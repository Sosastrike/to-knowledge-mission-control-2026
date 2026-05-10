import Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOrReuseAgentZeroBridgeSession, ensureAgentZeroBridgeSessionTables } from './agent-zero-bridge-session'
import { getAgentMailDeliveryStatus, sendAgentMailMessage } from './agentmail-delivery'

const ORIGINAL_ENV = { ...process.env }

function resetAgentMailEnv() {
  for (const key of [
    'AGENTMAIL_API_KEY',
    'AGENTMAIL_TOKEN',
    'AGENTMAIL_API_KEY_FILE',
    'AGENTMAIL_STATUS_ENDPOINT',
    'AGENTMAIL_INBOX_ENDPOINT',
    'AGENTMAIL_SEND_ENDPOINT',
    'AGENTMAIL_ALLOWED_DOMAINS',
    'AGENTMAIL_ALLOWED_RECIPIENTS',
  ]) {
    delete process.env[key]
  }
}

function setupDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);
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
    CREATE UNIQUE INDEX idx_bridge_approval_requests_idempotency_agentmail_test
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
  ensureAgentZeroBridgeSessionTables(db)
  return db
}

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...ORIGINAL_ENV }
})

describe('AgentMail delivery proof', () => {
  it('reports delivery as credential gated without exposing credentials or enabling writes', () => {
    resetAgentMailEnv()
    const status = getAgentMailDeliveryStatus()

    expect(status.provider).toBe('agentmail')
    expect(status.mode).toBe('agentmail_delivery')
    expect(status.required_scope).toBe('agentmail.send')
    expect(status.bridge_session_required).toBe(true)
    expect(status.execution_enabled).toBe(false)
    expect(status.writes_enabled).toBe(false)
    expect(status.no_email_sent).toBe(true)
    expect(status.no_fake_done).toBe(true)
    expect(status.canonical_status).toBe('CREDENTIAL_GATED')
    expect(status.blocked_reason).toBe('agentmail_credential_required')
    expect(JSON.stringify(status)).not.toMatch(/agentmail-placeholder|Bearer\s+[A-Za-z0-9._-]+|\/Users\/sosastrike/i)
  })

  it('blocks send without credential and does not create fake approval or send mail', async () => {
    resetAgentMailEnv()
    const db = setupDb()
    const result = await sendAgentMailMessage({
      db,
      requester: { userId: 1, username: 'owner', workspaceId: 1, tenantId: 1 },
      recipient: 'owner@example.com',
      subject: 'Day 56 proof',
      text: 'No credential means no send.',
    })

    expect(result).toMatchObject({
      ok: false,
      provider: 'agentmail',
      action: 'agentmail.send',
      status: 'blocked',
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      blocked_reason: 'agentmail_credential_required',
      approval_request_created: false,
      agentmail_message_id: null,
      no_email_sent: true,
      no_fake_done: true,
      no_tokens_exposed: true,
    })
    expect(db.prepare('SELECT COUNT(*) AS count FROM bridge_approval_requests').get()).toMatchObject({ count: 0 })
  })

  it('creates an approval request instead of sending when Bridge Session is missing', async () => {
    process.env.AGENTMAIL_API_KEY = 'agentmail-placeholder'
    process.env.AGENTMAIL_SEND_ENDPOINT = 'https://agentmail.example/send'
    process.env.AGENTMAIL_ALLOWED_DOMAINS = 'example.com'
    const db = setupDb()

    const result = await sendAgentMailMessage({
      db,
      requester: { userId: 1, username: 'owner', workspaceId: 1, tenantId: 1 },
      recipient: 'owner@example.com',
      subject: 'Day 56 proof',
      text: 'Approval first.',
    })

    expect(result.status).toBe('approval_pending')
    expect(result.accepted_for_execution).toBe(false)
    expect(result.approval_request_created).toBe(true)
    expect(result.approval_request_id).toMatch(/^apr_/)
    expect(result.no_email_sent).toBe(true)
    const approval = db.prepare('SELECT connector, action, target_key, approval_state, approval_scope_json FROM bridge_approval_requests LIMIT 1').get() as any
    expect(approval).toMatchObject({
      connector: 'agentmail',
      action: 'agentmail.send',
      target_key: 'agentmail.send',
      approval_state: 'pending',
    })
    expect(JSON.parse(approval.approval_scope_json)).toMatchObject({
      route: '/api/bridge/agent-zero/agentmail/send',
      required_scope: 'agentmail.send',
      recipient_domain: 'example.com',
      bridge_session_required: true,
    })
  })

  it('blocks recipients outside the allow-list before approval or send', async () => {
    process.env.AGENTMAIL_API_KEY = 'agentmail-placeholder'
    process.env.AGENTMAIL_SEND_ENDPOINT = 'https://agentmail.example/send'
    process.env.AGENTMAIL_ALLOWED_DOMAINS = 'example.com'
    const db = setupDb()

    const result = await sendAgentMailMessage({
      db,
      requester: { userId: 1, username: 'owner', workspaceId: 1, tenantId: 1 },
      recipient: 'other@blocked.test',
      subject: 'Day 56 proof',
      text: 'Should stay blocked.',
    })

    expect(result.status).toBe('blocked')
    expect(result.blocked_reason).toBe('agentmail_recipient_not_allowed')
    expect(result.approval_request_created).toBe(false)
    expect(result.no_email_sent).toBe(true)
  })

  it('audits and sends only after active scoped Bridge Session and configured connector', async () => {
    process.env.AGENTMAIL_API_KEY = 'agentmail-placeholder'
    process.env.AGENTMAIL_SEND_ENDPOINT = 'https://agentmail.example/send'
    process.env.AGENTMAIL_ALLOWED_DOMAINS = 'example.com'
    const db = setupDb()
    const requester = { userId: 1, username: 'owner', workspaceId: 1, tenantId: 1 }
    const session = createOrReuseAgentZeroBridgeSession({ db, requester })
    db.prepare(`UPDATE bridge_approval_requests SET approval_state = 'approved', resolved_at = ? WHERE id = ?`)
      .run('2026-05-10T10:00:00.000Z', session.session.approval_request_id)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, id: 'mail_123' }),
    } as Response)

    const result = await sendAgentMailMessage({
      db,
      requester,
      bridgeSessionId: session.session.session_id,
      recipient: 'owner@example.com',
      subject: 'Day 56 approved proof',
      text: 'This path is mocked in tests.',
    })

    expect(result).toMatchObject({
      ok: true,
      status: 'completed',
      accepted_for_execution: true,
      agentmail_message_id: 'mail_123',
      blocked_reason: null,
      no_fake_done: true,
      no_tokens_exposed: true,
    })
    expect(result.audit_event_id).toMatch(/^bsa_/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const audit = db.prepare(`SELECT action, target, outcome FROM bridge_session_audit_events WHERE action = ? LIMIT 1`)
      .get('agentmail.send') as { action: string; target: string; outcome: string } | undefined
    expect(audit).toMatchObject({
      action: 'agentmail.send',
      target: 'example.com',
      outcome: 'approved_for_send',
    })
  })
})
