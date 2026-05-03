import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { authJson, ownerApprovalRequired } from '@/lib/designer-module-api'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { fetchClaudeClawJson, hasClaudeClawDashboardToken } from '@/lib/claudeclaw-telegram-approvals'
import { splitApprovalQueue, summarizeApprovalQueue, normalizeApprovalQueueState } from '@/lib/approval-queue-state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APPROVAL_STUB = {
  persistence: 'not_applied',
  no_execution_enabled: true,
  no_connector_writes_enabled: true,
  migration_required: 'bridge approval/audit persistence migration',
  canonical_contract: '/api/bridge/approval-contract',
}

type ApprovalRow = {
  id: string
  connector: string
  action: string
  target: string | null
  target_key: string
  requester: string
  risk_level: string
  approval_state: string
  protected_category: string
  reason: string | null
  required_approver: string
  expires_at: string | null
  resolved_at: string | null
  resolved_by: string | null
  correlation_id: string
  created_at: string
}

type TelegramApprovalQueuePayload = {
  ok?: boolean
  mode?: string
  generated_at?: string
  canonical_channel?: string
  execution_enabled?: boolean
  execution_scope?: string
  broad_connector_execution_enabled?: boolean
  approvals?: Array<{
    id: string
    requesting_agent: string
    title: string
    action: string
    scope: string
    risk_level: string
    protected_action: number
    tools_integrations: string
    summary: string
    status: string
    created_at: number
    expires_at: number
    approved_by: string | null
    decision_at: number | null
    correlation_id: string
    chat_id: string | null
    telegram_message_id: number | null
    run_status: string | null
    run_started_at: number | null
    run_completed_at: number | null
    run_exit_code: number | null
    run_summary: string | null
    error: string | null
    ui_state?: string
    unified_state?: string
    audit_events?: Array<{
      id: number
      request_id: string
      ts: number
      actor: string
      event: string
      detail: string | null
    }>
    linked_tasks?: Array<{
      id: string
      current_status: string
      assigned_agent: string
      approval_state: string
      execution_state: string
      last_checkpoint: string | null
      final_result: string | null
      updated_at: number
      completed_at: number | null
    }>
  }>
  summary?: Record<string, number>
  error?: string
}

const RISK_LEVELS = new Set(['low', 'medium', 'high'])
const PROTECTED_CATEGORIES = new Set([
  'agent_execution',
  'memory',
  'routing',
  'external_automation',
  'research',
  'tooling',
  'skills',
  'model_routing',
  'infrastructure',
  'credentials',
  'other',
])

function cleanText(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim().slice(0, 500)
}

function stableJson(value: unknown): string {
  if (!value || typeof value !== 'object') return '{}'
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort())
}

function hashScope(input: {
  workspaceId: number
  tenantId: number
  connector: string
  action: string
  targetKey: string
  approvalScopeJson: string
}) {
  return createHash('sha256')
    .update([
      input.workspaceId,
      input.tenantId,
      input.connector,
      input.action,
      input.targetKey,
      input.approvalScopeJson,
    ].join('|'))
    .digest('hex')
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(name) as { name?: string } | undefined
  return row?.name === name
}

function realUserIdOrNull(db: Database.Database, value: unknown): number | null {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  const row = db.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').get(id) as { id?: number } | undefined
  return row?.id || null
}

function readApprovalQueue() {
  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { readonly: true, fileMustExist: true })
    if (!tableExists(db, 'bridge_approval_requests')) {
      return {
        persistence_ready: false,
        approvals: [] as ApprovalRow[],
        active_approvals: [] as ApprovalRow[],
        history_approvals: [] as ApprovalRow[],
        active_queue_visible: false,
        summary: { total: 0, pending: 0, approved: 0, denied: 0, expired: 0, revoked: 0 },
        error: null,
      }
    }

    const approvals = db.prepare(`
      SELECT id, connector, action, target, target_key, requester, risk_level,
             approval_state, protected_category, reason, required_approver,
             expires_at, resolved_at, resolved_by, correlation_id, created_at
      FROM bridge_approval_requests
      ORDER BY created_at DESC
      LIMIT 100
    `).all() as ApprovalRow[]

    const generatedAt = new Date()
    const summary = summarizeApprovalQueue(approvals, generatedAt)
    const { activeApprovals, historyApprovals } = splitApprovalQueue(approvals, generatedAt)

    return {
      persistence_ready: true,
      approvals,
      active_approvals: activeApprovals,
      history_approvals: historyApprovals,
      active_queue_visible: activeApprovals.length > 0,
      summary,
      error: null,
    }
  } catch (error) {
    return {
      persistence_ready: false,
      approvals: [] as ApprovalRow[],
      active_approvals: [] as ApprovalRow[],
      history_approvals: [] as ApprovalRow[],
      active_queue_visible: false,
      summary: { total: 0, pending: 0, approved: 0, denied: 0, expired: 0, revoked: 0 },
      error: error instanceof Error ? error.message.slice(0, 200) : 'approval queue read failed',
    }
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}

async function readTelegramApprovalQueue() {
  if (!hasClaudeClawDashboardToken()) {
    return null
  }

  try {
    const upstream = await fetchClaudeClawJson<TelegramApprovalQueuePayload>(
      '/api/telegram-approvals?audit=1&limit=100',
      {},
      12000,
    )
    if (!upstream.ok || !upstream.payload || typeof upstream.payload !== 'object') {
      return null
    }

    const payload = upstream.payload as TelegramApprovalQueuePayload
    if (!payload.ok) return null
    const approvals = payload.approvals || []
    const generatedAt = new Date()
    const summary = summarizeApprovalQueue(approvals, generatedAt)
    const { activeApprovals } = splitApprovalQueue(approvals, generatedAt)
    const activeIds = new Set(activeApprovals.map((row) => row.id))

    return {
      ok: true,
      mode: 'telegram_approval_queue_proxy_read_only',
      generated_at: generatedAt.toISOString(),
      persistence: 'claudeclaw_telegram_approvals_connected',
      approval_queue_connected: true,
      active_queue_visible: activeApprovals.length > 0,
      canonical_channel: payload.canonical_channel || 'Agent Zero -> owner channel',
      execution_enabled: false,
      exact_scope_execution_enabled: true,
      broad_connector_execution_enabled: false,
      active_approvals: approvals.filter((row) => activeIds.has(row.id)).map((row) => mapTelegramApprovalRow(row, generatedAt)),
      history_approvals: approvals.filter((row) => !activeIds.has(row.id)).map((row) => mapTelegramApprovalRow(row, generatedAt)),
      approvals: approvals.map((row) => mapTelegramApprovalRow(row, generatedAt)),
      summary,
      ui_placeholder: {
        title: activeApprovals.length > 0 ? 'Approval Queue — Agent Zero owner channel' : 'Approval system status',
        state: activeApprovals.length > 0 ? 'PENDING' : 'NO_PENDING_APPROVALS',
        message: activeApprovals.length > 0
          ? 'Pending owner decisions are waiting in Telegram. Use the Approve/Deny buttons there.'
          : 'No approvals pending. Completed, denied, expired, and failed requests are shown in approval history only.',
        next_backend_step: activeApprovals.length > 0
          ? 'Wait for owner decision in Telegram, then mirror the canonical status here.'
          : 'No owner action required unless Agent Zero creates a new owner approval request.',
        no_fake_approval_requests: true,
        approval_request_created: false,
        protected_actions_locked: true,
        protected_action_http_status: 423,
      },
      next_action: activeApprovals.length > 0
        ? 'Use Telegram Approve/Deny buttons for pending decisions. Mission Control remains read-only.'
        : 'No approvals pending.',
    }
  } catch {
    return null
  }
}

function mapTelegramApprovalRow(
  row: NonNullable<TelegramApprovalQueuePayload['approvals']>[number],
  generatedAt: Date,
) {
  const normalizedState = normalizeApprovalQueueState(row, generatedAt)
  return {
        ui_state: normalizedState,
        unified_state: normalizedState,
        id: row.id,
        title: row.title,
        requesting_agent: row.requesting_agent,
        connector: 'telegram',
        action: row.action,
        scope: row.scope,
        approval_state: row.status,
        status: row.status,
        risk_level: row.risk_level,
        protected_action: Boolean(row.protected_action),
        tools_integrations: (() => {
          try {
            const parsed = JSON.parse(row.tools_integrations || '[]')
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        })(),
        summary: row.summary,
        created_at: new Date(row.created_at * 1000).toISOString(),
        expires_at: new Date(row.expires_at * 1000).toISOString(),
        approved_by: row.approved_by,
        decision_at: row.decision_at ? new Date(row.decision_at * 1000).toISOString() : null,
        correlation_id: row.correlation_id,
        telegram_message_id: row.telegram_message_id,
        telegram_sent: Boolean(row.telegram_message_id),
        run_status: row.run_status,
        run_started_at: row.run_started_at ? new Date(row.run_started_at * 1000).toISOString() : null,
        run_completed_at: row.run_completed_at ? new Date(row.run_completed_at * 1000).toISOString() : null,
        run_exit_code: row.run_exit_code,
        run_summary: row.run_summary,
        error: row.error,
        audit_events: row.audit_events || [],
        linked_tasks: (row.linked_tasks || []).map((task) => ({
          id: task.id,
          current_status: task.current_status,
          assigned_agent: task.assigned_agent,
          approval_state: task.approval_state,
          execution_state: task.execution_state,
          last_checkpoint: task.last_checkpoint,
          final_result: task.final_result,
          updated_at: new Date(task.updated_at * 1000).toISOString(),
          completed_at: task.completed_at ? new Date(task.completed_at * 1000).toISOString() : null,
        })),
  }
}

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  const telegramQueue = await readTelegramApprovalQueue()
  if (telegramQueue) {
    return NextResponse.json(telegramQueue, { headers: { 'Cache-Control': 'no-store' } })
  }

  const queue = readApprovalQueue()

  return NextResponse.json({
    ok: true,
    mode: queue.persistence_ready ? 'approval_requests_read_only_queue' : 'approval_requests_read_only_stub',
    generated_at: new Date().toISOString(),
    ...APPROVAL_STUB,
    persistence: queue.persistence_ready ? 'read_only_connected' : 'not_applied',
    approval_queue_connected: queue.persistence_ready,
    active_queue_visible: Boolean(queue.active_queue_visible),
    active_approvals: queue.active_approvals || [],
    history_approvals: queue.history_approvals || [],
    approvals: queue.approvals,
    summary: queue.summary,
    error: queue.error,
    ui_placeholder: {
      title: queue.active_queue_visible ? 'Approval Queue' : 'Approval system status',
      state: queue.active_queue_visible ? 'PENDING' : (queue.persistence_ready ? 'NO_PENDING_APPROVALS' : 'BACKEND_REQUIRED'),
      message: queue.active_queue_visible
        ? 'Pending owner decisions are waiting in the canonical approval queue.'
        : queue.persistence_ready
        ? 'No approvals pending. Completed, denied, expired, and failed requests are shown in approval history only.'
        : 'Approval persistence is being prepared. Protected actions cannot execute yet.',
      next_backend_step: 'Owner-approved approval/audit persistence migration + queue API write path.',
      no_fake_approval_requests: true,
      approval_request_created: false,
      protected_actions_locked: true,
      protected_action_http_status: 423,
    },
    next_action: queue.persistence_ready
      ? 'Queue is readable. Protected execution remains locked until owner explicitly approves scoped execution runners.'
      : 'Owner must approve and apply the bridge approval/audit migration before approval requests can persist.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { fileMustExist: true })
    db.pragma('foreign_keys = ON')

    if (!tableExists(db, 'bridge_approval_requests') || !tableExists(db, 'bridge_audit_events')) {
      return ownerApprovalRequired({
        reason: 'approval_persistence_not_applied',
        current_state: 'OWNER_APPROVAL_REQUIRED',
        http_status_when_blocked: 423,
        ...APPROVAL_STUB,
        accepted_for_execution: false,
        approval_request_created: false,
        next_action: 'Apply the owner-approved bridge approval/audit migration before creating persistent approval requests.',
      })
    }

    const connector = cleanText(body.connector || body.provider || 'unknown', 'unknown')
    const action = cleanText(body.action || body.requested_action || 'protected_action', 'protected_action')
    const target = cleanText(body.target || body.tool || '', '')
    const targetKey = cleanText(body.target_key || target || action, action)
    const riskLevel = cleanText(body.risk_level || 'high', 'high').toLowerCase()
    const protectedCategory = cleanText(body.protected_category || 'other', 'other')
    const approvalScopeJson = stableJson(body.approval_scope_json || body.approval_scope || {})

    const errors: string[] = []
    if (!connector || connector === 'unknown') errors.push('connector is required')
    if (!action) errors.push('action is required')
    if (!RISK_LEVELS.has(riskLevel)) errors.push('risk_level must be low|medium|high')
    if (!PROTECTED_CATEGORIES.has(protectedCategory)) errors.push('protected_category is invalid')
    if (errors.length) {
      return NextResponse.json({ ok: false, errors, execution_enabled: false }, { status: 400 })
    }

    const workspaceId = auth.user.workspace_id || 1
    const tenantId = auth.user.tenant_id || 1
    const id = `apr_${randomUUID()}`
    const auditId = `audit_${randomUUID()}`
    const correlationId = cleanText(body.correlation_id || `corr_${randomUUID()}`, `corr_${randomUUID()}`)
    const scopeHash = hashScope({ workspaceId, tenantId, connector, action, targetKey, approvalScopeJson })
    const idempotencyKey = cleanText(body.idempotency_key || '', '') || null
    const requester = auth.user.username || auth.user.display_name || 'mission-control'
    const requesterUserId = realUserIdOrNull(db, auth.user.id)
    const reason = cleanText(body.reason || body.owner_goal || body.summary || 'Protected action requires owner approval.', 'Protected action requires owner approval.')

    const created = db.transaction(() => {
      if (idempotencyKey) {
        const existing = db!.prepare(`
          SELECT id, approval_state
          FROM bridge_approval_requests
          WHERE workspace_id = ? AND tenant_id = ? AND idempotency_key = ?
          LIMIT 1
        `).get(workspaceId, tenantId, idempotencyKey) as { id: string; approval_state: string } | undefined
        if (existing) return { id: existing.id, reused: true, state: existing.approval_state }
      }

      db!.prepare(`
        INSERT INTO bridge_approval_requests (
          id, workspace_id, tenant_id, connector, action, target, target_key,
          requester, requester_user_id, risk_level, approval_state, protected_category,
          approval_scope_json, scope_hash, reason, required_approver, rollback_available,
          rollback_ref, expires_at, correlation_id, idempotency_key
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 'owner', ?, ?, ?, ?, ?
        )
      `).run(
        id,
        workspaceId,
        tenantId,
        connector,
        action,
        target || null,
        targetKey,
        requester,
        requesterUserId,
        riskLevel,
        protectedCategory,
        approvalScopeJson,
        scopeHash,
        reason,
        body.rollback_available ? 1 : 0,
        cleanText(body.rollback_ref || '', '') || null,
        cleanText(body.expires_at || '', '') || null,
        correlationId,
        idempotencyKey,
      )

      db!.prepare(`
        INSERT INTO bridge_audit_events (
          id, workspace_id, tenant_id, approval_request_id, actor, actor_user_id,
          connector, action, target, target_key, outcome, payload_hash, metadata_json, correlation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approval_requested', ?, ?, ?)
      `).run(
        auditId,
        workspaceId,
        tenantId,
        id,
        requester,
        requesterUserId,
        connector,
        action,
        target || null,
        targetKey,
        createHash('sha256').update(approvalScopeJson).digest('hex'),
        stableJson({
          source: 'mission-control',
          no_execution_enabled: true,
          approval_request_created: true,
        }),
        correlationId,
      )

      return { id, reused: false, state: 'pending' }
    })()

    return NextResponse.json({
      ok: true,
      mode: 'approval_request_created_no_execution',
      persistence: 'connected',
      approval_request_created: true,
      approval_id: created.id,
      reused_idempotency_key: created.reused,
      approval_state: created.state,
      execution_enabled: false,
      accepted_for_execution: false,
      no_connector_writes_enabled: true,
      next_action: 'Owner must approve this request before any protected action can execute. Execution runners remain disabled.',
    }, { status: created.reused ? 200 : 201 })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 240) : 'approval_request_failed',
      execution_enabled: false,
      approval_request_created: false,
    }, { status: 500 })
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}
