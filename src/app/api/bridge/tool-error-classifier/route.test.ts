import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

import { POST } from './route'

function request(body: unknown = {}) {
  return new Request('http://mission-control.test/api/bridge/tool-error-classifier', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('tool error classifier route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({
      user: { id: 1, username: 'owner', display_name: 'Owner', role: 'viewer', workspace_id: 1, tenant_id: 1 },
    })
  })

  it('returns canonical owner-facing classified tool errors without leaking raw detail', async () => {
    const response = await POST(request({
      errors: [
        {
          http_status: 503,
          message: 'connect ECONNREFUSED http://127.0.0.1:9999',
          technical_detail: 'service failed with API_KEY=secret-value at /Users/sosastrike/private',
        },
        {
          http_status: 401,
          message: 'authentication required',
        },
      ],
    }) as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'tool_error_classification',
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      classifications: [
        { kind: 'SERVICE_DOWN' },
        { kind: 'AUTH_REQUIRED' },
      ],
    })
    expect(payload.allowed_error_kinds).toContain('BACKEND_MISSING')
    expect(JSON.stringify(payload)).not.toContain('secret-value')
    expect(JSON.stringify(payload)).not.toContain('/Users/sosastrike')
    expect(JSON.stringify(payload)).not.toContain('127.0.0.1')
  })

  it('accepts one error object for compact route callers', async () => {
    const response = await POST(request({ http_status: 423, message: 'approval required' }) as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.classifications).toEqual([
      expect.objectContaining({ kind: 'OWNER_GATED', owner_action_required: true }),
    ])
  })

  it('keeps authentication required', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })

    const response = await POST(request({ http_status: 404 }) as any)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ ok: false, error: 'Authentication required' })
  })
})
