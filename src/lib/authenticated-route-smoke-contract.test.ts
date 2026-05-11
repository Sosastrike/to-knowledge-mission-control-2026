import { describe, expect, it } from 'vitest'
import {
  AUTHENTICATED_API_ROUTES,
  AUTHENTICATED_PAGE_ROUTES,
  buildAuthenticatedRouteSmokeReport,
  classifyAuthenticatedProbe,
} from '../../scripts/authenticated-route-smoke-contract.mjs'

const buildReport = buildAuthenticatedRouteSmokeReport as unknown as (input: Record<string, unknown>) => Record<string, any>
const classifyProbe = classifyAuthenticatedProbe as (probe: Record<string, unknown>) => Record<string, any>

describe('authenticated route smoke contract', () => {
  it('inventories primary Mission Control, Gateway, Bridge, connector, and report routes', () => {
    expect(AUTHENTICATED_PAGE_ROUTES.map((route) => route.path)).toEqual(expect.arrayContaining([
      '/tkmc',
      '/gateway',
      '/gateway?tab=agent-hub',
      '/gateway?tab=paperclip',
      '/gateway?tab=bridge',
      '/gateway/status',
      '/settings/tkmc/security',
    ]))
    expect(AUTHENTICATED_API_ROUTES.map((route) => route.path)).toEqual(expect.arrayContaining([
      '/api/runtime/health',
      '/api/gateway/status',
      '/api/gateway/agent-hub/status',
      '/api/bridge/approval-requests',
      '/api/bridge/agent-zero/status',
      '/api/bridge/hermes/status',
      '/api/bridge/pi/status',
      '/api/bridge/paperclip/status',
      '/api/bridge/agent-zero/reports',
      '/api/bridge/agent-zero/telegram/status',
      '/api/bridge/agent-zero/google-drive/status',
      '/api/bridge/agent-zero/onedrive/status',
    ]))
  })

  it('classifies missing owner session as owner-gated without claiming authenticated proof', () => {
    const report = buildReport({
      base_url: 'http://127.0.0.1:3337',
      checked_at: '2026-05-11T00:00:00.000Z',
      owner_session_available: false,
      probes: [],
    })

    expect(report.ok).toBe(true)
    expect(report.authenticated_smoke_proven).toBe(false)
    expect(report.owner_visual_proof_claimed).toBe(false)
    expect(report.blocker_class).toBe('OWNER_GATED')
    expect(report.blocker).toBe('owner_authenticated_browser_session_required')
    expect(report.cookie_value_stored).toBe(false)
  })

  it('classifies an unreachable Mission Control runtime separately from owner-gated auth', () => {
    const report = buildReport({
      base_url: 'http://127.0.0.1:3337',
      checked_at: '2026-05-11T00:00:00.000Z',
      owner_session_available: false,
      probes: [],
      base_probe: {
        path: '/login',
        status: 0,
        body_bytes: 0,
        mission_control_present: false,
        unsafe_text_detected: false,
        error: 'fetch failed',
      },
    })

    expect(report.ok).toBe(false)
    expect(report.authenticated_smoke_proven).toBe(false)
    expect(report.owner_visual_proof_claimed).toBe(false)
    expect(report.blocker_class).toBe('SERVICE_DOWN')
    expect(report.blocker).toBe('mission_control_login_probe_failed')
  })

  it('accepts authenticated page and API success statuses', () => {
    expect(classifyProbe({
      path: '/gateway',
      kind: 'page',
      status: 200,
      location: null,
      body_bytes: 20_000,
      unsafe_text_detected: false,
    }).ok).toBe(true)

    expect(classifyProbe({
      path: '/api/runtime/health',
      kind: 'api',
      status: 200,
      location: null,
      body_bytes: 200,
      unsafe_text_detected: false,
    }).ok).toBe(true)
  })

  it('fails authenticated smoke when a provided session still redirects or blocks', () => {
    const report = buildReport({
      base_url: 'http://127.0.0.1:3337',
      checked_at: '2026-05-11T00:00:00.000Z',
      owner_session_available: true,
      session_kind: 'owner',
      probes: [
        {
          path: '/gateway',
          kind: 'page',
          status: 307,
          location: '/login',
          body_bytes: 6,
          unsafe_text_detected: false,
        },
      ],
    })

    expect(report.ok).toBe(false)
    expect(report.blocker_class).toBe('BLOCKED')
    expect(report.blocker).toBe('provided_owner_session_failed_authenticated_smoke')
    expect(report.owner_visual_proof_claimed).toBe(false)
    expect(report.failures).toEqual([
      expect.objectContaining({
        path: '/gateway',
        reason: 'authenticated_page_not_rendered',
      }),
    ])
  })

  it('marks owner visual proof only when owner session succeeds', () => {
    const report = buildReport({
      base_url: 'http://127.0.0.1:3337',
      checked_at: '2026-05-11T00:00:00.000Z',
      owner_session_available: true,
      session_kind: 'owner',
      probes: [
        {
          path: '/gateway',
          kind: 'page',
          status: 200,
          location: null,
          body_bytes: 20_000,
          unsafe_text_detected: false,
        },
        {
          path: '/api/runtime/health',
          kind: 'api',
          status: 200,
          location: null,
          body_bytes: 200,
          unsafe_text_detected: false,
        },
      ],
    })

    expect(report.ok).toBe(true)
    expect(report.authenticated_smoke_proven).toBe(true)
    expect(report.owner_visual_proof_claimed).toBe(true)
    expect(report.blocker_class).toBe('NONE')
  })
})
