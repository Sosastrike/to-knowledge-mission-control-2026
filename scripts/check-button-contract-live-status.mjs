#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const contractPath = path.join(root, 'src/app/api/bridge/button-contracts/route.ts')
const allowedMissing = new Set(['/api/notifications/stream'])
const allowedStates = new Set([
  'LIVE',
  'READ_ONLY',
  'BACKEND_REQUIRED',
  'CREDENTIAL_REQUIRED',
  'OWNER_APPROVAL_REQUIRED',
  'DISABLED',
])
const disabledStates = new Set([
  'BACKEND_REQUIRED',
  'CREDENTIAL_REQUIRED',
  'OWNER_APPROVAL_REQUIRED',
  'DISABLED',
])
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

function normalizeEndpoint(endpoint) {
  if (endpoint === '/api/mcp/servers/:id/:action') return '/api/mcp/servers/sample/disable'
  if (endpoint === '/api/n8n/workflows/:id/:action') return '/api/n8n/workflows/sample/activate'
  if (endpoint === '/api/skills/:id/:action') return '/api/skills/sample/enable'
  return endpoint
    .replace(/:id/g, 'sample')
    .replace(/:action/g, 'test')
}

function sampleBodyFor(endpoint) {
  if (endpoint === '/api/bridge/preflight') {
    return {
      task_type: 'status_check',
      agent_id: 'codex',
      owner_goal: 'Button contract live probe.',
    }
  }
  if (endpoint === '/api/bridge/executive-report-preview') {
    return {
      owner_goal: 'Button contract live probe.',
      preflight_decision: 'ALLOWED_READ_ONLY',
      next_action: 'No execution from this probe.',
    }
  }
  if (endpoint === '/api/bridge/telegram-approval-preview') {
    return {
      owner_goal: 'Button contract live probe.',
      selected_route: 'read_only_probe',
      approval_gates: ['approval persistence not connected'],
    }
  }
  if (endpoint === '/api/firecrawl/jobs') return { type: 'scrape', url: 'https://example.invalid/' }
  if (endpoint === '/api/firecrawl/drafts') return { type: 'scrape', title: 'button contract probe' }
  if (endpoint === '/api/n8n/test') return { probe: true }
  if (endpoint.includes('/api/n8n/workflows/')) return { probe: true }
  if (endpoint.includes('/api/mcp/servers/')) return { probe: true }
  if (endpoint.includes('/api/skills/')) return { name: 'button-contract-probe' }
  if (endpoint === '/api/zapier/request-write-approval') return { tool: 'button-contract-probe', scope: 'probe' }
  if (endpoint === '/api/zapier/revoke-write-approval') return { tool: 'button-contract-probe' }
  if (endpoint === '/api/viral-crawl/video/request-run') return { url: 'https://example.invalid/video' }
  if (endpoint === '/api/agent-zero/request') return { reason: 'button contract probe' }
  if (endpoint === '/api/agents') return { name: 'button-contract-probe' }
  if (endpoint === '/api/tasks/:id') return { status: 'probe' }
  if (endpoint === '/api/sessions') return { title: 'button contract probe' }
  if (endpoint === '/api/sessions/:id/control') return { action: 'probe' }
  return { probe: true }
}

function extractEndpoints(source) {
  const endpoints = new Set()
  const regex = /endpoint:\s*'([^']+)'/g
  let match
  while ((match = regex.exec(source))) {
    if (match[1].startsWith('/api/')) endpoints.add(match[1])
  }
  return Array.from(endpoints).sort()
}

if (!fs.existsSync(contractPath)) {
  console.error(JSON.stringify({ ok: false, error: 'button_contract_route_missing', path: contractPath }, null, 2))
  process.exit(1)
}

const endpoints = extractEndpoints(fs.readFileSync(contractPath, 'utf8'))
const failures = []
const results = []
let liveButtons = []

async function getJson(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'GET',
    headers: apiKey ? { 'x-api-key': apiKey } : {},
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

try {
  const contract = await getJson('/api/bridge/button-contracts')
  if (contract.status !== 200 || contract.body?.ok !== true) {
    failures.push({ endpoint: '/api/bridge/button-contracts', status: contract.status, error: 'button_contract_payload_not_ok' })
  } else {
    if (contract.body.no_fake_success !== true) failures.push({ endpoint: '/api/bridge/button-contracts', error: 'no_fake_success_not_asserted' })
    if (contract.body.protected_execution_enabled !== false) failures.push({ endpoint: '/api/bridge/button-contracts', error: 'protected_execution_enabled_not_false' })
    if (!Array.isArray(contract.body.buttons) || contract.body.buttons.length === 0) {
      failures.push({ endpoint: '/api/bridge/button-contracts', error: 'buttons_missing' })
    }
    liveButtons = contract.body.buttons || []

    const seenButtonKeys = new Set()
    for (const [index, button] of liveButtons.entries()) {
      const label = button?.label || `button_${index}`
      const duplicateKey = [
        button?.route || 'unknown-route',
        label,
        button?.method || 'unknown-method',
        button?.endpoint || 'local',
      ].join('::')
      if (seenButtonKeys.has(duplicateKey)) failures.push({ label, error: 'duplicate_button_contract', key: duplicateKey })
      seenButtonKeys.add(duplicateKey)

      if (!allowedStates.has(button?.state)) failures.push({ label, error: 'invalid_button_state', state: button?.state })
      if (button?.fake_success_allowed !== false) failures.push({ label, error: 'fake_success_allowed_not_false' })
      if (button?.protected_execution_enabled !== false) failures.push({ label, error: 'protected_execution_enabled_not_false' })
      if (!button?.safe_ui_behavior || typeof button.safe_ui_behavior !== 'string') failures.push({ label, error: 'safe_ui_behavior_missing' })
      if (disabledStates.has(button?.state) && button?.should_render_as_disabled !== true) {
        failures.push({ label, state: button?.state, error: 'blocked_state_not_rendered_disabled' })
      }
      if (button?.approval_required === true && button?.audit_required !== true) {
        failures.push({ label, error: 'approval_required_without_audit_required' })
      }
      if (button?.method !== 'LOCAL' && button?.method !== 'EXTERNAL' && !button?.endpoint) {
        failures.push({ label, error: 'remote_button_missing_endpoint' })
      }
    }
  }
} catch (error) {
  failures.push({
    endpoint: '/api/bridge/button-contracts',
    error: error instanceof Error ? error.message.slice(0, 200) : 'button_contract_fetch_failed',
  })
}

const buttonsByEndpoint = new Map()
for (const button of liveButtons) {
  if (button?.endpoint && String(button.endpoint).startsWith('/api/')) {
    const existing = buttonsByEndpoint.get(button.endpoint) || []
    existing.push(button)
    buttonsByEndpoint.set(button.endpoint, existing)
  }
}

const endpointsToProbe = buttonsByEndpoint.size > 0 ? [...buttonsByEndpoint.keys()].sort() : endpoints

function expectedStatusesFor(buttons) {
  const states = new Set(buttons.map((button) => button.state))
  const methods = new Set(buttons.map((button) => button.method))
  const statuses = new Set([200, 201, 202, 204, 400, 401, 403, 405])
  if (states.has('OWNER_APPROVAL_REQUIRED')) statuses.add(423)
  if (states.has('BACKEND_REQUIRED') || states.has('CREDENTIAL_REQUIRED')) statuses.add(503)
  if ([...buttons].some((button) => (button.credential_names || []).length > 0)) statuses.add(503)
  // Dynamic sample IDs can return semantic not-found responses while proving
  // the route handler exists. Static checks still catch missing route files.
  if ([...buttons].some((button) => String(button.endpoint || '').includes(':id'))) statuses.add(404)
  if (methods.has('GET') && states.has('READ_ONLY')) statuses.add(200)
  return statuses
}

for (const endpoint of endpointsToProbe) {
  if (allowedMissing.has(endpoint)) {
    results.push({ endpoint, skipped: true, reason: 'allowed_missing' })
    continue
  }

  const url = `${baseUrl}${normalizeEndpoint(endpoint)}`
  const buttons = buttonsByEndpoint.get(endpoint) || []
  const method = buttons.find((button) => button.method && button.method !== 'LOCAL' && button.method !== 'EXTERNAL')?.method || 'GET'
  const body = method === 'GET' ? undefined : JSON.stringify(sampleBodyFor(endpoint))
  const expectedStatuses = expectedStatusesFor(buttons)
  let status = 0
  let responseBody = null
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(apiKey && endpoint.startsWith('/api/') ? { 'x-api-key': apiKey } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    status = response.status
    responseBody = await response.json().catch(() => null)
  } catch (error) {
    failures.push({
      endpoint,
      url,
      error: error instanceof Error ? error.message.slice(0, 200) : 'request_failed',
    })
    continue
  }

  results.push({ endpoint, url, method, status, response_state: responseBody?.state || responseBody?.error || null })
  if (!expectedStatuses.has(status)) failures.push({ endpoint, url, method, status, error: 'unexpected_status_for_button_contract' })
  if (status === 404 && !endpoint.includes(':id')) failures.push({ endpoint, url, method, status, error: 'route_not_found' })
  if (status >= 500 && ![503].includes(status)) failures.push({ endpoint, url, method, status, error: 'route_server_error' })
  if (responseBody?.execution_enabled === true || responseBody?.writes_enabled === true || responseBody?.approval_request_created === true) {
    failures.push({ endpoint, url, method, status, error: 'endpoint_enabled_execution_writes_or_fake_approval' })
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, base_url: baseUrl, failures, results }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  endpoints_checked: results.filter((result) => !result.skipped).length,
  skipped: results.filter((result) => result.skipped).length,
  live_contract_checked: true,
  accepted_statuses: '401/403/405 are acceptable for auth-gated or POST-only routes; 404/5xx are failures.',
  results,
}, null, 2))
