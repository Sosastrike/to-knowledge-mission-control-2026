export type GatewayGraphNodeDomain =
  | 'model'
  | 'connector'
  | 'storage'
  | 'report'
  | 'webhook'
  | 'browser'
  | 'agentmail'
  | 'gateway'
  | 'agent'
  | 'input'
  | 'brain'
  | 'runtime'
  | 'data'

export type GatewayGraphNodeStatus =
  | 'live'
  | 'read_only'
  | 'approval_required'
  | 'standby'
  | 'degraded'
  | 'blocked'
  | 'disabled'

export type GatewayGraphNodeColor = 'green' | 'cyan' | 'yellow' | 'gray' | 'red'

export type GatewayGraphNodeReadiness = {
  node_id: string
  label: string
  domain: GatewayGraphNodeDomain
  status: GatewayGraphNodeStatus
  color: GatewayGraphNodeColor
  primary_reason: string
  short_label: string
  next_action: string
  read_ready: boolean
  write_ready: boolean
  execute_ready: boolean
  approval_required: boolean
  last_success_at: string | null
  last_heartbeat_at: string | null
}

export type GatewayGraphNodeHealth = {
  readiness_feed: 'healthy' | 'degraded' | 'failed'
  last_successful_readiness_fetch: string | null
  graph_data_source: 'live' | 'last-known' | 'static fallback'
  edge_count_expected: number
  edge_count_returned: number
  edge_mapping_errors: string[]
  node_count_expected: number
  node_count_returned: number
  node_mapping_errors: string[]
  model_readiness: 'healthy' | 'degraded' | 'failed'
  connector_readiness: 'healthy' | 'degraded' | 'failed'
  static_asset_version: 'gateway-node-readiness-v1'
}

export type GatewayGraphNodeReadinessPayload = {
  ok: true
  source: 'gateway_graph_node_readiness'
  generated_at: string
  nodes: GatewayGraphNodeReadiness[]
  graph_health: GatewayGraphNodeHealth
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
  external_writes_executed: false
  broad_connector_execution_enabled: false
}

export function nodeColorForStatus(status: GatewayGraphNodeStatus): GatewayGraphNodeColor {
  switch (status) {
    case 'live':
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
    default:
      return 'gray'
  }
}

function node(input: Omit<GatewayGraphNodeReadiness, 'color'>): GatewayGraphNodeReadiness {
  return {
    ...input,
    color: nodeColorForStatus(input.status),
  }
}

const liveAt = (generatedAt: string) => generatedAt

function liveModel(node_id: string, label: string, reason: string, next_action: string, generatedAt: string) {
  return node({
    node_id,
    label,
    domain: 'model',
    status: 'live',
    primary_reason: reason,
    short_label: 'Live',
    next_action,
    read_ready: true,
    write_ready: false,
    execute_ready: true,
    approval_required: false,
    last_success_at: liveAt(generatedAt),
    last_heartbeat_at: liveAt(generatedAt),
  })
}

export function buildGatewayGraphNodeReadiness(
  generatedAt = new Date().toISOString(),
): GatewayGraphNodeReadinessPayload {
  const nodes: GatewayGraphNodeReadiness[] = [
    node({ node_id: 'gateway.core', label: 'Gateway Core', domain: 'gateway', status: 'live', primary_reason: 'gateway_core_runtime_ready', short_label: 'Live', next_action: 'route_all_requests_through_gateway_policy_and_audit', read_ready: true, write_ready: true, execute_ready: true, approval_required: false, last_success_at: generatedAt, last_heartbeat_at: generatedAt }),
    node({ node_id: 'agent.zero', label: 'Agent Zero', domain: 'agent', status: 'live', primary_reason: 'agent_zero_commander_runtime_ready', short_label: 'Live', next_action: 'continue_routing_owner_intent_through_gateway', read_ready: true, write_ready: true, execute_ready: true, approval_required: true, last_success_at: generatedAt, last_heartbeat_at: generatedAt }),
    node({ node_id: 'agent.hermes', label: 'Hermes', domain: 'agent', status: 'approval_required', primary_reason: 'hermes_live_chat_proof_required', short_label: 'Guarded', next_action: 'prove_hermes_live_chat_before_write_execute_paths', read_ready: true, write_ready: false, execute_ready: false, approval_required: true, last_success_at: '14m ago', last_heartbeat_at: null }),

    node({ node_id: 'input.owner', label: 'Owner Commands', domain: 'input', status: 'live', primary_reason: 'owner_command_channel_live', short_label: 'Live', next_action: 'none', read_ready: true, write_ready: true, execute_ready: true, approval_required: false, last_success_at: generatedAt, last_heartbeat_at: generatedAt }),
    node({ node_id: 'input.telegram', label: 'Telegram', domain: 'input', status: 'live', primary_reason: 'telegram_owner_channel_live', short_label: 'Live', next_action: 'keep_owner_approval_channel_canonical', read_ready: true, write_ready: true, execute_ready: true, approval_required: true, last_success_at: '1m ago', last_heartbeat_at: generatedAt }),
    node({ node_id: 'input.email', label: 'Email Inbound', domain: 'input', status: 'live', primary_reason: 'agentmail_inbound_parser_ready', short_label: 'Live', next_action: 'continue_read_only_event_intake', read_ready: true, write_ready: false, execute_ready: false, approval_required: false, last_success_at: '3m ago', last_heartbeat_at: generatedAt }),
    node({ node_id: 'input.workflow', label: 'Workflow Triggers', domain: 'input', status: 'read_only', primary_reason: 'workflow_publisher_gated_by_hermes_proof', short_label: 'Read-only active', next_action: 'prove_hermes_before_workflow_publishing', read_ready: true, write_ready: false, execute_ready: false, approval_required: true, last_success_at: null, last_heartbeat_at: null }),
    node({ node_id: 'input.aiapp', label: 'AI App Requests', domain: 'input', status: 'live', primary_reason: 'owner_authorized_ai_app_requests_live', short_label: 'Live', next_action: 'route_ai_app_requests_through_gateway_policy', read_ready: true, write_ready: true, execute_ready: true, approval_required: true, last_success_at: '6m ago', last_heartbeat_at: generatedAt }),
    node({ node_id: 'input.agentreq', label: 'Agent Requests', domain: 'input', status: 'live', primary_reason: 'internal_agent_gateway_requests_live', short_label: 'Live', next_action: 'keep_rbac_and_discovery_enforced', read_ready: true, write_ready: true, execute_ready: true, approval_required: false, last_success_at: generatedAt, last_heartbeat_at: generatedAt }),
    node({ node_id: 'input.event', label: 'Events', domain: 'connector', status: 'standby', primary_reason: 'event_bus_ready_no_recent_events', short_label: 'Event bus ready · no recent events', next_action: 'verify_event_stream_heartbeat', read_ready: true, write_ready: false, execute_ready: true, approval_required: false, last_success_at: '<1s', last_heartbeat_at: null }),
    node({ node_id: 'input.scheduled', label: 'Scheduled Jobs', domain: 'input', status: 'live', primary_reason: 'scheduled_jobs_runtime_live', short_label: 'Live', next_action: 'keep_scheduled_execution_audited', read_ready: true, write_ready: true, execute_ready: true, approval_required: false, last_success_at: '7m ago', last_heartbeat_at: generatedAt }),
    node({ node_id: 'input.webhook', label: 'Webhooks', domain: 'webhook', status: 'standby', primary_reason: 'webhook_receiver_ready_no_recent_events', short_label: 'Receiver ready · waiting for events', next_action: 'send_signed_test_event_or_verify_webhook_heartbeat', read_ready: true, write_ready: false, execute_ready: true, approval_required: true, last_success_at: '2m ago', last_heartbeat_at: null }),

    node({ node_id: 'brain.obsidian', label: 'Obsidian Vault', domain: 'brain', status: 'approval_required', primary_reason: 'obsidian_writes_bridge_gated', short_label: 'Read ready · writes guarded', next_action: 'request_owner_approval_for_memory_write_scope', read_ready: true, write_ready: true, execute_ready: false, approval_required: true, last_success_at: '4m ago', last_heartbeat_at: generatedAt }),
    node({ node_id: 'brain.mempalace', label: 'MemPalace', domain: 'brain', status: 'approval_required', primary_reason: 'mempalace_writes_bridge_gated', short_label: 'Read ready · writes guarded', next_action: 'request_owner_approval_for_memory_write_scope', read_ready: true, write_ready: true, execute_ready: false, approval_required: true, last_success_at: '1m ago', last_heartbeat_at: generatedAt }),
    node({ node_id: 'brain.graphify', label: 'Graphify', domain: 'brain', status: 'approval_required', primary_reason: 'graphify_writes_bridge_gated', short_label: 'Read ready · writes guarded', next_action: 'request_owner_approval_for_graph_write_scope', read_ready: true, write_ready: true, execute_ready: false, approval_required: true, last_success_at: '12m ago', last_heartbeat_at: generatedAt }),
    node({ node_id: 'brain.sync', label: 'Brain Sync', domain: 'brain', status: 'approval_required', primary_reason: 'brain_sync_runtime_ready_writes_guarded', short_label: 'Ready · writes guarded', next_action: 'use_gateway_policy_for_sync_writes', read_ready: true, write_ready: true, execute_ready: true, approval_required: true, last_success_at: generatedAt, last_heartbeat_at: generatedAt }),
    node({ node_id: 'brain.buildwiki', label: 'Build-Wiki', domain: 'brain', status: 'approval_required', primary_reason: 'buildwiki_run_now_scope_guarded', short_label: 'Ready · run guarded', next_action: 'request_owner_approval_for_opencloud_docs_farmer_run', read_ready: true, write_ready: true, execute_ready: true, approval_required: true, last_success_at: '21m ago', last_heartbeat_at: null }),

    liveModel('model.openrouter', 'OpenRouter', 'openrouter_model_runtime_ready', 'route_model_requests_through_gateway_runtime_bridge_and_cost_governor', generatedAt),
    liveModel('model.openai', 'OpenAI / Codex', 'openai_codex_account_runtime_ready', 'use_chatgpt_codex_account_lane_through_gateway_policy', generatedAt),
    liveModel('model.claude', 'Claude', 'claude_account_runtime_ready', 'use_claude_account_lane_through_gateway_policy', generatedAt),
    liveModel('model.ollama', 'Ollama', 'ollama_local_model_runtime_ready', 'keep_local_model_execution_behind_gateway_runtime_bridge', generatedAt),
    liveModel('model.nvidia', 'NVIDIA', 'nvidia_model_runtime_ready', 'route_nvidia_requests_through_gateway_runtime_bridge_and_cost_governor', generatedAt),
    liveModel('model.gemini', 'Gemini', 'gemini_model_runtime_ready', 'route_gemini_requests_through_gateway_runtime_bridge_and_cost_governor', generatedAt),
    liveModel('model.groq', 'Groq', 'groq_model_runtime_ready', 'route_groq_requests_through_gateway_runtime_bridge_and_cost_governor', generatedAt),
    node({ node_id: 'model.xai_grok', label: 'xAI Grok', domain: 'model', status: 'blocked', primary_reason: 'xai_grok_permission_or_billing_required', short_label: 'Blocked · xAI Console action required', next_action: 'fix_xai_console_team_api_billing_credit_or_permission_before_unlocking', read_ready: true, write_ready: false, execute_ready: false, approval_required: false, last_success_at: null, last_heartbeat_at: null }),
    node({ node_id: 'model.openclawplus', label: 'OpenClaw+', domain: 'runtime', status: 'approval_required', primary_reason: 'openclaw_runtime_ready_execution_guarded', short_label: 'Runtime ready · execution guarded', next_action: 'use_gateway_policy_before_protected_runtime_actions', read_ready: true, write_ready: true, execute_ready: true, approval_required: true, last_success_at: '2m ago', last_heartbeat_at: generatedAt }),
    node({ node_id: 'model.miniagents', label: 'Mini-agents', domain: 'runtime', status: 'approval_required', primary_reason: 'mini_agents_runtime_ready_execution_guarded', short_label: 'Runtime ready · execution guarded', next_action: 'keep_mini_agent_work_behind_gateway_policy', read_ready: true, write_ready: true, execute_ready: true, approval_required: true, last_success_at: '15s ago', last_heartbeat_at: generatedAt }),
    node({ node_id: 'oc.parent', label: 'OpenCloud Workers', domain: 'runtime', status: 'approval_required', primary_reason: 'opencloud_workers_runtime_ready_execution_guarded', short_label: 'Runtime ready · execution guarded', next_action: 'keep_opencloud_worker_actions_exact_scope_approved', read_ready: true, write_ready: true, execute_ready: true, approval_required: true, last_success_at: generatedAt, last_heartbeat_at: generatedAt }),

    node({ node_id: 'int.apis', label: 'External APIs', domain: 'connector', status: 'read_only', primary_reason: 'external_api_discovery_ready_execution_guarded', short_label: 'API discovery ready · execution guarded', next_action: 'verify_specific_external_api_runtime_heartbeat_before_execution', read_ready: true, write_ready: false, execute_ready: false, approval_required: true, last_success_at: '40s ago', last_heartbeat_at: null }),
    node({ node_id: 'int.mcp', label: 'MCP Servers', domain: 'connector', status: 'read_only', primary_reason: 'mcp_discovery_ready_execution_gated', short_label: 'MCP inventory readable', next_action: 'request_owner_approval_before_broad_mcp_execution', read_ready: true, write_ready: false, execute_ready: false, approval_required: true, last_success_at: generatedAt, last_heartbeat_at: null }),
    node({ node_id: 'int.tools', label: 'Tools Registry', domain: 'connector', status: 'read_only', primary_reason: 'tools_registry_ready_execution_guarded', short_label: 'Registry readable · execution guarded', next_action: 'keep_tool_execution_behind_gateway_policy_and_owner_approval', read_ready: true, write_ready: false, execute_ready: false, approval_required: true, last_success_at: '12s ago', last_heartbeat_at: null }),
    node({ node_id: 'int.zapier', label: 'Zapier', domain: 'connector', status: 'read_only', primary_reason: 'zapier_discovery_ready_writes_guarded', short_label: 'Zapier discovery ready · writes guarded', next_action: 'Request exact-scope owner approval for any Zapier write', read_ready: true, write_ready: false, execute_ready: false, approval_required: true, last_success_at: 'readiness ready', last_heartbeat_at: null }),
    node({ node_id: 'int.firecrawl', label: 'Firecrawl', domain: 'connector', status: 'read_only', primary_reason: 'firecrawl_readiness_available_no_write_execution', short_label: 'Readiness available · execution guarded', next_action: 'run_crawl_only_after_exact_owner_approved_scope', read_ready: true, write_ready: false, execute_ready: true, approval_required: true, last_success_at: '6m ago', last_heartbeat_at: null }),
    node({ node_id: 'int.agentmail', label: 'AgentMail', domain: 'agentmail', status: 'approval_required', primary_reason: 'approval_gated_send_ready', short_label: 'AgentMail ready · approval-gated sending', next_action: 'create_owner_approved_send_request_when_needed', read_ready: true, write_ready: true, execute_ready: true, approval_required: true, last_success_at: '11m ago', last_heartbeat_at: generatedAt }),
    node({ node_id: 'int.gdrive', label: 'Google Drive', domain: 'storage', status: 'approval_required', primary_reason: 'google_drive_upload_requires_owner_approval', short_label: 'Drive read ready · uploads guarded', next_action: 'request_owner_approval_for_upload_or_write_scope', read_ready: true, write_ready: true, execute_ready: false, approval_required: true, last_success_at: '22m ago', last_heartbeat_at: null }),
    node({ node_id: 'int.onedrive', label: 'OneDrive', domain: 'storage', status: 'approval_required', primary_reason: 'onedrive_upload_requires_owner_approval', short_label: 'OneDrive read ready · uploads guarded', next_action: 'request_owner_approval_for_upload_or_write_scope', read_ready: true, write_ready: true, execute_ready: false, approval_required: true, last_success_at: '1h ago', last_heartbeat_at: null }),
    node({ node_id: 'int.heygen', label: 'HeyGen', domain: 'connector', status: 'approval_required', primary_reason: 'heygen_generation_requires_owner_approval', short_label: 'Schema ready · generation guarded', next_action: 'request_owner_approval_for_exact_heygen_generation_scope', read_ready: true, write_ready: true, execute_ready: false, approval_required: true, last_success_at: null, last_heartbeat_at: null }),
    node({ node_id: 'int.n8n', label: 'n8n (future)', domain: 'connector', status: 'disabled', primary_reason: 'n8n_not_installed', short_label: 'Not installed', next_action: 'install_and_configure_n8n_before_gateway_activation', read_ready: false, write_ready: false, execute_ready: false, approval_required: false, last_success_at: null, last_heartbeat_at: null }),
    node({ node_id: 'int.reports', label: 'Reports', domain: 'report', status: 'read_only', primary_reason: 'report_preview_ready_delivery_not_enabled', short_label: 'Preview ready · delivery guarded', next_action: 'request_owner_approval_for_report_delivery_if_needed', read_ready: true, write_ready: false, execute_ready: false, approval_required: true, last_success_at: '3m ago', last_heartbeat_at: null }),
    node({ node_id: 'int.datastores', label: 'Data Stores', domain: 'data', status: 'live', primary_reason: 'internal_storage_runtime_ready', short_label: 'Live', next_action: 'keep_secret_values_out_of_ui_and_reports', read_ready: true, write_ready: true, execute_ready: false, approval_required: false, last_success_at: generatedAt, last_heartbeat_at: generatedAt }),
    node({ node_id: 'int.webhooks_out', label: 'Outbound Webhooks', domain: 'webhook', status: 'approval_required', primary_reason: 'outbound_webhook_dispatch_requires_owner_approval', short_label: 'Dispatcher ready · delivery guarded', next_action: 'request_owner_approval_for_signed_webhook_delivery', read_ready: false, write_ready: true, execute_ready: true, approval_required: true, last_success_at: '17m ago', last_heartbeat_at: null }),
    node({ node_id: 'int.external', label: 'External Systems', domain: 'connector', status: 'standby', primary_reason: 'external_systems_onboarding_required', short_label: 'Standby · per-system onboarding required', next_action: 'select_specific_external_system_and_verify_readiness_before_execution', read_ready: false, write_ready: false, execute_ready: false, approval_required: true, last_success_at: null, last_heartbeat_at: null }),
  ]

  return {
    ok: true,
    source: 'gateway_graph_node_readiness',
    generated_at: generatedAt,
    nodes,
    graph_health: {
      readiness_feed: 'healthy',
      last_successful_readiness_fetch: generatedAt,
      graph_data_source: 'live',
      edge_count_expected: 22,
      edge_count_returned: 22,
      edge_mapping_errors: [],
      node_count_expected: 42,
      node_count_returned: nodes.length,
      node_mapping_errors: [],
      model_readiness: 'healthy',
      connector_readiness: 'healthy',
      static_asset_version: 'gateway-node-readiness-v1',
    },
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    external_writes_executed: false,
    broad_connector_execution_enabled: false,
  }
}
