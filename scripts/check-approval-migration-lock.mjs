#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const allowApplied = process.env.ALLOW_BRIDGE_APPROVAL_MIGRATION === '1'
const apiKey = (process.env.MISSION_CONTROL_API_KEY || process.env.API_KEY || readApiKeyFromDb()).trim()

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

const response = await fetch(`${baseUrl}/api/bridge/approval-readiness`, {
  headers: { 'x-api-key': apiKey },
  cache: 'no-store',
  signal: AbortSignal.timeout(7000),
})
const body = await response.json().catch(() => ({}))

const failures = []
if (response.status !== 200 || body?.ok !== true) {
  failures.push({ path: '/api/bridge/approval-readiness', status: response.status, error: 'approval_readiness_not_ok' })
}

const migrationApplied = body?.production_migration_applied === true
if (migrationApplied && !allowApplied) {
  failures.push({
    path: '/api/bridge/approval-readiness',
    error: 'production_approval_audit_migration_is_applied_without_allow_flag',
    next_action: 'Set ALLOW_BRIDGE_APPROVAL_MIGRATION=1 only after owner explicitly approves the production migration.',
  })
}

if (body?.no_execution_enabled === false || body?.no_connector_writes_enabled === false || body?.no_fake_approval_requests !== true) {
  failures.push({
    path: '/api/bridge/approval-readiness',
    error: 'approval_readiness_invariants_not_locked',
  })
}

const report = {
  ok: failures.length === 0,
  base_url: baseUrl,
  allow_applied: allowApplied,
  production_migration_applied: migrationApplied,
  current_state: body?.current_state || 'unknown',
  approval_queue_state: body?.approval_queue_state || 'unknown',
  no_execution_enabled: body?.no_execution_enabled === true,
  no_connector_writes_enabled: body?.no_connector_writes_enabled === true,
  no_fake_approval_requests: body?.no_fake_approval_requests === true,
  failures,
}

const text = JSON.stringify(report, null, 2)
if (failures.length) {
  console.error(text)
  process.exit(1)
}

console.log(text)
