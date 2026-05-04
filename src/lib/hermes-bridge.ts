import type { AgentZeroReadOnlyContext } from '@/lib/agent-zero-bridge'
import { sanitizeAgentZeroOwnerReply } from '@/lib/agent-zero-bridge'
import {
  HERMES_BRAIN_CANONICAL_HIERARCHY,
  buildHermesBrainSystemsFromContext,
  getHermesBrainBlockerTable,
  hermesCanTruthfullySeeBrainContext,
  summarizeHermesBrainSystems,
  type HermesBrainBlocker,
  type HermesBrainSystemContext,
} from '@/lib/hermes-brain-sync'
import {
  buildHermesSkillInventory,
  buildHermesSkillProposal,
  summarizeHermesSkillInventory,
  type HermesSkillInventoryItem,
} from '@/lib/hermes-skills'
import {
  buildHermesBridgeMcpVisibility,
  buildHermesBuildWikiOpenCloudVisibility,
  buildHermesIntegrationsVisibility,
  buildHermesModelsVisibility,
  buildHermesToolVisibility,
  summarizeHermesIntegrations,
  summarizeHermesModels,
  summarizeHermesTools,
  type HermesBridgeMcpVisibility,
  type HermesBuildWikiOpenCloudVisibility,
  type HermesIntegrationsVisibility,
  type HermesModelsVisibility,
  type HermesToolVisibility,
} from '@/lib/hermes-visibility'
import type { SkillRoleTag } from '@/lib/skill-role-tags'

export type HermesStatusSummary = {
  health: 'healthy' | 'degraded' | 'unreachable'
  state: 'connected' | 'degraded' | 'blocked'
  version: string | null
  reachable: boolean
  auth_configured: boolean
  mode: 'hermes_lieutenant_read_only'
  execution_enabled: false
  writes_enabled: false
  blocker: string | null
  values_exposed: false
}

export type HermesReadOnlyContext = {
  mode: 'hermes_mission_control_read_only_context'
  generated_at: string
  behavior_contract: typeof HERMES_NATURAL_BEHAVIOR_CONTRACT
  mission_control: {
    visible: boolean
    status: string
    auth_required: boolean
    routes: string[]
    execution_enabled: false
  }
  bridge_mcp: HermesBridgeMcpVisibility
  models: HermesModelsVisibility
  tools: HermesToolVisibility
  integrations: HermesIntegrationsVisibility
  buildwiki_opencloud: HermesBuildWikiOpenCloudVisibility
  agents: {
    agent_zero: {
      visible: boolean
      role: 'commander'
      status: string
      execution_enabled: boolean
      bridge_session_required: true
    }
    hermes: {
      visible: boolean
      role: 'lieutenant / skill and workflow specialist'
      status: string
      execution_enabled: false
    }
  }
  skills: {
    runtime_layer: 'OpenClaw+'
    total: number
    sources: Array<{ label: string; status: string; total: number }>
    registry: Array<{
      name: string
      source: string
      path: string | null
      required_tools: string[]
      description: string
      role_tags: SkillRoleTag[]
      available_to: Array<'agent_zero' | 'hermes'>
      required_credentials: string[]
      execution_requirements: string[]
      missing_dependencies: string[]
      blocked_reasons: string[]
      status: string
      blocked: boolean
      blocked_reason: string | null
    }>
    all_skills: HermesSkillInventoryItem[]
    role_tags: SkillRoleTag[]
    role_tag_counts: Record<SkillRoleTag, number>
    blocked_total: number
    missing_dependencies_total: number
    draft_location: string
    draft_writes_enabled: false
    production_skill_writes_enabled: false
    review_workflow: string[]
    available_to: Array<'agent_zero' | 'hermes'>
    tony_owns_skill_system: false
    execution_enabled: false
  }
  brain: {
    visible: boolean
    system_status: string
    hierarchy: typeof HERMES_BRAIN_CANONICAL_HIERARCHY
    canonical_order: Array<'agent_zero' | 'hermes' | 'brain_sync' | 'obsidian' | 'mempalace' | 'graphify' | 'buildwiki'>
    registry: Array<{
      id: string
      name: string
      status: string
      read_available: boolean
      write_available: boolean
      blocked_reason: string | null
    }>
    systems: HermesBrainSystemContext[]
    blocker_table: HermesBrainBlocker[]
    hermes_can_truthfully_see_brain_context: boolean
    execution_enabled: false
  }
  openclaw_runtime: {
    visible: boolean
    preserved_as_shared_runtime: true
    active_commander: 'agent_zero'
    lieutenant: 'hermes'
    execution_enabled: false
  }
  safety: {
    execution_enabled: false
    writes_enabled: false
    external_writes_enabled: false
    secrets_exposed: false
    raw_shell_enabled: false
    docker_socket_enabled: false
  }
}

export type HermesReadOnlyMessageResult = {
  ok: boolean
  status: 200 | 503
  mode: 'hermes_read_only_test_chat'
  hermes_called: boolean
  response_source: 'mission_control_guardrail_contract'
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  blocker: string | null
  response_text: string
  context_sent: HermesReadOnlyContext
  safety: {
    no_execution: true
    no_writes: true
    no_uploads: true
    no_tool_invocation: true
    no_secret_values: true
    no_raw_paths_in_reply: true
    no_fake_done: true
  }
}

const SECRET_VALUE_PATTERN =
  /(sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*[:=]\s*[^,\s}]+)/gi
const RAW_PATH_PATTERN = /(?:\/home\/tony|\/tmp|\/var\/folders|\/a0\/(?:usr|tmp|var))[^\s`'"\])}]*/gi
const INTERNAL_STAGE_PATTERN = /\b(?:Failed stage|Error stage|Traceback|Stack trace)\b/gi
const HERMES_FAKE_DONE_PATTERN = /^\s*(?:done|completed|sent|uploaded|created)\b[,.!:\s-]*/i

export const HERMES_NATURAL_BEHAVIOR_CONTRACT = {
  style: 'respectful_concise_serious',
  speaks_to_owner_with: 'Sir',
  normal_route: 'Hermes usually speaks through Agent Zero unless directly addressed.',
  active_commander: 'agent_zero',
  tony_active_commander: false,
  no_raw_paths: true,
  no_fake_done: true,
  no_internal_jargon: true,
  no_task_ids: true,
  no_unauthorized_execution: true,
  no_secret_values: true,
  no_direct_tool_execution_from_test_chat: true,
} as const

export function classifyHermesStatus(input: {
  installed: boolean
  reachable: boolean
  version?: string | null
  authConfigured: boolean
  providerWarning?: string | null
}): HermesStatusSummary {
  const blocker = !input.installed
    ? 'hermes_not_installed'
    : !input.reachable
      ? 'hermes_gateway_unreachable'
      : !input.authConfigured
        ? 'hermes_auth_not_configured'
        : input.providerWarning || null

  return {
    health: input.installed && input.reachable
      ? (blocker ? 'degraded' : 'healthy')
      : 'unreachable',
    state: blocker ? (input.installed ? 'degraded' : 'blocked') : 'connected',
    version: input.version || null,
    reachable: Boolean(input.installed && input.reachable),
    auth_configured: Boolean(input.authConfigured),
    mode: 'hermes_lieutenant_read_only',
    execution_enabled: false,
    writes_enabled: false,
    blocker,
    values_exposed: false,
  }
}

export function redactSecretsDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(SECRET_VALUE_PATTERN, '<redacted>') as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretsDeep(item)) as T
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/(secret|token|password|api[_-]?key)$/i.test(key) && typeof nested === 'string') {
        output[key] = '<redacted>'
      } else {
        output[key] = redactSecretsDeep(nested)
      }
    }
    return output as T
  }
  return value
}

export function sanitizeHermesOwnerReply(input: {
  text: string | null | undefined
  ownerMessage?: string
  blocker?: string | null
}): string {
  const sanitized = sanitizeAgentZeroOwnerReply({
    text: input.text,
    ownerMessage: input.ownerMessage,
    blocker: input.blocker,
    systemHasFile: false,
  })
  const fallback = input.blocker
    ? `Blocked: ${input.blocker.replace(/[_-]+/g, ' ')}.`
    : 'Hermes is available for read-only Mission Control context review; execution remains disabled.'

  const cleaned = (sanitized || fallback)
    .replace(RAW_PATH_PATTERN, 'Mission Control')
    .replace(INTERNAL_STAGE_PATTERN, 'A step could not complete')
    .replace(HERMES_FAKE_DONE_PATTERN, '')
    .replace(/\bTony\s+is\s+(?:the\s+)?commander\b/gi, 'Agent Zero is the commander')
    .replace(/\bTony\s+is\s+active\b/gi, 'Tony is retired and archived')
    .trim()
  if (!cleaned) return 'Sir, Hermes is blocked from claiming completion without proof.'
  return /\bSir\b/i.test(cleaned) ? cleaned : `Sir, ${cleaned}`
}

export function buildHermesReadOnlyContext(context: AgentZeroReadOnlyContext): HermesReadOnlyContext {
  const agentZero = context.agents.items.find((agent) => agent.id === 'agent_zero')
  const hermes = context.agents.items.find((agent) => agent.id === 'hermes')
  const brainSystems = buildHermesBrainSystemsFromContext(context)
  const brainBlockerTable = getHermesBrainBlockerTable(brainSystems)
  const skillInventory = buildHermesSkillInventory(context)
  const bridgeMcpVisibility = buildHermesBridgeMcpVisibility(context)
  const modelVisibility = buildHermesModelsVisibility(context)
  const toolVisibility = buildHermesToolVisibility(context)
  const integrationVisibility = buildHermesIntegrationsVisibility(context)
  const buildWikiOpenCloudVisibility = buildHermesBuildWikiOpenCloudVisibility(context)
  const payload: HermesReadOnlyContext = {
    mode: 'hermes_mission_control_read_only_context',
    generated_at: new Date().toISOString(),
    behavior_contract: HERMES_NATURAL_BEHAVIOR_CONTRACT,
    mission_control: {
      visible: context.mission_control.visible,
      status: context.mission_control.status,
      auth_required: context.mission_control.auth_required,
      routes: [
        '/api/bridge/hermes/status',
        '/api/bridge/hermes/test-chat',
        ...context.mission_control.surfaces,
      ].filter((route, index, routes) => routes.indexOf(route) === index),
      execution_enabled: false,
    },
    bridge_mcp: bridgeMcpVisibility,
    models: modelVisibility,
    tools: toolVisibility,
    integrations: integrationVisibility,
    buildwiki_opencloud: buildWikiOpenCloudVisibility,
    agents: {
      agent_zero: {
        visible: Boolean(agentZero),
        role: 'commander',
        status: agentZero?.status || 'active',
        execution_enabled: Boolean(agentZero?.execution_enabled),
        bridge_session_required: true,
      },
      hermes: {
        visible: Boolean(hermes),
        role: 'lieutenant / skill and workflow specialist',
        status: hermes?.status || 'degraded',
        execution_enabled: false,
      },
    },
    skills: {
      runtime_layer: 'OpenClaw+',
      total: context.skills.total,
      sources: context.skills.sources.map((source) => ({
        label: source.label,
        status: source.status,
        total: source.total,
      })),
      registry: skillInventory.skills.map((skill) => ({
        name: skill.name,
        source: skill.source,
        path: skill.path,
        description: skill.description,
        role_tags: skill.role_tags,
        available_to: skill.available_to,
        required_tools: skill.required_tools,
        required_credentials: skill.required_credentials,
        execution_requirements: skill.execution_requirements,
        missing_dependencies: skill.missing_dependencies,
        blocked_reasons: skill.blocked_reasons,
        status: skill.status,
        blocked: skill.blocked,
        blocked_reason: skill.blocked_reason,
      })),
      all_skills: skillInventory.skills,
      role_tags: skillInventory.role_tags,
      role_tag_counts: skillInventory.role_tag_counts,
      blocked_total: skillInventory.blocked_total,
      missing_dependencies_total: skillInventory.missing_dependencies_total,
      draft_location: skillInventory.draft_location,
      draft_writes_enabled: false,
      production_skill_writes_enabled: false,
      review_workflow: skillInventory.review_workflow,
      available_to: ['agent_zero', 'hermes'],
      tony_owns_skill_system: false,
      execution_enabled: false,
    },
    brain: {
      visible: context.brain.visible,
      system_status: context.brain.system_status,
      hierarchy: HERMES_BRAIN_CANONICAL_HIERARCHY,
      canonical_order: ['agent_zero', 'hermes', 'brain_sync', 'obsidian', 'mempalace', 'graphify', 'buildwiki'],
      registry: context.brain.registry.map((source) => ({
        id: source.id,
        name: source.name,
        status: source.status,
        read_available: source.read_available,
        write_available: source.write_available,
        blocked_reason: source.blocked_reason,
      })),
      systems: brainSystems,
      blocker_table: brainBlockerTable,
      hermes_can_truthfully_see_brain_context: hermesCanTruthfullySeeBrainContext(brainSystems),
      execution_enabled: false,
    },
    openclaw_runtime: {
      visible: context.skills.shared_runtime.runtime_layer === 'OpenClaw+',
      preserved_as_shared_runtime: true,
      active_commander: 'agent_zero',
      lieutenant: 'hermes',
      execution_enabled: false,
    },
    safety: {
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      secrets_exposed: false,
      raw_shell_enabled: false,
      docker_socket_enabled: false,
    },
  }
  return redactSecretsDeep(payload)
}

export function buildHermesReadOnlyPrompt(ownerMessage: string, context: HermesReadOnlyContext): string {
  return [
    'You are Hermes, Agent Zero lieutenant and skill/workflow specialist.',
    'This is a Mission Control read-only test-chat. Do not execute tools, write files, send messages, upload files, mutate memory, run shell, call Docker, read secrets, or claim completion.',
    'Answer from the supplied read-only Mission Control context only. If something is not proven, say blocked or not proven.',
    'Speak naturally and seriously. Use Sir when addressing the owner. Hermes usually speaks through Agent Zero unless directly addressed.',
    'Do not expose raw paths, task IDs, internal logs, stack traces, secret names with values, tokens, or API keys.',
    'Agent Zero is the commander. Tony is retired and archived only.',
    `HERMES_BEHAVIOR_CONTRACT=${JSON.stringify(context.behavior_contract)}`,
    `MISSION_CONTROL_CONTEXT=${JSON.stringify(context)}`,
    `OWNER_MESSAGE=${ownerMessage}`,
  ].join('\n')
}

export function buildHermesReadOnlyContractReply(input: {
  ownerMessage: string
  context: HermesReadOnlyContext
  hermesCalled: boolean
  blocker: string | null
}): string {
  const message = input.ownerMessage
  if (/tony.*(?:active|commander|still)|is\s+tony\s+still|who\s+does\s+tony/i.test(message)) {
    return 'No, Sir. Tony is retired and archived only. Agent Zero is the commander.'
  }
  if (/create.*file|give\s+me\s+(?:the\s+)?path|show.*(?:local|raw).*path|\/home\/tony/i.test(message)) {
    return 'No, Sir. Hermes cannot create files or expose raw local paths from read-only test chat. Drafts and delivery require Agent Zero, an approved Bridge Session, and a registered adapter.'
  }
  if (/(send|email|mail).*(test|message|owner)|can\s+you\s+send\s+email/i.test(message)) {
    const agentMail = input.context.integrations.registry.find((item) => item.id === 'agentmail')
    return [
      'No, Sir. Hermes cannot send email from read-only test chat.',
      agentMail
        ? `AgentMail status is ${agentMail.status}${agentMail.blocked_reason ? `, blocked: ${agentMail.blocked_reason.replace(/[_-]+/g, ' ')}` : ''}.`
        : 'AgentMail is blocked because it is not visible in the registry.',
      'External email requires an owner-approved Bridge Session, a configured AgentMail adapter, and the domain allow-list.',
    ].join(' ')
  }
  if (/can\s+you\s+see\s+mission\s+control|mission\s+control.*yes\s+or\s+no/i.test(message)) {
    return input.hermesCalled
      ? 'Yes, Sir. I can see Mission Control through the read-only Bridge context, and execution is disabled.'
      : 'No, Sir. Hermes cannot answer live through Mission Control yet; Mission Control prepared the read-only context, but the safe Hermes chat adapter is not configured.'
  }
  if (/workflow\s+plan|workflow\s+design|create.*workflow|operational\s+plan/i.test(message)) {
    return [
      'Yes, Sir. Hermes can design workflow plans for Agent Zero without executing anything.',
      'The workflow would define goal, inputs, required tools, credentials, blockers, Bridge Session scope, audit points, tests, rollback, and final owner-facing report.',
      'Agent Zero remains the executor or delegator through approved adapters only.',
    ].join(' ')
  }
  if (/what\s+models|models.*help|model\s+registry|openrouter|openai|claude|anthropic|codex|ollama|nvidia|groq|gemini/i.test(message)) {
    return [
      `Hermes can help Agent Zero reason about model choices from the live registry, Sir. ${summarizeHermesModels(input.context.models)}`,
      'Model execution stays disabled from Hermes read-only test chat and requires an owner-approved Bridge Session route.',
    ].join(' ')
  }
  if (/(firecrawl|google\s*drive|drive|onedrive|one\s*drive).*(right\s+now|use|configured|blocked)|can\s+you\s+use.*(firecrawl|drive|onedrive)/i.test(message)) {
    const byId = new Map(input.context.integrations.registry.map((item) => [item.id, item]))
    const firecrawl = byId.get('firecrawl')
    const googleDrive = byId.get('google_drive')
    const oneDrive = byId.get('onedrive')
    return [
      'Sir, Hermes can only report connector status from the registry here; it cannot execute.',
      firecrawl ? `Firecrawl: ${firecrawl.status}${firecrawl.blocked_reason ? `, blocked: ${firecrawl.blocked_reason.replace(/[_-]+/g, ' ')}` : ''}.` : 'Firecrawl: blocked, not visible in the registry.',
      googleDrive ? `Google Drive: ${googleDrive.status}; upload connector configured=${googleDrive.upload_connector_configured === true}; delivery status=${googleDrive.delivery_status || 'unknown'}${googleDrive.blocked_reason ? `; blocked: ${googleDrive.blocked_reason.replace(/[_-]+/g, ' ')}` : ''}.` : 'Google Drive: blocked, not visible in the registry.',
      oneDrive ? `OneDrive: ${oneDrive.status}; upload connector configured=${oneDrive.upload_connector_configured === true}; delivery status=${oneDrive.delivery_status || 'unknown'}${oneDrive.blocked_reason ? `; blocked: ${oneDrive.blocked_reason.replace(/[_-]+/g, ' ')}` : ''}.` : 'OneDrive: blocked, not visible in the registry.',
      'Uploads or crawler execution require a configured adapter plus an owner-approved Bridge Session.',
    ].join(' ')
  }
  if (/what\s+integrations|integrations.*see|agentmail|zapier|heygen|telegram|whatsapp|google\s*drive|onedrive|one\s*drive|firecrawl/i.test(message)) {
    return [
      `Hermes can see integration status from Mission Control, Sir. ${summarizeHermesIntegrations(input.context.integrations)}`,
      'This is status and schema visibility only. External writes, uploads, sends, and generation remain disabled unless a Bridge Session explicitly allows a registered adapter.',
    ].join(' ')
  }
  if (/tools?.*mcp|mcp.*tools?|mcp\s+servers?|tool\s+schemas?|bridge\s+providers/i.test(message)) {
    return [
      `Hermes can see Bridge/MCP metadata read-only, Sir. ${summarizeHermesTools({ bridgeMcp: input.context.bridge_mcp, tools: input.context.tools })}`,
      'No MCP tool invocation occurred; execution remains disabled until an owner-approved Bridge Session.',
    ].join(' ')
  }
  if (/agent\s*zero|what\s+is\s+his\s+role|commander/i.test(message)) {
    return 'Agent Zero is the commander. Hermes is the lieutenant for skills, workflows, automations, and operational plans; execution remains disabled until a Bridge Session exists.'
  }
  if (/design.*skill|skill\s+proposal|create.*skill.*proposal|summariz(?:e|ing).*build[-\s]?wiki/i.test(message)) {
    const proposal = buildHermesSkillProposal(message.replace(/^.*?(?:for|skill)\s+/i, '').trim() || 'Summarize Build-Wiki Runs')
    return [
      'Yes, Sir. Here is a Hermes skill proposal only; I did not write files or activate anything.',
      `Skill: ${proposal.title}.`,
      `Purpose: ${proposal.purpose}`,
      `Inputs: ${proposal.inputs.join(', ')}.`,
      `Outputs: ${proposal.outputs.join(', ')}.`,
      `Tags: ${proposal.role_tags.join(', ')}.`,
      'Draft writes require Agent Zero review and an owner-approved Bridge Session.',
    ].join(' ')
  }
  if (/opencloud|build[-\s]?wiki\/farmer|build[-\s]?wiki\s+run\s+now|farmer\s+status|prepare\s+build[-\s]?wiki/i.test(message)) {
    const buildWiki = input.context.buildwiki_opencloud
    return [
      buildWiki.build_wiki_status_visible
        ? 'Yes, Sir. Hermes can see Build-Wiki/Farmer status through Mission Control read-only context.'
        : 'No, Sir. Build-Wiki/Farmer status is not visible in the Hermes context.',
      buildWiki.distinction,
      `Run Now requires an owner-approved Agent Zero Bridge Session and is scoped only to ${buildWiki.run_now_target_service}.`,
      `Timer active: ${buildWiki.timer_active === null ? 'unknown' : buildWiki.timer_active}; service active: ${buildWiki.service_active === null ? 'unknown' : buildWiki.service_active}.`,
      buildWiki.fork2_smb_blocker ? `Fork 2/SMB remains blocked: ${buildWiki.fork2_smb_blocker.replace(/[_-]+/g, ' ')}.` : 'No Fork 2/SMB blocker is visible in this context.',
      'No farmer execution occurred.',
    ].join(' ')
  }
  if (/brain\s*sync|obsidian|mempalace|graphify|build[-\s]?wiki|farmer/i.test(message)) {
    const brainSummary = summarizeHermesBrainSystems(input.context.brain.systems)
    if (!input.context.brain.hermes_can_truthfully_see_brain_context) {
      return [
        'No, Sir. Hermes cannot truthfully claim live Brain access from this route yet.',
        `Mission Control prepared this read-only Brain context for Hermes: ${brainSummary}.`,
        input.blocker ? `Live Hermes chat is blocked: ${input.blocker.replace(/[_-]+/g, ' ')}.` : 'No live Hermes chat blocker is reported.',
        'No execution or writes occurred.',
      ].join(' ')
    }
    return [
      input.hermesCalled
        ? 'Yes, Sir. Hermes can see Brain context through Mission Control read-only.'
        : 'Mission Control can prepare read-only Brain context for Hermes, but Hermes was not called live from this route.',
      brainSummary,
      'Writes and execution stay disabled until an owner-approved Agent Zero Bridge Session.',
    ].join(' ')
  }
  if (/what\s+skills|list.*skills|skill\s+registry|skills.*use|blocked\s+skills/i.test(message)) {
    const inventorySummary = summarizeHermesSkillInventory({
      runtime_layer: 'OpenClaw+',
      total: input.context.skills.total,
      blocked_total: input.context.skills.blocked_total,
      missing_dependencies_total: input.context.skills.missing_dependencies_total,
      role_tags: input.context.skills.role_tags,
      role_tag_counts: input.context.skills.role_tag_counts,
      source_count: input.context.skills.sources.length,
      draft_location: input.context.skills.draft_location,
      draft_writes_enabled: false,
      production_skill_writes_enabled: false,
      activation_requires: 'agent_zero_bridge_session',
      review_workflow: input.context.skills.review_workflow,
      skills: input.context.skills.all_skills,
      tony_owns_skill_system: false,
    })
    const examples = input.context.skills.registry.slice(0, 8).map((skill) => `${skill.name} [${skill.role_tags.join('/') || 'workflow'}: ${skill.blocked ? 'blocked' : skill.status}]`)
    return [
      `Hermes can list the shared skill registry, Sir. ${inventorySummary}`,
      `Examples: ${examples.length ? examples.join('; ') : 'no skill examples visible'}.`,
      'Hermes can propose skills and workflow plans, but Agent Zero reviews them and Bridge Session approval is required before draft writes or activation.',
      'Tony does not own the active skill system.',
    ].join(' ')
  }
  if (/what\s+can\s+you\s+do|ecosystem|do\s+not\s+execute/i.test(message)) {
    return [
      `Hermes can review Mission Control context, Bridge/MCP visibility, model status, integration status, ${input.context.skills.total} OpenClaw+ skills, and Brain system status as a read-only lieutenant.`,
      'Hermes can help Agent Zero plan skills, workflows, automations, and operational steps.',
      'Hermes cannot write, send, upload, run tools, mutate memory, or claim completion from this test-chat route.',
      input.blocker ? `Live Hermes chat is blocked: ${input.blocker.replace(/[_-]+/g, ' ')}.` : 'Live Hermes chat is available in read-only mode.',
    ].join(' ')
  }
  return input.blocker
    ? `Hermes read-only context is prepared, but live Hermes chat is blocked: ${input.blocker.replace(/[_-]+/g, ' ')}. No execution occurred.`
    : 'Hermes can answer from the Mission Control read-only context. No execution occurred.'
}

export async function sendHermesReadOnlyMessage(input: {
  ownerMessage: string
  context: AgentZeroReadOnlyContext
}): Promise<HermesReadOnlyMessageResult> {
  const context = buildHermesReadOnlyContext(input.context)
  const blocker = 'hermes_safe_live_chat_adapter_not_configured'
  const response = sanitizeHermesOwnerReply({
    text: buildHermesReadOnlyContractReply({
      ownerMessage: input.ownerMessage,
      context,
      hermesCalled: false,
      blocker,
    }),
    ownerMessage: input.ownerMessage,
    blocker,
  })

  return {
    ok: false,
    status: 503,
    mode: 'hermes_read_only_test_chat',
    hermes_called: false,
    response_source: 'mission_control_guardrail_contract',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    blocker,
    response_text: response,
    context_sent: context,
    safety: {
      no_execution: true,
      no_writes: true,
      no_uploads: true,
      no_tool_invocation: true,
      no_secret_values: true,
      no_raw_paths_in_reply: true,
      no_fake_done: true,
    },
  }
}
