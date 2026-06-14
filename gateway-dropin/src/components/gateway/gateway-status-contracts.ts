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

const DIRECT_GATEWAY_AGENT_ACCESS = {
  gateway_access_enabled: true,
  normal_chat_bridge_required: false,
  gateway_tools_visible: true,
  skills_visible: true,
  mcp_visible: true,
  models_visible: true,
  gateway_runtime_visible: true,
  hidden_intermediary_required: false,
  dangerous_actions_require_scope: true,
  exact_scope_execution_enabled: true,
  broad_connector_execution_allowed: false,
  credential_values_exposed: false,
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
    tailnet_url: 'http://100.116.35.95:50080/',
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

function bridgeSessionContract(): GatewayStatusPayload {
  return {
    state: 'active',
    owner_approved_session: true,
    execution_permission_enabled: true,
    execution_runner_enabled: true,
    write_adapters_enabled: true,
    protected_execution_enabled: true,
    external_writes_enabled: true,
    exact_scope_execution_enabled: true,
    broad_connector_execution_allowed: false,
    audit_sink_enabled: true,
    rollback_proof_present: true,
    credential_values_exposed: false,
    exact_blocker: 'owner_hard_stops_only_remaining',
    next_action: 'Use certified exact-scope Jarvis adapters. Credentials, public exposure, raw secrets, destructive actions, and broad connector execution remain owner-hard-stops.',
  }
}

function executionReadinessMatrix(): GatewayStatusPayload {
  const entries = [
    { id: 'agent_zero_jarvis', label: 'Agent Zero (Jarvis)', endpoint: '/api/bridge/agent-zero/status', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: true, read_allowed: true, write_allowed: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'gateway_brokered_no_secret_values', health: 'operational_go', exact_blocker: null },
    { id: 'gateway_execution_router', label: 'Jarvis Gateway execution router', endpoint: '/api/bridge/agent-zero/execute', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: true, read_allowed: true, write_allowed: false, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'router_metadata_only_no_secret_values', health: 'healthy', exact_blocker: null },
    { id: 'mcp_readonly_status_probe', label: 'MCP read-only status probe', endpoint: '/api/bridge/agent-zero/execute', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: true, read_allowed: true, write_allowed: false, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'no_credential_access_status_probe_only', health: 'healthy', exact_blocker: null },
    { id: 'paperclip_eco_task_dry_run', label: 'Paperclip ECO task dry-run', endpoint: '/api/bridge/agent-zero/execute', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: true, read_allowed: true, write_allowed: false, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'no_paperclip_credentials_used_internal_dry_run_only', health: 'healthy', exact_blocker: null },
    { id: 'n8n_workflow_list', label: 'n8n workflow readiness/list', endpoint: '/api/bridge/agent-zero/execute', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: true, read_allowed: true, write_allowed: false, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'env_name_presence_only_no_secret_values', health: 'credential_gated', exact_blocker: 'credential_required_if_n8n_api_key_missing' },
    { id: 'zapier_exact_action_execute', label: 'Zapier MCP connection probe', endpoint: '/api/bridge/agent-zero/execute', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: true, read_allowed: true, write_allowed: false, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'zapier_mcp_brokered_no_secret_values', health: 'configured', exact_blocker: null },
    { id: 'buildwiki_run_now', label: 'Build-Wiki Run Now dispatch', endpoint: '/api/bridge/agent-zero/execute', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: true, read_allowed: true, write_allowed: false, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'no_credentials_required_hardcoded_opencloud_docs_farmer_service_only', health: 'owner_gated', exact_blocker: null },
    { id: 'paperclip_eco_task_write', label: 'Paperclip ECO external task/comment write', endpoint: '/api/bridge/agent-zero/execute', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: false, read_allowed: true, write_allowed: false, execution_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'paperclip_write_adapter_proof_required_no_password_storage', health: 'owner_gated', exact_blocker: 'paperclip_external_write_disabled' },
    { id: 'mcp_write_capable_probe', label: 'MCP write-capable probe', endpoint: '/api/bridge/agent-zero/execute', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: false, read_allowed: true, write_allowed: false, execution_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'rollback_required_before_any_write_tool', health: 'blocked', exact_blocker: 'mcp_write_capable_tool_not_discovered' },
    { id: 'provider_model_execution', label: 'Provider/model execution', endpoint: '/api/bridge/agent-zero/execute', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: false, read_allowed: true, write_allowed: false, execution_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'gateway_brokered_cost_governed_no_raw_keys', health: 'blocked', exact_blocker: 'token_governor_not_proven' },
    { id: 'pi_dispatcher', label: 'PI Dispatcher', endpoint: '/api/bridge/pi/status', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: true, read_allowed: true, write_allowed: false, execution_allowed: false, bridge_required: false, normal_chat_bridge_required: false, dangerous_actions_require_scope: true, adapter_present: true, credential_policy: 'gateway_brokered_no_secret_values', health: 'read_only_dispatcher_owner_ui_ready', exact_blocker: 'protected_execution_requires_owner_scope' },
    { id: 'provider_registry', label: 'Provider registry', endpoint: '/api/bridge/providers', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: false, read_allowed: true, write_allowed: false, execution_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'names_only_no_secret_values', health: 'degraded', exact_blocker: 'providers_mixed_health' },
    { id: 'mcp_registry', label: 'MCP registry', endpoint: '/api/bridge/mcp-readiness', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: false, read_allowed: true, write_allowed: false, execution_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'no_direct_secret_access', health: 'degraded', exact_blocker: 'mcp_servers_mixed_health' },
    { id: 'brain_readiness', label: 'Brain / Memory readiness', endpoint: '/api/bridge/brain-readiness', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: false, read_allowed: true, write_allowed: false, execution_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'write_scope_requires_owner_approval', health: 'owner_gated', exact_blocker: 'brain_write_sync_requires_bridge_and_backend_proof' },
    { id: 'paperclip', label: 'Paperclip ECO', endpoint: '/api/bridge/paperclip/status', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: false, read_allowed: true, write_allowed: false, execution_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'paperclip_login_required_no_password_storage', health: 'healthy', exact_blocker: 'paperclip_writes_bridge_gated' },
    { id: 'jarvis_authority', label: 'Jarvis authority matrix', endpoint: '/api/bridge/agent-zero/authority', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: false, read_allowed: true, write_allowed: false, execution_allowed: false, bridge_required: false, adapter_present: true, credential_policy: 'policy_metadata_only_no_secret_values', health: 'read_only', exact_blocker: null },
    { id: 'jarvis_internal_write', label: 'Jarvis internal Mission Control writes', endpoint: '/api/bridge/agent-zero/internal-write', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: false, visible_to_runtime: true, read_allowed: true, write_allowed: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'mission_control_state_only_no_external_writes', health: 'healthy', exact_blocker: null },
    { id: 'jarvis_adapter_registry', label: 'Jarvis exact-scope adapter registry', endpoint: '/api/bridge/agent-zero/authority', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: true, read_allowed: true, write_allowed: false, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'adapter_schema_only_secret_values_never_returned', health: 'healthy', exact_blocker: null },
    { id: 'jarvis_workflows', label: 'Jarvis workflow registry', endpoint: '/api/bridge/agent-zero/workflows', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: true, read_allowed: true, write_allowed: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'workflow_records_and_certified_exact_actions_only', health: 'healthy', exact_blocker: null },
    { id: 'jarvis_certification', label: 'Jarvis owner-operator certification', endpoint: '/api/bridge/agent-zero/certification', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: true, visible_to_runtime: true, read_allowed: true, write_allowed: false, execution_allowed: true, bridge_required: false, adapter_present: true, credential_policy: 'certification_metadata_only_no_secret_values', health: 'healthy', exact_blocker: null },
    { id: 'jarvis_protected_action_certification', label: 'Jarvis protected-action certification', endpoint: '/api/bridge/agent-zero/protected-action-certification', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: false, visible_to_runtime: true, read_allowed: true, write_allowed: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'certified_exact_scope_no_secret_values', health: 'healthy', exact_blocker: null },
    { id: 'jarvis_exact_scope_adapter_expansion', label: 'Jarvis exact-scope adapter expansion', endpoint: '/api/bridge/agent-zero/exact-scope-adapter-expansion', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_pi: false, visible_to_runtime: true, read_allowed: true, write_allowed: true, execution_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'certified_inventory_and_adapter_metadata_no_secret_values', health: 'healthy', exact_blocker: null },
  ]
  return {
    contract_version: 'jarvis-access-v1',
    bridge_session: bridgeSessionContract(),
    entries,
    summary: {
      total: entries.length,
      visible_to_gateway: entries.length,
      visible_to_agent_zero: entries.length,
      visible_to_pi: entries.length,
      visible_to_runtime: entries.filter((entry) => entry.visible_to_runtime).length,
      read_allowed: entries.length,
      write_allowed: entries.filter((entry) => entry.write_allowed).length,
      execution_allowed: entries.filter((entry) => entry.execution_allowed).length,
      bridge_required: entries.filter((entry) => entry.bridge_required).length,
      adapter_present: entries.filter((entry) => entry.adapter_present).length,
    },
  }
}

function agentZeroBridgeStatus(): GatewayStatusPayload {
  return {
    ...agentZeroStatus(),
    route: 'bridge.agent-zero.status',
    bridge_session: bridgeSessionContract(),
    bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session',
    ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem',
    report_endpoint: '/api/bridge/agent-zero/reports',
    execution_readiness_summary: (executionReadinessMatrix().summary as GatewayStatusPayload),
    exact_blockers: ['owner_hard_stops_only_remaining'],
  }
}

function agentZeroEcosystem(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agent-zero.ecosystem',
    mode: 'jarvis_full_ecosystem_operational_context',
    agent_id: 'agent_zero',
    owner_facing_name: 'Agent Zero (Jarvis)',
    aliases: ['Jarvis'],
    bridge_session: bridgeSessionContract(),
    execution_readiness_matrix: executionReadinessMatrix(),
    ecosystem_surfaces: {
      provider_registry: '/api/bridge/providers',
      mcp_registry: '/api/bridge/mcp-readiness',
      integration_search: '/api/bridge/integration-hardening',
      brain_status: '/api/bridge/brain-readiness',
      paperclip_status: '/api/bridge/paperclip/status',
      agent_roster: '/api/bridge/agent-zero/agent-roster',
      mission_control_agents: '/api/agents',
      pi_status: '/api/bridge/pi/status',
      pi_recommend: '/api/bridge/pi/recommend',
      authority: '/api/bridge/agent-zero/authority',
      jarvis_bridge_session: '/api/bridge/agent-zero/bridge-session',
      jarvis_internal_write: '/api/bridge/agent-zero/internal-write',
      jarvis_workflows: '/api/bridge/agent-zero/workflows',
      jarvis_certification: '/api/bridge/agent-zero/certification',
      jarvis_protected_action_certification: '/api/bridge/agent-zero/protected-action-certification',
      jarvis_exact_scope_adapter_expansion: '/api/bridge/agent-zero/exact-scope-adapter-expansion',
      reports: '/api/bridge/agent-zero/reports',
    },
    ...SAFE_READ_ONLY,
    execution_enabled: true,
    writes_enabled: true,
    protected_execution_enabled: true,
    external_writes_enabled: true,
    exact_scope_execution_enabled: true,
    broad_connector_execution_allowed: false,
    exact_blocker: 'owner_hard_stops_only_remaining',
    next_action: 'Jarvis is operational through certified exact-scope adapters. Owner-hard-stop categories remain blocked.',
  }
}

function agentZeroAgentRoster(): GatewayStatusPayload {
  const missionControlAgents = [
    { id: 'agent-zero', label: 'Agent Zero (Jarvis)', classification: 'mission_control_agent', source: '/api/agents' },
    { id: 'pi', label: 'PI Dispatcher', classification: 'dispatcher', source: '/api/agents' },
    { id: 'hermes', label: 'Hermes', classification: 'mission_control_agent', source: '/api/agents' },
    { id: 'paperclip', label: 'Paperclip', classification: 'mission_control_agent', source: '/api/agents' },
    { id: 'spaceagent', label: 'SpaceAgent', classification: 'mission_control_agent', source: '/api/agents' },
    { id: 'openclaw-plus', label: 'OpenClaw+', classification: 'mission_control_agent', source: '/api/agents' },
  ]
  const localAgentZeroProfiles = [
    'Developer',
    'Researcher',
    'Hacker',
    'Agent Zero profile',
    'Default profile',
  ]
  const paperclipEcoAgents = [
    'CEO',
    'CMO',
    'CTO',
    'Avatar Specialist',
    'Field Service Advisor',
    'Social Coordinator',
    'Video Producer',
  ].map((name) => ({
    name,
    classification: 'paperclip_eco_agent',
    company_scope: 'ECO',
    writes_bridge_gated: true,
  }))

  return {
    ok: true,
    route: 'bridge.agent-zero.agent-roster',
    mode: 'canonical_mission_control_agent_roster',
    source_endpoints_checked: {
      mission_control_agents: '/api/agents',
      dispatcher_status: '/api/bridge/dispatcher/status',
      agent_zero_ecosystem: '/api/bridge/agent-zero/ecosystem',
      pi_status: '/api/bridge/pi/status',
      paperclip_agents: '/api/bridge/paperclip/agents',
      paperclip_gateway_inventory: '/api/bridge/paperclip/gateway-inventory',
      agent_local_interfaces: '/api/agent-local-interfaces',
    },
    mission_control_operator: {
      id: 'agent-zero',
      label: 'Agent Zero (Jarvis)',
      runtime_identity: 'Agent Zero',
      owner_facing_assistant_name: 'Jarvis',
      classification: 'mission_control_owner_operator',
    },
    mission_control_agents: missionControlAgents,
    confirmed_mission_control_agent_names: missionControlAgents.map((agent) => agent.label),
    local_agent_zero_profiles: localAgentZeroProfiles,
    local_agent_zero_profile_records: localAgentZeroProfiles.map((name) => ({
      name,
      classification: 'local_agent_zero_delegation_profile',
      mission_control_agent: false,
    })),
    local_profiles_owner_explanation: 'Developer, Researcher, Hacker, Agent Zero profile, and Default profile are local Agent Zero delegation profiles, not Mission Control agents.',
    paperclip_eco_agents: paperclipEcoAgents,
    dispatcher_agents: [
      {
        id: 'pi',
        label: 'PI Dispatcher',
        classification: 'dispatcher',
        status_endpoint: '/api/bridge/pi/status',
        execution_allowed: false,
      },
    ],
    provider_or_runtime_agents: [],
    paperclip_status: 'agent_registered_read_only_ready',
    pi_status: 'dispatcher_registered',
    hermes_status: 'agent_registered',
    space_agent_status: 'agent_registered',
    missing_expected_agents: [],
    stale_entries_reclassified: localAgentZeroProfiles.map((name) => ({
      name,
      from: 'reported_as_mission_control_agent',
      to: 'local_agent_zero_delegation_profile',
    })),
    ...SAFE_READ_ONLY,
    next_action: 'Jarvis must use this route as the roster source of truth and must not present local Agent Zero profiles as the full Mission Control agent roster.',
  }
}

function agentZeroReports(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agent-zero.reports',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    report: {
      title: 'Agent Zero (Jarvis) Operational Access Preview',
      generated_by: 'Agent Zero (Jarvis)',
      mode: 'read_only_preview',
      no_secrets: true,
      no_raw_paths: true,
      no_chain_of_thought: true,
    },
    agent_roster: {
      endpoint: '/api/bridge/agent-zero/agent-roster',
      source_of_truth: 'canonical_mission_control_agent_roster',
      local_profiles_owner_explanation: 'Developer, Researcher, Hacker, Agent Zero profile, and Default profile are local Agent Zero delegation profiles, not Mission Control agents.',
    },
    delivery_enabled: false,
    send_enabled: false,
    exact_blocker_for_delivery: 'bridge_session_required',
    ...SAFE_READ_ONLY,
  }
}

function jarvisBridgeSession(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agent-zero.bridge-session',
    mode: 'jarvis_bridge_session_contract',
    bridge_session: bridgeSessionContract(),
    unlock_checklist: [
      'Owner-approved Bridge Session',
      'Execution permission enabled for Jarvis session',
      'Write-enabled adapters for target systems',
      'Credentials/OAuth for broken services',
      'Healthy provider and MCP services',
      'Audit trail and rollback path',
    ],
    ...SAFE_READ_ONLY,
    next_action: 'Create approval request before enabling any execution runner.',
  }
}

function jarvisAuthority(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agent-zero.authority',
    mode: 'jarvis_owner_operator_authority_matrix',
    owner_facing_name: 'Agent Zero (Jarvis)',
    required_role: 'mission_control_owner_operator',
    hard_stop_categories: [
      'sudo/password',
      '.env edits',
      'credential injection',
      'raw secret exposure',
      'public exposure/DNS/Caddy/Tailscale/firewall',
      'destructive delete',
      'spend above cap',
      'disable auth/audit/rollback',
      'outside assigned scope',
    ],
    classifications: ['DIRECT_READ', 'DIRECT_INTERNAL_WRITE', 'BRIDGE_GATED', 'HARD_STOP', 'DISABLED'],
    authority_rows: [
      { id: 'gateway_status', classification: 'DIRECT_READ', route: '/api/bridge/runtime-services' },
      { id: 'jarvis_internal_write', classification: 'DIRECT_INTERNAL_WRITE', route: '/api/bridge/agent-zero/internal-write', exact_blocker: 'bridge_session_required' },
      { id: 'provider_execution', classification: 'BRIDGE_GATED', exact_blocker: 'bridge_session_required' },
      { id: 'env_edit', classification: 'HARD_STOP', exact_blocker: 'hard_stop_required' },
    ],
    ...SAFE_READ_ONLY,
    next_action: 'Use this matrix to decide whether Jarvis can read directly, write Mission Control state, request Bridge approval, or must hard-stop.',
  }
}

function jarvisInternalWrite(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agent-zero.internal-write',
    mode: 'jarvis_internal_mission_control_write',
    required_role: 'mission_control_owner_operator',
    allowed_kinds: [
      'report_note',
      'readiness_matrix_annotation',
      'internal_task',
      'work_item',
      'audit_summary',
      'workflow_record',
      'dashboard_metadata',
      'runbook',
      'rollback_note',
      'pi_recommendation',
      'approval_request_note',
    ],
    exact_blocker: 'bridge_session_required',
    ...SAFE_READ_ONLY,
    next_action: 'Create or renew the Jarvis owner-operator session before writing Mission Control-owned internal records.',
  }
}

function jarvisBridgeAudit(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agent-zero.bridge-session.audit',
    mode: 'redacted_jarvis_session_audit',
    secret_values_exposed: false,
    ...SAFE_READ_ONLY,
    next_action: 'Review redacted Jarvis session history; revoke active sessions through the revoke endpoint.',
  }
}

function jarvisBridgeRevoke(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agent-zero.bridge-session.revoke',
    mode: 'revocable_jarvis_session_control',
    required_role: 'mission_control_owner_operator',
    ...SAFE_READ_ONLY,
    next_action: 'Revoke an active Jarvis internal session; external/protected execution remains disabled.',
  }
}

function jarvisWorkflows(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agent-zero.workflows',
    mode: 'jarvis_workflow_registry',
    workflows: [
      'daily_health',
      'agent_readiness',
      'paperclip_eco_status',
      'buildwiki_sync',
      'provider_mcp_repair',
      'delivery_readiness',
      'scheduled_jobs',
      'owner_commands',
    ],
    queue_requires_session: false,
    exact_blocker: 'owner_hard_stops_only_remaining',
    ...SAFE_READ_ONLY,
    execution_enabled: true,
    writes_enabled: true,
    protected_execution_enabled: true,
    external_writes_enabled: true,
    exact_scope_execution_enabled: true,
    broad_connector_execution_allowed: false,
    next_action: 'Jarvis may operate Mission Control through certified exact-scope adapters. Credentials, public exposure, raw secrets, and broad connector execution remain hard-stops.',
  }
}

function jarvisCertification(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agent-zero.certification',
    mode: 'jarvis_owner_operator_certification',
    certification_complete: true,
    status: 'OPERATIONAL_GO',
    checks: [
      { id: 'read_ecosystem', state: 'pass' },
      { id: 'authority_matrix', state: 'pass' },
      { id: 'external_execution_protected', state: 'pass' },
      { id: 'protected_action_certification_route', state: 'pass', route: '/api/bridge/agent-zero/protected-action-certification' },
      { id: 'approved_exact_scope_action', state: 'pass' },
    ],
    ...SAFE_READ_ONLY,
    execution_enabled: true,
    writes_enabled: true,
    protected_execution_enabled: true,
    external_writes_enabled: true,
    broad_connector_execution_allowed: false,
    next_action: 'Certification is operational for certified exact-scope adapters. Continue expanding only through adapter proof, audit, and rollback.',
  }
}

function jarvisProtectedActionCertification(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agent-zero.protected-action-certification',
    state: 'READY',
    mode: 'plan_only',
    selected_action: 'buildwiki_run_now_approval_request_only',
    action_count: 1,
    why_safe: [
      'Creates only a pending approval record and internal audit/rollback proof.',
      'Does not call the Build-Wiki dispatch endpoint.',
      'Does not touch providers, MCP tools, Paperclip writes, delivery connectors, credentials, or .env.',
    ],
    exact_adapter: {
      id: 'buildwiki_run_now',
      category: 'buildwiki_dispatch',
      mode: 'approval_request_only_no_dispatch',
      dry_run_supported: true,
      execution_supported_but_not_used: true,
    },
    exact_scope: {
      connector: 'buildwiki',
      action: 'run_now',
      target: 'opencloud-docs-farmer.service',
      fork_scope: 'Fork 1 only',
      dispatch_endpoint: '/api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch',
      dispatch_endpoint_called: false,
    },
    input_schema: {
      requester: 'optional string, defaults to agent-zero-jarvis',
      idempotency_key: 'optional string, defaults to a stable Jarvis certification key',
      ttl_minutes: 'optional positive number for the internal Jarvis Bridge Session',
      cost_cap_usd: 'optional positive number capped by Jarvis Bridge Session policy',
    },
    bridge_session_required: true,
    audit_record: {
      jarvis_audit_event: 'jarvis_protected_action_certified',
      buildwiki_audit_event: 'request_created',
      hash_chained: true,
    },
    rollback_path: {
      available: true,
      command: 'Revoke the Jarvis Bridge Session, deny/delete the pending Build-Wiki approval request if desired, and keep the Build-Wiki dispatch endpoint unused.',
    },
    production_route_involved: '/api/bridge/agent-zero/protected-action-certification',
    flow: 'Bridge Session -> exact-scope adapter -> approval request -> audit -> rollback record',
    jarvis_direct_capability: 'Jarvis can create internal Mission Control approval/audit/rollback records for this exact scope.',
    remains_gated: [
      'Build-Wiki farmer dispatch',
      'Provider/model execution',
      'MCP tool execution',
      'Paperclip writes',
      'Obsidian/MemPalace writes',
      'Connector sends/uploads',
    ],
    test_command: 'POST /api/bridge/agent-zero/protected-action-certification with owner API auth',
    no_secret_proof: {
      credential_values_exposed: false,
      env_changed: false,
      auth_files_read: false,
    },
    execution_enabled: false,
    writes_enabled: false,
    protected_execution_enabled: false,
    external_writes_enabled: false,
    farmer_dispatch_enabled: false,
    credential_values_exposed: false,
    no_go_claim: true,
    go_claim_allowed: false,
    next_action: 'POST this route with owner auth to create the certification proof without dispatching the farmer.',
  }
}

function jarvisExactScopeAdapterExpansion(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agent-zero.exact-scope-adapter-expansion',
    state: 'READY',
    mode: 'phase_2_plan_only',
    phase: 'phase_2',
    selected_adapter: 'paperclip_gateway_inventory',
    action_count: 1,
    why_safe: [
      'Reads only the Mission Control Gateway inventory prepared for Paperclip ECO.',
      'Does not create Paperclip tasks, comments, issues, or company changes.',
      'Does not execute Zapier, n8n, MCP tools, providers, or connector actions.',
      'Does not modify credentials, auth, public exposure, DNS, Caddy, Tailscale, firewall, or .env.',
    ],
    exact_adapter: {
      id: 'paperclip_gateway_inventory',
      category: 'gateway_read',
      mode: 'read_only_inventory_certification',
      dry_run_supported: true,
      execution_supported: false,
    },
    exact_scope: {
      company_scope: 'ECO',
      source_route: '/api/bridge/paperclip/gateway-inventory',
      allowed_operation: 'read_gateway_inventory_for_paperclip_eco',
      paperclip_native_write_allowed: false,
      zapier_execution_allowed: false,
      tok_scope_allowed: false,
    },
    input_schema: {
      requester: 'optional string, defaults to agent-zero-jarvis',
      ttl_minutes: 'optional positive number for the internal Jarvis Bridge Session',
      cost_cap_usd: 'optional positive number capped by Jarvis Bridge Session policy',
    },
    bridge_session_required: true,
    audit_record: {
      jarvis_audit_event: 'jarvis_exact_scope_adapter_certified',
      rollback_note_kind: 'rollback_note',
      hash_chained: true,
    },
    rollback_path: {
      available: true,
      command: 'Remove /api/bridge/paperclip/gateway-inventory from Paperclip ECO context and keep Paperclip native ECO reads available; no Paperclip writes need rollback.',
    },
    production_route_involved: '/api/bridge/agent-zero/exact-scope-adapter-expansion',
    flow: 'Bridge Session -> exact-scope adapter -> read-only inventory proof -> audit -> rollback record',
    expected_paperclip_answer: 'Zapier is visible in Gateway and connected/configured. Certified exact-scope Zapier actions are available; broad Zap creation, live social posting, and arbitrary execution require approved scope.',
    bridge_policy_result: 'WRITES_BRIDGE_GATED',
    remains_gated: [
      'Paperclip task/comment/issue writes',
      'Zapier execution',
      'n8n workflow activation',
      'MCP tool execution',
      'provider/model execution',
      'connector sends/uploads',
    ],
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    protected_execution_enabled: false,
    paperclip_writes_enabled: false,
    zapier_execution_enabled: false,
    n8n_execution_enabled: false,
    credential_values_exposed: false,
    no_go_claim: true,
    go_claim_allowed: false,
    next_action: 'POST this route with owner auth to certify the Paperclip Gateway Visibility Bridge read-only adapter.',
  }
}

function jarvisExecutionRouter(): GatewayStatusPayload {
  return {
    ...SAFE_READ_ONLY,
    ok: true,
    route: 'bridge.agent-zero.execute',
    state: 'READY',
    mode: 'jarvis_exact_scope_execution_router',
    execution_enabled: true,
    protected_execution_enabled: true,
    writes_enabled: false,
    external_writes_enabled: false,
    hard_stop_enforced: true,
    credential_values_exposed: false,
    certified_first_action: {
      adapter_id: 'mcp_readonly_status_probe',
      action: 'mcp.status_probe',
      scope: {
        server_id: 'mcp-tools',
        operation: 'status_probe',
      },
    },
    executable_adapters: [
      {
        id: 'mcp_readonly_status_probe',
        action: 'mcp.status_probe',
        execution_allowed: true,
        write_allowed: false,
        bridge_required: true,
        credential_policy: 'no_credential_access_status_probe_only',
      },
      {
        id: 'paperclip_eco_task_dry_run',
        action: 'paperclip.eco_task_dry_run',
        execution_allowed: true,
        write_allowed: false,
        bridge_required: true,
        credential_policy: 'no_paperclip_credentials_used_internal_dry_run_only',
        external_write_allowed: false,
      },
      {
        id: 'n8n_workflow_list',
        action: 'n8n.workflow_list',
        execution_allowed: true,
        write_allowed: false,
        bridge_required: true,
        credential_policy: 'env_name_presence_only_no_secret_values',
        exact_blocker_if_missing_credentials: 'n8n_credentials_required_for_workflow_list',
        workflow_activation_enabled: false,
        workflow_execution_enabled: false,
        public_webhook_creation_enabled: false,
      },
      {
        id: 'buildwiki_run_now',
        action: 'buildwiki.run_now_dispatch',
        execution_allowed: true,
        write_allowed: false,
        bridge_required: true,
        credential_policy: 'no_credentials_required_hardcoded_opencloud_docs_farmer_service_only',
        exact_scope_session_required: 'buildwiki_run_now_dispatch',
        allowed_systemd_unit: 'opencloud-docs-farmer.service',
        smb_allowed: false,
        external_farmers_allowed: false,
        other_systemd_units_allowed: false,
      },
    ],
    blocked_adapters: [
      { id: 'provider_model_execution', exact_blocker: 'token_governor_not_proven' },
      { id: 'mcp_write_capable_probe', exact_blocker: 'mcp_write_capable_tool_not_discovered' },
      { id: 'paperclip_eco_task_write', exact_blocker: 'paperclip_external_write_disabled', bridge_policy_result: 'paperclip_writes_bridge_gated' },
      { id: 'obsidian_write', exact_blocker: 'obsidian_write_adapter_not_proven' },
      { id: 'mempalace_write', exact_blocker: 'mempalace_write_adapter_not_proven' },
      { id: 'delivery_connectors', exact_blocker: 'delivery_adapter_not_proven' },
    ],
    input_schema: {
      supported_adapters: ['mcp_readonly_status_probe', 'paperclip_eco_task_dry_run', 'n8n_workflow_list', 'buildwiki_run_now'],
      mcp_probe: {
        adapter_id: 'mcp_readonly_status_probe',
        action: 'mcp.status_probe',
        scope: { server_id: 'mcp-tools', operation: 'status_probe' },
        input: 'optional object; ignored by the read-only probe',
      },
      paperclip_eco_task_dry_run: {
        adapter_id: 'paperclip_eco_task_dry_run',
        action: 'paperclip.eco_task_dry_run',
        scope: { company: 'ECO', operation: 'task_dry_run' },
        input: { title: 'string', description: 'string', assignee: 'optional string', issue_key: 'optional string' },
      },
      n8n_workflow_list: {
        adapter_id: 'n8n_workflow_list',
        action: 'n8n.workflow_list',
        scope: { connector: 'n8n', operation: 'workflow_list_readiness' },
        input: 'optional object; does not activate workflows, execute workflows, create webhooks, or inject credentials',
      },
      buildwiki_run_now: {
        adapter_id: 'buildwiki_run_now',
        action: 'buildwiki.run_now_dispatch',
        scope: {
          connector: 'buildwiki',
          operation: 'dispatch',
          target: 'opencloud-docs-farmer.service',
          fork_scope: 'Fork 1 only',
        },
        required_bridge_session_scope: 'buildwiki_run_now_dispatch',
        disallowed: ['SMB', 'external farmers', 'other systemd units'],
      },
      idempotency_key: 'optional string',
      actor: 'optional string, defaults to agent-zero-jarvis',
    },
    rollback_path: {
      available: true,
      command: 'Revoke the Jarvis Bridge Session and remove the selected internal proof record; no external state was changed.',
    },
    next_action: 'POST this route with owner auth and an active Jarvis Bridge Session to execute only certified exact-scope adapters.',
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
    readOnlyConnector('AgentMail', 'READ_ONLY', 'mail', 'Primary mailbox is represented, but outbound sends remain Bridge-gated.'),
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
    state: 'READ_ONLY',
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
    { id: 'pi', status: 'read_only_dispatcher_owner_ui_ready', visible_to_gateway: true, visible_to_agent_zero: true, visible_to_PI: true, visible_to_agent_runtime: true, visible_to_runtime: true, read_allowed: true, write_allowed: false, can_open_ui: true, execution_allowed: false, bridge_required: false, normal_chat_bridge_required: false, dangerous_actions_require_scope: true, adapter_present: true, credential_policy: 'gateway_brokered_no_secret_values', health: 'read_only_dispatcher_owner_ui_ready', exact_blocker: 'protected_execution_requires_owner_scope', blocker: 'protected_execution_requires_owner_scope' },
    { id: 'hermes', status: 'foundation_ready_nuclear_dispatcher_control_plane', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, can_open_ui: false, execution_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'no_direct_secret_access_jarvis_brokered', blocker: 'jarvis_concurrence_required_for_major_changes' },
    { id: 'paperclip', status: 'direct_gateway_workforce_ready', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, can_open_ui: true, execution_allowed: false, bridge_required: true, normal_chat_bridge_required: false, dangerous_actions_require_scope: true, adapter_present: true, credential_policy: 'paperclip_auth_preserved_no_password_storage', blocker: 'paperclip_writes_exact_scope_required' },
    { id: 'spaceagent', status: 'research_agent_owner_ui_ready', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, can_open_ui: true, execution_allowed: false, bridge_required: false, normal_chat_bridge_required: false, dangerous_actions_require_scope: true, adapter_present: true, credential_policy: 'playwright_local_only_firecrawl_credential_gated', blocker: 'browser_actions_exact_scope_required' },
    { id: 'openclaw-plus', status: 'partial', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: false, can_open_ui: true, execution_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'owner_tunnel_only_no_public_exposure', blocker: 'openclaw_doctor_runtime_not_reachable' },
  ]

  return {
    ok: true,
    route: 'bridge.capability-matrix',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    agents,
    connectors: connectorReadiness().connectors,
    execution_readiness_matrix: executionReadinessMatrix(),
    pi_dispatcher: piStatus,
    pi_visibility_contract: piStatus.visibility_contract,
    ...SAFE_READ_ONLY,
    next_action: 'Use /gateway/tools for the owner UI wrapper. This API remains machine-readable and never executes protected actions.',
  }
}

function piVisibilityContract() {
  return [
    { id: 'provider_registry', label: 'Provider registry', endpoint: '/api/bridge/providers', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: false, bridge_required: false, adapter_present: true, credential_policy: 'names_only_no_secret_values', health: 'read_only' },
    { id: 'capability_matrix', label: 'Capability matrix', endpoint: '/api/bridge/capability-matrix', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: false, bridge_required: false, adapter_present: true, credential_policy: 'not_required_for_read_only_inventory', health: 'read_only' },
    { id: 'mcp_health', label: 'MCP health', endpoint: '/api/bridge/mcp-readiness', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: false, bridge_required: false, adapter_present: true, credential_policy: 'no_direct_secret_access', health: 'read_only_or_degraded' },
    { id: 'agent_roster', label: 'Agent roster', endpoint: '/api/agents', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: false, bridge_required: false, adapter_present: true, credential_policy: 'not_required_for_read_only_roster', health: 'read_only' },
    { id: 'bridge_readiness', label: 'Approval readiness', endpoint: '/api/bridge/approval-readiness', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: false, bridge_required: false, adapter_present: true, credential_policy: 'owner_approval_required_for_mutations', health: 'read_only' },
    { id: 'skills_tools_inventory', label: 'Skills/tools inventory', endpoint: '/api/skills', visible_to_gateway: true, visible_to_PI: true, visible_to_agent_runtime: true, execution_allowed: false, bridge_required: false, adapter_present: true, credential_policy: 'install_mutation_owner_gated', health: 'read_only' },
  ]
}

function piDispatcherStatus(): GatewayStatusPayload {
  const visibility = piVisibilityContract()
  return {
    ok: true,
    route: 'bridge.pi.status',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    agent_id: 'pi',
    label: 'PI Dispatcher',
    status: 'READ_ONLY DISPATCHER - OWNER UI READY',
    role: 'Gateway dispatcher / route optimizer',
    runtime_status: 'read_only_dispatcher_owner_ui_ready',
    runtime_blocker: 'protected_execution_requires_owner_scope',
    exact_blocker: 'protected_execution_requires_owner_scope',
    local_url: 'http://127.0.0.1:3337/gateway/agent-hub/pi/config',
    tailnet_url: 'http://100.116.35.95:3337/gateway/agent-hub/pi/config',
    mission_control_ui: '/gateway/agent-hub/pi/config',
    visibility_contract: visibility,
    inventory_summary: {
      visible_to_gateway: visibility.filter((item) => item.visible_to_gateway).length,
      visible_to_PI: visibility.filter((item) => item.visible_to_PI).length,
      visible_to_agent_runtime: visibility.filter((item) => item.visible_to_agent_runtime).length,
      execution_allowed: visibility.filter((item) => item.execution_allowed).length,
      bridge_required: visibility.filter((item) => item.bridge_required).length,
      adapter_present: visibility.filter((item) => item.adapter_present).length,
    },
    pi_dispatcher_contract: {
      normal_chat_bridge_required: false,
      gateway_tools_visible: true,
      skills_visible: true,
      mcp_visible: true,
      models_visible: true,
      gateway_runtime_visible: true,
      dangerous_actions_require_scope: true,
      exact_scope_execution_enabled: false,
      writes_enabled: false,
      protected_execution_enabled: false,
      approval_request_created: false,
      audit_record_written: false,
      credential_values_exposed: false,
      fake_success_allowed: false,
      go_claim_allowed: false,
      no_go_claim: true,
      rollback_command: 'remove Pi owner UI link and return to disabled UI copy',
    },
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    recommend_endpoint: '/api/bridge/pi/recommend',
    jarvis_handoff: {
      commander: 'Agent Zero (Jarvis)',
      protected_execution_route: '/api/bridge/agent-zero/status',
      protected_actions_require_exact_scope: true,
    },
    next_action: 'Open Pi through /gateway/agent-hub/pi/config. PI can inspect Gateway inventory and recommend routes; writes and protected actions remain disabled unless a separate exact-scope approval exists.',
  }
}

function piRecommendation(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.pi.recommend',
    mode: 'read_only_dispatcher_recommendation',
    recommendation: {
      selected_lane: 'pi',
      label: 'PI Dispatcher',
      state: 'READ_ONLY',
      readiness_endpoint: '/api/bridge/pi/status',
      execution_allowed: false,
      writes_enabled: false,
      protected_execution_enabled: false,
      bridge_required_for_protected_actions: true,
      next_action: 'Pi can recommend a lane. Agent Zero (Jarvis) and Bridge Session are required before protected execution.',
    },
    execution_readiness_summary: (executionReadinessMatrix().summary as GatewayStatusPayload),
    ...SAFE_READ_ONLY,
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
      label: 'Hermes',
      state: 'READ_ONLY',
      blocker_class: 'NONE',
      local_bind_address: '127.0.0.1',
      local_port: '3000',
      owner_access_blocker: 'jarvis_concurrence_required_for_major_changes',
      ...SAFE_READ_ONLY,
      ...SERVICE_CONTROL_BLOCKED,
      next_action: 'Use /api/bridge/hermes/* command-center routes for Hermes status, drafts, dispatch plans, and Jarvis concurrence requests.',
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
      owner_access_blocker: 'browser_actions_exact_scope_required; firecrawl_credential_required; firecrawl_backend_adapter_not_configured; youtube_transcript_connector_not_proven',
      ...SAFE_READ_ONLY,
      ...SERVICE_CONTROL_BLOCKED,
      mission_control_ui: '/gateway/agent-hub/spaceagent/config',
      local_url: 'http://127.0.0.1:3337/gateway/agent-hub/spaceagent/config',
      tailnet_url: 'http://100.116.35.95:3337/gateway/agent-hub/spaceagent/config',
      next_action: 'Open SpaceAgent through /gateway/agent-hub/spaceagent/config. Browser actions and crawls remain exact-scope guarded.',
    },
    {
      ok: true,
      route: 'bridge.dispatcher.status',
      agent_id: 'pi',
      label: 'PI Dispatcher',
      state: 'READ_ONLY',
      blocker_class: 'NONE',
      runtime_mode: 'read_only_dispatcher_owner_ui_ready',
      ...SAFE_READ_ONLY,
      ...SERVICE_CONTROL_BLOCKED,
      owner_access_blocker: 'protected_execution_requires_owner_scope',
      mission_control_ui: '/gateway/agent-hub/pi/config',
      local_url: 'http://127.0.0.1:3337/gateway/agent-hub/pi/config',
      tailnet_url: 'http://100.116.35.95:3337/gateway/agent-hub/pi/config',
      next_action: 'Open PI through /gateway/agent-hub/pi/config. PI can read and recommend; protected actions require separate exact-scope approval.',
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
      name: 'E copier Solutions',
      issue_prefix: 'ECO',
      access: 'owner_accessible',
      active_user_members: 3,
      agents: 2,
      issues: 6,
    },
    {
      name: 'To Knowledge Gateway',
      issue_prefix: 'TOK',
      access: 'legacy_membership_warning',
      active_user_members: 11,
      agents: 10,
      issues: 0,
      blocker: 'tok_owner_membership_not_repaired',
    },
  ]
  const items = resource === 'companies'
    ? companies
    : resource === 'agents'
      ? [
        { company: 'E copier Solutions', issue_prefix: 'ECO', count: 2, state: 'read_only_visible' },
        { company: 'To Knowledge Gateway', issue_prefix: 'TOK', count: 10, state: 'blocked_for_owner_until_membership_repair' },
      ]
      : resource === 'issues'
        ? [
          { company: 'E copier Solutions', issue_prefix: 'ECO', count: 6, state: 'read_only_visible' },
          { company: 'To Knowledge Gateway', issue_prefix: 'TOK', count: 0, state: 'blocked_for_owner_until_membership_repair' },
        ]
        : []
  const gatewayInventory = paperclipGatewayInventory().gateway_inventory as GatewayStatusPayload
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
    active_company: companies[0],
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
    gateway_inventory: {
      company_scope: gatewayInventory.company_scope,
      endpoint: '/api/bridge/paperclip/gateway-inventory',
      providers_visible: 5,
      models_visible: 5,
      skills_visible: 3,
      mcp_tools_visible: 3,
      integrations_visible: 6,
      zapier: gatewayInventory.zapier,
      bridge_policy: gatewayInventory.bridge_policy,
      paperclip_agent_context: gatewayInventory.paperclip_agent_context,
      credential_values_exposed: false,
      execution_enabled: false,
      writes_enabled: false,
    },
    gateway_inventory_endpoint: '/api/bridge/paperclip/gateway-inventory',
    items,
    company_data_enabled: true,
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    workspace_truth_endpoint: '/api/bridge/paperclip/workspace-truth',
    hard_coded_eco_only: false,
    next_action: 'Use /api/bridge/paperclip/workspace-truth and the AgentHub selector for live workspace launches. Keep all Paperclip writes Bridge-gated exact-scope adapter actions.',
  }
}

function paperclipGatewayInventory(): GatewayStatusPayload {
  const gatewayInventory = {
    company_scope: 'ECO',
    route: 'bridge.paperclip.gateway-inventory',
    providers: [
      { id: 'claude_cli', label: 'Claude CLI', status: 'read_only', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, credential_policy: 'local_adapter_no_secret_values_exposed', exact_blocker: 'provider_execution_requires_bridge_session' },
      { id: 'openrouter', label: 'OpenRouter', status: 'credential_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, credential_policy: 'openrouter_credential_required', exact_blocker: 'credential_required' },
      { id: 'ollama', label: 'Ollama', status: 'service_down', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, credential_policy: 'local_service_required_no_secret_values', exact_blocker: 'service_down' },
      { id: 'openai', label: 'OpenAI API', status: 'credential_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, credential_policy: 'openai_api_key_required_through_secret_path', exact_blocker: 'credential_required' },
      { id: 'nvidia', label: 'NVIDIA', status: 'credential_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, credential_policy: 'nvidia_credential_required_through_secret_path', exact_blocker: 'credential_required' },
    ],
    models: [
      { id: 'claude_cli_models', label: 'Claude CLI models', status: 'read_only', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'openrouter_models', label: 'OpenRouter models', status: 'credential_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'ollama_models', label: 'Ollama models', status: 'service_down', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'openai_models', label: 'OpenAI API models', status: 'credential_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'nvidia_models', label: 'NVIDIA models', status: 'credential_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
    ],
    skills: [
      { id: 'browser-use', label: 'Browser Use', status: 'read_only', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'watch-video', label: 'Watch Video', status: 'read_only', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'brain-sync', label: 'Brain Sync', status: 'bridge_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
    ],
    mcp_tools: [
      { id: 'mcp-tools', label: 'MCP Tools', status: 'read_only', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'zapier-mcp', label: 'Zapier MCP', status: 'configured', visible_to_paperclip: true, execution_allowed: true, write_allowed: false, bridge_required: true },
      { id: 'firecrawl-mcp', label: 'FireCrawl MCP', status: 'credential_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
    ],
    integrations: [
      { id: 'zapier', label: 'Zapier', status: 'configured', visible_to_paperclip: true, execution_allowed: true, write_allowed: false, bridge_required: true, exact_blocker: null, certified_action: 'zapier.connection_probe' },
      { id: 'n8n', label: 'n8n', status: 'credential_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, exact_blocker: 'credential_required' },
      { id: 'heygen', label: 'HeyGen through Zapier', status: 'bridge_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, exact_blocker: 'credential_required' },
      { id: 'telegram', label: 'Telegram', status: 'bridge_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, exact_blocker: 'bridge_session_required' },
      { id: 'agentmail', label: 'AgentMail', status: 'read_only', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, exact_blocker: 'bridge_session_required' },
      { id: 'google-drive', label: 'Google Drive', status: 'bridge_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, exact_blocker: 'bridge_session_required' },
      { id: 'onedrive', label: 'OneDrive', status: 'bridge_gated', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, exact_blocker: 'bridge_session_required' },
    ],
    agents: [
      { id: 'agent_zero_jarvis', label: 'Agent Zero (Jarvis)', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'pi_dispatcher', label: 'PI Dispatcher', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'hermes', label: 'Hermes', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'paperclip', label: 'Paperclip ECO', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'spaceagent', label: 'SpaceAgent', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
      { id: 'openclaw_plus', label: 'OpenClaw+', visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true },
    ],
    zapier: {
      visible: true,
      status: 'configured',
      execution_allowed: true,
      write_allowed: false,
      bridge_required: true,
      adapter_present: true,
      reason: 'Zapier is visible in Gateway and connected through the certified zapier.connection_probe adapter. Certified exact-scope Zapier actions are available; broad Zap creation, live social posting, and arbitrary Zapier execution require approved scope.',
      exact_blockers: [],
    },
    n8n: {
      visible: true,
      status: 'credential_gated',
      execution_allowed: false,
      write_allowed: false,
      bridge_required: true,
      adapter_present: false,
      reason: 'n8n is visible in Gateway but workflows are credential-gated and execution is Bridge-gated.',
      exact_blockers: ['credential_required', 'bridge_session_required', 'adapter_missing'],
    },
    bridge_policy: {
      read_visible: true,
      writes_bridge_gated: true,
      execution_requires_bridge_session: true,
      protected_action_result: 'WRITES_BRIDGE_GATED',
      approval_request_only_no_execution: true,
    },
    paperclip_agent_context: {
      company_scope: 'ECO',
      target_agents: ['CEO', 'CMO', 'CTO', 'Avatar Specialist', 'Field Service Advisor', 'Social Coordinator', 'Video Producer'],
      gateway_rule: 'Mission Control Gateway is the source of truth for models/tools/providers. If Zapier is visible with guardrails, say it is visible, connected/configured, and exact-scope approved rather than blocked or missing.',
      zapier_answer_template: 'Zapier is visible in Gateway and connected/configured. Certified exact-scope Zapier actions are available; broad Zap creation, live social posting, and arbitrary execution require approved scope.',
      n8n_answer_template: 'n8n is visible in Gateway but workflows are credential-gated and execution is Bridge-gated.',
      runtime_context_hook_status: 'ready_for_paperclip_runtime',
    },
    credential_values_exposed: false,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    protected_execution_enabled: false,
  }
  return {
    ok: true,
    route: 'bridge.paperclip.gateway-inventory',
    company_scope: 'ECO',
    gateway_inventory: gatewayInventory,
    ...SAFE_READ_ONLY,
    next_action: 'Expose this read-only Gateway inventory to Paperclip ECO agent context. Keep Zapier and Paperclip writes Bridge-gated.',
  }
}

function paperclipAgentContext(): GatewayStatusPayload {
  const inventory = paperclipGatewayInventory().gateway_inventory as GatewayStatusPayload
  const targetAgents = [
    'CEO',
    'CMO',
    'CTO',
    'Avatar Specialist',
    'Field Service Advisor',
    'Social Coordinator',
    'Video Producer',
  ]

  return {
    ok: true,
    route: 'bridge.paperclip.agent-context',
    company_scope: 'ECO',
    context_injection_status: 'ready_for_paperclip_runtime',
    target_agents: targetAgents,
    mission_control_gateway_inventory_summary: {
      company_scope: 'ECO',
      providers: inventory.providers,
      models: inventory.models,
      skills: inventory.skills,
      mcp_tools: inventory.mcp_tools,
      integrations: inventory.integrations,
      zapier: inventory.zapier,
      n8n: inventory.n8n,
      bridge_policy: inventory.bridge_policy,
      credential_gated: ['openrouter', 'openai', 'nvidia', 'n8n', 'firecrawl-mcp'],
      bridge_gated: ['brain-sync', 'heygen', 'telegram', 'google-drive', 'onedrive'],
    },
    context_markdown: [
      'Mission Control Gateway inventory for ECO is visible read-only.',
      'Gateway is the source of truth for providers, models, skills, MCP/NCP tools, integrations, Zapier status, n8n status, and Bridge policy.',
      `Target ECO Paperclip agents receiving this summary: ${targetAgents.join(', ')}.`,
      'Zapier is visible in Gateway and connected/configured. Certified exact-scope Zapier actions are available; broad Zap creation, live social posting, and arbitrary execution require approved scope.',
      'n8n is visible in Gateway but workflows are credential-gated and execution is Bridge-gated.',
      'If Zapier is visible with guardrails, report it as visible, connected/configured, and exact-scope approved rather than blocked or missing.',
      'Protected action result: WRITES_BRIDGE_GATED.',
    ].join('\n'),
    ceo_test_question: 'Do we have Zapier? Check the Gateway on Mission Control.',
    ceo_expected_answer: 'Zapier is visible in Gateway. Current status is connected/configured, and certified exact-scope Zapier actions are available through Jarvis. Paperclip can see the read-only Gateway inventory; broad Zap creation, live social posting, and arbitrary execution require approved scope.',
    zapier_answer_behavior: 'visible_configured_connection_probe_certified_write_gated',
    n8n_visibility_behavior: 'visible_credential_gated_bridge_gated',
    paperclip_writes_enabled: false,
    zapier_execution_enabled: false,
    n8n_execution_enabled: false,
    ...SAFE_READ_ONLY,
    next_action: 'Use this prompt context in Paperclip ECO agent runtime. Keep writes and connector execution Bridge-gated.',
  }
}

function paperclipTranscribeContract(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.paperclip.transcribe',
    mode: 'paperclip_voice_reply_transcription_proxy',
    bot_name: 'Paperclip Concierge',
    company_scope: 'ECO',
    agent_scope: 'CEO',
    auth_tier: 'viewer',
    accepts: 'multipart/form-data',
    required_fields: [
      'audio',
      'context_company_slug',
      'context_agent_id',
      'context_thread_id',
    ],
    max_duration_seconds: 60,
    max_audio_bytes: 25 * 1024 * 1024,
    secure_context_required: true,
    insecure_context_message: 'Microphone recording requires HTTPS or localhost tunnel.',
    transcript_behavior: 'transcript_inserted_for_owner_review',
    no_auto_send: true,
    output_mode: 'text_only',
    sticky_state: 'sqlite',
    errors: [
      'invalid_payload',
      'payload_too_large',
      'unsupported_media_type',
      'empty_transcript',
      'transcription_upstream_down',
      'transcription_disabled',
      'not_configured_for_v1',
    ],
    ...SAFE_READ_ONLY,
    next_action: 'Paperclip records audio in the browser, posts audio to Mission Control, inserts the returned transcript into the reply composer, and waits for owner review before Send.',
  }
}

function paperclipConciergeAnswerContract(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.paperclip.concierge.answer',
    mode: 'paperclip_concierge_text_only_read_only_answer',
    bot_name: 'Paperclip Concierge',
    company_scope: 'ECO',
    agent_scope: 'CEO',
    output_mode: 'text_only',
    input_schema: {
      company: 'ECO',
      agent: 'CEO',
      question: 'string',
      intent: 'optional read_only_question',
    },
    resolver_sources: [
      '/api/bridge/paperclip/companies',
      '/api/bridge/paperclip/agents',
    ],
    outside_v1_error: 'not_configured_for_v1',
    missing_company_error: '404 with available_companies',
    missing_agent_error: '404 with available_agents',
    wrote_anything: false,
    write_requests: 'WRITES_BRIDGE_GATED',
    no_paperclip_task_created: true,
    no_paperclip_comment_created: true,
    no_issue_modified: true,
    no_zapier_execution: true,
    sticky_state: 'sqlite',
    ...SAFE_READ_ONLY,
    next_action: 'Answer ECO CEO read-only questions from existing Mission Control/Paperclip bridge inventory. Reject write-shaped requests as WRITES_BRIDGE_GATED.',
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
      { name: 'Agent Zero (Jarvis)', status: 'operational_go_exact_scope_execution_certified', tailnet_url: 'http://100.116.35.95:50080/', mission_control_route: '/api/bridge/agent-zero/status', blocker: 'owner_hard_stops_only_remaining' },
      { name: 'Hermes', status: 'foundation_ready_nuclear_dispatcher_control_plane', local_url: null, mission_control_route: '/api/bridge/hermes/status', blocker: 'jarvis_concurrence_required_for_major_changes' },
      { name: 'PI Dispatcher', status: 'read_only_dispatcher_owner_ui_ready', local_url: 'http://127.0.0.1:3337/gateway/agent-hub/pi/config', tailnet_url: 'http://100.116.35.95:3337/gateway/agent-hub/pi/config', mission_control_route: '/api/bridge/pi/status', mission_control_ui: '/gateway/agent-hub/pi/config', blocker: 'protected_execution_requires_owner_scope' },
      { name: 'SpaceAgent', status: 'research_agent_owner_ui_ready', local_url: 'http://127.0.0.1:3337/gateway/agent-hub/spaceagent/config', tailnet_url: 'http://100.116.35.95:3337/gateway/agent-hub/spaceagent/config', mission_control_route: '/api/bridge/space-agent/status', mission_control_ui: '/gateway/agent-hub/spaceagent/config', blocker: 'browser_actions_exact_scope_required; firecrawl_credential_required; firecrawl_backend_adapter_not_configured; youtube_transcript_connector_not_proven' },
      { name: 'Paperclip', status: 'direct_gateway_workforce_ready_writes_exact_scope_guarded', local_url: 'http://127.0.0.1:3337/gateway/agent-hub/paperclip/ui', tailnet_url: 'http://100.116.35.95:3100/ECO/dashboard', mission_control_route: '/api/bridge/paperclip/workspace-truth', mission_control_ui: '/gateway/agent-hub/paperclip/ui', blocker: 'paperclip_writes_exact_scope_required' },
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
      { name: 'Agent Brain visibility', state: 'READ_ONLY', agents: ['Agent Zero', 'Hermes', 'Pi', 'SpaceAgent', 'Paperclip', 'OpenClaw+'], writes_enabled: false },
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
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    mailbox: 'ops@to-knowledge',
    send_enabled: false,
    draft_enabled: true,
    ...SAFE_READ_ONLY,
    next_action: 'AgentMail can be inspected. Sending remains disabled without Bridge approval.',
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
    case 'bridge/agent-zero/status':
      return agentZeroBridgeStatus()
    case 'bridge/agent-zero/ecosystem':
      return agentZeroEcosystem()
    case 'bridge/agent-zero/agent-roster':
      return agentZeroAgentRoster()
    case 'bridge/agent-zero/reports':
      return agentZeroReports()
    case 'bridge/agent-zero/authority':
      return jarvisAuthority()
    case 'bridge/agent-zero/bridge-session':
      return jarvisBridgeSession()
    case 'bridge/agent-zero/bridge-session/audit':
      return jarvisBridgeAudit()
    case 'bridge/agent-zero/bridge-session/revoke':
      return jarvisBridgeRevoke()
    case 'bridge/agent-zero/internal-write':
      return jarvisInternalWrite()
    case 'bridge/agent-zero/workflows':
      return jarvisWorkflows()
    case 'bridge/agent-zero/certification':
      return jarvisCertification()
    case 'bridge/agent-zero/protected-action-certification':
      return jarvisProtectedActionCertification()
    case 'bridge/agent-zero/exact-scope-adapter-expansion':
      return jarvisExactScopeAdapterExpansion()
    case 'bridge/agent-zero/execute':
      return jarvisExecutionRouter()
    case 'hermes/status':
      return (runtimeServices().services as GatewayStatusPayload[])[2]
    case 'paperclip/status':
      return {
        ...paperclipBridge('status'),
        route: 'paperclip.status',
        agent_id: 'paperclip',
        label: 'Paperclip',
      }
    case 'bridge/paperclip/status':
    case 'bridge/paperclip/companies':
    case 'bridge/paperclip/agents':
    case 'bridge/paperclip/issues':
      return paperclipBridge(key.split('/').at(-1) || 'status')
    case 'bridge/paperclip/gateway-inventory':
      return paperclipGatewayInventory()
    case 'bridge/paperclip/agent-context':
      return paperclipAgentContext()
    case 'bridge/paperclip/transcribe':
      return paperclipTranscribeContract()
    case 'bridge/paperclip/concierge/answer':
      return paperclipConciergeAnswerContract()
    case 'spaceagent/status':
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
    case 'bridge/pi/recommend':
      return piRecommendation()
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
          { id: 'pi', state: 'READ_ONLY_DISPATCHER_OWNER_UI_READY', execution_allowed: false, bridge_required: false, normal_chat_bridge_required: false, blocker: 'protected_execution_requires_owner_scope' },
          { id: 'paperclip', state: 'DIRECT_GATEWAY_WORKFORCE_READY', execution_allowed: false, bridge_required: true, normal_chat_bridge_required: false, blocker: 'paperclip_writes_exact_scope_required' },
          { id: 'agent-zero', state: 'OPERATIONAL_GO', execution_allowed: true, bridge_required: false, normal_chat_bridge_required: false, blocker: 'owner_hard_stops_only_remaining' },
          { id: 'hermes', state: 'DISPATCH_PLAN_READY', execution_allowed: false, bridge_required: false, normal_chat_bridge_required: false, blocker: 'jarvis_concurrence_required_for_major_changes' },
          { id: 'spaceagent', state: 'RESEARCH_AGENT_OWNER_UI_READY', execution_allowed: false, bridge_required: false, normal_chat_bridge_required: false, blocker: 'browser_actions_exact_scope_required' },
        ],
      }
    case 'bridge/runtime-services':
      return runtimeServices()
    case 'bridge/preflight':
      return preflight()
    case 'bridge/brain-readiness':
      return brainReadiness()
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
