import { describe, expect, it } from 'vitest'

import {
  buildAgentConfigSyncIdentityContract,
  findCanonicalGatewayTelemetryIdentity,
} from '@/lib/gateway-telemetry-identity'

describe('Gateway telemetry identity contract', () => {
  it('resolves known gateway identities to canonical node and edge metadata', () => {
    expect(findCanonicalGatewayTelemetryIdentity(['agent.zero'])).toMatchObject({
      canonical_agent_id: 'agent.zero',
      canonical_node_id: 'agent.zero',
      canonical_edge_id: 'highway.inputs.agent.zero',
      route_group: 'inputs',
    })
    expect(findCanonicalGatewayTelemetryIdentity(['brain.gbrain'])).toMatchObject({
      canonical_agent_id: 'brain.gbrain',
      canonical_node_id: 'brain.gbrain',
      canonical_edge_id: 'highway.knowledge.brain.gbrain',
      route_group: 'knowledge',
    })
    expect(findCanonicalGatewayTelemetryIdentity(['opencloud.octm'])).toMatchObject({
      canonical_agent_id: 'opencloud.octm',
      canonical_node_id: 'oc.parent',
      canonical_edge_id: 'highway.models.oc.parent',
    })
  })

  it('keeps Tony as owner/operator identity instead of an agent edge', () => {
    const identity = findCanonicalGatewayTelemetryIdentity(['Tony'])
    expect(identity).toMatchObject({
      canonical_agent_id: 'owner.tony',
      canonical_node_id: 'input.owner',
      canonical_edge_id: null,
      owner_operator: true,
    })

    const contract = buildAgentConfigSyncIdentityContract({
      openclawAgent: { id: 'Tony', name: 'Tony', identity: { name: 'Tony' } },
      agentName: 'Tony',
      action: 'updated',
      occurredAt: '2026-06-10T12:00:00.000Z',
    })
    expect(contract).toMatchObject({
      event_type: 'agent_config_sync',
      source_system: 'agent_config',
      canonical_agent_id: 'owner.tony',
      canonical_node_id: 'input.owner',
      canonical_edge_id: null,
      confidence: 'source_provided',
      reason: 'owner_operator_identity_outside_gateway_agent_edges',
    })
  })

  it('marks unknown agent config sync producers unresolved without inventing topology', () => {
    const contract = buildAgentConfigSyncIdentityContract({
      openclawAgent: { id: 'unknown-agent', name: 'Friendly Unknown' },
      agentName: 'Friendly Unknown',
      action: 'created',
    })

    expect(contract).toMatchObject({
      canonical_agent_id: null,
      canonical_node_id: null,
      canonical_edge_id: null,
      route_group: null,
      confidence: 'unresolved',
      reason: 'canonical_identity_missing',
    })
  })
})
