import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type Database from 'better-sqlite3'

import { createApprovalRequest } from '@/lib/approval-requests'
import {
  AGENTMAIL_PERMISSION_KEYS,
  loadAgentMailCredentialSecret,
  resolveAgentMailScopedCredential,
  upsertAgentMailScopedCredentialMetadata,
  type AgentMailPermission,
} from '@/lib/agentmail-credential-resolver'
import { sendAgentMailMessage, type AgentMailAdapterSendResult } from '@/lib/agentmail-send-adapter'

import { config, ensureDirExists } from '@/lib/config'
import { getDatabase } from '@/lib/db'

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

export const AGENTMAIL_CONSOLE_URL = 'https://app.agentmail.to'
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
  `)

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
  const hasCredential = Boolean(env.AGENTMAIL_API_KEY || env.AGENTMAIL_TOKEN || env.AGENTMAIL_CREDENTIAL_REF)
  const hasWsUrl = Boolean(env.AGENTMAIL_WS_URL)
  const state: AgentMailMonitorState = monitor?.state === 'running' && ageMs < 90_000
    ? 'running'
    : hasCredential || hasWsUrl
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
      exact_blocker: state === 'running' ? null : hasCredential ? 'agentmail_websocket_listener_not_running' : 'agentmail_credential_required',
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
  const apiKey = env.AGENTMAIL_API_KEY || env.AGENTMAIL_TOKEN || ''
  const credentialRef = env.AGENTMAIL_CREDENTIAL_REF
  const hasApiCredential = Boolean(apiKey || credentialRef)
  const hasWsUrl = Boolean(env.AGENTMAIL_WS_URL)
  const hasLocalMcpConfig = runtimeMetadata.agentmail_mcp_config_detected ?? detectAgentMailMcpConfig()
  const assignedInboxCount = (db.prepare(`SELECT COUNT(*) AS count FROM agentmail_inboxes WHERE inbox_address IS NOT NULL`).get() as { count: number }).count
  const lastAudit = db.prepare(`SELECT action, result, detail, created_at FROM agentmail_audit ORDER BY created_at DESC LIMIT 1`).get() as Record<string, unknown> | undefined

  const status: AgentMailConnectStatus = hasApiCredential && hasWsUrl
    ? assignedInboxCount > 0
      ? monitorStatus.state === 'running' ? 'monitor_ready' : 'inbox_sync_complete'
      : 'sync_ready'
    : hasApiCredential
      ? 'connected'
      : hasLocalMcpConfig
        ? 'api_key_required'
      : 'owner_sso_required'

  return {
    ok: true,
    source: 'agentmail_connect_status',
    generated_at: nowIso(),
    status,
    current_blocker: status === 'api_key_required'
      ? 'agentmail_mcp_oauth_not_visible_to_mission_control_runtime'
      : status === 'owner_sso_required'
      ? 'agentmail_owner_sso_or_api_key_required'
      : status === 'connected'
        ? 'agentmail_ws_url_or_inbox_sync_required'
        : status === 'sync_ready'
          ? 'agentmail_inbox_sync_preview_required'
          : status === 'inbox_sync_complete'
            ? 'agentmail_bridge_session_required'
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
        : 'AgentMail credential metadata detected; sync inbox registry before enabling monitor.',
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
      masked_preview: apiKey ? maskAgentMailKey(apiKey) : credentialRef ? 'configured_by_reference' : null,
      source: apiKey ? 'runtime_environment' : credentialRef ? 'credential_reference' : null,
    },
    last_sync_attempt: lastAudit || null,
    sync_ready: status === 'sync_ready' || status === 'inbox_sync_complete' || status === 'monitor_ready',
    bridge_session_status: 'bridge_session_required',
    local_monitor: monitorStatus.local_monitor,
    send_state: 'approval_required',
    execution_enabled: false,
    send_enabled: false,
    next_status_flow: [
      'owner_sso_required',
      'connected',
      'sync_ready',
      'inbox_sync_complete',
      'bridge_session_required',
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
  return {
    ok: true,
    source: 'agentmail_inbox_sync_preview',
    generated_at: nowIso(),
    organization_connected: status.status !== 'owner_sso_required',
    available_inboxes: inboxes.filter((inbox) => inbox.inbox_address).map((inbox) => ({
      agent_id: inbox.agent_id,
      display_name: inbox.display_name,
      inbox_address: inbox.inbox_address,
      provision_state: inbox.provision_state,
    })),
    known_agents: knownAgents,
    missing_inboxes: knownAgents.filter((agent) => !agent.current_inbox),
    proposed_inbox_assignments: proposedAssignments,
    proposed_scoped_credentials: proposedAssignments.map((assignment) => ({
      agent_id: assignment.agent_id,
      credential_scope: 'inbox_scoped',
      credential_values_exposed: false,
    })),
    bridge_routing_preview: proposedAssignments.map((assignment) => ({
      source: 'agentmail',
      agent_id: assignment.agent_id,
      route: assignment.bridge_route,
      policy_state: 'pending_gateway_review',
      outbound_send_state: 'approval_required',
    })),
    provision_automatically: false,
    send_enabled: false,
    execution_enabled: false,
    bridge_session_required: true,
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

function permissionMap(enabled: boolean, sendCapable: boolean) {
  return AGENTMAIL_SEND_PERMISSIONS.reduce((acc, key) => {
    acc[key] = enabled && (sendCapable || !key.includes('send'))
    return acc
  }, {} as Record<AgentMailSendPermission, boolean>)
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

function sendAccessForInbox(inbox: AgentMailInboxRecord, env: Record<string, string | undefined>, bridgeState: AgentMailBridgeSessionState, db: Database.Database = getDatabase()) {
  const policy = sendPolicyForInbox(inbox)
  const inbox_state = inboxStatus(inbox)
  const sendCapablePolicy = policy === 'approval_required' || policy === 'allowlisted_auto_send'
  const credentialResolution = inbox.inbox_address
    ? resolveAgentMailScopedCredential({ db, agentId: inbox.agent_id, inboxId: inbox.inbox_address, requiredPermissions: sendCapablePolicy ? ['message_send'] : [], env })
    : null
  const credential = credentialResolution?.credential_status || 'missing'
  const permissions = credentialResolution?.permissions || permissionMap(false, sendCapablePolicy)
  const blockers: string[] = []

  if (inbox_state === 'missing') blockers.push('agentmail_inbox_assignment_missing')
  if (credential === 'missing' || credential === 'detected') blockers.push('agentmail_inbox_credential_required')
  for (const blocker of credentialResolution?.blockers || []) blockers.push(blocker)
  if (!permissions.message_send && sendCapablePolicy) blockers.push('message_send_permission_missing')
  if (policy === 'monitor_only') blockers.push('gateway_policy_monitor_only')
  if (policy === 'draft_only') blockers.push('gateway_policy_draft_only')
  if (bridgeState !== 'active') blockers.push(bridgeState === 'inactive' ? 'bridge_session_inactive' : `bridge_session_${bridgeState}`)
  if (policy === 'approval_required') blockers.push('owner_approval_required')

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
    bridge_allowed: bridgeState === 'active',
    gateway_policy: policy,
    send_ready: blockers.length === 0,
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
  const inboxes = listAgentMailInboxes(db)
  const agents = inboxes.reduce((acc, inbox) => {
    acc[inbox.agent_id] = {
      agent_id: inbox.agent_id,
      display_name: inbox.display_name,
      role: inbox.role,
      autonomy_level: inbox.autonomy_level,
      send_policy: inbox.agent_id === 'pi' || inbox.agent_id === 'agent_zero' ? 'owner_approval_required' : 'no_external_send_by_default',
      ...sendAccessForInbox(inbox, env, bridgeState, db),
    }
    return acc
  }, {} as Record<string, Record<string, unknown>>)

  return {
    ok: true,
    source: 'agentmail_send_access',
    generated_at: nowIso(),
    global: {
      agentmail_connected: connect.status !== 'owner_sso_required' && connect.status !== 'api_key_required',
      organization_selected: connect.status === 'sync_ready' || connect.status === 'inbox_sync_complete' || connect.status === 'monitor_ready',
      bridge_session_state: bridgeState,
      bridge_session_id: bridgeRow?.id || null,
      expires_at: bridgeState === 'active' ? bridgeRow?.expires_at || null : null,
      sends_remaining_per_agent: bridgeRow ? Math.max(0, bridgeRow.max_sends_per_session_per_agent - bridgeRow.sends_dispatched) : 0,
      max_sends_per_session_per_agent: bridgeRow?.max_sends_per_session_per_agent || 10,
      max_recipients_per_send: bridgeRow?.max_recipients_per_send || 10,
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
    permission_keys: AGENTMAIL_SEND_PERMISSIONS,
    exact_blockers: Array.from(new Set(Object.values(agents).flatMap((agent) => agent.blockers as string[]))),
    ...SAFE_FLAGS,
  }
}


export function buildAgentMailCredentialProvisionPreview(db: Database.Database = getDatabase(), env: Record<string, string | undefined> = process.env) {
  ensureAgentMailSchema(db)
  const sendAccess = buildAgentMailSendAccessStatus(db, env)
  const inboxes = listAgentMailInboxes(db)
  const targets = inboxes.map((inbox) => {
    const agent = sendAccess.agents[inbox.agent_id] as any
    const sendCapable = inbox.agent_id === 'pi' || inbox.agent_id === 'agent_zero'
    return {
      agent_id: inbox.agent_id,
      display_name: inbox.display_name,
      role: inbox.role,
      inbox_id: inbox.inbox_address,
      inbox_required: sendCapable,
      scoped_credential_required: sendCapable,
      existing_credential_ref: agent?.scoped_credential?.credential_ref || null,
      credential_status: agent?.credential_status || 'missing',
      permissions_detected: agent?.permission_status || permissionMap(false, sendCapable),
      permissions_missing: AGENTMAIL_SEND_PERMISSIONS.filter((permission) => sendCapable && !agent?.permission_status?.[permission]),
      safe_next_action: sendCapable
        ? agent?.credential_status === 'scoped'
          ? 'run_credential_readiness_test'
          : 'create_owner_approved_scoped_inbox_key_in_existing_runtime_secret_storage'
        : 'no_send_identity_monitor_only',
      send_policy: sendCapable ? 'owner_approval_required' : 'no_external_send_by_default',
    }
  })
  recordAgentMailAudit(db, 'agentmail_scoped_credential_previewed', 'ok', 'preview_only_no_key_creation')
  return {
    ok: true,
    source: 'agentmail_scoped_credential_provision_preview',
    generated_at: nowIso(),
    provision_automatically: false,
    secret_store: 'existing_mission_control_runtime_secret_storage_required',
    exact_blocker: 'agentmail_runtime_secret_store_required',
    targets,
    ...SAFE_FLAGS,
  }
}

export function createAgentMailCredentialProvisionRequest(db: Database.Database = getDatabase(), requester = 'owner') {
  ensureAgentMailSchema(db)
  const { request: approval, created } = createApprovalRequest({
    connector: 'agentmail',
    action: 'agentmail_scoped_credential_provision_request',
    target: 'agentmail_scoped_credentials',
    target_key: 'agentmail:scoped-credentials',
    requester: sanitizeText(requester, 'owner', 120),
    risk_level: 'medium',
    protected_category: 'credential_write',
    reason: 'Owner approval is required before scoped AgentMail inbox send credentials can be created and stored.',
    approval_scope: {
      credential_scope: 'inbox',
      no_org_wide_default: true,
      send_policy: 'owner_approval_required',
      credential_values_exposed: false,
    },
    idempotency_key: 'agentmail:scoped-credentials:request',
  })
  recordAgentMailAudit(db, 'agentmail_scoped_credential_requested', 'blocked', `approval_id=${approval.id};runtime_secret_store_required`)
  return { ok: true, source: 'agentmail_scoped_credential_provision_request', approval_id: approval.id, approval_state: approval.approval_state, approval_request_created: created, exact_blocker: 'canonical_owner_approval_required', ...SAFE_FLAGS }
}

export function approveAgentMailCredentialProvision(db: Database.Database = getDatabase(), actor = 'owner') {
  ensureAgentMailSchema(db)
  recordAgentMailAudit(db, 'agentmail_scoped_credential_approved', 'ok', `actor=${sanitizeText(actor, 'owner', 120)}`)
  return { ok: true, source: 'agentmail_scoped_credential_provision_approve', approval_state: 'approved', exact_blocker: 'agentmail_runtime_secret_store_required', apply_enabled: false, ...SAFE_FLAGS }
}

export function applyAgentMailCredentialProvision(db: Database.Database = getDatabase()) {
  ensureAgentMailSchema(db)
  recordAgentMailAudit(db, 'agentmail_scoped_credential_missing', 'blocked', 'agentmail_runtime_secret_store_required')
  return { ok: false, source: 'agentmail_scoped_credential_provision_apply', exact_blocker: 'agentmail_runtime_secret_store_required', created: false, ...SAFE_FLAGS }
}

export function createAgentMailBridgeSessionRequest(
  db: Database.Database = getDatabase(),
  input: { requester?: string; ttl_minutes?: number } = {},
) {
  ensureAgentMailSchema(db)
  const requester = sanitizeText(input.requester || 'owner', 'owner', 120)
  const ttlMinutes = Number.isFinite(input.ttl_minutes) && Number(input.ttl_minutes) > 0 ? Math.min(Number(input.ttl_minutes), 240) : 60
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
      max_sends_per_session_per_agent: 10,
      max_recipients_per_send: 10,
      attachments_policy: 'blocked_until_scanning_exists',
      external_domain_policy: 'owner_approval_required',
      credential_values_exposed: false,
    },
    idempotency_key: 'agentmail:bridge-session:request',
  })
  const id = `ambs_${sha(`${approval.id}:${expiresAt}`).slice(0, 18)}`
  db.prepare(`
    INSERT INTO agentmail_bridge_sessions (id, state, approval_request_id, requester, expires_at, max_sends_per_session_per_agent, max_recipients_per_send)
    VALUES (?, 'pending_owner_approval', ?, ?, ?, 10, 10)
    ON CONFLICT(id) DO NOTHING
  `).run(id, approval.id, requester, expiresAt)
  recordAgentMailAudit(db, 'agentmail_bridge_session_requested', 'blocked', `approval_id=${approval.id};canonical_owner_channel_required`)
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
  db.prepare(`UPDATE agentmail_send_requests SET state = 'owner_approved', exact_blocker = 'bridge_session_required', updated_at = unixepoch() WHERE id = ?`).run(row.id)
  db.prepare(`UPDATE agentmail_approvals SET state = 'approved', exact_blocker = 'bridge_session_required' WHERE id = ?`).run(`ama_${row.id}`)
  recordAgentMailAudit(db, 'agentmail_send_approved', 'ok', `actor=${sanitizeText(input.actor || 'owner', 'owner', 120)}`, row.id)
  const updated = getSendRequest(db, row.id)!
  return {
    ok: true,
    source: 'agentmail_send_approve',
    send_request: sendRequestFromRow(updated),
    approval_state: 'approved',
    dispatch_enabled: false,
    exact_blocker: 'bridge_session_required',
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
  const inbox = findInboxForAgent(db, row.agent_id)
  const access = inbox ? sendAccessForInbox(inbox, env, bridgeState, db) : null
  const credentialResolution = inbox?.inbox_address ? resolveAgentMailScopedCredential({ db, env, agentId: row.agent_id, inboxId: inbox.inbox_address, requiredPermissions: ['message_send'] }) : null
  const recipientCount = parseJsonArray(row.to_json).length + parseJsonArray(row.cc_json).length + parseJsonArray(row.bcc_json).length
  let exactBlocker: string | null = null

  if (bridgeState !== 'active') exactBlocker = bridgeState === 'inactive' ? 'bridge_session_inactive' : `bridge_session_${bridgeState}`
  else if (row.state !== 'owner_approved') exactBlocker = 'owner_approval_required'
  else if (!inbox || !inbox.inbox_address) exactBlocker = 'agentmail_inbox_assignment_missing'
  else if (inbox.inbox_address.toLowerCase() !== row.inbox_id.toLowerCase()) exactBlocker = 'wrong_agent_inbox'
  else if (!access || access.credential_status !== 'scoped') exactBlocker = credentialResolution?.blockers.includes('scoped_credential_missing') ? 'scoped_credential_missing' : 'agentmail_inbox_credential_required'
  else if (credentialResolution?.blockers.includes('scoped_credential_wrong_inbox')) exactBlocker = 'scoped_credential_wrong_inbox'
  else if (credentialResolution?.blockers.includes('agentmail_runtime_secret_store_required')) exactBlocker = 'agentmail_runtime_secret_store_required'
  else if (!access.permission_status.message_send) exactBlocker = 'message_send_permission_missing'
  else if (recipientCount > (bridgeRow?.max_recipients_per_send || 10)) exactBlocker = 'recipient_limit_exceeded'

  if (exactBlocker) {
    db.prepare(`UPDATE agentmail_send_requests SET state = 'dispatch_blocked', exact_blocker = ?, bridge_session_id = ?, updated_at = unixepoch() WHERE id = ?`).run(exactBlocker, bridgeRow?.id || null, row.id)
    recordAgentMailAudit(db, 'agentmail_send_dispatch_blocked', 'blocked', exactBlocker, row.id)
    return {
      ok: false,
      source: 'agentmail_send_dispatch',
      send_request: sendRequestFromRow(getSendRequest(db, row.id)!),
      dispatch_enabled: false,
      execution_enabled: false,
      exact_blocker: exactBlocker,
      bridge_session_state: bridgeState,
      ...SAFE_FLAGS,
    }
  }

  const secret = credentialResolution ? loadAgentMailCredentialSecret(credentialResolution, env) : null
  if (!secret || !credentialResolution?.credentialRef) {
    exactBlocker = 'agentmail_runtime_secret_store_required'
    db.prepare(`UPDATE agentmail_send_requests SET state = 'dispatch_blocked', exact_blocker = ?, bridge_session_id = ?, updated_at = unixepoch() WHERE id = ?`).run(exactBlocker, bridgeRow?.id || null, row.id)
    recordAgentMailAudit(db, 'agentmail_send_dispatch_blocked', 'blocked', exactBlocker, row.id)
    return { ok: false, source: 'agentmail_send_dispatch', send_request: sendRequestFromRow(getSendRequest(db, row.id)!), dispatch_enabled: false, execution_enabled: false, exact_blocker: exactBlocker, bridge_session_state: bridgeState, ...SAFE_FLAGS }
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
    bridgeSessionId: bridgeRow?.id || null,
    gatewayDecisionId: `agentmail:${row.id}`,
  }).then((result) => {
    if (!result.ok) {
      db.prepare(`UPDATE agentmail_send_requests SET state = 'dispatch_blocked', exact_blocker = ?, bridge_session_id = ?, updated_at = unixepoch() WHERE id = ?`).run(result.exact_blocker, bridgeRow?.id || null, row.id)
      recordAgentMailAudit(db, 'agentmail_real_send_failed', 'error', result.exact_blocker, row.id)
      return { ok: false, source: 'agentmail_send_dispatch', send_request: sendRequestFromRow(getSendRequest(db, row.id)!), dispatch_enabled: false, execution_enabled: false, exact_blocker: result.exact_blocker, bridge_session_state: bridgeState, ...SAFE_FLAGS }
    }
    db.prepare(`UPDATE agentmail_send_requests SET state = 'dispatched', exact_blocker = NULL, bridge_session_id = ?, message_id = ?, thread_id = COALESCE(?, thread_id), updated_at = unixepoch() WHERE id = ?`).run(bridgeRow?.id || null, result.message_id, result.thread_id, row.id)
    if (bridgeRow) db.prepare(`UPDATE agentmail_bridge_sessions SET sends_dispatched = sends_dispatched + 1, updated_at = unixepoch() WHERE id = ?`).run(bridgeRow.id)
    recordAgentMailAudit(db, 'agentmail_real_send_dispatched', 'ok', `message_id=${result.message_id};thread_id=${result.thread_id || 'none'}`, row.id)
    return {
      ok: true,
      source: 'agentmail_send_dispatch',
      send_request: sendRequestFromRow(getSendRequest(db, row.id)!),
      message_id: result.message_id,
      thread_id: result.thread_id,
      bridge_session_id: bridgeRow?.id || null,
      dispatch_enabled: false,
      execution_enabled: false,
      auto_send_enabled: false,
      ...SAFE_FLAGS,
    }
  })
}

export { upsertAgentMailScopedCredentialMetadata }
