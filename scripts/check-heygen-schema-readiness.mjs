#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const apiKey = (process.env.MISSION_CONTROL_API_KEY || process.env.API_KEY || readApiKeyFromDb()).trim()
const allowedStatuses = new Set(['LIVE', 'READY', 'OWNER_GATED', 'CREDENTIAL_GATED', 'SERVICE_DOWN', 'BLOCKED', 'DISABLED'])

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

async function request(path, init = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(init.auth === false || !apiKey ? {} : {
      'x-api-key': apiKey,
      cookie: 'mc-session=runtime-smoke-proxy-pass',
    }),
    ...(init.headers || {}),
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method || 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const text = await response.text()
  let body = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text.slice(0, 200) }
  }
  return { path, status: response.status, body }
}

const endpoint = '/api/bridge/heygen/schema-readiness'
const checks = [
  {
    name: 'unauthenticated_get_requires_auth',
    expectStatus: 401,
    request: () => request(endpoint, { auth: false }),
  },
  {
    name: 'authenticated_get_readiness',
    expectStatus: 200,
    request: () => request(endpoint),
  },
  {
    name: 'invalid_payload_stays_non_executable',
    expectStatus: 200,
    request: () => request(endpoint, {
      method: 'POST',
      body: { payload: { template_id: 'schema-readiness-probe' } },
    }),
  },
]

const failures = []
const results = []

function checkReadiness(name, result) {
  const body = result.body || {}
  if (body.ok !== true) failures.push({ name, path: result.path, error: 'readiness_not_ok' })
  if (!allowedStatuses.has(body.canonical_status)) {
    failures.push({ name, path: result.path, error: 'missing_or_invalid_canonical_status', canonical_status: body.canonical_status })
  }
  if (body.accepted_for_generation !== false) failures.push({ name, path: result.path, error: 'generation_accepted' })
  if (body.execution_enabled !== false) failures.push({ name, path: result.path, error: 'execution_enabled' })
  if (body.writes_enabled !== false) failures.push({ name, path: result.path, error: 'writes_enabled' })
  if (body.no_heygen_generation !== true) failures.push({ name, path: result.path, error: 'missing_no_heygen_generation_guard' })
  if (body.no_zapier_writes !== true) failures.push({ name, path: result.path, error: 'missing_no_zapier_writes_guard' })
  if (body.bridge_session_required !== true) failures.push({ name, path: result.path, error: 'missing_bridge_session_gate' })
  if (body.approval_required_for_generation !== true) failures.push({ name, path: result.path, error: 'missing_approval_gate' })
  if (JSON.stringify(body).match(/\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)) {
    failures.push({ name, path: result.path, error: 'unsafe_output_pattern' })
  }
}

for (const check of checks) {
  const result = await check.request().catch((error) => ({
    path: endpoint,
    status: 0,
    body: { error: error instanceof Error ? error.message : String(error) },
  }))
  results.push({
    name: check.name,
    path: result.path,
    status: result.status,
    canonical_status: result.body?.canonical_status || null,
    blocker_class: result.body?.blocker_class || null,
    blocker: result.body?.blocker || result.body?.error || null,
    schema_available: result.body?.schema_available === true,
    payload_valid: result.body?.payload_valid ?? null,
    accepted_for_generation: result.body?.accepted_for_generation === true,
    execution_enabled: result.body?.execution_enabled === true,
    writes_enabled: result.body?.writes_enabled === true,
    no_heygen_generation: result.body?.no_heygen_generation === true,
  })

  if (result.status !== check.expectStatus) {
    failures.push({ name: check.name, path: result.path, status: result.status, error: `expected_${check.expectStatus}` })
  }
  if (check.expectStatus === 200) checkReadiness(check.name, result)
}

const summary = {
  ok: failures.length === 0,
  base_url: baseUrl,
  checked: checks.length,
  expectation: 'HeyGen schema readiness is read-only and never generates video without exact Bridge Session approval.',
  failures,
  results,
}

if (failures.length) {
  console.error(JSON.stringify(summary, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(summary, null, 2))
