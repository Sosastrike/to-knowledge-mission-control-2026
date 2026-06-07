#!/usr/bin/env node
import childProcess from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import Database from 'better-sqlite3'

const cwd = process.cwd()
const envPath = path.join(cwd, '.env')
const dataDir = process.env.MISSION_CONTROL_DATA_DIR || path.join(cwd, '.data')
const dbPath = process.env.MISSION_CONTROL_DB_PATH || path.join(dataDir, 'mission-control.db')
const actor = process.env.MISSION_CONTROL_ACTOR || 'agentmail-bootstrap-key-store'
const providerId = 'agentmail'
const envVarName = 'AGENTMAIL_API_KEY'
const refName = 'AGENTMAIL_API_KEY'

const SAFE_FLAGS = {
  credential_values_exposed: false,
  tokens_exposed: false,
  env_values_exposed: false,
  raw_secret_values_exposed: false,
  execution_enabled: false,
  send_enabled: false,
}

function safeJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

function sanitizeArgName(arg) {
  return String(arg || '').split('=')[0].slice(0, 48)
}

export function normalizeRef(value) {
  return String(value || '').replace(/\^M/g, '').replace(/[\r\n]/g, '').trim().replace(/^env:/, '')
}

export function maskAgentMailBootstrapKey(value) {
  const clean = String(value || '').trim()
  if (!clean) return null
  return `am_****${clean.slice(-4)}`
}

export function fingerprintSecret(value) {
  const clean = String(value || '').trim()
  if (!clean) return null
  return crypto.createHash('sha256').update(clean).digest('hex').slice(0, 12)
}

export function rejectsRawSecretArgument(argv) {
  return argv.some((arg) => /^--(?:key|token|secret|api-key|agentmail-api-key|agentmail-key)=/i.test(String(arg || '')))
}

function parseArgs(argv) {
  const cleaned = argv.filter((arg) => arg !== '--')
  if (rejectsRawSecretArgument(cleaned)) {
    return { ok: false, exact_blocker: 'raw_secret_cli_argument_rejected' }
  }
  const supported = new Set(['--help', '--json'])
  for (const arg of cleaned) {
    const name = sanitizeArgName(arg)
    if (!supported.has(name)) return { ok: false, exact_blocker: 'unsupported_argument', unsupported_argument: name }
  }
  return { ok: true, help: cleaned.includes('--help'), json: cleaned.includes('--json') }
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const result = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    result[key] = value
  }
  return result
}

function parseMasterKey(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex')
  try {
    const decoded = Buffer.from(trimmed, 'base64')
    if (decoded.length === 32) return decoded
  } catch {}
  const utf8 = Buffer.from(trimmed, 'utf8')
  if (utf8.length >= 32) return crypto.createHash('sha256').update(utf8).digest()
  return null
}

function loadMasterKey(env) {
  const inline = String(env.MISSION_CONTROL_SECRETS_MASTER_KEY || '').trim()
  if (inline) {
    const key = parseMasterKey(inline)
    return key ? { ok: true, key, key_version: 'env:MISSION_CONTROL_SECRETS_MASTER_KEY' } : { ok: false, blocker: 'provider_vault_master_key_invalid' }
  }
  const keyFile = String(env.MISSION_CONTROL_SECRETS_KEY_FILE || '').trim()
  if (keyFile) {
    try {
      const key = parseMasterKey(fs.readFileSync(keyFile, 'utf8'))
      return key ? { ok: true, key, key_version: 'file:MISSION_CONTROL_SECRETS_KEY_FILE' } : { ok: false, blocker: 'provider_vault_master_key_invalid' }
    } catch {
      return { ok: false, blocker: 'provider_vault_key_file_unreadable' }
    }
  }
  return { ok: false, blocker: 'provider_vault_master_key_missing' }
}

function ensureProviderVaultSchema(db) {
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

    CREATE TABLE IF NOT EXISTS provider_secret_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'system',
      result TEXT NOT NULL DEFAULT 'ok',
      detail TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)
  db.prepare(`
    INSERT INTO provider_configs (provider_id, display_name, provider_type, base_url, validation_path, enabled, custom)
    VALUES ('agentmail', 'AgentMail', 'hosted', 'https://api.agentmail.to', '/v0/inboxes', 1, 1)
    ON CONFLICT(provider_id) DO UPDATE SET
      display_name = excluded.display_name,
      provider_type = excluded.provider_type,
      base_url = excluded.base_url,
      validation_path = excluded.validation_path,
      enabled = 1,
      custom = 1,
      updated_at = unixepoch()
  `).run()
}

function encryptSecret(rawSecret, masterKey, keyVersion) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv)
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

function writeAudit(db, action, result = 'ok', detail = null) {
  db.prepare(`
    INSERT INTO provider_secret_audit (provider_id, action, actor, result, detail)
    VALUES ('agentmail', ?, ?, ?, ?)
  `).run(action, actor, result, detail)
}

function upsertAgentMailBootstrapSecret(db, rawSecret, masterKey) {
  const encrypted = encryptSecret(rawSecret, masterKey.key, masterKey.key_version)
  const masked = maskAgentMailBootstrapKey(rawSecret)
  const fingerprintHash = crypto.createHash('sha256').update(rawSecret).digest('hex')
  db.transaction(() => {
    db.prepare(`
      UPDATE provider_secrets
      SET active = 0, rotated_at = unixepoch()
      WHERE provider_id = 'agentmail' AND active = 1 AND deleted_at IS NULL
    `).run()
    db.prepare(`
      INSERT INTO provider_secrets (
        provider_id, env_var_name, ciphertext, iv, auth_tag, algorithm,
        key_version, masked_preview, fingerprint_hash, created_by
      ) VALUES ('agentmail', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(envVarName, encrypted.ciphertext, encrypted.iv, encrypted.auth_tag, encrypted.algorithm, encrypted.key_version, masked, fingerprintHash, actor)
    writeAudit(db, 'agentmail_bootstrap_secret_upsert', 'ok', 'hidden_prompt_provider_vault_store')
  })()
  return { masked, fingerprint: fingerprintSecret(rawSecret), keyLength: rawSecret.length }
}

export function buildSanitizedStoreSummary(input) {
  return {
    ok: Boolean(input.ok),
    source: 'agentmail_bootstrap_key_store',
    generated_at: new Date().toISOString(),
    provider_id: providerId,
    env_var_name: envVarName,
    provider_vault_row_created: Boolean(input.providerVaultRowCreated),
    masked_preview: input.maskedPreview || null,
    fingerprint: input.fingerprint || null,
    key_length: input.keyLength || null,
    service_reference_name: 'AGENTMAIL_API_KEY_REF',
    service_reference_value: input.refName || refName,
    next_action: 'restart mission-control.service, then run AgentMail connection test and inbox sync preview',
    ...SAFE_FLAGS,
  }
}

function failure(exactBlocker, extra = {}) {
  return {
    ok: false,
    source: 'agentmail_bootstrap_key_store',
    generated_at: new Date().toISOString(),
    provider_id: providerId,
    env_var_name: envVarName,
    exact_blocker: exactBlocker,
    provider_vault_row_created: false,
    ...extra,
    ...SAFE_FLAGS,
  }
}

function restoreTerminalState() {
  try {
    childProcess.spawnSync('stty', ['sane'], { stdio: 'ignore' })
  } catch {}
}

async function readHiddenLine(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return { ok: false, exact_blocker: 'approved_secret_intake_required' }
  process.stdout.write(prompt)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  try {
    childProcess.spawnSync('stty', ['-echo'], { stdio: 'ignore' })
    const value = await rl.question('')
    process.stdout.write('\n')
    return { ok: true, value: String(value || '').trim() }
  } finally {
    try { rl.close() } catch {}
    restoreTerminalState()
  }
}

function printHelp() {
  process.stdout.write(`Mission Control AgentMail Bootstrap Credential Store\n\n`)
  process.stdout.write(`This stores one AgentMail bootstrap API key into the encrypted existing Provider Vault.\n`)
  process.stdout.write(`It does not modify .env, send email, provision inboxes, or create scoped per-agent credentials.\n`)
  process.stdout.write(`Run from /home/tony/mission-control: pnpm run agentmail:store-bootstrap-key\n`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.ok) {
    safeJson(failure(args.exact_blocker, args.unsupported_argument ? { unsupported_argument: args.unsupported_argument } : {}))
    return
  }
  if (args.help) {
    printHelp()
    return
  }

  const envFile = parseEnvFile(envPath)
  const env = { ...envFile, ...process.env }
  const masterKey = loadMasterKey(env)
  if (!masterKey.ok) {
    safeJson(failure(masterKey.blocker))
    return
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    safeJson(failure('approved_secret_intake_required'))
    return
  }

  process.stdout.write(`Mission Control AgentMail Bootstrap Credential Store\n`)
  process.stdout.write(`Provider: AgentMail\n`)
  process.stdout.write(`Expected reference: ${envVarName}\n\n`)
  process.stdout.write(`Paste the AgentMail API key at the hidden prompt. Input is hidden. Nothing will appear on screen.\n`)
  const hidden = await readHiddenLine('AgentMail API key: ')
  if (!hidden.ok) {
    safeJson(failure(hidden.exact_blocker))
    return
  }
  const rawSecret = String(hidden.value || '').trim()
  if (!rawSecret) {
    safeJson(failure('agentmail_api_key_blank'))
    return
  }

  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  const db = new Database(dbPath)
  try {
    ensureProviderVaultSchema(db)
    const stored = upsertAgentMailBootstrapSecret(db, rawSecret, masterKey)
    safeJson(buildSanitizedStoreSummary({
      ok: true,
      providerVaultRowCreated: true,
      maskedPreview: stored.masked,
      fingerprint: stored.fingerprint,
      keyLength: stored.keyLength,
      refName,
    }))
  } finally {
    db.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    restoreTerminalState()
    safeJson(failure('agentmail_bootstrap_store_failed', {
      error: String(error?.message || error).replace(/[A-Za-z0-9._-]{16,}/g, '[redacted]'),
    }))
  })
}
