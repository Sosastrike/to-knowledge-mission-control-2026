import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  dbPath: '',
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/config', () => ({
  config: {
    get dbPath() {
      return mocks.dbPath
    },
  },
}))

import { GET } from './route'

let tempDir = ''

function request() {
  return new Request('http://mission-control.test/api/bridge/approval-requests/audit-report') as NextRequest
}

function createSchema(dbPath: string) {
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL);
    INSERT INTO users (id, username) VALUES (1, 'owner');
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
      connector TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      target_key TEXT NOT NULL DEFAULT '',
      approval_request_id TEXT,
      audit_event_id TEXT,
      run_state TEXT NOT NULL,
      risk_level TEXT NOT NULL DEFAULT 'low',
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
  db.close()
}

function insertReportRows(dbPath: string) {
  const db = new Database(dbPath)
  db.prepare(`
    INSERT INTO bridge_approval_requests (
      id, workspace_id, tenant_id, connector, action, target, target_key,
      requester, requester_user_id, risk_level, approval_state,
      protected_category, approval_scope_json, scope_hash, reason,
      required_approver, resolved_at, resolved_by, resolved_by_user_id,
      resolution_reason, correlation_id, created_at
    ) VALUES (
      'apr_report', 1, 1, 'skill.build_wiki', 'buildwiki.run_now',
      'opencloud-docs-farmer.service', 'opencloud-docs-farmer.service',
      'owner', 1, 'low', 'approved', 'tooling',
      '{"service":"opencloud-docs-farmer.service"}', 'hash',
      'Owner approved Fork 1 only.', 'owner', '2026-05-09T12:00:10.000Z',
      'owner', 1, 'approved_by_owner', 'corr_report',
      '2026-05-09T12:00:00.000Z'
    )
  `).run()
  db.prepare(`
    INSERT INTO bridge_connector_runs (
      id, connector, action, target, target_key, approval_request_id,
      audit_event_id, run_state, risk_level, started_at, finished_at,
      correlation_id, created_at
    ) VALUES (
      'run_report', 'skill.build_wiki', 'buildwiki.run_now',
      'opencloud-docs-farmer.service', 'opencloud-docs-farmer.service',
      'apr_report', 'audit_failed', 'failed', 'low',
      '2026-05-09T12:00:11.000Z', '2026-05-09T12:00:12.000Z',
      'corr_report', '2026-05-09T12:00:12.000Z'
    )
  `).run()
  db.prepare(`
    INSERT INTO bridge_audit_events (
      id, approval_request_id, actor, actor_user_id, connector, action,
      target, target_key, outcome, metadata_json, correlation_id, created_at
    ) VALUES (
      'audit_requested', 'apr_report', 'owner', 1, 'skill.build_wiki',
      'buildwiki.run_now', 'opencloud-docs-farmer.service',
      'opencloud-docs-farmer.service', 'approval_requested',
      '{"summary":"request from /Users/sosastrike/private/auth.json","credential_state":"redacted fixture"}',
      'corr_report', '2026-05-09T12:00:00.000Z'
    ),
    (
      'audit_failed', 'apr_report', 'mission-control', 1, 'skill.build_wiki',
      'buildwiki.run_now', 'opencloud-docs-farmer.service',
      'opencloud-docs-farmer.service', 'failed',
      '{"blocked_reason":"systemctl user unavailable","stderr":"/home/sosastrike/.config/auth.json missing"}',
      'corr_report', '2026-05-09T12:00:12.000Z'
    )
  `).run()
  db.close()
}

describe('Bridge approval audit report route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-audit-report-route-'))
    mocks.dbPath = path.join(tempDir, 'mission-control.db')
    mocks.requireRole.mockReturnValue({
      user: { id: 1, username: 'owner', display_name: 'Owner', role: 'admin', workspace_id: 1, tenant_id: 1 },
    })
  })

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    tempDir = ''
  })

  it('requires an authenticated viewer before reading the database', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Forbidden', status: 403 })
    mocks.dbPath = path.join(tempDir, 'missing.db')

    const response = await GET(request())
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toEqual({ ok: false, error: 'Forbidden' })
  })

  it('returns a truthful unavailable report when approval persistence is missing', async () => {
    const db = new Database(mocks.dbPath)
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL);')
    db.close()

    const response = await GET(request())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'approval_audit_report_unavailable',
      persistence_ready: false,
      execution_enabled: false,
      writes_enabled: false,
      report: {
        title: 'Bridge Approval Audit Report',
        requests: [],
      },
    })
    expect(payload.blocked_reason).toBe('approval_persistence_not_applied')
  })

  it('exports request lifecycle, run result, audit history, and sanitized metadata', async () => {
    createSchema(mocks.dbPath)
    insertReportRows(mocks.dbPath)

    const response = await GET(request())
    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'approval_audit_report',
      persistence_ready: true,
      execution_enabled: false,
      writes_enabled: false,
      report: {
        title: 'Bridge Approval Audit Report',
        summary: {
          total: 1,
          approved: 1,
          failed_runs: 1,
        },
      },
    })
    expect(payload.report.requests).toHaveLength(1)
    expect(payload.report.requests[0]).toMatchObject({
      id: 'apr_report',
      scope: {
        connector: 'skill.build_wiki',
        action: 'buildwiki.run_now',
        target_key: 'opencloud-docs-farmer.service',
      },
      lifecycle: {
        approval_state: 'approved',
        resolved_by: 'owner',
      },
      execution: {
        run_id: 'run_report',
        run_state: 'failed',
        accepted_for_execution: true,
        execution_enabled: false,
        writes_enabled: false,
      },
    })
    expect(payload.report.requests[0].audit_events.map((event: { outcome: string }) => event.outcome)).toEqual([
      'failed',
      'approval_requested',
    ])
    expect(serialized).not.toContain('/Users/sosastrike')
    expect(serialized).not.toContain('/home/sosastrike')
    expect(serialized).not.toContain('auth.json')
  })
})
