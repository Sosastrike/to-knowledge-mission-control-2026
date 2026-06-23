import crypto from 'node:crypto'
import type { User } from '@/lib/auth'
import {
  buildAgentZeroInternalAuthHeaders,
  getAgentZeroApiKeyState,
  getAgentZeroBaseUrl,
} from '@/lib/agent-zero-bridge'

export type AgentPlatformInputMode = 'QUEUE' | 'STEER' | 'CANCEL'
export type AgentPlatformAgentId = string
export type ModelSelectionScope = 'THIS_TURN' | 'THIS_JOB' | 'THIS_SESSION' | 'AGENT_DEFAULT'
export type FallbackPolicy = 'STRICT' | 'ASK_BEFORE_FALLBACK' | 'AUTO_FALLBACK'

export type AgentPlatformAgentSummary = {
  agent_id: string
  display_name: string
  status: 'active' | 'unknown'
  runtime_adapter: string | null
  owner_route: string
  registered_for_production: boolean
  durable_submission_enabled: boolean
  durable_worker_enabled: boolean
  test_fixture: false
}

export type AgentPlatformJobSummary = {
  platform_job_id: string | null
  job_id: string
  task_id: string
  target_agent_id: string
  runtime_adapter: string | null
  state: string
  priority: number | null
  queue_reason: string | null
  worker_id: string | null
  lease_expires_at: number | null
  last_heartbeat_at: number | null
  checkpoint_id: string | null
  current_model: string | null
  previous_models: string[]
  requested_route_id: string | null
  requested_provider_id: string | null
  requested_model_id: string | null
  selection_scope: ModelSelectionScope | null
  fallback_policy: FallbackPolicy | null
  provider_lock: string | null
  deployment_lock: string | null
  effective_route_id: string | null
  effective_provider_id: string | null
  effective_model_id: string | null
  route_selected_at: number | null
  route_state: string | null
  fallback_reason: string | null
  fallback_approved_by: string | null
  transition_history: Record<string, unknown>[]
  cancellation_requested: boolean
  error_code: string | null
  correlation_id: string | null
  status_url: string
  detail_url: string
}

export type AgentPlatformEventSummary = {
  event_id: string | null
  job_id: string | null
  task_id: string | null
  target_agent_id: string | null
  type: string
  previous_state: string | null
  new_state: string | null
  reason: string | null
  created_at: number | null
  correlation_id: string | null
}

export type AgentPlatformDiagnostics = {
  ok: boolean
  mode: 'agent_platform_diagnostics'
  source: 'agent_zero_durable_runtime'
  schema_version: string | null
  platform_schema_version: string | null
  migration_id: string | null
  controls: Record<string, unknown>
  store_health: Record<string, unknown>
  registered_agents: string[]
  agents: AgentPlatformAgentSummary[]
  jobs_total: number
  active_workers: number
  worker_slots_configured: number
  jobs: AgentPlatformJobSummary[]
  events: AgentPlatformEventSummary[]
  results: Record<string, unknown>
  runtime: Record<string, unknown>
  generated_at: string
  credential_values_exposed: false
  no_secrets_exposed: true
}

type BridgeResult = {
  ok: boolean
  status: number
  payload: unknown
}

const SECRET_KEY_RE = /(^|_)(api_?key|token|telegram_?token|password|cookie|authorization|auth_?header|bearer|session_?secret|client_?secret|env|credentials)($|_)/i
const SECRET_VALUE_RE = /(sk-[A-Za-z0-9_-]{12,}|[0-9]{6,}:[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{16,}|SYNTHETIC_FAKE_[A-Z0-9_]*(?:SECRET|TOKEN|API_KEY))/gi
const INTERNAL_ORIGIN_RE = /https?:\/\/(?:100(?:\.\d{1,3}){3}|127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/[^\s"'<>]*)?/gi
const INTERNAL_HOST_RE = /\b(?:100(?:\.\d{1,3}){3}|127\.0\.0\.1|localhost)(?::\d+)?\b/gi
const RAW_PATH_RE = /(?:\/(?:home|Users|a0|tmp|var|private)\/)[^\s"'`,)}\]]+/g

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function redactString(value: string): string {
  return value
    .replace(SECRET_VALUE_RE, '[redacted-secret]')
    .replace(INTERNAL_ORIGIN_RE, '[internal-origin]')
    .replace(INTERNAL_HOST_RE, '[internal-host]')
    .replace(RAW_PATH_RE, '[redacted-path]')
}

export function sanitizeAgentPlatformPayload(value: unknown, keyName = ''): unknown {
  if (SECRET_KEY_RE.test(keyName)) return '[redacted-secret]'
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.map((item) => sanitizeAgentPlatformPayload(item))
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeAgentPlatformPayload(item, key)]),
    )
  }
  return value
}

export function normalizeAgentPlatformAgentId(raw: string | null | undefined): string | null {
  const normalized = String(raw || '').trim().toLowerCase().replace(/-/g, '_')
  if (!normalized || !/^[a-z0-9_]+$/.test(normalized)) return null
  if (normalized.startsWith('test_agent_')) return null
  return normalized
}

export function rolePermissions(role: User['role']): string[] {
  if (role === 'admin') return ['platform:admin', 'agent:diagnostics', 'agent:message', 'agent:cancel']
  if (role === 'operator') return ['agent:diagnostics', 'agent:message']
  return ['agent:diagnostics']
}

export function buildMissionControlActorContext(input: {
  user: User
  targetAgentId: string
  correlationId?: string
  requiredPermission?: 'agent:diagnostics' | 'agent:message' | 'agent:cancel'
}): Record<string, unknown> {
  const user = input.user
  const actorId = user.id < 0 ? `svc_${Math.abs(user.id)}` : `usr_${user.id}`
  const sessionId = typeof (user as User & { sessionId?: number }).sessionId === 'number'
    ? `mc_session_${(user as User & { sessionId: number }).sessionId}`
    : `mc_authenticated_${crypto.createHash('sha256').update(`${user.id}:${user.workspace_id}:${user.tenant_id}`).digest('hex').slice(0, 12)}`
  const permissions = rolePermissions(user.role)
  const permissionSnapshotHash = `perm_${crypto.createHash('sha256').update(JSON.stringify({
    user_id: user.id,
    role: user.role,
    workspace_id: user.workspace_id,
    tenant_id: user.tenant_id,
    target_agent_id: input.targetAgentId,
    permissions,
  })).digest('hex').slice(0, 24)}`
  return {
    requesting_actor_id: actorId,
    actor_id: actorId,
    actor_type: user.id < 0 ? 'service' : 'human',
    requesting_actor_type: user.id < 0 ? 'service' : 'human',
    target_agent_id: input.targetAgentId,
    organization_id: 'org_luis',
    session_id: sessionId,
    role_ids: [`mission_control:${user.role}`],
    delegation_reference: user.agent_name ? `agent_api_key:${user.agent_name}` : null,
    effective_permissions: permissions,
    permission_snapshot_hash: permissionSnapshotHash,
    approval_context: null,
    correlation_id: input.correlationId || `mc_${crypto.randomUUID()}`,
  }
}

export function buildAgentPlatformSubmissionBody(input: {
  user: User
  targetAgentId: string
  message: string
  inputMode?: AgentPlatformInputMode
  idempotencyKey?: string | null
  jobId?: string | null
  taskId?: string | null
  conversationId?: string | null
  reason?: string
  priority?: number
  requiredPermission?: 'agent:message' | 'agent:cancel'
  requestedRouteId?: string | null
  selectionScope?: ModelSelectionScope | null
  fallbackPolicy?: FallbackPolicy | null
  providerLock?: string | null
  deploymentLock?: string | null
  noOpenAI?: boolean
}): Record<string, unknown> {
  const mode = input.inputMode || 'QUEUE'
  const actor = buildMissionControlActorContext({
    user: input.user,
    targetAgentId: input.targetAgentId,
    requiredPermission: input.requiredPermission || (mode === 'CANCEL' ? 'agent:cancel' : 'agent:message'),
  })
  return {
    ...actor,
    target_agent_id: input.targetAgentId,
    agent_id: input.targetAgentId,
    message: input.message.trim().slice(0, 8000),
    input_mode: mode,
    mode,
    idempotency_key: input.idempotencyKey || undefined,
    job_id: input.jobId || undefined,
    task_id: input.taskId || undefined,
    conversation_id: input.conversationId || undefined,
    priority: input.priority ?? 100,
    reason: input.reason || (mode === 'QUEUE' ? 'mission_control_queue_message' : mode === 'STEER' ? 'mission_control_steer' : 'mission_control_cancel'),
    requested_route_id: input.requestedRouteId || undefined,
    selection_scope: input.selectionScope || undefined,
    fallback_policy: input.fallbackPolicy || undefined,
    provider_lock: input.providerLock || undefined,
    deployment_lock: input.deploymentLock || undefined,
    no_openai: input.noOpenAI === true || undefined,
  }
}

function parsePayload(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw_response_text: text.slice(0, 500) }
  }
}

export async function callAgentZeroPlatformApi(path: string, body: Record<string, unknown>, timeoutMs = 15000): Promise<BridgeResult> {
  const auth = buildAgentZeroInternalAuthHeaders()
  if (!auth) {
    return {
      ok: false,
      status: 503,
      payload: {
        ok: false,
        error: 'agent_zero_platform_api_key_missing',
        credential_state: getAgentZeroApiKeyState(),
        credential_values_exposed: false,
      },
    }
  }
  const endpoint = `${getAgentZeroBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'Content-Type': 'application/json',
        ...auth.headers,
      },
      body: JSON.stringify(body),
    })
    const payload = parsePayload(await response.text())
    return { ok: response.ok, status: response.status, payload: sanitizeAgentPlatformPayload(payload) }
  } catch (error) {
    return {
      ok: false,
      status: 503,
      payload: {
        ok: false,
        error: error instanceof Error && error.name === 'AbortError' ? 'agent_platform_proxy_timeout' : 'agent_platform_proxy_unreachable',
        stage: 'mission_control_to_agent_platform',
        credential_values_exposed: false,
      },
    }
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asBool(value: unknown): boolean {
  return value === true
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function titleFromAgentId(agentId: string): string {
  if (agentId === 'agent_zero') return 'Agent Zero'
  if (agentId === 'hermes') return 'Hermes'
  return agentId.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function agentOwnerRoute(agentId: string): string {
  return agentId === 'agent_zero'
    ? '/gateway/agent-hub/agent-zero/chat'
    : `/gateway/agents/${encodeURIComponent(agentId)}/jobs`
}

function isControlSurfaceAgentId(agentId: string): boolean {
  return agentId === 'ron' || agentId === 'hermes_webui'
}

function agentDetails(record: Record<string, unknown>, agentId: string): Record<string, unknown> {
  const details = isRecord(record.registered_agent_details) ? record.registered_agent_details : {}
  const detail = details[agentId]
  return isRecord(detail) ? detail : {}
}

function runtimeAdapterFor(agentId: string, detail: Record<string, unknown>): string | null {
  if (typeof detail.runtime_adapter === 'string') return detail.runtime_adapter
  if (agentId === 'agent_zero') return 'agent_zero'
  if (agentId === 'hermes') return 'hermes'
  return null
}

function durableSubmissionEnabled(agentId: string, controls: Record<string, unknown>): boolean {
  const globalEnabled = controls.durable_message_submission_enabled === true
  if (agentId === 'hermes') return globalEnabled && controls.hermes_durable_submission_enabled === true
  return globalEnabled
}

function durableWorkerEnabled(agentId: string, controls: Record<string, unknown>): boolean {
  const globalEnabled = controls.durable_worker_enabled === true
  if (agentId === 'hermes') return globalEnabled && controls.hermes_shared_worker_enabled === true
  return globalEnabled
}

function normalizeJob(value: unknown): AgentPlatformJobSummary | null {
  if (!isRecord(value)) return null
  const jobId = asString(value.job_id)
  const taskId = asString(value.task_id)
  const targetAgentId = normalizeAgentPlatformAgentId(asString(value.target_agent_id))
  if (!jobId || !taskId || !targetAgentId) return null
  return {
    platform_job_id: typeof value.platform_job_id === 'string' ? value.platform_job_id : null,
    job_id: jobId,
    task_id: taskId,
    target_agent_id: targetAgentId,
    runtime_adapter: typeof value.runtime_adapter === 'string' ? value.runtime_adapter : null,
    state: asString(value.state, 'UNKNOWN'),
    priority: asNumberOrNull(value.priority),
    queue_reason: typeof value.queue_reason === 'string' ? value.queue_reason : null,
    worker_id: typeof value.worker_id === 'string' ? value.worker_id : null,
    lease_expires_at: asNumberOrNull(value.lease_expires_at),
    last_heartbeat_at: asNumberOrNull(value.last_heartbeat_at),
    checkpoint_id: typeof value.checkpoint_id === 'string' ? value.checkpoint_id : null,
    current_model: typeof value.current_model === 'string' ? value.current_model : null,
    previous_models: arrayOfStrings(value.previous_models),
    requested_route_id: typeof value.requested_route_id === 'string' ? value.requested_route_id : null,
    requested_provider_id: typeof value.requested_provider_id === 'string' ? value.requested_provider_id : typeof value.requested_provider === 'string' ? value.requested_provider : null,
    requested_model_id: typeof value.requested_model_id === 'string' ? value.requested_model_id : typeof value.requested_model === 'string' ? value.requested_model : null,
    selection_scope: typeof value.selection_scope === 'string' ? value.selection_scope as ModelSelectionScope : null,
    fallback_policy: typeof value.fallback_policy === 'string' ? value.fallback_policy as FallbackPolicy : null,
    provider_lock: typeof value.provider_lock === 'string' ? value.provider_lock : null,
    deployment_lock: typeof value.deployment_lock === 'string' ? value.deployment_lock : null,
    effective_route_id: typeof value.effective_route_id === 'string' ? value.effective_route_id : null,
    effective_provider_id: typeof value.effective_provider_id === 'string' ? value.effective_provider_id : typeof value.effective_provider === 'string' ? value.effective_provider : null,
    effective_model_id: typeof value.effective_model_id === 'string' ? value.effective_model_id : typeof value.effective_model === 'string' ? value.effective_model : null,
    route_selected_at: asNumberOrNull(value.route_selected_at),
    route_state: typeof value.route_state === 'string' ? value.route_state : null,
    fallback_reason: typeof value.fallback_reason === 'string' ? value.fallback_reason : null,
    fallback_approved_by: typeof value.fallback_approved_by === 'string' ? value.fallback_approved_by : null,
    transition_history: Array.isArray(value.transition_history) ? value.transition_history.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item))) : [],
    cancellation_requested: asBool(value.cancellation_requested),
    error_code: typeof value.error_code === 'string' ? value.error_code : null,
    correlation_id: typeof value.correlation_id === 'string' ? value.correlation_id : null,
    status_url: `/api/agent-platform/jobs/${encodeURIComponent(jobId)}`,
    detail_url: `/gateway/agents/${encodeURIComponent(targetAgentId)}/jobs/${encodeURIComponent(jobId)}`,
  }
}

function normalizeEvent(value: unknown): AgentPlatformEventSummary | null {
  if (!isRecord(value)) return null
  return {
    event_id: typeof value.event_id === 'string' ? value.event_id : null,
    job_id: typeof value.job_id === 'string' ? value.job_id : null,
    task_id: typeof value.task_id === 'string' ? value.task_id : null,
    target_agent_id: typeof value.target_agent_id === 'string' ? value.target_agent_id : null,
    type: asString(value.type || value.event_type, 'event'),
    previous_state: typeof value.previous_state === 'string' ? value.previous_state : null,
    new_state: typeof value.new_state === 'string' ? value.new_state : null,
    reason: typeof value.reason === 'string' ? value.reason : null,
    created_at: asNumberOrNull(value.created_at),
    correlation_id: typeof value.correlation_id === 'string' ? value.correlation_id : null,
  }
}

export function normalizeAgentPlatformDiagnostics(payload: unknown): AgentPlatformDiagnostics {
  const record = isRecord(payload) ? payload : {}
  const controls = isRecord(record.controls) ? record.controls : {}
  const rawRegistered = Array.isArray(record.registered_agents) ? record.registered_agents : ['agent_zero']
  const registeredAgents = Array.from(new Set(rawRegistered
    .map((item) => normalizeAgentPlatformAgentId(typeof item === 'string' ? item : null))
    .filter((item): item is AgentPlatformAgentId => Boolean(item) && !isControlSurfaceAgentId(item as AgentPlatformAgentId))))
  const agents = registeredAgents.map((agentId) => {
    const detail = agentDetails(record, agentId)
    return {
      agent_id: agentId,
      display_name: typeof detail.display_name === 'string' ? detail.display_name : titleFromAgentId(agentId),
      status: 'active' as const,
      runtime_adapter: runtimeAdapterFor(agentId, detail),
      owner_route: agentOwnerRoute(agentId),
      registered_for_production: true,
      durable_submission_enabled: durableSubmissionEnabled(agentId, controls),
      durable_worker_enabled: durableWorkerEnabled(agentId, controls),
      test_fixture: false as const,
    }
  })
  const jobs = Array.isArray(record.jobs)
    ? record.jobs.map(normalizeJob).filter((job): job is AgentPlatformJobSummary => Boolean(job))
    : []
  const events = Array.isArray(record.events)
    ? record.events.map(normalizeEvent).filter((event): event is AgentPlatformEventSummary => Boolean(event))
    : []
  const results = isRecord(record.results) ? record.results : {}
  return {
    ok: true,
    mode: 'agent_platform_diagnostics',
    source: 'agent_zero_durable_runtime',
    schema_version: typeof record.schema_version === 'string' ? record.schema_version : null,
    platform_schema_version: typeof record.platform_schema_version === 'string' ? record.platform_schema_version : null,
    migration_id: typeof record.migration_id === 'string' ? record.migration_id : null,
    controls,
    store_health: isRecord(record.store_health) ? record.store_health : {},
    registered_agents: registeredAgents,
    agents,
    jobs_total: typeof record.jobs_total === 'number' ? record.jobs_total : jobs.length,
    active_workers: typeof record.active_workers === 'number' ? record.active_workers : 0,
    worker_slots_configured: typeof record.worker_slots_configured === 'number' ? record.worker_slots_configured : 0,
    jobs,
    events,
    results,
    runtime: isRecord(record.runtime) ? record.runtime : {},
    generated_at: new Date().toISOString(),
    credential_values_exposed: false,
    no_secrets_exposed: true,
  }
}

export async function fetchAgentPlatformDiagnostics(input: {
  user: User
  targetAgentId?: string
  includeEvents?: boolean
  includeResults?: boolean
}): Promise<{ status: number; diagnostics: AgentPlatformDiagnostics; upstream_ok: boolean; upstream_error: unknown }> {
  const targetAgentId = normalizeAgentPlatformAgentId(input.targetAgentId || 'agent_zero') || 'agent_zero'
  const actor = buildMissionControlActorContext({
    user: input.user,
    targetAgentId,
    requiredPermission: 'agent:diagnostics',
  })
  const upstream = await callAgentZeroPlatformApi('/api/durable_jobs', {
    ...actor,
    target_agent_id: targetAgentId,
    include_events: Boolean(input.includeEvents),
    include_results: Boolean(input.includeResults),
  })
  const diagnostics = normalizeAgentPlatformDiagnostics(upstream.payload)
  return {
    status: upstream.ok ? 200 : upstream.status,
    diagnostics,
    upstream_ok: upstream.ok,
    upstream_error: upstream.ok ? null : upstream.payload,
  }
}

export function findAgentPlatformJob(diagnostics: AgentPlatformDiagnostics, jobId: string): AgentPlatformJobSummary | null {
  return diagnostics.jobs.find((job) => job.job_id === jobId || job.platform_job_id === jobId) || null
}

export function resultForJob(diagnostics: AgentPlatformDiagnostics, jobId: string): unknown {
  const result = diagnostics.results[jobId]
  return sanitizeAgentPlatformPayload(result)
}
