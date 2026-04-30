import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { authJson, ownerApprovalRequired } from '@/lib/designer-module-api'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'

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

function readApprovalQueue() {
  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { readonly: true, fileMustExist: true })
    if (!tableExists(db, 'bridge_approval_requests')) {
      return {
        persistence_ready: false,
        approvals: [] as ApprovalRow[],
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

    const summary = approvals.reduce((acc, row) => {
      acc.total += 1
      if (row.approval_state === 'pending') acc.pending += 1
      else if (row.approval_state === 'approved') acc.approved += 1
      else if (row.approval_state === 'denied') acc.denied += 1
      else if (row.approval_state === 'expired') acc.expired += 1
      else if (row.approval_state === 'revoked') acc.revoked += 1
      return acc
    }, { total: 0, pending: 0, approved: 0, denied: 0, expired: 0, revoked: 0 })

    return {
      persistence_ready: true,
      approvals,
      summary,
      error: null,
    }
  } catch (error) {
    return {
      persistence_ready: false,
      approvals: [] as ApprovalRow[],
      summary: { total: 0, pending: 0, approved: 0, denied: 0, expired: 0, revoked: 0 },
      error: error instanceof Error ? error.message.slice(0, 200) : 'approval queue read failed',
    }
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth
  const queue = readApprovalQueue()

  return NextResponse.json({
    ok: true,
    mode: queue.persistence_ready ? 'approval_requests_read_only_queue' : 'approval_requests_read_only_stub',
    generated_at: new Date().toISOString(),
    ...APPROVAL_STUB,
    persistence: queue.persistence_ready ? 'read_only_connected' : 'not_applied',
    approval_queue_connected: queue.persistence_ready,
    approvals: queue.approvals,
    summary: queue.summary,
    error: queue.error,
    ui_placeholder: {
      title: 'Approval Queue',
      state: queue.persistence_ready ? 'READ_ONLY' : 'BACKEND_REQUIRED',
      message: queue.persistence_ready
        ? 'Approval persistence tables are present. Queue is visible read-only; protected execution remains locked.'
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
        auth.user.id,
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
        auth.user.id,
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
