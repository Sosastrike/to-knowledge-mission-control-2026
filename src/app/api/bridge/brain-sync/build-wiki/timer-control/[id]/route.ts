import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import {
  ApprovalRow,
  ConnectorRunRow,
  approvalPersistenceReady,
} from '@/lib/build-wiki-run-now'
import {
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_TIMER_UNIT,
  TIMER_PUBLIC_VIEW,
  deriveTimerUiState,
  isTimerApprovalAction,
} from '@/lib/build-wiki-timer-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

// ---------------------------------------------------------------------------
// GET /api/bridge/brain-sync/build-wiki/timer-control/[id]
// Returns the live state of a specific timer-control approval request.
// Refuses to return rows whose action/target do not match the timer-control
// scope.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const { id } = await params

  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { readonly: true, fileMustExist: true })
    if (!approvalPersistenceReady(db)) {
      return NextResponse.json(
        { ok: false, error: 'approval_persistence_not_applied', approval_id: id, ui_state: 'idle' },
        { status: 503 },
      )
    }

    const approval = db
      .prepare(
        `SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
                requester, requester_user_id, risk_level, approval_state,
                protected_category, reason, required_approver, expires_at,
                resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
                correlation_id, idempotency_key, created_at
           FROM bridge_approval_requests
          WHERE id = ? LIMIT 1`,
      )
      .get(id) as ApprovalRow | undefined

    if (!approval) {
      return NextResponse.json(
        { ok: false, error: 'approval_request_not_found', approval_id: id },
        { status: 404 },
      )
    }
    if (
      approval.connector !== BUILDWIKI_CONNECTOR ||
      !isTimerApprovalAction(approval.action) ||
      approval.target_key !== BUILDWIKI_TIMER_UNIT
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'approval_request_out_of_scope',
          approval_id: id,
          expected_connector: BUILDWIKI_CONNECTOR,
          expected_target_key: BUILDWIKI_TIMER_UNIT,
          expected_actions: ['buildwiki.pause_sync', 'buildwiki.resume_sync'],
        },
        { status: 422 },
      )
    }

    const run = db
      .prepare(
        `SELECT id, approval_request_id, audit_event_id, run_state, started_at,
                finished_at, output_hash, rollback_ref, correlation_id
           FROM bridge_connector_runs
          WHERE approval_request_id = ?
          ORDER BY created_at DESC LIMIT 1`,
      )
      .get(approval.id) as ConnectorRunRow | undefined

    const ui = deriveTimerUiState(approval, run || null)

    return NextResponse.json(
      {
        ok: true,
        mode: 'timer_control_request_status',
        generated_at: new Date().toISOString(),
        target_unit: BUILDWIKI_TIMER_UNIT,
        approval_id: approval.id,
        ui_state: ui.ui_state,
        is_terminal: ui.is_terminal,
        action_id: ui.action_id,
        approval: TIMER_PUBLIC_VIEW.pickApproval(approval),
        run: TIMER_PUBLIC_VIEW.pickRun(run || null),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 240) : 'timer_control_status_failed',
      },
      { status: 500 },
    )
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}
