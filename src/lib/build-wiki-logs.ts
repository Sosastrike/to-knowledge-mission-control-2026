import { promises as fs } from 'node:fs'
import { scanForSecrets } from '@/lib/build-wiki-files'

// ---------------------------------------------------------------------------
// Build-Wiki — read-only farmer log helpers.
//
// Tail of /home/tony/.openclaw/logs/opencloud-docs-farmer.log capped at:
//   - 500 lines max per request
//   - 256 KB raw read window from the end of the file (more than enough for
//     ~500 lines of ~200-char log entries, and bounded so a runaway log can
//     never blow up the response)
//
// Every line is scanned for secret patterns; any matched line is replaced
// with `[REDACTED <pattern_name>]`. The full cap-bounded slice is also
// scanned for stats (last run, imported count, skip count, last error).
//
// This module never writes, edits, or deletes the log.
// ---------------------------------------------------------------------------

export const FARMER_LOG_PATH =
  process.env.OPENCLOUD_FARMER_LOG_PATH ||
  '/home/tony/.openclaw/logs/opencloud-docs-farmer.log'

export const MAX_LOG_LINES = 500
export const DEFAULT_LOG_LINES = 200
export const MAX_TAIL_BYTES = 256 * 1024  // 256 KB read-from-end window

const TIMESTAMP_RE = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\]/
const RUN_COMPLETE_RE = /^\[([^\]]+)\]\s+run complete\. imported=(\d+) cap=(\d+) window=([^\s]+)/
const IMPORTED_LINE_RE = /^\[([^\]]+)\]\s+imported\b/
const SKIP_DUP_RE = /^\[([^\]]+)\]\s+skip dup-sha/
const ERROR_LIKE_RE = /\b(error|fail|exception|refus|panic|warn)\b/i

export type LogStats = {
  total_lines: number
  redacted_lines: number
  earliest_timestamp: string | null
  latest_timestamp: string | null
  last_run_complete: { at: string; imported: number; cap: number; window: string } | null
  last_imported_at: string | null
  imported_in_last_run: number | null
  skipped_duplicates_in_window: number
  imported_in_window: number
  last_error: { at: string | null; line: string } | null
}

export type LogTail = {
  log_path: string
  size_bytes: number
  modified_at: string
  truncated_from_start: boolean
  lines_returned: number
  lines: string[]
  stats: LogStats
  no_writes_enabled: true
}

export function clampLineRequest(value: string | null): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LOG_LINES
  return Math.max(1, Math.min(MAX_LOG_LINES, Math.floor(n)))
}

function redactLine(line: string): { line: string; redacted: boolean } {
  const scan = scanForSecrets(line)
  if (scan.hits.length === 0) return { line, redacted: false }
  return {
    line: `[REDACTED ${scan.hits.join(',')}]`,
    redacted: true,
  }
}

function parseStats(allLines: string[]): LogStats {
  let earliest: string | null = null
  let latest: string | null = null
  let lastRunComplete: LogStats['last_run_complete'] = null
  let lastImportedAt: string | null = null
  let importedInWindow = 0
  let skippedInWindow = 0
  let lastError: LogStats['last_error'] = null

  for (const line of allLines) {
    const tsMatch = line.match(TIMESTAMP_RE)
    const ts = tsMatch ? tsMatch[1] : null
    if (ts) {
      if (!earliest) earliest = ts
      latest = ts
    }

    const runMatch = line.match(RUN_COMPLETE_RE)
    if (runMatch) {
      lastRunComplete = {
        at: runMatch[1],
        imported: Number(runMatch[2]) || 0,
        cap: Number(runMatch[3]) || 0,
        window: runMatch[4],
      }
      continue
    }

    if (IMPORTED_LINE_RE.test(line)) {
      importedInWindow += 1
      lastImportedAt = ts
      continue
    }

    if (SKIP_DUP_RE.test(line)) {
      skippedInWindow += 1
      continue
    }

    if (ERROR_LIKE_RE.test(line)) {
      // Only overwrite if this is a stronger signal — keep the LAST error in
      // the window as the surfaced one.
      lastError = { at: ts, line: line.slice(0, 400) }
    }
  }

  return {
    total_lines: allLines.length,
    redacted_lines: 0, // filled in by caller after redaction
    earliest_timestamp: earliest,
    latest_timestamp: latest,
    last_run_complete: lastRunComplete,
    last_imported_at: lastImportedAt,
    imported_in_last_run: lastRunComplete ? lastRunComplete.imported : null,
    skipped_duplicates_in_window: skippedInWindow,
    imported_in_window: importedInWindow,
    last_error: lastError,
  }
}

/**
 * Reads the tail of the farmer log. Opens the file with a positioned read
 * starting at max(0, size - MAX_TAIL_BYTES); never reads more than that
 * window, regardless of how big the file gets. Returns the last `lines`
 * complete lines from the window after redaction.
 */
export async function readFarmerLogTail(linesRequested: number): Promise<LogTail | null> {
  const cap = Math.max(1, Math.min(MAX_LOG_LINES, Math.floor(linesRequested) || DEFAULT_LOG_LINES))
  let stat
  try {
    stat = await fs.stat(FARMER_LOG_PATH)
  } catch {
    return null
  }
  if (!stat.isFile()) return null

  const totalSize = stat.size
  const readStart = Math.max(0, totalSize - MAX_TAIL_BYTES)
  const truncatedFromStart = readStart > 0
  const readLength = totalSize - readStart

  let raw = ''
  if (readLength > 0) {
    const fh = await fs.open(FARMER_LOG_PATH, 'r')
    try {
      const buf = Buffer.alloc(readLength)
      await fh.read(buf, 0, readLength, readStart)
      raw = buf.toString('utf8')
    } finally {
      await fh.close()
    }
  }

  // If we truncated from the start, drop the first (likely partial) line.
  let lines = raw.split('\n')
  if (truncatedFromStart && lines.length > 0) {
    lines = lines.slice(1)
  }
  // Drop trailing empty strings caused by the final newline.
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

  const stats = parseStats(lines)

  // Tail to the requested number of lines, then redact.
  const tail = lines.slice(-cap)
  let redactedCount = 0
  const redactedTail = tail.map((line) => {
    const r = redactLine(line)
    if (r.redacted) redactedCount += 1
    return r.line
  })

  return {
    log_path: FARMER_LOG_PATH,
    size_bytes: totalSize,
    modified_at: new Date(stat.mtimeMs).toISOString(),
    truncated_from_start: truncatedFromStart,
    lines_returned: redactedTail.length,
    lines: redactedTail,
    stats: { ...stats, redacted_lines: redactedCount },
    no_writes_enabled: true,
  }
}
