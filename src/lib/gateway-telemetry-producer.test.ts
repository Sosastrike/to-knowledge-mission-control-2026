import { beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const gatewaySessionStoreMock = vi.hoisted(() => ({
  getAllGatewaySessions: vi.fn(() => []),
}))

vi.mock('@/lib/sessions', () => gatewaySessionStoreMock)

import {
  recordGatewayModelUsage,
  recordGatewayToolActivity,
} from '@/lib/gateway-telemetry-producer'
import { buildGatewayGraphTopology } from '@/lib/gateway-graph-topology'
import { buildGatewayGraphTrafficFromReadOnlyDatabase } from '@/lib/gateway-graph-traffic'

function createTelemetryDb() {
  const root = mkdtempSync(join(tmpdir(), 'gateway-telemetry-producer-'))
  const dbPath = join(root, 'mission-control.db')
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT NOT NULL,
      session_id TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      workspace_id INTEGER NOT NULL DEFAULT 1,
      task_id INTEGER,
      cost_usd REAL,
      agent_name TEXT
    );
    CREATE TABLE activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      actor TEXT NOT NULL,
      description TEXT NOT NULL,
      data TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      workspace_id INTEGER NOT NULL DEFAULT 1
    );
  `)
  return { root, dbPath, db }
}

describe('gateway telemetry producer', () => {
  beforeEach(() => {
    gatewaySessionStoreMock.getAllGatewaySessions.mockReturnValue([])
  })

  it('records model usage in token_usage and canonical traffic activities without raw payloads', () => {
    const { root, dbPath, db } = createTelemetryDb()

    const result = recordGatewayModelUsage({
      db,
      agentName: 'Jarvis',
      canonicalAgentId: 'agent.zero',
      provider: 'openai',
      model: 'gpt-5.4',
      sessionId: 'agent.zero:telegram',
      inputTokens: 123,
      outputTokens: 45,
      occurredAt: '2026-06-09T14:59:50.000Z',
      workspaceId: 1,
    })

    expect(result.tokenUsageId).toEqual(expect.any(Number))
    expect(result.activityIds.length).toBeGreaterThanOrEqual(2)
    expect(db.prepare('SELECT model, session_id, input_tokens, output_tokens, agent_name FROM token_usage').all()).toEqual([
      {
        model: 'openai/gpt-5.4',
        session_id: 'agent.zero:telegram',
        input_tokens: 123,
        output_tokens: 45,
        agent_name: 'agent.zero',
      },
    ])

    const activities = db.prepare('SELECT type, actor, data FROM activities ORDER BY id').all() as Array<{ type: string; actor: string; data: string }>
    expect(activities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'gateway_model_usage', actor: 'agent.zero' }),
      expect.objectContaining({ type: 'gateway_agent_activity', actor: 'agent.zero' }),
    ]))
    expect(JSON.stringify(activities)).toContain('model.openai_codex_to_gateway')
    expect(JSON.stringify(activities)).toContain('highway.inputs.agent.zero')
    expect(JSON.stringify(activities)).not.toMatch(/Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i)

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
    })

    expect(snapshot.edges.find((edge) => edge.edge_id === 'model.openai_codex_to_gateway')).toMatchObject({
      traffic_status: 'active',
      requests_last_60s: 1,
      bytes_in_last_60s: 123,
      bytes_out_last_60s: 45,
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.inputs.agent.zero')).toMatchObject({
      traffic_status: 'active',
      events_last_60s: 1,
    })

    db.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('records tool activity as canonical traffic without creating fake token spend', () => {
    const { root, dbPath, db } = createTelemetryDb()

    const result = recordGatewayToolActivity({
      db,
      agentName: 'Paperclip',
      canonicalAgentId: 'agent.paperclip',
      canonicalEdgeId: 'connector.tools_registry_to_gateway',
      canonicalNodeId: 'int.tools',
      toolId: 'skills.lookup',
      sourceSystem: 'tools_registry',
      occurredAt: '2026-06-09T14:59:50.000Z',
      workspaceId: 1,
    })

    expect(result.tokenUsageId).toBeNull()
    expect(result.activityIds.length).toBeGreaterThanOrEqual(2)
    expect(db.prepare('SELECT COUNT(*) as count FROM token_usage').get()).toEqual({ count: 0 })

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
    })

    expect(snapshot.edges.find((edge) => edge.edge_id === 'connector.tools_registry_to_gateway')).toMatchObject({
      traffic_status: 'active',
      events_last_60s: 1,
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.inputs.agent.paperclip')).toMatchObject({
      traffic_status: 'active',
      events_last_60s: 1,
    })

    db.close()
    rmSync(root, { recursive: true, force: true })
  })
})
