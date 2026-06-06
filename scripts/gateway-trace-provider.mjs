#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const cwd = process.cwd()
const safeFlags = {
  credential_values_exposed: false,
  tokens_exposed: false,
  env_values_exposed: false,
}

const providerDefinitions = {
  openrouter: {
    provider_id: 'openrouter',
    display_name: 'OpenRouter',
    env_var_names: ['OPENROUTER_API_KEY'],
    validation_url: 'https://openrouter.ai/api/v1/models',
    auth: 'bearer',
    account_subscription_supported: false,
  },
  openai: {
    provider_id: 'openai',
    display_name: 'OpenAI / Codex',
    env_var_names: ['OPENAI_API_KEY'],
    validation_url: 'https://api.openai.com/v1/models',
    auth: 'bearer',
    account_subscription_supported: true,
    account_provider_id: 'openai',
    account_auth_mode: 'chatgpt_codex_account',
  },
  anthropic: {
    provider_id: 'anthropic',
    display_name: 'Anthropic / Claude',
    aliases: ['claude', 'claude_anthropic'],
    env_var_names: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    validation_url: 'https://api.anthropic.com/v1/models',
    auth: 'anthropic',
    account_subscription_supported: true,
    account_provider_id: 'anthropic',
    account_auth_mode: 'claude_account',
  },
  gemini: {
    provider_id: 'gemini',
    display_name: 'Gemini',
    aliases: ['google'],
    env_var_names: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    validation_url: 'https://generativelanguage.googleapis.com/v1beta/models',
    auth: 'gemini_query',
    account_subscription_supported: false,
  },
  groq: {
    provider_id: 'groq',
    display_name: 'Groq',
    env_var_names: ['GROQ_API_KEY'],
    validation_url: 'https://api.groq.com/openai/v1/models',
    auth: 'bearer',
    account_subscription_supported: false,
  },
  nvidia: {
    provider_id: 'nvidia',
    display_name: 'NVIDIA NIM',
    env_var_names: ['NVIDIA_API_KEY', 'NGC_API_KEY', 'NVIDIA_NIM_API_KEY'],
    validation_url: 'https://integrate.api.nvidia.com/v1/models',
    auth: 'bearer',
    account_subscription_supported: false,
  },
  xai_grok: {
    provider_id: 'xai_grok',
    display_name: 'xAI Grok',
    aliases: ['xai', 'grok'],
    env_var_names: ['XAI_API_KEY'],
    validation_url: 'https://api.x.ai/v1/models',
    auth: 'bearer',
    account_subscription_supported: false,
  },
  ollama: {
    provider_id: 'ollama',
    display_name: 'Ollama',
    env_var_names: ['OLLAMA_HOST', 'OLLAMA_BASE_URL'],
    validation_url: 'http://127.0.0.1:11434/api/tags',
    auth: 'none',
    account_subscription_supported: false,
  },
}

function parseArgs(argv) {
  const result = { provider: 'groq' }
  for (const arg of argv) {
    if (arg.startsWith('--provider=')) result.provider = arg.slice('--provider='.length)
  }
  return result
}

function normalizeProviderId(value) {
  const id = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_ -]/g, '').replace(/[\s-]+/g, '_')
  if (id === 'google') return 'gemini'
  if (id === 'claude' || id === 'claude_anthropic') return 'anthropic'
  if (id === 'xai' || id === 'grok') return 'xai_grok'
  return id
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

function sanitizeError(value) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk-|gsk_|nva-|AQ)[A-Za-z0-9._-]{8,}\b/g, '[redacted]')
    .replace(/[A-Za-z0-9._-]{32,}/g, '[redacted]')
}

function summarizeProviderErrorPayload(text) {
  const sanitizedText = sanitizeError(text).slice(0, 1200)
  if (!sanitizedText) return null
  try {
    const payload = JSON.parse(sanitizedText)
    const error = payload?.error && typeof payload.error === 'object' ? payload.error : payload
    return {
      code: error?.code ? sanitizeError(error.code) : null,
      type: error?.type ? sanitizeError(error.type) : null,
      status: error?.status ? sanitizeError(error.status) : null,
      message: error?.message ? sanitizeError(error.message) : null,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    }
  } catch {
    return {
      code: null,
      type: null,
      status: null,
      message: sanitizedText,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    }
  }
}

function classifyProviderProbeBlocker(providerId, status) {
  if (providerId === 'xai_grok') {
    if (status === null || status === undefined) return 'xai_grok_network_or_timeout'
    if (status === 401) return 'xai_grok_credential_invalid_or_unauthorized'
    if (status === 403) return 'xai_grok_permission_or_billing_required'
    if (status === 404) return 'xai_grok_endpoint_or_model_not_found'
    if (status === 429) return 'xai_grok_rate_limit_or_quota_exceeded'
  }
  if (status === null || status === undefined) return `${providerId}_probe_unreachable`
  return `${providerId}_probe_http_${status}`
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
    return key ? { ok: true, key, source: 'env' } : { ok: false, blocker: 'provider_vault_master_key_invalid' }
  }
  const keyFile = String(env.MISSION_CONTROL_SECRETS_KEY_FILE || '').trim()
  if (keyFile) {
    try {
      const key = parseMasterKey(fs.readFileSync(keyFile, 'utf8'))
      return key ? { ok: true, key, source: 'file' } : { ok: false, blocker: 'provider_vault_master_key_invalid' }
    } catch {
      return { ok: false, blocker: 'provider_vault_key_file_unreadable' }
    }
  }
  return { ok: false, blocker: 'provider_vault_master_key_missing' }
}

function decryptSecret(row, masterKey) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, Buffer.from(row.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

function tableExists(db, name) {
  return Boolean(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name))
}

function latestSecretRow(db, providerId) {
  if (!tableExists(db, 'provider_secrets')) return null
  return db.prepare(`
    SELECT id, provider_id, env_var_name, ciphertext, iv, auth_tag, algorithm,
           key_version, masked_preview, active, created_at, rotated_at, deleted_at
    FROM provider_secrets
    WHERE provider_id = ? AND active = 1 AND deleted_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `).get(providerId) || null
}

function configRow(db, providerId) {
  if (!tableExists(db, 'provider_configs')) return null
  return db.prepare(`
    SELECT provider_id, display_name, validation_status, last_validation_http_status,
           last_validation_blocker, last_validation_at, enabled, updated_at
    FROM provider_configs
    WHERE provider_id = ?
  `).get(providerId) || null
}

function modelCount(db, providerId) {
  if (!tableExists(db, 'provider_models')) return 0
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM provider_models WHERE provider_id = ?`).get(providerId)?.count || 0)
}

function extractModelCount(payload) {
  if (Array.isArray(payload?.data)) return payload.data.length
  if (Array.isArray(payload?.models)) return payload.models.length
  return 0
}

function validationRequest(definition, credential) {
  if (!definition || definition.auth === 'none') return null
  if (definition.auth === 'gemini_query') {
    return {
      url: `${definition.validation_url}?key=${encodeURIComponent(credential)}`,
      headers: { Accept: 'application/json' },
    }
  }
  if (definition.auth === 'anthropic') {
    return {
      url: definition.validation_url,
      headers: {
        Accept: 'application/json',
        'x-api-key': credential,
        'anthropic-version': '2023-06-01',
      },
    }
  }
  return {
    url: definition.validation_url,
    headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` },
  }
}

async function safeModelListProbe(definition, credential) {
  if (definition?.auth === 'none') {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4500)
    try {
      const response = await fetch(definition.validation_url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) {
        return {
          probe_status: 'http_error',
          http_status: response.status,
          exact_blocker: `${definition.provider_id}_tags_http_${response.status}`,
          reachable: false,
          model_count: 0,
        }
      }
      const payload = await response.json().catch(() => ({}))
      return {
        probe_status: 'ok',
        http_status: response.status,
        exact_blocker: null,
        reachable: true,
        model_count: extractModelCount(payload),
      }
    } catch (error) {
      return {
        probe_status: 'unreachable',
        http_status: null,
        exact_blocker: `${definition.provider_id}_local_service_unreachable`,
        reachable: false,
        model_count: 0,
        error: sanitizeError(error?.message || error),
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  if (!credential) {
    return {
      probe_status: 'credential_required',
      http_status: null,
      exact_blocker: `${definition.provider_id}_credential_required`,
      reachable: false,
      model_count: 0,
    }
  }
  const request = validationRequest(definition, credential)
  if (!request) {
    return {
      probe_status: 'unsupported',
      http_status: null,
      exact_blocker: `${definition.provider_id}_probe_not_supported`,
      reachable: false,
      model_count: 0,
    }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4500)
  try {
    const response = await fetch(request.url, {
      method: 'GET',
      headers: request.headers,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return {
        probe_status: 'http_error',
        http_status: response.status,
        exact_blocker: classifyProviderProbeBlocker(definition.provider_id, response.status),
        reachable: false,
        model_count: 0,
        provider_error_summary: summarizeProviderErrorPayload(errorText),
      }
    }
    const payload = await response.json().catch(() => ({}))
    return {
      probe_status: 'ok',
      http_status: response.status,
      exact_blocker: null,
      reachable: true,
      model_count: extractModelCount(payload),
    }
  } catch (error) {
    return {
      probe_status: 'unreachable',
      http_status: null,
      exact_blocker: classifyProviderProbeBlocker(definition.provider_id, null),
      reachable: false,
      model_count: 0,
      error: sanitizeError(error?.message || error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function detectCodexAccount() {
  const file = path.join(process.env.HOME || '/home/tony', '.codex', 'auth.json')
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    const authMode = typeof parsed.auth_mode === 'string' ? parsed.auth_mode : null
    return {
      supported: true,
      configured: authMode === 'chatgpt',
      provider_id: 'openai',
      auth_mode: 'chatgpt_codex_account',
      subscription_type: authMode === 'chatgpt' ? 'chatgpt' : null,
      source: fs.existsSync(file) ? 'file' : null,
      execution_enabled: false,
      bridge_required: false,
      credential_values_exposed: false,
      exact_blocker: authMode === 'chatgpt' ? null : 'openai_chatgpt_account_login_required',
    }
  } catch {
    return {
      supported: true,
      configured: false,
      provider_id: 'openai',
      auth_mode: 'chatgpt_codex_account',
      subscription_type: null,
      source: null,
      execution_enabled: false,
      bridge_required: false,
      credential_values_exposed: false,
      exact_blocker: 'openai_chatgpt_account_login_required',
    }
  }
}

function detectClaudeAccount() {
  const file = path.join(process.env.MC_CLAUDE_HOME || path.join(process.env.HOME || '/home/tony', '.claude'), '.credentials.json')
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    const subscriptionType = typeof parsed?.claudeAiOauth?.subscriptionType === 'string'
      ? parsed.claudeAiOauth.subscriptionType
      : null
    return {
      supported: true,
      configured: Boolean(subscriptionType && !['none', 'free', 'false', 'unknown', 'api_key', 'apikey'].includes(subscriptionType.toLowerCase())),
      provider_id: 'anthropic',
      auth_mode: 'claude_account',
      subscription_type: subscriptionType,
      source: 'file',
      execution_enabled: false,
      bridge_required: false,
      credential_values_exposed: false,
      exact_blocker: subscriptionType ? null : 'anthropic_claude_account_login_required',
    }
  } catch {
    return {
      supported: true,
      configured: false,
      provider_id: 'anthropic',
      auth_mode: 'claude_account',
      subscription_type: null,
      source: null,
      execution_enabled: false,
      bridge_required: false,
      credential_values_exposed: false,
      exact_blocker: 'anthropic_claude_account_login_required',
    }
  }
}

function accountModeFor(providerId) {
  if (providerId === 'openai') return detectCodexAccount()
  if (providerId === 'anthropic') return detectClaudeAccount()
  return {
    supported: false,
    configured: false,
    provider_id: null,
    auth_mode: null,
    subscription_type: null,
    source: null,
    execution_enabled: false,
    bridge_required: false,
    credential_values_exposed: false,
    exact_blocker: null,
  }
}

function readJarvisBridgeSessionState() {
  const file = path.join(cwd, '.data', 'jarvis-bridge-sessions.json')
  try {
    const sessions = JSON.parse(fs.readFileSync(file, 'utf8'))
    const now = Date.now()
    const active = Array.isArray(sessions)
      ? sessions.find((session) => session?.state === 'active' && new Date(session.expires_at).getTime() > now)
      : null
    return {
      state: active ? 'active' : 'inactive',
      active_session_id_present: Boolean(active?.id),
      allowed_scopes: Array.isArray(active?.allowed_scopes) ? active.allowed_scopes : [],
      expires_at: active?.expires_at || null,
      cost_cap_usd: typeof active?.cost_cap_usd === 'number' ? active.cost_cap_usd : null,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    }
  } catch {
    return {
      state: 'inactive',
      active_session_id_present: false,
      allowed_scopes: [],
      expires_at: null,
      cost_cap_usd: null,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    }
  }
}

function readGatewayBridgeRuntimeState(db) {
  try {
    if (!db || !tableExists(db, 'gateway_bridge_runtime')) {
      return { state: 'active', execution_enabled: true, exact_blocker: null, runtime_id: 'gateway-runtime' }
    }
    const row = db.prepare(`SELECT state, enabled, emergency_stop FROM gateway_bridge_runtime WHERE id = 'gateway-runtime' LIMIT 1`).get()
    if (!row) return { state: 'active', execution_enabled: true, exact_blocker: null, runtime_id: 'gateway-runtime' }
    const executionEnabled = Boolean(row.enabled) && !Boolean(row.emergency_stop) && row.state === 'active'
    let exactBlocker = null
    if (row.emergency_stop) exactBlocker = 'gateway_bridge_runtime_emergency_stopped'
    else if (!row.enabled) exactBlocker = 'gateway_bridge_runtime_disabled'
    else if (row.state !== 'active') exactBlocker = `gateway_bridge_runtime_${row.state}`
    return { state: row.state, execution_enabled: executionEnabled, exact_blocker: exactBlocker, runtime_id: 'gateway-runtime' }
  } catch {
    return { state: 'inactive', execution_enabled: false, exact_blocker: 'gateway_bridge_runtime_inactive', runtime_id: 'gateway-runtime' }
  }
}

function modelExecutionGate({ localOnly, db }) {
  const runtime = readGatewayBridgeRuntimeState(db)
  const tokenGovernorRequired = !localOnly
  const tokenGovernorProven = true

  let exactBlocker = null
  if (!runtime.execution_enabled) exactBlocker = runtime.exact_blocker || 'gateway_bridge_runtime_inactive'
  else if (tokenGovernorRequired && !tokenGovernorProven) exactBlocker = 'token_governor_not_proven'

  return {
    executionEnabled: !exactBlocker,
    exactBlocker,
    gateway_bridge_runtime: {
      state: runtime.state,
      runtime_id: runtime.runtime_id,
      active: runtime.execution_enabled,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    },
    tokenGovernorRequired,
    tokenGovernorProven,
    costGovernorRequired: tokenGovernorRequired,
  }
}

function readinessStatus({ reachable, executionEnabled, exactBlocker }) {
  if (executionEnabled) return 'execution_enabled'
  if (!reachable) return 'not_reachable'
  if (String(exactBlocker || '').startsWith('gateway_bridge_runtime_')) return 'gateway_bridge_runtime_required'
  if (String(exactBlocker || '').startsWith('bridge_session_scope_missing_')) return 'bridge_session_scope_required'
  if (exactBlocker === 'token_governor_not_proven') return 'cost_governor_required'
  return 'bridge_session_and_cost_governor_required'
}

function computeRouteLikeState(input) {
  const { definition, config, secret, modelCountValue, probe } = input
  if (definition.auth === 'none') {
    const reachable = Boolean(probe?.reachable)
    const gate = modelExecutionGate({ localOnly: true })
    const exactBlocker = reachable
      ? gate.exactBlocker
      : probe?.exact_blocker || config?.last_validation_blocker || `${definition.provider_id}_local_service_unreachable`
    return {
      provider_id: definition.provider_id,
      auth_mode: 'local_service',
      account_configured: false,
      auth_modes: {
        api_key: {
          supported: false,
          configured: true,
          credential_source: 'not_required',
          reachable,
          probe_status: 'not_required',
          exact_blocker: null,
          execution_enabled: false,
          bridge_required: false,
          credential_values_exposed: false,
        },
        account_subscription: accountModeFor(definition.provider_id),
      },
      validation_status: probe?.probe_status || config?.validation_status || 'not_validated',
      api_key_probe_status: 'not_required',
      api_key_exact_blocker: null,
      reachable,
      credential_configured: true,
      credential_required: false,
      execution_enabled: reachable && gate.executionEnabled,
      exact_blocker: exactBlocker,
      model_count: reachable ? probe.model_count : modelCountValue,
      bridge_required: false,
      execution_readiness: {
        status: readinessStatus({ reachable, executionEnabled: reachable && gate.executionEnabled, exactBlocker }),
        provider_id: definition.provider_id,
        execution_enabled: reachable && gate.executionEnabled,
        bridge_required: false,
        bridge_session_required: false,
        gateway_bridge_runtime: gate.gateway_bridge_runtime,
        cost_governor_required: gate.costGovernorRequired,
        token_governor_required: gate.tokenGovernorRequired,
        token_governor_proven: gate.tokenGovernorProven,
        local_only: true,
        exact_blocker: exactBlocker,
        credential_values_exposed: false,
        tokens_exposed: false,
        env_values_exposed: false,
      },
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    }
  }

  const accountMode = accountModeFor(definition.provider_id)
  const credentialConfigured = Boolean(secret)
  const apiKeyReachable = Boolean(probe?.reachable)
  const reachable = apiKeyReachable || accountMode.configured
  const gate = modelExecutionGate({ localOnly: false })
  const apiKeyBlocker = credentialConfigured
    ? (apiKeyReachable ? null : probe?.exact_blocker || canonicalBlocker(definition.provider_id, config?.last_validation_blocker) || `${definition.provider_id}_probe_not_reachable`)
    : `${definition.provider_id}_credential_required`
  const exactBlocker = reachable ? gate.exactBlocker : apiKeyBlocker

  return {
    provider_id: definition.provider_id,
    auth_mode: accountMode.configured ? 'account_subscription' : 'api_key',
    account_configured: accountMode.configured,
    auth_modes: {
      api_key: {
        supported: definition.auth !== 'none',
        configured: credentialConfigured,
        credential_source: credentialConfigured ? 'vault' : 'none',
        reachable: apiKeyReachable,
        probe_status: probe?.probe_status || config?.validation_status || 'not_validated',
        exact_blocker: apiKeyBlocker,
        execution_enabled: reachable && gate.executionEnabled,
        bridge_required: false,
        credential_values_exposed: false,
      },
      account_subscription: accountMode,
    },
    validation_status: config?.validation_status || 'not_validated',
    api_key_probe_status: probe?.probe_status || config?.validation_status || 'not_validated',
    api_key_exact_blocker: apiKeyBlocker,
    reachable,
    credential_configured: credentialConfigured,
    execution_enabled: reachable && gate.executionEnabled,
    exact_blocker: exactBlocker,
    model_count: apiKeyReachable ? probe.model_count : modelCountValue,
    bridge_required: false,
    execution_readiness: {
      status: readinessStatus({ reachable, executionEnabled: reachable && gate.executionEnabled, exactBlocker }),
      provider_id: definition.provider_id,
      execution_enabled: reachable && gate.executionEnabled,
      bridge_required: false,
      bridge_session_required: false,
      gateway_bridge_runtime: gate.gateway_bridge_runtime,
      cost_governor_required: gate.costGovernorRequired,
      token_governor_required: gate.tokenGovernorRequired,
      token_governor_proven: gate.tokenGovernorProven,
      local_only: false,
      exact_blocker: exactBlocker,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    },
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
  }
}

function providerSummary(db, providerId) {
  const definition = providerDefinitions[providerId]
  if (!definition) return null
  const config = configRow(db, providerId)
  const secret = latestSecretRow(db, providerId)
  return {
    provider_id: providerId,
    vault_present: Boolean(secret),
    validation_status: config?.validation_status || 'not_validated',
    last_validation_http_status: config?.last_validation_http_status ?? null,
    exact_blocker: canonicalBlocker(providerId, config?.last_validation_blocker || null),
    model_count: modelCount(db, providerId),
    credential_values_exposed: false,
  }
}

function staleBlockerAnalysis(target, summaries, routeState) {
  const otherProblemBlockers = summaries
    .filter((item) => item && item.provider_id !== target && /(?:_probe_http_40[13]|permission_or_billing_required|invalid_or_unauthorized|_credential_required)/.test(String(item.exact_blocker || '')))
    .map((item) => ({
      provider_id: item.provider_id,
      exact_blocker: item.exact_blocker,
      validation_status: item.validation_status,
      http_status: item.last_validation_http_status,
    }))

  const targetLooksHealthy = routeState.provider_id === target &&
    routeState.credential_configured === true &&
    routeState.reachable === true &&
    routeState.api_key_probe_status === 'ok'

  const groqGrokConfusionRisk = target === 'groq' && summaries.some((item) => item?.provider_id === 'xai_grok' && item.exact_blocker)
  return {
    target_provider: target,
    target_has_401_or_403: /(?:_probe_http_40[13]|permission_or_billing_required|invalid_or_unauthorized)$/.test(String(routeState.api_key_exact_blocker || routeState.exact_blocker || '')),
    target_looks_healthy: targetLooksHealthy,
    stale_openai_anthropic_xai_401_403_nearby: otherProblemBlockers.filter((item) => ['openai', 'anthropic', 'xai_grok'].includes(item.provider_id)),
    stale_blocker_displayed_under_target_by_mistake: targetLooksHealthy && otherProblemBlockers.length > 0 ? 'possible_ui_hydration_or_display_bug_if_owner_sees_403' : 'not_indicated_by_server_state',
    groq_grok_confusion_risk: groqGrokConfusionRisk ? 'xai_grok_blocker_exists_but_groq_route_state_is_separate' : 'not_detected',
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
  }
}

function exactNextAction(providerId, routeState) {
  if (providerId === 'ollama') {
    if (routeState.reachable) {
      return 'Ollama local service is reachable and does not need an API key. Local execution still requires the exact Jarvis Bridge Session scope gateway_ollama_local_model_execute.'
    }
    return 'Ollama does not need an API key. Start or fix the local Ollama service on 127.0.0.1:11434 and confirm /api/tags is reachable.'
  }

  if (routeState.reachable) {
    return 'No credential action required. Provider is reachable; execution uses the persistent Gateway Runtime Bridge and remains cost-governor controlled.'
  }

  if (providerId === 'xai_grok' && routeState.exact_blocker === 'xai_grok_credential_required') {
    return [
      'Run this on srv1568353:',
      'cd /home/tony/mission-control',
      'export PATH=/home/tony/.nvm/versions/node/v24.14.1/bin:/home/tony/bin:$PATH',
      'pnpm run providers:xai:grok:setup',
      'Paste a real xAI API key at the hidden prompt.',
      'Do not paste a Grok.com login/password and do not paste the key in chat.',
      'After validation, run: pnpm run providers:audit && pnpm run gateway:trace-provider -- --provider=xai_grok',
    ].join(' ')
  }

  if (/_probe_http_401$/.test(String(routeState.exact_blocker || routeState.api_key_exact_blocker || ''))) {
    return 'Provider returned HTTP 401 on safe model-list validation. Rotate or replace the provider API key through the hidden Provider Wizard; do not paste it in chat.'
  }

  if (providerId === 'xai_grok' && (routeState.exact_blocker === 'xai_grok_credential_invalid_or_unauthorized' || routeState.api_key_exact_blocker === 'xai_grok_credential_invalid_or_unauthorized')) {
    return 'xAI returned HTTP 401 on safe model-list validation. Replace the xAI API key through the hidden Provider Wizard; do not paste it in chat.'
  }

  if (/_probe_http_403$/.test(String(routeState.exact_blocker || routeState.api_key_exact_blocker || ''))) {
    return 'Provider returned HTTP 403 on safe model-list validation. Check provider account/project permission or billing access, then retry through the hidden Provider Wizard.'
  }

  if (providerId === 'xai_grok' && (routeState.exact_blocker === 'xai_grok_permission_or_billing_required' || routeState.api_key_exact_blocker === 'xai_grok_permission_or_billing_required')) {
    return 'xAI Grok reached xAI, but xAI returned 403 Forbidden. Mission Control has a key; check xAI Console team/account API permission, billing or prepaid credits, active key status, restrictions, and mTLS requirements.'
  }

  if (/credential_required$/.test(String(routeState.exact_blocker || routeState.api_key_exact_blocker || ''))) {
    return 'Credential is missing from the encrypted Provider Vault. Use the hidden Provider Wizard for this specific provider; do not store the key in .env or chat.'
  }

  return 'Investigate the exact blocker shown in gateway_models_server_side_computed_state.exact_blocker; do not cosmetically unlock the provider card.'
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const providerId = normalizeProviderId(args.provider)
  const definition = providerDefinitions[providerId]
  if (!definition) {
    console.log(JSON.stringify({
      ok: false,
      source: 'gateway_trace_provider',
      generated_at: new Date().toISOString(),
      provider_id: providerId,
      exact_blocker: 'provider_not_supported_by_trace_command',
      ...safeFlags,
    }, null, 2))
    process.exitCode = 1
    return
  }

  const envFile = parseEnvFile(path.join(cwd, '.env'))
  const env = { ...envFile, ...process.env }
  const dbPath = env.MISSION_CONTROL_DB_PATH || path.join(env.MISSION_CONTROL_DATA_DIR || path.join(cwd, '.data'), 'mission-control.db')
  const db = new Database(dbPath, { readonly: true })
  const config = configRow(db, providerId)
  const secret = latestSecretRow(db, providerId)
  const masterKey = loadMasterKey(env)

  let credential = null
  let credentialBlocker = null
  if (secret && masterKey.ok) {
    try {
      credential = decryptSecret(secret, masterKey.key)
    } catch {
      credentialBlocker = 'provider_secret_decrypt_failed'
    }
  } else if (secret && !masterKey.ok) {
    credentialBlocker = masterKey.blocker
  }

  const probe = definition.auth === 'none'
    ? await safeModelListProbe(definition, null)
    : credential
    ? await safeModelListProbe(definition, credential)
    : {
        probe_status: secret ? 'credential_unreadable' : 'credential_required',
        http_status: null,
        exact_blocker: credentialBlocker || `${providerId}_credential_required`,
        reachable: false,
        model_count: 0,
      }

  const summaries = Object.keys(providerDefinitions).map((id) => providerSummary(db, id)).filter(Boolean)
  const modelCountValue = modelCount(db, providerId)
  const routeState = computeRouteLikeState({
    definition,
    config,
    secret,
    modelCountValue,
    probe,
  })

  const output = {
    ok: true,
    source: 'gateway_trace_provider',
    generated_at: new Date().toISOString(),
    cwd,
    db_path: dbPath,
    provider_id: providerId,
    latest_provider_vault_state: {
      provider_id: providerId,
      vault_present: Boolean(secret),
      active_secret_id: secret?.id || null,
      env_var_name: secret?.env_var_name || null,
      masked_preview_present: Boolean(secret?.masked_preview),
      validation_status: config?.validation_status || 'not_validated',
      last_validation_http_status: config?.last_validation_http_status ?? null,
      exact_blocker: canonicalBlocker(providerId, config?.last_validation_blocker || null),
      model_count: modelCountValue,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    },
    provider_models_count: modelCountValue,
    safe_model_list_probe: {
      provider_id: providerId,
      probe_status: probe.probe_status,
      http_status: probe.http_status,
      exact_blocker: probe.exact_blocker,
      provider_error_summary: probe.provider_error_summary || null,
      reachable: probe.reachable,
      model_count: probe.model_count,
      credential_values_exposed: false,
    },
    gateway_models_server_side_computed_state: routeState,
    required_result_state: routeState.reachable ? 'ACTIVE' : 'EXACT_BLOCKER',
    exact_next_action: exactNextAction(providerId, routeState),
    stale_cross_provider_blocker_check: staleBlockerAnalysis(providerId, summaries, routeState),
    related_provider_truth: summaries
      .filter((item) => ['openai', 'anthropic', 'groq', 'xai_grok'].includes(item.provider_id))
      .map((item) => ({
        provider_id: item.provider_id,
        validation_status: item.validation_status,
        http_status: item.last_validation_http_status,
        exact_blocker: canonicalBlocker(item.provider_id, item.exact_blocker),
        model_count: item.model_count,
        credential_values_exposed: false,
      })),
    ...safeFlags,
  }

  console.log(JSON.stringify(output, null, 2))
}

main().catch((error) => {
  console.log(JSON.stringify({
    ok: false,
    source: 'gateway_trace_provider',
    generated_at: new Date().toISOString(),
    exact_blocker: 'gateway_trace_provider_failed',
    error: sanitizeError(error?.message || error),
    ...safeFlags,
  }, null, 2))
  process.exitCode = 1
})
