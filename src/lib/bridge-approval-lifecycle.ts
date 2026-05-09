import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'

export type BridgeApprovalDecision = 'approved' | 'denied'

export type BridgeApprovalLifecycleRequester = {
  userId: number | null
  username: string
  workspaceId: number
  tenantId: number
}

export type BridgeApprovalLifecycleRow = {
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
  approval_scope_json: string
  scope_hash: string
  reason: string | null
  required_approver: string
  rollback_available: number
  rollback_ref: string | null
  expires_at: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolved_by_user_id: number | null
  resolution_reason: string | null
  correlation_id: string
  idempotency_key: string | null
  created_at: string
}

export type BridgeApprovalResolveResult = {
  ok: boolean
  http_status: number
  approval_request: BridgeApprovalLifecycleRow | null
  approval_state: string | null
  decision: BridgeApprovalDecision | 'expired' | null
  audit_event_id: string | null
  accepted_for_execution: false
  execution_enabled: false
  writes_enabled: false
  blocked_reason: string | null
  next_action: string
}

export function bridgeApprovalLifecyclePersistenceReady(db: Database.Database): boolean {
  return (
    tableExists(db, 'bridge_approval_requests') &&
    tableExists(db, 'bridge_audit_events')
  )
}

export function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(name) as { name?: string } | undefined
  return row?.name === name
}

export function readBridgeApprovalRequest(
  db: Database.Database,
  approvalId: string,
): BridgeApprovalLifecycleRow | null {
  const row = db
    .prepare(
      `SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
              requester, requester_user_id, risk_level, approval_state,
              protected_category, approval_scope_json, scope_hash, reason,
              required_approver, rollback_available, rollback_ref, expires_at,
              resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
              correlation_id, idempotency_key, created_at
         FROM bridge_approval_requests
        WHERE id = ? LIMIT 1`,
    )
    .get(approvalId) as BridgeApprovalLifecycleRow | undefined
  return row || null
}

export function resolveBridgeApprovalRequest(input: {
  db: Database.Database
  approvalId: string
  decision: BridgeApprovalDecision
  requester: BridgeApprovalLifecycleRequester
  reason?: string
  now?: Date
}): BridgeApprovalResolveResult {
  const { db, approvalId, decision, requester } = input
  const now = input.now || new Date()
  const nowIso = now.toISOString()

  if (!bridgeApprovalLifecyclePersistenceReady(db)) {
    return {
      ok: false,
      http_status: 503,
      approval_request: null,
      approval_state: null,
      decision: null,
      audit_event_id: null,
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      blocked_reason: 'approval_persistence_not_applied',
      next_action: 'Apply Bridge approval/audit persistence before resolving approval requests.',
    }
  }

  const row = readBridgeApprovalRequest(db, approvalId)
  if (!row) {
    return {
      ok: false,
      http_status: 404,
      approval_request: null,
      approval_state: null,
      decision: null,
      audit_event_id: null,
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      blocked_reason: 'approval_request_not_found',
      next_action: 'Create an approval request before resolving it.',
    }
  }

  if (row.approval_state !== 'pending') {
    return {
      ok: row.approval_state === decision,
      http_status: row.approval_state === decision ? 200 : 409,
      approval_request: row,
      approval_state: row.approval_state,
      decision: row.approval_state === 'approved' || row.approval_state === 'denied'
        ? row.approval_state
        : null,
      audit_event_id: null,
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      blocked_reason: row.approval_state === decision ? null : 'approval_request_already_resolved',
      next_action: row.approval_state === 'approved'
        ? 'Approval is already approved. Use the scoped dispatch route if this action has one.'
        : 'Approval is already resolved. Create a new request for another action.',
    }
  }

  if (row.expires_at && Date.parse(row.expires_at) <= now.getTime()) {
    const auditId = `audit_${randomUUID()}`
    db.transaction(() => {
      db.prepare(
        `UPDATE bridge_approval_requests
            SET approval_state = 'expired',
                resolved_at = ?,
                resolved_by = ?,
                resolved_by_user_id = ?,
                resolution_reason = 'expired_before_decision'
          WHERE id = ?`,
      ).run(nowIso, requester.username, requester.userId, approvalId)
      insertDecisionAudit(db, {
        auditId,
        row,
        requester,
        outcome: 'expired',
        reason: 'expired_before_decision',
      })
    })()

    const expired = readBridgeApprovalRequest(db, approvalId)
    return {
      ok: false,
      http_status: 409,
      approval_request: expired,
      approval_state: 'expired',
      decision: 'expired',
      audit_event_id: auditId,
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      blocked_reason: 'approval_request_expired',
      next_action: 'Create a fresh approval request with a valid expiration window.',
    }
  }

  const auditId = `audit_${randomUUID()}`
  const resolutionReason = String(input.reason || `${decision}_by_owner`).slice(0, 500)
  db.transaction(() => {
    db.prepare(
      `UPDATE bridge_approval_requests
          SET approval_state = ?,
              resolved_at = ?,
              resolved_by = ?,
              resolved_by_user_id = ?,
              resolution_reason = ?
        WHERE id = ?`,
    ).run(decision, nowIso, requester.username, requester.userId, resolutionReason, approvalId)
    insertDecisionAudit(db, {
      auditId,
      row,
      requester,
      outcome: decision,
      reason: resolutionReason,
    })
  })()

  const updated = readBridgeApprovalRequest(db, approvalId)
  return {
    ok: true,
    http_status: 200,
    approval_request: updated,
    approval_state: decision,
    decision,
    audit_event_id: auditId,
    accepted_for_execution: false,
    execution_enabled: false,
    writes_enabled: false,
    blocked_reason: null,
    next_action: decision === 'approved'
      ? 'Approval is approved. Use the exact scoped dispatch route; no broad execution is enabled.'
      : 'Approval is denied. The protected action must not execute.',
  }
}

function insertDecisionAudit(
  db: Database.Database,
  input: {
    auditId: string
    row: BridgeApprovalLifecycleRow
    requester: BridgeApprovalLifecycleRequester
    outcome: BridgeApprovalDecision | 'expired'
    reason: string
  },
) {
  db.prepare(
    `INSERT INTO bridge_audit_events (
       id, workspace_id, tenant_id, approval_request_id, actor, actor_user_id,
       connector, action, target, target_key, outcome, payload_hash,
       metadata_json, correlation_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.auditId,
    input.row.workspace_id,
    input.row.tenant_id,
    input.row.id,
    input.requester.username,
    input.requester.userId,
    input.row.connector,
    input.row.action,
    input.row.target,
    input.row.target_key,
    input.outcome,
    createHash('sha256').update(`${input.row.id}|${input.outcome}`).digest('hex'),
    JSON.stringify({
      source: 'mission-control',
      decision_surface: 'mission_control_owner_api',
      reason: input.reason,
      execution_enabled: false,
      accepted_for_execution: false,
      no_connector_writes_enabled: true,
    }),
    input.row.correlation_id,
  )
}
