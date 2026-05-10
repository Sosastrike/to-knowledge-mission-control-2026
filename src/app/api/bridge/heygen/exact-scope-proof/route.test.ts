import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getZapierToolBridge: vi.fn(),
  createBridgeApprovalRequest: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/zapier-tool-bridge', () => ({
  getZapierToolBridge: mocks.getZapierToolBridge,
}))

vi.mock('@/lib/bridge-approval-request-store', () => ({
  createBridgeApprovalRequest: mocks.createBridgeApprovalRequest,
}))

import { POST } from './route'

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
        description: 'Create a HeyGen video from a template.',
        category: 'heygen',
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

function request(body: unknown = { payload: { template_id: 'tpl_123', script: 'Short approved script' } }) {
  return new Request('http://mission-control.test/api/bridge/heygen/exact-scope-proof', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('HeyGen exact-scope proof route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({
      user: { id: 1, username: 'owner', display_name: 'Owner', role: 'operator', workspace_id: 1, tenant_id: 1 },
    })
    mocks.getZapierToolBridge.mockResolvedValue(zapierBridge())
    mocks.createBridgeApprovalRequest.mockReturnValue({
      ok: true,
      http_status: 201,
      approval_request_created: true,
      approval_request_reused: false,
      approval_request: { id: 'apr_heygen', approval_state: 'pending' },
      approval_request_id: 'apr_heygen',
      approval_state: 'pending',
      audit_event_id: 'audit_heygen',
      blocked_reason: null,
      next_action: 'Owner must approve this exact request before protected execution can proceed.',
    })
  })

  it('creates an exact heygen.generate approval request without executing generation', async () => {
    const response = await POST(request() as any)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(mocks.getZapierToolBridge).toHaveBeenCalledWith('heygen')
    expect(mocks.createBridgeApprovalRequest).toHaveBeenCalledTimes(1)
    expect(mocks.createBridgeApprovalRequest.mock.calls[0][0]).toMatchObject({
      connector: 'zapier.heygen',
      action: 'heygen.generate',
      targetKey: 'mcp__zapier__heygen_create_a_video_from_template',
      riskLevel: 'high',
      protectedCategory: 'external_automation',
      approvalScope: {
        required_scope: 'heygen.generate',
        tool_name: 'mcp__zapier__heygen_create_a_video_from_template',
        payload_fields_present: ['script', 'template_id'],
        no_heygen_generation: true,
        no_zapier_writes: true,
      },
    })
    expect(mocks.createBridgeApprovalRequest.mock.calls[0][0].approvalScope).not.toHaveProperty('script')
    expect(payload).toMatchObject({
      ok: true,
      mode: 'heygen_exact_scope_approval_requested',
      required_scope: 'heygen.generate',
      approval_request_created: true,
      approval_id: 'apr_heygen',
      audit_event_id: 'audit_heygen',
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      no_heygen_generation: true,
      no_zapier_writes: true,
      bridge_session_required: true,
      owner_approval_required: true,
    })
    expect(JSON.stringify(payload)).not.toContain('Short approved script')
    expect(JSON.stringify(payload)).not.toMatch(/\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)
  })

  it('blocks approval creation when the HeyGen schema is not visible', async () => {
    mocks.getZapierToolBridge.mockResolvedValueOnce(zapierBridge({
      canonical_status: 'BLOCKED',
      blocker_class: 'BLOCKED',
      blocker: 'MCP server zapier is not present in the Claude MCP configuration.',
      heygen_found: false,
      exact_heygen_tool_name: null,
      required_fields: null,
      heygen_tools: [],
    }))

    const response = await POST(request() as any)
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(mocks.createBridgeApprovalRequest).not.toHaveBeenCalled()
    expect(payload).toMatchObject({
      ok: false,
      mode: 'heygen_exact_scope_blocked',
      blocker: 'MCP server zapier is not present in the Claude MCP configuration.',
      approval_request_created: false,
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      no_heygen_generation: true,
    })
  })

  it('blocks invalid payloads before creating approvals', async () => {
    const response = await POST(request({ payload: { template_id: 'tpl_123' } }) as any)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(mocks.createBridgeApprovalRequest).not.toHaveBeenCalled()
    expect(payload).toMatchObject({
      ok: false,
      blocker: 'heygen_payload_missing_required_fields',
      missing_fields: ['script'],
      approval_request_created: false,
      accepted_for_execution: false,
      no_heygen_generation: true,
    })
  })

  it('keeps authentication required', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })

    const response = await POST(request() as any)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ ok: false, error: 'Authentication required' })
  })
})
