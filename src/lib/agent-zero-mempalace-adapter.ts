import { statSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

export const AGENT_ZERO_MEMPALACE_DEFAULT_GRAPH_DB = '/home/tony/.mempalace/knowledge_graph.sqlite3'
export const AGENT_ZERO_MEMPALACE_DEFAULT_DATA_DIR = '/home/tony/mempalace-data'
export const AGENT_ZERO_MEMPALACE_DEFAULT_CHROMA_DB = '/home/tony/mempalace-data/chroma.sqlite3'
export const AGENT_ZERO_MEMPALACE_DEFAULT_CONFIG = '/home/tony/.mempalace/config.json'

const MAX_SUMMARY_ITEMS = 8

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
  }
  available_actions: Array<'status' | 'query' | 'summary'>
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
  configPath?: string
}

function resolvePaths(input?: AdapterPaths) {
  const dataDir = path.resolve(input?.dataDir || process.env.AGENT_ZERO_MEMPALACE_DATA_DIR || AGENT_ZERO_MEMPALACE_DEFAULT_DATA_DIR)
  return {
    graphDbPath: path.resolve(input?.graphDbPath || process.env.AGENT_ZERO_MEMPALACE_GRAPH_DB || AGENT_ZERO_MEMPALACE_DEFAULT_GRAPH_DB),
    dataDir,
    chromaDbPath: path.resolve(input?.chromaDbPath || process.env.AGENT_ZERO_MEMPALACE_CHROMA_DB || path.join(dataDir, 'chroma.sqlite3')),
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
    counts: { entities, triples, entity_types: entityTypes, predicates, collections, embeddings, fulltext_rows: fulltextRows },
    available_actions: visible ? ['status', 'query', 'summary'] : ['status'],
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
