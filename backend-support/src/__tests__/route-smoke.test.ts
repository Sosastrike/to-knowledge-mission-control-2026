import { describe, expect, it } from 'vitest'
import {
  ROUTE_SMOKE_TARGETS,
  buildRouteSmokeReport,
  runRouteSmoke,
} from '../route-smoke.js'

describe('ROUTE_SMOKE_TARGETS', () => {
  it('contains the spec routes in stable order', () => {
    const paths = ROUTE_SMOKE_TARGETS.map((t) => t.path)
    expect(paths).toContain('/gateway')
    expect(paths).toContain('/gateway/overview')
    expect(paths).toContain('/gateway/agent-hub')
    expect(paths).toContain('/gateway/dispatcher')
    expect(paths).toContain('/gateway/token-governor')
    expect(paths).toContain('/gateway/bridge-session')
    expect(paths).toContain('/agent-network')
    expect(paths).toContain('/agents')
    expect(paths).toContain('/api/gateway/status')
  })
})

describe('buildRouteSmokeReport', () => {
  it('classifies a healthy 200 as LIVE', () => {
    const report = buildRouteSmokeReport(
      [{ path: '/gateway', http_status: 200 }],
      'https://example.com',
      () => new Date('2026-05-09T10:00:00.000Z'),
    )
    const row = report.routes.find((r) => r.path === '/gateway')!
    expect(row.status_label).toBe('LIVE')
    expect(row.failure_reason).toBeNull()
  })

  it('classifies a 404 as BLOCKED with route missing reason', () => {
    const report = buildRouteSmokeReport(
      [{ path: '/gateway/overview', http_status: 404 }],
      'https://example.com',
    )
    const row = report.routes.find((r) => r.path === '/gateway/overview')!
    expect(row.status_label).toBe('BLOCKED')
    expect(row.failure_reason).toBe('route missing')
  })

  it('classifies a redirect to /login as OWNER_GATED for protected routes', () => {
    const report = buildRouteSmokeReport(
      [{ path: '/gateway', http_status: 302, redirect_target: '/login?next=/gateway' }],
      'https://example.com',
    )
    const row = report.routes.find((r) => r.path === '/gateway')!
    expect(row.status_label).toBe('OWNER_GATED')
  })

  it('classifies 423 as OWNER_GATED', () => {
    const report = buildRouteSmokeReport(
      [{ path: '/api/gateway/status', http_status: 423 }],
      'https://example.com',
    )
    const row = report.routes.find((r) => r.path === '/api/gateway/status')!
    expect(row.status_label).toBe('OWNER_GATED')
  })

  it('classifies 503 as SERVICE_DOWN', () => {
    const report = buildRouteSmokeReport(
      [{ path: '/gateway', http_status: 503 }],
      'https://example.com',
    )
    const row = report.routes.find((r) => r.path === '/gateway')!
    expect(row.status_label).toBe('SERVICE_DOWN')
  })

  it('marks missing probe data as UNKNOWN', () => {
    const report = buildRouteSmokeReport([], 'https://example.com')
    expect(report.routes.every((r) => r.status_label === 'UNKNOWN')).toBe(true)
  })

  it('redacts the base origin', () => {
    const report = buildRouteSmokeReport([], 'http://127.0.0.1:3000')
    expect(report.base_origin_redacted).toBe('http://[redacted-host]')
    expect(report.base_origin_redacted).not.toContain('3000')
  })

  it('redacts redirect targets that contain absolute paths', () => {
    const report = buildRouteSmokeReport(
      [{ path: '/gateway', http_status: 302, redirect_target: '/login?return=/home/tony/mission-control' }],
      'https://example.com',
    )
    const row = report.routes.find((r) => r.path === '/gateway')!
    expect(row.redirect_target).not.toContain('/home/tony')
  })
})

describe('runRouteSmoke (with injected fetch)', () => {
  function makeMockResponse(status: number, location: string | null = null) {
    return {
      status,
      headers: { get: (n: string) => (n.toLowerCase() === 'location' ? location : null) },
    }
  }

  it('runs against an injected fetch and produces a complete report', async () => {
    const fetched: string[] = []
    const fetchImpl = async (url: string) => {
      fetched.push(url)
      if (url.endsWith('/api/gateway/status')) return makeMockResponse(200)
      if (url.endsWith('/gateway/dispatcher')) return makeMockResponse(401)
      return makeMockResponse(404)
    }
    const report = await runRouteSmoke({ baseOrigin: 'https://example.com', fetchImpl })
    expect(report.routes.length).toBe(ROUTE_SMOKE_TARGETS.length)
    expect(fetched.length).toBe(ROUTE_SMOKE_TARGETS.length)
    const dispatcher = report.routes.find((r) => r.path === '/gateway/dispatcher')!
    expect(dispatcher.status_label).toBe('OWNER_GATED')
    const status = report.routes.find((r) => r.path === '/api/gateway/status')!
    expect(status.status_label).toBe('LIVE')
  })

  it('marks routes SERVICE_DOWN when fetch throws', async () => {
    const fetchImpl = async () => { throw new Error('ECONNREFUSED 127.0.0.1:3000') }
    const report = await runRouteSmoke({ baseOrigin: 'http://127.0.0.1:3000', fetchImpl })
    expect(report.routes.every((r) => r.status_label === 'SERVICE_DOWN')).toBe(true)
    expect(JSON.stringify(report)).not.toContain('127.0.0.1')
  })
})
