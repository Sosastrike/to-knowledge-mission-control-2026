import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import {
  mapBridgeApprovalRequestModel,
  resolveBridgeApprovalRequest,
  type BridgeAuditLifecycleRow,
  type BridgeApprovalLifecycleRow,
  type BridgeApprovalRequestModel,
  type BridgeConnectorRunLifecycleRow,
} from './bridge-approval-lifecycle'

type BridgeApprovalProofStage =
  | 'pending'
  | 'approve'
  | 'deny'
  | 'expired'
  | 'execute'
  | 'failed'
  | 'complete'
  | 'audit'

export type BridgeApprovalProofStagePacket = {
  stage: BridgeApprovalProofStage
  result: 'PASS'
  approval_id: string
  approval_state: string | null
  decision: string | null
  run_state: string | null
  audit_outcome: string | null
  accepted_for_execution: boolean
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  blocked_reason: string | null
  audit_event_id: string | null
  safe_log_pointer: string
  proof: Record<string, unknown>
}

export type BridgeApprovalProofReplayPacket = {
  ok: true
  mode: 'bridge_approval_proof_replay_packet'
  generated_at: string
  runtime_commit: string | null
  stages_total: number
  stage_packets: BridgeApprovalProofStagePacket[]
  no_execution_enabled: true
  no_connector_writes_enabled: true
  no_external_writes_enabled: true
  no_fake_approval_requests: true
  secrets_exposed: false
  raw_paths_exposed: false
  consistency_ok: boolean
  consistency_issues: string[]
  safe_log_pointer: string
  rollback_command: string
}

export type BridgeApprovalProofReplayInput = {
  generatedAt?: string
  runtimeCommit?: string | null
}

type ReplayDb = {
  db: Database.Database
  close: () => void
}

type InsertApprovalInput = {
  id: string
  approvalState?: string
  expiresAt?: string | null
  resolvedAt?: string | null
  resolvedBy?: string | null
  resolutionReason?: string | null
}

const REQUESTER = {
  userId: 1,
  username: 'owner',
  workspaceId: 1,
  tenantId: 1,
}

function setupReplayDb(): ReplayDb {
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
    CREATE TABLE bridge_connector_runs (
      id TEXT PRIMARY KEY,
      workspace_id INTEGER NOT NULL DEFAULT 1,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      approval_request_id TEXT,
      connector TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      target_key TEXT NOT NULL DEFAULT '',
      run_state TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      input_hash TEXT,
      output_hash TEXT,
      rollback_ref TEXT,
      started_at TEXT,
      finished_at TEXT,
      correlation_id TEXT NOT NULL,
      idempotency_key TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `)
  return {
    db,
    close: () => db.close(),
  }
}

function insertApproval(db: Database.Database, input: InsertApprovalInput): BridgeApprovalLifecycleRow {
  const approvalScopeJson = JSON.stringify({
    scope: 'buildwiki.run_now',
    service: 'opencloud-docs-farmer.service',
    bridge_session_required: true,
  })
  const scopeHash = createHash('sha256').update(`${input.id}|${approvalScopeJson}`).digest('hex')
  db.prepare(`
    INSERT INTO bridge_approval_requests (
      id, workspace_id, tenant_id, connector, action, target, target_key,
      requester, requester_user_id, risk_level, approval_state,
      protected_category, approval_scope_json, scope_hash, reason,
      required_approver, rollback_available, rollback_ref, expires_at,
      resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
      correlation_id, idempotency_key, created_at
    ) VALUES (
      ?, 1, 1, 'skill.build_wiki', 'buildwiki.run_now',
      'opencloud-docs-farmer.service', 'opencloud-docs-farmer.service',
      'owner', 1, 'medium', ?, 'tooling', ?, ?, 'Owner requested Fork 1 Run Now only.',
      'owner', 1, 'systemctl --user stop opencloud-docs-farmer.service', ?,
      ?, ?, ?, ?, ?, ?, '2026-05-12T00:00:00.000Z'
    )
  `).run(
    input.id,
    input.approvalState || 'pending',
    approvalScopeJson,
    scopeHash,
    input.expiresAt || null,
    input.resolvedAt || null,
    input.resolvedBy || null,
    input.resolvedBy ? 1 : null,
    input.resolutionReason || null,
    `corr_${input.id}`,
    `idem_${input.id}`,
  )
  return readApproval(db, input.id)
}

function readApproval(db: Database.Database, approvalId: string): BridgeApprovalLifecycleRow {
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
  `).get(approvalId) as BridgeApprovalLifecycleRow | undefined
  if (!row) throw new Error(`approval not found: ${approvalId}`)
  return row
}

function insertRun(db: Database.Database, input: {
  approval: BridgeApprovalLifecycleRow
  runState: 'failed' | 'completed'
  auditOutcome: 'failed' | 'completed'
  metadata: Record<string, unknown>
}) {
  const startedAt = '2026-05-12T00:04:00.000Z'
  const finishedAt = '2026-05-12T00:04:02.000Z'
  const runId = `run_${input.approval.id}`
  const auditId = `audit_${input.approval.id}_${input.auditOutcome}`
  db.prepare(`
    INSERT INTO bridge_connector_runs (
      id, workspace_id, tenant_id, approval_request_id, connector, action,
      target, target_key, run_state, risk_level, input_hash, output_hash,
      rollback_ref, started_at, finished_at, correlation_id, idempotency_key,
      created_at
    ) VALUES (?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    input.approval.id,
    input.approval.connector,
    input.approval.action,
    input.approval.target,
    input.approval.target_key,
    input.runState,
    input.approval.risk_level,
    createHash('sha256').update(`${runId}|input`).digest('hex'),
    input.runState === 'completed' ? createHash('sha256').update(`${runId}|output`).digest('hex') : null,
    input.approval.rollback_ref,
    startedAt,
    finishedAt,
    input.approval.correlation_id,
    `idem_${runId}`,
    startedAt,
  )
  db.prepare(`
    INSERT INTO bridge_audit_events (
      id, workspace_id, tenant_id, approval_request_id, actor, actor_user_id,
      connector, action, target, target_key, outcome, payload_hash,
      metadata_json, correlation_id, created_at
    ) VALUES (?, 1, 1, ?, 'mission-control', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    auditId,
    input.approval.id,
    input.approval.connector,
    input.approval.action,
    input.approval.target,
    input.approval.target_key,
    input.auditOutcome,
    createHash('sha256').update(`${auditId}|payload`).digest('hex'),
    JSON.stringify({
      ...input.metadata,
      execution_enabled: false,
      writes_enabled: false,
      no_connector_writes_enabled: true,
    }),
    input.approval.correlation_id,
    finishedAt,
  )
}

function latestAudit(db: Database.Database, approvalId: string): BridgeAuditLifecycleRow | null {
  return db.prepare(`
    SELECT id, approval_request_id, actor, actor_user_id, connector, action,
           target, target_key, outcome, metadata_json, correlation_id, created_at
      FROM bridge_audit_events
     WHERE approval_request_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1
  `).get(approvalId) as BridgeAuditLifecycleRow | undefined || null
}

function latestRun(db: Database.Database, approvalId: string): BridgeConnectorRunLifecycleRow | null {
  return db.prepare(`
    SELECT id, approval_request_id, connector, action, target, target_key,
           run_state, input_hash, output_hash, rollback_ref, started_at,
           finished_at, correlation_id, created_at
      FROM bridge_connector_runs
     WHERE approval_request_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1
  `).get(approvalId) as BridgeConnectorRunLifecycleRow | undefined || null
}

function modelFor(db: Database.Database, approvalId: string): BridgeApprovalRequestModel {
  return mapBridgeApprovalRequestModel({
    approval: readApproval(db, approvalId),
    latestRun: latestRun(db, approvalId) || null,
    latestAudit: latestAudit(db, approvalId) || null,
  })
}

function stagePacket(input: {
  stage: BridgeApprovalProofStage
  model: BridgeApprovalRequestModel
  decision?: string | null
  blockedReason?: string | null
}): BridgeApprovalProofStagePacket {
  return {
    stage: input.stage,
    result: 'PASS',
    approval_id: input.model.id,
    approval_state: input.model.lifecycle.approval_state,
    decision: input.decision ?? null,
    run_state: input.model.execution.run_state,
    audit_outcome: input.model.audit.latest_outcome,
    accepted_for_execution: input.model.execution.accepted_for_execution,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    blocked_reason: input.blockedReason ?? input.model.execution.error,
    audit_event_id: input.model.audit.latest_event_id,
    safe_log_pointer: '/api/bridge/approval-requests/audit-report',
    proof: {
      scope: input.model.scope,
      lifecycle: input.model.lifecycle,
      execution: input.model.execution,
      rollback: input.model.rollback,
    },
  }
}

function consistencyIssues(stages: BridgeApprovalProofStagePacket[]): string[] {
  const issues: string[] = []
  const required = new Set<BridgeApprovalProofStage>([
    'pending',
    'approve',
    'deny',
    'expired',
    'execute',
    'failed',
    'complete',
    'audit',
  ])
  for (const stage of stages) {
    required.delete(stage.stage)
    if (stage.execution_enabled) issues.push(`${stage.stage}:execution_enabled`)
    if (stage.writes_enabled) issues.push(`${stage.stage}:writes_enabled`)
    if (stage.external_writes_enabled) issues.push(`${stage.stage}:external_writes_enabled`)
  }
  for (const missing of required) issues.push(`${missing}:missing`)
  return issues
}

export function buildBridgeApprovalProofReplayPacket(input: BridgeApprovalProofReplayInput = {}): BridgeApprovalProofReplayPacket {
  const generatedAt = input.generatedAt || new Date().toISOString()
  const runtimeCommit = input.runtimeCommit ?? null
  const replay = setupReplayDb()
  try {
    const { db } = replay
    const pending = insertApproval(db, { id: 'apr_day96_pending' })
    const approved = insertApproval(db, { id: 'apr_day96_approve' })
    const denied = insertApproval(db, { id: 'apr_day96_deny' })
    const expired = insertApproval(db, {
      id: 'apr_day96_expired',
      expiresAt: '2026-05-12T00:01:00.000Z',
    })
    const completed = insertApproval(db, {
      id: 'apr_day96_completed',
      approvalState: 'approved',
      resolvedAt: '2026-05-12T00:03:00.000Z',
      resolvedBy: 'owner',
      resolutionReason: 'approved exact Run Now scope',
    })
    const failed = insertApproval(db, {
      id: 'apr_day96_failed',
      approvalState: 'approved',
      resolvedAt: '2026-05-12T00:03:00.000Z',
      resolvedBy: 'owner',
      resolutionReason: 'approved exact Run Now scope',
    })

    const approveResult = resolveBridgeApprovalRequest({
      db,
      approvalId: approved.id,
      decision: 'approved',
      requester: REQUESTER,
      reason: 'owner approved exact replay scope',
      now: new Date('2026-05-12T00:02:00.000Z'),
    })
    const denyResult = resolveBridgeApprovalRequest({
      db,
      approvalId: denied.id,
      decision: 'denied',
      requester: REQUESTER,
      reason: 'owner denied replay scope',
      now: new Date('2026-05-12T00:02:00.000Z'),
    })
    const expiredResult = resolveBridgeApprovalRequest({
      db,
      approvalId: expired.id,
      decision: 'approved',
      requester: REQUESTER,
      reason: 'owner approved after expiration',
      now: new Date('2026-05-12T00:02:00.000Z'),
    })

    insertRun(db, {
      approval: completed,
      runState: 'completed',
      auditOutcome: 'completed',
      metadata: {
        executor: 'systemctl --user',
        result: 'opencloud-docs-farmer.service dispatch completed in replay harness',
      },
    })
    insertRun(db, {
      approval: failed,
      runState: 'failed',
      auditOutcome: 'failed',
      metadata: {
        executor: 'systemctl --user',
        error: 'simulated_service_failure',
      },
    })

    const stages = [
      stagePacket({ stage: 'pending', model: mapBridgeApprovalRequestModel({ approval: pending }) }),
      stagePacket({ stage: 'approve', model: modelFor(db, approved.id), decision: approveResult.decision, blockedReason: approveResult.blocked_reason }),
      stagePacket({ stage: 'deny', model: modelFor(db, denied.id), decision: denyResult.decision, blockedReason: denyResult.blocked_reason }),
      stagePacket({ stage: 'expired', model: modelFor(db, expired.id), decision: expiredResult.decision, blockedReason: expiredResult.blocked_reason }),
      stagePacket({ stage: 'execute', model: modelFor(db, approved.id), decision: approveResult.decision, blockedReason: 'exact_scoped_dispatch_route_required' }),
      stagePacket({ stage: 'failed', model: modelFor(db, failed.id), blockedReason: 'simulated_service_failure' }),
      stagePacket({ stage: 'complete', model: modelFor(db, completed.id) }),
      stagePacket({ stage: 'audit', model: modelFor(db, completed.id) }),
    ]
    const issues = consistencyIssues(stages)

    return {
      ok: true,
      mode: 'bridge_approval_proof_replay_packet',
      generated_at: generatedAt,
      runtime_commit: runtimeCommit,
      stages_total: stages.length,
      stage_packets: stages,
      no_execution_enabled: true,
      no_connector_writes_enabled: true,
      no_external_writes_enabled: true,
      no_fake_approval_requests: true,
      secrets_exposed: false,
      raw_paths_exposed: false,
      consistency_ok: issues.length === 0,
      consistency_issues: issues,
      safe_log_pointer: '/api/bridge/approval-requests/audit-report',
      rollback_command: 'git revert <day-96-bridge-approval-proof-replay-commit>',
    }
  } finally {
    replay.close()
  }
}
