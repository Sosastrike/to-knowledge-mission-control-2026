import { beforeEach, describe, expect, it, vi } from 'vitest'

const destroySession = vi.fn()
const getUserFromRequest = vi.fn()
const logAuditEvent = vi.fn()

vi.mock('@/lib/auth', () => ({
  destroySession,
  getUserFromRequest,
}))

vi.mock('@/lib/db', () => ({
  logAuditEvent,
}))

function setCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie()
  const raw = response.headers.get('set-cookie')
  return raw ? [raw] : []
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.resetModules()
    destroySession.mockReset()
    getUserFromRequest.mockReset()
    logAuditEvent.mockReset()
  })

  it('requires an authenticated session before logout succeeds', async () => {
    getUserFromRequest.mockReturnValue(null)
    const { POST } = await import('./route')

    const response = await POST(new Request('https://tkmc.knowledge-vs-ai.com/api/auth/logout', { method: 'POST' }))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ ok: false, error: 'Authentication required' })
    expect(destroySession).not.toHaveBeenCalled()
  })

  it('rejects cross-origin logout requests before touching the session', async () => {
    getUserFromRequest.mockReturnValue({ id: 7, username: 'luis', role: 'admin' })
    const { POST } = await import('./route')

    const response = await POST(new Request('https://tkmc.knowledge-vs-ai.com/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: '__Host-mc-session=session-token',
        host: 'tkmc.knowledge-vs-ai.com',
        origin: 'https://evil.example',
      },
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ ok: false, error: 'CSRF origin mismatch' })
    expect(destroySession).not.toHaveBeenCalled()
  })

  it('invalidates all Mission Control session cookies and clears both current and legacy cookie names', async () => {
    getUserFromRequest.mockReturnValue({ id: 7, username: 'luis', role: 'admin' })
    const { POST } = await import('./route')

    const response = await POST(new Request('https://tkmc.knowledge-vs-ai.com/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: '__Host-mc-session=current-token; mc-session=legacy-token',
        host: 'tkmc.knowledge-vs-ai.com',
        origin: 'https://tkmc.knowledge-vs-ai.com',
        'x-forwarded-for': '203.0.113.7',
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, authenticated: false })
    expect(destroySession).toHaveBeenCalledWith('current-token')
    expect(destroySession).toHaveBeenCalledWith('legacy-token')
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'logout',
      actor_id: 7,
      ip_address: '203.0.113.7',
    }))

    const cookies = setCookieHeaders(response).join('\n')
    expect(cookies).toContain('__Host-mc-session=')
    expect(cookies).toContain('mc-session=')
    expect(cookies.toLowerCase()).toContain('httponly')
    expect(cookies.toLowerCase()).toContain('samesite=strict')
  })
})
