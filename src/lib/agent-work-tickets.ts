import type { Activity, Task } from '@/lib/db'
import { db_helpers, getDatabase } from '@/lib/db'

export const AGENT_WORK_EVENT_TYPES = [
  'TASK_CREATED',
  'AGENT_ASSIGNED',
  'COMMAND_SENT',
  'ROUTE_PROBED',
  'ADAPTER_EXECUTED',
  'BLOCKER_FOUND',
  'OWNER_HARD_STOP_REQUIRED',
  'FILE_CHANGED',
  'BUILD_PASSED',
  'ROUTE_SMOKE_PASSED',
  'PROOF_CAPTURED',
  'TASK_COMPLETED',
  'DELIVERY_FAILURE_DETECTED',
  'EXECUTION_LOOP_DETECTED',
  'HEARTBEAT_UPDATED',
] as const

export type AgentWorkEventType = typeof AGENT_WORK_EVENT_TYPES[number]

export type AgentWorkTicket = {
  ticket_id: string
  owner_request: string | null
  assigned_agent: string | null
  agent_runtime: string
  task_title: string
  task_type: string
  current_status: string
  current_phase: string | null
  progress_percent: number
  delivery_state: string
  priority: string
  created_at: string
  updated_at: string
  last_heartbeat_at: string | null
  blocker: string | null
  next_action: string | null
  proof_visible_to_owner: boolean
  currently_doing: string | null
  current_step: string | null
  current_tool_or_route: string | null
  current_blocker: string | null
  expected_next_update_type: string | null
  files_routes_touched: string[]
  apis_called: string[]
  adapters_used: string[]
  proof_records: string[]
  audit_records: string[]
  rollback_path: string | null
  final_result: string | null
  blocked_lane: string | null
  affected_system: string | null
  needed_to_unblock: string | null
  blocker_reason: string | null
  continued_work: string[]
  next_safe_lane: string | null
  project_continues: boolean
  mutation_occurred?: boolean
}

export type AgentWorkMetadata = Record<string, unknown> & {
  agent_work_ticket?: AgentWorkTicket
  owner_visible_blocker_packet?: OwnerVisibleBlockerPacket | null
}

export type OwnerVisibleBlockerPacket = {
  ticket_id: string
  blocker_name: string
  exact_system_affected: string | null
  blocked_lane: string | null
  what_is_needed: string
  why_blocked: string
  what_work_continued_anyway: string[]
  next_safe_lane: string | null
  project_continues: boolean
}

export type AgentWorkEvent = {
  id: number
  timestamp: string
  agent: string
  event_type: string
  summary: string
  route_api_touched: string | null
  status: string | null
  blocker: string | null
  proof_link_or_id: string | null
  data: Record<string, unknown>
}

export type HeartbeatState = 'NO_AGENT_TICKET' | 'NO_HEARTBEAT' | 'HEARTBEAT_ACTIVE' | 'STALE_AGENT_TASK' | 'HEARTBEAT_CLOSED'

const ACTIVE_STATUSES = new Set(['backlog', 'inbox', 'assigned', 'awaiting_owner', 'in_progress', 'review', 'quality_review', 'wip', 'pending', 'blocked'])
const CLOSED_STATUSES = new Set(['done', 'complete', 'archived', 'failed'])
const HEARTBEAT_STALE_MS = 10 * 60 * 1000

function cleanString(value: unknown, fallback: string | null = null, max = 1000): string | null {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : fallback
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => cleanString(item, null, 500)).filter((item): item is string => Boolean(item))
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

function toIso(value: unknown, fallbackIso: string): string {
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value * 1000).toISOString()
  }
  return fallbackIso
}

function clampPercent(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

export function isAgentLikeAssignee(value: unknown): boolean {
  const id = cleanString(value, '')?.toLowerCase().replace(/[_\s]+/g, '-') || ''
  if (!id) return false
  return [
    'jarvis',
    'agent-zero',
    'agent-0',
    'hermes',
    'sofia',
    'pi',
    'paperclip',
    'spaceagent',
    'space-agent',
  ].some((candidate) => id === candidate || id.includes(candidate))
}

export function runtimeForAgent(value: unknown): string {
  const id = cleanString(value, '')?.toLowerCase().replace(/[_\s]+/g, '-') || ''
  if (id.includes('agent-zero') || id.includes('jarvis')) return 'Agent Zero / Jarvis'
  if (id.includes('hermes')) return 'Ron Weasley — Nuclear Dispatcher'
  if (id.includes('sofia')) return 'Sofia — Deputy Nuclear Dispatcher'
  if (id === 'pi' || id.includes('pi-dispatcher')) return 'Pi advisory dispatcher'
  if (id.includes('paperclip')) return 'Paperclip company workforce'
  if (id.includes('space')) return 'SpaceAgent'
  return 'Mission Control agent runtime'
}

function normalizeTicket(existing: Record<string, unknown>, fallback: Partial<AgentWorkTicket>, nowIso: string): AgentWorkTicket {
  const progress = clampPercent(existing.progress_percent ?? fallback.progress_percent ?? 0)
  return {
    ticket_id: cleanString(existing.ticket_id, fallback.ticket_id || '') || '',
    owner_request: cleanString(existing.owner_request, fallback.owner_request || null, 2000),
    assigned_agent: cleanString(existing.assigned_agent, fallback.assigned_agent || null),
    agent_runtime: cleanString(existing.agent_runtime, fallback.agent_runtime || 'Mission Control agent runtime') || 'Mission Control agent runtime',
    task_title: cleanString(existing.task_title, fallback.task_title || 'Untitled task', 500) || 'Untitled task',
    task_type: cleanString(existing.task_type, fallback.task_type || 'owner_visible_agent_work') || 'owner_visible_agent_work',
    current_status: cleanString(existing.current_status, fallback.current_status || 'in_progress') || 'in_progress',
    current_phase: cleanString(existing.current_phase, fallback.current_phase || 'Task created', 500),
    progress_percent: progress,
    delivery_state: cleanString(existing.delivery_state, fallback.delivery_state || 'VISIBLE_PROGRESS_REQUIRED') || 'VISIBLE_PROGRESS_REQUIRED',
    priority: cleanString(existing.priority, fallback.priority || 'medium') || 'medium',
    created_at: toIso(existing.created_at, fallback.created_at || nowIso),
    updated_at: toIso(existing.updated_at, fallback.updated_at || nowIso),
    last_heartbeat_at: existing.last_heartbeat_at === null ? null : cleanString(existing.last_heartbeat_at, fallback.last_heartbeat_at || null),
    blocker: cleanString(existing.blocker, fallback.blocker || null, 1000),
    next_action: cleanString(existing.next_action, fallback.next_action || null, 1000),
    proof_visible_to_owner: Boolean(existing.proof_visible_to_owner ?? fallback.proof_visible_to_owner ?? false),
    currently_doing: cleanString(existing.currently_doing, fallback.currently_doing || null, 1000),
    current_step: cleanString(existing.current_step, fallback.current_step || null, 1000),
    current_tool_or_route: cleanString(existing.current_tool_or_route, fallback.current_tool_or_route || null, 1000),
    current_blocker: cleanString(existing.current_blocker, fallback.current_blocker || null, 1000),
    expected_next_update_type: cleanString(existing.expected_next_update_type, fallback.expected_next_update_type || null, 500),
    files_routes_touched: asArray(existing.files_routes_touched ?? fallback.files_routes_touched),
    apis_called: asArray(existing.apis_called ?? fallback.apis_called),
    adapters_used: asArray(existing.adapters_used ?? fallback.adapters_used),
    proof_records: asArray(existing.proof_records ?? fallback.proof_records),
    audit_records: asArray(existing.audit_records ?? fallback.audit_records),
    rollback_path: cleanString(existing.rollback_path, fallback.rollback_path || null, 2000),
    final_result: cleanString(existing.final_result, fallback.final_result || null, 3000),
    blocked_lane: cleanString(existing.blocked_lane, fallback.blocked_lane || null, 500),
    affected_system: cleanString(existing.affected_system, fallback.affected_system || null, 500),
    needed_to_unblock: cleanString(existing.needed_to_unblock, fallback.needed_to_unblock || null, 1000),
    blocker_reason: cleanString(existing.blocker_reason, fallback.blocker_reason || null, 1000),
    continued_work: asArray(existing.continued_work ?? fallback.continued_work),
    next_safe_lane: cleanString(existing.next_safe_lane, fallback.next_safe_lane || null, 1000),
    project_continues: Boolean(existing.project_continues ?? fallback.project_continues ?? false),
    mutation_occurred: Boolean(existing.mutation_occurred ?? fallback.mutation_occurred ?? false),
  }
}

export function initializeAgentWorkTicketMetadata(input: {
  task: Partial<Task> & { id: number; title: string; metadata?: unknown }
  metadata?: Record<string, unknown>
  nowIso?: string
}): AgentWorkMetadata {
  const nowIso = input.nowIso || new Date().toISOString()
  const metadata = { ...(input.metadata || parseJsonObject(input.task.metadata)) }
  const existing = parseJsonObject(metadata.agent_work_ticket)
  const assignedAgent = cleanString(input.task.assigned_to, null) || null
  if (!assignedAgent && !Object.keys(existing).length) return metadata as AgentWorkMetadata

  const ticket = normalizeTicket(existing, {
    ticket_id: String(input.task.id),
    owner_request: cleanString(input.task.description, input.task.title, 2000),
    assigned_agent: assignedAgent,
    agent_runtime: runtimeForAgent(assignedAgent),
    task_title: input.task.title,
    task_type: 'owner_visible_agent_work',
    current_status: input.task.status || 'in_progress',
    current_phase: cleanString(metadata.current_phase, 'Task created') || 'Task created',
    progress_percent: clampPercent(metadata.progress ?? 0),
    delivery_state: cleanString(metadata.delivery_state, 'VISIBLE_PROGRESS_REQUIRED') || 'VISIBLE_PROGRESS_REQUIRED',
    priority: input.task.priority || 'medium',
    created_at: toIso(input.task.created_at, nowIso),
    updated_at: toIso(input.task.updated_at, nowIso),
    last_heartbeat_at: cleanString(metadata.last_heartbeat_at, nowIso),
    blocker: cleanString(metadata.blocker, null),
    next_action: cleanString(metadata.next_action, null),
    proof_visible_to_owner: Boolean(metadata.proof_visible_to_owner),
    blocked_lane: cleanString(metadata.blocked_lane, null),
    affected_system: cleanString(metadata.affected_system, null),
    needed_to_unblock: cleanString(metadata.needed_to_unblock, null),
    blocker_reason: cleanString(metadata.blocker_reason, null),
    continued_work: asArray(metadata.continued_work),
    next_safe_lane: cleanString(metadata.next_safe_lane, null),
    project_continues: Boolean(metadata.project_continues),
  }, nowIso)

  return mirrorTicketToMetadata(metadata, ticket)
}

export function mergeTaskMetadataForAgentWorkTicket(
  existingMetadata: Record<string, unknown> = {},
  patch: Partial<AgentWorkTicket> & Record<string, unknown>,
  nowIso = new Date().toISOString(),
): AgentWorkMetadata {
  const existingTicket = parseJsonObject(existingMetadata.agent_work_ticket)
  const mergedTicket = normalizeTicket({ ...existingTicket, ...patch, updated_at: nowIso, last_heartbeat_at: patch.last_heartbeat_at || nowIso }, {
    ticket_id: cleanString(existingTicket.ticket_id, '') || '',
    owner_request: cleanString(existingTicket.owner_request, null),
    assigned_agent: cleanString(existingTicket.assigned_agent, null),
    agent_runtime: cleanString(existingTicket.agent_runtime, 'Mission Control agent runtime') || 'Mission Control agent runtime',
    task_title: cleanString(existingTicket.task_title, 'Untitled task') || 'Untitled task',
    task_type: cleanString(existingTicket.task_type, 'owner_visible_agent_work') || 'owner_visible_agent_work',
    current_status: cleanString(existingTicket.current_status, 'in_progress') || 'in_progress',
    progress_percent: clampPercent(existingTicket.progress_percent ?? existingMetadata.progress ?? 0),
    priority: cleanString(existingTicket.priority, 'medium') || 'medium',
    created_at: cleanString(existingTicket.created_at, nowIso) || nowIso,
    updated_at: nowIso,
    blocked_lane: cleanString(existingTicket.blocked_lane, null),
    affected_system: cleanString(existingTicket.affected_system, null),
    needed_to_unblock: cleanString(existingTicket.needed_to_unblock, null),
    blocker_reason: cleanString(existingTicket.blocker_reason, null),
    continued_work: asArray(existingTicket.continued_work),
    next_safe_lane: cleanString(existingTicket.next_safe_lane, null),
    project_continues: Boolean(existingTicket.project_continues),
  }, nowIso)
  return mirrorTicketToMetadata(existingMetadata, mergedTicket)
}

export function buildOwnerVisibleBlockerPacket(ticket: AgentWorkTicket | null | undefined): OwnerVisibleBlockerPacket | null {
  if (!ticket) return null
  const blockerName = cleanString(ticket.blocker || ticket.current_blocker, null, 1000)
  if (!blockerName) return null
  return {
    ticket_id: ticket.ticket_id,
    blocker_name: blockerName,
    exact_system_affected: cleanString(ticket.affected_system, ticket.agent_runtime || null, 500),
    blocked_lane: cleanString(ticket.blocked_lane, ticket.task_type || null, 500),
    what_is_needed: cleanString(ticket.needed_to_unblock, ticket.next_action || 'Resolve the listed blocker through the approved path.', 1000) || 'Resolve the listed blocker through the approved path.',
    why_blocked: cleanString(ticket.blocker_reason, blockerName, 1000) || blockerName,
    what_work_continued_anyway: asArray(ticket.continued_work),
    next_safe_lane: cleanString(ticket.next_safe_lane, ticket.next_action || null, 1000),
    project_continues: ticket.project_continues === true,
  }
}

export function mirrorTicketToMetadata(existingMetadata: Record<string, unknown>, ticket: AgentWorkTicket): AgentWorkMetadata {
  const blockerPacket = buildOwnerVisibleBlockerPacket(ticket)
  return {
    ...existingMetadata,
    agent_work_ticket: ticket,
    owner_visible_blocker_packet: blockerPacket,
    progress: ticket.progress_percent,
    current_phase: ticket.current_phase,
    blocker: ticket.blocker || ticket.current_blocker || null,
    next_action: ticket.next_action,
    delivery_state: ticket.delivery_state,
    proof_visible_to_owner: ticket.proof_visible_to_owner,
    last_heartbeat_at: ticket.last_heartbeat_at,
    blocked_lane: ticket.blocked_lane,
    affected_system: ticket.affected_system,
    needed_to_unblock: ticket.needed_to_unblock,
    blocker_reason: ticket.blocker_reason,
    continued_work: ticket.continued_work,
    next_safe_lane: ticket.next_safe_lane,
    project_continues: ticket.project_continues,
    jarvis_progress: {
      progress: ticket.progress_percent,
      current_phase: ticket.current_phase,
      blocker: ticket.blocker || ticket.current_blocker || null,
      next_action: ticket.next_action,
      proof_link: ticket.proof_records[0] || null,
      delivery_state: ticket.delivery_state,
      proof_visible_to_owner: ticket.proof_visible_to_owner,
      updated_at: ticket.updated_at,
      owner_visible_blocker_packet: blockerPacket,
    },
  }
}

export function computeHeartbeatState(
  ticket: Pick<AgentWorkTicket, 'current_status' | 'last_heartbeat_at'> | { status?: string | null; last_heartbeat_at?: string | null } | null | undefined,
  nowIso = new Date().toISOString(),
): HeartbeatState {
  if (!ticket) return 'NO_AGENT_TICKET'
  const status = cleanString((ticket as { current_status?: string }).current_status ?? (ticket as { status?: string }).status, '') || ''
  if (CLOSED_STATUSES.has(status)) return 'HEARTBEAT_CLOSED'
  const heartbeat = cleanString(ticket.last_heartbeat_at, null)
  if (!heartbeat) return ACTIVE_STATUSES.has(status) ? 'NO_HEARTBEAT' : 'HEARTBEAT_CLOSED'
  const heartbeatMs = Date.parse(heartbeat)
  const nowMs = Date.parse(nowIso)
  if (!Number.isFinite(heartbeatMs) || !Number.isFinite(nowMs)) return 'NO_HEARTBEAT'
  if (ACTIVE_STATUSES.has(status) && nowMs - heartbeatMs > HEARTBEAT_STALE_MS) return 'STALE_AGENT_TASK'
  return 'HEARTBEAT_ACTIVE'
}

export function canCompleteAgentWorkTicket(input: {
  proof_visible_to_owner?: boolean
  final_result?: string | null
  audit_records?: unknown
  rollback_path?: string | null
  mutation_occurred?: boolean
}) {
  const missing: string[] = []
  if (input.proof_visible_to_owner !== true) missing.push('proof_visible_to_owner')
  if (!cleanString(input.final_result, null)) missing.push('final_result')
  if (!asArray(input.audit_records).length) missing.push('audit_record')
  if (input.mutation_occurred && !cleanString(input.rollback_path, null)) missing.push('rollback_path')
  return { ok: missing.length === 0, missing }
}

export function normalizeAgentWorkEvent(row: Partial<Activity> & { workspace_id?: number; data?: unknown }): AgentWorkEvent {
  const data = parseJsonObject(row.data)
  return {
    id: Number(row.id || 0),
    timestamp: typeof row.created_at === 'number' ? new Date(row.created_at * 1000).toISOString() : new Date(0).toISOString(),
    agent: cleanString(row.actor, 'system') || 'system',
    event_type: cleanString(row.type, 'TASK_UPDATED') || 'TASK_UPDATED',
    summary: cleanString(row.description, '') || '',
    route_api_touched: cleanString(data.route_api_touched, null),
    status: cleanString(data.status, null),
    blocker: cleanString(data.blocker, null),
    proof_link_or_id: cleanString(data.proof_link_or_id, null),
    data,
  }
}

export function listAgentWorkEvents(taskId: number, workspaceId = 1, limit = 100): AgentWorkEvent[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT * FROM activities
    WHERE entity_type = 'task' AND entity_id = ? AND workspace_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(taskId, workspaceId, Math.max(1, Math.min(limit, 250))) as Activity[]
  return rows.map(normalizeAgentWorkEvent)
}

export function countAgentWorkEvents(taskId: number, workspaceId = 1): number {
  const db = getDatabase()
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM activities
    WHERE entity_type = 'task' AND entity_id = ? AND workspace_id = ?
  `).get(taskId, workspaceId) as { count?: number } | undefined
  return Number(row?.count || 0)
}

export function logAgentWorkEvent(input: {
  taskId: number
  workspaceId?: number
  event_type: AgentWorkEventType
  agent?: string | null
  summary: string
  route_api_touched?: string | null
  status?: string | null
  blocker?: string | null
  proof_link_or_id?: string | null
  data?: Record<string, unknown>
}): AgentWorkEvent {
  const workspaceId = input.workspaceId || 1
  const data = {
    ...(input.data || {}),
    route_api_touched: cleanString(input.route_api_touched, null),
    status: cleanString(input.status, null),
    blocker: cleanString(input.blocker, null),
    proof_link_or_id: cleanString(input.proof_link_or_id, null),
  }
  db_helpers.logActivity(
    input.event_type,
    'task',
    input.taskId,
    cleanString(input.agent, 'system') || 'system',
    input.summary,
    data,
    workspaceId,
  )
  const db = getDatabase()
  const row = db.prepare(`
    SELECT * FROM activities
    WHERE entity_type = 'task' AND entity_id = ? AND workspace_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(input.taskId, workspaceId) as Activity | undefined
  return normalizeAgentWorkEvent(row || {
    id: 0,
    type: input.event_type,
    entity_type: 'task',
    entity_id: input.taskId,
    actor: input.agent || 'system',
    description: input.summary,
    data: JSON.stringify(data),
    created_at: Math.floor(Date.now() / 1000),
  })
}

export function enrichTaskWithAgentWork<T extends { id: number; metadata?: unknown; status?: string | null; assigned_to?: string | null; title?: string; description?: string; priority?: string; created_at?: number; updated_at?: number }>(
  task: T,
  workspaceId = 1,
  nowIso = new Date().toISOString(),
): T & {
  agent_work_ticket: AgentWorkTicket | null
  agent_work_summary: Record<string, unknown> | null
  agent_work_events_count: number
  heartbeat_state: HeartbeatState
  metadata: Record<string, unknown>
} {
  const metadata = parseJsonObject(task.metadata)
  const hasTicket = metadata.agent_work_ticket && typeof metadata.agent_work_ticket === 'object'
  const initialized = hasTicket || isAgentLikeAssignee(task.assigned_to)
    ? initializeAgentWorkTicketMetadata({ task: task as never, metadata, nowIso })
    : metadata
  const ticket = (initialized.agent_work_ticket || null) as AgentWorkTicket | null
  const heartbeat_state = computeHeartbeatState(ticket, nowIso)
  return {
    ...task,
    metadata: initialized,
    agent_work_ticket: ticket,
    agent_work_summary: ticket ? {
      request: ticket.owner_request,
      assigned_agent: ticket.assigned_agent,
      current_phase: ticket.current_phase,
      progress_percent: ticket.progress_percent,
      blocker: ticket.blocker || ticket.current_blocker,
      next_action: ticket.next_action,
      delivery_state: ticket.delivery_state,
      last_heartbeat_at: ticket.last_heartbeat_at,
      heartbeat_state,
      proof_visible_to_owner: ticket.proof_visible_to_owner,
      final_result_present: Boolean(ticket.final_result),
      owner_visible_blocker_packet: buildOwnerVisibleBlockerPacket(ticket),
    } : null,
    agent_work_events_count: countAgentWorkEvents(task.id, workspaceId),
    heartbeat_state,
  }
}

export function isAllowedAgentWorkEventType(value: unknown): value is AgentWorkEventType {
  return AGENT_WORK_EVENT_TYPES.includes(value as AgentWorkEventType)
}
