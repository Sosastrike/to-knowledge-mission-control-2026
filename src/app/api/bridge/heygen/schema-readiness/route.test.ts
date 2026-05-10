import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getZapierToolBridge: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/zapier-tool-bridge', () => ({
  getZapierToolBridge: mocks.getZapierToolBridge,
}))

import { GET, POST } from './route'

function zapierBridge(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    canonical_status: 'READY',
    blocker_class: 'NONE',
    blocker: null,
    heygen_found: true,
    exact_heygen_tool_name: 'mcp__zapier__heygen_create_a_video_from_template',
    required_fields: ['template_id', 'script'],
    heygen_tools: [
      {
        tool_name: 'mcp__zapier__heygen_create_a_video_from_template',
        write_classification: 'write',
        required_fields: ['template_id', 'script'],
        execution_enabled: false,
      },
    ],
    execution_enabled: false,
    writes_enabled: false,
    no_zapier_writes: true,
    ...overrides,
  }
}

function request(body?: unknown) {
  return new Request('http://mission-control.test/api/bridge/heygen/schema-readiness', {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('HeyGen schema readiness route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', workspace_id: 1, tenant_id: 1 } })
    mocks.getZapierToolBridge.mockResolvedValue(zapierBridge())
  })

  it('returns read-only schema readiness without enabling generation', async () => {
    const response = await GET(request() as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.getZapierToolBridge).toHaveBeenCalledWith('heygen')
    expect(payload).toMatchObject({
      ok: true,
      endpoint: '/api/bridge/heygen/schema-readiness',
      mode: 'heygen_schema_readiness',
      canonical_status: 'READY',
      schema_available: true,
      tool_name: 'mcp__zapier__heygen_create_a_video_from_template',
      accepted_for_generation: false,
      execution_enabled: false,
      writes_enabled: false,
      no_heygen_generation: true,
      no_zapier_writes: true,
      bridge_session_required: true,
      approval_required_for_generation: true,
    })
    expect(JSON.stringify(payload)).not.toMatch(/\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)
  })

  it('validates POST payloads but never executes HeyGen', async () => {
    const response = await POST(request({ payload: { template_id: 'tpl_123' } }) as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      canonical_status: 'BLOCKED',
      blocker: 'heygen_payload_missing_required_fields',
      payload_checked: true,
      payload_valid: false,
      missing_fields: ['script'],
      accepted_for_generation: false,
      execution_enabled: false,
      writes_enabled: false,
      no_heygen_generation: true,
    })
  })

  it('keeps authentication required', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })

    const response = await GET(request() as any)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Authentication required' })
  })
})
