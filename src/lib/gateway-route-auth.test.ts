import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(() => ({ error: 'Authentication required', status: 401 })),
}))

vi.mock('@/lib/gateway-registry-api', () => ({
  loadGatewayRegistry: vi.fn(() => {
    throw new Error('loadGatewayRegistry should not run for unauthenticated Gateway routes')
  }),
  buildGatewayStatusPayload: vi.fn(),
  buildGatewayFlowsPayload: vi.fn(),
  buildGatewayPoliciesPayload: vi.fn(),
  getGatewayNodeDetail: vi.fn(),
}))

describe('Gateway route authentication policy', () => {
  it('rejects unauthenticated Gateway routes before registry loading', async () => {
    const registry = await import('@/app/api/gateway/registry/route')
    const status = await import('@/app/api/gateway/status/route')
    const nodes = await import('@/app/api/gateway/nodes/[id]/route')
    const flows = await import('@/app/api/gateway/flows/route')
    const policies = await import('@/app/api/gateway/policies/route')

    const checks = [
      registry.GET(new NextRequest('http://localhost/api/gateway/registry')),
      status.GET(new NextRequest('http://localhost/api/gateway/status')),
      nodes.GET(new NextRequest('http://localhost/api/gateway/nodes/agent_zero'), {
        params: Promise.resolve({ id: 'agent_zero' }),
      }),
      flows.GET(new NextRequest('http://localhost/api/gateway/flows')),
      policies.GET(new NextRequest('http://localhost/api/gateway/policies')),
    ]

    const responses = await Promise.all(checks)
    for (const response of responses) {
      expect([401, 403]).toContain(response.status)
      expect(await response.json()).toMatchObject({ error: 'Authentication required' })
    }
  })
})
