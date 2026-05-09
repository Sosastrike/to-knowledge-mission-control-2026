import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  dbPath: '',
  execFile: vi.fn(),
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

vi.mock('node:child_process', () => ({
  __esModule: true,
  default: { execFile: mocks.execFile },
  execFile: mocks.execFile,
}))

import { POST } from './route'

let tempDir = ''

function request() {
  return new Request('http://mission-control.test/api/bridge/brain-sync/build-wiki/run-now/apr_run/dispatch', {
    method: 'POST',
  }) as NextRequest
}

function createSchema(dbPath: string) {
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
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
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (approval_request_id) REFERENCES bridge_approval_requests(id) ON DELETE SET NULL,
      FOREIGN KEY (audit_event_id) REFERENCES bridge_audit_events(id) ON DELETE SET NULL
    );
  `)
  db.close()
}

function insertApproval(dbPath: string, override: Partial<Record<string, string>> = {}) {
  const db = new Database(dbPath)
  db.prepare(`
    INSERT INTO bridge_approval_requests (
      id, workspace_id, tenant_id, connector, action, target, target_key,
      requester, requester_user_id, risk_level, approval_state,
      protected_category, approval_scope_json, scope_hash, reason,
      required_approver, resolved_at, resolved_by, correlation_id
    ) VALUES (?, 1, 1, ?, ?, ?, ?, 'owner', 1, 'low', ?, 'tooling', '{}', 'hash', 'reason', 'owner', '2026-05-09T14:00:00.000Z', 'owner', 'corr_run')
  `).run(
    override.id || 'apr_run',
    override.connector || 'skill.build_wiki',
    override.action || 'buildwiki.run_now',
    override.target || 'opencloud-docs-farmer.service',
    override.target_key || 'opencloud-docs-farmer.service',
    override.approval_state || 'approved',
  )
  db.close()
}

describe('Build-Wiki Run Now dispatch route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildwiki-run-now-dispatch-'))
    mocks.dbPath = path.join(tempDir, 'mission-control.db')
    createSchema(mocks.dbPath)
    mocks.requireRole.mockReturnValue({
      user: { id: 1, username: 'owner', display_name: 'Owner', role: 'admin', workspace_id: 1, tenant_id: 1 },
    })
    mocks.execFile.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(null, '', '')
      return { on: vi.fn() }
    })
  })

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    tempDir = ''
  })

  it('dispatches only the approved fixed service command and writes run/audit rows', async () => {
    insertApproval(mocks.dbPath)

    const response = await POST(request(), { params: Promise.resolve({ id: 'apr_run' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'run_now_dispatched_completed',
      approval_id: 'apr_run',
      run_state: 'completed',
      target_service: 'opencloud-docs-farmer.service',
      execution_enabled: true,
      accepted_for_execution: true,
    })
    expect(mocks.execFile).toHaveBeenCalledWith(
      '/usr/bin/systemctl',
      ['--user', 'start', 'opencloud-docs-farmer.service'],
      expect.objectContaining({ timeout: expect.any(Number), env: expect.any(Object) }),
      expect.any(Function),
    )

    const db = new Database(mocks.dbPath, { readonly: true })
    const run = db.prepare('SELECT run_state, target_key, audit_event_id FROM bridge_connector_runs WHERE approval_request_id = ?').get('apr_run') as any
    const audit = db.prepare('SELECT outcome, action, target_key FROM bridge_audit_events WHERE approval_request_id = ?').get('apr_run') as any
    db.close()
    expect(run.run_state).toBe('completed')
    expect(run.target_key).toBe('opencloud-docs-farmer.service')
    expect(run.audit_event_id).toBeTruthy()
    expect(audit).toEqual({
      outcome: 'completed',
      action: 'buildwiki.run_now',
      target_key: 'opencloud-docs-farmer.service',
    })
  })

  it('blocks approved requests outside the Build-Wiki Run Now scope', async () => {
    insertApproval(mocks.dbPath, {
      id: 'apr_wrong',
      connector: 'agentmail',
      action: 'agentmail.send',
      target: 'outside',
      target_key: 'agentmail:outside',
    })

    const response = await POST(request(), { params: Promise.resolve({ id: 'apr_wrong' }) })
    const payload = await response.json()

    expect(response.status).toBe(422)
    expect(payload).toMatchObject({
      ok: false,
      error: 'approval_request_out_of_scope',
      expected_action: 'buildwiki.run_now',
      expected_target_key: 'opencloud-docs-farmer.service',
      execution_enabled: false,
    })
    expect(mocks.execFile).not.toHaveBeenCalled()
  })
})
