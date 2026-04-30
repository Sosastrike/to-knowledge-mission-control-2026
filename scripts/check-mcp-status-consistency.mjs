#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
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

async function getJson(path) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: apiKey ? { 'x-api-key': apiKey } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const body = await response.json().catch(() => ({}))
    return { status: response.status, body }
  } catch (error) {
    return {
      status: 0,
      body: {},
      error: error instanceof Error ? error.message : 'request_failed',
    }
  }
}

const failures = []
const status = await getJson('/api/mcp/status')
const servers = await getJson('/api/mcp/servers')

if (status.status !== 200 || status.body?.ok !== true) {
  failures.push({ endpoint: '/api/mcp/status', status: status.status, error: 'status_not_ok' })
}
if (servers.status !== 200 || servers.body?.ok !== true) {
  failures.push({ endpoint: '/api/mcp/servers', status: servers.status, error: 'servers_not_ok' })
}

const statusCounts = {
  total: Number(status.body?.total || 0),
  healthy: Number(status.body?.healthy || 0),
  degraded: Number(status.body?.degraded || 0),
  failed: Number(status.body?.failed || 0),
  unknown: Number(status.body?.unknown || 0),
}
const serverCounts = {
  total: Number(servers.body?.total ?? servers.body?.summary?.total ?? (servers.body?.servers || []).length),
  healthy: Number(servers.body?.healthy ?? servers.body?.summary?.healthy ?? 0),
  degraded: Number(servers.body?.degraded ?? servers.body?.summary?.degraded ?? 0),
  failed: Number(servers.body?.failed ?? servers.body?.summary?.failed ?? 0),
  unknown: Number(servers.body?.unknown ?? servers.body?.summary?.unknown ?? 0),
}

for (const key of Object.keys(statusCounts)) {
  if (statusCounts[key] !== serverCounts[key]) {
    failures.push({
      endpoint: '/api/mcp/status + /api/mcp/servers',
      error: 'mcp_count_mismatch',
      field: key,
      status_value: statusCounts[key],
      servers_value: serverCounts[key],
    })
  }
}

const serverListCount = Array.isArray(servers.body?.servers) ? servers.body.servers.length : 0
if (serverCounts.total !== serverListCount) {
  failures.push({
    endpoint: '/api/mcp/servers',
    error: 'server_total_does_not_match_list_length',
    total: serverCounts.total,
    server_list_count: serverListCount,
  })
}

if (serverCounts.total === 0 && process.env.ALLOW_EMPTY_MCP_SERVERS !== '1') {
  failures.push({
    endpoint: '/api/mcp/servers',
    error: 'no_mcp_servers_detected',
    note: servers.body?.note || null,
    next_action: 'Mission Control should surface the live Claude MCP inventory. Set ALLOW_EMPTY_MCP_SERVERS=1 only for isolated test environments.',
  })
}

if (failures.length) {
  console.error(JSON.stringify({
    ok: false,
    base_url: baseUrl,
    failures,
    status: { http: status.status, counts: statusCounts },
    servers: {
      http: servers.status,
      counts: serverCounts,
      server_list_count: serverListCount,
      sources_checked: servers.body?.sources_checked || [],
      note: servers.body?.note || null,
    },
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  counts: statusCounts,
  server_list_count: serverListCount,
  sources_checked: servers.body?.sources_checked || [],
  note: servers.body?.note || null,
}, null, 2))
