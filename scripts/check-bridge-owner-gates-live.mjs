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

const response = await fetch(`${baseUrl}/api/bridge/owner-gates`, {
  headers: { 'x-api-key': apiKey },
  cache: 'no-store',
  signal: AbortSignal.timeout(7000),
})
const body = await response.json().catch(() => ({}))
const gates = Array.isArray(body.gates) ? body.gates : []
const failures = []
const expectedIds = [
  'approval_audit_migration',
  'persistent_approval_queue',
  'telegram_one_click_approval',
  'connector_execution_runners',
  'firecrawl_mission_control_setup',
  'zapier_mcp_setup_and_writes',
  'n8n_setup_and_workflow_execution',
  'microsoft_365_secret_path',
  'cleanup_quarantine',
]
const ids = gates.map((gate) => gate.id)

if (response.status !== 200 || body.ok !== true) failures.push({ error: 'owner_gates_not_ok', status: response.status })
for (const id of expectedIds) {
  if (!ids.includes(id)) failures.push({ error: 'missing_owner_gate', id })
}
if (body.no_execution_enabled !== true || body.no_connector_writes_enabled !== true) {
  failures.push({ error: 'owner_gates_execution_not_locked' })
}
if (body.no_secret_values_exposed !== true) failures.push({ error: 'owner_gates_secret_flag_missing' })
if (body.production_db_migration_applied !== false) failures.push({ error: 'owner_gates_claims_migration_applied' })
if ((body.summary?.execution_enabled ?? 0) !== 0 || (body.summary?.writes_enabled ?? 0) !== 0) {
  failures.push({ error: 'owner_gates_summary_enables_execution_or_writes', summary: body.summary })
}
for (const gate of gates) {
  if (gate.execution_enabled !== false || gate.writes_enabled !== false) {
    failures.push({ error: 'gate_enables_execution_or_writes', id: gate.id })
  }
}

const payloadText = JSON.stringify(body)
if (/(BEGIN (RSA|OPENSSH)|sk-[A-Za-z0-9]{20,}|[A-Za-z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY)=)/.test(payloadText)) {
  failures.push({ error: 'owner_gates_may_expose_secret_material' })
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, base_url: baseUrl, failures, summary: body.summary || null }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  mode: body.mode,
  gates_total: gates.length,
  summary: body.summary,
  no_execution_enabled: body.no_execution_enabled,
  no_connector_writes_enabled: body.no_connector_writes_enabled,
}, null, 2))
