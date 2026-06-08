import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type Database from 'better-sqlite3'

import { createApprovalRequest, getApprovalRequest, listApprovalRequests, resolveApprovalRequest } from '@/lib/approval-requests'
import {
  AGENTMAIL_PERMISSION_KEYS,
  createAndStoreAgentMailScopedCredential,
  loadAgentMailCredentialSecret,
  resolveAgentMailBootstrapCredential,
  resolveAgentMailScopedCredential,
  upsertAgentMailScopedCredentialMetadata,
  type AgentMailPermission,
  type AgentMailPermissionMap,
} from '@/lib/agentmail-credential-resolver'
import { sendAgentMailMessage, type AgentMailAdapterSendResult } from '@/lib/agentmail-send-adapter'

import { config, ensureDirExists } from '@/lib/config'
import { getDatabase } from '@/lib/db'
import { loadSecretMasterKey } from '@/lib/provider-vault'

export type AgentMailAutonomyLevel = 'L0_monitor_only' | 'L1_draft_only' | 'L2_approval_gated_send'
export type AgentMailMonitorState = 'running' | 'degraded' | 'stopped'
export type AgentMailConnectStatus =
  | 'credential_required'
  | 'owner_sso_required'
  | 'oauth_pending'
  | 'api_key_required'
  | 'connected'
  | 'organization_selected'
  | 'sync_ready'
  | 'inbox_sync_complete'
  | 'bridge_session_required'
  | 'monitor_ready'
  | 'error'
export type AgentMailEventType =
  | 'message.received'
  | 'message.sent'
  | 'message.delivered'
  | 'message.bounced'
  | 'message.complained'
  | 'message.rejected'

export type AgentMailInboxRecord = {
  agent_id: string
  display_name: string
  role: string
  inbox_address: string | null
  client_id: string
  autonomy_level: AgentMailAutonomyLevel
  owner_approval_required: boolean
  provision_state: 'not_provisioned' | 'assigned' | 'disabled'
}

type AgentMailInboxRow = Omit<AgentMailInboxRecord, 'owner_approval_required'> & {
  owner_approval_required: number
}

export type NormalizedAgentMailEvent = {
  event_id: string
  source: 'agentmail'
  event_type: AgentMailEventType
  inbox_id: string
  agent_id: string
  thread_id: string
  message_id: string
  direction: 'inbound' | 'outbound'
  sender_preview: string
  sender_domain: string | null
  sender_hash: string
  subject: string
  received_at: string
  classification: 'unknown'
  policy_state: 'pending_gateway_review'
  autonomy_level: AgentMailAutonomyLevel
  outbound_send_enabled: false
  owner_approval_required: true
  credential_values_exposed: false
  raw_secret_values_exposed: false
}

const SAFE_FLAGS = {
  credential_values_exposed: false,
  tokens_exposed: false,
  env_values_exposed: false,
  raw_secret_values_exposed: false,
}

export const AGENTMAIL_CONSOLE_URL = 'https://console.agentmail.to'
export const AGENTMAIL_MCP_URL = 'https://mcp.agentmail.to/mcp'

const ALLOWED_EVENTS: AgentMailEventType[] = [
  'message.received',
  'message.sent',
  'message.delivered',
  'message.bounced',
  'message.complained',
  'message.rejected',
]

const DEFAULT_INBOXES: AgentMailInboxRecord[] = [
  { agent_id: 'pi', display_name: 'Pi', role: 'reasoning_observer', inbox_address: null, client_id: 'mission-pi-inbox-v1', autonomy_level: 'L1_draft_only', owner_approval_required: true, provision_state: 'not_provisioned' },
  { agent_id: 'agent_zero', display_name: 'Agent Zero', role: 'command_triage', inbox_address: null, client_id: 'mission-agent-zero-inbox-v1', autonomy_level: 'L1_draft_only', owner_approval_required: true, provision_state: 'not_provisioned' },
  { agent_id: 'gateway', display_name: 'Gateway', role: 'policy_router', inbox_address: null, client_id: 'mission-gateway-inbox-v1', autonomy_level: 'L0_monitor_only', owner_approval_required: true, provision_state: 'not_provisioned' },
  { agent_id: 'bridge_unit', display_name: 'Bridge Unit', role: 'event_translation_queue', inbox_address: null, client_id: 'mission-bridge-inbox-v1', autonomy_level: 'L0_monitor_only', owner_approval_required: true, provision_state: 'not_provisioned' },
  { agent_id: 'agentmail_monitor', display_name: 'Mission Control Monitor', role: 'health_monitor', inbox_address: null, client_id: 'mission-agentmail-monitor-v1', autonomy_level: 'L0_monitor_only', owner_approval_required: true, provision_state: 'not_provisioned' },
  { agent_id: 'agentmail_audit', display_name: 'Audit Archive', role: 'audit_export_identity', inbox_address: null, client_id: 'mission-agentmail-audit-v1', autonomy_level: 'L0_monitor_only', owner_approval_required: true, provision_state: 'not_provisioned' },
]

const statusPath = path.join(config.dataDir, 'agentmail-local-monitor-status.json')

function nowIso() {
  return new Date().toISOString()
}

function sanitizeText(value: unknown, fallback = '', max = 240) {
  return String(value || fallback)
    .replace(/\b(?:sk-|gsk_|nva-|xai-|am_|Bearer\s+)[A-Za-z0-9._-]{8,}\b/gi, '[redacted]')
    .replace(/(?:SECRET|SECRET[_-]?KEY|TOKEN|PASSWORD|API[_-]?KEY)\s*[:=]\s*[^,\s}]+/gi, '[redacted]')
    .replace(/(?:\/home\/tony|\/tmp|\/var\/folders)[^\s`'"\])}]*/g, '<server-local-path>')
    .trim()
    .slice(0, max)
}

function sha(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function emailDomain(value: string) {
  const match = value.toLowerCase().match(/@([^>\s]+)$/)
  return match ? match[1] : null
}

function previewEmail(value: string) {
  const clean = value.trim().toLowerCase()
  const domain = emailDomain(clean)
  if (!clean || !domain) return 'unknown'
  const first = clean[0] || 'u'
  return `${first}***@${domain}`
}

function maskAgentMailKey(value: string) {
  const clean = String(value || '').trim()
  if (!clean) return null
  const suffix = clean.slice(-4)
  return `am_****${suffix}`
}

function detectAgentMailMcpConfig() {
  const candidates = [
    process.env.CLAUDE_CONFIG_PATH,
    process.env.HOME ? path.join(process.env.HOME, '.claude.json') : null,
    '/home/tony/.claude.json',
  ].filter(Boolean) as string[]

  for (const file of candidates) {
    try {
      if (fs.readFileSync(file, 'utf8').includes(AGENTMAIL_MCP_URL)) return true
    } catch {
      // Missing or unreadable local CLI config is not a Mission Control runtime error.
    }
  }
  return false
}

function tableExists(db: Database.Database, name: string) {
  return Boolean(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name))
}

export function ensureAgentMailSchema(db: Database.Database = getDatabase()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agentmail_inboxes (
      agent_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      inbox_address TEXT,
      client_id TEXT NOT NULL UNIQUE,
      autonomy_level TEXT NOT NULL,
      owner_approval_required INTEGER NOT NULL DEFAULT 1,
      provision_state TEXT NOT NULL DEFAULT 'not_provisioned',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS agentmail_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      inbox_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      sender_preview TEXT NOT NULL,
      sender_domain TEXT,
      sender_hash TEXT NOT NULL,
      subject TEXT NOT NULL,
      received_at TEXT NOT NULL,
      classification TEXT NOT NULL,
      policy_state TEXT NOT NULL,
      autonomy_level TEXT NOT NULL,
      raw_payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS agentmail_bridge_queue (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      task_candidate_state TEXT NOT NULL,
      policy_state TEXT NOT NULL,
      outbound_send_enabled INTEGER NOT NULL DEFAULT 0,
      owner_approval_required INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS agentmail_approvals (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      action_type TEXT NOT NULL,
      state TEXT NOT NULL,
      exact_blocker TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS agentmail_audit (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      action TEXT NOT NULL,
      result TEXT NOT NULL,
      detail TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS agentmail_bridge_sessions (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      approval_request_id TEXT,
      requester TEXT NOT NULL,
      expires_at TEXT,
      max_sends_per_session_per_agent INTEGER NOT NULL DEFAULT 10,
      max_recipients_per_send INTEGER NOT NULL DEFAULT 10,
      sends_dispatched INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS agentmail_send_requests (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      inbox_id TEXT NOT NULL,
      to_json TEXT NOT NULL,
      cc_json TEXT NOT NULL DEFAULT '[]',
      bcc_json TEXT NOT NULL DEFAULT '[]',
      subject TEXT NOT NULL,
      text_body TEXT NOT NULL,
      html_body TEXT,
      thread_id TEXT,
      reply_to_message_id TEXT,
      labels_json TEXT NOT NULL DEFAULT '[]',
      state TEXT NOT NULL,
      gateway_policy TEXT NOT NULL,
      exact_blocker TEXT,
      approval_request_id TEXT,
      bridge_session_id TEXT,
      message_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS agentmail_dispatch_runtime (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'always_on',
      enabled INTEGER NOT NULL DEFAULT 1,
      autostart INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      owner_enabled INTEGER NOT NULL DEFAULT 1,
      emergency_stop INTEGER NOT NULL DEFAULT 0,
      default_policy TEXT NOT NULL DEFAULT 'approval_gated_send',
      external_send_policy TEXT NOT NULL DEFAULT 'approval_required',
      allow_registered_agents INTEGER NOT NULL DEFAULT 1,
      max_sends_per_hour INTEGER NOT NULL DEFAULT 10,
      max_recipients_per_send INTEGER NOT NULL DEFAULT 10,
      sends_dispatched INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  db.prepare(`
    INSERT INTO agentmail_dispatch_runtime (
      id, mode, enabled, autostart, status, owner_enabled, emergency_stop,
      default_policy, external_send_policy, allow_registered_agents,
      max_sends_per_hour, max_recipients_per_send
    )
    VALUES (
      'agentmail_dispatch_runtime', 'always_on', 1, 1, 'active', 1, 0,
      'approval_gated_send', 'approval_required', 1, 10, 10
    )
    ON CONFLICT(id) DO NOTHING
  `).run()

  const insert = db.prepare(`
    INSERT INTO agentmail_inboxes (
      agent_id, display_name, role, inbox_address, client_id,
      autonomy_level, owner_approval_required, provision_state
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id) DO NOTHING
  `)
  for (const row of DEFAULT_INBOXES) {
    insert.run(row.agent_id, row.display_name, row.role, row.inbox_address, row.client_id, row.autonomy_level, row.owner_approval_required ? 1 : 0, row.provision_state)
  }
}

export function listAgentMailInboxes(db: Database.Database = getDatabase()): AgentMailInboxRecord[] {
  ensureAgentMailSchema(db)
  const rows = db.prepare(`
    SELECT agent_id, display_name, role, inbox_address, client_id, autonomy_level,
           owner_approval_required, provision_state
    FROM agentmail_inboxes
    ORDER BY CASE agent_id
      WHEN 'pi' THEN 1
      WHEN 'agent_zero' THEN 2
      WHEN 'gateway' THEN 3
      WHEN 'bridge_unit' THEN 4
      WHEN 'agentmail_monitor' THEN 5
      WHEN 'agentmail_audit' THEN 6
      ELSE 99
    END, agent_id
  `).all() as AgentMailInboxRow[]
  return rows.map((row) => ({
    ...row,
    owner_approval_required: Boolean(row.owner_approval_required),
  }))
}

export function validateInboxRegistry(inboxes: AgentMailInboxRecord[]) {
  const assigned = inboxes.filter((row) => row.inbox_address)
  const duplicates = new Set<string>()
  const seen = new Set<string>()
  for (const row of assigned) {
    const addr = String(row.inbox_address).toLowerCase()
    if (seen.has(addr)) duplicates.add(addr)
    seen.add(addr)
  }
  return {
    ok: duplicates.size === 0,
    duplicate_inboxes: [...duplicates],
    shared_autonomous_inbox_detected: duplicates.size > 0,
    ...SAFE_FLAGS,
  }
}

export function recordAgentMailAudit(
  db: Database.Database,
  action: string,
  result: 'ok' | 'blocked' | 'error' = 'ok',
  detail = '',
  eventId: string | null = null,
) {
  ensureAgentMailSchema(db)
  const safeAction = sanitizeText(action, 'agentmail_audit_event', 120)
  const safeResult = result === 'ok' || result === 'blocked' || result === 'error' ? result : 'blocked'
  const safeDetail = sanitizeText(detail, '', 320)
  const id = `audit_${sha(`${safeAction}:${safeResult}:${safeDetail}:${nowIso()}`).slice(0, 20)}`
  db.prepare(`
    INSERT INTO agentmail_audit (id, event_id, action, result, detail)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, eventId, safeAction, safeResult, safeDetail)
  return { id, action: safeAction, result: safeResult, detail: safeDetail, ...SAFE_FLAGS }
}

export function normalizeAgentMailEvent(payload: Record<string, unknown>, inboxes: AgentMailInboxRecord[] = DEFAULT_INBOXES): NormalizedAgentMailEvent {
  const eventType = ALLOWED_EVENTS.includes(payload.type as AgentMailEventType) ? payload.type as AgentMailEventType : 'message.received'
  const rawInbox = sanitizeText(payload.inbox_id || payload.inbox || payload.to || 'unassigned', 'unassigned', 160)
  const inbox = inboxes.find((row) => row.inbox_address && row.inbox_address.toLowerCase() === rawInbox.toLowerCase()) ||
    inboxes.find((row) => row.agent_id === payload.agent_id) ||
    inboxes.find((row) => row.agent_id === 'bridge_unit') ||
    DEFAULT_INBOXES[3]
  const rawSender = sanitizeText(payload.sender || payload.from || 'unknown', 'unknown', 220)
  const receivedAt = sanitizeText(payload.received_at || payload.created_at || nowIso(), nowIso(), 80)
  const messageId = sanitizeText(payload.message_id || payload.id || `msg_${sha(JSON.stringify(payload)).slice(0, 16)}`, 'msg_unknown', 120)
  const eventId = sanitizeText(payload.event_id || `agentmail_${sha(`${eventType}:${messageId}:${receivedAt}`).slice(0, 20)}`, 'agentmail_event', 120)
  const direction = eventType === 'message.received' ? 'inbound' : 'outbound'

  return {
    event_id: eventId,
    source: 'agentmail',
    event_type: eventType,
    inbox_id: rawInbox,
    agent_id: inbox.agent_id,
    thread_id: sanitizeText(payload.thread_id || `thread_${messageId}`, 'thread_unknown', 120),
    message_id: messageId,
    direction,
    sender_preview: previewEmail(rawSender),
    sender_domain: emailDomain(rawSender),
    sender_hash: sha(rawSender),
    subject: sanitizeText(payload.subject || '(no subject)', '(no subject)', 220),
    received_at: receivedAt,
    classification: 'unknown',
    policy_state: 'pending_gateway_review',
    autonomy_level: inbox.autonomy_level,
    outbound_send_enabled: false,
    owner_approval_required: true,
    credential_values_exposed: false,
    raw_secret_values_exposed: false,
  }
}

export function ingestAgentMailEvent(payload: Record<string, unknown>, db: Database.Database = getDatabase()) {
  ensureAgentMailSchema(db)
  const event = normalizeAgentMailEvent(payload, listAgentMailInboxes(db))
  const rawPayloadJson = JSON.stringify({
    type: event.event_type,
    event_id: event.event_id,
    message_id: event.message_id,
    thread_id: event.thread_id,
    subject: event.subject,
    sender_preview: event.sender_preview,
    sender_domain: event.sender_domain,
    credential_values_exposed: false,
  })
  db.transaction(() => {
    db.prepare(`
      INSERT INTO agentmail_events (
        event_id, event_type, inbox_id, agent_id, thread_id, message_id,
        direction, sender_preview, sender_domain, sender_hash, subject, received_at,
        classification, policy_state, autonomy_level, raw_payload_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO NOTHING
    `).run(
      event.event_id,
      event.event_type,
      event.inbox_id,
      event.agent_id,
      event.thread_id,
      event.message_id,
      event.direction,
      event.sender_preview,
      event.sender_domain,
      event.sender_hash,
      event.subject,
      event.received_at,
      event.classification,
      event.policy_state,
      event.autonomy_level,
      rawPayloadJson,
    )
    db.prepare(`
      INSERT INTO agentmail_bridge_queue (id, event_id, thread_id, task_candidate_state, policy_state, outbound_send_enabled, owner_approval_required)
      VALUES (?, ?, ?, 'candidate_pending_classification', ?, 0, 1)
      ON CONFLICT(id) DO NOTHING
    `).run(`amq_${event.event_id}`, event.event_id, event.thread_id, event.policy_state)
    db.prepare(`
      INSERT INTO agentmail_approvals (id, event_id, action_type, state, exact_blocker)
      VALUES (?, ?, 'outbound_send', 'blocked', 'agentmail_owner_approval_required')
      ON CONFLICT(id) DO NOTHING
    `).run(`ama_${event.event_id}`, event.event_id)
    db.prepare(`
      INSERT INTO agentmail_audit (id, event_id, action, result, detail)
      VALUES (?, ?, 'event_ingested', 'ok', ?)
      ON CONFLICT(id) DO NOTHING
    `).run(`audit_${event.event_id}`, event.event_id, `type=${event.event_type};policy=${event.policy_state}`)
  })()
  return event
}

function readMonitorStatusFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statusPath, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

export function writeAgentMailMonitorStatus(status: Record<string, unknown>) {
  ensureDirExists(path.dirname(statusPath))
  fs.writeFileSync(statusPath, `${JSON.stringify({
    updated_at: nowIso(),
    ...status,
    ...SAFE_FLAGS,
  }, null, 2)}\n`, 'utf8')
}

export function buildAgentMailStatus(db: Database.Database = getDatabase(), env: Record<string, string | undefined> = process.env) {
  ensureAgentMailSchema(db)
  const monitor = readMonitorStatusFile()
  const updatedAt = typeof monitor?.updated_at === 'string' ? monitor.updated_at : null
  const ageMs = updatedAt ? Date.now() - Date.parse(updatedAt) : Number.POSITIVE_INFINITY
  const bootstrap = resolveAgentMailBootstrapCredential({ db, env })
  const hasCredential = Boolean(env.AGENTMAIL_API_KEY || env.AGENTMAIL_TOKEN || env.AGENTMAIL_CREDENTIAL_REF || env.AGENTMAIL_API_KEY_REF)
  const hasRuntimeCredential = hasCredential || bootstrap.keyAvailable
  const hasWsUrl = Boolean(env.AGENTMAIL_WS_URL)
  const state: AgentMailMonitorState = monitor?.state === 'running' && ageMs < 90_000
    ? 'running'
    : hasRuntimeCredential || hasWsUrl
      ? 'degraded'
      : 'stopped'
  const inboxCount = (db.prepare(`SELECT COUNT(*) AS count FROM agentmail_inboxes`).get() as { count: number }).count
  const eventCount = tableExists(db, 'agentmail_events')
    ? (db.prepare(`SELECT COUNT(*) AS count FROM agentmail_events`).get() as { count: number }).count
    : 0
  return {
    ok: true,
    source: 'agentmail_local_control',
    generated_at: nowIso(),
    state,
    local_monitor: {
      state,
      updated_at: updatedAt,
      websocket_connected: Boolean(monitor?.websocket_connected && state === 'running'),
      subscribed_inboxes: Number(monitor?.subscribed_inboxes || 0),
      subscribed_event_types: ALLOWED_EVENTS,
      last_event_at: typeof monitor?.last_event_at === 'string' ? monitor.last_event_at : null,
      exact_blocker: state === 'running' ? null : hasRuntimeCredential ? 'agentmail_websocket_listener_not_running' : 'agentmail_credential_required',
    },
    runtime_credentials: {
      agentmail_api_key: env.AGENTMAIL_API_KEY ? 'detected' : 'missing',
      agentmail_api_key_ref: env.AGENTMAIL_API_KEY_REF
        ? (bootstrap.keyAvailable ? 'resolved' : bootstrap.exact_blocker === 'agentmail_runtime_secret_store_required' ? 'unresolved' : 'detected')
        : 'missing',
      agentmail_credential_ref: env.AGENTMAIL_CREDENTIAL_REF
        ? (bootstrap.keyAvailable ? 'resolved' : bootstrap.exact_blocker === 'agentmail_runtime_secret_store_required' ? 'unresolved' : 'detected')
        : 'missing',
      agentmail_org_id: env.AGENTMAIL_ORGANIZATION_ID || env.AGENTMAIL_ORG_ID ? 'detected' : 'missing',
      agentmail_ws_url: env.AGENTMAIL_WS_URL ? 'detected' : 'missing',
      credential_source: bootstrap.source,
      masked_preview: bootstrap.keyMasked,
      exact_blocker: bootstrap.exact_blocker,
    },
    secret_safety: {
      raw_secret_exposed: false,
      client_exposed: false,
    },
    inbox_count: inboxCount,
    event_count: eventCount,
    send_enabled: false,
    outbound_send_state: 'owner_approval_required',
    autonomy_default: 'monitor_first',
    ...SAFE_FLAGS,
  }
}

export function buildAgentMailConnectStatus(
  db: Database.Database = getDatabase(),
  env: Record<string, string | undefined> = process.env,
  runtimeMetadata: { agentmail_mcp_config_detected?: boolean } = {},
) {
  ensureAgentMailSchema(db)
  const monitorStatus = buildAgentMailStatus(db, env)
  const bootstrap = resolveAgentMailBootstrapCredential({ db, env })
  const hasApiCredential = bootstrap.keyAvailable
  const hasLocalMcpConfig = runtimeMetadata.agentmail_mcp_config_detected ?? detectAgentMailMcpConfig()
  const assignedInboxCount = (db.prepare(`SELECT COUNT(*) AS count FROM agentmail_inboxes WHERE inbox_address IS NOT NULL`).get() as { count: number }).count
  const lastAudit = db.prepare(`SELECT action, result, detail, created_at FROM agentmail_audit ORDER BY created_at DESC LIMIT 1`).get() as Record<string, unknown> | undefined

  const status: AgentMailConnectStatus = hasApiCredential
    ? assignedInboxCount > 0
      ? monitorStatus.state === 'running' ? 'monitor_ready' : 'inbox_sync_complete'
      : 'sync_ready'
    : hasLocalMcpConfig
      ? 'api_key_required'
      : 'owner_sso_required'

  return {
    ok: true,
    source: 'agentmail_connect_status',
    generated_at: nowIso(),
    status,
    runtime_credentials: monitorStatus.runtime_credentials,
    secret_safety: monitorStatus.secret_safety,
    runtime_credential_blocker: bootstrap.exact_blocker,
    current_blocker: status === 'api_key_required'
      ? (bootstrap.exact_blocker && bootstrap.exact_blocker !== 'agentmail_api_key_missing'
        ? bootstrap.exact_blocker
        : 'agentmail_mcp_oauth_not_visible_to_mission_control_runtime')
      : status === 'owner_sso_required'
      ? 'agentmail_owner_sso_or_api_key_required'
      : status === 'sync_ready'
          ? 'agentmail_inbox_sync_preview_required'
          : status === 'inbox_sync_complete'
            ? (detectAgentMailInboxLimitExceeded(db) ? 'agentmail_inbox_limit_exceeded' : 'approval_gated_send_ready')
            : null,
    primary_cta: 'Connect AgentMail',
    hosted_console_url: AGENTMAIL_CONSOLE_URL,
    mcp_oauth_url: AGENTMAIL_MCP_URL,
    hosted_console: {
      state: status === 'owner_sso_required'
        ? 'owner_sso_required'
        : status === 'api_key_required'
          ? 'owner_sso_completed_runtime_credential_required'
          : 'connected_or_api_key_configured',
      url: AGENTMAIL_CONSOLE_URL,
      message: status === 'owner_sso_required'
        ? 'Waiting for owner Google/SSO sign-in through AgentMail.'
        : status === 'api_key_required'
          ? 'Hosted MCP config was detected for a local CLI, but mission-control.service still needs approved runtime access.'
        : 'AgentMail credential metadata detected. AgentMail Console opened in a new tab. If the hosted console shows an error, Mission Control runtime access is still tested through the server-side Provider Vault credential.',
    },
    google_sso_status: status === 'owner_sso_required'
      ? 'owner_sso_required'
      : status === 'api_key_required'
        ? 'owner_sso_completed_unverified_by_service'
        : 'connected_or_api_key_fallback',
    mcp_oauth_status: {
      state: hasLocalMcpConfig ? 'mcp_config_detected_runtime_unusable' : 'oauth_pending',
      url: AGENTMAIL_MCP_URL,
      cli_status: hasLocalMcpConfig ? 'configured_for_local_cli_not_service_runtime' : 'not_verified_by_server',
    },
    api_key_fallback: {
      state: hasApiCredential ? 'detected' : 'api_key_required',
      masked_preview: bootstrap.keyMasked,
      source: bootstrap.source === 'none' ? null : bootstrap.source,
      ref_status: bootstrap.ref ? (bootstrap.keyAvailable ? 'resolved' : bootstrap.exact_blocker) : 'missing',
    },
    last_sync_attempt: lastAudit || null,
    sync_ready: status === 'sync_ready' || status === 'inbox_sync_complete' || status === 'monitor_ready',
    bridge_session_status: 'legacy_optional_not_global_setup_gate',
    local_monitor: monitorStatus.local_monitor,
    send_state: 'approval_required',
    dispatch_runtime_status: buildAgentMailDispatchRuntimeStatus(db),
    execution_enabled: false,
    send_enabled: false,
    next_status_flow: [
      'owner_sso_required',
      'connected',
      'sync_ready',
      'inbox_sync_complete',
      'approval_gated_send_ready',
      'monitor_ready',
    ],
    ...SAFE_FLAGS,
  }
}

export function buildAgentMailInboxSyncPreview(
  db: Database.Database = getDatabase(),
  env: Record<string, string | undefined> = process.env,
  runtimeMetadata: { agentmail_mcp_config_detected?: boolean } = {},
) {
  ensureAgentMailSchema(db)
  const inboxes = listAgentMailInboxes(db)
  const status = buildAgentMailConnectStatus(db, env, runtimeMetadata)
  const setupStatus = buildAgentMailSetupStatus(db, env)
  const connectionVisibleToRuntime = status.status !== 'owner_sso_required' && status.status !== 'api_key_required'
  const organizationSelected = status.status === 'sync_ready' || status.status === 'inbox_sync_complete' || status.status === 'monitor_ready'
  const knownAgents = inboxes.map((inbox) => ({
    agent_id: inbox.agent_id,
    display_name: inbox.display_name,
    role: inbox.role,
    autonomy_level: inbox.autonomy_level,
    owner_approval_required: inbox.owner_approval_required,
    current_inbox: inbox.inbox_address,
    provision_state: inbox.provision_state,
  }))
  const proposedAssignments = inboxes.map((inbox) => ({
    agent_id: inbox.agent_id,
    display_name: inbox.display_name,
    role: inbox.role,
    autonomy_level: inbox.autonomy_level,
    owner_approval_required: true,
    proposed_client_id: inbox.client_id,
    proposed_inbox: inbox.inbox_address || `${inbox.agent_id.replace(/_/g, '-')}@agentmail.to`,
    scoped_credentials: 'proposed_inbox_scoped_reference_only',
    bridge_route: `agentmail:${inbox.agent_id}:pending_gateway_review`,
    provision_state: inbox.inbox_address ? 'preserve_existing' : 'preview_only_not_provisioned',
  }))
  const requiredPermissions = proposedAssignments.map((assignment) => {
    const sendCapable = assignment.agent_id === 'pi' || assignment.agent_id === 'agent_zero'
    return {
      agent_id: assignment.agent_id,
      credential_scope: sendCapable ? 'inbox' : 'monitor_or_control_plane',
      required_permissions: sendCapable
        ? ['inbox_read', 'thread_read', 'message_read', 'message_send', 'message_update', 'draft_read', 'draft_create', 'draft_update', 'draft_send']
        : ['inbox_read', 'thread_read', 'message_read'],
      send_policy: sendCapable ? 'owner_approval_required' : 'no_external_send_by_default',
      scoped_credential_required: sendCapable,
    }
  })
  return {
    ok: true,
    source: 'agentmail_inbox_sync_preview',
    generated_at: nowIso(),
    connection_state: status.status,
    connection_visible_to_runtime: connectionVisibleToRuntime,
    organization_connected: connectionVisibleToRuntime,
    organization_selected: organizationSelected,
    organization: {
      state: organizationSelected ? 'selected' : connectionVisibleToRuntime ? 'connection_visible_selection_required' : 'not_visible_to_runtime',
      id: null,
      name: null,
      credential_values_exposed: false,
    },
    available_inboxes: inboxes.filter((inbox) => inbox.inbox_address).map((inbox) => ({
      agent_id: inbox.agent_id,
      display_name: inbox.display_name,
      inbox_address: inbox.inbox_address,
      provision_state: inbox.provision_state,
    })),
    existing_agentmail_inboxes: inboxes.filter((inbox) => inbox.inbox_address).map((inbox) => ({
      agent_id: inbox.agent_id,
      inbox_address: inbox.inbox_address,
      provision_state: inbox.provision_state,
    })),
    known_agents: knownAgents,
    missing_inboxes: knownAgents.filter((agent) => !agent.current_inbox),
    missing_inbox_addresses: knownAgents.filter((agent) => !agent.current_inbox).map((agent) => ({
      agent_id: agent.agent_id,
      display_name: agent.display_name,
      role: agent.role,
      proposed_inbox: `${agent.agent_id.replace(/_/g, '-')}@agentmail.to`,
    })),
    proposed_inbox_assignments: proposedAssignments,
    provisioning_plan: proposedAssignments.map((assignment) => ({
      agent_id: assignment.agent_id,
      proposed_inbox: assignment.proposed_inbox,
      proposed_client_id: assignment.proposed_client_id,
      mutation: 'requires_owner_approval',
      provision_automatically: false,
    })),
    proposed_scoped_credentials: proposedAssignments.map((assignment) => ({
      agent_id: assignment.agent_id,
      credential_scope: 'inbox_scoped',
      credential_values_exposed: false,
    })),
    required_scoped_credentials: requiredPermissions.filter((row) => row.scoped_credential_required),
    required_permissions: requiredPermissions,
    bridge_routing_preview: proposedAssignments.map((assignment) => ({
      source: 'agentmail',
      agent_id: assignment.agent_id,
      route: assignment.bridge_route,
      policy_state: 'pending_gateway_review',
      outbound_send_state: 'approval_required',
    })),
    provision_automatically: false,
    mutation_enabled: false,
    send_enabled: false,
    execution_enabled: false,
    exact_blocker: setupStatus.primary_blocker,
    setup_status: setupStatus,
    bridge_session_required: true,
    ...SAFE_FLAGS,
  }
}

export function createAgentMailInboxProvisioningRequest(db: Database.Database = getDatabase(), requester = 'owner') {
  ensureAgentMailSchema(db)
  const preview = buildAgentMailInboxSyncPreview(db)
  const { request: approval, created } = createApprovalRequest({
    connector: 'agentmail',
    action: 'agentmail_inbox_provisioning',
    target: 'agentmail_inboxes',
    target_key: 'agentmail:inboxes:provision',
    requester: sanitizeText(requester, 'owner', 120),
    risk_level: 'medium',
    protected_category: 'connector_write',
    reason: 'Owner approval is required before AgentMail inboxes can be provisioned or assigned.',
    approval_scope: {
      provision_automatically: false,
      proposed_inboxes: preview.proposed_inbox_assignments.map((row: any) => ({ agent_id: row.agent_id, proposed_inbox: row.proposed_inbox })),
      scoped_credentials_created: false,
      send_enabled: false,
      credential_values_exposed: false,
    },
    idempotency_key: 'agentmail:inboxes:provision',
  })
  recordAgentMailAudit(db, 'agentmail_inbox_provisioning_requested', 'blocked', `approval_id=${approval.id};preview_only_no_provisioning_no_send`)
  return {
    ok: true,
    source: 'agentmail_inbox_provisioning_request',
    approval_id: approval.id,
    approval_state: approval.approval_state,
    approval_request_created: created,
    exact_blocker: 'canonical_owner_approval_required',
    provision_enabled: false,
    send_enabled: false,
    preview,
    ...SAFE_FLAGS,
  }
}

function queryRows(db: Database.Database, sql: string) {
  ensureAgentMailSchema(db)
  return db.prepare(sql).all()
}

export function buildAgentMailPayload(kind: 'inboxes' | 'events' | 'bridge_queue' | 'approvals' | 'audit' | 'overview', db: Database.Database = getDatabase()) {
  ensureAgentMailSchema(db)
  const base = {
    ok: true,
    source: 'agentmail_local_control',
    generated_at: nowIso(),
    execution_enabled: false,
    writes_enabled: false,
    send_enabled: false,
    ...SAFE_FLAGS,
  }
  if (kind === 'inboxes') return { ...base, inboxes: listAgentMailInboxes(db), registry: validateInboxRegistry(listAgentMailInboxes(db)) }
  if (kind === 'events') return { ...base, events: queryRows(db, `SELECT event_id, event_type, inbox_id, agent_id, thread_id, message_id, direction, sender_preview, sender_domain, subject, received_at, classification, policy_state, autonomy_level FROM agentmail_events ORDER BY created_at DESC LIMIT 100`) }
  if (kind === 'bridge_queue') return { ...base, bridge_queue: queryRows(db, `SELECT id, event_id, thread_id, task_candidate_state, policy_state, outbound_send_enabled, owner_approval_required, created_at FROM agentmail_bridge_queue ORDER BY created_at DESC LIMIT 100`) }
  if (kind === 'approvals') return { ...base, approvals: queryRows(db, `SELECT id, event_id, action_type, state, exact_blocker, created_at FROM agentmail_approvals ORDER BY created_at DESC LIMIT 100`) }
  if (kind === 'audit') return { ...base, audit: queryRows(db, `SELECT id, event_id, action, result, detail, created_at FROM agentmail_audit ORDER BY created_at DESC LIMIT 200`) }
  return {
    ...base,
    status: buildAgentMailStatus(db),
    connect: buildAgentMailConnectStatus(db),
    sync_preview: buildAgentMailInboxSyncPreview(db),
    send_access: buildAgentMailSendAccessStatus(db),
    setup_status: buildAgentMailSetupStatus(db),
    inboxes: listAgentMailInboxes(db),
    events: queryRows(db, `SELECT event_id, event_type, agent_id, sender_preview, subject, received_at, policy_state FROM agentmail_events ORDER BY created_at DESC LIMIT 12`),
    bridge_queue: queryRows(db, `SELECT id, event_id, task_candidate_state, policy_state, owner_approval_required FROM agentmail_bridge_queue ORDER BY created_at DESC LIMIT 12`),
    approvals: queryRows(db, `SELECT id, event_id, action_type, state, exact_blocker FROM agentmail_approvals ORDER BY created_at DESC LIMIT 12`),
    audit: queryRows(db, `SELECT id, event_id, action, result, detail FROM agentmail_audit ORDER BY created_at DESC LIMIT 12`),
  }
}


export type AgentMailBridgeSessionState = 'inactive' | 'pending_owner_approval' | 'active' | 'expired' | 'revoked' | 'error'
export type AgentMailGatewayPolicy = 'monitor_only' | 'draft_only' | 'approval_required' | 'allowlisted_auto_send'
export type AgentMailCredentialStatus = 'missing' | 'detected' | 'scoped' | 'invalid' | 'expired'
export type AgentMailInboxStatus = 'missing' | 'provisioned' | 'synced'

export const AGENTMAIL_BLOCKER_PRIORITY = [
  'agentmail_owner_sso_or_api_key_required',
  'agentmail_connection_not_visible_to_runtime',
  'agentmail_inbox_limit_exceeded',
  'agentmail_inbox_assignment_missing',
  'agentmail_inbox_not_provisioned',
  'agentmail_inbox_address_missing',
  'agentmail_inbox_credential_required',
  'agentmail_runtime_secret_store_required',
  'scoped_credential_invalid',
  'scoped_credential_wrong_inbox',
  'message_send_permission_missing',
  'draft_send_permission_missing',
  'owner_approval_required',
  'action_bridge_session_inactive',
  'agentmail_dispatch_runtime_inactive',
  'agentmail_dispatch_runtime_paused',
  'agentmail_dispatch_runtime_degraded',
  'agentmail_dispatch_runtime_failed',
  'gateway_blocked',
  'audit_context_missing',
  'ready',
] as const

type AgentMailSetupBlocker = typeof AGENTMAIL_BLOCKER_PRIORITY[number]

type AgentMailSetupChecklist = {
  owner_connection: 'missing' | 'connected'
  runtime_visibility: 'missing' | 'visible'
  organization_selected: 'missing' | 'selected'
  inbox_registry: 'preview' | 'synced'
  inboxes_provisioned: 'no' | 'partial' | 'yes'
  inbox_addresses: 'missing' | 'assigned'
  scoped_credentials: 'missing' | 'stored'
  permissions: 'missing' | 'verified'
  send_adapter: 'configured' | 'failed'
  owner_approval_flow: 'ready' | 'missing'
  dispatch_runtime: 'active' | 'paused' | 'degraded' | 'failed'
  action_bridge_session: 'inactive' | 'active'
  gateway_policy: 'ready' | 'blocked'
  audit: 'ready' | 'missing'
}

type AgentMailSetupEvaluation = {
  agentmail_ready: boolean
  send_ready: boolean
  setup_state: AgentMailSetupBlocker | 'approval_gated_send_ready'
  primary_blocker: AgentMailSetupBlocker
  blockers: AgentMailSetupBlocker[]
  exact_blockers: AgentMailSetupBlocker[]
  per_send_status: {
    state: 'no_pending_send_request' | 'owner_approval_required' | 'action_bridge_session_inactive' | 'approved_send_dispatch_ready' | 'send_dispatched' | 'send_blocked'
    send_request_id: string | null
    exact_blocker: string | null
  }
  next_action: string
  inboxes: {
    total: number
    provisioned: number
    missing_addresses: number
  }
  credentials: {
    scoped_credentials_present: number
    required: number
  }
  checklist: AgentMailSetupChecklist
}

const AGENTMAIL_SEND_PERMISSIONS = AGENTMAIL_PERMISSION_KEYS

type AgentMailSendPermission = AgentMailPermission

type AgentMailSendInput = {
  agent_id?: unknown
  inbox_id?: unknown
  to?: unknown
  cc?: unknown
  bcc?: unknown
  subject?: unknown
  text?: unknown
  html?: unknown
  thread_id?: unknown
  reply_to_message_id?: unknown
  labels?: unknown
}

type AgentMailSendRequestRow = {
  id: string
  agent_id: string
  inbox_id: string
  to_json: string
  cc_json: string
  bcc_json: string
  subject: string
  text_body: string
  html_body: string | null
  thread_id: string | null
  reply_to_message_id: string | null
  labels_json: string
  state: string
  gateway_policy: string
  exact_blocker: string | null
  approval_request_id: string | null
  bridge_session_id: string | null
  message_id: string | null
  created_at: number
  updated_at: number
}

type AgentMailBridgeSessionRow = {
  id: string
  state: string
  approval_request_id: string | null
  requester: string
  expires_at: string | null
  max_sends_per_session_per_agent: number
  max_recipients_per_send: number
  sends_dispatched: number
  created_at: number
  updated_at: number
}

type AgentMailDispatchRuntimeStatusValue = 'active' | 'degraded' | 'paused' | 'failed'

type AgentMailDispatchRuntimeRow = {
  id: string
  mode: string
  enabled: number
  autostart: number
  status: string
  owner_enabled: number
  emergency_stop: number
  default_policy: string
  external_send_policy: string
  allow_registered_agents: number
  max_sends_per_hour: number
  max_recipients_per_send: number
  sends_dispatched: number
  created_at: number
  updated_at: number
}

function uniqueBlockers(blockers: string[]): AgentMailSetupBlocker[] {
  const found = new Set<string>(blockers)
  return AGENTMAIL_BLOCKER_PRIORITY.filter((blocker): blocker is AgentMailSetupBlocker => found.has(blocker))
}

function primaryAgentMailBlocker(blockers: AgentMailSetupBlocker[]): AgentMailSetupBlocker {
  for (const blocker of AGENTMAIL_BLOCKER_PRIORITY) {
    if (blockers.includes(blocker)) return blocker
  }
  return 'ready'
}

function agentMailNextAction(primaryBlocker: AgentMailSetupBlocker): string {
  if (primaryBlocker === 'agentmail_owner_sso_or_api_key_required') return 'connect_agentmail'
  if (primaryBlocker === 'agentmail_connection_not_visible_to_runtime') return 'connect_agentmail_runtime_access'
  if (primaryBlocker === 'agentmail_inbox_limit_exceeded') return 'resolve_agentmail_inbox_capacity'
  if (primaryBlocker === 'agentmail_inbox_assignment_missing' || primaryBlocker === 'agentmail_inbox_not_provisioned' || primaryBlocker === 'agentmail_inbox_address_missing') return 'sync_or_provision_inbox_registry'
  if (primaryBlocker === 'agentmail_inbox_credential_required' || primaryBlocker === 'scoped_credential_invalid' || primaryBlocker === 'scoped_credential_wrong_inbox') return 'provision_scoped_inbox_credentials'
  if (primaryBlocker === 'agentmail_runtime_secret_store_required') return 'configure_approved_runtime_secret_storage'
  if (primaryBlocker === 'message_send_permission_missing' || primaryBlocker === 'draft_send_permission_missing') return 'verify_agentmail_scoped_permissions'
  if (primaryBlocker === 'owner_approval_required') return 'request_owner_message_approval'
  if (primaryBlocker === 'action_bridge_session_inactive') return 'request_agentmail_action_bridge_session'
  if (primaryBlocker === 'agentmail_dispatch_runtime_inactive' || primaryBlocker === 'agentmail_dispatch_runtime_paused') return 'resume_agentmail_dispatch_runtime'
  if (primaryBlocker === 'agentmail_dispatch_runtime_degraded' || primaryBlocker === 'agentmail_dispatch_runtime_failed') return 'inspect_agentmail_dispatch_runtime'
  if (primaryBlocker === 'gateway_blocked') return 'resolve_gateway_policy_blocker'
  if (primaryBlocker === 'audit_context_missing') return 'restore_agentmail_audit_context'
  return 'approval_gated_send_ready'
}

function latestAgentMailSendRequest(db: Database.Database): AgentMailSendRequestRow | null {
  ensureAgentMailSchema(db)
  const row = db.prepare(`
    SELECT * FROM agentmail_send_requests
    WHERE state IN ('preview_created', 'approval_requested', 'owner_approved')
    ORDER BY created_at DESC, updated_at DESC
    LIMIT 1
  `).get() as AgentMailSendRequestRow | undefined
  return row || null
}

function runtimeBlocker(status: AgentMailDispatchRuntimeStatusValue) {
  if (status === 'active') return null
  return `agentmail_dispatch_runtime_${status}`
}

function evaluateAgentMailPerSendStatus(db: Database.Database, dispatchRuntimeStatus: AgentMailDispatchRuntimeStatusValue): AgentMailSetupEvaluation['per_send_status'] {
  const row = latestAgentMailSendRequest(db)
  if (!row) return { state: 'no_pending_send_request', send_request_id: null, exact_blocker: null }
  if (row.state === 'owner_approved') {
    const blocker = runtimeBlocker(dispatchRuntimeStatus)
    if (!blocker) return { state: 'approved_send_dispatch_ready', send_request_id: row.id, exact_blocker: null }
    return { state: 'send_blocked', send_request_id: row.id, exact_blocker: blocker }
  }
  return { state: 'owner_approval_required', send_request_id: row.id, exact_blocker: 'owner_approval_required' }
}

function setupChecklist(input: {
  connectStatus: AgentMailConnectStatus
  hasRuntimeConnection: boolean
  organizationSelected: boolean
  totalInboxes: number
  provisionedInboxes: number
  missingAddresses: number
  scopedCredentialsPresent: number
  requiredScopedCredentials: number
  permissionsVerified: boolean
  dispatchRuntimeStatus: AgentMailDispatchRuntimeStatusValue
  bridgeState: AgentMailBridgeSessionState
  gatewayReady: boolean
  auditReady: boolean
}): AgentMailSetupChecklist {
  return {
    owner_connection: input.connectStatus === 'owner_sso_required' || input.connectStatus === 'api_key_required' ? 'missing' : 'connected',
    runtime_visibility: input.hasRuntimeConnection ? 'visible' : 'missing',
    organization_selected: input.organizationSelected ? 'selected' : 'missing',
    inbox_registry: input.provisionedInboxes > 0 && input.missingAddresses === 0 ? 'synced' : 'preview',
    inboxes_provisioned: input.provisionedInboxes === 0 ? 'no' : input.provisionedInboxes === input.totalInboxes ? 'yes' : 'partial',
    inbox_addresses: input.missingAddresses === 0 ? 'assigned' : 'missing',
    scoped_credentials: input.scopedCredentialsPresent >= input.requiredScopedCredentials && input.requiredScopedCredentials > 0 ? 'stored' : 'missing',
    permissions: input.permissionsVerified ? 'verified' : 'missing',
    send_adapter: 'configured',
    owner_approval_flow: 'ready',
    dispatch_runtime: input.dispatchRuntimeStatus,
    action_bridge_session: input.bridgeState === 'active' ? 'active' : 'inactive',
    gateway_policy: input.gatewayReady ? 'ready' : 'blocked',
    audit: input.auditReady ? 'ready' : 'missing',
  }
}

function evaluateAgentMailSetup(input: {
  db: Database.Database
  connect: ReturnType<typeof buildAgentMailConnectStatus>
  inboxes: AgentMailInboxRecord[]
  agents: Record<string, Record<string, unknown>>
  dispatchRuntimeStatus: AgentMailDispatchRuntimeStatusValue
  bridgeState: AgentMailBridgeSessionState
  auditReady: boolean
  inboxLimitExceeded?: boolean
}): AgentMailSetupEvaluation {
  const sendCapable = input.inboxes.filter((inbox) => inbox.agent_id === 'pi' || inbox.agent_id === 'agent_zero')
  const totalInboxes = input.inboxes.length
  const provisionedInboxes = input.inboxes.filter((inbox) => inbox.provision_state === 'assigned' || Boolean(inbox.inbox_address)).length
  const missingAddresses = input.inboxes.filter((inbox) => !inbox.inbox_address).length
  const requiredScopedCredentials = sendCapable.length
  const scopedCredentialsPresent = sendCapable.filter((inbox) => {
    const agent = input.agents[inbox.agent_id] || {}
    return agent.credential_status === 'scoped'
  }).length
  const permissionsVerified = sendCapable.length > 0 && sendCapable.every((inbox) => {
    const agent = input.agents[inbox.agent_id] || {}
    const permissions = agent.permission_status as Record<string, boolean> | undefined
    return Boolean(permissions?.message_send)
  })
  const connected = input.connect.status !== 'owner_sso_required' && input.connect.status !== 'api_key_required'
  const runtimeVisible = connected
  const organizationSelected = input.connect.status === 'sync_ready' || input.connect.status === 'inbox_sync_complete' || input.connect.status === 'monitor_ready'
  const gatewayReady = !Object.values(input.agents).some((agent) => (agent.blockers as string[] | undefined)?.includes('gateway_policy_monitor_only') && (agent.agent_id === 'pi' || agent.agent_id === 'agent_zero'))
  const perSendStatus = evaluateAgentMailPerSendStatus(input.db, input.dispatchRuntimeStatus)
  const rawBlockers: string[] = []

  if (!connected) rawBlockers.push(input.connect.runtime_credential_blocker === 'agentmail_runtime_secret_store_required' ? 'agentmail_runtime_secret_store_required' : 'agentmail_owner_sso_or_api_key_required')
  if (connected && !runtimeVisible) rawBlockers.push('agentmail_connection_not_visible_to_runtime')
  if (input.inboxLimitExceeded && missingAddresses > 0) rawBlockers.push('agentmail_inbox_limit_exceeded')
  if (input.inboxes.some((inbox) => !inbox.inbox_address)) rawBlockers.push('agentmail_inbox_assignment_missing', 'agentmail_inbox_address_missing')
  if (input.inboxes.some((inbox) => inbox.provision_state !== 'assigned')) rawBlockers.push('agentmail_inbox_not_provisioned')
  if (scopedCredentialsPresent < requiredScopedCredentials) rawBlockers.push('agentmail_inbox_credential_required')
  for (const agent of Object.values(input.agents)) {
    const blockers = agent.blockers as string[] | undefined
    if (!blockers) continue
    if (blockers.includes('agentmail_runtime_secret_store_required')) rawBlockers.push('agentmail_runtime_secret_store_required')
    if (blockers.includes('scoped_credential_invalid')) rawBlockers.push('scoped_credential_invalid')
    if (blockers.includes('scoped_credential_wrong_inbox')) rawBlockers.push('scoped_credential_wrong_inbox')
    if (blockers.includes('message_send_permission_missing')) rawBlockers.push('message_send_permission_missing')
    if (blockers.includes('draft_send_permission_missing')) rawBlockers.push('draft_send_permission_missing')
    if (blockers.includes('gateway_blocked')) rawBlockers.push('gateway_blocked')
  }
  if (!gatewayReady) rawBlockers.push('gateway_blocked')
  if (!input.auditReady) rawBlockers.push('audit_context_missing')

  const blockers = uniqueBlockers(rawBlockers)
  const primary = primaryAgentMailBlocker(blockers)
  const infrastructureReady = primary === 'ready'
  const setupState = infrastructureReady ? 'approval_gated_send_ready' : primary
  const sendReady = perSendStatus.state === 'approved_send_dispatch_ready'
  const checklist = setupChecklist({
    connectStatus: input.connect.status,
    hasRuntimeConnection: runtimeVisible,
    organizationSelected,
    totalInboxes,
    provisionedInboxes,
    missingAddresses,
    scopedCredentialsPresent,
    requiredScopedCredentials,
    permissionsVerified,
    dispatchRuntimeStatus: input.dispatchRuntimeStatus,
    bridgeState: input.bridgeState,
    gatewayReady,
    auditReady: input.auditReady,
  })

  return {
    agentmail_ready: connected && organizationSelected && missingAddresses === 0,
    send_ready: sendReady,
    setup_state: setupState,
    primary_blocker: primary,
    blockers: blockers.length ? blockers : ['ready'],
    exact_blockers: blockers.filter((blocker) => blocker !== 'ready'),
    per_send_status: perSendStatus,
    next_action: agentMailNextAction(primary),
    inboxes: {
      total: totalInboxes,
      provisioned: provisionedInboxes,
      missing_addresses: missingAddresses,
    },
    credentials: {
      scoped_credentials_present: scopedCredentialsPresent,
      required: requiredScopedCredentials,
    },
    checklist,
  }
}

export function buildAgentMailSetupStatus(
  db: Database.Database = getDatabase(),
  env: Record<string, string | undefined> = process.env,
): AgentMailSetupEvaluation & typeof SAFE_FLAGS {
  ensureAgentMailSchema(db)
  const connect = buildAgentMailConnectStatus(db, env)
  const bridgeState = normalizeBridgeState(latestAgentMailBridgeSession(db))
  const dispatchRuntime = buildAgentMailDispatchRuntimeStatus(db)
  const inboxes = listAgentMailInboxes(db)
  const agents = inboxes.reduce((acc, inbox) => {
    acc[inbox.agent_id] = {
      agent_id: inbox.agent_id,
      ...sendAccessForInbox(inbox, env, dispatchRuntime, db),
    }
    return acc
  }, {} as Record<string, Record<string, unknown>>)
  const auditReady = true
  const inboxLimitExceeded = detectAgentMailInboxLimitExceeded(db)
  const setup = evaluateAgentMailSetup({ db, connect, inboxes, agents, dispatchRuntimeStatus: dispatchRuntime.status, bridgeState, auditReady, inboxLimitExceeded })
  recordAgentMailAudit(db, 'agentmail_readiness_evaluated', setup.setup_state === 'approval_gated_send_ready' ? 'ok' : 'blocked', setup.setup_state)
  if (setup.setup_state === 'approval_gated_send_ready') recordAgentMailAudit(db, 'agentmail_setup_ready', 'ok', setup.per_send_status.state)
  recordAgentMailAudit(db, 'agentmail_status_blockers_evaluated', setup.primary_blocker === 'ready' ? 'ok' : 'blocked', setup.exact_blockers.join(',') || setup.setup_state)
  recordAgentMailAudit(db, 'agentmail_primary_blocker_selected', setup.primary_blocker === 'ready' ? 'ok' : 'blocked', setup.primary_blocker)
  recordAgentMailAudit(db, 'agentmail_next_action_selected', 'ok', setup.next_action)
  if (setup.blockers.includes('agentmail_inbox_limit_exceeded')) {
    recordAgentMailAudit(db, 'agentmail_inbox_limit_exceeded', 'blocked', 'agentmail_provider_inbox_capacity_limit_blocks_required_agent_inboxes')
    recordAgentMailAudit(db, 'agentmail_capacity_resolution_required', 'blocked', 'increase_capacity_or_owner_approve_reuse_mapping')
  }
  if (setup.blockers.includes('agentmail_inbox_not_provisioned')) recordAgentMailAudit(db, 'agentmail_inbox_provisioning_required', 'blocked', 'preview_or_owner_approved_provisioning_required')
  if (setup.blockers.includes('agentmail_inbox_credential_required')) recordAgentMailAudit(db, 'agentmail_scoped_credentials_required', 'blocked', 'owner_approved_scoped_inbox_credentials_required')
  if (setup.blockers.includes('action_bridge_session_inactive')) recordAgentMailAudit(db, 'agentmail_action_bridge_session_required', 'blocked', 'agentmail_action_bridge_session_required_after_setup')
  return { ...setup, ...SAFE_FLAGS }
}


export function detectAgentMailInboxLimitExceeded(db: Database.Database = getDatabase()): boolean {
  ensureAgentMailSchema(db)
  const missingAddresses = (db.prepare(`SELECT COUNT(*) AS count FROM agentmail_inboxes WHERE inbox_address IS NULL OR inbox_address = ''`).get() as { count: number }).count
  if (missingAddresses < 1) return false
  const row = db.prepare(`
    SELECT detail FROM agentmail_audit
    WHERE action IN ('agentmail_inbox_provisioning_failed', 'agentmail_inbox_limit_exceeded')
      AND detail LIKE '%agentmail_inbox_limit_exceeded%'
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get() as { detail?: string } | undefined
  return Boolean(row?.detail)
}

export function latestAgentMailLiveInboxCount(db: Database.Database = getDatabase()): number | null {
  ensureAgentMailSchema(db)
  const row = db.prepare(`
    SELECT detail FROM agentmail_audit
    WHERE action = 'agentmail_live_inbox_preview_completed'
      AND detail LIKE 'live_inboxes=%'
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get() as { detail?: string } | undefined
  const match = String(row?.detail || '').match(/live_inboxes=(\d+)/)
  return match ? Number(match[1]) : null
}

function parseJsonArray(value: string | null): string[] {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function stringArray(value: unknown, maxItems = 10) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => sanitizeText(item, '', 180))
    .filter(Boolean)
    .slice(0, maxItems)
}

function latestAgentMailBridgeSession(db: Database.Database): AgentMailBridgeSessionRow | null {
  ensureAgentMailSchema(db)
  const row = db.prepare(`
    SELECT id, state, approval_request_id, requester, expires_at,
           max_sends_per_session_per_agent, max_recipients_per_send,
           sends_dispatched, created_at, updated_at
    FROM agentmail_bridge_sessions
    ORDER BY created_at DESC
    LIMIT 1
  `).get() as AgentMailBridgeSessionRow | undefined
  return row || null
}

function normalizeBridgeState(row: AgentMailBridgeSessionRow | null, at = new Date()): AgentMailBridgeSessionState {
  if (!row) return 'inactive'
  if (row.state === 'revoked') return 'revoked'
  if (row.state === 'active' && row.expires_at && Date.parse(row.expires_at) <= at.getTime()) return 'expired'
  if (row.state === 'active') return 'active'
  if (row.state === 'pending_owner_approval') return 'pending_owner_approval'
  if (row.state === 'expired') return 'expired'
  return 'error'
}

function readAgentMailDispatchRuntimeRow(db: Database.Database): AgentMailDispatchRuntimeRow {
  ensureAgentMailSchema(db)
  return db.prepare(`
    SELECT id, mode, enabled, autostart, status, owner_enabled, emergency_stop,
           default_policy, external_send_policy, allow_registered_agents,
           max_sends_per_hour, max_recipients_per_send, sends_dispatched,
           created_at, updated_at
    FROM agentmail_dispatch_runtime
    WHERE id = 'agentmail_dispatch_runtime'
    LIMIT 1
  `).get() as AgentMailDispatchRuntimeRow
}

function normalizeDispatchRuntimeStatus(row: AgentMailDispatchRuntimeRow): AgentMailDispatchRuntimeStatusValue {
  if (!row.enabled || !row.owner_enabled || row.emergency_stop) return 'paused'
  if (row.status === 'active' || row.status === 'degraded' || row.status === 'paused' || row.status === 'failed') return row.status
  return 'failed'
}

export function buildAgentMailDispatchRuntimeStatus(db: Database.Database = getDatabase()) {
  ensureAgentMailSchema(db)
  const row = readAgentMailDispatchRuntimeRow(db)
  const status = normalizeDispatchRuntimeStatus(row)
  return {
    id: row.id,
    mode: 'always_on',
    enabled: Boolean(row.enabled),
    autostart: Boolean(row.autostart),
    status,
    owner_enabled: Boolean(row.owner_enabled),
    emergency_stop: Boolean(row.emergency_stop),
    default_policy: row.default_policy || 'approval_gated_send',
    external_send_policy: row.external_send_policy || 'approval_required',
    allow_registered_agents: Boolean(row.allow_registered_agents),
    max_sends_per_hour: row.max_sends_per_hour || 10,
    max_recipients_per_send: row.max_recipients_per_send || 10,
    sends_dispatched: row.sends_dispatched || 0,
    sends_remaining_per_hour: Math.max(0, (row.max_sends_per_hour || 10) - (row.sends_dispatched || 0)),
    auto_send_enabled: false,
    bulk_send_enabled: false,
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    raw_secret_values_exposed: false,
  }
}

export function setAgentMailDispatchRuntimeEmergencyStop(
  db: Database.Database = getDatabase(),
  enabled: boolean,
  actor = 'owner',
) {
  ensureAgentMailSchema(db)
  db.prepare(`
    UPDATE agentmail_dispatch_runtime
    SET emergency_stop = ?, status = ?, updated_at = unixepoch()
    WHERE id = 'agentmail_dispatch_runtime'
  `).run(enabled ? 1 : 0, enabled ? 'paused' : 'active')
  recordAgentMailAudit(
    db,
    enabled ? 'agentmail_dispatch_runtime_emergency_stopped' : 'agentmail_dispatch_runtime_resumed',
    'ok',
    `actor=${sanitizeText(actor, 'owner', 120)}`,
  )
  return buildAgentMailDispatchRuntimeStatus(db)
}

function permissionMap(enabled: boolean, sendCapable: boolean) {
  return AGENTMAIL_SEND_PERMISSIONS.reduce((acc, key) => {
    acc[key] = enabled && (sendCapable || !key.includes('send'))
    return acc
  }, {} as Record<AgentMailSendPermission, boolean>)
}

function agentMailCredentialRef(agentId: string) {
  const refs: Record<string, string> = {
    pi: 'AGENTMAIL_INBOX_KEY_PI',
    agent_zero: 'AGENTMAIL_INBOX_KEY_AGENT_ZERO',
    gateway: 'AGENTMAIL_INBOX_KEY_GATEWAY',
    bridge_unit: 'AGENTMAIL_INBOX_KEY_BRIDGE_UNIT',
    agentmail_monitor: 'AGENTMAIL_INBOX_KEY_MONITOR',
    agentmail_audit: 'AGENTMAIL_INBOX_KEY_AUDIT_ARCHIVE',
  }
  return refs[agentId] || `AGENTMAIL_INBOX_KEY_${agentId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
}

function agentMailSendCapable(agentId: string) {
  return agentId === 'pi' || agentId === 'agent_zero'
}

function agentMailCredentialSendPolicy(agentId: string) {
  if (agentId === 'pi' || agentId === 'agent_zero') return 'approval_gated_send'
  if (agentId === 'gateway') return 'no_normal_external_send'
  if (agentId === 'bridge_unit') return 'dispatch_control_plane_only'
  return 'no_send'
}

function proposedAgentMailCredentialPermissions(agentId: string): Record<AgentMailSendPermission, boolean> {
  const permissions = permissionMap(false, false)
  for (const key of ['inbox_read', 'thread_read', 'message_read'] as AgentMailSendPermission[]) permissions[key] = true
  if (agentId === 'pi' || agentId === 'agent_zero') {
    for (const key of AGENTMAIL_SEND_PERMISSIONS) permissions[key] = true
  } else if (agentId === 'gateway' || agentId === 'bridge_unit') {
    permissions.message_update = true
  }
  return permissions
}

function approvedAgentMailScopedCredentialRequest(approvalId?: string | null) {
  if (approvalId) {
    const approval = getApprovalRequest(approvalId)
    return approval?.connector === 'agentmail' && approval.approval_state === 'approved'
      && (approval.action === 'agentmail_scoped_credentials_provisioning' || approval.action === 'agentmail_scoped_credential_provision_request')
      ? approval
      : null
  }
  return listApprovalRequests().find((request) => request.connector === 'agentmail'
    && request.approval_state === 'approved'
    && (request.action === 'agentmail_scoped_credentials_provisioning' || request.action === 'agentmail_scoped_credential_provision_request')) || null
}

function sendPolicyForInbox(inbox: AgentMailInboxRecord): AgentMailGatewayPolicy {
  if (inbox.agent_id === 'pi' || inbox.agent_id === 'agent_zero') return 'approval_required'
  if (inbox.agent_id === 'bridge_unit') return 'monitor_only'
  return inbox.autonomy_level === 'L1_draft_only' ? 'draft_only' : 'monitor_only'
}

function inboxStatus(inbox: AgentMailInboxRecord): AgentMailInboxStatus {
  if (!inbox.inbox_address) return 'missing'
  return inbox.provision_state === 'assigned' ? 'synced' : 'provisioned'
}

function agentMailProviderSendAllowlistStatus(db: Database.Database, inbox: AgentMailInboxRecord, policy: AgentMailGatewayPolicy) {
  if (policy !== 'approval_required' && policy !== 'allowlisted_auto_send') {
    return {
      status: 'not_required',
      source: 'role_policy',
      last_verified_recipient: null,
      last_provider_rejection: null,
      required_next_action: null,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      raw_secret_values_exposed: false,
    }
  }

  const address = String(inbox.inbox_address || '').trim()
  const verified = address
    ? db.prepare(`
      SELECT detail FROM agentmail_audit
      WHERE action = 'agentmail_send_allowlist_entry_verified'
        AND detail LIKE ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(`%inbox=${address}%`) as { detail?: string } | undefined
    : null
  const latestRejection = db.prepare(`
    SELECT detail FROM agentmail_audit
    WHERE action = 'agentmail_real_send_failed'
      AND detail IN ('agentmail_send_allowlist_required', 'agentmail_message_rejected')
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get() as { detail?: string } | undefined

  if (verified?.detail) {
    const recipient = String(verified.detail.match(/entry=([^;]+)/)?.[1] || '').trim() || null
    return {
      status: 'configured',
      source: 'provider_audit',
      last_verified_recipient: recipient,
      last_provider_rejection: null,
      required_next_action: null,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      raw_secret_values_exposed: false,
    }
  }

  return {
    status: latestRejection?.detail === 'agentmail_send_allowlist_required' ? 'blocked' : 'unknown',
    source: 'provider_audit',
    last_verified_recipient: null,
    last_provider_rejection: latestRejection?.detail || null,
    required_next_action: 'verify_recipient_in_agentmail_provider_send_allowlist_before_dispatch',
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    raw_secret_values_exposed: false,
  }
}

function sendAccessForInbox(inbox: AgentMailInboxRecord, env: Record<string, string | undefined>, dispatchRuntime: ReturnType<typeof buildAgentMailDispatchRuntimeStatus>, db: Database.Database = getDatabase()) {
  const policy = sendPolicyForInbox(inbox)
  const inbox_state = inboxStatus(inbox)
  const sendCapablePolicy = policy === 'approval_required' || policy === 'allowlisted_auto_send'
  const credentialResolution = inbox.inbox_address
    ? resolveAgentMailScopedCredential({ db, agentId: inbox.agent_id, inboxId: inbox.inbox_address, requiredPermissions: sendCapablePolicy ? ['message_send'] : [], env })
    : null
  const credential = credentialResolution?.credential_status || 'missing'
  const permissions = credentialResolution?.permissions || permissionMap(false, sendCapablePolicy)
  const blockers: string[] = []

  if (inbox_state === 'missing') blockers.push('agentmail_inbox_assignment_missing', 'agentmail_inbox_not_provisioned', 'agentmail_inbox_address_missing')
  if (credential === 'missing' || credential === 'detected') blockers.push('agentmail_inbox_credential_required')
  for (const blocker of credentialResolution?.blockers || []) blockers.push(blocker)
  if (!permissions.message_send && sendCapablePolicy) blockers.push('message_send_permission_missing')
  if (policy === 'monitor_only') blockers.push('gateway_policy_monitor_only')
  if (policy === 'draft_only') blockers.push('gateway_policy_draft_only')
  const dispatchRuntimeBlocker = runtimeBlocker(dispatchRuntime.status)
  const perSendDispatchBlockers = [
    policy === 'approval_required' ? 'owner_approval_required' : null,
    dispatchRuntimeBlocker,
  ].filter((blocker): blocker is string => Boolean(blocker))

  return {
    inbox_id: inbox.inbox_address,
    inbox_status: inbox_state,
    credential_status: credential,
    scoped_credential: credentialResolution ? {
      credential_ref: credentialResolution.credentialRef,
      key_available: credentialResolution.keyAvailable,
      key_masked: credentialResolution.keyMasked,
      scope: credentialResolution.scope,
      blockers: credentialResolution.blockers,
      credential_values_exposed: false,
    } : null,
    permission_status: permissions,
    bridge_allowed: dispatchRuntime.status === 'active',
    dispatch_runtime_allowed: dispatchRuntime.status === 'active',
    gateway_policy: policy,
    agentmail_provider_send_allowlist: agentMailProviderSendAllowlistStatus(db, inbox, policy),
    send_ready: blockers.length === 0,
    approval_gated_send_capable: sendCapablePolicy && blockers.length === 0,
    dispatch_blockers: perSendDispatchBlockers,
    blockers,
  }
}

export function buildAgentMailSendAccessStatus(
  db: Database.Database = getDatabase(),
  env: Record<string, string | undefined> = process.env,
) {
  ensureAgentMailSchema(db)
  const connect = buildAgentMailConnectStatus(db, env)
  const bridgeRow = latestAgentMailBridgeSession(db)
  const bridgeState = normalizeBridgeState(bridgeRow)
  const dispatchRuntime = buildAgentMailDispatchRuntimeStatus(db)
  const inboxes = listAgentMailInboxes(db)
  const agents = inboxes.reduce((acc, inbox) => {
    acc[inbox.agent_id] = {
      agent_id: inbox.agent_id,
      display_name: inbox.display_name,
      role: inbox.role,
      autonomy_level: inbox.autonomy_level,
      send_policy: inbox.agent_id === 'pi' || inbox.agent_id === 'agent_zero' ? 'owner_approval_required' : 'no_external_send_by_default',
      ...sendAccessForInbox(inbox, env, dispatchRuntime, db),
    }
    return acc
  }, {} as Record<string, Record<string, unknown>>)

  const setupStatus = evaluateAgentMailSetup({
    db,
    connect,
    inboxes,
    agents,
    dispatchRuntimeStatus: dispatchRuntime.status,
    bridgeState,
    auditReady: true,
  })

  return {
    ok: true,
    source: 'agentmail_send_access',
    generated_at: nowIso(),
    global: {
      agentmail_connected: connect.status !== 'owner_sso_required' && connect.status !== 'api_key_required',
      organization_selected: connect.status === 'sync_ready' || connect.status === 'inbox_sync_complete' || connect.status === 'monitor_ready',
      bridge_session_state: bridgeState,
      bridge_session_id: bridgeRow?.id || null,
      legacy_bridge_session_state: bridgeState,
      expires_at: bridgeState === 'active' ? bridgeRow?.expires_at || null : null,
      sends_remaining_per_agent: bridgeRow ? Math.max(0, bridgeRow.max_sends_per_session_per_agent - bridgeRow.sends_dispatched) : 0,
      max_sends_per_session_per_agent: bridgeRow?.max_sends_per_session_per_agent || 10,
      max_recipients_per_send: bridgeRow?.max_recipients_per_send || 10,
      agentmail_dispatch_runtime: dispatchRuntime,
      send_default: 'approval_required',
      execution_enabled: false,
      send_enabled: false,
      approval_channel: 'canonical_owner_channel',
      real_send_adapter: {
        state: 'configured',
        endpoint: 'https://api.agentmail.to/v0/inboxes/:inbox_id/messages/send',
        test_status: 'not_run',
        credential_values_exposed: false,
      },
    },
    agents,
    setup_status: setupStatus,
    primary_blocker: setupStatus.primary_blocker,
    blockers: setupStatus.blockers,
    setup_state: setupStatus.setup_state,
    per_send_status: setupStatus.per_send_status,
    next_action: setupStatus.next_action,
    agentmail_ready: setupStatus.agentmail_ready,
    send_ready: setupStatus.send_ready,
    inbox_summary: setupStatus.inboxes,
    credential_summary: setupStatus.credentials,
    setup_checklist: setupStatus.checklist,
    permission_keys: AGENTMAIL_SEND_PERMISSIONS,
    exact_blockers: setupStatus.exact_blockers,
    ...SAFE_FLAGS,
  }
}


export function buildAgentMailCredentialProvisionPreview(db: Database.Database = getDatabase(), env: Record<string, string | undefined> = process.env) {
  ensureAgentMailSchema(db)
  const sendAccess = buildAgentMailSendAccessStatus(db, env)
  const inboxes = listAgentMailInboxes(db)
  const providerVaultAvailable = loadSecretMasterKey(env).ok
  const targets = inboxes.map((inbox) => {
    const agent = sendAccess.agents[inbox.agent_id] as any
    const sendCapable = agentMailSendCapable(inbox.agent_id)
    const credentialRef = agentMailCredentialRef(inbox.agent_id)
    const proposedPermissions = proposedAgentMailCredentialPermissions(inbox.agent_id)
    return {
      agent_id: inbox.agent_id,
      display_name: inbox.display_name,
      role: inbox.role,
      inbox_id: inbox.inbox_address,
      inbox_required: true,
      credential_ref: credentialRef,
      credential_scope: 'inbox',
      scoped_credential_required: true,
      existing_credential_ref: agent?.scoped_credential?.credential_ref || null,
      credential_status: agent?.credential_status || 'missing',
      existing_key_masked: agent?.scoped_credential?.key_masked || null,
      provider_vault_storage_available: providerVaultAvailable,
      send_capable: sendCapable,
      permissions_detected: agent?.permission_status || permissionMap(false, sendCapable),
      proposed_permissions: proposedPermissions,
      permissions_missing: AGENTMAIL_SEND_PERMISSIONS.filter((permission) => Boolean(proposedPermissions[permission]) && !agent?.permission_status?.[permission]),
      safe_next_action: agent?.credential_status === 'scoped'
        ? 'run_credential_readiness_test'
        : providerVaultAvailable
          ? 'request_owner_approval_for_scoped_inbox_key_creation'
          : 'configure_approved_runtime_secret_storage',
      send_policy: agentMailCredentialSendPolicy(inbox.agent_id),
    }
  })
  recordAgentMailAudit(db, 'agentmail_scoped_credential_preview_started', 'ok', 'preview_only_no_key_creation')
  recordAgentMailAudit(db, 'agentmail_scoped_credential_preview_completed', 'ok', `targets=${targets.length};provider_vault_available=${providerVaultAvailable}`)
  return {
    ok: true,
    source: 'agentmail_scoped_credential_provision_preview',
    generated_at: nowIso(),
    provision_automatically: false,
    provider_vault_available: providerVaultAvailable,
    secret_store: 'existing_mission_control_provider_vault',
    exact_blocker: providerVaultAvailable ? 'agentmail_scoped_credential_provisioning_approval_required' : 'agentmail_runtime_secret_store_required',
    credential_refs_to_create: targets.filter((target) => target.credential_status !== 'scoped').map((target) => target.credential_ref),
    email_sent: false,
    send_enabled: false,
    scoped_credentials_created: false,
    targets,
    ...SAFE_FLAGS,
  }
}

export function createAgentMailCredentialProvisionRequest(db: Database.Database = getDatabase(), requester = 'owner') {
  ensureAgentMailSchema(db)
  const preview = buildAgentMailCredentialProvisionPreview(db)
  const { request: approval, created } = createApprovalRequest({
    connector: 'agentmail',
    action: 'agentmail_scoped_credentials_provisioning',
    target: 'agentmail_scoped_credentials',
    target_key: 'agentmail:scoped-credentials',
    requester: sanitizeText(requester, 'owner', 120),
    risk_level: 'medium',
    protected_category: 'credential_write',
    reason: 'Owner approval is required before scoped AgentMail inbox send credentials can be created and stored.',
    approval_scope: {
      credential_scope: 'inbox',
      no_org_wide_default: true,
      credential_refs: preview.credential_refs_to_create,
      send_capable_roles: ['pi', 'agent_zero'],
      no_send_roles: ['agentmail_monitor', 'agentmail_audit'],
      control_plane_roles: ['gateway', 'bridge_unit'],
      send_policy: 'approval_gated_send_for_pi_and_agent_zero_only',
      email_sent: false,
      credential_values_exposed: false,
    },
    idempotency_key: 'agentmail:scoped-credentials:provisioning:v1',
  })
  recordAgentMailAudit(db, 'agentmail_scoped_credential_provisioning_requested', 'blocked', `approval_id=${approval.id};preview_targets=${preview.targets.length}`)
  return { ok: true, source: 'agentmail_scoped_credential_provision_request', approval_id: approval.id, approval_state: approval.approval_state, approval_request_created: created, preview, exact_blocker: 'canonical_owner_approval_required', email_sent: false, send_enabled: false, ...SAFE_FLAGS }
}

export function approveAgentMailCredentialProvision(
  db: Database.Database = getDatabase(),
  input: string | { approvalId?: string | null; actor?: string } = 'owner',
) {
  ensureAgentMailSchema(db)
  const actor = typeof input === 'string' ? input : input.actor || 'owner'
  const approvalId = typeof input === 'string' ? null : input.approvalId || null
  const pending = approvalId
    ? getApprovalRequest(approvalId)
    : listApprovalRequests().find((request) => request.connector === 'agentmail'
      && request.approval_state === 'pending'
      && (request.action === 'agentmail_scoped_credentials_provisioning' || request.action === 'agentmail_scoped_credential_provision_request'))
  if (!pending) {
    recordAgentMailAudit(db, 'agentmail_scoped_credential_provisioning_approved', 'blocked', 'canonical_owner_approval_request_missing')
    return { ok: false, source: 'agentmail_scoped_credential_provision_approve', approval_state: 'missing', exact_blocker: 'canonical_owner_approval_required', apply_enabled: false, email_sent: false, send_enabled: false, ...SAFE_FLAGS }
  }
  const approved = pending.approval_state === 'approved'
    ? pending
    : resolveApprovalRequest(pending.id, 'approved', sanitizeText(actor, 'owner', 120), 'Owner approved scoped AgentMail inbox credential provisioning only.')
  recordAgentMailAudit(db, 'agentmail_scoped_credential_provisioning_approved', 'ok', `approval_id=${pending.id};actor=${sanitizeText(actor, 'owner', 120)}`)
  return { ok: Boolean(approved), source: 'agentmail_scoped_credential_provision_approve', approval_id: pending.id, approval_state: approved?.approval_state || 'missing', exact_blocker: approved ? null : 'canonical_owner_approval_required', apply_enabled: Boolean(approved), email_sent: false, send_enabled: false, ...SAFE_FLAGS }
}

type AgentMailCredentialProvisionApplyInput = {
  db?: Database.Database
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  approvalId?: string | null
  actor?: string
}

function normalizeCredentialProvisionApplyInput(input?: Database.Database | AgentMailCredentialProvisionApplyInput): Required<Pick<AgentMailCredentialProvisionApplyInput, 'db' | 'env'>> & Omit<AgentMailCredentialProvisionApplyInput, 'db' | 'env'> {
  if (input && typeof (input as Database.Database).prepare === 'function') {
    return { db: input as Database.Database, env: process.env, actor: 'mission-control' }
  }
  const value = (input || {}) as AgentMailCredentialProvisionApplyInput
  return { db: value.db || getDatabase(), env: value.env || process.env, fetchImpl: value.fetchImpl, approvalId: value.approvalId || null, actor: value.actor || 'mission-control' }
}

export async function applyAgentMailCredentialProvision(input?: Database.Database | AgentMailCredentialProvisionApplyInput) {
  const normalized = normalizeCredentialProvisionApplyInput(input)
  const db = normalized.db
  const env = normalized.env
  ensureAgentMailSchema(db)
  const approval = approvedAgentMailScopedCredentialRequest(normalized.approvalId)
  if (!approval) {
    recordAgentMailAudit(db, 'agentmail_scoped_credential_provisioning_failed', 'blocked', 'canonical_owner_approval_required')
    return { ok: false, source: 'agentmail_scoped_credential_provision_apply', exact_blocker: 'canonical_owner_approval_required', credentials_created: 0, credentials_stored: 0, scoped_credentials_created: false, email_sent: false, send_enabled: false, ...SAFE_FLAGS }
  }
  const preview = buildAgentMailCredentialProvisionPreview(db, env)
  if (!preview.provider_vault_available) {
    recordAgentMailAudit(db, 'agentmail_scoped_credential_failed', 'blocked', 'agentmail_runtime_secret_store_required')
    return { ok: false, source: 'agentmail_scoped_credential_provision_apply', approval_id: approval.id, exact_blocker: 'agentmail_runtime_secret_store_required', credentials_created: 0, credentials_stored: 0, scoped_credentials_created: false, email_sent: false, send_enabled: false, ...SAFE_FLAGS }
  }

  const results: Array<Record<string, unknown>> = []
  let created = 0
  let stored = 0
  let failed = 0
  recordAgentMailAudit(db, 'agentmail_scoped_credential_create_started', 'ok', `approval_id=${approval.id};targets=${preview.targets.length}`)
  for (const target of preview.targets) {
    if (!target.inbox_id) {
      failed += 1
      recordAgentMailAudit(db, 'agentmail_scoped_credential_missing', 'blocked', `agent=${target.agent_id};inbox_missing`)
      results.push({ agent_id: target.agent_id, ok: false, exact_blocker: 'agentmail_inbox_assignment_missing', credential_ref: target.credential_ref, ...SAFE_FLAGS })
      continue
    }
    if (target.credential_status === 'scoped') {
      stored += 1
      results.push({ agent_id: target.agent_id, ok: true, reused: true, credential_ref: target.credential_ref, key_masked: target.existing_key_masked, permissions: target.permissions_detected, ...SAFE_FLAGS })
      continue
    }

    const create = await createAndStoreAgentMailScopedCredential({
      db,
      env,
      fetchImpl: normalized.fetchImpl,
      agentId: target.agent_id,
      inboxId: target.inbox_id,
      credentialRef: target.credential_ref,
      name: `Mission Control ${target.display_name} scoped inbox key`,
      permissions: target.proposed_permissions as AgentMailPermissionMap,
      actor: normalized.actor || 'mission-control',
    })
    if (!create.ok) {
      failed += 1
      recordAgentMailAudit(db, 'agentmail_scoped_credential_failed', 'blocked', `agent=${target.agent_id};blocker=${create.exact_blocker}`)
      results.push(create)
      continue
    }

    created += 1
    stored += 1
    upsertAgentMailScopedCredentialMetadata(db, {
      agentId: target.agent_id,
      inboxId: target.inbox_id,
      credentialRef: target.credential_ref,
      maskedPreview: create.key_masked,
      permissions: target.proposed_permissions as AgentMailPermissionMap,
      status: 'scoped',
      exactBlocker: null,
    })
    const resolution = resolveAgentMailScopedCredential({
      db,
      env,
      agentId: target.agent_id,
      inboxId: target.inbox_id,
      requiredPermissions: agentMailSendCapable(target.agent_id) ? ['message_send'] : ['inbox_read'],
    })
    recordAgentMailAudit(db, 'agentmail_scoped_credential_created', 'ok', `agent=${target.agent_id};ref=${target.credential_ref}`)
    recordAgentMailAudit(db, 'agentmail_scoped_credential_stored', 'ok', `agent=${target.agent_id};ref=${target.credential_ref}`)
    recordAgentMailAudit(db, 'agentmail_scoped_credential_resolved', resolution.keyAvailable ? 'ok' : 'blocked', `agent=${target.agent_id};ref=${target.credential_ref}`)
    recordAgentMailAudit(db, 'agentmail_scoped_credential_permission_verified', resolution.blockers.length ? 'blocked' : 'ok', `agent=${target.agent_id};missing=${resolution.blockers.join('|') || 'none'}`)
    results.push({
      ...create,
      resolved: resolution.keyAvailable,
      blockers: resolution.blockers,
    })
  }

  const sendAccess = buildAgentMailSendAccessStatus(db, env)
  const ok = failed === 0
  recordAgentMailAudit(db, 'agentmail_scoped_credential_provisioning_completed', ok ? 'ok' : 'blocked', `created=${created};stored=${stored};failed=${failed}`)
  return {
    ok,
    source: 'agentmail_scoped_credential_provision_apply',
    generated_at: nowIso(),
    approval_id: approval.id,
    credentials_created: created,
    credentials_stored: stored,
    credentials_failed: failed,
    credential_refs_used: preview.targets.map((target) => target.credential_ref),
    masked_key_confirmations: results.map((result) => ({
      agent_id: result.agent_id,
      credential_ref: result.credential_ref,
      key_masked: result.key_masked || null,
      ok: Boolean(result.ok),
    })),
    per_agent_results: results,
    current_primary_blocker: sendAccess.primary_blocker,
    full_blocker_list: sendAccess.blockers,
    scoped_credentials_created: created > 0 || stored === preview.targets.length,
    email_sent: false,
    send_enabled: false,
    execution_enabled: false,
    exact_blocker: ok ? null : (results.find((result) => result.exact_blocker)?.exact_blocker as string | null) || 'agentmail_scoped_credential_failed',
    ...SAFE_FLAGS,
  }
}

export function createAgentMailBridgeSessionRequest(
  db: Database.Database = getDatabase(),
  input: { requester?: string; ttl_minutes?: number; max_sends_per_session_per_agent?: number; max_recipients_per_send?: number } = {},
) {
  ensureAgentMailSchema(db)
  const requester = sanitizeText(input.requester || 'owner', 'owner', 120)
  const ttlMinutes = Number.isFinite(input.ttl_minutes) && Number(input.ttl_minutes) > 0 ? Math.min(Number(input.ttl_minutes), 240) : 60
  const maxSends = Number.isFinite(input.max_sends_per_session_per_agent) && Number(input.max_sends_per_session_per_agent) > 0
    ? Math.min(Number(input.max_sends_per_session_per_agent), 10)
    : 10
  const maxRecipients = Number.isFinite(input.max_recipients_per_send) && Number(input.max_recipients_per_send) > 0
    ? Math.min(Number(input.max_recipients_per_send), 10)
    : 10
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString()
  const { request: approval, created } = createApprovalRequest({
    connector: 'agentmail',
    action: 'agentmail_bridge_session_request',
    target: 'agentmail_bridge_session',
    target_key: 'agentmail:bridge-session',
    requester,
    risk_level: 'medium',
    protected_category: 'connector_send_upload',
    reason: 'Owner approval is required before Mission Control can dispatch approved AgentMail send requests through Bridge Unit.',
    approval_scope: {
      session_duration_minutes: ttlMinutes,
      max_sends_per_session_per_agent: maxSends,
      max_recipients_per_send: maxRecipients,
      attachments_policy: 'blocked_until_scanning_exists',
      external_domain_policy: 'owner_approval_required',
      credential_values_exposed: false,
    },
    idempotency_key: 'agentmail:bridge-session:request',
  })
  const id = `ambs_${sha(`${approval.id}:${expiresAt}`).slice(0, 18)}`
  db.prepare(`
    INSERT INTO agentmail_bridge_sessions (id, state, approval_request_id, requester, expires_at, max_sends_per_session_per_agent, max_recipients_per_send)
    VALUES (?, 'pending_owner_approval', ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(id, approval.id, requester, expiresAt, maxSends, maxRecipients)
  recordAgentMailAudit(db, 'agentmail_bridge_session_requested', 'blocked', `approval_id=${approval.id};canonical_owner_channel_required`)
  recordAgentMailAudit(db, 'agentmail_action_bridge_session_requested', 'blocked', `approval_id=${approval.id};max_sends=${maxSends};max_recipients=${maxRecipients}`)
  return {
    ok: true,
    source: 'agentmail_bridge_session_request',
    state: 'pending_owner_approval',
    bridge_session_id: id,
    approval_request_created: created,
    approval_id: approval.id,
    approval_state: approval.approval_state,
    bridge_session_required: true,
    execution_enabled: false,
    dispatch_enabled: false,
    accepted_for_execution: false,
    exact_blocker: 'canonical_owner_approval_required',
    expires_at: expiresAt,
    ...SAFE_FLAGS,
  }
}

export function revokeAgentMailBridgeSession(db: Database.Database = getDatabase(), actor = 'owner') {
  ensureAgentMailSchema(db)
  const row = latestAgentMailBridgeSession(db)
  if (row) {
    db.prepare(`UPDATE agentmail_bridge_sessions SET state = 'revoked', updated_at = unixepoch() WHERE id = ?`).run(row.id)
  }
  recordAgentMailAudit(db, 'agentmail_bridge_session_revoked', 'ok', `actor=${sanitizeText(actor, 'owner', 120)}`)
  return {
    ok: true,
    source: 'agentmail_bridge_session_revoke',
    state: 'revoked',
    bridge_session_id: row?.id || null,
    execution_enabled: false,
    dispatch_enabled: false,
    ...SAFE_FLAGS,
  }
}


export function approveAgentMailBridgeSession(
  db: Database.Database = getDatabase(),
  input: { actor?: string } = {},
) {
  ensureAgentMailSchema(db)
  const row = latestAgentMailBridgeSession(db)
  if (!row) {
    recordAgentMailAudit(db, 'agentmail_bridge_session_approved', 'blocked', 'bridge_session_request_missing')
    return { ok: false, source: 'agentmail_bridge_session_approve', state: 'inactive', exact_blocker: 'bridge_session_request_missing', dispatch_enabled: false, ...SAFE_FLAGS }
  }
  const expiresAt = row.expires_at && Date.parse(row.expires_at) > Date.now()
    ? row.expires_at
    : new Date(Date.now() + 60 * 60_000).toISOString()
  db.prepare(`UPDATE agentmail_bridge_sessions SET state = 'active', expires_at = ?, updated_at = unixepoch() WHERE id = ?`).run(expiresAt, row.id)
  recordAgentMailAudit(db, 'agentmail_bridge_session_approved', 'ok', `actor=${sanitizeText(input.actor || 'owner', 'owner', 120)}`)
  recordAgentMailAudit(db, 'agentmail_bridge_session_active', 'ok', `expires_at=${expiresAt}`)
  recordAgentMailAudit(db, 'agentmail_action_bridge_session_approved', 'ok', `actor=${sanitizeText(input.actor || 'owner', 'owner', 120)}`)
  recordAgentMailAudit(db, 'agentmail_action_bridge_session_active', 'ok', `expires_at=${expiresAt}`)
  return {
    ok: true,
    source: 'agentmail_bridge_session_approve',
    state: 'active',
    bridge_session_id: row.id,
    bridge_session_active: true,
    expires_at: expiresAt,
    execution_enabled: false,
    dispatch_enabled: false,
    send_default: 'approval_required',
    ...SAFE_FLAGS,
  }
}

function findInboxForAgent(db: Database.Database, agentId: string) {
  return listAgentMailInboxes(db).find((inbox) => inbox.agent_id === agentId) || null
}

function sendRequestFromRow(row: AgentMailSendRequestRow) {
  return {
    id: row.id,
    agent_id: row.agent_id,
    inbox_id: row.inbox_id,
    to: parseJsonArray(row.to_json),
    cc: parseJsonArray(row.cc_json),
    bcc: parseJsonArray(row.bcc_json),
    subject: row.subject,
    text: row.text_body,
    html_present: Boolean(row.html_body),
    thread_id: row.thread_id,
    reply_to_message_id: row.reply_to_message_id,
    labels: parseJsonArray(row.labels_json),
    state: row.state,
    gateway_policy: row.gateway_policy,
    exact_blocker: row.exact_blocker,
    approval_request_id: row.approval_request_id,
    bridge_session_id: row.bridge_session_id,
    message_id: row.message_id,
  }
}

function getSendRequest(db: Database.Database, id: string) {
  ensureAgentMailSchema(db)
  return db.prepare(`SELECT * FROM agentmail_send_requests WHERE id = ? LIMIT 1`).get(id) as AgentMailSendRequestRow | undefined
}

export function createAgentMailSendPreview(db: Database.Database = getDatabase(), input: AgentMailSendInput = {}) {
  ensureAgentMailSchema(db)
  const agentId = sanitizeText(input.agent_id, '', 80)
  const inboxId = sanitizeText(input.inbox_id, '', 180)
  const inbox = findInboxForAgent(db, agentId)
  const to = stringArray(input.to, 10)
  const cc = stringArray(input.cc, 10)
  const bcc = stringArray(input.bcc, 10)
  const subject = sanitizeText(input.subject, '(no subject)', 220)
  const textBody = sanitizeText(input.text, '', 5000)
  const htmlBody = input.html ? sanitizeText(input.html, '', 5000) : null
  const labels = Array.from(new Set(['mission-control', 'agentmail', 'approval-gated', ...stringArray(input.labels, 10)]))
  let exactBlocker: string | null = null

  if (!inbox || !inbox.inbox_address) exactBlocker = 'agentmail_inbox_assignment_missing'
  else if (inbox.inbox_address.toLowerCase() !== inboxId.toLowerCase()) exactBlocker = 'wrong_agent_inbox'
  else if (!to.length) exactBlocker = 'missing_recipient'
  else if (!textBody) exactBlocker = 'missing_text_body'
  else exactBlocker = 'owner_approval_required'
  const ok = exactBlocker === 'owner_approval_required'

  const id = `amsr_${sha(`${agentId}:${inboxId}:${subject}:${nowIso()}`).slice(0, 20)}`
  db.prepare(`
    INSERT INTO agentmail_send_requests (
      id, agent_id, inbox_id, to_json, cc_json, bcc_json, subject, text_body,
      html_body, thread_id, reply_to_message_id, labels_json, state, gateway_policy, exact_blocker
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'preview_created', 'approval_required', ?)
  `).run(
    id,
    agentId || 'unknown',
    inboxId || 'unknown',
    JSON.stringify(to),
    JSON.stringify(cc),
    JSON.stringify(bcc),
    subject,
    textBody,
    htmlBody,
    sanitizeText(input.thread_id, '', 140) || null,
    sanitizeText(input.reply_to_message_id, '', 140) || null,
    JSON.stringify(labels),
    exactBlocker,
  )
  recordAgentMailAudit(db, 'agentmail_send_preview_created', ok ? 'ok' : 'blocked', exactBlocker || 'preview_created')
  recordAgentMailAudit(db, 'agentmail_gateway_policy_evaluated', ok ? 'ok' : 'blocked', ok ? 'approval_gated_send' : exactBlocker || 'gateway_blocked')
  const row = getSendRequest(db, id)!
  return {
    ok,
    source: 'agentmail_send_preview',
    send_request: sendRequestFromRow(row),
    dispatch_enabled: false,
    approval_required: true,
    exact_blocker: exactBlocker,
    ...SAFE_FLAGS,
  }
}

export function createAgentMailSendRequest(db: Database.Database = getDatabase(), sendRequestId: string, requester = 'agentmail') {
  ensureAgentMailSchema(db)
  const row = getSendRequest(db, sendRequestId)
  if (!row) {
    return { ok: false, source: 'agentmail_send_request', exact_blocker: 'send_request_not_found', dispatch_enabled: false, ...SAFE_FLAGS }
  }
  const { request: approval } = createApprovalRequest({
    connector: 'agentmail',
    action: 'agentmail_send_message',
    target: row.agent_id,
    target_key: row.id,
    requester,
    risk_level: 'medium',
    protected_category: 'connector_send_upload',
    reason: `AgentMail send request for ${row.agent_id} requires canonical owner approval before dispatch.`,
    approval_scope: {
      agent_id: row.agent_id,
      inbox_id: row.inbox_id,
      recipients_count: parseJsonArray(row.to_json).length + parseJsonArray(row.cc_json).length + parseJsonArray(row.bcc_json).length,
      subject: row.subject,
      credential_values_exposed: false,
    },
    idempotency_key: `agentmail:send:${row.id}`,
  })
  db.prepare(`UPDATE agentmail_send_requests SET state = 'approval_requested', approval_request_id = ?, exact_blocker = 'owner_approval_required', updated_at = unixepoch() WHERE id = ?`).run(approval.id, row.id)
  db.prepare(`INSERT INTO agentmail_approvals (id, event_id, action_type, state, exact_blocker) VALUES (?, ?, 'outbound_send', 'pending', 'owner_approval_required') ON CONFLICT(id) DO NOTHING`).run(`ama_${row.id}`, row.id)
  recordAgentMailAudit(db, 'agentmail_send_request_created', 'blocked', `approval_id=${approval.id};canonical_owner_channel_required`)
  recordAgentMailAudit(db, 'agentmail_send_approval_required', 'blocked', `approval_id=${approval.id};send_request_id=${row.id}`)
  const updated = getSendRequest(db, row.id)!
  return {
    ok: true,
    source: 'agentmail_send_request',
    send_request: sendRequestFromRow(updated),
    approval_id: approval.id,
    approval_state: approval.approval_state,
    approval_required: true,
    dispatch_enabled: false,
    exact_blocker: 'owner_approval_required',
    ...SAFE_FLAGS,
  }
}


export function approveAgentMailSendRequest(
  db: Database.Database = getDatabase(),
  sendRequestId: string,
  input: { actor?: string } = {},
) {
  ensureAgentMailSchema(db)
  const row = getSendRequest(db, sendRequestId)
  if (!row) return { ok: false, source: 'agentmail_send_approve', exact_blocker: 'send_request_not_found', dispatch_enabled: false, ...SAFE_FLAGS }
  const dispatchRuntime = buildAgentMailDispatchRuntimeStatus(db)
  const runtimeExactBlocker = runtimeBlocker(dispatchRuntime.status)
  db.prepare(`UPDATE agentmail_send_requests SET state = 'owner_approved', exact_blocker = ?, updated_at = unixepoch() WHERE id = ?`).run(runtimeExactBlocker, row.id)
  db.prepare(`UPDATE agentmail_approvals SET state = 'approved', exact_blocker = ? WHERE id = ?`).run(runtimeExactBlocker || 'approved_send_dispatch_ready', `ama_${row.id}`)
  recordAgentMailAudit(db, 'agentmail_send_approved', 'ok', `actor=${sanitizeText(input.actor || 'owner', 'owner', 120)}`, row.id)
  const updated = getSendRequest(db, row.id)!
  return {
    ok: true,
    source: 'agentmail_send_approve',
    send_request: sendRequestFromRow(updated),
    approval_state: 'approved',
    dispatch_enabled: false,
    exact_blocker: runtimeExactBlocker,
    dispatch_runtime: dispatchRuntime,
    ...SAFE_FLAGS,
  }
}

type AgentMailDispatchAdapter = { sendAgentMailMessage: (input: any) => Promise<AgentMailAdapterSendResult> }

type AgentMailDispatchOptions = { env?: Record<string, string | undefined>; adapter?: AgentMailDispatchAdapter }

function normalizeDispatchOptions(input: Record<string, string | undefined> | AgentMailDispatchOptions = process.env): AgentMailDispatchOptions {
  if ('adapter' in input || 'env' in input) return input as AgentMailDispatchOptions
  return { env: input as Record<string, string | undefined> }
}

export function dispatchAgentMailSendRequest(db: Database.Database = getDatabase(), sendRequestId: string, optionsInput: Record<string, string | undefined> | AgentMailDispatchOptions = process.env): any {
  const options = normalizeDispatchOptions(optionsInput)
  const env = options.env || process.env
  ensureAgentMailSchema(db)
  const row = getSendRequest(db, sendRequestId)
  if (!row) return { ok: false, source: 'agentmail_send_dispatch', exact_blocker: 'send_request_not_found', dispatch_enabled: false, ...SAFE_FLAGS }
  const bridgeRow = latestAgentMailBridgeSession(db)
  const bridgeState = normalizeBridgeState(bridgeRow)
  const dispatchRuntime = buildAgentMailDispatchRuntimeStatus(db)
  const inbox = findInboxForAgent(db, row.agent_id)
  const access = inbox ? sendAccessForInbox(inbox, env, dispatchRuntime, db) : null
  const credentialResolution = inbox?.inbox_address ? resolveAgentMailScopedCredential({ db, env, agentId: row.agent_id, inboxId: inbox.inbox_address, requiredPermissions: ['message_send'] }) : null
  const recipientCount = parseJsonArray(row.to_json).length + parseJsonArray(row.cc_json).length + parseJsonArray(row.bcc_json).length
  let exactBlocker: string | null = null

  if (row.state !== 'owner_approved') exactBlocker = 'owner_approval_required'
  else if (dispatchRuntime.status !== 'active') exactBlocker = runtimeBlocker(dispatchRuntime.status)
  else if (!inbox || !inbox.inbox_address) exactBlocker = 'agentmail_inbox_assignment_missing'
  else if (inbox.inbox_address.toLowerCase() !== row.inbox_id.toLowerCase()) exactBlocker = 'wrong_agent_inbox'
  else if (!access || access.credential_status !== 'scoped') exactBlocker = credentialResolution?.blockers.includes('scoped_credential_missing') ? 'scoped_credential_missing' : 'agentmail_inbox_credential_required'
  else if (credentialResolution?.blockers.includes('scoped_credential_wrong_inbox')) exactBlocker = 'scoped_credential_wrong_inbox'
  else if (credentialResolution?.blockers.includes('agentmail_runtime_secret_store_required')) exactBlocker = 'agentmail_runtime_secret_store_required'
  else if (!access.permission_status.message_send) exactBlocker = 'message_send_permission_missing'
  else if (recipientCount > dispatchRuntime.max_recipients_per_send) exactBlocker = 'recipient_limit_exceeded'
  else if (dispatchRuntime.sends_remaining_per_hour <= 0) exactBlocker = 'send_limit_exceeded'

  if (exactBlocker) {
    db.prepare(`UPDATE agentmail_send_requests SET state = 'dispatch_blocked', exact_blocker = ?, bridge_session_id = NULL, updated_at = unixepoch() WHERE id = ?`).run(exactBlocker, row.id)
    recordAgentMailAudit(db, 'agentmail_send_dispatch_blocked', 'blocked', exactBlocker, row.id)
    return {
      ok: false,
      source: 'agentmail_send_dispatch',
      send_request: sendRequestFromRow(getSendRequest(db, row.id)!),
      dispatch_enabled: false,
      execution_enabled: false,
      exact_blocker: exactBlocker,
      bridge_session_state: bridgeState,
      dispatch_runtime: dispatchRuntime,
      ...SAFE_FLAGS,
    }
  }

  const secret = credentialResolution ? loadAgentMailCredentialSecret(credentialResolution, env, db) : null
  if (!secret || !credentialResolution?.credentialRef) {
    exactBlocker = 'agentmail_runtime_secret_store_required'
    db.prepare(`UPDATE agentmail_send_requests SET state = 'dispatch_blocked', exact_blocker = ?, bridge_session_id = NULL, updated_at = unixepoch() WHERE id = ?`).run(exactBlocker, row.id)
    recordAgentMailAudit(db, 'agentmail_send_dispatch_blocked', 'blocked', exactBlocker, row.id)
    return { ok: false, source: 'agentmail_send_dispatch', send_request: sendRequestFromRow(getSendRequest(db, row.id)!), dispatch_enabled: false, execution_enabled: false, exact_blocker: exactBlocker, bridge_session_state: bridgeState, dispatch_runtime: dispatchRuntime, ...SAFE_FLAGS }
  }

  const adapter = options.adapter || { sendAgentMailMessage }
  recordAgentMailAudit(db, 'agentmail_real_send_attempted', 'ok', `agent=${row.agent_id};inbox=${row.inbox_id}`, row.id)
  return adapter.sendAgentMailMessage({
    agentId: row.agent_id,
    inboxId: row.inbox_id,
    credentialRef: credentialResolution.credentialRef,
    apiKey: secret,
    to: parseJsonArray(row.to_json),
    cc: parseJsonArray(row.cc_json),
    bcc: parseJsonArray(row.bcc_json),
    subject: row.subject,
    text: row.text_body,
    html: row.html_body,
    labels: parseJsonArray(row.labels_json),
    approvalId: row.approval_request_id,
    bridgeSessionId: null,
    gatewayDecisionId: `agentmail:${row.id}`,
  }).then((result) => {
    if (!result.ok) {
      db.prepare(`UPDATE agentmail_send_requests SET state = 'dispatch_blocked', exact_blocker = ?, bridge_session_id = NULL, updated_at = unixepoch() WHERE id = ?`).run(result.exact_blocker, row.id)
      recordAgentMailAudit(db, 'agentmail_real_send_failed', 'error', result.exact_blocker, row.id)
      return { ok: false, source: 'agentmail_send_dispatch', send_request: sendRequestFromRow(getSendRequest(db, row.id)!), dispatch_enabled: false, execution_enabled: false, exact_blocker: result.exact_blocker, bridge_session_state: bridgeState, dispatch_runtime: dispatchRuntime, ...SAFE_FLAGS }
    }
    db.prepare(`UPDATE agentmail_send_requests SET state = 'dispatched', exact_blocker = NULL, bridge_session_id = NULL, message_id = ?, thread_id = COALESCE(?, thread_id), updated_at = unixepoch() WHERE id = ?`).run(result.message_id, result.thread_id, row.id)
    db.prepare(`UPDATE agentmail_dispatch_runtime SET sends_dispatched = sends_dispatched + 1, updated_at = unixepoch() WHERE id = 'agentmail_dispatch_runtime'`).run()
    recordAgentMailAudit(db, 'agentmail_real_send_dispatched', 'ok', `message_id=${result.message_id};thread_id=${result.thread_id || 'none'}`, row.id)
    recordAgentMailAudit(db, 'agentmail_send_test_completed', 'ok', `message_id=${result.message_id};thread_id=${result.thread_id || 'none'}`, row.id)
    return {
      ok: true,
      source: 'agentmail_send_dispatch',
      send_request: sendRequestFromRow(getSendRequest(db, row.id)!),
      message_id: result.message_id,
      thread_id: result.thread_id,
      bridge_session_id: null,
      dispatch_runtime: buildAgentMailDispatchRuntimeStatus(db),
      dispatch_enabled: false,
      execution_enabled: false,
      auto_send_enabled: false,
      ...SAFE_FLAGS,
    }
  })
}

export { upsertAgentMailScopedCredentialMetadata }
