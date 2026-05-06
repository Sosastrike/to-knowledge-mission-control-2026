import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createGatewayRegistryFromAgentNetwork } from './gateway-model'
import { clearSpaceAgentJobStoreForTests } from './space-agent-api'

const requireRoleMock = vi.hoisted(() => vi.fn())
const loadGatewayRegistryMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireRole: requireRoleMock,
}))

vi.mock('@/lib/gateway-registry-api', async () => {
  const actual = await vi.importActual<typeof import('./gateway-registry-api')>('@/lib/gateway-registry-api')
  return {
    ...actual,
    loadGatewayRegistry: loadGatewayRegistryMock,
  }
})

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

async function json(response: Response) {
  return await response.json() as Record<string, any>
}

function expectOwnerSafe(payload: unknown) {
  const serialized = JSON.stringify(payload)
  expect(serialized).not.toMatch(/API_KEY=abc123|Bearer\s+abc123|\/home\/owner|auth\.json/i)
  expect(serialized).toMatch(/"execution_enabled":false/)
}

describe('Space Agent Gateway and Bridge routes', () => {
  beforeEach(() => {
    requireRoleMock.mockReset()
    loadGatewayRegistryMock.mockReset()
    clearSpaceAgentJobStoreForTests()
    loadGatewayRegistryMock.mockResolvedValue(createGatewayRegistryFromAgentNetwork({
      generatedAt: '2026-05-06T00:00:00.000Z',
    }))
  })

  it('rejects unauthenticated Space Agent routes before loading Gateway state', async () => {
    requireRoleMock.mockReturnValue({ error: 'Authentication required', status: 401 })
    const nodeAlias = await import('@/app/api/gateway/nodes/space-agent/route')
    const status = await import('@/app/api/bridge/space-agent/status/route')
    const testChat = await import('@/app/api/bridge/space-agent/test-chat/route')
    const research = await import('@/app/api/gateway/space-agent/research/route')
    const job = await import('@/app/api/gateway/space-agent/jobs/[id]/route')

    const responses = await Promise.all([
      nodeAlias.GET(request('http://localhost/api/gateway/nodes/space-agent')),
      status.GET(request('http://localhost/api/bridge/space-agent/status')),
      testChat.POST(request('http://localhost/api/bridge/space-agent/test-chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Can you see Gateway?' }),
      })),
      research.POST(request('http://localhost/api/gateway/space-agent/research', {
        method: 'POST',
        body: JSON.stringify({ request: 'Research a public page.' }),
      })),
      job.GET(request('http://localhost/api/gateway/space-agent/jobs/missing'), {
        params: Promise.resolve({ id: 'missing' }),
      }),
    ])

    for (const response of responses) {
      expect([401, 403]).toContain(response.status)
      expect(await response.json()).toMatchObject({ error: 'Authentication required' })
    }
    expect(loadGatewayRegistryMock).not.toHaveBeenCalled()
  })

  it('returns authenticated read-only Space Agent status and node detail without secrets', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'operator' } })
    const nodeAlias = await import('@/app/api/gateway/nodes/space-agent/route')
    const status = await import('@/app/api/bridge/space-agent/status/route')

    const nodeResponse = await nodeAlias.GET(request('http://localhost/api/gateway/nodes/space-agent'))
    const statusResponse = await status.GET(request('http://localhost/api/bridge/space-agent/status'))
    const nodePayload = await json(nodeResponse)
    const statusPayload = await json(statusResponse)

    expect(nodeResponse.status).toBe(200)
    expect(nodePayload.node).toMatchObject({
      id: 'space_agent',
      type: 'specialist_agent',
      execution_enabled: false,
      write_enabled: false,
    })
    expect(statusResponse.status).toBe(200)
    expect(statusPayload).toMatchObject({
      mode: 'space_agent_status_read_only',
      health: 'blocked',
      firecrawl: {
        credential_configured: false,
        blocked_reason: 'firecrawl_missing_credential',
      },
      browser: {
        configured: false,
        runtime_adapter_configured: false,
        bridge_session_required: true,
        execution_enabled: false,
      },
      youtube: {
        transcript_path_configured: true,
        runtime_adapter_configured: false,
        execution_enabled: false,
      },
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expectOwnerSafe(statusPayload)
  })

  it('keeps test-chat safely blocked until a live Space Agent adapter is configured', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'operator' } })
    const testChat = await import('@/app/api/bridge/space-agent/test-chat/route')

    const response = await testChat.POST(request('http://localhost/api/bridge/space-agent/test-chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Can you see Gateway? API_KEY=abc123' }),
    }))
    const payload = await json(response)

    expect(response.status).toBe(503)
    expect(payload).toMatchObject({
      mode: 'space_agent_read_only_test_chat',
      space_agent_called: false,
      live_chat_status: 'blocked_safe_live_adapter_not_configured',
      blocker: 'space_agent_runtime_adapter_not_configured',
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(payload.prompt).toContain('[redacted-secret]')
    expectOwnerSafe(payload)
  })

  it('creates read-only research packets, stores job lookup, and blocks protected browser work', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'operator' } })
    const research = await import('@/app/api/gateway/space-agent/research/route')
    const job = await import('@/app/api/gateway/space-agent/jobs/[id]/route')

    const planned = await research.POST(request('http://localhost/api/gateway/space-agent/research', {
      method: 'POST',
      body: JSON.stringify({ request: 'Use Firecrawl to crawl a public documentation page.' }),
    }))
    const plannedPayload = await json(planned)
    const jobId = plannedPayload.job.id as string
    const jobResponse = await job.GET(request(`http://localhost/api/gateway/space-agent/jobs/${jobId}`), {
      params: Promise.resolve({ id: jobId }),
    })
    const jobPayload = await json(jobResponse)

    expect(planned.status).toBe(200)
    expect(plannedPayload).toMatchObject({
      mode: 'space_agent_research_packet_planning',
      accepted_for_execution: false,
      research_performed: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(plannedPayload.packet.firecrawl_status).toBe('blocked_missing_credential')
    expect(jobResponse.status).toBe(200)
    expect(jobPayload.job.id).toBe(jobId)
    expectOwnerSafe(plannedPayload)

    const blocked = await research.POST(request('http://localhost/api/gateway/space-agent/research', {
      method: 'POST',
      body: JSON.stringify({ request: 'Log in with owner credentials and inspect a private dashboard.' }),
    }))
    const blockedPayload = await json(blocked)

    expect(blocked.status).toBe(423)
    expect(blockedPayload).toMatchObject({
      ok: false,
      accepted_for_execution: false,
      research_performed: false,
      bridge_session_required: true,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(blockedPayload.blocked_reason).toBe('owner_credentials_not_approved')
    expectOwnerSafe(blockedPayload)
  })
})
