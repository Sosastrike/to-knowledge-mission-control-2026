import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { ownerApprovalRequired } from '@/lib/designer-module-api'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(name) as { name?: string } | undefined
  return row?.name === name
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { fileMustExist: true })
    db.pragma('foreign_keys = ON')
    if (!tableExists(db, 'bridge_approval_requests') || !tableExists(db, 'bridge_audit_events')) {
      return ownerApprovalRequired({
        approval_id: id,
        action: 'deny',
        reason: 'approval_persistence_not_applied',
        persistence: 'not_applied',
        current_state: 'OWNER_APPROVAL_REQUIRED',
        http_status_when_blocked: 423,
        no_execution_enabled: true,
        no_connector_writes_enabled: true,
        approval_request_created: false,
        accepted_for_execution: false,
        next_action: 'Apply the owner-approved bridge approval/audit migration before approval decisions can be persisted.',
      })
    }

    const row = db.prepare(`
      SELECT id, workspace_id, tenant_id, connector, action, target, target_key, approval_state, correlation_id
      FROM bridge_approval_requests
      WHERE id = ?
      LIMIT 1
    `).get(id) as {
      id: string
      workspace_id: number
      tenant_id: number
      connector: string
      action: string
      target: string | null
      target_key: string
      approval_state: string
      correlation_id: string
    } | undefined

    if (!row) return NextResponse.json({ ok: false, error: 'approval_request_not_found', approval_id: id }, { status: 404 })
    if (row.approval_state !== 'pending') {
      return NextResponse.json({
        ok: false,
        error: 'approval_request_not_pending',
        approval_id: id,
        approval_state: row.approval_state,
        execution_enabled: false,
      }, { status: 409 })
    }

    const reason = String(body.reason || 'Denied by owner/operator in Mission Control.').trim().slice(0, 500)
    db.transaction(() => {
      db!.prepare(`
        UPDATE bridge_approval_requests
        SET approval_state = 'denied',
            resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            resolved_by = ?,
            resolved_by_user_id = ?,
            resolution_reason = ?
        WHERE id = ? AND approval_state = 'pending'
      `).run(auth.user.username || auth.user.display_name || 'owner', auth.user.id, reason, id)

      db!.prepare(`
        INSERT INTO bridge_audit_events (
          id, workspace_id, tenant_id, approval_request_id, actor, actor_user_id,
          connector, action, target, target_key, outcome, metadata_json, correlation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'denied', ?, ?)
      `).run(
        `audit_${randomUUID()}`,
        row.workspace_id,
        row.tenant_id,
        id,
        auth.user.username || auth.user.display_name || 'owner',
        auth.user.id,
        row.connector,
        row.action,
        row.target,
        row.target_key,
        JSON.stringify({ no_execution_enabled: true, decision_only: true, reason }),
        row.correlation_id,
      )
    })()

    return NextResponse.json({
      ok: true,
      mode: 'approval_decision_persisted_no_execution',
      approval_id: id,
      approval_state: 'denied',
      execution_enabled: false,
      accepted_for_execution: false,
      no_connector_writes_enabled: true,
      next_action: 'Approval denial is recorded. No protected action can execute from this decision.',
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 240) : 'approval_decision_failed',
      execution_enabled: false,
    }, { status: 500 })
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}
