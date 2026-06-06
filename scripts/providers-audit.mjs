#!/usr/bin/env node
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const cwd = process.cwd()
const envPath = path.join(cwd, '.env')
const dataDir = process.env.MISSION_CONTROL_DATA_DIR || path.join(cwd, '.data')
const dbPath = process.env.MISSION_CONTROL_DB_PATH || path.join(dataDir, 'mission-control.db')

const providerVars = {
  openrouter: ['OPENROUTER_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
  groq: ['GROQ_API_KEY'],
  nvidia: ['NVIDIA_API_KEY', 'NGC_API_KEY', 'NVIDIA_NIM_API_KEY'],
  xai_grok: ['XAI_API_KEY'],
  ollama: ['OLLAMA_HOST', 'OLLAMA_BASE_URL'],
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const result = {}
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

function mask(value) {
  if (!value) return null
  if (value.length <= 8) return `${value.slice(0, 1)}...${value.slice(-1)}`
  return `${value.slice(0, 3)}...${value.slice(-4)}`
}

function fingerprint(value) {
  if (!value) return null
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)
}

function tableExists(db, name) {
  return Boolean(db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(name))
}



function codexAccountActive() {
  try {
    const file = path.join(process.env.HOME || '/home/tony', '.codex', 'auth.json')
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return parsed?.auth_mode === 'chatgpt'
  } catch {
    return false
  }
}

function claudeAccountActive() {
  try {
    const file = path.join(process.env.MC_CLAUDE_HOME || path.join(process.env.HOME || '/home/tony', '.claude'), '.credentials.json')
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    const type = String(parsed?.claudeAiOauth?.subscriptionType || '').toLowerCase()
    return Boolean(type && !['none', 'free', 'false', 'unknown', 'api_key', 'apikey'].includes(type))
  } catch {
    return false
  }
}

function gatewayRuntimeActive(db) {
  try {
    if (!db || !tableExists(db, 'gateway_bridge_runtime')) return true
    const row = db.prepare(`SELECT state, enabled, emergency_stop FROM gateway_bridge_runtime WHERE id = 'gateway-runtime' LIMIT 1`).get()
    if (!row) return true
    return Boolean(row.enabled) && !Boolean(row.emergency_stop) && row.state === 'active'
  } catch {
    return false
  }
}

function canonicalBlocker(providerId, blocker) {
  if (providerId !== 'xai_grok') return blocker
  if (blocker === 'xai_grok_probe_http_401') return 'xai_grok_credential_invalid_or_unauthorized'
  if (blocker === 'xai_grok_probe_http_403') return 'xai_grok_permission_or_billing_required'
  if (blocker === 'xai_grok_probe_http_404') return 'xai_grok_endpoint_or_model_not_found'
  if (blocker === 'xai_grok_probe_http_429') return 'xai_grok_rate_limit_or_quota_exceeded'
  if (blocker === 'xai_grok_probe_unreachable') return 'xai_grok_network_or_timeout'
  return blocker
}

const envFile = parseEnvFile(envPath)
const env = { ...envFile, ...process.env }
const summary = {
  ok: true,
  source: 'provider_vault_runtime_audit',
  generated_at: new Date().toISOString(),
  cwd,
  db_path: dbPath,
  env_file: envPath,
  credential_values_exposed: false,
  providers: [],
}

let db = null
try {
  if (fs.existsSync(dbPath)) db = new Database(dbPath, { readonly: true })
} catch (error) {
  summary.db_error = String(error?.message || error).replace(/[A-Za-z0-9_-]{16,}/g, '[redacted]')
}

for (const [providerId, names] of Object.entries(providerVars)) {
  const envName = names.find((name) => env[name])
  const row = {
    provider_id: providerId,
    env_present: Boolean(envName),
    env_var_name: envName || null,
    env_masked_preview: envName ? mask(env[envName]) : null,
    env_fingerprint: envName ? fingerprint(env[envName]) : null,
    vault_present: false,
    vault_masked_preview: null,
    validation_status: 'not_available',
    exact_blocker: envName ? null : providerId === 'ollama' ? null : `${providerId}_credential_required`,
    execution_enabled: false,
    bridge_required: false,
    credential_values_exposed: false,
  }

  if (db && tableExists(db, 'provider_secrets')) {
    const secret = db.prepare(`
      SELECT masked_preview
      FROM provider_secrets
      WHERE provider_id = ? AND active = 1 AND deleted_at IS NULL
      ORDER BY id DESC
      LIMIT 1
    `).get(providerId)
    if (secret) {
      row.vault_present = true
      row.vault_masked_preview = secret.masked_preview
      row.exact_blocker = null
    }
  }

  if (db && tableExists(db, 'provider_configs')) {
    const config = db.prepare(`
      SELECT validation_status, last_validation_blocker
      FROM provider_configs
      WHERE provider_id = ?
    `).get(providerId)
    if (config) {
      row.validation_status = config.validation_status || 'not_validated'
      if (config.last_validation_blocker) row.exact_blocker = canonicalBlocker(providerId, config.last_validation_blocker)
    }
  }

  const runtimeActive = gatewayRuntimeActive(db)
  const accountModeActive = (providerId === 'openai' && codexAccountActive()) || (providerId === 'anthropic' && claudeAccountActive())
  if (accountModeActive) {
    row.account_mode_active = true
    row.account_mode = providerId === 'openai' ? 'chatgpt_codex_account' : 'claude_account'
    row.exact_blocker = null
  }
  if ((accountModeActive || row.validation_status === 'ok' || (providerId === 'ollama' && !row.exact_blocker)) && runtimeActive) {
    row.execution_enabled = true
    row.bridge_required = false
  } else if (row.validation_status === 'ok' && !runtimeActive) {
    row.execution_enabled = false
    row.exact_blocker = row.exact_blocker || 'gateway_bridge_runtime_inactive'
  }

  summary.providers.push(row)
}

console.log(JSON.stringify(summary, null, 2))
