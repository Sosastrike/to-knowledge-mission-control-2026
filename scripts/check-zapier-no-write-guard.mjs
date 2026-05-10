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
    ...(apiKey ? { 'x-api-key': apiKey, cookie: 'mc-session=runtime-smoke-proxy-pass' } : {}),
    ...(init.headers || {}),
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
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

const checks = [
  {
    name: 'write_approval_send_mail',
    expectedStatus: 423,
    requireGuard: true,
    request: () => request('/api/zapier/request-write-approval', {
      method: 'POST',
      body: { tool: 'send_mail', scope: 'probe' },
    }),
  },
  {
    name: 'write_classified_test_read',
    expectedStatus: 423,
    requireGuard: true,
    request: () => request('/api/zapier/test-read', {
      method: 'POST',
      body: { tool: 'send_mail' },
    }),
  },
  {
    name: 'read_invocation_stays_backend_locked',
    expectedStatus: 503,
    requireGuard: true,
    request: () => request('/api/zapier/test-read', {
      method: 'POST',
      body: { tool: 'list_records' },
    }),
  },
  {
    name: 'revoke_without_backend_stays_locked',
    expectedStatus: 503,
    requireGuard: true,
    request: () => request('/api/zapier/revoke-write-approval', {
      method: 'POST',
      body: { tool: 'send_mail' },
    }),
  },
  {
    name: 'bridge_tools_reject_post',
    expectedStatus: 405,
    request: () => request('/api/bridge/zapier/tools', {
      method: 'POST',
      body: { tool: 'send_mail' },
    }),
  },
  {
    name: 'bridge_search_reject_post',
    expectedStatus: 405,
    request: () => request('/api/bridge/zapier/tools/search?q=heygen', {
      method: 'POST',
      body: { tool: 'heygen_create_video' },
    }),
  },
]

const results = []
const failures = []

for (const check of checks) {
  const result = await check.request().catch((error) => ({
    path: 'unknown',
    status: 0,
    body: { error: error instanceof Error ? error.message : String(error) },
  }))
  results.push({
    name: check.name,
    path: result.path,
    status: result.status,
    owner_approval_required: result.body?.owner_approval_required === true,
    backend_required: result.body?.backend_required === true,
    accepted_for_execution: result.body?.accepted_for_execution === true,
    execution_enabled: result.body?.execution_enabled === true,
    writes_enabled: result.body?.writes_enabled === true,
    no_zapier_writes: result.body?.no_zapier_writes === true,
    approval_request_created: result.body?.approval_request_created === true,
    blocker: result.body?.blocker || result.body?.error || null,
  })

  if (result.status !== check.expectedStatus) {
    failures.push({ name: check.name, path: result.path, status: result.status, error: `expected_${check.expectedStatus}` })
  }
  if (result.body?.accepted_for_execution === true || result.body?.execution_enabled === true || result.body?.writes_enabled === true || result.body?.approval_request_created === true) {
    failures.push({ name: check.name, path: result.path, error: 'zapier_write_or_execution_enabled' })
  }
  if (check.requireGuard && result.body?.no_zapier_writes !== true) {
    failures.push({ name: check.name, path: result.path, error: 'missing_no_zapier_writes_guard' })
  }
}

const summary = {
  ok: failures.length === 0,
  base_url: baseUrl,
  checked: checks.length,
  expectation: 'Zapier write/action paths remain non-executable, non-writing, and non-persistent without exact owner approval and Bridge Session scope.',
  failures,
  results,
}

if (failures.length) {
  console.error(JSON.stringify(summary, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(summary, null, 2))
