import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { mapBridgeApprovalRequestModel, resolveBridgeApprovalRequest } from './bridge-approval-lifecycle'

function setupDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE bridge_approval_requests (
      id TEXT PRIMARY KEY,
      workspace_id INTEGER NOT NULL DEFAULT 1,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      connector TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      target_key TEXT NOT NULL DEFAULT '',
      requester TEXT NOT NULL,
      requester_user_id INTEGER,
      risk_level TEXT NOT NULL,
      approval_state TEXT NOT NULL,
      protected_category TEXT NOT NULL,
      approval_scope_json TEXT NOT NULL DEFAULT '{}',
      scope_hash TEXT NOT NULL,
      reason TEXT,
      required_approver TEXT NOT NULL DEFAULT 'owner',
      rollback_available INTEGER NOT NULL DEFAULT 0,
      rollback_ref TEXT,
      expires_at TEXT,
      resolved_at TEXT,
      resolved_by TEXT,
      resolved_by_user_id INTEGER,
      resolution_reason TEXT,
      correlation_id TEXT NOT NULL,
      idempotency_key TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE TABLE bridge_audit_events (
      id TEXT PRIMARY KEY,
      workspace_id INTEGER NOT NULL DEFAULT 1,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      approval_request_id TEXT,
      actor TEXT NOT NULL,
      actor_user_id INTEGER,
      connector TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      target_key TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL,
      payload_hash TEXT,
      before_ref TEXT,
      after_ref TEXT,
      rollback_ref TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      correlation_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `)
  return db
}

function insertApproval(db: Database.Database, override: Partial<Record<string, unknown>> = {}) {
  db.prepare(`
    INSERT INTO bridge_approval_requests (
      id, workspace_id, tenant_id, connector, action, target, target_key,
      requester, requester_user_id, risk_level, approval_state,
      protected_category, approval_scope_json, scope_hash, reason,
      required_approver, expires_at, correlation_id
    ) VALUES (?, 1, 1, ?, ?, ?, ?, 'owner', 1, 'low', ?, 'tooling', '{}', 'hash', 'reason', 'owner', ?, 'corr_test')
  `).run(
    override.id || 'apr_test',
    override.connector || 'skill.build_wiki',
    override.action || 'buildwiki.run_now',
    override.target || 'opencloud-docs-farmer.service',
    override.target_key || 'opencloud-docs-farmer.service',
    override.approval_state || 'pending',
    override.expires_at || null,
  )
}

const requester = {
  userId: 1,
  username: 'owner',
  workspaceId: 1,
  tenantId: 1,
}

describe('Bridge approval lifecycle', () => {
  it('projects a complete approval request model with scope, owner, execution, result, error, and audit pointers', () => {
    const model = mapBridgeApprovalRequestModel({
      approval: {
        id: 'apr_model',
        workspace_id: 1,
        tenant_id: 1,
        connector: 'skill.build_wiki',
        action: 'buildwiki.run_now',
        target: 'opencloud-docs-farmer.service',
        target_key: 'opencloud-docs-farmer.service',
        requester: 'owner',
        requester_user_id: 1,
        risk_level: 'medium',
        approval_state: 'approved',
        protected_category: 'tooling',
        approval_scope_json: '{"service":"opencloud-docs-farmer.service","scope":"buildwiki.run_now"}',
        scope_hash: 'scope_hash',
        reason: 'Owner requested Fork 1 Run Now only.',
        required_approver: 'owner',
        rollback_available: 1,
        rollback_ref: 'systemctl --user stop opencloud-docs-farmer.service',
        expires_at: '2026-05-09T15:00:00.000Z',
        resolved_at: '2026-05-09T14:05:00.000Z',
        resolved_by: 'owner',
        resolved_by_user_id: 1,
        resolution_reason: 'approved exact Run Now scope',
        correlation_id: 'corr_model',
        idempotency_key: 'idem_model',
        created_at: '2026-05-09T14:00:00.000Z',
      },
      latestRun: {
        id: 'run_model',
        approval_request_id: 'apr_model',
        connector: 'skill.build_wiki',
        action: 'buildwiki.run_now',
        target: 'opencloud-docs-farmer.service',
        target_key: 'opencloud-docs-farmer.service',
        run_state: 'completed',
        input_hash: 'input_hash',
        output_hash: 'output_hash',
        rollback_ref: 'systemctl --user stop opencloud-docs-farmer.service',
        started_at: '2026-05-09T14:06:00.000Z',
        finished_at: '2026-05-09T14:06:02.000Z',
        correlation_id: 'corr_model',
        created_at: '2026-05-09T14:06:00.000Z',
      },
      latestAudit: {
        id: 'audit_model',
        approval_request_id: 'apr_model',
        actor: 'mission-control',
        actor_user_id: 1,
        connector: 'skill.build_wiki',
        action: 'buildwiki.run_now',
        target: 'opencloud-docs-farmer.service',
        target_key: 'opencloud-docs-farmer.service',
        outcome: 'completed',
        metadata_json: '{"executor":"systemctl --user","result":"run dispatched / completed"}',
        correlation_id: 'corr_model',
        created_at: '2026-05-09T14:06:02.000Z',
      },
    })

    expect(model).toMatchObject({
      id: 'apr_model',
      request_type: 'buildwiki.run_now',
      scope: {
        connector: 'skill.build_wiki',
        action: 'buildwiki.run_now',
        target_key: 'opencloud-docs-farmer.service',
        approval_scope: {
          service: 'opencloud-docs-farmer.service',
          scope: 'buildwiki.run_now',
        },
      },
      owner: {
        requester: 'owner',
        required_approver: 'owner',
        resolved_by: 'owner',
      },
      lifecycle: {
        approval_state: 'approved',
        requested_at: '2026-05-09T14:00:00.000Z',
        approved_at: '2026-05-09T14:05:00.000Z',
        denied_at: null,
      },
      execution: {
        accepted_for_execution: true,
        executor: 'systemctl --user',
        run_id: 'run_model',
        run_state: 'completed',
        result: 'run dispatched / completed',
        error: null,
        audit_event_id: 'audit_model',
      },
      audit: {
        latest_event_id: 'audit_model',
        latest_outcome: 'completed',
        correlation_id: 'corr_model',
      },
    })
    expect(model.execution.execution_enabled).toBe(false)
    expect(model.execution.writes_enabled).toBe(false)
  })

  it('approves a pending request and writes an audit event without executing', () => {
    const db = setupDb()
    insertApproval(db)

    const result = resolveBridgeApprovalRequest({
      db,
      approvalId: 'apr_test',
      decision: 'approved',
      requester,
      reason: 'owner approved exact scope',
      now: new Date('2026-05-09T14:00:00.000Z'),
    })

    expect(result).toMatchObject({
      ok: true,
      http_status: 200,
      approval_state: 'approved',
      decision: 'approved',
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    const approval = db.prepare('SELECT approval_state, resolved_by, resolution_reason FROM bridge_approval_requests WHERE id = ?').get('apr_test') as any
    const audit = db.prepare('SELECT outcome, actor, action, target_key FROM bridge_audit_events WHERE approval_request_id = ?').get('apr_test') as any
    expect(approval).toEqual({
      approval_state: 'approved',
      resolved_by: 'owner',
      resolution_reason: 'owner approved exact scope',
    })
    expect(audit).toEqual({
      outcome: 'approved',
      actor: 'owner',
      action: 'buildwiki.run_now',
      target_key: 'opencloud-docs-farmer.service',
    })
  })

  it('denies a pending request and keeps execution disabled', () => {
    const db = setupDb()
    insertApproval(db)

    const result = resolveBridgeApprovalRequest({
      db,
      approvalId: 'apr_test',
      decision: 'denied',
      requester,
      reason: 'owner denied',
    })

    expect(result).toMatchObject({
      ok: true,
      approval_state: 'denied',
      decision: 'denied',
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    const audit = db.prepare('SELECT outcome FROM bridge_audit_events WHERE approval_request_id = ?').get('apr_test') as any
    expect(audit.outcome).toBe('denied')
  })

  it('expires an old pending request instead of approving it', () => {
    const db = setupDb()
    insertApproval(db, { expires_at: '2026-05-09T13:00:00.000Z' })

    const result = resolveBridgeApprovalRequest({
      db,
      approvalId: 'apr_test',
      decision: 'approved',
      requester,
      now: new Date('2026-05-09T14:00:00.000Z'),
    })

    expect(result).toMatchObject({
      ok: false,
      http_status: 409,
      approval_state: 'expired',
      decision: 'expired',
      blocked_reason: 'approval_request_expired',
      execution_enabled: false,
    })
    const audit = db.prepare('SELECT outcome FROM bridge_audit_events WHERE approval_request_id = ?').get('apr_test') as any
    expect(audit.outcome).toBe('expired')
  })
})
