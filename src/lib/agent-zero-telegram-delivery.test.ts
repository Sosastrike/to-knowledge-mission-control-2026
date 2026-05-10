import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAgentZeroReport } from './agent-zero-report-delivery'
import { createOrReuseAgentZeroBridgeSession, ensureAgentZeroBridgeSessionTables } from './agent-zero-bridge-session'
import { getAgentZeroTelegramDeliveryStatus, uploadAgentZeroReportToTelegram } from './agent-zero-telegram-delivery'

const ORIGINAL_ENV = { ...process.env }

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
  `)
  ensureAgentZeroBridgeSessionTables(db)
  return db
}

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'az-telegram-delivery-'))
}

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...ORIGINAL_ENV }
})

describe('Agent Zero Telegram delivery adapter', () => {
  it('reports blocked status when connector credentials are missing', () => {
    const status = getAgentZeroTelegramDeliveryStatus()
    expect(status.provider).toBe('telegram')
    expect(status.bridge_session_required).toBe(true)
    expect(status.required_scope).toBe('telegram.upload_report_pdf')
    expect(status.active_commander).toBe('agent_zero')
    expect(status.owner_command_route).toBe('agent_zero')
    expect(status.tony_active).toBe(false)
    expect(status.inbound_owner_validation_model).toBe('owner_chat_id_match_required')
    expect(status.proof_packet).toMatchObject({
      lane: 'Telegram owner command lane',
      active_commander: 'agent_zero',
      owner_command_route: 'agent_zero',
      tony_active: false,
      bridge_session_required: true,
      send_enabled_without_bridge: false,
      inbound_owner_validation_required: true,
      fake_delivery_allowed: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    })
    if (!status.connector_configured) {
      expect(status.canonical_status).toBe('CREDENTIAL_GATED')
      expect(status.blocker_class).toBe('CREDENTIAL_GATED')
      expect(status.blocked_reason).toBe('telegram_report_delivery_adapter_not_configured')
      expect(status.no_tokens_exposed).toBe(true)
    } else {
      expect(status.canonical_status).toBe('OWNER_GATED')
      expect(status.blocker_class).toBe('OWNER_GATED')
    }
    expect(JSON.stringify(status)).not.toMatch(/sk-[A-Za-z0-9]{20,}|bot[0-9]+:[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|\/Users\/sosastrike/i)
  })

  it('blocks upload when report id is missing or unknown without fake completion', async () => {
    const result = await uploadAgentZeroReportToTelegram({
      requester: { userId: 1, username: 'tester', workspaceId: 1, tenantId: 1 },
      reportId: 'azr_invalid_123456789abc',
      bridgeSessionId: null,
    })
    expect(result.ok).toBe(false)
    expect(result.status).toBe('blocked')
    expect(result.accepted_for_execution).toBe(false)
    expect(result.blocked_reason).toBe('agent_zero_report_not_found')
    expect(result.no_fake_done).toBe(true)
    expect(result.no_tokens_exposed).toBe(true)
    expect(result.required_scope).toBe('telegram.upload_report_pdf')
    expect(result.audit_event_id).toBeNull()
  })

  it('blocks known report upload until an active Bridge Session exists', async () => {
    const root = makeRoot()
    process.env.AGENT_ZERO_REPORT_ROOT = root
    const report = await createAgentZeroReport({
      root,
      title: 'Telegram Blocked Report',
      summary: 'Report exists, but no active Bridge Session exists.',
      ownerMessage: 'Create this report and attach the PDF in Telegram',
    })

    const result = await uploadAgentZeroReportToTelegram({
      db: setupDb(),
      requester: { userId: 1, username: 'owner', workspaceId: 1, tenantId: 1 },
      reportId: report.report.id,
      bridgeSessionId: null,
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('blocked')
    expect(result.blocked_reason).toBe('active_bridge_session_required')
    expect(result.accepted_for_execution).toBe(false)
    expect(result.audit_event_id).toBeNull()
    expect(result.report_link).toBe(report.report.mission_control_url)
    expect(result.normal_reply).not.toMatch(/^Done\b/)
  })

  it('audits and sends only after active Bridge Session and Telegram connector are configured', async () => {
    const root = makeRoot()
    process.env.AGENT_ZERO_REPORT_ROOT = root
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token-placeholder'
    process.env.AGENT_ZERO_OWNER_TELEGRAM_CHAT_ID = 'owner-chat-placeholder'
    const db = setupDb()
    const requester = { userId: 1, username: 'owner', workspaceId: 1, tenantId: 1 }
    const session = createOrReuseAgentZeroBridgeSession({ db, requester })
    db.prepare(`UPDATE bridge_approval_requests SET approval_state = 'approved', resolved_at = ? WHERE id = ?`)
      .run('2026-05-10T10:00:00.000Z', session.session.approval_request_id)
    const report = await createAgentZeroReport({
      root,
      title: 'Telegram Approved Report',
      summary: 'Report exists and active Bridge Session is available.',
      ownerMessage: 'Create this report and attach the PDF in Telegram',
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 99 } }),
    } as Response)

    const result = await uploadAgentZeroReportToTelegram({
      db,
      requester,
      reportId: report.report.id,
      bridgeSessionId: session.session.session_id,
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe('completed')
    expect(result.telegram_message_id).toBe(99)
    expect(result.audit_event_id).toMatch(/^bsa_/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const audit = db.prepare(`SELECT action, target, outcome FROM bridge_session_audit_events WHERE action = ? LIMIT 1`)
      .get('telegram.upload_report_pdf') as { action: string; target: string; outcome: string } | undefined
    expect(audit).toMatchObject({
      action: 'telegram.upload_report_pdf',
      target: report.report.id,
      outcome: 'approved_for_send',
    })
  })
})
