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

const cases = [
  {
    name: 'direct_skill_create',
    method: 'POST',
    path: '/api/skills',
    body: { source: 'project-codex', name: 'protected-action-check' },
    acceptedStatuses: [423],
  },
  {
    name: 'skill_install_request',
    method: 'POST',
    path: '/api/skills/finder/request-install',
    body: { name: 'protected-action-check' },
    acceptedStatuses: [423],
  },
  {
    name: 'video_request_run',
    method: 'POST',
    path: '/api/viral-crawl/video/request-run',
    body: { url: 'https://example.invalid/video' },
    acceptedStatuses: [423],
  },
  {
    name: 'brain_sync_rebuild',
    method: 'POST',
    path: '/api/bridge/brain-sync/rebuild',
    body: { scope: 'status-only' },
    acceptedStatuses: [423],
  },
  {
    name: 'agent_zero_request',
    method: 'POST',
    path: '/api/agent-zero/request',
    body: { task: 'status-only protected action check' },
    acceptedStatuses: [423],
  },
  {
    name: 'approval_request_create_without_persistence',
    method: 'POST',
    path: '/api/bridge/approval-requests',
    body: { connector: 'zapier', action: 'write', target: 'protected-action-check', risk_level: 'high' },
    acceptedStatuses: [423],
  },
  {
    name: 'approval_request_approve_without_persistence',
    method: 'POST',
    path: '/api/bridge/approval-requests/sample/approve',
    body: { reason: 'status-only protected action check' },
    acceptedStatuses: [423],
  },
  {
    name: 'approval_request_deny_without_persistence',
    method: 'POST',
    path: '/api/bridge/approval-requests/sample/deny',
    body: { reason: 'status-only protected action check' },
    acceptedStatuses: [423],
  },
  {
    name: 'mcp_disable_request',
    method: 'POST',
    path: '/api/mcp/servers/sample/disable',
    body: { reason: 'status-only protected action check' },
    acceptedStatuses: [423],
  },
  {
    name: 'n8n_activate_request',
    method: 'POST',
    path: '/api/n8n/workflows/sample/activate',
    body: { reason: 'status-only protected action check' },
    acceptedStatuses: [423, 503],
  },
  {
    name: 'zapier_write_approval_request',
    method: 'POST',
    path: '/api/zapier/request-write-approval',
    body: { tool: 'protected-action-check', scope: 'probe' },
    acceptedStatuses: [423],
  },
]

const results = []
const failures = []

for (const check of cases) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    method: check.method,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(check.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  }).catch((error) => ({ error }))

  if ('error' in response) {
    failures.push({ name: check.name, path: check.path, error: response.error.message })
    continue
  }

  const body = await response.json().catch(() => ({}))
  const result = {
    name: check.name,
    path: check.path,
    status: response.status,
    owner_approval_required: body.owner_approval_required === true,
    credential_required: body.credential_required === true,
    backend_required: body.backend_required === true,
    execution_enabled: body.execution_enabled === true,
    writes_enabled: body.writes_enabled === true,
    approval_request_created: body.approval_request_created === true,
  }
  results.push(result)

  if (!check.acceptedStatuses.includes(response.status)) {
    failures.push({ ...result, error: `expected ${check.acceptedStatuses.join(' or ')}` })
  }
  if (result.execution_enabled || result.writes_enabled || result.approval_request_created) {
    failures.push({ ...result, error: 'protected action unexpectedly enabled execution, writes, or approval persistence' })
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
  expectation: 'All protected action probes remain locked; no execution, writes, or approval request persistence.',
  results,
}, null, 2))
