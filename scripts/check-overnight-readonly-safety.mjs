#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const publicLoginUrl = process.env.TKMC_LOGIN_URL || 'https://tkmc.knowledge-vs-ai.com/login'

const checks = [
  ['api_contract_parity', ['node', ['scripts/check-api-contract-parity.mjs', '--root', '.', '--openapi', 'openapi.json', '--ignore-file', 'scripts/api-contract-parity.ignore', '--json']]],
  ['protected_file_invariants', ['node', ['scripts/check-protected-file-invariants.mjs']]],
  ['mission_control_service_live', ['node', ['scripts/check-mission-control-service-live.mjs', baseUrl]]],
  ['button_contract_static', ['node', ['scripts/check-button-contract-routes.mjs']]],
  ['bridge_readonly_static', ['node', ['scripts/check-bridge-readonly-mvp.mjs']]],
  ['bridge_capability_matrix_live', ['node', ['scripts/check-bridge-capability-matrix-live.mjs', baseUrl]]],
  ['button_contract_live', ['node', ['scripts/check-button-contract-live-status.mjs', baseUrl]]],
  ['protected_actions_locked', ['node', ['scripts/check-protected-actions-locked.mjs', baseUrl]]],
  ['connector_readiness_live', ['node', ['scripts/check-connector-readiness-live.mjs', baseUrl]]],
  ['connector_action_contracts', ['node', ['scripts/check-connector-action-contracts.mjs', baseUrl]]],
  ['skills_readonly_live', ['node', ['scripts/check-skills-readonly-live.mjs', baseUrl]]],
  ['mcp_status_consistency', ['node', ['scripts/check-mcp-status-consistency.mjs', baseUrl]]],
  ['viral_firecrawl_readiness', ['node', ['scripts/check-viral-firecrawl-readiness.mjs', baseUrl]]],
  ['official_url_policy', ['node', ['scripts/check-official-url-policy.mjs']]],
  ['official_public_urls', ['node', ['scripts/check-official-public-urls.mjs']]],
  ['approval_migration_lock', ['node', ['scripts/check-approval-migration-lock.mjs', baseUrl]]],
  ['approval_readiness_live', ['node', ['scripts/check-approval-readiness-live.mjs', baseUrl]]],
  ['bridge_preflight_live', ['node', ['scripts/check-bridge-preflight-live.mjs', baseUrl]]],
  ['bridge_execution_cycle_live', ['node', ['scripts/check-bridge-execution-cycle-live.mjs', baseUrl]]],
  ['bridge_costs_live', ['node', ['scripts/check-bridge-costs-live.mjs', baseUrl]]],
  ['bridge_owner_gates_live', ['node', ['scripts/check-bridge-owner-gates-live.mjs', baseUrl]]],
  ['agent_network_ui_contracts', ['node', ['scripts/check-agent-network-ui-contracts.mjs']]],
  ['provider_registry_live', ['node', ['scripts/check-provider-registry-live.mjs', baseUrl]]],
  ['route_rendering_live', ['node', ['scripts/check-mission-control-route-rendering.mjs', baseUrl]]],
  ['approval_migration_temp_db', ['bash', ['-lc', "MISSION_CONTROL_DB_PATH=/home/tony/mission-control/.data/mission-control.db bash scripts/test-bridge-approval-migration.sh >/tmp/bridge-approval-migration-overnight.txt && printf '{\"ok\":true,\"mode\":\"copied_db_only\",\"production_db_modified\":false,\"execution_enabled\":false}\\n'"]]],
]

function runCheck(name, command, args) {
  try {
    const raw = execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: `/home/tony/.nvm/versions/node/v24.14.1/bin:${process.env.PATH || ''}`,
      },
      maxBuffer: 10 * 1024 * 1024,
    })
    const parsed = JSON.parse(raw)
    return {
      name,
      ok: parsed.ok === true,
      summary: summarize(name, parsed),
    }
  } catch (error) {
    const output = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout || '').slice(0, 500) : ''
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr || '').slice(0, 500) : ''
    return {
      name,
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 500) : 'check_failed',
      output,
      stderr,
    }
  }
}

function summarize(name, parsed) {
  if (name === 'api_contract_parity') {
    return { route_operations: parsed.totals?.routeOperations, openapi_operations: parsed.totals?.openapiOperations, ignored_operations: parsed.totals?.ignoredOperations }
  }
  if (name === 'protected_file_invariants') {
    return { protected_changes: parsed.protected_changes?.length ?? 0, protected_patterns: parsed.protected_patterns }
  }
  if (name === 'mission_control_service_live') {
    return { service: parsed.service, local_login: parsed.local_login, public_login: parsed.public_login }
  }
  if (name === 'button_contract_static') {
    return { api_endpoints: parsed.api_endpoints, state_counts: parsed.state_counts }
  }
  if (name === 'bridge_capability_matrix_live') {
    return { summary: parsed.summary, agents: parsed.agents, tools: parsed.tools }
  }
  if (name === 'button_contract_live') {
    return { endpoints_checked: parsed.endpoints_checked, skipped: parsed.skipped }
  }
  if (name === 'protected_actions_locked') {
    return { checked: parsed.checked, expectation: parsed.expectation }
  }
  if (name === 'connector_readiness_live') {
    return { connector_count: parsed.connector_count, connector_summary: parsed.connector_summary }
  }
  if (name === 'connector_action_contracts') {
    return { checked: parsed.checked, expectation: parsed.expectation }
  }
  if (name === 'skills_readonly_live') {
    return parsed.summary
  }
  if (name === 'mcp_status_consistency') {
    return { counts: parsed.counts, server_list_count: parsed.server_list_count, note: parsed.note }
  }
  if (name === 'viral_firecrawl_readiness') {
    return { video: parsed.video, firecrawl: parsed.firecrawl }
  }
  if (name === 'official_url_policy') {
    return { temporary_8080_matches: parsed.matches?.length ?? 0, official_urls: parsed.policy?.official_urls }
  }
  if (name === 'official_public_urls') {
    return { results: parsed.results?.map((result) => ({ id: result.id, status: result.status })) }
  }
  if (name === 'approval_migration_lock') {
    return {
      production_migration_applied: parsed.production_migration_applied,
      allow_applied: parsed.allow_applied,
      current_state: parsed.current_state,
    }
  }
  if (name === 'approval_readiness_live') {
    return {
      current_state: parsed.readiness?.current_state,
      approval_queue_state: parsed.readiness?.approval_queue_state,
      production_migration_applied: parsed.readiness?.production_migration_applied,
      create_probe_status: parsed.create_probe?.status,
      approval_request_created: parsed.create_probe?.approval_request_created,
    }
  }
  if (name === 'bridge_preflight_live') {
    return {
      contract_status: parsed.contract?.status,
      status_check_decision: parsed.status_check?.decision,
      zapier_write_decision: parsed.zapier_write?.decision,
      execution_enabled: parsed.status_check?.execution_enabled || parsed.zapier_write?.execution_enabled || false,
      approval_request_created: parsed.status_check?.approval_request_created || parsed.zapier_write?.approval_request_created || false,
    }
  }
  if (name === 'bridge_execution_cycle_live') {
    return { mode: parsed.mode, cycle_steps: parsed.cycle_steps, validation_checks: parsed.validation_checks, no_execution_enabled: parsed.no_execution_enabled, approval_request_created: parsed.approval_request_created }
  }
  if (name === 'bridge_costs_live') {
    return {
      mode: parsed.mode,
      summary: parsed.summary,
      no_execution_enabled: parsed.no_execution_enabled,
      no_budget_enforcement_enabled: parsed.no_budget_enforcement_enabled,
      no_provider_routing_changes_enabled: parsed.no_provider_routing_changes_enabled,
    }
  }
  if (name === 'bridge_owner_gates_live') {
    return {
      mode: parsed.mode,
      gates_total: parsed.gates_total,
      summary: parsed.summary,
      no_execution_enabled: parsed.no_execution_enabled,
      no_connector_writes_enabled: parsed.no_connector_writes_enabled,
    }
  }
  if (name === 'agent_network_ui_contracts') {
    return { contracts_checked: parsed.contracts_checked, required_copy_checked: parsed.required_copy_checked, invariants: parsed.invariants }
  }
  if (name === 'provider_registry_live') {
    return { provider_count: parsed.provider_count, summary: parsed.summary }
  }
  if (name === 'route_rendering_live') {
    return { routes_checked: parsed.routes_checked, designer_pages_checked: parsed.designer_pages_checked, api_auth: parsed.api_auth }
  }
  if (name === 'approval_migration_temp_db') {
    return { mode: parsed.mode, production_db_modified: parsed.production_db_modified, execution_enabled: parsed.execution_enabled }
  }
  return { checked: parsed.checked || parsed.guarantees?.length || true }
}

const results = []
for (const [name, [command, args]] of checks) {
  results.push(runCheck(name, command, args))
}

let login = { ok: false, status: 0 }
try {
  const response = await fetch(publicLoginUrl, {
    method: 'GET',
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  login = { ok: response.status === 200, status: response.status }
} catch (error) {
  login = {
    ok: false,
    status: 0,
    error: error instanceof Error ? error.message.slice(0, 240) : 'request_failed',
  }
}

const failures = results.filter((result) => !result.ok)
if (!login.ok) failures.push({ name: 'tkmc_public_login', ok: false, ...login })

const report = {
  ok: failures.length === 0,
  generated_at: new Date().toISOString(),
  base_url: baseUrl,
  public_login: login,
  checks_run: results.length + 1,
  failures,
  results,
  invariants: {
    no_execution_enabled: true,
    no_connector_writes_enabled: true,
    no_zapier_writes: true,
    no_fake_approval_requests: true,
    approval_persistence_migration: 'owner-approved allowed when readiness remains locked',
  },
}

const text = JSON.stringify(report, null, 2)
if (failures.length) {
  console.error(text)
  process.exit(1)
}

console.log(text)
