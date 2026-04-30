import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { execFile, type ExecFileException } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import {
  ApprovalRow,
  BUILDWIKI_ACTION_RUN_NOW,
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_TARGET_KEY,
  BUILDWIKI_TARGET_SERVICE,
  approvalPersistenceReady,
} from '@/lib/build-wiki-run-now'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

// ---------------------------------------------------------------------------
// POST /api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch
//
// The ONLY surface in Mission Control that runs `systemctl --user start
// opencloud-docs-farmer.service`. Every condition below must hold or this
// endpoint refuses, returns a 4xx, and writes nothing:
//
//   1. Auth: operator role.
//   2. Persistence tables present.
//   3. Approval row exists for this id.
//   4. approval_state === 'approved'.
//   5. connector === 'skill.build_wiki'
//      AND action  === 'buildwiki.run_now'
//      AND target_key === 'opencloud-docs-farmer.service'   (HARD GUARD)
//   6. No existing run row in 'running' / 'completed' / 'success' state for
//      this approval id (idempotency — one approval, one run).
//
// On dispatch:
//   - Inserts bridge_connector_runs (run_state='running', started_at=NOW).
//   - execFile('systemctl', ['--user', 'start', BUILDWIKI_TARGET_SERVICE], ...)
//     with NO shell, NO env exposure, NO arbitrary args. The unit name is a
//     module constant — never read from request body, query string, or DB.
//   - On exit, updates run_state to 'completed' (exit 0) or 'failed', sets
//     finished_at, and writes bridge_audit_events with outcome
//     'dispatched_completed' or 'dispatched_failed'.
// ---------------------------------------------------------------------------

const DISPATCH_TIMEOUT_MS = 9 * 60 * 1000   // farmer TimeoutStartSec=10min — give 1m headroom

const TERMINAL_RUN_STATES = new Set(['completed', 'success', 'failed', 'error'])

function nowIsoZ(): string {
  return new Date().toISOString()
}

function execSystemctlStart(): Promise<{ ok: boolean; exitCode: number | null; signal: string | null; stderr: string }>
{
  return new Promise((resolve) => {
    // Minimal env: keep XDG_RUNTIME_DIR for user-scope systemd, drop everything
    // else to avoid leaking secrets into the child. NODE_ENV is required by
    // ProcessEnv typing but irrelevant to systemctl.
    const childEnv: NodeJS.ProcessEnv = {
      XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/1001',
      PATH: '/usr/bin:/bin',
      NODE_ENV: process.env.NODE_ENV || 'production',
    }
    const child = execFile(
      '/usr/bin/systemctl',
      ['--user', 'start', BUILDWIKI_TARGET_SERVICE],
      {
        timeout: DISPATCH_TIMEOUT_MS,
        env: childEnv,
        maxBuffer: 64 * 1024,
      },
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

  // --- pre-flight (sync, fast, cheap; closes db before exec) ---
  let approval: ApprovalRow | undefined
  let workspaceId = 1
  let tenantId = 1
  let correlationId = `corr_dispatch_${randomUUID()}`
  let runId = `run_${randomUUID()}`
  let dispatchAuditId = `audit_${randomUUID()}`

  try {
    db = new Database(config.dbPath, { fileMustExist: true })
    db.pragma('foreign_keys = ON')

    if (!approvalPersistenceReady(db)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'approval_persistence_not_applied',
          approval_id: id,
          execution_enabled: false,
        },
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
      approval.action !== BUILDWIKI_ACTION_RUN_NOW ||
      approval.target_key !== BUILDWIKI_TARGET_KEY
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'approval_request_out_of_scope',
          approval_id: id,
          expected_connector: BUILDWIKI_CONNECTOR,
          expected_action: BUILDWIKI_ACTION_RUN_NOW,
          expected_target_key: BUILDWIKI_TARGET_KEY,
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
          next_action: 'Owner must approve via /api/bridge/approval-requests/{id}/approve before dispatch.',
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
          next_action: 'Each approval id may dispatch the service at most once. Create a new run-now request to start another run.',
        },
        { status: 409 },
      )
    }

    workspaceId = approval.workspace_id || 1
    tenantId = approval.tenant_id || 1
    correlationId = approval.correlation_id || `corr_dispatch_${randomUUID()}`

    // Insert run row in 'running' state BEFORE invoking systemctl.
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
      BUILDWIKI_ACTION_RUN_NOW,
      BUILDWIKI_TARGET_SERVICE,
      BUILDWIKI_TARGET_KEY,
      approval.id,
      approval.risk_level || 'low',
      createHash('sha256').update(BUILDWIKI_TARGET_SERVICE).digest('hex'),
      `systemctl --user stop ${BUILDWIKI_TARGET_SERVICE}`,
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
    try {
      db?.close()
    } catch {
      /* noop */
    }
  }

  // --- exec systemctl outside the DB transaction ---
  const result = await execSystemctlStart()

  // --- post-exec: write outcome ---
  // bridge_connector_runs.audit_event_id is an FK that references the audit
  // row, so the audit row MUST be inserted before the run row's UPDATE — the
  // earlier order failed silently with FOREIGN KEY constraint failed.
  let db2: Database.Database | null = null
  let auditWriteError: string | null = null
  try {
    db2 = new Database(config.dbPath, { fileMustExist: true })
    db2.pragma('foreign_keys = ON')

    // bridge_audit_events.outcome has a CHECK constraint limiting it to:
    //   blocked, approval_requested, approved, denied, revoked, expired,
    //   allowed, running, failed, completed, rolled_back
    // Use 'completed' / 'failed' for the dispatch result.
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
        BUILDWIKI_ACTION_RUN_NOW,
        BUILDWIKI_TARGET_SERVICE,
        BUILDWIKI_TARGET_KEY,
        outcome,
        createHash('sha256').update(`${BUILDWIKI_TARGET_SERVICE}|exit=${result.exitCode ?? 'null'}`).digest('hex'),
        JSON.stringify({
          source: 'mission-control',
          dispatch_endpoint: '/api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch',
          target_service: BUILDWIKI_TARGET_SERVICE,
          execution_enabled: true,
          run_id: runId,
          systemctl_exit_code: result.exitCode,
          systemctl_signal: result.signal,
          stderr_tail: result.stderr.slice(-400),
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
    try {
      db2?.close()
    } catch {
      /* noop */
    }
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'run_now_dispatched_failed',
        approval_id: id,
        run_id: runId,
        run_state: 'failed',
        target_service: BUILDWIKI_TARGET_SERVICE,
        systemctl_exit_code: result.exitCode,
        systemctl_signal: result.signal,
        stderr_tail: result.stderr.slice(-400),
        execution_enabled: true,
        audit_write_error: auditWriteError,
      },
      { status: 502 },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      mode: 'run_now_dispatched_completed',
      approval_id: id,
      run_id: runId,
      run_state: 'completed',
      target_service: BUILDWIKI_TARGET_SERVICE,
      systemctl_exit_code: result.exitCode,
      execution_enabled: true,
      audit_write_error: auditWriteError,
      next_action: 'Service ran to completion. Use /status to see refreshed raw/wiki counts.',
    },
    { status: 200 },
  )
}
