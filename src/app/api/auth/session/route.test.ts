import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUserFromRequest = vi.fn()

vi.mock('@/lib/auth', () => ({
  getUserFromRequest,
}))

const luisUser = {
  id: 7,
  username: 'owner-account',
  display_name: 'Luis',
  role: 'admin',
  provider: 'local',
  email: 'luis@example.invalid',
  avatar_url: null,
  workspace_id: 1,
  tenant_id: 1,
  is_approved: 1,
  created_at: 1,
  updated_at: 1,
  last_login_at: 1,
}

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    vi.resetModules()
    getUserFromRequest.mockReset()
  })

  it('returns an unauthenticated sanitized shape without a session', async () => {
    getUserFromRequest.mockReturnValue(null)
    const { GET } = await import('./route')

    const response = await GET(new Request('https://tkmc.knowledge-vs-ai.com/api/auth/session'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      authenticated: false,
      actor_id: null,
      roles: [],
      allowed_operations: [],
      csrf_required: true,
    })
  })

  it('returns the verified backend actor without raw session material', async () => {
    getUserFromRequest.mockReturnValue(luisUser)
    const { GET } = await import('./route')

    const response = await GET(new Request('https://tkmc.knowledge-vs-ai.com/api/auth/session'))
    const payload = await response.json()

    expect(payload).toMatchObject({
      authenticated: true,
      actor_id: 'usr_7',
      display_name: 'Luis',
      account_type: 'human',
      roles: ['admin'],
    })
    expect(payload.allowed_operations).toContain('mission-control:logout')
    expect(JSON.stringify(payload).toLowerCase()).not.toMatch(/cookie|session-token|authorization|password/)
  })
})
