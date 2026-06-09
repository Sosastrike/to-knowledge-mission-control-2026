import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = vi.hoisted(() => {
  type AuthResult = { error: string; status: number } | { user: { role: string } }
  return {
    requireRole: vi.fn<() => AuthResult>(() => ({ error: 'Authentication required', status: 401 })),
  }
})

vi.mock('@/lib/auth', () => authMock)

describe('/api/gateway/graph/edge-readiness route', () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.requireRole.mockReset()
    authMock.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
  })

  it('returns 401 to unauthenticated callers', async () => {
    const route = await import('@/app/api/gateway/graph/edge-readiness/route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/graph/edge-readiness'))

    expect(response.status).toBe(401)
  })

  it('returns sanitized edge readiness for authenticated viewers', async () => {
    authMock.requireRole.mockReturnValue({ user: { role: 'viewer' } })
    const route = await import('@/app/api/gateway/graph/edge-readiness/route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/graph/edge-readiness'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(authMock.requireRole).toHaveBeenCalledWith(expect.any(NextRequest), 'viewer')
    expect(payload).toMatchObject({
      ok: true,
      source: 'gateway_graph_edge_readiness',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_executed: false,
      broad_connector_execution_enabled: false,
    })
    expect(payload.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        edge_id: 'browser.firefox_to_gateway',
        status: 'standby',
        color: 'gray',
        primary_reason: 'firefox_runtime_not_connected',
      }),
      expect.objectContaining({
        edge_id: 'webhooks.inbound_to_gateway',
        status: 'standby',
        color: 'gray',
        primary_reason: 'webhook_receiver_ready_no_recent_events',
      }),
    ]))
    expect(JSON.stringify(payload)).not.toMatch(
      /Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i,
    )
  })
})
