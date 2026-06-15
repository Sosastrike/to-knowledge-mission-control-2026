import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { getDatabase, Task, db_helpers } from '@/lib/db'
import { eventBus } from '@/lib/event-bus'
import { listJarvisInternalRecords } from '@/lib/jarvis-internal-state'
import {
  canCompleteAgentWorkTicket,
  computeHeartbeatState,
  listAgentWorkEvents,
  logAgentWorkEvent,
  mergeTaskMetadataForAgentWorkTicket,
} from '@/lib/agent-work-tickets'

export const JARVIS_VISIBLE_TASK_PROGRESS_ADAPTER_ID = 'jarvis_visible_task_progress_update'
export const JARVIS_VISIBLE_TASK_PROGRESS_ACTION = 'mission_control.visible_task_progress.update'
export const JARVIS_VISIBLE_TASK_PROGRESS_SESSION_SCOPE = 'jarvis_visible_task_progress_update'

export const VISIBLE_TASK_SURFACE_ROUTE = '/designer-mission-control/Mission%20Control.html?page=mission'
export const VISIBLE_TASK_API_ROUTE = '/api/tasks'
export const VISIBLE_TASK_BACKING_STORE = 'sqlite:tasks'

export type VisibleTaskDeliveryState =
  | 'VISIBLE_PROGRESS_REQUIRED'
  | 'VISIBLE_PROGRESS_UPDATED'
  | 'DELIVERY_RETRY_REQUIRED'
  | 'DELIVERY_FAILURE_POSSIBLE'
  | 'DELIVERY_FAILURE'
  | 'EXECUTION_LOOP_DETECTED'

export type VisibleTaskProgressInput = {
  task_id: number
  title?: string
  status?: Task['status'] | 'done' | 'complete'
  percent?: number
  current_phase?: string | null
  blocker?: string | null
  next_action?: string | null
  proof_link?: string | null
  delivery_state?: VisibleTaskDeliveryState
  completion_proof_visible?: boolean
  browser_dom_proof?: boolean
  visible_api_returned_update?: boolean
  request_fingerprint?: string | null
  currently_doing?: string | null
  current_step?: string | null
  current_tool_or_route?: string | null
  expected_next_update_type?: string | null
  files_routes_touched?: string[]
  apis_called?: string[]
  adapters_used?: string[]
  proof_records?: string[]
  audit_records?: string[]
  rollback_path?: string | null
  final_result?: string | null
  blocked_lane?: string | null
  affected_system?: string | null
  needed_to_unblock?: string | null
  blocker_reason?: string | null
  continued_work?: string[]
  next_safe_lane?: string | null
  project_continues?: boolean
  mutation_occurred?: boolean
  previous_metadata?: Record<string, unknown>
}

export type VisibleTaskProgressPatch = {
  table: 'tasks'
  internal_only: false
  values: {
    title?: string
    status: Task['status']
    error_message: string | null
    resolution: string | null
    metadata: Record<string, unknown>
  }
}

export type VisibleTaskProgressTruth = {
  visible_surface_route: string
  visible_api_route: string
  backing_store: string
  last_visible_update: string | null
  current_task_id: number | null
  current_status: string | null
  current_percent: number | null
  blocker: string | null
  proof_visible_to_owner: boolean
  stale_cache_detected: boolean
  wrong_surface_detected: boolean
  visible_progress_field: 'tasks.metadata.progress'
  visible_task_field: 'tasks.title'
  supporting_fields: string[]
  selected_ticket_id?: number | null
  current_phase?: string | null
  heartbeat_state?: string
  latest_event?: Record<string, unknown> | null
  final_result_present?: boolean
  audit_record_present?: boolean
  rollback_path_present?: boolean
  owner_visible_blocker_packet?: Record<string, unknown> | null
  credential_values_exposed: false
}

type TaskRow = Task & {
  project_name?: string | null
  project_prefix?: string | null
  ticket_ref?: string | null
  tags?: unknown
  metadata?: unknown
}

const requestLoopPath = join(config.dataDir, 'jarvis-visible-task-request-loop.json')

function clampPercent(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function cleanNullableText(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function asTaskStatus(value: unknown): Task['status'] {
  const status = String(value || '').trim()
  if (status === 'complete') return 'done'
  const allowed = new Set(['backlog', 'inbox', 'assigned', 'awaiting_owner', 'in_progress', 'review', 'quality_review', 'done', 'failed'])
  return allowed.has(status) ? status as Task['status'] : 'in_progress'
}

function isProofVisible(input: Pick<VisibleTaskProgressInput, 'completion_proof_visible' | 'browser_dom_proof' | 'visible_api_returned_update'>) {
  if (input.completion_proof_visible === true) return true
  return isVisibleProofSatisfied({
    visible_api_returned_update: input.visible_api_returned_update === true,
    browser_dom_proof: input.browser_dom_proof === true,
  })
}

export function buildVisibleTaskProgressPatch(input: VisibleTaskProgressInput): VisibleTaskProgressPatch {
  const percent = clampPercent(input.percent)
  const proofVisible = isProofVisible(input)
  const requestedStatus = asTaskStatus(input.status)
  const status = requestedStatus === 'done' && !proofVisible ? 'review' : requestedStatus
  const blocker = cleanNullableText(input.blocker)
  const currentPhase = cleanNullableText(input.current_phase, 240)
  const nextAction = cleanNullableText(input.next_action, 500)
  const proofLink = cleanNullableText(input.proof_link, 500)
  const deliveryState = input.delivery_state || (proofVisible ? 'VISIBLE_PROGRESS_UPDATED' : 'VISIBLE_PROGRESS_UPDATED')
  const previousMetadata = input.previous_metadata || {}
  const at = new Date().toISOString()
  const proofRecords = Array.isArray(input.proof_records) ? input.proof_records : []
  const ticketMetadata = mergeTaskMetadataForAgentWorkTicket(previousMetadata, {
    ticket_id: String(input.task_id),
    assigned_agent: 'agent-zero',
    agent_runtime: 'Agent Zero / Jarvis',
    task_title: cleanNullableText(input.title, 240) || 'Mission Control visible task',
    task_type: 'owner_visible_agent_work',
    current_status: status,
    current_phase: currentPhase,
    progress_percent: percent,
    delivery_state: deliveryState,
    blocker,
    next_action: nextAction,
    proof_visible_to_owner: proofVisible,
    currently_doing: cleanNullableText(input.currently_doing, 1000),
    current_step: cleanNullableText(input.current_step, 1000),
    current_tool_or_route: cleanNullableText(input.current_tool_or_route, 1000),
    current_blocker: blocker,
    expected_next_update_type: cleanNullableText(input.expected_next_update_type, 500),
    files_routes_touched: Array.isArray(input.files_routes_touched) ? input.files_routes_touched : [],
    apis_called: Array.isArray(input.apis_called) ? input.apis_called : [],
    adapters_used: Array.isArray(input.adapters_used) ? input.adapters_used : [JARVIS_VISIBLE_TASK_PROGRESS_ADAPTER_ID],
    proof_records: proofLink ? [proofLink, ...proofRecords] : proofRecords,
    audit_records: Array.isArray(input.audit_records) ? input.audit_records : [],
    rollback_path: cleanNullableText(input.rollback_path, 2000),
    final_result: cleanNullableText(input.final_result, 3000),
    blocked_lane: cleanNullableText(input.blocked_lane, 500),
    affected_system: cleanNullableText(input.affected_system, 500),
    needed_to_unblock: cleanNullableText(input.needed_to_unblock, 1000),
    blocker_reason: cleanNullableText(input.blocker_reason, 1000),
    continued_work: Array.isArray(input.continued_work) ? input.continued_work : [],
    next_safe_lane: cleanNullableText(input.next_safe_lane, 1000),
    project_continues: input.project_continues === true,
    mutation_occurred: input.mutation_occurred !== false,
  }, at)

  const metadata = {
    ...ticketMetadata,
    proof_link: proofLink,
    jarvis_visible_update: {
      at,
      actor: 'agent-zero-jarvis',
      task_id: input.task_id,
      progress: percent,
      proof_visible_to_owner: proofVisible,
      request_fingerprint: cleanNullableText(input.request_fingerprint, 80),
      visible_surface_route: VISIBLE_TASK_SURFACE_ROUTE,
      visible_api_route: `${VISIBLE_TASK_API_ROUTE}/${input.task_id}`,
    },
  }

  return {
    table: 'tasks',
    internal_only: false,
    values: {
      title: cleanNullableText(input.title, 240) || undefined,
      status,
      error_message: blocker,
      resolution: proofVisible ? 'Jarvis visible task progress proof recorded.' : null,
      metadata,
    },
  }
}

function visibleUpdateAt(metadata: Record<string, unknown>) {
  const update = parseJsonObject(metadata.jarvis_visible_update)
  const at = typeof update.at === 'string' ? Date.parse(update.at) : NaN
  return Number.isFinite(at) ? Math.floor(at / 1000) : null
}

function metadataPercent(metadata: Record<string, unknown>) {
  if (metadata.progress === undefined || metadata.progress === null) return null
  return clampPercent(metadata.progress)
}

export function buildTaskProgressTruth(input: {
  task?: { id?: number | null; status?: string | null; updated_at?: number | null; metadata?: unknown; error_message?: string | null } | null
  latest_internal_record_at?: number | null
  browser_cache_at?: number | null
  latest_event?: Record<string, unknown> | null
}): VisibleTaskProgressTruth {
  const task = input.task || null
  const metadata = parseJsonObject(task?.metadata)
  const jarvisUpdate = parseJsonObject(metadata.jarvis_visible_update)
  const proofVisible = Boolean(jarvisUpdate.proof_visible_to_owner || metadata.proof_visible_to_owner)
  const lastVisibleUpdateSeconds = visibleUpdateAt(metadata) || (typeof task?.updated_at === 'number' ? task.updated_at : null)
  const latestInternal = typeof input.latest_internal_record_at === 'number' ? input.latest_internal_record_at : null
  const staleCacheAt = typeof input.browser_cache_at === 'number' ? input.browser_cache_at : null
  const wrongSurfaceDetected = Boolean(
    !proofVisible &&
    latestInternal &&
    lastVisibleUpdateSeconds &&
    latestInternal > lastVisibleUpdateSeconds
  )

  const ticket = parseJsonObject(metadata.agent_work_ticket)
  const blockerPacket = parseJsonObject(metadata.owner_visible_blocker_packet)
  const latestEvent = input.latest_event || null

  return {
    visible_surface_route: VISIBLE_TASK_SURFACE_ROUTE,
    visible_api_route: VISIBLE_TASK_API_ROUTE,
    backing_store: VISIBLE_TASK_BACKING_STORE,
    last_visible_update: lastVisibleUpdateSeconds ? new Date(lastVisibleUpdateSeconds * 1000).toISOString() : null,
    current_task_id: typeof task?.id === 'number' ? task.id : null,
    selected_ticket_id: typeof task?.id === 'number' ? task.id : null,
    current_status: typeof task?.status === 'string' ? task.status : null,
    current_percent: metadataPercent(metadata),
    current_phase: cleanNullableText(ticket.current_phase) || cleanNullableText(metadata.current_phase) || null,
    heartbeat_state: computeHeartbeatState(ticket as never),
    latest_event: latestEvent as Record<string, unknown> | null,
    final_result_present: typeof ticket.final_result === 'string' && ticket.final_result.trim().length > 0,
    audit_record_present: Array.isArray(ticket.audit_records) && ticket.audit_records.length > 0,
    rollback_path_present: typeof ticket.rollback_path === 'string' && ticket.rollback_path.trim().length > 0,
    owner_visible_blocker_packet: Object.keys(blockerPacket).length ? blockerPacket : null,
    blocker: cleanNullableText(metadata.blocker) || cleanNullableText(task?.error_message) || null,
    proof_visible_to_owner: proofVisible,
    stale_cache_detected: Boolean(staleCacheAt && lastVisibleUpdateSeconds && staleCacheAt < lastVisibleUpdateSeconds),
    wrong_surface_detected: wrongSurfaceDetected,
    visible_progress_field: 'tasks.metadata.progress',
    visible_task_field: 'tasks.title',
    supporting_fields: [
      'tasks.status',
      'tasks.error_message',
      'tasks.resolution',
      'tasks.updated_at',
      'tasks.metadata.current_phase',
      'tasks.metadata.blocker',
      'tasks.metadata.next_action',
      'tasks.metadata.proof_link',
      'tasks.metadata.delivery_state',
    ],
    credential_values_exposed: false,
  }
}

export function detectJarvisRequestLoop(input: { repeated_count: number; visible_progress_changed: boolean }) {
  if (input.visible_progress_changed) {
    return { delivery_state: 'VISIBLE_PROGRESS_UPDATED' as const, exact_blocker: null }
  }
  if (input.repeated_count >= 3) {
    return { delivery_state: 'EXECUTION_LOOP_DETECTED' as const, exact_blocker: 'execution_loop_detected_visible_progress_not_updated' }
  }
  if (input.repeated_count >= 2) {
    return { delivery_state: 'DELIVERY_FAILURE_POSSIBLE' as const, exact_blocker: 'visible_delivery_failure_possible' }
  }
  return { delivery_state: 'VISIBLE_PROGRESS_REQUIRED' as const, exact_blocker: 'visible_progress_required_before_progress_claim' }
}

export function isVisibleProofSatisfied(input: { visible_api_returned_update: boolean; browser_dom_proof: boolean }) {
  return input.visible_api_returned_update === true && input.browser_dom_proof === true
}

function normalizeOwnerRequest(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 1000)
}

function requestFingerprint(value: string) {
  return createHash('sha256').update(normalizeOwnerRequest(value)).digest('hex')
}

type RequestLoopRecord = {
  fingerprint: string
  count: number
  first_seen_at: string
  last_seen_at: string
  task_id: number | null
}

function readLoopRows(): RequestLoopRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(requestLoopPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLoopRows(rows: RequestLoopRecord[]) {
  mkdirSync(dirname(requestLoopPath), { recursive: true })
  writeFileSync(requestLoopPath, `${JSON.stringify(rows.slice(0, 200), null, 2)}\n`, 'utf8')
}

export function recordJarvisOwnerRequestSignal(input: {
  owner_request: string
  task_id?: number | null
  visible_progress_changed: boolean
}) {
  const fingerprint = requestFingerprint(input.owner_request || '')
  const rows = readLoopRows()
  const existing = rows.find((row) => row.fingerprint === fingerprint) || null
  const now = new Date().toISOString()
  const nextCount = input.visible_progress_changed ? 1 : (existing?.count || 0) + 1
  const row: RequestLoopRecord = {
    fingerprint,
    count: nextCount,
    first_seen_at: existing?.first_seen_at || now,
    last_seen_at: now,
    task_id: input.task_id ?? existing?.task_id ?? null,
  }
  writeLoopRows([row, ...rows.filter((item) => item.fingerprint !== fingerprint)])
  return {
    request_fingerprint: fingerprint,
    repeated_count: nextCount,
    ...detectJarvisRequestLoop({ repeated_count: nextCount, visible_progress_changed: input.visible_progress_changed }),
  }
}

function formatTicketRef(prefix?: string | null, num?: number | null): string | undefined {
  if (!prefix || typeof num !== 'number' || !Number.isFinite(num) || num <= 0) return undefined
  return `${prefix}-${String(num).padStart(3, '0')}`
}

function parseTaskRow(task: TaskRow | undefined | null) {
  if (!task) return null
  return {
    ...task,
    tags: typeof task.tags === 'string' ? safeJsonArray(task.tags) : Array.isArray(task.tags) ? task.tags : [],
    metadata: parseJsonObject(task.metadata),
    ticket_ref: formatTicketRef(task.project_prefix, task.project_ticket_no),
  }
}

function safeJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function selectTask(taskId: number | null, workspaceId: number) {
  const db = getDatabase()
  const base = `
    SELECT t.*, p.name as project_name, p.ticket_prefix as project_prefix
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id AND p.workspace_id = t.workspace_id
    WHERE t.workspace_id = ?`
  const row = taskId
    ? db.prepare(`${base} AND t.id = ? LIMIT 1`).get(workspaceId, taskId) as TaskRow | undefined
    : db.prepare(`${base} ORDER BY t.updated_at DESC, t.id DESC LIMIT 1`).get(workspaceId) as TaskRow | undefined
  return parseTaskRow(row)
}

function latestInternalRecordSeconds() {
  const rows = listJarvisInternalRecords(1)
  if (!rows[0]?.at) return null
  const parsed = Date.parse(rows[0].at)
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null
}

export function readVisibleTaskProgressTruth(input: { task_id?: number | null; workspace_id?: number; browser_cache_at?: number | null } = {}) {
  const task = selectTask(input.task_id ?? null, input.workspace_id || 1)
  const latestEvent = task?.id ? listAgentWorkEvents(task.id, input.workspace_id || 1, 1)[0] || null : null
  return buildTaskProgressTruth({
    task,
    latest_internal_record_at: latestInternalRecordSeconds(),
    browser_cache_at: input.browser_cache_at ?? null,
    latest_event: latestEvent as Record<string, unknown> | null,
  })
}

export async function executeJarvisVisibleTaskProgressUpdate(input: {
  task_id: number
  title?: string
  status?: Task['status'] | 'done' | 'complete'
  percent?: number
  current_phase?: string | null
  blocker?: string | null
  next_action?: string | null
  proof_link?: string | null
  delivery_state?: VisibleTaskDeliveryState
  completion_proof_visible?: boolean
  browser_dom_proof?: boolean
  visible_api_returned_update?: boolean
  owner_request?: string | null
  actor?: string
  workspace_id?: number
  currently_doing?: string | null
  current_step?: string | null
  current_tool_or_route?: string | null
  expected_next_update_type?: string | null
  files_routes_touched?: string[]
  apis_called?: string[]
  adapters_used?: string[]
  proof_records?: string[]
  audit_records?: string[]
  rollback_path?: string | null
  final_result?: string | null
  blocked_lane?: string | null
  affected_system?: string | null
  needed_to_unblock?: string | null
  blocker_reason?: string | null
  continued_work?: string[]
  next_safe_lane?: string | null
  project_continues?: boolean
  mutation_occurred?: boolean
}) {
  const workspaceId = input.workspace_id || 1
  const task = selectTask(input.task_id, workspaceId)
  if (!task) {
    return {
      ok: false as const,
      exact_blocker: 'visible_task_not_found',
      credential_values_exposed: false as const,
      external_writes_enabled: false as const,
    }
  }

  const previousMetadata = parseJsonObject(task.metadata)
  const previousPercent = metadataPercent(previousMetadata)
  const requestedPercent = input.percent ?? previousPercent ?? 0
  const loop = input.owner_request
    ? recordJarvisOwnerRequestSignal({
      owner_request: input.owner_request,
      task_id: input.task_id,
      visible_progress_changed: previousPercent !== null && clampPercent(requestedPercent) !== previousPercent,
    })
    : null
  const patch = buildVisibleTaskProgressPatch({
    task_id: input.task_id,
    title: input.title,
    status: input.status || task.status as Task['status'],
    percent: input.percent ?? metadataPercent(previousMetadata) ?? 0,
    current_phase: input.current_phase,
    blocker: input.blocker,
    next_action: input.next_action,
    proof_link: input.proof_link,
    delivery_state: input.delivery_state || loop?.delivery_state || 'VISIBLE_PROGRESS_UPDATED',
    completion_proof_visible: input.completion_proof_visible,
    browser_dom_proof: input.browser_dom_proof,
    visible_api_returned_update: input.visible_api_returned_update,
    request_fingerprint: loop?.request_fingerprint || null,
    currently_doing: input.currently_doing,
    current_step: input.current_step,
    current_tool_or_route: input.current_tool_or_route,
    expected_next_update_type: input.expected_next_update_type,
    files_routes_touched: input.files_routes_touched,
    apis_called: input.apis_called,
    adapters_used: input.adapters_used,
    proof_records: input.proof_records,
    audit_records: input.audit_records,
    rollback_path: input.rollback_path,
    final_result: input.final_result,
    blocked_lane: input.blocked_lane,
    affected_system: input.affected_system,
    needed_to_unblock: input.needed_to_unblock,
    blocker_reason: input.blocker_reason,
    continued_work: input.continued_work,
    next_safe_lane: input.next_safe_lane,
    project_continues: input.project_continues,
    mutation_occurred: input.mutation_occurred,
    previous_metadata: previousMetadata,
  })

  const requestedDone = asTaskStatus(input.status) === 'done'
  if (requestedDone) {
    const ticket = parseJsonObject(patch.values.metadata.agent_work_ticket)
    const completion = canCompleteAgentWorkTicket({
      proof_visible_to_owner: ticket.proof_visible_to_owner === true,
      final_result: typeof ticket.final_result === 'string' ? ticket.final_result : null,
      audit_records: Array.isArray(ticket.audit_records) ? ticket.audit_records : [],
      rollback_path: typeof ticket.rollback_path === 'string' ? ticket.rollback_path : null,
      mutation_occurred: ticket.mutation_occurred !== false,
    })
    if (!completion.ok) {
      return {
        ok: false as const,
        exact_blocker: 'visible_completion_requires_proof_audit_rollback',
        missing: completion.missing,
        credential_values_exposed: false as const,
        external_writes_enabled: false as const,
      }
    }
  }

  const now = Math.floor(Date.now() / 1000)
  const db = getDatabase()
  const nextTitle = patch.values.title || task.title
  const nextStatus = patch.values.status
  const nextError = patch.values.error_message
  const nextResolution = patch.values.resolution || task.resolution || null
  db.prepare(`
    UPDATE tasks
    SET title = ?, status = ?, error_message = ?, resolution = ?, metadata = ?, updated_at = ?
    WHERE id = ? AND workspace_id = ?
  `).run(
    nextTitle,
    nextStatus,
    nextError,
    nextResolution,
    JSON.stringify(patch.values.metadata),
    now,
    input.task_id,
    workspaceId,
  )

  const updated = selectTask(input.task_id, workspaceId)
  db_helpers.logActivity(
    'jarvis_visible_task_progress_updated',
    'task',
    input.task_id,
    input.actor || 'agent-zero-jarvis',
    `Jarvis updated visible task progress: ${nextTitle}`,
    {
      progress: patch.values.metadata.progress,
      current_phase: patch.values.metadata.current_phase,
      delivery_state: patch.values.metadata.delivery_state,
      visible_surface_route: VISIBLE_TASK_SURFACE_ROUTE,
      visible_api_route: `${VISIBLE_TASK_API_ROUTE}/${input.task_id}`,
      credential_values_exposed: false,
    },
    workspaceId,
  )
  const actor = input.actor || 'agent-zero-jarvis'
  logAgentWorkEvent({
    taskId: input.task_id,
    workspaceId,
    event_type: 'HEARTBEAT_UPDATED',
    agent: actor,
    summary: `Heartbeat updated at ${patch.values.metadata.current_phase || 'visible progress update'}`,
    route_api_touched: `${VISIBLE_TASK_API_ROUTE}/${input.task_id}`,
    status: nextStatus,
  })
  logAgentWorkEvent({
    taskId: input.task_id,
    workspaceId,
    event_type: 'ADAPTER_EXECUTED',
    agent: actor,
    summary: `Jarvis visible task progress adapter updated progress to ${patch.values.metadata.progress}%`,
    route_api_touched: 'POST /api/bridge/agent-zero/execute',
    status: nextStatus,
  })
  if (patch.values.metadata.blocker) {
    logAgentWorkEvent({
      taskId: input.task_id,
      workspaceId,
      event_type: 'BLOCKER_FOUND',
      agent: actor,
      summary: String(patch.values.metadata.blocker),
      route_api_touched: `${VISIBLE_TASK_API_ROUTE}/${input.task_id}`,
      status: nextStatus,
      blocker: String(patch.values.metadata.blocker),
    })
  }
  if (patch.values.metadata.proof_visible_to_owner || patch.values.metadata.proof_link) {
    logAgentWorkEvent({
      taskId: input.task_id,
      workspaceId,
      event_type: 'PROOF_CAPTURED',
      agent: actor,
      summary: 'Owner-visible task proof captured.',
      route_api_touched: `${VISIBLE_TASK_API_ROUTE}/${input.task_id}`,
      status: nextStatus,
      proof_link_or_id: typeof patch.values.metadata.proof_link === 'string' ? patch.values.metadata.proof_link : `task-${input.task_id}-visible-proof`,
    })
  }
  if (patch.values.metadata.delivery_state === 'DELIVERY_FAILURE_POSSIBLE') {
    logAgentWorkEvent({
      taskId: input.task_id,
      workspaceId,
      event_type: 'DELIVERY_FAILURE_DETECTED',
      agent: actor,
      summary: 'Repeated owner request detected without visible progress; diagnosis required before repeating summary.',
      route_api_touched: `${VISIBLE_TASK_API_ROUTE}/${input.task_id}`,
      status: nextStatus,
      blocker: 'visible_delivery_failure_possible',
    })
  }
  if (patch.values.metadata.delivery_state === 'EXECUTION_LOOP_DETECTED') {
    logAgentWorkEvent({
      taskId: input.task_id,
      workspaceId,
      event_type: 'EXECUTION_LOOP_DETECTED',
      agent: actor,
      summary: 'Execution loop detected from repeated owner request without visible progress.',
      route_api_touched: `${VISIBLE_TASK_API_ROUTE}/${input.task_id}`,
      status: nextStatus,
      blocker: 'execution_loop_detected_visible_progress_not_updated',
    })
  }
  if (input.final_result && patch.values.metadata.proof_visible_to_owner) {
    logAgentWorkEvent({
      taskId: input.task_id,
      workspaceId,
      event_type: 'TASK_COMPLETED',
      agent: actor,
      summary: input.final_result,
      route_api_touched: `${VISIBLE_TASK_API_ROUTE}/${input.task_id}`,
      status: nextStatus,
      proof_link_or_id: typeof patch.values.metadata.proof_link === 'string' ? patch.values.metadata.proof_link : null,
    })
  }
  if (updated) eventBus.broadcast('task.updated', updated)

  const truth = buildTaskProgressTruth({ task: updated, latest_internal_record_at: latestInternalRecordSeconds() })
  return {
    ok: true as const,
    id: `jvtp_${randomUUID()}`,
    at: new Date().toISOString(),
    action: JARVIS_VISIBLE_TASK_PROGRESS_ACTION,
    task_id: input.task_id,
    visible_task_updated: true,
    status: nextStatus,
    percent: patch.values.metadata.progress as number,
    delivery_state: patch.values.metadata.delivery_state as VisibleTaskDeliveryState,
    proof_visible_to_owner: truth.proof_visible_to_owner,
    visible_surface_route: VISIBLE_TASK_SURFACE_ROUTE,
    visible_api_route: `${VISIBLE_TASK_API_ROUTE}/${input.task_id}`,
    backing_store: VISIBLE_TASK_BACKING_STORE,
    wrong_surface_detected: truth.wrong_surface_detected,
    stale_cache_detected: truth.stale_cache_detected,
    previous_values: {
      status: task.status,
      error_message: task.error_message || null,
      resolution: task.resolution || null,
      metadata_progress: metadataPercent(previousMetadata),
      metadata_current_phase: previousMetadata.current_phase || null,
      metadata_delivery_state: previousMetadata.delivery_state || null,
    },
    rollback_command: `Restore task ${input.task_id} status/error_message/resolution/metadata from this adapter rollback snapshot; do not touch other task rows.`,
    credential_values_exposed: false as const,
    external_writes_enabled: false as const,
    paperclip_write_called: false,
    zapier_execution_called: false,
    n8n_workflow_activation_called: false,
    provider_execution_called: false,
    delivery_send_or_upload_called: false,
    exact_blocker: null,
  }
}
