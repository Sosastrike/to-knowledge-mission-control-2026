import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
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

export const BUILDWIKI_RUN_NOW_APPROVAL_SCOPE = {
  action: BUILDWIKI_ACTION_RUN_NOW,
  connector: BUILDWIKI_CONNECTOR,
  target_service: BUILDWIKI_TARGET_SERVICE,
  command: ['systemctl', '--user', 'start', BUILDWIKI_TARGET_SERVICE],
  fork: 'fork_1_only',
  no_smb: true,
  no_fork_2: true,
  no_external_farmers: true,
  no_second_vault: true,
  no_immediate_execution: true,
}

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

export type BuildWikiRunNowAuditEventRow = {
  id: string
  approval_request_id: string | null
  actor: string
  actor_user_id: number | null
  connector: string
  action: string
  target: string | null
  target_key: string
  outcome: string
  correlation_id: string
  created_at: string
}

export type BuildWikiRunNowRequester = {
  userId: number | null
  username: string
  workspaceId: number
  tenantId: number
}

export type BuildWikiRunNowApprovalResult = {
  ok: boolean
  http_status: number
  persistence_ready: boolean
  approval_request_created: boolean
  reused_existing: boolean
  approval: ApprovalRow | null
  audit_event_id: string | null
  ui_state: 'idle' | 'pending_approval' | 'denied' | 'approved' | 'dispatching' | 'completed' | 'failed' | 'expired'
  is_terminal: boolean
  execution_enabled: false
  accepted_for_execution: false
  writes_enabled: false
  blocked_reason: string | null
  next_action: string
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

export function createBuildWikiRunNowApproval(input: {
  db: Database.Database
  requester: BuildWikiRunNowRequester
  reason?: string
  idempotencyKey?: string | null
  now?: Date
}): BuildWikiRunNowApprovalResult {
  const { db, requester } = input
  const now = input.now || new Date()
  const nowIso = now.toISOString()

  if (!approvalPersistenceReady(db)) {
    return {
      ok: false,
      http_status: 503,
      persistence_ready: false,
      approval_request_created: false,
      reused_existing: false,
      approval: null,
      audit_event_id: null,
      ui_state: 'idle',
      is_terminal: true,
      execution_enabled: false,
      accepted_for_execution: false,
      writes_enabled: false,
      blocked_reason: 'approval_persistence_not_applied',
      next_action: 'Apply Bridge approval/audit/run persistence before creating Build-Wiki Run Now approvals.',
    }
  }

  const existing = db
    .prepare(
      `SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
              requester, requester_user_id, risk_level, approval_state,
              protected_category, reason, required_approver, expires_at,
              resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
              correlation_id, idempotency_key, created_at
         FROM bridge_approval_requests
        WHERE workspace_id = ?
          AND tenant_id = ?
          AND connector = ?
          AND action = ?
          AND target_key = ?
          AND approval_state = 'pending'
          AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY created_at DESC
        LIMIT 1`,
    )
    .get(
      requester.workspaceId,
      requester.tenantId,
      BUILDWIKI_CONNECTOR,
      BUILDWIKI_ACTION_RUN_NOW,
      BUILDWIKI_TARGET_KEY,
      nowIso,
    ) as ApprovalRow | undefined

  if (existing) {
    return {
      ok: true,
      http_status: 200,
      persistence_ready: true,
      approval_request_created: false,
      reused_existing: true,
      approval: existing,
      audit_event_id: null,
      ui_state: 'pending_approval',
      is_terminal: false,
      execution_enabled: false,
      accepted_for_execution: false,
      writes_enabled: false,
      blocked_reason: null,
      next_action: 'Existing pending Build-Wiki Run Now approval is waiting for owner approval.',
    }
  }

  const id = `apr_${randomUUID()}`
  const auditId = `audit_${randomUUID()}`
  const correlationId = `corr_buildwiki_run_now_${randomUUID()}`
  const approvalScopeJson = stableJson(BUILDWIKI_RUN_NOW_APPROVAL_SCOPE)
  const scopeHash = createHash('sha256').update([
    requester.workspaceId,
    requester.tenantId,
    BUILDWIKI_CONNECTOR,
    BUILDWIKI_ACTION_RUN_NOW,
    BUILDWIKI_TARGET_KEY,
    approvalScopeJson,
  ].join('|')).digest('hex')
  const reason = String(input.reason || 'Owner requested Build-Wiki/Farmer Run Now.').slice(0, 500)
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString()
  const idempotencyKey = input.idempotencyKey || `buildwiki.run_now:${requester.workspaceId}:${requester.tenantId}:${nowIso.slice(0, 16)}`

  db.transaction(() => {
    db.prepare(
      `INSERT INTO bridge_approval_requests (
         id, workspace_id, tenant_id, connector, action, target, target_key,
         requester, requester_user_id, risk_level, approval_state,
         protected_category, approval_scope_json, scope_hash, reason,
         required_approver, rollback_available, rollback_ref, expires_at,
         correlation_id, idempotency_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    ).run(
      id,
      requester.workspaceId,
      requester.tenantId,
      BUILDWIKI_CONNECTOR,
      BUILDWIKI_ACTION_RUN_NOW,
      BUILDWIKI_TARGET_SERVICE,
      BUILDWIKI_TARGET_KEY,
      requester.username,
      requester.userId,
      BUILDWIKI_RISK_LEVEL,
      BUILDWIKI_PROTECTED_CATEGORY,
      approvalScopeJson,
      scopeHash,
      reason,
      BUILDWIKI_REQUIRED_APPROVER,
      BUILDWIKI_ROLLBACK_REF,
      expiresAt,
      correlationId,
      idempotencyKey,
    )

    db.prepare(
      `INSERT INTO bridge_audit_events (
         id, workspace_id, tenant_id, approval_request_id, actor, actor_user_id,
         connector, action, target, target_key, outcome, payload_hash,
         rollback_ref, metadata_json, correlation_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approval_requested', ?, ?, ?, ?)`,
    ).run(
      auditId,
      requester.workspaceId,
      requester.tenantId,
      id,
      requester.username,
      requester.userId,
      BUILDWIKI_CONNECTOR,
      BUILDWIKI_ACTION_RUN_NOW,
      BUILDWIKI_TARGET_SERVICE,
      BUILDWIKI_TARGET_KEY,
      createHash('sha256').update(approvalScopeJson).digest('hex'),
      BUILDWIKI_ROLLBACK_REF,
      stableJson({
        source: 'mission-control',
        scope: BUILDWIKI_RUN_NOW_APPROVAL_SCOPE,
        approval_request_created: true,
        execution_enabled: false,
        accepted_for_execution: false,
      }),
      correlationId,
    )
  })()

  const approval = db
    .prepare(
      `SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
              requester, requester_user_id, risk_level, approval_state,
              protected_category, reason, required_approver, expires_at,
              resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
              correlation_id, idempotency_key, created_at
         FROM bridge_approval_requests
        WHERE id = ? LIMIT 1`,
    )
    .get(id) as ApprovalRow

  return {
    ok: true,
    http_status: 201,
    persistence_ready: true,
    approval_request_created: true,
    reused_existing: false,
    approval,
    audit_event_id: auditId,
    ui_state: 'pending_approval',
    is_terminal: false,
    execution_enabled: false,
    accepted_for_execution: false,
    writes_enabled: false,
    blocked_reason: null,
    next_action: 'Owner must approve this exact buildwiki.run_now request before dispatching opencloud-docs-farmer.service.',
  }
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

export function readRunNowHistory(limit = 10): {
  persistence_ready: boolean
  history: Array<{
    approval: ReturnType<typeof pickPublicApprovalView>
    run: ReturnType<typeof pickPublicRunView>
    audit_events: ReturnType<typeof pickPublicRunNowAuditEventView>[]
    ui_state: ReturnType<typeof deriveRunNowUiState>['ui_state']
    is_terminal: boolean
    result_label: string
  }>
} {
  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { readonly: true, fileMustExist: true })
    if (!approvalPersistenceReady(db)) {
      return { persistence_ready: false, history: [] }
    }

    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 10, 1), 25)
    const approvals = db
      .prepare(
        `SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
                requester, requester_user_id, risk_level, approval_state,
                protected_category, reason, required_approver, expires_at,
                resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
                correlation_id, idempotency_key, created_at
           FROM bridge_approval_requests
          WHERE connector = ? AND action = ? AND target_key = ?
          ORDER BY created_at DESC
          LIMIT ?`,
      )
      .all(
        BUILDWIKI_CONNECTOR,
        BUILDWIKI_ACTION_RUN_NOW,
        BUILDWIKI_TARGET_KEY,
        safeLimit,
      ) as ApprovalRow[]

    if (approvals.length === 0) {
      return { persistence_ready: true, history: [] }
    }

    const approvalIds = approvals.map((approval) => approval.id)
    const placeholders = approvalIds.map(() => '?').join(',')
    const runs = db
      .prepare(
        `SELECT id, approval_request_id, audit_event_id, run_state, started_at,
                finished_at, output_hash, rollback_ref, correlation_id
           FROM bridge_connector_runs
          WHERE approval_request_id IN (${placeholders})
          ORDER BY created_at DESC`,
      )
      .all(...approvalIds) as ConnectorRunRow[]
    const auditEvents = db
      .prepare(
        `SELECT id, approval_request_id, actor, actor_user_id, connector, action,
                target, target_key, outcome, correlation_id, created_at
           FROM bridge_audit_events
          WHERE approval_request_id IN (${placeholders})
          ORDER BY created_at ASC`,
      )
      .all(...approvalIds) as BuildWikiRunNowAuditEventRow[]

    const latestRunByApproval = new Map<string, ConnectorRunRow>()
    for (const run of runs) {
      if (!latestRunByApproval.has(run.approval_request_id)) {
        latestRunByApproval.set(run.approval_request_id, run)
      }
    }

    const auditEventsByApproval = new Map<string, BuildWikiRunNowAuditEventRow[]>()
    for (const event of auditEvents) {
      if (!event.approval_request_id) continue
      const current = auditEventsByApproval.get(event.approval_request_id) || []
      current.push(event)
      auditEventsByApproval.set(event.approval_request_id, current)
    }

    return {
      persistence_ready: true,
      history: approvals.map((approval) => {
        const run = latestRunByApproval.get(approval.id) || null
        const ui = deriveRunNowUiState(approval, run)
        return {
          approval: pickPublicApprovalView(approval),
          run: pickPublicRunView(run),
          audit_events: (auditEventsByApproval.get(approval.id) || []).map(pickPublicRunNowAuditEventView),
          ui_state: ui.ui_state,
          is_terminal: ui.is_terminal,
          result_label: runNowResultLabel(ui.ui_state, run),
        }
      }),
    }
  } catch {
    return { persistence_ready: false, history: [] }
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
    connector: approval.connector,
    action: approval.action,
    target: approval.target,
    target_key: approval.target_key,
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

export function pickPublicRunNowAuditEventView(event: BuildWikiRunNowAuditEventRow) {
  return {
    id: event.id,
    actor: event.actor,
    connector: event.connector,
    action: event.action,
    target: event.target,
    target_key: event.target_key,
    outcome: event.outcome,
    correlation_id: event.correlation_id,
    created_at: event.created_at,
  }
}

function stableJson(value: unknown): string {
  if (!value || typeof value !== 'object') return '{}'
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort())
}

function runNowResultLabel(
  uiState: ReturnType<typeof deriveRunNowUiState>['ui_state'],
  run: ConnectorRunRow | null,
): string {
  if (run?.run_state === 'completed' || run?.run_state === 'success') return 'run dispatched / completed'
  if (run?.run_state === 'failed' || run?.run_state === 'error') return 'service_down'
  switch (uiState) {
    case 'pending_approval':
      return 'approval pending'
    case 'approved':
      return 'approved / dispatch available'
    case 'dispatching':
      return 'run dispatched'
    case 'denied':
      return 'approval denied'
    case 'expired':
      return 'approval expired'
    case 'completed':
      return 'run dispatched / completed'
    case 'failed':
      return 'service_down'
    default:
      return 'request run'
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
