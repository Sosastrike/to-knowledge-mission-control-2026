import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getBrainSyncStatus: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('../status/route', () => ({
  GET: mocks.getBrainSyncStatus,
}))

import { GET } from './route'

function request(url = 'http://mission-control.test/api/bridge/brain-sync/knowledge-report') {
  return new Request(url)
}

describe('Brain Sync knowledge report route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', workspace_id: 1, tenant_id: 1 } })
    mocks.getBrainSyncStatus.mockResolvedValue(Response.json({
      generated_at: '2026-05-09T22:40:00.000Z',
      sources: [
        {
          source: 'obsidian',
          status: 'read_only',
          count: 4,
          last_known_sync_at: '2026-05-09T12:00:00.000Z',
          summary: 'Vault at /Users/sosastrike/private/vault is visible.',
          details: { indexed: true },
          owner_status: { status: 'READY' },
        },
        {
          source: 'graphify',
          status: 'not_connected',
          last_error: '/home/tony/.graphify missing',
          owner_status: { status: 'SERVICE_DOWN' },
        },
      ],
      brain_sync: {
        production_memory_writes_enabled: false,
        external_connector_writes_enabled: false,
      },
    }))
  })

  it('returns a safe owner-facing knowledge report', async () => {
    const response = await GET(request() as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.mode).toBe('knowledge_report')
    expect(payload.summary).toMatchObject({ indexed: 1, blocked: 1, last_sync_at: '2026-05-09T12:00:00.000Z' })
    expect(payload.links).toMatchObject({
      brain: '/gateway/brain',
      bridge_session: '/gateway/bridge-session',
    })
    expect(payload.safety).toMatchObject({
      raw_local_paths_exposed: false,
      memory_writes_enabled: false,
      external_writes_enabled: false,
    })
    expect(JSON.stringify(payload)).not.toMatch(/\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)
  })

  it('keeps authentication required', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })

    const response = await GET(request() as any)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Authentication required' })
  })
})
