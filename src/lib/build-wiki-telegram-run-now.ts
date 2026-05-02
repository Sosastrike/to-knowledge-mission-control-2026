import {
  BUILDWIKI_ACTION_RUN_NOW,
  BUILDWIKI_PROTECTED_CATEGORY,
  BUILDWIKI_REQUIRED_APPROVER,
  BUILDWIKI_ROLLBACK_REF,
} from '@/lib/build-wiki-run-now'
import { fetchClaudeClawJson } from '@/lib/claudeclaw-telegram-approvals'

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
    run_started_at: number | null
    run_completed_at: number | null
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

function isoFromUnix(value: number | null | undefined): string | null {
  return value ? new Date(value * 1000).toISOString() : null
}

export async function readLatestTelegramBuildWikiRunNowApproval() {
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
        linked_task: null,
        ui_state: 'idle',
        is_terminal: true,
      }
    }

    const terminal =
      ['denied', 'expired'].includes(approval.status) ||
      ['completed', 'failed'].includes(approval.run_status || '')
    const uiState =
      approval.status === 'pending' ? 'pending_approval' :
      approval.status === 'denied' ? 'denied' :
      approval.status === 'expired' ? 'expired' :
      approval.run_status === 'completed' ? 'completed' :
      approval.run_status === 'failed' ? 'failed' :
      approval.run_status === 'running' ? 'dispatching' :
      approval.status === 'approved' ? 'dispatching' :
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
        expires_at: isoFromUnix(approval.expires_at),
        resolved_at: isoFromUnix(approval.decision_at),
        resolved_by: approval.approved_by,
        resolution_reason: null,
        correlation_id: '',
        created_at: isoFromUnix(approval.created_at),
        telegram_message_id: approval.telegram_message_id,
      },
      run: approval.run_status ? {
        id: approval.id,
        approval_request_id: approval.id,
        audit_event_id: null,
        run_state: approval.run_status,
        started_at: isoFromUnix(approval.run_started_at),
        finished_at: isoFromUnix(approval.run_completed_at),
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
        updated_at: isoFromUnix(approval.linked_tasks[0].updated_at),
        completed_at: isoFromUnix(approval.linked_tasks[0].completed_at),
      } : null,
      ui_state: uiState,
      is_terminal: terminal,
    }
  } catch {
    return null
  }
}
