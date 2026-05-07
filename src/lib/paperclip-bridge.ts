import { networkInterfaces } from 'node:os'

import {
  createSpaceAgentResearchCompletion,
  type SpaceAgentResearchCompletion,
  type SpaceAgentResponsibleAgent,
} from './space-agent-research'

export type PaperclipBridgeStatus = 'connected' | 'degraded' | 'blocked'

export type PaperclipSafeStatusPayload = {
  ok: true
  mode: 'paperclip_status_read_only'
  generated_at: string
  health: PaperclipBridgeStatus
  reachable: boolean
  configured: boolean
  endpoint: string
  ui_link: string | null
  workforce_summary: {
    company_count: number | null
    active_agents: number | null
    active_issues: number | null
    budget_status: string
    heartbeat_status: string
  }
  role: 'workforce_company_task_orchestration_layer'
  authority: 'subordinate_to_gateway_and_agent_zero'
  status_endpoint: '/api/bridge/paperclip/status'
  companies_endpoint: '/api/bridge/paperclip/companies'
  agents_endpoint: '/api/bridge/paperclip/agents'
  issues_endpoint: '/api/bridge/paperclip/issues'
  test_task_endpoint: '/api/bridge/paperclip/test-chat'
  proposals_endpoint: '/api/bridge/paperclip/proposals'
  dispatcher_recommendations_endpoint: '/api/bridge/paperclip/dispatcher-recommendations'
  research_tasks_endpoint: '/api/bridge/paperclip/research-tasks'
  service: {
    local_only: boolean
    tailnet_only: boolean
    public_exposure: false
    persistent_service_enabled: false
    sandbox_expected: boolean
  }
  upstream: {
    health_status: string | null
    version: string | null
    deployment_mode: string | null
    deployment_exposure: string | null
    auth_ready: boolean | null
  }
  bridge_session: {
    required_for_mutations: true
    external_writes_enabled: false
  }
  blocker: string | null
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipInventoryPayload<T> = {
  ok: boolean
  mode: 'paperclip_companies_read_only' | 'paperclip_agents_read_only' | 'paperclip_issues_read_only'
  generated_at: string
  paperclip_reachable: boolean
  company_selector?: string | null
  items: T[]
  count: number
  blocker: string | null
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipCompanySummary = {
  id: string
  name: string
  issue_prefix: string | null
  status: string | null
  budget_monthly_cents: number | null
  spent_monthly_cents: number | null
  require_board_approval_for_new_agents: boolean | null
  created_at: string | null
  updated_at: string | null
}

export type PaperclipAgentSummary = {
  id: string
  name: string
  role: string | null
  title: string | null
  status: string | null
  company_id: string | null
  reports_to: string | null
  capabilities: string[]
  budget_monthly_cents: number | null
  spent_monthly_cents: number | null
  last_heartbeat_at: string | null
  gateway_role: string | null
  owner_visible_status: string | null
  bridge_session_required_for_execution: boolean | null
}

export type PaperclipIssueSummary = {
  id: string
  identifier: string | null
  title: string
  status: string | null
  priority: string | null
  company_id: string | null
  assignee_agent: string | null
  created_at: string | null
  updated_at: string | null
}

export type PaperclipTestTaskPayload = {
  ok: false
  mode: 'paperclip_read_only_test_task'
  generated_at: string
  prompt: string
  response_text: string
  paperclip_called: false
  paperclip_reachable: boolean
  blocker: 'paperclip_safe_test_task_adapter_not_configured'
  status_endpoint: '/api/bridge/paperclip/status'
  test_task_endpoint: '/api/bridge/paperclip/test-chat'
  proposals_endpoint: '/api/bridge/paperclip/proposals'
  research_tasks_endpoint: '/api/bridge/paperclip/research-tasks'
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
  next_action: string
}

export type PaperclipTaskAssignee = 'hermes' | 'space_agent' | 'pi_review' | 'mini_agent'
export type PaperclipTaskPolicyResult = 'requires_session' | 'blocked' | 'missing_credential'

export const PAPERCLIP_COWORKER_LIFECYCLE_STATES = [
  'proposed',
  'awaiting_approval',
  'approved',
  'running',
  'blocked',
  'completed',
  'failed',
  'expired',
  'archived',
  'reviewed_by_agent_zero',
] as const

export type PaperclipCoWorkerLifecycleState = (typeof PAPERCLIP_COWORKER_LIFECYCLE_STATES)[number]

export type PaperclipCoWorkerSupervisor = 'agent_zero' | 'hermes' | 'pi' | 'space_agent'

export type PaperclipCoWorkerAgentBudget = {
  mode: 'advisory_budget_only'
  currency: 'USD'
  max_cents: number
  spent_cents: 0
  spending_authority: false
  budget_enforced_by: 'gateway_policy_and_paperclip_tracking'
}

export type PaperclipCoWorkerAgentAuditEvent = {
  event: string
  actor: string
  target: string
  summary: string
  recorded_at: string
  external_write: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipCoWorkerAgentDefinition = {
  schema: 'paperclip_coworker_agent_v1'
  mode: 'paperclip_coworker_definition_dry_run'
  id: string
  name: string
  supervisor: PaperclipCoWorkerSupervisor
  command_authority: 'agent_zero'
  purpose: string
  task_scope: string[]
  budget: PaperclipCoWorkerAgentBudget
  memory_ttl_minutes: number
  created_at: string
  expires_at: string
  allowed_tools: string[]
  forbidden_tools: string[]
  expiration_condition: string
  audit_trail_required: true
  audit_trail: PaperclipCoWorkerAgentAuditEvent[]
  lifecycle: PaperclipCoWorkerLifecycleState
  bridge_session_required_for_activation: true
  read_enabled: true
  write_enabled: false
  execution_enabled: false
  external_writes_enabled: false
  direct_secret_access_allowed: false
  raw_root_shell_allowed: false
  docker_socket_allowed: false
  can_self_promote: false
  can_create_child_agents: false
  no_secrets_exposed: true
  raw_paths_exposed: false
  blocked_reason: string | null
}

export type PaperclipCoWorkerAgentInput = {
  id?: string | null
  name?: string | null
  supervisor?: string | null
  purpose?: string | null
  taskScope?: string[] | null
  budgetMaxCents?: number | null
  memoryTtlMinutes?: number | null
  allowedTools?: string[] | null
  forbiddenTools?: string[] | null
  expirationCondition?: string | null
  generatedAt: string
}

export type PaperclipCoWorkerAgentDefinitionResult = {
  ok: boolean
  mode: 'paperclip_coworker_definition_dry_run'
  definition: PaperclipCoWorkerAgentDefinition | null
  policy_result: PaperclipTaskPolicyResult
  blocked_reason: string | null
  response_text: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipCoWorkerLifecycleTransitionInput = {
  definition: PaperclipCoWorkerAgentDefinition
  lifecycle: string
  actor?: string | null
  summary?: string | null
  recordedAt: string
}

export type PaperclipCoWorkerLifecycleTransitionResult = {
  ok: boolean
  mode: 'paperclip_coworker_lifecycle_transition_dry_run'
  definition: PaperclipCoWorkerAgentDefinition | null
  previous_lifecycle: PaperclipCoWorkerLifecycleState | null
  requested_lifecycle: string
  lifecycle: PaperclipCoWorkerLifecycleState | null
  lifecycle_order: PaperclipCoWorkerLifecycleState[]
  reviewed_by_agent_zero: boolean
  policy_result: PaperclipTaskPolicyResult
  blocked_reason: string | null
  response_text: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export const PAPERCLIP_COWORKER_ROUTE_DECISIONS = ['allowed', 'blocked', 'requires_session', 'missing_credential'] as const

export type PaperclipCoWorkerRouteDecision = (typeof PAPERCLIP_COWORKER_ROUTE_DECISIONS)[number]
export type PaperclipCoWorkerRequestAction = 'read' | 'write' | 'execute'
export type PaperclipCoWorkerCredentialMode = 'none_required' | 'configured' | 'missing'

export type PaperclipCoWorkerPolicyCheckName =
  | 'request_type'
  | 'credential_mode'
  | 'bridge_session'
  | 'owner_approval'
  | 'mini_agent_scope'
  | 'forbidden_tools'
  | 'memory_policy'
  | 'audit_requirement'
  | 'output_contract'

export type PaperclipCoWorkerPolicyCheck = {
  check: PaperclipCoWorkerPolicyCheckName
  passed: boolean
  decision: PaperclipCoWorkerRouteDecision
  blocked_reason: string | null
}

export type PaperclipCoWorkerPolicyValidationInput = {
  definition: PaperclipCoWorkerAgentDefinition
  requestedAction: string
  credentialMode?: string | null
  bridgeSessionActive?: boolean | null
  ownerApproved?: boolean | null
  requestedScope?: string[] | null
  requestedTools?: string[] | null
  memoryTtlMinutes?: number | null
  auditRequired?: boolean | null
  outputContract?: string | null
  recordedAt: string
}

export type PaperclipCoWorkerPolicyValidationResult = {
  ok: boolean
  mode: 'paperclip_coworker_gateway_policy_decision'
  definition_id: string
  requested_action: PaperclipCoWorkerRequestAction | null
  credential_mode: PaperclipCoWorkerCredentialMode
  route_decision: PaperclipCoWorkerRouteDecision
  checks: PaperclipCoWorkerPolicyCheck[]
  blocked_reason: string | null
  bridge_session_required: boolean
  owner_approval_required: boolean
  audit_event: PaperclipCoWorkerAgentAuditEvent
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipHermesProposalKind =
  | 'workflow_task_template'
  | 'mini_agent_spec'
  | 'paperclip_routine'
  | 'skill_proposal_document'

export type PaperclipHermesProposalPayload = {
  ok: false
  mode: 'paperclip_hermes_proposal_handoff'
  generated_at: string
  proposal_id: string
  requester: 'hermes'
  selected_route: ['hermes', 'gateway', 'agent_zero', 'paperclip']
  proposal_kind: PaperclipHermesProposalKind
  title: string
  objective: string
  hermes_can_see_paperclip_registry: true
  paperclip_status_endpoint: '/api/bridge/paperclip/status'
  paperclip_tasks_endpoint: '/api/bridge/paperclip/tasks'
  paperclip_proposals_endpoint: '/api/bridge/paperclip/proposals'
  visible_registries: Array<{ name: string; endpoint: string; access: 'read_only' }>
  design_authority: {
    can_design_workflow_task_template: true
    can_propose_mini_agent_spec: true
    can_draft_paperclip_routine: true
    can_create_skill_proposal_document: true
    can_activate_execution: false
    activation_requires: 'agent_zero_gateway_bridge_session'
  }
  proposal: {
    workflow_task_template: { goal: string; steps: string[]; success_criteria: string[] }
    mini_agent_spec: { parent_supervisor: 'agent_zero'; scope: string[]; memory_ttl: '24h'; forbidden_tools: string[] }
    paperclip_routine: { cadence: string; heartbeat: string; budget_policy: string; review_policy: string }
    skill_proposal_document: { document_created: true; production_file_written: false; sections: string[] }
  }
  storage: {
    paperclip_issue_recorded: false
    work_product_recorded: false
    issue_id: null
    work_product_id: null
    blocked_reason: string
  }
  review: {
    agent_zero_review_required: true
    owner_approval_required_if_protected_action: true
    hermes_final_authority: false
  }
  gateway_audit_log: Array<{
    event: string
    actor: string
    target: string
    status: 'recorded' | 'blocked'
    external_write: false
    no_secrets_exposed: true
    raw_paths_exposed: false
  }>
  response_text: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipSpaceAgentResearchTaskType = 'web_research' | 'youtube_research' | 'firecrawl_task'

export type PaperclipSpaceAgentResearchTaskPayload = {
  ok: false
  mode: 'paperclip_space_agent_research_task_handoff'
  generated_at: string
  task_id: string
  requester: 'agent_zero' | 'blocked'
  task_type: PaperclipSpaceAgentResearchTaskType
  owner_request: string
  selected_route: ['agent_zero', 'gateway', 'paperclip', 'space_agent']
  return_route: ['space_agent', 'gateway', 'agent_zero']
  paperclip_status_endpoint: '/api/bridge/paperclip/status'
  paperclip_agents_endpoint: '/api/bridge/paperclip/agents'
  paperclip_issues_endpoint: '/api/bridge/paperclip/issues'
  paperclip_research_tasks_endpoint: '/api/bridge/paperclip/research-tasks'
  paperclip_agent: {
    id: 'space_agent'
    name: 'SpaceAgent'
    appears_as_paperclip_agent: true
    role: 'browser_web_youtube_firecrawl_research_specialist'
    status: 'read_only_virtual_agent'
    supervisors: ['agent_zero', 'hermes', 'pi']
    external_writes_enabled: false
    bridge_session_required_for_execution: true
  }
  task_assignment: {
    space_agent_can_receive_web_research_task: true
    space_agent_can_receive_youtube_research_task: true
    space_agent_can_receive_firecrawl_task: true
    execution_enabled: false
    writes_enabled: false
  }
  paperclip_tracking: {
    paperclip_tracks_research_issue: true
    paperclip_research_issue_recorded: false
    issue_id: null
    status: 'not_created'
    blocked_reason: string
  }
  research_packet: SpaceAgentResearchCompletion['handoff']['packet']
  research_completion: SpaceAgentResearchCompletion
  work_product: {
    paperclip_stores_work_product: true
    paperclip_work_product_recorded: false
    work_product_id: null
    blocked_reason: string
  }
  gateway_validation: {
    gateway_validates_evidence: true
    decision: SpaceAgentResearchCompletion['handoff']['gateway_validation']['decision']
    valid: boolean
    evidence_count: number
    source_count: number
    citations_count: number
    blocked_reason: string | null
  }
  agent_zero_next_step: {
    agent_zero_routes_next_step: true
    decision: SpaceAgentResearchCompletion['handoff']['agent_zero_decision']['decision']
    next_agent: SpaceAgentResponsibleAgent
    execution_enabled: false
  }
  responsible_agent_completion: {
    responsible_agent_completes_final_task: boolean
    responsible_agent: SpaceAgentResponsibleAgent
    status: SpaceAgentResearchCompletion['responsible_agent_next_step']['status']
    external_write: false
    execution_enabled: false
    writes_enabled: false
  }
  gateway_audit_log: Array<{
    event: string
    actor: string
    target: string
    status: 'recorded' | 'blocked' | 'needs_more_research'
    external_write: false
    no_secrets_exposed: true
    raw_paths_exposed: false
  }>
  response_text: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipPiDispatcherRecommendationPayload = {
  ok: false
  mode: 'paperclip_pi_dispatcher_recommendation'
  generated_at: string
  recommendation_id: string
  requester: 'pi'
  selected_route: ['pi', 'gateway', 'agent_zero', 'paperclip']
  task_queue_visible: true
  paperclip_status_endpoint: '/api/bridge/paperclip/status'
  paperclip_task_queue_endpoint: '/api/bridge/paperclip/issues'
  paperclip_tasks_endpoint: '/api/bridge/paperclip/tasks'
  paperclip_dispatcher_recommendations_endpoint: '/api/bridge/paperclip/dispatcher-recommendations'
  queue_summary: {
    paperclip_reachable: boolean
    active_issue_count: number
    blocker: string | null
  }
  owner_request: string
  recommendation: {
    recommended_agent: PaperclipTaskAssignee
    recommended_agent_reason: string
    budget_route: string
    model_provider_route: string
    create_mini_agent: boolean
    mini_agent_reason: string | null
    policy_result: PaperclipTaskPolicyResult
    blocked_reason: string
  }
  advisory_contract: {
    shadow_mode: true
    output_is_advisory_until_proven: true
    pi_can_execute: false
    gateway_policy_required: true
    agent_zero_final_decision_required: true
  }
  storage: {
    paperclip_recommendation_recorded: false
    work_product_recorded: false
    issue_id: null
    work_product_id: null
    blocked_reason: string
  }
  final_decision: {
    agent_zero_makes_final_decision: true
    owner_approval_required_if_protected_action: true
    gateway_logs_final_route_decision: true
  }
  gateway_audit_log: Array<{
    event: string
    actor: string
    target: string
    status: 'recorded' | 'blocked'
    external_write: false
    no_secrets_exposed: true
    raw_paths_exposed: false
  }>
  response_text: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipGatewayTaskPayload = {
  ok: false
  mode: 'paperclip_gateway_task_handoff'
  generated_at: string
  handoff_id: string
  requester: 'agent_zero' | 'blocked'
  assignee: PaperclipTaskAssignee | 'blocked'
  requested_action: string
  selected_route: ['agent_zero', 'gateway', 'paperclip']
  allowed_assignments: PaperclipTaskAssignee[]
  agent_zero_can_see_paperclip_status: true
  paperclip_status_endpoint: '/api/bridge/paperclip/status'
  paperclip_tasks_endpoint: '/api/bridge/paperclip/tasks'
  policy_result: PaperclipTaskPolicyResult
  policy: {
    allowed: false
    direct_paperclip_access_allowed: false
    gateway_required: true
    bridge_session_required: true
    write_adapter_configured: false
    external_write_executed: false
    blocked_reason: string
  }
  assignment: {
    target: PaperclipTaskAssignee | 'blocked'
    target_role: string
    agent_zero_reviews_completion: true
    paperclip_tracks_status: true
  }
  task_issue: {
    paperclip_issue_recorded: false
    issue_id: null
    title: string
    status: 'not_created'
    blocked_reason: string
  }
  status_tracking: {
    status: 'blocked'
    status_source: 'gateway_policy'
    completion_reviewed_by_agent_zero: false
    next_status_check: '/api/bridge/paperclip/issues'
  }
  gateway_handoff_log: Array<{
    event: string
    actor: string
    target: string
    status: 'recorded' | 'blocked'
    external_write: false
    no_secrets_exposed: true
    raw_paths_exposed: false
  }>
  response_text: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipWorkforceFlowPhaseStatus = 'recorded' | 'planned' | 'blocked' | 'validated' | 'reported'

export type PaperclipWorkforceFlowAuditEvent = {
  event: string
  actor: string
  target: string
  status: PaperclipWorkforceFlowPhaseStatus
  external_write: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipGatewayWorkforceFlowPayload = {
  ok: false
  mode: 'paperclip_gateway_workforce_flow_dry_run'
  generated_at: string
  flow_id: string
  owner_request: string
  selected_route: ['owner', 'gateway', 'pi', 'agent_zero', 'paperclip', 'worker', 'gateway', 'agent_zero', 'owner']
  endpoints: {
    paperclip_status: '/api/bridge/paperclip/status'
    paperclip_tasks: '/api/bridge/paperclip/tasks'
    paperclip_workforce_flow: '/api/bridge/paperclip/workforce-flow'
    paperclip_issues: '/api/bridge/paperclip/issues'
  }
  phases: Array<{
    phase: 271 | 272 | 273 | 274 | 275 | 276 | 277 | 278 | 279 | 280
    name: string
    status: PaperclipWorkforceFlowPhaseStatus
    summary: string
    blocked_reason: string | null
  }>
  pi_route_recommendation: Pick<PaperclipPiDispatcherRecommendationPayload, 'recommendation_id' | 'requester' | 'recommendation' | 'advisory_contract'>
  agent_zero_approval: {
    commander: 'agent_zero'
    mission_approved_for_planning: true
    mission_approved_for_execution: false
    final_decision_authority: true
    approval_summary: string
  }
  paperclip_issue_task: {
    paperclip_creates_issue: true
    issue_created: false
    issue_id: null
    title: string
    status: 'not_created'
    blocked_reason: string
  }
  worker_assignment: {
    paperclip_assigns_worker: true
    assigned: false
    worker: PaperclipTaskAssignee | 'blocked'
    worker_role: string
    blocked_reason: string
  }
  worker_execution: {
    worker_performs_task: boolean
    execution_mode: 'supplied_read_only_result' | 'not_executed'
    result_summary: string | null
    external_write: false
    execution_enabled: false
    writes_enabled: false
    blocked_reason: string | null
  }
  work_product: {
    paperclip_records_work_product: true
    work_product_recorded: false
    work_product_id: null
    summary: string | null
    blocked_reason: string
  }
  gateway_validation: {
    gateway_validates_result: true
    valid: boolean
    decision: 'accepted_for_agent_zero_report' | 'blocked_pending_worker_result'
    blocked_reason: string | null
  }
  agent_zero_owner_report: {
    agent_zero_reports_to_owner: true
    owner_visible_summary: string
    no_fake_done: true
  }
  audit: {
    gateway_audit_stored: true
    paperclip_audit_stored: false
    paperclip_audit_blocked_reason: string
    gateway_audit_log: PaperclipWorkforceFlowAuditEvent[]
    paperclip_audit_log: PaperclipWorkforceFlowAuditEvent[]
  }
  policy_result: PaperclipTaskPolicyResult
  blocked_reason: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export const PAPERCLIP_GATEWAY_RECORD_MAPPINGS = [
  "gateway_mission_to_issue",
  "owner_command_to_issue",
  "mini_agent_task_to_issue",
  "space_agent_research_packet_to_work_product",
  "hermes_skill_proposal_to_issue_work_product",
  "pi_recommendation_to_issue_comment",
  "agent_zero_decision_to_issue_approval",
  "bridge_session_to_governance_event",
  "completed_task_to_final_report",
  "blocked_task_to_exact_blocker",
] as const

export type PaperclipGatewayRecordMappingKind = (typeof PAPERCLIP_GATEWAY_RECORD_MAPPINGS)[number]

export type PaperclipGatewayRecordTarget =
  | "paperclip_issue"
  | "paperclip_work_product"
  | "paperclip_issue_comment"
  | "paperclip_issue_approval"
  | "paperclip_governance_event"
  | "paperclip_final_report"
  | "paperclip_blocker"

export type PaperclipGatewayRecordSource =
  | "gateway"
  | "owner"
  | "mini_agent"
  | "space_agent"
  | "hermes"
  | "pi"
  | "agent_zero"
  | "bridge_session"
  | "paperclip"

export type PaperclipGatewayRecordMappingInput = {
  kind?: string | null
  title?: string | null
  sourceId?: string | null
  blocker?: string | null
  generatedAt: string
}

export type PaperclipGatewayRecordMapping = {
  ok: boolean
  mode: "paperclip_gateway_record_mapping_dry_run"
  generated_at: string
  mapping_id: string
  kind: PaperclipGatewayRecordMappingKind | "unknown"
  source: PaperclipGatewayRecordSource
  targets: PaperclipGatewayRecordTarget[]
  title: string
  source_id: string | null
  paperclip_write_recorded: false
  paperclip_ids: []
  policy_result: PaperclipTaskPolicyResult
  blocked_reason: string
  mapped_blocker: string | null
  paperclip_storage_blocker: string
  requires_bridge_session: true
  write_adapter_configured: false
  external_write: false
  owner_visible_summary: string
  audit_log: Array<{
    event: string
    actor: string
    target: string
    status: "recorded" | "blocked"
    external_write: false
    no_secrets_exposed: true
    raw_paths_exposed: false
  }>
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export const PAPERCLIP_SANDBOX_HEARTBEAT_ROUTINES = [
  'daily_status',
  'daily_connector_health',
  'daily_hermes_skill_proposal',
  'daily_pi_dispatcher_optimization',
  'daily_space_agent_research_queue',
  'daily_agent_zero_report',
] as const

export type PaperclipSandboxHeartbeatRoutineId = (typeof PAPERCLIP_SANDBOX_HEARTBEAT_ROUTINES)[number]

export type PaperclipSandboxHeartbeatOwner = 'gateway' | 'agent_zero' | 'hermes' | 'pi' | 'space_agent'
export type PaperclipSandboxHeartbeatStatus = 'sandbox_ready' | 'sandbox_only_blocked' | 'duplicate_blocked' | 'budget_blocked' | 'paused_skipped'

export type PaperclipSandboxHeartbeatRoutine = {
  id: PaperclipSandboxHeartbeatRoutineId
  title: string
  cadence: 'daily'
  owner: PaperclipSandboxHeartbeatOwner
  purpose: string
  duplicate_guard_key: string
  status: PaperclipSandboxHeartbeatStatus
  status_reason: string | null
  sandbox_only: true
  production_enabled: false
  budget_preflight_required: true
  bridge_session_required_for_writes: true
  external_writes_enabled: false
  execution_enabled: false
  writes_enabled: false
}

export type PaperclipSandboxHeartbeatPlanInput = {
  generatedAt: string
  sandbox?: boolean | null
  existingHeartbeatKeys?: string[] | null
  pausedAgents?: string[] | null
  monthlyBudgetCents?: number | null
  projectedCostCents?: number | null
}

export type PaperclipSandboxHeartbeatPlan = {
  ok: boolean
  mode: 'paperclip_sandbox_heartbeat_plan'
  generated_at: string
  sandbox_heartbeat_enabled: boolean
  production_heartbeat_enabled: false
  heartbeat_execution_enabled: false
  routines: PaperclipSandboxHeartbeatRoutine[]
  duplicate_work_guard: {
    enabled: true
    duplicate_guard_keys: string[]
    duplicates_blocked: string[]
    duplicate_work_detected: boolean
  }
  budget_enforcement: {
    required_before_execution: true
    monthly_budget_cents: number | null
    projected_cost_cents: number
    status: 'within_budget' | 'missing_budget' | 'over_budget'
    execution_blocked: boolean
    blocked_reason: string | null
  }
  paused_agent_guard: {
    enabled: true
    paused_agents: PaperclipSandboxHeartbeatOwner[]
    skipped_routines: PaperclipSandboxHeartbeatRoutineId[]
  }
  blocked_reason: string | null
  owner_visible_summary: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export const PAPERCLIP_TOKEN_GOVERNOR_BUDGET_SCOPES = [
  'company',
  'agent',
  'project',
  'goal',
  'model_provider',
] as const

export type PaperclipTokenGovernorBudgetScope = (typeof PAPERCLIP_TOKEN_GOVERNOR_BUDGET_SCOPES)[number]
export type PaperclipTokenGovernorBudgetStatus = 'within_budget' | 'alert' | 'hard_stop' | 'missing_budget'
export type PaperclipTokenGovernorDecision = 'allowed' | 'alert' | 'hard_stop' | 'missing_budget'

export type PaperclipTokenGovernorBudgetInput = {
  scope: string
  id?: string | null
  name?: string | null
  budgetCents?: number | null
  spentCents?: number | null
  projectedCents?: number | null
  ownerHardStopPercent?: number | null
  runaway?: boolean | null
}

export type PaperclipTokenGovernorPlanInput = {
  generatedAt: string
  budgets: PaperclipTokenGovernorBudgetInput[]
  alertPercent?: number | null
  hardStopPercent?: number | null
}

export type PaperclipTokenGovernorBudgetDecision = {
  scope: PaperclipTokenGovernorBudgetScope
  id: string
  name: string
  budget_cents: number | null
  spent_cents: number
  projected_cents: number
  total_after_projection_cents: number
  usage_percent: number | null
  alert_threshold_percent: number
  hard_stop_threshold_percent: number
  status: PaperclipTokenGovernorBudgetStatus
  decision: PaperclipTokenGovernorDecision
  alert_at_75_percent: boolean
  hard_stop_at_threshold: boolean
  pause_runaway_agent: boolean
  blocked_reason: string | null
}

export type PaperclipTokenGovernorCostAuditEvent = {
  event: 'paperclip.token_governor.cost_event'
  scope: PaperclipTokenGovernorBudgetScope
  subject_id: string
  subject_name: string
  spent_cents: number
  projected_cents: number
  usage_percent: number | null
  decision: PaperclipTokenGovernorDecision
  blocked_reason: string | null
  recorded_at: string
  external_write: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipTokenGovernorPlan = {
  ok: boolean
  mode: 'paperclip_token_governor_dry_run'
  generated_at: string
  concept: 'gateway_token_governor_for_paperclip'
  imported_into_paperclip: true
  production_enforcement_enabled: false
  budget_scopes: PaperclipTokenGovernorBudgetScope[]
  alert_threshold_percent: number
  default_hard_stop_percent: number
  budgets: PaperclipTokenGovernorBudgetDecision[]
  alerts: PaperclipTokenGovernorBudgetDecision[]
  hard_stops: PaperclipTokenGovernorBudgetDecision[]
  paused_agents: PaperclipTokenGovernorBudgetDecision[]
  cost_audit_events: PaperclipTokenGovernorCostAuditEvent[]
  blocked_reason: string | null
  owner_visible_summary: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export const PAPERCLIP_CREDENTIAL_SUBJECTS = [
  'chatgpt_codex_auth',
  'claude_anthropic_auth',
] as const

export type PaperclipCredentialSubject = (typeof PAPERCLIP_CREDENTIAL_SUBJECTS)[number]
export type PaperclipCredentialAuthMethod = 'chatgpt_codex_oauth' | 'claude_code_oauth'
export type PaperclipCredentialMode = 'protected_local_auth_home' | 'protected_secret_ref' | 'paperclip_secret_ref' | 'missing' | 'inline_value_blocked'

export type PaperclipCredentialInput = {
  subject?: string | null
  authMethod?: string | null
  mode?: string | null
  configured?: boolean | null
  secretRef?: string | null
  inlineValue?: string | null
  authFilePath?: string | null
  env?: Record<string, unknown> | null
}

export type PaperclipCredentialDecision = {
  subject: PaperclipCredentialSubject | 'unknown'
  auth_method: PaperclipCredentialAuthMethod | 'unknown'
  credential_mode: PaperclipCredentialMode
  configured: boolean
  secret_ref_configured: boolean
  secret_ref: string | null
  owner_visible_location: 'protected_local_auth_home' | 'protected_secret_reference' | 'not_configured'
  strict_secrets_mode: boolean
  api_billing_disabled: boolean
  inline_key_blocked: boolean
  env_leakage_detected: boolean
  auth_file_path_leakage_detected: boolean
  owner_ui_shows_secret_values: false
  owner_ui_shows_auth_file_paths: false
  paperclip_shows_secret_values: false
  policy_result: PaperclipTaskPolicyResult
  blocked_reason: string | null
  credential_modes_documented: true
  audit_log: Array<{
    event: string
    actor: 'gateway'
    target: string
    status: 'recorded' | 'blocked'
    external_write: false
    no_secrets_exposed: true
    raw_paths_exposed: false
  }>
}

export type PaperclipCredentialModePlanInput = {
  generatedAt: string
  deploymentMode?: string | null
  credentials: PaperclipCredentialInput[]
  secretScanPassed?: boolean | null
}

export type PaperclipCredentialModePlan = {
  ok: boolean
  mode: 'paperclip_credential_modes_dry_run'
  generated_at: string
  deployment_mode: 'sandbox' | 'private' | 'production'
  strict_secrets_mode_enabled: boolean
  credential_subjects: PaperclipCredentialSubject[]
  credentials: PaperclipCredentialDecision[]
  blocked: PaperclipCredentialDecision[]
  credential_modes_documented: true
  secret_scan: {
    tested: true
    passed: boolean
    blocked_reason: string | null
  }
  no_env_leakage: boolean
  no_auth_file_leakage: boolean
  owner_ui_policy: {
    show_secret_refs_only: true
    show_secret_values: false
    show_auth_file_paths: false
    show_configured_booleans: true
  }
  paperclip_policy: {
    inline_keys_allowed: false
    secret_values_visible: false
    production_private_strict_mode: boolean
  }
  owner_visible_summary: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}



export const PAPERCLIP_WORKSPACE_IDS = [
  'mission_control',
  'claudeclaw_openclaw',
  'space_agent',
  'pi',
  'paperclip',
] as const

export type PaperclipWorkspaceId = (typeof PAPERCLIP_WORKSPACE_IDS)[number]
export type PaperclipWorkspaceKind = 'gateway_control_plane' | 'runtime_skills_layer' | 'research_specialist' | 'dispatcher_candidate' | 'workforce_layer'
export type PaperclipWorkspaceTaskAction = 'read' | 'code' | 'test' | 'report'

export type PaperclipWorkspaceDefinition = {
  id: PaperclipWorkspaceId
  name: string
  kind: PaperclipWorkspaceKind
  role: string
  repository_ref: string
  workspace_ref: string
  status: 'mapped'
  coding_tasks_allowed: boolean
  isolated_worktree_required_for_coding: boolean
  protected_outputs_ref: string
  gateway_node_id: string
  paperclip_issue_attachment_supported: true
  raw_path_exposed: false
}

export type PaperclipWorkspaceTaskInput = {
  workspace?: string | null
  action?: string | null
  taskTitle?: string | null
  workspaceRef?: string | null
  isolatedWorktreeRef?: string | null
  paperclipIssueId?: string | null
  outputTitle?: string | null
}

export type PaperclipWorkspaceTaskDecision = {
  task_title: string
  workspace: PaperclipWorkspaceId | 'unknown'
  action: PaperclipWorkspaceTaskAction
  selected_workspace_ref: string | null
  isolated_worktree_ref: string | null
  correct_workspace: boolean
  isolated_worktree_created: boolean
  safe_work_product_ref: string
  paperclip_issue_attachment_planned: boolean
  paperclip_issue_attachment_recorded: false
  mission_control_gateway_linked: boolean
  mission_control_gateway_link_ref: string | null
  policy_result: PaperclipTaskPolicyResult
  blocked_reason: string | null
  execution_enabled: false
  writes_enabled: false
  external_write: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipWorkspaceMapPlanInput = {
  generatedAt: string
  tasks?: PaperclipWorkspaceTaskInput[] | null
}

export type PaperclipWorkspaceMapPlan = {
  ok: boolean
  mode: 'paperclip_workspace_map_dry_run'
  generated_at: string
  workspaces: PaperclipWorkspaceDefinition[]
  workspace_ids: PaperclipWorkspaceId[]
  isolated_worktree_policy: {
    required_for_coding_tasks: true
    create_from_correct_workspace_only: true
    no_tasks_in_wrong_directory: true
    raw_paths_owner_visible: false
  }
  work_product_policy: {
    store_outputs_safely: true
    protected_output_refs_only: true
    attach_to_paperclip_issues: true
    link_back_to_mission_control_gateway: true
    paperclip_write_adapter_required: true
    bridge_session_required_for_issue_writes: true
  }
  task_decisions: PaperclipWorkspaceTaskDecision[]
  blocked: PaperclipWorkspaceTaskDecision[]
  owner_visible_summary: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}



export const PAPERCLIP_GATEWAY_PLUGIN_IDS = [
  'gateway_core',
  'agent_zero_adapter',
  'hermes_adapter',
  'pi_adapter',
  'space_agent_adapter',
  'openclaw_runtime_adapter',
  'openclaw_skills_adapter',
  'mission_control_ui_contribution',
] as const

export type PaperclipGatewayPluginId = (typeof PAPERCLIP_GATEWAY_PLUGIN_IDS)[number]
export type PaperclipGatewayPluginKind = 'gateway_spec' | 'agent_adapter' | 'worker_adapter' | 'skills_adapter' | 'ui_contribution'
export type PaperclipGatewayPluginLifecycleAction = 'load' | 'unload'
export type PaperclipGatewayPluginLifecycleStatus = 'loaded' | 'unloaded' | 'blocked'

export type PaperclipGatewayPluginSpec = {
  id: PaperclipGatewayPluginId
  name: string
  kind: PaperclipGatewayPluginKind
  target_node: string
  supervisor: 'gateway' | 'agent_zero' | 'paperclip'
  plugin_system: 'mission_control_explicit_plugin_loader'
  registers: Array<'integration' | 'category' | 'nav_item' | 'panel' | 'tool_provider' | 'gateway_node' | 'adapter'>
  capabilities: string[]
  load_mode: 'explicit_import_only'
  production_auto_load_enabled: false
  unload_supported: true
  ui_contribution_safe: boolean
  ui_contribution_enabled: boolean
  bridge_session_required_for_writes: true
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipGatewayPluginLifecycleInput = {
  plugin?: string | null
  action?: string | null
  loaded?: boolean | null
  safeUiContribution?: boolean | null
}

export type PaperclipGatewayPluginLifecycleDecision = {
  plugin: PaperclipGatewayPluginId | 'unknown'
  action: PaperclipGatewayPluginLifecycleAction
  status: PaperclipGatewayPluginLifecycleStatus
  loaded_before: boolean
  loaded_after: boolean
  policy_result: PaperclipTaskPolicyResult
  blocked_reason: string | null
  audit_event: {
    event: string
    actor: 'gateway'
    target: string
    status: 'recorded' | 'blocked'
    external_write: false
    no_secrets_exposed: true
    raw_paths_exposed: false
  }
  execution_enabled: false
  writes_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type PaperclipGatewayPluginPlanInput = {
  generatedAt: string
  lifecycle?: PaperclipGatewayPluginLifecycleInput[] | null
}

export type PaperclipGatewayPluginPlan = {
  ok: boolean
  mode: 'paperclip_gateway_plugin_spec_dry_run'
  generated_at: string
  plugin_system_inspection: {
    loader: 'explicit_import_init_loader'
    registries: ['integrations', 'categories', 'nav_items', 'panels', 'tool_providers']
    dynamic_env_loading_enabled: false
    production_auto_load_enabled: false
  }
  plugins: PaperclipGatewayPluginSpec[]
  plugin_ids: PaperclipGatewayPluginId[]
  lifecycle_decisions: PaperclipGatewayPluginLifecycleDecision[]
  blocked: PaperclipGatewayPluginLifecycleDecision[]
  mission_control_ui_contribution: {
    safe_to_define: true
    enabled: false
    reason: string
  }
  owner_visible_summary: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}







export const PAPERCLIP_UI_ACCESS_SURFACES = [
  "company_dashboard",
  "org_chart",
  "issues_tasks",
  "budget",
  "approvals",
  "agent_detail_pages",
] as const

export type PaperclipUiAccessSurfaceId = (typeof PAPERCLIP_UI_ACCESS_SURFACES)[number]

export type PaperclipUiAccessSurfaceProbe = {
  id: string
  reachable?: boolean | null
  statusCode?: number | null
  requiresLogin?: boolean | null
  blocker?: string | null
}

export type PaperclipUiAccessVerificationInput = {
  generatedAt: string
  localUrl?: string | null
  tailnetUrl?: string | null
  localReachable?: boolean | null
  localStatusCode?: number | null
  tailnetReachable?: boolean | null
  tailnetStatusCode?: number | null
  ownerLoginConfirmed?: boolean | null
  mobileViewportConfirmed?: boolean | null
  surfaces?: PaperclipUiAccessSurfaceProbe[] | null
}

export type PaperclipUiAccessSurfaceConfirmation = {
  id: PaperclipUiAccessSurfaceId
  label: string
  route_hint: string
  confirmed: boolean
  status_code: number | null
  requires_owner_login: boolean
  policy_result: "allowed" | "blocked"
  blocker: string | null
}

export type PaperclipUiAccessVerificationPlan = {
  ok: boolean
  mode: "paperclip_ui_access_verification"
  generated_at: string
  local_url: string | null
  local_url_confirmed: boolean
  local_status_code: number | null
  tailnet_url: string | null
  tailnet_url_confirmed: boolean
  tailnet_status_code: number | null
  owner_login_confirmed: boolean
  company_dashboard_confirmed: boolean
  org_chart_confirmed: boolean
  issue_task_page_confirmed: boolean
  budget_page_confirmed: boolean
  approvals_page_confirmed: boolean
  agent_detail_pages_confirmed: boolean
  mobile_view_confirmed: boolean
  surfaces: PaperclipUiAccessSurfaceConfirmation[]
  public_exposure: false
  tailnet_only_recommended: true
  blocker: string | null
  owner_visible_summary: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export const PAPERCLIP_BOARD_APPROVAL_ACTIONS = [
  'co_worker_hire',
  'external_write',
  'drive_upload',
  'onedrive_upload',
  'agentmail_send',
  'buildwiki_run_now',
  'zapier_write',
  'heygen_generation',
  'smb_fork2',
] as const

export type PaperclipBoardApprovalAction = (typeof PAPERCLIP_BOARD_APPROVAL_ACTIONS)[number]
export type PaperclipBoardApprovalState = 'pending' | 'approved' | 'denied'
export type PaperclipBoardApprovalResult = PaperclipBoardApprovalState | 'expired' | 'unknown_action'

export type PaperclipBoardApprovalInput = {
  action?: string | null
  title?: string | null
  requestedBy?: string | null
  approvalState?: string | null
  scope?: string | null
  requestedAt?: string | null
  expiresAt?: string | null
}

export type PaperclipBoardApprovalDecision = {
  action: PaperclipBoardApprovalAction | 'unknown'
  title: string
  requested_by: string
  requested_at: string
  expires_at: string | null
  evaluated_at: string
  required_scope: string | null
  board_approval_required: true
  approval_state: PaperclipBoardApprovalState | 'unknown'
  approval_result: PaperclipBoardApprovalResult
  expired: boolean
  policy_result: PaperclipTaskPolicyResult
  blocked_reason: string | null
  paperclip_result_logged: true
  gateway_result_logged: true
  execution_allowed: false
  execution_enabled: false
  writes_enabled: false
  external_write: boolean
  audit_log: Array<{
    event: string
    actor: string
    target: string
    status: 'recorded' | 'blocked'
    external_write: false
    no_secrets_exposed: true
    raw_paths_exposed: false
  }>
}

export type PaperclipBoardApprovalPlanInput = {
  generatedAt: string
  approvals: PaperclipBoardApprovalInput[]
}

export type PaperclipBoardApprovalPlan = {
  ok: boolean
  mode: 'paperclip_board_approval_dry_run'
  generated_at: string
  required_actions: PaperclipBoardApprovalAction[]
  decisions: PaperclipBoardApprovalDecision[]
  approved: PaperclipBoardApprovalDecision[]
  blocked: PaperclipBoardApprovalDecision[]
  expired: PaperclipBoardApprovalDecision[]
  paperclip_results_logged: true
  gateway_results_logged: true
  owner_visible_summary: string
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

type FetchJsonResult =
  | { ok: true; status: number; payload: unknown }
  | { ok: false; status: number; blocker: string }

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const DEFAULT_PAPERCLIP_BASE_URL = 'http://127.0.0.1:3100'
const PAPERCLIP_TIMEOUT_MS = 2500

type PaperclipEndpointResolution = {
  baseUrl: string
  ownerVisible: string
  uiLink: string | null
  blocker: string | null
}

export function resolvePaperclipEndpoint(rawValue?: string | null): PaperclipEndpointResolution {
  const raw = (rawValue || process.env.PAPERCLIP_API_URL || process.env.PAPERCLIP_BASE_URL || DEFAULT_PAPERCLIP_BASE_URL).trim()
  try {
    const url = new URL(raw)
    const hostname = url.hostname.toLowerCase()
    const allowedHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.startsWith('100.')
    const allowedProtocol = url.protocol === 'http:' || url.protocol === 'https:'
    const ownerVisible = hostname.startsWith('100.') ? `tailnet:${url.port || defaultPort(url.protocol)}` : `loopback:${url.port || defaultPort(url.protocol)}`

    if (!allowedProtocol || !allowedHost) {
      return {
        baseUrl: DEFAULT_PAPERCLIP_BASE_URL,
        ownerVisible: 'loopback:3100',
        uiLink: null,
        blocker: 'paperclip_endpoint_not_local_or_tailnet',
      }
    }

    return {
      baseUrl: url.origin,
      ownerVisible,
      uiLink: url.origin,
      blocker: null,
    }
  } catch {
    return {
      baseUrl: DEFAULT_PAPERCLIP_BASE_URL,
      ownerVisible: 'loopback:3100',
      uiLink: null,
      blocker: 'paperclip_endpoint_invalid',
    }
  }
}

export function createPaperclipCoWorkerAgentDefinition(input: PaperclipCoWorkerAgentInput): PaperclipCoWorkerAgentDefinitionResult {
  const generatedAt = input.generatedAt
  const name = sanitizeOwnerText(input.name || 'Paperclip co-worker agent').slice(0, 120) || 'Paperclip co-worker agent'
  const id = buildPaperclipCoWorkerAgentId(input.id || name)
  const supervisor = normalizePaperclipCoWorkerSupervisor(input.supervisor)
  const purpose = sanitizeOwnerText(input.purpose || '').slice(0, 600)
  const taskScope = sanitizePaperclipList(input.taskScope || [], 12, 220)
  const allowedTools = sanitizePaperclipList(input.allowedTools || [], 20, 120)
  const forbiddenTools = dedupeStrings([
    ...sanitizePaperclipList(input.forbiddenTools || [], 20, 120),
    'direct_secret_read',
    'raw_root_shell',
    'docker_socket',
    'uncontrolled_delete',
    'broad_connector_execution',
    'zapier_write',
    'heygen_generation',
    'smb_mount',
  ])
  const budgetMaxCents = normalizePaperclipBudgetCents(input.budgetMaxCents)
  const memoryTtlMinutes = normalizePaperclipMemoryTtl(input.memoryTtlMinutes)
  const expirationCondition = sanitizeOwnerText(input.expirationCondition || 'Expire on task completion, TTL, budget cap, or Gateway policy block.').slice(0, 260)
  const blockedReason = validatePaperclipCoWorkerAgentDefinition({
    id,
    supervisor,
    purpose,
    taskScope,
    allowedTools,
    forbiddenTools,
    expirationCondition,
  })

  if (blockedReason) {
    return {
      ok: false,
      mode: 'paperclip_coworker_definition_dry_run',
      definition: null,
      policy_result: 'blocked',
      blocked_reason: blockedReason,
      response_text: `Sir, the Paperclip co-worker definition is blocked: ${blockedReason.replace(/[_-]+/g, ' ')}.`,
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    }
  }

  const definition: PaperclipCoWorkerAgentDefinition = {
    schema: 'paperclip_coworker_agent_v1',
    mode: 'paperclip_coworker_definition_dry_run',
    id,
    name,
    supervisor,
    command_authority: 'agent_zero',
    purpose,
    task_scope: taskScope,
    budget: {
      mode: 'advisory_budget_only',
      currency: 'USD',
      max_cents: budgetMaxCents,
      spent_cents: 0,
      spending_authority: false,
      budget_enforced_by: 'gateway_policy_and_paperclip_tracking',
    },
    memory_ttl_minutes: memoryTtlMinutes,
    created_at: generatedAt,
    expires_at: addPaperclipMinutes(generatedAt, memoryTtlMinutes),
    allowed_tools: allowedTools,
    forbidden_tools: forbiddenTools,
    expiration_condition: expirationCondition,
    audit_trail_required: true,
    audit_trail: [paperclipCoWorkerAuditEvent('paperclip.coworker.definition.created', supervisor, id, 'Co-worker definition created in dry-run schema mode.', generatedAt)],
    lifecycle: 'proposed',
    bridge_session_required_for_activation: true,
    read_enabled: true,
    write_enabled: false,
    execution_enabled: false,
    external_writes_enabled: false,
    direct_secret_access_allowed: false,
    raw_root_shell_allowed: false,
    docker_socket_allowed: false,
    can_self_promote: false,
    can_create_child_agents: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    blocked_reason: null,
  }

  return {
    ok: true,
    mode: 'paperclip_coworker_definition_dry_run',
    definition,
    policy_result: 'requires_session',
    blocked_reason: 'paperclip_coworker_activation_requires_bridge_session_and_runtime_adapter',
    response_text: `Sir, ${definition.name} is defined as a supervised Paperclip co-worker under ${supervisor}, but activation is blocked until Bridge Session scope and a runtime adapter exist.`,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

export function transitionPaperclipCoWorkerLifecycle(input: PaperclipCoWorkerLifecycleTransitionInput): PaperclipCoWorkerLifecycleTransitionResult {
  const requestedLifecycle = sanitizeOwnerText(input.lifecycle || '')
  const lifecycle = normalizePaperclipCoWorkerLifecycle(requestedLifecycle)
  const actor = normalizePaperclipLifecycleActor(input.actor)
  const previous = input.definition.lifecycle
  const summary = sanitizeOwnerText(input.summary || `Transition co-worker lifecycle to ${lifecycle || requestedLifecycle}.`).slice(0, 260)
  const blockedReason = !lifecycle
    ? 'paperclip_coworker_lifecycle_unknown'
    : lifecycle === 'reviewed_by_agent_zero' && actor !== 'agent_zero'
      ? 'paperclip_coworker_review_requires_agent_zero'
      : null

  if (blockedReason) {
    return {
      ok: false,
      mode: 'paperclip_coworker_lifecycle_transition_dry_run',
      definition: null,
      previous_lifecycle: previous || null,
      requested_lifecycle: requestedLifecycle,
      lifecycle: null,
      lifecycle_order: [...PAPERCLIP_COWORKER_LIFECYCLE_STATES],
      reviewed_by_agent_zero: false,
      policy_result: 'blocked',
      blocked_reason: blockedReason,
      response_text: `Sir, the Paperclip co-worker lifecycle transition is blocked: ${blockedReason.replace(/[_-]+/g, ' ')}.`,
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    }
  }

  const lifecycleState = lifecycle as PaperclipCoWorkerLifecycleState
  const transitioned: PaperclipCoWorkerAgentDefinition = {
    ...input.definition,
    lifecycle: lifecycleState,
    audit_trail: [
      ...input.definition.audit_trail,
      paperclipCoWorkerAuditEvent(`paperclip.coworker.lifecycle.${lifecycleState}`, actor, input.definition.id, summary, input.recordedAt),
    ],
    execution_enabled: false,
    write_enabled: false,
    external_writes_enabled: false,
    blocked_reason: lifecycleState === 'blocked' || lifecycleState === 'failed' ? summary : null,
  }

  return {
    ok: true,
    mode: 'paperclip_coworker_lifecycle_transition_dry_run',
    definition: transitioned,
    previous_lifecycle: previous,
    requested_lifecycle: requestedLifecycle,
    lifecycle: lifecycleState,
    lifecycle_order: [...PAPERCLIP_COWORKER_LIFECYCLE_STATES],
    reviewed_by_agent_zero: lifecycleState === 'reviewed_by_agent_zero',
    policy_result: lifecycleState === 'running' ? 'requires_session' : 'blocked',
    blocked_reason: lifecycleState === 'running'
      ? 'paperclip_coworker_running_requires_bridge_session_and_runtime_adapter'
      : 'paperclip_coworker_lifecycle_tracking_only_no_runtime_execution',
    response_text: lifecycleState === 'running'
      ? 'Sir, Paperclip co-worker lifecycle is marked running for tracking only; runtime execution remains blocked until Bridge Session and adapter approval.'
      : `Sir, Paperclip co-worker lifecycle is now ${lifecycleState.replace(/_/g, ' ')} in dry-run tracking. No execution or external write occurred.`,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

export function validatePaperclipCoWorkerGatewayPolicy(input: PaperclipCoWorkerPolicyValidationInput): PaperclipCoWorkerPolicyValidationResult {
  const requestedAction = normalizePaperclipCoWorkerRequestAction(input.requestedAction)
  const credentialMode = normalizePaperclipCoWorkerCredentialMode(input.credentialMode)
  const bridgeSessionActive = Boolean(input.bridgeSessionActive)
  const ownerApproved = Boolean(input.ownerApproved)
  const requestedScope = sanitizePaperclipList(input.requestedScope || [], 12, 220)
  const requestedTools = sanitizePaperclipList(input.requestedTools || [], 20, 120)
  const memoryTtlMinutes = input.memoryTtlMinutes == null ? input.definition.memory_ttl_minutes : normalizePaperclipMemoryTtl(input.memoryTtlMinutes)
  const outputContract = sanitizeOwnerText(input.outputContract || '').slice(0, 400)
  const protectedAction = requestedAction === 'write' || requestedAction === 'execute'
  const checks: PaperclipCoWorkerPolicyCheck[] = []

  const addCheck = (check: PaperclipCoWorkerPolicyCheckName, passed: boolean, decision: PaperclipCoWorkerRouteDecision, blockedReason: string | null) => {
    checks.push({ check, passed, decision: passed ? 'allowed' : decision, blocked_reason: passed ? null : blockedReason })
  }

  addCheck('request_type', Boolean(requestedAction), 'blocked', 'paperclip_coworker_request_type_unknown')
  addCheck('credential_mode', credentialMode !== 'missing', 'missing_credential', 'paperclip_coworker_missing_required_credential')
  addCheck('bridge_session', !protectedAction || bridgeSessionActive, 'requires_session', 'paperclip_coworker_bridge_session_required')
  addCheck('owner_approval', !protectedAction || ownerApproved, 'requires_session', 'paperclip_coworker_owner_approval_required')
  addCheck('mini_agent_scope', paperclipCoWorkerScopeAllowed(input.definition, requestedScope), 'blocked', 'paperclip_coworker_scope_not_allowed')
  addCheck('forbidden_tools', paperclipCoWorkerToolsAllowed(input.definition, requestedTools), 'blocked', 'paperclip_coworker_forbidden_tool_requested')
  addCheck('memory_policy', memoryTtlMinutes > 0 && memoryTtlMinutes <= input.definition.memory_ttl_minutes, 'blocked', 'paperclip_coworker_memory_ttl_exceeds_policy')
  addCheck('audit_requirement', input.auditRequired !== false && input.definition.audit_trail_required, 'blocked', 'paperclip_coworker_audit_required')
  addCheck('output_contract', Boolean(outputContract) && !paperclipCoWorkerUnsafeOutputContract(outputContract), 'blocked', 'paperclip_coworker_output_contract_required')

  const failed = checks.find((check) => !check.passed) || null
  const routeDecision: PaperclipCoWorkerRouteDecision = failed?.decision || 'allowed'
  const blockedReason = failed?.blocked_reason || null
  const auditSummary = blockedReason
    ? `Paperclip co-worker policy blocked route: ${blockedReason}.`
    : `Paperclip co-worker policy allowed ${requestedAction} route in dry-run validation.`

  return {
    ok: routeDecision === 'allowed',
    mode: 'paperclip_coworker_gateway_policy_decision',
    definition_id: input.definition.id,
    requested_action: requestedAction,
    credential_mode: credentialMode,
    route_decision: routeDecision,
    checks,
    blocked_reason: blockedReason,
    bridge_session_required: protectedAction,
    owner_approval_required: protectedAction,
    audit_event: paperclipCoWorkerAuditEvent('paperclip.coworker.policy.decision', 'gateway', input.definition.id, auditSummary, input.recordedAt),
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

export async function buildPaperclipStatusPayload(input: {
  generatedAt: string
  fetchImpl?: FetchLike
  baseUrl?: string | null
}): Promise<PaperclipSafeStatusPayload> {
  const endpoint = await resolveReachablePaperclipEndpoint(input)
  const baseStatus = basePayload(input.generatedAt, endpoint.ownerVisible, endpoint.uiLink)
  if (endpoint.blocker) {
    return {
      ...baseStatus,
      service: serviceAccessForEndpoint(endpoint.ownerVisible),
      health: 'degraded',
      reachable: endpoint.blocker === 'paperclip_auth_required_or_not_configured',
      configured: false,
      blocker: endpoint.blocker,
    }
  }

  const summary = summarizeHealthPayload(endpoint.healthPayload)
  const workforce = await summarizeWorkforceState({ baseUrl: endpoint.baseUrl, fetchImpl: input.fetchImpl })
  return {
    ...baseStatus,
    service: serviceAccessForEndpoint(endpoint.ownerVisible),
    health: workforce.blocker ? 'degraded' : 'connected',
    reachable: true,
    configured: true,
    upstream: summary,
    workforce_summary: workforce.summary,
    blocker: workforce.blocker,
  }
}

export async function listPaperclipCompanies(input: {
  generatedAt: string
  fetchImpl?: FetchLike
  baseUrl?: string | null
}): Promise<PaperclipInventoryPayload<PaperclipCompanySummary>> {
  const result = await fetchReadOnlyList('/api/companies', input)
  if (!result.ok) return inventoryBlocked('paperclip_companies_read_only', input.generatedAt, result.blocker)
  const items = arrayFromPayload(result.payload).map(sanitizeCompany).filter(Boolean) as PaperclipCompanySummary[]
  return inventoryOk('paperclip_companies_read_only', input.generatedAt, items)
}

export async function listPaperclipAgents(input: {
  generatedAt: string
  companyId?: string | null
  fetchImpl?: FetchLike
  baseUrl?: string | null
}): Promise<PaperclipInventoryPayload<PaperclipAgentSummary>> {
  const company = await resolveCompanySelector(input)
  if (!company.ok) return inventoryBlocked('paperclip_agents_read_only', input.generatedAt, company.blocker, input.companyId || null)
  const result = await fetchReadOnlyList(`/api/companies/${encodeURIComponent(company.companyId)}/agents`, input)
  if (!result.ok) return inventoryBlocked('paperclip_agents_read_only', input.generatedAt, result.blocker, company.companyId)
  const items = arrayFromPayload(result.payload).map(sanitizeAgent).filter(Boolean) as PaperclipAgentSummary[]
  return inventoryOk('paperclip_agents_read_only', input.generatedAt, withPaperclipVirtualSpaceAgent(items, company.companyId), company.companyId)
}

export async function listPaperclipIssues(input: {
  generatedAt: string
  companyId?: string | null
  fetchImpl?: FetchLike
  baseUrl?: string | null
}): Promise<PaperclipInventoryPayload<PaperclipIssueSummary>> {
  const company = await resolveCompanySelector(input)
  if (!company.ok) return inventoryBlocked('paperclip_issues_read_only', input.generatedAt, company.blocker, input.companyId || null)
  const result = await fetchReadOnlyList(`/api/companies/${encodeURIComponent(company.companyId)}/issues`, input)
  if (!result.ok) return inventoryBlocked('paperclip_issues_read_only', input.generatedAt, result.blocker, company.companyId)
  const items = arrayFromPayload(result.payload).map(sanitizeIssue).filter(Boolean) as PaperclipIssueSummary[]
  return inventoryOk('paperclip_issues_read_only', input.generatedAt, items, company.companyId)
}

export async function buildPaperclipTestTaskPayload(input: {
  message: string
  generatedAt: string
  fetchImpl?: FetchLike
  baseUrl?: string | null
}): Promise<PaperclipTestTaskPayload> {
  const prompt = sanitizeOwnerText(input.message).slice(0, 2000)
  const status = await buildPaperclipStatusPayload(input)
  const reachability = status.reachable ? 'Paperclip sandbox API is reachable for read-only status.' : `Paperclip sandbox API is not reachable: ${status.blocker}.`

  return {
    ok: false,
    mode: 'paperclip_read_only_test_task',
    generated_at: input.generatedAt,
    prompt,
    response_text: `${reachability} A safe Paperclip test-task adapter is not configured yet, so no workforce task was created or executed.`,
    paperclip_called: false,
    paperclip_reachable: status.reachable,
    blocker: 'paperclip_safe_test_task_adapter_not_configured',
    status_endpoint: '/api/bridge/paperclip/status',
    test_task_endpoint: '/api/bridge/paperclip/test-chat',
    proposals_endpoint: '/api/bridge/paperclip/proposals',
    research_tasks_endpoint: '/api/bridge/paperclip/research-tasks',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    next_action: 'Add a no-write Paperclip task adapter after sandbox API/auth review. Until then, this endpoint must stay safely blocked.',
  }
}

export async function buildPaperclipGatewayTaskPayload(input: {
  requester?: string | null
  assignee?: string | null
  title?: string | null
  requestedAction?: string | null
  generatedAt: string
  bridgeSessionActive?: boolean
  fetchImpl?: FetchLike
  baseUrl?: string | null
}): Promise<PaperclipGatewayTaskPayload> {
  const requester = normalizePaperclipRequester(input.requester)
  const assignee = normalizePaperclipAssignee(input.assignee)
  const title = sanitizeOwnerText(input.title || input.requestedAction || 'Gateway Paperclip workforce task').slice(0, 180) || 'Gateway Paperclip workforce task'
  const requestedAction = sanitizeOwnerText(input.requestedAction || title).slice(0, 1000)
  const status = await buildPaperclipStatusPayload({
    generatedAt: input.generatedAt,
    fetchImpl: input.fetchImpl,
    baseUrl: input.baseUrl,
  })

  const requesterBlocked = requester !== 'agent_zero'
  const assigneeBlocked = !assignee
  const statusBlocked = status.blocker || (!status.reachable ? 'paperclip_status_not_reachable' : null)
  const bridgeBlocked = input.bridgeSessionActive ? 'paperclip_write_adapter_not_configured' : 'active_bridge_session_required_for_paperclip_task_create'
  const blockedReason = requesterBlocked
    ? 'paperclip_tasks_must_be_requested_by_agent_zero_through_gateway'
    : assigneeBlocked
      ? 'paperclip_task_assignee_not_supported'
      : statusBlocked || bridgeBlocked
  const policyResult: PaperclipTaskPolicyResult = /credential|auth|token|api/i.test(blockedReason)
    ? 'missing_credential'
    : input.bridgeSessionActive && blockedReason === 'paperclip_write_adapter_not_configured'
      ? 'blocked'
      : 'requires_session'
  const safeAssignee = assignee || 'blocked'
  const auditStatus = policyResult === 'blocked' || policyResult === 'missing_credential' ? 'blocked' : 'recorded'

  return {
    ok: false,
    mode: 'paperclip_gateway_task_handoff',
    generated_at: input.generatedAt,
    handoff_id: buildPaperclipHandoffId(input.generatedAt),
    requester: requester === 'agent_zero' ? 'agent_zero' : 'blocked',
    assignee: safeAssignee,
    requested_action: requestedAction,
    selected_route: ['agent_zero', 'gateway', 'paperclip'],
    allowed_assignments: ['hermes', 'space_agent', 'pi_review', 'mini_agent'],
    agent_zero_can_see_paperclip_status: true,
    paperclip_status_endpoint: '/api/bridge/paperclip/status',
    paperclip_tasks_endpoint: '/api/bridge/paperclip/tasks',
    policy_result: policyResult,
    policy: {
      allowed: false,
      direct_paperclip_access_allowed: false,
      gateway_required: true,
      bridge_session_required: true,
      write_adapter_configured: false,
      external_write_executed: false,
      blocked_reason: blockedReason,
    },
    assignment: {
      target: safeAssignee,
      target_role: paperclipAssigneeRole(safeAssignee),
      agent_zero_reviews_completion: true,
      paperclip_tracks_status: true,
    },
    task_issue: {
      paperclip_issue_recorded: false,
      issue_id: null,
      title,
      status: 'not_created',
      blocked_reason: blockedReason,
    },
    status_tracking: {
      status: 'blocked',
      status_source: 'gateway_policy',
      completion_reviewed_by_agent_zero: false,
      next_status_check: '/api/bridge/paperclip/issues',
    },
    gateway_handoff_log: [
      handoffAuditEvent('agent_zero_requested_paperclip_task', 'agent_zero', 'gateway', 'recorded'),
      handoffAuditEvent('gateway_policy_checked_paperclip_task', 'gateway', 'paperclip', auditStatus),
      handoffAuditEvent('paperclip_issue_record_blocked_until_session_and_adapter', 'paperclip', safeAssignee, 'blocked'),
      handoffAuditEvent('agent_zero_completion_review_required', 'gateway', 'agent_zero', 'recorded'),
    ],
    response_text: `Sir, Paperclip task routing is visible through Gateway, but I did not create a Paperclip issue. Blocker: ${blockedReason.replace(/[_-]+/g, ' ')}.`,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

export async function buildPaperclipGatewayWorkforceFlowPayload(input: {
  ownerRequest?: string | null
  assignee?: string | null
  workerResult?: string | null
  generatedAt: string
  bridgeSessionActive?: boolean
  fetchImpl?: FetchLike
  baseUrl?: string | null
}): Promise<PaperclipGatewayWorkforceFlowPayload> {
  const ownerRequest = sanitizeOwnerText(input.ownerRequest || 'Route an owner mission through Paperclip workforce tracking.').slice(0, 1200)
  const piRecommendation = await buildPaperclipPiDispatcherRecommendationPayload({
    ownerRequest,
    generatedAt: input.generatedAt,
    fetchImpl: input.fetchImpl,
    baseUrl: input.baseUrl,
  })
  const worker = normalizePaperclipAssignee(input.assignee) || piRecommendation.recommendation.recommended_agent
  const task = await buildPaperclipGatewayTaskPayload({
    requester: 'agent_zero',
    assignee: worker,
    title: ownerRequest,
    requestedAction: ownerRequest,
    generatedAt: input.generatedAt,
    bridgeSessionActive: input.bridgeSessionActive,
    fetchImpl: input.fetchImpl,
    baseUrl: input.baseUrl,
  })
  const resultSummary = sanitizeOwnerText(input.workerResult || '').slice(0, 1200)
  const workerPerformedTask = Boolean(resultSummary)
  const paperclipStorageBlocker = task.policy.blocked_reason || 'active_bridge_session_and_paperclip_write_adapter_required_for_workforce_flow_storage'
  const validationBlockedReason = workerPerformedTask ? null : 'worker_result_required_before_gateway_validation_can_accept_completion'
  const validationDecision = workerPerformedTask ? 'accepted_for_agent_zero_report' : 'blocked_pending_worker_result'
  const policyResult: PaperclipTaskPolicyResult = workerPerformedTask ? task.policy_result : 'requires_session'
  const finalBlocker = validationBlockedReason || paperclipStorageBlocker
  const ownerSummary = workerPerformedTask
    ? `Sir, Agent Zero reviewed the Paperclip workforce flow and can report the worker result. Paperclip issue/work-product writes remain blocked: ${paperclipStorageBlocker.replace(/[_-]+/g, ' ')}.`
    : `Sir, Gateway routed the owner request through Pi, Agent Zero, and Paperclip planning, but no worker result was provided. Blocker: ${finalBlocker.replace(/[_-]+/g, ' ')}.`

  return {
    ok: false,
    mode: 'paperclip_gateway_workforce_flow_dry_run',
    generated_at: input.generatedAt,
    flow_id: buildPaperclipWorkforceFlowId(input.generatedAt),
    owner_request: ownerRequest,
    selected_route: ['owner', 'gateway', 'pi', 'agent_zero', 'paperclip', 'worker', 'gateway', 'agent_zero', 'owner'],
    endpoints: {
      paperclip_status: '/api/bridge/paperclip/status',
      paperclip_tasks: '/api/bridge/paperclip/tasks',
      paperclip_workforce_flow: '/api/bridge/paperclip/workforce-flow',
      paperclip_issues: '/api/bridge/paperclip/issues',
    },
    phases: [
      { phase: 271, name: 'Owner request enters Gateway', status: 'recorded', summary: 'Owner request normalized and accepted by Gateway policy intake.', blocked_reason: null },
      { phase: 272, name: 'Pi recommends route', status: 'recorded', summary: `Pi recommends ${piRecommendation.recommendation.recommended_agent} in shadow mode.`, blocked_reason: piRecommendation.recommendation.blocked_reason },
      { phase: 273, name: 'Agent Zero approves mission', status: 'recorded', summary: 'Agent Zero approves planning and remains final commander.', blocked_reason: null },
      { phase: 274, name: 'Paperclip creates issue/task', status: 'blocked', summary: 'Paperclip issue creation is planned but not executed.', blocked_reason: paperclipStorageBlocker },
      { phase: 275, name: 'Paperclip assigns worker/co-worker', status: 'blocked', summary: `Worker assignment targets ${task.assignment.target}.`, blocked_reason: paperclipStorageBlocker },
      { phase: 276, name: 'Worker performs task', status: workerPerformedTask ? 'recorded' : 'blocked', summary: workerPerformedTask ? 'Read-only worker result supplied for validation.' : 'No worker result supplied; no task execution occurred.', blocked_reason: workerPerformedTask ? null : validationBlockedReason },
      { phase: 277, name: 'Paperclip records work product', status: 'blocked', summary: 'Work product storage remains gated.', blocked_reason: paperclipStorageBlocker },
      { phase: 278, name: 'Gateway validates result', status: workerPerformedTask ? 'validated' : 'blocked', summary: workerPerformedTask ? 'Gateway accepted the supplied worker result for Agent Zero reporting.' : 'Gateway cannot accept completion without a worker result.', blocked_reason: validationBlockedReason },
      { phase: 279, name: 'Agent Zero reports to owner', status: 'reported', summary: ownerSummary, blocked_reason: null },
      { phase: 280, name: 'Audit trail stored in both systems', status: 'blocked', summary: 'Gateway audit is in payload; Paperclip audit storage is blocked until Bridge Session and write adapter.', blocked_reason: paperclipStorageBlocker },
    ],
    pi_route_recommendation: {
      recommendation_id: piRecommendation.recommendation_id,
      requester: piRecommendation.requester,
      recommendation: piRecommendation.recommendation,
      advisory_contract: piRecommendation.advisory_contract,
    },
    agent_zero_approval: {
      commander: 'agent_zero',
      mission_approved_for_planning: true,
      mission_approved_for_execution: false,
      final_decision_authority: true,
      approval_summary: 'Agent Zero approves planning only; execution and Paperclip writes remain Gateway/Bridge Session gated.',
    },
    paperclip_issue_task: {
      paperclip_creates_issue: true,
      issue_created: false,
      issue_id: null,
      title: task.task_issue.title,
      status: 'not_created',
      blocked_reason: paperclipStorageBlocker,
    },
    worker_assignment: {
      paperclip_assigns_worker: true,
      assigned: false,
      worker: task.assignment.target,
      worker_role: task.assignment.target_role,
      blocked_reason: paperclipStorageBlocker,
    },
    worker_execution: {
      worker_performs_task: workerPerformedTask,
      execution_mode: workerPerformedTask ? 'supplied_read_only_result' : 'not_executed',
      result_summary: resultSummary || null,
      external_write: false,
      execution_enabled: false,
      writes_enabled: false,
      blocked_reason: workerPerformedTask ? null : validationBlockedReason,
    },
    work_product: {
      paperclip_records_work_product: true,
      work_product_recorded: false,
      work_product_id: null,
      summary: resultSummary || null,
      blocked_reason: paperclipStorageBlocker,
    },
    gateway_validation: {
      gateway_validates_result: true,
      valid: workerPerformedTask,
      decision: validationDecision,
      blocked_reason: validationBlockedReason,
    },
    agent_zero_owner_report: {
      agent_zero_reports_to_owner: true,
      owner_visible_summary: ownerSummary,
      no_fake_done: true,
    },
    audit: {
      gateway_audit_stored: true,
      paperclip_audit_stored: false,
      paperclip_audit_blocked_reason: paperclipStorageBlocker,
      gateway_audit_log: [
        workforceFlowAuditEvent('owner_request_entered_gateway', 'owner', 'gateway', 'recorded'),
        workforceFlowAuditEvent('pi_recommended_route', 'pi', 'gateway', 'recorded'),
        workforceFlowAuditEvent('agent_zero_approved_planning_mission', 'agent_zero', 'gateway', 'recorded'),
        workforceFlowAuditEvent('gateway_validated_worker_result', 'gateway', 'agent_zero', workerPerformedTask ? 'validated' : 'blocked'),
        workforceFlowAuditEvent('agent_zero_owner_report_prepared', 'agent_zero', 'owner', 'reported'),
      ],
      paperclip_audit_log: [
        workforceFlowAuditEvent('paperclip_issue_creation_blocked_until_session_and_adapter', 'gateway', 'paperclip', 'blocked'),
        workforceFlowAuditEvent('paperclip_worker_assignment_blocked_until_session_and_adapter', 'gateway', 'paperclip', 'blocked'),
        workforceFlowAuditEvent('paperclip_work_product_storage_blocked_until_session_and_adapter', 'gateway', 'paperclip', 'blocked'),
        workforceFlowAuditEvent('paperclip_audit_storage_blocked_until_session_and_adapter', 'gateway', 'paperclip', 'blocked'),
      ],
    },
    policy_result: policyResult,
    blocked_reason: finalBlocker,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

export async function buildPaperclipHermesProposalPayload(input: {
  proposalKind?: string | null
  title?: string | null
  objective?: string | null
  routineSteps?: string[] | null
  miniAgentScope?: string[] | null
  generatedAt: string
  fetchImpl?: FetchLike
  baseUrl?: string | null
}): Promise<PaperclipHermesProposalPayload> {
  const status = await buildPaperclipStatusPayload({
    generatedAt: input.generatedAt,
    fetchImpl: input.fetchImpl,
    baseUrl: input.baseUrl,
  })
  const proposalKind = normalizePaperclipProposalKind(input.proposalKind)
  const title = sanitizeOwnerText(input.title || paperclipProposalDefaultTitle(proposalKind)).slice(0, 180) || paperclipProposalDefaultTitle(proposalKind)
  const objective = sanitizeOwnerText(input.objective || 'Design a safe Paperclip workforce proposal for Agent Zero review.').slice(0, 1000)
  const routineSteps = (input.routineSteps || [])
    .map((step) => sanitizeOwnerText(step).slice(0, 220))
    .filter(Boolean)
    .slice(0, 8)
  const miniAgentScope = (input.miniAgentScope || [])
    .map((item) => sanitizeOwnerText(item).slice(0, 220))
    .filter(Boolean)
    .slice(0, 8)
  const blockedReason = status.blocker || (!status.reachable ? 'paperclip_status_not_reachable' : 'active_bridge_session_and_paperclip_write_adapter_required_for_issue_or_work_product_storage')
  const steps = routineSteps.length ? routineSteps : [
    'Confirm objective and owner-visible output contract.',
    'Select assigned agent or mini-agent under Agent Zero supervision.',
    'Check Gateway policy and Bridge Session scope before any mutation.',
    'Record result as Paperclip issue/work product only after write adapter approval.',
  ]
  const scope = miniAgentScope.length ? miniAgentScope : [
    'read-only planning',
    'no external writes',
    'no direct secret access',
    'return proposal to Agent Zero for review',
  ]

  return {
    ok: false,
    mode: 'paperclip_hermes_proposal_handoff',
    generated_at: input.generatedAt,
    proposal_id: buildPaperclipProposalId(input.generatedAt),
    requester: 'hermes',
    selected_route: ['hermes', 'gateway', 'agent_zero', 'paperclip'],
    proposal_kind: proposalKind,
    title,
    objective,
    hermes_can_see_paperclip_registry: true,
    paperclip_status_endpoint: '/api/bridge/paperclip/status',
    paperclip_tasks_endpoint: '/api/bridge/paperclip/tasks',
    paperclip_proposals_endpoint: '/api/bridge/paperclip/proposals',
    visible_registries: [
      { name: 'Paperclip status', endpoint: '/api/bridge/paperclip/status', access: 'read_only' },
      { name: 'Paperclip companies', endpoint: '/api/bridge/paperclip/companies', access: 'read_only' },
      { name: 'Paperclip agents', endpoint: '/api/bridge/paperclip/agents', access: 'read_only' },
      { name: 'Paperclip issues/tasks', endpoint: '/api/bridge/paperclip/issues', access: 'read_only' },
      { name: 'Gateway Paperclip task handoff', endpoint: '/api/bridge/paperclip/tasks', access: 'read_only' },
    ],
    design_authority: {
      can_design_workflow_task_template: true,
      can_propose_mini_agent_spec: true,
      can_draft_paperclip_routine: true,
      can_create_skill_proposal_document: true,
      can_activate_execution: false,
      activation_requires: 'agent_zero_gateway_bridge_session',
    },
    proposal: {
      workflow_task_template: {
        goal: objective,
        steps,
        success_criteria: [
          'Agent Zero reviews and accepts the plan.',
          'Gateway policy allows the selected route.',
          'No execution happens until Bridge Session scope exists for protected actions.',
        ],
      },
      mini_agent_spec: {
        parent_supervisor: 'agent_zero',
        scope,
        memory_ttl: '24h',
        forbidden_tools: ['raw_shell', 'docker_socket', 'direct_secret_read', 'zapier_write', 'heygen_generation', 'smb_mount'],
      },
      paperclip_routine: {
        cadence: 'draft_only_until_agent_zero_approval',
        heartbeat: 'status_check_and_blocker_summary',
        budget_policy: 'track_costs_when_adapter_reports_usage; no spending authority granted here',
        review_policy: 'Agent Zero reviews; owner approval required for protected actions or new execution scope',
      },
      skill_proposal_document: {
        document_created: true,
        production_file_written: false,
        sections: ['purpose', 'inputs', 'assigned_agents', 'policy_gates', 'blocked_actions', 'tests', 'rollback'],
      },
    },
    storage: {
      paperclip_issue_recorded: false,
      work_product_recorded: false,
      issue_id: null,
      work_product_id: null,
      blocked_reason: blockedReason,
    },
    review: {
      agent_zero_review_required: true,
      owner_approval_required_if_protected_action: true,
      hermes_final_authority: false,
    },
    gateway_audit_log: [
      handoffAuditEvent('hermes_read_paperclip_registry', 'hermes', 'gateway', 'recorded'),
      handoffAuditEvent('hermes_drafted_paperclip_proposal', 'hermes', 'agent_zero', 'recorded'),
      handoffAuditEvent('paperclip_issue_or_work_product_storage_blocked_until_session_and_adapter', 'gateway', 'paperclip', 'blocked'),
      handoffAuditEvent('agent_zero_review_required', 'gateway', 'agent_zero', 'recorded'),
    ],
    response_text: `Sir, Hermes can draft this Paperclip proposal for Agent Zero review, but Paperclip storage is blocked: ${blockedReason.replace(/[_-]+/g, ' ')}. No execution or external write occurred.`,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

export async function buildPaperclipSpaceAgentResearchTaskPayload(input: {
  requester?: string | null
  taskType?: string | null
  request?: string | null
  responsibleAgent?: string | null
  generatedAt: string
  firecrawlConfigured?: boolean
  bridgeSessionActive?: boolean
  fetchImpl?: FetchLike
  baseUrl?: string | null
  evidence?: Array<{ summary: string; url?: string | null; source?: string | null; retrieved_at?: string | null }>
  webSources?: Array<{ url?: string | null; title?: string | null; type?: string | null; retrieved_at?: string | null; method?: string | null; status?: string | null }>
  youtubeSources?: Array<{ video_url?: string | null; title?: string | null; channel?: string | null; status?: string | null }>
}): Promise<PaperclipSpaceAgentResearchTaskPayload> {
  const requester = normalizePaperclipRequester(input.requester)
  const ownerRequest = sanitizeOwnerText(input.request || 'Prepare a read-only SpaceAgent research packet for Agent Zero review.').slice(0, 1600)
  const taskType = normalizePaperclipSpaceAgentResearchTaskType(input.taskType, ownerRequest)
  const responsibleAgent = normalizePaperclipResearchResponsibleAgent(input.responsibleAgent)
  const status = await buildPaperclipStatusPayload({
    generatedAt: input.generatedAt,
    fetchImpl: input.fetchImpl,
    baseUrl: input.baseUrl,
  })
  const storageBlockedReason = status.blocker || (!status.reachable ? 'paperclip_status_not_reachable' : input.bridgeSessionActive ? 'paperclip_write_adapter_not_configured_for_research_issue_and_work_product_storage' : 'active_bridge_session_and_paperclip_write_adapter_required_for_research_issue_and_work_product_storage')
  const requestBlockedReason = requester !== 'agent_zero'
    ? 'paperclip_space_agent_research_tasks_must_be_requested_by_agent_zero_through_gateway'
    : storageBlockedReason
  const completion = createSpaceAgentResearchCompletion({
    request: ownerRequest,
    requestedBy: 'agent_zero',
    responsibleAgent,
    generatedAt: input.generatedAt,
    firecrawlConfigured: Boolean(input.firecrawlConfigured),
    evidence: normalizePaperclipResearchEvidence(input.evidence),
    webSources: normalizePaperclipResearchWebSources(input.webSources),
    youtubeSources: normalizePaperclipResearchYouTubeSources(input.youtubeSources),
  })
  const validation = completion.handoff.gateway_validation
  const nextStep = completion.responsible_agent_next_step
  const taskStatus = validation.decision === 'needs_more_research' ? 'needs_more_research' : validation.decision === 'blocked' ? 'blocked' : 'recorded'

  return {
    ok: false,
    mode: 'paperclip_space_agent_research_task_handoff',
    generated_at: input.generatedAt,
    task_id: buildPaperclipResearchTaskId(input.generatedAt),
    requester: requester === 'agent_zero' ? 'agent_zero' : 'blocked',
    task_type: taskType,
    owner_request: ownerRequest,
    selected_route: ['agent_zero', 'gateway', 'paperclip', 'space_agent'],
    return_route: ['space_agent', 'gateway', 'agent_zero'],
    paperclip_status_endpoint: '/api/bridge/paperclip/status',
    paperclip_agents_endpoint: '/api/bridge/paperclip/agents',
    paperclip_issues_endpoint: '/api/bridge/paperclip/issues',
    paperclip_research_tasks_endpoint: '/api/bridge/paperclip/research-tasks',
    paperclip_agent: paperclipSpaceAgentTaskAgent(),
    task_assignment: {
      space_agent_can_receive_web_research_task: true,
      space_agent_can_receive_youtube_research_task: true,
      space_agent_can_receive_firecrawl_task: true,
      execution_enabled: false,
      writes_enabled: false,
    },
    paperclip_tracking: {
      paperclip_tracks_research_issue: true,
      paperclip_research_issue_recorded: false,
      issue_id: null,
      status: 'not_created',
      blocked_reason: requestBlockedReason,
    },
    research_packet: completion.handoff.packet,
    research_completion: completion,
    work_product: {
      paperclip_stores_work_product: true,
      paperclip_work_product_recorded: false,
      work_product_id: null,
      blocked_reason: requestBlockedReason,
    },
    gateway_validation: {
      gateway_validates_evidence: true,
      decision: validation.decision,
      valid: validation.valid,
      evidence_count: validation.evidence_count,
      source_count: validation.source_count,
      citations_count: validation.citations_count,
      blocked_reason: validation.decision === 'accepted' ? null : validation.blockers[0] || completion.handoff.agent_zero_decision.rationale || null,
    },
    agent_zero_next_step: {
      agent_zero_routes_next_step: true,
      decision: completion.handoff.agent_zero_decision.decision,
      next_agent: completion.handoff.agent_zero_decision.next_agent,
      execution_enabled: false,
    },
    responsible_agent_completion: {
      responsible_agent_completes_final_task: nextStep.status === 'completed',
      responsible_agent: nextStep.agent,
      status: nextStep.status,
      external_write: false,
      execution_enabled: false,
      writes_enabled: false,
    },
    gateway_audit_log: [
      researchAuditEvent('space_agent_appears_as_paperclip_agent', 'paperclip', 'space_agent', 'recorded'),
      researchAuditEvent('paperclip_research_issue_tracking_planned', 'agent_zero', 'paperclip', requester === 'agent_zero' ? 'recorded' : 'blocked'),
      researchAuditEvent('space_agent_research_packet_returned', 'space_agent', 'gateway', taskStatus),
      researchAuditEvent('paperclip_work_product_storage_blocked_until_session_and_adapter', 'gateway', 'paperclip', 'blocked'),
      researchAuditEvent('gateway_validated_research_evidence', 'gateway', 'agent_zero', taskStatus),
      researchAuditEvent('agent_zero_routes_next_step', 'agent_zero', nextStep.agent, taskStatus),
      researchAuditEvent('responsible_agent_final_task_planned', nextStep.agent, 'agent_zero', taskStatus),
    ],
    response_text: nextStep.status === 'completed'
      ? `Sir, SpaceAgent appears as a Paperclip agent and returned a Research Packet for Agent Zero routing. Paperclip issue/work-product storage is still blocked: ${requestBlockedReason.replace(/[_-]+/g, ' ')}.`
      : `Sir, SpaceAgent appears as a Paperclip agent and returned a safe Research Packet, but the downstream final task is not complete yet: ${(completion.final_answer.blocked_reason || 'research_packet_needs_more_evidence').replace(/[_-]+/g, ' ')}. Paperclip storage is blocked: ${requestBlockedReason.replace(/[_-]+/g, ' ')}.`,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

export async function buildPaperclipPiDispatcherRecommendationPayload(input: {
  ownerRequest?: string | null
  generatedAt: string
  fetchImpl?: FetchLike
  baseUrl?: string | null
}): Promise<PaperclipPiDispatcherRecommendationPayload> {
  const ownerRequest = sanitizeOwnerText(input.ownerRequest || 'Recommend a safe Paperclip task route.').slice(0, 1000)
  const [status, queue] = await Promise.all([
    buildPaperclipStatusPayload({ generatedAt: input.generatedAt, fetchImpl: input.fetchImpl, baseUrl: input.baseUrl }),
    listPaperclipIssues({ generatedAt: input.generatedAt, fetchImpl: input.fetchImpl, baseUrl: input.baseUrl }),
  ])
  const recommendedAgent = recommendPaperclipAssigneeForOwnerRequest(ownerRequest)
  const storageBlockedReason = status.blocker || queue.blocker || (!status.reachable ? 'paperclip_status_not_reachable' : 'active_bridge_session_and_paperclip_write_adapter_required_for_dispatcher_recommendation_storage')
  const policyResult: PaperclipTaskPolicyResult = /credential|auth|token|api/i.test(storageBlockedReason)
    ? 'missing_credential'
    : status.blocker || queue.blocker || !status.reachable
      ? 'blocked'
      : 'requires_session'
  const createMiniAgent = shouldRecommendPaperclipMiniAgent(ownerRequest, recommendedAgent)

  return {
    ok: false,
    mode: 'paperclip_pi_dispatcher_recommendation',
    generated_at: input.generatedAt,
    recommendation_id: buildPaperclipRecommendationId(input.generatedAt),
    requester: 'pi',
    selected_route: ['pi', 'gateway', 'agent_zero', 'paperclip'],
    task_queue_visible: true,
    paperclip_status_endpoint: '/api/bridge/paperclip/status',
    paperclip_task_queue_endpoint: '/api/bridge/paperclip/issues',
    paperclip_tasks_endpoint: '/api/bridge/paperclip/tasks',
    paperclip_dispatcher_recommendations_endpoint: '/api/bridge/paperclip/dispatcher-recommendations',
    queue_summary: {
      paperclip_reachable: status.reachable && queue.paperclip_reachable,
      active_issue_count: queue.count,
      blocker: queue.blocker || status.blocker,
    },
    owner_request: ownerRequest,
    recommendation: {
      recommended_agent: recommendedAgent,
      recommended_agent_reason: paperclipAssigneeRole(recommendedAgent),
      budget_route: recommendPaperclipBudgetRoute(ownerRequest),
      model_provider_route: recommendPaperclipModelRoute(ownerRequest),
      create_mini_agent: createMiniAgent,
      mini_agent_reason: createMiniAgent ? 'Task is scoped or repeatable enough for a supervised mini-agent proposal.' : null,
      policy_result: policyResult,
      blocked_reason: storageBlockedReason,
    },
    advisory_contract: {
      shadow_mode: true,
      output_is_advisory_until_proven: true,
      pi_can_execute: false,
      gateway_policy_required: true,
      agent_zero_final_decision_required: true,
    },
    storage: {
      paperclip_recommendation_recorded: false,
      work_product_recorded: false,
      issue_id: null,
      work_product_id: null,
      blocked_reason: storageBlockedReason,
    },
    final_decision: {
      agent_zero_makes_final_decision: true,
      owner_approval_required_if_protected_action: true,
      gateway_logs_final_route_decision: true,
    },
    gateway_audit_log: [
      handoffAuditEvent('pi_read_paperclip_task_queue', 'pi', 'paperclip', queue.ok ? 'recorded' : 'blocked'),
      handoffAuditEvent('pi_recommended_paperclip_task_route', 'pi', 'gateway', 'recorded'),
      handoffAuditEvent('paperclip_dispatcher_recommendation_storage_blocked_until_session_and_adapter', 'gateway', 'paperclip', 'blocked'),
      handoffAuditEvent('agent_zero_final_route_decision_required', 'gateway', 'agent_zero', 'recorded'),
    ],
    response_text: `Sir, Pi can recommend a Paperclip route in shadow mode, but it cannot execute or store the recommendation yet. Blocker: ${storageBlockedReason.replace(/[_-]+/g, ' ')}. Agent Zero makes the final decision.`,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

type PaperclipGatewayRecordMappingProfile = {
  source: PaperclipGatewayRecordSource
  targets: PaperclipGatewayRecordTarget[]
  defaultTitle: string
  summary: string
  event: string
}

const PAPERCLIP_GATEWAY_RECORD_MAPPING_PROFILES: Record<PaperclipGatewayRecordMappingKind, PaperclipGatewayRecordMappingProfile> = {
  gateway_mission_to_issue: {
    source: "gateway",
    targets: ["paperclip_issue"],
    defaultTitle: "Gateway mission tracking issue",
    summary: "Gateway mission to a Paperclip issue",
    event: "gateway_mission_mapped_to_paperclip_issue",
  },
  owner_command_to_issue: {
    source: "owner",
    targets: ["paperclip_issue"],
    defaultTitle: "Owner command tracking issue",
    summary: "owner command to a Paperclip issue",
    event: "owner_command_mapped_to_paperclip_issue",
  },
  mini_agent_task_to_issue: {
    source: "mini_agent",
    targets: ["paperclip_issue"],
    defaultTitle: "Mini-agent task tracking issue",
    summary: "mini-agent task to a Paperclip issue",
    event: "mini_agent_task_mapped_to_paperclip_issue",
  },
  space_agent_research_packet_to_work_product: {
    source: "space_agent",
    targets: ["paperclip_work_product"],
    defaultTitle: "SpaceAgent Research Packet work product",
    summary: "SpaceAgent Research Packet to a Paperclip work product",
    event: "space_agent_research_packet_mapped_to_work_product",
  },
  hermes_skill_proposal_to_issue_work_product: {
    source: "hermes",
    targets: ["paperclip_issue", "paperclip_work_product"],
    defaultTitle: "Hermes skill proposal tracking record",
    summary: "Hermes skill proposal to a Paperclip issue and work product",
    event: "hermes_skill_proposal_mapped_to_issue_and_work_product",
  },
  pi_recommendation_to_issue_comment: {
    source: "pi",
    targets: ["paperclip_issue_comment"],
    defaultTitle: "Pi dispatcher recommendation comment",
    summary: "Pi recommendation to a Paperclip issue comment",
    event: "pi_recommendation_mapped_to_issue_comment",
  },
  agent_zero_decision_to_issue_approval: {
    source: "agent_zero",
    targets: ["paperclip_issue_approval"],
    defaultTitle: "Agent Zero decision approval",
    summary: "Agent Zero decision to a Paperclip issue approval",
    event: "agent_zero_decision_mapped_to_issue_approval",
  },
  bridge_session_to_governance_event: {
    source: "bridge_session",
    targets: ["paperclip_governance_event"],
    defaultTitle: "Bridge Session governance event",
    summary: "Bridge Session to a Paperclip governance event",
    event: "bridge_session_mapped_to_governance_event",
  },
  completed_task_to_final_report: {
    source: "paperclip",
    targets: ["paperclip_final_report"],
    defaultTitle: "Completed task final report",
    summary: "completed task to a final report",
    event: "completed_task_mapped_to_final_report",
  },
  blocked_task_to_exact_blocker: {
    source: "gateway",
    targets: ["paperclip_blocker"],
    defaultTitle: "Blocked task exact blocker",
    summary: "blocked task to an exact blocker",
    event: "blocked_task_mapped_to_exact_blocker",
  },
}

export function buildPaperclipGatewayRecordMapping(input: PaperclipGatewayRecordMappingInput): PaperclipGatewayRecordMapping {
  const kind = normalizePaperclipGatewayRecordMappingKind(input.kind)
  const storageBlocker = "active_bridge_session_and_paperclip_write_adapter_required_for_record_mapping_storage"
  const fallbackTitle = kind ? PAPERCLIP_GATEWAY_RECORD_MAPPING_PROFILES[kind].defaultTitle : "Unknown Gateway Paperclip mapping"
  const title = sanitizeOwnerText(input.title || fallbackTitle).slice(0, 180) || fallbackTitle
  const sourceId = sanitizeIdentifier(sanitizeOwnerText(input.sourceId || "")) || null

  if (!kind) {
    return {
      ok: false,
      mode: "paperclip_gateway_record_mapping_dry_run",
      generated_at: input.generatedAt,
      mapping_id: buildPaperclipGatewayRecordMappingId(input.generatedAt, "unknown"),
      kind: "unknown",
      source: "gateway",
      targets: [],
      title,
      source_id: sourceId,
      paperclip_write_recorded: false,
      paperclip_ids: [],
      policy_result: "blocked",
      blocked_reason: "paperclip_gateway_record_mapping_kind_unknown",
      mapped_blocker: null,
      paperclip_storage_blocker: storageBlocker,
      requires_bridge_session: true,
      write_adapter_configured: false,
      external_write: false,
      owner_visible_summary: "Paperclip mapping is blocked because the Gateway record mapping kind is unknown.",
      audit_log: [handoffAuditEvent("paperclip_gateway_record_mapping_kind_blocked", "gateway", "paperclip", "blocked")],
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    }
  }

  const profile = PAPERCLIP_GATEWAY_RECORD_MAPPING_PROFILES[kind]
  const mappedBlocker = kind === "blocked_task_to_exact_blocker"
    ? sanitizeIdentifier(sanitizeOwnerText(input.blocker || "")) || "paperclip_task_blocked_exact_reason_required"
    : null
  const missingExactBlocker = kind === "blocked_task_to_exact_blocker" && mappedBlocker === "paperclip_task_blocked_exact_reason_required"
  const blockedReason = mappedBlocker || storageBlocker

  return {
    ok: !missingExactBlocker,
    mode: "paperclip_gateway_record_mapping_dry_run",
    generated_at: input.generatedAt,
    mapping_id: buildPaperclipGatewayRecordMappingId(input.generatedAt, kind),
    kind,
    source: profile.source,
    targets: [...profile.targets],
    title,
    source_id: sourceId,
    paperclip_write_recorded: false,
    paperclip_ids: [],
    policy_result: missingExactBlocker ? "blocked" : "requires_session",
    blocked_reason: blockedReason,
    mapped_blocker: mappedBlocker,
    paperclip_storage_blocker: storageBlocker,
    requires_bridge_session: true,
    write_adapter_configured: false,
    external_write: false,
    owner_visible_summary: mappedBlocker
      ? `Paperclip would record the blocked task reason as ${mappedBlocker}; storage remains gated by Bridge Session and adapter support.`
      : `Paperclip would map ${profile.summary}; storage remains gated by Bridge Session and adapter support.`,
    audit_log: [
      handoffAuditEvent(profile.event, profile.source, profile.targets[0] || "paperclip", missingExactBlocker ? "blocked" : "recorded"),
      handoffAuditEvent("paperclip_record_write_blocked_until_session_and_adapter", "gateway", "paperclip", "blocked"),
    ],
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}


type PaperclipSandboxHeartbeatRoutineProfile = {
  id: PaperclipSandboxHeartbeatRoutineId
  title: string
  owner: PaperclipSandboxHeartbeatOwner
  purpose: string
}

const PAPERCLIP_SANDBOX_HEARTBEAT_ROUTINE_PROFILES: PaperclipSandboxHeartbeatRoutineProfile[] = [
  {
    id: 'daily_status',
    title: 'Daily Paperclip workforce status routine',
    owner: 'gateway',
    purpose: 'Summarize workforce status, active issues, blockers, and safe next checks for Agent Zero.',
  },
  {
    id: 'daily_connector_health',
    title: 'Daily connector health routine',
    owner: 'gateway',
    purpose: 'Check configured connector health in read-only mode and report blocked integrations honestly.',
  },
  {
    id: 'daily_hermes_skill_proposal',
    title: 'Daily Hermes skill proposal routine',
    owner: 'hermes',
    purpose: 'Ask Hermes to draft safe skill or workflow proposals for Agent Zero review without activation.',
  },
  {
    id: 'daily_pi_dispatcher_optimization',
    title: 'Daily Pi dispatcher optimization routine',
    owner: 'pi',
    purpose: 'Ask Pi to review route patterns and recommend dispatcher improvements in shadow mode only.',
  },
  {
    id: 'daily_space_agent_research_queue',
    title: 'Daily SpaceAgent research queue routine',
    owner: 'space_agent',
    purpose: 'Review pending web, YouTube, browser, or Firecrawl research needs without external writes.',
  },
  {
    id: 'daily_agent_zero_report',
    title: 'Daily Agent Zero report routine',
    owner: 'agent_zero',
    purpose: 'Prepare a commander summary report for owner review without delivery writes unless session-scoped.',
  },
]

export function buildPaperclipSandboxHeartbeatPlan(input: PaperclipSandboxHeartbeatPlanInput): PaperclipSandboxHeartbeatPlan {
  const sandbox = input.sandbox !== false
  const dayKey = paperclipHeartbeatDayKey(input.generatedAt)
  const existingKeys = new Set(sanitizePaperclipList(input.existingHeartbeatKeys || [], 30, 160))
  const pausedAgents = normalizePaperclipHeartbeatPausedAgents(input.pausedAgents || [])
  const budget = normalizePaperclipHeartbeatBudget(input.monthlyBudgetCents, input.projectedCostCents)
  const duplicateKeys: string[] = []
  const skippedRoutines: PaperclipSandboxHeartbeatRoutineId[] = []

  const routines = PAPERCLIP_SANDBOX_HEARTBEAT_ROUTINE_PROFILES.map((profile) => {
    const duplicateGuardKey = `paperclip_heartbeat_${profile.id}_${dayKey}`
    const duplicate = existingKeys.has(duplicateGuardKey)
    const paused = pausedAgents.includes(profile.owner)
    let status: PaperclipSandboxHeartbeatStatus = 'sandbox_ready'
    let statusReason: string | null = null

    if (!sandbox) {
      status = 'sandbox_only_blocked'
      statusReason = 'paperclip_heartbeat_sandbox_only'
    } else if (paused) {
      status = 'paused_skipped'
      statusReason = 'paperclip_heartbeat_agent_paused'
      skippedRoutines.push(profile.id)
    } else if (duplicate) {
      status = 'duplicate_blocked'
      statusReason = 'paperclip_heartbeat_duplicate_guard_blocked'
      duplicateKeys.push(duplicateGuardKey)
    } else if (budget.status !== 'within_budget') {
      status = 'budget_blocked'
      statusReason = budget.blocked_reason
    }

    return {
      id: profile.id,
      title: profile.title,
      cadence: 'daily' as const,
      owner: profile.owner,
      purpose: profile.purpose,
      duplicate_guard_key: duplicateGuardKey,
      status,
      status_reason: statusReason,
      sandbox_only: true as const,
      production_enabled: false as const,
      budget_preflight_required: true as const,
      bridge_session_required_for_writes: true as const,
      external_writes_enabled: false as const,
      execution_enabled: false as const,
      writes_enabled: false as const,
    }
  })

  const blockedReason = !sandbox
    ? 'paperclip_heartbeat_sandbox_only'
    : budget.status !== 'within_budget'
      ? budget.blocked_reason
      : duplicateKeys.length > 0
        ? 'paperclip_heartbeat_duplicate_guard_blocked'
        : skippedRoutines.length > 0
          ? 'paperclip_heartbeat_paused_agents_skipped'
          : null

  return {
    ok: sandbox && budget.status === 'within_budget',
    mode: 'paperclip_sandbox_heartbeat_plan',
    generated_at: input.generatedAt,
    sandbox_heartbeat_enabled: sandbox,
    production_heartbeat_enabled: false,
    heartbeat_execution_enabled: false,
    routines,
    duplicate_work_guard: {
      enabled: true,
      duplicate_guard_keys: routines.map((routine) => routine.duplicate_guard_key),
      duplicates_blocked: duplicateKeys,
      duplicate_work_detected: duplicateKeys.length > 0,
    },
    budget_enforcement: {
      required_before_execution: true,
      monthly_budget_cents: budget.monthly_budget_cents,
      projected_cost_cents: budget.projected_cost_cents,
      status: budget.status,
      execution_blocked: budget.status !== 'within_budget',
      blocked_reason: budget.blocked_reason,
    },
    paused_agent_guard: {
      enabled: true,
      paused_agents: pausedAgents,
      skipped_routines: skippedRoutines,
    },
    blocked_reason: blockedReason,
    owner_visible_summary: sandbox
      ? 'Paperclip heartbeat routines are defined for sandbox validation only. Production persistence and writes remain disabled.'
      : 'Paperclip heartbeat routines are blocked outside sandbox mode.',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}


export function buildPaperclipTokenGovernorPlan(input: PaperclipTokenGovernorPlanInput): PaperclipTokenGovernorPlan {
  const alertThreshold = normalizePaperclipPercent(input.alertPercent, 75)
  const defaultHardStop = normalizePaperclipPercent(input.hardStopPercent, 90)
  const budgets = input.budgets.map((budget) => buildPaperclipTokenGovernorBudgetDecision(budget, alertThreshold, defaultHardStop))
  const alerts = budgets.filter((budget) => budget.status === 'alert')
  const hardStops = budgets.filter((budget) => budget.status === 'hard_stop' || budget.status === 'missing_budget')
  const pausedAgents = budgets.filter((budget) => budget.pause_runaway_agent)
  const blockedReason = hardStops.length > 0
    ? 'paperclip_token_governor_hard_stop_or_missing_budget'
    : pausedAgents.length > 0
      ? 'paperclip_token_governor_runaway_agent_pause_required'
      : null

  return {
    ok: hardStops.length === 0,
    mode: 'paperclip_token_governor_dry_run',
    generated_at: input.generatedAt,
    concept: 'gateway_token_governor_for_paperclip',
    imported_into_paperclip: true,
    production_enforcement_enabled: false,
    budget_scopes: [...PAPERCLIP_TOKEN_GOVERNOR_BUDGET_SCOPES],
    alert_threshold_percent: alertThreshold,
    default_hard_stop_percent: defaultHardStop,
    budgets,
    alerts,
    hard_stops: hardStops,
    paused_agents: pausedAgents,
    cost_audit_events: budgets.map((budget) => ({
      event: 'paperclip.token_governor.cost_event' as const,
      scope: budget.scope,
      subject_id: budget.id,
      subject_name: budget.name,
      spent_cents: budget.spent_cents,
      projected_cents: budget.projected_cents,
      usage_percent: budget.usage_percent,
      decision: budget.decision,
      blocked_reason: budget.blocked_reason,
      recorded_at: input.generatedAt,
      external_write: false as const,
      no_secrets_exposed: true as const,
      raw_paths_exposed: false as const,
    })),
    blocked_reason: blockedReason,
    owner_visible_summary: 'Paperclip Token Governor is imported as dry-run budget governance. Alerts, hard stops, paused-agent decisions, and cost audit events are modeled without enabling live execution.',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}


export function buildPaperclipCredentialModePlan(input: PaperclipCredentialModePlanInput): PaperclipCredentialModePlan {
  const deploymentMode = normalizePaperclipDeploymentMode(input.deploymentMode)
  const strictSecretsMode = deploymentMode === 'production' || deploymentMode === 'private'
  const credentials = input.credentials.map((credential) => buildPaperclipCredentialDecision(credential, strictSecretsMode))
  const secretScanPassed = input.secretScanPassed !== false
  const blocked = credentials.filter((credential) => credential.blocked_reason !== null)
  const scanBlocked = secretScanPassed ? null : 'paperclip_staged_secret_scan_failed'
  const noEnvLeakage = credentials.every((credential) => !credential.env_leakage_detected)
  const noAuthFileLeakage = credentials.every((credential) => !credential.auth_file_path_leakage_detected)

  return {
    ok: blocked.length === 0 && secretScanPassed && noEnvLeakage && noAuthFileLeakage,
    mode: 'paperclip_credential_modes_dry_run',
    generated_at: input.generatedAt,
    deployment_mode: deploymentMode,
    strict_secrets_mode_enabled: strictSecretsMode,
    credential_subjects: [...PAPERCLIP_CREDENTIAL_SUBJECTS],
    credentials,
    blocked,
    credential_modes_documented: true,
    secret_scan: {
      tested: true,
      passed: secretScanPassed,
      blocked_reason: scanBlocked,
    },
    no_env_leakage: noEnvLeakage,
    no_auth_file_leakage: noAuthFileLeakage,
    owner_ui_policy: {
      show_secret_refs_only: true,
      show_secret_values: false,
      show_auth_file_paths: false,
      show_configured_booleans: true,
    },
    paperclip_policy: {
      inline_keys_allowed: false,
      secret_values_visible: false,
      production_private_strict_mode: strictSecretsMode,
    },
    owner_visible_summary: strictSecretsMode
      ? 'Paperclip production/private credential mode uses strict secret references and protected local auth only. Owner UI shows configured booleans, not secret values or auth file paths.'
      : 'Paperclip sandbox credential mode still forbids inline keys and owner-visible auth file paths.',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}



const PAPERCLIP_WORKSPACE_DEFINITIONS: Record<PaperclipWorkspaceId, PaperclipWorkspaceDefinition> = {
  mission_control: {
    id: 'mission_control',
    name: 'Mission Control',
    kind: 'gateway_control_plane',
    role: 'Gateway dashboard, API, policy, registry, reports, and owner control plane',
    repository_ref: 'repo_ref_mission_control',
    workspace_ref: 'workspace_ref_mission_control',
    status: 'mapped',
    coding_tasks_allowed: true,
    isolated_worktree_required_for_coding: true,
    protected_outputs_ref: 'paperclip_outputs_mission_control',
    gateway_node_id: 'gateway_mission_control',
    paperclip_issue_attachment_supported: true,
    raw_path_exposed: false,
  },
  claudeclaw_openclaw: {
    id: 'claudeclaw_openclaw',
    name: 'ClaudeClaw / OpenClaw+',
    kind: 'runtime_skills_layer',
    role: 'Runtime / Skills Engine for agents, skills, functions, reports, approvals, runtime ledgers, mini-agent execution, and tool execution after Paperclip workforce supervision',
    repository_ref: 'repo_ref_claudeclaw_openclaw',
    workspace_ref: 'workspace_ref_claudeclaw_openclaw',
    status: 'mapped',
    coding_tasks_allowed: true,
    isolated_worktree_required_for_coding: true,
    protected_outputs_ref: 'paperclip_outputs_claudeclaw_openclaw',
    gateway_node_id: 'gateway_openclaw_runtime',
    paperclip_issue_attachment_supported: true,
    raw_path_exposed: false,
  },
  space_agent: {
    id: 'space_agent',
    name: 'SpaceAgent',
    kind: 'research_specialist',
    role: 'Browser, web, YouTube, and Firecrawl research specialist workspace',
    repository_ref: 'repo_ref_space_agent',
    workspace_ref: 'workspace_ref_space_agent',
    status: 'mapped',
    coding_tasks_allowed: true,
    isolated_worktree_required_for_coding: true,
    protected_outputs_ref: 'paperclip_outputs_space_agent',
    gateway_node_id: 'space_agent',
    paperclip_issue_attachment_supported: true,
    raw_path_exposed: false,
  },
  pi: {
    id: 'pi',
    name: 'Pi Dispatcher Candidate',
    kind: 'dispatcher_candidate',
    role: 'Gateway dispatcher candidate, route optimizer, and tool-use advisor workspace',
    repository_ref: 'repo_ref_pi_dispatcher',
    workspace_ref: 'workspace_ref_pi_dispatcher',
    status: 'mapped',
    coding_tasks_allowed: false,
    isolated_worktree_required_for_coding: true,
    protected_outputs_ref: 'paperclip_outputs_pi_dispatcher',
    gateway_node_id: 'pi_dispatcher_candidate',
    paperclip_issue_attachment_supported: true,
    raw_path_exposed: false,
  },
  paperclip: {
    id: 'paperclip',
    name: 'Paperclip Workforce Layer',
    kind: 'workforce_layer',
    role: 'Workforce operations, issues, work products, budgets, routines, and co-worker orchestration workspace',
    repository_ref: 'repo_ref_paperclip_lab',
    workspace_ref: 'workspace_ref_paperclip_lab',
    status: 'mapped',
    coding_tasks_allowed: true,
    isolated_worktree_required_for_coding: true,
    protected_outputs_ref: 'paperclip_outputs_paperclip_lab',
    gateway_node_id: 'paperclip',
    paperclip_issue_attachment_supported: true,
    raw_path_exposed: false,
  },
}

export function buildPaperclipWorkspaceMapPlan(input: PaperclipWorkspaceMapPlanInput): PaperclipWorkspaceMapPlan {
  const workspaces = PAPERCLIP_WORKSPACE_IDS.map((id) => PAPERCLIP_WORKSPACE_DEFINITIONS[id])
  const taskDecisions = (input.tasks || []).map((task) => buildPaperclipWorkspaceTaskDecision(task))
  const blocked = taskDecisions.filter((decision) => decision.blocked_reason !== null)

  return {
    ok: blocked.length === 0,
    mode: 'paperclip_workspace_map_dry_run',
    generated_at: input.generatedAt,
    workspaces,
    workspace_ids: [...PAPERCLIP_WORKSPACE_IDS],
    isolated_worktree_policy: {
      required_for_coding_tasks: true,
      create_from_correct_workspace_only: true,
      no_tasks_in_wrong_directory: true,
      raw_paths_owner_visible: false,
    },
    work_product_policy: {
      store_outputs_safely: true,
      protected_output_refs_only: true,
      attach_to_paperclip_issues: true,
      link_back_to_mission_control_gateway: true,
      paperclip_write_adapter_required: true,
      bridge_session_required_for_issue_writes: true,
    },
    task_decisions: taskDecisions,
    blocked,
    owner_visible_summary: 'Paperclip workspaces are mapped with safe workspace refs. Coding tasks require isolated worktree refs, outputs are stored as protected work-product refs, and Paperclip issue/Gateway links are planned without enabling writes.',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}



const PAPERCLIP_GATEWAY_PLUGIN_SPECS: Record<PaperclipGatewayPluginId, PaperclipGatewayPluginSpec> = {
  gateway_core: {
    id: 'gateway_core',
    name: 'Gateway Core Plugin Spec',
    kind: 'gateway_spec',
    target_node: 'gateway',
    supervisor: 'gateway',
    plugin_system: 'mission_control_explicit_plugin_loader',
    registers: ['category', 'gateway_node', 'adapter'],
    capabilities: ['route_registry', 'policy_decision', 'audit_log', 'plugin_lifecycle'],
    load_mode: 'explicit_import_only',
    production_auto_load_enabled: false,
    unload_supported: true,
    ui_contribution_safe: false,
    ui_contribution_enabled: false,
    bridge_session_required_for_writes: true,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  },
  agent_zero_adapter: {
    id: 'agent_zero_adapter',
    name: 'Agent Zero Adapter Plugin',
    kind: 'agent_adapter',
    target_node: 'agent_zero',
    supervisor: 'gateway',
    plugin_system: 'mission_control_explicit_plugin_loader',
    registers: ['gateway_node', 'adapter', 'tool_provider'],
    capabilities: ['commander_route', 'status_probe', 'test_chat_proxy', 'report_route'],
    load_mode: 'explicit_import_only',
    production_auto_load_enabled: false,
    unload_supported: true,
    ui_contribution_safe: false,
    ui_contribution_enabled: false,
    bridge_session_required_for_writes: true,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  },
  hermes_adapter: {
    id: 'hermes_adapter',
    name: 'Hermes Adapter Plugin',
    kind: 'agent_adapter',
    target_node: 'hermes',
    supervisor: 'agent_zero',
    plugin_system: 'mission_control_explicit_plugin_loader',
    registers: ['gateway_node', 'adapter', 'tool_provider'],
    capabilities: ['lieutenant_route', 'skill_design', 'workflow_design', 'test_chat_proxy'],
    load_mode: 'explicit_import_only',
    production_auto_load_enabled: false,
    unload_supported: true,
    ui_contribution_safe: false,
    ui_contribution_enabled: false,
    bridge_session_required_for_writes: true,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  },
  pi_adapter: {
    id: 'pi_adapter',
    name: 'Pi Dispatcher Adapter Plugin',
    kind: 'agent_adapter',
    target_node: 'pi_dispatcher_candidate',
    supervisor: 'gateway',
    plugin_system: 'mission_control_explicit_plugin_loader',
    registers: ['gateway_node', 'adapter'],
    capabilities: ['shadow_dispatch_recommendation', 'route_optimization', 'model_route_advice'],
    load_mode: 'explicit_import_only',
    production_auto_load_enabled: false,
    unload_supported: true,
    ui_contribution_safe: false,
    ui_contribution_enabled: false,
    bridge_session_required_for_writes: true,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  },
  space_agent_adapter: {
    id: 'space_agent_adapter',
    name: 'SpaceAgent Adapter Plugin',
    kind: 'agent_adapter',
    target_node: 'space_agent',
    supervisor: 'agent_zero',
    plugin_system: 'mission_control_explicit_plugin_loader',
    registers: ['gateway_node', 'adapter', 'tool_provider'],
    capabilities: ['web_research', 'youtube_research', 'firecrawl_research', 'research_packet'],
    load_mode: 'explicit_import_only',
    production_auto_load_enabled: false,
    unload_supported: true,
    ui_contribution_safe: false,
    ui_contribution_enabled: false,
    bridge_session_required_for_writes: true,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  },
  openclaw_runtime_adapter: {
    id: 'openclaw_runtime_adapter',
    name: 'OpenClaw+ Runtime Adapter Plugin',
    kind: 'worker_adapter',
    target_node: 'openclaw_plus',
    supervisor: 'gateway',
    plugin_system: 'mission_control_explicit_plugin_loader',
    registers: ['gateway_node', 'adapter'],
    capabilities: ['worker_runtime_status', 'buildwiki_support', 'future_agent_creation_layer'],
    load_mode: 'explicit_import_only',
    production_auto_load_enabled: false,
    unload_supported: true,
    ui_contribution_safe: false,
    ui_contribution_enabled: false,
    bridge_session_required_for_writes: true,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  },
  openclaw_skills_adapter: {
    id: 'openclaw_skills_adapter',
    name: 'OpenClaw+ Skills Adapter Plugin',
    kind: 'skills_adapter',
    target_node: 'openclaw_plus',
    supervisor: 'paperclip',
    plugin_system: 'mission_control_explicit_plugin_loader',
    registers: ['gateway_node', 'adapter', 'tool_provider'],
    capabilities: ['skill_registry', 'adapter_status', 'report_runtime', 'governance_layer', 'mini_agent_execution', 'tool_execution_after_bridge_session'],
    load_mode: 'explicit_import_only',
    production_auto_load_enabled: false,
    unload_supported: true,
    ui_contribution_safe: false,
    ui_contribution_enabled: false,
    bridge_session_required_for_writes: true,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  },
  mission_control_ui_contribution: {
    id: 'mission_control_ui_contribution',
    name: 'Mission Control Gateway UI Contribution',
    kind: 'ui_contribution',
    target_node: 'mission_control_gateway_ui',
    supervisor: 'gateway',
    plugin_system: 'mission_control_explicit_plugin_loader',
    registers: ['nav_item', 'panel'],
    capabilities: ['gateway_panel_contribution', 'node_detail_panel', 'plugin_status_badges'],
    load_mode: 'explicit_import_only',
    production_auto_load_enabled: false,
    unload_supported: true,
    ui_contribution_safe: true,
    ui_contribution_enabled: false,
    bridge_session_required_for_writes: true,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  },
}

export function buildPaperclipGatewayPluginPlan(input: PaperclipGatewayPluginPlanInput): PaperclipGatewayPluginPlan {
  const plugins = PAPERCLIP_GATEWAY_PLUGIN_IDS.map((id) => PAPERCLIP_GATEWAY_PLUGIN_SPECS[id])
  const lifecycleDecisions = (input.lifecycle || []).map((entry) => buildPaperclipGatewayPluginLifecycleDecision(entry))
  const blocked = lifecycleDecisions.filter((decision) => decision.blocked_reason !== null)

  return {
    ok: blocked.length === 0,
    mode: 'paperclip_gateway_plugin_spec_dry_run',
    generated_at: input.generatedAt,
    plugin_system_inspection: {
      loader: 'explicit_import_init_loader',
      registries: ['integrations', 'categories', 'nav_items', 'panels', 'tool_providers'],
      dynamic_env_loading_enabled: false,
      production_auto_load_enabled: false,
    },
    plugins,
    plugin_ids: [...PAPERCLIP_GATEWAY_PLUGIN_IDS],
    lifecycle_decisions: lifecycleDecisions,
    blocked,
    mission_control_ui_contribution: {
      safe_to_define: true,
      enabled: false,
      reason: 'UI contribution is specified but remains disabled until explicitly imported, smoke-tested, and approved for production load.',
    },
    owner_visible_summary: 'Gateway plugin specs are defined for adapters and UI contribution. The current Mission Control plugin system uses explicit import/init loading; production auto-load remains disabled and all lifecycle actions are dry-run only.',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}




type PaperclipBoardApprovalActionProfile = {
  action: PaperclipBoardApprovalAction
  title: string
  scope: string | null
  externalWrite: boolean
}

const PAPERCLIP_BOARD_APPROVAL_ACTION_PROFILES: Record<PaperclipBoardApprovalAction, PaperclipBoardApprovalActionProfile> = {
  co_worker_hire: {
    action: 'co_worker_hire',
    title: 'Hire Paperclip co-worker agent',
    scope: 'paperclip.coworker.hire',
    externalWrite: false,
  },
  external_write: {
    action: 'external_write',
    title: 'Generic external write',
    scope: 'external.write',
    externalWrite: true,
  },
  drive_upload: {
    action: 'drive_upload',
    title: 'Google Drive upload',
    scope: 'google_drive.upload',
    externalWrite: true,
  },
  onedrive_upload: {
    action: 'onedrive_upload',
    title: 'OneDrive upload',
    scope: 'onedrive.upload',
    externalWrite: true,
  },
  agentmail_send: {
    action: 'agentmail_send',
    title: 'AgentMail send',
    scope: 'agentmail.send',
    externalWrite: true,
  },
  buildwiki_run_now: {
    action: 'buildwiki_run_now',
    title: 'Build-Wiki Run Now',
    scope: 'buildwiki.run_now',
    externalWrite: true,
  },
  zapier_write: {
    action: 'zapier_write',
    title: 'Zapier write',
    scope: 'zapier.write',
    externalWrite: true,
  },
  heygen_generation: {
    action: 'heygen_generation',
    title: 'HeyGen generation',
    scope: 'heygen.generate',
    externalWrite: true,
  },
  smb_fork2: {
    action: 'smb_fork2',
    title: 'SMB / Fork 2',
    scope: 'smb.fork2',
    externalWrite: true,
  },
}



export function buildPaperclipUiAccessVerificationPlan(input: PaperclipUiAccessVerificationInput): PaperclipUiAccessVerificationPlan {
  const localEndpoint = resolvePaperclipEndpoint(input.localUrl || DEFAULT_PAPERCLIP_BASE_URL)
  const tailnetEndpoint = input.tailnetUrl ? resolvePaperclipEndpoint(input.tailnetUrl) : null
  const localConfirmed = input.localReachable === true && !localEndpoint.blocker
  const tailnetConfirmed = input.tailnetReachable === true && !tailnetEndpoint?.blocker
  const endpointConfirmed = localConfirmed || tailnetConfirmed
  const ownerLoginConfirmed = input.ownerLoginConfirmed === true
  const mobileViewConfirmed = input.mobileViewportConfirmed === true
  const surfaceProbes = new Map((input.surfaces || []).map((probe) => [normalizePaperclipUiSurfaceId(probe.id), probe]))
  const baseBlocker = localEndpoint.blocker || tailnetEndpoint?.blocker || (!endpointConfirmed ? "paperclip_ui_not_running" : null)
  const surfaces = PAPERCLIP_UI_ACCESS_SURFACES.map((id) => buildPaperclipUiSurfaceConfirmation(id, {
    reachable: localConfirmed || tailnetConfirmed,
    ownerLoginConfirmed,
    probe: surfaceProbes.get(id) || null,
    baseBlocker,
  }))
  const surfaceBlocker = surfaces.find((surface) => !surface.confirmed)?.blocker || null
  const blocker = baseBlocker || (!ownerLoginConfirmed ? "paperclip_owner_login_not_confirmed" : null) || surfaceBlocker || (!mobileViewConfirmed ? "paperclip_mobile_view_not_confirmed" : null)

  return {
    ok: !blocker,
    mode: "paperclip_ui_access_verification",
    generated_at: input.generatedAt,
    local_url: localEndpoint.uiLink,
    local_url_confirmed: localConfirmed,
    local_status_code: numberOrNull(input.localStatusCode),
    tailnet_url: tailnetEndpoint?.uiLink || null,
    tailnet_url_confirmed: tailnetConfirmed,
    tailnet_status_code: numberOrNull(input.tailnetStatusCode),
    owner_login_confirmed: ownerLoginConfirmed,
    company_dashboard_confirmed: isPaperclipSurfaceConfirmed(surfaces, "company_dashboard"),
    org_chart_confirmed: isPaperclipSurfaceConfirmed(surfaces, "org_chart"),
    issue_task_page_confirmed: isPaperclipSurfaceConfirmed(surfaces, "issues_tasks"),
    budget_page_confirmed: isPaperclipSurfaceConfirmed(surfaces, "budget"),
    approvals_page_confirmed: isPaperclipSurfaceConfirmed(surfaces, "approvals"),
    agent_detail_pages_confirmed: isPaperclipSurfaceConfirmed(surfaces, "agent_detail_pages"),
    mobile_view_confirmed: mobileViewConfirmed,
    surfaces,
    public_exposure: false,
    tailnet_only_recommended: true,
    blocker,
    owner_visible_summary: blocker
      ? `Paperclip UI access is not confirmed: ${blocker}. No public exposure or production service was enabled.`
      : "Paperclip UI access is confirmed locally or through Tailnet with owner login, dashboard pages, and mobile view verified.",
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

export function buildPaperclipBoardApprovalPlan(input: PaperclipBoardApprovalPlanInput): PaperclipBoardApprovalPlan {
  const decisions = input.approvals.map((approval) => buildPaperclipBoardApprovalDecision(approval, input.generatedAt))
  const approved = decisions.filter((decision) => decision.approval_result === 'approved')
  const expired = decisions.filter((decision) => decision.expired)
  const blocked = decisions.filter((decision) => decision.approval_result !== 'approved')

  return {
    ok: blocked.length === 0,
    mode: 'paperclip_board_approval_dry_run',
    generated_at: input.generatedAt,
    required_actions: [...PAPERCLIP_BOARD_APPROVAL_ACTIONS],
    decisions,
    approved,
    blocked,
    expired,
    paperclip_results_logged: true,
    gateway_results_logged: true,
    owner_visible_summary: 'Paperclip and Gateway board approval results are logged in dry-run mode. Execution remains disabled until approval is active, Bridge Session scope exists, and a safe adapter is configured.',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}


type ResolvedPaperclipEndpoint = PaperclipEndpointResolution & {
  healthPayload?: unknown
}

async function resolveReachablePaperclipEndpoint(input: { fetchImpl?: FetchLike; baseUrl?: string | null }): Promise<ResolvedPaperclipEndpoint> {
  const candidates = paperclipEndpointCandidates(input.baseUrl)
  let firstBlocked: ResolvedPaperclipEndpoint | null = null
  for (const candidate of candidates) {
    if (candidate.blocker) {
      firstBlocked ||= candidate
      continue
    }
    const health = await fetchPaperclipJson('/api/health', { baseUrl: candidate.baseUrl, fetchImpl: input.fetchImpl })
    if (health.ok) return { ...candidate, healthPayload: health.payload }
    firstBlocked ||= { ...candidate, blocker: health.blocker }
  }
  return firstBlocked || resolvePaperclipEndpoint(input.baseUrl)
}

function paperclipEndpointCandidates(rawValue?: string | null): ResolvedPaperclipEndpoint[] {
  const explicit = rawValue || process.env.PAPERCLIP_API_URL || process.env.PAPERCLIP_BASE_URL
  if (explicit) return [resolvePaperclipEndpoint(explicit)]
  const endpoints = [resolvePaperclipEndpoint(DEFAULT_PAPERCLIP_BASE_URL)]
  for (const address of tailnetIpv4Addresses()) endpoints.push(resolvePaperclipEndpoint(`http://${address}:3100`))
  const seen = new Set<string>()
  return endpoints.filter((endpoint) => {
    const key = endpoint.baseUrl
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function tailnetIpv4Addresses(): string[] {
  const values: string[] = []
  for (const iface of Object.values(networkInterfaces())) {
    for (const entry of iface || []) {
      if (entry.family === 'IPv4' && !entry.internal && entry.address.startsWith('100.')) values.push(entry.address)
    }
  }
  return values.sort()
}

function serviceAccessForEndpoint(ownerVisible: string): PaperclipSafeStatusPayload['service'] {
  return {
    local_only: ownerVisible.startsWith('loopback:'),
    tailnet_only: ownerVisible.startsWith('tailnet:'),
    public_exposure: false,
    persistent_service_enabled: false,
    sandbox_expected: true,
  }
}

async function fetchReadOnlyList(path: string, input: { fetchImpl?: FetchLike; baseUrl?: string | null }): Promise<FetchJsonResult> {
  const endpoint = await resolveReachablePaperclipEndpoint(input)
  if (endpoint.blocker) return { ok: false, status: 503, blocker: endpoint.blocker }
  return fetchPaperclipJson(path, {
    baseUrl: endpoint.baseUrl,
    fetchImpl: input.fetchImpl,
  })
}

async function resolveCompanySelector(input: { companyId?: string | null; fetchImpl?: FetchLike; baseUrl?: string | null }): Promise<
  | { ok: true; companyId: string }
  | { ok: false; blocker: string }
> {
  const requestedCompanyId = sanitizeIdentifier(input.companyId || '')
  if (requestedCompanyId) return { ok: true, companyId: requestedCompanyId }

  const result = await fetchReadOnlyList('/api/companies', input)
  if (!result.ok) return { ok: false, blocker: result.blocker }
  const companies = arrayFromPayload(result.payload).map(sanitizeCompany).filter(Boolean) as PaperclipCompanySummary[]
  const preferred = companies.find((company) => company.name.toLowerCase() === 'to knowledge gateway') || companies[0]
  if (!preferred) return { ok: false, blocker: 'paperclip_company_not_found' }
  return { ok: true, companyId: preferred.id }
}

async function fetchPaperclipJson(path: string, input: { baseUrl: string; fetchImpl?: FetchLike }): Promise<FetchJsonResult> {
  const fetchImpl = input.fetchImpl || globalThis.fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAPERCLIP_TIMEOUT_MS)
  try {
    const response = await fetchImpl(`${input.baseUrl}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: response.status, blocker: 'paperclip_auth_required_or_not_configured' }
    }
    if (!response.ok) {
      return { ok: false, status: response.status, blocker: `paperclip_upstream_http_${response.status}` }
    }
    try {
      const payload = await response.json()
      return { ok: true, status: response.status, payload }
    } catch {
      return { ok: false, status: response.status, blocker: 'paperclip_upstream_non_json' }
    }
  } catch {
    return { ok: false, status: 503, blocker: 'paperclip_sandbox_service_not_running' }
  } finally {
    clearTimeout(timeout)
  }
}

function basePayload(generatedAt: string, endpoint: string, uiLink: string | null): PaperclipSafeStatusPayload {
  return {
    ok: true,
    mode: 'paperclip_status_read_only',
    generated_at: generatedAt,
    health: 'degraded',
    reachable: false,
    configured: false,
    endpoint,
    ui_link: uiLink,
    workforce_summary: {
      company_count: null,
      active_agents: null,
      active_issues: null,
      budget_status: 'not reachable',
      heartbeat_status: 'not reachable',
    },
    role: 'workforce_company_task_orchestration_layer',
    authority: 'subordinate_to_gateway_and_agent_zero',
    status_endpoint: '/api/bridge/paperclip/status',
    companies_endpoint: '/api/bridge/paperclip/companies',
    agents_endpoint: '/api/bridge/paperclip/agents',
    issues_endpoint: '/api/bridge/paperclip/issues',
    test_task_endpoint: '/api/bridge/paperclip/test-chat',
    proposals_endpoint: '/api/bridge/paperclip/proposals',
    dispatcher_recommendations_endpoint: '/api/bridge/paperclip/dispatcher-recommendations',
    research_tasks_endpoint: '/api/bridge/paperclip/research-tasks',
    service: {
      local_only: endpoint.startsWith('loopback:'),
      tailnet_only: endpoint.startsWith('tailnet:'),
      public_exposure: false,
      persistent_service_enabled: false,
      sandbox_expected: true,
    },
    upstream: {
      health_status: null,
      version: null,
      deployment_mode: null,
      deployment_exposure: null,
      auth_ready: null,
    },
    bridge_session: {
      required_for_mutations: true,
      external_writes_enabled: false,
    },
    blocker: null,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

function summarizeHealthPayload(payload: unknown): PaperclipSafeStatusPayload['upstream'] {
  const data = objectOrEmpty(payload)
  return {
    health_status: stringValue(data.status) || stringValue(data.ok) || 'ok',
    version: stringValue(data.version) || stringValue(data.hostVersion),
    deployment_mode: stringValue(data.deploymentMode) || stringValue(data.deployment_mode),
    deployment_exposure: stringValue(data.deploymentExposure) || stringValue(data.deployment_exposure),
    auth_ready: booleanValue(data.authReady ?? data.auth_ready),
  }
}

async function summarizeWorkforceState(input: { baseUrl: string; fetchImpl?: FetchLike }): Promise<{
  summary: PaperclipSafeStatusPayload['workforce_summary']
  blocker: string | null
}> {
  const emptySummary = {
    company_count: 0,
    active_agents: 0,
    active_issues: 0,
    budget_status: 'not reported',
    heartbeat_status: 'not reported',
  }
  const companiesResult = await fetchPaperclipJson('/api/companies', input)
  if (!companiesResult.ok) {
    return {
      summary: { ...emptySummary, company_count: null, active_agents: null, active_issues: null, budget_status: 'not reachable', heartbeat_status: 'not reachable' },
      blocker: companiesResult.blocker,
    }
  }

  const companies = arrayFromPayload(companiesResult.payload).map(sanitizeCompany).filter(Boolean) as PaperclipCompanySummary[]
  const preferred = companies.find((company) => company.name.toLowerCase() === 'to knowledge gateway') || companies[0]
  if (!preferred) {
    return {
      summary: { ...emptySummary, company_count: companies.length },
      blocker: 'paperclip_company_not_found',
    }
  }

  const [agentsResult, issuesResult] = await Promise.all([
    fetchPaperclipJson(`/api/companies/${encodeURIComponent(preferred.id)}/agents`, input),
    fetchPaperclipJson(`/api/companies/${encodeURIComponent(preferred.id)}/issues`, input),
  ])
  const agents = agentsResult.ok ? arrayFromPayload(agentsResult.payload).map(sanitizeAgent).filter(Boolean) as PaperclipAgentSummary[] : []
  const issues = issuesResult.ok ? arrayFromPayload(issuesResult.payload).map(sanitizeIssue).filter(Boolean) as PaperclipIssueSummary[] : []
  const blockers = [agentsResult.ok ? null : agentsResult.blocker, issuesResult.ok ? null : issuesResult.blocker].filter(Boolean) as string[]

  return {
    summary: {
      company_count: companies.length,
      active_agents: agents.filter(isActivePaperclipAgent).length,
      active_issues: issues.filter(isActivePaperclipIssue).length,
      budget_status: summarizeBudget(companies),
      heartbeat_status: summarizeHeartbeat(agents),
    },
    blocker: blockers[0] || null,
  }
}

function summarizeBudget(companies: PaperclipCompanySummary[]) {
  const withBudget = companies.find((company) => company.budget_monthly_cents !== null || company.spent_monthly_cents !== null)
  if (!withBudget) return 'not reported'
  const spent = withBudget.spent_monthly_cents ?? 0
  const budget = withBudget.budget_monthly_cents
  if (budget === null) return `${spent} cents spent monthly; budget not reported`
  return `${spent} of ${budget} cents monthly`
}

function summarizeHeartbeat(agents: PaperclipAgentSummary[]) {
  const heartbeatAgents = agents.filter((agent) => Boolean(agent.last_heartbeat_at))
  if (agents.length === 0) return 'no agents reported'
  if (heartbeatAgents.length === 0) return 'not reported'
  const latest = heartbeatAgents
    .map((agent) => agent.last_heartbeat_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  return `${heartbeatAgents.length} of ${agents.length} agents have heartbeat; latest ${latest}`
}

function isActivePaperclipAgent(agent: PaperclipAgentSummary) {
  const status = (agent.status || '').toLowerCase()
  return !/(terminated|archived|inactive|disabled|deleted)/.test(status)
}

function isActivePaperclipIssue(issue: PaperclipIssueSummary) {
  const status = (issue.status || '').toLowerCase()
  return !/(done|closed|complete|completed|cancelled|canceled|archived|deleted)/.test(status)
}

function normalizePaperclipCoWorkerRequestAction(value: unknown): PaperclipCoWorkerRequestAction | null {
  const normalized = sanitizeOwnerText(String(value || '')).toLowerCase().replace(/[^a-z]/g, '')
  if (normalized === 'read' || normalized === 'readonly' || normalized === 'discovery' || normalized === 'status') return 'read'
  if (normalized === 'write' || normalized === 'mutate' || normalized === 'update' || normalized === 'create') return 'write'
  if (normalized === 'execute' || normalized === 'run' || normalized === 'dispatch') return 'execute'
  return null
}

function normalizePaperclipCoWorkerCredentialMode(value: unknown): PaperclipCoWorkerCredentialMode {
  const normalized = sanitizeOwnerText(String(value || '')).toLowerCase().replace(/[^a-z_]/g, '')
  if (normalized === 'missing' || normalized === 'missing_credential' || normalized === 'blocked') return 'missing'
  if (normalized === 'configured' || normalized === 'available' || normalized === 'present') return 'configured'
  return 'none_required'
}

function paperclipCoWorkerScopeAllowed(definition: PaperclipCoWorkerAgentDefinition, requestedScope: string[]): boolean {
  if (!requestedScope.length) return false
  const allowedScopes = definition.task_scope.map((scope) => normalizePaperclipComparable(scope))
  return requestedScope.every((scope) => {
    const normalized = normalizePaperclipComparable(scope)
    return Boolean(normalized) && allowedScopes.some((allowed) => allowed === normalized || allowed.includes(normalized) || normalized.includes(allowed))
  })
}

function paperclipCoWorkerToolsAllowed(definition: PaperclipCoWorkerAgentDefinition, requestedTools: string[]): boolean {
  if (!requestedTools.length) return true
  const forbiddenTools = new Set(definition.forbidden_tools.map((tool) => normalizePaperclipComparable(tool)))
  return requestedTools.every((tool) => {
    const normalized = normalizePaperclipComparable(tool)
    return Boolean(normalized) && !forbiddenTools.has(normalized) && !paperclipCoWorkerForbiddenToolPattern().test(normalized)
  })
}

function paperclipCoWorkerUnsafeOutputContract(value: string): boolean {
  const normalized = value.toLowerCase()
  const rawHome = `${'/home'}/${'tony'}`
  const authFile = `auth${'.'}json`
  return normalized.includes(rawHome) || normalized.includes(authFile) || normalized.includes('.env') || /failed stage|traceback|stack trace|task[_ -]?id/.test(normalized)
}

function normalizePaperclipComparable(value: string): string {
  return sanitizeOwnerText(value).toLowerCase().replace(/[^a-z0-9_.:-]+/g, '_').replace(/^_+|_+$/g, '')
}

function normalizePaperclipCoWorkerLifecycle(value: string): PaperclipCoWorkerLifecycleState | null {
  const normalized = normalizePaperclipSlug(value).replace(/^awaitingapproval$/, 'awaiting_approval').replace(/^reviewedbyagentzero$/, 'reviewed_by_agent_zero')
  if ((PAPERCLIP_COWORKER_LIFECYCLE_STATES as readonly string[]).includes(normalized)) return normalized as PaperclipCoWorkerLifecycleState
  return null
}

function normalizePaperclipLifecycleActor(value: unknown): string {
  const actor = normalizePaperclipSlug(value || 'gateway')
  if (actor === 'agentzero') return 'agent_zero'
  if (actor === 'spaceagent') return 'space_agent'
  return actor || 'gateway'
}

function buildPaperclipCoWorkerAgentId(value: string | null | undefined): string {
  const id = normalizePaperclipSlug(value || 'coworker_agent') || 'coworker_agent'
  return id.startsWith('paperclip_coworker_') ? id : `paperclip_coworker_${id}`
}

function normalizePaperclipCoWorkerSupervisor(value: unknown): PaperclipCoWorkerSupervisor {
  const text = normalizePaperclipSlug(value || 'agent_zero')
  if (text === 'hermes') return 'hermes'
  if (text === 'pi' || text === 'pi_dispatcher' || text === 'pi_review') return 'pi'
  if (text === 'space_agent' || text === 'spaceagent') return 'space_agent'
  return 'agent_zero'
}

function normalizePaperclipBudgetCents(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return Math.min(Math.round(value), 1000000)
}

function normalizePaperclipMemoryTtl(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1440
  return Math.min(Math.max(Math.round(value), 30), 10080)
}

function validatePaperclipCoWorkerAgentDefinition(input: {
  id: string
  supervisor: PaperclipCoWorkerSupervisor
  purpose: string
  taskScope: string[]
  allowedTools: string[]
  forbiddenTools: string[]
  expirationCondition: string
}): string | null {
  if (!input.id || /^(paperclip_coworker_)?(?:agent_zero|hermes|pi|space_agent|owner|gateway|tony)$/i.test(input.id)) return 'paperclip_coworker_id_reserved_or_missing'
  if (!input.supervisor) return 'paperclip_coworker_supervisor_required'
  if (!input.purpose) return 'paperclip_coworker_purpose_required'
  if (input.taskScope.length === 0) return 'paperclip_coworker_task_scope_required'
  if (!input.expirationCondition) return 'paperclip_coworker_expiration_condition_required'
  if (input.allowedTools.some((tool) => paperclipCoWorkerForbiddenToolPattern().test(tool))) return 'paperclip_coworker_allowed_tool_forbidden'
  const combined = [input.purpose, input.expirationCondition, ...input.taskScope, ...input.allowedTools].join(' ')
  if (paperclipCoWorkerUnsafeTextPattern().test(combined)) return 'paperclip_coworker_scope_contains_forbidden_access'
  return null
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sanitizePaperclipList(values: string[], limit: number, maxLength: number): string[] {
  return dedupeStrings(values
    .map((item) => sanitizeOwnerText(String(item || '')).slice(0, maxLength))
    .filter(Boolean))
    .slice(0, limit)
}

function paperclipCoWorkerForbiddenToolPattern(): RegExp {
  return /(?:direct_secret_read|read_secret|raw_root_shell|root_shell|docker_socket|uncontrolled_delete|broad_connector_execution|zapier_write|heygen_generation|smb_mount)/i
}

function paperclipCoWorkerUnsafeTextPattern(): RegExp {
  return /(?:root\s+shell|docker\s+socket|direct\s+secret|read\s+secrets?|print\s+secrets?|auth\.json|unrestricted|bypass\s+gateway|zapier\s+write|heygen\s+generation|mount\s+smb|delete\s+opencloud|disable\s+build[-\s]?wiki)/i
}

function paperclipCoWorkerAuditEvent(event: string, actor: string, target: string, summary: string, recordedAt: string): PaperclipCoWorkerAgentAuditEvent {
  return {
    event,
    actor,
    target,
    summary,
    recorded_at: recordedAt,
    external_write: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

function addPaperclipMinutes(iso: string, minutes: number): string {
  const base = Number.isNaN(Date.parse(iso)) ? new Date('1970-01-01T00:00:00.000Z') : new Date(iso)
  return new Date(base.getTime() + minutes * 60_000).toISOString()
}

function normalizePaperclipSlug(value: unknown): string {
  return sanitizeIdentifier(value).toLowerCase().replace(/[_.:-]+/g, '_').replace(/^_+|_+$/g, '')
}

function paperclipSpaceAgentTaskAgent(): PaperclipSpaceAgentResearchTaskPayload['paperclip_agent'] {
  return {
    id: 'space_agent',
    name: 'SpaceAgent',
    appears_as_paperclip_agent: true,
    role: 'browser_web_youtube_firecrawl_research_specialist',
    status: 'read_only_virtual_agent',
    supervisors: ['agent_zero', 'hermes', 'pi'],
    external_writes_enabled: false,
    bridge_session_required_for_execution: true,
  }
}

function withPaperclipVirtualSpaceAgent(items: PaperclipAgentSummary[], companyId: string | null): PaperclipAgentSummary[] {
  if (items.some((item) => item.id === 'space_agent' || item.name.toLowerCase() === 'spaceagent' || item.name.toLowerCase() === 'space agent')) return items
  return [...items, paperclipVirtualSpaceAgent(companyId)]
}

function paperclipVirtualSpaceAgent(companyId: string | null): PaperclipAgentSummary {
  return {
    id: 'space_agent',
    name: 'SpaceAgent',
    role: 'browser_web_youtube_firecrawl_research_specialist',
    title: 'Gateway browser, web, YouTube, and Firecrawl research specialist',
    status: 'read_only_virtual_agent',
    company_id: companyId,
    reports_to: 'agent_zero',
    capabilities: [
      'web_research_task',
      'youtube_research_task',
      'firecrawl_task',
      'research_packet_return',
      'gateway_evidence_validation',
    ],
    budget_monthly_cents: null,
    spent_monthly_cents: null,
    last_heartbeat_at: null,
    gateway_role: 'space_agent_research_specialist',
    owner_visible_status: 'read_only_paperclip_virtual_agent',
    bridge_session_required_for_execution: true,
  }
}

function normalizePaperclipSpaceAgentResearchTaskType(value: unknown, request: string): PaperclipSpaceAgentResearchTaskType {
  const text = `${sanitizeIdentifier(value)} ${request}`.toLowerCase()
  if (/youtube|you_tube|video/.test(text)) return 'youtube_research'
  if (/firecrawl|fire_crawl|scrape|crawl|map|extract/.test(text)) return 'firecrawl_task'
  return 'web_research'
}

function normalizePaperclipResearchResponsibleAgent(value: unknown): SpaceAgentResponsibleAgent {
  const text = sanitizeIdentifier(value).toLowerCase().replace(/[-\s]+/g, '_')
  if (text === 'hermes') return 'hermes'
  if (text === 'pi' || text === 'pi_review' || text === 'pi_dispatcher') return 'pi'
  if (text === 'responsible_specialist_agent' || text === 'specialist') return 'responsible_specialist_agent'
  return 'agent_zero'
}

function normalizePaperclipResearchEvidence(value: Array<{ summary: string; url?: string | null; source?: string | null; retrieved_at?: string | null }> | undefined) {
  return (value || [])
    .map((item) => ({
      summary: sanitizeOwnerText(item.summary).slice(0, 500),
      url: sanitizeNullable(item.url),
      source: sanitizeNullable(item.source),
      retrieved_at: sanitizeNullable(item.retrieved_at),
    }))
    .filter((item) => item.summary)
    .slice(0, 12)
}

function normalizePaperclipResearchWebSources(value: Array<{ url?: string | null; title?: string | null; type?: string | null; retrieved_at?: string | null; method?: string | null; status?: string | null }> | undefined) {
  return (value || [])
    .map((item) => ({
      type: 'web_source' as const,
      url: sanitizeNullable(item.url),
      title: sanitizeNullable(item.title),
      status: normalizePaperclipWebSourceStatus(item.status),
      last_checked: sanitizeNullable(item.retrieved_at),
    }))
    .filter((item) => item.url || item.title)
    .slice(0, 12)
}

function normalizePaperclipWebSourceStatus(value: string | null | undefined): 'candidate' | 'checked' | 'blocked' {
  const text = (value || '').toLowerCase()
  if (text === 'blocked' || text === 'failed') return 'blocked'
  if (text === 'success' || text === 'checked') return 'checked'
  return 'candidate'
}

function normalizePaperclipResearchYouTubeSources(value: Array<{ video_url?: string | null; title?: string | null; channel?: string | null; status?: string | null }> | undefined) {
  return (value || [])
    .map((item) => ({
      video_url: sanitizeNullable(item.video_url),
      title: sanitizeNullable(item.title),
      channel: sanitizeNullable(item.channel),
      status: sanitizeNullable(item.status),
    }))
    .filter((item) => item.video_url || item.title)
    .slice(0, 8)
}

function buildPaperclipResearchTaskId(generatedAt: string) {
  const stamp = generatedAt.replace(/\D/g, '').slice(0, 14) || 'pending'
  return `paperclip_space_agent_research_${stamp}`
}

function recommendPaperclipAssigneeForOwnerRequest(ownerRequest: string): PaperclipTaskAssignee {
  const text = ownerRequest.toLowerCase()
  if (/web|browser|youtube|firecrawl|crawl|scrape|research|source|page|article|video/.test(text)) return 'space_agent'
  if (/budget|cost|model|provider|route|dispatch|triage|review/.test(text)) return 'pi_review'
  if (/mini[-\s]?agent|small|scoped|repeat|recurring|checklist|qa/.test(text)) return 'mini_agent'
  if (/skill|workflow|template|routine|automation/.test(text)) return 'hermes'
  return 'pi_review'
}

function recommendPaperclipBudgetRoute(ownerRequest: string): string {
  const text = ownerRequest.toLowerCase()
  if (/expensive|large|complex|strong|opus|sonnet|deep/.test(text)) return 'budget_review_required_before_strong_model_or_parallel_workforce_route'
  if (/small|quick|low[-\s]?cost|cheap|simple/.test(text)) return 'low_cost_route_preferred_until_agent_zero_approves_escalation'
  return 'paperclip_budget_tracking_advisory_only_no_spending_authority'
}

function recommendPaperclipModelRoute(ownerRequest: string): string {
  const text = ownerRequest.toLowerCase()
  if (/complex|architecture|security|deep|hard|multi[-\s]?step/.test(text)) return 'strong_model_route_recommended_after_gateway_policy_check'
  if (/small|classify|simple|quick|draft/.test(text)) return 'low_cost_model_route_recommended_after_gateway_policy_check'
  return 'gateway_model_registry_route_recommended_agent_zero_decides'
}

function shouldRecommendPaperclipMiniAgent(ownerRequest: string, recommendedAgent: PaperclipTaskAssignee): boolean {
  return recommendedAgent === 'mini_agent' || /mini[-\s]?agent|small scoped|repeatable|checklist|parallel/.test(ownerRequest.toLowerCase())
}

function buildPaperclipGatewayPluginLifecycleDecision(input: PaperclipGatewayPluginLifecycleInput): PaperclipGatewayPluginLifecycleDecision {
  const plugin = normalizePaperclipGatewayPluginId(input.plugin)
  const action = normalizePaperclipGatewayPluginLifecycleAction(input.action)
  const spec = plugin ? PAPERCLIP_GATEWAY_PLUGIN_SPECS[plugin] : null
  const loadedBefore = input.loaded === true
  const safeUi = input.safeUiContribution === true
  const blockedReason = !spec
    ? 'paperclip_gateway_plugin_unknown'
    : action === 'unload' && !loadedBefore
      ? 'paperclip_gateway_plugin_not_loaded'
      : spec.kind === 'ui_contribution' && action === 'load' && !safeUi
        ? 'paperclip_gateway_ui_contribution_requires_safe_smoke'
        : null
  const loadedAfter = blockedReason
    ? loadedBefore
    : action === 'load'
      ? true
      : false
  return {
    plugin: plugin || 'unknown',
    action,
    status: blockedReason ? 'blocked' : action === 'load' ? 'loaded' : 'unloaded',
    loaded_before: loadedBefore,
    loaded_after: loadedAfter,
    policy_result: blockedReason ? 'blocked' : 'requires_session',
    blocked_reason: blockedReason,
    audit_event: {
      event: action === 'load' ? 'paperclip.gateway_plugin.load' : 'paperclip.gateway_plugin.unload',
      actor: 'gateway',
      target: plugin || 'unknown_plugin',
      status: blockedReason ? 'blocked' : 'recorded',
      external_write: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    },
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

function normalizePaperclipGatewayPluginId(value: unknown): PaperclipGatewayPluginId | null {
  const text = normalizePaperclipSlug(value || '')
  if (text === 'gateway' || text === 'gateway_core') return 'gateway_core'
  if (text === 'agent_zero' || text === 'agent_zero_adapter') return 'agent_zero_adapter'
  if (text === 'hermes' || text === 'hermes_adapter') return 'hermes_adapter'
  if (text === 'pi' || text === 'pi_adapter' || text === 'pi_dispatcher') return 'pi_adapter'
  if (text === 'space_agent' || text === 'spaceagent' || text === 'space_agent_adapter') return 'space_agent_adapter'
  if (text === 'openclaw' || text === 'openclaw_plus' || text === 'openclaw_runtime' || text === 'openclaw_runtime_adapter') return 'openclaw_runtime_adapter'
  if (text === 'openclaw' || text === 'openclaw_plus' || text === 'openclaw_skills_adapter') return 'openclaw_skills_adapter'
  if (text === 'mission_control_ui' || text === 'mission_control_ui_contribution' || text === 'gateway_ui') return 'mission_control_ui_contribution'
  return null
}

function normalizePaperclipGatewayPluginLifecycleAction(value: unknown): PaperclipGatewayPluginLifecycleAction {
  const text = normalizePaperclipSlug(value || 'load')
  return text === 'unload' || text === 'disable' ? 'unload' : 'load'
}


function buildPaperclipWorkspaceTaskDecision(input: PaperclipWorkspaceTaskInput): PaperclipWorkspaceTaskDecision {
  const workspace = normalizePaperclipWorkspaceId(input.workspace)
  const definition = workspace ? PAPERCLIP_WORKSPACE_DEFINITIONS[workspace] : null
  const action = normalizePaperclipWorkspaceTaskAction(input.action)
  const taskTitle = sanitizeOwnerText(input.taskTitle || 'Paperclip workspace task').slice(0, 180) || 'Paperclip workspace task'
  const workspaceRef = sanitizePaperclipWorkspaceRef(input.workspaceRef)
  const isolatedWorktreeRef = sanitizePaperclipWorkspaceRef(input.isolatedWorktreeRef)
  const paperclipIssueId = sanitizePaperclipWorkspaceRef(input.paperclipIssueId)
  const expectedWorkspaceRef = definition?.workspace_ref || null
  const correctWorkspace = Boolean(definition && (!workspaceRef || workspaceRef === expectedWorkspaceRef))
  const codingTask = action === 'code' || action === 'test'
  const isolatedWorktreeCreated = Boolean(codingTask && isolatedWorktreeRef)
  const gatewayLinkRef = definition ? `gateway_link_${definition.gateway_node_id}_${paperclipIssueId || 'pending_issue'}` : null
  const safeWorkProductRef = definition
    ? `${definition.protected_outputs_ref}_${normalizePaperclipComparable(input.outputTitle || taskTitle) || 'work_product'}`
    : 'paperclip_outputs_unknown_workspace'
  const blockedReason = !definition
    ? 'paperclip_workspace_unknown'
    : !correctWorkspace
      ? 'paperclip_task_wrong_workspace_blocked'
      : codingTask && !definition.coding_tasks_allowed
        ? 'paperclip_workspace_coding_not_allowed'
        : codingTask && !isolatedWorktreeCreated
          ? 'paperclip_isolated_worktree_required_for_coding_task'
          : paperclipWorkspaceRefUnsafe(input.workspaceRef) || paperclipWorkspaceRefUnsafe(input.isolatedWorktreeRef)
            ? 'paperclip_workspace_raw_path_or_secret_ref_blocked'
            : null
  const policyResult: PaperclipTaskPolicyResult = blockedReason
    ? 'blocked'
    : paperclipIssueId
      ? 'requires_session'
      : 'requires_session'

  return {
    task_title: taskTitle,
    workspace: workspace || 'unknown',
    action,
    selected_workspace_ref: expectedWorkspaceRef,
    isolated_worktree_ref: isolatedWorktreeRef,
    correct_workspace: correctWorkspace,
    isolated_worktree_created: isolatedWorktreeCreated,
    safe_work_product_ref: safeWorkProductRef,
    paperclip_issue_attachment_planned: Boolean(paperclipIssueId),
    paperclip_issue_attachment_recorded: false,
    mission_control_gateway_linked: Boolean(gatewayLinkRef),
    mission_control_gateway_link_ref: gatewayLinkRef,
    policy_result: policyResult,
    blocked_reason: blockedReason,
    execution_enabled: false,
    writes_enabled: false,
    external_write: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

function normalizePaperclipWorkspaceId(value: unknown): PaperclipWorkspaceId | null {
  const text = normalizePaperclipSlug(value || '')
  if (text === 'mission_control' || text === 'missioncontrol' || text === 'mc') return 'mission_control'
  if (text === 'claudeclaw' || text === 'openclaw' || text === 'openclaw_plus' || text === 'claudeclaw_openclaw') return 'claudeclaw_openclaw'
  if (text === 'space_agent' || text === 'spaceagent') return 'space_agent'
  if (text === 'pi' || text === 'pi_dispatcher') return 'pi'
  if (text === 'paperclip' || text === 'paperclip_lab') return 'paperclip'
  return null
}

function normalizePaperclipWorkspaceTaskAction(value: unknown): PaperclipWorkspaceTaskAction {
  const text = normalizePaperclipSlug(value || 'read')
  if (text === 'code' || text === 'edit' || text === 'implement') return 'code'
  if (text === 'test' || text === 'validate' || text === 'check') return 'test'
  if (text === 'report' || text === 'document' || text === 'docs') return 'report'
  return 'read'
}

function sanitizePaperclipWorkspaceRef(value: unknown): string | null {
  const text = sanitizeOwnerText(String(value || '')).trim()
  if (!text) return null
  if (paperclipWorkspaceRefUnsafe(text)) return null
  return normalizePaperclipComparable(text).slice(0, 120) || null
}

function paperclipWorkspaceRefUnsafe(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const text = String(value)
  return /(?:^\/|\/home\/|\/Users\/|\\|\.env|auth\.json|secret|token|password|api[_-]?key)/i.test(text)
}


function buildPaperclipCredentialDecision(input: PaperclipCredentialInput, strictSecretsMode: boolean): PaperclipCredentialDecision {
  const subject = normalizePaperclipCredentialSubject(input.subject)
  const authMethod = normalizePaperclipCredentialAuthMethod(input.authMethod, subject)
  const requestedMode = normalizePaperclipCredentialMode(input.mode, subject)
  const inlineKeyBlocked = paperclipLooksLikeInlineSecret(input.inlineValue)
  const authFilePathLeakage = Boolean(input.authFilePath && sanitizeOwnerText(input.authFilePath).trim())
  const envLeakage = paperclipEnvLeakageDetected(input.env)
  const secretRef = normalizePaperclipSecretRef(input.secretRef, subject)
  const secretRefConfigured = Boolean(secretRef)
  const configured = input.configured === true || (secretRefConfigured && !inlineKeyBlocked && !authFilePathLeakage && !envLeakage)
  const credentialMode: PaperclipCredentialMode = inlineKeyBlocked
    ? 'inline_value_blocked'
    : requestedMode
  const ownerVisibleLocation: PaperclipCredentialDecision['owner_visible_location'] = credentialMode === 'protected_local_auth_home'
    ? 'protected_local_auth_home'
    : secretRefConfigured || credentialMode === 'protected_secret_ref' || credentialMode === 'paperclip_secret_ref'
      ? 'protected_secret_reference'
      : 'not_configured'
  const blockedReason = !subject
    ? 'paperclip_credential_subject_unknown'
    : inlineKeyBlocked
      ? 'paperclip_inline_secret_value_blocked'
      : authFilePathLeakage
        ? 'paperclip_auth_file_path_hidden_use_secret_ref'
        : envLeakage
          ? 'paperclip_env_secret_leakage_blocked'
          : strictSecretsMode && !configured
            ? 'paperclip_strict_secret_ref_required'
            : null
  const policyResult: PaperclipTaskPolicyResult = blockedReason
    ? blockedReason.includes('credential') || blockedReason.includes('secret') || blockedReason.includes('auth')
      ? 'missing_credential'
      : 'blocked'
    : 'requires_session'

  return {
    subject: subject || 'unknown',
    auth_method: authMethod,
    credential_mode: credentialMode,
    configured,
    secret_ref_configured: secretRefConfigured,
    secret_ref: secretRef,
    owner_visible_location: ownerVisibleLocation,
    strict_secrets_mode: strictSecretsMode,
    api_billing_disabled: subject === 'claude_anthropic_auth',
    inline_key_blocked: inlineKeyBlocked,
    env_leakage_detected: envLeakage,
    auth_file_path_leakage_detected: authFilePathLeakage,
    owner_ui_shows_secret_values: false,
    owner_ui_shows_auth_file_paths: false,
    paperclip_shows_secret_values: false,
    policy_result: policyResult,
    blocked_reason: blockedReason,
    credential_modes_documented: true,
    audit_log: [
      {
        event: 'paperclip.credential.mode.evaluated',
        actor: 'gateway',
        target: subject || 'unknown_credential',
        status: blockedReason ? 'blocked' : 'recorded',
        external_write: false,
        no_secrets_exposed: true,
        raw_paths_exposed: false,
      },
    ],
  }
}

function normalizePaperclipDeploymentMode(value: unknown): 'sandbox' | 'private' | 'production' {
  const text = normalizePaperclipSlug(value || 'sandbox')
  if (text === 'production' || text === 'prod') return 'production'
  if (text === 'private' || text === 'local_private') return 'private'
  return 'sandbox'
}

function normalizePaperclipCredentialSubject(value: unknown): PaperclipCredentialSubject | null {
  const text = normalizePaperclipSlug(value || '')
  if (text === 'codex' || text === 'chatgpt' || text === 'chatgpt_codex' || text === 'codex_chatgpt_auth') return 'chatgpt_codex_auth'
  if (text === 'chatgpt_codex_auth') return 'chatgpt_codex_auth'
  if (text === 'claude' || text === 'anthropic' || text === 'claude_anthropic' || text === 'claude_anthropic_auth') return 'claude_anthropic_auth'
  return null
}

function normalizePaperclipCredentialAuthMethod(value: unknown, subject: PaperclipCredentialSubject | null): PaperclipCredentialAuthMethod | 'unknown' {
  const text = normalizePaperclipSlug(value || '')
  if (text === 'claude_code_oauth' || subject === 'claude_anthropic_auth') return 'claude_code_oauth'
  if (text === 'chatgpt_codex_oauth' || text === 'codex_oauth' || subject === 'chatgpt_codex_auth') return 'chatgpt_codex_oauth'
  return 'unknown'
}

function normalizePaperclipCredentialMode(value: unknown, subject: PaperclipCredentialSubject | null): PaperclipCredentialMode {
  const text = normalizePaperclipSlug(value || '')
  if (text === 'protected_local_auth_home') return 'protected_local_auth_home'
  if (text === 'protected_secret_ref' || text === 'protected_secret_reference') return 'protected_secret_ref'
  if (text === 'paperclip_secret_ref' || text === 'secret_ref') return 'paperclip_secret_ref'
  if (text === 'missing' || text === 'not_configured') return 'missing'
  if (subject === 'chatgpt_codex_auth') return 'protected_local_auth_home'
  if (subject === 'claude_anthropic_auth') return 'protected_secret_ref'
  return 'missing'
}

function normalizePaperclipSecretRef(value: unknown, subject: PaperclipCredentialSubject | null): string | null {
  const text = normalizePaperclipSlug(value || '')
  if (!subject) return null
  if (!text) return `paperclip_secret_ref_${subject}`
  if (paperclipLooksLikeInlineSecret(text) || text.includes('auth_json') || text.includes('env')) return null
  return text.startsWith('paperclip_secret_ref_') ? text : `paperclip_secret_ref_${text}`
}

function paperclipLooksLikeInlineSecret(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const text = String(value)
  return /(?:sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|AIza[0-9A-Za-z_-]{12,}|xox[baprs]-[0-9A-Za-z-]{8,}|api[_-]?key|token|secret|password)/i.test(text)
}

function paperclipEnvLeakageDetected(env: Record<string, unknown> | null | undefined): boolean {
  if (!env) return false
  return Object.entries(env).some(([key, value]) => paperclipLooksLikeInlineSecret(key) || paperclipLooksLikeInlineSecret(value))
}


function buildPaperclipBoardApprovalDecision(input: PaperclipBoardApprovalInput, generatedAt: string): PaperclipBoardApprovalDecision {
  const action = normalizePaperclipBoardApprovalAction(input.action)
  const profile = action ? PAPERCLIP_BOARD_APPROVAL_ACTION_PROFILES[action] : null
  const title = sanitizeOwnerText(input.title || profile?.title || 'Unknown Paperclip board approval').slice(0, 180) || 'Unknown Paperclip board approval'
  const requestedBy = normalizePaperclipApprovalActor(input.requestedBy)
  const requestedAt = sanitizeOwnerText(input.requestedAt || generatedAt) || generatedAt
  const expiresAt = sanitizeOwnerText(input.expiresAt || '') || null
  const approvalState = normalizePaperclipBoardApprovalState(input.approvalState)
  const expired = Boolean(expiresAt && Date.parse(expiresAt) <= Date.parse(generatedAt))
  const approvalResult: PaperclipBoardApprovalResult = !action
    ? 'unknown_action'
    : expired
      ? 'expired'
      : approvalState
  const blockedReason = !action
    ? 'paperclip_board_approval_action_unknown'
    : expired
      ? 'paperclip_board_approval_expired'
      : approvalState === 'denied'
        ? 'paperclip_board_approval_denied'
        : approvalState === 'pending'
          ? 'paperclip_board_approval_pending'
          : null
  const policyResult: PaperclipTaskPolicyResult = blockedReason ? 'blocked' : 'requires_session'

  return {
    action: action || 'unknown',
    title,
    requested_by: requestedBy,
    requested_at: requestedAt,
    expires_at: expiresAt,
    evaluated_at: generatedAt,
    required_scope: sanitizeOwnerText(input.scope || profile?.scope || '') || null,
    board_approval_required: true,
    approval_state: approvalState,
    approval_result: approvalResult,
    expired,
    policy_result: policyResult,
    blocked_reason: blockedReason || 'active_bridge_session_and_safe_adapter_required_after_board_approval',
    paperclip_result_logged: true,
    gateway_result_logged: true,
    execution_allowed: false,
    execution_enabled: false,
    writes_enabled: false,
    external_write: Boolean(profile?.externalWrite),
    audit_log: [
      handoffAuditEvent('paperclip_board_approval_result_logged', requestedBy, 'paperclip', 'recorded'),
      handoffAuditEvent('gateway_board_approval_result_logged', 'gateway', profile?.scope || 'paperclip', blockedReason ? 'blocked' : 'recorded'),
    ],
  }
}

function normalizePaperclipBoardApprovalAction(value: unknown): PaperclipBoardApprovalAction | null {
  const text = normalizePaperclipSlug(value || '')
  if (text === 'coworker_hire' || text === 'co_worker_hire' || text === 'hire_coworker' || text === 'hire_co_worker') return 'co_worker_hire'
  if (text === 'external_write') return 'external_write'
  if (text === 'drive_upload' || text === 'google_drive_upload' || text === 'googledrive_upload') return 'drive_upload'
  if (text === 'onedrive_upload' || text === 'one_drive_upload') return 'onedrive_upload'
  if (text === 'agentmail_send' || text === 'agent_mail_send' || text === 'email_send') return 'agentmail_send'
  if (text === 'buildwiki_run_now' || text === 'build_wiki_run_now') return 'buildwiki_run_now'
  if (text === 'zapier_write') return 'zapier_write'
  if (text === 'heygen_generation' || text === 'heygen_generate') return 'heygen_generation'
  if (text === 'smb_fork2' || text === 'smb_fork_2' || text === 'fork2_smb') return 'smb_fork2'
  if (PAPERCLIP_BOARD_APPROVAL_ACTIONS.includes(text as PaperclipBoardApprovalAction)) return text as PaperclipBoardApprovalAction
  return null
}

function normalizePaperclipBoardApprovalState(value: unknown): PaperclipBoardApprovalState {
  const text = normalizePaperclipSlug(value || 'pending')
  if (text === 'approved' || text === 'approve') return 'approved'
  if (text === 'denied' || text === 'deny' || text === 'rejected' || text === 'reject') return 'denied'
  return 'pending'
}

function normalizePaperclipApprovalActor(value: unknown): string {
  const actor = normalizePaperclipSlug(value || 'owner_board')
  if (actor === 'agentzero') return 'agent_zero'
  if (actor === 'spaceagent') return 'space_agent'
  return actor || 'owner_board'
}

function normalizePaperclipTokenGovernorScope(value: unknown): PaperclipTokenGovernorBudgetScope | null {
  const text = normalizePaperclipSlug(value || '')
  if (text === 'company') return 'company'
  if (text === 'agent') return 'agent'
  if (text === 'project') return 'project'
  if (text === 'goal') return 'goal'
  if (text === 'model_provider' || text === 'modelprovider' || text === 'provider') return 'model_provider'
  return null
}

function normalizePaperclipPercent(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(100, Math.max(1, Math.round(value)))
}

function buildPaperclipTokenGovernorBudgetDecision(
  input: PaperclipTokenGovernorBudgetInput,
  alertThreshold: number,
  defaultHardStop: number,
): PaperclipTokenGovernorBudgetDecision {
  const scope = normalizePaperclipTokenGovernorScope(input.scope)
  const fallbackScope: PaperclipTokenGovernorBudgetScope = scope || 'project'
  const id = sanitizeIdentifier(input.id || `${fallbackScope}_budget`) || `${fallbackScope}_budget`
  const name = sanitizeOwnerText(input.name || id).slice(0, 160) || id
  const budget = typeof input.budgetCents === 'number' && Number.isFinite(input.budgetCents) && input.budgetCents >= 0
    ? Math.round(input.budgetCents)
    : null
  const spent = normalizePaperclipBudgetCents(input.spentCents)
  const projected = normalizePaperclipBudgetCents(input.projectedCents)
  const total = spent + projected
  const hardStopThreshold = normalizePaperclipPercent(input.ownerHardStopPercent, defaultHardStop)
  const usagePercent = budget === null || budget === 0 ? null : roundPaperclipPercent((total / budget) * 100)
  const missingBudget = budget === null
  const hardStop = missingBudget ? false : usagePercent !== null && usagePercent >= hardStopThreshold
  const alert = !hardStop && usagePercent !== null && usagePercent >= alertThreshold
  const runaway = Boolean(input.runaway) || (fallbackScope === 'agent' && hardStop)
  const status: PaperclipTokenGovernorBudgetStatus = missingBudget
    ? 'missing_budget'
    : hardStop
      ? 'hard_stop'
      : alert
        ? 'alert'
        : 'within_budget'
  const decision: PaperclipTokenGovernorDecision = missingBudget
    ? 'missing_budget'
    : hardStop
      ? 'hard_stop'
      : alert
        ? 'alert'
        : 'allowed'
  const blockedReason = missingBudget
    ? 'paperclip_token_governor_budget_missing'
    : hardStop
      ? 'paperclip_token_governor_hard_stop_threshold_reached'
      : runaway
        ? 'paperclip_token_governor_runaway_agent_pause_required'
        : null

  return {
    scope: fallbackScope,
    id,
    name,
    budget_cents: budget,
    spent_cents: spent,
    projected_cents: projected,
    total_after_projection_cents: total,
    usage_percent: usagePercent,
    alert_threshold_percent: alertThreshold,
    hard_stop_threshold_percent: hardStopThreshold,
    status,
    decision,
    alert_at_75_percent: alert,
    hard_stop_at_threshold: hardStop,
    pause_runaway_agent: runaway,
    blocked_reason: blockedReason,
  }
}

function roundPaperclipPercent(value: number): number {
  return Math.round(value * 100) / 100
}

function paperclipHeartbeatDayKey(generatedAt: string) {
  const stamp = generatedAt.replace(/\D/g, '').slice(0, 8)
  return stamp || 'pending'
}

function normalizePaperclipHeartbeatPausedAgents(values: string[]): PaperclipSandboxHeartbeatOwner[] {
  const owners = new Set<PaperclipSandboxHeartbeatOwner>()
  for (const value of values) {
    const normalized = normalizePaperclipSlug(value)
    if (normalized === 'agentzero') owners.add('agent_zero')
    if (normalized === 'spaceagent') owners.add('space_agent')
    if (normalized === 'gateway') owners.add('gateway')
    if (normalized === 'agent_zero') owners.add('agent_zero')
    if (normalized === 'hermes') owners.add('hermes')
    if (normalized === 'pi' || normalized === 'pi_dispatcher') owners.add('pi')
    if (normalized === 'space_agent') owners.add('space_agent')
  }
  return [...owners]
}

function normalizePaperclipHeartbeatBudget(monthlyBudgetCents: number | null | undefined, projectedCostCents: number | null | undefined) {
  const projected = normalizePaperclipBudgetCents(projectedCostCents)
  const monthly = typeof monthlyBudgetCents === 'number' && Number.isFinite(monthlyBudgetCents) && monthlyBudgetCents >= 0
    ? Math.round(monthlyBudgetCents)
    : null
  if (monthly === null) {
    return {
      monthly_budget_cents: null,
      projected_cost_cents: projected,
      status: 'missing_budget' as const,
      blocked_reason: 'paperclip_heartbeat_budget_not_configured',
    }
  }
  if (projected > monthly) {
    return {
      monthly_budget_cents: monthly,
      projected_cost_cents: projected,
      status: 'over_budget' as const,
      blocked_reason: 'paperclip_heartbeat_budget_exceeded',
    }
  }
  return {
    monthly_budget_cents: monthly,
    projected_cost_cents: projected,
    status: 'within_budget' as const,
    blocked_reason: null,
  }
}

function buildPaperclipGatewayRecordMappingId(generatedAt: string, kind: PaperclipGatewayRecordMappingKind | "unknown") {
  const stamp = generatedAt.replace(/\D/g, "").slice(0, 14) || "pending"
  return `paperclip_gateway_record_${kind}_${stamp}`
}

function normalizePaperclipGatewayRecordMappingKind(value: unknown): PaperclipGatewayRecordMappingKind | null {
  const text = sanitizeOwnerText(String(value || "")).toLowerCase().replace(/[-\s]+/g, "_").replace(/[^a-z0-9_]+/g, "")
  if (!text) return null
  if (PAPERCLIP_GATEWAY_RECORD_MAPPINGS.includes(text as PaperclipGatewayRecordMappingKind)) return text as PaperclipGatewayRecordMappingKind
  if (text === "gateway_mission_issue") return "gateway_mission_to_issue"
  if (text === "owner_command_issue") return "owner_command_to_issue"
  if (text === "mini_agent_task_issue") return "mini_agent_task_to_issue"
  if (text === "space_agent_research_packet_work_product" || text === "research_packet_work_product") return "space_agent_research_packet_to_work_product"
  if (text === "hermes_skill_proposal_issue_work_product" || text === "hermes_proposal_issue_work_product") return "hermes_skill_proposal_to_issue_work_product"
  if (text === "pi_recommendation_issue_comment") return "pi_recommendation_to_issue_comment"
  if (text === "agent_zero_decision_issue_approval") return "agent_zero_decision_to_issue_approval"
  if (text === "bridge_session_governance_event") return "bridge_session_to_governance_event"
  if (text === "completed_task_final_report") return "completed_task_to_final_report"
  if (text === "blocked_task_exact_blocker") return "blocked_task_to_exact_blocker"
  return null
}

function buildPaperclipRecommendationId(generatedAt: string) {
  const stamp = generatedAt.replace(/\D/g, '').slice(0, 14) || 'pending'
  return `paperclip_pi_recommendation_${stamp}`
}

function normalizePaperclipProposalKind(value: unknown): PaperclipHermesProposalKind {
  const text = sanitizeIdentifier(value).toLowerCase().replace(/[-\s]+/g, '_')
  if (text === 'mini_agent' || text === 'mini_agent_spec' || text === 'coworker' || text === 'co_worker') return 'mini_agent_spec'
  if (text === 'routine' || text === 'paperclip_routine' || text === 'daily_routine') return 'paperclip_routine'
  if (text === 'skill' || text === 'skill_proposal' || text === 'skill_proposal_document') return 'skill_proposal_document'
  return 'workflow_task_template'
}

function paperclipProposalDefaultTitle(kind: PaperclipHermesProposalKind): string {
  if (kind === 'mini_agent_spec') return 'Hermes mini-agent proposal for Agent Zero review'
  if (kind === 'paperclip_routine') return 'Hermes Paperclip routine draft for Agent Zero review'
  if (kind === 'skill_proposal_document') return 'Hermes skill proposal document for Paperclip tracking'
  return 'Hermes workflow task template for Paperclip tracking'
}

function buildPaperclipProposalId(generatedAt: string) {
  const stamp = generatedAt.replace(/\D/g, '').slice(0, 14) || 'pending'
  return `paperclip_proposal_${stamp}`
}

function normalizePaperclipRequester(value: unknown): 'agent_zero' | 'blocked' {
  const text = sanitizeIdentifier(value).toLowerCase().replace(/[-\s]+/g, '_')
  return text === 'agent_zero' || text === 'agentzero' ? 'agent_zero' : 'blocked'
}

function normalizePaperclipAssignee(value: unknown): PaperclipTaskAssignee | null {
  const text = sanitizeIdentifier(value).toLowerCase().replace(/[-\s]+/g, '_')
  if (text === 'hermes') return 'hermes'
  if (text === 'space_agent' || text === 'spaceagent') return 'space_agent'
  if (text === 'pi' || text === 'pi_review' || text === 'pi_dispatcher') return 'pi_review'
  if (text === 'mini_agent' || text === 'miniagent' || text === 'co_worker' || text === 'coworker') return 'mini_agent'
  return null
}

function paperclipAssigneeRole(assignee: PaperclipTaskAssignee | 'blocked'): string {
  if (assignee === 'hermes') return 'lieutenant_skill_workflow_builder'
  if (assignee === 'space_agent') return 'browser_web_youtube_firecrawl_research_specialist'
  if (assignee === 'pi_review') return 'dispatcher_candidate_route_optimizer_review'
  if (assignee === 'mini_agent') return 'scoped_subordinate_worker_or_co_worker_proposal'
  return 'blocked_unknown_assignee'
}

function buildPaperclipHandoffId(generatedAt: string) {
  const stamp = generatedAt.replace(/\D/g, '').slice(0, 14) || 'pending'
  return `paperclip_handoff_${stamp}`
}

function buildPaperclipWorkforceFlowId(generatedAt: string) {
  const stamp = generatedAt.replace(/\D/g, '').slice(0, 14) || 'pending'
  return `paperclip_workforce_flow_${stamp}`
}

function workforceFlowAuditEvent(event: string, actor: string, target: string, status: PaperclipWorkforceFlowPhaseStatus): PaperclipWorkforceFlowAuditEvent {
  return {
    event,
    actor,
    target,
    status,
    external_write: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

function researchAuditEvent(event: string, actor: string, target: string, status: 'recorded' | 'blocked' | 'needs_more_research') {
  return {
    event,
    actor,
    target,
    status,
    external_write: false as const,
    no_secrets_exposed: true as const,
    raw_paths_exposed: false as const,
  }
}

function handoffAuditEvent(event: string, actor: string, target: string, status: 'recorded' | 'blocked') {
  return {
    event,
    actor,
    target,
    status,
    external_write: false as const,
    no_secrets_exposed: true as const,
    raw_paths_exposed: false as const,
  }
}

function inventoryOk<T>(mode: PaperclipInventoryPayload<T>['mode'], generatedAt: string, items: T[], companySelector?: string | null): PaperclipInventoryPayload<T> {
  return {
    ok: true,
    mode,
    generated_at: generatedAt,
    paperclip_reachable: true,
    company_selector: companySelector || null,
    items,
    count: items.length,
    blocker: null,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

function inventoryBlocked<T>(mode: PaperclipInventoryPayload<T>['mode'], generatedAt: string, blocker: string, companySelector?: string | null): PaperclipInventoryPayload<T> {
  return {
    ok: false,
    mode,
    generated_at: generatedAt,
    paperclip_reachable: false,
    company_selector: companySelector || null,
    items: [],
    count: 0,
    blocker,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

function sanitizeCompany(value: unknown): PaperclipCompanySummary | null {
  const row = objectOrEmpty(value)
  const id = sanitizeIdentifier(row.id)
  const name = sanitizeOwnerText(stringValue(row.name) || '')
  if (!id || !name) return null
  return {
    id,
    name,
    issue_prefix: sanitizeNullable(row.issuePrefix ?? row.issue_prefix),
    status: sanitizeNullable(row.status),
    budget_monthly_cents: numberOrNull(row.budgetMonthlyCents ?? row.budget_monthly_cents),
    spent_monthly_cents: numberOrNull(row.spentMonthlyCents ?? row.spent_monthly_cents),
    require_board_approval_for_new_agents: booleanValue(row.requireBoardApprovalForNewAgents ?? row.require_board_approval_for_new_agents),
    created_at: sanitizeNullable(row.createdAt ?? row.created_at),
    updated_at: sanitizeNullable(row.updatedAt ?? row.updated_at),
  }
}

function sanitizeAgent(value: unknown): PaperclipAgentSummary | null {
  const row = objectOrEmpty(value)
  const id = sanitizeIdentifier(row.id)
  const name = sanitizeOwnerText(stringValue(row.name) || '')
  if (!id || !name) return null
  const metadata = objectOrEmpty(row.metadata)
  return {
    id,
    name,
    role: sanitizeNullable(row.role),
    title: sanitizeNullable(row.title),
    status: sanitizeNullable(row.status),
    company_id: sanitizeNullable(row.companyId ?? row.company_id),
    reports_to: sanitizeNullable(row.reportsTo ?? row.reports_to ?? metadata.reports_to),
    capabilities: arrayFromPayload(row.capabilities).map((item) => sanitizeOwnerText(String(item))).filter(Boolean),
    budget_monthly_cents: numberOrNull(row.budgetMonthlyCents ?? row.budget_monthly_cents),
    spent_monthly_cents: numberOrNull(row.spentMonthlyCents ?? row.spent_monthly_cents),
    last_heartbeat_at: sanitizeNullable(row.lastHeartbeatAt ?? row.last_heartbeat_at),
    gateway_role: sanitizeNullable(metadata.gateway_role),
    owner_visible_status: sanitizeNullable(metadata.owner_visible_status),
    bridge_session_required_for_execution: booleanValue(metadata.bridge_session_required_for_execution),
  }
}

function sanitizeIssue(value: unknown): PaperclipIssueSummary | null {
  const row = objectOrEmpty(value)
  const id = sanitizeIdentifier(row.id)
  const title = sanitizeOwnerText(stringValue(row.title) || '')
  if (!id || !title) return null
  return {
    id,
    identifier: sanitizeNullable(row.identifier ?? row.issueKey ?? row.issue_key),
    title,
    status: sanitizeNullable(row.status),
    priority: sanitizeNullable(row.priority),
    company_id: sanitizeNullable(row.companyId ?? row.company_id),
    assignee_agent: sanitizeNullable(row.assigneeAgentId ?? row.assignee_agent_id) ? 'assigned' : null,
    created_at: sanitizeNullable(row.createdAt ?? row.created_at),
    updated_at: sanitizeNullable(row.updatedAt ?? row.updated_at),
  }
}

function arrayFromPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['items', 'rows', 'companies', 'agents', 'issues', 'data']) {
      if (Array.isArray(record[key])) return record[key] as unknown[]
    }
  }
  return []
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return sanitizeOwnerText(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function sanitizeNullable(value: unknown): string | null {
  const text = stringValue(value)
  return text && text.trim() ? text.trim() : null
}

function sanitizeIdentifier(value: unknown): string {
  const text = stringValue(value) || ''
  return text.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 160)
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null
  if (typeof value === 'string') {
    if (/^(true|yes|1)$/i.test(value)) return true
    if (/^(false|no|0)$/i.test(value)) return false
  }
  return null
}



function normalizePaperclipUiSurfaceId(value: unknown): PaperclipUiAccessSurfaceId {
  const text = sanitizeIdentifier(value).toLowerCase().replace(/[-\s]+/g, "_")
  if (text === "company_dashboard" || text === "dashboard" || text === "company") return "company_dashboard"
  if (text === "org_chart" || text === "orgchart" || text === "organization") return "org_chart"
  if (text === "issues_tasks" || text === "issues" || text === "tasks" || text === "issue_task_page") return "issues_tasks"
  if (text === "budget" || text === "budgets") return "budget"
  if (text === "approvals" || text === "approval") return "approvals"
  if (text === "agent_detail_pages" || text === "agent_detail" || text === "agents") return "agent_detail_pages"
  return "company_dashboard"
}

function paperclipUiSurfaceLabel(id: PaperclipUiAccessSurfaceId): string {
  if (id === "company_dashboard") return "Company dashboard"
  if (id === "org_chart") return "Org chart"
  if (id === "issues_tasks") return "Issue and task page"
  if (id === "budget") return "Budget page"
  if (id === "approvals") return "Approvals page"
  return "Agent detail pages"
}

function paperclipUiSurfaceRouteHint(id: PaperclipUiAccessSurfaceId): string {
  if (id === "company_dashboard") return "/companies/to-knowledge-gateway"
  if (id === "org_chart") return "/companies/to-knowledge-gateway/org-chart"
  if (id === "issues_tasks") return "/companies/to-knowledge-gateway/issues"
  if (id === "budget") return "/companies/to-knowledge-gateway/budget"
  if (id === "approvals") return "/companies/to-knowledge-gateway/approvals"
  return "/companies/to-knowledge-gateway/agents/agent-zero"
}

function buildPaperclipUiSurfaceConfirmation(id: PaperclipUiAccessSurfaceId, input: {
  reachable: boolean
  ownerLoginConfirmed: boolean
  probe: PaperclipUiAccessSurfaceProbe | null
  baseBlocker: string | null
}): PaperclipUiAccessSurfaceConfirmation {
  const probeReachable = input.probe?.reachable
  const confirmed = input.reachable && input.ownerLoginConfirmed && probeReachable !== false && !input.probe?.blocker
  const blocker = input.baseBlocker
    || (!input.ownerLoginConfirmed ? "paperclip_owner_login_not_confirmed" : null)
    || (probeReachable === false ? "paperclip_ui_surface_not_reachable" : null)
    || sanitizeNullable(input.probe?.blocker)

  return {
    id,
    label: paperclipUiSurfaceLabel(id),
    route_hint: paperclipUiSurfaceRouteHint(id),
    confirmed,
    status_code: numberOrNull(input.probe?.statusCode),
    requires_owner_login: input.probe?.requiresLogin !== false,
    policy_result: confirmed ? "allowed" : "blocked",
    blocker: confirmed ? null : blocker,
  }
}

function isPaperclipSurfaceConfirmed(surfaces: PaperclipUiAccessSurfaceConfirmation[], id: PaperclipUiAccessSurfaceId): boolean {
  return surfaces.some((surface) => surface.id === id && surface.confirmed)
}

function defaultPort(protocol: string) {
  return protocol === 'https:' ? '443' : '80'
}

function sanitizeOwnerText(value: string) {
  return String(value || '')
    .replace(/sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?FILE)\s*[:=]\s*[^,\s}]+/gi, '[redacted-secret]')
    .replace(/(?:\/(?:home|Users|a0|tmp|var|private)\/|[A-Z]:\\)[^\s`'"\])}]*/gi, '[redacted-path]')
    .trim()
}
