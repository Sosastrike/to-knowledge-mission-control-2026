import type Database from 'better-sqlite3'

import { getDatabase } from '@/lib/db'

export const AGENTMAIL_CREDENTIAL_SAFE_FLAGS = {
  credential_values_exposed: false,
  tokens_exposed: false,
  env_values_exposed: false,
  raw_secret_values_exposed: false,
} as const

export const AGENTMAIL_PERMISSION_KEYS = [
  'inbox_read',
  'thread_read',
  'message_read',
  'message_send',
  'message_update',
  'draft_read',
  'draft_create',
  'draft_update',
  'draft_send',
] as const

export type AgentMailPermission = typeof AGENTMAIL_PERMISSION_KEYS[number]
export type AgentMailPermissionMap = Partial<Record<AgentMailPermission, boolean>>

type CredentialRow = {
  id: number
  agent_id: string
  inbox_id: string
  credential_ref: string
  scope: string
  masked_preview: string | null
  permissions_json: string
  status: string
  exact_blocker: string | null
  active: number
}

export type AgentMailScopedCredentialResolution = {
  credentialRef: string | null
  keyAvailable: boolean
  keyMasked: string | null
  scope: 'inbox' | 'missing'
  inboxId: string | null
  permissions: Record<AgentMailPermission, boolean>
  blockers: string[]
  credential_status: 'missing' | 'detected' | 'scoped' | 'invalid' | 'expired'
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
  raw_secret_values_exposed: false
}

function normalizeRef(ref: string) {
  return String(ref || '').trim().replace(/^env:/, '')
}

function maskAgentMailKey(value: string) {
  const clean = String(value || '').trim()
  if (!clean) return null
  return `am_****${clean.slice(-4)}`
}

function emptyPermissions(): Record<AgentMailPermission, boolean> {
  return AGENTMAIL_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = false
    return acc
  }, {} as Record<AgentMailPermission, boolean>)
}

function normalizePermissions(input: AgentMailPermissionMap = {}): Record<AgentMailPermission, boolean> {
  return AGENTMAIL_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(input[key])
    return acc
  }, {} as Record<AgentMailPermission, boolean>)
}

function parsePermissions(value: string | null) {
  try {
    const parsed = JSON.parse(value || '{}')
    return normalizePermissions(parsed && typeof parsed === 'object' ? parsed as AgentMailPermissionMap : {})
  } catch {
    return emptyPermissions()
  }
}

export function ensureAgentMailCredentialSchema(db: Database.Database = getDatabase()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agentmail_scoped_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      inbox_id TEXT NOT NULL,
      credential_ref TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'inbox',
      masked_preview TEXT,
      permissions_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'scoped',
      exact_blocker TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(agent_id, inbox_id, active)
    );
    CREATE INDEX IF NOT EXISTS idx_agentmail_scoped_credentials_agent ON agentmail_scoped_credentials(agent_id, inbox_id, active);
  `)
}

export function upsertAgentMailScopedCredentialMetadata(
  db: Database.Database = getDatabase(),
  input: {
    agentId: string
    inboxId: string
    credentialRef: string
    maskedPreview?: string | null
    permissions?: AgentMailPermissionMap
    status?: 'scoped' | 'detected' | 'invalid' | 'expired'
    exactBlocker?: string | null
  },
) {
  ensureAgentMailCredentialSchema(db)
  const agentId = String(input.agentId || '').trim()
  const inboxId = String(input.inboxId || '').trim().toLowerCase()
  const credentialRef = normalizeRef(input.credentialRef)
  if (!agentId || !inboxId || !credentialRef) throw new Error('agentmail_scoped_credential_metadata_required')
  const permissions = normalizePermissions(input.permissions || {})
  db.transaction(() => {
    db.prepare(`UPDATE agentmail_scoped_credentials SET active = 0, updated_at = unixepoch() WHERE agent_id = ? AND inbox_id = ? AND active = 1`).run(agentId, inboxId)
    db.prepare(`
      INSERT INTO agentmail_scoped_credentials (
        agent_id, inbox_id, credential_ref, scope, masked_preview, permissions_json, status, exact_blocker
      ) VALUES (?, ?, ?, 'inbox', ?, ?, ?, ?)
    `).run(agentId, inboxId, credentialRef, input.maskedPreview || null, JSON.stringify(permissions), input.status || 'scoped', input.exactBlocker || null)
  })()
  return {
    ok: true,
    agent_id: agentId,
    inbox_id: inboxId,
    credential_ref: credentialRef,
    key_masked: input.maskedPreview || null,
    scope: 'inbox',
    permissions,
    ...AGENTMAIL_CREDENTIAL_SAFE_FLAGS,
  }
}

function findCredentialRow(db: Database.Database, agentId: string, inboxId: string): CredentialRow | undefined {
  ensureAgentMailCredentialSchema(db)
  return db.prepare(`
    SELECT * FROM agentmail_scoped_credentials
    WHERE agent_id = ? AND active = 1
    ORDER BY CASE WHEN lower(inbox_id) = lower(?) THEN 0 ELSE 1 END, id DESC
    LIMIT 1
  `).get(agentId, inboxId) as CredentialRow | undefined
}

export function resolveAgentMailScopedCredential(input: {
  db?: Database.Database
  env?: Record<string, string | undefined>
  agentId: string
  inboxId: string
  requiredPermissions?: AgentMailPermission[]
}): AgentMailScopedCredentialResolution {
  const db = input.db || getDatabase()
  const env = input.env || process.env
  const agentId = String(input.agentId || '').trim()
  const inboxId = String(input.inboxId || '').trim().toLowerCase()
  const row = findCredentialRow(db, agentId, inboxId)
  const blockers: string[] = []
  const required = input.requiredPermissions || []
  if (!row) {
    blockers.push('scoped_credential_missing')
    return {
      credentialRef: null,
      keyAvailable: false,
      keyMasked: null,
      scope: 'missing',
      inboxId: null,
      permissions: emptyPermissions(),
      blockers,
      credential_status: 'missing',
      ...AGENTMAIL_CREDENTIAL_SAFE_FLAGS,
    }
  }
  const permissions = parsePermissions(row.permissions_json)
  if (row.status === 'invalid') blockers.push('scoped_credential_invalid')
  if (row.status === 'expired') blockers.push('scoped_credential_expired')
  if (row.scope !== 'inbox' || row.inbox_id.toLowerCase() !== inboxId) blockers.push('scoped_credential_wrong_inbox')
  for (const permission of required) {
    if (!permissions[permission]) blockers.push(`${permission}_permission_missing`)
  }
  const ref = normalizeRef(row.credential_ref)
  const keyValue = String(env[ref] || '').trim()
  if (!keyValue) blockers.push('agentmail_runtime_secret_store_required')
  return {
    credentialRef: ref,
    keyAvailable: Boolean(keyValue),
    keyMasked: row.masked_preview || maskAgentMailKey(keyValue),
    scope: 'inbox',
    inboxId: row.inbox_id,
    permissions,
    blockers: Array.from(new Set(blockers)),
    credential_status: row.status === 'invalid' ? 'invalid' : row.status === 'expired' ? 'expired' : row.scope === 'inbox' && row.inbox_id.toLowerCase() === inboxId ? 'scoped' : 'detected',
    ...AGENTMAIL_CREDENTIAL_SAFE_FLAGS,
  }
}

export function loadAgentMailCredentialSecret(resolution: AgentMailScopedCredentialResolution, env: Record<string, string | undefined> = process.env): string | null {
  const ref = resolution.credentialRef ? normalizeRef(resolution.credentialRef) : ''
  if (!ref) return null
  return String(env[ref] || '').trim() || null
}
