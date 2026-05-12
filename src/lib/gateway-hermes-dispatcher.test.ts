import { describe, expect, it } from 'vitest'
import {
  buildHermesDispatcherStatusPayload,
  planHermesGatewayDispatch,
} from './gateway-hermes-dispatcher'
import { loadGatewayRegistry } from './gateway-registry-api'

describe('Hermes Gateway dispatcher', () => {
  it('publishes Hermes as Agent Zero lieutenant without claiming live chat or execution', async () => {
    const registry = await loadGatewayRegistry()
    const status = buildHermesDispatcherStatusPayload(registry, '2026-05-12T00:00:00.000Z')

    expect(status).toMatchObject({
      ok: true,
      mode: 'hermes_dispatcher_status',
      canonical_status: 'BLOCKED',
      blocker_class: 'BLOCKED',
      blocker: 'hermes_safe_live_chat_adapter_not_configured',
      node_id: 'hermes',
      role: 'lieutenant / skill and workflow specialist',
      commander: false,
      agent_zero_is_commander: true,
      hermes_called: false,
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
    expect(status.safe_probe.route.dispatch_target).toBe('hermes')
    expect(status.audit_trail[0]).toMatchObject({
      event: 'hermes.dispatcher.route_planned',
      execution_enabled: false,
      writes_enabled: false,
      hermes_called: false,
      secrets_exposed: false,
    })
  })

  it('routes workflow and skill design to Hermes through Agent Zero', async () => {
    const registry = await loadGatewayRegistry()
    const dispatch = planHermesGatewayDispatch(registry, {
      ownerRequest: 'Design a workflow skill for email triage',
      generatedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(dispatch).toMatchObject({
      ok: true,
      mode: 'hermes_dispatcher_route_plan',
      classification: 'skill',
      agent_zero_in_route: true,
      hermes_in_route: true,
      hermes_called: false,
      live_adapter_status: 'blocked_safe_live_chat_adapter_not_configured',
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      dispatch_executed: false,
    })
    expect(dispatch.route).toMatchObject({
      primary_target: 'agent_zero',
      dispatch_target: 'hermes',
      via: ['owner', 'gateway', 'agent_zero', 'hermes'],
      final_commander: 'agent_zero',
    })
  })

  it('does not pretend Hermes handled non-Hermes owner requests', async () => {
    const registry = await loadGatewayRegistry()
    const dispatch = planHermesGatewayDispatch(registry, {
      ownerRequest: 'Who is commander?',
      generatedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(dispatch.route.dispatch_target).toBe('agent_zero')
    expect(dispatch.hermes_in_route).toBe(false)
    expect(dispatch.hermes_called).toBe(false)
    expect(dispatch.blocker).toBe('hermes_not_selected_for_this_request')
    expect(dispatch.dispatch_executed).toBe(false)
  })

  it('redacts owner-visible secret-like strings and raw paths in Hermes dispatcher proof', async () => {
    const registry = await loadGatewayRegistry()
    const dispatch = planHermesGatewayDispatch(registry, {
      ownerRequest: 'Design a skill with API_KEY=fixture_value from /Users/sosastrike/private and Bearer FixtureToken1234',
      generatedAt: '2026-05-12T00:00:00.000Z',
    })
    const serialized = JSON.stringify(dispatch)

    expect(serialized).not.toMatch(/API_KEY=fixture_value|Bearer\s+FixtureToken1234|\/Users\/sosastrike/i)
    expect(dispatch.owner_request).toContain('[redacted]')
  })
})
