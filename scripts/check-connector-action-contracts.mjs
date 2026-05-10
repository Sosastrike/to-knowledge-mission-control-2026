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

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method || 'GET',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      cookie: 'mc-session=runtime-smoke-proxy-pass',
      ...(init.headers || {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  const body = await response.json().catch(() => ({}))
  return { path, status: response.status, body }
}

const cases = [
  {
    name: 'zapier_tools_inventory',
    path: '/api/zapier/tools',
    method: 'GET',
    acceptedStatuses: [200],
    requireNoExecution: true,
  },
  {
    name: 'firecrawl_job_request',
    path: '/api/firecrawl/jobs',
    method: 'POST',
    body: { type: 'crawl', url: 'https://example.invalid/', format: 'markdown' },
    acceptedStatuses: [503],
    acceptedBlockers: ['credential_required', 'backend_required'],
    requireNoExecution: true,
  },
  {
    name: 'n8n_workflow_inventory',
    path: '/api/n8n/workflows',
    method: 'GET',
    acceptedStatuses: [503],
    acceptedBlockers: ['credential_required', 'backend_required'],
    requireNoExecution: true,
  },
  {
    name: 'n8n_workflow_execute',
    path: '/api/n8n/workflows/sample/execute',
    method: 'POST',
    body: {},
    acceptedStatuses: [423, 503],
    acceptedBlockers: ['credential_required', 'owner_approval_required'],
    requireNoExecution: true,
  },
  {
    name: 'viral_crawl_video_run',
    path: '/api/viral-crawl/video/request-run',
    method: 'POST',
    body: { url: 'https://example.invalid/video' },
    acceptedStatuses: [423],
    acceptedBlockers: ['owner_approval_required'],
    requireNoExecution: true,
  },
  {
    name: 'skill_install_request',
    path: '/api/skills/finder/request-install',
    method: 'POST',
    body: { name: 'connector-action-contract-check' },
    acceptedStatuses: [423],
    acceptedBlockers: ['owner_approval_required'],
    requireNoExecution: true,
  },
]

const failures = []
const results = []

for (const test of cases) {
  const result = await request(test.path, { method: test.method, body: test.body }).catch((error) => ({
    path: test.path,
    status: 0,
    body: {},
    error: error instanceof Error ? error.message : 'request_failed',
  }))

  const blocker =
    result.body?.credential_required === true ? 'credential_required' :
    result.body?.owner_approval_required === true ? 'owner_approval_required' :
    result.body?.backend_required === true ? 'backend_required' :
    result.body?.state || result.body?.status || 'none'

  const summary = {
    name: test.name,
    path: test.path,
    status: result.status,
    blocker,
    execution_enabled: result.body?.execution_enabled === true,
    writes_enabled: result.body?.writes_enabled === true,
    approval_request_created: result.body?.approval_request_created === true,
  }
  results.push(summary)

  if (result.error) failures.push({ ...summary, error: result.error })
  if (!test.acceptedStatuses.includes(result.status)) {
    failures.push({ ...summary, error: `expected_http_${test.acceptedStatuses.join('_or_')}` })
  }
  if (test.acceptedBlockers && !test.acceptedBlockers.includes(blocker)) {
    failures.push({ ...summary, error: `unexpected_blocker_${blocker}` })
  }
  if (test.requireNoExecution && (summary.execution_enabled || summary.writes_enabled || summary.approval_request_created)) {
    failures.push({ ...summary, error: 'unexpected_execution_writes_or_approval_persistence' })
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, base_url: baseUrl, failures, results }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  checked: results.length,
  expectation: 'Connector action contracts block execution safely: credentials are required first, otherwise owner approval/HTTP 423 or backend-required placeholders are returned. No writes or fake approval persistence.',
  results,
}, null, 2))
