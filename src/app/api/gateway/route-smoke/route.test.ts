import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

import { GET } from './route'

describe('Gateway route smoke route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', workspace_id: 1, tenant_id: 1 } })
  })

  it('returns a safe diagnostics table instead of raw route errors', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/')) {
        return new Response('', { status: 200 })
      }
      return new Response('', {
        status: 307,
        headers: { location: '/login' },
      })
    }) as any

    try {
      const response = await GET(new Request('http://mission-control.test/api/gateway/route-smoke') as NextRequest)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.mode).toBe('gateway_route_smoke_diagnostics')
      expect(payload.report.routes.length).toBeGreaterThan(0)
      expect(payload.table[0]).toEqual(expect.objectContaining({
        label: 'Mission Control Home',
        path: '/',
      }))
      expect(JSON.stringify(payload)).not.toMatch(/mission-control\.test|\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
