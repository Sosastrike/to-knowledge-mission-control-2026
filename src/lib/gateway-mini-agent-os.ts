import {
  createGatewayFlow,
  getGatewayRoleMatrixEntry,
  type GatewayFlow,
  type GatewayFlowRouteDecision,
  type GatewayRegistry,
  type GatewaySelectedRoute,
  type GatewayStatus,
} from './gateway-model'

export const GATEWAY_MINI_AGENT_SUPERVISORS = ['agent_zero', 'hermes', 'pi'] as const

export type GatewayMiniAgentSupervisor = (typeof GATEWAY_MINI_AGENT_SUPERVISORS)[number]

export type GatewayMiniAgentRouteMode = 'proposal_only' | 'supervised_runtime_pending_bridge_session'

export type GatewayMiniAgentProposalInput = {
  name?: string | null
  purpose?: string | null
  parent_supervisor?: string | null
  scope?: string | string[] | null
  memory_ttl_hours?: number | null
  requested_by?: string | null
  reusable?: boolean | null
  bridge_session_id?: string | null
  allowed_capabilities?: string[] | null
}

export type GatewayMiniAgentPolicy = {
  supervisor_required: true
  scope_required: true
  memory_ttl_required: true
  audit_required: true
  bridge_session_required_for_activation: true
  agent_zero_command_authority_required: true
  no_independent_action: true
  no_unrestricted_root_shell: true
  no_docker_socket: true
  no_direct_secret_access: true
  no_external_writes_without_bridge_session: true
  no_second_agent_zero: true
  openclaw_plus_retained_as_runtime: true
}

export type GatewayMiniAgentRole = {
  id: string
  label: string
  role: string
  authority: string
  can_create_proposals: boolean
  can_supervise: boolean
  can_execute: false
  notes: string
}

export type GatewayMiniAgentRoute = {
  id: string
  source: string
  target: string
  mode: GatewayMiniAgentRouteMode
  hops: string[]
  supervisor: GatewayMiniAgentSupervisor
  command_authority: 'agent_zero'
  requires_bridge_session: boolean
  execution_enabled: false
  writes_enabled: false
  audit_required: true
  blocked_reason: string | null
}

export type GatewayMiniAgentOperatingSystem = {
  ok: true
  mode: 'gateway_mini_agent_os_read_only'
  generated_at: string
  hierarchy: {
    owner: 'final_authority'
    gateway: 'routing_policy_documentation_memory_audit_hub'
    agent_zero: 'commander'
    hermes: 'lieutenant_skill_workflow_builder'
    pi: 'dispatcher_candidate_route_optimizer_tool_use_advisor'
    space_agent: 'browser_web_youtube_research'
    mini_agents: 'temporary_or_reusable_subordinate_workers'
    openclaw_plus: 'runtime_skills_adapters_reports_layer'
    bridge_mcp: 'tools_models_integrations_access_layer'
    brain: 'obsidian_mempalace_graphify_buildwiki'
  }
  roles: GatewayMiniAgentRole[]
  policies: GatewayMiniAgentPolicy
  routes: GatewayMiniAgentRoute[]
  mini_agent_contract: {
    parent_supervisor_required: true
    scope_required: true
    memory_ttl_hours_default: number
    memory_ttl_hours_max: number
    audit_trail_required: true
    activation_requires_bridge_session: true
    proposal_only_without_bridge_session: true
    raw_root_shell_allowed: false
    docker_socket_allowed: false
    direct_secret_access_allowed: false
    independent_owner_facing_authority_allowed: false
  }
  improvement_loop: GatewayMiniAgentImprovementLoop
  registry: {
    agent_zero_present: boolean
    hermes_present: boolean
    pi_present: boolean
    space_agent_present: boolean
    mini_agents_present: boolean
    openclaw_plus_present: boolean
    openclaw_plus_retained: true
    tony_active_authority: false
    space_agent_commander_authority: false
  }
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
}

export type GatewayMiniAgentImprovementLoop = {
  hermes_daily_skill_proposals: true
  pi_daily_route_improvements: true
  agent_zero_review_required: true
  gateway_logs_accepted_rejected_proposals: true
  mini_agents_report_missing_tools: true
  mini_agents_report_failed_instructions: true
  hermes_converts_failures_to_skill_proposals: true
  pi_converts_repeated_routes_to_dispatcher_rules: true
  agent_zero_approves_only_safe_improvements: true
  no_improvement_deploys_without_tests: true
  execution_enabled: false
  writes_enabled: false
}

export type GatewayMiniAgentProposal = {
  ok: boolean
  mode: 'gateway_mini_agent_proposal'
  generated_at: string
  proposal_id: string | null
  mini_agent: {
    id: string
    name: string
    purpose: string
    parent_supervisor: GatewayMiniAgentSupervisor
    command_authority: 'agent_zero'
    scope: string[]
    memory_ttl_hours: number
    reusable: boolean
    allowed_capabilities: string[]
  } | null
  route: GatewayMiniAgentRoute | null
  flow: GatewayFlow | null
  policy_result: {
    route_decision: GatewayFlowRouteDecision
    allowed: boolean
    requires_bridge_session: boolean
    blocked_reason: string | null
  }
  audit_trail: Array<{
    event: string
    actor: string
    target: string
    summary: string
    secrets_exposed: false
    external_write: false
  }>
  accepted_for_activation: false
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  safety: {
    no_second_agent_zero: true
    no_independent_action: true
    no_raw_root_shell: true
    no_docker_socket: true
    no_direct_secret_reads: true
    no_external_writes_without_bridge_session: true
    no_secrets_exposed: true
    no_fake_done: true
  }
  blocked_reason: string | null
  owner_visible_summary: string
}

export const GATEWAY_IMPROVEMENT_PROPOSAL_SOURCES = [
  'hermes_daily_skill_proposal',
  'pi_daily_route_improvement',
  'mini_agent_missing_tool',
  'mini_agent_failed_instruction',
] as const

export type GatewayImprovementProposalSource = (typeof GATEWAY_IMPROVEMENT_PROPOSAL_SOURCES)[number]

export type GatewayImprovementProposalInput = {
  source?: string | null
  title?: string | null
  evidence?: string | string[] | null
  repeated_route_count?: number | null
  tests_passed?: boolean | null
  agent_zero_reviewed?: boolean | null
  owner_approved?: boolean | null
  generated_at?: string | null
}

export type GatewayImprovementProposal = {
  ok: boolean
  mode: 'gateway_improvement_proposal_dry_run'
  generated_at: string
  source: GatewayImprovementProposalSource | null
  proposer: 'hermes' | 'pi' | 'mini_agent' | 'gateway'
  title: string
  evidence: string[]
  cadence: 'daily' | 'event_triggered'
  agent_zero_review: 'required' | 'reviewed'
  gateway_decision_log: Array<{ event: string; decision: 'accepted' | 'rejected' | 'blocked'; reason: string | null }>
  hermes_skill_proposal: { required: boolean; production_write: false }
  pi_dispatcher_rule: { required: boolean; production_write: false }
  mini_agent_report: { missing_tool: boolean; failed_instruction: boolean }
  deployment: { allowed: false; blocked_reason: string }
  tests_required: true
  tests_passed: boolean
  execution_enabled: false
  writes_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
  blocked_reason: string | null
}

const DEFAULT_MEMORY_TTL_HOURS = 24
const MAX_MEMORY_TTL_HOURS = 168
const RESERVED_AGENT_NAMES = new Set([
  'agent_zero',
  'agent zero',
  'azero',
  'owner',
  'gateway',
  'hermes',
  'pi',
  'tony',
  'tony legacy',
  'tony v2',
])
const FORBIDDEN_SCOPE_PATTERN = /(?:root\s+shell|raw[_\s-]*shell|docker[_\s-]*socket|direct[_\s-]*secret|read[_\s-]*secrets?|print[_\s-]*secrets?|\.env|auth\.json|unrestricted|bypass\s+gateway|external[_\s-]*write|zapier[_\s-]*write|heygen[_\s-]*generation|smb[_\s-]*mount|mount\s+smb)/i

export function buildGatewayMiniAgentOperatingSystem(registry: GatewayRegistry): GatewayMiniAgentOperatingSystem {
  const nodeIds = new Set(registry.nodes.map((node) => node.id))
  return {
    ok: true,
    mode: 'gateway_mini_agent_os_read_only',
    generated_at: registry.generated_at,
    hierarchy: {
      owner: 'final_authority',
      gateway: 'routing_policy_documentation_memory_audit_hub',
      agent_zero: 'commander',
      hermes: 'lieutenant_skill_workflow_builder',
      pi: 'dispatcher_candidate_route_optimizer_tool_use_advisor',
      space_agent: 'browser_web_youtube_research',
      mini_agents: 'temporary_or_reusable_subordinate_workers',
      openclaw_plus: 'runtime_skills_adapters_reports_layer',
      bridge_mcp: 'tools_models_integrations_access_layer',
      brain: 'obsidian_mempalace_graphify_buildwiki',
    },
    roles: buildMiniAgentRoles(registry),
    policies: miniAgentPolicy(),
    routes: buildMiniAgentRoutes(registry),
    mini_agent_contract: {
      parent_supervisor_required: true,
      scope_required: true,
      memory_ttl_hours_default: DEFAULT_MEMORY_TTL_HOURS,
      memory_ttl_hours_max: MAX_MEMORY_TTL_HOURS,
      audit_trail_required: true,
      activation_requires_bridge_session: true,
      proposal_only_without_bridge_session: true,
      raw_root_shell_allowed: false,
      docker_socket_allowed: false,
      direct_secret_access_allowed: false,
      independent_owner_facing_authority_allowed: false,
    },
    improvement_loop: miniAgentImprovementLoop(),
    registry: {
      agent_zero_present: nodeIds.has('agent_zero'),
      hermes_present: nodeIds.has('hermes'),
      pi_present: nodeIds.has('pi'),
      space_agent_present: nodeIds.has('space_agent'),
      mini_agents_present: nodeIds.has('mini_agents'),
      openclaw_plus_present: nodeIds.has('openclaw_plus'),
      openclaw_plus_retained: true,
      tony_active_authority: false,
      space_agent_commander_authority: false,
    },
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
  }
}

export function createGatewayMiniAgentProposal(
  registry: GatewayRegistry,
  input: GatewayMiniAgentProposalInput = {},
): GatewayMiniAgentProposal {
  const generatedAt = registry.generated_at
  const name = safeLabel(input.name || 'Mini-agent proposal')
  const normalizedName = normalizeId(name)
  const purpose = safeText(input.purpose || '') || ''
  const scope = normalizeScope(input.scope)
  const parentSupervisor = normalizeSupervisor(input.parent_supervisor)
  const requestedBy = normalizeId(input.requested_by || 'gateway') || 'gateway'
  const requestedCapabilities = normalizeRequestedCapabilities(input.allowed_capabilities)
  const allowedCapabilities = normalizeAllowedCapabilities(registry, requestedCapabilities)
  const ttlHours = normalizeMemoryTtl(input.memory_ttl_hours)
  const bridgeSessionId = safeText(input.bridge_session_id || '') || null
  const validationBlocker = validateMiniAgentProposal({ name, normalizedName, purpose, scope, requestedCapabilities })

  if (validationBlocker) {
    return blockedMiniAgentProposal({ generatedAt, name, requestedBy, blocker: validationBlocker })
  }

  const route = buildMiniAgentRouteForSupervisor(parentSupervisor, normalizedName, Boolean(bridgeSessionId))
  const selectedRoute: GatewaySelectedRoute = {
    source: route.source,
    target: route.target,
    edge_kind: 'delegation',
    hops: route.hops,
  }
  const blockedReason = 'mini_agent_activation_requires_bridge_session_and_registered_runtime_adapter'
  const flowStatus: GatewayStatus = 'blocked'
  const flow = createGatewayFlow({
    flow_id: normalizeId(`flow_mini_agent_${normalizedName}_${parentSupervisor}`),
    source: route.source,
    target: route.target,
    requested_action: 'mini_agent_proposal',
    selected_route: selectedRoute,
    policy_result: {
      route_decision: 'requires_session',
      allowed: false,
      requires_bridge_session: true,
      blocked_reason: blockedReason,
    },
    bridge_session_id: bridgeSessionId,
    status: flowStatus,
    node_health: {},
    request: {
      source: requestedBy,
      target: route.target,
      purpose,
    },
    route: selectedRoute,
    policy: {
      auth_required: true,
      bridge_session_required: true,
      write_allowed: false,
      secret_safe: true,
      external_allowed: false,
    },
    execution_mode: 'bridge_session',
    audit: {
      audit_id: null,
      events: ['gateway_mini_agent_proposal_recorded', 'agent_zero_command_authority_preserved', 'activation_not_executed'],
      external_write: false,
      secrets_exposed: false,
    },
    result: {
      status: flowStatus,
      summary: 'Mini-agent proposal is documented only; activation requires Bridge Session and registered runtime adapter.',
      blocker: blockedReason,
    },
  })

  return {
    ok: true,
    mode: 'gateway_mini_agent_proposal',
    generated_at: generatedAt,
    proposal_id: normalizeId(`mini_agent_proposal_${normalizedName}`),
    mini_agent: {
      id: normalizeId(`mini_agent_${normalizedName}`),
      name,
      purpose,
      parent_supervisor: parentSupervisor,
      command_authority: 'agent_zero',
      scope,
      memory_ttl_hours: ttlHours,
      reusable: Boolean(input.reusable),
      allowed_capabilities: allowedCapabilities,
    },
    route,
    flow,
    policy_result: flow.policy_result,
    audit_trail: [
      auditEvent('gateway.mini_agent.proposal', requestedBy, route.target, 'Gateway documented a mini-agent proposal without activation.'),
      auditEvent('gateway.mini_agent.supervisor', parentSupervisor, route.target, 'Mini-agent has a parent supervisor and Agent Zero command authority.'),
      auditEvent('gateway.mini_agent.memory_ttl', requestedBy, route.target, `Memory TTL set to ${ttlHours} hour${ttlHours === 1 ? '' : 's'}.`),
    ],
    accepted_for_activation: false,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    safety: miniAgentSafety(),
    blocked_reason: blockedReason,
    owner_visible_summary: `${name} is a supervised mini-agent proposal under ${parentSupervisor}; no activation or external write occurred.`,
  }
}

export function createGatewayImprovementProposal(
  registry: GatewayRegistry,
  input: GatewayImprovementProposalInput = {},
): GatewayImprovementProposal {
  const source = normalizeImprovementSource(input.source)
  const generatedAt = safeText(input.generated_at || registry.generated_at) || registry.generated_at
  const title = safeLabel(input.title || 'Gateway improvement proposal')
  const evidence = normalizeScope(input.evidence).slice(0, 10)
  const testsPassed = Boolean(input.tests_passed)
  const reviewed = Boolean(input.agent_zero_reviewed)
  const missingTool = source === 'mini_agent_missing_tool'
  const failedInstruction = source === 'mini_agent_failed_instruction'
  const repeatedRouteCount = Math.max(0, Math.floor(Number(input.repeated_route_count || 0)))
  const hermesSkillRequired = source === 'hermes_daily_skill_proposal' || missingTool || failedInstruction
  const piRuleRequired = source === 'pi_daily_route_improvement' || repeatedRouteCount >= 3
  const blocker = !source
    ? 'gateway_improvement_source_unknown'
    : !title
      ? 'gateway_improvement_title_required'
      : !evidence.length
        ? 'gateway_improvement_evidence_required'
        : !reviewed
          ? 'gateway_improvement_agent_zero_review_required'
          : !testsPassed
            ? 'gateway_improvement_tests_required_before_deployment'
            : 'gateway_improvement_deployment_requires_bridge_session_and_change_review'
  const decision = blocker === 'gateway_improvement_deployment_requires_bridge_session_and_change_review' ? 'accepted' : 'blocked'

  return {
    ok: decision === 'accepted',
    mode: 'gateway_improvement_proposal_dry_run',
    generated_at: generatedAt,
    source,
    proposer: source?.startsWith('hermes') ? 'hermes' : source?.startsWith('pi') ? 'pi' : source?.startsWith('mini_agent') ? 'mini_agent' : 'gateway',
    title,
    evidence,
    cadence: source === 'hermes_daily_skill_proposal' || source === 'pi_daily_route_improvement' ? 'daily' : 'event_triggered',
    agent_zero_review: reviewed ? 'reviewed' : 'required',
    gateway_decision_log: [{ event: 'gateway.improvement.proposal.review', decision, reason: blocker }],
    hermes_skill_proposal: { required: hermesSkillRequired, production_write: false },
    pi_dispatcher_rule: { required: piRuleRequired, production_write: false },
    mini_agent_report: { missing_tool: missingTool, failed_instruction: failedInstruction },
    deployment: { allowed: false, blocked_reason: blocker },
    tests_required: true,
    tests_passed: testsPassed,
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    blocked_reason: blocker,
  }
}

export function routeMiniAgentRequest(registry: GatewayRegistry, input: GatewayMiniAgentProposalInput = {}): GatewayMiniAgentRoute {
  void registry
  const parentSupervisor = normalizeSupervisor(input.parent_supervisor)
  const name = safeLabel(input.name || 'mini-agent')
  return buildMiniAgentRouteForSupervisor(parentSupervisor, normalizeId(name), false)
}

function buildMiniAgentRoles(registry: GatewayRegistry): GatewayMiniAgentRole[] {
  const nodeIds = new Set(registry.nodes.map((node) => node.id))
  return [
    {
      id: 'agent_zero',
      label: 'Agent Zero',
      role: 'commander',
      authority: 'primary supervisor and final mini-agent activation authority under Owner.',
      can_create_proposals: true,
      can_supervise: true,
      can_execute: false,
      notes: nodeIds.has('agent_zero') ? 'Present in Gateway registry.' : 'Missing from Gateway registry.',
    },
    {
      id: 'hermes',
      label: 'Hermes',
      role: 'lieutenant / skill and workflow builder',
      authority: 'can design mini-agent scopes, skills, and workflows; Agent Zero retains command authority.',
      can_create_proposals: true,
      can_supervise: true,
      can_execute: false,
      notes: nodeIds.has('hermes') ? 'Present in Gateway registry.' : 'Missing from Gateway registry.',
    },
    {
      id: 'pi',
      label: 'Pi',
      role: 'Gateway Dispatcher candidate / route optimizer / tool-use advisor',
      authority: 'can advise routing and supervise proposal-only mini-agent plans through Gateway; cannot replace Agent Zero.',
      can_create_proposals: true,
      can_supervise: true,
      can_execute: false,
      notes: nodeIds.has('pi') ? 'Present in Gateway registry.' : 'Pending registry node.',
    },
    {
      id: 'space_agent',
      label: 'Space Agent',
      role: getGatewayRoleMatrixEntry('space_agent')?.role || 'browser_web_youtube_research',
      authority: 'browser, web, YouTube, Firecrawl, crawl, scrape, search, and extraction research specialist; returns Research Packets through Agent Zero.',
      can_create_proposals: false,
      can_supervise: false,
      can_execute: false,
      notes: nodeIds.has('space_agent') ? 'Present in Gateway registry; not commander.' : 'Pending registry node.',
    },
  ]
}

function buildMiniAgentRoutes(registry: GatewayRegistry): GatewayMiniAgentRoute[] {
  return GATEWAY_MINI_AGENT_SUPERVISORS.map((supervisor) =>
    buildMiniAgentRouteForSupervisor(supervisor, 'mini_agent_candidate', false, registry.nodes.some((node) => node.id === supervisor) ? null : `${supervisor}_not_registered`),
  )
}

function buildMiniAgentRouteForSupervisor(
  supervisor: GatewayMiniAgentSupervisor,
  miniAgentId: string,
  bridgeSessionActive: boolean,
  blocker: string | null = null,
): GatewayMiniAgentRoute {
  const target = normalizeId(`mini_agent_${miniAgentId}`)
  const supervisorHop = supervisor === 'agent_zero' ? [] : ['gateway', supervisor]
  return {
    id: normalizeId(`route_${supervisor}_${target}`),
    source: supervisor,
    target,
    mode: bridgeSessionActive ? 'supervised_runtime_pending_bridge_session' : 'proposal_only',
    hops: ['owner', 'gateway', 'agent_zero', ...supervisorHop, 'gateway', target],
    supervisor,
    command_authority: 'agent_zero',
    requires_bridge_session: true,
    execution_enabled: false,
    writes_enabled: false,
    audit_required: true,
    blocked_reason: blocker || 'mini_agent_activation_requires_bridge_session_and_registered_runtime_adapter',
  }
}

function validateMiniAgentProposal(input: {
  name: string
  normalizedName: string
  purpose: string | null
  scope: string[]
  requestedCapabilities: string[]
}): string | null {
  if (!input.normalizedName) return 'mini_agent_name_required'
  if (RESERVED_AGENT_NAMES.has(input.normalizedName) || RESERVED_AGENT_NAMES.has(input.name.toLowerCase())) return 'mini_agent_name_reserved_existing_agent_or_authority'
  if (!input.purpose) return 'mini_agent_purpose_required'
  if (FORBIDDEN_SCOPE_PATTERN.test(input.purpose)) return 'mini_agent_purpose_contains_forbidden_access'
  if (input.scope.length === 0) return 'mini_agent_scope_required'
  if (input.scope.some((item) => FORBIDDEN_SCOPE_PATTERN.test(item))) return 'mini_agent_scope_contains_forbidden_access'
  if (input.requestedCapabilities.some((item) => FORBIDDEN_SCOPE_PATTERN.test(item))) return 'mini_agent_capability_contains_forbidden_access'
  return null
}

function normalizeSupervisor(value: string | null | undefined): GatewayMiniAgentSupervisor {
  const normalized = normalizeId(value || 'agent_zero')
  return (GATEWAY_MINI_AGENT_SUPERVISORS as readonly string[]).includes(normalized)
    ? normalized as GatewayMiniAgentSupervisor
    : 'agent_zero'
}

function normalizeScope(value: string | string[] | null | undefined): string[] {
  const values = Array.isArray(value) ? value : String(value || '').split(/[,\n]/)
  return values.map((item) => safeText(item)).filter((item): item is string => Boolean(item))
}

function normalizeRequestedCapabilities(value: string[] | null | undefined): string[] {
  return (value || []).map((item) => safeText(item)).filter((item): item is string => Boolean(item))
}

function normalizeAllowedCapabilities(registry: GatewayRegistry, value: string[] | null | undefined): string[] {
  const requested = new Set((value || []).map((item) => normalizeId(item)).filter(Boolean))
  const known = registry.capabilities.map((capability) => capability.id)
  if (requested.size === 0) return []
  return known.filter((capabilityId) => requested.has(capabilityId) || requested.has(normalizeId(capabilityId)))
}

function normalizeMemoryTtl(value: number | null | undefined): number {
  const numeric = Number(value || DEFAULT_MEMORY_TTL_HOURS)
  if (!Number.isFinite(numeric)) return DEFAULT_MEMORY_TTL_HOURS
  return Math.max(1, Math.min(MAX_MEMORY_TTL_HOURS, Math.floor(numeric)))
}

function blockedMiniAgentProposal(input: {
  generatedAt: string
  name: string
  requestedBy: string
  blocker: string
}): GatewayMiniAgentProposal {
  return {
    ok: false,
    mode: 'gateway_mini_agent_proposal',
    generated_at: input.generatedAt,
    proposal_id: null,
    mini_agent: null,
    route: null,
    flow: null,
    policy_result: {
      route_decision: 'blocked',
      allowed: false,
      requires_bridge_session: true,
      blocked_reason: input.blocker,
    },
    audit_trail: [auditEvent('gateway.mini_agent.proposal.blocked', input.requestedBy, 'mini_agents', input.blocker)],
    accepted_for_activation: false,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    safety: miniAgentSafety(),
    blocked_reason: input.blocker,
    owner_visible_summary: `Mini-agent proposal for ${input.name} is blocked: ${input.blocker}.`,
  }
}

function miniAgentImprovementLoop(): GatewayMiniAgentImprovementLoop {
  return {
    hermes_daily_skill_proposals: true,
    pi_daily_route_improvements: true,
    agent_zero_review_required: true,
    gateway_logs_accepted_rejected_proposals: true,
    mini_agents_report_missing_tools: true,
    mini_agents_report_failed_instructions: true,
    hermes_converts_failures_to_skill_proposals: true,
    pi_converts_repeated_routes_to_dispatcher_rules: true,
    agent_zero_approves_only_safe_improvements: true,
    no_improvement_deploys_without_tests: true,
    execution_enabled: false,
    writes_enabled: false,
  }
}

function normalizeImprovementSource(value: string | null | undefined): GatewayImprovementProposalSource | null {
  const normalized = normalizeId(value || '')
  return (GATEWAY_IMPROVEMENT_PROPOSAL_SOURCES as readonly string[]).includes(normalized) ? normalized as GatewayImprovementProposalSource : null
}

function miniAgentPolicy(): GatewayMiniAgentPolicy {
  return {
    supervisor_required: true,
    scope_required: true,
    memory_ttl_required: true,
    audit_required: true,
    bridge_session_required_for_activation: true,
    agent_zero_command_authority_required: true,
    no_independent_action: true,
    no_unrestricted_root_shell: true,
    no_docker_socket: true,
    no_direct_secret_access: true,
    no_external_writes_without_bridge_session: true,
    no_second_agent_zero: true,
    openclaw_plus_retained_as_runtime: true,
  }
}

function miniAgentSafety(): GatewayMiniAgentProposal['safety'] {
  return {
    no_second_agent_zero: true,
    no_independent_action: true,
    no_raw_root_shell: true,
    no_docker_socket: true,
    no_direct_secret_reads: true,
    no_external_writes_without_bridge_session: true,
    no_secrets_exposed: true,
    no_fake_done: true,
  }
}

function auditEvent(event: string, actor: string, target: string, summary: string): GatewayMiniAgentProposal['audit_trail'][number] {
  return {
    event,
    actor,
    target,
    summary,
    secrets_exposed: false,
    external_write: false,
  }
}

function safeLabel(value: string): string {
  return safeText(value)?.slice(0, 80) || 'Mini-agent proposal'
}

function safeText(value: string | null | undefined): string | null {
  const text = String(value || '')
    .replace(/(?:\/home\/tony|\/a0\/|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi, '[redacted-path]')
    .replace(/(sk-[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*[:=]\s*[^,\s}]+)/gi, '[redacted-secret]')
    .trim()
  return text || null
}

function normalizeId(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
