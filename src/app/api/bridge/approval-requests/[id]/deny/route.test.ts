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

import { POST } from './route'

let tempDir = ''

function request(reason = 'denied_by_owner') {
  return new Request('http://mission-control.test/api/bridge/approval-requests/apr_run/deny', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
  }) as NextRequest
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

function insertApproval(dbPath: string) {
  const db = new Database(dbPath)
  db.prepare(`
    INSERT INTO bridge_approval_requests (
      id, workspace_id, tenant_id, connector, action, target, target_key,
      requester, requester_user_id, risk_level, approval_state,
      protected_category, approval_scope_json, scope_hash, reason,
      required_approver, correlation_id
    ) VALUES (
      'apr_run', 1, 1, 'skill.build_wiki', 'buildwiki.run_now',
      'opencloud-docs-farmer.service', 'opencloud-docs-farmer.service',
      'owner', 1, 'low', 'pending', 'tooling', '{}', 'hash',
      'reason', 'owner', 'corr_run'
    )
  `).run()
  db.close()
}

function openDb() {
  const db = new Database(mocks.dbPath)
  db.pragma('foreign_keys = ON')
  return db
}

describe('Bridge approval request deny route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-deny-route-'))
    mocks.dbPath = path.join(tempDir, 'mission-control.db')
    createSchema(mocks.dbPath)
    mocks.requireRole.mockReturnValue({
      user: { id: 1, username: 'owner', display_name: 'Owner', role: 'admin', workspace_id: 1, tenant_id: 1 },
    })
  })

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    tempDir = ''
  })

  it('rejects unauthorized denial attempts before touching persistence', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Forbidden', status: 403 })
    insertApproval(mocks.dbPath)

    const response = await POST(request(), { params: Promise.resolve({ id: 'apr_run' }) })
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toEqual({ ok: false, error: 'Forbidden' })

    const db = openDb()
    expect(db.prepare('SELECT approval_state FROM bridge_approval_requests WHERE id = ?').get('apr_run')).toMatchObject({
      approval_state: 'pending',
    })
    expect(db.prepare('SELECT COUNT(*) AS count FROM bridge_audit_events').get()).toMatchObject({ count: 0 })
    db.close()
  })

  it('denies a pending request without creating an execution run', async () => {
    insertApproval(mocks.dbPath)

    const response = await POST(request('owner denied the run'), { params: Promise.resolve({ id: 'apr_run' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'approval_request_denied_no_execution',
      approval_id: 'apr_run',
      approval_state: 'denied',
      decision: 'denied',
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(payload.audit_event_id).toMatch(/^audit_/)

    const db = openDb()
    expect(db.prepare('SELECT approval_state, resolution_reason FROM bridge_approval_requests WHERE id = ?').get('apr_run')).toMatchObject({
      approval_state: 'denied',
      resolution_reason: 'owner denied the run',
    })
    expect(db.prepare('SELECT outcome FROM bridge_audit_events WHERE approval_request_id = ?').get('apr_run')).toMatchObject({
      outcome: 'denied',
    })
    expect(db.prepare('SELECT COUNT(*) AS count FROM bridge_connector_runs WHERE approval_request_id = ?').get('apr_run')).toMatchObject({
      count: 0,
    })
    db.close()
  })

  it('keeps replayed denials non-executing and does not add a second audit row', async () => {
    insertApproval(mocks.dbPath)

    await POST(request('first denial'), { params: Promise.resolve({ id: 'apr_run' }) })
    const replay = await POST(request('second denial'), { params: Promise.resolve({ id: 'apr_run' }) })
    const payload = await replay.json()

    expect(replay.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'approval_request_denied_no_execution',
      approval_state: 'denied',
      decision: 'denied',
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      audit_event_id: null,
    })

    const db = openDb()
    expect(db.prepare('SELECT COUNT(*) AS count FROM bridge_audit_events WHERE approval_request_id = ?').get('apr_run')).toMatchObject({
      count: 1,
    })
    expect(db.prepare('SELECT COUNT(*) AS count FROM bridge_connector_runs WHERE approval_request_id = ?').get('apr_run')).toMatchObject({
      count: 0,
    })
    db.close()
  })
})
