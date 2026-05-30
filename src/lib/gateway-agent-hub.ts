import type { SpaceAgentBrowserAutomationPayload } from './space-agent-browser-automation'
import type { GatewayApiNode } from './gateway-registry-api'
import type { PlaywrightMcpStatus } from './playwright-mcp'
import {
  buildGatewayFlowsPayload,
  buildGatewayNodesPayload,
  getGatewayNodeDetail,
} from './gateway-registry-api'
import type { GatewayEdge, GatewayFlow, GatewayRegistry, GatewayStatus } from './gateway-model'
import { AGENT_UPDATE_COMPONENTS } from './agent-update-coordinator'
import { buildAgentRoutingLinesStatus } from './agent-routing-lines'
import { RON_WEASLEY_IDENTITY } from './hermes-boundaries'
import { SOFIA_DEPUTY_IDENTITY } from './sofia-identity'

export type AgentHubAgentId = 'paperclip' | 'agent-zero' | 'hermes' | 'sofia' | 'hermes-webui' | 'spaceagent' | 'pi-mono'

export type AgentHubAgentState = 'partial_go' | 'full_access_delegated' | 'gated' | 'pending' | 'blocked' | 'read_only' | 'configured'

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

export type AgentHubDirectAgentLinesSummary = {
  route: '/api/bridge/agent-routing/lines'
  live_trace_route: '/api/bridge/agent-routing/trace/live'
  probe_route: '/api/bridge/agent-routing/trace/probe'
  trace_commands: Array<{
    agent_id: string
    display_name: string
    command: string
    local_probe_command: string
    live_trace_route: '/api/bridge/agent-routing/trace/live'
    trace_href: string
    probe_route: '/api/bridge/agent-routing/trace/probe'
    direct_line_active: true
    opencloud_intermediary_allowed: false
  }>
  total: number
  active: number
  inactive_supporting_runtime: number
  paperclip_company_agents: number
  hermes_mini_agents: number
  ron_mini_agents: number
  future_agent_ready: true
  gateway_architecture: 'owner_to_mission_control_to_nuclear_gateway_to_direct_agent_line'
  direct_line_required_for_owner_messages: true
  conversation_owner_rule: 'target_agent_owns_conversation'
  opencloud_hidden_intermediary_allowed: false
  opencloud_conversation_owner_allowed: false
  opencloud_allowed_role: 'supporting_tool_only_when_explicitly_invoked'
  no_secrets_exposed: true
}

export type AgentHubNuclearGatewayGraphSummary = {
  route: '/api/gateway/agent-hub/status'
  graph_id: 'nuclear_gateway_operational_path'
  central_broker_node: 'nuclear.gateway'
  architecture: 'owner_to_mission_control_to_nuclear_gateway_to_direct_agent_line'
  nodes: Array<{
    id: string
    label: string
    role: string
    direct_line_owner: boolean
    openclaw_conversation_owner_allowed: false
    disabled_reason?: string
  }>
  edges: Array<{
    source: string
    target: string
    relation: 'enters' | 'brokers' | 'routes_to' | 'reports_to' | 'supports'
  }>
  direct_line_trace_buttons: Array<{
    agent_id: string
    label: string
    href: string
  }>
  openclaw_disabled_reason: 'Supporting runtime only — not an agent line.'
  openclaw_hidden_intermediary_allowed: false
  openclaw_commander_allowed: false
  credential_broker: 'nuclear.gateway'
  no_secrets_exposed: true
}

export type AgentHubRonProofPanel = {
  webui: 'READY'
  webui_alias: 'READY'
  full_access_delegation: 'FULL_ACCESS_DELEGATED'
  mission_control_service: 'ACTIVE'
  authenticated_ron_routes: 'RESPONDING'
  direct_line_chat: 'LOCAL_PROOF_PRESENT'
  direct_line_chat_blocker: 'mission_control_authenticated_proxy_send_receive_proof_pending' | 'none'
  direct_line_chat_proof: 'TRACE-MC-RON-20260529T005215Z-LEGACY-ALIAS'
  mission_control_proxy: 'AUTHENTICATED_SEND_RECEIVE_PENDING'
  proxy_proof_route: '/api/bridge/ron/runtime-proof'
  protected_writes_execution: 'JARVIS CONCURRENCE REQUIRED'
  execution_model: 'JARVIS-GATED EXECUTION'
  opencloud_intermediary: false
}

export type AgentHubAutoUpdateControlPlane = {
  route: '/api/bridge/agent-updates/status'
  run_route: '/api/bridge/agent-updates/run'
  visible_task_title: 'Agent Auto-Update Control Plane'
  scheduler_task_id: 'agent_update_check'
  scheduler_interval: 'every_6h'
  auto_apply_setting: 'agent_updates.auto_apply'
  auto_apply_scope: 'exact_scoped_loopback_only'
  safe_auto_apply_components: Array<{
    id: string
    label: string
    apply_target: 'webui' | 'agent'
    rollback: string
  }>
  visible_task_only_components: Array<{
    id: string
    label: string
    reason: string
    rollback: string
  }>
  forbidden_actions: [
    'sudo_or_polkit_without_owner',
    'credential_injection',
    'public_exposure_changes',
    'broad_connector_execution',
    'production_risk_without_rollback',
  ]
  opencloud_intermediary: false
  public_exposure_created: false
  secrets_exposed: false
  raw_env_values_exposed: false
}

export type AgentHubGatewayRouteState = 'READY' | 'DOWN' | 'STALE_UI' | 'ROUTE_MAP_REQUIRED' | 'CDP_NOT_RUNNING'

export type AgentHubGatewayRouteCdpTruth = {
  mode: 'gateway_route_cdp_truth'
  generated_at: string
  route_source: 'source_route_tree'
  route_map_status: 'READY' | 'ROUTE_MAP_REQUIRED'
  cdp_status: 'READY' | 'CDP_NOT_RUNNING' | 'STALE_UI'
  gateway_status: AgentHubGatewayRouteState
  route_count: number
  routes: Array<{
    route: string
    methods: Array<'GET' | 'POST'>
    surface: 'gateway' | 'agent_hub' | 'space_agent' | 'playwright_mcp' | 'data_layer' | 'observability' | 'runtime'
    state: AgentHubGatewayRouteState
    bridge_session_required: boolean
    writes_enabled: false
    public_exposure: false
  }>
  missing_legacy_routes: Array<{
    route: '/tools' | '/routes' | '/health'
    status: 'ROUTE_MAP_REQUIRED'
    correct_route: string
    note: string
  }>
  cdp_truth: {
    running: boolean
    cdpReady: boolean
    status: 'READY' | 'CDP_NOT_RUNNING' | 'STALE_UI'
    service: 'playwright-mcp.service'
    mcp_endpoint: 'http://127.0.0.1:8931/mcp'
    local_only: true
    public_exposure: false
    bridge_session_required_for_interactive_actions: true
    source: 'playwright_mcp_status'
    blocker: string | null
  }
  next_safe_action: string
  opencloud_intermediary: false
  public_exposure_created: false
  secrets_exposed: false
  raw_env_values_exposed: false
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
    ui_mode: 'mission_control_proxy' | 'local_ui' | 'local_only_pending' | 'tailnet_authenticated' | 'tailnet_pending' | 'not_installed' | 'service_gated'
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
  proof_panel?: AgentHubRonProofPanel
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
    hermes: 'full_access_delegated_direct_line'
    pi_mono: 'full_access_gateway_pipeline_agent'
    sofia: 'ron_deputy_dispatcher_direct_line_internal_records_only'
    spaceagent: 'first_class_direct_line_gateway_pipeline_agent'
    paperclip: 'tailnet_ui_ready_company_aliases_recovered_owner_auth_required'
    buildwiki_fork2_smb: 'blocked'
    buildwiki_run_now_scope: 'opencloud-docs-farmer.service_only'
    direct_agent_lines: 'owner_to_mission_control_to_nuclear_gateway_to_target_agent'
  }
  direct_agent_lines: AgentHubDirectAgentLinesSummary
  nuclear_gateway_graph: AgentHubNuclearGatewayGraphSummary
  agent_update_control_plane: AgentHubAutoUpdateControlPlane
  gateway_route_cdp_truth: AgentHubGatewayRouteCdpTruth
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
  direct_agent_lines: AgentHubDirectAgentLinesSummary
  nuclear_gateway_graph: AgentHubNuclearGatewayGraphSummary
  agent_update_control_plane: AgentHubAutoUpdateControlPlane
  gateway_route_cdp_truth: AgentHubGatewayRouteCdpTruth
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
  trace_direct_line: {
    label: 'Trace Direct Line'
    command: string
    local_probe_command: string
    live_trace_route: '/api/bridge/agent-routing/trace/live'
    probe_route: '/api/bridge/agent-routing/trace/probe'
    opencloud_intermediary_allowed: false
  }
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

const RON_DIRECT_LINE_CHAT_PROOF = 'TRACE-MC-RON-20260529T005215Z-LEGACY-ALIAS' as const

const RON_WEASLEY_PROOF_PANEL: AgentHubRonProofPanel = {
  webui: 'READY',
  webui_alias: 'READY',
  full_access_delegation: 'FULL_ACCESS_DELEGATED',
  mission_control_service: 'ACTIVE',
  authenticated_ron_routes: 'RESPONDING',
  direct_line_chat: 'LOCAL_PROOF_PRESENT',
  direct_line_chat_blocker: 'mission_control_authenticated_proxy_send_receive_proof_pending',
  direct_line_chat_proof: RON_DIRECT_LINE_CHAT_PROOF,
  mission_control_proxy: 'AUTHENTICATED_SEND_RECEIVE_PENDING',
  proxy_proof_route: '/api/bridge/ron/runtime-proof',
  protected_writes_execution: 'JARVIS CONCURRENCE REQUIRED',
  execution_model: 'JARVIS-GATED EXECUTION',
  opencloud_intermediary: false,
}

const AGENT_HUB_DEFINITIONS: AgentHubDefinition[] = [
  {
    id: 'paperclip',
    registryNodeId: 'paperclip',
    name: 'Paperclip',
    role: 'Workforce Control Plane',
    layer: 'company_workforce_direct_line',
    productionTruth: 'Paperclip Tailnet UI is reachable at 100.116.35.95:3100. ECO, TKG, and ITT company dashboard aliases are recovered; writes remain Bridge-gated and Pacman bootstrap stays blocked only on paperclip_board_admin_credential_required.',
    status: 'partial_go',
    liveInterfaceProven: true,
    calledTrueProven: false,
    interfaceSummary: 'Open Paperclip through the Tailnet UI, not server localhost. ECO, TKG, and ITT dashboards resolve through the owner-accessible Paperclip service.',
    localUiUrl: null,
    tailnetUrl: 'http://100.116.35.95:3100/ECO/dashboard',
    uiMode: 'tailnet_authenticated',
    bridgeStatusRoute: '/api/bridge/paperclip/status',
    extraBlockers: ['paperclip_writes_bridge_gated', 'paperclip_board_admin_credential_required_for_pacman_bootstrap'],
  },
  {
    id: 'agent-zero',
    registryNodeId: 'agent_zero',
    name: 'Agent Zero',
    role: 'Commander',
    layer: 'command_authority',
    productionTruth: 'Agent Zero / Jarvis is the commander and owner-operator direct line. Nuclear Gateway brokers direct agent lines; OpenClaw/OpenCloud is not the conversation owner, dispatcher, default gateway, or hidden interpreter.',
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
    name: RON_WEASLEY_IDENTITY.canonical_name,
    role: 'Nuclear Dispatcher / Skill + Workflow Architect',
    layer: 'planning_and_skill_design',
    productionTruth: 'Ron Weasley has FULL ACCESS DELEGATED under Agent Zero / Jarvis. Protected writes and execution use JARVIS-GATED EXECUTION and require Jarvis concurrence; Ron is not unrestricted and does not outrank Agent Zero. Local direct-line proof is present; Mission Control proxy send/receive certification is pending the authenticated browser proof run.',
    status: 'full_access_delegated',
    liveInterfaceProven: true,
    calledTrueProven: true,
    interfaceSummary: 'Mission Control Ron Weasley routes and WebUI proxy are responding; protected writes and execution require Jarvis concurrence.',
    localUiUrl: 'http://127.0.0.1:8787/',
    tailnetUrl: null,
    uiMode: 'local_ui',
    bridgeStatusRoute: '/api/bridge/hermes/webui/status',
    extraBlockers: ['jarvis_signed_exact_scope_delegation_required_for_protected_execution'],
  },
  {
    id: 'sofia',
    registryNodeId: 'sofia',
    name: SOFIA_DEPUTY_IDENTITY.display_name,
    role: SOFIA_DEPUTY_IDENTITY.role,
    layer: 'ron_deputy_dispatcher_direct_line',
    productionTruth: 'Sofia is Ron Weasley’s second-in-command and Deputy Nuclear Dispatcher. Sofia may create internal recommendations, Ron review requests, Gateway improvement drafts, cybersecurity review notes, Brain hygiene drafts, and Jarvis concurrence requests; production execution requires Ron plus Jarvis concurrence.',
    status: 'configured',
    liveInterfaceProven: true,
    calledTrueProven: true,
    interfaceSummary: 'Mission Control Sofia deputy direct line is source-configured; writes are internal records only and production execution is blocked without Ron plus Jarvis concurrence.',
    localUiUrl: null,
    tailnetUrl: null,
    uiMode: 'mission_control_proxy',
    bridgeStatusRoute: '/api/bridge/sofia/status',
    extraBlockers: ['production_execution_requires_ron_plus_jarvis_concurrence'],
  },
  {
    id: 'hermes-webui',
    registryNodeId: 'hermes_webui',
    name: 'Ron Weasley WebUI',
    role: 'Ron Weasley Browser Control Surface',
    layer: 'direct_line_browser_interface',
    productionTruth: 'Ron Weasley WebUI is a loopback/Tailnet-only browser surface for Ron Weasley — Nuclear Dispatcher. It is not a second brain, and OpenClaw/OpenCloud is not in the owner-to-Ron path.',
    status: 'configured',
    liveInterfaceProven: true,
    calledTrueProven: true,
    interfaceSummary: 'Standalone WebUI link, canonical preflight/status/identity/routes, and Mission Control Ron Weasley control-plane routes are visible. Production-impacting actions still require Jarvis concurrence.',
    localUiUrl: 'http://127.0.0.1:8787/',
    tailnetUrl: null,
    uiMode: 'local_ui',
    bridgeStatusRoute: '/api/bridge/hermes-webui/status',
    extraBlockers: ['hermes_agent_checkout_or_config_required_for_full_agent_features'],
  },
  {
    id: 'spaceagent',
    registryNodeId: 'space_agent',
    name: 'SpaceAgent',
    role: 'Independent Specialized Agent',
    layer: 'first_class_gateway_pipeline_agent',
    productionTruth: 'SpaceAgent is an independent specialized Mission Control agent under Agent Zero / Jarvis authority. Playwright MCP, Firecrawl, and YouTube are tools under SpaceAgent, not SpaceAgent identity. Production-impacting actions require Jarvis concurrence.',
    status: 'configured',
    liveInterfaceProven: true,
    calledTrueProven: true,
    interfaceSummary: 'Canonical SpaceAgent direct line is source-configured through Nuclear Gateway; legacy /space-agent routes remain aliases while canonical /spaceagent routes carry first-class status, readiness, authority, capability, report, and concurrence surfaces.',
    localUiUrl: null,
    tailnetUrl: null,
    uiMode: 'mission_control_proxy',
    bridgeStatusRoute: '/api/bridge/spaceagent/status',
    extraBlockers: ['production_execution_requires_jarvis_concurrence', 'firecrawl_credential_required', 'interactive_browser_actions_require_bridge_session'],
  },
  {
    id: 'pi-mono',
    registryNodeId: 'pi',
    name: 'Pi',
    role: 'Full Access Gateway Agent',
    layer: 'direct_gateway_pipeline_agent',
    productionTruth: 'Pi is not a dispatcher. Pi has a direct Nuclear Gateway line with full brokered access to tools, skills, MCPs, providers, Brain reads, visible task events, and pipeline requests. Production-impacting execution requires Jarvis concurrence; raw secrets are never exposed.',
    status: 'full_access_delegated',
    liveInterfaceProven: true,
    calledTrueProven: true,
    interfaceSummary: 'Pi is a direct Gateway pipeline agent. Gateway brokers all tools, skills, MCPs, providers, Brain reads, visible task events, and exact-scope action requests; Jarvis remains final authority.',
    localUiUrl: null,
    tailnetUrl: null,
    uiMode: 'mission_control_proxy',
    bridgeStatusRoute: '/api/bridge/pi/status',
    extraBlockers: ['production_execution_requires_jarvis_concurrence'],
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

const GATEWAY_ROUTE_MAP: AgentHubGatewayRouteCdpTruth['routes'] = [
  { route: '/api/gateway/status', methods: ['GET'], surface: 'gateway', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/registry', methods: ['GET'], surface: 'gateway', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/flows', methods: ['GET'], surface: 'gateway', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/nodes', methods: ['GET'], surface: 'gateway', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/nodes/playwright-mcp', methods: ['GET'], surface: 'playwright_mcp', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/agent-hub/status', methods: ['GET'], surface: 'agent_hub', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/agent-hub/registry', methods: ['GET'], surface: 'agent_hub', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/agent-hub/agents', methods: ['GET'], surface: 'agent_hub', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/agent-hub/agents/[id]', methods: ['GET'], surface: 'agent_hub', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/agent-hub/agents/[id]/health', methods: ['GET'], surface: 'agent_hub', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/agent-hub/agents/[id]/routes', methods: ['GET'], surface: 'agent_hub', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/agent-hub/agents/[id]/audit', methods: ['GET'], surface: 'agent_hub', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/bridge/spaceagent/status', methods: ['GET'], surface: 'space_agent', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/bridge/spaceagent/readiness', methods: ['GET'], surface: 'space_agent', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/bridge/spaceagent/capability-map', methods: ['GET'], surface: 'space_agent', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/bridge/spaceagent/authority', methods: ['GET'], surface: 'space_agent', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/bridge/spaceagent/recommendation', methods: ['POST'], surface: 'space_agent', state: 'READY', bridge_session_required: true, writes_enabled: false, public_exposure: false },
  { route: '/api/bridge/spaceagent/report-draft', methods: ['POST'], surface: 'space_agent', state: 'READY', bridge_session_required: true, writes_enabled: false, public_exposure: false },
  { route: '/api/bridge/spaceagent/jarvis-concurrence-request', methods: ['POST'], surface: 'space_agent', state: 'READY', bridge_session_required: true, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/space-agent/browser/status', methods: ['GET'], surface: 'space_agent', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/space-agent/browser/jobs', methods: ['GET', 'POST'], surface: 'space_agent', state: 'READY', bridge_session_required: true, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/space-agent/playwright-mcp/evidence', methods: ['GET'], surface: 'playwright_mcp', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/space-agent/research', methods: ['POST'], surface: 'space_agent', state: 'READY', bridge_session_required: true, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/data-layer/query', methods: ['POST'], surface: 'data_layer', state: 'READY', bridge_session_required: true, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/data-layer/execute', methods: ['POST'], surface: 'data_layer', state: 'READY', bridge_session_required: true, writes_enabled: false, public_exposure: false },
  { route: '/api/gateway/observability', methods: ['GET'], surface: 'observability', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/bridge/playwright-mcp/status', methods: ['GET'], surface: 'playwright_mcp', state: 'READY', bridge_session_required: false, writes_enabled: false, public_exposure: false },
  { route: '/api/bridge/playwright-mcp/smoke', methods: ['POST'], surface: 'playwright_mcp', state: 'CDP_NOT_RUNNING', bridge_session_required: false, writes_enabled: false, public_exposure: false },
]

const GATEWAY_MISSING_LEGACY_ROUTES: AgentHubGatewayRouteCdpTruth['missing_legacy_routes'] = [
  {
    route: '/tools',
    status: 'ROUTE_MAP_REQUIRED',
    correct_route: '/gateway/tools',
    note: 'Owner-facing tools are under the authenticated Gateway shell; /tools is not a canonical top-level route.',
  },
  {
    route: '/routes',
    status: 'ROUTE_MAP_REQUIRED',
    correct_route: '/api/gateway/flows',
    note: 'Gateway route data is exposed by the read-only flows and registry APIs, not a bare /routes endpoint.',
  },
  {
    route: '/health',
    status: 'ROUTE_MAP_REQUIRED',
    correct_route: '/api/gateway/status',
    note: 'Gateway health truth is the authenticated /api/gateway/status route.',
  },
]

export function normalizeAgentHubAgentId(value: string): AgentHubAgentId | null {
  const normalized = value.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')
  if (normalized === 'paperclip') return 'paperclip'
  if (normalized === 'agent-zero' || normalized === 'agentzero') return 'agent-zero'
  if (normalized === 'hermes') return 'hermes'
  if (normalized === 'hermes-webui' || normalized === 'hermeswebui') return 'hermes-webui'
  if (normalized === 'sofia' || normalized === 'sofia-deputy' || normalized === 'deputy-nuclear-dispatcher') return 'sofia'
  if (normalized === 'space-agent' || normalized === 'spaceagent') return 'spaceagent'
  if (normalized === 'pi' || normalized === 'pi-mono' || normalized === 'pimono') return 'pi-mono'
  return null
}

export function buildAgentHubStatusPayload(registry: GatewayRegistry): AgentHubStatusPayload {
  const agents = buildAgentHubAgents(registry)
  const directAgentLines = buildAgentHubDirectAgentLinesSummary()
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
      hermes: 'full_access_delegated_direct_line',
      pi_mono: 'full_access_gateway_pipeline_agent',
      sofia: 'ron_deputy_dispatcher_direct_line_internal_records_only',
      spaceagent: 'first_class_direct_line_gateway_pipeline_agent',
      paperclip: 'tailnet_ui_ready_company_aliases_recovered_owner_auth_required',
      buildwiki_fork2_smb: 'blocked',
      buildwiki_run_now_scope: 'opencloud-docs-farmer.service_only',
      direct_agent_lines: 'owner_to_mission_control_to_nuclear_gateway_to_target_agent',
    },
    direct_agent_lines: directAgentLines,
    nuclear_gateway_graph: buildAgentHubNuclearGatewayGraphSummary(directAgentLines),
    agent_update_control_plane: buildAgentHubAutoUpdateControlPlane(),
    gateway_route_cdp_truth: buildAgentHubGatewayRouteCdpTruth(registry.generated_at),
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
    direct_agent_lines: buildAgentHubDirectAgentLinesSummary(),
    nuclear_gateway_graph: buildAgentHubNuclearGatewayGraphSummary(),
    agent_update_control_plane: buildAgentHubAutoUpdateControlPlane(),
    gateway_route_cdp_truth: buildAgentHubGatewayRouteCdpTruth(registry.generated_at),
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

function buildAgentHubDirectAgentLinesSummary(): AgentHubDirectAgentLinesSummary {
  const status = buildAgentRoutingLinesStatus()
  const activeLines = status.lines.filter((line) => line.direct_line_active)

  return {
    route: '/api/bridge/agent-routing/lines',
    live_trace_route: '/api/bridge/agent-routing/trace/live',
    probe_route: '/api/bridge/agent-routing/trace/probe',
    trace_commands: activeLines.map((line) => {
      const traceId = line.agent_id === 'agent-zero-jarvis'
        ? 'jarvis'
        : line.agent_id === 'ron-weasley'
          ? 'ron'
          : line.agent_id
      return {
        agent_id: line.agent_id,
        display_name: line.display_name,
        command: `ssh tony@100.116.35.95 'bash /home/tony/agent-line-trace.sh --agent ${traceId}'`,
        local_probe_command: `bash /home/tony/agent-line-trace.sh --agent ${traceId} --local-probe`,
        live_trace_route: '/api/bridge/agent-routing/trace/live',
        trace_href: `/api/bridge/agent-routing/trace/live?agent=${encodeURIComponent(traceId)}`,
        probe_route: '/api/bridge/agent-routing/trace/probe',
        direct_line_active: true,
        opencloud_intermediary_allowed: false,
      }
    }),
    total: status.lines_count,
    active: activeLines.length,
    inactive_supporting_runtime: status.lines.filter((line) => !line.direct_line_active && line.system_type === 'supporting_runtime_system').length,
    paperclip_company_agents: status.lines.filter((line) => line.system_type === 'paperclip_company_agent').length,
    hermes_mini_agents: status.lines.filter((line) => line.system_type === 'hermes_mini_agent' || line.system_type === 'ron_mini_agent').length,
    ron_mini_agents: status.lines.filter((line) => line.system_type === 'ron_mini_agent').length,
    future_agent_ready: true,
    gateway_architecture: 'owner_to_mission_control_to_nuclear_gateway_to_direct_agent_line',
    direct_line_required_for_owner_messages: true,
    conversation_owner_rule: 'target_agent_owns_conversation',
    opencloud_hidden_intermediary_allowed: false,
    opencloud_conversation_owner_allowed: false,
    opencloud_allowed_role: 'supporting_tool_only_when_explicitly_invoked',
    no_secrets_exposed: true,
  }
}

function buildAgentHubNuclearGatewayGraphSummary(
  directLines: AgentHubDirectAgentLinesSummary = buildAgentHubDirectAgentLinesSummary(),
): AgentHubNuclearGatewayGraphSummary {
  return {
    route: '/api/gateway/agent-hub/status',
    graph_id: 'nuclear_gateway_operational_path',
    central_broker_node: 'nuclear.gateway',
    architecture: 'owner_to_mission_control_to_nuclear_gateway_to_direct_agent_line',
    nodes: [
      { id: 'owner', label: 'Owner', role: 'final authority', direct_line_owner: false, openclaw_conversation_owner_allowed: false },
      { id: 'mission.control', label: 'Mission Control', role: 'owner-control surface and task proof board', direct_line_owner: false, openclaw_conversation_owner_allowed: false },
      { id: 'nuclear.gateway', label: 'Nuclear Gateway', role: 'central broker for policy, routing, tools, credentials, audit, and rollback', direct_line_owner: false, openclaw_conversation_owner_allowed: false },
      { id: 'agent.zero', label: 'Agent Zero / Jarvis', role: 'commander and owner-operator direct line', direct_line_owner: true, openclaw_conversation_owner_allowed: false },
      { id: 'ron.weasley', label: 'Ron Weasley', role: 'Nuclear Dispatcher under Jarvis', direct_line_owner: true, openclaw_conversation_owner_allowed: false },
      { id: 'sofia', label: 'Sofia', role: 'Second-in-Command to Ron Weasley', direct_line_owner: true, openclaw_conversation_owner_allowed: false },
      { id: 'pi', label: 'Pi', role: 'Full Access Gateway Agent under Jarvis authority', direct_line_owner: true, openclaw_conversation_owner_allowed: false },
      { id: 'paperclip', label: 'Paperclip', role: 'company workforce and execution plane', direct_line_owner: true, openclaw_conversation_owner_allowed: false },
      { id: 'spaceagent', label: 'SpaceAgent', role: 'independent specialized agent under Jarvis authority', direct_line_owner: true, openclaw_conversation_owner_allowed: false },
      { id: 'brain.bridge', label: 'Brain Bridge', role: 'memory and intelligence layer', direct_line_owner: true, openclaw_conversation_owner_allowed: false },
      { id: 'tool.registry', label: 'Tool Registry', role: 'certified adapter, MCP, and API tool catalog', direct_line_owner: false, openclaw_conversation_owner_allowed: false },
      { id: 'credential.broker', label: 'Credential Broker', role: 'name-only credential presence and adapter brokering', direct_line_owner: false, openclaw_conversation_owner_allowed: false },
      {
        id: 'openclaw.supporting_runtime',
        label: 'OpenClaw / OpenCloud',
        role: 'supporting runtime/tool layer only',
        direct_line_owner: false,
        openclaw_conversation_owner_allowed: false,
        disabled_reason: 'Supporting runtime only — not an agent line.',
      },
    ],
    edges: [
      { source: 'owner', target: 'mission.control', relation: 'enters' },
      { source: 'mission.control', target: 'nuclear.gateway', relation: 'brokers' },
      { source: 'nuclear.gateway', target: 'agent.zero', relation: 'routes_to' },
      { source: 'nuclear.gateway', target: 'ron.weasley', relation: 'routes_to' },
      { source: 'ron.weasley', target: 'agent.zero', relation: 'reports_to' },
      { source: 'nuclear.gateway', target: 'pi', relation: 'routes_to' },
      { source: 'nuclear.gateway', target: 'sofia', relation: 'routes_to' },
      { source: 'sofia', target: 'ron.weasley', relation: 'reports_to' },
      { source: 'pi', target: 'agent.zero', relation: 'reports_to' },
      { source: 'nuclear.gateway', target: 'paperclip', relation: 'routes_to' },
      { source: 'nuclear.gateway', target: 'spaceagent', relation: 'routes_to' },
      { source: 'spaceagent', target: 'agent.zero', relation: 'reports_to' },
      { source: 'nuclear.gateway', target: 'brain.bridge', relation: 'routes_to' },
      { source: 'nuclear.gateway', target: 'tool.registry', relation: 'brokers' },
      { source: 'nuclear.gateway', target: 'credential.broker', relation: 'brokers' },
      { source: 'openclaw.supporting_runtime', target: 'tool.registry', relation: 'supports' },
    ],
    direct_line_trace_buttons: directLines.trace_commands.map((trace) => ({ agent_id: trace.agent_id, label: trace.display_name, href: trace.trace_href })),
    openclaw_disabled_reason: 'Supporting runtime only — not an agent line.',
    openclaw_hidden_intermediary_allowed: false,
    openclaw_commander_allowed: false,
    credential_broker: 'nuclear.gateway',
    no_secrets_exposed: true,
  }
}

function buildAgentHubAutoUpdateControlPlane(): AgentHubAutoUpdateControlPlane {
  const safeAutoApply = AGENT_UPDATE_COMPONENTS.filter((component) =>
    component.auto_apply_supported &&
    Boolean(component.apply_target) &&
    !component.requires_sudo_or_polkit &&
    !component.requires_owner_restart &&
    component.safe_policy.includes('exact'),
  )
  const visibleTaskOnly = AGENT_UPDATE_COMPONENTS.filter((component) => !safeAutoApply.includes(component))

  return {
    route: '/api/bridge/agent-updates/status',
    run_route: '/api/bridge/agent-updates/run',
    visible_task_title: 'Agent Auto-Update Control Plane',
    scheduler_task_id: 'agent_update_check',
    scheduler_interval: 'every_6h',
    auto_apply_setting: 'agent_updates.auto_apply',
    auto_apply_scope: 'exact_scoped_loopback_only',
    safe_auto_apply_components: safeAutoApply.map((component) => ({
      id: component.id,
      label: component.label,
      apply_target: component.apply_target!,
      rollback: component.rollback,
    })),
    visible_task_only_components: visibleTaskOnly.map((component) => ({
      id: component.id,
      label: component.label,
      reason: component.requires_sudo_or_polkit
        ? 'owner_sudo_or_polkit_gate'
        : component.requires_owner_restart
          ? 'owner_restart_or_live_refresh_gate'
          : component.auto_apply_supported
            ? 'exact_scope_certification_pending'
            : 'standalone_updater_not_certified',
      rollback: component.rollback,
    })),
    forbidden_actions: [
      'sudo_or_polkit_without_owner',
      'credential_injection',
      'public_exposure_changes',
      'broad_connector_execution',
      'production_risk_without_rollback',
    ],
    opencloud_intermediary: false,
    public_exposure_created: false,
    secrets_exposed: false,
    raw_env_values_exposed: false,
  }
}

function buildAgentHubGatewayRouteCdpTruth(
  generatedAt: string,
  playwrightMcp?: PlaywrightMcpStatus | null,
): AgentHubGatewayRouteCdpTruth {
  const cdpReady = Boolean(playwrightMcp?.ok && playwrightMcp.status === 'connected' && playwrightMcp.required_tools_present)
  const cdpStatus = cdpReady ? 'READY' : 'CDP_NOT_RUNNING'
  const routes = GATEWAY_ROUTE_MAP.map((route) => ({
    ...route,
    state: route.surface === 'playwright_mcp' && route.route.includes('/smoke')
      ? cdpStatus
      : route.state,
  }))
  const routeMapStatus = 'READY'
  const gatewayStatus: AgentHubGatewayRouteState = cdpReady
    ? 'READY'
    : playwrightMcp
      ? 'CDP_NOT_RUNNING'
      : 'ROUTE_MAP_REQUIRED'

  return {
    mode: 'gateway_route_cdp_truth',
    generated_at: generatedAt,
    route_source: 'source_route_tree',
    route_map_status: routeMapStatus,
    cdp_status: cdpStatus,
    gateway_status: gatewayStatus,
    route_count: routes.length,
    routes,
    missing_legacy_routes: GATEWAY_MISSING_LEGACY_ROUTES,
    cdp_truth: {
      running: cdpReady,
      cdpReady,
      status: cdpStatus,
      service: 'playwright-mcp.service',
      mcp_endpoint: 'http://127.0.0.1:8931/mcp',
      local_only: true,
      public_exposure: false,
      bridge_session_required_for_interactive_actions: true,
      source: 'playwright_mcp_status',
      blocker: ownerSafeText(playwrightMcp?.blocker || playwrightMcp?.last_error || (cdpReady ? null : 'playwright_mcp_cdp_not_running')),
    },
    next_safe_action: cdpReady
      ? 'Keep Playwright MCP local-only and continue route proof through Mission Control authenticated surfaces.'
      : 'Start or repair the local-only Playwright MCP service before claiming browser/CDP READY; do not expose public ports.',
    opencloud_intermediary: false,
    public_exposure_created: false,
    secrets_exposed: false,
    raw_env_values_exposed: false,
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
  const traceId = agent.id === 'agent-zero'
    ? 'jarvis'
    : agent.id === 'pi-mono'
      ? 'pi'
      : agent.id
  return {
    ok: true,
    mode: 'gateway_agent_hub_agent_routes_read_only',
    generated_at: registry.generated_at,
    agent_id: agent.id,
    registry_node_id: agent.registry_node_id,
    trace_direct_line: {
      label: 'Trace Direct Line',
      command: `ssh tony@100.116.35.95 'bash /home/tony/agent-line-trace.sh --agent ${traceId}'`,
      local_probe_command: `bash /home/tony/agent-line-trace.sh --agent ${traceId} --local-probe`,
      live_trace_route: '/api/bridge/agent-routing/trace/live',
      probe_route: '/api/bridge/agent-routing/trace/probe',
      opencloud_intermediary_allowed: false,
    },
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
    const preferDefinitionBlocker = definition.id === 'hermes' || definition.id === 'pi-mono' || definition.id === 'spaceagent'
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
      configured: (definition.status === 'full_access_delegated') || (Boolean(node?.configured) && blockers.length === 0),
      read_enabled: Boolean(node?.read_enabled) || definition.status === 'partial_go' || definition.status === 'full_access_delegated',
      write_enabled: definition.status === 'full_access_delegated',
      execution_enabled: definition.status === 'full_access_delegated',
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
	      ...(definition.id === 'hermes' ? { proof_panel: RON_WEASLEY_PROOF_PANEL } : {}),
	    }
	  })
	}

function buildSupportingRuntimeSystems(registry: GatewayRegistry): AgentHubRuntimeSystem[] {
  const nodes = buildGatewayNodesPayload(registry).nodes
  return SUPPORTING_RUNTIME_NODE_IDS.map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is GatewayApiNode => Boolean(node))
    .map((node) => ({
      id: node.id,
      name: node.id === 'openclaw_plus' ? 'OpenClaw / OpenCloud Supporting Runtime Only' : node.name,
      type: node.type,
      status: node.status,
      connected: node.connected,
      configured: node.configured,
      read_enabled: node.read_enabled,
      write_enabled: false,
      execution_enabled: false,
      requires_bridge_session: node.requires_bridge_session,
      blocked_reason: node.id === 'openclaw_plus'
        ? 'Supporting runtime only — not an agent line.'
        : ownerSafeText(node.blocked_reason),
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

export function attachGatewayRouteCdpTruthStatus(
  payload: AgentHubStatusPayload,
  playwrightMcp: PlaywrightMcpStatus,
): AgentHubStatusPayload {
  return {
    ...payload,
    gateway_route_cdp_truth: buildAgentHubGatewayRouteCdpTruth(payload.generated_at, playwrightMcp),
  }
}
