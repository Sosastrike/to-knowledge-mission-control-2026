#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const apiKey = (process.env.MISSION_CONTROL_API_KEY || process.env.API_KEY || readApiKeyFromDb()).trim()

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
    method: init.method || 'POST',
    headers,
    body: JSON.stringify(init.body || {
      payload: {
        template_id: 'schema-readiness-probe',
        script: 'schema readiness proof only',
      },
    }),
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

const endpoint = '/api/bridge/heygen/exact-scope-proof'
const checks = [
  {
    name: 'unauthenticated_post_requires_auth',
    expectedStatuses: [401],
    request: () => request(endpoint, { auth: false }),
  },
  {
    name: 'authenticated_exact_scope_probe',
    expectedStatuses: [201, 400, 503],
    request: () => request(endpoint),
  },
]

const failures = []
const results = []

for (const check of checks) {
  const result = await check.request().catch((error) => ({
    path: endpoint,
    status: 0,
    body: { error: error instanceof Error ? error.message : String(error) },
  }))
  const body = result.body || {}
  results.push({
    name: check.name,
    path: result.path,
    status: result.status,
    mode: body.mode || null,
    required_scope: body.required_scope || null,
    blocker: body.blocker || body.error || null,
    approval_request_created: body.approval_request_created === true,
    accepted_for_execution: body.accepted_for_execution === true,
    execution_enabled: body.execution_enabled === true,
    writes_enabled: body.writes_enabled === true,
    no_heygen_generation: body.no_heygen_generation === true,
    no_zapier_writes: body.no_zapier_writes === true,
  })

  if (!check.expectedStatuses.includes(result.status)) {
    failures.push({ name: check.name, path: result.path, status: result.status, error: `expected_${check.expectedStatuses.join('_or_')}` })
  }
  if (result.status !== 401) {
    if (body.required_scope !== 'heygen.generate') failures.push({ name: check.name, path: result.path, error: 'missing_exact_scope' })
    if (body.accepted_for_execution !== false) failures.push({ name: check.name, path: result.path, error: 'accepted_for_execution' })
    if (body.execution_enabled !== false) failures.push({ name: check.name, path: result.path, error: 'execution_enabled' })
    if (body.writes_enabled !== false) failures.push({ name: check.name, path: result.path, error: 'writes_enabled' })
    if (body.no_heygen_generation !== true) failures.push({ name: check.name, path: result.path, error: 'missing_no_heygen_generation_guard' })
    if (body.no_zapier_writes !== true) failures.push({ name: check.name, path: result.path, error: 'missing_no_zapier_writes_guard' })
    if (JSON.stringify(body).match(/schema readiness proof only|\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)) {
      failures.push({ name: check.name, path: result.path, error: 'unsafe_output_pattern' })
    }
  }
}

const summary = {
  ok: failures.length === 0,
  base_url: baseUrl,
  checked: checks.length,
  expectation: 'HeyGen exact-scope proof stays behind Bridge approval and never runs generation in this lane.',
  failures,
  results,
}

if (failures.length) {
  console.error(JSON.stringify(summary, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(summary, null, 2))
