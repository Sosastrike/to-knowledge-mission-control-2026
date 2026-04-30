import { promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from '@/lib/config'
import {
  ApprovalRow,
  ConnectorRunRow,
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_PROTECTED_CATEGORY,
  BUILDWIKI_REQUIRED_APPROVER,
  BUILDWIKI_RISK_LEVEL,
  approvalPersistenceReady,
  pickPublicApprovalView,
  pickPublicRunView,
} from '@/lib/build-wiki-run-now'

// ---------------------------------------------------------------------------
// Build-Wiki — Add Local Source helper module.
//
// Owner-approved edit of the SOURCES=() array in the farmer shell script.
// Local paths only; must be under /home/tony/, must exist, must be readable,
// must not match the denylist (.env, secret-like dirs, db dirs, vault loop,
// backup dirs). Atomic write with rollback backup; bash -n syntax check
// after replacement, restore from backup on failure.
//
// The farmer is NOT triggered to run as a side effect of adding a source —
// the next scheduled timer fire will pick the new path up naturally.
// ---------------------------------------------------------------------------

export const FARMER_SCRIPT_PATH =
  process.env.OPENCLOUD_FARMER_SCRIPT_PATH ||
  '/home/tony/obsidian-vault/08-Wiki/OpenCloud/farmers/opencloud-docs-farmer.sh'

export const FARMER_BACKUP_DIR =
  process.env.OPENCLOUD_FARMER_BACKUP_DIR ||
  '/home/tony/obsidian-vault/08-Wiki/OpenCloud/farmers/_backups'

export const ALLOWED_PATH_PREFIX = '/home/tony/'

// Denylist for the resolved (realpath) path. Matched as substring (lowercase)
// against `realpath + '/'` so directory matches work without requiring the
// caller to include a trailing slash.
const DENYLIST_SUBSTRINGS: ReadonlyArray<string> = [
  '/.env/',
  '/.env.',
  '/.ssh/',
  '/.gnupg/',
  '/.git/',
  '/.bitwarden/',
  '/.bitwarden.',
  '/secrets/',
  '/secret/',
  '/credentials/',
  '/credential/',
  '/private/',
  '/claudeclaw/store/',                       // claudeclaw DB dir
  '/mission-control/.data/',                   // mission-control DB dir
  '/mission-control.db/',                      // (defensive: anyone naming a dir this)
  '/-backups/',
  '/_backups/',
  '/backups/',
  '/.openclaw/cache/',
  '/obsidian-vault/.obsidian/',                // vault internals
  '/obsidian-vault/08-Wiki/OpenCloud/raw/',    // would re-import its own outputs
  '/obsidian-vault/08-Wiki/OpenCloud/wiki/',
  '/obsidian-vault/08-Wiki/OpenCloud/farmers/', // the script's own dir
]

// Regex denylist (more flexible patterns).
const DENYLIST_REGEXES: ReadonlyArray<RegExp> = [
  /\.env(\b|\.|\/)/i,
  /\bid_(?:rsa|ecdsa|ed25519)\b/,
  /\bbitwarden\b/i,
  /\.pgpass\b/,
  /\.netrc\b/,
]

export const BUILDWIKI_ACTION_ADD_LOCAL_SOURCE = 'buildwiki.add_local_source'
export const BUILDWIKI_TARGET_FARMER_SCRIPT = 'opencloud-docs-farmer.sh'

export type AddSourceValidation = {
  ok: boolean
  proposed_path: string
  resolved_path: string | null
  reason?: string
  reason_code?:
    | 'must_be_absolute_path'
    | 'must_be_under_home_tony'
    | 'realpath_failed'
    | 'realpath_escapes_home_tony'
    | 'not_a_directory'
    | 'not_readable'
    | 'denylisted_path'
    | 'already_in_sources'
    | 'farmer_script_unreadable'
}

export type AddSourcePlan = {
  validation: AddSourceValidation
  current_sources: string[] | null
  next_sources: string[] | null
  diff_preview: string | null
  farmer_script_path: string
  backup_dir: string
}

function denyListMatch(realPath: string): string | null {
  // Match against the path WITH a trailing slash so substrings like '/.ssh/'
  // match a directory whose realpath has no trailing slash. This catches
  // both /home/tony/.ssh and /home/tony/.ssh/something cleanly.
  const lower = (realPath + '/').toLowerCase()
  for (const sub of DENYLIST_SUBSTRINGS) {
    if (lower.includes(sub.toLowerCase())) return `denylist_substring:${sub}`
  }
  for (const re of DENYLIST_REGEXES) {
    if (re.test(realPath)) return `denylist_regex:${re.source}`
  }
  return null
}

async function isReadableDir(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p)
    if (!st.isDirectory()) return false
    await fs.access(p, (await import('node:fs')).constants.R_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Reads the farmer script and returns the SOURCES=(...) array contents,
 * along with the line ranges of the open and close braces. Treats one
 * non-empty trimmed entry per line.
 */
export async function readSourcesBlock(): Promise<{
  ok: boolean
  text: string
  lines: string[]
  openIdx: number
  closeIdx: number
  sources: string[]
  reason?: string
}> {
  let text: string
  try {
    text = await fs.readFile(FARMER_SCRIPT_PATH, 'utf8')
  } catch (e) {
    return { ok: false, text: '', lines: [], openIdx: -1, closeIdx: -1, sources: [], reason: e instanceof Error ? e.message : 'read_failed' }
  }
  const lines = text.split('\n')
  const openIdx = lines.findIndex((l) => /^\s*SOURCES=\(\s*$/.test(l))
  if (openIdx === -1) {
    return { ok: false, text, lines, openIdx, closeIdx: -1, sources: [], reason: 'sources_open_brace_not_found' }
  }
  let closeIdx = -1
  for (let i = openIdx + 1; i < lines.length; i++) {
    if (/^\s*\)\s*$/.test(lines[i])) {
      closeIdx = i
      break
    }
  }
  if (closeIdx === -1) {
    return { ok: false, text, lines, openIdx, closeIdx, sources: [], reason: 'sources_close_brace_not_found' }
  }
  const sources: string[] = []
  for (let i = openIdx + 1; i < closeIdx; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    sources.push(trimmed)
  }
  return { ok: true, text, lines, openIdx, closeIdx, sources }
}

function normalizeSource(p: string): string {
  // The farmer script lists sources without a trailing slash. Normalise so
  // /home/tony/foo/  and  /home/tony/foo  collapse to the same entry.
  if (typeof p !== 'string') return ''
  let q = p.trim()
  while (q.length > 1 && q.endsWith('/')) q = q.slice(0, -1)
  return q
}

export async function validateProposedPath(input: string): Promise<AddSourceValidation> {
  const proposed = String(input || '').trim()
  if (!proposed.startsWith('/')) {
    return { ok: false, proposed_path: proposed, resolved_path: null, reason: 'Path must be absolute', reason_code: 'must_be_absolute_path' }
  }
  if (!proposed.startsWith(ALLOWED_PATH_PREFIX)) {
    return { ok: false, proposed_path: proposed, resolved_path: null, reason: 'Path must be under /home/tony/', reason_code: 'must_be_under_home_tony' }
  }

  let realPath: string
  try {
    realPath = await fs.realpath(proposed)
  } catch {
    return { ok: false, proposed_path: proposed, resolved_path: null, reason: 'Path does not exist or is not resolvable', reason_code: 'realpath_failed' }
  }
  if (!realPath.startsWith(ALLOWED_PATH_PREFIX)) {
    return { ok: false, proposed_path: proposed, resolved_path: realPath, reason: 'Realpath escapes /home/tony/ via symlink', reason_code: 'realpath_escapes_home_tony' }
  }
  const isDir = await isReadableDir(realPath)
  if (!isDir) {
    let st
    try { st = await fs.stat(realPath) } catch { return { ok: false, proposed_path: proposed, resolved_path: realPath, reason: 'Cannot stat path', reason_code: 'not_readable' } }
    if (!st.isDirectory()) {
      return { ok: false, proposed_path: proposed, resolved_path: realPath, reason: 'Path is not a directory', reason_code: 'not_a_directory' }
    }
    return { ok: false, proposed_path: proposed, resolved_path: realPath, reason: 'Path is not readable by this process', reason_code: 'not_readable' }
  }
  const denyHit = denyListMatch(realPath)
  if (denyHit) {
    return { ok: false, proposed_path: proposed, resolved_path: realPath, reason: `Path matches denylist: ${denyHit}`, reason_code: 'denylisted_path' }
  }

  // Already-wired check
  const block = await readSourcesBlock()
  if (!block.ok) {
    return { ok: false, proposed_path: proposed, resolved_path: realPath, reason: `Cannot read farmer script: ${block.reason}`, reason_code: 'farmer_script_unreadable' }
  }
  const candidate = normalizeSource(realPath)
  for (const existing of block.sources) {
    if (normalizeSource(existing) === candidate) {
      return { ok: false, proposed_path: proposed, resolved_path: realPath, reason: 'Path is already in the SOURCES array', reason_code: 'already_in_sources' }
    }
  }

  return { ok: true, proposed_path: proposed, resolved_path: realPath }
}

function unifiedDiff(beforeLines: string[], afterLines: string[]): string {
  // Lightweight unified-style preview (not a full LCS diff). Adequate for
  // owner-approval review of single-line insertions/deletions, which is
  // the only mutation Add-Local-Source produces today.
  //
  // The previous implementation walked end-of-array index-aligned, so a
  // simple insertion at position p made every line from p..end appear as
  // a "diff" (because before[i] vs after[i] mismatch for all i ≥ p once
  // one line shifts). The fix below computes a common SUFFIX with two
  // separate pointers (beforeEnd, afterEnd) that decrement together only
  // while their values match — exactly what `diff` does.
  const out: string[] = []
  out.push(`--- ${FARMER_SCRIPT_PATH}`)
  out.push(`+++ ${FARMER_SCRIPT_PATH}`)

  // Find first differing index (longest common prefix).
  const minLen = Math.min(beforeLines.length, afterLines.length)
  let firstDiff = 0
  while (firstDiff < minLen && beforeLines[firstDiff] === afterLines[firstDiff]) {
    firstDiff++
  }
  // Identical files → no hunk.
  if (firstDiff === minLen && beforeLines.length === afterLines.length) {
    return out.join('\n')
  }

  // Find last differing index by walking the common SUFFIX (independent
  // pointers per side).
  let beforeEnd = beforeLines.length
  let afterEnd = afterLines.length
  while (
    beforeEnd > firstDiff &&
    afterEnd > firstDiff &&
    beforeLines[beforeEnd - 1] === afterLines[afterEnd - 1]
  ) {
    beforeEnd--
    afterEnd--
  }

  // Hunk window with `ctx` lines of context on either side. The start
  // index is shared; the END indices differ by the net insertion/deletion
  // count, which is what makes the `,N` counts in the @@ header right.
  const ctx = 3
  const start = Math.max(0, firstDiff - ctx)
  const beforeContextEnd = Math.min(beforeLines.length, beforeEnd + ctx)
  const afterContextEnd = Math.min(afterLines.length, afterEnd + ctx)
  const beforeCount = beforeContextEnd - start
  const afterCount = afterContextEnd - start
  out.push(`@@ -${start + 1},${beforeCount} +${start + 1},${afterCount} @@`)

  // Pre-context (identical on both sides).
  for (let i = start; i < firstDiff; i++) {
    out.push(' ' + beforeLines[i])
  }
  // Removed lines.
  for (let i = firstDiff; i < beforeEnd; i++) {
    out.push('-' + beforeLines[i])
  }
  // Added lines.
  for (let i = firstDiff; i < afterEnd; i++) {
    out.push('+' + afterLines[i])
  }
  // Post-context (identical on both sides — `diff` walks beforeLines from
  // beforeEnd; we use the same since the suffix is identical to afterLines
  // from afterEnd by construction).
  for (let i = beforeEnd; i < beforeContextEnd; i++) {
    out.push(' ' + beforeLines[i])
  }

  return out.join('\n')
}

/**
 * Builds the next SOURCES block by inserting `realPath` (without trailing
 * slash) immediately before the closing `)`. Indentation matches the existing
 * lines (first non-empty entry's leading whitespace).
 */
export async function planAddSource(input: string): Promise<AddSourcePlan> {
  const validation = await validateProposedPath(input)
  const block = await readSourcesBlock()
  if (!block.ok || !validation.ok || !validation.resolved_path) {
    return {
      validation,
      current_sources: block.ok ? block.sources : null,
      next_sources: null,
      diff_preview: null,
      farmer_script_path: FARMER_SCRIPT_PATH,
      backup_dir: FARMER_BACKUP_DIR,
    }
  }
  const inserted = normalizeSource(validation.resolved_path)
  // Detect indentation from the first existing source line; fall back to 2 spaces.
  const firstSourceLineRaw = block.lines[block.openIdx + 1] || '  '
  const indentMatch = firstSourceLineRaw.match(/^(\s*)/)
  const indent = (indentMatch && indentMatch[1]) || '  '
  const newLines = [...block.lines]
  newLines.splice(block.closeIdx, 0, indent + inserted)
  const nextSources = [...block.sources, inserted]
  const diff = unifiedDiff(block.lines, newLines)
  return {
    validation,
    current_sources: block.sources,
    next_sources: nextSources,
    diff_preview: diff,
    farmer_script_path: FARMER_SCRIPT_PATH,
    backup_dir: FARMER_BACKUP_DIR,
  }
}

function bashSyntaxCheck(scriptPath: string): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    execFile('/bin/bash', ['-n', scriptPath], { timeout: 5000 }, (err, _stdout, stderr) => {
      const stderrText = String(stderr || '').slice(0, 1000)
      if (err) resolve({ ok: false, stderr: stderrText || (err.message || 'bash_n_failed') })
      else resolve({ ok: true, stderr: stderrText })
    })
  })
}

/**
 * Atomic write of the new farmer script:
 *   1. Re-read the script + parse SOURCES block (re-check guards under the
 *      latest on-disk state).
 *   2. Re-validate the proposed path.
 *   3. Copy the current script to FARMER_BACKUP_DIR with a timestamped name.
 *   4. Write the new content to <script>.tmp with mode 0o755.
 *   5. bash -n <tmp>; if it fails, delete the tmp and abort.
 *   6. fs.rename(tmp, script) — atomic replacement.
 *   7. bash -n <script>; if it fails, restore from backup and return error.
 */
export async function applyAddSource(input: string): Promise<{
  ok: boolean
  reason?: string
  reason_code?: string
  backup_path?: string
  script_path?: string
  syntax_stderr?: string
  inserted_source?: string
}> {
  const plan = await planAddSource(input)
  if (!plan.validation.ok || !plan.next_sources || plan.diff_preview === null) {
    return {
      ok: false,
      reason: plan.validation.reason || 'plan_invalid',
      reason_code: plan.validation.reason_code || 'plan_invalid',
    }
  }
  const block = await readSourcesBlock()
  if (!block.ok) {
    return { ok: false, reason: `farmer_script_unreadable: ${block.reason}`, reason_code: 'farmer_script_unreadable' }
  }
  const inserted = normalizeSource(plan.validation.resolved_path!)
  // Detect indentation from the first existing source line.
  const firstSourceLineRaw = block.lines[block.openIdx + 1] || '  '
  const indent = (firstSourceLineRaw.match(/^(\s*)/) || ['', '  '])[1]
  const newLines = [...block.lines]
  newLines.splice(block.closeIdx, 0, indent + inserted)
  const newText = newLines.join('\n')

  // Backup
  await fs.mkdir(FARMER_BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const backupName = `${path.basename(FARMER_SCRIPT_PATH)}.bak.${ts}`
  const backupPath = path.join(FARMER_BACKUP_DIR, backupName)
  // Read current bytes again to back up the EXACT on-disk state under the
  // same lock window we used to read above.
  const currentBytes = await fs.readFile(FARMER_SCRIPT_PATH)
  await fs.writeFile(backupPath, currentBytes, { mode: 0o644 })

  // Stage tmp
  const tmpPath = `${FARMER_SCRIPT_PATH}.tmp.${process.pid}.${Date.now()}`
  await fs.writeFile(tmpPath, newText, { mode: 0o755 })

  // Syntax-check the tmp before swapping
  const preCheck = await bashSyntaxCheck(tmpPath)
  if (!preCheck.ok) {
    try { await fs.unlink(tmpPath) } catch { /* noop */ }
    return {
      ok: false,
      reason: 'bash_syntax_error_in_proposed_script',
      reason_code: 'bash_syntax_error',
      syntax_stderr: preCheck.stderr,
      backup_path: backupPath,
    }
  }

  // Atomic swap
  await fs.rename(tmpPath, FARMER_SCRIPT_PATH)

  // Re-check syntax after swap (paranoia)
  const postCheck = await bashSyntaxCheck(FARMER_SCRIPT_PATH)
  if (!postCheck.ok) {
    // Restore from backup
    const backupBytes = await fs.readFile(backupPath)
    await fs.writeFile(FARMER_SCRIPT_PATH, backupBytes, { mode: 0o755 })
    return {
      ok: false,
      reason: 'bash_syntax_error_after_swap_restored_from_backup',
      reason_code: 'bash_syntax_error_post_swap',
      syntax_stderr: postCheck.stderr,
      backup_path: backupPath,
      script_path: FARMER_SCRIPT_PATH,
    }
  }

  return {
    ok: true,
    backup_path: backupPath,
    script_path: FARMER_SCRIPT_PATH,
    inserted_source: inserted,
  }
}

// ---------------------------------------------------------------------------
// Approval-row read helpers (mirror run-now / timer-control patterns).
// ---------------------------------------------------------------------------

export type LatestAddSource = {
  persistence_ready: boolean
  approval: ApprovalRow | null
  run: ConnectorRunRow | null
}

export function readLatestAddSource(): LatestAddSource {
  let db: Database.Database | null = null
  try {
    db = new Database(config.dbPath, { readonly: true, fileMustExist: true })
    if (!approvalPersistenceReady(db)) {
      return { persistence_ready: false, approval: null, run: null }
    }
    const approval = db
      .prepare(
        `SELECT id, workspace_id, tenant_id, connector, action, target, target_key,
                requester, requester_user_id, risk_level, approval_state,
                protected_category, reason, required_approver, expires_at,
                resolved_at, resolved_by, resolved_by_user_id, resolution_reason,
                correlation_id, idempotency_key, created_at
           FROM bridge_approval_requests
          WHERE connector = ? AND action = ?
          ORDER BY created_at DESC LIMIT 1`,
      )
      .get(BUILDWIKI_CONNECTOR, BUILDWIKI_ACTION_ADD_LOCAL_SOURCE) as ApprovalRow | undefined
    if (!approval) return { persistence_ready: true, approval: null, run: null }
    const run = db
      .prepare(
        `SELECT id, approval_request_id, audit_event_id, run_state, started_at,
                finished_at, output_hash, rollback_ref, correlation_id
           FROM bridge_connector_runs
          WHERE approval_request_id = ?
          ORDER BY created_at DESC LIMIT 1`,
      )
      .get(approval.id) as ConnectorRunRow | undefined
    return { persistence_ready: true, approval, run: run || null }
  } catch {
    return { persistence_ready: false, approval: null, run: null }
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}

export function deriveAddSourceUiState(
  approval: ApprovalRow | null,
  run: ConnectorRunRow | null,
): {
  ui_state: 'idle' | 'pending_approval' | 'denied' | 'approved' | 'dispatching' | 'completed' | 'failed' | 'expired'
  is_terminal: boolean
} {
  if (!approval) return { ui_state: 'idle', is_terminal: true }
  if (approval.approval_state === 'pending') return { ui_state: 'pending_approval', is_terminal: false }
  if (approval.approval_state === 'denied') return { ui_state: 'denied', is_terminal: true }
  if (approval.approval_state === 'expired' || approval.approval_state === 'revoked') {
    return { ui_state: 'expired', is_terminal: true }
  }
  if (!run) return { ui_state: 'approved', is_terminal: false }
  switch (run.run_state) {
    case 'pending':
    case 'running':
      return { ui_state: 'dispatching', is_terminal: false }
    case 'completed':
    case 'success':
      return { ui_state: 'completed', is_terminal: true }
    case 'failed':
    case 'error':
      return { ui_state: 'failed', is_terminal: true }
    default:
      return { ui_state: 'dispatching', is_terminal: false }
  }
}

export const ADD_SOURCE_PUBLIC_VIEW = {
  pickApproval: pickPublicApprovalView,
  pickRun: pickPublicRunView,
}

export {
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_PROTECTED_CATEGORY,
  BUILDWIKI_REQUIRED_APPROVER,
  BUILDWIKI_RISK_LEVEL,
}
