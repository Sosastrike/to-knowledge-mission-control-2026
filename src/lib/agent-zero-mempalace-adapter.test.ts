import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  getAgentZeroMemPalaceStatus,
  linkAgentZeroMemoryToReportTask,
  queryAgentZeroMemPalaceSummary,
  rememberAgentZeroOwnerPreference,
  rememberAgentZeroTaskResult,
  updateAgentZeroSafeMemorySummary,
} from './agent-zero-mempalace-adapter'

function makeMemPalaceFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'az-mempalace-'))
  const home = path.join(root, '.mempalace')
  const data = path.join(root, 'mempalace-data')
  mkdirSync(home, { recursive: true })
  mkdirSync(data, { recursive: true })
  const configPath = path.join(home, 'config.json')
  const graphDbPath = path.join(home, 'knowledge_graph.sqlite3')
  const chromaDbPath = path.join(data, 'chroma.sqlite3')
  const summaryDbPath = path.join(data, 'agent-zero-memory-summaries.sqlite3')
  writeFileSync(configPath, '{"enabled":true}')

  const graph = new Database(graphDbPath)
  graph.exec(`
    CREATE TABLE entities (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT DEFAULT 'unknown', properties TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE triples (id TEXT PRIMARY KEY, subject TEXT NOT NULL, predicate TEXT NOT NULL, object TEXT NOT NULL, valid_from TEXT, valid_to TEXT, confidence REAL DEFAULT 1.0, source_closet TEXT, source_file TEXT, extracted_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `)
  graph.prepare('INSERT INTO entities (id, name, type, properties) VALUES (?, ?, ?, ?)').run('e1', 'Bridge Memory Project should-not-leak', 'project', '{"token":"secret-value"}')
  graph.prepare('INSERT INTO entities (id, name, type, properties) VALUES (?, ?, ?, ?)').run('e2', 'Quiet Operations', 'process', '{}')
  graph.prepare('INSERT INTO triples (id, subject, predicate, object, source_file) VALUES (?, ?, ?, ?, ?)').run('t1', 'Bridge Memory Project should-not-leak', 'mentions', 'Agent Zero /home/tony/private.md', '/home/tony/private/source.md')
  graph.close()

  const chroma = new Database(chromaDbPath)
  chroma.exec(`
    CREATE TABLE collections (id TEXT PRIMARY KEY, name TEXT NOT NULL, dimension INTEGER, database_id TEXT NOT NULL, config_json_str TEXT, schema_str TEXT);
    CREATE TABLE embeddings (id INTEGER PRIMARY KEY, segment_id TEXT NOT NULL, embedding_id TEXT NOT NULL, seq_id BLOB NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE VIRTUAL TABLE embedding_fulltext_search USING fts5(string_value);
  `)
  chroma.prepare('INSERT INTO collections (id, name, dimension, database_id) VALUES (?, ?, ?, ?)').run('c1', 'private_collection_name', 1536, 'db1')
  chroma.prepare('INSERT INTO embeddings (segment_id, embedding_id, seq_id) VALUES (?, ?, ?)').run('s1', 'emb1', Buffer.from('1'))
  chroma.prepare('INSERT INTO embedding_fulltext_search (string_value) VALUES (?)').run('Bridge memory summary contains should-not-leak and /home/tony/private.md')
  chroma.close()

  return { root, graphDbPath, chromaDbPath, summaryDbPath, dataDir: data, configPath }
}

describe('Agent Zero MemPalace read-only adapter', () => {
  it('reports MemPalace status without exposing paths, writes, or raw dumps', () => {
    const fixture = makeMemPalaceFixture()
    const status = getAgentZeroMemPalaceStatus(fixture)
    const serialized = JSON.stringify(status)

    expect(status.ok).toBe(true)
    expect(status.status).toBe('connected')
    expect(status.graph_db_status).toBe('present')
    expect(status.vector_db_status).toBe('present')
    expect(status.counts.entities).toBe(2)
    expect(status.counts.triples).toBe(1)
    expect(status.counts.collections).toBe(1)
    expect(status.counts.embeddings).toBe(1)
    expect(status.available_actions).toEqual([
      'status',
      'query',
      'summary',
      'remember_task_result',
      'remember_owner_preference',
      'update_safe_memory_summary',
      'link_memory_to_report_task',
    ])
    expect(status.counts.safe_memory_summaries).toBe(0)
    expect(status.write_enabled).toBe(false)
    expect(status.execution_enabled).toBe(false)
    expect(status.direct_filesystem_exposed).toBe(false)
    expect(status.raw_private_dump_enabled).toBe(false)
    expect(serialized).not.toContain(fixture.root)
    expect(serialized).not.toContain('/home/tony')
  })

  it('returns safe query summaries without dumping entity, triple, or embedding content', () => {
    const fixture = makeMemPalaceFixture()
    const result = queryAgentZeroMemPalaceSummary({ ...fixture, query: 'Bridge memory' })
    const serialized = JSON.stringify(result)

    expect(result.ok).toBe(true)
    expect(result.summary?.matched).toBe(true)
    expect(result.summary?.entity_matches).toBeGreaterThan(0)
    expect(result.summary?.triple_matches).toBeGreaterThan(0)
    expect(result.summary?.chroma_fulltext_matches).toBeGreaterThan(0)
    expect(result.raw_records_returned).toBe(false)
    expect(result.raw_private_dump_enabled).toBe(false)
    expect(serialized).not.toContain('should-not-leak')
    expect(serialized).not.toContain('secret-value')
    expect(serialized).not.toContain('private_collection_name')
    expect(serialized).not.toContain('/home/tony')
    expect(serialized).not.toContain(fixture.root)
  })

  it('reports blockers when MemPalace is not visible', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'az-mempalace-missing-'))
    const status = getAgentZeroMemPalaceStatus({
      graphDbPath: path.join(root, 'missing-graph.sqlite3'),
      chromaDbPath: path.join(root, 'missing-chroma.sqlite3'),
      dataDir: path.join(root, 'missing-data'),
      configPath: path.join(root, 'missing-config.json'),
    })
    const query = queryAgentZeroMemPalaceSummary({
      query: 'anything',
      graphDbPath: path.join(root, 'missing-graph.sqlite3'),
      chromaDbPath: path.join(root, 'missing-chroma.sqlite3'),
      dataDir: path.join(root, 'missing-data'),
      configPath: path.join(root, 'missing-config.json'),
    })

    expect(status.ok).toBe(false)
    expect(status.blockers).toContain('mempalace_not_visible')
    expect(query.ok).toBe(false)
    expect(query.blockers).toContain('mempalace_not_visible')
  })

  it('remembers task results as safe append-only summaries without raw dumps', () => {
    const fixture = makeMemPalaceFixture()
    const result = rememberAgentZeroTaskResult({
      ...fixture,
      taskId: 'task-123',
      resultSummary: 'Owner report finished. secret=do-not-leak and /home/tony/private/path.md were present in source text.',
      reportId: 'report-123',
      reportUrl: '/api/bridge/agent-zero/reports/report-123/pdf',
      confidence: 0.91,
      tags: ['Release', 'Release'],
    })
    const serialized = JSON.stringify(result)

    expect(result.ok).toBe(true)
    expect(result.action).toBe('remember_task_result')
    expect(result.memory?.category).toBe('task_result')
    expect(result.memory?.task_id).toBe('task-123')
    expect(result.memory?.report_id).toBe('report-123')
    expect(result.memory?.owner_visible_summary).toContain('Remembered task result')
    expect(result.memory?.owner_visible_summary).toContain('<redacted>')
    expect(result.memory?.owner_visible_summary).toContain('<server-local-path>')
    expect(result.overwrite_performed).toBe(false)
    expect(result.append_only_versioned).toBe(true)
    expect(result.audit_required).toBe(true)
    expect(result.raw_private_dump_enabled).toBe(false)
    expect(result.raw_records_returned).toBe(false)
    expect(serialized).not.toContain('do-not-leak')
    expect(serialized).not.toContain('/home/tony')
    expect(serialized).not.toContain(fixture.root)

    const db = new Database(fixture.summaryDbPath, { readonly: true, fileMustExist: true })
    const count = (db.prepare('SELECT COUNT(*) AS count FROM agent_zero_memory_summaries').get() as { count: number }).count
    db.close()
    expect(count).toBe(1)

    const status = getAgentZeroMemPalaceStatus(fixture)
    expect(status.counts.safe_memory_summaries).toBe(1)
  })

  it('stores owner preferences and safe summary updates as versioned records', () => {
    const fixture = makeMemPalaceFixture()
    const preference = rememberAgentZeroOwnerPreference({
      ...fixture,
      scope: 'telegram',
      preference: 'Owner prefers short natural replies.',
      tags: ['owner', 'tone'],
    })
    const first = updateAgentZeroSafeMemorySummary({
      ...fixture,
      memoryKey: 'release-status',
      summary: 'Release is at 84.2% with SMB still blocked.',
      ownerVisibleSummary: 'Updated release memory summary.',
      confidence: 0.8,
    })
    const second = updateAgentZeroSafeMemorySummary({
      ...fixture,
      memoryKey: 'release-status',
      summary: 'Release moved forward after MemPalace write adapter.',
      ownerVisibleSummary: 'Updated release memory summary again.',
      confidence: 0.82,
    })

    expect(preference.ok).toBe(true)
    expect(preference.memory?.category).toBe('owner_preference')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(first.overwrite_performed).toBe(false)
    expect(second.overwrite_performed).toBe(false)

    const db = new Database(fixture.summaryDbPath, { readonly: true, fileMustExist: true })
    const rows = db.prepare(`
      SELECT memory_key, previous_memory_id
      FROM agent_zero_memory_summaries
      WHERE memory_key = 'release-status'
      ORDER BY created_at ASC
    `).all() as Array<{ memory_key: string; previous_memory_id: string | null }>
    db.close()

    expect(rows).toHaveLength(2)
    expect(rows[0].previous_memory_id).toBeNull()
    expect(rows[1].previous_memory_id).toBeTruthy()
  })

  it('links memory to task/report metadata and blocks incomplete writes', () => {
    const fixture = makeMemPalaceFixture()
    const linked = linkAgentZeroMemoryToReportTask({
      ...fixture,
      memoryKey: 'capability-report',
      taskId: 'task-456',
      reportId: 'report-456',
      summary: 'Linked capability report to task.',
      reportUrl: '/api/bridge/agent-zero/reports/report-456/pdf',
    })
    const missing = rememberAgentZeroTaskResult({ ...fixture, taskId: 'task-789', resultSummary: '' })

    expect(linked.ok).toBe(true)
    expect(linked.memory).toMatchObject({
      category: 'task_report_link',
      task_id: 'task-456',
      report_id: 'report-456',
    })
    expect(JSON.stringify(linked)).not.toContain(fixture.root)
    expect(missing.ok).toBe(false)
    expect(missing.blockers).toContain('task_result_summary_required')
  })
})
