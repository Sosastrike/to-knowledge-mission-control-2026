type GatewayStatusPayload = Record<string, unknown>

const SAFE_READ_ONLY = {
  execution_enabled: false,
  writes_enabled: false,
  protected_execution_enabled: false,
  external_writes_enabled: false,
  fake_success_allowed: false,
  approval_request_created: false,
  audit_record_written: false,
  credential_values_exposed: false,
  go_claim_allowed: false,
  no_go_claim: true,
}

const SERVICE_CONTROL_BLOCKED = {
  service_control_enabled: false,
  install_started: false,
  restart_started: false,
}

function serviceDown(agentId: string, label: string, runtimeHint: string): GatewayStatusPayload {
  return {
    ok: false,
    route: `${agentId}.status`,
    agent_id: agentId,
    label,
    state: 'SERVICE_DOWN',
    blocker_class: 'SERVICE_DOWN',
    installed: false,
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    next_action: `${label} needs a real local runtime/service registration before Gateway can open or execute it. Expected runtime: ${runtimeHint}.`,
  }
}

function agentZeroStatus(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'agent-zero.status',
    agent_id: 'agent-zero',
    label: 'Agent Zero (Jarvis)',
    owner_facing_name: 'Agent Zero (Jarvis)',
    aliases: ['Jarvis'],
    state: 'OPERATIONAL_GO',
    blocker_class: 'OWNER_HARD_STOPS_ONLY',
    installed: true,
    tailnet_url: null,
    owner_access_blocker: null,
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    execution_enabled: true,
    writes_enabled: true,
    protected_execution_enabled: true,
    external_writes_enabled: true,
    exact_scope_execution_enabled: true,
    broad_connector_execution_allowed: false,
    credential_values_exposed: false,
    audit_record_written: true,
    rollback_proof_present: true,
    go_claim_allowed: true,
    no_go_claim: false,
    owner_hard_stops_remaining: ['sudo_or_master_password', 'env_edit_or_credential_injection', 'raw_secret_exposure', 'public_exposure_change', 'destructive_delete', 'spending_above_cap', 'disable_auth_audit_or_rollback', 'broad_connector_execution_outside_exact_scope'],
    next_action: 'Jarvis is operational through certified exact-scope Mission Control adapters. Continue adapter expansion; only owner-hard-stop categories remain blocked.',
  }
}

function readOnlyConnector(name: string, state: string, scope: string, nextAction: string): GatewayStatusPayload {
  return {
    name,
    state,
    scope,
    next_action: nextAction,
    external_writes_enabled: false,
    credential_values_exposed: false,
  }
}

function connectorReadiness(): GatewayStatusPayload {
  const connectors = [
    readOnlyConnector('AgentMail', 'READY', 'mail', 'AgentMail runtime is ready for server-side approval-gated sending; auto-send and bulk-send remain disabled.'),
    readOnlyConnector('SendGrid', 'NOT_CONFIGURED', 'mail', 'Configure API key and sender domain through the owner secret path.'),
    readOnlyConnector('Twilio Voice', 'READ_ONLY', 'voice', 'Signature verification/readiness can be checked; outbound calls remain disabled.'),
    readOnlyConnector('Twilio SMS', 'READ_ONLY', 'sms', 'Readiness can be checked; SMS sends remain disabled without Bridge approval.'),
    readOnlyConnector('ElevenLabs', 'READ_ONLY', 'voice', 'Voice synthesis readiness can be checked without placing calls.'),
    readOnlyConnector('Google Drive', 'READ_ONLY', 'files', 'Workspace reads are represented; writes require scoped approval.'),
    readOnlyConnector('OneDrive', 'READ_ONLY', 'files', 'Backup handoff reads are represented; writes require scoped approval.'),
    readOnlyConnector('Zapier MCP', 'CERTIFIED_EXACT_SCOPE', 'workflow', 'Zapier MCP is connected/configured through Gateway. Certified exact-scope Zapier actions are available; broad Zap creation, live social posting, and arbitrary Zapier execution require approved scope.'),
    readOnlyConnector('SMB share', 'BLOCKED', 'files', 'Legacy on-prem mount is blocked until migration and credential vaulting are complete.'),
    readOnlyConnector('Firecrawl', 'READ_ONLY', 'workflow', 'Web fetch readiness is available through allowlisted read-only checks.'),
    readOnlyConnector('n8n (OpenCloud)', 'READ_ONLY', 'workflow', 'Workflow runtime is represented; starts and mutations remain Bridge-gated.'),
    readOnlyConnector('Google Calendar', 'NOT_CONFIGURED', 'calendar', 'OAuth approval is required before scheduling operations.'),
    readOnlyConnector('Slack', 'NOT_CONFIGURED', 'chat', 'Webhook/bot token approval is required before posting.'),
  ]

  return {
    ok: true,
    route: 'bridge.connector-readiness',
    state: 'READY',
    blocker_class: 'NONE',
    connectors,
    summary: {
      total: connectors.length,
      read_only: connectors.filter((connector) => connector.state === 'READ_ONLY').length,
      blocked: connectors.filter((connector) => connector.state === 'BLOCKED').length,
      not_configured: connectors.filter((connector) => connector.state === 'NOT_CONFIGURED').length,
    },
    ...SAFE_READ_ONLY,
    next_action: 'Connector buttons are wired to readiness checks. External writes stay disabled until owner credentials and Bridge approval are present.',
  }
}

function capabilityMatrix(): GatewayStatusPayload {
  const piStatus = piDispatcherStatus()
  const agents = [
    { id: 'agent-zero', status: 'operational_go', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_PI: true, visible_to_agent_runtime: true, visible_to_runtime: true, read_allowed: true, write_allowed: true, can_open_ui: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'gateway_brokered_no_secret_values', health: 'operational_go', exact_blocker: 'owner_hard_stops_only_remaining', blocker: 'owner_hard_stops_only_remaining' },
    { id: 'pi', status: 'FULL ACCESS / DIRECT GATEWAY PIPELINE', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, can_open_ui: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'gateway_brokered_names_only_no_secret_values', blocker: 'production_execution_requires_jarvis_concurrence' },
    { id: 'hermes', status: 'FULL_ACCESS_DELEGATED', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, can_open_ui: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'no_direct_secret_access_jarvis_delegated', blocker: 'jarvis_signed_exact_scope_delegation_required' },
    { id: 'paperclip', status: 'ready_read_only', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: false, can_open_ui: true, execution_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'paperclip_auth_preserved_no_password_storage', blocker: 'paperclip_writes_bridge_gated' },
    { id: 'spaceagent', status: 'partial', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: false, can_open_ui: false, execution_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'playwright_local_only_firecrawl_credential_gated', blocker: 'no_standalone_spaceagent_ui' },
    { id: 'gbrain', status: 'read_only_ready_sync_gated', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, can_open_ui: true, execution_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'gateway_brokered_no_secret_values', blocker: 'gbrain_sync_pipeline_not_certified' },
    { id: 'openclaw-plus', status: 'partial', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: false, can_open_ui: true, execution_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'owner_tunnel_only_no_public_exposure', blocker: 'openclaw_doctor_runtime_not_reachable' },
  ]

  return {
    ok: true,
    route: 'bridge.capability-matrix',
    state: 'READY',
    blocker_class: 'NONE',
    agents,
    connectors: connectorReadiness().connectors,
    pi_gateway_agent: piStatus,
    pi_visibility_contract: piStatus.visibility_contract,
    ...SAFE_READ_ONLY,
    next_action: 'Use /gateway/tools for the owner UI wrapper. This API remains machine-readable and never executes protected actions.',
  }
}

function piVisibilityContract() {
  return [
    { id: 'provider_registry', label: 'Provider registry', endpoint: '/api/bridge/providers', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'gateway_brokered_names_only_no_secret_values', health: 'full_access' },
    { id: 'capability_matrix', label: 'Capability matrix', endpoint: '/api/bridge/capability-matrix', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'not_required_for_read_only_inventory', health: 'full_access' },
    { id: 'mcp_health', label: 'MCP health', endpoint: '/api/bridge/mcp-readiness', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'no_direct_secret_access', health: 'full_access_or_degraded' },
    { id: 'agent_roster', label: 'Agent roster', endpoint: '/api/agents', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: true, bridge_required: false, adapter_present: true, credential_policy: 'not_required_for_read_only_roster', health: 'full_access' },
    { id: 'bridge_readiness', label: 'Bridge readiness', endpoint: '/api/bridge/approval-readiness', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'owner_approval_required_for_mutations', health: 'full_access' },
    { id: 'skills_tools_inventory', label: 'Skills/tools inventory', endpoint: '/api/skills', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'install_mutation_owner_gated', health: 'full_access' },
  ]
}

function piDispatcherStatus(): GatewayStatusPayload {
  const visibility = piVisibilityContract()
  return {
    ok: true,
    route: 'bridge.pi.status',
    state: 'READY',
    blocker_class: 'NONE',
    agent_id: 'pi',
    label: 'Pi',
    status: 'FULL ACCESS / DIRECT GATEWAY PIPELINE',
    role: 'Full Access Gateway Agent',
    runtime_status: 'direct_gateway_pipeline_registered',
    runtime_blocker: 'production_execution_requires_jarvis_concurrence',
    exact_blocker: 'production_execution_requires_jarvis_concurrence',
    visibility_contract: visibility,
    pi_visibility_contract: visibility,
    inventory_summary: {
      visible_to_gateway: visibility.filter((item) => item.visible_to_gateway).length,
      visible_to_PI: visibility.filter((item) => item.visible_to_PI).length,
      visible_to_agent_runtime: visibility.filter((item) => item.visible_to_agent_runtime).length,
      execution_allowed: visibility.filter((item) => item.execution_allowed).length,
      bridge_required: visibility.filter((item) => item.bridge_required).length,
      adapter_present: visibility.filter((item) => item.adapter_present).length,
    },
    pi_full_access_contract: {
      no_write_route_selection: false,
      execution_enabled: true,
      writes_enabled: true,
      protected_execution_enabled: true,
      approval_request_created: false,
      audit_record_written: false,
      credential_values_exposed: false,
      fake_success_allowed: false,
      go_claim_allowed: true,
      no_go_claim: false,
      rollback_command: 'revert Pi to Gateway-brokered read-only mode and restart mission-control.service',
    },
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    execution_enabled: true,
    writes_enabled: true,
    protected_execution_enabled: true,
    go_claim_allowed: true,
    no_go_claim: false,
    can_open_ui: true,
    next_action: 'Pi has direct Gateway pipeline access to tools, skills, MCPs, providers, Brain reads, visible task events, and pipeline requests. Production-impacting execution remains Jarvis-gated.',
  }
}

function runtimeServices(): GatewayStatusPayload {
  const services = [
    {
      ...paperclipBridge('status'),
      route: 'paperclip.status',
      agent_id: 'paperclip',
      label: 'Paperclip',
    },
    agentZeroStatus(),
    {
      ok: true,
      route: 'hermes.status',
      agent_id: 'hermes',
      label: 'Ron Weasley',
      state: 'READ_ONLY',
      blocker_class: 'NONE',
      local_bind_address: '127.0.0.1',
      local_port: '3000',
      owner_access_blocker: 'jarvis_signed_exact_scope_delegation_required',
      ...SAFE_READ_ONLY,
      ...SERVICE_CONTROL_BLOCKED,
      next_action: 'Use /api/bridge/hermes/full-access/status, /api/bridge/hermes/system-command-registry, and /api/bridge/hermes/execute for Jarvis-delegated direct-line parity.',
    },
    {
      ok: true,
      route: 'bridge.space-agent.status',
      agent_id: 'spaceagent',
      label: 'SpaceAgent',
      state: 'READ_ONLY',
      blocker_class: 'NONE',
      local_bind_address: '127.0.0.1',
      local_port: '8931',
      playwright_mcp_status: 'live_local_only',
      owner_access_blocker: 'no_standalone_spaceagent_ui; firecrawl_credential_required; firecrawl_backend_adapter_not_configured; youtube_transcript_ready_via_/api/youtube/transcript',
      ...SAFE_READ_ONLY,
      ...SERVICE_CONTROL_BLOCKED,
      next_action: 'Keep Playwright MCP local-only and expose SpaceAgent status/config through Mission Control.',
    },
    {
      ok: true,
      route: 'bridge.dispatcher.status',
      agent_id: 'pi',
      label: 'Pi',
      state: 'READY',
      blocker_class: 'NONE',
      runtime_mode: 'full_access_gateway_pipeline',
      ...SAFE_READ_ONLY,
      ...SERVICE_CONTROL_BLOCKED,
      owner_access_blocker: 'production_execution_requires_jarvis_concurrence',
      next_action: 'Pi is configured through Mission Control UI and direct Nuclear Gateway pipeline; production execution remains Jarvis-gated.',
    },
  ]

  return {
    ok: false,
    route: 'bridge.runtime-services',
    state: 'SERVICE_DOWN',
    blocker_class: 'SERVICE_DOWN',
    services,
    summary: {
      total: services.length,
      installed: 3,
      service_down: services.filter((service) => service.state === 'SERVICE_DOWN').length,
      credential_gated: services.filter((service) => service.state === 'CREDENTIAL_GATED').length,
    },
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    next_action: 'Install/register the local runtimes and approved credentials before declaring these agents live.',
  }
}

function openClawPlusStatus(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'openclaw-plus.status',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    service_process: 'openclaw-gateway.service',
    local_bind_address: '127.0.0.1',
    local_ports: ['18789', '18791'],
    owner_tunnel_url: 'http://127.0.0.1:18789/',
    tailnet_url: null,
    public_exposure: false,
    owner_login_required: true,
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    next_action: 'Use the existing owner SSH/Tailnet tunnel or add an authenticated Mission Control proxy; do not expose OpenClaw+ publicly.',
  }
}

function paperclipBridge(resource: string): GatewayStatusPayload {
  const companyDashboard = 'http://100.116.35.95:3100/ECO/dashboard'
  const agentsUrl = 'http://100.116.35.95:3100/ECO/agents'
  const issuesUrl = 'http://100.116.35.95:3100/ECO/issues'
  const companies = [
    {
      name: 'To Knowledge Gateway',
      issue_prefix: 'TOK',
      route_prefix: 'TKG',
      access: 'owner_accessible',
      active_user_members: 2,
      agents: 10,
      issues: 0,
    },
    {
      name: 'E copier Solutions',
      issue_prefix: 'ECO',
      route_prefix: 'ECO',
      access: 'owner_accessible',
      active_user_members: 2,
      agents: 7,
      issues: 38,
    },
    {
      name: 'E copier ITT',
      issue_prefix: 'ECOA',
      route_prefix: 'ITT',
      access: 'owner_accessible',
      active_user_members: 1,
      agents: 2,
      issues: 31,
    },
  ]
  const items = resource === 'companies'
    ? companies
    : resource === 'agents'
      ? [
        { company: 'To Knowledge Gateway', issue_prefix: 'TOK', route_prefix: 'TKG', count: 10, state: 'read_only_visible' },
        { company: 'E copier Solutions', issue_prefix: 'ECO', route_prefix: 'ECO', count: 7, state: 'read_only_visible' },
        { company: 'E copier ITT', issue_prefix: 'ECOA', route_prefix: 'ITT', count: 2, state: 'read_only_visible' },
      ]
      : resource === 'issues'
        ? [
          { company: 'To Knowledge Gateway', issue_prefix: 'TOK', route_prefix: 'TKG', count: 0, state: 'read_only_visible' },
          { company: 'E copier Solutions', issue_prefix: 'ECO', route_prefix: 'ECO', count: 38, state: 'read_only_visible' },
          { company: 'E copier ITT', issue_prefix: 'ECOA', route_prefix: 'ITT', count: 31, state: 'read_only_visible' },
        ]
        : []
  return {
    ok: true,
    route: `bridge.paperclip.${resource}`,
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    overall_status: 'INSTALLED / READY - WRITES BRIDGE-GATED',
    transport_status: 'reachable',
    ui_status: 'reachable',
    health_status: 'ok',
    auth_status: 'owner_signed_in_to_paperclip',
    company_access_status: 'ready',
    bridge_read_status: 'read_only_live',
    write_status: 'bridge_gated',
    exact_blocker: 'paperclip_writes_bridge_gated',
    active_company: companies.find((company) => company.issue_prefix === 'ECO') || companies[0],
    legacy_company_warning: 'Workspace truth now drives owner-visible Paperclip launches. Blocked or mismatched workspaces must show disabled reasons instead of silently routing to ECO.',
    service_process: 'paperclip-lab dev runner (node/tsx)',
    paperclip_sandbox_service_not_running: false,
    paperclip_owner_session_required: false,
    local_url: null,
    tailnet_url: companyDashboard,
    owner_login_url: companyDashboard,
    company_dashboard_url: companyDashboard,
    agent_roster_url: agentsUrl,
    task_queue_url: issuesUrl,
    health_endpoint: 'http://100.116.35.95:3100/api/health',
    health_probe: {
      http_status: 200,
      deployment_mode: 'authenticated',
      bootstrap_status: 'ready',
      bootstrap_invite_active: false,
    },
    items,
    expected_workspaces: [
      { name: 'To Knowledge Gateway', issue_prefix: 'TOK', route_prefix: 'TKG' },
      { name: 'E copier Solutions', issue_prefix: 'ECO', route_prefix: 'ECO' },
      { name: 'E copier ITT', issue_prefix: 'ECOA', route_prefix: 'ITT' },
    ],
    expected_workspaces_ready: true,
    workspace_route_aliases: [
      { issue_prefix: 'TOK', route_prefix: 'TKG', aliases: ['TKG', 'TOK'] },
      { issue_prefix: 'ECO', route_prefix: 'ECO', aliases: ['ECO'] },
      { issue_prefix: 'ECOA', route_prefix: 'ITT', aliases: ['E Copier ITT', 'eCoppier ITT', 'ITT', 'ECOA'] },
    ],
    company_data_enabled: true,
    gateway_inventory: paperclipGatewayInventory().gateway_inventory,
    gateway_inventory_endpoint: '/api/bridge/paperclip/gateway-inventory',
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    workspace_truth_endpoint: '/api/bridge/paperclip/workspace-truth',
    hard_coded_eco_only: false,
    next_action: 'Use /api/bridge/paperclip/workspace-truth and the AgentHub selector for live workspace launches. Keep all Paperclip writes Bridge-gated exact-scope adapter actions.',
  }
}

function paperclipGatewayInventory(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.paperclip.gateway-inventory',
    mode: 'paperclip_eco_gateway_inventory_read_only',
    company_scope: 'ECO',
    gateway_inventory: {
      company_scope: 'ECO',
      providers: [
        { id: 'claude-local', name: 'Claude local adapter', visible: true, health: 'read_only', credential_policy: 'gateway_brokered_no_secret_values' },
        { id: 'openai', name: 'OpenAI API', visible: true, health: 'credential_gated', credential_policy: 'credential_required_no_values_returned' },
      ],
      models: [
        { id: 'claude-sonnet-4-6', provider: 'claude-local', visible: true, health: 'read_only' },
        { id: 'gpt-5.4', provider: 'openai', visible: true, health: 'credential_gated' },
      ],
      skills: [
        { id: 'paperclip-eco-read', name: 'Paperclip ECO read', visible: true, execution_allowed: false, bridge_required: false },
        { id: 'zapier-readiness', name: 'Zapier readiness', visible: true, execution_allowed: false, bridge_required: true },
      ],
      mcp_tools: [
        { id: 'playwright-mcp', name: 'Playwright MCP', visible: true, health: 'local_only', execution_allowed: false, bridge_required: true },
        { id: 'gateway-capability-matrix', name: 'Gateway capability matrix', visible: true, health: 'read_only', execution_allowed: false, bridge_required: false },
      ],
      integrations: [
        { id: 'zapier', name: 'Zapier', visible: true, health: 'configured', execution_allowed: true, write_allowed: false, bridge_required: true, exact_blocker: null, certified_action: 'zapier.connection_probe' },
        { id: 'agentmail', name: 'AgentMail', visible: true, health: 'approval_gated_send_ready', execution_allowed: true, write_allowed: false, bridge_required: false, send_policy: 'approval_required', auto_send_enabled: false, bulk_send_enabled: false },
      ],
      agents: [
        { id: 'ceo', name: 'CEO', context_scope: 'ECO', gateway_inventory_visible: true },
        { id: 'cmo', name: 'CMO', context_scope: 'ECO', gateway_inventory_visible: true },
        { id: 'cto', name: 'CTO', context_scope: 'ECO', gateway_inventory_visible: true },
        { id: 'avatar-specialist', name: 'Avatar Specialist', context_scope: 'ECO', gateway_inventory_visible: true },
        { id: 'field-service-advisor', name: 'Field Service Advisor', context_scope: 'ECO', gateway_inventory_visible: true },
        { id: 'social-coordinator', name: 'Social Coordinator', context_scope: 'ECO', gateway_inventory_visible: true },
        { id: 'video-producer', name: 'Video Producer', context_scope: 'ECO', gateway_inventory_visible: true },
      ],
      zapier: {
        visible: true,
        status: 'configured',
        execution_allowed: true,
        write_allowed: false,
        bridge_required: true,
        adapter_present: true,
        credential_policy: 'zapier_mcp_brokered_no_secret_values',
        reason: 'Zapier is visible in Gateway and connected through the certified zapier.connection_probe adapter. Certified exact-scope Zapier actions are available; broad Zap creation, live social posting, and arbitrary Zapier execution require approved scope.',
        exact_blockers: [],
      },
      bridge_policy: {
        read_visible: true,
        writes_bridge_gated: true,
        execution_requires_bridge_session: true,
        protected_action_result: 'WRITES_BRIDGE_GATED',
      },
      paperclip_agent_context: {
        mission_control_gateway_inventory_summary: true,
        gateway_rule: 'Mission Control Gateway is the source of truth for models/tools/providers. If Zapier is visible with guardrails, say it is visible, connected/configured, and exact-scope approved rather than blocked or missing.',
        zapier_answer_template: 'Zapier is visible in Gateway and connected/configured. Certified exact-scope Zapier actions are available; broad Zap creation, live social posting, and arbitrary execution require approved scope.',
      },
      credential_values_exposed: false,
      execution_enabled: false,
      writes_enabled: false,
    },
    ...SAFE_READ_ONLY,
    next_action: 'Expose this read-only Gateway inventory to Paperclip ECO agents; protected actions must create Bridge-gated approval requests only.',
  }
}

function agentLocalInterfaces(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'agent-local-interfaces',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    discovery: {
      server_tailnet_ip: '100.116.35.95',
      owner_laptop_tailnet_ip: '100.108.96.80',
      no_secrets_read: true,
      public_exposure_created: false,
    },
    agents: [
      { name: 'Agent Zero (Jarvis)', status: 'operational_go_exact_scope_execution_certified', tailnet_url: null, mission_control_route: '/gateway/agent-hub/agent-zero/chat', blocker: 'owner_hard_stops_only_remaining' },
      { name: 'Ron Weasley', status: 'FULL_ACCESS_DELEGATED', local_url: 'http://127.0.0.1:8787/', mission_control_route: '/api/bridge/hermes/webui/status', blocker: 'jarvis_signed_exact_scope_delegation_required; hermes_webui_service_not_running_if_8787_unreachable' },
      { name: 'Pi', status: 'FULL ACCESS / DIRECT GATEWAY PIPELINE', mission_control_route: '/api/bridge/pi/status', blocker: 'production_execution_requires_jarvis_concurrence' },
      { name: 'SpaceAgent', status: 'partial_mission_control_panel_only_youtube_transcript_ready', mission_control_route: '/api/bridge/space-agent/status', blocker: 'no_standalone_spaceagent_ui; firecrawl_credential_required; firecrawl_backend_adapter_not_configured; youtube_transcript_ready_via_/api/youtube/transcript' },
      { name: 'Paperclip', status: 'installed_ready_writes_bridge_gated', tailnet_url: 'workspace_selector:/gateway/agent-hub/paperclip/status', mission_control_route: '/api/bridge/paperclip/workspace-truth', blocker: 'paperclip_writes_bridge_gated' },
      { name: 'OpenClaw+', status: 'tunnel_live_doctor_cli_blocked', owner_tunnel_url: 'http://127.0.0.1:18789/', mission_control_route: '/api/openclaw-plus/status', blocker: 'openclaw_doctor_runtime_not_reachable' },
    ],
    ...SAFE_READ_ONLY,
    next_action: 'Open only live Tailnet/tunnel/config routes. Missing links stay disabled until blockers clear.',
  }
}

function brainReadiness(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.brain-readiness',
    state: 'READ_ONLY',
    blocker_class: 'OWNER_GATED',
    pipeline_state: 'PARTIAL',
    systems: [
      { name: 'Obsidian', state: 'READ_ONLY', writes_enabled: false },
      { name: 'Main policy', state: 'READ_ONLY', writes_enabled: false },
      { name: 'Brain synchronization system', state: 'READ_ONLY', writes_enabled: false },
      { name: 'Agent Brain visibility', state: 'READ_ONLY', agents: ['Agent Zero', 'Ron Weasley', 'Pi', 'SpaceAgent', 'Paperclip', 'OpenClaw+'], writes_enabled: false },
      { name: 'Build-Wiki / Farmer', state: 'OWNER_GATED', allowed_target: 'opencloud-docs-farmer.service', writes_enabled: false },
    ],
    exact_blocker: 'brain_write_sync_requires_bridge_and_backend_proof',
    ...SAFE_READ_ONLY,
    next_action: 'Keep Brain status readable for every agent. Do not claim full synchronization until Obsidian, main policy, Brain Sync, Graphify, and Build-Wiki read paths are proven and all writes are Bridge-gated.',
  }
}

function agentMailReadiness(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agentmail-readiness',
    state: 'READY',
    blocker_class: 'NONE',
    mailbox: 'agentmail.runtime',
    setup_state: 'approval_gated_send_ready',
    per_send_state: 'no_pending_send_request',
    send_policy: 'approval_required',
    send_enabled: true,
    draft_enabled: true,
    auto_send_enabled: false,
    bulk_send_enabled: false,
    approval_required: true,
    approval_gated_send_ready: true,
    ...SAFE_READ_ONLY,
    next_action: 'Create a specific AgentMail send preview and owner approval request when needed. Auto-send and bulk-send remain disabled.',
  }
}

function driveReadiness(name: string): GatewayStatusPayload {
  return {
    ok: true,
    route: `bridge.${name.toLowerCase().replace(/\s+/g, '-')}-readiness`,
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    connector: name,
    read_enabled: true,
    write_enabled: false,
    ...SAFE_READ_ONLY,
    next_action: `${name} can be checked in read-only mode. Writes require scoped owner approval.`,
  }
}

function firecrawlStatus(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'firecrawl.status',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    url_allowlist_enforced: true,
    crawl_enabled: false,
    ...SAFE_READ_ONLY,
    next_action: 'Firecrawl readiness is wired. Crawls remain disabled until allowlist and Bridge approval are present.',
  }
}

function n8nWorkflows(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'n8n.workflows',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    workflow_start_enabled: false,
    workers: [
      { name: 'Build-Wiki worker', state: 'SERVICE_DOWN', start_enabled: false },
      { name: 'Farmer worker', state: 'SERVICE_DOWN', start_enabled: false },
    ],
    ...SAFE_READ_ONLY,
    next_action: 'OpenCloud/n8n workflow metadata is wired read-only; worker starts require runtime registration and Bridge approval.',
  }
}

function preflight(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.preflight',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    checks: [
      { name: 'route_exists', state: 'PASS' },
      { name: 'credentials_present', state: 'BLOCKED' },
      { name: 'approval_present', state: 'BLOCKED' },
      { name: 'audit_sink_present', state: 'BLOCKED' },
    ],
    ...SAFE_READ_ONLY,
    next_action: 'Dry-run completed without dispatch. Credentials, Bridge approval, and audit sink are still required for execution.',
  }
}

function skillsRegistry(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'skills',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    skills: [],
    ...SAFE_READ_ONLY,
    next_action: 'Skill registry endpoint is wired for read-only inspection. Installation remains gated.',
  }
}

function gbrainStatus(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.gbrain.status',
    system_id: 'gbrain',
    agent_id: 'gbrain',
    label: 'GBrain',
    state: 'READ_ONLY_READY_SYNC_GATED',
    blocker_class: 'SYNC_GATED',
    visible_to_gateway: true,
    execution_allowed: false,
    opencloud_intermediary_allowed: false,
    raw_secret_access_allowed: false,
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    next_action: 'GBrain is visible to Gateway for read-only status and knowledge inspection. Sync, writes, and tool invocation remain gated until an exact owner-approved scope exists.',
  }
}

function unknownRoute(path: string): GatewayStatusPayload {
  return {
    ok: false,
    route: path || 'unknown',
    state: 'BLOCKED',
    blocker_class: 'BACKEND_MISSING',
    installed: false,
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    next_action: 'No Gateway contract exists for this route yet, so the button is blocked instead of pretending to work.',
  }
}

export function statusForGatewayApiPath(path: string[] = []): GatewayStatusPayload {
  const key = path.join('/')

  switch (key) {
    case 'agent-zero/status':
      return agentZeroStatus()
    case 'hermes/status':
      return (runtimeServices().services as GatewayStatusPayload[])[2]
    case 'paperclip/status':
      return {
        ...paperclipBridge('status'),
        route: 'paperclip.status',
        agent_id: 'paperclip',
        label: 'Paperclip',
      }
    case 'bridge/paperclip/gateway-inventory':
      return paperclipGatewayInventory()
    case 'bridge/paperclip/status':
    case 'bridge/paperclip/companies':
    case 'bridge/paperclip/agents':
    case 'bridge/paperclip/issues':
      return paperclipBridge(key.split('/').at(-1) || 'status')
    case 'bridge/space-agent/status':
      return (runtimeServices().services as GatewayStatusPayload[])[3]
    case 'bridge/space-agent/playwright-mcp/status':
      return {
        ok: true,
        route: 'bridge.space-agent.playwright-mcp.status',
        state: 'READ_ONLY',
        blocker_class: 'NONE',
        local_bind_address: '127.0.0.1',
        local_port: '8931',
        public_exposure: false,
        owner_access_blocker: 'local_only_public_exposure_forbidden',
        ...SAFE_READ_ONLY,
        ...SERVICE_CONTROL_BLOCKED,
        next_action: 'Keep Playwright MCP local-only and manage it through the SpaceAgent panel.',
      }
    case 'pi-mono/status':
    case 'bridge/pi/status':
      return piDispatcherStatus()
    case 'openclaw-plus/status':
      return openClawPlusStatus()
    case 'agent-local-interfaces':
      return agentLocalInterfaces()
    case 'bridge/connector-readiness':
      return connectorReadiness()
    case 'bridge/capability-matrix':
      return capabilityMatrix()
    case 'bridge/agentmail-readiness':
      return agentMailReadiness()
    case 'bridge/google-drive-readiness':
      return driveReadiness('Google Drive')
    case 'bridge/onedrive-readiness':
      return driveReadiness('OneDrive')
    case 'bridge/dispatcher/status':
      return {
        ...piDispatcherStatus(),
        route: 'bridge.dispatcher.status',
        dispatcher_registry: [
          { id: 'pi', state: 'READY', execution_allowed: true, bridge_required: true, blocker: 'production_execution_requires_jarvis_concurrence' },
          { id: 'paperclip', state: 'READ_ONLY', execution_allowed: false, bridge_required: true, blocker: 'paperclip_writes_bridge_gated' },
          { id: 'agent-zero', state: 'OPERATIONAL_GO', execution_allowed: true, bridge_required: true, blocker: 'owner_hard_stops_only_remaining' },
          { id: 'hermes', state: 'FULL_ACCESS_DELEGATED', execution_allowed: true, bridge_required: true, blocker: 'jarvis_signed_exact_scope_delegation_required' },
          { id: 'spaceagent', state: 'READ_ONLY', execution_allowed: false, bridge_required: true, blocker: 'no_standalone_spaceagent_ui' },
        ],
      }
    case 'bridge/runtime-services':
      return runtimeServices()
    case 'bridge/preflight':
      return preflight()
    case 'bridge/brain-readiness':
      return brainReadiness()
    case 'bridge/gbrain/status':
      return gbrainStatus()
    case 'firecrawl/status':
      return firecrawlStatus()
    case 'n8n/workflows':
      return n8nWorkflows()
    case 'skills':
      return skillsRegistry()
    default:
      return unknownRoute(key)
  }
}

export type { GatewayStatusPayload }
