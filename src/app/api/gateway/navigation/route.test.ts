import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

import { GET } from './route'

describe('Gateway navigation metadata route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', workspace_id: 1, tenant_id: 1 } })
  })

  it('returns safe breadcrumbs and app/home/back targets', async () => {
    const response = await GET(new Request('http://mission-control.test/api/gateway/navigation?route=/gateway/agent-hub') as NextRequest)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'gateway_navigation_metadata',
      targets: {
        mission_control_home: '/',
        safe_back: '/gateway',
        gateway_overview: '/gateway',
        agent_hub: '/gateway/agent-hub',
      },
    })
    expect(payload.breadcrumbs.map((crumb: any) => crumb.breadcrumb_label)).toEqual(['Mission Control', 'Gateway', 'Agent Hub'])
  })

  it('returns safe breadcrumbs for the mounted Paperclip Agent Hub page', async () => {
    const response = await GET(new Request('http://mission-control.test/api/gateway/navigation?route=/gateway/agent-hub/paperclip') as NextRequest)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'gateway_navigation_metadata',
      targets: {
        mission_control_home: '/',
        safe_back: '/gateway/agent-hub',
        gateway_overview: '/gateway',
        agent_hub: '/gateway/agent-hub',
      },
    })
    expect(payload.breadcrumbs.map((crumb: any) => crumb.breadcrumb_label)).toEqual(['Mission Control', 'Gateway', 'Agent Hub', 'Paperclip'])
  })

  it('classifies unknown routes without exposing raw errors', async () => {
    const response = await GET(new Request('http://mission-control.test/api/gateway/navigation?route=/gateway/missing') as NextRequest)
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.classified_error).toMatchObject({ kind: 'ROUTE_MISSING' })
    expect(JSON.stringify(payload)).not.toMatch(/\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)
  })
})
