import { describe, expect, it } from 'vitest'

import {
  buildGatewayGraphSyncStatus,
  buildGatewayGraphTopology,
} from '@/lib/gateway-graph-topology'

describe('gateway graph topology snapshot', () => {
  it('backs visible operator highways with canonical server-side edge ids', () => {
    const snapshot = buildGatewayGraphTopology('2026-06-09T14:00:00.000Z')
    const edgeIds = snapshot.edges.map((edge) => edge.edge_id)

    expect(snapshot).toMatchObject({
      ok: true,
      source: 'gateway_graph_topology',
      runtime_id: 'mission-control',
      asset_version: 'gateway-topology-v1',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_executed: false,
      broad_connector_execution_enabled: false,
    })
    expect(edgeIds).toEqual(expect.arrayContaining([
      'highway.models.dispatcher-link',
      'highway.models.trunk',
      'highway.models.model.openrouter',
      'highway.knowledge.trunk',
      'highway.knowledge.brain.gbrain',
      'highway.agentmail.int.agentmail',
      'highway.zapier.int.zapier',
      'model.openrouter_to_gateway',
    ]))
    expect(snapshot.graph_mapping_errors).toEqual([])
  })

  it('separates structural topology from readiness and live traffic', () => {
    const snapshot = buildGatewayGraphTopology('2026-06-09T14:00:00.000Z')
    const byId = new Map(snapshot.edges.map((edge) => [edge.edge_id, edge]))

    expect(byId.get('highway.models.trunk')).toMatchObject({
      relationship: 'structural',
      route_group: 'models',
      traffic_state: 'traffic_data_unavailable',
      traffic: {
        events_last_60s: 0,
        requests_last_60s: 0,
        bytes_in_last_60s: 0,
        bytes_out_last_60s: 0,
      },
    })
    expect(byId.get('model.openrouter_to_gateway')).toMatchObject({
      relationship: 'readiness',
      route_group: 'models',
      status: 'live',
      traffic_state: 'traffic_data_unavailable',
    })
    expect(snapshot.edges.some((edge) => edge.traffic_state === 'live_recent')).toBe(false)
  })

  it('does not expose secrets in topology payloads', () => {
    const snapshot = buildGatewayGraphTopology('2026-06-09T14:00:00.000Z')

    expect(JSON.stringify(snapshot)).not.toMatch(
      /Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i,
    )
  })
})

describe('gateway graph sync status', () => {
  it('reports healthy sync when rendered ids match canonical topology', () => {
    const topology = buildGatewayGraphTopology('2026-06-09T14:00:00.000Z')
    const status = buildGatewayGraphSyncStatus({
      generatedAt: '2026-06-09T14:00:01.000Z',
      topology,
      renderedNodeIds: topology.nodes.map((node) => node.node_id),
      renderedEdgeIds: topology.edges.map((edge) => edge.edge_id),
    })

    expect(status).toMatchObject({
      ok: true,
      source: 'gateway_graph_sync_status',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_executed: false,
      broad_connector_execution_enabled: false,
      graph_sync: {
        status: 'healthy',
        topology_node_count: topology.nodes.length,
        rendered_node_count: topology.nodes.length,
        topology_edge_count: topology.edges.length,
        rendered_edge_count: topology.edges.length,
        missing_node_mappings: [],
        missing_edge_mappings: [],
        stale_edges: [],
        status_mismatches: [],
        traffic_mismatches: [],
        primary_blocker: null,
      },
    })
  })

  it('flags missing rendered edge mappings instead of silently treating visuals as live', () => {
    const topology = buildGatewayGraphTopology('2026-06-09T14:00:00.000Z')
    const renderedEdgeIds = topology.edges
      .map((edge) => edge.edge_id)
      .filter((id) => id !== 'highway.models.model.openrouter')
    const status = buildGatewayGraphSyncStatus({
      generatedAt: '2026-06-09T14:00:01.000Z',
      topology,
      renderedNodeIds: topology.nodes.map((node) => node.node_id),
      renderedEdgeIds,
    })

    expect(status.graph_sync).toMatchObject({
      status: 'degraded',
      primary_blocker: 'missing_edge_mappings',
    })
    expect(status.graph_sync.missing_edge_mappings).toContain('highway.models.model.openrouter')
  })
})
