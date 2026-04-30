import Database from 'better-sqlite3'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const WRAPPER_PATH = '/home/tony/claudeclaw/scripts/claude-video-to-brain.mjs'
const VENDOR_SKILL_PATH = '/home/tony/claudeclaw/vendor/skills/claude-video'
const CLAUDECLAW_DB_PATH = '/home/tony/claudeclaw/store/claudeclaw.db'
const OBSIDIAN_DESTINATION_PATH = '/home/tony/obsidian-vault/07-Knowledge/Viral Crawl/Video Intelligence'
const DB_INSTALLER_PATH = '/home/tony/claudeclaw/scripts/install-viral-crawl-tables.mjs'
const WATCH_ENV_PATH = '/home/tony/.config/watch/.env'
const SKILL_NAME = 'watch_video'

type SkillRow = {
  id?: number
  name?: string
  display_name?: string
  enabled?: number
  health?: string
  command_or_api?: string
}

function countMarkdownNotes(root: string): number {
  if (!existsSync(root)) return 0
  let count = 0
  const stack = [root]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    try {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const fullPath = join(current, entry.name)
        if (entry.isDirectory()) stack.push(fullPath)
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) count += 1
      }
    } catch {
      /* skip unreadable paths */
    }
  }
  return count
}

function executable(path: string): boolean {
  try {
    return Boolean(statSync(path).mode & 0o111)
  } catch {
    return false
  }
}

function readWatchEnvMode(): string | null {
  try {
    return `0${(statSync(WATCH_ENV_PATH).mode & 0o777).toString(8)}`
  } catch {
    return null
  }
}

function readSkillRegistry() {
  if (!existsSync(CLAUDECLAW_DB_PATH)) {
    return {
      skill_registry_present: false,
      db_path: CLAUDECLAW_DB_PATH,
      row: null as SkillRow | null,
      error: 'claudeclaw_db_missing',
    }
  }

  try {
    const db = new Database(CLAUDECLAW_DB_PATH, { readonly: true, fileMustExist: true })
    try {
      const row = db
        .prepare('SELECT id, name, display_name, enabled, health, command_or_api FROM agent_skills WHERE name = ? LIMIT 1')
        .get(SKILL_NAME) as SkillRow | undefined
      return {
        skill_registry_present: Boolean(row),
        db_path: CLAUDECLAW_DB_PATH,
        row: row || null,
        error: null,
      }
    } finally {
      db.close()
    }
  } catch (error) {
    return {
      skill_registry_present: false,
      db_path: CLAUDECLAW_DB_PATH,
      row: null as SkillRow | null,
      error: error instanceof Error ? error.message.slice(0, 240) : 'skill_registry_read_failed',
    }
  }
}

export function getViralCrawlVideoStatus() {
  const wrapperPresent = existsSync(WRAPPER_PATH)
  const vendorSkillPresent = existsSync(VENDOR_SKILL_PATH)
  const obsidianDestinationPresent = existsSync(OBSIDIAN_DESTINATION_PATH)
  const watchEnvPresent = existsSync(WATCH_ENV_PATH)
  const dbInstallerPresent = existsSync(DB_INSTALLER_PATH)
  const registry = readSkillRegistry()
  const enabled = registry.row?.enabled === 1
  const commandTemplate =
    registry.row?.command_or_api ||
    'node /home/tony/claudeclaw/scripts/claude-video-to-brain.mjs <URL> <agent> <purpose>'
  const backendReadyCli = wrapperPresent && vendorSkillPresent && obsidianDestinationPresent && registry.skill_registry_present && enabled
  const state = backendReadyCli ? 'BACKEND_READY_CLI' : 'READ_ONLY'

  const blockers = [
    'UI execution is disabled until owner approves a protected runner path.',
    'Endpoint is status/read-only only and never runs the wrapper.',
    'No Mission Control job queue, approval persistence, or audit-chain execution runner is connected for video jobs yet.',
  ]
  if (!wrapperPresent) blockers.push('Wrapper script is missing.')
  if (!vendorSkillPresent) blockers.push('Vendor claude-video skill is missing.')
  if (!obsidianDestinationPresent) blockers.push('Canonical Obsidian destination folder is missing.')
  if (!registry.skill_registry_present) blockers.push('watch_video skill is missing from ClaudeClaw agent_skills.')
  if (registry.skill_registry_present && !enabled) blockers.push('watch_video skill is present but disabled.')

  return {
    ok: true,
    mode: 'viral_crawl_video_status_read_only',
    wrapper_present: wrapperPresent,
    wrapper_path: WRAPPER_PATH,
    wrapper_executable: executable(WRAPPER_PATH),
    vendor_skill_present: vendorSkillPresent,
    vendor_skill_path: VENDOR_SKILL_PATH,
    obsidian_destination_present: obsidianDestinationPresent,
    obsidian_destination_path: OBSIDIAN_DESTINATION_PATH,
    obsidian_destination: OBSIDIAN_DESTINATION_PATH,
    notes_count: countMarkdownNotes(OBSIDIAN_DESTINATION_PATH),
    skill_registry_present: registry.skill_registry_present,
    skill_registry_db_path: registry.db_path,
    skill_name: SKILL_NAME,
    skill_row_id: registry.row?.id ?? null,
    skill_present: registry.skill_registry_present,
    skill_enabled: enabled,
    skill_health: registry.row?.health || 'unknown',
    enabled,
    health: registry.row?.health || 'unknown',
    command_template: commandTemplate,
    commandTemplate,
    watchEnvPresent,
    watchEnvMode: watchEnvPresent ? readWatchEnvMode() : null,
    dbInstallerPresent,
    execution_enabled: false,
    state,
    blockers,
    youtube_limitation: 'Video Intelligence uses yt-dlp/claude-video for public URLs and local files only. Login-required, private, age-gated, or region-locked YouTube videos may fail without platform access; do not use account cookies unless owner explicitly approves a secure path.',
    endpoint_contract: {
      status: 'GET /api/viral-crawl/video/status',
      run_video: 'not_enabled',
      creates_files: false,
      downloads_video: false,
      modifies_vault: false,
      prints_secrets: false,
    },
    nextAction: backendReadyCli
      ? watchEnvPresent
        ? 'Ready. Use the wrapper to analyze a public URL or local file.'
        : 'Bridge GROQ_API_KEY/OPENAI_API_KEY into ~/.config/watch/.env (mode 0600). Optional — falls back to --no-whisper.'
      : 'Cloud Code should show missing backend components from the blockers list and keep execution disabled.',
    next_action: backendReadyCli
      ? 'Cloud Code can show Video Intelligence as BACKEND_READY_CLI/read-only. Execution stays locked until owner approves runner, queue, approval, and audit flow.'
      : 'Cloud Code should show missing backend components from the blockers list and keep execution disabled.',
  }
}
