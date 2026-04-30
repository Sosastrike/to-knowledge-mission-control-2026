import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { requireRole } from '@/lib/auth'
import { ownerApprovalRequired } from '@/lib/designer-module-api'
import { config } from '@/lib/config'
import {
  approvalPersistenceReady,
} from '@/lib/build-wiki-run-now'
import {
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_PROTECTED_CATEGORY,
  BUILDWIKI_REQUIRED_APPROVER,
  BUILDWIKI_RISK_LEVEL,
  BUILDWIKI_TIMER_UNIT,
  TIMER_ACTIONS,
  TIMER_APPROVAL_ACTIONS,
  TIMER_PUBLIC_VIEW,
  TimerActionId,
  deriveTimerUiState,
  isValidTimerActionId,
  readLatestTimerControl,
  TIMER_ROLLBACK_REF,
} from '@/lib/build-wiki-timer-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// POST /api/bridge/brain-sync/build-wiki/timer-control
//   Body: { action: 'pause' | 'resume', reason?: string }
//
// Creates an approval row pinned to:
//   connector  = skill.build_wiki
//   action     = buildwiki.pause_sync | buildwiki.resume_sync
//   target_key = opencloud-docs-farmer.timer
//
// Refuses to stack a duplicate when an in-flight (pending OR approved-not-
// yet-dispatched OR currently-running) request already exists. Will also
// refuse if the requested action is a no-op for the current timer state
// (e.g., asking to pause an already-inactive timer) so the owner doesn't
// approve something that won't change anything.
//
// GET — returns the latest timer-control state (any of the two actions).
// ---------------------------------------------------------------------------

const REQUEST_REASON_DEFAULT_PAUSE =
  'Owner-initiated pause of the OpenCloud Build-Wiki farmer timer (stops calendar; service unaffected, manual Run Now still available).'
const REQUEST_REASON_DEFAULT_RESUME =
  'Owner-initiated resume of the OpenCloud Build-Wiki farmer timer (re-arms calendar at the next 3-hour mark).'

function stableJson(value: unknown): string {
  if (!value || typeof value !== 'object') return '{}'
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort())
}

function realUserIdOrNull(db: Database.Database, value: unknown): number | null {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  const row = db.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').get(id) as { id?: number } | undefined
  return row?.id || null
}

function hashScope(input: {
  workspaceId: number
  tenantId: number
  approvalAction: string
  approvalScopeJson: string
}): string {
  return createHash('sha256')
    .update([
      input.workspaceId,
      input.tenantId,
      BUILDWIKI_CONNECTOR,
      input.approvalAction,
      BUILDWIKI_TIMER_UNIT,
      input.approvalScopeJson,
    ].join('|'))
    .digest('hex')
}

function probeTimerActiveState(): 'active' | 'inactive' | 'unknown' {
  try {
    const out = execFileSync(
      'systemctl',
      ['--user', 'show', BUILDWIKI_TIMER_UNIT, '--no-pager', '-p', 'ActiveState', '--output=cat'],
      {
        encoding: 'utf8',
        env: { ...process.env, XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/1001' },
        timeout: 2500,
      },
    )
    const m = out.match(/ActiveState=(\S+)/)
    if (!m) return 'unknown'
    if (m[1] === 'active') return 'active'
    if (m[1] === 'inactive' || m[1] === 'failed') return 'inactive'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const latest = readLatestTimerControl()
  const ui = deriveTimerUiState(latest.approval, latest.run)
  const timerActive = probeTimerActiveState()

  return NextResponse.json(
    {
      ok: true,
      mode: 'timer_control_read_only',
      generated_at: new Date().toISOString(),
      target_unit: BUILDWIKI_TIMER_UNIT,
      timer_active_state: timerActive,
      offered_action: timerActive === 'active' ? 'pause' : timerActive === 'inactive' ? 'resume' : null,
      persistence_ready: latest.persistence_ready,
      ui_state: ui.ui_state,
      is_terminal: ui.is_terminal,
      action_id: ui.action_id,
      approval: TIMER_PUBLIC_VIEW.pickApproval(latest.approval),
      run: TIMER_PUBLIC_VIEW.pickRun(latest.run),
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
  const actionId = String(body.action || '').toLowerCase()
  if (!isValidTimerActionId(actionId)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_action', expected: ['pause', 'resume'], action: body.action ?? null },
      { status: 400 },
    )
  }
  const action = TIMER_ACTIONS[actionId as TimerActionId]

  // No-op guard: refuse to create an approval whose dispatch would be a
  // no-op against the current timer state. Saves the owner from approving
  // a request that would change nothing.
  const currentState = probeTimerActiveState()
  if (currentState === action.expected_active_state_after) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'timer_control_noop',
        error: 'timer_already_in_target_state',
        current_state: currentState,
        action: actionId,
        next_action: `Timer is already ${currentState}; ${action.human_label} would be a no-op.`,
      },
      { status: 409 },
    )
  }

  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { fileMustExist: true })
    db.pragma('foreign_keys = ON')

    if (!approvalPersistenceReady(db)) {
      return ownerApprovalRequired({
        reason: 'approval_persistence_not_applied',
        connector: BUILDWIKI_CONNECTOR,
        action: action.approval_action,
        target: BUILDWIKI_TIMER_UNIT,
        approval_request_created: false,
        accepted_for_execution: false,
        next_action: 'Apply the bridge approval/audit migration before creating timer-control requests.',
      })
    }

    // Reject if any in-flight request exists for ANY timer action. Each
    // pause/resume is single-shot; you must complete or revoke one before
    // starting another.
    const placeholders = Array.from(TIMER_APPROVAL_ACTIONS).map(() => '?').join(', ')
    const existing = db
      .prepare(
        `SELECT id, action, approval_state
           FROM bridge_approval_requests
          WHERE connector = ? AND target_key = ? AND action IN (${placeholders})
            AND approval_state IN ('pending', 'approved')
          ORDER BY created_at DESC
          LIMIT 1`,
      )
      .get(
        BUILDWIKI_CONNECTOR,
        BUILDWIKI_TIMER_UNIT,
        ...Array.from(TIMER_APPROVAL_ACTIONS),
      ) as { id: string; action: string; approval_state: string } | undefined

    if (existing) {
      const runRow = db
        .prepare(
          `SELECT run_state FROM bridge_connector_runs
            WHERE approval_request_id = ?
            ORDER BY created_at DESC LIMIT 1`,
        )
        .get(existing.id) as { run_state?: string } | undefined
      const runTerminal = !!runRow && (
        runRow.run_state === 'completed' ||
        runRow.run_state === 'success'   ||
        runRow.run_state === 'failed'    ||
        runRow.run_state === 'error'
      )

      if (existing.approval_state === 'pending') {
        return NextResponse.json(
          {
            ok: false,
            mode: 'timer_control_in_flight',
            approval_request_created: false,
            approval_id: existing.id,
            approval_state: 'pending',
            existing_action: existing.action,
            error: 'in_flight_request_exists',
            next_action: 'A timer-control request is already pending owner approval. Approve, deny, or wait for it before creating another.',
          },
          { status: 409 },
        )
      }
      if (existing.approval_state === 'approved' && !runTerminal) {
        if (runRow && runRow.run_state === 'running') {
          return NextResponse.json(
            {
              ok: false,
              mode: 'timer_control_dispatching',
              approval_request_created: false,
              approval_id: existing.id,
              approval_state: 'approved',
              existing_action: existing.action,
              error: 'dispatch_in_progress',
            },
            { status: 409 },
          )
        }
        // approved-not-dispatched of the SAME action → reuse so the UI can
        // proceed to dispatch. Of a DIFFERENT action → reject (the existing
        // approved request must be dispatched or revoked first).
        if (existing.action === action.approval_action) {
          return NextResponse.json(
            {
              ok: true,
              mode: 'timer_control_request_reused',
              approval_request_created: false,
              approval_id: existing.id,
              approval_state: 'approved',
              action: actionId,
              next_action: 'Approval already granted for this action. Call POST /timer-control/{id}/dispatch to apply.',
            },
            { status: 200 },
          )
        }
        return NextResponse.json(
          {
            ok: false,
            mode: 'timer_control_conflicting_approval',
            approval_request_created: false,
            approval_id: existing.id,
            approval_state: 'approved',
            existing_action: existing.action,
            requested_action: actionId,
            error: 'conflicting_approval_present',
            next_action: 'A different timer-control action is already approved. Dispatch or revoke it before requesting another.',
          },
          { status: 409 },
        )
      }
      // approved + terminal → fall through and create new
    }

    const workspaceId = auth.user.workspace_id || 1
    const tenantId = auth.user.tenant_id || 1
    const approvalId = `apr_${randomUUID()}`
    const auditId = `audit_${randomUUID()}`
    const correlationId = `corr_buildwiki_${actionId}_${randomUUID()}`
    const requester = auth.user.username || auth.user.display_name || 'mission-control'
    const requesterUserId = realUserIdOrNull(db, auth.user.id)
    const reasonDefault = actionId === 'pause' ? REQUEST_REASON_DEFAULT_PAUSE : REQUEST_REASON_DEFAULT_RESUME
    const reason = String(body.reason || reasonDefault).trim().slice(0, 500) || reasonDefault
    const approvalScopeJson = stableJson({
      timer_unit: BUILDWIKI_TIMER_UNIT,
      systemctl_verb: action.systemctl_verb,
      command: `systemctl --user ${action.systemctl_verb} ${BUILDWIKI_TIMER_UNIT}`,
      affects: 'timer (calendar) only — service unit and Run Now path unaffected',
    })

    db.transaction(() => {
      db!.prepare(`
        INSERT INTO bridge_approval_requests (
          id, workspace_id, tenant_id, connector, action, target, target_key,
          requester, requester_user_id, risk_level, approval_state, protected_category,
          approval_scope_json, scope_hash, reason, required_approver, rollback_available,
          rollback_ref, expires_at, correlation_id, idempotency_key
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 1, ?, NULL, ?, NULL
        )
      `).run(
        approvalId,
        workspaceId,
        tenantId,
        BUILDWIKI_CONNECTOR,
        action.approval_action,
        BUILDWIKI_TIMER_UNIT,
        BUILDWIKI_TIMER_UNIT,
        requester,
        requesterUserId,
        BUILDWIKI_RISK_LEVEL,
        BUILDWIKI_PROTECTED_CATEGORY,
        approvalScopeJson,
        hashScope({ workspaceId, tenantId, approvalAction: action.approval_action, approvalScopeJson }),
        reason,
        BUILDWIKI_REQUIRED_APPROVER,
        TIMER_ROLLBACK_REF(action.systemctl_verb),
        correlationId,
      )
      db!.prepare(`
        INSERT INTO bridge_audit_events (
          id, workspace_id, tenant_id, approval_request_id, actor, actor_user_id,
          connector, action, target, target_key, outcome, payload_hash,
          metadata_json, correlation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approval_requested', ?, ?, ?)
      `).run(
        auditId,
        workspaceId,
        tenantId,
        approvalId,
        requester,
        requesterUserId,
        BUILDWIKI_CONNECTOR,
        action.approval_action,
        BUILDWIKI_TIMER_UNIT,
        BUILDWIKI_TIMER_UNIT,
        createHash('sha256').update(approvalScopeJson).digest('hex'),
        stableJson({
          source: 'mission-control',
          timer_control_endpoint: '/api/bridge/brain-sync/build-wiki/timer-control',
          target_unit: BUILDWIKI_TIMER_UNIT,
          systemctl_verb: action.systemctl_verb,
          execution_enabled: false,
          approval_request_created: true,
        }),
        correlationId,
      )
    })()

    return NextResponse.json(
      {
        ok: true,
        mode: 'timer_control_request_created_no_execution',
        approval_request_created: true,
        approval_id: approvalId,
        approval_state: 'pending',
        action: actionId,
        target_unit: BUILDWIKI_TIMER_UNIT,
        execution_enabled: false,
        accepted_for_execution: false,
        ui_state: 'pending_approval',
        next_action: `Owner must POST /api/bridge/approval-requests/${approvalId}/approve before dispatch can ${action.human_label.toLowerCase()}.`,
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 240) : 'timer_control_request_failed',
        approval_request_created: false,
        execution_enabled: false,
      },
      { status: 500 },
    )
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}
