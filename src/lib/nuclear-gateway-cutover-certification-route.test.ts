import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireRoleMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireRole: requireRoleMock,
}))

describe('Nuclear Gateway cutover certification route', () => {
  it('requires authentication', async () => {
    requireRoleMock.mockReturnValue({ error: 'Authentication required', status: 401 })
    const route = await import('@/app/api/bridge/nuclear-gateway/cutover-certification/route')

    const response = await route.GET(new NextRequest('http://localhost/api/bridge/nuclear-gateway/cutover-certification'))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ ok: false, error: 'Authentication required' })
  })

  it('returns owner-safe source-only Phase 10 preflight truth', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'viewer' } })
    const route = await import('@/app/api/bridge/nuclear-gateway/cutover-certification/route')

    const response = await route.GET(new NextRequest('http://localhost/api/bridge/nuclear-gateway/cutover-certification'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      state: 'READ_ONLY',
      route: 'bridge.nuclear-gateway.cutover-certification',
      final_status: 'CUTOVER_NOT_CERTIFIED',
      cutover_allowed: false,
      disable_openclaw_service_allowed: false,
      openclaw_service_mutation_performed: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      external_writes_enabled: false,
    })
    expect(payload.criteria_count).toBeGreaterThanOrEqual(10)
  })
})
