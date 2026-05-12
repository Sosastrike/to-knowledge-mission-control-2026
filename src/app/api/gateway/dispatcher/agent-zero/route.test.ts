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

describe('/api/gateway/dispatcher/agent-zero', () => {
  it('returns a read-only Agent Zero dispatcher status on GET', async () => {
    const route = await import('./route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/dispatcher/agent-zero'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'agent_zero_dispatcher_status',
      agent_id: 'agent-zero',
      commander: true,
      execution_enabled: false,
      writes_enabled: false,
      dispatch_executed: false,
    })
  })

  it('returns a safe route plan on POST without executing the request', async () => {
    const route = await import('./route')
    const request = new NextRequest('http://localhost/api/gateway/dispatcher/agent-zero', {
      method: 'POST',
      body: JSON.stringify({ owner_request: 'Send a status report to the owner' }),
    })
    const response = await route.POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'agent_zero_dispatcher_route',
      dispatch: {
        mode: 'agent_zero_dispatcher_route_plan',
        agent_zero_in_route: true,
        execution_enabled: false,
        writes_enabled: false,
        dispatch_executed: false,
      },
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(payload.audit_event).toMatchObject({
      event: 'agent_zero.dispatcher.route_planned',
      execution_enabled: false,
      writes_enabled: false,
    })
  })
})
