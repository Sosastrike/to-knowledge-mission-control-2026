import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>()
  const dataDir = process.env.SOFIA_TEST_DATA_DIR || '/tmp/mission-control-sofia-dispatcher-test'
  return {
    ...actual,
    config: {
      ...actual.config,
      dataDir,
      dbPath: `${dataDir}/mission-control.db`,
      tokensPath: `${dataDir}/mission-control-tokens.json`,
    },
  }
})

import { buildAgentMessageEnvelope, buildAgentRoutingLinesStatus, resolveAgentRoutingLine } from '@/lib/agent-routing-lines'
import { createGatewayRegistryFromAgentNetwork } from '@/lib/gateway-model'
import { buildAgentHubStatusPayload } from '@/lib/gateway-agent-hub'
import { buildHermesAuthorityMap, buildHermesStatus } from '@/lib/hermes-command-center'
import {
  buildSofiaAuthority,
  buildSofiaCapabilityMap,
  buildSofiaStatus,
  createSofiaJarvisConcurrenceRequest,
  createSofiaRecommendation,
  createSofiaRonReviewRequest,
  refuseSofiaProductionExecution,
} from '@/lib/sofia-deputy-dispatcher'

describe('Sofia deputy dispatcher', () => {
  it('registers Sofia as Ron Weasley second-in-command without OpenCloud authority', () => {
    const status = buildAgentRoutingLinesStatus()
    const sofia = status.by_id.sofia

    expect(sofia).toMatchObject({
      agent_id: 'sofia',
      display_name: 'Sofia',
      system_type: 'deputy_dispatcher',
      gateway_route: '/api/bridge/sofia/*',
      conversation_owner: 'sofia',
      reports_to: 'ron-weasley',
      direct_line_active: true,
      opencloud_allowed_role: 'supporting_tool_only',
      openclaw_allowed_role: 'supporting_tool_only',
      allowed_as_intermediary: false,
      allowed_as_commander: false,
      execution_policy: 'ron_deputy_internal_planning_ron_and_jarvis_concurrence_for_production',
    })
    expect(resolveAgentRoutingLine('sofia')).toMatchObject({ agent_id: 'sofia', conversation_owner: 'sofia' })

    const envelope = buildAgentMessageEnvelope({ target_agent: 'sofia', message: 'review Ron route wording' }, sofia)
    expect(envelope).toMatchObject({
      target_agent: 'sofia',
      conversation_owner: 'sofia',
      direct_line_used: true,
      route_trace: ['owner', 'mission-control', 'nuclear-gateway', 'sofia'],
      intermediaries: [],
      opencloud_used: false,
      opencloud_role: 'not_used',
    })
  })

  it('exposes Sofia authority, capability, and safe draft records only', () => {
    expect(buildSofiaStatus()).toMatchObject({
      route: 'bridge.sofia.status',
      agent_id: 'sofia',
      display_name: 'Sofia',
      title: 'Second-in-Command to Ron Weasley',
      role: 'Deputy Nuclear Dispatcher',
      reports_to: 'ron-weasley',
      final_authority: 'agent-zero-jarvis',
      direct_line_route: '/api/bridge/sofia/status',
      production_execution: 'requires_ron_plus_jarvis_concurrence',
      opencloud_intermediary: false,
      jarvis_final_authority: true,
      writes_enabled: false,
      external_execution_enabled: false,
    })
    expect(buildSofiaAuthority()).toMatchObject({
      sofia_does_not_outrank_ron: true,
      sofia_does_not_outrank_jarvis: true,
      can_act_as_opencloud: false,
      hidden_intermediary_allowed: false,
      production_execution: 'requires_ron_plus_jarvis_concurrence',
    })
    expect(buildSofiaCapabilityMap().capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'create_internal_recommendations', execution_enabled: false }),
      expect.objectContaining({ id: 'request_ron_review', execution_enabled: false }),
      expect.objectContaining({ id: 'request_jarvis_concurrence', execution_enabled: false }),
    ]))

    expect(createSofiaRecommendation({
      title: 'Sofia route wording review',
      recommendation: 'Keep Sofia below Ron and Jarvis.',
      risk_level: 'low',
    })).toMatchObject({
      ok: true,
      route: 'bridge.sofia.recommendation',
      mode: 'sofia_internal_record_written',
      record: { kind: 'sofia_recommendation', payload: { requested_by: 'sofia' } },
      external_execution_enabled: false,
      credential_values_exposed: false,
      jarvis_final_authority: true,
    })
    expect(createSofiaRonReviewRequest({
      request_id: 'sofia-ron-review-test',
      review_topic: 'Ron skill registry update',
      reason: 'Deputy review before Jarvis concurrence.',
    })).toMatchObject({
      ok: true,
      route: 'bridge.sofia.ron_review_request',
      record: { kind: 'ron_review_request', payload: { target_reviewer: 'ron-weasley' } },
    })
    expect(createSofiaJarvisConcurrenceRequest({
      request_id: 'sofia-jarvis-concurrence-test',
      action_type: 'gateway_route_change',
      affected_system: 'mission-control',
      reason: 'Production route change requires final authority.',
    })).toMatchObject({
      ok: true,
      route: 'bridge.sofia.jarvis_concurrence_request',
      record: { kind: 'jarvis_concurrence_request', payload: { target_authority: 'agent-zero-jarvis' } },
    })
    expect(refuseSofiaProductionExecution({ action_type: 'production_write' })).toMatchObject({
      ok: false,
      exact_blocker: 'sofia_requires_ron_and_jarvis_concurrence',
      writes_enabled: false,
      external_execution_enabled: false,
      credential_values_exposed: false,
    })
  })

  it('adds Sofia to Agent Hub and Ron policy surfaces', () => {
    const registry = createGatewayRegistryFromAgentNetwork({ generatedAt: '2026-05-29T00:00:00.000Z' })
    const payload = buildAgentHubStatusPayload(registry)

    expect(payload.agents.map((agent) => agent.id)).toEqual(expect.arrayContaining(['sofia']))
    expect(payload.agents.find((agent) => agent.id === 'sofia')).toMatchObject({
      name: 'Sofia',
      role: 'Deputy Nuclear Dispatcher',
      status: 'configured',
      called_true_proven: true,
      routes: { bridge_status: '/api/bridge/sofia/status' },
    })
    expect(payload.nuclear_gateway_graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'sofia', label: 'Sofia', role: 'Second-in-Command to Ron Weasley', direct_line_owner: true }),
    ]))
    expect(payload.nuclear_gateway_graph.edges).toEqual(expect.arrayContaining([
      { source: 'nuclear.gateway', target: 'sofia', relation: 'routes_to' },
      { source: 'sofia', target: 'ron.weasley', relation: 'reports_to' },
    ]))
    expect(payload.nuclear_gateway_graph.direct_line_trace_buttons).toEqual(expect.arrayContaining([
      expect.objectContaining({ agent_id: 'sofia', label: 'Sofia' }),
    ]))

    expect(buildHermesStatus()).toMatchObject({
      deputy: expect.objectContaining({ agent_id: 'sofia', display_name: 'Sofia', reports_to: 'ron-weasley' }),
    })
    expect(buildHermesAuthorityMap()).toMatchObject({
      deputy_authority: expect.objectContaining({
        agent_id: 'sofia',
        production_execution: 'requires_ron_plus_jarvis_concurrence',
      }),
    })
  })
})
