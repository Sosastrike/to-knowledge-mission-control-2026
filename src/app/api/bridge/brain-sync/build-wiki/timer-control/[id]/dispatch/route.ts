import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { execFile, type ExecFileException } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import {
  ApprovalRow,
  approvalPersistenceReady,
} from '@/lib/build-wiki-run-now'
import {
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_TIMER_UNIT,
  TIMER_ACTIONS,
  actionIdForApprovalAction,
  isTimerApprovalAction,
} from '@/lib/build-wiki-timer-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

// ---------------------------------------------------------------------------
// POST /api/bridge/brain-sync/build-wiki/timer-control/[id]/dispatch
//
// The ONLY surface that runs systemctl --user {start|stop} opencloud-docs-
// farmer.timer. Hard guards:
//   - operator role
//   - approval row exists, approval_state='approved'
//   - connector === BUILDWIKI_CONNECTOR
//     AND target_key === BUILDWIKI_TIMER_UNIT
//     AND action ∈ {buildwiki.pause_sync, buildwiki.resume_sync}
//   - no existing run row in running/completed/failed/success state
//
// The systemctl verb is resolved from the approval row's `action` field via
// the TIMER_ACTIONS allowlist — never read from the request body, query
// string, or any user-influenced source.
//
// On execution: insert audit row first (FK-correct), then UPDATE the run
// row with audit_event_id. Audit `outcome` uses 'completed'/'failed' to
// satisfy the bridge_audit_events CHECK constraint.
// ---------------------------------------------------------------------------

const DISPATCH_TIMEOUT_MS = 30_000  // start/stop on a timer is sub-second; 30s is generous

const TERMINAL_RUN_STATES = new Set(['completed', 'success', 'failed', 'error'])

function nowIsoZ(): string {
  return new Date().toISOString()
}

function execSystemctlVerb(verb: 'start' | 'stop'): Promise<{
  ok: boolean
  exitCode: number | null
  signal: string | null
  stderr: string
}> {
  return new Promise((resolve) => {
    const childEnv: NodeJS.ProcessEnv = {
      XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/1001',
      PATH: '/usr/bin:/bin',
      NODE_ENV: process.env.NODE_ENV || 'production',
    }
    const child = execFile(
      '/usr/bin/systemctl',
      ['--user', verb, BUILDWIKI_TIMER_UNIT],
      { timeout: DISPATCH_TIMEOUT_MS, env: childEnv, maxBuffer: 64 * 1024 },
      (error: ExecFileException | null, _stdout: string | Buffer, stderr: string | Buffer) => {
        const stderrText = String(stderr || '').slice(0, 1000)
        if (error) {
          const exitCode = typeof error.code === 'number' ? error.code : null
          const signal = error.signal ? String(error.signal) : null
          resolve({ ok: false, exitCode, signal, stderr: stderrText })
          return
        }
        resolve({ ok: true, exitCode: 0, signal: null, stderr: stderrText })
      },
    )
    child.on('error', () => { /* swallowed by callback above */ })
  })
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  let db: Database.Database | null = null
  let approval: ApprovalRow | undefined
  let workspaceId = 1
  let tenantId = 1
  let correlationId = `corr_dispatch_${randomUUID()}`
  const runId = `run_${randomUUID()}`
  const dispatchAuditId = `audit_${randomUUID()}`

  // Determined from the approval row (NEVER from the request).
  let actionApproval: string = ''
  let systemctlVerb: 'start' | 'stop' = 'start'

  try {
    db = new Database(config.dbPath, { fileMustExist: true })
    db.pragma('foreign_keys = ON')

    if (!approvalPersistenceReady(db)) {
      return NextResponse.json(
        { ok: false, error: 'approval_persistence_not_applied', approval_id: id, execution_enabled: false },
        { status: 503 },
      )
    }

    approval = db
      .prepare(
        `SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
                requester, requester_user_id, risk_level, approval_state,
                protected_category, reason, required_approver, expires_at,
                resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
                correlation_id, idempotency_key, created_at
           FROM bridge_approval_requests
          WHERE id = ? LIMIT 1`,
      )
      .get(id) as ApprovalRow | undefined

    if (!approval) {
      return NextResponse.json({ ok: false, error: 'approval_request_not_found', approval_id: id }, { status: 404 })
    }
    if (
      approval.connector !== BUILDWIKI_CONNECTOR ||
      !isTimerApprovalAction(approval.action) ||
      approval.target_key !== BUILDWIKI_TIMER_UNIT
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'approval_request_out_of_scope',
          approval_id: id,
          expected_connector: BUILDWIKI_CONNECTOR,
          expected_target_key: BUILDWIKI_TIMER_UNIT,
          expected_actions: ['buildwiki.pause_sync', 'buildwiki.resume_sync'],
          execution_enabled: false,
        },
        { status: 422 },
      )
    }
    if (approval.approval_state !== 'approved') {
      return NextResponse.json(
        {
          ok: false,
          error: 'approval_state_not_approved',
          approval_id: id,
          approval_state: approval.approval_state,
          execution_enabled: false,
        },
        { status: 409 },
      )
    }

    const existingRun = db
      .prepare(
        `SELECT id, run_state FROM bridge_connector_runs
          WHERE approval_request_id = ?
          ORDER BY created_at DESC LIMIT 1`,
      )
      .get(approval.id) as { id: string; run_state: string } | undefined
    if (existingRun && (existingRun.run_state === 'running' || TERMINAL_RUN_STATES.has(existingRun.run_state))) {
      return NextResponse.json(
        {
          ok: false,
          error: 'run_already_dispatched',
          approval_id: id,
          run_id: existingRun.id,
          run_state: existingRun.run_state,
          execution_enabled: false,
        },
        { status: 409 },
      )
    }

    // Resolve verb from the approval action via the allowlist. Anything
    // outside the allowlist would have failed the scope guard above.
    actionApproval = approval.action
    const id1 = actionIdForApprovalAction(actionApproval)
    if (!id1) {
      return NextResponse.json(
        { ok: false, error: 'unknown_timer_action', approval_id: id, action: actionApproval },
        { status: 422 },
      )
    }
    systemctlVerb = TIMER_ACTIONS[id1].systemctl_verb

    workspaceId = approval.workspace_id || 1
    tenantId = approval.tenant_id || 1
    correlationId = approval.correlation_id || correlationId

    db.prepare(
      `INSERT INTO bridge_connector_runs (
         id, workspace_id, tenant_id, connector, action, target, target_key,
         approval_request_id, audit_event_id, run_state, risk_level, input_hash,
         output_hash, rollback_ref, started_at, finished_at, correlation_id,
         idempotency_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'running', ?, ?, NULL, ?, ?, NULL, ?, NULL)`,
    ).run(
      runId,
      workspaceId,
      tenantId,
      BUILDWIKI_CONNECTOR,
      actionApproval,
      BUILDWIKI_TIMER_UNIT,
      BUILDWIKI_TIMER_UNIT,
      approval.id,
      approval.risk_level || 'low',
      createHash('sha256').update(`${BUILDWIKI_TIMER_UNIT}|${systemctlVerb}`).digest('hex'),
      systemctlVerb === 'stop'
        ? `systemctl --user start ${BUILDWIKI_TIMER_UNIT}`
        : `systemctl --user stop ${BUILDWIKI_TIMER_UNIT}`,
      nowIsoZ(),
      correlationId,
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 240) : 'dispatch_preflight_failed',
        execution_enabled: false,
      },
      { status: 500 },
    )
  } finally {
    try { db?.close() } catch { /* noop */ }
  }

  // Exec OUTSIDE any DB transaction
  const result = await execSystemctlVerb(systemctlVerb)

  // Probe new state to record alongside the audit
  let postActiveState: string = 'unknown'
  try {
    // Use a tiny synchronous probe (we already exited systemctl, this is
    // just for reporting; failure is harmless).
    const { execFileSync } = await import('node:child_process')
    const out = execFileSync(
      '/usr/bin/systemctl',
      ['--user', 'show', BUILDWIKI_TIMER_UNIT, '--no-pager', '-p', 'ActiveState', '--output=cat'],
      {
        encoding: 'utf8',
        env: { ...process.env, XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/1001' },
        timeout: 2500,
      },
    )
    const m = out.match(/ActiveState=(\S+)/)
    if (m) postActiveState = m[1]
  } catch { /* noop */ }

  // Persist outcome — audit first, then UPDATE the run row (FK ordering).
  let auditWriteError: string | null = null
  let db2: Database.Database | null = null
  try {
    db2 = new Database(config.dbPath, { fileMustExist: true })
    db2.pragma('foreign_keys = ON')

    const outcome = result.ok ? 'completed' : 'failed'
    const newRunState = result.ok ? 'completed' : 'failed'
    const finishedAt = nowIsoZ()
    const requester = auth.user.username || auth.user.display_name || 'mission-control'

    db2.transaction(() => {
      db2!.prepare(
        `INSERT INTO bridge_audit_events (
           id, workspace_id, tenant_id, approval_request_id, actor, actor_user_id,
           connector, action, target, target_key, outcome, payload_hash,
           metadata_json, correlation_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        dispatchAuditId,
        workspaceId,
        tenantId,
        approval!.id,
        requester,
        null,
        BUILDWIKI_CONNECTOR,
        actionApproval,
        BUILDWIKI_TIMER_UNIT,
        BUILDWIKI_TIMER_UNIT,
        outcome,
        createHash('sha256').update(`${BUILDWIKI_TIMER_UNIT}|${systemctlVerb}|exit=${result.exitCode ?? 'null'}`).digest('hex'),
        JSON.stringify({
          source: 'mission-control',
          dispatch_endpoint: '/api/bridge/brain-sync/build-wiki/timer-control/[id]/dispatch',
          target_unit: BUILDWIKI_TIMER_UNIT,
          systemctl_verb: systemctlVerb,
          execution_enabled: true,
          run_id: runId,
          systemctl_exit_code: result.exitCode,
          systemctl_signal: result.signal,
          stderr_tail: result.stderr.slice(-400),
          post_active_state: postActiveState,
          finished_at: finishedAt,
        }),
        correlationId,
      )
      db2!.prepare(
        `UPDATE bridge_connector_runs
            SET run_state = ?, finished_at = ?, audit_event_id = ?
          WHERE id = ?`,
      ).run(newRunState, finishedAt, dispatchAuditId, runId)
    })()
  } catch (error) {
    auditWriteError = error instanceof Error ? error.message.slice(0, 240) : 'audit_write_failed'
  } finally {
    try { db2?.close() } catch { /* noop */ }
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'timer_control_dispatched_failed',
        approval_id: id,
        run_id: runId,
        run_state: 'failed',
        target_unit: BUILDWIKI_TIMER_UNIT,
        systemctl_verb: systemctlVerb,
        systemctl_exit_code: result.exitCode,
        systemctl_signal: result.signal,
        stderr_tail: result.stderr.slice(-400),
        post_active_state: postActiveState,
        execution_enabled: true,
        audit_write_error: auditWriteError,
      },
      { status: 502 },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      mode: 'timer_control_dispatched_completed',
      approval_id: id,
      run_id: runId,
      run_state: 'completed',
      target_unit: BUILDWIKI_TIMER_UNIT,
      systemctl_verb: systemctlVerb,
      systemctl_exit_code: result.exitCode,
      post_active_state: postActiveState,
      execution_enabled: true,
      audit_write_error: auditWriteError,
      next_action: `Timer is now ${postActiveState}. Use /status to refresh the panel.`,
    },
    { status: 200 },
  )
}
