import { describe, expect, it } from 'vitest'
import { createGatewayRegistryFromAgentNetwork } from './gateway-model'
import {
  buildAgentHubAgentAuditPayload,
  buildAgentHubAgentHealthPayload,
  buildAgentHubAgentRoutesPayload,
  buildAgentHubAgentsPayload,
  buildAgentHubStatusPayload,
  buildAgentHubRegistryPayload,
  getAgentHubAgentPayload,
  normalizeAgentHubAgentId,
} from './gateway-agent-hub'

const registry = createGatewayRegistryFromAgentNetwork({ generatedAt: '2026-05-07T00:00:00.000Z' })

describe('Gateway Agent Hub', () => {
  it('builds the production roster from Gateway registry truth, not mock data', () => {
    const payload = buildAgentHubStatusPayload(registry)
    expect(payload).toMatchObject({
      mode: 'gateway_agent_hub_status_read_only',
      source: 'gateway_registry',
      mock_data_used: false,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    })
    expect(payload.agents.map((agent) => agent.id)).toEqual(['paperclip', 'agent-zero', 'hermes', 'spaceagent', 'pi-mono'])
    expect(payload.agents.find((agent) => agent.id === 'agent-zero')).toMatchObject({ role: 'Commander', status: 'partial_go', called_true_proven: true })
    expect(payload.agents.find((agent) => agent.id === 'hermes')).toMatchObject({ role: 'Lieutenant / Skill + Workflow Builder', status: 'gated', called_true_proven: false })
    expect(payload.agents.find((agent) => agent.id === 'paperclip')).toMatchObject({ role: 'Workforce Control Plane', status: 'pending', live_interface_proven: false })
    expect(payload.agents.find((agent) => agent.id === 'spaceagent')).toMatchObject({ role: 'Browser / Firecrawl / YouTube Research Specialist', status: 'read_only' })
    expect(payload.agents.find((agent) => agent.id === 'pi-mono')).toMatchObject({
      role: 'Dispatcher / Route Optimizer Candidate',
      status: 'pending',
      routes: {
        bridge_status: '/api/bridge/pi/status',
      },
    })
    expect(payload.agents.find((agent) => agent.id === 'pi-mono')?.blocked_reason).toBe('pi_runtime_session_not_proven')
    expect(payload.design_handoff.expected_files_present).toBe(true)
    expect(payload.design_handoff.production_uses_mock_data).toBe(false)
    for (const agent of payload.agents) {
      expect(agent.interface.auth_required).toBe(true)
      expect(agent.interface.iframe_allowed).toBe(false)
      expect(agent.interface.public_exposure).toBe(false)
      expect(agent.interface.local_ui_url).toBeNull()
      expect(agent.interface.tailnet_url).toBeNull()
    }
  })

  it('keeps Paperclip before OpenClaw+ and keeps Build-Wiki/Farmer gated', () => {
    const paperclip = getAgentHubAgentPayload(registry, 'paperclip')
    const routes = buildAgentHubAgentRoutesPayload(registry, 'paperclip')
    const status = buildAgentHubStatusPayload(registry)

    expect(paperclip?.agent.layer).toBe('workforce_and_task_orchestration_before_openclaw_runtime')
    expect(routes?.registered_flows.some((flow) => flow.selected_route.hops.join('>') === 'agent_zero>gateway>paperclip>openclaw_plus')).toBe(true)
    expect(status.supporting_runtime_systems.some((system) => system.id === 'buildwiki')).toBe(true)
    expect(status.buildwiki_run_now).toMatchObject({
      target_service: 'opencloud-docs-farmer.service',
      bridge_session_required: true,
      owner_approval_required: true,
      execution_enabled: false,
      fork2_smb_status: 'blocked',
    })
  })

  it('serves detail, health, routes, and audit payloads without owner-unsafe fields', () => {
    const agents = buildAgentHubAgentsPayload(registry)
    const health = buildAgentHubAgentHealthPayload(registry, 'pi')
    const routes = buildAgentHubAgentRoutesPayload(registry, 'agent_zero')
    const audit = buildAgentHubAgentAuditPayload(registry, 'space-agent')
    const registryPayload = buildAgentHubRegistryPayload(registry)
    const serialized = JSON.stringify({ agents, health, routes, audit, registryPayload })

    expect(normalizeAgentHubAgentId('pi')).toBe('pi-mono')
    expect(normalizeAgentHubAgentId('space_agent')).toBe('spaceagent')
    expect(health).toMatchObject({ agent_id: 'pi-mono', execution_enabled: false, writes_enabled: false })
    expect(routes?.registered_flows.length).toBeGreaterThan(0)
    expect(audit?.audit_events.length).toBeGreaterThan(0)
    expect(serialized).not.toMatch(/\/home\/tony|\/a0\/|auth\.json|Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]/i)
    expect(agents.mock_data_used).toBe(false)
    expect(agents.execution_enabled).toBe(false)
    expect(registryPayload).toMatchObject({ mode: 'gateway_agent_hub_registry_read_only', mock_data_used: false, execution_enabled: false, writes_enabled: false })
  })
})
