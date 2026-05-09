import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { config } from './config'
import { tableExists, type BridgeApprovalLifecycleRow } from './bridge-approval-lifecycle'
import { ownerSafeStatusText } from './owner-status'

export type BridgeApprovalRequestStoreRequester = {
  userId: number | null
  username: string
  workspaceId: number
  tenantId: number
}

export type CreateBridgeApprovalRequestInput = {
  db?: Database.Database
  requester: BridgeApprovalRequestStoreRequester
  connector: string
  action: string
  target?: string | null
  targetKey: string
  riskLevel: 'low' | 'medium' | 'high'
  protectedCategory: string
  approvalScope: Record<string, unknown>
  reason: string
  rollbackAvailable?: boolean
  rollbackRef?: string | null
  expiresAt?: string | null
  idempotencyKey?: string | null
  correlationId?: string | null
}

export type CreateBridgeApprovalRequestResult = {
  ok: boolean
  http_status: number
  approval_request_created: boolean
  approval_request_reused: boolean
  approval_request: BridgeApprovalLifecycleRow | null
  approval_request_id: string | null
  approval_state: string | null
  audit_event_id: string | null
  blocked_reason: string | null
  next_action: string
}

function cleanText(value: unknown, fallback = ''): string {
  return ownerSafeStatusText(String(value ?? fallback).trim())?.slice(0, 500) || fallback
}

function stableJson(value: Record<string, unknown>): string {
  const ordered = Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
  return JSON.stringify(ordered)
}

function hashScope(input: {
  workspaceId: number
  tenantId: number
  connector: string
  action: string
  targetKey: string
  approvalScopeJson: string
}) {
  return createHash('sha256')
    .update([
      input.workspaceId,
      input.tenantId,
      input.connector,
      input.action,
      input.targetKey,
      input.approvalScopeJson,
    ].join('|'))
    .digest('hex')
}

function readApprovalRequest(db: Database.Database, id: string): BridgeApprovalLifecycleRow | null {
  const row = db.prepare(`
    SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
           requester, requester_user_id, risk_level, approval_state,
           protected_category, approval_scope_json, scope_hash, reason,
           required_approver, rollback_available, rollback_ref, expires_at,
           resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
           correlation_id, idempotency_key, created_at
      FROM bridge_approval_requests
     WHERE id = ?
     LIMIT 1
  `).get(id) as BridgeApprovalLifecycleRow | undefined
  return row || null
}

function realUserIdOrNull(db: Database.Database, value: unknown): number | null {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  if (!tableExists(db, 'users')) return null
  const row = db.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').get(id) as { id?: number } | undefined
  return row?.id || null
}

function unavailable(blockedReason: string): CreateBridgeApprovalRequestResult {
  return {
    ok: false,
    http_status: 503,
    approval_request_created: false,
    approval_request_reused: false,
    approval_request: null,
    approval_request_id: null,
    approval_state: null,
    audit_event_id: null,
    blocked_reason: blockedReason,
    next_action: 'Apply Bridge approval/audit persistence before creating approval requests.',
  }
}

export function createBridgeApprovalRequest(
  input: CreateBridgeApprovalRequestInput,
): CreateBridgeApprovalRequestResult {
  let ownedDb: Database.Database | null = null
  const db = input.db || (() => {
    ownedDb = new Database(config.dbPath, { fileMustExist: true })
    ownedDb.pragma('foreign_keys = ON')
    return ownedDb
  })()

  try {
    if (!tableExists(db, 'bridge_approval_requests') || !tableExists(db, 'bridge_audit_events')) {
      return unavailable('approval_persistence_not_applied')
    }

    const workspaceId = input.requester.workspaceId || 1
    const tenantId = input.requester.tenantId || 1
    const connector = cleanText(input.connector, 'unknown')
    const action = cleanText(input.action, 'protected_action')
    const target = cleanText(input.target || '', '')
    const targetKey = cleanText(input.targetKey, action)
    const approvalScopeJson = stableJson(input.approvalScope)
    const scopeHash = hashScope({ workspaceId, tenantId, connector, action, targetKey, approvalScopeJson })
    const requester = cleanText(input.requester.username, 'mission-control')
    const requesterUserId = realUserIdOrNull(db, input.requester.userId)
    const reason = cleanText(input.reason, 'Protected action requires owner approval.')
    const correlationId = cleanText(input.correlationId || `corr_${randomUUID()}`, `corr_${randomUUID()}`)
    const idempotencyKey = input.idempotencyKey ? cleanText(input.idempotencyKey, '') : null
    const approvalId = `apr_${randomUUID()}`
    const auditId = `audit_${randomUUID()}`

    const created = db.transaction(() => {
      if (idempotencyKey) {
        const existing = db.prepare(`
          SELECT id, approval_state
            FROM bridge_approval_requests
           WHERE workspace_id = ? AND tenant_id = ? AND idempotency_key = ?
           LIMIT 1
        `).get(workspaceId, tenantId, idempotencyKey) as { id: string; approval_state: string } | undefined
        if (existing) return { id: existing.id, reused: true, auditId: null as string | null }
      }

      db.prepare(`
        INSERT INTO bridge_approval_requests (
          id, workspace_id, tenant_id, connector, action, target, target_key,
          requester, requester_user_id, risk_level, approval_state, protected_category,
          approval_scope_json, scope_hash, reason, required_approver, rollback_available,
          rollback_ref, expires_at, correlation_id, idempotency_key
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 'owner', ?, ?, ?, ?, ?
        )
      `).run(
        approvalId,
        workspaceId,
        tenantId,
        connector,
        action,
        target || null,
        targetKey,
        requester,
        requesterUserId,
        input.riskLevel,
        input.protectedCategory,
        approvalScopeJson,
        scopeHash,
        reason,
        input.rollbackAvailable ? 1 : 0,
        input.rollbackRef || null,
        input.expiresAt || null,
        correlationId,
        idempotencyKey,
      )

      db.prepare(`
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
        connector,
        action,
        target || null,
        targetKey,
        createHash('sha256').update(`${approvalId}|${scopeHash}`).digest('hex'),
        JSON.stringify({
          source: 'mission-control',
          approval_surface: 'bridge_approval_request_store',
          execution_enabled: false,
          accepted_for_execution: false,
          no_connector_writes_enabled: true,
        }),
        correlationId,
      )
      return { id: approvalId, reused: false, auditId }
    })()

    const approval = readApprovalRequest(db, created.id)
    return {
      ok: Boolean(approval),
      http_status: approval ? 201 : 500,
      approval_request_created: Boolean(approval),
      approval_request_reused: created.reused,
      approval_request: approval,
      approval_request_id: approval?.id || null,
      approval_state: approval?.approval_state || null,
      audit_event_id: created.auditId,
      blocked_reason: approval ? null : 'approval_request_create_failed',
      next_action: created.reused
        ? 'Reuse the existing pending owner approval request; no duplicate approval was created.'
        : 'Owner must approve this exact request before protected execution can proceed.',
    }
  } catch {
    return unavailable('approval_request_create_failed')
  } finally {
    try { ownedDb?.close() } catch { /* noop */ }
  }
}
