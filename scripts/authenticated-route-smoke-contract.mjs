#!/usr/bin/env node

export const AUTHENTICATED_PAGE_ROUTES = [
  { path: '/tkmc', label: 'Mission Control home' },
  { path: '/gateway', label: 'Gateway overview' },
  { path: '/gateway?tab=agent-hub', label: 'Gateway Agent Hub tab' },
  { path: '/gateway?tab=paperclip', label: 'Gateway Paperclip tab' },
  { path: '/gateway?tab=bridge', label: 'Gateway Bridge Session tab' },
  { path: '/gateway?tab=dispatcher', label: 'Gateway Dispatcher tab' },
  { path: '/gateway?tab=governor', label: 'Gateway Token Governor tab' },
  { path: '/gateway/status', label: 'Gateway status page' },
  { path: '/gateway/space-agent', label: 'SpaceAgent page' },
  { path: '/gateway/brain', label: 'Brain page' },
  { path: '/agents', label: 'Agents alias' },
  { path: '/agent-network', label: 'Agent Network alias' },
  { path: '/settings/tkmc', label: 'TKMC settings' },
  { path: '/settings/tkmc/integrations', label: 'TKMC integrations settings' },
  { path: '/settings/tkmc/security', label: 'TKMC security settings' },
]

export const AUTHENTICATED_API_ROUTES = [
  { path: '/api/runtime/health', label: 'Runtime health' },
  { path: '/api/runtime/failure-states', label: 'Runtime failure states' },
  { path: '/api/status?action=dashboard', label: 'Dashboard status' },
  { path: '/api/gateway/status', label: 'Gateway status' },
  { path: '/api/gateway/agent-hub/status', label: 'Agent Hub status' },
  { path: '/api/gateway/navigation?route=/gateway/agent-hub', label: 'Gateway navigation metadata' },
  { path: '/api/bridge/approval-requests', label: 'Bridge approval requests' },
  { path: '/api/bridge/connector-readiness', label: 'Connector readiness' },
  { path: '/api/bridge/agent-zero/status', label: 'Agent Zero status' },
  { path: '/api/bridge/hermes/status', label: 'Hermes status' },
  { path: '/api/bridge/pi/status', label: 'Pi status' },
  { path: '/api/bridge/paperclip/status', label: 'Paperclip status' },
  { path: '/api/bridge/brain-sync/build-wiki/status', label: 'Build-Wiki status' },
  { path: '/api/bridge/agent-zero/reports', label: 'Agent Zero reports' },
  { path: '/api/bridge/agent-zero/telegram/status', label: 'Telegram status' },
  { path: '/api/bridge/agent-zero/agentmail/status', label: 'AgentMail status' },
  { path: '/api/bridge/agent-zero/google-drive/status', label: 'Google Drive status' },
  { path: '/api/bridge/agent-zero/onedrive/status', label: 'OneDrive status' },
  { path: '/api/bridge/zapier/status', label: 'Zapier status' },
  { path: '/api/bridge/heygen/schema-readiness', label: 'HeyGen schema readiness' },
  { path: '/api/gateway/space-agent/browser/status', label: 'SpaceAgent browser status' },
  { path: '/api/gateway/space-agent/youtube/status', label: 'YouTube status' },
]

function safeCookieName(value) {
  const cookieName = String(value || '').trim()
  return /^[A-Za-z0-9_.-]+$/.test(cookieName) ? cookieName : 'mc-session'
}

function redactHeader(value, baseUrl) {
  if (!value) return null
  try {
    const url = new URL(value, baseUrl)
    return `${url.pathname}${url.search ? '?[query-redacted]' : ''}`
  } catch {
    return '[redacted-location]'
  }
}

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

export function classifyAuthenticatedProbe(probe) {
  if (probe.unsafe_text_detected) {
    return {
      ...probe,
      ok: false,
      reason: 'unsafe_text_detected',
    }
  }

  if (probe.kind === 'page') {
    const ok = probe.status === 200
    return {
      ...probe,
      ok,
      reason: ok ? 'authenticated_page_rendered' : 'authenticated_page_not_rendered',
    }
  }

  const ok = probe.status >= 200 && probe.status < 300
  return {
    ...probe,
    ok,
    reason: ok ? 'authenticated_api_ok' : 'authenticated_api_not_ok',
  }
}

export function buildAuthenticatedRouteSmokeReport({
  base_url,
  checked_at,
  cookie_name = 'mc-session',
  owner_session_available,
  session_kind = 'none',
  probes = [],
  base_probe = null,
}) {
  const results = probes.map(classifyAuthenticatedProbe)
  const baseProbeOk = !base_probe || (
    base_probe.status === 200 &&
    base_probe.mission_control_present === true &&
    base_probe.unsafe_text_detected === false
  )
  const failures = results
    .filter((result) => !result.ok)
    .map((result) => ({
      path: result.path,
      kind: result.kind,
      status: result.status,
      location: result.location || null,
      reason: result.reason,
    }))

  const authenticatedSmokeProven = Boolean(
    baseProbeOk &&
    owner_session_available &&
    failures.length === 0 &&
    results.length > 0,
  )
  const ownerVisualProofClaimed = Boolean(authenticatedSmokeProven && session_kind === 'owner')
  const blockerClass = !baseProbeOk
    ? 'SERVICE_DOWN'
    : owner_session_available
      ? (authenticatedSmokeProven ? 'NONE' : 'BLOCKED')
      : 'OWNER_GATED'
  const blocker = !baseProbeOk
    ? 'mission_control_login_probe_failed'
    : owner_session_available
      ? (authenticatedSmokeProven ? null : 'provided_owner_session_failed_authenticated_smoke')
      : 'owner_authenticated_browser_session_required'

  return {
    ok: baseProbeOk && (owner_session_available ? authenticatedSmokeProven : true),
    authenticated_smoke_proven: authenticatedSmokeProven,
    owner_visual_proof_claimed: ownerVisualProofClaimed,
    blocker_class: blockerClass,
    blocker,
    checked_at,
    base_url,
    mode: 'authenticated_route_smoke',
    session_kind: owner_session_available ? session_kind : 'none',
    cookie_name,
    cookie_value_stored: false,
    page_routes_inventory: AUTHENTICATED_PAGE_ROUTES,
    api_routes_inventory: AUTHENTICATED_API_ROUTES,
    base_probe,
    routes_checked: results.length,
    pages_checked: results.filter((result) => result.kind === 'page').length,
    apis_checked: results.filter((result) => result.kind === 'api').length,
    no_cookie_value_written: true,
    no_response_bodies_written: true,
    failures,
    results,
  }
}

async function fetchProbe(baseUrl, route, kind, cookieHeader) {
  try {
    const response = await fetch(`${baseUrl}${route.path}`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    })
    const body = await response.text()
    return {
      path: route.path,
      label: route.label,
      kind,
      status: response.status,
      location: redactHeader(response.headers.get('location'), baseUrl),
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

async function fetchBaseProbe(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    const body = await response.text()
    return {
      path: '/login',
      status: response.status,
      body_bytes: body.length,
      mission_control_present: body.includes('Mission Control'),
      unsafe_text_detected: hasUnsafeText(body),
    }
  } catch (error) {
    return {
      path: '/login',
      status: 0,
      body_bytes: 0,
      mission_control_present: false,
      unsafe_text_detected: false,
      error: error instanceof Error ? error.message.slice(0, 180) : 'request_failed',
    }
  }
}

async function run() {
  const baseUrl = (process.argv[2] || process.env.MC_BASE_URL || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
  const cookieName = safeCookieName(process.env.MC_PROOF_COOKIE_NAME || 'mc-session')
  const cookieValue = String(process.env.MC_PROOF_COOKIE_VALUE || '').trim()
  const sessionKind = String(process.env.MC_VISUAL_PROOF_SESSION_KIND || 'provided_session_not_owner_confirmed')
  const ownerSessionAvailable = Boolean(cookieValue)
  const baseProbe = await fetchBaseProbe(baseUrl)
  const probes = []

  if (ownerSessionAvailable) {
    const cookieHeader = `${cookieName}=${cookieValue}`
    for (const route of AUTHENTICATED_PAGE_ROUTES) {
      probes.push(await fetchProbe(baseUrl, route, 'page', cookieHeader))
    }
    for (const route of AUTHENTICATED_API_ROUTES) {
      probes.push(await fetchProbe(baseUrl, route, 'api', cookieHeader))
    }
  }

  const report = buildAuthenticatedRouteSmokeReport({
    base_url: baseUrl,
    checked_at: new Date().toISOString(),
    cookie_name: cookieName,
    owner_session_available: ownerSessionAvailable,
    session_kind: sessionKind,
    probes,
    base_probe: baseProbe,
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
