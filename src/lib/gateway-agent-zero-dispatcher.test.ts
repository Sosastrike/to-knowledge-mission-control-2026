import { describe, expect, it } from 'vitest'
import {
  buildAgentZeroDispatcherStatusPayload,
  planAgentZeroGatewayDispatch,
} from './gateway-agent-zero-dispatcher'
import { loadGatewayRegistry } from './gateway-registry-api'

describe('Agent Zero Gateway dispatcher', () => {
  it('publishes Agent Zero as the canonical commander dispatcher without enabling execution', async () => {
    const registry = await loadGatewayRegistry()
    const status = buildAgentZeroDispatcherStatusPayload(registry, '2026-05-12T00:00:00.000Z')

    expect(status).toMatchObject({
      ok: true,
      mode: 'agent_zero_dispatcher_status',
      agent_id: 'agent-zero',
      registry_node_id: 'agent_zero',
      commander: true,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      dispatch_executed: false,
    })
    expect(status.canonical_agent_registry.map((agent) => agent.id)).toEqual([
      'agent-zero',
      'hermes',
      'pi-mono',
      'spaceagent',
      'paperclip',
      'openclaw-plus',
    ])
    expect(status.safe_probe.route.final_commander).toBe('agent_zero')
    expect(status.audit_trail[0]).toMatchObject({
      event: 'agent_zero.dispatcher.route_planned',
      execution_enabled: false,
      writes_enabled: false,
      secrets_exposed: false,
    })
  })

  it('routes normal owner commands to Agent Zero by default', async () => {
    const registry = await loadGatewayRegistry()
    const dispatch = planAgentZeroGatewayDispatch(registry, {
      ownerRequest: 'Who is commander and what agents can you see?',
      generatedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(dispatch).toMatchObject({
      ok: true,
      mode: 'agent_zero_dispatcher_route_plan',
      classification: 'chat',
      agent_zero_in_route: true,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      dispatch_executed: false,
    })
    expect(dispatch.route).toMatchObject({
      primary_target: 'agent_zero',
      dispatch_target: 'agent_zero',
      via: ['owner', 'gateway', 'agent_zero'],
      final_commander: 'agent_zero',
    })
  })

  it('keeps protected actions Bridge-gated while preserving Agent Zero in the route', async () => {
    const registry = await loadGatewayRegistry()
    const dispatch = planAgentZeroGatewayDispatch(registry, {
      ownerRequest: 'Run Build-Wiki now',
      generatedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(dispatch.classification).toBe('sync')
    expect(dispatch.agent_zero_in_route).toBe(true)
    expect(dispatch.requires_bridge_session).toBe(true)
    expect(dispatch.execution_enabled).toBe(false)
    expect(dispatch.writes_enabled).toBe(false)
    expect(dispatch.dispatch_executed).toBe(false)
    expect(['blocked', 'requires_session']).toContain(dispatch.policy_result.route_decision)
  })

  it('redacts owner-visible secrets and raw paths in dispatcher proof', async () => {
    const registry = await loadGatewayRegistry()
    const dispatch = planAgentZeroGatewayDispatch(registry, {
      ownerRequest: 'Use API_KEY=fixture_value from /Users/sosastrike/private and Bearer FixtureToken1234',
      generatedAt: '2026-05-12T00:00:00.000Z',
    })
    const serialized = JSON.stringify(dispatch)

    expect(serialized).not.toMatch(/API_KEY=fixture_value|Bearer\s+FixtureToken1234|\/Users\/sosastrike/i)
    expect(dispatch.owner_request).toContain('[redacted]')
  })
})
