import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { fetchClaudeClawJson, hasClaudeClawDashboardToken } from '@/lib/claudeclaw-telegram-approvals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ProviderStatus = {
  id?: string
  name?: string
  category?: string
  state?: string
  last_checked?: number
  detail?: {
    endpoint?: string | null
    notes?: string
    error?: string | null
  }
  next_action?: string | null
}

type TaskRow = {
  id: number
  title: string
  status: string
  priority: string
  assigned_to: string | null
  updated_at: number
  project_ticket_no: number | null
  project_prefix: string | null
}

type AgentRow = {
  id: number
  name: string
  role: string
  status: string
  last_seen: number | null
  last_activity: string | null
  updated_at: number
}

type ActivityRow = {
  id: number
  type: string
  entity_type: string
  entity_id: number
  actor: string
  description: string
  created_at: number
}

function isoFromSeconds(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString()
}

function ticketRef(row: TaskRow): string | null {
  if (!row.project_prefix || typeof row.project_ticket_no !== 'number' || row.project_ticket_no <= 0) return null
  return `${row.project_prefix}-${String(row.project_ticket_no).padStart(3, '0')}`
}

function openReadOnlyDb(): Database.Database {
  return new Database(config.dbPath, { readonly: true, fileMustExist: true })
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
    .get(tableName) as { name?: string } | undefined
  return Boolean(row?.name)
}

function readPendingTickets(db: Database.Database, workspaceId: number) {
  if (!tableExists(db, 'tasks')) return []
  const rows = db.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.assigned_to, t.updated_at,
           t.project_ticket_no, p.ticket_prefix as project_prefix
      FROM tasks t
      LEFT JOIN projects p
        ON p.id = t.project_id AND p.workspace_id = t.workspace_id
     WHERE t.workspace_id = ?
       AND t.status IN ('inbox', 'assigned', 'awaiting_owner', 'in_progress', 'review', 'quality_review')
     ORDER BY t.updated_at DESC
     LIMIT 12
  `).all(workspaceId) as TaskRow[]

  return rows.map((row) => ({
    id: row.id,
    ticket_ref: ticketRef(row),
    title: row.title,
    status: row.status,
    priority: row.priority,
    assigned_to: row.assigned_to || 'unassigned',
    updated_at: isoFromSeconds(row.updated_at),
  }))
}

function readAgentActivity(db: Database.Database, workspaceId: number) {
  if (!tableExists(db, 'agents')) return []
  const rows = db.prepare(`
    SELECT id, name, role, status, last_seen, last_activity, updated_at
      FROM agents
     WHERE workspace_id = ?
       AND hidden = 0
     ORDER BY COALESCE(last_seen, updated_at, created_at) DESC
     LIMIT 12
  `).all(workspaceId) as AgentRow[]

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    status: row.status,
    last_seen_at: isoFromSeconds(row.last_seen),
    last_activity: row.last_activity || 'No recent activity recorded.',
    updated_at: isoFromSeconds(row.updated_at),
  }))
}

function readRecentActivity(db: Database.Database, workspaceId: number) {
  if (!tableExists(db, 'activities')) return []
  const rows = db.prepare(`
    SELECT id, type, entity_type, entity_id, actor, description, created_at
      FROM activities
     WHERE workspace_id = ?
     ORDER BY created_at DESC
     LIMIT 12
  `).all(workspaceId) as ActivityRow[]

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    actor: row.actor,
    description: row.description,
    created_at: isoFromSeconds(row.created_at),
  }))
}

async function readProviderActivity() {
  if (!hasClaudeClawDashboardToken()) {
    return {
      state: 'not_connected',
      providers: [] as ProviderStatus[],
      warning: 'ClaudeClaw dashboard token is unavailable to the Mission Control Harness status proxy.',
    }
  }

  const upstream = await fetchClaudeClawJson<{ providers?: ProviderStatus[]; summary?: Record<string, unknown> }>(
    '/api/bridge/providers',
    {},
    12000,
  ).catch((error) => ({
    ok: false,
    status: 503,
    payload: { error: error instanceof Error ? error.message : 'provider_status_failed' },
  }))

  const providers = Array.isArray((upstream.payload as any)?.providers)
    ? ((upstream.payload as any).providers as ProviderStatus[])
    : []

  return {
    state: upstream.ok ? 'read_only' : 'not_connected',
    providers: providers.slice(0, 12).map((provider) => ({
      id: provider.id,
      name: provider.name,
      category: provider.category,
      state: provider.state,
      endpoint: provider.detail?.endpoint || null,
      last_checked_at: typeof provider.last_checked === 'number'
        ? new Date(provider.last_checked).toISOString()
        : null,
      notes: provider.detail?.notes || null,
      blocker: provider.detail?.error || null,
      next_action: provider.next_action || null,
    })),
    warning: upstream.ok ? null : ((upstream.payload as any)?.error || `provider status HTTP ${upstream.status}`),
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const workspaceId = auth.user.workspace_id ?? 1
  const providerActivity = await readProviderActivity()

  let dbStatus = 'read_only'
  let pendingTickets: ReturnType<typeof readPendingTickets> = []
  let agentActivity: ReturnType<typeof readAgentActivity> = []
  let recentActivity: ReturnType<typeof readRecentActivity> = []
  let harnessEventsTablePresent = false
  let bridgeHarnessEventsTablePresent = false
  let dbWarning: string | null = null

  try {
    const db = openReadOnlyDb()
    try {
      pendingTickets = readPendingTickets(db, workspaceId)
      agentActivity = readAgentActivity(db, workspaceId)
      recentActivity = readRecentActivity(db, workspaceId)
      harnessEventsTablePresent = tableExists(db, 'harness_events')
      bridgeHarnessEventsTablePresent = tableExists(db, 'bridge_harness_events')
    } finally {
      db.close()
    }
  } catch (error) {
    dbStatus = 'not_connected'
    dbWarning = error instanceof Error ? error.message : 'mission_control_db_read_failed'
  }

  const durableHarnessConnected = harnessEventsTablePresent || bridgeHarnessEventsTablePresent
  const missingHarnessBackendWarning = durableHarnessConnected
    ? null
    : 'Durable Harness backend is not connected yet. Mission Control is showing existing task/ticket, activity, agent, and provider read-only sources only.'

  return NextResponse.json({
    ok: true,
    mode: 'harness_readonly_status',
    generated_at: new Date().toISOString(),
    no_execution_routes_created: true,
    no_protected_actions_created: true,
    no_db_migrations_created: true,
    execution_enabled: false,
    protected_actions_enabled: false,
    routing_status: {
      state: durableHarnessConnected ? 'read_only' : 'not_connected',
      ticket_routing: 'read_only_existing_tasks',
      event_routing: durableHarnessConnected ? 'read_only_harness_events_available' : 'backend_required',
      agent_activity: agentActivity.length > 0 ? 'read_only' : 'not_connected',
      provider_activity: providerActivity.state,
      durable_harness_backend_present: durableHarnessConnected,
      missing_harness_backend_warning: missingHarnessBackendWarning,
    },
    pending_tickets: {
      state: pendingTickets.length > 0 ? 'read_only' : 'none_found',
      source: 'Mission Control tasks table',
      count: pendingTickets.length,
      items: pendingTickets,
    },
    agent_activity: {
      state: agentActivity.length > 0 ? 'read_only' : 'none_found',
      source: 'Mission Control agents table',
      count: agentActivity.length,
      items: agentActivity,
    },
    provider_activity: {
      state: providerActivity.state,
      source: 'ClaudeClaw /api/bridge/providers',
      count: providerActivity.providers.length,
      items: providerActivity.providers,
      warning: providerActivity.warning,
    },
    recent_activity: {
      state: recentActivity.length > 0 ? 'read_only' : 'none_found',
      source: 'Mission Control activities table',
      count: recentActivity.length,
      items: recentActivity,
    },
    missing_harness_backend_warning: missingHarnessBackendWarning,
    db: {
      state: dbStatus,
      warning: dbWarning,
      harness_events_table_present: harnessEventsTablePresent,
      bridge_harness_events_table_present: bridgeHarnessEventsTablePresent,
    },
    next_action: durableHarnessConnected
      ? 'Keep Harness read-only until owner approves execution routing.'
      : 'Create a future owner-approved Harness persistence schema before routing tickets/events or enabling execution.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
