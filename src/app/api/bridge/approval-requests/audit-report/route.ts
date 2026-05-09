import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { authJson } from '@/lib/designer-module-api'
import { config } from '@/lib/config'
import {
  tableExists,
  type BridgeApprovalLifecycleRow,
  type BridgeAuditLifecycleRow,
} from '@/lib/bridge-approval-lifecycle'
import { ownerSafeStatusText } from '@/lib/owner-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ConnectorRunReportRow = {
  id: string
  approval_request_id: string | null
  connector: string
  action: string
  target: string | null
  target_key: string
  run_state: string
  input_hash: string | null
  output_hash: string | null
  rollback_ref: string | null
  started_at: string | null
  finished_at: string | null
  correlation_id: string
  created_at: string
}

function unavailableReport(blockedReason: string, error?: unknown) {
  return NextResponse.json({
    ok: true,
    mode: 'approval_audit_report_unavailable',
    generated_at: new Date().toISOString(),
    persistence_ready: false,
    approval_queue_connected: false,
    execution_enabled: false,
    writes_enabled: false,
    blocked_reason: blockedReason,
    error: error instanceof Error ? ownerSafeStatusText(error.message) : null,
    report: {
      title: 'Bridge Approval Audit Report',
      summary: {
        total: 0,
        pending: 0,
        approved: 0,
        denied: 0,
        expired: 0,
        revoked: 0,
        completed_runs: 0,
        failed_runs: 0,
      },
      requests: [],
    },
    safety: {
      read_only: true,
      no_execution_enabled: true,
      no_connector_writes_enabled: true,
      no_secret_values: true,
      raw_paths_redacted: true,
    },
    next_action: 'Apply Bridge approval/audit persistence before exporting approval history.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

function readApprovalRows(db: Database.Database): BridgeApprovalLifecycleRow[] {
  return db.prepare(`
    SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
           requester, requester_user_id, risk_level, approval_state,
           protected_category, approval_scope_json, scope_hash, reason,
           required_approver, rollback_available, rollback_ref, expires_at,
           resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
           correlation_id, idempotency_key, created_at
      FROM bridge_approval_requests
     ORDER BY created_at DESC
     LIMIT 100
  `).all() as BridgeApprovalLifecycleRow[]
}

function readConnectorRuns(
  db: Database.Database,
  approvalIds: string[],
): Map<string, ConnectorRunReportRow> {
  if (approvalIds.length === 0 || !tableExists(db, 'bridge_connector_runs')) return new Map()
  const placeholders = approvalIds.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT id, approval_request_id, connector, action, target, target_key,
           run_state, input_hash, output_hash, rollback_ref, started_at,
           finished_at, correlation_id, created_at
      FROM bridge_connector_runs
     WHERE approval_request_id IN (${placeholders})
     ORDER BY created_at DESC
  `).all(...approvalIds) as ConnectorRunReportRow[]

  const latest = new Map<string, ConnectorRunReportRow>()
  for (const row of rows) {
    if (row.approval_request_id && !latest.has(row.approval_request_id)) {
      latest.set(row.approval_request_id, row)
    }
  }
  return latest
}

function readAuditEvents(
  db: Database.Database,
  approvalIds: string[],
): Map<string, BridgeAuditLifecycleRow[]> {
  if (approvalIds.length === 0 || !tableExists(db, 'bridge_audit_events')) return new Map()
  const placeholders = approvalIds.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT id, approval_request_id, actor, actor_user_id, connector, action,
           target, target_key, outcome, metadata_json, correlation_id, created_at
      FROM bridge_audit_events
     WHERE approval_request_id IN (${placeholders})
     ORDER BY created_at DESC
     LIMIT 500
  `).all(...approvalIds) as BridgeAuditLifecycleRow[]

  const grouped = new Map<string, BridgeAuditLifecycleRow[]>()
  for (const row of rows) {
    if (!row.approval_request_id) continue
    const current = grouped.get(row.approval_request_id) || []
    current.push(row)
    grouped.set(row.approval_request_id, current)
  }
  return grouped
}

function safeJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? sanitizeJson(parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function sanitizeJson(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    ownerSafeStatusText(key) || key,
    sanitizeValue(item),
  ]))
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return ownerSafeStatusText(value) || ''
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item))
  if (value && typeof value === 'object') return sanitizeJson(value)
  return null
}

function safeText(value: unknown): string | null {
  const safe = ownerSafeStatusText(String(value ?? '').trim())
  return safe ? safe.slice(0, 500) : null
}

function summarizeReport(
  approvals: BridgeApprovalLifecycleRow[],
  runs: Map<string, ConnectorRunReportRow>,
) {
  const summary = {
    total: approvals.length,
    pending: 0,
    approved: 0,
    denied: 0,
    expired: 0,
    revoked: 0,
    completed_runs: 0,
    failed_runs: 0,
  }
  for (const approval of approvals) {
    if (approval.approval_state === 'pending') summary.pending += 1
    if (approval.approval_state === 'approved') summary.approved += 1
    if (approval.approval_state === 'denied') summary.denied += 1
    if (approval.approval_state === 'expired') summary.expired += 1
    if (approval.approval_state === 'revoked') summary.revoked += 1
    const run = runs.get(approval.id)
    if (run?.run_state === 'completed') summary.completed_runs += 1
    if (run?.run_state === 'failed') summary.failed_runs += 1
  }
  return summary
}

function mapReportRequest(
  approval: BridgeApprovalLifecycleRow,
  run: ConnectorRunReportRow | null,
  auditEvents: BridgeAuditLifecycleRow[],
) {
  return {
    id: approval.id,
    scope: {
      connector: approval.connector,
      action: approval.action,
      target: safeText(approval.target),
      target_key: approval.target_key,
      protected_category: approval.protected_category,
      risk_level: approval.risk_level,
      approval_scope: safeJsonObject(approval.approval_scope_json),
      scope_hash: approval.scope_hash,
    },
    lifecycle: {
      approval_state: approval.approval_state,
      requested_at: approval.created_at,
      expires_at: approval.expires_at,
      resolved_at: approval.resolved_at,
      resolved_by: safeText(approval.resolved_by),
      resolution_reason: safeText(approval.resolution_reason),
    },
    owner: {
      requester: safeText(approval.requester),
      requester_user_id: approval.requester_user_id,
      required_approver: approval.required_approver,
      resolved_by_user_id: approval.resolved_by_user_id,
    },
    execution: {
      accepted_for_execution: Boolean(run),
      execution_enabled: false,
      writes_enabled: false,
      run_id: run?.id || null,
      run_state: run?.run_state || null,
      started_at: run?.started_at || null,
      completed_at: run?.finished_at || null,
      result: run?.run_state || null,
      rollback_ref: safeText(run?.rollback_ref) || safeText(approval.rollback_ref),
    },
    audit_events: auditEvents.map((event) => ({
      id: event.id,
      actor: safeText(event.actor),
      connector: event.connector,
      action: event.action,
      target: safeText(event.target),
      target_key: event.target_key,
      outcome: event.outcome,
      metadata: safeJsonObject(event.metadata_json),
      correlation_id: event.correlation_id,
      created_at: event.created_at,
    })),
    rollback: {
      available: Boolean(approval.rollback_available),
      ref: safeText(approval.rollback_ref),
    },
  }
}

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { readonly: true, fileMustExist: true })
    if (!tableExists(db, 'bridge_approval_requests') || !tableExists(db, 'bridge_audit_events')) {
      return unavailableReport('approval_persistence_not_applied')
    }

    const approvals = readApprovalRows(db)
    const approvalIds = approvals.map((approval) => approval.id)
    const runs = readConnectorRuns(db, approvalIds)
    const audits = readAuditEvents(db, approvalIds)

    return NextResponse.json({
      ok: true,
      mode: 'approval_audit_report',
      generated_at: new Date().toISOString(),
      persistence_ready: true,
      approval_queue_connected: true,
      execution_enabled: false,
      writes_enabled: false,
      report: {
        title: 'Bridge Approval Audit Report',
        summary: summarizeReport(approvals, runs),
        requests: approvals.map((approval) => mapReportRequest(
          approval,
          runs.get(approval.id) || null,
          audits.get(approval.id) || [],
        )),
      },
      safety: {
        read_only: true,
        no_execution_enabled: true,
        no_connector_writes_enabled: true,
        no_secret_values: true,
        raw_paths_redacted: true,
      },
      next_action: 'Use this protected report for Bridge approval history. Execute actions only through scoped Bridge dispatch routes.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return unavailableReport('approval_audit_report_read_failed', error)
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}
