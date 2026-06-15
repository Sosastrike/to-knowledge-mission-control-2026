import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = vi.hoisted(() => {
  type AuthResult = { error: string; status: number } | { user: { role: string } }
  return {
    requireRole: vi.fn<() => AuthResult>(() => ({ error: 'Authentication required', status: 401 })),
  }
})

vi.mock('@/lib/auth', () => authMock)

describe('/api/gateway/graph/node-readiness route', () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.requireRole.mockReset()
    authMock.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
  })

  it('returns 401 to unauthenticated callers', async () => {
    const route = await import('@/app/api/gateway/graph/node-readiness/route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/graph/node-readiness'))

    expect(response.status).toBe(401)
  })

  it('returns sanitized node readiness for authenticated viewers', async () => {
    authMock.requireRole.mockReturnValue({ user: { role: 'viewer' } })
    const route = await import('@/app/api/gateway/graph/node-readiness/route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/graph/node-readiness'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(authMock.requireRole).toHaveBeenCalledWith(expect.any(NextRequest), 'viewer')
    expect(payload).toMatchObject({
      ok: true,
      source: 'gateway_graph_node_readiness',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_executed: false,
      broad_connector_execution_enabled: false,
    })
    expect(payload.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        node_id: 'int.zapier',
        status: 'read_only',
        color: 'cyan',
        primary_reason: 'zapier_discovery_ready_writes_guarded',
      }),
      expect.objectContaining({
        node_id: 'int.agentmail',
        status: 'live',
        color: 'green',
        primary_reason: 'approval_gated_send_ready',
        setup_state: 'approval_gated_send_ready',
        per_action_state: 'no_pending_send_request',
      }),
    ]))
    expect(payload.graph_health.node_count_returned).toBe(46)
    expect(JSON.stringify(payload)).not.toMatch(
      /Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i,
    )
  })
})
