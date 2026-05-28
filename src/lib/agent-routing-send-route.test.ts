import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const routeAgentMessageMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(() => ({
    id: 1,
    username: 'owner',
    display_name: 'Owner',
    role: 'operator',
    workspace_id: 1,
    tenant_id: 1,
    created_at: 0,
    updated_at: 0,
    last_login_at: null,
  })),
}))

vi.mock('@/lib/agent-routing-lines', () => ({
  routeAgentMessage: routeAgentMessageMock,
}))

describe('Agent routing send route blocker statuses', () => {
  beforeEach(() => {
    vi.resetModules()
    routeAgentMessageMock.mockReset()
  })

  it('returns 403 for every hidden intermediary blocker, not only OpenCloud/OpenClaw', async () => {
    routeAgentMessageMock.mockReturnValue({
      ok: false,
      exact_blocker: 'hidden_intermediary_forbidden',
      project_continues: true,
      credential_values_exposed: false,
    })

    const send = await import('@/app/api/bridge/agent-routing/send/route')
    const response = await send.POST(new NextRequest('http://localhost/api/bridge/agent-routing/send', {
      method: 'POST',
      body: JSON.stringify({
        target_agent: 'hermes',
        intermediaries: ['legacy-transport-layer'],
      }),
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      ok: false,
      exact_blocker: 'hidden_intermediary_forbidden',
      project_continues: true,
      credential_values_exposed: false,
    })
  })

  it('keeps OpenCloud hidden-intermediary and missing-line statuses scoped', async () => {
    const send = await import('@/app/api/bridge/agent-routing/send/route')

    routeAgentMessageMock.mockReturnValueOnce({
      ok: false,
      exact_blocker: 'opencloud_hidden_intermediary_forbidden',
      project_continues: true,
      credential_values_exposed: false,
    })
    routeAgentMessageMock.mockReturnValueOnce({
      ok: false,
      exact_blocker: 'agent_direct_line_missing_visible_ticket_required',
      project_continues: true,
      credential_values_exposed: false,
    })

    const opencloud = await send.POST(new NextRequest('http://localhost/api/bridge/agent-routing/send', {
      method: 'POST',
      body: JSON.stringify({ target_agent: 'jarvis', intermediaries: ['openclaw'] }),
    }))
    const missing = await send.POST(new NextRequest('http://localhost/api/bridge/agent-routing/send', {
      method: 'POST',
      body: JSON.stringify({ target_agent: 'not-registered' }),
    }))

    expect(opencloud.status).toBe(403)
    expect(missing.status).toBe(404)
  })
})
