import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { authJson, ownerApprovalRequired } from '@/lib/designer-module-api'
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
    next_action: queue.persistence_ready
      ? 'Queue is readable. Protected execution remains locked until owner explicitly approves scoped execution runners.'
      : 'Owner must approve and apply the bridge approval/audit migration before approval requests can persist.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = authJson(request, 'operator')
  if (auth) return auth

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
