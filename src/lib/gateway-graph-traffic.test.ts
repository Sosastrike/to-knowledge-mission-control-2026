import { describe, expect, it } from 'vitest'

import { buildGatewayGraphTopology } from '@/lib/gateway-graph-topology'
import { buildGatewayGraphTrafficSnapshot } from '@/lib/gateway-graph-traffic'

describe('gateway graph traffic snapshot', () => {
  it('returns unavailable traffic without trusted runtime telemetry', () => {
    const topology = buildGatewayGraphTopology('2026-06-09T15:00:00.000Z')
    const snapshot = buildGatewayGraphTrafficSnapshot({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology,
    })

    expect(snapshot).toMatchObject({
      ok: true,
      source: 'gateway_graph_traffic',
      traffic_source: 'unavailable',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_executed: false,
      broad_connector_execution_enabled: false,
    })
    expect(snapshot.edges).toHaveLength(topology.edges.length)
    expect(snapshot.summary).toMatchObject({
      active_traffic_edges: 0,
      stale_telemetry_edges: 0,
      unavailable_telemetry_edges: topology.edges.length,
    })
    expect(snapshot.edges.every((edge) => edge.traffic_status === 'unavailable')).toBe(true)
    expect(JSON.stringify(snapshot)).not.toMatch(
      /Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i,
    )
  })

  it('marks a canonical edge active only when trusted recent activity exists', () => {
    const topology = buildGatewayGraphTopology('2026-06-09T15:00:00.000Z')
    const snapshot = buildGatewayGraphTrafficSnapshot({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology,
      trustedSources: [{ source_id: 'model_request_logs', status: 'readable', inspected_at: '2026-06-09T15:00:00.000Z' }],
      edgeActivity: [{
        edge_id: 'model.openrouter_to_gateway',
        requests: 2,
        bytes_in: 120,
        bytes_out: 360,
        occurred_at: '2026-06-09T14:59:45.000Z',
        source_id: 'model_request_logs',
      }],
    })

    const active = snapshot.edges.find((edge) => edge.edge_id === 'model.openrouter_to_gateway')
    const idle = snapshot.edges.find((edge) => edge.edge_id === 'model.gemini_to_gateway')

    expect(snapshot.traffic_source).toBe('live')
    expect(active).toMatchObject({
      requests_last_60s: 2,
      bytes_in_last_60s: 120,
      bytes_out_last_60s: 360,
      traffic_status: 'active',
    })
    expect(idle).toMatchObject({
      requests_last_60s: 0,
      events_last_60s: 0,
      traffic_status: 'ready_no_recent_traffic',
    })
    expect(snapshot.summary.active_traffic_edges).toBe(1)
  })

  it('marks old trusted activity stale instead of animating it', () => {
    const topology = buildGatewayGraphTopology('2026-06-09T15:00:00.000Z')
    const snapshot = buildGatewayGraphTrafficSnapshot({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology,
      trustedSources: [{ source_id: 'agentmail_events', status: 'readable', inspected_at: '2026-06-09T15:00:00.000Z' }],
      edgeActivity: [{
        edge_id: 'agentmail.gateway_to_agentmail',
        events: 1,
        occurred_at: '2026-06-09T14:55:00.000Z',
        source_id: 'agentmail_events',
      }],
    })

    const edge = snapshot.edges.find((item) => item.edge_id === 'agentmail.gateway_to_agentmail')

    expect(snapshot.traffic_source).toBe('partial')
    expect(edge).toMatchObject({
      events_last_60s: 0,
      traffic_status: 'stale',
      last_event_at: '2026-06-09T14:55:00.000Z',
    })
    expect(snapshot.summary.stale_telemetry_edges).toBe(1)
    expect(snapshot.summary.active_traffic_edges).toBe(0)
  })
})
