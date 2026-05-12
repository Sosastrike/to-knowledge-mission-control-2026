import { describe, expect, it } from 'vitest'
import {
  PROTECTED_API_ROUTES,
  PROTECTED_PAGE_ROUTES,
  PUBLIC_ROUTES,
  buildProtectedRouteSmokeReport,
  classifyProbe,
} from '../../scripts/protected-route-smoke-contract.mjs'

describe('protected route smoke contract', () => {
  it('tracks Mission Control, Gateway, Bridge, and public health routes', () => {
    expect(PROTECTED_PAGE_ROUTES.map((route) => route.path)).toEqual(expect.arrayContaining([
      '/gateway',
      '/gateway?tab=agent-hub',
      '/gateway/agent-hub',
      '/agents',
      '/settings/tkmc',
      '/design/gateway/Agent%20Hub.html',
      '/design/gateway/Paperclip.html',
    ]))
    expect(PROTECTED_API_ROUTES.map((route) => route.path)).toEqual(expect.arrayContaining([
      '/api/runtime/health',
      '/api/runtime/failure-states',
      '/api/gateway/status',
      '/api/gateway/agent-hub/status',
      '/api/gateway/agent-hub/proof-packet',
      '/api/bridge/agent-zero/status',
      '/api/bridge/approval-requests',
    ]))
    expect(PUBLIC_ROUTES.map((route) => route.path)).toEqual(expect.arrayContaining([
      '/login',
      '/setup',
      '/docs',
      '/api/status?action=health',
    ]))
  })

  it('accepts protected page redirects to login', () => {
    const result = classifyProbe({
      path: '/gateway',
      kind: 'protected_page',
      status: 307,
      location: '/login',
      body_bytes: 0,
      unsafe_text_detected: false,
    })

    expect(result.ok).toBe(true)
    expect(result.protected).toBe(true)
    expect(result.reason).toBe('login_redirect')
  })

  it('accepts protected API auth blocks', () => {
    const result = classifyProbe({
      path: '/api/runtime/health',
      kind: 'protected_api',
      status: 401,
      location: null,
      body_bytes: 24,
      unsafe_text_detected: false,
    })

    expect(result.ok).toBe(true)
    expect(result.protected).toBe(true)
    expect(result.reason).toBe('auth_blocked')
  })

  it('rejects protected routes that render unauthenticated content', () => {
    const result = classifyProbe({
      path: '/gateway/agent-hub',
      kind: 'protected_page',
      status: 200,
      location: null,
      body_bytes: 50_000,
      unsafe_text_detected: false,
    })

    expect(result.ok).toBe(false)
    expect(result.protected).toBe(false)
    expect(result.reason).toBe('protected_page_rendered_unauthenticated')
  })

  it('builds a failing report when any protected route leaks unsafe text', () => {
    const report = buildProtectedRouteSmokeReport({
      base_url: 'http://127.0.0.1:3337',
      checked_at: '2026-05-11T00:00:00.000Z',
      probes: [
        {
          path: '/gateway',
          kind: 'protected_page',
          status: 307,
          location: '/login',
          body_bytes: 0,
          unsafe_text_detected: false,
        },
        {
          path: '/api/gateway/status',
          kind: 'protected_api',
          status: 401,
          location: null,
          body_bytes: 24,
          unsafe_text_detected: true,
        },
      ],
    })

    expect(report.ok).toBe(false)
    expect(report.failures).toEqual([
      expect.objectContaining({
        path: '/api/gateway/status',
        reason: 'unsafe_text_detected',
      }),
    ])
  })
})
