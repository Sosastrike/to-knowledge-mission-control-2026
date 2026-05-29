import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const requireRoleMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireRole: requireRoleMock,
}))

describe('Nuclear Gateway task dispatch adapter route', () => {
  it('requires authentication for status', async () => {
    requireRoleMock.mockReturnValue({ error: 'Authentication required', status: 401 })
    const route = await import('@/app/api/bridge/nuclear-gateway/task-dispatch-adapter/route')

    const response = await route.GET(new NextRequest('http://localhost/api/bridge/nuclear-gateway/task-dispatch-adapter'))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ ok: false, error: 'Authentication required' })
  })

  it('returns source-ready adapter status for authenticated viewers', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'viewer' } })
    const route = await import('@/app/api/bridge/nuclear-gateway/task-dispatch-adapter/route')

    const response = await route.GET(new NextRequest('http://localhost/api/bridge/nuclear-gateway/task-dispatch-adapter'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      state: 'READ_ONLY',
      route: 'bridge.nuclear-gateway.task-dispatch-adapter',
      status: 'SOURCE_READY_EXECUTION_BLOCKED',
      openclaw_runtime_invoked: false,
      execution_enabled: false,
      writes_enabled: false,
      credential_values_exposed: false,
    })
  })

  it('previews a direct-line task dispatch envelope without executing writes', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'operator' } })
    const route = await import('@/app/api/bridge/nuclear-gateway/task-dispatch-adapter/route')

    const response = await route.POST(new NextRequest('http://localhost/api/bridge/nuclear-gateway/task-dispatch-adapter', {
      method: 'POST',
      body: JSON.stringify({
        dispatch_kind: 'task_dispatch_new_session',
        target_agent: 'ron',
        message: 'Preview dispatch only.',
        visible_task_id: '140',
      }),
    }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      exact_blocker: 'execution_blocked_until_live_receive_audit_and_rollback_proof',
      target_agent: 'ron-weasley',
      direct_line_used: true,
      route_trace: ['owner', 'mission-control', 'nuclear-gateway', 'ron-weasley'],
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      credential_values_exposed: false,
    })
  })

  it('refuses OpenClaw as task dispatch owner', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'operator' } })
    const route = await import('@/app/api/bridge/nuclear-gateway/task-dispatch-adapter/route')

    const response = await route.POST(new NextRequest('http://localhost/api/bridge/nuclear-gateway/task-dispatch-adapter', {
      method: 'POST',
      body: JSON.stringify({
        dispatch_kind: 'task_broadcast',
        target_agent: 'openclaw',
        message: 'Use OpenClaw as owner.',
      }),
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      ok: false,
      exact_blocker: 'openclaw_cannot_be_task_dispatch_conversation_owner',
      execution_enabled: false,
    })
  })
})
