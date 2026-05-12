import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(() => ({
    user: {
      id: 1,
      role: 'viewer',
      workspace_id: 1,
      tenant_id: 1,
    },
  })),
}))

describe('/api/gateway/dispatcher/pi', () => {
  it('returns truthful advisory-only Pi dispatcher status on GET', async () => {
    const route = await import('./route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/dispatcher/pi'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'pi_dispatcher_shadow_status',
      canonical_status: 'LIVE',
      role: 'Dispatcher / Route Optimizer Candidate',
      authority: 'advisory_only',
      commander: false,
      replaces_agent_zero: false,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      tools_enabled: false,
      runtime: {
        mode: 'mission_control_in_process_shadow',
        blocker: 'advisory_only_no_execution_authority',
      },
    })
    expect(payload.canonical_agent_registry.map((agent: { id: string }) => agent.id)).toContain('pi-mono')
  })

  it('returns a safe SpaceAgent route recommendation on POST without execution', async () => {
    const route = await import('./route')
    const request = new NextRequest('http://localhost/api/gateway/dispatcher/pi', {
      method: 'POST',
      body: JSON.stringify({ owner_request: 'Search the web for current sources' }),
    })
    const response = await route.POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'pi_dispatcher_shadow_recommendation_route',
      recommendation: {
        mode: 'pi_dispatcher_shadow_recommendation',
        recommended_agent: 'space_agent',
        selected_route: {
          target: 'space_agent',
        },
        execution_enabled: false,
        writes_enabled: false,
      },
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
    })
    expect(payload.recommendation.selected_route.via).toEqual(['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'])
    expect(payload.audit_event).toMatchObject({
      event: 'pi.dispatcher.recommendation.generated',
      route_target: 'space_agent',
      execution_enabled: false,
      writes_enabled: false,
      external_write: false,
    })
  })

  it('routes workflow design to Hermes while keeping Agent Zero as final authority', async () => {
    const route = await import('./route')
    const request = new NextRequest('http://localhost/api/gateway/dispatcher/pi', {
      method: 'POST',
      body: JSON.stringify({ owner_request: 'Design a workflow skill for customer email triage' }),
    })
    const response = await route.POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.recommendation).toMatchObject({
      recommended_agent: 'hermes',
      selected_route: {
        target: 'hermes',
      },
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(payload.recommendation.owner_visible_summary).toContain('Agent Zero')
  })

  it('blocks unknown connectors without fake completion language', async () => {
    const route = await import('./route')
    const request = new NextRequest('http://localhost/api/gateway/dispatcher/pi', {
      method: 'POST',
      body: JSON.stringify({ owner_request: 'Use UnknownCRM to update a record' }),
    })
    const response = await route.POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.recommendation).toMatchObject({
      ok: false,
      selected_route: {
        target: 'blocked',
      },
      policy_result: 'blocked',
      blocked_reason: 'unknown_connector_not_registered',
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(payload.recommendation.owner_visible_summary).not.toMatch(/\bdone\b/i)
  })

  it('redacts raw local paths and secrets from owner input', async () => {
    const route = await import('./route')
    const request = new NextRequest('http://localhost/api/gateway/dispatcher/pi', {
      method: 'POST',
      body: JSON.stringify({
        owner_request: 'Search /Users/sosastrike/private with API_KEY=fixture-secret-value',
      }),
    })
    const response = await route.POST(request)
    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    expect(response.status).toBe(200)
    expect(serialized).not.toContain('/Users/sosastrike')
    expect(serialized).not.toContain('fixture-secret-value')
    expect(serialized).toContain('[redacted-path]')
    expect(serialized).toContain('[redacted-secret]')
    expect(payload.execution_enabled).toBe(false)
    expect(payload.writes_enabled).toBe(false)
  })

  it('requires an owner request for recommendations', async () => {
    const route = await import('./route')
    const request = new NextRequest('http://localhost/api/gateway/dispatcher/pi', {
      method: 'POST',
      body: JSON.stringify({ owner_request: '   ' }),
    })
    const response = await route.POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toMatchObject({
      ok: false,
      error: 'owner_request_required',
      execution_enabled: false,
      writes_enabled: false,
    })
  })
})
