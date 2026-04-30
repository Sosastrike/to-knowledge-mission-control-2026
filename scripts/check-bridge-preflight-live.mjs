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

function preflightSummary(result) {
  const p = result.body?.preflight || result.body || {}
  return {
    status: result.status,
    mode: result.body?.mode,
    decision: p.decision,
    selected_route: p.selected_route || null,
    selected_tools: p.selected_tools || [],
    selected_models: p.selected_models || [],
    selected_skills: p.selected_skills || [],
    selected_integrations: p.selected_integrations || [],
    selected_mcps: p.selected_mcps || [],
    missing_credentials: p.missing_credentials || [],
    approval_gates: p.approval_gates || [],
    execution_enabled: p.execution_enabled === true || result.body?.execution_enabled === true,
    approval_request_created: p.approval_request_created === true || result.body?.approval_request_created === true,
    persistence: p.persistence || result.body?.persistence || null,
  }
}

const failures = []
const contract = await requestJson('/api/bridge/preflight')
const statusCheck = await requestJson('/api/bridge/preflight', {
  method: 'POST',
  body: JSON.stringify({
    task_type: 'status_check',
    agent_id: 'tony',
    owner_goal: 'Verify Mission Control status in read-only mode.',
  }),
})
const zapierWrite = await requestJson('/api/bridge/preflight', {
  method: 'POST',
  body: JSON.stringify({
    task_type: 'connector_write',
    agent_id: 'tony',
    connector: 'zapier',
    action: 'write',
    owner_goal: 'Probe protected Zapier write path without executing.',
  }),
})
const latestContract = await requestJson('/api/bridge/preflight')

if (contract.status !== 200 || contract.body?.ok !== true) {
  failures.push({ path: contract.path, status: contract.status, error: 'preflight_contract_not_ok' })
}
if (latestContract.status !== 200 || latestContract.body?.ok !== true) {
  failures.push({ path: latestContract.path, status: latestContract.status, error: 'preflight_latest_contract_not_ok' })
}

const statusSummary = preflightSummary(statusCheck)
const zapierSummary = preflightSummary(zapierWrite)

if (statusCheck.status !== 200 || statusSummary.decision !== 'ALLOWED_READ_ONLY') {
  failures.push({ path: statusCheck.path, status: statusCheck.status, decision: statusSummary.decision, error: 'status_check_not_allowed_read_only' })
}

if (zapierWrite.status !== 200 || !['CREDENTIAL_REQUIRED', 'OWNER_APPROVAL_REQUIRED'].includes(zapierSummary.decision)) {
  failures.push({ path: zapierWrite.path, status: zapierWrite.status, decision: zapierSummary.decision, error: 'zapier_write_not_blocked_by_credential_or_approval' })
}

for (const [label, summary] of [['status_check', statusSummary], ['zapier_write', zapierSummary]]) {
  if (summary.execution_enabled || summary.approval_request_created) {
    failures.push({ label, error: 'preflight_enabled_execution_or_created_approval', summary })
  }
}

const latest = latestContract.body?.ui_visibility?.latest_preflight
if (!latest || typeof latest !== 'object') {
  failures.push({ path: latestContract.path, error: 'latest_preflight_not_visible_after_post' })
} else {
  if (latest.id !== zapierWrite.body?.preflight?.id) {
    failures.push({
      path: latestContract.path,
      error: 'latest_preflight_does_not_match_last_post',
      latest_id: latest.id,
      last_post_id: zapierWrite.body?.preflight?.id,
    })
  }
  if (latest.decision !== zapierSummary.decision) {
    failures.push({
      path: latestContract.path,
      error: 'latest_preflight_decision_mismatch',
      latest_decision: latest.decision,
      last_post_decision: zapierSummary.decision,
    })
  }
  if (latest.execution_enabled === true || latest.approval_request_created === true) {
    failures.push({ path: latestContract.path, error: 'latest_preflight_enabled_execution_or_created_approval' })
  }
}

if (failures.length) {
  console.error(JSON.stringify({
    ok: false,
    base_url: baseUrl,
    failures,
    contract: { status: contract.status, mode: contract.body?.mode },
    latest_contract: { status: latestContract.status, mode: latestContract.body?.mode, ui_visibility: latestContract.body?.ui_visibility },
    status_check: statusSummary,
    zapier_write: zapierSummary,
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  expectation: 'Bridge Mode preflight selects read-only routes and blocks protected writes without execution or approval persistence.',
  contract: { status: contract.status, mode: contract.body?.mode, execution_enabled: contract.body?.execution_enabled },
  latest_visibility: {
    status: latestContract.status,
    state: latestContract.body?.ui_visibility?.state,
    latest_id: latest?.id || null,
    latest_decision: latest?.decision || null,
  },
  status_check: statusSummary,
  zapier_write: zapierSummary,
}, null, 2))
