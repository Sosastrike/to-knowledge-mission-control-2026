import { mkdirSync, statSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import Database from 'better-sqlite3'

export const AGENT_ZERO_MEMPALACE_DEFAULT_GRAPH_DB = '/home/tony/.mempalace/knowledge_graph.sqlite3'
export const AGENT_ZERO_MEMPALACE_DEFAULT_DATA_DIR = '/home/tony/mempalace-data'
export const AGENT_ZERO_MEMPALACE_DEFAULT_CHROMA_DB = '/home/tony/mempalace-data/chroma.sqlite3'
export const AGENT_ZERO_MEMPALACE_DEFAULT_SUMMARY_DB = '/home/tony/mempalace-data/agent-zero-memory-summaries.sqlite3'
export const AGENT_ZERO_MEMPALACE_DEFAULT_CONFIG = '/home/tony/.mempalace/config.json'

const MAX_SUMMARY_ITEMS = 8
const MAX_MEMORY_SUMMARY_CHARS = 2000
const MAX_OWNER_VISIBLE_SUMMARY_CHARS = 500
const MAX_TAGS = 20

export type AgentZeroMemPalaceAdapterStatus = 'connected' | 'blocked'

export type AgentZeroMemPalaceStatus = {
  ok: boolean
  mode: 'agent_zero_mempalace_read_only_adapter'
  status: AgentZeroMemPalaceAdapterStatus
  mempalace_visible: boolean
  graph_db_status: 'present' | 'missing'
  vector_db_status: 'present' | 'missing'
  data_dir_status: 'present' | 'missing'
  config_status: 'present' | 'missing'
  index_status: 'visible' | 'missing'
  last_seen_at: string | null
  counts: {
    entities: number | null
    triples: number | null
    entity_types: number | null
    predicates: number | null
    collections: number | null
    embeddings: number | null
    fulltext_rows: number | null
    safe_memory_summaries: number | null
  }
  available_actions: Array<'status' | 'query' | 'summary' | 'remember_task_result' | 'remember_owner_preference' | 'update_safe_memory_summary' | 'link_memory_to_report_task'>
  safe_summary_available: boolean
  raw_private_dump_enabled: false
  read_only: true
  write_enabled: false
  execution_enabled: false
  direct_filesystem_exposed: false
  direct_access: false
  proxy_access: true
  blockers: string[]
}

export type AgentZeroMemPalaceWriteAction =
  | 'remember_task_result'
  | 'remember_owner_preference'
  | 'update_safe_memory_summary'
  | 'link_memory_to_report_task'

export type AgentZeroMemPalaceMemoryWriteResult = {
  ok: boolean
  mode: 'agent_zero_mempalace_bridge_memory_write_adapter'
  action: AgentZeroMemPalaceWriteAction
  status: AgentZeroMemPalaceAdapterStatus
  memory: {
    id: string
    memory_key: string
    category: 'task_result' | 'owner_preference' | 'safe_summary' | 'task_report_link'
    owner_visible_summary: string
    confidence: number
    task_id: string | null
    report_id: string | null
    tags: string[]
    created_at: string
  } | null
  read_only: false
  write_enabled: true
  execution_enabled: true
  bridge_session_required: true
  raw_records_returned: false
  raw_private_dump_enabled: false
  direct_filesystem_exposed: false
  overwrite_performed: false
  append_only_versioned: true
  audit_required: true
  blockers: string[]
  normal_reply: string
  no_fake_done: true
}

export type AgentZeroMemPalaceQuerySummary = {
  ok: boolean
  mode: 'agent_zero_mempalace_read_only_adapter'
  action: 'query' | 'summary'
  status: AgentZeroMemPalaceAdapterStatus
  query: string
  summary: {
    matched: boolean
    entity_matches: number
    triple_matches: number
    chroma_fulltext_matches: number | null
    matched_entity_types: Array<{ type: string; count: number }>
    matched_predicates: Array<{ predicate: string; count: number }>
    summary_text: string
  } | null
  raw_records_returned: false
  raw_private_dump_enabled: false
  read_only: true
  write_enabled: false
  execution_enabled: false
  direct_filesystem_exposed: false
  blockers: string[]
}

type AdapterPaths = {
  graphDbPath?: string
  dataDir?: string
  chromaDbPath?: string
  summaryDbPath?: string
  configPath?: string
}

function resolvePaths(input?: AdapterPaths) {
  const dataDir = path.resolve(input?.dataDir || process.env.AGENT_ZERO_MEMPALACE_DATA_DIR || AGENT_ZERO_MEMPALACE_DEFAULT_DATA_DIR)
  return {
    graphDbPath: path.resolve(input?.graphDbPath || process.env.AGENT_ZERO_MEMPALACE_GRAPH_DB || AGENT_ZERO_MEMPALACE_DEFAULT_GRAPH_DB),
    dataDir,
    chromaDbPath: path.resolve(input?.chromaDbPath || process.env.AGENT_ZERO_MEMPALACE_CHROMA_DB || path.join(dataDir, 'chroma.sqlite3')),
    summaryDbPath: path.resolve(input?.summaryDbPath || process.env.AGENT_ZERO_MEMPALACE_SUMMARY_DB || path.join(dataDir, 'agent-zero-memory-summaries.sqlite3')),
    configPath: path.resolve(input?.configPath || process.env.AGENT_ZERO_MEMPALACE_CONFIG || AGENT_ZERO_MEMPALACE_DEFAULT_CONFIG),
  }
}

function filePresent(filePath: string): boolean {
  try {
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}

function dirPresent(dirPath: string): boolean {
  try {
    return statSync(dirPath).isDirectory()
  } catch {
    return false
  }
}

function mtimeIso(filePath: string): string | null {
  try {
    const stat = statSync(filePath)
    return Number.isFinite(stat.mtimeMs) ? new Date(stat.mtimeMs).toISOString() : null
  } catch {
    return null
  }
}

function newestIso(values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) || null
}

function openReadonlySqlite(dbPath: string): Database.Database | null {
  if (!filePresent(dbPath)) return null
  try {
    return new Database(dbPath, { readonly: true, fileMustExist: true })
  } catch {
    return null
  }
}

function tableExists(db: Database.Database, table: string): boolean {
  try {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name = ?").get(table) as { name?: string } | undefined
    return Boolean(row?.name)
  } catch {
    return false
  }
}

function countRows(db: Database.Database | null, table: string): number | null {
  if (!db || !tableExists(db, table)) return null
  try {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count?: number } | undefined
    return typeof row?.count === 'number' ? row.count : null
  } catch {
    return null
  }
}

function countDistinct(db: Database.Database | null, table: string, column: string): number | null {
  if (!db || !tableExists(db, table)) return null
  try {
    const row = db.prepare(`SELECT COUNT(DISTINCT ${column}) AS count FROM ${table}`).get() as { count?: number } | undefined
    return typeof row?.count === 'number' ? row.count : null
  } catch {
    return null
  }
}

function sanitizeLabel(value: unknown): string {
  const raw = String(value || '').replace(/\s+/g, ' ').trim()
  if (!raw) return 'unknown'
  return raw
    .replace(/\b(?:api[_-]?key|token|secret|password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s`]+["']?/gi, (match) => {
      const key = match.split(/[:=]/)[0]?.trim() || 'secret'
      return `${key}=<redacted>`
    })
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{16,}/gi, 'Bearer <redacted>')
    .replace(/\b(?:sk|ghp|gho|ghu|ghs|ghr|xoxb|xoxp|xoxa)-[A-Za-z0-9_-]{16,}/g, '<redacted-token>')
    .replace(/\/home\/tony\/[^\s)\]'"`<>]+/g, '<server-local-path>')
    .slice(0, 80)
}

function sanitizeMemoryText(value: unknown, max = MAX_MEMORY_SUMMARY_CHARS): string {
  return String(value || '')
    .replace(/\0/g, '')
    .replace(/\b(?:api[_-]?key|token|secret|password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s`]+["']?/gi, (match) => {
      const key = match.split(/[:=]/)[0]?.trim() || 'secret'
      return `${key}=<redacted>`
    })
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{16,}/gi, 'Bearer <redacted>')
    .replace(/\b(?:sk|ghp|gho|ghu|ghs|ghr|xoxb|xoxp|xoxa)-[A-Za-z0-9_-]{16,}/g, '<redacted-token>')
    .replace(/\/home\/tony\/[^\s)\]'"`<>]+/g, '<server-local-path>')
    .replace(/\bruntime\/(?:executive-reports|reports|task-reports)\/[^\s)\]'"`<>]+/g, '<server-local-path>')
    .replace(/\s+$/g, '')
    .slice(0, max)
}

function normalizeKey(value: unknown, fallback: string): string {
  const text = sanitizeLabel(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  return text || fallback
}

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : []
  return Array.from(new Set(raw
    .map((item) => String(item || '').toLowerCase().replace(/[^a-z0-9_/-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48))
    .filter((tag) => tag && !tag.includes('..') && !tag.startsWith('/'))))
    .slice(0, MAX_TAGS)
}

function boundedConfidence(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return 0.7
  return Math.max(0, Math.min(1, Number(number.toFixed(3))))
}

function isoNow(): string {
  return new Date().toISOString()
}

function openSummaryDb(input?: AdapterPaths): Database.Database {
  const resolved = resolvePaths(input)
  mkdirSync(path.dirname(resolved.summaryDbPath), { recursive: true, mode: 0o700 })
  const db = new Database(resolved.summaryDbPath)
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_zero_memory_summaries (
      id TEXT PRIMARY KEY,
      memory_key TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('task_result', 'owner_preference', 'safe_summary', 'task_report_link')),
      summary TEXT NOT NULL,
      owner_visible_summary TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
      task_id TEXT,
      report_id TEXT,
      report_url TEXT,
      previous_memory_id TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agent_zero_memory_summaries_key_created
      ON agent_zero_memory_summaries(memory_key, created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_zero_memory_summaries_category_created
      ON agent_zero_memory_summaries(category, created_at);
  `)
  return db
}

function countSummaryRows(summaryDbPath: string): number | null {
  if (!filePresent(summaryDbPath)) return 0
  let db: Database.Database | null = null
  try {
    db = new Database(summaryDbPath, { readonly: true, fileMustExist: true })
    if (!tableExists(db, 'agent_zero_memory_summaries')) return 0
    return countRows(db, 'agent_zero_memory_summaries')
  } catch {
    return null
  } finally {
    db?.close()
  }
}

function latestMemoryForKey(db: Database.Database, memoryKey: string): { id: string } | null {
  try {
    const row = db.prepare(`
      SELECT id
      FROM agent_zero_memory_summaries
      WHERE memory_key = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(memoryKey) as { id?: string } | undefined
    return row?.id ? { id: row.id } : null
  } catch {
    return null
  }
}

function writeBlocked(action: AgentZeroMemPalaceWriteAction, blocker: string): AgentZeroMemPalaceMemoryWriteResult {
  return {
    ok: false,
    mode: 'agent_zero_mempalace_bridge_memory_write_adapter',
    action,
    status: 'blocked',
    memory: null,
    read_only: false,
    write_enabled: true,
    execution_enabled: true,
    bridge_session_required: true,
    raw_records_returned: false,
    raw_private_dump_enabled: false,
    direct_filesystem_exposed: false,
    overwrite_performed: false,
    append_only_versioned: true,
    audit_required: true,
    blockers: [blocker],
    normal_reply: 'MemPalace memory write is blocked.',
    no_fake_done: true,
  }
}

function insertSafeMemorySummary(input: {
  action: AgentZeroMemPalaceWriteAction
  category: NonNullable<AgentZeroMemPalaceMemoryWriteResult['memory']>['category']
  memoryKey: string
  summary: string
  ownerVisibleSummary?: string
  confidence?: number
  taskId?: string | null
  reportId?: string | null
  reportUrl?: string | null
  tags?: string[]
} & AdapterPaths): AgentZeroMemPalaceMemoryWriteResult {
  const status = getAgentZeroMemPalaceStatus(input)
  if (!status.ok && status.data_dir_status !== 'present') return writeBlocked(input.action, 'mempalace_not_visible')
  const summary = sanitizeMemoryText(input.summary)
  if (!summary) return writeBlocked(input.action, 'memory_summary_required')
  const ownerVisibleSummary = sanitizeMemoryText(input.ownerVisibleSummary || summary, MAX_OWNER_VISIBLE_SUMMARY_CHARS)
  const memoryKey = normalizeKey(input.memoryKey, `${input.category}:${Date.now()}`)
  let db: Database.Database | null = null
  try {
    db = openSummaryDb(input)
    const previous = latestMemoryForKey(db, memoryKey)
    const id = `azm_${randomUUID()}`
    const createdAt = isoNow()
    const taskId = input.taskId ? sanitizeLabel(input.taskId) : null
    const reportId = input.reportId ? sanitizeLabel(input.reportId) : null
    const reportUrl = input.reportUrl ? sanitizeMemoryText(input.reportUrl, 300) : null
    const tags = normalizeTags(input.tags)
    db.prepare(`
      INSERT INTO agent_zero_memory_summaries (
        id, memory_key, category, summary, owner_visible_summary, confidence,
        task_id, report_id, report_url, previous_memory_id, tags_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      memoryKey,
      input.category,
      summary,
      ownerVisibleSummary,
      boundedConfidence(input.confidence),
      taskId,
      reportId,
      reportUrl,
      previous?.id || null,
      JSON.stringify(tags),
      createdAt,
    )
    return {
      ok: true,
      mode: 'agent_zero_mempalace_bridge_memory_write_adapter',
      action: input.action,
      status: 'connected',
      memory: {
        id,
        memory_key: memoryKey,
        category: input.category,
        owner_visible_summary: ownerVisibleSummary,
        confidence: boundedConfidence(input.confidence),
        task_id: taskId,
        report_id: reportId,
        tags,
        created_at: createdAt,
      },
      read_only: false,
      write_enabled: true,
      execution_enabled: true,
      bridge_session_required: true,
      raw_records_returned: false,
      raw_private_dump_enabled: false,
      direct_filesystem_exposed: false,
      overwrite_performed: false,
      append_only_versioned: true,
      audit_required: true,
      blockers: [],
      normal_reply: `Remembered safely: ${ownerVisibleSummary}`,
      no_fake_done: true,
    }
  } catch (error) {
    return writeBlocked(input.action, error instanceof Error ? error.message.slice(0, 200) : 'mempalace_memory_write_failed')
  } finally {
    db?.close()
  }
}

function safeFtsQuery(query: string): string {
  const words = query
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}_-]/gu, ''))
    .filter(Boolean)
    .slice(0, 8)
  if (!words.length) return '""'
  return words.map((word) => `${word}*`).join(' ')
}

function countGraphMatches(db: Database.Database | null, query: string) {
  if (!db) {
    return {
      entityMatches: 0,
      tripleMatches: 0,
      matchedEntityTypes: [] as Array<{ type: string; count: number }>,
      matchedPredicates: [] as Array<{ predicate: string; count: number }>,
    }
  }
  const like = `%${query}%`
  let entityMatches = 0
  let tripleMatches = 0
  let matchedEntityTypes: Array<{ type: string; count: number }> = []
  let matchedPredicates: Array<{ predicate: string; count: number }> = []
  try {
    if (tableExists(db, 'entities')) {
      const row = db.prepare('SELECT COUNT(*) AS count FROM entities WHERE name LIKE ? OR type LIKE ? OR properties LIKE ?').get(like, like, like) as { count?: number } | undefined
      entityMatches = typeof row?.count === 'number' ? row.count : 0
      matchedEntityTypes = (db.prepare(`
        SELECT COALESCE(type, 'unknown') AS type, COUNT(*) AS count
        FROM entities
        WHERE name LIKE ? OR type LIKE ? OR properties LIKE ?
        GROUP BY COALESCE(type, 'unknown')
        ORDER BY count DESC, type ASC
        LIMIT ?
      `).all(like, like, like, MAX_SUMMARY_ITEMS) as Array<{ type?: string; count?: number }>).map((row) => ({
        type: sanitizeLabel(row.type),
        count: Number(row.count || 0),
      }))
    }
  } catch {
    entityMatches = 0
    matchedEntityTypes = []
  }
  try {
    if (tableExists(db, 'triples')) {
      const row = db.prepare('SELECT COUNT(*) AS count FROM triples WHERE subject LIKE ? OR predicate LIKE ? OR object LIKE ? OR source_file LIKE ?').get(like, like, like, like) as { count?: number } | undefined
      tripleMatches = typeof row?.count === 'number' ? row.count : 0
      matchedPredicates = (db.prepare(`
        SELECT COALESCE(predicate, 'unknown') AS predicate, COUNT(*) AS count
        FROM triples
        WHERE subject LIKE ? OR predicate LIKE ? OR object LIKE ? OR source_file LIKE ?
        GROUP BY COALESCE(predicate, 'unknown')
        ORDER BY count DESC, predicate ASC
        LIMIT ?
      `).all(like, like, like, like, MAX_SUMMARY_ITEMS) as Array<{ predicate?: string; count?: number }>).map((row) => ({
        predicate: sanitizeLabel(row.predicate),
        count: Number(row.count || 0),
      }))
    }
  } catch {
    tripleMatches = 0
    matchedPredicates = []
  }
  return { entityMatches, tripleMatches, matchedEntityTypes, matchedPredicates }
}

function countChromaFtsMatches(db: Database.Database | null, query: string): number | null {
  if (!db || !tableExists(db, 'embedding_fulltext_search')) return null
  try {
    const row = db.prepare('SELECT COUNT(*) AS count FROM embedding_fulltext_search WHERE embedding_fulltext_search MATCH ?').get(safeFtsQuery(query)) as { count?: number } | undefined
    return typeof row?.count === 'number' ? row.count : 0
  } catch {
    return null
  }
}

export function getAgentZeroMemPalaceStatus(input?: AdapterPaths): AgentZeroMemPalaceStatus {
  const resolved = resolvePaths(input)
  const graphPresent = filePresent(resolved.graphDbPath)
  const chromaPresent = filePresent(resolved.chromaDbPath)
  const dataDirPresent = dirPresent(resolved.dataDir)
  const configPresent = filePresent(resolved.configPath)
  const summaryRows = countSummaryRows(resolved.summaryDbPath)
  const graphDb = openReadonlySqlite(resolved.graphDbPath)
  const chromaDb = openReadonlySqlite(resolved.chromaDbPath)
  const entities = countRows(graphDb, 'entities')
  const triples = countRows(graphDb, 'triples')
  const entityTypes = countDistinct(graphDb, 'entities', 'type')
  const predicates = countDistinct(graphDb, 'triples', 'predicate')
  const collections = countRows(chromaDb, 'collections')
  const embeddings = countRows(chromaDb, 'embeddings')
  const fulltextRows = countRows(chromaDb, 'embedding_fulltext_search')
  graphDb?.close()
  chromaDb?.close()

  const visible = Boolean(graphPresent || chromaPresent || dataDirPresent || configPresent)
  const blockers = [
    ...(graphPresent ? [] : ['mempalace_knowledge_graph_missing']),
    ...(chromaPresent ? [] : ['mempalace_chroma_index_missing']),
  ]
  return {
    ok: visible,
    mode: 'agent_zero_mempalace_read_only_adapter',
    status: visible ? 'connected' : 'blocked',
    mempalace_visible: visible,
    graph_db_status: graphPresent ? 'present' : 'missing',
    vector_db_status: chromaPresent ? 'present' : 'missing',
    data_dir_status: dataDirPresent ? 'present' : 'missing',
    config_status: configPresent ? 'present' : 'missing',
    index_status: entities !== null || triples !== null || embeddings !== null || fulltextRows !== null ? 'visible' : 'missing',
    last_seen_at: newestIso([mtimeIso(resolved.graphDbPath), mtimeIso(resolved.chromaDbPath), mtimeIso(resolved.dataDir), mtimeIso(resolved.configPath)]),
    counts: { entities, triples, entity_types: entityTypes, predicates, collections, embeddings, fulltext_rows: fulltextRows, safe_memory_summaries: summaryRows },
    available_actions: visible
      ? ['status', 'query', 'summary', 'remember_task_result', 'remember_owner_preference', 'update_safe_memory_summary', 'link_memory_to_report_task']
      : ['status'],
    safe_summary_available: visible && (entities !== null || triples !== null || embeddings !== null || fulltextRows !== null),
    raw_private_dump_enabled: false,
    read_only: true,
    write_enabled: false,
    execution_enabled: false,
    direct_filesystem_exposed: false,
    direct_access: false,
    proxy_access: true,
    blockers: visible ? blockers : ['mempalace_not_visible'],
  }
}

export function queryAgentZeroMemPalaceSummary(input: { query: string; action?: 'query' | 'summary' } & AdapterPaths): AgentZeroMemPalaceQuerySummary {
  const query = input.query.trim()
  if (!query) {
    return {
      ok: false,
      mode: 'agent_zero_mempalace_read_only_adapter',
      action: input.action || 'query',
      status: 'blocked',
      query,
      summary: null,
      raw_records_returned: false,
      raw_private_dump_enabled: false,
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      blockers: ['query_required'],
    }
  }

  const resolved = resolvePaths(input)
  const status = getAgentZeroMemPalaceStatus(input)
  if (!status.ok) {
    return {
      ok: false,
      mode: 'agent_zero_mempalace_read_only_adapter',
      action: input.action || 'query',
      status: 'blocked',
      query,
      summary: null,
      raw_records_returned: false,
      raw_private_dump_enabled: false,
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      blockers: status.blockers,
    }
  }
  const graphDb = openReadonlySqlite(resolved.graphDbPath)
  const chromaDb = openReadonlySqlite(resolved.chromaDbPath)
  const graph = countGraphMatches(graphDb, query)
  const chromaMatches = countChromaFtsMatches(chromaDb, query)
  graphDb?.close()
  chromaDb?.close()

  const matched = graph.entityMatches > 0 || graph.tripleMatches > 0 || Boolean(chromaMatches && chromaMatches > 0)
  const summaryText = matched
    ? `MemPalace has ${graph.entityMatches} knowledge-graph entity matches, ${graph.tripleMatches} relationship matches, and ${chromaMatches ?? 'unknown'} vector/full-text matches for this query. Raw memory records are not exposed to Agent Zero.`
    : 'MemPalace is visible, but no safe indexed summary matched this query. Raw memory records are not exposed to Agent Zero.'

  return {
    ok: true,
    mode: 'agent_zero_mempalace_read_only_adapter',
    action: input.action || 'query',
    status: 'connected',
    query: sanitizeLabel(query),
    summary: {
      matched,
      entity_matches: graph.entityMatches,
      triple_matches: graph.tripleMatches,
      chroma_fulltext_matches: chromaMatches,
      matched_entity_types: graph.matchedEntityTypes,
      matched_predicates: graph.matchedPredicates,
      summary_text: summaryText,
    },
    raw_records_returned: false,
    raw_private_dump_enabled: false,
    read_only: true,
    write_enabled: false,
    execution_enabled: false,
    direct_filesystem_exposed: false,
    blockers: [],
  }
}

export function rememberAgentZeroTaskResult(input: {
  taskId?: string | number | null
  resultSummary?: string | null
  reportId?: string | null
  reportUrl?: string | null
  confidence?: number
  tags?: unknown
} & AdapterPaths): AgentZeroMemPalaceMemoryWriteResult {
  const taskId = input.taskId ? sanitizeLabel(input.taskId) : ''
  const summary = sanitizeMemoryText(input.resultSummary)
  if (!taskId) return writeBlocked('remember_task_result', 'task_id_required')
  if (!summary) return writeBlocked('remember_task_result', 'task_result_summary_required')
  return insertSafeMemorySummary({
    ...input,
    action: 'remember_task_result',
    category: 'task_result',
    memoryKey: `task_result:${taskId}`,
    summary,
    ownerVisibleSummary: `Remembered task result for ${taskId}: ${summary}`,
    confidence: input.confidence,
    taskId,
    reportId: input.reportId,
    reportUrl: input.reportUrl,
    tags: normalizeTags(input.tags).concat('task-result'),
  })
}

export function rememberAgentZeroOwnerPreference(input: {
  preference?: string | null
  scope?: string | null
  confidence?: number
  tags?: unknown
} & AdapterPaths): AgentZeroMemPalaceMemoryWriteResult {
  const preference = sanitizeMemoryText(input.preference)
  const scope = sanitizeLabel(input.scope || 'general')
  if (!preference) return writeBlocked('remember_owner_preference', 'owner_preference_required')
  return insertSafeMemorySummary({
    ...input,
    action: 'remember_owner_preference',
    category: 'owner_preference',
    memoryKey: `owner_preference:${normalizeKey(scope, 'general')}`,
    summary: preference,
    ownerVisibleSummary: `Remembered owner preference for ${scope}: ${preference}`,
    confidence: input.confidence ?? 0.8,
    tags: normalizeTags(input.tags).concat('owner-preference'),
  })
}

export function updateAgentZeroSafeMemorySummary(input: {
  memoryKey?: string | null
  summary?: string | null
  ownerVisibleSummary?: string | null
  confidence?: number
  tags?: unknown
} & AdapterPaths): AgentZeroMemPalaceMemoryWriteResult {
  const memoryKey = normalizeKey(input.memoryKey, '')
  const summary = sanitizeMemoryText(input.summary)
  if (!memoryKey) return writeBlocked('update_safe_memory_summary', 'memory_key_required')
  if (!summary) return writeBlocked('update_safe_memory_summary', 'memory_summary_required')
  return insertSafeMemorySummary({
    ...input,
    action: 'update_safe_memory_summary',
    category: 'safe_summary',
    memoryKey,
    summary,
    ownerVisibleSummary: input.ownerVisibleSummary || `Updated safe memory summary for ${memoryKey}.`,
    confidence: input.confidence,
    tags: normalizeTags(input.tags).concat('safe-summary'),
  })
}

export function linkAgentZeroMemoryToReportTask(input: {
  memoryKey?: string | null
  taskId?: string | number | null
  reportId?: string | null
  reportUrl?: string | null
  summary?: string | null
  confidence?: number
  tags?: unknown
} & AdapterPaths): AgentZeroMemPalaceMemoryWriteResult {
  const taskId = input.taskId ? sanitizeLabel(input.taskId) : ''
  const reportId = input.reportId ? sanitizeLabel(input.reportId) : ''
  const memoryKey = normalizeKey(input.memoryKey || taskId || reportId, '')
  if (!memoryKey) return writeBlocked('link_memory_to_report_task', 'memory_key_or_task_or_report_required')
  if (!taskId && !reportId) return writeBlocked('link_memory_to_report_task', 'task_id_or_report_id_required')
  const summary = sanitizeMemoryText(input.summary || `Linked memory ${memoryKey} to ${taskId ? `task ${taskId}` : ''}${taskId && reportId ? ' and ' : ''}${reportId ? `report ${reportId}` : ''}.`)
  return insertSafeMemorySummary({
    ...input,
    action: 'link_memory_to_report_task',
    category: 'task_report_link',
    memoryKey: `task_report_link:${memoryKey}`,
    summary,
    ownerVisibleSummary: summary,
    confidence: input.confidence ?? 0.75,
    taskId: taskId || null,
    reportId: reportId || null,
    reportUrl: input.reportUrl,
    tags: normalizeTags(input.tags).concat('task-report-link'),
  })
}
