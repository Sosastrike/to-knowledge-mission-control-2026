import Database from 'better-sqlite3'
import { config } from '@/lib/config'

// ---------------------------------------------------------------------------
// Build-Wiki "Run now" — shared constants + read helpers.
//
// This module is the single source of truth for the run-now action's hard-
// coded scope. Every endpoint that touches run-now must use these constants
// directly so the dispatcher can never start a service other than
// opencloud-docs-farmer.service.
// ---------------------------------------------------------------------------

export const BUILDWIKI_CONNECTOR = 'skill.build_wiki'
export const BUILDWIKI_ACTION_RUN_NOW = 'buildwiki.run_now'
export const BUILDWIKI_TARGET_SERVICE = 'opencloud-docs-farmer.service'
export const BUILDWIKI_TARGET_KEY = BUILDWIKI_TARGET_SERVICE
export const BUILDWIKI_RISK_LEVEL = 'low'
export const BUILDWIKI_PROTECTED_CATEGORY = 'tooling'
export const BUILDWIKI_REQUIRED_APPROVER = 'owner'
export const BUILDWIKI_ROLLBACK_REF =
  'systemctl --user stop opencloud-docs-farmer.service (oneshot exits on completion; no manual rollback usually needed)'

export type ApprovalRow = {
  id: string
  workspace_id: number
  tenant_id: number
  connector: string
  action: string
  target: string | null
  target_key: string
  requester: string
  requester_user_id: number | null
  risk_level: string
  approval_state: string
  protected_category: string
  reason: string | null
  required_approver: string
  expires_at: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolved_by_user_id: number | null
  resolution_reason: string | null
  correlation_id: string
  idempotency_key: string | null
  created_at: string
}

export type ConnectorRunRow = {
  id: string
  approval_request_id: string
  audit_event_id: string | null
  run_state: string
  started_at: string | null
  finished_at: string | null
  output_hash: string | null
  rollback_ref: string | null
  correlation_id: string
}

export function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(name) as { name?: string } | undefined
  return row?.name === name
}

export function approvalPersistenceReady(db: Database.Database): boolean {
  return (
    tableExists(db, 'bridge_approval_requests') &&
    tableExists(db, 'bridge_audit_events') &&
    tableExists(db, 'bridge_connector_runs')
  )
}

/**
 * Returns the most recent run-now approval request and its latest dispatch run
 * (if any). Used by /status and /run-now/[id] to surface live UI state.
 */
export function readLatestRunNow(): {
  persistence_ready: boolean
  approval: ApprovalRow | null
  run: ConnectorRunRow | null
} {
  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { readonly: true, fileMustExist: true })
    if (!approvalPersistenceReady(db)) {
      return { persistence_ready: false, approval: null, run: null }
    }

    const approval = db
      .prepare(
        `SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
                requester, requester_user_id, risk_level, approval_state,
                protected_category, reason, required_approver, expires_at,
                resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
                correlation_id, idempotency_key, created_at
           FROM bridge_approval_requests
          WHERE connector = ? AND action = ? AND target_key = ?
          ORDER BY created_at DESC
          LIMIT 1`,
      )
      .get(
        BUILDWIKI_CONNECTOR,
        BUILDWIKI_ACTION_RUN_NOW,
        BUILDWIKI_TARGET_KEY,
      ) as ApprovalRow | undefined

    if (!approval) {
      return { persistence_ready: true, approval: null, run: null }
    }

    const run = db
      .prepare(
        `SELECT id, approval_request_id, audit_event_id, run_state, started_at,
                finished_at, output_hash, rollback_ref, correlation_id
           FROM bridge_connector_runs
          WHERE approval_request_id = ?
          ORDER BY created_at DESC
          LIMIT 1`,
      )
      .get(approval.id) as ConnectorRunRow | undefined

    return { persistence_ready: true, approval, run: run || null }
  } catch {
    return { persistence_ready: false, approval: null, run: null }
  } finally {
    try {
      db?.close()
    } catch {
      /* noop */
    }
  }
}

/**
 * Maps the (approval_state, run_state) pair into a single UI-facing state.
 *   idle              — no run-now request yet, or the latest one is fully resolved
 *                       and the user can request another.
 *   pending_approval  — request created, awaiting owner approval.
 *   denied            — owner denied the request.
 *   approved          — approved but not yet dispatched (UI button: Dispatch).
 *   dispatching       — dispatch endpoint hit, run row in 'running' state.
 *   completed         — service exited 0; ready to request again.
 *   failed            — service exited non-zero or dispatch errored.
 *   expired           — request reached its expiry without owner action.
 */
export function deriveRunNowUiState(
  approval: ApprovalRow | null,
  run: ConnectorRunRow | null,
): {
  ui_state: 'idle' | 'pending_approval' | 'denied' | 'approved' | 'dispatching' | 'completed' | 'failed' | 'expired'
  is_terminal: boolean
} {
  if (!approval) return { ui_state: 'idle', is_terminal: true }

  if (approval.approval_state === 'pending') {
    return { ui_state: 'pending_approval', is_terminal: false }
  }
  if (approval.approval_state === 'denied') {
    return { ui_state: 'denied', is_terminal: true }
  }
  if (approval.approval_state === 'expired' || approval.approval_state === 'revoked') {
    return { ui_state: 'expired', is_terminal: true }
  }
  // approval_state === 'approved'
  if (!run) return { ui_state: 'approved', is_terminal: false }

  switch (run.run_state) {
    case 'pending':
    case 'running':
      return { ui_state: 'dispatching', is_terminal: false }
    case 'completed':
    case 'success':
      return { ui_state: 'completed', is_terminal: true }
    case 'failed':
    case 'error':
      return { ui_state: 'failed', is_terminal: true }
    default:
      return { ui_state: 'dispatching', is_terminal: false }
  }
}

export function pickPublicApprovalView(approval: ApprovalRow | null) {
  if (!approval) return null
  return {
    id: approval.id,
    approval_state: approval.approval_state,
    requester: approval.requester,
    risk_level: approval.risk_level,
    protected_category: approval.protected_category,
    reason: approval.reason,
    required_approver: approval.required_approver,
    expires_at: approval.expires_at,
    resolved_at: approval.resolved_at,
    resolved_by: approval.resolved_by,
    resolution_reason: approval.resolution_reason,
    correlation_id: approval.correlation_id,
    created_at: approval.created_at,
  }
}

export function pickPublicRunView(run: ConnectorRunRow | null) {
  if (!run) return null
  return {
    id: run.id,
    approval_request_id: run.approval_request_id,
    audit_event_id: run.audit_event_id,
    run_state: run.run_state,
    started_at: run.started_at,
    finished_at: run.finished_at,
    rollback_ref: run.rollback_ref,
    correlation_id: run.correlation_id,
  }
}
