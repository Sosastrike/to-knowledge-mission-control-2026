import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(() => ({ error: 'Authentication required', status: 401 })),
}))

vi.mock('@/lib/agent-routing-lines', () => ({
  buildAgentRoutingLinesStatus: vi.fn(() => {
    throw new Error('agent routing lines must not build for unauthenticated requests')
  }),
  resolveAgentRoutingLine: vi.fn(() => {
    throw new Error('agent routing detail must not resolve for unauthenticated requests')
  }),
  routeAgentMessage: vi.fn(() => {
    throw new Error('agent routing send must not run for unauthenticated requests')
  }),
}))

describe('Agent routing route protection', () => {
  it('rejects unauthenticated universal direct-line routes before builders or senders run', async () => {
    const lines = await import('@/app/api/bridge/agent-routing/lines/route')
    const detail = await import('@/app/api/bridge/agent-routing/lines/[agent_id]/route')
    const send = await import('@/app/api/bridge/agent-routing/send/route')

    const responses = await Promise.all([
      lines.GET(new NextRequest('http://localhost/api/bridge/agent-routing/lines')),
      detail.GET(new NextRequest('http://localhost/api/bridge/agent-routing/lines/hermes'), {
        params: Promise.resolve({ agent_id: 'hermes' }),
      }),
      send.POST(new NextRequest('http://localhost/api/bridge/agent-routing/send', {
        method: 'POST',
        body: JSON.stringify({ target_agent: 'hermes', message: 'hello' }),
      })),
    ])

    for (const response of responses) {
      expect(response.status).toBe(401)
      expect(await response.json()).toMatchObject({ ok: false, error: 'Authentication required' })
    }
  })
})
