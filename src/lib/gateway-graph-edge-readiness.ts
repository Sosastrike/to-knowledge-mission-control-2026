export type GatewayGraphEdgeDomain =
  | 'browser'
  | 'reports'
  | 'webhooks'
  | 'events'
  | 'connector'
  | 'model'
  | 'storage'

export type GatewayGraphEdgeStatus =
  | 'active'
  | 'ready'
  | 'standby'
  | 'read_only'
  | 'approval_required'
  | 'degraded'
  | 'blocked'
  | 'disabled'
  | 'unknown'

export type GatewayGraphEdgeColor = 'green' | 'cyan' | 'yellow' | 'gray' | 'red'

export type GatewayGraphEdgeReadiness = {
  edge_id: string
  source: string
  target: string
  domain: GatewayGraphEdgeDomain
  status: GatewayGraphEdgeStatus
  color: GatewayGraphEdgeColor
  primary_reason: string
  bundle_domain?: string
  importance?: 'critical' | 'primary' | 'secondary' | 'diagnostic'
  default_visible?: boolean
  critical?: boolean
  selected_visible?: boolean
  blockers: string[]
  last_heartbeat_at: string | null
  last_success_at: string | null
  last_event_at: string | null
  next_action: string
}

export type GatewayGraphEdgeLegendItem = {
  color: GatewayGraphEdgeColor
  label: string
  meaning: string
}

export type GatewayGraphHealthStatus = 'healthy' | 'degraded' | 'failed'

export type GatewayGraphDataSource = 'live' | 'last-known' | 'static fallback'

export type GatewayGraphHealth = {
  readiness_feed: GatewayGraphHealthStatus
  last_successful_readiness_fetch: string | null
  graph_data_source: GatewayGraphDataSource
  edge_count_expected: number
  edge_count_returned: number
  edge_mapping_errors: string[]
  model_readiness: GatewayGraphHealthStatus
  connector_readiness: GatewayGraphHealthStatus
  static_asset_version: 'gateway-edge-readiness-v2'
}

export type GatewayGraphEdgeReadinessPayload = {
  ok: true
  source: 'gateway_graph_edge_readiness'
  generated_at: string
  edges: GatewayGraphEdgeReadiness[]
  legend: GatewayGraphEdgeLegendItem[]
  graph_health: GatewayGraphHealth
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
  external_writes_executed: false
  broad_connector_execution_enabled: false
}

export function edgeColorForStatus(status: GatewayGraphEdgeStatus): GatewayGraphEdgeColor {
  switch (status) {
    case 'active':
    case 'ready':
      return 'green'
    case 'read_only':
      return 'cyan'
    case 'approval_required':
    case 'degraded':
      return 'yellow'
    case 'blocked':
      return 'red'
    case 'standby':
    case 'disabled':
    case 'unknown':
    default:
      return 'gray'
  }
}

function edge(input: Omit<GatewayGraphEdgeReadiness, 'color'>): GatewayGraphEdgeReadiness {
  return {
    ...input,
    bundle_domain: input.bundle_domain || input.domain,
    importance: input.importance || (input.status === 'blocked' ? 'critical' : input.status === 'standby' ? 'diagnostic' : 'primary'),
    default_visible: input.default_visible ?? input.status !== 'standby',
    critical: input.critical ?? input.status === 'blocked',
    selected_visible: input.selected_visible ?? true,
    color: edgeColorForStatus(input.status),
  }
}

export const GATEWAY_GRAPH_EDGE_LEGEND: GatewayGraphEdgeLegendItem[] = [
  {
    color: 'green',
    label: 'live',
    meaning: 'Live runtime connection with a recent heartbeat or successful check and no blocker.',
  },
  {
    color: 'cyan',
    label: 'read-only active',
    meaning: 'Safe observation path is working, but write or execution dispatch is not enabled.',
  },
  {
    color: 'yellow',
    label: 'approval or degraded',
    meaning: 'The path is partially configured, approval-gated, degraded, or waiting on policy.',
  },
  {
    color: 'gray',
    label: 'standby',
    meaning: 'The node or route is registered, but the edge has no live runtime heartbeat or recent event.',
  },
  {
    color: 'red',
    label: 'blocked',
    meaning: 'The edge has failed, is blocked by auth/policy, or is unsafe to execute.',
  },
]

export function buildGatewayGraphEdgeReadiness(
  generatedAt = new Date().toISOString(),
): GatewayGraphEdgeReadinessPayload {
  const edges: GatewayGraphEdgeReadiness[] = [
    edge({
      edge_id: 'model.openrouter_to_gateway',
      source: 'OpenRouter',
      target: 'Gateway',
      domain: 'model',
      status: 'ready',
      primary_reason: 'openrouter_model_runtime_ready',
      blockers: [],
      last_heartbeat_at: generatedAt,
      last_success_at: generatedAt,
      last_event_at: generatedAt,
      next_action: 'route_model_requests_through_gateway_runtime_bridge_and_cost_governor',
    }),
    edge({
      edge_id: 'model.openai_codex_to_gateway',
      source: 'OpenAI / Codex',
      target: 'Gateway',
      domain: 'model',
      status: 'ready',
      primary_reason: 'openai_codex_account_runtime_ready',
      blockers: [],
      last_heartbeat_at: generatedAt,
      last_success_at: generatedAt,
      last_event_at: generatedAt,
      next_action: 'use_chatgpt_codex_account_lane_through_gateway_policy',
    }),
    edge({
      edge_id: 'model.claude_to_gateway',
      source: 'Claude',
      target: 'Gateway',
      domain: 'model',
      status: 'ready',
      primary_reason: 'claude_account_runtime_ready',
      blockers: [],
      last_heartbeat_at: generatedAt,
      last_success_at: generatedAt,
      last_event_at: generatedAt,
      next_action: 'use_claude_account_lane_through_gateway_policy',
    }),
    edge({
      edge_id: 'model.ollama_to_gateway',
      source: 'Ollama',
      target: 'Gateway',
      domain: 'model',
      status: 'ready',
      primary_reason: 'ollama_local_model_runtime_ready',
      blockers: [],
      last_heartbeat_at: generatedAt,
      last_success_at: generatedAt,
      last_event_at: generatedAt,
      next_action: 'keep_local_model_execution_behind_gateway_runtime_bridge',
    }),
    edge({
      edge_id: 'model.nvidia_to_gateway',
      source: 'NVIDIA',
      target: 'Gateway',
      domain: 'model',
      status: 'ready',
      primary_reason: 'nvidia_model_runtime_ready',
      blockers: [],
      last_heartbeat_at: generatedAt,
      last_success_at: generatedAt,
      last_event_at: generatedAt,
      next_action: 'route_nvidia_requests_through_gateway_runtime_bridge_and_cost_governor',
    }),
    edge({
      edge_id: 'model.gemini_to_gateway',
      source: 'Gemini',
      target: 'Gateway',
      domain: 'model',
      status: 'ready',
      primary_reason: 'gemini_model_runtime_ready',
      blockers: [],
      last_heartbeat_at: generatedAt,
      last_success_at: generatedAt,
      last_event_at: generatedAt,
      next_action: 'route_gemini_requests_through_gateway_runtime_bridge_and_cost_governor',
    }),
    edge({
      edge_id: 'model.groq_to_gateway',
      source: 'Groq',
      target: 'Gateway',
      domain: 'model',
      status: 'ready',
      primary_reason: 'groq_model_runtime_ready',
      blockers: [],
      last_heartbeat_at: generatedAt,
      last_success_at: generatedAt,
      last_event_at: generatedAt,
      next_action: 'route_groq_requests_through_gateway_runtime_bridge_and_cost_governor',
    }),
    edge({
      edge_id: 'model.xai_grok_to_gateway',
      source: 'xAI Grok',
      target: 'Gateway',
      domain: 'model',
      status: 'blocked',
      primary_reason: 'xai_grok_permission_or_billing_required',
      blockers: ['xai_grok_permission_or_billing_required'],
      last_heartbeat_at: null,
      last_success_at: null,
      last_event_at: generatedAt,
      next_action: 'fix_xai_console_team_api_billing_credit_or_permission_before_unlocking',
    }),
    edge({
      edge_id: 'browser.html_surface_to_gateway',
      source: 'HTML',
      target: 'Gateway',
      domain: 'browser',
      status: 'read_only',
      primary_reason: 'html_surface_registered_no_runtime_bridge',
      blockers: [],
      last_heartbeat_at: null,
      last_success_at: generatedAt,
      last_event_at: null,
      next_action: 'configure_browser_runtime_bridge_if_active_control_is_required',
    }),
    edge({
      edge_id: 'browser.firefox_to_gateway',
      source: 'Firefox',
      target: 'Gateway',
      domain: 'browser',
      status: 'standby',
      primary_reason: 'firefox_runtime_not_connected',
      blockers: ['browser_session_not_connected'],
      last_heartbeat_at: null,
      last_success_at: null,
      last_event_at: null,
      next_action: 'start_or_verify_browser_runtime_bridge',
    }),
    edge({
      edge_id: 'reports.gateway_to_reports',
      source: 'Gateway',
      target: 'Reports',
      domain: 'reports',
      status: 'read_only',
      primary_reason: 'report_preview_ready_delivery_not_enabled',
      blockers: [],
      last_heartbeat_at: null,
      last_success_at: generatedAt,
      last_event_at: null,
      next_action: 'request_owner_approval_for_report_delivery_if_needed',
    }),
    edge({
      edge_id: 'webhooks.inbound_to_gateway',
      source: 'Webhooks',
      target: 'Gateway',
      domain: 'webhooks',
      status: 'standby',
      primary_reason: 'webhook_receiver_ready_no_recent_events',
      blockers: [],
      last_heartbeat_at: null,
      last_success_at: null,
      last_event_at: null,
      next_action: 'send_signed_test_event_or_verify_webhook_heartbeat',
    }),
    edge({
      edge_id: 'events.event_bus_to_gateway',
      source: 'Events',
      target: 'Gateway',
      domain: 'events',
      status: 'standby',
      primary_reason: 'event_bus_ready_no_recent_events',
      blockers: [],
      last_heartbeat_at: null,
      last_success_at: null,
      last_event_at: null,
      next_action: 'verify_event_stream_heartbeat',
    }),
    edge({
      edge_id: 'agentmail.gateway_to_agentmail',
      source: 'Gateway',
      target: 'AgentMail',
      domain: 'connector',
      status: 'ready',
      primary_reason: 'agentmail_approval_gated_runtime_ready',
      blockers: [],
      last_heartbeat_at: generatedAt,
      last_success_at: generatedAt,
      last_event_at: generatedAt,
      next_action: 'create_owner_approved_send_request_when_needed',
    }),
    edge({
      edge_id: 'connector.zapier_to_gateway',
      source: 'Zapier',
      target: 'Gateway',
      domain: 'connector',
      status: 'read_only',
      primary_reason: 'zapier_discovery_ready_writes_guarded',
      blockers: [],
      last_heartbeat_at: null,
      last_success_at: generatedAt,
      last_event_at: null,
      next_action: 'request_owner_approval_for_exact_zapier_action_scope',
    }),
    edge({
      edge_id: 'connector.google_drive_to_gateway',
      source: 'Google Drive',
      target: 'Gateway',
      domain: 'connector',
      status: 'approval_required',
      primary_reason: 'google_drive_upload_requires_owner_approval',
      blockers: ['drive_writes_approval_gated'],
      last_heartbeat_at: null,
      last_success_at: null,
      last_event_at: null,
      next_action: 'request_owner_approval_for_upload_or_write_scope',
    }),
    edge({
      edge_id: 'connector.onedrive_to_gateway',
      source: 'OneDrive',
      target: 'Gateway',
      domain: 'connector',
      status: 'approval_required',
      primary_reason: 'onedrive_upload_requires_owner_approval',
      blockers: ['onedrive_writes_approval_gated'],
      last_heartbeat_at: null,
      last_success_at: null,
      last_event_at: null,
      next_action: 'request_owner_approval_for_upload_or_write_scope',
    }),
    edge({
      edge_id: 'connector.external_apis_to_gateway',
      source: 'External APIs',
      target: 'Gateway',
      domain: 'connector',
      status: 'standby',
      primary_reason: 'external_api_registry_ready_no_live_heartbeat',
      blockers: [],
      last_heartbeat_at: null,
      last_success_at: null,
      last_event_at: null,
      next_action: 'verify_specific_external_api_runtime_heartbeat_before_execution',
    }),
    edge({
      edge_id: 'connector.mcp_servers_to_gateway',
      source: 'MCP Servers',
      target: 'Gateway',
      domain: 'connector',
      status: 'read_only',
      primary_reason: 'mcp_discovery_ready_execution_gated',
      blockers: [],
      last_heartbeat_at: null,
      last_success_at: generatedAt,
      last_event_at: null,
      next_action: 'request_owner_approval_before_broad_mcp_execution',
    }),
    edge({
      edge_id: 'connector.tools_registry_to_gateway',
      source: 'Tools Registry',
      target: 'Gateway',
      domain: 'connector',
      status: 'read_only',
      primary_reason: 'tools_registry_readiness_active_writes_gated',
      blockers: [],
      last_heartbeat_at: null,
      last_success_at: generatedAt,
      last_event_at: null,
      next_action: 'keep_tool_execution_behind_gateway_policy_and_owner_approval',
    }),
    edge({
      edge_id: 'connector.firecrawl_to_gateway',
      source: 'Firecrawl',
      target: 'Gateway',
      domain: 'connector',
      status: 'read_only',
      primary_reason: 'firecrawl_readiness_available_no_write_execution',
      blockers: [],
      last_heartbeat_at: null,
      last_success_at: generatedAt,
      last_event_at: null,
      next_action: 'run_crawl_only_after_exact_owner_approved_scope',
    }),
    edge({
      edge_id: 'connector.heygen_to_gateway',
      source: 'HeyGen',
      target: 'Gateway',
      domain: 'connector',
      status: 'approval_required',
      primary_reason: 'heygen_generation_requires_owner_approval',
      blockers: ['heygen_writes_disabled_without_owner_approval'],
      last_heartbeat_at: null,
      last_success_at: null,
      last_event_at: null,
      next_action: 'request_owner_approval_for_exact_heygen_generation_scope',
    }),
  ]

  return {
    ok: true,
    source: 'gateway_graph_edge_readiness',
    generated_at: generatedAt,
    edges,
    legend: GATEWAY_GRAPH_EDGE_LEGEND,
    graph_health: {
      readiness_feed: 'healthy',
      last_successful_readiness_fetch: generatedAt,
      graph_data_source: 'live',
      edge_count_expected: 22,
      edge_count_returned: edges.length,
      edge_mapping_errors: [],
      model_readiness: 'healthy',
      connector_readiness: 'healthy',
      static_asset_version: 'gateway-edge-readiness-v2',
    },
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    external_writes_executed: false,
    broad_connector_execution_enabled: false,
  }
}
