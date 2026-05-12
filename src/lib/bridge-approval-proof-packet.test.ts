import { describe, expect, it } from 'vitest'
import { buildBridgeApprovalProofReplayPacket } from './bridge-approval-proof-packet'

const EXPECTED_STAGES = [
  'pending',
  'approve',
  'deny',
  'expired',
  'execute',
  'failed',
  'complete',
  'audit',
]

describe('Bridge approval proof replay packet', () => {
  it('replays pending, approval, denial, expiration, execution projection, failure, completion, and audit states without enabling writes', () => {
    const packet = buildBridgeApprovalProofReplayPacket({
      generatedAt: '2026-05-12T00:00:00.000Z',
      runtimeCommit: 'test-commit',
    })

    expect(packet).toMatchObject({
      ok: true,
      mode: 'bridge_approval_proof_replay_packet',
      generated_at: '2026-05-12T00:00:00.000Z',
      runtime_commit: 'test-commit',
      stages_total: 8,
      no_execution_enabled: true,
      no_connector_writes_enabled: true,
      no_external_writes_enabled: true,
      no_fake_approval_requests: true,
      secrets_exposed: false,
      raw_paths_exposed: false,
      consistency_ok: true,
      consistency_issues: [],
      safe_log_pointer: '/api/bridge/approval-requests/audit-report',
    })
    expect(packet.stage_packets.map((stage) => stage.stage)).toEqual(EXPECTED_STAGES)

    const byStage = Object.fromEntries(packet.stage_packets.map((stage) => [stage.stage, stage]))
    expect(byStage.pending).toMatchObject({
      approval_state: 'pending',
      decision: null,
      accepted_for_execution: false,
      audit_event_id: null,
    })
    expect(byStage.approve).toMatchObject({
      approval_state: 'approved',
      decision: 'approved',
      accepted_for_execution: false,
      audit_outcome: 'approved',
    })
    expect(byStage.deny).toMatchObject({
      approval_state: 'denied',
      decision: 'denied',
      accepted_for_execution: false,
      audit_outcome: 'denied',
    })
    expect(byStage.expired).toMatchObject({
      approval_state: 'expired',
      decision: 'expired',
      blocked_reason: 'approval_request_expired',
      accepted_for_execution: false,
      audit_outcome: 'expired',
    })
    expect(byStage.execute).toMatchObject({
      approval_state: 'approved',
      decision: 'approved',
      accepted_for_execution: false,
      blocked_reason: 'exact_scoped_dispatch_route_required',
      run_state: null,
    })
    expect(byStage.failed).toMatchObject({
      approval_state: 'approved',
      run_state: 'failed',
      accepted_for_execution: true,
      blocked_reason: 'simulated_service_failure',
      audit_outcome: 'failed',
    })
    expect(byStage.complete).toMatchObject({
      approval_state: 'approved',
      run_state: 'completed',
      accepted_for_execution: true,
      audit_outcome: 'completed',
    })
    expect(byStage.audit?.audit_event_id).toMatch(/^audit_/)

    for (const stage of packet.stage_packets) {
      expect(stage.execution_enabled).toBe(false)
      expect(stage.writes_enabled).toBe(false)
      expect(stage.external_writes_enabled).toBe(false)
      expect(stage.safe_log_pointer).toBe('/api/bridge/approval-requests/audit-report')
    }
  })

  it('keeps the replay packet owner-safe', () => {
    const packetText = JSON.stringify(buildBridgeApprovalProofReplayPacket(), null, 2)

    expect(packetText).not.toMatch(/\/Users\//)
    expect(packetText).not.toMatch(/\/home\//)
    expect(packetText).not.toMatch(/Bearer\s+/)
    expect(packetText).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/)
    expect(packetText).not.toMatch(/TOKEN=/)
    expect(packetText).not.toMatch(/SECRET=/)
  })
})
