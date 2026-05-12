import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  loadGatewayRegistry: vi.fn(),
  buildAgentHubAgentHealthPayload: vi.fn(),
  buildCloudCodeAgentHealth: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/gateway-registry-api', () => ({
  loadGatewayRegistry: mocks.loadGatewayRegistry,
}))

vi.mock('@/lib/gateway-agent-hub', () => ({
  buildAgentHubAgentHealthPayload: mocks.buildAgentHubAgentHealthPayload,
}))

vi.mock('@/lib/gateway-cloudcode-integration', async () => {
  const actual = await vi.importActual<typeof import('@/lib/gateway-cloudcode-integration')>('@/lib/gateway-cloudcode-integration')
  return {
    ...actual,
    buildCloudCodeAgentHealth: mocks.buildCloudCodeAgentHealth,
  }
})

import { GET } from './route'

function request(id: string) {
  return new Request(`http://mission-control.test/api/gateway/agent-hub/agents/${id}/health`) as NextRequest
}

describe('Agent Hub agent health route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', workspace_id: 1, tenant_id: 1 } })
    mocks.loadGatewayRegistry.mockResolvedValue({ generated_at: '2026-05-11T12:00:00.000Z' })
    mocks.buildAgentHubAgentHealthPayload.mockReturnValue({
      ok: true,
      mode: 'gateway_agent_hub_agent_health_read_only',
      generated_at: '2026-05-11T12:00:00.000Z',
      agent_id: 'pi-mono',
      registry_node_id: 'pi',
      status: 'read_only',
      gateway_health: 'read_only',
      connected: true,
      configured: true,
      live_interface_proven: true,
      called_true_proven: false,
      last_success: null,
      last_error: null,
      blocker: null,
      owner_status: { status: 'READY', can_read: true },
      execution_enabled: false,
      writes_enabled: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    })
    mocks.buildCloudCodeAgentHealth.mockReturnValue([
      { id: 'agent_zero', label: 'Agent Zero', status: 'READ_ONLY' },
      { id: 'pi', label: 'Pi', status: 'READ_ONLY' },
    ])
  })

  it('returns the requested agent health row instead of the first CloudCode roster row', async () => {
    const response = await GET(request('pi-mono'), { params: Promise.resolve({ id: 'pi-mono' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.agent_id).toBe('pi-mono')
    expect(payload.cloudcode_agent_health).toMatchObject({ id: 'pi', status: 'READ_ONLY' })
    expect(payload.cloudcode_agent_health.id).not.toBe('agent_zero')
    expect(payload.cloudcode_agent_health_rows.map((row: any) => row.id)).toEqual(['pi'])
  })
})
