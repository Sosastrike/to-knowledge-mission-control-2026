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

import { GET, POST } from './route'

let tempDir = ''

function request(body: Record<string, unknown> = {}) {
  return new Request('http://mission-control.test/api/bridge/brain-sync/build-wiki/run-now', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as NextRequest
}

function getRequest() {
  return new Request('http://mission-control.test/api/bridge/brain-sync/build-wiki/run-now', {
    method: 'GET',
  }) as NextRequest
}

function createSchema(dbPath: string) {
  const db = new Database(dbPath)
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
    CREATE UNIQUE INDEX idx_bridge_approval_requests_idempotency_test
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

describe('Build-Wiki Run Now route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildwiki-run-now-route-'))
    mocks.dbPath = path.join(tempDir, 'mission-control.db')
    createSchema(mocks.dbPath)
    mocks.requireRole.mockReturnValue({
      user: {
        id: 1,
        username: 'owner',
        display_name: 'Owner',
        role: 'admin',
        workspace_id: 1,
        tenant_id: 1,
      },
    })
  })

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    tempDir = ''
  })

  it('creates a scoped owner approval request and keeps execution disabled', async () => {
    const response = await POST(request({ reason: 'owner requested one run now' }))
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'run_now_approval_requested_no_execution',
      approval_request_created: true,
      approval_state: 'pending',
      required_scope: 'buildwiki.run_now',
      target_service: 'opencloud-docs-farmer.service',
      execution_enabled: false,
      accepted_for_execution: false,
      writes_enabled: false,
      ui_state: 'pending_approval',
    })
    expect(payload.dispatch_route).toContain('/api/bridge/brain-sync/build-wiki/run-now/')
    expect(payload.approval_route).toContain('/api/bridge/approval-requests/')

    const db = new Database(mocks.dbPath, { readonly: true })
    const approval = db.prepare('SELECT action, target_key, approval_state, approval_scope_json FROM bridge_approval_requests LIMIT 1').get() as any
    const audit = db.prepare('SELECT outcome, action, target_key FROM bridge_audit_events LIMIT 1').get() as any
    db.close()
    expect(approval).toMatchObject({
      action: 'buildwiki.run_now',
      target_key: 'opencloud-docs-farmer.service',
      approval_state: 'pending',
    })
    expect(JSON.parse(approval.approval_scope_json)).toMatchObject({
      action: 'buildwiki.run_now',
      target_service: 'opencloud-docs-farmer.service',
      command: ['systemctl', '--user', 'start', 'opencloud-docs-farmer.service'],
      fork: 'fork_1_only',
      no_smb: true,
      no_fork_2: true,
      no_external_farmers: true,
      no_second_vault: true,
      no_immediate_execution: true,
    })
    expect(audit).toEqual({
      outcome: 'approval_requested',
      action: 'buildwiki.run_now',
      target_key: 'opencloud-docs-farmer.service',
    })
  })

  it('reuses an existing pending request instead of creating approval spam', async () => {
    const first = await POST(request({ reason: 'probe', idempotency_key: 'run-now-test' }))
    const firstPayload = await first.json()
    const second = await POST(request({ reason: 'probe again', idempotency_key: 'run-now-test' }))
    const secondPayload = await second.json()

    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(secondPayload).toMatchObject({
      ok: true,
      approval_request_created: false,
      reused_existing: true,
      approval_id: firstPayload.approval_id,
      execution_enabled: false,
      accepted_for_execution: false,
    })
  })

  it('reads the latest Run Now state without executing', async () => {
    await POST(request({ reason: 'read probe' }))
    const response = await GET(getRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'run_now_read_only',
      persistence_ready: true,
      ui_state: 'pending_approval',
      execution_enabled: false,
      accepted_for_execution: false,
    })
    expect(payload.approval).toMatchObject({
      approval_state: 'pending',
      risk_level: 'low',
      protected_category: 'tooling',
    })
  })

  it('returns the Run Now approval, dispatch, and audit history without raw paths or secrets', async () => {
    const created = await POST(request({ reason: 'history probe' }))
    const createdPayload = await created.json()
    const approvalId = createdPayload.approval_id

    const db = new Database(mocks.dbPath)
    db.prepare(
      `UPDATE bridge_approval_requests
          SET approval_state = 'approved',
              resolved_at = '2026-05-09T12:00:00.000Z',
              resolved_by = 'owner',
              resolved_by_user_id = 1,
              resolution_reason = 'approved exact scoped test'
        WHERE id = ?`,
    ).run(approvalId)
    db.prepare(
      `INSERT INTO bridge_connector_runs (
         id, workspace_id, tenant_id, connector, action, target, target_key,
         approval_request_id, audit_event_id, run_state, risk_level, input_hash,
         rollback_ref, started_at, finished_at, correlation_id
       ) VALUES (
         'run_history', 1, 1, 'skill.build_wiki', 'buildwiki.run_now',
         'opencloud-docs-farmer.service', 'opencloud-docs-farmer.service',
         ?, 'audit_failed', 'failed', 'low', 'inputhash',
         'systemctl --user stop opencloud-docs-farmer.service',
         '2026-05-09T12:01:00.000Z', '2026-05-09T12:01:04.000Z', 'corr_history'
       )`,
    ).run(approvalId)
    db.prepare(
      `INSERT INTO bridge_audit_events (
         id, workspace_id, tenant_id, approval_request_id, actor, actor_user_id,
         connector, action, target, target_key, outcome, payload_hash,
         metadata_json, correlation_id
       ) VALUES (
         'audit_failed', 1, 1, ?, 'owner', 1, 'skill.build_wiki',
         'buildwiki.run_now', 'opencloud-docs-farmer.service',
         'opencloud-docs-farmer.service', 'failed', 'payloadhash',
         '{"stderr_tail_present":true}', 'corr_history'
       )`,
    ).run(approvalId)
    db.close()

    const response = await GET(getRequest())
    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'run_now_read_only',
      ui_state: 'failed',
      history_count: 1,
      execution_enabled: false,
      accepted_for_execution: false,
    })
    expect(payload.history[0]).toMatchObject({
      ui_state: 'failed',
      result_label: 'service_down',
      approval: {
        id: approvalId,
        action: 'buildwiki.run_now',
        target_key: 'opencloud-docs-farmer.service',
        approval_state: 'approved',
      },
      run: {
        id: 'run_history',
        run_state: 'failed',
        rollback_ref: 'systemctl --user stop opencloud-docs-farmer.service',
      },
    })
    expect(payload.history[0].audit_events.map((event: { outcome: string }) => event.outcome)).toEqual([
      'approval_requested',
      'failed',
    ])
    expect(serialized).not.toMatch(/\/home\/|\/Users\/|sk-[A-Za-z0-9]{20,}|Bearer\s+/)
  })
})
