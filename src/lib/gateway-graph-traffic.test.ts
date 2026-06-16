import { beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type GatewaySessionFixture = {
  key: string
  agent: string
  sessionId: string
  updatedAt: number
  chatType: string
  channel: string
  model: string
  totalTokens: number
  inputTokens: number
  outputTokens: number
  contextTokens: number
  active: boolean
}

const gatewaySessionStoreMock = vi.hoisted(() => ({
  getAllGatewaySessions: vi.fn<(_limit?: number, _includeInactive?: boolean) => GatewaySessionFixture[]>(() => []),
}))

vi.mock('@/lib/sessions', () => gatewaySessionStoreMock)

import { buildGatewayGraphTopology } from '@/lib/gateway-graph-topology'
import {
  buildGatewayGraphTrafficFromReadOnlyDatabase,
  buildGatewayGraphTrafficSnapshot,
} from '@/lib/gateway-graph-traffic'

describe('gateway graph traffic snapshot', () => {
  beforeEach(() => {
    gatewaySessionStoreMock.getAllGatewaySessions.mockReturnValue([])
  })

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


  it('reads fresh ClaudeClaw memory and knowledge runtime traffic onto canonical edges', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-claudeclaw-memory-knowledge-'))
    const dbPath = join(root, 'mission-control.db')
    const claudeClawDbPath = join(root, 'claudeclaw.db')
    const db = new Database(dbPath)
    db.close()
    const claudeClawDb = new Database(claudeClawDbPath)
    claudeClawDb.exec(`
      CREATE TABLE agent_memory_usage (
        id INTEGER PRIMARY KEY,
        ts INTEGER NOT NULL,
        agent_id TEXT,
        task_id TEXT,
        project TEXT,
        source TEXT,
        tool TEXT,
        model TEXT,
        skill TEXT,
        duration_ms INTEGER,
        detail TEXT
      );
      CREATE TABLE knowledge_graph_events (
        id INTEGER PRIMARY KEY,
        ts INTEGER NOT NULL,
        kind TEXT,
        source TEXT,
        agent_id TEXT,
        task_id TEXT,
        project TEXT,
        detail TEXT,
        meta_json TEXT
      );
    `)
    claudeClawDb.prepare(`
      INSERT INTO agent_memory_usage (
        id, ts, agent_id, source, tool, model, skill, duration_ms, detail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      401,
      Math.floor(Date.parse('2026-06-09T14:59:50.000Z') / 1000),
      'zero',
      'agent',
      'mcp__filesystem__read_file',
      'claude-sonnet-4-6',
      'skill.registry.lookup',
      120,
      'agent0 interaction memory event',
    )
    claudeClawDb.prepare(`
      INSERT INTO knowledge_graph_events (
        id, ts, kind, source, agent_id, detail, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      501,
      Math.floor(Date.parse('2026-06-09T14:59:52.000Z') / 1000),
      'brain-alignment',
      'agent',
      'zero',
      'Brain Sync alignment completed',
      '{}',
    )
    claudeClawDb.prepare(`
      INSERT INTO knowledge_graph_events (
        id, ts, kind, source, agent_id, detail, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      502,
      Math.floor(Date.parse('2026-06-09T14:59:54.000Z') / 1000),
      'file-change',
      'obsidian',
      '',
      'Obsidian vault file changed',
      '{}',
    )
    claudeClawDb.close()

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
      claudeClawDbPath,
    })

    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.inputs.agent.zero')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'agent_request_events',
      telemetry_kind: 'claudeclaw_agent_memory_usage',
      identity_reason: 'claudeclaw_source_agent_memory_identity_resolved',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'model.claude_to_gateway')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'model_request_logs',
      telemetry_kind: 'claudeclaw_agent_memory_usage_model',
      requests_last_60s: 1,
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'connector.mcp_servers_to_gateway')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'connector_readiness_events',
      telemetry_kind: 'claudeclaw_agent_memory_usage_tool',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'connector.tools_registry_to_gateway')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'connector_readiness_events',
      telemetry_kind: 'claudeclaw_agent_memory_usage_tool',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.knowledge.brain.sync')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'knowledge_runtime_events',
      telemetry_kind: 'claudeclaw_knowledge_graph_event',
      identity_reason: 'claudeclaw_source_knowledge_identity_resolved',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.knowledge.brain.obsidian')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'knowledge_runtime_events',
      telemetry_kind: 'claudeclaw_knowledge_graph_event',
    })
    expect(snapshot.summary.active_traffic_edges).toBeGreaterThanOrEqual(6)

    rmSync(root, { recursive: true, force: true })
  })

  it('maps Gateway activity rows to specific agent, model, tool, MCP, and API edges', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-traffic-activities-'))
    const dbPath = join(root, 'mission-control.db')
    const db = new Database(dbPath)
    db.exec(`
      CREATE TABLE activities (
        id TEXT PRIMARY KEY,
        type TEXT,
        entity_type TEXT,
        entity_id TEXT,
        actor TEXT,
        description TEXT,
        data TEXT,
        created_at TEXT,
        workspace_id INTEGER
      );
    `)
    const insertActivity = db.prepare(`
      INSERT INTO activities (id, type, entity_type, entity_id, actor, description, data, created_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `)
    insertActivity.run('activity_agent_zero', 'agent_request', 'agent', 'agent.zero', 'jarvis', 'Agent Zero normal Gateway chat turn', '{"canonical_agent_id":"agent.zero"}', '2026-06-09T14:59:58.000Z')
    insertActivity.run('activity_pi', 'agent_request', 'agent', 'agent.pi', 'pi', 'Pi direct Gateway chat turn', '{"canonical_agent_id":"agent.pi"}', '2026-06-09T14:59:57.000Z')
    insertActivity.run('activity_mcp', 'connector_read', 'connector', 'int.mcp', 'gateway', 'MCP Servers discovery completed', '{"tool":"mcp.list"}', '2026-06-09T14:59:56.000Z')
    insertActivity.run('activity_tools', 'connector_read', 'connector', 'int.tools', 'gateway', 'Tools Registry skill lookup completed', '{"tool":"skills.list"}', '2026-06-09T14:59:55.000Z')
    insertActivity.run('activity_api', 'connector_read', 'connector', 'int.apis', 'gateway', 'External APIs registry read completed', '{"target":"external_apis"}', '2026-06-09T14:59:54.000Z')
    insertActivity.run('activity_claude', 'model_request', 'model', 'model.claude', 'agent.zero', 'Claude model request completed', '{"provider":"anthropic","model":"claude-opus-4-7"}', '2026-06-09T14:59:53.000Z')
    db.close()

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
    })

    for (const edgeId of [
      'highway.inputs.agent.zero',
      'highway.inputs.agent.pi',
      'connector.mcp_servers_to_gateway',
      'connector.tools_registry_to_gateway',
      'connector.external_apis_to_gateway',
      'model.claude_to_gateway',
    ]) {
      expect(snapshot.edges.find((edge) => edge.edge_id === edgeId), edgeId).toMatchObject({
        traffic_status: 'active',
        telemetry_source: 'gateway_event_bus',
      })
    }
    expect(snapshot.summary.active_traffic_edges).toBeGreaterThanOrEqual(6)
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

  it('classifies missing traffic mapping gaps and resolves confident aliases', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-traffic-gaps-'))
    const dbPath = join(root, 'mission-control.db')
    const db = new Database(dbPath)
    db.exec(`
      CREATE TABLE audit_log (
        id TEXT PRIMARY KEY,
        action TEXT,
        target_type TEXT,
        created_at TEXT
      );
    `)
    db.prepare(`INSERT INTO audit_log (id, action, target_type, created_at) VALUES (?, ?, ?, ?)`)
      .run('zapier_readiness_alias', 'zapier_readiness', 'zapier', '2026-06-09T14:59:45.000Z')
    db.prepare(`INSERT INTO audit_log (id, action, target_type, created_at) VALUES (?, ?, ?, ?)`)
      .run('legacy_webhooks_alias', 'webhooks-events', 'legacy_route', '2026-06-09T14:59:44.000Z')
    db.prepare(`INSERT INTO audit_log (id, action, target_type, created_at) VALUES (?, ?, ?, ?)`)
      .run('login_unmapped', 'login', 'auth', '2026-06-09T14:59:43.000Z')
    db.prepare(`INSERT INTO audit_log (id, action, target_type, created_at) VALUES (?, ?, ?, ?)`)
      .run('agent_config_unmapped', 'agent_config_sync', 'agent_config', '2026-06-09T14:59:42.000Z')
    db.close()

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
    })

    expect(snapshot.edges.find((edge) => edge.edge_id === 'connector.zapier_to_gateway')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'zapier_discovery_events',
      source_record_id: 'audit_log:zapier_readiness_alias',
      traffic_type: 'event',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'webhooks.inbound_to_gateway')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'workflow_trigger_events',
      source_record_id: 'audit_log:legacy_webhooks_alias',
    })
    expect(snapshot.summary.missing_traffic_mappings).toBe(2)
    expect(snapshot.missing_traffic_mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        telemetry_kind: 'login',
        source_system: 'auth',
        classification: 'auth_login_event_outside_gateway_topology',
        severity: 'info',
        recommended_mapping_fix: 'leave_unmapped_auth_events_outside_gateway_topology',
      }),
      expect.objectContaining({
        telemetry_kind: 'agent_config_sync',
        source_system: 'agent_config',
        classification: 'missing_node_alias',
        identity_confidence: 'low',
        identity_reason: 'agent_config_sync_identity_missing',
        candidate_node_id: null,
        candidate_edge_id: null,
        severity: 'warning',
      }),
    ]))

    rmSync(root, { recursive: true, force: true })
  })

  it('maps owner-visible knowledge and Telegram activity aliases to their exact Gateway branches', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-traffic-knowledge-aliases-'))
    const dbPath = join(root, 'mission-control.db')
    const db = new Database(dbPath)
    db.exec(`
      CREATE TABLE audit_log (
        id TEXT PRIMARY KEY,
        action TEXT,
        target_type TEXT,
        created_at TEXT
      );
    `)
    const insert = db.prepare(`INSERT INTO audit_log (id, action, target_type, created_at) VALUES (?, ?, ?, ?)`)
    insert.run('obsidian_read', 'obsidian_vault_readiness', 'obsidian', '2026-06-09T14:59:50.000Z')
    insert.run('mempalace_read', 'main_policy_memory_lookup', 'palacio', '2026-06-09T14:59:49.000Z')
    insert.run('graphify_read', 'graffiti_graph_preview', 'graphify', '2026-06-09T14:59:48.000Z')
    insert.run('gbrain_read', 'gbrain_inventory_refresh', 'gbrain', '2026-06-09T14:59:47.000Z')
    insert.run('brain_sync_read', 'brain_synchronization_status', 'brain_sync', '2026-06-09T14:59:46.000Z')
    insert.run('telegram_input', 'telegram_owner_request_received', 'telegram', '2026-06-09T14:59:45.000Z')
    db.close()

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
    })

    for (const edgeId of [
      'highway.knowledge.brain.obsidian',
      'highway.knowledge.brain.mempalace',
      'highway.knowledge.brain.graphify',
      'highway.knowledge.brain.gbrain',
      'highway.knowledge.brain.sync',
      'highway.inputs.input.telegram',
    ]) {
      expect(snapshot.edges.find((edge) => edge.edge_id === edgeId)).toMatchObject({
        traffic_status: 'active',
        events_last_60s: 1,
        traffic_type: 'event',
      })
    }
    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.knowledge.trunk')).toMatchObject({
      traffic_status: 'ready_no_recent_traffic',
      events_last_60s: 0,
      requests_last_60s: 0,
    })
    expect(snapshot.summary.missing_traffic_mappings).toBe(0)

    rmSync(root, { recursive: true, force: true })
  })

  it('maps source-provided agent_config_sync identity and leaves owner/display-name records unanimated', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-agent-config-identity-'))
    const dbPath = join(root, 'mission-control.db')
    const db = new Database(dbPath)
    db.exec(`
      CREATE TABLE audit_log (
        id TEXT PRIMARY KEY,
        action TEXT,
        actor TEXT,
        actor_id TEXT,
        target_type TEXT,
        target_id TEXT,
        detail TEXT,
        created_at TEXT
      );
    `)
    db.prepare(`INSERT INTO audit_log (id, action, actor, actor_id, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('agent_config_agent_zero', 'agent_config_sync', 'scheduled', null, 'gateway_node', null, JSON.stringify({
        event_type: 'agent_config_sync',
        source_system: 'agent_config',
        canonical_agent_id: 'agent.zero',
        canonical_node_id: 'agent.zero',
        canonical_edge_id: 'highway.inputs.agent.zero',
        route_group: 'inputs',
        confidence: 'source_provided',
        source_runtime: 'gateway_agent_sync',
        config_target: 'openclaw.agent:agent-zero',
        safe_event_summary: 'agent_config_sync:updated',
      }), '2026-06-09T14:59:50.000Z')
    db.prepare(`INSERT INTO audit_log (id, action, actor, actor_id, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('agent_config_tony', 'agent_config_sync', 'scheduled', null, null, null, '{"synced":13,"agents":["Tony"]}', '2026-06-09T14:59:49.000Z')
    db.prepare(`INSERT INTO audit_log (id, action, actor, actor_id, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('agent_config_owner_tony', 'agent_config_sync', 'scheduled', null, 'agent_config', null, JSON.stringify({
        event_type: 'agent_config_sync',
        source_system: 'agent_config',
        canonical_agent_id: 'owner.tony',
        canonical_node_id: 'input.owner',
        canonical_edge_id: null,
        route_group: 'inputs',
        confidence: 'source_provided',
        source_runtime: 'gateway_agent_sync',
        config_target: 'openclaw.agent:tony',
        safe_event_summary: 'agent_config_sync:updated',
        reason: 'owner_operator_identity_outside_gateway_agent_edges',
      }), '2026-06-09T14:59:48.000Z')
    db.prepare(`INSERT INTO audit_log (id, action, actor, actor_id, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('agent_config_gbrain', 'agent_config_sync', 'scheduled', null, 'agent', 'brain.gbrain', '{"agent_id":"brain.gbrain","provider":"gbrain"}', '2026-06-09T14:59:47.000Z')
    db.close()

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
    })

    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.inputs.agent.zero')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'agent_request_events',
      source_record_id: 'audit_log:agent_config_agent_zero',
      telemetry_kind: 'agent_config_sync',
      identity_reason: 'source_provided_canonical_identity',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.knowledge.brain.gbrain')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'knowledge_runtime_events',
      source_record_id: 'audit_log:agent_config_gbrain',
    })
    expect(snapshot.summary.missing_traffic_mappings).toBe(2)
    expect(snapshot.summary.agent_config_sync_resolved).toBe(2)
    expect(snapshot.summary.agent_config_sync_unresolved).toBe(2)
    expect(snapshot.summary.agent_config_sync_identity_missing).toBe(1)
    expect(snapshot.summary.source_provided_canonical_identity).toBe(2)
    expect(snapshot.summary.auth_login_outside_topology).toBe(0)
    expect(snapshot.summary.confidence.high).toBeGreaterThanOrEqual(2)
    expect(snapshot.summary.confidence.medium).toBe(1)
    expect(snapshot.summary.confidence.low).toBe(1)
    expect(snapshot.missing_traffic_mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        telemetry_kind: 'agent_config_sync',
        source_system: 'agent_config',
        identity_confidence: 'low',
        identity_reason: 'agent_config_sync_identity_missing',
        candidate_node_id: null,
        candidate_edge_id: null,
        classification: 'missing_node_alias',
        recommended_mapping_fix: 'add_explicit_agent_identity_to_agent_config_sync_detail',
      }),
      expect.objectContaining({
        telemetry_kind: 'agent_config_sync',
        source_system: 'agent_config',
        identity_confidence: 'medium',
        identity_reason: 'owner_operator_identity_outside_gateway_agent_edges',
        source_provided_identity: true,
        candidate_node_id: 'input.owner',
        candidate_edge_id: null,
      }),
    ]))

    rmSync(root, { recursive: true, force: true })
  })

  it('maps recent Gateway sessions to canonical agent and model traffic', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-session-traffic-'))
    const dbPath = join(root, 'mission-control.db')
    const db = new Database(dbPath)
    db.close()

    gatewaySessionStoreMock.getAllGatewaySessions.mockReturnValue([{
      key: 'agent:jarvis:telegram',
      agent: 'jarvis',
      sessionId: 'session-jarvis',
      updatedAt: Date.parse('2026-06-09T14:59:50.000Z'),
      chatType: 'telegram',
      channel: 'telegram',
      model: 'gpt-5.4',
      totalTokens: 168,
      inputTokens: 123,
      outputTokens: 45,
      contextTokens: 0,
      active: true,
    }])

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
    })

    expect(gatewaySessionStoreMock.getAllGatewaySessions).toHaveBeenCalledWith(Infinity, true)
    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.inputs.agent.zero')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'agent_request_events',
      telemetry_kind: 'gateway_session_agent_activity',
      identity_reason: 'gateway_session_agent_identity_resolved',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'model.openai_codex_to_gateway')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'model_request_logs',
      telemetry_kind: 'gateway_session_model_activity',
      requests_last_60s: 1,
      bytes_in_last_60s: 123,
      bytes_out_last_60s: 45,
    })

    rmSync(root, { recursive: true, force: true })
  })

  it('reads fresh ClaudeClaw/Jarvis trace traffic without guessing classifier rows onto agents', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-claudeclaw-traffic-'))
    const dbPath = join(root, 'mission-control.db')
    const claudeClawDbPath = join(root, 'claudeclaw.db')
    const db = new Database(dbPath)
    db.close()
    const claudeClawDb = new Database(claudeClawDbPath)
    claudeClawDb.exec(`
      CREATE TABLE agent_trace (
        id INTEGER PRIMARY KEY,
        ts INTEGER,
        agent TEXT NOT NULL,
        channel TEXT,
        runtime TEXT NOT NULL,
        requested_route TEXT,
        actual_model TEXT,
        provider_path TEXT,
        tools_executed TEXT,
        skills_used TEXT,
        start_ts INTEGER NOT NULL,
        end_ts INTEGER,
        ok INTEGER,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        cost_usd REAL
      );
      CREATE TABLE openrouter_requests (
        id INTEGER PRIMARY KEY,
        ts INTEGER NOT NULL,
        agent TEXT NOT NULL,
        task_type TEXT NOT NULL,
        requested_route TEXT NOT NULL,
        actual_model TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        cost_usd REAL,
        ok INTEGER NOT NULL
      );
    `)
    claudeClawDb.prepare(`
      INSERT INTO agent_trace (
        id, ts, agent, channel, runtime, requested_route, actual_model, provider_path,
        tools_executed, skills_used, start_ts, end_ts, ok, prompt_tokens, completion_tokens, cost_usd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      101,
      Math.floor(Date.parse('2026-06-09T14:59:47.000Z') / 1000),
      'agent-zero',
      'telegram',
      'claude_cli_direct',
      '/api/bridge/agent-zero/test-chat',
      'sonnet',
      'mission_control_agent_zero',
      JSON.stringify([
        'ToolSearch',
        'mcp__filesystem__read_file',
        'zapier: google_drive_upload_file',
        'firecrawl: scrape',
        'heygen_create_an_avatar_video_scene',
      ]),
      JSON.stringify(['skill.registry.lookup']),
      Date.parse('2026-06-09T14:59:45.000Z'),
      Date.parse('2026-06-09T14:59:50.000Z'),
      1,
      222,
      44,
      0.0123,
    )
    claudeClawDb.prepare(`
      INSERT INTO openrouter_requests (
        id, ts, agent, task_type, requested_route, actual_model, prompt_tokens, completion_tokens, cost_usd, ok
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      202,
      Math.floor(Date.parse('2026-06-09T14:59:52.000Z') / 1000),
      'classifier',
      'cheap',
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      567,
      290,
      0,
      1,
    )
    claudeClawDb.close()

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
      claudeClawDbPath,
    })

    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.inputs.agent.zero')).toMatchObject({
      traffic_status: 'active',
      telemetry_source: 'agent_request_events',
      source_record_id: 'claudeclaw.agent_trace:101',
      telemetry_kind: 'claudeclaw_agent_trace',
      identity_reason: 'claudeclaw_source_agent_identity_resolved',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'model.claude_to_gateway')).toMatchObject({
      traffic_status: 'active',
      requests_last_60s: 1,
      bytes_in_last_60s: 222,
      bytes_out_last_60s: 44,
      source_record_id: 'claudeclaw.agent_trace:101',
      telemetry_kind: 'claudeclaw_agent_trace_model',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'model.openrouter_to_gateway')).toMatchObject({
      traffic_status: 'active',
      requests_last_60s: 1,
      bytes_in_last_60s: 567,
      bytes_out_last_60s: 290,
      source_record_id: 'claudeclaw.openrouter_requests:202',
      telemetry_kind: 'claudeclaw_openrouter_request',
    })
    for (const [edgeId, telemetrySource] of [
      ['connector.tools_registry_to_gateway', 'connector_readiness_events'],
      ['connector.mcp_servers_to_gateway', 'connector_readiness_events'],
      ['connector.zapier_to_gateway', 'zapier_discovery_events'],
      ['connector.google_drive_to_gateway', 'storage_sync_events'],
      ['connector.firecrawl_to_gateway', 'connector_readiness_events'],
      ['connector.heygen_to_gateway', 'connector_readiness_events'],
    ] as const) {
      expect(snapshot.edges.find((edge) => edge.edge_id === edgeId), edgeId).toMatchObject({
        traffic_status: 'active',
        telemetry_source: telemetrySource,
        events_last_60s: 1,
        telemetry_kind: 'claudeclaw_agent_trace_tool',
        identity_reason: 'claudeclaw_source_tool_identity_resolved',
      })
    }
    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.inputs.agent.paperclip')).not.toMatchObject({
      traffic_status: 'active',
    })
    expect(snapshot.summary.active_traffic_edges).toBeGreaterThanOrEqual(9)
    expect(JSON.stringify(snapshot)).not.toMatch(
      /Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i,
    )

    rmSync(root, { recursive: true, force: true })
  })

  it('keeps old ClaudeClaw activity stale instead of creating a live pulse', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-claudeclaw-stale-'))
    const dbPath = join(root, 'mission-control.db')
    const claudeClawDbPath = join(root, 'claudeclaw.db')
    const db = new Database(dbPath)
    db.close()
    const claudeClawDb = new Database(claudeClawDbPath)
    claudeClawDb.exec(`
      CREATE TABLE agent_trace (
        id INTEGER PRIMARY KEY,
        ts INTEGER,
        agent TEXT NOT NULL,
        channel TEXT,
        runtime TEXT NOT NULL,
        requested_route TEXT,
        actual_model TEXT,
        provider_path TEXT,
        start_ts INTEGER NOT NULL,
        end_ts INTEGER,
        ok INTEGER,
        prompt_tokens INTEGER,
        completion_tokens INTEGER
      );
    `)
    claudeClawDb.prepare(`
      INSERT INTO agent_trace (
        id, ts, agent, channel, runtime, requested_route, actual_model, provider_path,
        start_ts, end_ts, ok, prompt_tokens, completion_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      301,
      Math.floor(Date.parse('2026-06-09T14:50:00.000Z') / 1000),
      'agent-zero',
      'telegram',
      'claude_cli_direct',
      '/api/bridge/agent-zero/test-chat',
      'sonnet',
      'mission_control_agent_zero',
      Date.parse('2026-06-09T14:49:50.000Z'),
      Date.parse('2026-06-09T14:50:00.000Z'),
      1,
      100,
      20,
    )
    claudeClawDb.close()

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
      claudeClawDbPath,
    })

    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.inputs.agent.zero')).toMatchObject({
      traffic_status: 'stale',
      events_last_60s: 0,
      source_record_id: 'claudeclaw.agent_trace:301',
      telemetry_kind: 'claudeclaw_agent_trace',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'model.claude_to_gateway')).toMatchObject({
      traffic_status: 'stale',
      requests_last_60s: 0,
      bytes_in_last_60s: 0,
      bytes_out_last_60s: 0,
      source_record_id: 'claudeclaw.agent_trace:301',
      telemetry_kind: 'claudeclaw_agent_trace_model',
    })
    expect(snapshot.summary.active_traffic_edges).toBe(0)
    expect(snapshot.summary.stale_telemetry_edges).toBeGreaterThanOrEqual(2)

    rmSync(root, { recursive: true, force: true })
  })

  it('does not guess owner Tony sessions onto Agent Zero or GBrain', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-session-tony-'))
    const dbPath = join(root, 'mission-control.db')
    const db = new Database(dbPath)
    db.close()

    gatewaySessionStoreMock.getAllGatewaySessions.mockReturnValue([{
      key: 'agent:tony:main',
      agent: 'tony',
      sessionId: 'session-tony',
      updatedAt: Date.parse('2026-06-09T14:59:50.000Z'),
      chatType: 'main',
      channel: 'telegram',
      model: '',
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      contextTokens: 0,
      active: true,
    }])

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
    })

    expect(snapshot.summary.active_traffic_edges).toBe(0)
    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.inputs.agent.zero')).not.toMatchObject({ traffic_status: 'active' })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'highway.knowledge.brain.gbrain')).not.toMatchObject({ traffic_status: 'active' })

    rmSync(root, { recursive: true, force: true })
  })

  it('classifies broad protected-action-check writes as target ambiguous without creating a pulse', () => {
    const root = mkdtempSync(join(tmpdir(), 'gateway-protected-action-ambiguous-'))
    const dbPath = join(root, 'mission-control.db')
    const db = new Database(dbPath)
    db.exec(`
      CREATE TABLE audit_log (
        id TEXT PRIMARY KEY,
        action TEXT,
        target_type TEXT,
        target_id TEXT,
        detail TEXT,
        created_at TEXT
      );
    `)
    db.prepare(`INSERT INTO audit_log (id, action, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('protected_write', 'write', 'protected-action-check', 'protected-action-check', '{"tool":"protected-action-check","scope":"probe"}', '2026-06-09T14:59:50.000Z')
    db.close()

    const snapshot = buildGatewayGraphTrafficFromReadOnlyDatabase({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology: buildGatewayGraphTopology('2026-06-09T15:00:00.000Z'),
      dbPath,
    })

    expect(snapshot.summary.active_traffic_edges).toBe(0)
    expect(snapshot.summary.protected_action_check_unresolved).toBe(1)
    expect(snapshot.summary.unmapped_event_type_count).toBe(0)
    expect(snapshot.missing_traffic_mappings).toEqual([
      expect.objectContaining({
        source_event_type: 'write',
        source_system: 'protected-action-check',
        classification: 'protected_action_check_target_ambiguous',
        candidate_node_id: null,
        candidate_edge_id: null,
        recommended_mapping_fix: 'add_exact_protected_action_target_edge_or_keep_in_approval_center',
      }),
    ])

    rmSync(root, { recursive: true, force: true })
  })

  it('explains stale telemetry with threshold and next action', () => {
    const topology = buildGatewayGraphTopology('2026-06-09T15:00:00.000Z')
    const snapshot = buildGatewayGraphTrafficSnapshot({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology,
      trustedSources: [{ source_id: 'agentmail_events', status: 'readable', inspected_at: '2026-06-09T15:00:00.000Z' }],
      edgeActivity: [{
        edge_id: 'agentmail.gateway_to_agentmail',
        events: 1,
        occurred_at: '2026-06-09T14:50:00.000Z',
        source_id: 'agentmail_events',
        record_id: 'agentmail_audit:receive_check',
        telemetry_kind: 'agentmail_receive_verification_passed',
      }],
    })

    expect(snapshot.edges.find((edge) => edge.edge_id === 'agentmail.gateway_to_agentmail')).toMatchObject({
      traffic_status: 'stale',
      traffic_classification: 'telemetry_stale',
      traffic_label: 'Ready · telemetry stale',
      stale_threshold_seconds: 300,
      recommended_next_action: 'verify_agentmail_event_listener_or_recent_readiness_probe',
      source_record_id: 'agentmail_audit:receive_check',
      traffic_type: 'event',
    })
  })

  it('classifies unavailable telemetry edges without marking them broken', () => {
    const topology = buildGatewayGraphTopology('2026-06-09T15:00:00.000Z')
    const snapshot = buildGatewayGraphTrafficSnapshot({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology,
    })

    expect(snapshot.edges.find((edge) => edge.edge_id === 'events.event_bus_to_gateway')).toMatchObject({
      traffic_status: 'unavailable',
      traffic_classification: 'system_is_standby_by_design',
      traffic_label: 'Standby · no heartbeat',
      recommended_next_action: 'wait_for_signed_event_or_verify_event_stream_heartbeat',
    })
    expect(snapshot.edges.find((edge) => edge.edge_id === 'reports.gateway_to_reports')).toMatchObject({
      traffic_status: 'unavailable',
      traffic_classification: 'read_only_without_traffic_counters',
      traffic_label: 'Traffic source unavailable',
    })
  })

  it('exposes safe active-edge drilldown metadata without raw payloads', () => {
    const topology = buildGatewayGraphTopology('2026-06-09T15:00:00.000Z')
    const snapshot = buildGatewayGraphTrafficSnapshot({
      generatedAt: '2026-06-09T15:00:00.000Z',
      topology,
      trustedSources: [{ source_id: 'model_request_logs', status: 'readable', inspected_at: '2026-06-09T15:00:00.000Z' }],
      edgeActivity: [{
        edge_id: 'model.openrouter_to_gateway',
        requests: 1,
        occurred_at: '2026-06-09T14:59:45.000Z',
        source_id: 'model_request_logs',
        record_id: 'runs:run_recent_openrouter',
        telemetry_kind: 'model_run',
      }],
    })

    const active = snapshot.edges.find((edge) => edge.edge_id === 'model.openrouter_to_gateway')
    expect(active).toMatchObject({
      traffic_status: 'active',
      traffic_classification: 'active_recent_traffic',
      traffic_label: 'Live traffic',
      source_record_id: 'runs:run_recent_openrouter',
      traffic_type: 'request',
      recommended_next_action: 'inspect_gateway_diagnostics_for_request_details',
    })
    expect(JSON.stringify(active)).not.toMatch(/Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i)
  })
})
