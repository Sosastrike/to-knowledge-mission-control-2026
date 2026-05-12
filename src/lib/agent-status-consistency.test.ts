import { describe, expect, it } from 'vitest'

import { buildAgentStatusConsistencyReport } from './agent-status-consistency'
import { buildCloudCodeAgentHealth } from './gateway-cloudcode-integration'
import { attachOpenClawGatewayRuntimeStatus, buildAgentHubStatusPayload, type AgentHubStatusPayload } from './gateway-agent-hub'
import { createGatewayRegistryFromAgentNetwork } from './gateway-model'
import { buildOpenClawGatewayRuntimeStatus } from './openclaw-gateway-runtime'
import { buildOpenClawDoctorMissingPayload, parseOpenClawDoctorOutput, withOpenClawDoctorClosure } from './openclaw-doctor'

const registry = createGatewayRegistryFromAgentNetwork({ generatedAt: '2026-05-12T00:00:00.000Z' })

function currentRuntimePayload() {
  const runtime = buildOpenClawGatewayRuntimeStatus(buildOpenClawDoctorMissingPayload({
    timestamp: '2026-05-12T00:00:00.000Z',
    serviceUser: 'mission-control',
  }))
  return attachOpenClawGatewayRuntimeStatus(buildAgentHubStatusPayload(registry), runtime)
}

describe('multi-agent status consistency', () => {
  it('accepts the current Agent Hub roster and CloudCode health rows without fake LIVE states', () => {
    const payload = currentRuntimePayload()
    const health = buildCloudCodeAgentHealth(payload as any)
    const report = buildAgentStatusConsistencyReport(payload, health)

    expect(report).toMatchObject({
      ok: true,
      mode: 'multi_agent_status_consistency',
      checked_agents: 6,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    })
    expect(report.canonical_agent_ids).toEqual(['paperclip', 'agent-zero', 'hermes', 'spaceagent', 'pi-mono', 'openclaw-plus'])
    expect(report.agent_hub_agent_ids).toEqual(report.canonical_agent_ids)
    expect(report.cloudcode_health_ids).toEqual(expect.arrayContaining([
      'agent_zero',
      'hermes',
      'pi',
      'paperclip',
      'openclaw_plus',
      'spaceagent_playwright',
      'spaceagent_youtube',
      'spaceagent_firecrawl',
    ]))
    expect(health.every((row) => row.status !== 'LIVE')).toBe(true)
    expect(report.issues).toEqual([])
  })

  it('fails when a blocked agent is shown as active owner-facing truth', () => {
    const payload = currentRuntimePayload()
    const broken = {
      ...payload,
      agents: payload.agents.map((agent) =>
        agent.id === 'openclaw-plus'
          ? {
            ...agent,
            owner_status: { ...agent.owner_status, status: 'READY' as const, label: 'READY' as const },
          }
          : agent,
      ),
    } satisfies AgentHubStatusPayload

    const report = buildAgentStatusConsistencyReport(broken, buildCloudCodeAgentHealth(broken as any))

    expect(report.ok).toBe(false)
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        agent_id: 'openclaw-plus',
        source: 'agent_hub',
        reason: 'active_owner_status_has_runtime_blocker',
      }),
      expect.objectContaining({
        agent_id: 'openclaw-plus',
        source: 'agent_hub',
        reason: 'blocked_agent_hub_row_has_active_owner_status',
      }),
    ]))
  })

  it('fails on duplicate agent rows and missing CloudCode health rows', () => {
    const payload = currentRuntimePayload()
    const broken = {
      ...payload,
      agents: [...payload.agents, payload.agents[0]],
    } satisfies AgentHubStatusPayload

    const report = buildAgentStatusConsistencyReport(
      broken,
      buildCloudCodeAgentHealth(payload as any).filter((row) => row.id !== 'paperclip'),
    )

    expect(report.ok).toBe(false)
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        agent_id: 'paperclip',
        reason: 'duplicate_agent_hub_status_row',
      }),
      expect.objectContaining({
        agent_id: 'paperclip',
        reason: 'missing_cloudcode_health_row',
      }),
    ]))
  })

  it('allows live OpenClaw+ doctor proof only when blockers disappear', () => {
    const runtime = buildOpenClawGatewayRuntimeStatus(withOpenClawDoctorClosure(
      parseOpenClawDoctorOutput('OK: configuration valid', 0),
      { timestamp: '2026-05-12T00:00:00.000Z', serviceUser: 'mission-control' },
    ))
    const payload = attachOpenClawGatewayRuntimeStatus(buildAgentHubStatusPayload(registry), runtime)
    const report = buildAgentStatusConsistencyReport(payload, buildCloudCodeAgentHealth(payload as any))

    expect(report.issues.filter((item) => item.agent_id === 'openclaw-plus')).toEqual([])
  })

  it('allows Hermes interface proof to coexist with a truthful service-down backend blocker', () => {
    const payload = currentRuntimePayload()
    const hermesServiceDown = {
      ...payload,
      agents: payload.agents.map((agent) =>
        agent.id === 'hermes'
          ? {
            ...agent,
            status: 'blocked' as const,
            live_interface_proven: true,
            owner_status: { ...agent.owner_status, status: 'SERVICE_DOWN' as const, label: 'SERVICE_DOWN' as const },
            blocked_reason: 'hermes_not_installed',
            blockers: ['hermes_not_installed', 'hermes_degraded_or_pending_live_proof'],
          }
          : agent,
      ),
    } satisfies AgentHubStatusPayload

    const report = buildAgentStatusConsistencyReport(hermesServiceDown, buildCloudCodeAgentHealth(hermesServiceDown as any))

    expect(report.issues.filter((item) => item.agent_id === 'hermes')).toEqual([])
  })
})
