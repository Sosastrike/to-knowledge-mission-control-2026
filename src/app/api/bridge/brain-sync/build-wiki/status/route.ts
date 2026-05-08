import { NextRequest, NextResponse } from 'next/server'
import { execFileSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { authJson } from '@/lib/designer-module-api'
import {
  BUILDWIKI_TARGET_SERVICE,
  deriveRunNowUiState,
  pickPublicApprovalView,
  pickPublicRunView,
  readLatestRunNow,
} from '@/lib/build-wiki-run-now'
import { readLatestTelegramBuildWikiRunNowApproval } from '@/lib/build-wiki-telegram-run-now'
import {
  BUILDWIKI_TIMER_UNIT,
  deriveTimerUiState,
  readLatestTimerControl,
  TIMER_PUBLIC_VIEW,
} from '@/lib/build-wiki-timer-control'
import {
  ADD_SOURCE_PUBLIC_VIEW,
  BUILDWIKI_TARGET_FARMER_SCRIPT,
  deriveAddSourceUiState,
  readLatestAddSource,
  readSourcesBlock,
} from '@/lib/build-wiki-add-source'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Read-only status surface for the Build-Wiki/Farmer sync under OpenClaw+.
//
// Source of truth:
//   • integration_connections row in the ClaudeClaw integration database
//     (provider = 'skill.build_wiki') for registry/meta state.
//   • agent_skills row (name = 'build-wiki') for assignment + health.
//   • systemd --user timer for live next-run / last-run.
//   • Filesystem counts under the legacy Build-Wiki storage subtree.
//
// This route never writes, never reads .env, never exposes secrets, and never
// triggers a farmer run. Controls in the response are advisory contracts only.
// ---------------------------------------------------------------------------

const CLAUDECLAW_DB_PATH =
  process.env.CLAUDECLAW_DB_PATH || '/home/tony/claudeclaw/store/claudeclaw.db'

const VAULT_BASE =
  process.env.OPENCLOUD_WIKI_VAULT_PATH ||
  '/home/tony/obsidian-vault/08-Wiki/OpenCloud'

const FARMER_LOG =
  process.env.OPENCLOUD_FARMER_LOG_PATH ||
  '/home/tony/.openclaw/logs/opencloud-docs-farmer.log'

const TIMER_UNIT = 'opencloud-docs-farmer.timer'
const SERVICE_UNIT = 'opencloud-docs-farmer.service'

const KNOWN_LOCAL_SOURCES = [
  '/home/tony/claudeclaw/docs/',
  '/home/tony/mission-control/docs/',
  '/home/tony/agent-capabilities/to-knowledge-everything-claude-code/docs/',
  '/home/tony/agent-memory/to-knowledge-claude-mem/docs/',
  '/home/tony/to-knowledge-lightrag/docs/',
]

function ownerSafeLocalRef(value: string | null | undefined, fallback: string): string | null {
  return value ? fallback : null
}

function ownerSafeLocalRefs(values: string[], prefix: string): string[] {
  return values.map((_, index) => `${prefix}_${index + 1}`)
}

type IntegrationRow = {
  provider: string
  connected: number
  health: string | null
  last_sync_at: number | null
  last_tested_at: number | null
  backend_status: string | null
  meta_json: string | null
  updated_at: number | null
}

type AgentSkillRow = {
  name: string
  enabled: number
  health: string | null
  assigned_agents: string | null
  mandatory_for: string | null
}

type ScheduledFarmer = {
  name: string
  script_path?: string
  systemd_service?: string
  systemd_timer?: string
  cadence?: string
  sources?: string[]
  per_run_cap?: number
  recency_window_days?: number
  network_egress?: boolean
  credentials_required?: string[]
  enabled?: boolean
  sources_count?: number
}

type DraftFarmer = {
  name: string
  state: string
  script_path?: string
  source?: string
  blockers?: string[]
}

type WikiMeta = {
  category?: string
  display_name?: string
  tool_state?: string
  install_path?: string
  obsidian_scaffold_path?: string
  farmers_running?: boolean
  auto_sync_enabled?: boolean
  approved_by?: string
  approved_at?: number
  installed_at?: number
  installed_by?: string
  next_action?: string
  stage?: string
  assigned_agents?: string[]
  activated_at?: number
  activated_by?: string
  scheduled_farmers?: ScheduledFarmer[]
  scheduled_farmers_count?: number
  draft_farmers?: DraftFarmer[]
  draft_farmers_count?: number
  raw_files_count?: number
  wiki_files_count?: number
  archive_files_count?: number
  cadence_summary?: string
  last_health_check_at?: number
}

function readRegistry(): {
  row: IntegrationRow | null
  meta: WikiMeta
  agentSkill: AgentSkillRow | null
} {
  let db: Database.Database | null = null
  try {
    db = new Database(CLAUDECLAW_DB_PATH, { readonly: true, fileMustExist: true })
    const row = db
      .prepare(
        `SELECT provider, connected, health, last_sync_at, last_tested_at,
                backend_status, meta_json, updated_at
           FROM integration_connections
          WHERE provider = 'skill.build_wiki'`,
      )
      .get() as IntegrationRow | undefined
    const agentSkill = db
      .prepare(
        `SELECT name, enabled, health, assigned_agents, mandatory_for
           FROM agent_skills
          WHERE name = 'build-wiki'`,
      )
      .get() as AgentSkillRow | undefined

    let meta: WikiMeta = {}
    if (row?.meta_json) {
      try {
        meta = JSON.parse(row.meta_json) as WikiMeta
      } catch {
        meta = {}
      }
    }
    return { row: row || null, meta, agentSkill: agentSkill || null }
  } catch {
    return { row: null, meta: {}, agentSkill: null }
  } finally {
    try {
      db?.close()
    } catch {
      /* noop */
    }
  }
}

function safeSystemctl(args: string[]): string {
  try {
    return execFileSync('systemctl', args, {
      encoding: 'utf8',
      env: {
        ...process.env,
        XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/1001',
      },
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2500,
      maxBuffer: 256 * 1024,
    })
  } catch {
    return ''
  }
}

function parseSystemctlShow(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const idx = line.indexOf('=')
    if (idx === -1) continue
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return out
}

function timestampOrNull(value: string | undefined): string | null {
  if (!value || value === '0' || value === 'n/a') return null
  // systemd prints e.g. "Thu 2026-04-30 12:44:33 EDT"; pass through as-is.
  return value
}

function getTimerStatus() {
  const showTimer = parseSystemctlShow(
    safeSystemctl([
      '--user',
      'show',
      TIMER_UNIT,
      '--no-pager',
      '-p',
      'NextElapseUSecRealtime',
      '-p',
      'LastTriggerUSec',
      '-p',
      'ActiveState',
      '-p',
      'UnitFileState',
    ]),
  )
  const showService = parseSystemctlShow(
    safeSystemctl([
      '--user',
      'show',
      SERVICE_UNIT,
      '--no-pager',
      '-p',
      'Result',
      '-p',
      'ExecMainStatus',
      '-p',
      'ExecMainStartTimestamp',
      '-p',
      'ExecMainExitTimestamp',
      '-p',
      'ActiveState',
      '-p',
      'SubState',
    ]),
  )

  return {
    timer_active: showTimer.ActiveState === 'active',
    timer_unit_file_state: showTimer.UnitFileState || 'unknown',
    next_run_at: timestampOrNull(showTimer.NextElapseUSecRealtime),
    last_run_at: timestampOrNull(showTimer.LastTriggerUSec),
    service_active_state: showService.ActiveState || 'unknown',
    service_sub_state: showService.SubState || 'unknown',
    last_result: showService.Result || 'unknown',
    last_exit_status:
      showService.ExecMainStatus !== undefined
        ? Number(showService.ExecMainStatus)
        : null,
    last_run_started_at: timestampOrNull(showService.ExecMainStartTimestamp),
    last_run_exited_at: timestampOrNull(showService.ExecMainExitTimestamp),
  }
}

async function countMarkdown(dir: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir)
    let n = 0
    for (const name of entries) {
      if (name.endsWith('.md')) n++
    }
    return n
  } catch {
    return 0
  }
}

async function countDestination() {
  const [raw, wiki, archive] = await Promise.all([
    countMarkdown(path.join(VAULT_BASE, 'raw')),
    countMarkdown(path.join(VAULT_BASE, 'wiki')),
    countMarkdown(path.join(VAULT_BASE, 'wiki', '_archive', '2026-04')),
  ])
  return { raw, wiki, archive }
}

async function readLastError(): Promise<string | null> {
  try {
    const buf = await fs.readFile(FARMER_LOG, 'utf8')
    const lines = buf.split('\n').filter(Boolean)
    // tail 200 lines and look for error/warn markers
    const tail = lines.slice(-200)
    for (let i = tail.length - 1; i >= 0; i--) {
      const line = tail[i]
      if (/\b(error|fail|refus|exit\s+code\s+[1-9])/i.test(line)) {
        return line
      }
    }
    return null
  } catch {
    return null
  }
}

function deriveSyncState(
  enabled: boolean,
  timerActive: boolean,
  lastResult: string,
  health: string | null,
): 'active' | 'paused' | 'failed' | 'unknown' {
  if (lastResult && lastResult !== 'success' && lastResult !== 'unknown') {
    return 'failed'
  }
  if (health === 'failed' || health === 'error') return 'failed'
  if (enabled && timerActive) return 'active'
  if (!timerActive) return 'paused'
  return 'unknown'
}

function safeAssignedAgents(meta: WikiMeta, agentSkill: AgentSkillRow | null): string[] {
  if (Array.isArray(meta.assigned_agents) && meta.assigned_agents.length > 0) {
    return meta.assigned_agents.map(String)
  }
  if (agentSkill?.assigned_agents) {
    try {
      const parsed = JSON.parse(agentSkill.assigned_agents)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      /* noop */
    }
  }
  return []
}

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  const { row, meta, agentSkill } = readRegistry()
  const timer = getTimerStatus()
  const counts = await countDestination()
  const lastError = await readLastError()
  const telegramRunNow = await readLatestTelegramBuildWikiRunNowApproval()

  const scheduled = meta.scheduled_farmers?.[0] || null
  // Active sources come from the LIVE farmer script (the source of truth for
  // what the farmer will actually scan), not the registry meta — the registry
  // can drift after an Add-Local-Source dispatch. Falls back to the registry
  // if the script can't be read (e.g., during deploys).
  const liveBlock = await readSourcesBlock()
  const registrySources = scheduled?.sources?.map(String) || []
  const activeSources: string[] = liveBlock.ok && liveBlock.sources.length > 0
    ? liveBlock.sources.map(String)
    : registrySources
  const normalizeSrc = (s: string) => s.endsWith('/') ? s.replace(/\/+$/, '/') : s + '/'
  const sourceSet = new Set(activeSources.map(normalizeSrc))
  const availableExpansions = KNOWN_LOCAL_SOURCES.filter((src) => !sourceSet.has(normalizeSrc(src)))

  const enabled = Boolean(scheduled?.enabled)
  const syncState = deriveSyncState(
    enabled,
    timer.timer_active,
    timer.last_result,
    row?.health || null,
  )

  const draftFarmers = (meta.draft_farmers || []).map((d) => ({
    name: d.name,
    state: d.state || 'draft_disabled',
    source: ownerSafeLocalRef(d.source, 'configured_source'),
    script_path: ownerSafeLocalRef(d.script_path, 'configured_farmer_script'),
    blockers: Array.isArray(d.blockers) ? d.blockers : [],
  }))

  const response = {
    ok: true,
    read_only: true,
    generated_at: new Date().toISOString(),
    source_db: 'claudeclaw',
    canonical_route: '/api/bridge/brain-sync/build-wiki/status',
    sync: {
      state: syncState,
      stage: meta.stage || null,
      tool_state: meta.tool_state || null,
      auto_sync_enabled: Boolean(meta.auto_sync_enabled),
      farmers_running: Boolean(meta.farmers_running),
      health: row?.health || null,
      backend_status: row?.backend_status || null,
      connected: Boolean(row?.connected),
      last_sync_at: row?.last_sync_at || null,
      last_tested_at: row?.last_tested_at || null,
      last_health_check_at: meta.last_health_check_at || null,
    },
    active_farmer: scheduled
      ? {
          name: scheduled.name,
          enabled,
          script_path: ownerSafeLocalRef(scheduled.script_path, 'configured_farmer_script'),
          systemd_service: scheduled.systemd_service || SERVICE_UNIT,
          systemd_timer: scheduled.systemd_timer || TIMER_UNIT,
          cadence: scheduled.cadence || meta.cadence_summary || null,
          per_run_cap: scheduled.per_run_cap ?? null,
          recency_window_days: scheduled.recency_window_days ?? null,
          network_egress: Boolean(scheduled.network_egress),
          credentials_required: scheduled.credentials_required || [],
          sources_count: scheduled.sources_count ?? activeSources.length,
          timer_active: timer.timer_active,
          timer_unit_file_state: timer.timer_unit_file_state,
          next_run_at: timer.next_run_at,
          last_run_at: timer.last_run_at,
          last_run_started_at: timer.last_run_started_at,
          last_run_exited_at: timer.last_run_exited_at,
          last_result: timer.last_result,
          last_exit_status: timer.last_exit_status,
          last_error: lastError,
          service_active_state: timer.service_active_state,
          service_sub_state: timer.service_sub_state,
        }
      : null,
    destination: {
      obsidian_path: ownerSafeLocalRef(VAULT_BASE, 'configured_buildwiki_destination'),
      raw_count: counts.raw || meta.raw_files_count || 0,
      wiki_count: counts.wiki || meta.wiki_files_count || 0,
      archive_count: counts.archive || meta.archive_files_count || 0,
    },
    active_sources: ownerSafeLocalRefs(activeSources, 'active_source'),
    available_source_expansions: ownerSafeLocalRefs(availableExpansions, 'available_local_source'),
    draft_external_farmers: draftFarmers,
    assigned_agents: safeAssignedAgents(meta, agentSkill),
    skill: {
      name: 'build-wiki',
      enabled: agentSkill ? Boolean(agentSkill.enabled) : null,
      health: agentSkill?.health || null,
    },
    controls: {
      run_now: 'OWNER_APPROVAL_REQUIRED',
      pause_sync: timer.timer_active ? 'OWNER_APPROVAL_REQUIRED' : 'NOT_APPLICABLE_TIMER_INACTIVE',
      resume_sync: timer.timer_active ? 'NOT_APPLICABLE_TIMER_ACTIVE' : 'OWNER_APPROVAL_REQUIRED',
      add_local_source: 'OWNER_APPROVAL_REQUIRED',
      enable_external_farmer: 'CREDENTIAL_REQUIRED',
      view_logs: 'READ_ONLY',
      view_latest_raw: 'READ_ONLY',
      view_latest_wiki: 'READ_ONLY',
    },
    run_now: (() => {
      const latest = readLatestRunNow()
      const ui = deriveRunNowUiState(latest.approval, latest.run)
      const canonical = telegramRunNow || {
        persistence_ready: latest.persistence_ready,
        target_service: BUILDWIKI_TARGET_SERVICE,
        ui_state: ui.ui_state,
        is_terminal: ui.is_terminal,
        approval: pickPublicApprovalView(latest.approval),
        run: pickPublicRunView(latest.run),
        linked_task: null,
      }
      return {
        persistence_ready: canonical.persistence_ready,
        target_service: BUILDWIKI_TARGET_SERVICE,
        ui_state: canonical.ui_state,
        is_terminal: canonical.is_terminal,
        approval: canonical.approval,
        run: canonical.run,
        linked_task: canonical.linked_task,
        approval_channel: 'Agent Zero -> owner channel',
        web_approval_enabled: false,
        dispatch_surface: 'telegram_callback_only',
        endpoints: {
          create:   { method: 'POST', path: '/api/bridge/brain-sync/build-wiki/run-now' },
          read:     { method: 'GET',  path: '/api/bridge/brain-sync/build-wiki/run-now/{id}' },
        },
      }
    })(),
    timer_control: (() => {
      const latest = readLatestTimerControl()
      const ui = deriveTimerUiState(latest.approval, latest.run)
      const timerActive = timer.timer_active
      return {
        persistence_ready: latest.persistence_ready,
        target_unit: BUILDWIKI_TIMER_UNIT,
        timer_active: timerActive,
        offered_action: timerActive ? 'pause' : 'resume',
        ui_state: ui.ui_state,
        is_terminal: ui.is_terminal,
        action_id: ui.action_id,
        approval: TIMER_PUBLIC_VIEW.pickApproval(latest.approval),
        run: TIMER_PUBLIC_VIEW.pickRun(latest.run),
        endpoints: {
          create:   { method: 'POST', path: '/api/bridge/brain-sync/build-wiki/timer-control' },
          dispatch: { method: 'POST', path: '/api/bridge/brain-sync/build-wiki/timer-control/{id}/dispatch' },
          read:     { method: 'GET',  path: '/api/bridge/brain-sync/build-wiki/timer-control/{id}' },
          approve:  { method: 'POST', path: '/api/bridge/approval-requests/{id}/approve' },
        },
      }
    })(),
    add_source: (() => {
      const latest = readLatestAddSource()
      const ui = deriveAddSourceUiState(latest.approval, latest.run)
      return {
        persistence_ready: latest.persistence_ready,
        target_script: BUILDWIKI_TARGET_FARMER_SCRIPT,
        ui_state: ui.ui_state,
        is_terminal: ui.is_terminal,
        latest_proposed_path: latest.approval ? 'pending_local_source' : null,
        approval: ADD_SOURCE_PUBLIC_VIEW.pickApproval(latest.approval),
        run: ADD_SOURCE_PUBLIC_VIEW.pickRun(latest.run),
        endpoints: {
          create:   { method: 'POST', path: '/api/bridge/brain-sync/build-wiki/add-source' },
          dispatch: { method: 'POST', path: '/api/bridge/brain-sync/build-wiki/add-source/{id}/dispatch' },
          read:     { method: 'GET',  path: '/api/bridge/brain-sync/build-wiki/add-source/{id}' },
          approve:  { method: 'POST', path: '/api/bridge/approval-requests/{id}/approve' },
        },
      }
    })(),
    notices: {
      no_execution_enabled: true,
      no_secret_exposure: true,
      no_env_writes: true,
      no_agent_zero_routing_change: true,
      no_zapier_writes: true,
      single_vault: true,
      run_now_dispatch_scope: BUILDWIKI_TARGET_SERVICE,
    },
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
