import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  userHasAnyAgentScope: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
  userHasAnyAgentScope: mocks.userHasAnyAgentScope,
}))

vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>()
  const dataDir = process.env.SOFIA_TEST_DATA_DIR || '/tmp/mission-control-sofia-bridge-test'
  return {
    ...actual,
    config: {
      ...actual.config,
      dataDir,
      dbPath: `${dataDir}/mission-control.db`,
      tokensPath: `${dataDir}/mission-control-tokens.json`,
    },
  }
})

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

async function loadSofiaRoutes() {
  return {
    status: await import('@/app/api/bridge/sofia/status/route'),
    authority: await import('@/app/api/bridge/sofia/authority/route'),
    capability: await import('@/app/api/bridge/sofia/capability-map/route'),
    recommendation: await import('@/app/api/bridge/sofia/recommendation/route'),
    ronReview: await import('@/app/api/bridge/sofia/ron-review-request/route'),
    concurrence: await import('@/app/api/bridge/sofia/jarvis-concurrence-request/route'),
    execute: await import('@/app/api/bridge/sofia/execute/route'),
  }
}

describe('Sofia bridge routes', () => {
  it('rejects unauthenticated Sofia routes before exposing deputy data', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
    mocks.userHasAnyAgentScope.mockReturnValue(false)
    const routes = await loadSofiaRoutes()

    const responses = await Promise.all([
      routes.status.GET(request('http://localhost/api/bridge/sofia/status')),
      routes.authority.GET(request('http://localhost/api/bridge/sofia/authority')),
      routes.capability.GET(request('http://localhost/api/bridge/sofia/capability-map')),
      routes.recommendation.POST(request('http://localhost/api/bridge/sofia/recommendation', {
        method: 'POST',
        body: JSON.stringify({ title: 'x', recommendation: 'y' }),
      })),
      routes.ronReview.POST(request('http://localhost/api/bridge/sofia/ron-review-request', {
        method: 'POST',
        body: JSON.stringify({ request_id: 'x', review_topic: 'y' }),
      })),
      routes.concurrence.POST(request('http://localhost/api/bridge/sofia/jarvis-concurrence-request', {
        method: 'POST',
        body: JSON.stringify({ request_id: 'x', reason: 'y' }),
      })),
      routes.execute.POST(request('http://localhost/api/bridge/sofia/execute', {
        method: 'POST',
        body: JSON.stringify({ action_type: 'production_write' }),
      })),
    ])

    for (const response of responses) {
      expect(response.status).toBe(401)
      expect(await response.json()).toMatchObject({ ok: false, error: 'Authentication required' })
    }
  })

  it('serves Sofia read-only routes to viewer-tier users', async () => {
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', username: 'owner', workspace_id: 1 } })
    mocks.userHasAnyAgentScope.mockReturnValue(false)
    const routes = await loadSofiaRoutes()

    const statusResponse = await routes.status.GET(request('http://localhost/api/bridge/sofia/status'))
    const authorityResponse = await routes.authority.GET(request('http://localhost/api/bridge/sofia/authority'))
    const capabilityResponse = await routes.capability.GET(request('http://localhost/api/bridge/sofia/capability-map'))

    expect(statusResponse.status).toBe(200)
    expect(await statusResponse.json()).toMatchObject({
      ok: true,
      agent_id: 'sofia',
      reports_to: 'ron-weasley',
      final_authority: 'agent-zero-jarvis',
      opencloud_intermediary: false,
      credential_values_exposed: false,
    })
    expect(authorityResponse.status).toBe(200)
    expect(await authorityResponse.json()).toMatchObject({
      ok: true,
      sofia_does_not_outrank_ron: true,
      sofia_does_not_outrank_jarvis: true,
      hidden_intermediary_allowed: false,
    })
    expect(capabilityResponse.status).toBe(200)
    expect(await capabilityResponse.json()).toMatchObject({
      ok: true,
      production_execution: 'requires_ron_plus_jarvis_concurrence',
      writes_enabled: false,
    })
  })

  it('allows Sofia to create internal recommendations and review requests only', async () => {
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'operator', username: 'owner', workspace_id: 1 } })
    mocks.userHasAnyAgentScope.mockReturnValue(false)
    const routes = await loadSofiaRoutes()

    const recommendation = await routes.recommendation.POST(request('http://localhost/api/bridge/sofia/recommendation', {
      method: 'POST',
      body: JSON.stringify({ title: 'Route wording', recommendation: 'Clarify Sofia is Ron deputy.', risk_level: 'low' }),
    }))
    const ronReview = await routes.ronReview.POST(request('http://localhost/api/bridge/sofia/ron-review-request', {
      method: 'POST',
      body: JSON.stringify({ request_id: 'sofia-review', review_topic: 'Skill registry', reason: 'Deputy review' }),
    }))
    const concurrence = await routes.concurrence.POST(request('http://localhost/api/bridge/sofia/jarvis-concurrence-request', {
      method: 'POST',
      body: JSON.stringify({ request_id: 'sofia-concurrence', action_type: 'gateway_route_change', reason: 'Production behavior changes require Jarvis.' }),
    }))
    const execute = await routes.execute.POST(request('http://localhost/api/bridge/sofia/execute', {
      method: 'POST',
      body: JSON.stringify({ action_type: 'production_write' }),
    }))

    expect(recommendation.status).toBe(200)
    expect(await recommendation.json()).toMatchObject({ ok: true, record: { kind: 'sofia_recommendation' }, external_execution_enabled: false })
    expect(ronReview.status).toBe(200)
    expect(await ronReview.json()).toMatchObject({ ok: true, record: { kind: 'ron_review_request' }, external_execution_enabled: false })
    expect(concurrence.status).toBe(200)
    expect(await concurrence.json()).toMatchObject({ ok: true, record: { kind: 'jarvis_concurrence_request' }, external_execution_enabled: false })
    expect(execute.status).toBe(423)
    expect(await execute.json()).toMatchObject({
      ok: false,
      exact_blocker: 'sofia_requires_ron_and_jarvis_concurrence',
      external_execution_enabled: false,
      credential_values_exposed: false,
    })
  })
})
