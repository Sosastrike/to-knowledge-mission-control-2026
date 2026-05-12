import type { SpaceAgentBrowserAutomationPayload } from './space-agent-browser-automation'
import type { GatewayApiNode } from './gateway-registry-api'
import {
  buildCanonicalAgentRegistryPayload,
  getCanonicalAgentRegistry,
  normalizeCanonicalAgentId,
  type CanonicalAgentId,
  type CanonicalAgentRegistryPayloadEntry,
  type CanonicalAgentRegistryEntry,
  type CanonicalAgentHubState,
} from './canonical-agent-registry'
import { describeOwnerFacingStatus, OWNER_FACING_STATUS_STATES, type OwnerFacingStatusDescriptor } from './owner-status'
import {
  buildGatewayFlowsPayload,
  buildGatewayNodesPayload,
  getGatewayNodeDetail,
} from './gateway-registry-api'
import type { GatewayEdge, GatewayFlow, GatewayRegistry, GatewayStatus } from './gateway-model'

export type AgentHubAgentId = CanonicalAgentId

export type AgentHubAgentState = CanonicalAgentHubState

export type AgentHubRuntimeSystem = {
  id: string
  name: string
  type: string
  status: GatewayStatus
  connected: boolean
  configured: boolean
  read_enabled: boolean
  write_enabled: boolean
  execution_enabled: boolean
  requires_bridge_session: boolean
  blocked_reason: string | null
  owner_status: OwnerFacingStatusDescriptor
}

export type AgentHubAgent = {
  id: AgentHubAgentId
  registry_node_id: string
  name: string
  role: string
  layer: string
  status: AgentHubAgentState
  gateway_health: GatewayStatus
  production_truth: string
  live_interface_proven: boolean
  called_true_proven: boolean
  connected: boolean
  configured: boolean
  read_enabled: boolean
  write_enabled: boolean
  execution_enabled: boolean
  requires_bridge_session: boolean
  blocked_reason: string | null
  blockers: string[]
  owner_status: OwnerFacingStatusDescriptor
  supervisors: string[]
  capabilities: string[]
  routes: {
    status: string
    detail: string
    health: string
    routes: string
    audit: string
    bridge_status: string | null
  }
  interface: {
    mission_control_surface: string
    owner_access: string
    local_ui_url: string | null
    tailnet_url: string | null
    ui_mode: 'mission_control_proxy' | 'local_only_pending' | 'tailnet_pending' | 'not_installed' | 'service_gated'
    iframe_allowed: false
    auth_required: true
    local_ui_proven: boolean
    tailnet_ui_proven: boolean
    public_exposure: false
  }
  policy: {
    bridge_session_required_for_writes: true
    external_writes_enabled: false
    no_raw_paths: true
    no_secrets: true
    no_fake_done: true
  }
}

export type AgentHubStatusPayload = {
  ok: true
  mode: 'gateway_agent_hub_status_read_only'
  generated_at: string
  title: 'Agent Hub / Control Center'
  source: 'gateway_registry'
  mock_data_used: false
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
  agents_total: number
  live_interfaces_proven: number
  gated_or_blocked: number
  allowed_owner_statuses: typeof OWNER_FACING_STATUS_STATES
  owner_status_summary: Record<string, number>
  production_truth: {
    agent_zero: 'credential_gated_until_agent_zero_external_api_key_available'
    hermes: 'partial_safe_adapter_proven_but_runtime_service_down'
    pi_mono: 'live_shadow_dispatcher_advisory_only'
    spaceagent: 'youtube_transcript_ready_playwright_service_down_firecrawl_credential_gated'
    paperclip: 'service_down_until_paperclip_sandbox_runtime_running'
    openclaw_plus: 'service_down_until_openclaw_cli_reachable'
    buildwiki_fork2_smb: 'blocked'
    buildwiki_run_now_scope: 'opencloud-docs-farmer.service_only'
  }
  canonical_agent_registry: CanonicalAgentRegistryPayloadEntry[]
  agents: AgentHubAgent[]
  space_agent_browser_automation?: SpaceAgentBrowserAutomationPayload
  supporting_runtime_systems: AgentHubRuntimeSystem[]
  buildwiki_run_now: {
    target_service: 'opencloud-docs-farmer.service'
    bridge_session_required: true
    owner_approval_required: true
    execution_enabled: false
    fork2_smb_status: 'blocked'
  }
  design_handoff: {
    expected_files_present: boolean
    production_uses_mock_data: false
    note: string
  }
}

export type AgentHubRegistryPayload = {
  ok: true
  mode: 'gateway_agent_hub_registry_read_only'
  generated_at: string
  source: 'gateway_registry'
  mock_data_used: false
  canonical_agent_registry: CanonicalAgentRegistryPayloadEntry[]
  agents: AgentHubAgent[]
  space_agent_browser_automation?: SpaceAgentBrowserAutomationPayload
  supporting_runtime_systems: AgentHubRuntimeSystem[]
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

export type AgentHubAgentsPayload = {
  ok: true
  mode: 'gateway_agent_hub_agents_read_only'
  generated_at: string
  source: 'gateway_registry'
  mock_data_used: false
  canonical_agent_registry: CanonicalAgentRegistryPayloadEntry[]
  agents: AgentHubAgent[]
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

export type AgentHubAgentPayload = {
  ok: true
  mode: 'gateway_agent_hub_agent_detail_read_only'
  generated_at: string
  source: 'gateway_registry'
  mock_data_used: false
  agent: AgentHubAgent
  node: GatewayApiNode | null
  inbound_edges: GatewayEdge[]
  outbound_edges: GatewayEdge[]
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

export type AgentHubAgentHealthPayload = {
  ok: true
  mode: 'gateway_agent_hub_agent_health_read_only'
  generated_at: string
  agent_id: AgentHubAgentId
  registry_node_id: string
  status: AgentHubAgentState
  gateway_health: GatewayStatus
  connected: boolean
  configured: boolean
  live_interface_proven: boolean
  called_true_proven: boolean
  last_success: string | null
  last_error: string | null
  blocker: string | null
  owner_status: OwnerFacingStatusDescriptor
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

export type AgentHubAgentRoutesPayload = {
  ok: true
  mode: 'gateway_agent_hub_agent_routes_read_only'
  generated_at: string
  agent_id: AgentHubAgentId
  registry_node_id: string
  registered_edges: GatewayEdge[]
  registered_flows: Array<Pick<GatewayFlow, 'flow_id' | 'source' | 'target' | 'requested_action' | 'selected_route' | 'policy_result' | 'status' | 'result'>>
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

export type AgentHubAgentAuditPayload = {
  ok: true
  mode: 'gateway_agent_hub_agent_audit_read_only'
  generated_at: string
  agent_id: AgentHubAgentId
  registry_node_id: string
  audit_events: Array<{
    event: string
    route_target: string
    decision: string
    allowed: boolean
    blocked_reason: string | null
    external_write: boolean
    bridge_session_id: string | null
    secrets_exposed: false
    recorded_at: string | null
  }>
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

type AgentHubDefinition = CanonicalAgentRegistryEntry

const AGENT_HUB_DEFINITIONS: AgentHubDefinition[] = getCanonicalAgentRegistry('agent_hub')

const SUPPORTING_RUNTIME_NODE_IDS = [
  'gateway',
  'paperclip',
  'openclaw_plus',
  'buildwiki',
  'brain',
  'brain_sync',
  'bridge_mcp',
  'mcp_gateway',
  'models',
  'tools',
  'skills',
  'integrations',
]

export function normalizeAgentHubAgentId(value: string): AgentHubAgentId | null {
  return normalizeCanonicalAgentId(value)
}

export function buildAgentHubStatusPayload(registry: GatewayRegistry): AgentHubStatusPayload {
  const agents = buildAgentHubAgents(registry)
  return {
    ok: true,
    mode: 'gateway_agent_hub_status_read_only',
    generated_at: registry.generated_at,
    title: 'Agent Hub / Control Center',
    source: 'gateway_registry',
    mock_data_used: false,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
    agents_total: agents.length,
    live_interfaces_proven: agents.filter((agent) => agent.live_interface_proven).length,
    gated_or_blocked: agents.filter((agent) => ['gated', 'pending', 'blocked'].includes(agent.status)).length,
    allowed_owner_statuses: OWNER_FACING_STATUS_STATES,
    owner_status_summary: summarizeOwnerStatuses(agents.map((agent) => agent.owner_status)),
    production_truth: {
      agent_zero: 'credential_gated_until_agent_zero_external_api_key_available',
      hermes: 'partial_safe_adapter_proven_but_runtime_service_down',
      pi_mono: 'live_shadow_dispatcher_advisory_only',
      spaceagent: 'youtube_transcript_ready_playwright_service_down_firecrawl_credential_gated',
      paperclip: 'service_down_until_paperclip_sandbox_runtime_running',
      openclaw_plus: 'service_down_until_openclaw_cli_reachable',
      buildwiki_fork2_smb: 'blocked',
      buildwiki_run_now_scope: 'opencloud-docs-farmer.service_only',
    },
    canonical_agent_registry: buildCanonicalAgentRegistryPayload('agent_hub'),
    agents,
    supporting_runtime_systems: buildSupportingRuntimeSystems(registry),
    buildwiki_run_now: {
      target_service: 'opencloud-docs-farmer.service',
      bridge_session_required: true,
      owner_approval_required: true,
      execution_enabled: false,
      fork2_smb_status: 'blocked',
    },
    design_handoff: {
      expected_files_present: true,
      production_uses_mock_data: false,
      note: 'The accepted Agent Hub v2 Browser Automation and Paperclip v1 handoff assets are present under design/gateway. Production renders the same control-center structure from live Gateway registry data, not stale mock agent-data.js.',
    },
  }
}

export function buildAgentHubAgentsPayload(registry: GatewayRegistry): AgentHubAgentsPayload {
  return {
    ok: true,
    mode: 'gateway_agent_hub_agents_read_only',
    generated_at: registry.generated_at,
    source: 'gateway_registry',
    mock_data_used: false,
    canonical_agent_registry: buildCanonicalAgentRegistryPayload('agent_hub'),
    agents: buildAgentHubAgents(registry),
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

export function buildAgentHubRegistryPayload(registry: GatewayRegistry): AgentHubRegistryPayload {
  return {
    ok: true,
    mode: 'gateway_agent_hub_registry_read_only',
    generated_at: registry.generated_at,
    source: 'gateway_registry',
    mock_data_used: false,
    canonical_agent_registry: buildCanonicalAgentRegistryPayload('agent_hub'),
    agents: buildAgentHubAgents(registry),
    supporting_runtime_systems: buildSupportingRuntimeSystems(registry),
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

export function getAgentHubAgentPayload(registry: GatewayRegistry, id: string): AgentHubAgentPayload | null {
  const agent = findAgentHubAgent(registry, id)
  if (!agent) return null
  const detail = getGatewayNodeDetail(registry, agent.registry_node_id)
  return {
    ok: true,
    mode: 'gateway_agent_hub_agent_detail_read_only',
    generated_at: registry.generated_at,
    source: 'gateway_registry',
    mock_data_used: false,
    agent,
    node: detail?.node || null,
    inbound_edges: detail?.inbound_edges || [],
    outbound_edges: detail?.outbound_edges || [],
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

export function buildAgentHubAgentHealthPayload(registry: GatewayRegistry, id: string): AgentHubAgentHealthPayload | null {
  const agent = findAgentHubAgent(registry, id)
  if (!agent) return null
  const detail = getGatewayNodeDetail(registry, agent.registry_node_id)
  return {
    ok: true,
    mode: 'gateway_agent_hub_agent_health_read_only',
    generated_at: registry.generated_at,
    agent_id: agent.id,
    registry_node_id: agent.registry_node_id,
    status: agent.status,
    gateway_health: agent.gateway_health,
    connected: agent.connected,
    configured: agent.configured,
    live_interface_proven: agent.live_interface_proven,
    called_true_proven: agent.called_true_proven,
    last_success: detail?.node.last_success || null,
    last_error: detail?.node.last_error || agent.blocked_reason,
    blocker: agent.blocked_reason,
    owner_status: agent.owner_status,
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

export function buildAgentHubAgentRoutesPayload(registry: GatewayRegistry, id: string): AgentHubAgentRoutesPayload | null {
  const agent = findAgentHubAgent(registry, id)
  if (!agent) return null
  const flows = buildGatewayFlowsPayload(registry).flows
  return {
    ok: true,
    mode: 'gateway_agent_hub_agent_routes_read_only',
    generated_at: registry.generated_at,
    agent_id: agent.id,
    registry_node_id: agent.registry_node_id,
    registered_edges: registry.edges.filter((edge) => edge.source === agent.registry_node_id || edge.target === agent.registry_node_id),
    registered_flows: flows
      .filter((flow) => flow.source === agent.registry_node_id || flow.target === agent.registry_node_id || flow.selected_route.hops.includes(agent.registry_node_id))
      .map((flow) => ({
        flow_id: flow.flow_id,
        source: flow.source,
        target: flow.target,
        requested_action: flow.requested_action,
        selected_route: flow.selected_route,
        policy_result: flow.policy_result,
        status: flow.status,
        result: flow.result,
      })),
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

export function buildAgentHubAgentAuditPayload(registry: GatewayRegistry, id: string): AgentHubAgentAuditPayload | null {
  const agent = findAgentHubAgent(registry, id)
  if (!agent) return null
  const flows = buildGatewayFlowsPayload(registry).flows
  const flowEvents = flows
    .filter((flow) => flow.source === agent.registry_node_id || flow.target === agent.registry_node_id || flow.selected_route.hops.includes(agent.registry_node_id))
    .flatMap((flow) => flow.audit_log.map((entry) => ({
      event: entry.event,
      route_target: entry.route_target || flow.target,
      decision: entry.decision || flow.policy_result.route_decision,
      allowed: entry.allowed ?? flow.policy_result.allowed,
      blocked_reason: entry.blocked_reason || flow.policy_result.blocked_reason,
      external_write: entry.external_write,
      bridge_session_id: entry.bridge_session_id,
      secrets_exposed: false as const,
      recorded_at: entry.recorded_at,
    })))
  return {
    ok: true,
    mode: 'gateway_agent_hub_agent_audit_read_only',
    generated_at: registry.generated_at,
    agent_id: agent.id,
    registry_node_id: agent.registry_node_id,
    audit_events: [
      {
        event: 'agent_hub.node.status_observed',
        route_target: agent.registry_node_id,
        decision: agent.status,
        allowed: agent.read_enabled,
        blocked_reason: agent.blocked_reason,
        external_write: false,
        bridge_session_id: null,
        secrets_exposed: false,
        recorded_at: registry.generated_at,
      },
      ...flowEvents,
    ],
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

function findAgentHubAgent(registry: GatewayRegistry, id: string): AgentHubAgent | null {
  const normalized = normalizeAgentHubAgentId(id)
  if (!normalized) return null
  return buildAgentHubAgents(registry).find((agent) => agent.id === normalized) || null
}

function buildAgentHubAgents(registry: GatewayRegistry): AgentHubAgent[] {
  const nodes = buildGatewayNodesPayload(registry).nodes
  return AGENT_HUB_DEFINITIONS.map((definition) => {
    const node = nodes.find((item) => item.id === definition.registryNodeId) || null
    const registryNode = registry.nodes.find((item) => item.id === definition.registryNodeId)
    const observedBlockers = [
      ...(node?.blocked_reason ? [node.blocked_reason] : []),
      ...(registryNode?.blockers || []),
    ]
    const blockers = ownerSafeList([...definition.extraBlockers, ...observedBlockers])
    const readEnabled = Boolean(node?.read_enabled) || definition.agentHubStatus === 'partial_go' || definition.agentHubStatus === 'read_only'
    const ownerStatus = describeOwnerFacingStatus({
      rawStatus: definition.agentHubStatus,
      blockers,
      summary: definition.productionTruth,
      connected: definition.liveInterfaceProven && Boolean(node?.connected),
      configured: Boolean(node?.configured) && blockers.length === 0,
      readEnabled,
      writeEnabled: false,
      executionEnabled: false,
      requiresBridgeSession: true,
      requiresOwnerApproval: definition.agentHubStatus === 'gated',
      preferReadyWhenReadable: definition.agentHubStatus === 'partial_go' || definition.agentHubStatus === 'read_only',
    })
    return {
      id: definition.id,
      registry_node_id: definition.registryNodeId,
      name: definition.name,
      role: definition.role,
      layer: definition.layer,
      status: definition.agentHubStatus,
      gateway_health: node?.status || 'missing',
      production_truth: definition.productionTruth,
      live_interface_proven: definition.liveInterfaceProven,
      called_true_proven: definition.calledTrueProven,
      connected: definition.liveInterfaceProven && Boolean(node?.connected),
      configured: Boolean(node?.configured) && blockers.length === 0,
      read_enabled: readEnabled,
      write_enabled: false,
      execution_enabled: false,
      requires_bridge_session: true,
      blocked_reason: blockers[0] || null,
      blockers,
      owner_status: ownerStatus,
      supervisors: ownerSafeList(registryNode?.supervisors || []),
      capabilities: ownerSafeList(node?.capabilities || registryNode?.capabilities || []),
      routes: {
        status: '/api/gateway/agent-hub/status',
        detail: '/api/gateway/agent-hub/agents/' + definition.id,
        health: '/api/gateway/agent-hub/agents/' + definition.id + '/health',
        routes: '/api/gateway/agent-hub/agents/' + definition.id + '/routes',
        audit: '/api/gateway/agent-hub/agents/' + definition.id + '/audit',
        bridge_status: definition.bridgeStatusRoute,
      },
      interface: {
        mission_control_surface: '/gateway/agent-hub' + (definition.id === 'paperclip' ? '/paperclip' : ''),
        owner_access: definition.interfaceSummary,
        local_ui_url: null,
        tailnet_url: null,
        ui_mode: definition.uiMode,
        iframe_allowed: false,
        auth_required: true,
        local_ui_proven: false,
        tailnet_ui_proven: false,
        public_exposure: false,
      },
      policy: {
        bridge_session_required_for_writes: true,
        external_writes_enabled: false,
        no_raw_paths: true,
        no_secrets: true,
        no_fake_done: true,
      },
    }
  })
}

function buildSupportingRuntimeSystems(registry: GatewayRegistry): AgentHubRuntimeSystem[] {
  const nodes = buildGatewayNodesPayload(registry).nodes
  return SUPPORTING_RUNTIME_NODE_IDS.map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is GatewayApiNode => Boolean(node))
    .map((node) => {
      const ownerStatus = describeOwnerFacingStatus({
        rawStatus: node.status,
        blockers: node.blocked_reason ? [node.blocked_reason] : [],
        summary: node.health?.summary || null,
        connected: node.connected,
        configured: node.configured,
        readEnabled: node.read_enabled,
        writeEnabled: false,
        executionEnabled: false,
        requiresBridgeSession: node.requires_bridge_session,
      })
      return {
        id: node.id,
        name: node.name,
        type: node.type,
        status: node.status,
        connected: node.connected,
        configured: node.configured,
        read_enabled: node.read_enabled,
        write_enabled: false,
        execution_enabled: false,
        requires_bridge_session: node.requires_bridge_session,
        blocked_reason: ownerSafeText(node.blocked_reason),
        owner_status: ownerStatus,
      }
    })
}

function summarizeOwnerStatuses(statuses: OwnerFacingStatusDescriptor[]): Record<string, number> {
  return OWNER_FACING_STATUS_STATES.reduce((acc, status) => {
    acc[status] = statuses.filter((item) => item.status === status).length
    return acc
  }, {} as Record<string, number>)
}

function ownerSafeList(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => ownerSafeText(value)).filter((value): value is string => Boolean(value))))
}

function ownerSafeText(value: string | null | undefined): string | null {
  if (!value) return null
  return value
    .replace(/\/home\/tony[^\s,;)]+/gi, '[redacted-path]')
    .replace(/\/a0\/(?:usr|tmp|var)[^\s,;)]+/gi, '[redacted-path]')
    .replace(/auth\.json/gi, '[redacted-auth-file]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9]{12,}/gi, '[redacted-secret]')
}


export function attachSpaceAgentBrowserAutomationStatus(
  payload: AgentHubStatusPayload,
  browserAutomation: SpaceAgentBrowserAutomationPayload,
): AgentHubStatusPayload {
  return {
    ...payload,
    space_agent_browser_automation: browserAutomation,
  }
}
