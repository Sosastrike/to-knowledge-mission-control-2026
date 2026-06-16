import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  buildExpenseDetailView,
  buildReadOnlyTokenLedgerRollup,
  loadClaudeClawTokenUsageRecords,
} from '@/lib/token-ledger-rollup'

function createClaudeClawDb() {
  const root = mkdtempSync(join(tmpdir(), 'claudeclaw-ledger-rollup-'))
  const dbPath = join(root, 'claudeclaw.db')
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE token_usage (
      id INTEGER PRIMARY KEY,
      chat_id TEXT NOT NULL,
      session_id TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read INTEGER NOT NULL DEFAULT 0,
      context_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      did_compact INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      agent_id TEXT NOT NULL DEFAULT 'main'
    );
  `)
  db.prepare(`
    INSERT INTO token_usage (
      id, chat_id, session_id, input_tokens, output_tokens, cost_usd, created_at, agent_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(1, '8644990569', 'session-a', 100, 25, 0.0125, 1776733223, 'main')
  db.prepare(`
    INSERT INTO token_usage (
      id, chat_id, session_id, input_tokens, output_tokens, cost_usd, created_at, agent_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(2, '8644990569', 'session-b', 300, 75, 0.0375, 1776733323, 'main')
  db.close()
  return { root, dbPath }
}

function createClaudeClawDbWithProviderModelColumns() {
  const root = mkdtempSync(join(tmpdir(), 'claudeclaw-ledger-rollup-provider-model-'))
  const dbPath = join(root, 'claudeclaw.db')
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE token_usage (
      id INTEGER PRIMARY KEY,
      chat_id TEXT NOT NULL,
      session_id TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read INTEGER NOT NULL DEFAULT 0,
      context_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      did_compact INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      agent_id TEXT NOT NULL DEFAULT 'main',
      provider TEXT,
      model TEXT
    );
  `)
  db.prepare(`
    INSERT INTO token_usage (
      id, chat_id, session_id, input_tokens, output_tokens, cost_usd, created_at, agent_id, provider, model
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(1, '8644990569', 'session-a', 100, 25, 0.0125, 1776733223, 'main', 'openrouter', 'anthropic/claude-sonnet-4.6')
  db.prepare(`
    INSERT INTO token_usage (
      id, chat_id, session_id, input_tokens, output_tokens, cost_usd, created_at, agent_id, provider, model
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(2, '8644990569', 'session-b', 300, 75, 0.0375, 1776733323, 'main', null, null)
  db.close()
  return { root, dbPath }
}

describe('read-only ClaudeClaw token ledger rollup', () => {
  it('loads ClaudeClaw rows without guessing provider/model fields', () => {
    const { root, dbPath } = createClaudeClawDb()

    try {
      const records = loadClaudeClawTokenUsageRecords({ dbPath, workspaceId: 1 })
      const firstSourceRow = records.find((record) => record.id === 'claudeclaw:1')

      expect(records).toHaveLength(2)
      expect(firstSourceRow).toMatchObject({
        id: 'claudeclaw:1',
        source: 'claudeclaw',
        sourceRunId: 'claudeclaw:1',
        provider: 'unknown',
        model: 'unknown',
        sessionId: 'claudeclaw:session-a',
        agentName: 'claudeclaw/main',
        inputTokens: 100,
        outputTokens: 25,
        cost: 0.0125,
        operation: 'claudeclaw_jarvis_read_only_rollup',
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('uses source-provided future ClaudeClaw provider/model fields without backfilling unknown rows', () => {
    const { root, dbPath } = createClaudeClawDbWithProviderModelColumns()

    try {
      const records = loadClaudeClawTokenUsageRecords({ dbPath, workspaceId: 1 })
      const attributedRow = records.find((record) => record.id === 'claudeclaw:1')
      const unattributedRow = records.find((record) => record.id === 'claudeclaw:2')
      const detail = buildExpenseDetailView({
        missionControlRecords: [],
        claudeClawRecords: records,
      })

      expect(attributedRow).toMatchObject({
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.6',
      })
      expect(unattributedRow).toMatchObject({
        provider: 'unknown',
        model: 'unknown',
      })
      expect(detail.claudeclaw.models.map((model) => ({
        label: model.label,
        rows: model.rows,
        unknown_provider: model.unknown_provider,
        unknown_model: model.unknown_model,
      }))).toEqual([
        {
          label: 'ClaudeClaw/Jarvis legacy unattributed',
          rows: 1,
          unknown_provider: true,
          unknown_model: true,
        },
        {
          label: 'openrouter/anthropic/claude-sonnet-4.6',
          rows: 1,
          unknown_provider: false,
          unknown_model: false,
        },
      ])
      expect(detail.unknown_provider_model_rows).toBe(1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('builds source-labeled combined spend without mutating Mission Control rows', () => {
    const { root, dbPath } = createClaudeClawDb()

    try {
      const claudeClawRecords = loadClaudeClawTokenUsageRecords({ dbPath, workspaceId: 1 })
      const rollup = buildReadOnlyTokenLedgerRollup({
        missionControlRecords: [],
        claudeClawRecords,
      })

      expect(rollup).toEqual({
        mission_control: {
          rows: 0,
          input_tokens: 0,
          output_tokens: 0,
          cost_usd: 0,
        },
        claudeclaw: {
          rows: 2,
          input_tokens: 400,
          output_tokens: 100,
          cost_usd: 0.05,
        },
        combined: {
          rows: 2,
          input_tokens: 400,
          output_tokens: 100,
          cost_usd: 0.05,
        },
        source_mode: 'read_only_rollup',
        double_count_guard: true,
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not double count a ClaudeClaw row that already has a source-prefixed Mission Control record', () => {
    const { root, dbPath } = createClaudeClawDb()

    try {
      const claudeClawRecords = loadClaudeClawTokenUsageRecords({ dbPath, workspaceId: 1 })
      const rollup = buildReadOnlyTokenLedgerRollup({
        missionControlRecords: [
          {
            id: 'mc-imported-claudeclaw-1',
            source: 'mission_control',
            sourceRunId: 'claudeclaw:1',
            model: 'unknown',
            sessionId: 'claudeclaw:session-a',
            agentName: 'claudeclaw/main',
            timestamp: 1776733223000,
            inputTokens: 100,
            outputTokens: 25,
            totalTokens: 125,
            cost: 0.0125,
            operation: 'imported_test_record',
            workspaceId: 1,
          },
        ],
        claudeClawRecords,
      })

      expect(rollup.mission_control).toEqual({
        rows: 1,
        input_tokens: 100,
        output_tokens: 25,
        cost_usd: 0.0125,
      })
      expect(rollup.claudeclaw).toEqual({
        rows: 2,
        input_tokens: 400,
        output_tokens: 100,
        cost_usd: 0.05,
      })
      expect(rollup.combined).toEqual({
        rows: 2,
        input_tokens: 400,
        output_tokens: 100,
        cost_usd: 0.05,
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('builds a source-labeled expense detail view with unknown ClaudeClaw provider/model marked explicitly', () => {
    const { root, dbPath } = createClaudeClawDb()

    try {
      const claudeClawRecords = loadClaudeClawTokenUsageRecords({ dbPath, workspaceId: 1 })
      const detail = buildExpenseDetailView({
        missionControlRecords: [
          {
            id: 'mc-1',
            source: 'mission_control',
            sourceRunId: 'mission-control:1',
            provider: 'openai',
            model: 'gpt-4o',
            sessionId: 'agent.zero:telegram',
            agentName: 'agent.zero',
            timestamp: 1781557200000,
            inputTokens: 20,
            outputTokens: 10,
            totalTokens: 30,
            cost: 0.001,
            operation: 'model_usage',
            workspaceId: 1,
          },
        ],
        claudeClawRecords,
      })

      expect(detail.source_mode).toBe('read_only_rollup')
      expect(detail.double_count_guard).toBe(true)
      expect(detail.mission_control.label).toBe('Mission Control ledger')
      expect(detail.claudeclaw.label).toBe('ClaudeClaw/Jarvis ledger')
      expect(detail.combined.label).toBe('Combined observed spend')
      expect(detail.mission_control.summary).toEqual({
        rows: 1,
        input_tokens: 20,
        output_tokens: 10,
        cost_usd: 0.001,
      })
      expect(detail.claudeclaw.summary).toEqual({
        rows: 2,
        input_tokens: 400,
        output_tokens: 100,
        cost_usd: 0.05,
      })
      expect(detail.combined.summary).toEqual({
        rows: 3,
        input_tokens: 420,
        output_tokens: 110,
        cost_usd: 0.051,
      })
      expect(detail.claudeclaw.models).toEqual([
        {
          provider: 'unknown',
          model: 'unknown',
          label: 'ClaudeClaw/Jarvis legacy unattributed',
          rows: 2,
          input_tokens: 400,
          output_tokens: 100,
          cost_usd: 0.05,
          unknown_provider: true,
          unknown_model: true,
        },
      ])
      expect(detail.combined.agents.map((agent) => agent.agentName)).toEqual([
        'claudeclaw/main',
        'agent.zero',
      ])
      expect(detail.unknown_provider_model_rows).toBe(2)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
