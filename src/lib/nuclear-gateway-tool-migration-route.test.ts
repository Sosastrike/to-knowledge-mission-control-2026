import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireRoleMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireRole: requireRoleMock,
}))

describe('Nuclear Gateway tool migration route', () => {
  it('requires authentication before returning the migration map', async () => {
    requireRoleMock.mockReturnValue({ error: 'Authentication required', status: 401 })
    const route = await import('@/app/api/bridge/nuclear-gateway/tool-migration/route')

    const response = await route.GET(new NextRequest('http://localhost/api/bridge/nuclear-gateway/tool-migration'))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ ok: false, error: 'Authentication required' })
  })

  it('returns the owner-safe Phase 6 tool migration map', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'viewer' } })
    const route = await import('@/app/api/bridge/nuclear-gateway/tool-migration/route')

    const response = await route.GET(new NextRequest('http://localhost/api/bridge/nuclear-gateway/tool-migration'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      state: 'READ_ONLY',
      route: 'bridge.nuclear-gateway.tool-migration',
      status: 'PHASE_6_TOOL_MCP_MIGRATION_MAP_READY',
      openclaw_tool_broker_of_record: false,
      gateway_tool_broker_of_record: true,
      credential_values_exposed: false,
      no_secrets_exposed: true,
    })
    expect(payload.entries.length).toBeGreaterThanOrEqual(9)
  })
})
