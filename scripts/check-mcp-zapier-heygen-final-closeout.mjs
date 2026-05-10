#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const outputPath = process.argv[3] || ''
const apiKey = (process.env.MISSION_CONTROL_API_KEY || process.env.API_KEY || readApiKeyFromDb()).trim()
const allowedStatuses = new Set(['LIVE', 'READY', 'OWNER_GATED', 'CREDENTIAL_GATED', 'SERVICE_DOWN', 'BLOCKED', 'DISABLED'])

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
  const headers = {
    'content-type': 'application/json',
    ...(init.auth === false || !apiKey ? {} : {
      'x-api-key': apiKey,
      cookie: 'mc-session=runtime-smoke-proxy-pass',
    }),
    ...(init.headers || {}),
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method || 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(init.timeout || 30000),
  })
  const text = await response.text()
  let body = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text.slice(0, 240) }
  }
  return { path, status: response.status, body }
}

function unsafeOutput(value) {
  return /\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}/
    .test(JSON.stringify(value))
}

function requireStatus(failures, name, result, expected) {
  if (!expected.includes(result.status)) {
    failures.push({ name, path: result.path, status: result.status, error: `expected_${expected.join('_or_')}` })
  }
}

function requireCanonical(failures, name, result) {
  const status = result.body?.canonical_status
  if (!allowedStatuses.has(status)) {
    failures.push({ name, path: result.path, error: 'missing_or_invalid_canonical_status', canonical_status: status })
  }
}

function requireReadOnly(failures, name, result, extra = {}) {
  const body = result.body || {}
  if (body.accepted_for_execution === true) failures.push({ name, path: result.path, error: 'accepted_for_execution' })
  if (body.execution_enabled === true) failures.push({ name, path: result.path, error: 'execution_enabled' })
  if (body.writes_enabled === true) failures.push({ name, path: result.path, error: 'writes_enabled' })
  if (body.approval_request_created === true && extra.allowApprovalRow !== true) {
    failures.push({ name, path: result.path, error: 'unexpected_approval_request_created' })
  }
  if (unsafeOutput(body)) failures.push({ name, path: result.path, error: 'unsafe_output_pattern' })
}

const checks = [
  {
    name: 'mcp_status_unauth_requires_auth',
    expected: [401],
    run: () => request('/api/mcp/status', { auth: false }),
  },
  {
    name: 'mcp_status_summary',
    expected: [200],
    canonical: true,
    readOnly: true,
    run: () => request('/api/mcp/status'),
  },
  {
    name: 'mcp_server_registry',
    expected: [200],
    canonical: true,
    readOnly: true,
    run: () => request('/api/mcp/servers'),
  },
  {
    name: 'zapier_bridge_status',
    expected: [200],
    canonical: true,
    readOnly: true,
    requireZapierGuard: true,
    run: () => request('/api/bridge/zapier/status'),
  },
  {
    name: 'zapier_bridge_tools',
    expected: [200],
    canonical: true,
    readOnly: true,
    requireZapierGuard: true,
    requireEmptyInventoryBlocker: true,
    run: () => request('/api/bridge/zapier/tools'),
  },
  {
    name: 'zapier_heygen_search',
    expected: [200],
    canonical: true,
    readOnly: true,
    requireZapierGuard: true,
    requireEmptyInventoryBlocker: true,
    run: () => request('/api/bridge/zapier/tools/search?q=heygen'),
  },
  {
    name: 'zapier_write_guard',
    expected: [423],
    readOnly: true,
    requireZapierGuard: true,
    run: () => request('/api/zapier/request-write-approval', {
      method: 'POST',
      body: { tool: 'send_mail', scope: 'day52_final_closeout' },
    }),
  },
  {
    name: 'zapier_read_invocation_locked',
    expected: [503],
    readOnly: true,
    requireZapierGuard: true,
    run: () => request('/api/zapier/test-read', {
      method: 'POST',
      body: { tool: 'list_records' },
    }),
  },
  {
    name: 'heygen_schema_readiness',
    expected: [200],
    canonical: true,
    readOnly: true,
    requireZapierGuard: true,
    requireHeyGenGuard: true,
    run: () => request('/api/bridge/heygen/schema-readiness'),
  },
  {
    name: 'heygen_exact_scope_proof',
    expected: [201, 400, 503],
    readOnly: true,
    requireZapierGuard: true,
    requireHeyGenGuard: true,
    requireScope: 'heygen.generate',
    run: () => request('/api/bridge/heygen/exact-scope-proof', {
      method: 'POST',
      body: {
        payload: {
          template_id: 'schema-readiness-probe',
          script: 'day52 proof only',
        },
      },
    }),
  },
  {
    name: 'tool_action_approval_heygen_preview',
    expected: [200],
    canonical: true,
    readOnly: true,
    requireZapierGuard: true,
    requireHeyGenGuard: true,
    requireScope: 'heygen.generate',
    run: () => request('/api/bridge/tool-action-approval', {
      method: 'POST',
      body: {
        connector: 'zapier',
        tool: 'mcp__zapier__heygen_create_a_video_from_template',
        action: 'generate video',
        dry_run: true,
      },
    }),
  },
]

const failures = []
const results = []

for (const check of checks) {
  const result = await check.run().catch((error) => ({
    path: 'unknown',
    status: 0,
    body: { error: error instanceof Error ? error.message : String(error) },
  }))
  const body = result.body || {}
  results.push({
    name: check.name,
    path: result.path,
    status: result.status,
    mode: body.mode || null,
    canonical_status: body.canonical_status || null,
    blocker_class: body.blocker_class || null,
    blocker: body.blocker || body.error || null,
    required_scope: body.required_scope || null,
    tools_total: body.tools_total ?? body.total ?? null,
    schema_available: body.schema_available ?? null,
    approval_request_created: body.approval_request_created === true,
    accepted_for_execution: body.accepted_for_execution === true,
    execution_enabled: body.execution_enabled === true,
    writes_enabled: body.writes_enabled === true,
    no_zapier_writes: body.no_zapier_writes === true,
    no_heygen_generation: body.no_heygen_generation === true,
    no_tool_invocation: body.no_tool_invocation === true,
  })

  requireStatus(failures, check.name, result, check.expected)
  if (check.canonical && result.status !== 401) requireCanonical(failures, check.name, result)
  if (check.readOnly && result.status !== 401) requireReadOnly(failures, check.name, result)
  if (check.requireZapierGuard && body.no_zapier_writes !== true) {
    failures.push({ name: check.name, path: result.path, error: 'missing_no_zapier_writes_guard' })
  }
  if (check.requireHeyGenGuard && body.no_heygen_generation !== true) {
    failures.push({ name: check.name, path: result.path, error: 'missing_no_heygen_generation_guard' })
  }
  if (check.requireScope && body.required_scope !== check.requireScope) {
    failures.push({ name: check.name, path: result.path, error: 'missing_required_scope', expected: check.requireScope, actual: body.required_scope || null })
  }
  if (check.requireEmptyInventoryBlocker && Number(body.tools_total || body.total || 0) === 0 && !body.blocker) {
    failures.push({ name: check.name, path: result.path, error: 'empty_inventory_without_blocker' })
  }
}

const summary = {
  ok: failures.length === 0,
  base_url: baseUrl,
  checked: checks.length,
  expectation: 'MCP, Zapier, and HeyGen expose truthful read-only status, keep writes/generation disabled, and route protected actions through exact Bridge approval only.',
  failures,
  results,
  blockers: {
    mcp: results.find((result) => result.name === 'mcp_status_summary')?.blocker || null,
    zapier: results.find((result) => result.name === 'zapier_bridge_status')?.blocker || null,
    heygen: results.find((result) => result.name === 'heygen_schema_readiness')?.blocker || null,
  },
}

const serialized = JSON.stringify(summary, null, 2)
if (outputPath) writeFileSync(outputPath, `${serialized}\n`, { mode: 0o600 })

if (failures.length) {
  console.error(serialized)
  process.exit(1)
}

console.log(serialized)
