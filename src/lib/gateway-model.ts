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
  status: GatewayStatus
  owner: string
  visibility: GatewayVisibility
  health: GatewayHealth
  capabilities: string[]
  blockers: string[]
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
  'source' | 'target' | 'requested_action' | 'selected_route' | 'policy_result' | 'bridge_session_id' | 'status'
> & Partial<Pick<
  GatewayFlow,
  'source' | 'target' | 'requested_action' | 'selected_route' | 'policy_result' | 'bridge_session_id' | 'status'
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

  return {
    ...input,
    source: input.source || input.request.source || route.source,
    target: input.target || input.request.target || route.target,
    requested_action: input.requested_action || input.request.purpose,
    selected_route: selectedRoute,
    policy_result: policyResult,
    bridge_session_id: input.bridge_session_id ?? null,
    status: input.status || input.result.status,
    request: {
      ...input.request,
    },
    route,
    audit: {
      ...input.audit,
      events: [...input.audit.events],
    },
    result: {
      ...input.result,
    },
  }
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
        capabilities: [system.role],
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
    { from: 'gateway', to: 'mini_agents', relation: 'dispatches' },
    { from: 'agent_zero', to: 'mini_agents', relation: 'delegates_to' },
    { from: 'hermes', to: 'mini_agents', relation: 'delegates_to' },
    { from: 'mini_agents', to: 'agent_zero', relation: 'reports_to' },
    { from: 'mini_agents', to: 'hermes', relation: 'reports_to' },
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
    },
    health,
  }
}

function createGatewayNode(input: {
  id: string
  label: string
  kind: GatewayNodeKind
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
    status,
    owner: input.owner,
    visibility: input.visibility,
    health: createGatewayHealth(status, blockers[0] || `${input.label} ${status}`, input.lastSeen),
    capabilities: [...input.capabilities],
    blockers,
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
