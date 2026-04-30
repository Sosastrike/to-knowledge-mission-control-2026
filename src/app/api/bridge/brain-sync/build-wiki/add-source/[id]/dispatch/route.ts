import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import {
  ApprovalRow,
  approvalPersistenceReady,
} from '@/lib/build-wiki-run-now'
import {
  BUILDWIKI_ACTION_ADD_LOCAL_SOURCE,
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_TARGET_FARMER_SCRIPT,
  applyAddSource,
} from '@/lib/build-wiki-add-source'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

// ---------------------------------------------------------------------------
// POST /api/bridge/brain-sync/build-wiki/add-source/[id]/dispatch
//
// The ONLY surface that edits opencloud-docs-farmer.sh. Hard guards:
//   - operator role
//   - approval_state === 'approved'
//   - connector === skill.build_wiki
//     AND action === buildwiki.add_local_source
//     AND target === opencloud-docs-farmer.sh
//   - no existing run row in running/completed/failed/success state
//
// The proposed path is read from the approval row's `approval_scope_json`
// (resolved_path field) — the dispatch handler RE-VALIDATES it against the
// same allowlist + denylist + already-wired check, so a path that was added
// to SOURCES manually between approval and dispatch will be caught.
//
// applyAddSource() copies the current script to a timestamped backup,
// writes a tmp file, runs `bash -n` on it, atomically renames into place,
// re-runs `bash -n` on the deployed file, and restores from backup if the
// post-swap syntax check fails.
//
// The farmer is NOT executed by this endpoint — the next scheduled timer
// fire will pick up the new source naturally.
// ---------------------------------------------------------------------------

const TERMINAL_RUN_STATES = new Set(['completed', 'success', 'failed', 'error'])

function nowIsoZ(): string {
  return new Date().toISOString()
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const { id } = await params

  let db: Database.Database | null = null
  let approval: (ApprovalRow & { approval_scope_json?: string }) | undefined
  let workspaceId = 1
  let tenantId = 1
  let correlationId = `corr_dispatch_${randomUUID()}`
  const runId = `run_${randomUUID()}`
  const dispatchAuditId = `audit_${randomUUID()}`
  let resolvedPath = ''

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
                correlation_id, idempotency_key, created_at, approval_scope_json
           FROM bridge_approval_requests
          WHERE id = ? LIMIT 1`,
      )
      .get(id) as (ApprovalRow & { approval_scope_json?: string }) | undefined

    if (!approval) {
      return NextResponse.json({ ok: false, error: 'approval_request_not_found', approval_id: id }, { status: 404 })
    }
    if (
      approval.connector !== BUILDWIKI_CONNECTOR ||
      approval.action !== BUILDWIKI_ACTION_ADD_LOCAL_SOURCE ||
      approval.target !== BUILDWIKI_TARGET_FARMER_SCRIPT
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'approval_request_out_of_scope',
          approval_id: id,
          expected_connector: BUILDWIKI_CONNECTOR,
          expected_action: BUILDWIKI_ACTION_ADD_LOCAL_SOURCE,
          expected_target: BUILDWIKI_TARGET_FARMER_SCRIPT,
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

    let scope: Record<string, unknown>
    try {
      scope = JSON.parse(approval.approval_scope_json || '{}') as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { ok: false, error: 'approval_scope_unparseable', approval_id: id, execution_enabled: false },
        { status: 422 },
      )
    }
    resolvedPath = String(scope.resolved_path || '')
    if (!resolvedPath || resolvedPath !== approval.target_key) {
      return NextResponse.json(
        {
          ok: false,
          error: 'approval_scope_path_mismatch',
          approval_id: id,
          execution_enabled: false,
        },
        { status: 422 },
      )
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
      BUILDWIKI_ACTION_ADD_LOCAL_SOURCE,
      BUILDWIKI_TARGET_FARMER_SCRIPT,
      approval.target_key,
      approval.id,
      approval.risk_level || 'low',
      createHash('sha256').update(resolvedPath).digest('hex'),
      'restore opencloud-docs-farmer.sh from the timestamped backup written under farmers/_backups/',
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

  // Apply outside the DB transaction.
  const result = await applyAddSource(resolvedPath)

  // Persist outcome — audit first (FK-correct), then update the run row.
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
        BUILDWIKI_ACTION_ADD_LOCAL_SOURCE,
        BUILDWIKI_TARGET_FARMER_SCRIPT,
        approval!.target_key,
        outcome,
        createHash('sha256').update(`${resolvedPath}|${result.ok ? 'ok' : 'fail'}`).digest('hex'),
        JSON.stringify({
          source: 'mission-control',
          dispatch_endpoint: '/api/bridge/brain-sync/build-wiki/add-source/[id]/dispatch',
          target_script: BUILDWIKI_TARGET_FARMER_SCRIPT,
          execution_enabled: true,
          run_id: runId,
          inserted_source: result.inserted_source || null,
          backup_path: result.backup_path || null,
          script_path: result.script_path || null,
          result_reason: result.reason || null,
          result_reason_code: result.reason_code || null,
          syntax_stderr: result.syntax_stderr || null,
          finished_at: finishedAt,
        }),
        correlationId,
      )
      db2!.prepare(
        `UPDATE bridge_connector_runs
            SET run_state = ?, finished_at = ?, audit_event_id = ?,
                rollback_ref = ?, output_hash = ?
          WHERE id = ?`,
      ).run(
        newRunState,
        finishedAt,
        dispatchAuditId,
        result.backup_path
          ? `cp ${result.backup_path} ${result.script_path || BUILDWIKI_TARGET_FARMER_SCRIPT}`
          : 'no backup written',
        createHash('sha256').update(JSON.stringify({ inserted: result.inserted_source, ok: result.ok })).digest('hex'),
        runId,
      )
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
        mode: 'add_source_dispatched_failed',
        approval_id: id,
        run_id: runId,
        run_state: 'failed',
        target_script: BUILDWIKI_TARGET_FARMER_SCRIPT,
        proposed_path: resolvedPath,
        backup_path: result.backup_path || null,
        reason: result.reason,
        reason_code: result.reason_code,
        syntax_stderr: result.syntax_stderr || null,
        execution_enabled: true,
        audit_write_error: auditWriteError,
      },
      { status: 502 },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      mode: 'add_source_dispatched_completed',
      approval_id: id,
      run_id: runId,
      run_state: 'completed',
      target_script: BUILDWIKI_TARGET_FARMER_SCRIPT,
      inserted_source: result.inserted_source,
      backup_path: result.backup_path,
      script_path: result.script_path,
      execution_enabled: true,
      audit_write_error: auditWriteError,
      next_action: 'Source added. The next timer firing will pick it up; no farmer was started by this dispatch.',
    },
    { status: 200 },
  )
}
