import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildGatewayGraphTopology } from '@/lib/gateway-graph-topology'
import {
  buildGatewayGraphTrafficFromReadOnlyDatabase,
  buildGatewayGraphTrafficSnapshot,
} from '@/lib/gateway-graph-traffic'

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

  it('reads model and AgentMail telemetry from the Mission Control DB without mutating it', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-traffic-'))
    const dbPath = join(root, 'mission-control.db')
    const db = new Database(dbPath)
    db.exec(`
      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        provider TEXT,
        model TEXT,
        started_at TEXT,
        ended_at TEXT,
        status TEXT
      );
      CREATE TABLE agentmail_audit (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `)
    db.prepare(`INSERT INTO runs (id, provider, model, started_at, status) VALUES (?, ?, ?, ?, ?)`)
      .run('run_recent_openrouter', 'openrouter', 'gpt-4o', '2026-06-09T14:59:50.000Z', 'completed')
    db.prepare(`INSERT INTO agentmail_audit (id, action, result, created_at) VALUES (?, ?, ?, ?)`)
      .run('audit_old_agentmail', 'agentmail_receive_verification_passed', 'ok', Math.floor(Date.parse('2026-06-09T14:55:00.000Z') / 1000))
    db.close()

    const topology = buildGatewayGraphTopology('2026-06-09T15:00:00.000Z')
    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology,
      dbPath,
    })

    expect(snapshot.traffic_source).toBe('live')
    expect(snapshot.telemetry_sources_inspected).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_id: 'model_request_logs', status: 'readable' }),
      expect.objectContaining({ source_id: 'agentmail_events', status: 'readable' }),
    ]))
    expect(snapshot.edges.find((edge) => edge.edge_id === 'model.openrouter_to_gateway')).toMatchObject({
      requests_last_60s: 1,
      traffic_status: 'active',
      telemetry_source: 'model_request_logs',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'model.gemini_to_gateway')).toMatchObject({
      traffic_status: 'ready_no_recent_traffic',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'agentmail.gateway_to_agentmail')).toMatchObject({
      traffic_status: 'stale',
      last_event_at: '2026-06-09T14:55:00.000Z',
    })
    expect(snapshot.summary.missing_traffic_mappings).toBe(0)
    expect(JSON.stringify(snapshot)).not.toMatch(
      /Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i,
    )

    rmSync(root, { recursive: true, force: true })
  })

  it('reports telemetry records that cannot be mapped to a canonical edge without animating them', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-traffic-unmapped-'))
    const dbPath = join(root, 'mission-control.db')
    const db = new Database(dbPath)
    db.exec(`
      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        provider TEXT,
        model TEXT,
        started_at TEXT,
        status TEXT
      );
    `)
    db.prepare(`INSERT INTO runs (id, provider, model, started_at, status) VALUES (?, ?, ?, ?, ?)`)
      .run('run_unknown_provider', 'mystery-provider', 'mystery-model', '2026-06-09T14:59:50.000Z', 'completed')
    db.close()

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
    })

    expect(snapshot.traffic_source).toBe('partial')
    expect(snapshot.summary.active_traffic_edges).toBe(0)
    expect(snapshot.summary.missing_traffic_mappings).toBe(1)
    expect(snapshot.missing_traffic_mappings).toEqual([
      expect.objectContaining({
        source_id: 'model_request_logs',
        reason: 'traffic_edge_mapping_missing',
      }),
    ])

    rmSync(root, { recursive: true, force: true })
  })

  it('uses the latest readable activity when multiple sources cover one canonical edge', () => {
    const topology = buildGatewayGraphTopology('2026-06-09T15:00:00.000Z')
    const snapshot = buildGatewayGraphTrafficSnapshot({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology,
      trustedSources: [
        { source_id: 'agentmail_events', status: 'readable', inspected_at: '2026-06-09T15:00:00.000Z', edge_ids: ['agentmail.gateway_to_agentmail'] },
        { source_id: 'bridge_queue_events', status: 'readable', inspected_at: '2026-06-09T15:00:00.000Z', edge_ids: ['agentmail.gateway_to_agentmail'] },
      ],
      edgeActivity: [{
        edge_id: 'agentmail.gateway_to_agentmail',
        events: 1,
        occurred_at: '2026-06-09T14:59:50.000Z',
        source_id: 'bridge_queue_events',
      }],
    })

    expect(snapshot.edges.find((edge) => edge.edge_id === 'agentmail.gateway_to_agentmail')).toMatchObject({
      traffic_status: 'active',
      events_last_60s: 1,
      telemetry_source: 'bridge_queue_events',
    })
  })
})
