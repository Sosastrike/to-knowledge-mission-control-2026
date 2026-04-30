import Database from 'better-sqlite3'
import { config } from '@/lib/config'
import {
  ApprovalRow,
  ConnectorRunRow,
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_PROTECTED_CATEGORY,
  BUILDWIKI_REQUIRED_APPROVER,
  BUILDWIKI_RISK_LEVEL,
  approvalPersistenceReady,
  pickPublicApprovalView,
  pickPublicRunView,
} from '@/lib/build-wiki-run-now'

// ---------------------------------------------------------------------------
// Build-Wiki — timer control (pause / resume) shared module.
//
// Wires two action types behind the same approval contract that Run Now uses:
//   buildwiki.pause_sync   → systemctl --user stop  opencloud-docs-farmer.timer
//   buildwiki.resume_sync  → systemctl --user start opencloud-docs-farmer.timer
//
// Hard-coded scope: only opencloud-docs-farmer.timer is touched. The
// dispatcher resolves the verb from a fixed allowlist; nothing in the
// approval body, query string, or DB row can redirect dispatch to another
// unit. The service unit is unaffected — Run Now still works whether the
// timer is paused or active.
// ---------------------------------------------------------------------------

export const BUILDWIKI_TIMER_UNIT = 'opencloud-docs-farmer.timer'

export type TimerActionId = 'pause' | 'resume'

export const TIMER_ACTIONS: Record<TimerActionId, {
  approval_action: string
  systemctl_verb: 'stop' | 'start'
  human_label: string
  expected_active_state_before: 'active' | 'inactive'
  expected_active_state_after: 'inactive' | 'active'
}> = {
  pause: {
    approval_action: 'buildwiki.pause_sync',
    systemctl_verb: 'stop',
    human_label: 'Pause sync',
    expected_active_state_before: 'active',
    expected_active_state_after: 'inactive',
  },
  resume: {
    approval_action: 'buildwiki.resume_sync',
    systemctl_verb: 'start',
    human_label: 'Resume sync',
    expected_active_state_before: 'inactive',
    expected_active_state_after: 'active',
  },
}

export const TIMER_APPROVAL_ACTIONS = new Set(
  Object.values(TIMER_ACTIONS).map((a) => a.approval_action),
)

export function isValidTimerActionId(value: unknown): value is TimerActionId {
  return value === 'pause' || value === 'resume'
}

export function isTimerApprovalAction(action: string | null | undefined): boolean {
  return typeof action === 'string' && TIMER_APPROVAL_ACTIONS.has(action)
}

export function actionIdForApprovalAction(action: string): TimerActionId | null {
  for (const id of ['pause', 'resume'] as TimerActionId[]) {
    if (TIMER_ACTIONS[id].approval_action === action) return id
  }
  return null
}

export const TIMER_ROLLBACK_REF = (verb: 'stop' | 'start') =>
  verb === 'stop'
    ? `systemctl --user start ${BUILDWIKI_TIMER_UNIT} (re-arms the calendar)`
    : `systemctl --user stop ${BUILDWIKI_TIMER_UNIT} (pauses the calendar)`

export type LatestTimerControl = {
  persistence_ready: boolean
  approval: ApprovalRow | null
  run: ConnectorRunRow | null
}

/**
 * Returns the most recent timer-control approval (any of the timer actions)
 * and its latest dispatch run. Used by the UI panel to know what state the
 * one-shot button is in, without needing to know which action_id was used.
 */
export function readLatestTimerControl(): LatestTimerControl {
  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { readonly: true, fileMustExist: true })
    if (!approvalPersistenceReady(db)) {
      return { persistence_ready: false, approval: null, run: null }
    }
    const placeholders = Array.from(TIMER_APPROVAL_ACTIONS).map(() => '?').join(', ')
    const approval = db
      .prepare(
        `SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
                requester, requester_user_id, risk_level, approval_state,
                protected_category, reason, required_approver, expires_at,
                resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
                correlation_id, idempotency_key, created_at
           FROM bridge_approval_requests
          WHERE connector = ? AND target_key = ? AND action IN (${placeholders})
          ORDER BY created_at DESC
          LIMIT 1`,
      )
      .get(
        BUILDWIKI_CONNECTOR,
        BUILDWIKI_TIMER_UNIT,
        ...Array.from(TIMER_APPROVAL_ACTIONS),
      ) as ApprovalRow | undefined

    if (!approval) return { persistence_ready: true, approval: null, run: null }

    const run = db
      .prepare(
        `SELECT id, approval_request_id, audit_event_id, run_state, started_at,
                finished_at, output_hash, rollback_ref, correlation_id
           FROM bridge_connector_runs
          WHERE approval_request_id = ?
          ORDER BY created_at DESC LIMIT 1`,
      )
      .get(approval.id) as ConnectorRunRow | undefined

    return { persistence_ready: true, approval, run: run || null }
  } catch {
    return { persistence_ready: false, approval: null, run: null }
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}

/**
 * Maps the (approval_state, run_state) pair plus the action id into a single
 * UI-facing state for the timer-control button.
 */
export function deriveTimerUiState(
  approval: ApprovalRow | null,
  run: ConnectorRunRow | null,
): {
  ui_state: 'idle' | 'pending_approval' | 'denied' | 'approved' | 'dispatching' | 'completed' | 'failed' | 'expired'
  is_terminal: boolean
  action_id: TimerActionId | null
} {
  if (!approval) return { ui_state: 'idle', is_terminal: true, action_id: null }
  const id = actionIdForApprovalAction(approval.action)

  if (approval.approval_state === 'pending') {
    return { ui_state: 'pending_approval', is_terminal: false, action_id: id }
  }
  if (approval.approval_state === 'denied') {
    return { ui_state: 'denied', is_terminal: true, action_id: id }
  }
  if (approval.approval_state === 'expired' || approval.approval_state === 'revoked') {
    return { ui_state: 'expired', is_terminal: true, action_id: id }
  }
  if (!run) return { ui_state: 'approved', is_terminal: false, action_id: id }

  switch (run.run_state) {
    case 'pending':
    case 'running':
      return { ui_state: 'dispatching', is_terminal: false, action_id: id }
    case 'completed':
    case 'success':
      return { ui_state: 'completed', is_terminal: true, action_id: id }
    case 'failed':
    case 'error':
      return { ui_state: 'failed', is_terminal: true, action_id: id }
    default:
      return { ui_state: 'dispatching', is_terminal: false, action_id: id }
  }
}

export const TIMER_PUBLIC_VIEW = {
  pickApproval: pickPublicApprovalView,
  pickRun: pickPublicRunView,
}

export {
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_PROTECTED_CATEGORY,
  BUILDWIKI_REQUIRED_APPROVER,
  BUILDWIKI_RISK_LEVEL,
}
