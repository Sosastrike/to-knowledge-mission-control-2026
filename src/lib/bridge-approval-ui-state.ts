import { normalizeApprovalQueueState, summarizeApprovalQueue, type ApprovalQueueSummary } from './approval-queue-state'
import type { BridgeApprovalRequestModel } from './bridge-approval-lifecycle'

export type BridgeApprovalUiInput = BridgeApprovalRequestModel

export type BridgeApprovalUiCommand = {
  method: 'POST' | null
  path: string | null
  enabled: boolean
  blocker: string | null
}

export type BridgeApprovalUiRow = {
  id: string
  title: string
  ui_state: string
  status_grammar: 'green' | 'yellow' | 'blue' | 'red' | 'gray'
  risk_level: string
  protected_category: string
  scope_label: string
  requester: string
  required_approver: string
  requested_at: string
  expires_at: string | null
  resolved_at: string | null
  result_label: string | null
  scope: BridgeApprovalRequestModel['scope']
  owner: BridgeApprovalRequestModel['owner']
  lifecycle: BridgeApprovalRequestModel['lifecycle']
  execution: BridgeApprovalRequestModel['execution']
  audit: BridgeApprovalRequestModel['audit']
  rollback: BridgeApprovalRequestModel['rollback']
  commands: {
    approve: BridgeApprovalUiCommand
    deny: BridgeApprovalUiCommand
    execute: BridgeApprovalUiCommand
  }
}

export type BridgeApprovalUiState = {
  generated_at: string
  pending: BridgeApprovalUiRow[]
  history: BridgeApprovalUiRow[]
  summary: ApprovalQueueSummary
  no_fake_approval_requests: true
  protected_actions_locked: true
  execution_enabled: false
  writes_enabled: false
}

export function buildBridgeApprovalUiState(input: {
  models?: BridgeApprovalUiInput[]
  generatedAt?: string | Date
}): BridgeApprovalUiState {
  const generatedAt = normalizeGeneratedAt(input.generatedAt)
  const rows = (input.models || []).map((model) => mapApprovalUiRow(model, generatedAt))
  return {
    generated_at: generatedAt.toISOString(),
    pending: rows.filter((row) => row.ui_state === 'pending'),
    history: rows.filter((row) => row.ui_state !== 'pending'),
    summary: summarizeApprovalQueue(rows.map((row) => ({
      approval_state: row.lifecycle.approval_state,
      ui_state: row.ui_state,
      run_status: row.execution.run_state,
      expires_at: row.lifecycle.expires_at,
    })), generatedAt),
    no_fake_approval_requests: true,
    protected_actions_locked: true,
    execution_enabled: false,
    writes_enabled: false,
  }
}

function mapApprovalUiRow(model: BridgeApprovalUiInput, generatedAt: Date): BridgeApprovalUiRow {
  const uiState = normalizeApprovalQueueState({
    approval_state: model.lifecycle.approval_state,
    run_status: model.execution.run_state,
    expires_at: model.lifecycle.expires_at,
  }, generatedAt)
  const pending = uiState === 'pending'
  const resultLabel = resultText(model, uiState)

  return {
    id: model.id,
    title: model.request_type,
    ui_state: uiState,
    status_grammar: statusGrammar(uiState),
    risk_level: model.scope.risk_level,
    protected_category: model.scope.protected_category,
    scope_label: scopeLabel(model),
    requester: model.owner.requester,
    required_approver: model.owner.required_approver,
    requested_at: model.lifecycle.requested_at,
    expires_at: model.lifecycle.expires_at,
    resolved_at: model.lifecycle.resolved_at,
    result_label: resultLabel,
    scope: model.scope,
    owner: model.owner,
    lifecycle: model.lifecycle,
    execution: model.execution,
    audit: model.audit,
    rollback: model.rollback,
    commands: {
      approve: {
        method: pending ? 'POST' : null,
        path: pending ? `/api/bridge/approval-requests/${model.id}/approve` : null,
        enabled: pending,
        blocker: pending ? null : 'approval_request_not_pending',
      },
      deny: {
        method: pending ? 'POST' : null,
        path: pending ? `/api/bridge/approval-requests/${model.id}/deny` : null,
        enabled: pending,
        blocker: pending ? null : 'approval_request_not_pending',
      },
      execute: {
        method: null,
        path: null,
        enabled: false,
        blocker: pending ? 'owner_approval_required_before_execution' : executionBlocker(model, uiState),
      },
    },
  }
}

function normalizeGeneratedAt(value: string | Date | undefined): Date {
  if (value instanceof Date) return value
  if (value) {
    const parsed = new Date(value)
    if (Number.isFinite(parsed.getTime())) return parsed
  }
  return new Date()
}

function scopeLabel(model: BridgeApprovalUiInput): string {
  const target = model.scope.target_key || model.scope.target
  return [model.scope.connector, model.scope.action, target].filter(Boolean).join(' · ')
}

function statusGrammar(uiState: string): BridgeApprovalUiRow['status_grammar'] {
  if (uiState === 'completed') return 'green'
  if (uiState === 'pending' || uiState === 'approved' || uiState === 'running') return 'yellow'
  if (uiState === 'denied' || uiState === 'expired' || uiState === 'failed') return 'red'
  return 'gray'
}

function resultText(model: BridgeApprovalUiInput, uiState: string): string | null {
  if (model.execution.error) return model.execution.error
  if (model.execution.result) return model.execution.result
  if (model.execution.run_state) return model.execution.run_state
  if (uiState === 'pending') return 'approval pending'
  if (uiState === 'approved') return 'approved; execution runner still gated'
  if (uiState === 'denied') return model.owner.resolution_reason || 'denied by owner'
  if (uiState === 'expired') return 'approval request expired'
  return null
}

function executionBlocker(model: BridgeApprovalUiInput, uiState: string): string {
  if (uiState === 'approved' && !model.execution.run_id) return 'scoped_execution_runner_not_enabled'
  if (uiState === 'denied') return 'approval_request_denied'
  if (uiState === 'expired') return 'approval_request_expired'
  if (uiState === 'completed') return 'approval_request_already_completed'
  if (uiState === 'failed') return 'approval_request_failed'
  return 'protected_execution_locked'
}
