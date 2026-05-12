#!/usr/bin/env node

export const PROTECTED_PAGE_ROUTES = [
  { path: '/tkmc', label: 'Mission Control home' },
  { path: '/gateway', label: 'Gateway overview' },
  { path: '/gateway?tab=agent-hub', label: 'Gateway Agent Hub tab deep link' },
  { path: '/gateway/agent-hub', label: 'Agent Hub compatibility route' },
  { path: '/gateway/agent-hub/paperclip', label: 'Paperclip compatibility route' },
  { path: '/gateway/routes', label: 'Gateway routes compatibility route' },
  { path: '/gateway/registry', label: 'Gateway registry compatibility route' },
  { path: '/gateway/policies', label: 'Gateway policies compatibility route' },
  { path: '/gateway/health', label: 'Gateway health compatibility route' },
  { path: '/gateway/bridge-session', label: 'Bridge Session compatibility route' },
  { path: '/gateway/dispatcher', label: 'Dispatcher compatibility route' },
  { path: '/gateway/token-governor', label: 'Token Governor compatibility route' },
  { path: '/gateway/node-detail', label: 'Gateway node detail compatibility route' },
  { path: '/gateway/mobile-tablet', label: 'Gateway mobile tablet compatibility route' },
  { path: '/agent-network', label: 'Agent Network alias' },
  { path: '/agents', label: 'Agents alias' },
  { path: '/settings/tkmc', label: 'TKMC settings' },
  { path: '/settings/tkmc/security', label: 'TKMC security settings' },
  { path: '/designer-mission-control/design/gateway/Agent%20Hub.html', label: 'Designer Agent Hub asset' },
  { path: '/designer-mission-control/design/gateway/Paperclip.html', label: 'Designer Paperclip asset' },
]

export const PROTECTED_API_ROUTES = [
  { path: '/api/runtime/health', label: 'Runtime health' },
  { path: '/api/runtime/failure-states', label: 'Runtime failure states' },
  { path: '/api/status?action=dashboard', label: 'Dashboard status' },
  { path: '/api/gateway/status', label: 'Gateway status' },
  { path: '/api/gateway/route-smoke', label: 'Gateway route smoke' },
  { path: '/api/gateway/agent-hub/status', label: 'Agent Hub status' },
  { path: '/api/gateway/agent-hub/registry', label: 'Agent Hub registry' },
  { path: '/api/gateway/nodes/pi', label: 'Pi node' },
  { path: '/api/gateway/nodes/space-agent', label: 'SpaceAgent node' },
  { path: '/api/bridge/agent-zero/status', label: 'Agent Zero status' },
  { path: '/api/bridge/hermes/status', label: 'Hermes status' },
  { path: '/api/bridge/pi/status', label: 'Pi status' },
  { path: '/api/bridge/paperclip/status', label: 'Paperclip status' },
  { path: '/api/bridge/approval-requests', label: 'Bridge approval requests' },
  { path: '/api/bridge/connector-readiness', label: 'Connector readiness' },
  { path: '/api/bridge/brain-sync/build-wiki/status', label: 'Build-Wiki status' },
  { path: '/api/bridge/brain-sync/build-wiki/run-now', label: 'Build-Wiki Run Now' },
]

export const PUBLIC_ROUTES = [
  { path: '/login', label: 'Login' },
  { path: '/setup', label: 'Setup' },
  { path: '/docs', label: 'Docs' },
  { path: '/api/status?action=health', label: 'Public health probe' },
]

function hasUnsafeText(text) {
  const patterns = [
    new RegExp(['/', 'Users', '/'].join('')),
    new RegExp(['/', 'home', '/'].join('')),
    new RegExp(['Bearer', '\\s+'].join('')),
    new RegExp(['sk', '-'].join('') + '[A-Za-z0-9_-]{20,}'),
    new RegExp(['API', '_KEY='].join('')),
    new RegExp(['AUTH', '_PASS='].join('')),
    new RegExp(['TOKEN', '='].join('')),
    new RegExp(['SECRET', '='].join('')),
    new RegExp(['BEGIN ', '[A-Z ]*', 'PRIVATE KEY'].join('')),
  ]
  return patterns.some((pattern) => pattern.test(text))
}

function isLoginRedirect(status, location) {
  return [301, 302, 307, 308].includes(status) && /\/login(?:$|[?#])/.test(String(location || ''))
}

export function classifyProbe(probe) {
  if (probe.unsafe_text_detected) {
    return {
      ...probe,
      ok: false,
      protected: false,
      reason: 'unsafe_text_detected',
    }
  }

  if (probe.kind === 'public') {
    const ok = probe.status === 200
    return {
      ...probe,
      ok,
      protected: false,
      reason: ok ? 'public_route_ok' : 'public_route_unexpected_status',
    }
  }

  if (probe.status === 401 || probe.status === 403) {
    return {
      ...probe,
      ok: true,
      protected: true,
      reason: 'auth_blocked',
    }
  }

  if (isLoginRedirect(probe.status, probe.location)) {
    return {
      ...probe,
      ok: true,
      protected: true,
      reason: 'login_redirect',
    }
  }

  return {
    ...probe,
    ok: false,
    protected: false,
    reason: probe.kind === 'protected_page'
      ? 'protected_page_rendered_unauthenticated'
      : 'protected_api_not_auth_blocked',
  }
}

export function buildProtectedRouteSmokeReport({ base_url, checked_at, probes }) {
  const results = probes.map(classifyProbe)
  const failures = results
    .filter((result) => !result.ok)
    .map((result) => ({
      path: result.path,
      kind: result.kind,
      status: result.status,
      location: result.location || null,
      reason: result.reason,
    }))

  return {
    ok: failures.length === 0,
    checked_at,
    base_url,
    mode: 'unauthenticated_protected_route_smoke',
    routes_checked: results.length,
    protected_pages_checked: results.filter((result) => result.kind === 'protected_page').length,
    protected_apis_checked: results.filter((result) => result.kind === 'protected_api').length,
    public_routes_checked: results.filter((result) => result.kind === 'public').length,
    no_auth_headers_sent: true,
    no_cookie_sent: true,
    no_response_bodies_written: true,
    failures,
    results,
  }
}

async function fetchProbe(baseUrl, route, kind) {
  try {
    const response = await fetch(`${baseUrl}${route.path}`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    const body = await response.text()
    return {
      path: route.path,
      label: route.label,
      kind,
      status: response.status,
      location: response.headers.get('location'),
      body_bytes: body.length,
      unsafe_text_detected: hasUnsafeText(body),
    }
  } catch (error) {
    return {
      path: route.path,
      label: route.label,
      kind,
      status: 0,
      location: null,
      body_bytes: 0,
      unsafe_text_detected: false,
      error: error instanceof Error ? error.message.slice(0, 180) : 'request_failed',
    }
  }
}

async function run() {
  const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
  const probes = []

  for (const route of PROTECTED_PAGE_ROUTES) {
    probes.push(await fetchProbe(baseUrl, route, 'protected_page'))
  }

  for (const route of PROTECTED_API_ROUTES) {
    probes.push(await fetchProbe(baseUrl, route, 'protected_api'))
  }

  for (const route of PUBLIC_ROUTES) {
    probes.push(await fetchProbe(baseUrl, route, 'public'))
  }

  const report = buildProtectedRouteSmokeReport({
    base_url: baseUrl,
    checked_at: new Date().toISOString(),
    probes,
  })

  const text = JSON.stringify(report, null, 2)
  if (!report.ok) {
    console.error(text)
    process.exit(1)
  }
  console.log(text)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
}
