import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { recordJarvisAudit } from '@/lib/jarvis-audit'
import {
  JARVIS_ACTOR_ID,
  JARVIS_DEFAULT_SESSION_SCOPES,
  JARVIS_HARD_STOP_REASONS,
} from '@/lib/jarvis-owner-operator-policy'

export type JarvisSessionState = 'active' | 'expired' | 'revoked'

export type JarvisBridgeSession = {
  id: string
  actor: typeof JARVIS_ACTOR_ID
  state: JarvisSessionState
  allowed_scopes: string[]
  cost_cap_usd: number
  created_at: string
  expires_at: string
  revoked_at: string | null
  revoked_by: string | null
  audit_hash: string
  rollback_command: string
  credential_values_exposed: false
  external_writes_enabled: false
  public_exposure_allowed: false
  destructive_actions_allowed: false
}

const storePath = join(config.dataDir, 'jarvis-bridge-sessions.json')
const DEFAULT_TTL_MINUTES = 7 * 24 * 60
const DEFAULT_COST_CAP_USD = 25

function readSessions(): JarvisBridgeSession[] {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSessions(rows: JarvisBridgeSession[]) {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function isExpired(session: JarvisBridgeSession, now = new Date()) {
  return new Date(session.expires_at).getTime() <= now.getTime()
}

export function listJarvisBridgeSessions() {
  const now = new Date()
  return readSessions().map((session) => ({
    ...session,
    state: session.state === 'active' && isExpired(session, now) ? 'expired' as const : session.state,
  })).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function activeJarvisBridgeSession() {
  return listJarvisBridgeSessions().find((session) => session.state === 'active') || null
}

export function createOrRenewJarvisBridgeSession(input: {
  ttl_minutes?: number
  cost_cap_usd?: number
  scopes?: string[]
  actor?: string
} = {}) {
  const now = new Date()
  const ttl = Number.isFinite(input.ttl_minutes) && input.ttl_minutes && input.ttl_minutes > 0
    ? Math.min(input.ttl_minutes, DEFAULT_TTL_MINUTES)
    : DEFAULT_TTL_MINUTES
  const costCap = Number.isFinite(input.cost_cap_usd) && input.cost_cap_usd && input.cost_cap_usd > 0
    ? Math.min(input.cost_cap_usd, DEFAULT_COST_CAP_USD)
    : DEFAULT_COST_CAP_USD
  const scopes = input.scopes?.length ? input.scopes : [...JARVIS_DEFAULT_SESSION_SCOPES]
  const audit = recordJarvisAudit({
    actor: input.actor || JARVIS_ACTOR_ID,
    event: 'jarvis_bridge_session_created',
    target: 'agent-zero-jarvis',
    classification: 'DIRECT_INTERNAL_WRITE',
    detail: { scopes, cost_cap_usd: costCap, ttl_minutes: ttl },
  })
  const session: JarvisBridgeSession = {
    id: `jbs_${randomUUID()}`,
    actor: JARVIS_ACTOR_ID,
    state: 'active',
    allowed_scopes: scopes,
    cost_cap_usd: costCap,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttl * 60_000).toISOString(),
    revoked_at: null,
    revoked_by: null,
    audit_hash: audit.hash,
    rollback_command: 'POST /api/bridge/agent-zero/bridge-session/revoke with the session id; leave protected external adapters disabled',
    credential_values_exposed: false,
    external_writes_enabled: false,
    public_exposure_allowed: false,
    destructive_actions_allowed: false,
  }
  const rows = readSessions().map((row) => row.state === 'active' ? { ...row, state: 'revoked' as const, revoked_at: now.toISOString(), revoked_by: JARVIS_ACTOR_ID } : row)
  writeSessions([session, ...rows])
  return session
}

export function revokeJarvisBridgeSession(id: string, actor = JARVIS_ACTOR_ID) {
  const rows = readSessions()
  const target = rows.find((session) => session.id === id && session.state === 'active')
  if (!target) return null
  const now = new Date().toISOString()
  const revoked = { ...target, state: 'revoked' as const, revoked_at: now, revoked_by: actor }
  writeSessions(rows.map((session) => session.id === id ? revoked : session))
  recordJarvisAudit({
    actor,
    event: 'jarvis_bridge_session_revoked',
    target: id,
    classification: 'DIRECT_INTERNAL_WRITE',
    detail: { id },
  })
  return revoked
}

export function jarvisBridgeSessionStatus() {
  const active = activeJarvisBridgeSession()
  return {
    state: active ? 'active' : 'inactive',
    active_session_id: active?.id || null,
    actor: JARVIS_ACTOR_ID,
    allowed_scopes: active?.allowed_scopes || [],
    expires_at: active?.expires_at || null,
    cost_cap_usd: active?.cost_cap_usd || DEFAULT_COST_CAP_USD,
    internal_writes_enabled: Boolean(active),
    provider_execution_enabled: false,
    mcp_execution_enabled: Boolean(active?.allowed_scopes.includes('mcp_memory_write_probe')),
    exact_scope_mcp_status_probe_enabled: Boolean(active),
    exact_scope_mcp_memory_write_probe_enabled: Boolean(active?.allowed_scopes.includes('mcp_memory_write_probe')),
    external_writes_enabled: false,
    credential_values_exposed: false,
    hard_stop_reasons: JARVIS_HARD_STOP_REASONS,
    exact_blocker: active ? 'external_actions_require_exact_adapter_scope_and_credentials' : 'bridge_session_required',
    next_action: active
      ? 'Use this session for internal Mission Control writes and certified exact-scope adapters only. MCP memory write proof is limited to one create-and-delete probe; Paperclip ECO issue-comment writes additionally require Paperclip API key credential.'
      : 'Create a Jarvis owner-operator Bridge Session before internal Mission Control writes.',
  }
}
