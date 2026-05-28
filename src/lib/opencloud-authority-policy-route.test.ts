import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireRoleMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireRole: requireRoleMock,
}))

describe('OpenCloud authority policy route', () => {
  it('returns 401 before exposing the policy to unauthenticated requests', async () => {
    requireRoleMock.mockReturnValue({ error: 'Authentication required', status: 401 })
    const route = await import('@/app/api/bridge/opencloud/authority-policy/route')

    const response = await route.GET(new NextRequest('http://localhost/api/bridge/opencloud/authority-policy'))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ ok: false, error: 'Authentication required' })
  })

  it('publishes the demotion policy as a protected read-only Gateway contract', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'viewer' } })
    const route = await import('@/app/api/bridge/opencloud/authority-policy/route')

    const response = await route.GET(new NextRequest('http://localhost/api/bridge/opencloud/authority-policy'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      route: 'bridge.opencloud.authority-policy',
      state: 'READ_ONLY',
      opencloud_demoted: true,
      system_type: 'supporting_runtime_system',
      conversation_owner: 'none',
      direct_line_active: false,
      can_route_owner_messages: false,
      can_modify_production_directly: false,
      can_listen_to_other_agent_channels: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
    })
    expect(payload.allowed_roles).toContain('supporting_runtime_system')
    expect(payload.allowed_roles).toContain('tool_provider_when_invoked')
    expect(payload.forbidden_roles).toContain('conversation_owner')
    expect(payload.forbidden_roles).toContain('hidden_dispatcher')
  })
})
