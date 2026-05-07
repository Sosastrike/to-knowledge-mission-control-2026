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

type FetchJsonResult =
  | { ok: true; status: number; payload: unknown }
  | { ok: false; status: number; blocker: string }

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const DEFAULT_PAPERCLIP_BASE_URL = 'http://127.0.0.1:3100'
const PAPERCLIP_TIMEOUT_MS = 2500

export function resolvePaperclipEndpoint(rawValue?: string | null) {
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

export async function buildPaperclipStatusPayload(input: {
  generatedAt: string
  fetchImpl?: FetchLike
  baseUrl?: string | null
}): Promise<PaperclipSafeStatusPayload> {
  const endpoint = resolvePaperclipEndpoint(input.baseUrl)
  const baseStatus = basePayload(input.generatedAt, endpoint.ownerVisible, endpoint.uiLink)
  if (endpoint.blocker) {
    return {
      ...baseStatus,
      health: 'blocked',
      configured: false,
      blocker: endpoint.blocker,
    }
  }

  const health = await fetchPaperclipJson('/api/health', {
    baseUrl: endpoint.baseUrl,
    fetchImpl: input.fetchImpl,
  })
  if (!health.ok) {
    return {
      ...baseStatus,
      health: 'degraded',
      reachable: false,
      configured: false,
      blocker: health.blocker,
    }
  }

  const summary = summarizeHealthPayload(health.payload)
  const workforce = await summarizeWorkforceState({ baseUrl: endpoint.baseUrl, fetchImpl: input.fetchImpl })
  return {
    ...baseStatus,
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

async function fetchReadOnlyList(path: string, input: { fetchImpl?: FetchLike; baseUrl?: string | null }): Promise<FetchJsonResult> {
  const endpoint = resolvePaperclipEndpoint(input.baseUrl)
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
      local_only: true,
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

function defaultPort(protocol: string) {
  return protocol === 'https:' ? '443' : '80'
}

function sanitizeOwnerText(value: string) {
  return String(value || '')
    .replace(/sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?FILE)\s*[:=]\s*[^,\s}]+/gi, '[redacted-secret]')
    .replace(/(?:\/(?:home|Users|a0|tmp|var|private)\/|[A-Z]:\\)[^\s`'"\])}]*/gi, '[redacted-path]')
    .trim()
}
