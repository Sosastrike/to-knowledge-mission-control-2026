#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
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

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: apiKey ? {
      'x-api-key': apiKey,
      cookie: 'mc-session=runtime-smoke-proxy-pass',
    } : {},
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const body = await response.json().catch(() => ({}))
  return { path, status: response.status, body }
}

async function getText(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: apiKey ? { cookie: 'mc-session=runtime-smoke-proxy-pass' } : {},
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  const body = await response.text()
  return { path, status: response.status, body }
}

const checks = await Promise.all([
  getJson('/api/bridge/zapier/status'),
  getJson('/api/bridge/zapier/tools'),
  getJson('/api/bridge/zapier/tools/search?q=heygen'),
  getJson('/api/zapier/status'),
  getJson('/api/zapier/tools'),
  getText('/designer-mission-control/src/replicas/ZapierPage.jsx'),
])

const failures = []
const [bridgeStatus, bridgeTools, bridgeSearch, legacyStatus, legacyTools, zapierPage] = checks

for (const result of [bridgeStatus, bridgeTools, bridgeSearch, legacyStatus, legacyTools]) {
  if (result.status !== 200 || result.body?.ok !== true) {
    failures.push({ path: result.path, status: result.status, error: 'zapier_registry_route_not_ok' })
  }
}

function assertCanonical(result) {
  const status = result.body?.canonical_status
  if (!allowedStatuses.has(status)) failures.push({ path: result.path, error: 'missing_or_invalid_canonical_status', canonical_status: status })
  if (result.body?.execution_enabled !== false) failures.push({ path: result.path, error: 'execution_not_disabled' })
  if (result.body?.writes_enabled !== false) failures.push({ path: result.path, error: 'writes_not_disabled' })
  if (result.body?.no_zapier_writes !== true) failures.push({ path: result.path, error: 'no_zapier_writes_not_asserted' })
  if (Number(result.body?.tools_total || 0) === 0 && !result.body?.blocker) {
    failures.push({ path: result.path, error: 'empty_inventory_without_blocker' })
  }
}

for (const result of [bridgeStatus, bridgeTools, bridgeSearch, legacyStatus, legacyTools]) assertCanonical(result)

for (const result of [bridgeTools, bridgeSearch, legacyTools]) {
  const tools = Array.isArray(result.body?.tools) ? result.body.tools : []
  for (const tool of tools) {
    if (!tool.tool_name) failures.push({ path: result.path, error: 'tool_missing_tool_name' })
    if (!['read', 'write', 'unknown'].includes(tool.write_classification)) {
      failures.push({ path: result.path, tool: tool.tool_name, error: 'invalid_write_classification' })
    }
    if (tool.execution_enabled !== false) failures.push({ path: result.path, tool: tool.tool_name, error: 'tool_execution_enabled' })
  }
}

if (zapierPage.status !== 200) failures.push({ path: zapierPage.path, status: zapierPage.status, error: 'zapier_page_source_not_served' })
if (!zapierPage.body.includes('/api/bridge/zapier/status')) failures.push({ path: zapierPage.path, error: 'ui_not_using_bridge_status' })
if (!zapierPage.body.includes('/api/bridge/zapier/tools')) failures.push({ path: zapierPage.path, error: 'ui_not_using_bridge_tools' })
if (zapierPage.body.includes('t.name') || zapierPage.body.includes('t.kind')) failures.push({ path: zapierPage.path, error: 'ui_uses_legacy_tool_fields' })

const summary = {
  ok: failures.length === 0,
  base_url: baseUrl,
  failures,
  bridge_status: {
    canonical_status: bridgeStatus.body?.canonical_status,
    blocker_class: bridgeStatus.body?.blocker_class,
    blocker: bridgeStatus.body?.blocker || null,
    tools_total: bridgeStatus.body?.tools_total ?? 0,
    read_tools_total: bridgeStatus.body?.read_tools_total ?? 0,
    write_tools_total: bridgeStatus.body?.write_tools_total ?? 0,
  },
  legacy_status: {
    canonical_status: legacyStatus.body?.canonical_status,
    blocker_class: legacyStatus.body?.blocker_class,
    blocker: legacyStatus.body?.blocker || null,
    tools_count: legacyStatus.body?.tools_count ?? 0,
  },
  ui_source: {
    bytes: zapierPage.body.length,
    uses_bridge_status: zapierPage.body.includes('/api/bridge/zapier/status'),
    uses_bridge_tools: zapierPage.body.includes('/api/bridge/zapier/tools'),
  },
}

if (failures.length) {
  console.error(JSON.stringify(summary, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(summary, null, 2))
