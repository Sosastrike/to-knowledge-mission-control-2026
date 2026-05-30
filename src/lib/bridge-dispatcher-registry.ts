export type DispatcherState = 'READY' | 'READ_ONLY' | 'OWNER_GATED' | 'CREDENTIAL_GATED' | 'SERVICE_DOWN' | 'BLOCKED'

export type DispatcherLane = {
  id: string
  label: string
  role: string
  state: DispatcherState
  blocker_class: 'NONE' | DispatcherState
  current_surface_blocker_class: 'NONE' | DispatcherState
  promotion_blocker_class: 'NONE' | 'OWNER_GATED' | 'CREDENTIAL_GATED' | 'SERVICE_DOWN' | 'BLOCKED'
  promotion_blocked: boolean
  promotion_requirements_complete: boolean
  no_go_claim: boolean
  go_claim_allowed: boolean
  execution_enabled: boolean
  writes_enabled: boolean
  protected_execution_enabled: boolean
  approval_request_created: false
  audit_record_written: false
  credential_values_exposed: false
  fake_success_allowed: false
  token_governor_required: boolean
  readiness_endpoint: string
  read_probe_endpoint: string
  owner_action_type: 'credential' | 'service_install' | 'owner_approval' | 'runtime_proof' | 'jarvis_delegation'
  audit_state: 'READY' | 'OWNER_GATED'
  rollback_state: 'READY' | 'OWNER_GATED'
  rollback_command: string
  route_mode: 'advisory' | 'read_only' | 'bridge_required' | 'credential_required' | 'service_required' | 'jarvis_concurrence_required' | 'jarvis_delegated'
  approval_required: boolean
  audit_required: boolean
  next_action: string
}

export const PI_FULL_ACCESS_CONTRACT = {
  id: 'pi',
  label: 'Pi',
  role: 'Full Access Gateway Agent',
  status: 'FULL ACCESS / DIRECT GATEWAY PIPELINE',
  no_write_route_selection: false,
  execution_enabled: true,
  writes_enabled: true,
  protected_execution_enabled: true,
  approval_request_created: false,
  audit_record_written: false,
  fake_success_allowed: false,
  promotion_blocker_class: 'OWNER_GATED',
  promotion_blocked: false,
  promotion_requirements_complete: true,
  no_go_claim: false,
  go_claim_allowed: true,
  readiness_endpoint: '/api/bridge/dispatcher/status',
  read_probe_endpoint: '/api/bridge/dispatcher/status',
  pi_status_endpoint: '/api/bridge/pi/status',
  capability_matrix_endpoint: '/api/bridge/capability-matrix',
  provider_registry_endpoint: '/api/bridge/providers',
  mcp_health_endpoint: '/api/bridge/mcp-readiness',
  agent_roster_endpoint: '/api/agents',
  bridge_readiness_endpoint: '/api/bridge/approval-readiness',
  skills_inventory_endpoint: '/api/skills',
  owner_action_type: 'owner_approval',
  audit_state: 'READY',
  rollback_state: 'READY',
  rollback_command: 'revert Pi to Gateway-brokered read-only mode and restart mission-control.service',
  credential_values_exposed: false,
  exact_blocker: 'production_execution_requires_jarvis_concurrence',
  next_action: 'Pi has direct Gateway pipeline access to tools, skills, MCPs, providers, Brain reads, visible task events, and pipeline requests; production-impacting execution stays Jarvis-gated.',
} as const

export const PI_ADVISORY_CONTRACT = PI_FULL_ACCESS_CONTRACT

export const PAPERCLIP_CONCIERGE_CONTRACT = {
  role: 'paperclip read-only concierge q&a',
  execution_enabled: false,
  writes_enabled: false,
  protected_execution_enabled: false,
  approval_request_created: false,
  audit_record_written: false,
  credential_values_exposed: false,
  fake_success_allowed: false,
  v1_whitelist: [{ company: 'eco', agent: 'ceo' }],
  write_verb_rejection: true,
  no_external_connector_execution: true,
} as const

export const PAPERCLIP_TRANSCRIBE_CONTRACT = {
  role: 'paperclip voice reply transcription proxy',
  execution_enabled: false,
  writes_enabled: false,
  protected_execution_enabled: false,
  approval_request_created: false,
  audit_record_written: false,
  credential_values_exposed: false,
  fake_success_allowed: false,
  audio_max_bytes: 10 * 1024 * 1024,
  no_persistence: true,
  no_secrets_exposed: true,
} as const

export const PI_VISIBILITY_CONTRACT = [
  {
    id: 'provider_registry',
    label: 'Provider registry',
    endpoint: '/api/bridge/providers',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: true,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'gateway_brokered_names_only_no_secret_values',
    health: 'full_access',
  },
  {
    id: 'capability_matrix',
    label: 'Capability matrix',
    endpoint: '/api/bridge/capability-matrix',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: true,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'not_required_for_read_only_inventory',
    health: 'full_access',
  },
  {
    id: 'mcp_health',
    label: 'MCP health',
    endpoint: '/api/bridge/mcp-readiness',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: true,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'no_direct_secret_access',
    health: 'full_access_or_degraded',
  },
  {
    id: 'agent_roster',
    label: 'Agent roster',
    endpoint: '/api/agents',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: true,
    bridge_required: false,
    adapter_present: true,
    credential_policy: 'not_required_for_read_only_roster',
    health: 'full_access',
  },
  {
    id: 'bridge_readiness',
    label: 'Bridge readiness',
    endpoint: '/api/bridge/approval-readiness',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: true,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'owner_approval_required_for_mutations',
    health: 'full_access',
  },
  {
    id: 'skills_tools_inventory',
    label: 'Skills/tools inventory',
    endpoint: '/api/skills',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: true,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'install_mutation_owner_gated',
    health: 'full_access',
  },
] as const

export function buildPiDispatcherStatus() {
  return {
    route: 'bridge.pi.status',
    mode: 'pi_full_access_gateway_status',
    agent_id: 'pi',
    label: 'Pi',
    status: PI_ADVISORY_CONTRACT.status,
    role: PI_ADVISORY_CONTRACT.role,
    runtime_status: 'direct_gateway_pipeline_registered',
    runtime_blocker: PI_ADVISORY_CONTRACT.exact_blocker,
    exact_blocker: PI_ADVISORY_CONTRACT.exact_blocker,
    pi_advisory_contract: PI_ADVISORY_CONTRACT,
    visibility_contract: PI_VISIBILITY_CONTRACT,
    inventory_summary: {
      visible_to_gateway: PI_VISIBILITY_CONTRACT.filter((item) => item.visible_to_gateway).length,
      visible_to_PI: PI_VISIBILITY_CONTRACT.filter((item) => item.visible_to_PI).length,
      visible_to_agent_runtime: PI_VISIBILITY_CONTRACT.filter((item) => item.visible_to_agent_runtime).length,
      execution_allowed: PI_VISIBILITY_CONTRACT.filter((item) => item.execution_allowed).length,
      bridge_required: PI_VISIBILITY_CONTRACT.filter((item) => item.bridge_required).length,
      adapter_present: PI_VISIBILITY_CONTRACT.filter((item) => item.adapter_present).length,
    },
    tool_model_api_states: PI_VISIBILITY_CONTRACT.map((item) => ({
      id: item.id,
      label: item.label,
      endpoint: item.endpoint,
      visible_to_gateway: item.visible_to_gateway,
      visible_to_PI: item.visible_to_PI,
      visible_to_agent_runtime: item.visible_to_agent_runtime,
      execution_allowed: item.execution_allowed,
      bridge_required: item.bridge_required,
      adapter_present: item.adapter_present,
      credential_policy: item.credential_policy,
      health: item.health,
    })),
    execution_enabled: true,
    writes_enabled: true,
    protected_execution_enabled: true,
    external_writes_enabled: false,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    fake_success_allowed: false,
    go_claim_allowed: true,
    no_go_claim: false,
    next_action: PI_ADVISORY_CONTRACT.next_action,
    rollback_command: PI_ADVISORY_CONTRACT.rollback_command,
  }
}

export const DISPATCHER_LANES: DispatcherLane[] = [
  {
    id: 'agent_zero',
    label: 'Agent Zero (Jarvis)',
    role: 'commander/supervisor and protected-action reviewer',
    state: 'CREDENTIAL_GATED',
    blocker_class: 'CREDENTIAL_GATED',
    current_surface_blocker_class: 'CREDENTIAL_GATED',
    promotion_blocker_class: 'CREDENTIAL_GATED',
    promotion_blocked: true,
    promotion_requirements_complete: false,
    no_go_claim: true,
    go_claim_allowed: false,
    execution_enabled: false,
    writes_enabled: false,
    protected_execution_enabled: false,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    fake_success_allowed: false,
    token_governor_required: true,
    readiness_endpoint: '/api/bridge/agent-zero/status',
    read_probe_endpoint: '/api/bridge/agent-zero/status',
    owner_action_type: 'credential',
    audit_state: 'OWNER_GATED',
    rollback_state: 'OWNER_GATED',
    rollback_command: 'disable protected Agent Zero request runner; keep /api/agent-zero/request OWNER_GATED',
    route_mode: 'credential_required',
    approval_required: true,
    audit_required: true,
    next_action: 'Use Jarvis read-only ecosystem context now; provide approved credentials and Bridge Session before protected execution.',
  },
  {
    id: 'hermes',
    label: 'Ron Weasley',
    role: 'nuclear dispatcher / optimization and workflow architect',
    state: 'READY',
    blocker_class: 'NONE',
    current_surface_blocker_class: 'NONE',
    promotion_blocker_class: 'NONE',
    promotion_blocked: false,
    promotion_requirements_complete: true,
    no_go_claim: false,
    go_claim_allowed: true,
    execution_enabled: true,
    writes_enabled: true,
    protected_execution_enabled: true,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    fake_success_allowed: false,
    token_governor_required: true,
    readiness_endpoint: '/api/bridge/hermes/full-access/status',
    read_probe_endpoint: '/api/bridge/hermes/system-command-registry',
    owner_action_type: 'jarvis_delegation',
    audit_state: 'READY',
    rollback_state: 'READY',
    rollback_command: 'archive the exact Ron Weasley delegation packet; keep /api/bridge/hermes/execute gated by Jarvis delegation',
    route_mode: 'jarvis_delegated',
    approval_required: true,
    audit_required: true,
    next_action: 'Use Ron Weasley direct-line parity for full ecosystem visibility and certified exact-scope execution only when Jarvis signs the delegation packet.',
  },
  {
    id: 'pi',
    label: 'Pi',
    role: 'Full Access Gateway Agent',
    state: 'READY',
    blocker_class: 'NONE',
    current_surface_blocker_class: 'NONE',
    promotion_blocker_class: 'OWNER_GATED',
    promotion_blocked: false,
    promotion_requirements_complete: true,
    no_go_claim: false,
    go_claim_allowed: true,
    execution_enabled: true,
    writes_enabled: true,
    protected_execution_enabled: true,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    fake_success_allowed: false,
    token_governor_required: false,
    readiness_endpoint: '/api/bridge/dispatcher/status',
    read_probe_endpoint: '/api/bridge/dispatcher/status',
    owner_action_type: 'owner_approval',
    audit_state: 'READY',
    rollback_state: 'READY',
    rollback_command: 'revert Pi to Gateway-brokered read-only mode and restart mission-control.service',
    route_mode: 'jarvis_concurrence_required',
    approval_required: true,
    audit_required: true,
    next_action: 'Pi has direct Gateway pipeline access to tools, skills, MCPs, providers, Brain reads, visible task events, and pipeline requests. Production-impacting execution remains Jarvis-gated.',
  },
  {
    id: 'paperclip',
    label: 'Paperclip',
    role: 'sandbox workforce/control-plane lane',
    state: 'SERVICE_DOWN',
    blocker_class: 'SERVICE_DOWN',
    current_surface_blocker_class: 'SERVICE_DOWN',
    promotion_blocker_class: 'SERVICE_DOWN',
    promotion_blocked: true,
    promotion_requirements_complete: false,
    no_go_claim: true,
    go_claim_allowed: false,
    execution_enabled: false,
    writes_enabled: false,
    protected_execution_enabled: false,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    fake_success_allowed: false,
    token_governor_required: true,
    readiness_endpoint: '/api/paperclip/status',
    read_probe_endpoint: '/api/paperclip/status',
    owner_action_type: 'service_install',
    audit_state: 'OWNER_GATED',
    rollback_state: 'OWNER_GATED',
    rollback_command: 'disable Paperclip protected runner; keep sandbox status read-only',
    route_mode: 'service_required',
    approval_required: true,
    audit_required: true,
    next_action: 'Resolve sandbox runtime before Workforce Control Plane protected actions.',
  },
  {
    id: 'openclaw_plus',
    label: 'OpenClaw+',
    role: 'runtime/doctor and protected execution lane',
    state: 'SERVICE_DOWN',
    blocker_class: 'SERVICE_DOWN',
    current_surface_blocker_class: 'SERVICE_DOWN',
    promotion_blocker_class: 'SERVICE_DOWN',
    promotion_blocked: true,
    promotion_requirements_complete: false,
    no_go_claim: true,
    go_claim_allowed: false,
    execution_enabled: false,
    writes_enabled: false,
    protected_execution_enabled: false,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    fake_success_allowed: false,
    token_governor_required: true,
    readiness_endpoint: '/api/openclaw-plus/status',
    read_probe_endpoint: '/api/openclaw-plus/status',
    owner_action_type: 'runtime_proof',
    audit_state: 'OWNER_GATED',
    rollback_state: 'OWNER_GATED',
    rollback_command: 'disable OpenClaw+ protected runner; keep doctor/runtime route read-only',
    route_mode: 'service_required',
    approval_required: true,
    audit_required: true,
    next_action: 'Resolve OpenClaw+ doctor/runtime path; protected execution remains Bridge-gated.',
  },
  {
    id: 'spaceagent',
    label: 'SpaceAgent',
    role: 'browser evidence and connector-read lane',
    state: 'SERVICE_DOWN',
    blocker_class: 'SERVICE_DOWN',
    current_surface_blocker_class: 'SERVICE_DOWN',
    promotion_blocker_class: 'SERVICE_DOWN',
    promotion_blocked: true,
    promotion_requirements_complete: false,
    no_go_claim: true,
    go_claim_allowed: false,
    execution_enabled: false,
    writes_enabled: false,
    protected_execution_enabled: false,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    fake_success_allowed: false,
    token_governor_required: true,
    readiness_endpoint: '/api/bridge/space-agent/status',
    read_probe_endpoint: '/api/bridge/space-agent/status',
    owner_action_type: 'runtime_proof',
    audit_state: 'OWNER_GATED',
    rollback_state: 'OWNER_GATED',
    rollback_command: 'disable SpaceAgent protected runner; keep browser evidence route read-only',
    route_mode: 'service_required',
    approval_required: true,
    audit_required: true,
    next_action: 'Resolve Playwright MCP service before browser evidence packets or protected actions.',
  },
]

export function recommendDispatcherRoute(taskType: string | undefined, target: string | undefined) {
  const normalizedTask = String(taskType || '').toLowerCase()
  const normalizedTarget = String(target || '').toLowerCase()
  if (normalizedTarget.includes('pi') || normalizedTask.includes('recommend')) {
    return DISPATCHER_LANES.find((lane) => lane.id === 'pi') || DISPATCHER_LANES[2]
  }
  if (normalizedTarget.includes('agent') || normalizedTarget.includes('zero')) {
    return DISPATCHER_LANES.find((lane) => lane.id === 'agent_zero') || DISPATCHER_LANES[0]
  }
  if (normalizedTarget.includes('hermes')) {
    return DISPATCHER_LANES.find((lane) => lane.id === 'hermes') || DISPATCHER_LANES[1]
  }
  if (normalizedTarget.includes('paperclip')) {
    return DISPATCHER_LANES.find((lane) => lane.id === 'paperclip') || DISPATCHER_LANES[3]
  }
  if (normalizedTarget.includes('openclaw')) {
    return DISPATCHER_LANES.find((lane) => lane.id === 'openclaw_plus') || DISPATCHER_LANES[4]
  }
  if (normalizedTarget.includes('spaceagent') || normalizedTask.includes('browser')) {
    return DISPATCHER_LANES.find((lane) => lane.id === 'spaceagent') || DISPATCHER_LANES[5]
  }
  return DISPATCHER_LANES.find((lane) => lane.id === 'pi') || DISPATCHER_LANES[2]
}

export function buildRouteSelectionProof() {
  const samples = [
    { task_type: 'recommend', target: 'pi' },
    { task_type: 'browser evidence', target: 'spaceagent' },
    { task_type: 'protected action', target: 'agent zero' },
    { task_type: 'runtime status', target: 'hermes' },
  ]

  return {
    proof_level: 'deterministic_read_only_recommendation',
    no_write_route_selection: true,
    no_go_claim: true,
    execution_enabled: false,
    writes_enabled: false,
    protected_execution_enabled: false,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    fake_success_allowed: false,
    sample_recommendations: samples.map((sample) => {
      const lane = recommendDispatcherRoute(sample.task_type, sample.target)
      return {
        ...sample,
        selected_lane: lane.id,
        state: lane.state,
        current_surface_state: lane.state,
        blocker_class: lane.blocker_class,
        current_surface_blocker_class: lane.current_surface_blocker_class,
        promotion_blocker_class: lane.promotion_blocker_class,
        promotion_blocked: lane.promotion_blocked,
        promotion_requirements_complete: lane.promotion_requirements_complete,
        no_go_claim: lane.no_go_claim,
        go_claim_allowed: lane.go_claim_allowed,
        execution_enabled: lane.execution_enabled,
        writes_enabled: lane.writes_enabled,
        protected_execution_enabled: lane.protected_execution_enabled,
        approval_request_created: lane.approval_request_created,
        audit_record_written: lane.audit_record_written,
        credential_values_exposed: lane.credential_values_exposed,
        token_governor_required: lane.token_governor_required,
        fake_success_allowed: lane.fake_success_allowed,
        readiness_endpoint: lane.readiness_endpoint,
        read_probe_endpoint: lane.read_probe_endpoint,
        owner_action_type: lane.owner_action_type,
        audit_state: lane.audit_state,
        rollback_state: lane.rollback_state,
        rollback_command: lane.rollback_command,
        route_mode: lane.route_mode,
        approval_required: lane.approval_required,
        audit_required: lane.audit_required,
        next_action: lane.next_action,
      }
    }),
  }
}
