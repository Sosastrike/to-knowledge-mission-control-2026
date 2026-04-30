import { promises as fs } from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Build-Wiki — read-only file visibility helpers.
//
// All paths surfaced through this module are confined to the OpenCloud
// vault subtree under /home/tony/obsidian-vault/08-Wiki/OpenCloud/{raw,wiki}.
// Caller-supplied filenames are validated against a strict allowlist regex
// AND a realpath start-with check, so '..' / absolute paths / symlinks
// pointing outside the subtree all refuse with `out_of_scope`.
//
// Raw files are immutable (the local farmer is append-only). Wiki files
// can be human-edited but this module never writes either kind.
// ---------------------------------------------------------------------------

export const VAULT_BASE =
  process.env.OPENCLOUD_WIKI_VAULT_PATH ||
  '/home/tony/obsidian-vault/08-Wiki/OpenCloud'

export const RAW_DIR = path.join(VAULT_BASE, 'raw')
export const WIKI_DIR = path.join(VAULT_BASE, 'wiki')

// Hard cap so a single GET cannot pull a multi-MB file into memory + over the
// wire. Build-Wiki files are markdown; the largest legitimate raw drop in the
// vault today is ~25 KB.
export const MAX_VIEW_BYTES = 200 * 1024

// Markdown filename allowlist. Only .md, only in our subtree. Excludes any
// path separators, control bytes, leading dots, or backslashes.
export const FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._\-]{0,250}\.md$/

export type FileType = 'raw' | 'wiki'

export type FileMeta = {
  name: string
  type: FileType
  relative_path: string
  full_path: string
  size_bytes: number
  modified_at: string  // ISO Z
  title: string | null
  imported_at: string | null
  source: string | null
  immutable: boolean
}

export type FileContent = FileMeta & {
  content: string | null
  content_truncated: boolean
  secrets_present: boolean
  secrets_redactions: string[]
  scan_warnings: string[]
}

export function dirForType(type: FileType): string {
  return type === 'raw' ? RAW_DIR : WIKI_DIR
}

export function isValidType(value: unknown): value is FileType {
  return value === 'raw' || value === 'wiki'
}

export function isValidFilename(name: string): boolean {
  if (typeof name !== 'string' || name.length === 0 || name.length > 256) return false
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false
  if (name.startsWith('.') || name.startsWith('-')) return false
  return FILENAME_RE.test(name)
}

/**
 * Verifies the resolved path lies inside the canonical vault subtree for the
 * given type AND that the realpath doesn't escape via a symlink. Returns the
 * resolved absolute path on success, or null if the file is out of scope.
 */
export async function resolveSafePath(type: FileType, name: string): Promise<string | null> {
  if (!isValidType(type) || !isValidFilename(name)) return null
  const baseDir = dirForType(type)
  const candidate = path.join(baseDir, name)
  try {
    const realPath = await fs.realpath(candidate)
    const realBase = await fs.realpath(baseDir)
    // Must be a direct child of the type directory (no nested subfolders).
    if (path.dirname(realPath) !== realBase) return null
    return realPath
  } catch {
    return null
  }
}

function parseFrontmatterField(text: string, key: string): string | null {
  // Very small YAML scanner — only extracts top-level scalar key/value pairs
  // before the first blank line / non-frontmatter delimiter. Sufficient for
  // farmer-emitted and synthesised wiki files; never evaluated as code.
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---', 3)
  if (end === -1) return null
  const block = text.slice(3, end)
  const re = new RegExp(`^\\s*${key}\\s*:\\s*(.+?)\\s*$`, 'm')
  const m = block.match(re)
  if (!m) return null
  let value = m[1].trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  return value || null
}

async function fileMetaFromDirent(type: FileType, dir: string, name: string): Promise<FileMeta | null> {
  const fullPath = path.join(dir, name)
  let stat
  try {
    stat = await fs.stat(fullPath)
  } catch {
    return null
  }
  if (!stat.isFile()) return null
  let title: string | null = null
  let imported: string | null = null
  let source: string | null = null
  try {
    const head = await fs.readFile(fullPath, { encoding: 'utf8', flag: 'r' })
    // Read only the first ~4 KB as a frontmatter snippet — we don't need the
    // full body for listing.
    const snippet = head.slice(0, 4096)
    title = parseFrontmatterField(snippet, 'title')
    imported = parseFrontmatterField(snippet, 'imported_at') || parseFrontmatterField(snippet, 'last_synthesized_at')
    source = parseFrontmatterField(snippet, 'source')
  } catch {
    /* file unreadable — leave fields null */
  }
  return {
    name,
    type,
    relative_path: path.relative(VAULT_BASE, fullPath),
    full_path: fullPath,
    size_bytes: stat.size,
    modified_at: new Date(stat.mtimeMs).toISOString(),
    title,
    imported_at: imported,
    source,
    immutable: type === 'raw',
  }
}

/**
 * Returns the most recently modified .md files inside the type's directory,
 * sorted by mtime DESC. Skips dotfiles and any name that fails the filename
 * allowlist. `limit` is clamped to [1, 200].
 */
export async function listLatestFiles(type: FileType, limit: number): Promise<FileMeta[]> {
  if (!isValidType(type)) return []
  const dir = dirForType(type)
  const cap = Math.max(1, Math.min(200, Math.floor(limit) || 25))
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }
  const candidates = entries.filter(isValidFilename)
  const metas = await Promise.all(candidates.map((name) => fileMetaFromDirent(type, dir, name)))
  return metas
    .filter((m): m is FileMeta => m !== null)
    .sort((a, b) => b.modified_at.localeCompare(a.modified_at))
    .slice(0, cap)
}

// Secret-detection — conservative regex set. If any of these match, the
// content is refused (metadata still returned so the UI can display the
// scan_warnings).
const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'anthropic_api_key',     re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'openrouter_api_key',    re: /\bsk-or-[A-Za-z0-9_-]{20,}/ },
  { name: 'openai_api_key',        re: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9]{32,}/ },
  { name: 'github_token',          re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: 'slack_bot_token',       re: /\bxox[baprs]-[A-Za-z0-9-]{16,}/ },
  { name: 'aws_access_key',        re: /\bAKIA[0-9A-Z]{16}/ },
  { name: 'google_oauth_refresh',  re: /\b1\/\/0[A-Za-z0-9_-]{40,}/ },
  { name: 'firecrawl_api_key',     re: /\bfc-[A-Za-z0-9]{20,}/ },
  { name: 'private_key_block',     re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: 'env_assignment_with_value', re: /\b(?:DASHBOARD_TOKEN|API_KEY|SECRET_KEY|BEARER_TOKEN|CLIENT_SECRET|ACCESS_TOKEN|REFRESH_TOKEN)\s*=\s*['"]?[A-Za-z0-9_-]{16,}/ },
]

export function scanForSecrets(text: string): { hits: string[] } {
  const hits: string[] = []
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(text)) hits.push(name)
  }
  return { hits }
}

/**
 * Reads a file from the OpenCloud vault subtree. Path is validated, content
 * is capped at MAX_VIEW_BYTES, and any secret-pattern hits cause content to
 * be replaced with null + the hit names listed in `secrets_redactions`.
 *
 * This is deliberately stricter than the Read tool: it never tries to render
 * binary files, never resolves symlinks outside the type dir, and never
 * returns content above the cap.
 */
export async function readFileSafe(type: FileType, name: string): Promise<FileContent | null> {
  const realPath = await resolveSafePath(type, name)
  if (!realPath) return null
  const dir = dirForType(type)
  const meta = await fileMetaFromDirent(type, dir, name)
  if (!meta) return null

  let content: string | null = null
  let truncated = false
  const warnings: string[] = []

  try {
    const stat = await fs.stat(realPath)
    if (stat.size > MAX_VIEW_BYTES) {
      truncated = true
      warnings.push(`size_${stat.size}_exceeds_cap_${MAX_VIEW_BYTES}_bytes`)
    }
    const fh = await fs.open(realPath, 'r')
    try {
      const buf = Buffer.alloc(Math.min(stat.size, MAX_VIEW_BYTES))
      await fh.read(buf, 0, buf.length, 0)
      content = buf.toString('utf8')
    } finally {
      await fh.close()
    }
  } catch (error) {
    warnings.push('read_failed')
    void error
  }

  let secretsPresent = false
  let redactions: string[] = []
  if (content !== null) {
    const scan = scanForSecrets(content)
    if (scan.hits.length > 0) {
      secretsPresent = true
      redactions = scan.hits
      content = null
      warnings.push('content_redacted_due_to_secret_pattern_match')
    }
  }

  return {
    ...meta,
    content,
    content_truncated: truncated,
    secrets_present: secretsPresent,
    secrets_redactions: redactions,
    scan_warnings: warnings,
  }
}
