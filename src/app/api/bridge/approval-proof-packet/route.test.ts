import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  buildBridgeApprovalProofReplayPacket: vi.fn(),
  buildRuntimeHealthPayload: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/bridge-approval-proof-packet', () => ({
  buildBridgeApprovalProofReplayPacket: mocks.buildBridgeApprovalProofReplayPacket,
}))

vi.mock('@/lib/runtime-health', () => ({
  buildRuntimeHealthPayload: mocks.buildRuntimeHealthPayload,
}))

import { GET } from './route'

function request() {
  return new Request('http://mission-control.test/api/bridge/approval-proof-packet')
}

describe('/api/bridge/approval-proof-packet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', workspace_id: 1, tenant_id: 1 } })
    mocks.buildRuntimeHealthPayload.mockReturnValue({ source_commit: 'abc123' })
    mocks.buildBridgeApprovalProofReplayPacket.mockReturnValue({
      ok: true,
      mode: 'bridge_approval_proof_replay_packet',
      generated_at: '2026-05-12T00:00:00.000Z',
      runtime_commit: 'abc123',
      stages_total: 8,
      stage_packets: [],
      no_execution_enabled: true,
      no_connector_writes_enabled: true,
      no_external_writes_enabled: true,
      no_fake_approval_requests: true,
      secrets_exposed: false,
      raw_paths_exposed: false,
      consistency_ok: true,
      consistency_issues: [],
      safe_log_pointer: '/api/bridge/approval-requests/audit-report',
      rollback_command: 'git revert <day-96-bridge-approval-proof-replay-commit>',
    })
  })

  it('returns the protected read-only Bridge approval proof packet', async () => {
    const response = await GET(request() as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.buildBridgeApprovalProofReplayPacket).toHaveBeenCalledWith({ runtimeCommit: 'abc123' })
    expect(payload).toMatchObject({
      ok: true,
      endpoint: '/api/bridge/approval-proof-packet',
      stages_total: 8,
      no_execution_enabled: true,
      no_connector_writes_enabled: true,
      no_external_writes_enabled: true,
      no_fake_approval_requests: true,
      consistency_ok: true,
    })
    expect(payload.note).toContain('Read-only Bridge approval proof replay')
    expect(payload.note).toContain('no Run Now')
  })

  it('keeps authentication required', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })

    const response = await GET(request() as any)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Authentication required' })
    expect(mocks.buildBridgeApprovalProofReplayPacket).not.toHaveBeenCalled()
  })
})
