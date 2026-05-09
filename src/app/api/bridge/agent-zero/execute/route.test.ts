import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  executeAgentZeroBridgeAction: vi.fn(),
  listAgentZeroExecutionAdapters: vi.fn(),
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

vi.mock('@/lib/agent-zero-execution-gateway', () => ({
  AGENT_ZERO_EXECUTION_GATEWAY_ROUTE: '/api/bridge/agent-zero/execute',
  executeAgentZeroBridgeAction: mocks.executeAgentZeroBridgeAction,
  listAgentZeroExecutionAdapters: mocks.listAgentZeroExecutionAdapters,
}))

vi.mock('@/lib/agent-zero-bridge-session', () => ({
  readLatestAgentZeroBridgeSession: vi.fn(() => ({
    session: { execution_enabled: false },
  })),
}))

import { POST } from './route'

let tempDir = ''

function request(body: Record<string, unknown>) {
  return new Request('http://mission-control.test/api/bridge/agent-zero/execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
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
    CREATE UNIQUE INDEX idx_bridge_approval_requests_idempotency_execute_test
      ON bridge_approval_requests(workspace_id, tenant_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
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
  db.close()
}

function blockedRegisteredAction(action = 'mission_control.report.attach') {
  return {
    ok: false,
    http_status: 423,
    mode: 'agent_zero_bridge_execution_gateway',
    action,
    adapter_registered: true,
    adapter: {
      action,
      category: 'mission_control_attachment',
      label: 'Expose report through Mission Control',
      description: 'Returns Mission Control report links only.',
      status: 'available',
      execution_enabled: true,
      writes_enabled: false,
      bridge_session_required: true,
      allowed_scope_keys: ['mission_control.report.attach'],
      blocked_reason: null,
      safety: {
        raw_shell_enabled: false,
        arbitrary_filesystem_enabled: false,
        root_enabled: false,
        docker_socket_enabled: false,
        direct_secret_reads_enabled: false,
      },
    },
    bridge_session_required: true,
    bridge_session: {
      session_id: null,
      status: 'missing',
      expires_at: null,
      execution_enabled: false,
      blocked_reason: 'active_bridge_session_required',
    },
    execution_enabled: false,
    accepted_for_execution: false,
    writes_enabled: false,
    status: 'blocked',
    result_checked: true,
    no_fake_done: true,
    raw_local_paths_exposed: false,
    raw_shell_enabled: false,
    arbitrary_filesystem_enabled: false,
    root_enabled: false,
    docker_socket_enabled: false,
    direct_secret_reads_enabled: false,
    audit: {
      started: false,
      finished: false,
      start_event_id: null,
      finish_event_id: null,
      blocked_reason: null,
    },
    result: null,
    normal_reply: 'Agent Zero needs an active Bridge Session before this adapter can run.',
    blocked_reason: 'active_bridge_session_required',
    error: null,
  }
}

function openDb() {
  const db = new Database(mocks.dbPath)
  db.pragma('foreign_keys = ON')
  return db
}

describe('Agent Zero execute route Bridge approval integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-zero-execute-route-'))
    mocks.dbPath = path.join(tempDir, 'mission-control.db')
    createSchema(mocks.dbPath)
    mocks.requireRole.mockReturnValue({
      user: { id: 1, username: 'owner', display_name: 'Owner', role: 'admin', workspace_id: 1, tenant_id: 1 },
    })
    mocks.listAgentZeroExecutionAdapters.mockReturnValue([])
    mocks.executeAgentZeroBridgeAction.mockResolvedValue(blockedRegisteredAction())
  })

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    tempDir = ''
  })

  it('creates exactly one pending approval request for a registered Agent Zero action blocked by missing Bridge Session', async () => {
    const response = await POST(request({
      action: 'mission_control.report.attach',
      input: { title: 'Day 30 proof' },
    }))
    const payload = await response.json()

    expect(response.status).toBe(423)
    expect(payload).toMatchObject({
      ok: false,
      action: 'mission_control.report.attach',
      blocked_reason: 'active_bridge_session_required',
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      approval_request_created: true,
      approval_request_reused: false,
      approval_state: 'pending',
      request_dispatched: false,
    })
    expect(payload.approval_request_id).toMatch(/^apr_/)

    const db = openDb()
    const approval = db.prepare(`
      SELECT connector, action, target, target_key, approval_state, protected_category, risk_level, approval_scope_json
      FROM bridge_approval_requests
      WHERE id = ?
    `).get(payload.approval_request_id) as {
      connector: string
      action: string
      target: string
      target_key: string
      approval_state: string
      protected_category: string
      risk_level: string
      approval_scope_json: string
    }
    expect(approval).toMatchObject({
      connector: 'agent_zero',
      action: 'agent_zero.execute',
      target: 'mission_control.report.attach',
      target_key: 'mission_control.report.attach',
      approval_state: 'pending',
      protected_category: 'agent_execution',
      risk_level: 'medium',
    })
    expect(JSON.parse(approval.approval_scope_json)).toMatchObject({
      route: '/api/bridge/agent-zero/execute',
      requested_action: 'mission_control.report.attach',
      allowed_scope_keys: ['mission_control.report.attach'],
      bridge_session_required: true,
    })
    expect(db.prepare('SELECT outcome FROM bridge_audit_events WHERE approval_request_id = ?').get(payload.approval_request_id)).toMatchObject({
      outcome: 'approval_requested',
    })
    db.close()
  })

  it('reuses the pending approval request on repeated blocked Agent Zero action attempts', async () => {
    const first = await POST(request({ action: 'mission_control.report.attach' }))
    const firstPayload = await first.json()
    const second = await POST(request({ action: 'mission_control.report.attach' }))
    const secondPayload = await second.json()

    expect(second.status).toBe(423)
    expect(secondPayload).toMatchObject({
      approval_request_created: true,
      approval_request_reused: true,
      approval_request_id: firstPayload.approval_request_id,
      request_dispatched: false,
    })

    const db = openDb()
    expect(db.prepare('SELECT COUNT(*) AS count FROM bridge_approval_requests').get()).toMatchObject({ count: 1 })
    expect(db.prepare('SELECT COUNT(*) AS count FROM bridge_audit_events').get()).toMatchObject({ count: 1 })
    db.close()
  })
})
