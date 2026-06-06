import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type Database from 'better-sqlite3'

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

export function buildAgentMailConnectStatus(db: Database.Database = getDatabase(), env: Record<string, string | undefined> = process.env) {
  ensureAgentMailSchema(db)
  const monitorStatus = buildAgentMailStatus(db, env)
  const apiKey = env.AGENTMAIL_API_KEY || env.AGENTMAIL_TOKEN || ''
  const credentialRef = env.AGENTMAIL_CREDENTIAL_REF
  const hasApiCredential = Boolean(apiKey || credentialRef)
  const hasWsUrl = Boolean(env.AGENTMAIL_WS_URL)
  const assignedInboxCount = (db.prepare(`SELECT COUNT(*) AS count FROM agentmail_inboxes WHERE inbox_address IS NOT NULL`).get() as { count: number }).count
  const lastAudit = db.prepare(`SELECT action, result, detail, created_at FROM agentmail_audit ORDER BY created_at DESC LIMIT 1`).get() as Record<string, unknown> | undefined

  const status: AgentMailConnectStatus = hasApiCredential && hasWsUrl
    ? assignedInboxCount > 0
      ? monitorStatus.state === 'running' ? 'monitor_ready' : 'inbox_sync_complete'
      : 'sync_ready'
    : hasApiCredential
      ? 'connected'
      : 'owner_sso_required'

  return {
    ok: true,
    source: 'agentmail_connect_status',
    generated_at: nowIso(),
    status,
    current_blocker: status === 'owner_sso_required'
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
      state: status === 'owner_sso_required' ? 'owner_sso_required' : 'connected_or_api_key_configured',
      url: AGENTMAIL_CONSOLE_URL,
      message: status === 'owner_sso_required'
        ? 'Waiting for owner Google/SSO sign-in through AgentMail.'
        : 'AgentMail credential metadata detected; sync inbox registry before enabling monitor.',
    },
    google_sso_status: status === 'owner_sso_required' ? 'owner_sso_required' : 'connected_or_api_key_fallback',
    mcp_oauth_status: {
      state: 'oauth_pending',
      url: AGENTMAIL_MCP_URL,
      cli_status: 'not_verified_by_server',
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

export function buildAgentMailInboxSyncPreview(db: Database.Database = getDatabase(), env: Record<string, string | undefined> = process.env) {
  ensureAgentMailSchema(db)
  const inboxes = listAgentMailInboxes(db)
  const status = buildAgentMailConnectStatus(db, env)
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
    inboxes: listAgentMailInboxes(db),
    events: queryRows(db, `SELECT event_id, event_type, agent_id, sender_preview, subject, received_at, policy_state FROM agentmail_events ORDER BY created_at DESC LIMIT 12`),
    bridge_queue: queryRows(db, `SELECT id, event_id, task_candidate_state, policy_state, owner_approval_required FROM agentmail_bridge_queue ORDER BY created_at DESC LIMIT 12`),
    approvals: queryRows(db, `SELECT id, event_id, action_type, state, exact_blocker FROM agentmail_approvals ORDER BY created_at DESC LIMIT 12`),
    audit: queryRows(db, `SELECT id, event_id, action, result, detail FROM agentmail_audit ORDER BY created_at DESC LIMIT 12`),
  }
}
