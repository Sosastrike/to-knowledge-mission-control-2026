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

    const db = new Database(mocks.dbPath, { readonly: true })
    const approval = db.prepare('SELECT action, target_key, approval_state FROM bridge_approval_requests LIMIT 1').get() as any
    const audit = db.prepare('SELECT outcome, action, target_key FROM bridge_audit_events LIMIT 1').get() as any
    db.close()
    expect(approval).toEqual({
      action: 'buildwiki.run_now',
      target_key: 'opencloud-docs-farmer.service',
      approval_state: 'pending',
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
})
