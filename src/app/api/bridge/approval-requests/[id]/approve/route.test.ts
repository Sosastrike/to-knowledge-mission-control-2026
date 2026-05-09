import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  dbPath: '',
  dispatchApprovedBuildWikiRunNow: vi.fn(),
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

vi.mock('@/lib/build-wiki-run-now-dispatch', () => ({
  dispatchApprovedBuildWikiRunNow: mocks.dispatchApprovedBuildWikiRunNow,
  isBuildWikiRunNowApproval: (approval: { connector?: string; action?: string; target_key?: string } | null) =>
    approval?.connector === 'skill.build_wiki' &&
    approval?.action === 'buildwiki.run_now' &&
    approval?.target_key === 'opencloud-docs-farmer.service',
}))

import { POST } from './route'

let tempDir = ''

function request() {
  return new Request('http://mission-control.test/api/bridge/approval-requests/apr_run/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'approved_by_owner' }),
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

function insertApproval(dbPath: string, override: Partial<Record<string, string>> = {}) {
  const db = new Database(dbPath)
  db.prepare(`
    INSERT INTO bridge_approval_requests (
      id, workspace_id, tenant_id, connector, action, target, target_key,
      requester, requester_user_id, risk_level, approval_state,
      protected_category, approval_scope_json, scope_hash, reason,
      required_approver, correlation_id
    ) VALUES (?, 1, 1, ?, ?, ?, ?, 'owner', 1, 'low', 'pending', 'tooling', '{}', 'hash', 'reason', 'owner', 'corr_run')
  `).run(
    override.id || 'apr_run',
    override.connector || 'skill.build_wiki',
    override.action || 'buildwiki.run_now',
    override.target || 'opencloud-docs-farmer.service',
    override.target_key || 'opencloud-docs-farmer.service',
  )
  db.close()
}

describe('Bridge approval request approve route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-approve-route-'))
    mocks.dbPath = path.join(tempDir, 'mission-control.db')
    createSchema(mocks.dbPath)
    mocks.requireRole.mockReturnValue({
      user: { id: 1, username: 'owner', display_name: 'Owner', role: 'admin', workspace_id: 1, tenant_id: 1 },
    })
    mocks.dispatchApprovedBuildWikiRunNow.mockResolvedValue({
      ok: true,
      http_status: 200,
      mode: 'run_now_dispatched_completed',
      approval_id: 'apr_run',
      run_id: 'run_123',
      run_state: 'completed',
      target_service: 'opencloud-docs-farmer.service',
      systemctl_exit_code: 0,
      execution_enabled: true,
      accepted_for_execution: true,
      writes_enabled: true,
      audit_event_id: 'audit_run',
      blocked_reason: null,
      next_action: 'Service ran to completion. Use /status to see refreshed raw/wiki counts.',
    })
  })

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    tempDir = ''
  })

  it('dispatches the exact Build-Wiki Run Now service after owner approval', async () => {
    insertApproval(mocks.dbPath)

    const response = await POST(request(), { params: Promise.resolve({ id: 'apr_run' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      approval_id: 'apr_run',
      approval_state: 'approved',
      accepted_for_execution: true,
      execution_enabled: true,
      buildwiki_run_now_dispatch: {
        mode: 'run_now_dispatched_completed',
        run_state: 'completed',
        target_service: 'opencloud-docs-farmer.service',
      },
    })
    expect(mocks.dispatchApprovedBuildWikiRunNow).toHaveBeenCalledWith(expect.objectContaining({
      approvalId: 'apr_run',
      requester: expect.objectContaining({ username: 'owner' }),
    }))
  })

  it('does not dispatch approvals outside the Build-Wiki Run Now scope', async () => {
    insertApproval(mocks.dbPath, {
      connector: 'agentmail',
      action: 'agentmail.send',
      target: 'agentmail',
      target_key: 'agentmail.send',
    })

    const response = await POST(request(), { params: Promise.resolve({ id: 'apr_run' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      approval_id: 'apr_run',
      approval_state: 'approved',
      accepted_for_execution: false,
      execution_enabled: false,
    })
    expect(payload.buildwiki_run_now_dispatch).toBeNull()
    expect(mocks.dispatchApprovedBuildWikiRunNow).not.toHaveBeenCalled()
  })

  it('does not report ok when the approved Build-Wiki dispatch fails', async () => {
    mocks.dispatchApprovedBuildWikiRunNow.mockResolvedValue({
      ok: false,
      http_status: 502,
      mode: 'run_now_dispatched_failed',
      approval_id: 'apr_run',
      run_id: 'run_failed',
      run_state: 'failed',
      target_service: 'opencloud-docs-farmer.service',
      systemctl_exit_code: null,
      execution_enabled: true,
      accepted_for_execution: true,
      writes_enabled: true,
      audit_event_id: 'audit_failed',
      blocked_reason: 'buildwiki_run_now_systemctl_failed',
      next_action: 'Check the local service/timer status before retrying.',
    })
    insertApproval(mocks.dbPath)

    const response = await POST(request(), { params: Promise.resolve({ id: 'apr_run' }) })
    const payload = await response.json()

    expect(response.status).toBe(502)
    expect(payload).toMatchObject({
      ok: false,
      approval_id: 'apr_run',
      approval_state: 'approved',
      accepted_for_execution: true,
      execution_enabled: true,
      blocked_reason: 'buildwiki_run_now_systemctl_failed',
      buildwiki_run_now_dispatch: {
        mode: 'run_now_dispatched_failed',
        run_state: 'failed',
      },
    })
  })
})
