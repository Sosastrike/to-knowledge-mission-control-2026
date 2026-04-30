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

async function requestJson(path, init = {}) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        ...(init.headers || {}),
      },
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

const failures = []
const readiness = await requestJson('/api/bridge/approval-readiness')
const queue = await requestJson('/api/bridge/approval-requests')

if (readiness.status !== 200 || readiness.body?.ok !== true) {
  failures.push({ path: readiness.path, status: readiness.status, error: 'approval_readiness_not_ok' })
}
if (queue.status !== 200 || queue.body?.ok !== true) {
  failures.push({ path: queue.path, status: queue.status, error: 'approval_queue_not_ok' })
}

for (const [label, result] of [['readiness', readiness], ['queue', queue]]) {
  const body = result.body || {}
  if (body.no_execution_enabled === false || body.no_connector_writes_enabled === false) {
    failures.push({ label, path: result.path, error: 'approval_surface_enabled_execution_or_connector_writes' })
  }
}

if (readiness.body?.no_fake_approval_requests !== true) {
  failures.push({ path: readiness.path, error: 'readiness_does_not_assert_no_fake_approval_requests' })
}

if (queue.body?.ui_placeholder?.no_fake_approval_requests !== true || queue.body?.ui_placeholder?.approval_request_created !== false) {
  failures.push({ path: queue.path, error: 'queue_placeholder_does_not_assert_no_fake_approval_requests' })
}

let createProbe = { skipped: true, reason: 'production migration is present; creation probe skipped to avoid writing approval rows' }
if (readiness.body?.production_migration_applied !== true) {
  createProbe = await requestJson('/api/bridge/approval-requests', {
    method: 'POST',
    body: JSON.stringify({
      connector: 'codex-smoke-test',
      action: 'protected_action_probe',
      protected_category: 'tooling',
      risk_level: 'high',
      reason: 'Smoke test must remain locked when approval persistence is not applied.',
    }),
  })
  if (createProbe.status !== 423) {
    failures.push({ path: createProbe.path, status: createProbe.status, error: 'approval_create_probe_not_locked' })
  }
  if (createProbe.body?.execution_enabled === true || createProbe.body?.approval_request_created === true) {
    failures.push({ path: createProbe.path, error: 'approval_create_probe_enabled_execution_or_created_request' })
  }
}

if (failures.length) {
  console.error(JSON.stringify({
    ok: false,
    base_url: baseUrl,
    failures,
    readiness: {
      status: readiness.status,
      mode: readiness.body?.mode,
      production_migration_applied: readiness.body?.production_migration_applied,
      current_state: readiness.body?.current_state,
    },
    queue: {
      status: queue.status,
      mode: queue.body?.mode,
      approval_queue_connected: queue.body?.approval_queue_connected,
      summary: queue.body?.summary,
    },
    create_probe: createProbe,
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  expectation: 'Approval/audit surfaces remain read-only; no execution, connector writes, or fake approval persistence.',
  readiness: {
    status: readiness.status,
    mode: readiness.body?.mode,
    production_migration_applied: readiness.body?.production_migration_applied,
    current_state: readiness.body?.current_state,
    approval_queue_state: readiness.body?.approval_queue_state,
  },
  queue: {
    status: queue.status,
    mode: queue.body?.mode,
    approval_queue_connected: queue.body?.approval_queue_connected,
    summary: queue.body?.summary,
    placeholder_state: queue.body?.ui_placeholder?.state,
  },
  create_probe: createProbe.skipped ? createProbe : {
    status: createProbe.status,
    owner_approval_required: createProbe.body?.owner_approval_required === true,
    execution_enabled: createProbe.body?.execution_enabled === true,
    approval_request_created: createProbe.body?.approval_request_created === true,
  },
}, null, 2))
