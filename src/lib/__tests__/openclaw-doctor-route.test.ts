import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  runOpenClaw: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/command', () => ({
  runOpenClaw: mocks.runOpenClaw,
}))

vi.mock('@/lib/config', () => ({
  config: {
    openclawStateDir: '/tmp/openclaw-test-state',
  },
}))

vi.mock('@/lib/db', () => ({
  getDatabase: vi.fn(),
}))

describe('OpenClaw+ doctor route closure payload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 'owner', username: 'owner' }, role: 'admin' })
  })

  it('returns a canonical SERVICE_DOWN blocker when the CLI is not reachable', async () => {
    mocks.runOpenClaw.mockRejectedValue(new Error('spawn openclaw ENOENT'))
    const route = await import('@/app/api/openclaw/doctor/route')

    const response = await route.GET(new Request('http://localhost/api/openclaw/doctor'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toMatchObject({
      error: 'OpenClaw is not installed or not reachable',
      canonical_status: 'SERVICE_DOWN',
      blocker_class: 'SERVICE_DOWN',
      blocker: 'openclaw_doctor_runtime_not_reachable',
      execution_enabled: false,
      writes_enabled: false,
      destructive_repair_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
      proof_packet: {
        lane: 'OpenClaw+',
        result: 'SERVICE_DOWN',
        blocker: 'openclaw_doctor_runtime_not_reachable',
        blocker_class: 'SERVICE_DOWN',
        execution_enabled: false,
        writes_enabled: false,
        destructive_repair_enabled: false,
        secrets_exposed: false,
        raw_paths_exposed: false,
      },
    })
    expect(JSON.stringify(payload)).not.toMatch(/sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|auth\.json|\/home\/tony/i)
  })

  it('rejects unauthenticated requests before invoking OpenClaw+', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
    const route = await import('@/app/api/openclaw/doctor/route')

    const response = await route.GET(new Request('http://localhost/api/openclaw/doctor'))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: 'Authentication required' })
    expect(mocks.runOpenClaw).not.toHaveBeenCalled()
  })
})
