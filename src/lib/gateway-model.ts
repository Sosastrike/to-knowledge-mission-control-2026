import {
  CANONICAL_AGENT_NETWORK_HIERARCHY,
  getCanonicalAgentNetworkRows,
  type CanonicalAgentNetworkRow,
  type HermesHierarchyStatusInput,
} from './agent-network-hierarchy'

export const GATEWAY_STATUS_STATES = [
  'connected',
  'degraded',
  'blocked',
  'missing',
  'read_only',
  'write_enabled',
  'execution_enabled',
  'legacy_archived',
] as const

export type GatewayStatus = (typeof GATEWAY_STATUS_STATES)[number]

export const GATEWAY_NODE_KINDS = [
  'owner',
  'gateway',
  'commander',
  'lieutenant',
  'specialist_agent',
  'mini_agent',
  'skill',
  'tool',
  'model',
  'mcp_server',
  'api',
  'event',
  'data_source',
  'brain_system',
  'opencloud_worker',
  'buildwiki_farmer',
  'delivery_channel',
] as const

export type GatewayNodeKind = (typeof GATEWAY_NODE_KINDS)[number]

export type GatewayEdgeKind =
  | 'command'
  | 'delegation'
  | 'tool-call'
  | 'model-call'
  | 'mcp-call'
  | 'event'
  | 'memory'
  | 'sync'
  | 'approval'
  | 'report'
  | 'blocked'

export type GatewayVisibility = 'owner_visible' | 'internal' | 'archived' | 'hidden'

export type GatewayCapabilityKind =
  | 'tool'
  | 'model'
  | 'skill'
  | 'integration'
  | 'agent'
  | 'mcp_server'
  | 'api'
  | 'brain'

export type GatewayExecutionMode = 'read_only' | 'bridge_session' | 'execution_enabled' | 'blocked'

export type GatewayNodeExecutionState =
  | 'read_only_by_default'
  | 'read_only_shadow_recommendation'
  | 'proposal_only_until_bridge_session'
  | 'bridge_session_required'
  | 'execution_enabled'
  | 'disabled'

export type GatewayPolicyGate = 'gated_by_policy' | 'enabled' | 'disabled'

export type GatewayExternalWriteState = 'disabled' | 'requires_bridge_session' | 'enabled'

export type GatewayHealth = {
  status: GatewayStatus
  summary: string
  score: number | null
  last_seen: string | null
}

export type GatewayNode = {
  id: string
  label: string
  kind: GatewayNodeKind
  role?: string
  parent?: string
  supervisors?: string[]
  execution_state?: GatewayNodeExecutionState
  web_access?: GatewayPolicyGate
  browser_interaction?: GatewayPolicyGate
  youtube_inspection?: GatewayPolicyGate
  external_writes?: GatewayExternalWriteState
  status: GatewayStatus
  owner: string
  visibility: GatewayVisibility
  health: GatewayHealth
  capabilities: string[]
  blockers: string[]
  status_details?: GatewayCapabilityStatusDetails
}

export type GatewayEdge = {
  source: string
  target: string
  kind: GatewayEdgeKind
  allowed: boolean
  requires_session: boolean
  status: GatewayStatus
  blocker: string | null
  last_seen: string | null
}

export type GatewayPolicy = {
  auth_required: boolean
  bridge_session_required: boolean
  write_allowed: boolean
  secret_safe: boolean
  external_allowed: boolean
}

export type GatewayCapabilityStatusDetails = Record<string, string | number | boolean | null>

export type GatewayCapability = {
  id: string
  label: string
  kind: GatewayCapabilityKind
  status: GatewayStatus
  owner: string
  visibility: GatewayVisibility
  read_enabled: boolean
  available_to: string[]
  execution_requirements: string[]
  write_enabled: boolean
  execution_enabled: boolean
  requires_session: boolean
  required_tools: string[]
  required_credentials: string[]
  blockers: string[]
  status_details: GatewayCapabilityStatusDetails
  source_node: string | null
  last_seen: string | null
}

export type GatewayFlowRouteDecision = 'allowed' | 'blocked' | 'requires_session' | 'missing_credential'

export type GatewaySelectedRoute = {
  source: string
  target: string
  edge_kind: GatewayEdgeKind
  hops: string[]
}

export type GatewayFlowPolicyResult = {
  route_decision: GatewayFlowRouteDecision
  allowed: boolean
  requires_bridge_session: boolean
  blocked_reason: string | null
}

export type GatewayFlowAudit = {
  audit_id: string | null
  events: string[]
  external_write: boolean
  secrets_exposed: boolean
}

export type GatewayFlowLogEntry = {
  event: string
  route_target: string | null
  decision: string | null
  allowed: boolean | null
  blocked_reason: string | null
  external_write: boolean
  bridge_session_id: string | null
  secrets_exposed: false
  recorded_at: string | null
}

export type GatewayNoSecretsLogging = {
  enabled: true
  secrets_exposed: false
  redaction_applied: boolean
  protected_fields: string[]
}

export type GatewayFlowNodeHealth = Record<string, GatewayHealth>

export type GatewayFlowResult = {
  status: GatewayStatus
  summary: string
  blocker: string | null
}

export type GatewayFlow = {
  flow_id: string
  source: string
  target: string
  requested_action: string
  selected_route: GatewaySelectedRoute
  policy_result: GatewayFlowPolicyResult
  bridge_session_id: string | null
  status: GatewayStatus
  node_health: GatewayFlowNodeHealth
  last_successful_route: GatewaySelectedRoute | null
  last_blocker: string | null
  audit_log: GatewayFlowLogEntry[]
  policy_decision_log: GatewayFlowLogEntry[]
  external_write_log: GatewayFlowLogEntry[]
  bridge_session_log: GatewayFlowLogEntry[]
  failure_reason: string | null
  no_secrets_logging: GatewayNoSecretsLogging
  request: {
    source: string
    target: string
    purpose: string
    prompt?: string
  }
  route: GatewaySelectedRoute
  policy: GatewayPolicy
  execution_mode: GatewayExecutionMode
  audit: GatewayFlowAudit
  result: GatewayFlowResult
}

export type GatewayFlowInput = Omit<
  GatewayFlow,
  | 'source'
  | 'target'
  | 'requested_action'
  | 'selected_route'
  | 'policy_result'
  | 'bridge_session_id'
  | 'status'
  | 'node_health'
  | 'last_successful_route'
  | 'last_blocker'
  | 'audit_log'
  | 'policy_decision_log'
  | 'external_write_log'
  | 'bridge_session_log'
  | 'failure_reason'
  | 'no_secrets_logging'
> & Partial<Pick<
  GatewayFlow,
  | 'source'
  | 'target'
  | 'requested_action'
  | 'selected_route'
  | 'policy_result'
  | 'bridge_session_id'
  | 'status'
  | 'node_health'
  | 'last_successful_route'
  | 'last_blocker'
  | 'audit_log'
  | 'policy_decision_log'
  | 'external_write_log'
  | 'bridge_session_log'
  | 'failure_reason'
  | 'no_secrets_logging'
>>

export type GatewayRegistry = {
  version: 'gateway_registry_v1'
  generated_at: string
  nodes: GatewayNode[]
  edges: GatewayEdge[]
  capabilities: GatewayCapability[]
  policies: Record<string, GatewayPolicy>
  health: Record<string, GatewayHealth>
}

export type GatewayCapabilityInput = Partial<
  Pick<
    GatewayCapability,
    | 'owner'
    | 'visibility'
    | 'read_enabled'
    | 'write_enabled'
    | 'available_to'
    | 'execution_requirements'
    | 'execution_enabled'
    | 'requires_session'
    | 'required_tools'
    | 'required_credentials'
    | 'blockers'
    | 'source_node'
    | 'last_seen'
    | 'status_details'
  >
> & {
  id: string
  label: string
  kind: GatewayCapabilityKind
  status?: GatewayStatus
}

export type AgentNetworkGatewayAdapterInput = {
  generatedAt?: string
  hermes?: HermesHierarchyStatusInput
  rows?: CanonicalAgentNetworkRow[]
}

const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z'

const ACTIVE_POLICY: GatewayPolicy = {
  auth_required: true,
  bridge_session_required: false,
  write_allowed: false,
  secret_safe: true,
  external_allowed: false,
}

const BRIDGE_SESSION_POLICY: GatewayPolicy = {
  auth_required: true,
  bridge_session_required: true,
  write_allowed: false,
  secret_safe: true,
  external_allowed: false,
}

const READ_ONLY_POLICY: GatewayPolicy = {
  auth_required: true,
  bridge_session_required: false,
  write_allowed: false,
  secret_safe: true,
  external_allowed: false,
}

export function createGatewayHealth(
  status: GatewayStatus,
  summary: string,
  lastSeen: string | null = null,
): GatewayHealth {
  return {
    status,
    summary,
    score: scoreForGatewayStatus(status),
    last_seen: lastSeen,
  }
}

export function normalizeGatewayStatus(status: string | null | undefined): GatewayStatus {
  const normalized = String(status || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
  if (isGatewayStatus(normalized)) return normalized
  if (['active', 'ok', 'healthy', 'available'].includes(normalized)) return 'connected'
  if (['pending', 'unknown', 'warning'].includes(normalized)) return 'degraded'
  if (['legacy_archived', 'retired_archived'].includes(normalized)) return 'legacy_archived'
  if (['disabled', 'retired', 'archived', 'denied'].includes(normalized)) return 'blocked'
  if (['readonly', 'read_only', 'visible'].includes(normalized)) return 'read_only'
  if (['write', 'writable', 'write_enabled'].includes(normalized)) return 'write_enabled'
  if (['execute', 'execution', 'execution_enabled'].includes(normalized)) return 'execution_enabled'
  if (['missing', 'not_found', 'unconfigured'].includes(normalized)) return 'missing'
  return 'degraded'
}

export function createGatewayCapability(input: GatewayCapabilityInput): GatewayCapability {
  const status = input.status || 'read_only'
  return {
    id: normalizeGatewayId(input.id),
    label: input.label,
    kind: input.kind,
    status,
    owner: input.owner || 'ecosystem',
    visibility: input.visibility || 'owner_visible',
    read_enabled: input.read_enabled ?? true,
    available_to: input.available_to ? [...input.available_to] : [],
    execution_requirements: input.execution_requirements ? [...input.execution_requirements] : [],
    write_enabled: input.write_enabled ?? false,
    execution_enabled: input.execution_enabled ?? false,
    requires_session: input.requires_session ?? false,
    required_tools: input.required_tools ? [...input.required_tools] : [],
    required_credentials: input.required_credentials ? [...input.required_credentials] : [],
    blockers: input.blockers ? compactBlockers(input.blockers) : [],
    status_details: input.status_details ? { ...input.status_details } : {},
    source_node: input.source_node || null,
    last_seen: input.last_seen || null,
  }
}

export function createGatewayFlow(input: GatewayFlowInput): GatewayFlow {
  const route = {
    ...input.route,
    hops: [...input.route.hops],
  }
  const selectedRoute = input.selected_route
    ? { ...input.selected_route, hops: [...input.selected_route.hops] }
    : { ...route, hops: [...route.hops] }
  const blockedReason = input.policy_result?.blocked_reason || input.result.blocker || null
  const policyResult = input.policy_result
    ? { ...input.policy_result }
    : deriveGatewayFlowPolicyResult(input.policy, blockedReason)

  const source = input.source || input.request.source || route.source
  const target = input.target || input.request.target || route.target
  const requestedAction = input.requested_action || input.request.purpose
  const bridgeSessionId = input.bridge_session_id ?? null
  const status = input.status || input.result.status
  const audit = {
    ...input.audit,
    events: [...input.audit.events],
  }
  const defaultAuditLog = gatewayFlowDefaultAuditLog({
    target,
    policyResult,
    bridgeSessionId,
    externalWrite: audit.external_write,
    failureReason: blockedReason,
  })

  return {
    ...input,
    source,
    target,
    requested_action: requestedAction,
    selected_route: selectedRoute,
    policy_result: policyResult,
    bridge_session_id: bridgeSessionId,
    status,
    node_health: input.node_health ? cloneGatewayFlowNodeHealth(input.node_health) : {},
    last_successful_route: input.last_successful_route
      ? { ...input.last_successful_route, hops: [...input.last_successful_route.hops] }
      : (policyResult.allowed ? { ...selectedRoute, hops: [...selectedRoute.hops] } : null),
    last_blocker: input.last_blocker ?? blockedReason,
    audit_log: input.audit_log ? input.audit_log.map(cloneGatewayFlowLogEntry) : defaultAuditLog,
    policy_decision_log: input.policy_decision_log ? input.policy_decision_log.map(cloneGatewayFlowLogEntry) : defaultAuditLog.filter((entry) => entry.event === 'gateway.policy.decision'),
    external_write_log: input.external_write_log ? input.external_write_log.map(cloneGatewayFlowLogEntry) : defaultAuditLog.filter((entry) => entry.event === 'gateway.external_write.decision'),
    bridge_session_log: input.bridge_session_log ? input.bridge_session_log.map(cloneGatewayFlowLogEntry) : defaultAuditLog.filter((entry) => entry.event === 'gateway.bridge_session.decision'),
    failure_reason: input.failure_reason ?? blockedReason,
    no_secrets_logging: input.no_secrets_logging
      ? { ...input.no_secrets_logging, protected_fields: [...input.no_secrets_logging.protected_fields] }
      : {
          enabled: true,
          secrets_exposed: false,
          redaction_applied: false,
          protected_fields: ['tokens', 'api_keys', 'auth_files', 'env_values', 'raw_paths'],
        },
    request: {
      ...input.request,
    },
    route,
    audit,
    result: {
      ...input.result,
    },
  }
}

function gatewayFlowDefaultAuditLog(input: {
  target: string
  policyResult: GatewayFlowPolicyResult
  bridgeSessionId: string | null
  externalWrite: boolean
  failureReason: string | null
}): GatewayFlowLogEntry[] {
  return [
    {
      event: 'gateway.policy.decision',
      route_target: input.target,
      decision: input.policyResult.route_decision,
      allowed: input.policyResult.allowed,
      blocked_reason: input.policyResult.blocked_reason,
      external_write: input.externalWrite,
      bridge_session_id: input.bridgeSessionId,
      secrets_exposed: false,
      recorded_at: null,
    },
    {
      event: 'gateway.external_write.decision',
      route_target: input.target,
      decision: input.externalWrite ? 'blocked_without_explicit_session_scope' : 'not_requested',
      allowed: false,
      blocked_reason: input.externalWrite ? input.failureReason || 'external_write_requires_bridge_session_scope' : null,
      external_write: input.externalWrite,
      bridge_session_id: input.bridgeSessionId,
      secrets_exposed: false,
      recorded_at: null,
    },
    {
      event: 'gateway.bridge_session.decision',
      route_target: input.target,
      decision: input.bridgeSessionId ? 'active' : (input.policyResult.requires_bridge_session ? 'required' : 'not_required'),
      allowed: Boolean(input.bridgeSessionId) || !input.policyResult.requires_bridge_session,
      blocked_reason: input.policyResult.requires_bridge_session && !input.bridgeSessionId ? input.failureReason || 'bridge_session_required' : null,
      external_write: input.externalWrite,
      bridge_session_id: input.bridgeSessionId,
      secrets_exposed: false,
      recorded_at: null,
    },
    {
      event: 'gateway.no_secrets.logging',
      route_target: input.target,
      decision: 'redacted_owner_safe',
      allowed: true,
      blocked_reason: null,
      external_write: false,
      bridge_session_id: input.bridgeSessionId,
      secrets_exposed: false,
      recorded_at: null,
    },
  ]
}

function cloneGatewayFlowNodeHealth(nodeHealth: GatewayFlowNodeHealth): GatewayFlowNodeHealth {
  return Object.fromEntries(
    Object.entries(nodeHealth).map(([nodeId, health]) => [nodeId, { ...health }]),
  )
}

function cloneGatewayFlowLogEntry(entry: GatewayFlowLogEntry): GatewayFlowLogEntry {
  return { ...entry }
}

function deriveGatewayFlowPolicyResult(policy: GatewayPolicy, blockedReason: string | null): GatewayFlowPolicyResult {
  const missingCredential = Boolean(blockedReason && /credential|api_key|token|auth/i.test(blockedReason))
  return {
    route_decision: blockedReason ? (missingCredential ? 'missing_credential' : 'blocked') : (policy.bridge_session_required ? 'requires_session' : 'allowed'),
    allowed: !blockedReason && !policy.bridge_session_required,
    requires_bridge_session: policy.bridge_session_required,
    blocked_reason: blockedReason,
  }
}

export function createGatewayRegistryFromAgentNetwork(
  input: AgentNetworkGatewayAdapterInput = {},
): GatewayRegistry {
  const generatedAt = input.generatedAt || DEFAULT_GENERATED_AT
  const rows = input.rows || getCanonicalAgentNetworkRows(input.hermes)
  const hierarchy = CANONICAL_AGENT_NETWORK_HIERARCHY
  const nodes = dedupeGatewayNodes([
    createGatewayNode({
      id: hierarchy.owner.id,
      label: hierarchy.owner.name,
      kind: 'owner',
      status: 'connected',
      owner: 'owner',
      visibility: 'owner_visible',
      capabilities: ['command'],
      blockers: [],
      lastSeen: generatedAt,
    }),
    createGatewayNode({
      id: 'gateway',
      label: 'Gateway',
      kind: 'gateway',
      status: 'connected',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      capabilities: ['route', 'govern', 'observe', 'control'],
      blockers: [],
      lastSeen: generatedAt,
    }),
    createGatewayNode({
      id: hierarchy.commander.id,
      label: hierarchy.commander.name,
      kind: 'commander',
      status: normalizeGatewayStatus(hierarchy.commander.status),
      owner: 'owner',
      visibility: 'owner_visible',
      capabilities: ['command', 'live-query', 'bridge-session'],
      blockers: [],
      lastSeen: generatedAt,
    }),
    createGatewayNode({
      id: hierarchy.lieutenant.id,
      label: hierarchy.lieutenant.name,
      kind: 'lieutenant',
      status: normalizeGatewayStatus(rows.find((row) => row.id === 'hermes')?.status || hierarchy.lieutenant.status),
      owner: 'ecosystem',
      visibility: 'owner_visible',
      capabilities: [...hierarchy.lieutenant.capabilities],
      blockers: compactBlockers([rows.find((row) => row.id === 'hermes')?.blocker || hierarchy.lieutenant.blocker]),
      lastSeen: generatedAt,
    }),
    createGatewayNode({
      id: 'pi',
      label: 'Pi',
      kind: 'mini_agent',
      status: 'read_only',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      capabilities: ['Gateway dispatch candidate', 'route optimization', 'tool-use advice', 'mini-agent supervision proposals'],
      blockers: ['dispatcher_candidate_not_authoritative'],
      lastSeen: generatedAt,
    }),
    createGatewayNode({
      id: 'space_agent',
      label: 'Space Agent',
      kind: 'specialist_agent',
      role: 'browser_web_youtube_research',
      parent: 'gateway',
      supervisors: ['agent_zero', 'hermes', 'pi'],
      executionState: 'read_only_by_default',
      webAccess: 'gated_by_policy',
      browserInteraction: 'gated_by_policy',
      youtubeInspection: 'gated_by_policy',
      externalWrites: 'disabled',
      status: 'read_only',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      capabilities: [
        'browser_web_youtube_research',
        'browser research',
        'webpage and article inspection planning',
        'YouTube and video research packets',
        'Firecrawl research coordination',
        'Firecrawl search capability',
        'Firecrawl scrape capability',
        'Firecrawl crawl capability',
        'Firecrawl map capability',
        'Firecrawl extract capability',
        'Firecrawl interact/browser capability gated by configuration',
        'web access gated by policy',
        'browser interaction gated by policy',
        'YouTube inspection gated by policy',
        'external writes disabled',
        'Gateway-routed structured Research Packets',
        'subordinate research stage, not commander',
      ],
      blockers: [],
      statusDetails: {
        firecrawl_status: 'blocked_until_gateway_registry_confirms_credential',
        firecrawl_credential_configured: false,
        firecrawl_search: 'blocked_missing_credential',
        firecrawl_scrape: 'blocked_missing_credential',
        firecrawl_crawl: 'blocked_missing_credential',
        firecrawl_map: 'blocked_missing_credential',
        firecrawl_extract: 'blocked_missing_credential',
        firecrawl_interact_browser: 'blocked_missing_credential',
        firecrawl_blocked_reason: 'firecrawl_missing_credential',
        secrets_exposed: false,
      },
      lastSeen: generatedAt,
    }),
    createGatewayNode({
      id: 'mini_agents',
      label: 'Mini-agents',
      kind: 'mini_agent',
      status: 'read_only',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      capabilities: ['gateway-routed reporting', 'Agent Zero dispatch', 'Hermes workflow support'],
      blockers: [],
      lastSeen: generatedAt,
    }),
    createGatewayNode({
      id: hierarchy.runtime.id,
      label: hierarchy.runtime.name,
      kind: 'skill',
      status: 'connected',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      capabilities: ['shared-skills', 'adapters', 'reports', 'governance'],
      blockers: [],
      lastSeen: generatedAt,
    }),
    ...hierarchy.systems.map((system) =>
      createGatewayNode({
        id: system.id,
        label: system.name,
        kind: kindForSystem(system.id),
        status: system.id === 'bridge_mcp' ? 'connected' : 'read_only',
        owner: 'ecosystem',
        visibility: 'owner_visible',
        capabilities: system.id === 'opencloud' ? system.role.split('|').map((item) => item.trim()).filter(Boolean) : [system.role],
        blockers: [],
        lastSeen: generatedAt,
      }),
    ),
    ...hierarchy.retired.map((agent) =>
      createGatewayNode({
        id: agent.id,
        label: agent.name,
        kind: 'mini_agent',
        status: normalizeGatewayStatus('status' in agent ? agent.status : 'legacy_archived'),
        owner: 'archive',
        visibility: 'archived',
        capabilities: [],
        blockers: ['legacy_archived'],
        lastSeen: generatedAt,
      }),
    ),
  ])

  const hierarchyEdges = [
    { from: 'owner', to: 'gateway', relation: 'commands' },
    { from: 'gateway', to: 'agent_zero', relation: 'commands' },
    ...hierarchy.edges,
    { from: 'gateway', to: 'pi', relation: 'dispatches' },
    { from: 'agent_zero', to: 'pi', relation: 'delegates_to' },
    { from: 'pi', to: 'agent_zero', relation: 'reports_to' },
    { from: 'gateway', to: 'space_agent', relation: 'dispatches' },
    { from: 'agent_zero', to: 'space_agent', relation: 'delegates_to' },
    { from: 'hermes', to: 'space_agent', relation: 'delegates_to' },
    { from: 'pi', to: 'space_agent', relation: 'delegates_to' },
    { from: 'space_agent', to: 'agent_zero', relation: 'reports_to' },
    { from: 'space_agent', to: 'hermes', relation: 'reports_to' },
    { from: 'gateway', to: 'mini_agents', relation: 'dispatches' },
    { from: 'agent_zero', to: 'mini_agents', relation: 'delegates_to' },
    { from: 'hermes', to: 'mini_agents', relation: 'delegates_to' },
    { from: 'pi', to: 'mini_agents', relation: 'delegates_to' },
    { from: 'mini_agents', to: 'agent_zero', relation: 'reports_to' },
    { from: 'mini_agents', to: 'hermes', relation: 'reports_to' },
    { from: 'mini_agents', to: 'pi', relation: 'reports_to' },
  ]

  const edges = hierarchyEdges.map((edge) => {
    const kind = edgeKindFromAgentNetworkRelation(edge.relation)
    const target = nodes.find((node) => node.id === edge.to)
    const blocker = target?.blockers[0] || null
    return {
      source: edge.from,
      target: edge.to,
      kind,
      allowed: !blocker,
      requires_session: ['tool-call', 'mcp-call', 'memory', 'sync'].includes(kind),
      status: blocker ? 'blocked' : 'connected',
      blocker,
      last_seen: generatedAt,
    } satisfies GatewayEdge
  })

  const capabilities = dedupeGatewayCapabilities([
    ...rows.flatMap((row) =>
      row.skills.map((skill) =>
        createGatewayCapability({
          id: `${row.id}.${skill}`,
          label: skill,
          kind: 'skill',
          status: normalizeGatewayStatus(row.status),
          source_node: row.id,
          requires_session: row.template.toLowerCase().includes('bridge session'),
          blockers: compactBlockers([row.blocker]),
        }),
      ),
    ),
    createGatewayCapability({
      id: 'pi.dispatcher_candidate',
      label: 'Pi Gateway dispatcher candidate',
      kind: 'agent',
      status: 'read_only',
      source_node: 'pi',
      available_to: ['agent_zero', 'hermes'],
      execution_requirements: ['agent_zero_command_authority_required', 'bridge_session_required_for_activation'],
      blockers: ['dispatcher_candidate_not_authoritative'],
    }),
    createGatewayCapability({
      id: 'opencloud.worker_runtime',
      label: 'OpenCloud worker/runtime engine',
      kind: 'tool',
      status: 'read_only',
      source_node: 'opencloud',
      available_to: ['agent_zero', 'hermes', 'pi'],
      execution_requirements: ['gateway_route_required', 'bridge_session_required_for_execution', 'opencloud_deletion_forbidden'],
      blockers: ['execution_requires_gateway_bridge_session_scope'],
    }),
    createGatewayCapability({
      id: 'mini_agents.gateway_supervision',
      label: 'Gateway mini-agent supervision',
      kind: 'agent',
      status: 'read_only',
      source_node: 'mini_agents',
      available_to: ['agent_zero', 'hermes', 'pi'],
      execution_requirements: ['parent_supervisor_required', 'scope_required', 'memory_ttl_required', 'audit_required', 'bridge_session_required_for_activation'],
    }),
    createGatewayCapability({
      id: 'space_agent_research_packet',
      label: 'Space Agent Research Packet',
      kind: 'agent',
      status: 'read_only',
      source_node: 'space_agent',
      available_to: ['agent_zero', 'hermes', 'pi'],
      execution_requirements: [
        'gateway_route_required',
        'research_only_by_default',
        'no_external_writes',
        'firecrawl_credential_required_for_firecrawl_operations',
        'firecrawl_operations_block_when_credential_missing',
        'bridge_session_required_for_browser_actions_beyond_read_only_research',
        'respect_login_paywall_private_content_boundaries',
      ],
      status_details: {
        summary: 'Space Agent prepares browser, web, YouTube, video, crawl, scrape, search, extraction, and Firecrawl research packets under Gateway supervision.',
        role: 'browser_web_youtube_research',
        specialty: 'web_browser_youtube_firecrawl_research_specialist',
        execution_state: 'read_only_by_default',
        web_access: 'gated_by_policy',
        browser_interaction: 'gated_by_policy',
        youtube_inspection: 'gated_by_policy',
        external_writes: 'disabled',
        firecrawl_credential_configured: false,
        firecrawl_search: 'blocked_missing_credential',
        firecrawl_scrape: 'blocked_missing_credential',
        firecrawl_crawl: 'blocked_missing_credential',
        firecrawl_map: 'blocked_missing_credential',
        firecrawl_extract: 'blocked_missing_credential',
        firecrawl_interact_browser: 'blocked_missing_credential',
        firecrawl_blocked_reason: 'firecrawl_missing_credential',
        returns_to: 'agent_zero',
        subordinate_to_gateway: true,
        agent_zero_commander: true,
        hermes_skill_builder: true,
        pi_can_recommend: true,
        mini_agents_are_subordinate_workers: true,
        opencloud_openclaw_worker_runtime: true,
        tony_retired_archive_only: true,
        space_agent_is_commander: false,
        commander_replacement: false,
        execution_enabled: false,
        policy: 'space_agent_not_commander',
      },
    }),
    createGatewayCapability({
      id: 'bridge_mcp.providers',
      label: 'Bridge/MCP providers',
      kind: 'mcp_server',
      status: 'read_only',
      source_node: 'bridge_mcp',
    }),
    createGatewayCapability({
      id: 'brain.systems',
      label: 'Brain systems',
      kind: 'brain',
      status: 'read_only',
      source_node: 'brain_sync',
    }),
  ])

  const health = Object.fromEntries(nodes.map((node) => [node.id, node.health]))

  return {
    version: 'gateway_registry_v1',
    generated_at: generatedAt,
    nodes,
    edges,
    capabilities,
    policies: {
      active_read_only: ACTIVE_POLICY,
      bridge_session_required: BRIDGE_SESSION_POLICY,
      read_only: READ_ONLY_POLICY,
      space_agent_not_commander: READ_ONLY_POLICY,
    },
    health,
  }
}

function createGatewayNode(input: {
  id: string
  label: string
  kind: GatewayNodeKind
  role?: string
  parent?: string
  supervisors?: readonly string[]
  executionState?: GatewayNodeExecutionState
  webAccess?: GatewayPolicyGate
  browserInteraction?: GatewayPolicyGate
  youtubeInspection?: GatewayPolicyGate
  externalWrites?: GatewayExternalWriteState
  statusDetails?: GatewayCapabilityStatusDetails
  status: GatewayStatus
  owner: string
  visibility: GatewayVisibility
  capabilities: readonly string[]
  blockers: readonly (string | null | undefined)[]
  lastSeen: string | null
}): GatewayNode {
  const blockers = compactBlockers(input.blockers)
  const status = blockers.length > 0 && input.status === 'connected' ? 'degraded' : input.status
  return {
    id: normalizeGatewayId(input.id),
    label: input.label,
    kind: input.kind,
    ...(input.role ? { role: input.role } : {}),
    ...(input.parent ? { parent: normalizeGatewayId(input.parent) } : {}),
    ...(input.supervisors ? { supervisors: input.supervisors.map(normalizeGatewayId) } : {}),
    ...(input.executionState ? { execution_state: input.executionState } : {}),
    ...(input.webAccess ? { web_access: input.webAccess } : {}),
    ...(input.browserInteraction ? { browser_interaction: input.browserInteraction } : {}),
    ...(input.youtubeInspection ? { youtube_inspection: input.youtubeInspection } : {}),
    ...(input.externalWrites ? { external_writes: input.externalWrites } : {}),
    status,
    owner: input.owner,
    visibility: input.visibility,
    health: createGatewayHealth(status, blockers[0] || `${input.label} ${status}`, input.lastSeen),
    capabilities: [...input.capabilities],
    blockers,
    ...(input.statusDetails ? { status_details: { ...input.statusDetails } } : {}),
  }
}

function normalizeGatewayId(id: string): string {
  return String(id).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function isGatewayStatus(status: string): status is GatewayStatus {
  return (GATEWAY_STATUS_STATES as readonly string[]).includes(status)
}

function scoreForGatewayStatus(status: GatewayStatus): number | null {
  if (status === 'connected' || status === 'execution_enabled') return 1
  if (status === 'write_enabled') return 0.9
  if (status === 'read_only') return 0.75
  if (status === 'degraded') return 0.5
  if (status === 'blocked') return 0.15
  if (status === 'legacy_archived') return 0.05
  return null
}

function kindForSystem(id: string): GatewayNodeKind {
  if (id === 'bridge_mcp') return 'mcp_server'
  if (id === 'opencloud') return 'opencloud_worker'
  if (id === 'buildwiki') return 'buildwiki_farmer'
  if (id === 'brain_sync' || id === 'obsidian' || id === 'mempalace' || id === 'graphify') return 'brain_system'
  return 'tool'
}

function edgeKindFromAgentNetworkRelation(relation: string): GatewayEdgeKind {
  if (relation === 'commands') return 'command'
  if (relation === 'dispatches' || relation === 'delegates_to') return 'delegation'
  if (relation === 'reports_to') return 'report'
  if (relation === 'supported_by') return 'delegation'
  if (relation === 'uses_runtime') return 'tool-call'
  if (relation === 'exposes_access_layer') return 'mcp-call'
  if (relation === 'operates_brain_systems') return 'memory'
  return 'event'
}

function compactBlockers(values: readonly (string | null | undefined)[]): string[] {
  return values.map((value) => String(value || '').trim()).filter(Boolean)
}

function dedupeGatewayNodes(nodes: GatewayNode[]): GatewayNode[] {
  const seen = new Set<string>()
  return nodes.filter((node) => {
    if (seen.has(node.id)) return false
    seen.add(node.id)
    return true
  })
}

function dedupeGatewayCapabilities(capabilities: GatewayCapability[]): GatewayCapability[] {
  const seen = new Set<string>()
  return capabilities.filter((capability) => {
    if (seen.has(capability.id)) return false
    seen.add(capability.id)
    return true
  })
}


export type GatewayRoleMatrixEntry = {
  id: string
  label: string
  role: string
  authority: string
  reports_to: readonly string[]
  supervises: readonly string[]
  execution_mode: string
  can_recommend: boolean
  can_design: boolean
  commander: boolean
  active: boolean
  archived: boolean
  policy_tags: readonly string[]
  owner_visible_summary: string
}

export const GATEWAY_ROLE_MATRIX: readonly GatewayRoleMatrixEntry[] = [
  {
    id: 'owner',
    label: 'Owner',
    role: 'final_authority',
    authority: 'Final authority over Gateway policy, approvals, and production changes.',
    reports_to: [],
    supervises: ['gateway', 'agent_zero'],
    execution_mode: 'owner_authority',
    can_recommend: false,
    can_design: false,
    commander: false,
    active: true,
    archived: false,
    policy_tags: ['owner_final_authority'],
    owner_visible_summary: 'Owner remains final authority over Agent Zero, Gateway, approvals, and protected actions.',
  },
  {
    id: 'gateway',
    label: 'Gateway',
    role: 'routing_policy_documentation_memory_audit_hub',
    authority: 'Routes, governs, documents, audits, and memory-gates traffic across agents, tools, Brain systems, OpenCloud, and integrations.',
    reports_to: ['owner'],
    supervises: ['agent_zero', 'hermes', 'pi', 'space_agent', 'mini_agents', 'openclaw_plus', 'opencloud'],
    execution_mode: 'control_plane_read_only_until_bridge_session',
    can_recommend: true,
    can_design: false,
    commander: false,
    active: true,
    archived: false,
    policy_tags: ['gateway_route_required', 'audit_required', 'bridge_session_required_for_external_writes'],
    owner_visible_summary: 'Gateway is the routing, policy, documentation, memory, and audit hub.',
  },
  {
    id: 'agent_zero',
    label: 'Agent Zero',
    role: 'commander',
    authority: 'Primary commander and final operational decision-maker under Owner.',
    reports_to: ['owner', 'gateway'],
    supervises: ['hermes', 'pi', 'space_agent', 'mini_agents', 'openclaw_plus', 'opencloud'],
    execution_mode: 'gateway_bridge_session_registered_adapters_only',
    can_recommend: true,
    can_design: true,
    commander: true,
    active: true,
    archived: false,
    policy_tags: ['agent_zero_commander', 'no_raw_shell', 'no_direct_secret_reads'],
    owner_visible_summary: 'Agent Zero is commander and supervises Space Agent research through Gateway.',
  },
  {
    id: 'hermes',
    label: 'Hermes',
    role: 'lieutenant_skill_workflow_builder',
    authority: 'Designs skills, workflows, automations, and Space Agent research workflows for Agent Zero review.',
    reports_to: ['agent_zero', 'gateway'],
    supervises: ['mini_agents'],
    execution_mode: 'proposal_only_until_bridge_session',
    can_recommend: true,
    can_design: true,
    commander: false,
    active: true,
    archived: false,
    policy_tags: ['hermes_lieutenant', 'can_design_space_agent_skills', 'agent_zero_review_required'],
    owner_visible_summary: 'Hermes is lieutenant and can build workflow or skill designs for Space Agent research routes.',
  },
  {
    id: 'pi',
    label: 'Pi',
    role: 'gateway_dispatcher_candidate_route_optimizer_tool_use_advisor',
    authority: 'Shadow-mode dispatcher candidate that recommends routes, models, tools, agents, and mini-agent use.',
    reports_to: ['agent_zero', 'gateway'],
    supervises: [],
    execution_mode: 'read_only_shadow_recommendation',
    can_recommend: true,
    can_design: false,
    commander: false,
    active: true,
    archived: false,
    policy_tags: ['pi_shadow_mode', 'can_recommend_space_agent_for_web_research', 'not_commander'],
    owner_visible_summary: 'Pi can recommend Space Agent for live web, browser, YouTube, and Firecrawl research stages.',
  },
  {
    id: 'space_agent',
    label: 'Space Agent',
    role: 'browser_web_youtube_research',
    authority: 'Subordinate research specialist that returns structured Research Packets through Gateway; Agent Zero remains commander.',
    reports_to: ['gateway', 'agent_zero'],
    supervises: [],
    execution_mode: 'read_only_research_packet_by_default',
    can_recommend: false,
    can_design: false,
    commander: false,
    active: true,
    archived: false,
    policy_tags: [
      'space_agent_not_commander',
      'gateway_route_required',
      'research_packet_only_by_default',
      'read_only_by_default',
      'web_access_gated_by_policy',
      'browser_interaction_gated_by_policy',
      'youtube_inspection_gated_by_policy',
      'external_writes_disabled',
      'no_external_writes_without_bridge_session',
    ],
    owner_visible_summary: 'Space Agent handles browser, web, YouTube, video, Firecrawl, crawl, scrape, search, and extraction research stages only.',
  },
  {
    id: 'mini_agents',
    label: 'Mini-agents',
    role: 'temporary_or_reusable_subordinate_workers',
    authority: 'Scoped subordinate workers created through Gateway routes with parent supervisors, TTL, output contracts, and audit.',
    reports_to: ['agent_zero', 'hermes', 'pi', 'gateway'],
    supervises: [],
    execution_mode: 'proposal_only_until_bridge_session',
    can_recommend: false,
    can_design: false,
    commander: false,
    active: true,
    archived: false,
    policy_tags: ['parent_supervisor_required', 'memory_ttl_required', 'no_self_promotion'],
    owner_visible_summary: 'Mini-agents are subordinate workers and cannot act independently or talk to Owner outside approved routes.',
  },
  {
    id: 'openclaw_plus',
    label: 'OpenClaw+ / ClaudeClaw',
    role: 'worker_runtime_skills_adapters_reports_layer',
    authority: 'Shared runtime, skills, adapters, reports, and governance layer under Gateway.',
    reports_to: ['gateway', 'agent_zero'],
    supervises: [],
    execution_mode: 'worker_runtime_gated_by_gateway_and_bridge_session',
    can_recommend: false,
    can_design: false,
    commander: false,
    active: true,
    archived: false,
    policy_tags: ['runtime_worker_system', 'bridge_session_required_for_side_effects'],
    owner_visible_summary: 'OpenClaw+ remains a worker/runtime system and skills layer.',
  },
  {
    id: 'opencloud',
    label: 'OpenCloud',
    role: 'worker_runtime_engine_skill_tool_agent_creation_layer',
    authority: 'Worker/runtime engine and Build-Wiki/Farmer support layer retained under Gateway control.',
    reports_to: ['gateway', 'agent_zero'],
    supervises: [],
    execution_mode: 'worker_runtime_gated_by_gateway_and_bridge_session',
    can_recommend: false,
    can_design: false,
    commander: false,
    active: true,
    archived: false,
    policy_tags: ['opencloud_retained', 'not_deletion_target', 'bridge_session_required_for_farmer_execution'],
    owner_visible_summary: 'OpenCloud stays as a worker/runtime engine and is not approved for deletion or disablement.',
  },
  {
    id: 'tony_legacy',
    label: 'Tony Legacy',
    role: 'retired_archive_only',
    authority: 'Historical archive only; no active commander, owner-facing, approval, or routing authority.',
    reports_to: [],
    supervises: [],
    execution_mode: 'archive_only',
    can_recommend: false,
    can_design: false,
    commander: false,
    active: false,
    archived: true,
    policy_tags: ['tony_retired_archive_only', 'no_active_authority'],
    owner_visible_summary: 'Tony remains historical archive only and must not appear as active authority.',
  },
]

export function getGatewayRoleMatrixEntry(id: string): GatewayRoleMatrixEntry | null {
  const normalized = normalizeGatewayId(id)
  return GATEWAY_ROLE_MATRIX.find((entry) => normalizeGatewayId(entry.id) === normalized) || null
}
