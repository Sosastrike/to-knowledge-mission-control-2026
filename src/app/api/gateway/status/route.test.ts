import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  loadGatewayRegistry: vi.fn(),
  buildGatewayStatusPayload: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/gateway-registry-api', () => ({
  loadGatewayRegistry: mocks.loadGatewayRegistry,
  buildGatewayStatusPayload: mocks.buildGatewayStatusPayload,
}))

import { GET } from './route'

function request() {
  return new Request('http://mission-control.test/api/gateway/status') as NextRequest
}

describe('Gateway status route CloudCode truth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', workspace_id: 1, tenant_id: 1 } })
    mocks.loadGatewayRegistry.mockResolvedValue({ generated_at: '2026-05-09T12:00:00.000Z' })
    mocks.buildGatewayStatusPayload.mockReturnValue({
      ok: true,
      generated_at: '2026-05-09T12:00:00.000Z',
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      agent_zero: {
        id: 'agent_zero',
        label: 'Agent Zero',
        status: 'connected',
        health: { status: 'connected', summary: 'commander route reachable' },
        blockers: [],
      },
      hermes: {
        id: 'hermes',
        label: 'Hermes',
        status: 'degraded',
        health: { status: 'degraded', summary: 'gated' },
        blockers: ['owner_approval_pending'],
      },
      bridge_mcp: { visible: true, providers: 2, mcp_servers: 1, mcp_tools_visible: true, execution_enabled: false },
      mcp_gateway: { servers: [], tools_integrations: [] },
      llm_gateway: { providers: [] },
      brain_systems: [],
      buildwiki_openclaw: {
        service_active: false,
        service_state: 'inactive',
        timer_active: true,
        timer_state: 'active',
        last_run_status: null,
        run_now_target_service: 'opencloud-docs-farmer.service',
        blockers: ['bridge_session_required'],
      },
      safety: {
        auth_required: true,
        secrets_exposed: false,
        raw_paths_exposed: false,
        bridge_session_required_for_writes: true,
      },
    })
  })

  it('adds normalized owner-facing status and navigation metadata', async () => {
    const response = await GET(request())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.cloudcode_backend_support).toMatchObject({
      applied: true,
      source: 'cloudcode-backend-support-handoff',
    })
    expect(payload.normalized_status.agents.find((agent: any) => agent.id === 'agent_zero')).toMatchObject({
      status: 'READ_ONLY',
    })
    expect(payload.owner_status).toBe(payload.normalized_status.overall_status)
    expect(payload.route_metadata.targets).toMatchObject({
      mission_control_home: '/',
      gateway_overview: '/gateway',
      agent_hub: '/gateway/agent-hub',
    })
    expect(payload.classified_errors.some((error: any) => error.kind === 'OWNER_GATED')).toBe(true)
    expect(JSON.stringify(payload)).not.toMatch(/\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)
  })
})
