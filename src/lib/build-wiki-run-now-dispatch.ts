import Database from 'better-sqlite3'
import { execFile, type ExecFileException } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { config } from '@/lib/config'
import {
  type ApprovalRow,
  BUILDWIKI_ACTION_RUN_NOW,
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_TARGET_KEY,
  BUILDWIKI_TARGET_SERVICE,
  approvalPersistenceReady,
} from '@/lib/build-wiki-run-now'

const DISPATCH_TIMEOUT_MS = 9 * 60 * 1000
const TERMINAL_RUN_STATES = new Set(['completed', 'success', 'failed', 'error'])

export type BuildWikiRunNowDispatchRequester = {
  userId: number | null
  username: string
}

export type BuildWikiSystemctlStartResult = {
  ok: boolean
  exitCode: number | null
  signal: string | null
  stderr: string
}

export type BuildWikiRunNowDispatchResult = {
  ok: boolean
  http_status: number
  mode: string
  error: string | null
  approval_id: string
  run_id: string | null
  run_state: string | null
  target_service: string
  expected_connector: string | null
  expected_action: string | null
  expected_target_key: string | null
  systemctl_exit_code: number | null
  systemctl_signal: string | null
  stderr_tail: string | null
  execution_enabled: boolean
  accepted_for_execution: boolean
  writes_enabled: boolean
  audit_event_id: string | null
  audit_write_error: string | null
  blocked_reason: string | null
  next_action: string | null
}

function nowIsoZ(): string {
  return new Date().toISOString()
}

function systemdRuntimeDir(): string {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 1001
  return process.env.XDG_RUNTIME_DIR || `/run/user/${uid}`
}

export function isBuildWikiRunNowApproval(approval: Pick<ApprovalRow, 'connector' | 'action' | 'target_key'> | null | undefined): boolean {
  return Boolean(
    approval &&
      approval.connector === BUILDWIKI_CONNECTOR &&
      approval.action === BUILDWIKI_ACTION_RUN_NOW &&
      approval.target_key === BUILDWIKI_TARGET_KEY,
  )
}

export function runBuildWikiSystemctlStart(): Promise<BuildWikiSystemctlStartResult> {
  return new Promise((resolve) => {
    const childEnv: NodeJS.ProcessEnv = {
      XDG_RUNTIME_DIR: systemdRuntimeDir(),
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
    child.on('error', () => { /* callback handles process errors */ })
  })
}

function response(input: Omit<BuildWikiRunNowDispatchResult, 'target_service' | 'writes_enabled' | 'audit_write_error' | 'stderr_tail' | 'systemctl_signal' | 'systemctl_exit_code' | 'error' | 'expected_connector' | 'expected_action' | 'expected_target_key'> & Partial<BuildWikiRunNowDispatchResult>): BuildWikiRunNowDispatchResult {
  return {
    target_service: BUILDWIKI_TARGET_SERVICE,
    writes_enabled: Boolean(input.writes_enabled),
    audit_write_error: input.audit_write_error ?? null,
    stderr_tail: input.stderr_tail ?? null,
    systemctl_signal: input.systemctl_signal ?? null,
    systemctl_exit_code: input.systemctl_exit_code ?? null,
    error: input.error ?? null,
    expected_connector: input.expected_connector ?? null,
    expected_action: input.expected_action ?? null,
    expected_target_key: input.expected_target_key ?? null,
    ...input,
  }
}

export async function dispatchApprovedBuildWikiRunNow(input: {
  approvalId: string
  requester: BuildWikiRunNowDispatchRequester
  runner?: () => Promise<BuildWikiSystemctlStartResult>
  dbPath?: string
}): Promise<BuildWikiRunNowDispatchResult> {
  const dbPath = input.dbPath || config.dbPath
  let db: Database.Database | null = null
  let approval: ApprovalRow | undefined
  let workspaceId = 1
  let tenantId = 1
  let correlationId = `corr_dispatch_${randomUUID()}`
  const runId = `run_${randomUUID()}`
  const dispatchAuditId = `audit_${randomUUID()}`

  try {
    db = new Database(dbPath, { fileMustExist: true })
    db.pragma('foreign_keys = ON')

    if (!approvalPersistenceReady(db)) {
      return response({
        ok: false,
        http_status: 503,
        mode: 'run_now_dispatch_blocked',
        approval_id: input.approvalId,
        run_id: null,
        run_state: null,
        execution_enabled: false,
        accepted_for_execution: false,
        audit_event_id: null,
        blocked_reason: 'approval_persistence_not_applied',
        next_action: 'Apply Bridge approval/audit/run persistence before dispatching Build-Wiki Run Now.',
      })
    }

    approval = db.prepare(
      `SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
              requester, requester_user_id, risk_level, approval_state,
              protected_category, reason, required_approver, expires_at,
              resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
              correlation_id, idempotency_key, created_at
         FROM bridge_approval_requests
        WHERE id = ? LIMIT 1`,
    ).get(input.approvalId) as ApprovalRow | undefined

    if (!approval) {
      return response({
        ok: false,
        http_status: 404,
        mode: 'run_now_dispatch_blocked',
        approval_id: input.approvalId,
        run_id: null,
        run_state: null,
        execution_enabled: false,
        accepted_for_execution: false,
        audit_event_id: null,
        blocked_reason: 'approval_request_not_found',
        next_action: 'Create a Build-Wiki Run Now approval request before dispatch.',
      })
    }

    if (!isBuildWikiRunNowApproval(approval)) {
      return response({
        ok: false,
        http_status: 422,
        mode: 'run_now_dispatch_blocked',
        approval_id: input.approvalId,
        run_id: null,
        run_state: null,
        execution_enabled: false,
        accepted_for_execution: false,
        audit_event_id: null,
        error: 'approval_request_out_of_scope',
        expected_connector: BUILDWIKI_CONNECTOR,
        expected_action: BUILDWIKI_ACTION_RUN_NOW,
        expected_target_key: BUILDWIKI_TARGET_KEY,
        blocked_reason: 'approval_request_out_of_scope',
        next_action: 'Only buildwiki.run_now for opencloud-docs-farmer.service can use this dispatcher.',
      })
    }

    if (approval.approval_state !== 'approved') {
      return response({
        ok: false,
        http_status: 409,
        mode: 'run_now_dispatch_blocked',
        approval_id: input.approvalId,
        run_id: null,
        run_state: null,
        execution_enabled: false,
        accepted_for_execution: false,
        audit_event_id: null,
        blocked_reason: 'approval_state_not_approved',
        next_action: 'Owner must approve the request before dispatch.',
      })
    }

    const existingRun = db.prepare(
      `SELECT id, run_state FROM bridge_connector_runs
        WHERE approval_request_id = ?
        ORDER BY created_at DESC LIMIT 1`,
    ).get(approval.id) as { id: string; run_state: string } | undefined

    if (existingRun && (existingRun.run_state === 'running' || TERMINAL_RUN_STATES.has(existingRun.run_state))) {
      return response({
        ok: false,
        http_status: 409,
        mode: 'run_now_dispatch_blocked',
        approval_id: input.approvalId,
        run_id: existingRun.id,
        run_state: existingRun.run_state,
        execution_enabled: false,
        accepted_for_execution: false,
        audit_event_id: null,
        blocked_reason: 'run_already_dispatched',
        next_action: 'Each approval id may dispatch the service at most once. Create a new run-now request to start another run.',
      })
    }

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
    return response({
      ok: false,
      http_status: 500,
      mode: 'run_now_dispatch_blocked',
      approval_id: input.approvalId,
      run_id: null,
      run_state: null,
      execution_enabled: false,
      accepted_for_execution: false,
      audit_event_id: null,
      blocked_reason: error instanceof Error ? error.message.slice(0, 240) : 'dispatch_preflight_failed',
      next_action: 'Fix dispatch preflight before retrying.',
    })
  } finally {
    try {
      db?.close()
    } catch {
      /* noop */
    }
  }

  const result = await (input.runner || runBuildWikiSystemctlStart)()
  let auditWriteError: string | null = null

  let db2: Database.Database | null = null
  try {
    db2 = new Database(dbPath, { fileMustExist: true })
    db2.pragma('foreign_keys = ON')
    const outcome = result.ok ? 'completed' : 'failed'
    const newRunState = result.ok ? 'completed' : 'failed'
    const finishedAt = nowIsoZ()
    const requester = input.requester.username || 'mission-control'

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
        input.requester.userId,
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
          accepted_for_execution: true,
          run_id: runId,
          systemctl_exit_code: result.exitCode,
          systemctl_signal: result.signal,
          stderr_tail_present: Boolean(result.stderr),
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
    return response({
      ok: false,
      http_status: 502,
      mode: 'run_now_dispatched_failed',
      approval_id: input.approvalId,
      run_id: runId,
      run_state: 'failed',
      systemctl_exit_code: result.exitCode,
      systemctl_signal: result.signal,
      stderr_tail: result.stderr.slice(-400),
      execution_enabled: true,
      accepted_for_execution: true,
      writes_enabled: true,
      audit_event_id: dispatchAuditId,
      audit_write_error: auditWriteError,
      blocked_reason: 'buildwiki_run_now_systemctl_failed',
      next_action: 'Check the local service/timer status before retrying.',
    })
  }

  return response({
    ok: true,
    http_status: 200,
    mode: 'run_now_dispatched_completed',
    approval_id: input.approvalId,
    run_id: runId,
    run_state: 'completed',
    systemctl_exit_code: result.exitCode,
    execution_enabled: true,
    accepted_for_execution: true,
    writes_enabled: true,
    audit_event_id: dispatchAuditId,
    audit_write_error: auditWriteError,
    blocked_reason: null,
    next_action: 'Service ran to completion. Use /status to see refreshed raw/wiki counts.',
  })
}
