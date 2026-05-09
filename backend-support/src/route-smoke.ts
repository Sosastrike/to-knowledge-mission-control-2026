import type { CanonicalStatus, RouteSmokeReport, RouteSmokeResult } from './types.js'
import { redactString, redactOrigin } from './redact.js'

// Routes covered by the route-smoke helper. Order is owner-meaningful: the UI
// displays them in this order. New routes get appended; never reordered.
export const ROUTE_SMOKE_TARGETS: ReadonlyArray<{
  path: string
  expected_auth: 'public' | 'viewer' | 'operator' | 'owner'
  owner_safe_label: string
}> = [
  { path: '/', expected_auth: 'public', owner_safe_label: 'Mission Control Home' },
  { path: '/gateway', expected_auth: 'viewer', owner_safe_label: 'Gateway' },
  { path: '/gateway/overview', expected_auth: 'viewer', owner_safe_label: 'Gateway Overview' },
  { path: '/gateway/agent-hub', expected_auth: 'viewer', owner_safe_label: 'Agent Hub' },
  { path: '/gateway/dispatcher', expected_auth: 'operator', owner_safe_label: 'Dispatcher' },
  { path: '/gateway/token-governor', expected_auth: 'viewer', owner_safe_label: 'Token Governor' },
  { path: '/gateway/bridge-session', expected_auth: 'operator', owner_safe_label: 'Bridge Session' },
  { path: '/agent-network', expected_auth: 'viewer', owner_safe_label: 'Agent Network' },
  { path: '/agents', expected_auth: 'viewer', owner_safe_label: 'Agents' },
  { path: '/api/gateway/status', expected_auth: 'viewer', owner_safe_label: 'Gateway Status JSON' },
]

interface FetchLike {
  (input: string, init?: { method?: string; headers?: Record<string, string>; redirect?: 'manual' | 'follow' }): Promise<{
    status: number
    headers: { get(name: string): string | null }
  }>
}

interface ProbeOptions {
  baseOrigin: string                 // e.g. https://mission-control.example.com or http://127.0.0.1:3000
  fetchImpl?: FetchLike              // injectable for tests
  timeoutMs?: number                 // per-route timeout
  authHeader?: string | null         // optional bearer/cookie if owner is logged in (REDACTED in output)
  now?: () => Date                   // injectable clock for tests
}

const DEFAULT_TIMEOUT_MS = 4000

function classifyHttpStatus(
  expectedAuth: 'public' | 'viewer' | 'operator' | 'owner',
  status: number | null,
  redirectTarget: string | null,
): { label: CanonicalStatus; failure_reason: string | null } {
  if (status === null) {
    return { label: 'SERVICE_DOWN', failure_reason: 'no response from origin' }
  }
  if (status >= 200 && status < 300) {
    return { label: 'LIVE', failure_reason: null }
  }
  if (status >= 300 && status < 400) {
    if (redirectTarget && /\/login(?:\b|$|\?)/.test(redirectTarget)) {
      return { label: expectedAuth === 'public' ? 'BLOCKED' : 'OWNER_GATED', failure_reason: 'redirected to login' }
    }
    return { label: 'READY', failure_reason: 'redirect issued' }
  }
  if (status === 401 || status === 407) {
    return { label: 'OWNER_GATED', failure_reason: 'authentication required' }
  }
  if (status === 403) {
    return { label: 'OWNER_GATED', failure_reason: 'authorisation refused' }
  }
  if (status === 404) {
    return { label: 'BLOCKED', failure_reason: 'route missing' }
  }
  if (status === 423) {
    return { label: 'OWNER_GATED', failure_reason: 'route locked pending owner approval' }
  }
  if (status === 503) {
    return { label: 'SERVICE_DOWN', failure_reason: 'origin reports service unavailable' }
  }
  if (status >= 500) {
    return { label: 'DEGRADED', failure_reason: `origin error ${status}` }
  }
  return { label: 'DEGRADED', failure_reason: `unexpected status ${status}` }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

async function probeRoute(
  target: typeof ROUTE_SMOKE_TARGETS[number],
  opts: ProbeOptions,
): Promise<RouteSmokeResult> {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined)
  const now = opts.now ?? (() => new Date())
  const last_checked_at = now().toISOString()
  if (!fetchImpl) {
    return {
      path: target.path,
      expected_auth: target.expected_auth,
      actual_http_status: null,
      redirect_target: null,
      status_label: 'BLOCKED',
      failure_reason: 'fetch not available in this runtime',
      last_checked_at,
    }
  }
  const url = `${opts.baseOrigin.replace(/\/$/, '')}${target.path}`
  const headers: Record<string, string> = { accept: 'application/json,text/html' }
  if (opts.authHeader) headers.authorization = opts.authHeader
  try {
    const response = await withTimeout(
      fetchImpl(url, { method: 'GET', headers, redirect: 'manual' }),
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    )
    const rawRedirect = response.headers.get('location')
    const redirect_target = rawRedirect ? redactString(rawRedirect) : null
    const { label, failure_reason } = classifyHttpStatus(target.expected_auth, response.status, redirect_target)
    return {
      path: target.path,
      expected_auth: target.expected_auth,
      actual_http_status: response.status,
      redirect_target,
      status_label: label,
      failure_reason,
      last_checked_at,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    return {
      path: target.path,
      expected_auth: target.expected_auth,
      actual_http_status: null,
      redirect_target: null,
      status_label: 'SERVICE_DOWN',
      failure_reason: redactString(message).slice(0, 120),
      last_checked_at,
    }
  }
}

export async function runRouteSmoke(opts: ProbeOptions): Promise<RouteSmokeReport> {
  const generated_at = (opts.now ?? (() => new Date()))().toISOString()
  const results = await Promise.all(ROUTE_SMOKE_TARGETS.map((t) => probeRoute(t, opts)))
  const by_status = results.reduce((acc, r) => {
    acc[r.status_label] = (acc[r.status_label] || 0) + 1
    return acc
  }, {} as Record<CanonicalStatus, number>)
  return {
    generated_at,
    base_origin_redacted: redactOrigin(opts.baseOrigin),
    routes: results,
    summary: { total: results.length, by_status },
  }
}

// Pure synchronous variant for unit tests / Codex consumers — accepts an array
// of pre-fetched (path, status, location) tuples and produces the same report.
export interface PrefetchedRouteResult {
  path: string
  http_status: number | null
  redirect_target?: string | null
  failure_reason?: string | null
}

export function buildRouteSmokeReport(
  prefetched: ReadonlyArray<PrefetchedRouteResult>,
  baseOrigin: string,
  now: () => Date = () => new Date(),
): RouteSmokeReport {
  const generated_at = now().toISOString()
  const results: RouteSmokeResult[] = ROUTE_SMOKE_TARGETS.map((t) => {
    const match = prefetched.find((p) => p.path === t.path)
    if (!match) {
      return {
        path: t.path,
        expected_auth: t.expected_auth,
        actual_http_status: null,
        redirect_target: null,
        status_label: 'UNKNOWN' as CanonicalStatus,
        failure_reason: 'no probe data',
        last_checked_at: generated_at,
      }
    }
    const redirect_target = match.redirect_target ? redactString(match.redirect_target) : null
    const { label, failure_reason } = classifyHttpStatus(t.expected_auth, match.http_status, redirect_target)
    return {
      path: t.path,
      expected_auth: t.expected_auth,
      actual_http_status: match.http_status,
      redirect_target,
      status_label: label,
      failure_reason: match.failure_reason ? redactString(match.failure_reason).slice(0, 120) : failure_reason,
      last_checked_at: generated_at,
    }
  })
  const by_status = results.reduce((acc, r) => {
    acc[r.status_label] = (acc[r.status_label] || 0) + 1
    return acc
  }, {} as Record<CanonicalStatus, number>)
  return {
    generated_at,
    base_origin_redacted: redactOrigin(baseOrigin),
    routes: results,
    summary: { total: results.length, by_status },
  }
}
