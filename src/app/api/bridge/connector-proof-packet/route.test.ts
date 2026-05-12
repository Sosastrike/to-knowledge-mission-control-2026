import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  buildConnectorProofReplayPacket: vi.fn(),
  buildRuntimeHealthPayload: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/connector-proof-packet', () => ({
  buildConnectorProofReplayPacket: mocks.buildConnectorProofReplayPacket,
}))

vi.mock('@/lib/runtime-health', () => ({
  buildRuntimeHealthPayload: mocks.buildRuntimeHealthPayload,
}))

import { GET } from './route'

function request() {
  return new Request('http://mission-control.test/api/bridge/connector-proof-packet')
}

describe('/api/bridge/connector-proof-packet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', workspace_id: 1, tenant_id: 1 } })
    mocks.buildRuntimeHealthPayload.mockReturnValue({ source_commit: 'abc123' })
    mocks.buildConnectorProofReplayPacket.mockResolvedValue({
      ok: true,
      mode: 'connector_proof_replay_packet',
      generated_at: '2026-05-12T00:00:00.000Z',
      runtime_commit: 'abc123',
      connectors_total: 6,
      connector_packets: [],
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      no_telegram_send: true,
      no_agentmail_send: true,
      no_drive_upload: true,
      no_onedrive_upload: true,
      no_zapier_writes: true,
      no_heygen_generation: true,
      secrets_exposed: false,
      raw_paths_exposed: false,
      consistency_ok: true,
      consistency_issues: [],
      safe_log_pointer: '/api/bridge/connector-readiness',
      rollback_command: 'git revert <day-95-connector-proof-replay-commit>',
    })
  })

  it('returns the protected read-only connector proof packet', async () => {
    const response = await GET(request() as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.buildConnectorProofReplayPacket).toHaveBeenCalledWith({ runtimeCommit: 'abc123' })
    expect(payload).toMatchObject({
      ok: true,
      endpoint: '/api/bridge/connector-proof-packet',
      connectors_total: 6,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      no_telegram_send: true,
      no_agentmail_send: true,
      no_drive_upload: true,
      no_onedrive_upload: true,
      no_zapier_writes: true,
      no_heygen_generation: true,
      consistency_ok: true,
    })
    expect(payload.note).toContain('Read-only connector proof replay')
  })

  it('keeps authentication required', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })

    const response = await GET(request() as any)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Authentication required' })
    expect(mocks.buildConnectorProofReplayPacket).not.toHaveBeenCalled()
  })
})
