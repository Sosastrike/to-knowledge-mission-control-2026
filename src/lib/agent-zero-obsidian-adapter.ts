import { lstatSync, readdirSync, readFileSync, statSync, type Dirent } from 'node:fs'
import path from 'node:path'

export const AGENT_ZERO_OBSIDIAN_DEFAULT_VAULT = '/home/tony/obsidian-vault'

const MAX_SCAN_FILES = 2500
const MAX_SEARCH_RESULTS = 12
const MAX_READ_BYTES = 120_000
const MAX_CONTENT_PREVIEW_CHARS = 8000
const MAX_SUMMARY_CHARS = 1400
const BLOCKED_SEGMENTS = new Set([
  '.git',
  '.obsidian',
  '.trash',
  '.vscode',
  'node_modules',
  'secrets',
  'private',
  'credentials',
])

export type AgentZeroObsidianAdapterStatus = 'connected' | 'blocked'

export type AgentZeroObsidianStatus = {
  ok: boolean
  mode: 'agent_zero_obsidian_read_only_adapter'
  status: AgentZeroObsidianAdapterStatus
  vault_visible: boolean
  vault_path_status: 'present' | 'missing'
  note_count: number
  indexed: boolean
  last_indexed_at: string | null
  available_actions: Array<'status' | 'search' | 'read' | 'summarize'>
  read_only: true
  write_enabled: false
  execution_enabled: false
  direct_filesystem_exposed: false
  direct_access: false
  proxy_access: true
  blockers: string[]
}

export type AgentZeroObsidianSearchResult = {
  title: string
  relative_path: string
  snippet: string
  score: number
  modified_at: string | null
  size_bytes: number
}

export type AgentZeroObsidianReadResult = {
  ok: boolean
  mode: 'agent_zero_obsidian_read_only_adapter'
  status: AgentZeroObsidianAdapterStatus
  note: {
    title: string
    relative_path: string
    content_preview: string
    truncated: boolean
    modified_at: string | null
    size_bytes: number
    wiki_links: string[]
  } | null
  read_only: true
  write_enabled: false
  execution_enabled: false
  direct_filesystem_exposed: false
  blockers: string[]
}

export type AgentZeroObsidianSummaryResult = {
  ok: boolean
  mode: 'agent_zero_obsidian_read_only_adapter'
  status: AgentZeroObsidianAdapterStatus
  summary: {
    title: string
    relative_path: string
    summary: string
    truncated: boolean
    modified_at: string | null
  } | null
  read_only: true
  write_enabled: false
  execution_enabled: false
  direct_filesystem_exposed: false
  blockers: string[]
}

type NoteMetadata = {
  title: string
  relative_path: string
  full_path: string
  modified_at: string | null
  size_bytes: number
}

function vaultRoot(root?: string): string {
  return path.resolve(root || process.env.AGENT_ZERO_OBSIDIAN_VAULT_DIR || AGENT_ZERO_OBSIDIAN_DEFAULT_VAULT)
}

function isWithin(base: string, candidate: string): boolean {
  return candidate === base || candidate.startsWith(base + path.sep)
}

function normalizeRelativePath(value: string): string {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '')
}

function hasBlockedSegment(relativePath: string): boolean {
  return normalizeRelativePath(relativePath)
    .split('/')
    .filter(Boolean)
    .some((segment) => segment.startsWith('.') || BLOCKED_SEGMENTS.has(segment.toLowerCase()))
}

function readTextFileSafe(fullPath: string): { content: string; truncated: boolean } {
  const stat = statSync(fullPath)
  if (stat.size > MAX_READ_BYTES) {
    const content = readFileSync(fullPath, 'utf8').slice(0, MAX_CONTENT_PREVIEW_CHARS)
    return { content, truncated: true }
  }
  const content = readFileSync(fullPath, 'utf8')
  return {
    content: content.slice(0, MAX_CONTENT_PREVIEW_CHARS),
    truncated: content.length > MAX_CONTENT_PREVIEW_CHARS,
  }
}

function redactSensitive(value: string): string {
  return value
    .replace(/\b(?:api[_-]?key|token|secret|password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s`]+["']?/gi, (match) => {
      const key = match.split(/[:=]/)[0]?.trim() || 'secret'
      return `${key}=<redacted>`
    })
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{16,}/gi, 'Bearer <redacted>')
    .replace(/\b(?:sk|ghp|gho|ghu|ghs|ghr|xoxb|xoxp|xoxa)-[A-Za-z0-9_-]{16,}/g, '<redacted-token>')
    .replace(/\/home\/tony\/[^\s)\]'"`<>]+/g, '<server-local-path>')
    .replace(/\bruntime\/(?:executive-reports|reports|task-reports)\/[^\s)\]'"`<>]+/g, '<server-local-path>')
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '')
}

function cleanContentPreview(content: string): string {
  return redactSensitive(stripFrontmatter(content)).trim()
}

function extractTitle(content: string, fallbackPath: string): string {
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)
  const frontmatterTitle = frontmatter?.[1]?.match(/^title:\s*(.+)$/mi)?.[1]
  if (frontmatterTitle) return frontmatterTitle.trim().replace(/^["']|["']$/g, '')
  const h1 = content.match(/^#\s+(.+)$/m)?.[1]
  if (h1) return h1.trim()
  return path.basename(fallbackPath, path.extname(fallbackPath)).replace(/[-_]/g, ' ')
}

function wikiLinks(content: string): string[] {
  return Array.from(content.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g))
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, 30)
}

function resolveSafeNotePath(relativePath: string, root?: string): string {
  const base = vaultRoot(root)
  const normalized = normalizeRelativePath(relativePath)
  if (!normalized || normalized.includes('\0') || normalized.includes('..') || hasBlockedSegment(normalized)) {
    throw new Error('obsidian_path_blocked')
  }
  if (!normalized.toLowerCase().endsWith('.md')) throw new Error('obsidian_note_must_be_markdown')
  const fullPath = path.resolve(base, normalized)
  if (!isWithin(base, fullPath)) throw new Error('obsidian_path_escapes_vault')
  const stat = lstatSync(fullPath)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('obsidian_note_not_readable')
  return fullPath
}

function listNotes(root?: string): NoteMetadata[] {
  const base = vaultRoot(root)
  const out: NoteMetadata[] = []
  try {
    const baseStat = statSync(base)
    if (!baseStat.isDirectory()) return []
  } catch {
    return []
  }

  const walk = (dir: string, relativeDir: string) => {
    if (out.length >= MAX_SCAN_FILES) return
    let entries: Dirent[] = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (out.length >= MAX_SCAN_FILES) return
      const relative = normalizeRelativePath(path.join(relativeDir, entry.name))
      if (hasBlockedSegment(relative)) continue
      const full = path.join(dir, entry.name)
      let lst
      try {
        lst = lstatSync(full)
      } catch {
        continue
      }
      if (lst.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        walk(full, relative)
        continue
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue
      try {
        const content = readFileSync(full, 'utf8').slice(0, 12000)
        const stat = statSync(full)
        out.push({
          title: extractTitle(content, relative),
          relative_path: relative,
          full_path: full,
          modified_at: Number.isFinite(stat.mtimeMs) ? new Date(stat.mtimeMs).toISOString() : null,
          size_bytes: stat.size,
        })
      } catch {
        // Skip unreadable notes.
      }
    }
  }
  walk(base, '')
  return out.sort((a, b) => a.relative_path.localeCompare(b.relative_path))
}

function findNoteByPathOrTitle(input: { path?: string | null; title?: string | null; root?: string }): NoteMetadata | null {
  const byPath = input.path?.trim()
  if (byPath) {
    const fullPath = resolveSafeNotePath(byPath, input.root)
    const relative = normalizeRelativePath(byPath)
    const content = readFileSync(fullPath, 'utf8').slice(0, 12000)
    const stat = statSync(fullPath)
    return {
      title: extractTitle(content, relative),
      relative_path: relative,
      full_path: fullPath,
      modified_at: Number.isFinite(stat.mtimeMs) ? new Date(stat.mtimeMs).toISOString() : null,
      size_bytes: stat.size,
    }
  }

  const title = input.title?.trim().toLowerCase()
  if (!title) return null
  const notes = listNotes(input.root)
  return notes.find((note) => note.title.toLowerCase() === title)
    || notes.find((note) => path.basename(note.relative_path, '.md').toLowerCase() === title)
    || notes.find((note) => note.title.toLowerCase().includes(title))
    || null
}

function snippetFor(content: string, query: string): string {
  const clean = cleanContentPreview(content).replace(/\s+/g, ' ')
  const lower = clean.toLowerCase()
  const q = query.toLowerCase().trim()
  const index = q ? lower.indexOf(q) : -1
  const start = index >= 0 ? Math.max(0, index - 180) : 0
  return clean.slice(start, start + 420).trim()
}

function scoreNote(note: NoteMetadata, content: string, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const haystacks = [
    note.title.toLowerCase(),
    note.relative_path.toLowerCase(),
    content.toLowerCase(),
  ]
  let score = 0
  for (const term of terms) {
    if (haystacks[0].includes(term)) score += 8
    if (haystacks[1].includes(term)) score += 4
    if (haystacks[2].includes(term)) score += 1
  }
  return score
}

export function getAgentZeroObsidianStatus(root?: string): AgentZeroObsidianStatus {
  const base = vaultRoot(root)
  let present = false
  try {
    present = statSync(base).isDirectory()
  } catch {
    present = false
  }
  const notes = present ? listNotes(base) : []
  return {
    ok: present,
    mode: 'agent_zero_obsidian_read_only_adapter',
    status: present ? 'connected' : 'blocked',
    vault_visible: present,
    vault_path_status: present ? 'present' : 'missing',
    note_count: notes.length,
    indexed: notes.length > 0,
    last_indexed_at: notes.map((note) => note.modified_at).filter((value): value is string => Boolean(value)).sort().at(-1) || null,
    available_actions: present ? ['status', 'search', 'read', 'summarize'] : ['status'],
    read_only: true,
    write_enabled: false,
    execution_enabled: false,
    direct_filesystem_exposed: false,
    direct_access: false,
    proxy_access: true,
    blockers: present ? [] : ['obsidian_vault_missing_or_unreadable'],
  }
}

export function searchAgentZeroObsidianNotes(input: {
  query: string
  limit?: number
  root?: string
}): { ok: boolean; status: AgentZeroObsidianAdapterStatus; query: string; results: AgentZeroObsidianSearchResult[]; blockers: string[] } {
  const query = input.query.trim()
  if (!query) {
    return { ok: false, status: 'blocked', query, results: [], blockers: ['query_required'] }
  }
  const status = getAgentZeroObsidianStatus(input.root)
  if (!status.ok) return { ok: false, status: 'blocked', query, results: [], blockers: status.blockers }

  const results = listNotes(input.root)
    .map((note) => {
      let content = ''
      try {
        content = readFileSync(note.full_path, 'utf8')
      } catch {
        return null
      }
      const score = scoreNote(note, content, query)
      if (score <= 0) return null
      return {
        title: note.title,
        relative_path: note.relative_path,
        snippet: snippetFor(content, query),
        score,
        modified_at: note.modified_at,
        size_bytes: note.size_bytes,
      } satisfies AgentZeroObsidianSearchResult
    })
    .filter((result): result is AgentZeroObsidianSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.relative_path.localeCompare(b.relative_path))
    .slice(0, Math.min(Math.max(1, input.limit || 5), MAX_SEARCH_RESULTS))

  return {
    ok: true,
    status: 'connected',
    query,
    results,
    blockers: results.length > 0 ? [] : ['no_safe_notes_matched_query'],
  }
}

export function readAgentZeroObsidianNote(input: {
  path?: string | null
  title?: string | null
  root?: string
}): AgentZeroObsidianReadResult {
  const status = getAgentZeroObsidianStatus(input.root)
  if (!status.ok) {
    return {
      ok: false,
      mode: 'agent_zero_obsidian_read_only_adapter',
      status: 'blocked',
      note: null,
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      blockers: status.blockers,
    }
  }

  let note: NoteMetadata | null = null
  try {
    note = findNoteByPathOrTitle(input)
  } catch (error) {
    return {
      ok: false,
      mode: 'agent_zero_obsidian_read_only_adapter',
      status: 'blocked',
      note: null,
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      blockers: [error instanceof Error ? error.message : 'obsidian_note_read_blocked'],
    }
  }
  if (!note) {
    return {
      ok: false,
      mode: 'agent_zero_obsidian_read_only_adapter',
      status: 'blocked',
      note: null,
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      blockers: ['safe_note_not_found_by_path_or_title'],
    }
  }

  const { content, truncated } = readTextFileSafe(note.full_path)
  const clean = cleanContentPreview(content)
  return {
    ok: true,
    mode: 'agent_zero_obsidian_read_only_adapter',
    status: 'connected',
    note: {
      title: note.title,
      relative_path: note.relative_path,
      content_preview: clean,
      truncated,
      modified_at: note.modified_at,
      size_bytes: note.size_bytes,
      wiki_links: wikiLinks(content),
    },
    read_only: true,
    write_enabled: false,
    execution_enabled: false,
    direct_filesystem_exposed: false,
    blockers: [],
  }
}

export function summarizeAgentZeroObsidianNote(input: {
  path?: string | null
  title?: string | null
  root?: string
}): AgentZeroObsidianSummaryResult {
  const read = readAgentZeroObsidianNote(input)
  if (!read.ok || !read.note) {
    return {
      ok: false,
      mode: 'agent_zero_obsidian_read_only_adapter',
      status: read.status,
      summary: null,
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      blockers: read.blockers,
    }
  }
  const body = read.note.content_preview
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^#\s+/.test(line))
    .slice(0, 8)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_SUMMARY_CHARS)
  return {
    ok: true,
    mode: 'agent_zero_obsidian_read_only_adapter',
    status: 'connected',
    summary: {
      title: read.note.title,
      relative_path: read.note.relative_path,
      summary: body || `Safe note "${read.note.title}" is readable through the Agent Zero Obsidian adapter.`,
      truncated: read.note.truncated || body.length >= MAX_SUMMARY_CHARS,
      modified_at: read.note.modified_at,
    },
    read_only: true,
    write_enabled: false,
    execution_enabled: false,
    direct_filesystem_exposed: false,
    blockers: [],
  }
}
