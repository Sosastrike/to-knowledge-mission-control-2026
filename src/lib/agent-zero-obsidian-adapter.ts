import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, type Dirent } from 'node:fs'
import path from 'node:path'

export const AGENT_ZERO_OBSIDIAN_DEFAULT_VAULT = '/home/tony/obsidian-vault'

const MAX_SCAN_FILES = 2500
const MAX_SEARCH_RESULTS = 12
const MAX_READ_BYTES = 120_000
const MAX_CONTENT_PREVIEW_CHARS = 8000
const MAX_SUMMARY_CHARS = 1400
const MAX_WRITE_CHARS = 20_000
const MAX_APPEND_CHARS = 6000
const MAX_TAGS = 20
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

export type AgentZeroObsidianWriteAction =
  | 'create_note'
  | 'update_note'
  | 'append_report_summary'
  | 'tag_note'
  | 'link_task_report'

export type AgentZeroObsidianWriteResult = {
  ok: boolean
  mode: 'agent_zero_obsidian_bridge_write_adapter'
  action: AgentZeroObsidianWriteAction
  status: AgentZeroObsidianAdapterStatus
  note: {
    title: string
    relative_path: string
    modified_at: string | null
    size_bytes: number
    tags?: string[]
  } | null
  read_only: false
  write_enabled: true
  execution_enabled: true
  bridge_session_required: true
  direct_filesystem_exposed: false
  raw_content_returned: false
  private_dump_returned: false
  audit_required: true
  blockers: string[]
  normal_reply: string
  no_fake_done: true
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

function cleanWriteContent(content: string, maxChars = MAX_WRITE_CHARS): string {
  return redactSensitive(String(content || '').replace(/\0/g, '')).trim().slice(0, maxChars)
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return slug || 'agent-zero-note'
}

function normalizeTag(value: string): string | null {
  const tag = String(value || '')
    .replace(/^#+/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_/-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  if (!tag || tag.startsWith('/') || tag.includes('..') || hasBlockedSegment(tag)) return null
  return tag
}

function normalizeTags(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[,\s]+/)
      : []
  return Array.from(new Set(raw.map((item) => normalizeTag(String(item))).filter((item): item is string => Boolean(item)))).slice(0, MAX_TAGS)
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

function assertNoSymlinkPath(base: string, relativePath: string): void {
  let current = base
  for (const segment of normalizeRelativePath(relativePath).split('/').filter(Boolean)) {
    current = path.join(current, segment)
    if (!existsSync(current)) continue
    const stat = lstatSync(current)
    if (stat.isSymbolicLink()) throw new Error('obsidian_path_symlink_blocked')
  }
}

function resolveSafeWritableNotePath(input: { relativePath: string; root?: string; mustExist: boolean }): string {
  const base = vaultRoot(input.root)
  const normalized = normalizeRelativePath(input.relativePath)
  if (!normalized || normalized.includes('\0') || normalized.includes('..') || hasBlockedSegment(normalized)) {
    throw new Error('obsidian_path_blocked')
  }
  if (!normalized.toLowerCase().endsWith('.md')) throw new Error('obsidian_note_must_be_markdown')
  const fullPath = path.resolve(base, normalized)
  if (!isWithin(base, fullPath)) throw new Error('obsidian_path_escapes_vault')
  assertNoSymlinkPath(base, normalized)
  if (input.mustExist) {
    const stat = lstatSync(fullPath)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('obsidian_note_not_writable')
  }
  return fullPath
}

function createRelativePath(input: { path?: string | null; title?: string | null }): string {
  const providedPath = input.path?.trim()
  if (providedPath) {
    const normalized = normalizeRelativePath(providedPath)
    return normalized.toLowerCase().endsWith('.md') ? normalized : `${normalized}.md`
  }
  const title = String(input.title || 'Agent Zero Note').trim().slice(0, 160) || 'Agent Zero Note'
  return `Agent Zero/${slugify(title)}.md`
}

function noteWriteMetadata(fullPath: string, relativePath: string, content?: string): NonNullable<AgentZeroObsidianWriteResult['note']> {
  const stat = statSync(fullPath)
  return {
    title: extractTitle(content ?? readFileSync(fullPath, 'utf8').slice(0, 12000), relativePath),
    relative_path: normalizeRelativePath(relativePath),
    modified_at: Number.isFinite(stat.mtimeMs) ? new Date(stat.mtimeMs).toISOString() : null,
    size_bytes: stat.size,
  }
}

function writeBlocked(action: AgentZeroObsidianWriteAction, blocker: string): AgentZeroObsidianWriteResult {
  return {
    ok: false,
    mode: 'agent_zero_obsidian_bridge_write_adapter',
    action,
    status: 'blocked',
    note: null,
    read_only: false,
    write_enabled: true,
    execution_enabled: true,
    bridge_session_required: true,
    direct_filesystem_exposed: false,
    raw_content_returned: false,
    private_dump_returned: false,
    audit_required: true,
    blockers: [blocker],
    normal_reply: 'Obsidian write is blocked.',
    no_fake_done: true,
  }
}

function writeSuccess(action: AgentZeroObsidianWriteAction, note: NonNullable<AgentZeroObsidianWriteResult['note']>, tags?: string[]): AgentZeroObsidianWriteResult {
  return {
    ok: true,
    mode: 'agent_zero_obsidian_bridge_write_adapter',
    action,
    status: 'connected',
    note: tags ? { ...note, tags } : note,
    read_only: false,
    write_enabled: true,
    execution_enabled: true,
    bridge_session_required: true,
    direct_filesystem_exposed: false,
    raw_content_returned: false,
    private_dump_returned: false,
    audit_required: true,
    blockers: [],
    normal_reply: 'Done. I updated the Obsidian note through the Bridge adapter.',
    no_fake_done: true,
  }
}

function requireVault(root?: string): { ok: true; base: string } | { ok: false; blocker: string } {
  const status = getAgentZeroObsidianStatus(root)
  if (!status.ok) return { ok: false, blocker: status.blockers[0] || 'obsidian_vault_missing_or_unreadable' }
  return { ok: true, base: vaultRoot(root) }
}

function contentWithFrontmatter(input: { title: string; body: string; tags?: string[] }): string {
  const tags = normalizeTags(input.tags)
  return [
    '---',
    `title: ${input.title.replace(/[\r\n]/g, ' ').slice(0, 160)}`,
    'created_by: agent_zero_bridge_adapter',
    `created_at: ${new Date().toISOString()}`,
    ...(tags.length ? [`tags: [${tags.join(', ')}]`] : []),
    '---',
    '',
    `# ${input.title.replace(/[\r\n]/g, ' ').slice(0, 160)}`,
    '',
    input.body,
    '',
  ].join('\n')
}

function readExistingNote(input: { path?: string | null; title?: string | null; root?: string }): NoteMetadata | null {
  return findNoteByPathOrTitle(input)
}

function parseSimpleTags(frontmatter: string): string[] {
  const line = frontmatter.match(/^tags:\s*(.+)$/mi)?.[1]
  if (!line) return []
  return normalizeTags(line.replace(/^\[|\]$/g, '').split(','))
}

function addTagsToContent(content: string, tags: string[]): { content: string; tags: string[] } {
  const nextTags = normalizeTags(tags)
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!frontmatter) {
    return {
      content: ['---', `tags: [${nextTags.join(', ')}]`, '---', '', content].join('\n'),
      tags: nextTags,
    }
  }
  const existingTags = parseSimpleTags(frontmatter[1])
  const merged = Array.from(new Set([...existingTags, ...nextTags])).slice(0, MAX_TAGS)
  const body = content.slice(frontmatter[0].length)
  const frontmatterBody = /^tags:\s*.+$/mi.test(frontmatter[1])
    ? frontmatter[1].replace(/^tags:\s*.+$/mi, `tags: [${merged.join(', ')}]`)
    : `${frontmatter[1].trimEnd()}\ntags: [${merged.join(', ')}]`
  return {
    content: ['---', frontmatterBody, '---', body.replace(/^\n?/, '\n')].join('\n'),
    tags: merged,
  }
}

function appendSection(input: { content: string; heading: string; body: string }): string {
  return `${input.content.replace(/\s*$/g, '')}\n\n## ${input.heading.replace(/[\r\n#]/g, ' ').trim().slice(0, 120)}\n\n${input.body.trim()}\n`
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

export function createAgentZeroObsidianNote(input: {
  path?: string | null
  title?: string | null
  content?: string | null
  tags?: unknown
  root?: string
}): AgentZeroObsidianWriteResult {
  const vault = requireVault(input.root)
  if (!vault.ok) return writeBlocked('create_note', vault.blocker)
  const title = String(input.title || 'Agent Zero Note').replace(/[\r\n]/g, ' ').trim().slice(0, 160) || 'Agent Zero Note'
  const relativePath = createRelativePath({ path: input.path, title })
  const body = cleanWriteContent(input.content || '')
  if (!body) return writeBlocked('create_note', 'obsidian_note_content_required')
  try {
    const fullPath = resolveSafeWritableNotePath({ relativePath, root: input.root, mustExist: false })
    if (existsSync(fullPath)) return writeBlocked('create_note', 'obsidian_note_already_exists')
    mkdirSync(path.dirname(fullPath), { recursive: true, mode: 0o700 })
    const content = contentWithFrontmatter({ title, body, tags: normalizeTags(input.tags) })
    writeFileSync(fullPath, content, { mode: 0o600, flag: 'wx' })
    return writeSuccess('create_note', noteWriteMetadata(fullPath, relativePath, content), normalizeTags(input.tags))
  } catch (error) {
    return writeBlocked('create_note', error instanceof Error ? error.message : 'obsidian_note_create_failed')
  }
}

export function updateAgentZeroObsidianNote(input: {
  path?: string | null
  title?: string | null
  content?: string | null
  root?: string
}): AgentZeroObsidianWriteResult {
  const vault = requireVault(input.root)
  if (!vault.ok) return writeBlocked('update_note', vault.blocker)
  const content = cleanWriteContent(input.content || '')
  if (!content) return writeBlocked('update_note', 'obsidian_note_content_required')
  try {
    const note = readExistingNote({ path: input.path, title: input.title, root: input.root })
    if (!note) return writeBlocked('update_note', 'safe_note_not_found_by_path_or_title')
    const fullPath = resolveSafeWritableNotePath({ relativePath: note.relative_path, root: input.root, mustExist: true })
    const title = String(input.title || note.title).replace(/[\r\n]/g, ' ').trim().slice(0, 160) || note.title
    const next = contentWithFrontmatter({ title, body: content })
    writeFileSync(fullPath, next, { mode: 0o600 })
    return writeSuccess('update_note', noteWriteMetadata(fullPath, note.relative_path, next))
  } catch (error) {
    return writeBlocked('update_note', error instanceof Error ? error.message : 'obsidian_note_update_failed')
  }
}

export function appendAgentZeroObsidianReportSummary(input: {
  path?: string | null
  title?: string | null
  summary?: string | null
  reportId?: string | null
  reportUrl?: string | null
  root?: string
}): AgentZeroObsidianWriteResult {
  const vault = requireVault(input.root)
  if (!vault.ok) return writeBlocked('append_report_summary', vault.blocker)
  const summary = cleanWriteContent(input.summary || '', MAX_APPEND_CHARS)
  if (!summary) return writeBlocked('append_report_summary', 'obsidian_report_summary_required')
  try {
    const note = readExistingNote({ path: input.path, title: input.title, root: input.root })
    if (!note) return writeBlocked('append_report_summary', 'safe_note_not_found_by_path_or_title')
    const fullPath = resolveSafeWritableNotePath({ relativePath: note.relative_path, root: input.root, mustExist: true })
    const current = readFileSync(fullPath, 'utf8')
    const reportLine = input.reportUrl
      ? `Report: ${redactSensitive(input.reportUrl).slice(0, 300)}`
      : input.reportId
        ? `Report: ${String(input.reportId).replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 120)}`
        : null
    const next = appendSection({
      content: current,
      heading: 'Agent Zero Report Summary',
      body: [
        `Appended: ${new Date().toISOString()}`,
        reportLine,
        '',
        summary,
      ].filter((line): line is string => line !== null).join('\n'),
    })
    writeFileSync(fullPath, next, { mode: 0o600 })
    return writeSuccess('append_report_summary', noteWriteMetadata(fullPath, note.relative_path, next))
  } catch (error) {
    return writeBlocked('append_report_summary', error instanceof Error ? error.message : 'obsidian_report_summary_append_failed')
  }
}

export function tagAgentZeroObsidianNote(input: {
  path?: string | null
  title?: string | null
  tags?: unknown
  root?: string
}): AgentZeroObsidianWriteResult {
  const vault = requireVault(input.root)
  if (!vault.ok) return writeBlocked('tag_note', vault.blocker)
  const tags = normalizeTags(input.tags)
  if (tags.length === 0) return writeBlocked('tag_note', 'obsidian_tags_required')
  try {
    const note = readExistingNote({ path: input.path, title: input.title, root: input.root })
    if (!note) return writeBlocked('tag_note', 'safe_note_not_found_by_path_or_title')
    const fullPath = resolveSafeWritableNotePath({ relativePath: note.relative_path, root: input.root, mustExist: true })
    const current = readFileSync(fullPath, 'utf8')
    const tagged = addTagsToContent(current, tags)
    writeFileSync(fullPath, tagged.content, { mode: 0o600 })
    return writeSuccess('tag_note', noteWriteMetadata(fullPath, note.relative_path, tagged.content), tagged.tags)
  } catch (error) {
    return writeBlocked('tag_note', error instanceof Error ? error.message : 'obsidian_note_tag_failed')
  }
}

export function linkAgentZeroObsidianNoteToTaskReport(input: {
  path?: string | null
  title?: string | null
  taskId?: string | number | null
  reportId?: string | null
  reportUrl?: string | null
  linkTitle?: string | null
  root?: string
}): AgentZeroObsidianWriteResult {
  const vault = requireVault(input.root)
  if (!vault.ok) return writeBlocked('link_task_report', vault.blocker)
  const taskId = input.taskId === null || input.taskId === undefined
    ? null
    : String(input.taskId).replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 120)
  const reportId = input.reportId ? String(input.reportId).replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 120) : null
  const reportUrl = input.reportUrl ? redactSensitive(input.reportUrl).slice(0, 300) : null
  const linkTitle = input.linkTitle ? String(input.linkTitle).replace(/[\[\]\r\n|]/g, '').trim().slice(0, 120) : null
  if (!taskId && !reportId && !reportUrl && !linkTitle) return writeBlocked('link_task_report', 'obsidian_task_or_report_link_required')
  try {
    const note = readExistingNote({ path: input.path, title: input.title, root: input.root })
    if (!note) return writeBlocked('link_task_report', 'safe_note_not_found_by_path_or_title')
    const fullPath = resolveSafeWritableNotePath({ relativePath: note.relative_path, root: input.root, mustExist: true })
    const current = readFileSync(fullPath, 'utf8')
    const next = appendSection({
      content: current,
      heading: 'Agent Zero Task and Report Link',
      body: [
        `Linked: ${new Date().toISOString()}`,
        taskId ? `Task: ${taskId}` : null,
        reportId ? `Report ID: ${reportId}` : null,
        reportUrl ? `Report: ${reportUrl}` : null,
        linkTitle ? `Related note: [[${linkTitle}]]` : null,
      ].filter((line): line is string => line !== null).join('\n'),
    })
    writeFileSync(fullPath, next, { mode: 0o600 })
    return writeSuccess('link_task_report', noteWriteMetadata(fullPath, note.relative_path, next))
  } catch (error) {
    return writeBlocked('link_task_report', error instanceof Error ? error.message : 'obsidian_task_report_link_failed')
  }
}
