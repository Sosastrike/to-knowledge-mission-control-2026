import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let testDb: Database.Database

vi.mock('@/lib/db', () => ({
  getDatabase: () => testDb,
}))

vi.mock('@/lib/event-bus', () => ({
  eventBus: { broadcast: vi.fn() },
}))

describe('Agent Run Gateway telemetry producer', () => {
  beforeEach(() => {
    testDb = new Database(':memory:')
    testDb.exec(`
      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_name TEXT,
        model TEXT,
        provider TEXT,
        runtime TEXT,
        runtime_version TEXT,
        trigger_type TEXT,
        parent_run_id TEXT,
        task_id TEXT,
        status TEXT NOT NULL,
        outcome TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_ms INTEGER,
        steps TEXT,
        tools_available TEXT,
        cost_input_tokens INTEGER DEFAULT 0,
        cost_output_tokens INTEGER DEFAULT 0,
        cost_cache_read_tokens INTEGER,
        cost_cache_write_tokens INTEGER,
        cost_usd REAL,
        cost_model TEXT,
        run_hash TEXT,
        parent_run_hash TEXT,
        lineage TEXT,
        model_version TEXT,
        config_hash TEXT,
        provenance_runtime TEXT,
        signed_by TEXT,
        signature TEXT,
        provenance_created_at TEXT,
        eval_task_type TEXT,
        eval_layer TEXT,
        eval_pass INTEGER,
        eval_score REAL,
        eval_detail TEXT,
        eval_metrics TEXT,
        eval_benchmark_id TEXT,
        error TEXT,
        git_branch TEXT,
        git_commit TEXT,
        workspace_id INTEGER DEFAULT 1,
        tags TEXT,
        metadata TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

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
        entity_type TEXT,
        entity_id INTEGER,
        actor TEXT,
        description TEXT,
        data TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        workspace_id INTEGER NOT NULL DEFAULT 1
      );
    `)
  })

  afterEach(() => {
    testDb.close()
    vi.resetModules()
  })

  it('records real run token cost and tool steps as canonical Gateway telemetry without payload content', async () => {
    const { createRun } = await import('@/lib/runs')

    createRun({
      id: 'run_pi_1',
      agent_id: 'agent.pi',
      agent_name: 'Pi',
      provider: 'openai',
      model: 'gpt-4o',
      status: 'completed',
      outcome: 'success',
      trigger: 'agent',
      started_at: '2026-06-15T17:00:00.000Z',
      ended_at: '2026-06-15T17:00:02.000Z',
      task_id: '42',
      steps: [
        {
          id: 'step_tool_1',
          type: 'tool_call',
          tool_name: 'mcp.search',
          mcp_server: 'mcp-tools',
          input_preview: 'raw prompt text must not be copied',
          output_preview: 'raw result text must not be copied',
          success: true,
          started_at: '2026-06-15T17:00:01.000Z',
        },
      ],
      tools_available: ['mcp.search'],
      cost: {
        input_tokens: 111,
        output_tokens: 22,
        cost_usd: 0.0042,
        model: 'gpt-4o',
      },
      provenance: { run_hash: 'hash' },
    }, 1)

    expect(testDb.prepare('SELECT model, session_id, input_tokens, output_tokens, cost_usd, agent_name FROM token_usage').all()).toEqual([
      {
        model: 'openai/gpt-4o',
        session_id: 'run:run_pi_1',
        input_tokens: 111,
        output_tokens: 22,
        cost_usd: 0.0042,
        agent_name: 'agent.pi',
      },
    ])

    const activities = testDb.prepare('SELECT type, actor, data FROM activities ORDER BY id').all() as Array<{ type: string; actor: string; data: string }>
    expect(activities.map((row) => row.type)).toEqual([
      'gateway_model_usage',
      'gateway_agent_activity',
      'gateway_tool_activity',
      'gateway_agent_activity',
    ])

    const activityData = activities.map((row) => JSON.parse(row.data))
    expect(activityData).toEqual(expect.arrayContaining([
      expect.objectContaining({
        canonical_agent_id: 'agent.pi',
        canonical_edge_id: 'model.openai_codex_to_gateway',
        input_tokens: 111,
        output_tokens: 22,
        cost_usd: 0.0042,
        request_count: 1,
        status: 'completed',
      }),
      expect.objectContaining({
        canonical_agent_id: 'agent.pi',
        canonical_edge_id: 'connector.mcp_servers_to_gateway',
        tool_id: 'mcp.search',
        action_type: 'tool_call',
        request_count: 1,
        status: 'success',
      }),
    ]))
    expect(JSON.stringify(activityData)).not.toContain('raw prompt text')
    expect(JSON.stringify(activityData)).not.toContain('raw result text')
  })

  it('records final PATCH token/tool telemetry once when a run reports cost after creation', async () => {
    const { createRun, updateRun } = await import('@/lib/runs')

    createRun({
      id: 'run_space_pending',
      agent_id: 'agent.space',
      agent_name: 'Space Agent',
      provider: 'openai',
      model: 'gpt-4o-mini',
      status: 'running',
      trigger: 'agent',
      started_at: '2026-06-15T17:10:00.000Z',
      steps: [],
      tools_available: ['skills.lookup'],
      cost: {
        input_tokens: 0,
        output_tokens: 0,
      },
      provenance: { run_hash: 'hash-space' },
    }, 1)

    updateRun('run_space_pending', {
      status: 'completed',
      outcome: 'success',
      ended_at: '2026-06-15T17:10:05.000Z',
      cost: {
        input_tokens: 77,
        output_tokens: 33,
        cost_usd: 0.0025,
        model: 'gpt-4o-mini',
      },
      steps: [
        {
          id: 'step_tool_space_1',
          type: 'tool_call',
          tool_name: 'skills.lookup',
          mcp_server: 'tools-registry',
          input_preview: 'private input must not be copied',
          output_preview: 'private output must not be copied',
          success: true,
          started_at: '2026-06-15T17:10:02.000Z',
        },
      ],
    }, 1)

    updateRun('run_space_pending', {
      status: 'completed',
      outcome: 'success',
      ended_at: '2026-06-15T17:10:05.000Z',
      cost: {
        input_tokens: 77,
        output_tokens: 33,
        cost_usd: 0.0025,
        model: 'gpt-4o-mini',
      },
      steps: [
        {
          id: 'step_tool_space_1',
          type: 'tool_call',
          tool_name: 'skills.lookup',
          mcp_server: 'tools-registry',
          input_preview: 'private input must not be copied',
          output_preview: 'private output must not be copied',
          success: true,
          started_at: '2026-06-15T17:10:02.000Z',
        },
      ],
    }, 1)

    expect(testDb.prepare('SELECT model, session_id, input_tokens, output_tokens, cost_usd, agent_name FROM token_usage').all()).toEqual([
      {
        model: 'openai/gpt-4o-mini',
        session_id: 'run:run_space_pending',
        input_tokens: 77,
        output_tokens: 33,
        cost_usd: 0.0025,
        agent_name: 'agent.space',
      },
    ])

    const activities = testDb.prepare('SELECT type, actor, data FROM activities ORDER BY id').all() as Array<{ type: string; actor: string; data: string }>
    const activityData = activities.map((row) => JSON.parse(row.data))
    expect(activities.filter((row) => row.type === 'gateway_model_usage')).toHaveLength(1)
    expect(activities.filter((row) => row.type === 'gateway_tool_activity')).toHaveLength(1)
    expect(activityData).toEqual(expect.arrayContaining([
      expect.objectContaining({
        canonical_agent_id: 'agent.space',
        canonical_edge_id: 'model.openai_codex_to_gateway',
        input_tokens: 77,
        output_tokens: 33,
        cost_usd: 0.0025,
        status: 'completed',
        run_id: 'run_space_pending',
      }),
      expect.objectContaining({
        canonical_agent_id: 'agent.space',
        canonical_edge_id: 'connector.tools_registry_to_gateway',
        tool_id: 'skills.lookup',
        action_type: 'tool_call',
        request_count: 1,
        status: 'success',
        run_id: 'run_space_pending',
        step_id: 'step_tool_space_1',
      }),
    ]))
    expect(JSON.stringify(activityData)).not.toContain('private input')
    expect(JSON.stringify(activityData)).not.toContain('private output')
  })
})
