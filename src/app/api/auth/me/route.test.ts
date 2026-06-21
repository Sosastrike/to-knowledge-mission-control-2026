import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireRole = vi.fn()
const getUserFromRequest = vi.fn()
const updateUser = vi.fn()
const destroyAllUserSessions = vi.fn()
const createSession = vi.fn()
const logAuditEvent = vi.fn()
const verifyPassword = vi.fn()
const passwordChangeLimiter = vi.fn()

vi.mock('@/lib/auth', () => ({
  requireRole,
  getUserFromRequest,
  updateUser,
  destroyAllUserSessions,
  createSession,
}))

vi.mock('@/lib/db', () => ({
  logAuditEvent,
}))

vi.mock('@/lib/password', () => ({
  verifyPassword,
}))

vi.mock('@/lib/rate-limit', () => ({
  passwordChangeLimiter,
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
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

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.resetModules()
    requireRole.mockReset()
    getUserFromRequest.mockReset()
    updateUser.mockReset()
    destroyAllUserSessions.mockReset()
    createSession.mockReset()
    logAuditEvent.mockReset()
    verifyPassword.mockReset()
    passwordChangeLimiter.mockReset()
  })

  it('returns a sanitized backend-issued actor session contract', async () => {
    requireRole.mockReturnValue({ user: luisUser })
    getUserFromRequest.mockReturnValue(luisUser)
    const { GET } = await import('./route')

    const response = await GET(new Request('https://tkmc.knowledge-vs-ai.com/api/auth/me'))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      authenticated: true,
      actor_id: 'usr_7',
      display_name: 'Luis',
      account_type: 'human',
      roles: ['admin'],
      csrf_required: true,
      user: {
        id: 7,
        display_name: 'Luis',
        role: 'admin',
      },
    })
    expect(payload.allowed_operations).toContain('mission-control:logout')
    expect(payload.allowed_operations).toContain('mission-control:agent-platform:read')

    const serialized = JSON.stringify(payload).toLowerCase()
    expect(serialized).not.toContain('session-token')
    expect(serialized).not.toContain('password')
    expect(serialized).not.toContain('cookie')
    expect(serialized).not.toContain('authorization')
  })
})
