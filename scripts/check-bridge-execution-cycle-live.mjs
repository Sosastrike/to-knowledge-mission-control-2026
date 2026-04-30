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

const response = await fetch(`${baseUrl}/api/bridge/execution-cycle`, {
  headers: { 'x-api-key': apiKey },
  cache: 'no-store',
  signal: AbortSignal.timeout(10000),
})
const body = await response.json().catch(() => ({}))
const failures = []

if (response.status !== 200 || body?.ok !== true) failures.push({ error: 'execution_cycle_not_ok', status: response.status })
if (body?.mode !== 'agent_execution_cycle_read_only_contract') failures.push({ error: 'unexpected_mode', mode: body?.mode })
if (body?.no_execution_enabled !== true || body?.no_connector_writes_enabled !== true) failures.push({ error: 'execution_or_writes_not_locked' })
if (body?.approval_request_created === true) failures.push({ error: 'fake_approval_created' })
if (!Array.isArray(body?.required_cycle) || body.required_cycle.length !== 9) failures.push({ error: 'cycle_steps_missing', count: body?.required_cycle?.length })
if (!Array.isArray(body?.validation_checks_required) || body.validation_checks_required.length !== 10) failures.push({ error: 'validation_checks_missing', count: body?.validation_checks_required?.length })
for (const endpoint of ['/api/bridge/preflight', '/api/bridge/approval-requests', '/api/bridge/executive-report-preview', '/api/bridge/telegram-approval-preview']) {
  if (!JSON.stringify(body).includes(endpoint)) failures.push({ error: 'required_endpoint_missing', endpoint })
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, base_url: baseUrl, status: response.status, failures, body }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  mode: body.mode,
  cycle_steps: body.required_cycle.length,
  validation_checks: body.validation_checks_required.length,
  no_execution_enabled: body.no_execution_enabled,
  approval_request_created: body.approval_request_created,
  enforcement_state: body.enforcement_state,
}, null, 2))
