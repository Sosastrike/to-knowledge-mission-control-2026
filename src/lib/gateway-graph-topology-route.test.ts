import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = vi.hoisted(() => {
  type AuthResult = { error: string; status: number } | { user: { role: string } }
  return {
    requireRole: vi.fn<() => AuthResult>(() => ({ error: 'Authentication required', status: 401 })),
  }
})

vi.mock('@/lib/auth', () => authMock)

describe('/api/gateway/graph/topology route', () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.requireRole.mockReset()
    authMock.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
  })

  it('returns 401 to unauthenticated callers', async () => {
    const route = await import('@/app/api/gateway/graph/topology/route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/graph/topology'))

    expect(response.status).toBe(401)
  })

  it('returns sanitized canonical topology for authenticated viewers', async () => {
    authMock.requireRole.mockReturnValue({ user: { role: 'viewer' } })
    const route = await import('@/app/api/gateway/graph/topology/route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/graph/topology'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(authMock.requireRole).toHaveBeenCalledWith(expect.any(NextRequest), 'viewer')
    expect(payload).toMatchObject({
      ok: true,
      source: 'gateway_graph_topology',
      asset_version: 'gateway-topology-v1',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_executed: false,
      broad_connector_execution_enabled: false,
    })
    expect(payload.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        edge_id: 'highway.models.trunk',
        relationship: 'structural',
        route_group: 'models',
      }),
      expect.objectContaining({
        edge_id: 'model.xai_grok_to_gateway',
        relationship: 'readiness',
        status: 'live',
      }),
    ]))
    expect(JSON.stringify(payload)).not.toMatch(
      /Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i,
    )
  })
})

describe('/api/gateway/graph/sync-status route', () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.requireRole.mockReset()
    authMock.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
  })

  it('returns 401 to unauthenticated callers', async () => {
    const route = await import('@/app/api/gateway/graph/sync-status/route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/graph/sync-status'))

    expect(response.status).toBe(401)
  })

  it('returns sanitized graph sync status for authenticated viewers', async () => {
    authMock.requireRole.mockReturnValue({ user: { role: 'viewer' } })
    const route = await import('@/app/api/gateway/graph/sync-status/route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/graph/sync-status'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(payload).toMatchObject({
      ok: true,
      source: 'gateway_graph_sync_status',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_executed: false,
      broad_connector_execution_enabled: false,
      graph_sync: {
        status: 'healthy',
        primary_blocker: null,
      },
    })
    expect(payload.graph_sync.topology_edge_count).toBeGreaterThan(0)
    expect(payload.graph_sync.rendered_edge_count).toBe(payload.graph_sync.topology_edge_count)
    expect(JSON.stringify(payload)).not.toMatch(
      /Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i,
    )
  })
})
