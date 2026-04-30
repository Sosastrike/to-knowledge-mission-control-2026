import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import {
  ApprovalRow,
  BUILDWIKI_ACTION_RUN_NOW,
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_TARGET_KEY,
  BUILDWIKI_TARGET_SERVICE,
  ConnectorRunRow,
  approvalPersistenceReady,
  deriveRunNowUiState,
  pickPublicApprovalView,
  pickPublicRunView,
} from '@/lib/build-wiki-run-now'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

// ---------------------------------------------------------------------------
// GET /api/bridge/brain-sync/build-wiki/run-now/[id]
//
// Returns the live state of a specific run-now approval request: approval row,
// latest dispatch run row, and a single derived UI state for the panel.
// Refuses to return rows whose action/target do not match the run-now scope —
// this prevents the UI from accidentally polling an unrelated approval id.
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
        {
          ok: false,
          error: 'approval_persistence_not_applied',
          approval_id: id,
          ui_state: 'idle',
        },
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
      approval.action !== BUILDWIKI_ACTION_RUN_NOW ||
      approval.target_key !== BUILDWIKI_TARGET_KEY
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'approval_request_out_of_scope',
          approval_id: id,
          expected_connector: BUILDWIKI_CONNECTOR,
          expected_action: BUILDWIKI_ACTION_RUN_NOW,
          expected_target_key: BUILDWIKI_TARGET_KEY,
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

    const ui = deriveRunNowUiState(approval, run || null)

    return NextResponse.json(
      {
        ok: true,
        mode: 'run_now_request_status',
        generated_at: new Date().toISOString(),
        target_service: BUILDWIKI_TARGET_SERVICE,
        approval_id: approval.id,
        ui_state: ui.ui_state,
        is_terminal: ui.is_terminal,
        approval: pickPublicApprovalView(approval),
        run: pickPublicRunView(run || null),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 240) : 'run_now_status_failed',
      },
      { status: 500 },
    )
  } finally {
    try {
      db?.close()
    } catch {
      /* noop */
    }
  }
}
