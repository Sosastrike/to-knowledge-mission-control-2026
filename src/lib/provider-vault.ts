import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import type Database from 'better-sqlite3'
import { getDatabase } from '@/lib/db'

export type ProviderVaultBuiltinId =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'nvidia'
  | 'xai_grok'
  | 'ollama'

export type ProviderVaultDefinition = {
  provider_id: ProviderVaultBuiltinId
  display_name: string
  provider_type: 'hosted' | 'local'
  env_var_names: string[]
  base_url: string
  validation_path: string
  default_enabled: boolean
}

export type EncryptedProviderSecret = {
  algorithm: 'aes-256-gcm'
  ciphertext: string
  iv: string
  auth_tag: string
  key_version: string
}

export type LoadedSecretMasterKey =
  | { ok: true; key: Buffer; key_version: string; source: 'env' | 'file' }
  | { ok: false; blocker: 'provider_vault_master_key_missing' | 'provider_vault_master_key_invalid' | 'provider_vault_key_file_unreadable' }

export type ProviderCredentialResult =
  | {
      found: true
      source: 'vault' | 'env'
      value: string
      env_var_name: string
      masked_preview: string
      provider_id: string
      credential_values_exposed: false
    }
  | {
      found: false
      source: 'none'
      value: null
      env_var_name?: undefined
      masked_preview?: undefined
      provider_id: string
      credential_values_exposed: false
      exact_blocker: string
    }

export type ProviderPublicState = {
  provider_id: string
  display_name: string
  provider_type: 'hosted' | 'local' | 'custom_openai_compatible'
  env_var_names: string[]
  credential_configured: boolean
  credential_source: 'vault' | 'env' | 'none' | 'not_required'
  masked_preview: string | null
  validation_status: string
  last_validation_at: string | null
  model_count: number
  base_url: string
  enabled: boolean
  exact_blocker: string | null
  credential_values_exposed: false
  execution_enabled: false
  bridge_required: true
}

export type ProviderValidationResult = {
  ok: boolean
  provider_id: string
  probe_status: 'ok' | 'credential_required' | 'http_error' | 'unreachable' | 'unsupported'
  http_status: number | null
  exact_blocker: string | null
  model_count: number
  models: string[]
  credential_values_exposed: false
}

type SecretRow = {
  id: number
  provider_id: string
  env_var_name: string
  ciphertext: string
  iv: string
  auth_tag: string
  algorithm: 'aes-256-gcm'
  key_version: string
  masked_preview: string
  active: number
  deleted_at: number | null
}

type ProviderConfigRow = {
  provider_id: string
  display_name: string | null
  provider_type: string | null
  base_url: string | null
  validation_path: string | null
  enabled: number | null
  validation_status: string | null
  last_validation_at: number | null
}

export const PROVIDER_VAULT_BUILT_INS: ProviderVaultDefinition[] = [
  {
    provider_id: 'openrouter',
    display_name: 'OpenRouter',
    provider_type: 'hosted',
    env_var_names: ['OPENROUTER_API_KEY'],
    base_url: 'https://openrouter.ai',
    validation_path: '/api/v1/models',
    default_enabled: true,
  },
  {
    provider_id: 'openai',
    display_name: 'OpenAI / Codex API',
    provider_type: 'hosted',
    env_var_names: ['OPENAI_API_KEY'],
    base_url: 'https://api.openai.com',
    validation_path: '/v1/models',
    default_enabled: true,
  },
  {
    provider_id: 'anthropic',
    display_name: 'Anthropic / Claude',
    provider_type: 'hosted',
    env_var_names: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    base_url: 'https://api.anthropic.com',
    validation_path: '/v1/models',
    default_enabled: true,
  },
  {
    provider_id: 'gemini',
    display_name: 'Gemini',
    provider_type: 'hosted',
    env_var_names: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    base_url: 'https://generativelanguage.googleapis.com',
    validation_path: '/v1beta/models',
    default_enabled: true,
  },
  {
    provider_id: 'groq',
    display_name: 'Groq',
    provider_type: 'hosted',
    env_var_names: ['GROQ_API_KEY'],
    base_url: 'https://api.groq.com',
    validation_path: '/openai/v1/models',
    default_enabled: true,
  },
  {
    provider_id: 'nvidia',
    display_name: 'NVIDIA NIM',
    provider_type: 'hosted',
    env_var_names: ['NVIDIA_API_KEY', 'NGC_API_KEY', 'NVIDIA_NIM_API_KEY'],
    base_url: 'https://integrate.api.nvidia.com',
    validation_path: '/v1/models',
    default_enabled: true,
  },
  {
    provider_id: 'xai_grok',
    display_name: 'xAI Grok',
    provider_type: 'hosted',
    env_var_names: ['XAI_API_KEY'],
    base_url: 'https://api.x.ai',
    validation_path: '/v1/models',
    default_enabled: true,
  },
  {
    provider_id: 'ollama',
    display_name: 'Ollama Local',
    provider_type: 'local',
    env_var_names: ['OLLAMA_HOST', 'OLLAMA_BASE_URL'],
    base_url: 'http://127.0.0.1:11434',
    validation_path: '/api/tags',
    default_enabled: true,
  },
]

export function normalizeProviderVaultId(providerId: string): string {
  const id = String(providerId || '').trim().toLowerCase()
  if (id === 'google') return 'gemini'
  if (id === 'claude' || id === 'claude_anthropic') return 'anthropic'
  if (id === 'xai' || id === 'grok') return 'xai_grok'
  return id
}

export function providerVaultDefinition(providerId: string): ProviderVaultDefinition | undefined {
  const id = normalizeProviderVaultId(providerId)
  return PROVIDER_VAULT_BUILT_INS.find((provider) => provider.provider_id === id)
}

export function ensureProviderVaultSchema(db: Database.Database = getDatabase()): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_configs (
      provider_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      provider_type TEXT NOT NULL DEFAULT 'hosted',
      base_url TEXT NOT NULL,
      validation_path TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      custom INTEGER NOT NULL DEFAULT 0,
      validation_status TEXT NOT NULL DEFAULT 'not_validated',
      last_validation_at INTEGER,
      last_validation_http_status INTEGER,
      last_validation_blocker TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS provider_secrets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      env_var_name TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
      key_version TEXT NOT NULL,
      masked_preview TEXT NOT NULL,
      fingerprint_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      rotated_at INTEGER,
      deleted_at INTEGER,
      FOREIGN KEY (provider_id) REFERENCES provider_configs(provider_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS provider_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      model_json TEXT,
      synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(provider_id, model_id)
    );

    CREATE TABLE IF NOT EXISTS provider_secret_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'system',
      result TEXT NOT NULL DEFAULT 'ok',
      detail TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_provider_secrets_provider_active ON provider_secrets(provider_id, active);
    CREATE INDEX IF NOT EXISTS idx_provider_models_provider ON provider_models(provider_id);
    CREATE INDEX IF NOT EXISTS idx_provider_secret_audit_provider ON provider_secret_audit(provider_id, created_at);
  `)

  const upsert = db.prepare(`
    INSERT INTO provider_configs (provider_id, display_name, provider_type, base_url, validation_path, enabled, custom)
    VALUES (?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(provider_id) DO UPDATE SET
      display_name = excluded.display_name,
      provider_type = excluded.provider_type,
      base_url = excluded.base_url,
      validation_path = excluded.validation_path,
      enabled = COALESCE(provider_configs.enabled, excluded.enabled),
      updated_at = unixepoch()
  `)
  for (const provider of PROVIDER_VAULT_BUILT_INS) {
    upsert.run(
      provider.provider_id,
      provider.display_name,
      provider.provider_type,
      provider.base_url,
      provider.validation_path,
      provider.default_enabled ? 1 : 0,
    )
  }
}

export function maskSecret(secret: string): string {
  const value = String(secret || '')
  if (!value) return ''
  if (value.length <= 8) return `${value.slice(0, 1)}...${value.slice(-1)}`
  return `${value.slice(0, 3)}...${value.slice(-4)}`
}

function parseMasterKey(raw: string): Buffer | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex')

  try {
    const decoded = Buffer.from(trimmed, 'base64')
    if (decoded.length === 32) return decoded
  } catch {}

  const utf8 = Buffer.from(trimmed, 'utf8')
  if (utf8.length >= 32) return createHash('sha256').update(utf8).digest()
  return null
}

export function loadSecretMasterKey(env: Record<string, string | undefined> = process.env): LoadedSecretMasterKey {
  const inline = String(env.MISSION_CONTROL_SECRETS_MASTER_KEY || '').trim()
  if (inline) {
    const key = parseMasterKey(inline)
    if (!key) return { ok: false, blocker: 'provider_vault_master_key_invalid' }
    return { ok: true, key, key_version: 'env:MISSION_CONTROL_SECRETS_MASTER_KEY', source: 'env' }
  }

  const keyFile = String(env.MISSION_CONTROL_SECRETS_KEY_FILE || '').trim()
  if (keyFile) {
    try {
      const key = parseMasterKey(readFileSync(keyFile, 'utf8'))
      if (!key) return { ok: false, blocker: 'provider_vault_master_key_invalid' }
      return { ok: true, key, key_version: 'file:MISSION_CONTROL_SECRETS_KEY_FILE', source: 'file' }
    } catch {
      return { ok: false, blocker: 'provider_vault_key_file_unreadable' }
    }
  }

  return { ok: false, blocker: 'provider_vault_master_key_missing' }
}

export function encryptProviderSecret(rawSecret: string, masterKey: Buffer, keyVersion: string): EncryptedProviderSecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv)
  const ciphertext = Buffer.concat([cipher.update(rawSecret, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    algorithm: 'aes-256-gcm',
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: authTag.toString('base64'),
    key_version: keyVersion,
  }
}

export function decryptProviderSecret(encrypted: EncryptedProviderSecret, masterKey: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', masterKey, Buffer.from(encrypted.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(encrypted.auth_tag, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}

function writeAudit(db: Database.Database, providerId: string, action: string, actor: string, result = 'ok', detail?: string): void {
  db.prepare(`
    INSERT INTO provider_secret_audit (provider_id, action, actor, result, detail)
    VALUES (?, ?, ?, ?, ?)
  `).run(providerId, action, actor || 'system', result, detail || null)
}

export function upsertProviderSecret(input: {
  db?: Database.Database
  providerId: string
  envVarName: string
  rawSecret: string
  masterKey: Buffer
  keyVersion: string
  actor: string
  reason?: string
}): ProviderPublicState {
  const db = input.db || getDatabase()
  ensureProviderVaultSchema(db)
  const providerId = normalizeProviderVaultId(input.providerId)
  const definition = providerVaultDefinition(providerId)
  if (!definition) {
    throw new Error('custom_provider_not_supported_until_validated')
  }
  const envVarName = String(input.envVarName || definition.env_var_names[0]).trim()
  if (!definition.env_var_names.includes(envVarName)) {
    throw new Error(`${providerId}_env_var_not_allowed`)
  }
  const rawSecret = String(input.rawSecret || '').trim()
  if (!rawSecret) throw new Error(`${providerId}_secret_required`)

  const encrypted = encryptProviderSecret(rawSecret, input.masterKey, input.keyVersion)
  const masked = maskSecret(rawSecret)
  const fingerprint = createHash('sha256').update(rawSecret).digest('hex')

  db.transaction(() => {
    db.prepare(`
      UPDATE provider_secrets
      SET active = 0, rotated_at = unixepoch()
      WHERE provider_id = ? AND active = 1 AND deleted_at IS NULL
    `).run(providerId)
    db.prepare(`
      INSERT INTO provider_secrets (
        provider_id, env_var_name, ciphertext, iv, auth_tag, algorithm,
        key_version, masked_preview, fingerprint_hash, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      providerId,
      envVarName,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.auth_tag,
      encrypted.algorithm,
      encrypted.key_version,
      masked,
      fingerprint,
      input.actor || 'system',
    )
    writeAudit(db, providerId, 'secret_upsert', input.actor, 'ok', input.reason || null || undefined)
  })()

  return publicStateForProvider(db, providerId, {}, { source: 'vault', masked_preview: masked })
}

export function deleteProviderSecret(input: {
  db?: Database.Database
  providerId: string
  actor: string
  reason?: string
}): ProviderPublicState {
  const db = input.db || getDatabase()
  ensureProviderVaultSchema(db)
  const providerId = normalizeProviderVaultId(input.providerId)
  db.transaction(() => {
    db.prepare(`
      UPDATE provider_secrets
      SET active = 0, deleted_at = unixepoch()
      WHERE provider_id = ? AND active = 1 AND deleted_at IS NULL
    `).run(providerId)
    writeAudit(db, providerId, 'secret_delete', input.actor, 'ok', input.reason || null || undefined)
  })()
  return publicStateForProvider(db, providerId, {})
}

function latestSecretRow(db: Database.Database, providerId: string): SecretRow | undefined {
  return db.prepare(`
    SELECT *
    FROM provider_secrets
    WHERE provider_id = ? AND active = 1 AND deleted_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `).get(providerId) as SecretRow | undefined
}

export function getProviderCredential(
  providerIdInput: string,
  env: Record<string, string | undefined> = process.env,
  db: Database.Database = getDatabase(),
  masterKey?: Buffer | null,
): ProviderCredentialResult {
  const providerId = normalizeProviderVaultId(providerIdInput)
  ensureProviderVaultSchema(db)
  const definition = providerVaultDefinition(providerId)
  const names = definition?.env_var_names || []
  const loadedKey = masterKey ? { ok: true as const, key: masterKey } : loadSecretMasterKey(env)

  if (loadedKey.ok) {
    const row = latestSecretRow(db, providerId)
    if (row) {
      try {
        const value = decryptProviderSecret({
          algorithm: row.algorithm,
          ciphertext: row.ciphertext,
          iv: row.iv,
          auth_tag: row.auth_tag,
          key_version: row.key_version,
        }, loadedKey.key)
        return {
          found: true,
          source: 'vault',
          value,
          env_var_name: row.env_var_name,
          masked_preview: row.masked_preview,
          provider_id: providerId,
          credential_values_exposed: false,
        }
      } catch {
        writeAudit(db, providerId, 'secret_decrypt', 'system', 'failed', 'provider_secret_decrypt_failed')
      }
    }
  }

  for (const name of names) {
    const value = String(env[name] || '').trim()
    if (value) {
      return {
        found: true,
        source: 'env',
        value,
        env_var_name: name,
        masked_preview: maskSecret(value),
        provider_id: providerId,
        credential_values_exposed: false,
      }
    }
  }

  return {
    found: false,
    source: 'none',
    value: null,
    provider_id: providerId,
    credential_values_exposed: false,
    exact_blocker: `${providerId}_credential_required`,
  }
}

function configRows(db: Database.Database): ProviderConfigRow[] {
  ensureProviderVaultSchema(db)
  return db.prepare(`SELECT * FROM provider_configs ORDER BY custom ASC, provider_id ASC`).all() as ProviderConfigRow[]
}

function modelCount(db: Database.Database, providerId: string): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM provider_models WHERE provider_id = ?`).get(providerId) as { count: number } | undefined
  return Number(row?.count || 0)
}

function publicStateForProvider(
  db: Database.Database,
  providerId: string,
  env: Record<string, string | undefined> = process.env,
  override?: { source?: 'vault' | 'env' | 'none'; masked_preview?: string | null },
): ProviderPublicState {
  ensureProviderVaultSchema(db)
  const definition = providerVaultDefinition(providerId)
  const config = db.prepare(`SELECT * FROM provider_configs WHERE provider_id = ?`).get(providerId) as ProviderConfigRow | undefined
  const secretRow = latestSecretRow(db, providerId)
  const envName = (definition?.env_var_names || []).find((name) => String(env[name] || '').trim())
  const source = override?.source || (secretRow ? 'vault' : envName ? 'env' : definition?.provider_type === 'local' ? 'not_required' : 'none')
  const credentialConfigured = source === 'vault' || source === 'env' || source === 'not_required'
  const exactBlocker = credentialConfigured
    ? null
    : `${normalizeProviderVaultId(providerId)}_credential_required`

  return {
    provider_id: providerId,
    display_name: config?.display_name || definition?.display_name || providerId,
    provider_type: (config?.provider_type as ProviderPublicState['provider_type']) || definition?.provider_type || 'custom_openai_compatible',
    env_var_names: definition?.env_var_names || [],
    credential_configured: credentialConfigured,
    credential_source: source,
    masked_preview: override?.masked_preview ?? secretRow?.masked_preview ?? (envName ? maskSecret(String(env[envName] || '')) : null),
    validation_status: config?.validation_status || 'not_validated',
    last_validation_at: config?.last_validation_at ? new Date(Number(config.last_validation_at) * 1000).toISOString() : null,
    model_count: modelCount(db, providerId),
    base_url: config?.base_url || definition?.base_url || '',
    enabled: config?.enabled !== 0,
    exact_blocker: exactBlocker,
    credential_values_exposed: false,
    execution_enabled: false,
    bridge_required: true,
  }
}

export function listProviderPublicStates(
  db: Database.Database = getDatabase(),
  env: Record<string, string | undefined> = process.env,
): ProviderPublicState[] {
  ensureProviderVaultSchema(db)
  const rows = configRows(db)
  return rows.map((row) => publicStateForProvider(db, row.provider_id, env))
}

export function updateProviderConfig(input: {
  db?: Database.Database
  providerId: string
  actor: string
  displayName?: string
  enabled?: boolean
  baseUrl?: string
}): ProviderPublicState {
  const db = input.db || getDatabase()
  ensureProviderVaultSchema(db)
  const providerId = normalizeProviderVaultId(input.providerId)
  const definition = providerVaultDefinition(providerId)
  if (!definition) throw new Error('custom_provider_not_supported_until_validated')

  const current = db.prepare(`SELECT * FROM provider_configs WHERE provider_id = ?`).get(providerId) as ProviderConfigRow | undefined
  if (!current) throw new Error(`${providerId}_not_registered`)

  const displayName = input.displayName ? String(input.displayName).trim() : current.display_name || definition.display_name
  const enabled = typeof input.enabled === 'boolean' ? (input.enabled ? 1 : 0) : current.enabled ?? 1
  const baseUrl = input.baseUrl ? String(input.baseUrl).replace(/\/+$/, '') : current.base_url || definition.base_url

  db.prepare(`
    UPDATE provider_configs
    SET display_name = ?, enabled = ?, base_url = ?, updated_at = unixepoch()
    WHERE provider_id = ?
  `).run(displayName, enabled, baseUrl, providerId)
  writeAudit(db, providerId, 'config_update', input.actor, 'ok')

  return publicStateForProvider(db, providerId)
}

export function buildProviderValidationRequest(
  providerIdInput: string,
  credential: string,
  customBaseUrl?: string,
): { url: string; method: 'GET'; headers: HeadersInit } | null {
  const providerId = normalizeProviderVaultId(providerIdInput)
  if (providerId === 'custom-openai' || providerId.startsWith('custom')) {
    if (!customBaseUrl) return null
    const parsed = new URL('/v1/models', customBaseUrl)
    return {
      url: parsed.toString(),
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` },
    }
  }
  if (providerId === 'openrouter') {
    return { url: 'https://openrouter.ai/api/v1/models', method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` } }
  }
  if (providerId === 'openai') {
    return { url: 'https://api.openai.com/v1/models', method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` } }
  }
  if (providerId === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/models',
      method: 'GET',
      headers: { Accept: 'application/json', 'x-api-key': credential, 'anthropic-version': '2023-06-01' },
    }
  }
  if (providerId === 'gemini') {
    return { url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(credential)}`, method: 'GET', headers: { Accept: 'application/json' } }
  }
  if (providerId === 'groq') {
    return { url: 'https://api.groq.com/openai/v1/models', method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` } }
  }
  if (providerId === 'nvidia') {
    return { url: 'https://integrate.api.nvidia.com/v1/models', method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` } }
  }
  if (providerId === 'xai_grok') {
    return { url: 'https://api.x.ai/v1/models', method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` } }
  }
  return null
}

function extractModelIds(payload: unknown): string[] {
  const value = payload as { data?: Array<{ id?: string }>; models?: Array<{ id?: string; name?: string }> }
  if (Array.isArray(value?.data)) {
    return value.data.map((model) => String(model.id || '').trim()).filter(Boolean)
  }
  if (Array.isArray(value?.models)) {
    return value.models.map((model) => String(model.id || model.name || '').trim()).filter(Boolean)
  }
  return []
}

export async function validateProviderCredential(input: {
  providerId: string
  credential?: string | null
  baseUrl?: string | null
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<ProviderValidationResult> {
  const providerId = normalizeProviderVaultId(input.providerId)
  const fetchImpl = input.fetchImpl || fetch
  const timeoutMs = input.timeoutMs ?? 4000

  if (providerId === 'ollama') {
    const baseUrl = String(input.baseUrl || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, '')
    return validateModelListRequest(providerId, `${baseUrl}/api/tags`, { Accept: 'application/json' }, fetchImpl, timeoutMs)
  }

  const credential = String(input.credential || '').trim()
  if (!credential) {
    return {
      ok: false,
      provider_id: providerId,
      probe_status: 'credential_required',
      http_status: null,
      exact_blocker: `${providerId}_credential_required`,
      model_count: 0,
      models: [],
      credential_values_exposed: false,
    }
  }
  const request = buildProviderValidationRequest(providerId, credential, input.baseUrl || undefined)
  if (!request) {
    return {
      ok: false,
      provider_id: providerId,
      probe_status: 'unsupported',
      http_status: null,
      exact_blocker: `${providerId}_validation_not_supported`,
      model_count: 0,
      models: [],
      credential_values_exposed: false,
    }
  }
  return validateModelListRequest(providerId, request.url, request.headers || {}, fetchImpl, timeoutMs)
}

async function validateModelListRequest(
  providerId: string,
  url: string,
  headers: HeadersInit,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<ProviderValidationResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      return {
        ok: false,
        provider_id: providerId,
        probe_status: 'http_error',
        http_status: response.status,
        exact_blocker: `${providerId}_probe_http_${response.status}`,
        model_count: 0,
        models: [],
        credential_values_exposed: false,
      }
    }
    const payload = await response.json().catch(() => ({}))
    const models = extractModelIds(payload)
    return {
      ok: true,
      provider_id: providerId,
      probe_status: 'ok',
      http_status: response.status,
      exact_blocker: null,
      model_count: models.length,
      models,
      credential_values_exposed: false,
    }
  } catch {
    return {
      ok: false,
      provider_id: providerId,
      probe_status: 'unreachable',
      http_status: null,
      exact_blocker: `${providerId}_probe_unreachable`,
      model_count: 0,
      models: [],
      credential_values_exposed: false,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function recordProviderValidation(input: {
  db?: Database.Database
  providerId: string
  actor: string
  result: ProviderValidationResult
}): void {
  const db = input.db || getDatabase()
  const providerId = normalizeProviderVaultId(input.providerId)
  ensureProviderVaultSchema(db)
  db.prepare(`
    UPDATE provider_configs
    SET validation_status = ?, last_validation_at = unixepoch(),
        last_validation_http_status = ?, last_validation_blocker = ?, updated_at = unixepoch()
    WHERE provider_id = ?
  `).run(input.result.probe_status, input.result.http_status, input.result.exact_blocker, providerId)
  writeAudit(db, providerId, 'validate', input.actor, input.result.ok ? 'ok' : 'failed', input.result.exact_blocker || null || undefined)
}

export function syncProviderModels(input: {
  db?: Database.Database
  providerId: string
  actor: string
  models: string[]
}): number {
  const db = input.db || getDatabase()
  const providerId = normalizeProviderVaultId(input.providerId)
  ensureProviderVaultSchema(db)
  const insert = db.prepare(`
    INSERT INTO provider_models (provider_id, model_id, model_json, synced_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(provider_id, model_id) DO UPDATE SET
      synced_at = excluded.synced_at,
      model_json = excluded.model_json
  `)
  db.transaction(() => {
    db.prepare(`DELETE FROM provider_models WHERE provider_id = ?`).run(providerId)
    for (const model of input.models) {
      insert.run(providerId, model, JSON.stringify({ id: model }))
    }
    writeAudit(db, providerId, 'sync_models', input.actor, 'ok', `count=${input.models.length}`)
  })()
  return input.models.length
}

export function providerAuditRows(
  db: Database.Database = getDatabase(),
  providerIdInput?: string,
  limit = 100,
): Array<Record<string, unknown>> {
  ensureProviderVaultSchema(db)
  if (providerIdInput) {
    return db.prepare(`
      SELECT id, provider_id, action, actor, result, detail, created_at
      FROM provider_secret_audit
      WHERE provider_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(normalizeProviderVaultId(providerIdInput), limit) as Array<Record<string, unknown>>
  }
  return db.prepare(`
    SELECT id, provider_id, action, actor, result, detail, created_at
    FROM provider_secret_audit
    ORDER BY id DESC
    LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>
}
