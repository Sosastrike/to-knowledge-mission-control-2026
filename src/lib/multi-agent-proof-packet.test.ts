import { describe, expect, it } from 'vitest'

import { buildAgentStatusConsistencyReport } from './agent-status-consistency'
import { buildCloudCodeAgentHealth } from './gateway-cloudcode-integration'
import { attachOpenClawGatewayRuntimeStatus, buildAgentHubStatusPayload } from './gateway-agent-hub'
import { createGatewayRegistryFromAgentNetwork } from './gateway-model'
import { buildMultiAgentProofPacket } from './multi-agent-proof-packet'
import { buildOpenClawDoctorMissingPayload } from './openclaw-doctor'
import { buildOpenClawGatewayRuntimeStatus } from './openclaw-gateway-runtime'

const registry = createGatewayRegistryFromAgentNetwork({ generatedAt: '2026-05-12T00:00:00.000Z' })

function proofPacket(runtimeCommit = 'test-commit') {
  const runtime = buildOpenClawGatewayRuntimeStatus(buildOpenClawDoctorMissingPayload({
    timestamp: '2026-05-12T00:00:00.000Z',
    serviceUser: 'mission-control',
  }))
  const agentHubPayload = attachOpenClawGatewayRuntimeStatus(buildAgentHubStatusPayload(registry), runtime)
  const cloudcodeHealth = buildCloudCodeAgentHealth(agentHubPayload as any)
  const consistencyReport = buildAgentStatusConsistencyReport(agentHubPayload, cloudcodeHealth)
  return buildMultiAgentProofPacket({
    agentHubPayload,
    cloudcodeHealth,
    consistencyReport,
    runtimeCommit,
  })
}

describe('multi-agent proof packet', () => {
  it('builds one safe proof packet for each canonical Agent Hub agent', () => {
    const packet = proofPacket('789bc28')

    expect(packet).toMatchObject({
      ok: true,
      mode: 'multi_agent_proof_packet',
      runtime_commit: '789bc28',
      packets_total: 6,
      consistency_ok: true,
      consistency_issues: 0,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    })
    expect(packet.proof_packets.map((item) => item.agent_id)).toEqual([
      'paperclip',
      'agent-zero',
      'hermes',
      'spaceagent',
      'pi-mono',
      'openclaw-plus',
    ])
    expect(packet.proof_packets.every((item) => item.route_or_service_checked.startsWith('/api/'))).toBe(true)
    expect(packet.proof_packets.every((item) => item.audit_pointer.startsWith('/api/'))).toBe(true)
    expect(packet.proof_packets.every((item) => item.safe_log_pointer.startsWith('/api/'))).toBe(true)
  })

  it('keeps active advisory proof distinct from blocked backend proof', () => {
    const packet = proofPacket()
    const pi = packet.proof_packets.find((item) => item.agent_id === 'pi-mono')
    const openclaw = packet.proof_packets.find((item) => item.agent_id === 'openclaw-plus')

    expect(pi).toMatchObject({
      result: 'READY',
      blocker_class: 'NONE',
      blocker: null,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(openclaw).toMatchObject({
      result: 'SERVICE_DOWN',
      blocker_class: 'SERVICE_DOWN',
      blocker: 'openclaw_doctor_runtime_not_reachable',
      execution_enabled: false,
      writes_enabled: false,
    })
  })

  it('redacts unsafe runtime commit text and never exposes secrets or raw paths', () => {
    const packet = proofPacket('/Users/example/not-a-token')
    const serialized = JSON.stringify(packet)

    expect(packet.runtime_commit).toBe('unknown')
    expect(serialized).not.toMatch(/\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}|API_KEY=|AUTH_PASS=|TOKEN=|SECRET=/i)
  })
})
