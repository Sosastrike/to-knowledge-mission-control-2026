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

async function getJson(path) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
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
const readiness = await getJson('/api/bridge/connector-readiness')

if (readiness.status !== 200 || readiness.body?.ok !== true) {
  failures.push({ path: readiness.path, status: readiness.status, error: 'connector_readiness_not_ok' })
}

const summary = readiness.body?.summary || {}
if (summary.execution_enabled !== 0 || summary.writes_enabled !== 0) {
  failures.push({
    path: readiness.path,
    error: 'connector_readiness_enabled_execution_or_writes',
    execution_enabled: summary.execution_enabled,
    writes_enabled: summary.writes_enabled,
  })
}

const connectors = Array.isArray(readiness.body?.connectors) ? readiness.body.connectors : []
if (connectors.length < 6) {
  failures.push({ path: readiness.path, error: 'expected_at_least_6_connectors', count: connectors.length })
}

const endpointResults = []
for (const connector of connectors) {
  if (!connector.read_only_endpoint) continue
  const result = await getJson(connector.read_only_endpoint)
  endpointResults.push({
    id: connector.id,
    path: connector.read_only_endpoint,
    status: result.status,
    ok: result.body?.ok,
    state: result.body?.state || result.body?.status || result.body?.mode || null,
    execution_enabled: result.body?.execution_enabled === true,
    writes_enabled: result.body?.writes_enabled === true,
    approval_request_created: result.body?.approval_request_created === true,
  })

  if (result.status !== 200) {
    failures.push({ id: connector.id, path: connector.read_only_endpoint, status: result.status, error: 'read_only_endpoint_not_200' })
  }
  if (result.body?.execution_enabled === true || result.body?.writes_enabled === true || result.body?.approval_request_created === true) {
    failures.push({
      id: connector.id,
      path: connector.read_only_endpoint,
      error: 'read_only_endpoint_enabled_execution_writes_or_fake_approval',
    })
  }
}

if (failures.length) {
  console.error(JSON.stringify({
    ok: false,
    base_url: baseUrl,
    failures,
    connector_summary: summary,
    endpoint_results: endpointResults,
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  connector_count: connectors.length,
  connector_summary: summary,
  expectation: 'All connector read-only endpoints respond without enabling execution, writes, or fake approval persistence.',
  endpoint_results: endpointResults,
}, null, 2))
