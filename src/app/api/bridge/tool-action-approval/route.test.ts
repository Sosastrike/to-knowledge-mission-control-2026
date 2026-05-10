import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createBridgeApprovalRequest: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/bridge-approval-request-store', () => ({
  createBridgeApprovalRequest: mocks.createBridgeApprovalRequest,
}))

import { POST } from './route'

function request(body: unknown = {}) {
  return new Request('http://mission-control.test/api/bridge/tool-action-approval', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('tool action approval route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({
      user: { id: 1, username: 'owner', display_name: 'Owner', role: 'operator', workspace_id: 1, tenant_id: 1 },
    })
    mocks.createBridgeApprovalRequest.mockReturnValue({
      ok: true,
      http_status: 201,
      approval_request_created: true,
      approval_request_reused: false,
      approval_request: { id: 'apr_tool_action', approval_state: 'pending' },
      approval_request_id: 'apr_tool_action',
      approval_state: 'pending',
      audit_event_id: 'audit_tool_action',
      blocked_reason: null,
      next_action: 'Owner must approve this exact request before protected execution can proceed.',
    })
  })

  it('creates a scoped approval request for an external tool action without executing it', async () => {
    const response = await POST(request({
      connector: 'agentmail',
      action: 'send',
      target: 'owner@example.com',
      payload: {
        subject: 'Day 50 proof',
        body: 'Do not leak this message body.',
      },
      idempotency_key: 'day50-agentmail-proof',
    }) as any)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(mocks.createBridgeApprovalRequest).toHaveBeenCalledTimes(1)
    expect(mocks.createBridgeApprovalRequest.mock.calls[0][0]).toMatchObject({
      connector: 'agentmail',
      action: 'agentmail.send',
      target: 'owner@example.com',
      targetKey: 'owner@example.com',
      riskLevel: 'medium',
      protectedCategory: 'external_delivery',
      approvalScope: {
        required_scope: 'agentmail.send',
        connector: 'agentmail',
        action: 'agentmail.send',
        target_key: 'owner@example.com',
        payload_fields_present: ['body', 'subject'],
        payload_value_storage: 'hash_and_field_names_only',
      },
    })
    expect(mocks.createBridgeApprovalRequest.mock.calls[0][0].approvalScope).not.toHaveProperty('body')
    expect(payload).toMatchObject({
      ok: true,
      mode: 'tool_action_approval_requested',
      canonical_status: 'OWNER_GATED',
      required_scope: 'agentmail.send',
      approval_request_created: true,
      approval_id: 'apr_tool_action',
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required: true,
      owner_approval_required: true,
    })
    expect(JSON.stringify(payload)).not.toContain('Do not leak this message body.')
  })

  it('previews the exact scope without writing an approval request when dry_run is true', async () => {
    const response = await POST(request({
      connector: 'zapier',
      tool: 'mcp__zapier__gmail_send_email',
      action: 'send email',
      dry_run: true,
    }) as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.createBridgeApprovalRequest).not.toHaveBeenCalled()
    expect(payload).toMatchObject({
      ok: true,
      mode: 'tool_action_approval_preview',
      canonical_status: 'OWNER_GATED',
      required_scope: 'zapier.write',
      approval_request_created: false,
      accepted_for_execution: false,
      no_zapier_writes: true,
    })
  })

  it('blocks unsupported broad tool action requests before approval persistence', async () => {
    const response = await POST(request({
      connector: 'unknown',
      action: 'execute any connector write',
    }) as any)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(mocks.createBridgeApprovalRequest).not.toHaveBeenCalled()
    expect(payload).toMatchObject({
      ok: false,
      mode: 'tool_action_approval_blocked',
      blocker: 'tool_action_scope_not_supported',
      classified_error: {
        kind: 'BACKEND_MISSING',
        owner_message: expect.any(String),
      },
      required_scope: null,
      approval_request_created: false,
      accepted_for_execution: false,
    })
  })

  it('keeps authentication required', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })

    const response = await POST(request({ connector: 'agentmail', action: 'send' }) as any)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ ok: false, error: 'Authentication required' })
  })
})
