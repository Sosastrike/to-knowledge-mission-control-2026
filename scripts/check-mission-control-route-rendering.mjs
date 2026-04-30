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

const designerPages = [
  { id: 'mission', label: 'Mission', required: ['Mission Control.html', 'src/app.jsx'] },
  { id: 'brain-sync', label: 'Brain Sync', required: ['Mission Control.html', 'BrainSyncPage'] },
  { id: 'agent-network', label: 'Agent Network / Bridge Mode', required: ['Mission Control.html', 'AgentNetworkPage'] },
  { id: 'firecrawl', label: 'FireCrawl', required: ['Mission Control.html', 'FireCrawlPage'] },
  { id: 'zapier', label: 'Zapier', required: ['Mission Control.html', 'ZapierPage'] },
  { id: 'n8n', label: 'n8n', required: ['Mission Control.html', 'N8NPage'] },
  { id: 'mcp-tools', label: 'MCP Tools', required: ['Mission Control.html', 'MCPToolsPage'] },
  { id: 'skills', label: 'Skills', required: ['Mission Control.html', 'SkillsRegistryPage'] },
]

const coreRoutes = [
  { path: '/login', label: 'Designer login', allowedStatuses: [200], required: ['Mission Control', 'Microsoft 365'] },
  { path: '/agents', label: 'Auth-gated agents route', allowedStatuses: [200, 302, 307, 308, 401, 403], required: [] },
  { path: '/api/bridge/button-contracts', label: 'Button contracts API', allowedStatuses: apiKey ? [200] : [401], json: true },
  { path: '/api/bridge/capability-matrix', label: 'Bridge capability matrix API', allowedStatuses: apiKey ? [200] : [401], json: true },
  { path: '/api/bridge/connector-readiness', label: 'Connector readiness API', allowedStatuses: apiKey ? [200] : [401], json: true },
  { path: '/api/bridge/preflight', label: 'Bridge preflight contract API', allowedStatuses: apiKey ? [200] : [401], json: true },
]

function buildDesignerPath(page) {
  return `/designer-mission-control/Mission%20Control.html?page=${encodeURIComponent(page)}`
}

async function fetchRoute(path, options = {}) {
  const headers = {}
  if (apiKey && path.startsWith('/api/')) headers['x-api-key'] = apiKey

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers,
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  const body = await response.text()
  const authRedirect = [301, 302, 307, 308].includes(response.status) && (response.headers.get('location') || '').startsWith('/login')
  const authBlocked = response.status === 401 || response.status === 403
  const missing = response.status === 200
    ? (options.required || []).filter((needle) => !body.includes(needle))
    : []
  let jsonOk = true
  if (options.json) {
    try {
      JSON.parse(body)
    } catch {
      jsonOk = false
    }
  }
  return {
    path,
    status: response.status,
    location: response.headers.get('location') || undefined,
    auth_gated: authRedirect || authBlocked,
    body_bytes: body.length,
    missing,
    json_ok: jsonOk,
  }
}

const failures = []
const results = []

for (const route of coreRoutes) {
  try {
    const result = await fetchRoute(route.path, route)
    results.push({ ...route, ...result })
    if (!route.allowedStatuses.includes(result.status)) {
      failures.push({ path: route.path, label: route.label, status: result.status, error: 'unexpected_status' })
    }
    if (route.required?.length && result.missing.length > 0) {
      failures.push({ path: route.path, label: route.label, error: 'required_text_missing', missing: result.missing })
    }
    if (route.json && !result.json_ok) {
      failures.push({ path: route.path, label: route.label, error: 'invalid_json' })
    }
  } catch (error) {
    failures.push({
      path: route.path,
      label: route.label,
      error: error instanceof Error ? error.message : 'request_failed',
    })
  }
}

for (const page of designerPages) {
  const path = buildDesignerPath(page.id)
  try {
    const result = await fetchRoute(path, { required: page.required })
    results.push({ ...page, path, ...result })
    if (result.status !== 200 && !result.auth_gated) {
      failures.push({ path, label: page.label, status: result.status, error: 'unexpected_status' })
    }
    if (result.missing.length > 0) {
      failures.push({ path, label: page.label, error: 'required_text_missing', missing: result.missing })
    }
  } catch (error) {
    failures.push({
      path,
      label: page.label,
      error: error instanceof Error ? error.message : 'request_failed',
    })
  }
}

const summary = {
  ok: failures.length === 0,
  base_url: baseUrl,
  api_auth: apiKey ? 'x-api-key provided from environment' : 'no API key provided; auth-gated 401 checks expected for APIs',
  routes_checked: results.length,
  designer_pages_checked: designerPages.length,
  failures,
  results,
  note: 'This smoke test verifies the authenticated shell routes, static designer entrypoint, and read-only Bridge APIs. It does not click browser buttons or enable execution.',
}

const text = JSON.stringify(summary, null, 2)
if (failures.length) {
  console.error(text)
  process.exit(1)
}

console.log(text)
