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
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method || 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init.auth === false || !apiKey ? {} : {
        'x-api-key': apiKey,
        cookie: 'mc-session=runtime-smoke-proxy-pass',
      }),
      ...(init.headers || {}),
    },
    body: JSON.stringify(init.body || {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const text = await response.text()
  let body = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text.slice(0, 240) }
  }
  return { path, status: response.status, body }
}

const endpoint = '/api/bridge/tool-error-classifier'
const checks = [
  {
    name: 'unauthenticated_post_requires_auth',
    expectedStatuses: [401],
    request: () => request(endpoint, { auth: false, body: { http_status: 404 } }),
  },
  {
    name: 'canonical_error_batch',
    expectedStatuses: [200],
    expectedKinds: ['SERVICE_DOWN', 'AUTH_REQUIRED', 'CREDENTIAL_GATED', 'BACKEND_MISSING'],
    request: () => request(endpoint, {
      body: {
        errors: [
          {
            http_status: 503,
            message: 'connect ECONNREFUSED http://127.0.0.1:9999',
            technical_detail: 'service failed with API_KEY=secret-value at /Users/sosastrike/private',
          },
          { http_status: 401, message: 'authentication required' },
          { message: 'missing FIRECRAWL_API_KEY' },
          { message: 'adapter not implemented yet' },
        ],
      },
    }),
  },
  {
    name: 'owner_gated_single_error',
    expectedStatuses: [200],
    expectedKinds: ['OWNER_GATED'],
    request: () => request(endpoint, {
      body: { http_status: 423, message: 'owner approval required' },
    }),
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
  const kinds = Array.isArray(body.classifications)
    ? body.classifications.map((item) => item.kind)
    : []
  const summary = {
    name: check.name,
    path: result.path,
    status: result.status,
    mode: body.mode || null,
    kinds,
    execution_enabled: body.execution_enabled === true,
    writes_enabled: body.writes_enabled === true,
    external_writes_enabled: body.external_writes_enabled === true,
    no_secret_output: body.no_secret_output === true,
  }
  results.push(summary)

  if (!check.expectedStatuses.includes(result.status)) {
    failures.push({ ...summary, error: `expected_http_${check.expectedStatuses.join('_or_')}` })
  }

  if (result.status !== 401) {
    for (const kind of check.expectedKinds || []) {
      if (!kinds.includes(kind)) failures.push({ ...summary, error: `missing_kind_${kind}` })
    }
    if (body.execution_enabled !== false) failures.push({ ...summary, error: 'execution_enabled' })
    if (body.writes_enabled !== false) failures.push({ ...summary, error: 'writes_enabled' })
    if (body.external_writes_enabled !== false) failures.push({ ...summary, error: 'external_writes_enabled' })
    if (JSON.stringify(body).match(/secret-value|\/Users\/sosastrike|127\.0\.0\.1|Bearer\s+[A-Za-z0-9._-]{8,}|sk-[A-Za-z0-9_-]{20,}/)) {
      failures.push({ ...summary, error: 'unsafe_output_pattern' })
    }
  }
}

const summary = {
  ok: failures.length === 0,
  base_url: baseUrl,
  checked: checks.length,
  expectation: 'Tool errors classify into canonical owner-facing blockers with no secret, raw path, or private-host leakage.',
  failures,
  results,
}

if (failures.length) {
  console.error(JSON.stringify(summary, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(summary, null, 2))
