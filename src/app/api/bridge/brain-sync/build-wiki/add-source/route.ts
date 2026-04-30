import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { requireRole } from '@/lib/auth'
import { ownerApprovalRequired } from '@/lib/designer-module-api'
import { config } from '@/lib/config'
import { approvalPersistenceReady } from '@/lib/build-wiki-run-now'
import {
  ADD_SOURCE_PUBLIC_VIEW,
  BUILDWIKI_ACTION_ADD_LOCAL_SOURCE,
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_PROTECTED_CATEGORY,
  BUILDWIKI_REQUIRED_APPROVER,
  BUILDWIKI_RISK_LEVEL,
  BUILDWIKI_TARGET_FARMER_SCRIPT,
  deriveAddSourceUiState,
  planAddSource,
  readLatestAddSource,
} from '@/lib/build-wiki-add-source'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// POST /api/bridge/brain-sync/build-wiki/add-source
//   Body: { path: string, reason?: string }
//
// Validates the proposed local source path, builds a unified-diff preview of
// the SOURCES=() block change, and creates a bridge_approval_requests row
// pinned to action=buildwiki.add_local_source. No script writes happen here.
//
// GET — returns the latest add-source approval state.
// ---------------------------------------------------------------------------

const REQUEST_REASON_DEFAULT =
  'Owner-initiated add of a new local docs source folder to the OpenCloud Build-Wiki farmer (atomic write, rollback backup, no execution).'

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

function hashScope(approvalScopeJson: string, workspaceId: number, tenantId: number, targetKey: string): string {
  return createHash('sha256')
    .update([
      workspaceId,
      tenantId,
      BUILDWIKI_CONNECTOR,
      BUILDWIKI_ACTION_ADD_LOCAL_SOURCE,
      targetKey,
      approvalScopeJson,
    ].join('|'))
    .digest('hex')
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const latest = readLatestAddSource()
  const ui = deriveAddSourceUiState(latest.approval, latest.run)
  let proposedPath: string | null = null
  if (latest.approval && latest.approval.target_key) proposedPath = latest.approval.target_key

  return NextResponse.json(
    {
      ok: true,
      mode: 'add_source_read_only',
      generated_at: new Date().toISOString(),
      target_script: BUILDWIKI_TARGET_FARMER_SCRIPT,
      persistence_ready: latest.persistence_ready,
      ui_state: ui.ui_state,
      is_terminal: ui.is_terminal,
      latest_proposed_path: proposedPath,
      approval: ADD_SOURCE_PUBLIC_VIEW.pickApproval(latest.approval),
      run: ADD_SOURCE_PUBLIC_VIEW.pickRun(latest.run),
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
  const proposedRaw = String(body.path || '').slice(0, 1024)

  // Plan first (validate + build diff). Cheaper than DB work — refuse early
  // if the path is bad.
  const plan = await planAddSource(proposedRaw)
  if (!plan.validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'add_source_validation_failed',
        approval_request_created: false,
        error: plan.validation.reason_code || 'invalid_path',
        reason: plan.validation.reason,
        proposed_path: plan.validation.proposed_path,
        resolved_path: plan.validation.resolved_path,
      },
      { status: 400 },
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
        action: BUILDWIKI_ACTION_ADD_LOCAL_SOURCE,
        approval_request_created: false,
        accepted_for_execution: false,
      })
    }

    // Refuse stacking: only one in-flight add-source request at a time.
    const existing = db
      .prepare(
        `SELECT id, approval_state, target_key
           FROM bridge_approval_requests
          WHERE connector = ? AND action = ?
            AND approval_state IN ('pending', 'approved')
          ORDER BY created_at DESC LIMIT 1`,
      )
      .get(BUILDWIKI_CONNECTOR, BUILDWIKI_ACTION_ADD_LOCAL_SOURCE) as
        { id: string; approval_state: string; target_key: string } | undefined

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
            mode: 'add_source_in_flight',
            approval_request_created: false,
            approval_id: existing.id,
            existing_path: existing.target_key,
            error: 'in_flight_request_exists',
            next_action: 'A previous add-source request is pending. Approve, deny, or wait for it before creating a new one.',
          },
          { status: 409 },
        )
      }
      if (existing.approval_state === 'approved' && !runTerminal) {
        return NextResponse.json(
          {
            ok: false,
            mode: 'add_source_dispatch_pending',
            approval_request_created: false,
            approval_id: existing.id,
            existing_path: existing.target_key,
            error: 'dispatch_pending_for_existing_approval',
            next_action: 'A previous add-source request is approved and awaiting dispatch. Dispatch or revoke it first.',
          },
          { status: 409 },
        )
      }
      // approved + terminal run → fall through, allow new
    }

    const workspaceId = auth.user.workspace_id || 1
    const tenantId = auth.user.tenant_id || 1
    const approvalId = `apr_${randomUUID()}`
    const auditId = `audit_${randomUUID()}`
    const correlationId = `corr_buildwiki_add_source_${randomUUID()}`
    const requester = auth.user.username || auth.user.display_name || 'mission-control'
    const requesterUserId = realUserIdOrNull(db, auth.user.id)
    const reason = String(body.reason || REQUEST_REASON_DEFAULT).trim().slice(0, 500) || REQUEST_REASON_DEFAULT
    const proposedPath = plan.validation.proposed_path
    const resolvedPath = plan.validation.resolved_path!
    const targetKey = resolvedPath  // use the realpath as the canonical id

    const approvalScopeJson = stableJson({
      proposed_path: proposedPath,
      resolved_path: resolvedPath,
      farmer_script: plan.farmer_script_path,
      backup_dir: plan.backup_dir,
      current_sources: plan.current_sources,
      next_sources: plan.next_sources,
      diff_preview: plan.diff_preview,
      no_farmer_run_on_apply: true,
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
        BUILDWIKI_ACTION_ADD_LOCAL_SOURCE,
        BUILDWIKI_TARGET_FARMER_SCRIPT,
        targetKey,
        requester,
        requesterUserId,
        BUILDWIKI_RISK_LEVEL,
        BUILDWIKI_PROTECTED_CATEGORY,
        approvalScopeJson,
        hashScope(approvalScopeJson, workspaceId, tenantId, targetKey),
        reason,
        BUILDWIKI_REQUIRED_APPROVER,
        'restore opencloud-docs-farmer.sh from the timestamped backup written under farmers/_backups/',
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
        BUILDWIKI_ACTION_ADD_LOCAL_SOURCE,
        BUILDWIKI_TARGET_FARMER_SCRIPT,
        targetKey,
        createHash('sha256').update(approvalScopeJson).digest('hex'),
        stableJson({
          source: 'mission-control',
          add_source_endpoint: '/api/bridge/brain-sync/build-wiki/add-source',
          target_script: BUILDWIKI_TARGET_FARMER_SCRIPT,
          proposed_path: proposedPath,
          resolved_path: resolvedPath,
          execution_enabled: false,
          approval_request_created: true,
        }),
        correlationId,
      )
    })()

    return NextResponse.json(
      {
        ok: true,
        mode: 'add_source_request_created_no_execution',
        approval_request_created: true,
        approval_id: approvalId,
        approval_state: 'pending',
        target_script: BUILDWIKI_TARGET_FARMER_SCRIPT,
        proposed_path: proposedPath,
        resolved_path: resolvedPath,
        diff_preview: plan.diff_preview,
        current_sources_count: (plan.current_sources || []).length,
        next_sources_count: (plan.next_sources || []).length,
        execution_enabled: false,
        accepted_for_execution: false,
        ui_state: 'pending_approval',
        next_action: `Owner must POST /api/bridge/approval-requests/${approvalId}/approve before dispatch can edit ${BUILDWIKI_TARGET_FARMER_SCRIPT}.`,
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 240) : 'add_source_request_failed',
        approval_request_created: false,
        execution_enabled: false,
      },
      { status: 500 },
    )
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}
