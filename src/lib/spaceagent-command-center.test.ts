import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>()
  const dataDir = process.env.SPACEAGENT_TEST_DATA_DIR || '/tmp/mission-control-spaceagent-command-center-test'
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
import {
  buildSpaceAgentAuthority,
  buildSpaceAgentBrainStatus,
  buildSpaceAgentCapabilityMap,
  buildSpaceAgentCertificationProof,
  buildSpaceAgentPipelineStatus,
  buildSpaceAgentQualityScorecard,
  buildSpaceAgentReadiness,
  buildSpaceAgentStatus,
  buildSpaceAgentToolMap,
  createSpaceAgentJarvisConcurrenceRequest,
  createSpaceAgentRecommendation,
  createSpaceAgentReportDraft,
  createSpaceAgentTaskPlan,
  refuseSpaceAgentProductionExecution,
} from '@/lib/spaceagent-command-center'

describe('SpaceAgent first-class Mission Control agent', () => {
  it('registers SpaceAgent as an independent direct-line agent under Jarvis', () => {
    const status = buildAgentRoutingLinesStatus()
    const spaceagent = status.by_id.spaceagent

    expect(spaceagent).toMatchObject({
      agent_id: 'spaceagent',
      display_name: 'SpaceAgent',
      system_type: 'specialist_agent_system',
      gateway_route: '/api/bridge/spaceagent/*',
      conversation_owner: 'spaceagent',
      reports_to: 'agent-zero-jarvis',
      direct_line_active: true,
      execution_policy: 'certified_exact_scope_or_read_only',
      allowed_as_intermediary: false,
      allowed_as_commander: false,
    })
    expect(resolveAgentRoutingLine('space-agent')).toMatchObject({ agent_id: 'spaceagent', conversation_owner: 'spaceagent' })
    expect(resolveAgentRoutingLine('SpaceAgent')).toMatchObject({ agent_id: 'spaceagent', conversation_owner: 'spaceagent' })
    expect(resolveAgentRoutingLine('opencloud')).toMatchObject({ agent_id: 'openclaw', conversation_owner: 'none' })

    const envelope = buildAgentMessageEnvelope({ target_agent: 'spaceagent', message: 'Read Gateway state' }, spaceagent)
    expect(envelope).toMatchObject({
      target_agent: 'spaceagent',
      conversation_owner: 'spaceagent',
      direct_line_used: true,
      route_trace: ['owner', 'mission-control', 'nuclear-gateway', 'spaceagent'],
      intermediaries: [],
      opencloud_used: false,
      opencloud_role: 'not_used',
    })
  })

  it('exposes status, readiness, authority, capability map, and safe internal records', () => {
    expect(buildSpaceAgentStatus()).toMatchObject({
      route: 'bridge.spaceagent.status',
      agent_id: 'spaceagent',
      display_name: 'SpaceAgent',
      reports_to: 'agent-zero-jarvis',
      conversation_owner: 'spaceagent',
      direct_line_active: true,
      opencloud_intermediary_allowed: false,
      jarvis_final_authority: true,
      execution_policy: 'certified_exact_scope_or_read_only',
      writes_enabled: false,
      external_execution_enabled: false,
      credential_values_exposed: false,
    })
    expect(buildSpaceAgentReadiness()).toMatchObject({
      route: 'bridge.spaceagent.readiness',
      status: 'SPACEAGENT_READINESS_GATEWAY_REGISTERED',
      readiness_states: expect.arrayContaining(['READ_ONLY_READY', 'WRITE_GATED', 'CREDENTIAL_REQUIRED', 'BRIDGE_SESSION_REQUIRED', 'NOT_CERTIFIED']),
      final_certification_status: 'NOT_CERTIFIED',
    })
    expect(buildSpaceAgentAuthority()).toMatchObject({
      route: 'bridge.spaceagent.authority',
      may_execute_production_changes: false,
      may_receive_raw_credentials: false,
      may_use_opencloud_as_intermediary: false,
      jarvis_concurrence_required_for_production: true,
    })
    const capabilityMap = buildSpaceAgentCapabilityMap()
    expect(capabilityMap.tools.map((tool) => tool.classification)).toEqual(expect.arrayContaining([
      'READ_ONLY',
      'WRITE_GATED',
      'CREDENTIAL_REQUIRED',
      'PERMISSION_REQUIRED',
      'UNSAFE_DISABLED',
    ]))
    expect(capabilityMap.pipeline_templates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'spaceagent_readiness_probe', route: '/api/bridge/spaceagent/readiness' }),
      expect.objectContaining({ id: 'spaceagent_report_draft', route: '/api/bridge/spaceagent/report-draft' }),
      expect.objectContaining({ id: 'jarvis_concurrence_gate', route: '/api/bridge/spaceagent/jarvis-concurrence-request' }),
    ]))
    expect(capabilityMap.pipeline_status_route).toBe('/api/bridge/spaceagent/pipeline-status')
    expect(capabilityMap.tool_map_route).toBe('/api/bridge/spaceagent/tool-map')
    expect(capabilityMap.brain_access.brain_status_route).toBe('/api/bridge/spaceagent/brain-status')

    expect(buildSpaceAgentToolMap()).toMatchObject({
      route: 'bridge.spaceagent.tool-map',
      status: 'SPACEAGENT_TOOL_MAP_GATEWAY_BROKERED',
      classifications: {
        READ_ONLY: expect.any(Number),
        WRITE_GATED: expect.any(Number),
        CREDENTIAL_REQUIRED: expect.any(Number),
        PERMISSION_REQUIRED: expect.any(Number),
        UNSAFE_DISABLED: expect.any(Number),
      },
      credential_policy: { values_exposed: false, brokered_credentials_by_name_only: true },
      proof: { gateway_brokered: true, no_opencloud_intermediary: true, credential_values_exposed: false },
      execution_enabled: false,
      external_execution_enabled: false,
    })

    expect(buildSpaceAgentPipelineStatus()).toMatchObject({
      route: 'bridge.spaceagent.pipeline-status',
      status: 'SPACEAGENT_PIPELINE_REGISTERED_INTERNAL_ONLY',
      pipeline: {
        id: 'spaceagent_gateway_integration_pipeline',
        name: 'SpaceAgent Gateway Integration Pipeline',
        direct_gateway_connection: true,
        opencloud_intermediary_allowed: false,
      },
      proof: {
        pipeline_visible: true,
        no_external_execution: true,
        no_opencloud_intermediary: true,
        credential_values_exposed: false,
      },
      execution_enabled: false,
      external_execution_enabled: false,
    })

    expect(buildSpaceAgentCertificationProof()).toMatchObject({
      route: 'bridge.spaceagent.certification-proof',
      status: 'SPACEAGENT_CERTIFICATION_SOURCE_PROOF_READY_LIVE_PROOF_PENDING',
      final_status: 'PENDING_AUTHENTICATED_DIRECT_LINE_AND_BROWSER_PROOF',
      direct_line: { conversation_owner: 'spaceagent', direct_line_active: true, opencloud_intermediary_allowed: false },
      message_envelope: { target_agent: 'spaceagent', conversation_owner: 'spaceagent', direct_line_used: true, route_trace: ['owner', 'mission-control', 'nuclear-gateway', 'spaceagent'], opencloud_used: false },
      surfaces: { agent_hub_visible: true, gateway_visible: true, pipeline_visible: true, brain_bridge_visible: true, tool_map_visible: true },
      unsafe_action_refusal: { exact_blocker: 'spaceagent_requires_jarvis_concurrence', execution_enabled: false, credential_values_exposed: false },
      proof: { no_opencloud_intermediary: true, no_external_execution: true, credential_values_exposed: false },
      execution_enabled: false,
      external_execution_enabled: false,
    })

    expect(buildSpaceAgentQualityScorecard()).toMatchObject({
      route: 'bridge.spaceagent.quality-scorecard',
      status: 'SPACEAGENT_QUALITY_SCORECARD_BASELINE_READY',
      final_certification_status: 'NOT_CERTIFIED',
      review_policy: { ron_review_available: true, jarvis_final_certification_required: true, production_execution_without_jarvis: false },
      proof: { baseline_defined: true, scenarios_defined: true, no_opencloud_intermediary: true, credential_values_exposed: false },
      execution_enabled: false,
      external_execution_enabled: false,
    })
    expect(buildSpaceAgentQualityScorecard().metrics.map((metric) => metric.id)).toEqual(expect.arrayContaining(['response_accuracy', 'direct_line_correctness', 'unsafe_action_refusal']))
    expect(buildSpaceAgentQualityScorecard().training_scenarios.map((scenario) => scenario.id)).toEqual(expect.arrayContaining(['read_gateway_state', 'request_jarvis_concurrence', 'refuse_unsafe_action']))

    expect(buildSpaceAgentBrainStatus()).toMatchObject({
      route: 'bridge.spaceagent.brain-status',
      status: 'SPACEAGENT_BRAIN_BRIDGE_CONNECTED_READ_ONLY',
      brain_bridge: {
        gateway_connected: true,
        opencloud_intermediary_allowed: false,
        read_only_canonical_truth: true,
        live_routes_outrank_stale_memory: true,
      },
      memory_policy: {
        can_read_canonical_truth: true,
        can_recommend_corrections: true,
        can_request_memory_write: true,
        can_execute_memory_write: false,
        broad_memory_deletion_allowed: false,
        raw_secret_memory_writes_allowed: false,
      },
      proof: { no_opencloud_intermediary: true, credential_values_exposed: false },
      execution_enabled: false,
      external_execution_enabled: false,
    })

    expect(createSpaceAgentRecommendation({
      title: 'SpaceAgent source review',
      recommendation: 'Use Gateway read-only routes first.',
      risk_level: 'low',
    })).toMatchObject({
      ok: true,
      route: 'bridge.spaceagent.recommendation',
      mode: 'spaceagent_internal_record_written',
      record: { kind: 'spaceagent_recommendation', payload: { requested_by: 'spaceagent' } },
      external_execution_enabled: false,
      credential_values_exposed: false,
      jarvis_final_authority: true,
    })
    expect(createSpaceAgentTaskPlan({
      title: 'SpaceAgent readiness probe',
      objective: 'Read Gateway status and report blockers.',
    })).toMatchObject({
      ok: true,
      route: 'bridge.spaceagent.task_plan',
      record: { kind: 'spaceagent_task_plan' },
    })
    expect(createSpaceAgentReportDraft({
      title: 'SpaceAgent report',
      summary: 'Read-only report draft.',
    })).toMatchObject({
      ok: true,
      route: 'bridge.spaceagent.report_draft',
      record: { kind: 'spaceagent_report_draft' },
    })
    expect(createSpaceAgentJarvisConcurrenceRequest({
      request_id: 'spaceagent-jarvis-test',
      action_type: 'gateway_tool_execution',
      reason: 'Major action requires Jarvis concurrence.',
    })).toMatchObject({
      ok: true,
      route: 'bridge.spaceagent.jarvis_concurrence_request',
      record: { kind: 'spaceagent_jarvis_concurrence_request', payload: { target_authority: 'agent-zero-jarvis' } },
    })
    expect(refuseSpaceAgentProductionExecution({ action_type: 'production_write' })).toMatchObject({
      ok: false,
      exact_blocker: 'spaceagent_requires_jarvis_concurrence',
      writes_enabled: false,
      external_execution_enabled: false,
      credential_values_exposed: false,
    })
  })

  it('shows SpaceAgent as first-class in Agent Hub and Nuclear Gateway graph', () => {
    const registry = createGatewayRegistryFromAgentNetwork({ generatedAt: '2026-05-30T00:00:00.000Z' })
    const payload = buildAgentHubStatusPayload(registry)
    const spaceagent = payload.agents.find((agent) => agent.id === 'spaceagent')

    expect(spaceagent).toMatchObject({
      name: 'SpaceAgent',
      role: 'Independent Specialized Agent',
      status: 'configured',
      called_true_proven: true,
      routes: { bridge_status: '/api/bridge/spaceagent/status' },
    })
    expect(payload.production_truth.spaceagent).toBe('first_class_direct_line_gateway_pipeline_agent')
    expect(payload.nuclear_gateway_graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'spaceagent', label: 'SpaceAgent', role: 'independent specialized agent under Jarvis authority', direct_line_owner: true }),
    ]))
    expect(payload.nuclear_gateway_graph.edges).toEqual(expect.arrayContaining([
      { source: 'nuclear.gateway', target: 'spaceagent', relation: 'routes_to' },
      { source: 'spaceagent', target: 'agent.zero', relation: 'reports_to' },
    ]))
  })
})
