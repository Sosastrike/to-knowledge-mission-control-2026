import { createHash, randomUUID } from 'node:crypto'
import type { AgentZeroReadOnlyContext } from '@/lib/agent-zero-bridge'
import { sanitizeAgentZeroOwnerReply } from '@/lib/agent-zero-bridge'
import { buildHermesReadOnlyContext, sanitizeHermesOwnerReply } from '@/lib/hermes-bridge'
import { buildHermesSkillProposal } from '@/lib/hermes-skills'

export const AGENT_ZERO_HERMES_HANDOFF_ROUTE = '/api/bridge/agent-zero/hermes-handoff'

export const HERMES_COLLABORATION_TASK_TYPES = [
  'skill_design',
  'workflow_plan',
  'automation_plan',
  'integration_mapping',
  'failure_analysis',
  'docs_report_outline',
] as const

export type HermesCollaborationTaskType = (typeof HERMES_COLLABORATION_TASK_TYPES)[number]

export const HERMES_FORBIDDEN_TASKS = [
  'direct_external_write',
  'raw_root_shell',
  'secret_read',
  'unapproved_execution',
  'docker_socket',
  'arbitrary_filesystem',
] as const

export type HermesCollaborationStatus = 'completed' | 'blocked' | 'timeout'

export type HermesCollaborationAuditEvent = {
  action: 'agent_zero.hermes_handoff'
  actor: 'agent_zero'
  target_type: 'hermes_collaboration'
  detail: Record<string, unknown>
}

export type HermesCollaborationPlan = {
  title: string
  task_type: HermesCollaborationTaskType
  summary: string
  steps: string[]
  acceptance_checks: string[]
  blockers: string[]
  execution_enabled: false
  writes_enabled: false
  bridge_session_required_for_execution: true
}

export type AgentZeroHermesCollaborationResult = {
  ok: boolean
  status: HermesCollaborationStatus
  http_status: number
  mode: 'agent_zero_hermes_collaboration_protocol'
  route: typeof AGENT_ZERO_HERMES_HANDOFF_ROUTE
  communication_protocol: {
    requester: 'agent_zero'
    responder: 'hermes'
    response_kind: 'plan_spec_recommendation'
    no_direct_execution: true
    no_external_writes: true
    no_secret_reads: true
    no_raw_paths: true
    no_fake_access: true
  }
  task_type: HermesCollaborationTaskType | null
  supported_task_types: HermesCollaborationTaskType[]
  forbidden_tasks: typeof HERMES_FORBIDDEN_TASKS
  hermes_called: boolean
  hermes_contract_plan_prepared: boolean
  live_hermes_adapter_required: boolean
  hermes_response_source: 'mission_control_hermes_contract' | 'blocked'
  hermes_reachable: boolean
  accepted_for_handoff: boolean
  execution_enabled: false
  writes_enabled: false
  request_id_tracked: boolean
  agent_zero_task_id_tracked: boolean
  hermes_response_id_tracked: boolean
  raw_ids_exposed_to_owner: false
  owner_visible_reference: string
  loop_guard: {
    max_depth: 2
    depth: number
    loop_detected: boolean
    blocked: boolean
  }
  timeout_ms: number
  timed_out: boolean
  plan: HermesCollaborationPlan | null
  hermes_reply: string
  agent_zero_review: {
    usable: boolean
    summary: string
    revision_available: boolean
  }
  report_contribution: {
    mention_hermes: boolean
    summary: string
  }
  audit: {
    attempted: true
    recorded: boolean
    action: 'agent_zero.hermes_handoff'
    raw_ids_stored_in_audit_only: boolean
  }
  owner_reply: string
  blocked_reason: string | null
}

type InternalCorrelation = {
  request_id: string
  agent_zero_task_id: string | null
  hermes_response_id: string
  owner_visible_reference: string
}

export type AgentZeroHermesCollaborationInput = {
  context: AgentZeroReadOnlyContext
  taskType: HermesCollaborationTaskType | string
  prompt: string
  agentZeroTaskId?: string | null
  previousHermesResponseId?: string | null
  agentChain?: string[]
  handoffDepth?: number
  timeoutMs?: number
  now?: Date
  hermesReachable?: boolean
  hermesResponder?: (input: {
    taskType: HermesCollaborationTaskType
    prompt: string
    context: AgentZeroReadOnlyContext
    correlation: InternalCorrelation
  }) => Promise<HermesCollaborationPlan>
  auditRecorder?: (event: HermesCollaborationAuditEvent) => void
}

const DEFAULT_TIMEOUT_MS = 3000
const MAX_HANDOFF_DEPTH = 2
const FORBIDDEN_PROMPT_RE = /\b(?:sudo|root\s+shell|docker\s+socket|cat\s+.*(?:secret|token|auth|\.env)|print\s+(?:token|secret|api\s*key)|external\s+write|upload\s+now|send\s+now|execute\s+now|run\s+shell|read\s+secrets?)\b/i
const RAW_PATH_RE = /(?:\/home\/tony|\/tmp|\/var\/folders|\/a0\/(?:usr|tmp|var)|runtime\/[A-Za-z0-9._/-]+)/gi
const RAW_ID_RE = /\b(?:azht|hermes|task|response|request)[_-][a-f0-9]{8,}\b/gi

function stableHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

function makeInternalCorrelation(input: {
  taskType: string
  prompt: string
  agentZeroTaskId?: string | null
  now: Date
}): InternalCorrelation {
  const seed = `${input.taskType}:${input.prompt}:${input.agentZeroTaskId || ''}:${input.now.toISOString()}:${randomUUID()}`
  return {
    request_id: `azht_${stableHash(`${seed}:request`)}`,
    agent_zero_task_id: input.agentZeroTaskId || null,
    hermes_response_id: `hermes_${stableHash(`${seed}:response`)}`,
    owner_visible_reference: `Hermes handoff ${stableHash(seed).slice(0, 6).toUpperCase()}`,
  }
}

function normalizeTaskType(value: string): HermesCollaborationTaskType | null {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return (HERMES_COLLABORATION_TASK_TYPES as readonly string[]).includes(normalized)
    ? normalized as HermesCollaborationTaskType
    : null
}

function safeOwnerText(text: string, ownerMessage = ''): string {
  const sanitized = sanitizeAgentZeroOwnerReply({
    text,
    ownerMessage,
    blocker: null,
    systemHasFile: false,
  }) || text
  return sanitized
    .replace(RAW_PATH_RE, 'Mission Control')
    .replace(RAW_ID_RE, 'handoff reference')
    .replace(/\s+/g, ' ')
    .trim()
}

function hermesAvailableFromContext(context: AgentZeroReadOnlyContext): boolean {
  const hermes = context.agents.items.find((agent) => agent.id === 'hermes')
  if (!hermes) return false
  return !/\b(?:offline|not_connected|missing|blocked|not_installed)\b/i.test(hermes.status || '')
}

function basePlan(taskType: HermesCollaborationTaskType, prompt: string, context: AgentZeroReadOnlyContext): HermesCollaborationPlan {
  const hermesContext = buildHermesReadOnlyContext(context)
  const skillCount = hermesContext.skills.total
  const integrationCount = hermesContext.integrations.registry.length
  const mcpCount = hermesContext.bridge_mcp.mcp_servers.length
  const topic = prompt.replace(/\s+/g, ' ').trim().slice(0, 120) || taskType.replace(/_/g, ' ')

  const commonChecks = [
    'Agent Zero reviews the recommendation before use.',
    'No tool execution occurs during Hermes planning.',
    'Any write/send/upload/run action requires an owner-approved Bridge Session.',
    'Blocked connectors are reported honestly.',
  ]

  if (taskType === 'skill_design') {
    const proposal = buildHermesSkillProposal(topic)
    return {
      title: proposal.title,
      task_type: taskType,
      summary: `Hermes proposes a skill for ${topic}. The proposal is draft-only and uses the shared OpenClaw+ skill registry context.`,
      steps: [
        `Define the skill purpose: ${proposal.purpose}`,
        `Declare inputs: ${proposal.inputs.join(', ')}.`,
        `Declare outputs: ${proposal.outputs.join(', ')}.`,
        `Tag the skill as: ${proposal.role_tags.join(', ')}.`,
        'Submit to Agent Zero for review before any file write or activation.',
      ],
      acceptance_checks: [...commonChecks, 'Skill activation remains disabled until Agent Zero Bridge Session approval.'],
      blockers: skillCount > 0 ? [] : ['shared_skill_registry_not_visible'],
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required_for_execution: true,
    }
  }

  if (taskType === 'workflow_plan') {
    return {
      title: `Workflow plan for ${topic}`,
      task_type: taskType,
      summary: 'Hermes lays out a workflow for Agent Zero to review and execute through registered adapters only.',
      steps: [
        'Clarify owner goal, required output, delivery surface, and blockers.',
        'Check Bridge/MCP, model, skill, integration, and Brain registry state.',
        'Select read-only discovery first, then identify any Bridge Session scope needed.',
        'Define verification, owner-facing result, rollback, and audit points.',
      ],
      acceptance_checks: commonChecks,
      blockers: [],
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required_for_execution: true,
    }
  }

  if (taskType === 'automation_plan') {
    return {
      title: `Automation plan for ${topic}`,
      task_type: taskType,
      summary: 'Hermes maps a safe automation design without enabling or running it.',
      steps: [
        'Identify trigger, inputs, idempotency guard, and failure mode.',
        'Map required MCP/tools/integrations and mark missing credentials.',
        'Define dry-run behavior and approval boundary.',
        'Require Agent Zero Bridge Session before any write or external execution.',
      ],
      acceptance_checks: commonChecks,
      blockers: integrationCount > 0 ? [] : ['integration_registry_not_visible'],
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required_for_execution: true,
    }
  }

  if (taskType === 'integration_mapping') {
    return {
      title: `Integration map for ${topic}`,
      task_type: taskType,
      summary: 'Hermes maps visible/configured/blocked integrations for Agent Zero.',
      steps: [
        `Review ${integrationCount} integration records and ${mcpCount} MCP server records.`,
        'Separate read-only schema visibility from write-enabled adapters.',
        'List missing credentials and blocked connector reasons.',
        'Define which actions require Bridge Session approval.',
      ],
      acceptance_checks: commonChecks,
      blockers: integrationCount > 0 || mcpCount > 0 ? [] : ['bridge_mcp_or_integration_registry_not_visible'],
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required_for_execution: true,
    }
  }

  if (taskType === 'failure_analysis') {
    return {
      title: `Failure analysis for ${topic}`,
      task_type: taskType,
      summary: 'Hermes provides a read-only failure-analysis structure for Agent Zero.',
      steps: [
        'State the observed failure without guessing.',
        'Identify expected behavior, actual behavior, affected registry/adapters, and evidence gaps.',
        'Propose narrow fixes and regression tests.',
        'Define a no-fake-completion owner response for blocked cases.',
      ],
      acceptance_checks: commonChecks,
      blockers: [],
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required_for_execution: true,
    }
  }

  return {
    title: `Report outline for ${topic}`,
    task_type: taskType,
    summary: 'Hermes drafts a docs/report outline for Agent Zero to review.',
    steps: [
      'Start with executive summary and decision state.',
      'List completed work, blocked work, tests, services, security confirmation, commits, and rollback.',
      'Separate live-verified facts from planned or blocked items.',
      'Keep owner-facing delivery free of raw local paths and internal IDs.',
    ],
    acceptance_checks: commonChecks,
    blockers: [],
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required_for_execution: true,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<{ timedOut: false; value: T } | { timedOut: true }> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise.then((value) => ({ timedOut: false as const, value })),
      new Promise<{ timedOut: true }>((resolve) => {
        timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function planToHermesReply(plan: HermesCollaborationPlan): string {
  return [
    `${plan.title}.`,
    plan.summary,
    `Plan: ${plan.steps.join(' ')}`,
    `Checks: ${plan.acceptance_checks.join(' ')}`,
    plan.blockers.length ? `Blockers: ${plan.blockers.join(', ')}.` : 'Blockers: none visible from the read-only context.',
    'No execution occurred.',
  ].join(' ')
}

function blockedResult(input: {
  taskType: HermesCollaborationTaskType | null
  prompt: string
  correlation: InternalCorrelation
  reason: string
  httpStatus?: number
  depth: number
  loopDetected?: boolean
  hermesReachable?: boolean
  auditRecorded: boolean
}): AgentZeroHermesCollaborationResult {
  const ownerReply = safeOwnerText(`Hermes is blocked: ${input.reason.replace(/[_-]+/g, ' ')}. Agent Zero should continue without Hermes or ask again after the blocker is fixed.`, input.prompt)
  return {
    ok: false,
    status: 'blocked',
    http_status: input.httpStatus || 409,
    mode: 'agent_zero_hermes_collaboration_protocol',
    route: AGENT_ZERO_HERMES_HANDOFF_ROUTE,
    communication_protocol: {
      requester: 'agent_zero',
      responder: 'hermes',
      response_kind: 'plan_spec_recommendation',
      no_direct_execution: true,
      no_external_writes: true,
      no_secret_reads: true,
      no_raw_paths: true,
      no_fake_access: true,
    },
    task_type: input.taskType,
    supported_task_types: [...HERMES_COLLABORATION_TASK_TYPES],
    forbidden_tasks: HERMES_FORBIDDEN_TASKS,
    hermes_called: false,
    hermes_contract_plan_prepared: false,
    live_hermes_adapter_required: true,
    hermes_response_source: 'blocked',
    hermes_reachable: Boolean(input.hermesReachable),
    accepted_for_handoff: false,
    execution_enabled: false,
    writes_enabled: false,
    request_id_tracked: true,
    agent_zero_task_id_tracked: Boolean(input.correlation.agent_zero_task_id),
    hermes_response_id_tracked: true,
    raw_ids_exposed_to_owner: false,
    owner_visible_reference: input.correlation.owner_visible_reference,
    loop_guard: {
      max_depth: MAX_HANDOFF_DEPTH,
      depth: input.depth,
      loop_detected: Boolean(input.loopDetected),
      blocked: Boolean(input.loopDetected),
    },
    timeout_ms: DEFAULT_TIMEOUT_MS,
    timed_out: false,
    plan: null,
    hermes_reply: ownerReply,
    agent_zero_review: {
      usable: false,
      summary: `Blocked: ${input.reason.replace(/[_-]+/g, ' ')}.`,
      revision_available: false,
    },
    report_contribution: {
      mention_hermes: false,
      summary: 'Hermes did not contribute because the handoff was blocked.',
    },
    audit: {
      attempted: true,
      recorded: input.auditRecorded,
      action: 'agent_zero.hermes_handoff',
      raw_ids_stored_in_audit_only: true,
    },
    owner_reply: ownerReply,
    blocked_reason: input.reason,
  }
}

function recordAudit(input: {
  recorder?: (event: HermesCollaborationAuditEvent) => void
  correlation: InternalCorrelation
  taskType: HermesCollaborationTaskType | null
  status: HermesCollaborationStatus
  blockedReason: string | null
  prompt: string
  depth: number
  hermesCalled: boolean
}): boolean {
  if (!input.recorder) return false
  input.recorder({
    action: 'agent_zero.hermes_handoff',
    actor: 'agent_zero',
    target_type: 'hermes_collaboration',
    detail: {
      request_id: input.correlation.request_id,
      agent_zero_task_id: input.correlation.agent_zero_task_id,
      hermes_response_id: input.correlation.hermes_response_id,
      owner_visible_reference: input.correlation.owner_visible_reference,
      task_type: input.taskType,
      status: input.status,
      blocked_reason: input.blockedReason,
      prompt_hash: stableHash(input.prompt),
      handoff_depth: input.depth,
      hermes_called: input.hermesCalled,
      raw_ids_exposed_to_owner: false,
      no_execution: true,
      no_external_writes: true,
    },
  })
  return true
}

export async function requestAgentZeroHermesCollaboration(input: AgentZeroHermesCollaborationInput): Promise<AgentZeroHermesCollaborationResult> {
  const now = input.now || new Date()
  const timeoutMs = Math.max(100, Math.min(input.timeoutMs || DEFAULT_TIMEOUT_MS, 30000))
  const prompt = String(input.prompt || '').trim().slice(0, 4000)
  const taskType = normalizeTaskType(String(input.taskType || ''))
  const depth = Math.max(0, Number(input.handoffDepth || 0))
  const chain = (input.agentChain || ['agent_zero']).map((agent) => String(agent).toLowerCase())
  const correlation = makeInternalCorrelation({
    taskType: String(input.taskType || ''),
    prompt,
    agentZeroTaskId: input.agentZeroTaskId || null,
    now,
  })

  const loopDetected = depth >= MAX_HANDOFF_DEPTH || chain.filter((agent) => agent === 'hermes').length > 1
  const hermesReachable = input.hermesReachable ?? hermesAvailableFromContext(input.context)

  const block = (reason: string, httpStatus?: number) => {
    const auditRecorded = recordAudit({
      recorder: input.auditRecorder,
      correlation,
      taskType,
      status: 'blocked',
      blockedReason: reason,
      prompt,
      depth,
      hermesCalled: false,
    })
    return blockedResult({
      taskType,
      prompt,
      correlation,
      reason,
      httpStatus,
      depth,
      loopDetected,
      hermesReachable,
      auditRecorded,
    })
  }

  if (!taskType) return block('unsupported_hermes_task_type', 400)
  if (!prompt) return block('prompt_required', 400)
  if (FORBIDDEN_PROMPT_RE.test(prompt)) return block('hermes_forbidden_task_requested', 403)
  if (loopDetected) return block('agent_zero_hermes_loop_guard_triggered', 409)
  if (!hermesReachable) return block('hermes_unreachable_or_not_proven', 503)

  const responder = input.hermesResponder || (async () => basePlan(taskType, prompt, input.context))
  const timed = await withTimeout(responder({ taskType, prompt, context: input.context, correlation }), timeoutMs)
  if (timed.timedOut) {
    const auditRecorded = recordAudit({
      recorder: input.auditRecorder,
      correlation,
      taskType,
      status: 'timeout',
      blockedReason: 'hermes_handoff_timeout',
      prompt,
      depth,
      hermesCalled: false,
    })
    const result = blockedResult({
      taskType,
      prompt,
      correlation,
      reason: 'hermes_handoff_timeout',
      httpStatus: 504,
      depth,
      hermesReachable,
      auditRecorded,
    })
    return { ...result, status: 'timeout', timed_out: true, timeout_ms: timeoutMs }
  }

  const plan = timed.value
  const hermesReply = sanitizeHermesOwnerReply({
    text: planToHermesReply(plan),
    ownerMessage: prompt,
    blocker: null,
  })
  const safeReply = safeOwnerText(hermesReply, prompt)
  const auditRecorded = recordAudit({
    recorder: input.auditRecorder,
    correlation,
    taskType,
    status: 'completed',
    blockedReason: plan.blockers[0] || null,
    prompt,
    depth,
      hermesCalled: false,
    })

  return {
    ok: true,
    status: 'completed',
    http_status: 200,
    mode: 'agent_zero_hermes_collaboration_protocol',
    route: AGENT_ZERO_HERMES_HANDOFF_ROUTE,
    communication_protocol: {
      requester: 'agent_zero',
      responder: 'hermes',
      response_kind: 'plan_spec_recommendation',
      no_direct_execution: true,
      no_external_writes: true,
      no_secret_reads: true,
      no_raw_paths: true,
      no_fake_access: true,
    },
    task_type: taskType,
    supported_task_types: [...HERMES_COLLABORATION_TASK_TYPES],
    forbidden_tasks: HERMES_FORBIDDEN_TASKS,
    hermes_called: false,
    hermes_contract_plan_prepared: true,
    live_hermes_adapter_required: true,
    hermes_response_source: 'mission_control_hermes_contract',
    hermes_reachable: hermesReachable,
    accepted_for_handoff: true,
    execution_enabled: false,
    writes_enabled: false,
    request_id_tracked: true,
    agent_zero_task_id_tracked: Boolean(correlation.agent_zero_task_id),
    hermes_response_id_tracked: true,
    raw_ids_exposed_to_owner: false,
    owner_visible_reference: correlation.owner_visible_reference,
    loop_guard: {
      max_depth: MAX_HANDOFF_DEPTH,
      depth,
      loop_detected: false,
      blocked: false,
    },
    timeout_ms: timeoutMs,
    timed_out: false,
    plan,
    hermes_reply: safeReply,
    agent_zero_review: {
      usable: plan.blockers.length === 0,
      summary: plan.blockers.length
        ? `Agent Zero can use this as a contract draft after resolving: ${plan.blockers.join(', ')}. Live Hermes runtime remains blocked until the safe adapter is proven.`
        : 'Agent Zero reviewed the contract draft and it is usable as a planning/specification artifact. Live Hermes runtime remains blocked until the safe adapter is proven.',
      revision_available: true,
    },
    report_contribution: {
      mention_hermes: true,
      summary: `Mission Control prepared a Hermes ${taskType.replace(/_/g, ' ')} contract recommendation for Agent Zero review. Live Hermes runtime was not called.`,
    },
    audit: {
      attempted: true,
      recorded: auditRecorded,
      action: 'agent_zero.hermes_handoff',
      raw_ids_stored_in_audit_only: true,
    },
    owner_reply: safeOwnerText(`Mission Control prepared the Hermes ${taskType.replace(/_/g, ' ')} contract plan for Agent Zero review. Live Hermes runtime is still blocked until the safe adapter is proven. No execution occurred.`, prompt),
    blocked_reason: plan.blockers[0] || 'hermes_safe_live_chat_adapter_not_configured',
  }
}

export function ownerSafeAgentZeroHermesResponse(result: AgentZeroHermesCollaborationResult): Omit<AgentZeroHermesCollaborationResult, 'owner_visible_reference'> & {
  owner_visible_reference: string
  internal_ids_returned: false
} {
  return {
    ...result,
    owner_visible_reference: result.owner_visible_reference,
    internal_ids_returned: false,
  }
}
