#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
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

const response = await fetch(`${baseUrl}/api/bridge/costs`, {
  headers: { 'x-api-key': apiKey },
  cache: 'no-store',
  signal: AbortSignal.timeout(7000),
})
const body = await response.json().catch(() => ({}))

const failures = []
if (response.status !== 200) failures.push({ status: response.status, error: 'costs_endpoint_not_200' })
if (body?.mode !== 'bridge_cost_rate_read_only') failures.push({ mode: body?.mode, error: 'unexpected_costs_mode' })
if (body?.no_execution_enabled !== true) failures.push({ error: 'costs_execution_not_locked' })
if (body?.no_budget_enforcement_enabled !== true) failures.push({ error: 'budget_enforcement_should_not_be_enabled' })
if (body?.no_provider_routing_changes_enabled !== true) failures.push({ error: 'provider_routing_changes_should_be_locked' })
if (!body?.governance?.approval_required_for?.includes('provider routing changes')) {
  failures.push({ error: 'provider_routing_approval_gate_missing' })
}
if (!body?.rate_limits?.no_autonomous_expensive_loops) {
  failures.push({ error: 'expensive_loop_guard_missing' })
}
if (typeof body?.summary?.total_tokens !== 'number') failures.push({ error: 'missing_total_tokens_summary' })
if (typeof body?.summary?.estimated_cost !== 'number') failures.push({ error: 'missing_estimated_cost_summary' })

const report = {
  ok: failures.length === 0,
  base_url: baseUrl,
  status: response.status,
  mode: body?.mode,
  summary: body?.summary || null,
  no_execution_enabled: body?.no_execution_enabled === true,
  no_budget_enforcement_enabled: body?.no_budget_enforcement_enabled === true,
  no_provider_routing_changes_enabled: body?.no_provider_routing_changes_enabled === true,
  failures,
}

const text = JSON.stringify(report, null, 2)
if (failures.length) {
  console.error(text)
  process.exit(1)
}

console.log(text)
