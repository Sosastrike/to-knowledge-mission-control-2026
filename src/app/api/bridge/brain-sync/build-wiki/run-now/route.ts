import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import {
  BUILDWIKI_ACTION_RUN_NOW,
  BUILDWIKI_TARGET_SERVICE,
  createBuildWikiRunNowApproval,
  deriveRunNowUiState,
  pickPublicApprovalView,
  pickPublicRunView,
  readLatestRunNow,
} from '@/lib/build-wiki-run-now'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// POST /api/bridge/brain-sync/build-wiki/run-now
//
// Creates an approval request for action `buildwiki.run_now` with target hard-
// coded to opencloud-docs-farmer.service. Returns the approval id immediately.
// No service is started here. After owner approval, the exact scoped dispatch
// route may start opencloud-docs-farmer.service once for this approval id.
//
// GET on the same route returns the latest run-now state — convenient when
// the UI needs the read view without going through the heavier /status route.
// ---------------------------------------------------------------------------

const REQUEST_REASON_DEFAULT =
  'Owner-initiated manual run of the Build-Wiki/Farmer local docs sync (oneshot, append-only, no network egress).'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const latest = readLatestRunNow()
  const ui = deriveRunNowUiState(latest.approval, latest.run)

  return NextResponse.json(
    {
      ok: true,
      mode: 'run_now_read_only',
      generated_at: new Date().toISOString(),
      persistence_ready: latest.persistence_ready,
      approval_channel: 'Mission Control owner approval API',
      target_service: BUILDWIKI_TARGET_SERVICE,
      ui_state: ui.ui_state,
      is_terminal: ui.is_terminal,
      approval: pickPublicApprovalView(latest.approval),
      run: pickPublicRunView(latest.run),
      execution_enabled: false,
      accepted_for_execution: false,
      next_action: latest.persistence_ready
        ? 'Use Run now to create a buildwiki.run_now approval request. Dispatch occurs only after owner approval.'
        : 'Apply Bridge approval/audit/run persistence before creating Run Now approvals.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { fileMustExist: true })
    db.pragma('foreign_keys = ON')
    const result = createBuildWikiRunNowApproval({
      db,
      requester: {
        userId: Number.isInteger(auth.user.id) ? auth.user.id : null,
        username: auth.user.username || auth.user.display_name || 'mission-control',
        workspaceId: auth.user.workspace_id || 1,
        tenantId: auth.user.tenant_id || 1,
      },
      reason: String(body.reason || REQUEST_REASON_DEFAULT).slice(0, 500),
      idempotencyKey: typeof body.idempotency_key === 'string' ? body.idempotency_key : null,
    })

    return NextResponse.json(
      {
        ok: result.ok,
        mode: result.ok ? 'run_now_approval_requested_no_execution' : 'run_now_approval_request_blocked',
        approval_request_created: result.approval_request_created,
        reused_existing: result.reused_existing,
        approval_id: result.approval?.id || null,
        approval_state: result.approval?.approval_state || null,
        audit_event_id: result.audit_event_id,
        approval_channel: 'Mission Control owner approval API',
        required_scope: BUILDWIKI_ACTION_RUN_NOW,
        target_service: BUILDWIKI_TARGET_SERVICE,
        execution_enabled: false,
        accepted_for_execution: false,
        writes_enabled: false,
        ui_state: result.ui_state,
        blocked_reason: result.blocked_reason,
        dispatch_route: result.approval
          ? `/api/bridge/brain-sync/build-wiki/run-now/${result.approval.id}/dispatch`
          : null,
        next_action: result.next_action,
      },
      { status: result.http_status, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'telegram_run_now_request_failed',
        approval_request_created: false,
        execution_enabled: false,
        error: error instanceof Error ? error.message.slice(0, 240) : 'telegram_approval_proxy_failed',
      },
      { status: 502 },
    )
  } finally {
    try {
      db?.close()
    } catch {
      /* noop */
    }
  }

}
