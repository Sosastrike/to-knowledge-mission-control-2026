import type { SpaceAgentBrowserAutomationPayload } from './space-agent-browser-automation'
import type { GatewayApiNode } from './gateway-registry-api'
import {
  buildGatewayFlowsPayload,
  buildGatewayNodesPayload,
  getGatewayNodeDetail,
} from './gateway-registry-api'
import type { GatewayEdge, GatewayFlow, GatewayRegistry, GatewayStatus } from './gateway-model'

export type AgentHubAgentId = 'paperclip' | 'agent-zero' | 'hermes' | 'spaceagent' | 'pi-mono' | 'openclaw-plus'

export type AgentHubAgentState = 'partial_go' | 'gated' | 'pending' | 'blocked' | 'read_only'

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
  production_truth: {
    agent_zero: 'partial_go_commander_track'
    hermes: 'gated_until_hermes_called_true'
    pi_mono: 'live_shadow_dispatcher_advisory_only'
    spaceagent: 'playwright_mcp_live_local_only_browser_research'
    paperclip: 'partial_degraded_until_local_or_tailnet_owner_ui_proven'
    openclaw_plus: 'service_down_until_openclaw_cli_reachable'
    buildwiki_fork2_smb: 'blocked'
    buildwiki_run_now_scope: 'opencloud-docs-farmer.service_only'
  }
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

type AgentHubDefinition = {
  id: AgentHubAgentId
  registryNodeId: string
  name: string
  role: string
  layer: string
  productionTruth: string
  status: AgentHubAgentState
  liveInterfaceProven: boolean
  calledTrueProven: boolean
  interfaceSummary: string
  localUiUrl: string | null
  tailnetUrl: string | null
  uiMode: AgentHubAgent['interface']['ui_mode']
  bridgeStatusRoute: string | null
  extraBlockers: string[]
}

const AGENT_HUB_DEFINITIONS: AgentHubDefinition[] = [
  {
    id: 'paperclip',
    registryNodeId: 'paperclip',
    name: 'Paperclip',
    role: 'Workforce Control Plane',
    layer: 'workforce_and_task_orchestration_before_openclaw_runtime',
    productionTruth: 'partial/degraded until local or Tailnet owner login, company dashboard, agent roster, and task queue are proven',
    status: 'pending',
    liveInterfaceProven: false,
    calledTrueProven: false,
    interfaceSummary: 'Mission Control node visible; Paperclip service and owner session proof pending',
    localUiUrl: null,
    tailnetUrl: null,
    uiMode: 'local_only_pending',
    bridgeStatusRoute: '/api/bridge/paperclip/status',
    extraBlockers: ['paperclip_localhost_or_tailnet_ui_not_proven'],
  },
  {
    id: 'agent-zero',
    registryNodeId: 'agent_zero',
    name: 'Agent Zero',
    role: 'Commander',
    layer: 'command_authority',
    productionTruth: 'commander track; authenticated test-chat has returned agent_zero_called:true, final GO still depends on every downstream route',
    status: 'partial_go',
    liveInterfaceProven: true,
    calledTrueProven: true,
    interfaceSummary: 'Mission Control bridge surface available; Agent Zero remains owner-facing commander',
    localUiUrl: null,
    tailnetUrl: null,
    uiMode: 'mission_control_proxy',
    bridgeStatusRoute: '/api/bridge/agent-zero/status',
    extraBlockers: ['agent_zero_full_go_requires_downstream_route_completion'],
  },
  {
    id: 'hermes',
    registryNodeId: 'hermes',
    name: 'Hermes',
    role: 'Lieutenant / Skill + Workflow Builder',
    layer: 'planning_and_skill_design',
    productionTruth: 'yellow/gated until hermes_called:true is proven',
    status: 'gated',
    liveInterfaceProven: false,
    calledTrueProven: false,
    interfaceSummary: 'Read-only status visible; live chat proof pending',
    localUiUrl: null,
    tailnetUrl: null,
    uiMode: 'service_gated',
    bridgeStatusRoute: '/api/bridge/hermes/status',
    extraBlockers: ['hermes_called_true_not_proven'],
  },
  {
    id: 'spaceagent',
    registryNodeId: 'space_agent',
    name: 'SpaceAgent',
    role: 'Browser / Firecrawl / YouTube Research Specialist',
    layer: 'web_research_specialist',
    productionTruth: 'Playwright MCP browser automation is live as a local-only SpaceAgent research tool; interactive/authenticated actions remain Bridge Session gated',
    status: 'read_only',
    liveInterfaceProven: true,
    calledTrueProven: false,
    interfaceSummary: 'Gateway research node visible; Playwright MCP is connected at localhost only and returns read-only Browser Evidence Packets',
    localUiUrl: null,
    tailnetUrl: null,
    uiMode: 'mission_control_proxy',
    bridgeStatusRoute: '/api/bridge/space-agent/status',
    extraBlockers: ['firecrawl_credential_required', 'youtube_transcript_connector_not_proven', 'interactive_browser_actions_require_bridge_session'],
  },
  {
    id: 'pi-mono',
    registryNodeId: 'pi',
    name: 'Pi-mono',
    role: 'Dispatcher / Route Optimizer Candidate',
    layer: 'shadow_dispatch_recommendation',
    productionTruth: 'Mission Control in-process shadow dispatcher is live for advisory route recommendations; execution and writes remain disabled',
    status: 'read_only',
    liveInterfaceProven: true,
    calledTrueProven: false,
    interfaceSummary: 'Shadow dispatcher candidate; recommendations only, no execution authority',
    localUiUrl: null,
    tailnetUrl: null,
    uiMode: 'mission_control_proxy',
    bridgeStatusRoute: '/api/bridge/pi/status',
    extraBlockers: [],
  },
  {
    id: 'openclaw-plus',
    registryNodeId: 'openclaw_plus',
    name: 'OpenClaw+',
    role: 'Runtime / Skills / Mini-Agent Execution Layer',
    layer: 'runtime_skills_agents_mini_agent_execution_layer',
    productionTruth: 'SERVICE_DOWN until an approved OpenClaw+ CLI/runtime binary is installed or exposed to the Mission Control runtime service user and the doctor route returns a real health payload',
    status: 'blocked',
    liveInterfaceProven: false,
    calledTrueProven: false,
    interfaceSummary: 'Runtime / skills / mini-agent execution layer remains visible but blocked until OpenClaw+ doctor runtime is reachable',
    localUiUrl: null,
    tailnetUrl: null,
    uiMode: 'service_gated',
    bridgeStatusRoute: '/api/openclaw/doctor',
    extraBlockers: ['openclaw_doctor_runtime_not_reachable'],
  },
]

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
  const normalized = value.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')
  if (normalized === 'paperclip') return 'paperclip'
  if (normalized === 'agent-zero' || normalized === 'agentzero') return 'agent-zero'
  if (normalized === 'hermes') return 'hermes'
  if (normalized === 'space-agent' || normalized === 'spaceagent') return 'spaceagent'
  if (normalized === 'pi' || normalized === 'pi-mono' || normalized === 'pimono') return 'pi-mono'
  if (normalized === 'openclaw' || normalized === 'openclaw+' || normalized === 'openclaw-plus' || normalized === 'openclawplus') return 'openclaw-plus'
  return null
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
    production_truth: {
      agent_zero: 'partial_go_commander_track',
      hermes: 'gated_until_hermes_called_true',
      pi_mono: 'live_shadow_dispatcher_advisory_only',
      spaceagent: 'playwright_mcp_live_local_only_browser_research',
      paperclip: 'partial_degraded_until_local_or_tailnet_owner_ui_proven',
      openclaw_plus: 'service_down_until_openclaw_cli_reachable',
      buildwiki_fork2_smb: 'blocked',
      buildwiki_run_now_scope: 'opencloud-docs-farmer.service_only',
    },
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
    const preferDefinitionBlocker = definition.id === 'pi-mono' || definition.id === 'spaceagent' || definition.id === 'openclaw-plus'
    const blockers = ownerSafeList(preferDefinitionBlocker
      ? [...definition.extraBlockers, ...observedBlockers]
      : [...observedBlockers, ...definition.extraBlockers])
    return {
      id: definition.id,
      registry_node_id: definition.registryNodeId,
      name: definition.name,
      role: definition.role,
      layer: definition.layer,
      status: definition.status,
      gateway_health: node?.status || 'missing',
      production_truth: definition.productionTruth,
      live_interface_proven: definition.liveInterfaceProven,
      called_true_proven: definition.calledTrueProven,
      connected: definition.liveInterfaceProven && Boolean(node?.connected),
      configured: Boolean(node?.configured) && blockers.length === 0,
      read_enabled: Boolean(node?.read_enabled) || definition.status === 'partial_go',
      write_enabled: false,
      execution_enabled: false,
      requires_bridge_session: true,
      blocked_reason: blockers[0] || null,
      blockers,
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
        local_ui_url: definition.localUiUrl,
        tailnet_url: definition.tailnetUrl,
        ui_mode: definition.uiMode,
        iframe_allowed: false,
        auth_required: true,
        local_ui_proven: definition.localUiUrl !== null && definition.liveInterfaceProven,
        tailnet_ui_proven: definition.tailnetUrl !== null && definition.liveInterfaceProven,
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
    .map((node) => ({
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
    }))
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
