import { describe, expect, it, vi } from 'vitest'

import { buildOpenClawDoctorMissingPayload, parseOpenClawDoctorOutput, withOpenClawDoctorClosure } from '@/lib/openclaw-doctor'
import {
  buildOpenClawGatewayRuntimeStatus,
  getOpenClawGatewayRuntimeStatus,
  isOpenClawGatewayNodeId,
} from '@/lib/openclaw-gateway-runtime'

describe('OpenClaw+ Gateway runtime status', () => {
  it('maps missing CLI proof into a Gateway-safe SERVICE_DOWN payload', async () => {
    const runDoctor = vi.fn().mockRejectedValue(new Error('spawn openclaw ENOENT'))

    const payload = await getOpenClawGatewayRuntimeStatus({
      generatedAt: '2026-05-11T00:00:00.000Z',
      serviceUser: 'mission-control',
      runDoctor,
    })

    expect(runDoctor).toHaveBeenCalledWith(['doctor'], { timeoutMs: 5000 })
    expect(payload).toMatchObject({
      mode: 'openclaw_plus_gateway_runtime_status',
      canonical_status: 'SERVICE_DOWN',
      blocker_class: 'SERVICE_DOWN',
      blocker: 'openclaw_doctor_runtime_not_reachable',
      agent_hub_state: 'blocked',
      gateway_health: 'blocked',
      connected: false,
      configured: false,
      read_enabled: false,
      owner_status: { status: 'SERVICE_DOWN', tone: 'red' },
      execution_enabled: false,
      writes_enabled: false,
      destructive_repair_enabled: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
      proof_packet: {
        lane: 'OpenClaw+',
        result: 'SERVICE_DOWN',
        blocker: 'openclaw_doctor_runtime_not_reachable',
        service_user: 'mission-control',
      },
    })
    expect(JSON.stringify(payload)).not.toMatch(/sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|auth\.json|\/Users\/|\/home\//i)
  })

  it('maps a healthy doctor result into read-only Gateway visibility', () => {
    const closure = withOpenClawDoctorClosure(parseOpenClawDoctorOutput('OK: configuration valid', 0), {
      timestamp: '2026-05-11T00:00:00.000Z',
      serviceUser: 'mission-control',
    })

    expect(buildOpenClawGatewayRuntimeStatus(closure)).toMatchObject({
      canonical_status: 'LIVE',
      blocker_class: 'NONE',
      blocker: null,
      agent_hub_state: 'read_only',
      gateway_health: 'read_only',
      connected: true,
      configured: true,
      read_enabled: true,
      live_interface_proven: true,
      called_true_proven: true,
      owner_status: { status: 'LIVE', tone: 'green' },
      execution_enabled: false,
      writes_enabled: false,
    })
  })

  it('accepts owner-facing OpenClaw+ route aliases', () => {
    expect(isOpenClawGatewayNodeId('OpenClaw+')).toBe(true)
    expect(isOpenClawGatewayNodeId('openclaw-plus')).toBe(true)
    expect(isOpenClawGatewayNodeId('openclaw_plus')).toBe(true)
    expect(isOpenClawGatewayNodeId('agent-zero')).toBe(false)
  })

  it('can build the same payload from the explicit missing-CLI closure', () => {
    const payload = buildOpenClawGatewayRuntimeStatus(buildOpenClawDoctorMissingPayload({
      timestamp: '2026-05-11T00:00:00.000Z',
      serviceUser: 'mission-control',
    }))

    expect(payload.canonical_status).toBe('SERVICE_DOWN')
    expect(payload.owner_status).toMatchObject({ status: 'SERVICE_DOWN' })
  })
})
