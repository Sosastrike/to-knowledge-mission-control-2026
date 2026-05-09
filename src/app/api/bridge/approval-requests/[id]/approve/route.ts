import { NextRequest } from 'next/server'
import Database from 'better-sqlite3'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { resolveBridgeApprovalRequest } from '@/lib/bridge-approval-lifecycle'
import { dispatchApprovedBuildWikiRunNow, isBuildWikiRunNowApproval, type BuildWikiRunNowDispatchResult } from '@/lib/build-wiki-run-now-dispatch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const requester = {
    userId: Number.isInteger(auth.user.id) ? auth.user.id : null,
    username: auth.user.username || auth.user.display_name || 'mission-control',
    workspaceId: auth.user.workspace_id || 1,
    tenantId: auth.user.tenant_id || 1,
  }
  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { fileMustExist: true })
    db.pragma('foreign_keys = ON')
    const result = resolveBridgeApprovalRequest({
      db,
      approvalId: id,
      decision: 'approved',
      requester,
      reason: typeof body.reason === 'string' ? body.reason : 'approved_by_owner',
    })

    let buildWikiDispatch: BuildWikiRunNowDispatchResult | null = null
    if (result.ok && result.decision === 'approved' && isBuildWikiRunNowApproval(result.approval_request)) {
      try {
        db?.close()
        db = null
      } catch {
        /* noop */
      }
      buildWikiDispatch = await dispatchApprovedBuildWikiRunNow({
        approvalId: id,
        requester: {
          userId: requester.userId,
          username: requester.username,
        },
      })
    }

    return Response.json({
      ok: buildWikiDispatch ? result.ok && buildWikiDispatch.ok : result.ok,
      mode: buildWikiDispatch
        ? `approval_request_approved_buildwiki_${buildWikiDispatch.mode}`
        : result.ok ? 'approval_request_approved_no_execution' : 'approval_request_approve_blocked',
      approval_id: id,
      approval_state: result.approval_state,
      decision: result.decision,
      audit_event_id: result.audit_event_id,
      accepted_for_execution: buildWikiDispatch?.accepted_for_execution ?? false,
      execution_enabled: buildWikiDispatch?.execution_enabled ?? false,
      writes_enabled: buildWikiDispatch?.writes_enabled ?? false,
      blocked_reason: buildWikiDispatch?.blocked_reason || result.blocked_reason,
      next_action: buildWikiDispatch?.next_action || result.next_action,
      buildwiki_run_now_dispatch: buildWikiDispatch,
    }, { status: buildWikiDispatch?.http_status || result.http_status })
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 240) : 'approval_request_approve_failed',
      approval_id: id,
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
    }, { status: 500 })
  } finally {
    try {
      db?.close()
    } catch {
      /* noop */
    }
  }
}
