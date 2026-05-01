import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { fetchClaudeClawJson } from '@/lib/claudeclaw-telegram-approvals'
import {
  BUILDWIKI_ACTION_RUN_NOW,
  BUILDWIKI_PROTECTED_CATEGORY,
  BUILDWIKI_REQUIRED_APPROVER,
  BUILDWIKI_ROLLBACK_REF,
  BUILDWIKI_TARGET_SERVICE,
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
// coded to opencloud-docs-farmer.service. Returns the approval id immediately;
// no service is started here. The dispatcher endpoint
// (POST /api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch) is the only
// surface that can actually call systemctl, and it will reject any approval
// row whose action/target does not match these constants exactly.
//
// GET on the same route returns the latest run-now state — convenient when
// the UI needs the read view without going through the heavier /status route.
// ---------------------------------------------------------------------------

const REQUEST_REASON_DEFAULT =
  'Owner-initiated manual run of the OpenCloud Build-Wiki local docs farmer (oneshot, append-only, no network egress).'

type TelegramApprovalQueuePayload = {
  ok?: boolean
  approvals?: Array<{
    id: string
    title: string
    requesting_agent: string
    action: string
    scope: string
    risk_level: string
    status: string
    created_at: number
    expires_at: number
    approved_by: string | null
    decision_at: number | null
    telegram_message_id: number | null
    run_status: string | null
    run_exit_code: number | null
    run_summary: string | null
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
}

type TelegramApprovalCreatePayload = {
  ok?: boolean
  approval_request_created?: boolean
  duplicate_prompt_prevented?: boolean
  approval?: {
    id: string
    title: string
    requesting_agent: string
    action: string
    scope: string
    risk_level: string
    status: string
    expires_at: number
    telegram_message_id: number | null
  }
  linked_task?: {
    id: string
    current_status: string
    approval_state: string
    execution_state: string
    last_checkpoint: string | null
  }
  error?: string
  detail?: string
}

async function readLatestTelegramBuildWikiApproval() {
  try {
    const upstream = await fetchClaudeClawJson<TelegramApprovalQueuePayload>(
      `/api/telegram-approvals?action=${encodeURIComponent(BUILDWIKI_ACTION_RUN_NOW)}&audit=1&limit=20`,
      {},
      12000,
    )
    if (!upstream.ok || !upstream.payload || typeof upstream.payload !== 'object') return null
    const payload = upstream.payload as TelegramApprovalQueuePayload
    const approval = payload.approvals?.[0]
    if (!approval) {
      return {
        persistence_ready: true,
        approval: null,
        run: null,
        ui_state: 'idle',
        is_terminal: true,
      }
    }
    const terminal = ['denied', 'expired'].includes(approval.status) || ['completed', 'failed'].includes(approval.run_status || '')
    const uiState =
      approval.status === 'pending' ? 'pending_approval' :
      approval.status === 'denied' ? 'denied' :
      approval.status === 'expired' ? 'expired' :
      approval.run_status === 'completed' ? 'completed' :
      approval.run_status === 'failed' ? 'failed' :
      approval.status === 'approved' ? 'approved' :
      'idle'
    return {
      persistence_ready: true,
      approval: {
        id: approval.id,
        approval_state: approval.status,
        requester: approval.requesting_agent,
        risk_level: approval.risk_level,
        protected_category: BUILDWIKI_PROTECTED_CATEGORY,
        reason: approval.title,
        required_approver: BUILDWIKI_REQUIRED_APPROVER,
        expires_at: new Date(approval.expires_at * 1000).toISOString(),
        resolved_at: approval.decision_at ? new Date(approval.decision_at * 1000).toISOString() : null,
        resolved_by: approval.approved_by,
        resolution_reason: null,
        correlation_id: '',
        created_at: new Date(approval.created_at * 1000).toISOString(),
        telegram_message_id: approval.telegram_message_id,
      },
      run: approval.run_status ? {
        id: approval.id,
        approval_request_id: approval.id,
        audit_event_id: null,
        run_state: approval.run_status,
        started_at: null,
        finished_at: null,
        rollback_ref: BUILDWIKI_ROLLBACK_REF,
        correlation_id: '',
        run_exit_code: approval.run_exit_code,
        run_summary: approval.run_summary,
      } : null,
      linked_task: approval.linked_tasks?.[0] ? {
        id: approval.linked_tasks[0].id,
        current_status: approval.linked_tasks[0].current_status,
        assigned_agent: approval.linked_tasks[0].assigned_agent,
        approval_state: approval.linked_tasks[0].approval_state,
        execution_state: approval.linked_tasks[0].execution_state,
        last_checkpoint: approval.linked_tasks[0].last_checkpoint,
        final_result: approval.linked_tasks[0].final_result,
        updated_at: new Date(approval.linked_tasks[0].updated_at * 1000).toISOString(),
        completed_at: approval.linked_tasks[0].completed_at ? new Date(approval.linked_tasks[0].completed_at * 1000).toISOString() : null,
      } : null,
      ui_state: uiState,
      is_terminal: terminal,
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const telegramLatest = await readLatestTelegramBuildWikiApproval()
  if (telegramLatest) {
    return NextResponse.json(
      {
        ok: true,
        mode: 'telegram_run_now_read_only',
        generated_at: new Date().toISOString(),
        persistence_ready: true,
        approval_channel: 'Tony -> Telegram',
        target_service: BUILDWIKI_TARGET_SERVICE,
        ui_state: telegramLatest.ui_state,
        is_terminal: telegramLatest.is_terminal,
        approval: telegramLatest.approval,
        run: telegramLatest.run,
        linked_task: telegramLatest.linked_task,
        execution_enabled: false,
        next_action: 'Use the Run now button to send a Telegram approval request; owner approves in Telegram.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const latest = readLatestRunNow()
  const ui = deriveRunNowUiState(latest.approval, latest.run)

  return NextResponse.json(
    {
      ok: true,
      mode: 'run_now_read_only',
      generated_at: new Date().toISOString(),
      persistence_ready: latest.persistence_ready,
      target_service: BUILDWIKI_TARGET_SERVICE,
      ui_state: ui.ui_state,
      is_terminal: ui.is_terminal,
      approval: pickPublicApprovalView(latest.approval),
      run: pickPublicRunView(latest.run),
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

  try {
    const upstream = await fetchClaudeClawJson<TelegramApprovalCreatePayload>(
      '/api/telegram-approvals/buildwiki/run-now',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reason: String(body.reason || REQUEST_REASON_DEFAULT).slice(0, 500),
        }),
      },
      12000,
    )
    const payload = upstream.payload as TelegramApprovalCreatePayload
    if (upstream.ok && payload?.ok && payload.approval) {
      return NextResponse.json(
        {
          ok: true,
          mode: 'telegram_run_now_request_sent_no_execution',
          approval_request_created: payload.approval_request_created === true,
          duplicate_prompt_prevented: payload.duplicate_prompt_prevented === true,
          approval_id: payload.approval.id,
          approval_state: payload.approval.status,
          telegram_message_id: payload.approval.telegram_message_id,
          linked_task: payload.linked_task || null,
          approval_channel: 'Tony -> Telegram',
          target_service: BUILDWIKI_TARGET_SERVICE,
          execution_enabled: false,
          accepted_for_execution: false,
          ui_state: 'pending_approval',
          next_action: 'Approve or deny this exact request in Telegram. Mission Control does not approve directly yet.',
        },
        { status: payload.approval_request_created === true ? 201 : 200 },
      )
    }

    return NextResponse.json(
      {
        ok: false,
        mode: 'telegram_run_now_request_failed',
        approval_request_created: false,
        execution_enabled: false,
        error: payload?.error || `upstream_http_${upstream.status}`,
        detail: payload?.detail,
        next_action: 'Restore ClaudeClaw Telegram approval endpoint before creating Build-Wiki approvals from Mission Control.',
      },
      { status: upstream.status || 502 },
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
  }

}
