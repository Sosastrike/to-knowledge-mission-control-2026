import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { requireRole } from '@/lib/auth'
import { ownerApprovalRequired } from '@/lib/designer-module-api'
import { config } from '@/lib/config'
import {
  BUILDWIKI_ACTION_RUN_NOW,
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_PROTECTED_CATEGORY,
  BUILDWIKI_REQUIRED_APPROVER,
  BUILDWIKI_RISK_LEVEL,
  BUILDWIKI_ROLLBACK_REF,
  BUILDWIKI_TARGET_KEY,
  BUILDWIKI_TARGET_SERVICE,
  approvalPersistenceReady,
  deriveRunNowUiState,
  pickPublicApprovalView,
  pickPublicRunView,
  readLatestRunNow,
} from '@/lib/build-wiki-run-now'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// POST /api/bridge/brain-sync/build-wiki/run-now
//
// Creates an approval request for action `buildwiki.run_now` with target hard-
// coded to opencloud-docs-farmer.service. Returns the approval id immediately;
// no service is started here. The dispatcher endpoint
// (POST /api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch) is the only
// surface that can actually call systemctl, and it will reject any approval
// row whose action/target does not match these constants exactly.
//
// GET on the same route returns the latest run-now state — convenient when
// the UI needs the read view without going through the heavier /status route.
// ---------------------------------------------------------------------------

const REQUEST_REASON_DEFAULT =
  'Owner-initiated manual run of the OpenCloud Build-Wiki local docs farmer (oneshot, append-only, no network egress).'

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
  approvalScopeJson: string
}): string {
  return createHash('sha256')
    .update([
      input.workspaceId,
      input.tenantId,
      BUILDWIKI_CONNECTOR,
      BUILDWIKI_ACTION_RUN_NOW,
      BUILDWIKI_TARGET_KEY,
      input.approvalScopeJson,
    ].join('|'))
    .digest('hex')
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const latest = readLatestRunNow()
  const ui = deriveRunNowUiState(latest.approval, latest.run)

  return NextResponse.json(
    {
      ok: true,
      mode: 'run_now_read_only',
      generated_at: new Date().toISOString(),
      persistence_ready: latest.persistence_ready,
      target_service: BUILDWIKI_TARGET_SERVICE,
      ui_state: ui.ui_state,
      is_terminal: ui.is_terminal,
      approval: pickPublicApprovalView(latest.approval),
      run: pickPublicRunView(latest.run),
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
  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { fileMustExist: true })
    db.pragma('foreign_keys = ON')

    if (!approvalPersistenceReady(db)) {
      return ownerApprovalRequired({
        reason: 'approval_persistence_not_applied',
        current_state: 'OWNER_APPROVAL_REQUIRED',
        http_status_when_blocked: 423,
        connector: BUILDWIKI_CONNECTOR,
        action: BUILDWIKI_ACTION_RUN_NOW,
        target: BUILDWIKI_TARGET_SERVICE,
        approval_request_created: false,
        accepted_for_execution: false,
        next_action:
          'Apply the owner-approved bridge approval/audit migration before creating run-now requests.',
      })
    }

    // Refuse a duplicate IN-FLIGHT request only:
    //   pending                       — owner hasn't decided yet
    //   approved + no dispatch row    — owner has decided, ready to fire
    //   approved + run='running'      — currently executing
    // Approved + terminal run (completed | failed | success | error) means the
    // request fully ran and is now historical — a new request is allowed.
    const existing = db
      .prepare(
        `SELECT id, approval_state
           FROM bridge_approval_requests
          WHERE connector = ? AND action = ? AND target_key = ?
            AND approval_state IN ('pending', 'approved')
          ORDER BY created_at DESC
          LIMIT 1`,
      )
      .get(
        BUILDWIKI_CONNECTOR,
        BUILDWIKI_ACTION_RUN_NOW,
        BUILDWIKI_TARGET_KEY,
      ) as { id: string; approval_state: string } | undefined

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
            mode: 'run_now_request_in_flight',
            approval_request_created: false,
            approval_id: existing.id,
            approval_state: 'pending',
            error: 'in_flight_request_exists',
            next_action: 'A run-now request is already pending owner approval. Approve, deny, or wait for it to expire before creating a new one.',
          },
          { status: 409 },
        )
      }

      if (existing.approval_state === 'approved' && !runTerminal) {
        if (runRow && runRow.run_state === 'running') {
          return NextResponse.json(
            {
              ok: false,
              mode: 'run_now_request_in_flight',
              approval_request_created: false,
              approval_id: existing.id,
              approval_state: 'approved',
              run_state: 'running',
              error: 'dispatch_in_progress',
              next_action: 'A previous run is currently executing. Wait for it to finish.',
            },
            { status: 409 },
          )
        }
        return NextResponse.json(
          {
            ok: true,
            mode: 'run_now_request_reused',
            approval_request_created: false,
            approval_id: existing.id,
            approval_state: 'approved',
            execution_enabled: false,
            next_action: 'Approval already granted. Call POST /run-now/{id}/dispatch to start the service.',
          },
          { status: 200 },
        )
      }
      // approved + terminal run → fall through to create a new request
    }

    const workspaceId = auth.user.workspace_id || 1
    const tenantId = auth.user.tenant_id || 1
    const approvalId = `apr_${randomUUID()}`
    const auditId = `audit_${randomUUID()}`
    const correlationId = `corr_buildwiki_run_now_${randomUUID()}`
    const requester = auth.user.username || auth.user.display_name || 'mission-control'
    const requesterUserId = realUserIdOrNull(db, auth.user.id)
    const reason = String(body.reason || REQUEST_REASON_DEFAULT).trim().slice(0, 500) || REQUEST_REASON_DEFAULT
    const approvalScopeJson = stableJson({
      service: BUILDWIKI_TARGET_SERVICE,
      command: `systemctl --user start ${BUILDWIKI_TARGET_SERVICE}`,
      farmer: 'opencloud-docs-farmer',
      cap: 'per-run cap of 3 raw drops; recency window 1 day; no network egress',
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
        BUILDWIKI_ACTION_RUN_NOW,
        BUILDWIKI_TARGET_SERVICE,
        BUILDWIKI_TARGET_KEY,
        requester,
        requesterUserId,
        BUILDWIKI_RISK_LEVEL,
        BUILDWIKI_PROTECTED_CATEGORY,
        approvalScopeJson,
        hashScope({ workspaceId, tenantId, approvalScopeJson }),
        reason,
        BUILDWIKI_REQUIRED_APPROVER,
        BUILDWIKI_ROLLBACK_REF,
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
        BUILDWIKI_ACTION_RUN_NOW,
        BUILDWIKI_TARGET_SERVICE,
        BUILDWIKI_TARGET_KEY,
        createHash('sha256').update(approvalScopeJson).digest('hex'),
        stableJson({
          source: 'mission-control',
          run_now_endpoint: '/api/bridge/brain-sync/build-wiki/run-now',
          target_service: BUILDWIKI_TARGET_SERVICE,
          execution_enabled: false,
          approval_request_created: true,
        }),
        correlationId,
      )
    })()

    return NextResponse.json(
      {
        ok: true,
        mode: 'run_now_request_created_no_execution',
        approval_request_created: true,
        approval_id: approvalId,
        approval_state: 'pending',
        target_service: BUILDWIKI_TARGET_SERVICE,
        execution_enabled: false,
        accepted_for_execution: false,
        ui_state: 'pending_approval',
        next_action: `Owner must POST /api/bridge/approval-requests/${approvalId}/approve before dispatch can start ${BUILDWIKI_TARGET_SERVICE}.`,
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 240) : 'run_now_request_failed',
        approval_request_created: false,
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
}
