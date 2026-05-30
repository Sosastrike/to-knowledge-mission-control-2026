import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireRoleMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireRole: requireRoleMock,
}))

vi.mock('@/lib/claudeclaw-telegram-approvals', () => ({
  hasClaudeClawDashboardToken: () => true,
}))

vi.mock('@/lib/build-wiki-run-now', () => ({
  readLatestRunNow: () => ({
    persistence_ready: true,
    approval: { id: 'approval_1', created_at: '2026-05-21T00:00:00.000Z' },
    run: null,
  }),
}))

describe('Brain Sync lane status routes', () => {
  beforeEach(() => {
    requireRoleMock.mockReset()
    vi.stubEnv('GRAPHIFY_GRAPH_PATH', '/tmp/mission-control-test-missing-graphify-lane-status.json')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 unauthenticated for canonical lane status routes', async () => {
    requireRoleMock.mockReturnValue({ error: 'Authentication required', status: 401 })

    const gateway = await import('@/app/api/bridge/brain-sync/gateway-status/route')
    const obsidian = await import('@/app/api/bridge/brain-sync/obsidian/status/route')
    const mempalace = await import('@/app/api/bridge/brain-sync/mempalace/status/route')
    const graphify = await import('@/app/api/bridge/brain-sync/graphify/status/route')
    const approvals = await import('@/app/api/bridge/brain-sync/memory-approvals/status/route')

    const responses = await Promise.all([
      gateway.GET(new NextRequest('http://localhost/api/bridge/brain-sync/gateway-status')),
      obsidian.GET(new NextRequest('http://localhost/api/bridge/brain-sync/obsidian/status')),
      mempalace.GET(new NextRequest('http://localhost/api/bridge/brain-sync/mempalace/status')),
      graphify.GET(new NextRequest('http://localhost/api/bridge/brain-sync/graphify/status')),
      approvals.GET(new NextRequest('http://localhost/api/bridge/brain-sync/memory-approvals/status')),
    ])

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401])
  })

  it('returns exact authenticated lane states without generic backend fallback', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'viewer' } })

    const gateway = await import('@/app/api/bridge/brain-sync/gateway-status/route')
    const obsidian = await import('@/app/api/bridge/brain-sync/obsidian/status/route')
    const mempalace = await import('@/app/api/bridge/brain-sync/mempalace/status/route')
    const graphify = await import('@/app/api/bridge/brain-sync/graphify/status/route')
    const approvals = await import('@/app/api/bridge/brain-sync/memory-approvals/status/route')

    const [gatewayPacket, obsidianPacket, mempalacePacket, graphifyPacket, approvalsPacket] = await Promise.all([
      gateway.GET(new NextRequest('http://localhost/api/bridge/brain-sync/gateway-status')).then((response) => response.json()),
      obsidian.GET(new NextRequest('http://localhost/api/bridge/brain-sync/obsidian/status')).then((response) => response.json()),
      mempalace.GET(new NextRequest('http://localhost/api/bridge/brain-sync/mempalace/status')).then((response) => response.json()),
      graphify.GET(new NextRequest('http://localhost/api/bridge/brain-sync/graphify/status')).then((response) => response.json()),
      approvals.GET(new NextRequest('http://localhost/api/bridge/brain-sync/memory-approvals/status')).then((response) => response.json()),
    ])

    expect(gatewayPacket).toMatchObject({
      route: 'bridge.brain-sync.gateway-status',
      obsidian: { state: 'WRITE_GATED' },
      mempalace: { state: 'WRITE_GATED' },
      graphify: { state: 'EVENT_STREAM_REQUIRED' },
      approvals: { state: 'WRITE_GATED' },
      credential_values_exposed: false,
    })
    expect(obsidianPacket.lane).toMatchObject({ id: 'obsidian', state: 'WRITE_GATED' })
    expect(mempalacePacket.lane).toMatchObject({ id: 'mempalace', state: 'WRITE_GATED' })
    expect(graphifyPacket.lane).toMatchObject({ id: 'graphify', state: 'EVENT_STREAM_REQUIRED' })
    expect(approvalsPacket.lane).toMatchObject({ id: 'memory-approvals', state: 'WRITE_GATED' })
    expect(JSON.stringify({ gatewayPacket, obsidianPacket, mempalacePacket, graphifyPacket, approvalsPacket })).not.toContain('"state":"BACKEND_REQUIRED"')
  })
})
