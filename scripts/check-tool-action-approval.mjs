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

const endpoint = '/api/bridge/tool-action-approval'
const checks = [
  {
    name: 'unauthenticated_post_requires_auth',
    expectedStatuses: [401],
    request: () => request(endpoint, {
      auth: false,
      body: { connector: 'agentmail', action: 'send', target: 'owner@example.com' },
    }),
  },
  {
    name: 'zapier_write_preview',
    expectedStatuses: [200],
    expectedScope: 'zapier.write',
    request: () => request(endpoint, {
      body: {
        connector: 'zapier',
        tool: 'mcp__zapier__gmail_send_email',
        action: 'send email',
        dry_run: true,
        payload: { subject: 'Day 50 proof', body: 'tool action proof body must not echo' },
      },
    }),
  },
  {
    name: 'heygen_generation_preview',
    expectedStatuses: [200],
    expectedScope: 'heygen.generate',
    request: () => request(endpoint, {
      body: {
        connector: 'zapier',
        tool: 'mcp__zapier__heygen_create_a_video_from_template',
        action: 'generate video',
        dry_run: true,
        payload: { template_id: 'proof', script: 'tool action proof script must not echo' },
      },
    }),
  },
  {
    name: 'agentmail_send_preview',
    expectedStatuses: [200],
    expectedScope: 'agentmail.send',
    request: () => request(endpoint, {
      body: {
        connector: 'agentmail',
        action: 'send',
        target: 'owner@example.com',
        dry_run: true,
        payload: { subject: 'Day 50 proof', body: 'agentmail proof body must not echo' },
      },
    }),
  },
  {
    name: 'unsupported_scope_blocked',
    expectedStatuses: [400],
    expectedScope: null,
    request: () => request(endpoint, {
      body: { connector: 'unknown', action: 'execute every connector write', dry_run: true },
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
  const summary = {
    name: check.name,
    path: result.path,
    status: result.status,
    mode: body.mode || null,
    canonical_status: body.canonical_status || null,
    required_scope: body.required_scope || null,
    blocker: body.blocker || body.error || null,
    approval_request_created: body.approval_request_created === true,
    accepted_for_execution: body.accepted_for_execution === true,
    execution_enabled: body.execution_enabled === true,
    writes_enabled: body.writes_enabled === true,
    no_zapier_writes: body.no_zapier_writes === true,
    no_heygen_generation: body.no_heygen_generation === true,
  }
  results.push(summary)

  if (!check.expectedStatuses.includes(result.status)) {
    failures.push({ ...summary, error: `expected_http_${check.expectedStatuses.join('_or_')}` })
  }

  if (result.status !== 401) {
    if ((check.expectedScope || null) !== (body.required_scope || null)) {
      failures.push({ ...summary, error: `unexpected_scope_${body.required_scope || 'null'}` })
    }
    if (body.accepted_for_execution !== false) failures.push({ ...summary, error: 'accepted_for_execution' })
    if (body.execution_enabled !== false) failures.push({ ...summary, error: 'execution_enabled' })
    if (body.writes_enabled !== false) failures.push({ ...summary, error: 'writes_enabled' })
    if (body.approval_request_created !== false) failures.push({ ...summary, error: 'approval_created_during_preview' })
    if (JSON.stringify(body).match(/proof body must not echo|proof script must not echo|\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)) {
      failures.push({ ...summary, error: 'unsafe_output_pattern' })
    }
  }
}

const summary = {
  ok: failures.length === 0,
  base_url: baseUrl,
  checked: checks.length,
  expectation: 'External tool actions resolve to exact Bridge approval scopes, stay non-executable, and do not create preview approval rows.',
  failures,
  results,
}

if (failures.length) {
  console.error(JSON.stringify(summary, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(summary, null, 2))
