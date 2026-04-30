#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const apiKey = process.env.MISSION_CONTROL_API_KEY || readApiKeyFromDb()

if (!apiKey) {
  console.error(JSON.stringify({ ok: false, error: 'missing_api_key_for_local_check' }, null, 2))
  process.exit(1)
}

function readApiKeyFromDb() {
  try {
    return execFileSync('sqlite3', [
      '.data/mission-control.db',
      "SELECT value FROM settings WHERE key='security.api_key' LIMIT 1;",
    ], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

async function getJson(path) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    })
    const body = await response.json().catch(() => ({}))
    return { path, status: response.status, body }
  } catch (error) {
    return {
      path,
      status: 0,
      body: {},
      error: error instanceof Error ? error.message : 'request_failed',
    }
  }
}

const expectedIds = [
  'tony',
  'agent_zero',
  'hermes',
  'openrouter',
  'nvidia',
  'openai',
  'ollama',
  'claude_cli',
  'openclaw_gateway',
]

const failures = []
const result = await getJson('/api/bridge/providers')
const providers = Array.isArray(result.body?.providers) ? result.body.providers : []
const ids = providers.map((provider) => provider.id).sort()
const missing = expectedIds.filter((id) => !ids.includes(id))
const extra = ids.filter((id) => !expectedIds.includes(id))
const payloadText = JSON.stringify(result.body || {})

if (result.status !== 200 || result.body?.ok !== true) {
  failures.push({ path: result.path, status: result.status, error: 'provider_registry_not_ok' })
}
if (missing.length || extra.length) {
  failures.push({ path: result.path, error: 'provider_registry_id_mismatch', missing, extra })
}
if (providers.length !== expectedIds.length) {
  failures.push({ path: result.path, error: 'provider_registry_wrong_count', expected: expectedIds.length, actual: providers.length })
}
if (/(BEGIN (RSA|OPENSSH)|sk-[A-Za-z0-9]{20,}|[A-Za-z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY)=)/.test(payloadText)) {
  failures.push({ path: result.path, error: 'provider_registry_may_expose_secret_material' })
}

const providerSummaries = providers.map((provider) => ({
  id: provider.id,
  state: provider.state || provider.status || 'unknown',
  credential_names: provider.credential_names || [],
  role: provider.role || null,
  production_readiness: provider.production_readiness || null,
  blocker: provider.blocker || null,
  next_action: provider.next_action || null,
}))

if (failures.length) {
  console.error(JSON.stringify({
    ok: false,
    base_url: baseUrl,
    failures,
    summary: result.body?.summary || null,
    providers: providerSummaries,
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  provider_count: providers.length,
  expected_ids: expectedIds,
  summary: result.body?.summary || null,
  providers: providerSummaries,
}, null, 2))
