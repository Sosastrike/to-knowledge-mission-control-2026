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

describe('/api/gateway/dispatcher/hermes', () => {
  it('returns truthful read-only Hermes dispatcher status on GET', async () => {
    const route = await import('./route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/dispatcher/hermes'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'hermes_dispatcher_status',
      canonical_status: 'BLOCKED',
      blocker: 'hermes_safe_live_chat_adapter_not_configured',
      hermes_called: false,
      execution_enabled: false,
      writes_enabled: false,
      dispatch_executed: false,
      agent_zero_is_commander: true,
    })
  })

  it('returns a safe Hermes route plan on POST without calling Hermes', async () => {
    const route = await import('./route')
    const request = new NextRequest('http://localhost/api/gateway/dispatcher/hermes', {
      method: 'POST',
      body: JSON.stringify({ owner_request: 'Design a workflow for customer email triage' }),
    })
    const response = await route.POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'hermes_dispatcher_route',
      dispatch: {
        mode: 'hermes_dispatcher_route_plan',
        hermes_in_route: true,
        hermes_called: false,
        live_adapter_status: 'blocked_safe_live_chat_adapter_not_configured',
        execution_enabled: false,
        writes_enabled: false,
        dispatch_executed: false,
      },
      execution_enabled: false,
      writes_enabled: false,
      hermes_called: false,
    })
    expect(payload.dispatch.route.final_commander).toBe('agent_zero')
    expect(payload.audit_event).toMatchObject({
      event: 'hermes.dispatcher.route_planned',
      execution_enabled: false,
      writes_enabled: false,
      hermes_called: false,
    })
  })
})
