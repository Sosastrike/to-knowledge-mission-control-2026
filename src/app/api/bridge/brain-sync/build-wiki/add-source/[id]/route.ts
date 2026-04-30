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
  ADD_SOURCE_PUBLIC_VIEW,
  BUILDWIKI_ACTION_ADD_LOCAL_SOURCE,
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_TARGET_FARMER_SCRIPT,
  deriveAddSourceUiState,
} from '@/lib/build-wiki-add-source'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

// ---------------------------------------------------------------------------
// GET /api/bridge/brain-sync/build-wiki/add-source/[id]
// Returns the live state of one add-source approval, including the diff
// preview that was computed at create time. Refuses ids whose action/target
// don't match the add-source scope.
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
                correlation_id, idempotency_key, created_at, approval_scope_json
           FROM bridge_approval_requests
          WHERE id = ? LIMIT 1`,
      )
      .get(id) as (ApprovalRow & { approval_scope_json?: string }) | undefined

    if (!approval) {
      return NextResponse.json({ ok: false, error: 'approval_request_not_found', approval_id: id }, { status: 404 })
    }
    if (
      approval.connector !== BUILDWIKI_CONNECTOR ||
      approval.action !== BUILDWIKI_ACTION_ADD_LOCAL_SOURCE ||
      approval.target !== BUILDWIKI_TARGET_FARMER_SCRIPT
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'approval_request_out_of_scope',
          approval_id: id,
          expected_connector: BUILDWIKI_CONNECTOR,
          expected_action: BUILDWIKI_ACTION_ADD_LOCAL_SOURCE,
          expected_target: BUILDWIKI_TARGET_FARMER_SCRIPT,
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

    let scope: Record<string, unknown> = {}
    try {
      scope = JSON.parse(approval.approval_scope_json || '{}') as Record<string, unknown>
    } catch { /* noop */ }

    const ui = deriveAddSourceUiState(approval, run || null)

    return NextResponse.json(
      {
        ok: true,
        mode: 'add_source_request_status',
        generated_at: new Date().toISOString(),
        target_script: BUILDWIKI_TARGET_FARMER_SCRIPT,
        approval_id: approval.id,
        ui_state: ui.ui_state,
        is_terminal: ui.is_terminal,
        proposed_path: scope.proposed_path,
        resolved_path: scope.resolved_path,
        diff_preview: scope.diff_preview,
        current_sources: scope.current_sources,
        next_sources: scope.next_sources,
        approval: ADD_SOURCE_PUBLIC_VIEW.pickApproval(approval),
        run: ADD_SOURCE_PUBLIC_VIEW.pickRun(run || null),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 240) : 'add_source_status_failed',
      },
      { status: 500 },
    )
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}
