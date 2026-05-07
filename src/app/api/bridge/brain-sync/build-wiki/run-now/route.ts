import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { fetchClaudeClawJson } from '@/lib/claudeclaw-telegram-approvals'
import {
  BUILDWIKI_TARGET_SERVICE,
} from '@/lib/build-wiki-run-now'
import { readLatestTelegramBuildWikiRunNowApproval } from '@/lib/build-wiki-telegram-run-now'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// POST /api/bridge/brain-sync/build-wiki/run-now
//
// Creates an approval request for action `buildwiki.run_now` with target hard-
// coded to opencloud-docs-farmer.service. Returns the approval id immediately;
// no service is started here. The canonical Agent Zero owner-channel approval callback is
// the only active path that can start opencloud-docs-farmer.service for this
// action.
//
// GET on the same route returns the latest run-now state — convenient when
// the UI needs the read view without going through the heavier /status route.
// ---------------------------------------------------------------------------

const REQUEST_REASON_DEFAULT =
  'Owner-initiated manual run of the Build-Wiki/Farmer local docs sync (oneshot, append-only, no network egress).'

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

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const telegramLatest = await readLatestTelegramBuildWikiRunNowApproval()
  if (telegramLatest) {
    return NextResponse.json(
      {
        ok: true,
        mode: 'telegram_run_now_read_only',
        generated_at: new Date().toISOString(),
        persistence_ready: true,
        approval_channel: 'Agent Zero -> owner channel',
        target_service: BUILDWIKI_TARGET_SERVICE,
        ui_state: telegramLatest.ui_state,
        is_terminal: telegramLatest.is_terminal,
        approval: telegramLatest.approval,
        run: telegramLatest.run,
        linked_task: telegramLatest.linked_task,
        execution_enabled: false,
        next_action: 'Use the Run now button to send a Telegram approval request; owner approves in Telegram. The approved Telegram callback runs the farmer once.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      mode: 'run_now_read_only',
      generated_at: new Date().toISOString(),
      persistence_ready: false,
      target_service: BUILDWIKI_TARGET_SERVICE,
      ui_state: 'idle',
      is_terminal: true,
      approval: null,
      run: null,
      next_action: 'ClaudeClaw Telegram approval queue is unavailable; Run Now cannot create or read approvals until it is restored.',
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
          approval_channel: 'Agent Zero -> owner channel',
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
