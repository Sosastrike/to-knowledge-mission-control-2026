import { getDatabase, db_helpers } from '@/lib/db'
import { RON_WEASLEY_IDENTITY } from '@/lib/hermes-boundaries'
import { logger } from '@/lib/logger'

export type AgentUpdateMode = 'check' | 'apply-safe'
export type AgentUpdateState =
  | 'current'
  | 'updates_available'
  | 'blocked'
  | 'unknown'
  | 'not_installed'

export type AgentUpdateComponent = {
  id: string
  label: string
  agent_id: string
  surface: 'mission-control' | 'webui' | 'agent-runtime' | 'supporting-runtime'
  status_url?: string
  apply_url?: string
  update_payload_key?: 'webui' | 'agent'
  apply_target?: 'webui' | 'agent'
  auto_check_enabled: boolean
  auto_apply_supported: boolean
  requires_owner_restart: boolean
  requires_sudo_or_polkit: boolean
  rollback: string
  safe_policy: string
}

export type AgentUpdateResult = Omit<AgentUpdateComponent, 'apply_target'> & {
  state: AgentUpdateState
  update_available: boolean
  installed_version: string | null
  latest_version: string | null
  release_url: string | null
  blocker: string | null
  action_taken: 'checked' | 'applied' | 'queued_visible_task' | 'blocked'
  apply_target: 'webui' | 'agent' | null
  visible_task_id: number | null
  opencloud_intermediary: false
  secrets_exposed: false
}

export type AgentUpdateRun = {
  ok: boolean
  mode: AgentUpdateMode
  route: string
  timestamp: string
  auto_apply_enabled: boolean
  components: AgentUpdateResult[]
  applied_count: number
  queued_task_count: number
  blocker_count: number
  status: 'PASS' | 'BLOCKED'
  blockers: string[]
  secrets_exposed: false
  credential_values_exposed: false
  public_exposure_created: false
  opencloud_intermediary: false
}

const TASK_TITLE = 'Agent Auto-Update Control Plane'
const DEFAULT_HERMES_WEBUI_URL = `${process.env.HERMES_WEBUI_URL || 'http://127.0.0.1:8787/'}`.replace(/\/+$/, '')

export const AGENT_UPDATE_COMPONENTS: AgentUpdateComponent[] = [
  {
    id: 'mission-control',
    label: 'Mission Control',
    agent_id: 'mission-control',
    surface: 'mission-control',
    status_url: 'http://127.0.0.1:3337/api/releases/check',
    apply_url: 'http://127.0.0.1:3337/api/releases/update',
    auto_check_enabled: true,
    auto_apply_supported: false,
    requires_owner_restart: true,
    requires_sudo_or_polkit: true,
    rollback: 'Use the prior deploy backup or previous git ref, rebuild, then restart mission-control.service with owner sudo.',
    safe_policy: 'check_and_visible_task_only_until_owner_restart_gate_is_satisfied',
  },
  {
    id: 'hermes-webui',
    label: 'Ron Weasley WebUI',
    agent_id: 'hermes',
    surface: 'webui',
    status_url: `${DEFAULT_HERMES_WEBUI_URL}/api/updates/check`,
    apply_url: `${DEFAULT_HERMES_WEBUI_URL}/api/updates/apply`,
    update_payload_key: 'webui',
    apply_target: 'webui',
    auto_check_enabled: true,
    auto_apply_supported: true,
    requires_owner_restart: false,
    requires_sudo_or_polkit: false,
    rollback: 'Ron Weasley WebUI self-update keeps git history; rollback by checking out the prior tag/ref and restarting the loopback service.',
    safe_policy: 'exact_target_only_webui_or_agent_no_public_exposure',
  },
  {
    id: 'hermes-agent',
    label: 'Ron Weasley Agent',
    agent_id: 'hermes',
    surface: 'agent-runtime',
    status_url: `${DEFAULT_HERMES_WEBUI_URL}/api/updates/check`,
    apply_url: `${DEFAULT_HERMES_WEBUI_URL}/api/updates/apply`,
    update_payload_key: 'agent',
    apply_target: 'agent',
    auto_check_enabled: true,
    auto_apply_supported: true,
    requires_owner_restart: false,
    requires_sudo_or_polkit: false,
    rollback: 'Ron Weasley Agent self-update keeps git history; rollback by checking out the prior tag/ref and restarting the loopback service.',
    safe_policy: 'exact_target_only_webui_or_agent_no_public_exposure',
  },
  {
    id: 'agent-zero-jarvis',
    label: 'Agent Zero / Jarvis',
    agent_id: 'agent-zero-jarvis',
    surface: 'agent-runtime',
    status_url: 'http://100.116.35.95:50080/',
    auto_check_enabled: true,
    auto_apply_supported: false,
    requires_owner_restart: true,
    requires_sudo_or_polkit: false,
    rollback: 'Keep current Agent Zero container image/tag until an exact image update and rollback command are registered.',
    safe_policy: 'visible_task_only_until_container_update_contract_is_certified',
  },
  {
    id: 'spaceagent',
    label: 'SpaceAgent',
    agent_id: 'spaceagent',
    surface: 'agent-runtime',
    status_url: 'http://127.0.0.1:3337/api/bridge/space-agent/status',
    auto_check_enabled: true,
    auto_apply_supported: false,
    requires_owner_restart: false,
    requires_sudo_or_polkit: false,
    rollback: 'No standalone SpaceAgent updater is registered; keep updates as visible Mission Control tasks.',
    safe_policy: 'check_only_no_standalone_updater',
  },
  {
    id: 'pi',
    label: 'Pi Dispatcher',
    agent_id: 'pi',
    surface: 'agent-runtime',
    status_url: 'http://127.0.0.1:3337/api/bridge/pi/status',
    auto_check_enabled: true,
    auto_apply_supported: false,
    requires_owner_restart: false,
    requires_sudo_or_polkit: false,
    rollback: 'Pi is a Mission Control dispatcher registration; no standalone updater is registered.',
    safe_policy: 'check_only_no_standalone_updater',
  },
  {
    id: 'paperclip',
    label: 'Paperclip',
    agent_id: 'paperclip',
    surface: 'agent-runtime',
    status_url: 'http://127.0.0.1:3337/api/bridge/paperclip/status',
    auto_check_enabled: true,
    auto_apply_supported: false,
    requires_owner_restart: false,
    requires_sudo_or_polkit: false,
    rollback: 'Paperclip company/runtime changes stay blocked until credentialed admin bootstrap and exact update contract exist.',
    safe_policy: 'visible_task_only_until_paperclip_update_contract_is_certified',
  },
  {
    id: 'openclaw',
    label: 'OpenClaw / OpenCloud Supporting Runtime Only',
    agent_id: 'openclaw',
    surface: 'supporting-runtime',
    status_url: 'http://127.0.0.1:3337/api/openclaw/version',
    apply_url: 'http://127.0.0.1:3337/api/openclaw/update',
    auto_check_enabled: true,
    auto_apply_supported: false,
    requires_owner_restart: false,
    requires_sudo_or_polkit: false,
    rollback: 'OpenClaw update is supporting runtime only and must not become conversation owner; rollback through the prior package/version once certified.',
    safe_policy: 'check_and_visible_task_only_until_supporting_runtime_update_is_certified',
  },
]

function isAutoApplyEnabled(): boolean {
  try {
    const row = getDatabase()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('agent_updates.auto_apply') as { value?: string } | undefined
    return row?.value === 'true'
  } catch {
    return false
  }
}

function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

function isMissionControlLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return isLoopbackUrl(value) && (url.port === '3337' || url.port === process.env.PORT)
  } catch {
    return false
  }
}

function missionControlLoopbackHeaders(url: string, base: Record<string, string>) {
  if (!isMissionControlLoopbackUrl(url)) return base
  const token = process.env.MISSION_CONTROL_API_KEY || process.env.MC_API_KEY || process.env.API_KEY
  if (!token) return base
  return {
    ...base,
    Authorization: `Bearer ${token}`,
    'X-Agent-Name': RON_WEASLEY_IDENTITY.short_name.toLowerCase(),
  }
}

async function fetchJson(url: string | undefined): Promise<{ ok: boolean; status: number | null; data: any }> {
  if (!url) return { ok: false, status: null, data: null }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: missionControlLoopbackHeaders(url, { Accept: 'application/json,text/plain,*/*' }),
      signal: controller.signal,
      cache: 'no-store',
    })
    const text = await response.text().catch(() => '')
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { reachable: response.ok, text: text.slice(0, 120) }
    }
    return { ok: response.ok, status: response.status, data }
  } catch {
    return { ok: false, status: null, data: null }
  } finally {
    clearTimeout(timeout)
  }
}

async function postJson(url: string | undefined, body: Record<string, unknown>): Promise<{ ok: boolean; status: number | null; data: any }> {
  if (!url) return { ok: false, status: null, data: null }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: missionControlLoopbackHeaders(url, { Accept: 'application/json', 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    })
    const text = await response.text().catch(() => '')
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { text: text.slice(0, 120) }
    }
    return { ok: response.ok, status: response.status, data }
  } catch {
    return { ok: false, status: null, data: null }
  } finally {
    clearTimeout(timeout)
  }
}

function extractVersion(data: any, keys: string[]): string | null {
  for (const key of keys) {
    const value = data?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function statusFromPayload(component: AgentUpdateComponent, probe: { ok: boolean; status: number | null; data: any }): AgentUpdateResult {
  const root = probe.data || {}
  const data = component.update_payload_key ? root[component.update_payload_key] || {} : root
  const updateAvailable = Boolean(
    data.updateAvailable ||
    data.update_available ||
    root.webui?.behind > 0 && component.update_payload_key === 'webui' ||
    root.agent?.behind > 0 && component.update_payload_key === 'agent' ||
    !component.update_payload_key && root.webui?.behind > 0 ||
    !component.update_payload_key && root.agent?.behind > 0 ||
    data.behind > 0,
  )
  const blocker = probe.ok
    ? null
    : component.status_url && !isLoopbackUrl(component.status_url) && component.id !== 'agent-zero-jarvis'
      ? 'status_url_not_loopback_or_certified_tailnet'
      : 'update_status_unreachable'

  return {
    ...component,
    state: blocker ? 'blocked' : updateAvailable ? 'updates_available' : 'current',
    update_available: updateAvailable,
    installed_version: extractVersion(data, ['currentVersion', 'current_version', 'installed', 'version']) || data.webui?.current || data.agent?.current || null,
    latest_version: extractVersion(data, ['latestVersion', 'latest_version', 'latest']) || data.webui?.latest || data.agent?.latest || null,
    release_url: extractVersion(data, ['releaseUrl', 'release_url', 'html_url', 'compare_url']) || data.webui?.compare_url || data.agent?.compare_url || null,
    blocker,
    action_taken: blocker ? 'blocked' : updateAvailable ? 'queued_visible_task' : 'checked',
    apply_target: component.apply_target || null,
    visible_task_id: null,
    opencloud_intermediary: false,
    secrets_exposed: false,
  }
}

function ensureVisibleUpdateTask(results: AgentUpdateResult[], mode: AgentUpdateMode): number | null {
  const actionable = results.filter((result) => result.update_available || result.blocker || result.action_taken === 'applied')
  if (actionable.length === 0) return null

  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)
    const existing = db.prepare(`
      SELECT id, metadata FROM tasks
      WHERE title = ? AND workspace_id = 1
      ORDER BY id DESC
      LIMIT 1
    `).get(TASK_TITLE) as { id: number; metadata?: string | null } | undefined

    const metadata = {
      auto_update_control_plane: true,
      mode,
      last_run_at: new Date(now * 1000).toISOString(),
      opencloud_intermediary: false,
      project_continues: true,
      actionable_component_count: actionable.length,
      components: results.map((result) => ({
        id: result.id,
        agent_id: result.agent_id,
        label: result.label,
        state: result.state,
        update_available: result.update_available,
        installed_version: result.installed_version,
        latest_version: result.latest_version,
        blocker: result.blocker,
        action_taken: result.action_taken,
        apply_target: result.apply_target,
        auto_apply_supported: result.auto_apply_supported,
        requires_owner_restart: result.requires_owner_restart,
        requires_sudo_or_polkit: result.requires_sudo_or_polkit,
        safe_policy: result.safe_policy,
        rollback: result.rollback,
      })),
      next_safe_action: 'Continue scheduled checks. Apply only exact scoped updates with rollback; create visible blocker tasks for sudo, credentials, public exposure, or uncertified agent runtimes.',
    }

    let taskId: number
    if (existing) {
      taskId = existing.id
      db.prepare('UPDATE tasks SET status = ?, priority = ?, metadata = ?, updated_at = ? WHERE id = ?')
        .run('quality_review', 'high', JSON.stringify(metadata), now, taskId)
    } else {
      const project = db.prepare(`
        SELECT id FROM projects
        WHERE workspace_id = 1 AND status = 'active'
        ORDER BY CASE WHEN slug = 'general' THEN 0 ELSE 1 END, id ASC
        LIMIT 1
      `).get() as { id: number } | undefined
      const projectId = project?.id || 1
      db.prepare('UPDATE projects SET ticket_counter = ticket_counter + 1, updated_at = ? WHERE id = ? AND workspace_id = 1')
        .run(now, projectId)
      const ticket = db.prepare('SELECT ticket_counter FROM projects WHERE id = ? AND workspace_id = 1')
        .get(projectId) as { ticket_counter?: number } | undefined
      const insert = db.prepare(`
        INSERT INTO tasks (
          title, description, status, priority, project_id, project_ticket_no, assigned_to, created_by,
          created_at, updated_at, tags, metadata, workspace_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        TASK_TITLE,
        `Automatic update monitoring for Mission Control, ${RON_WEASLEY_IDENTITY.full_title}, Jarvis/Agent Zero, SpaceAgent, Pi, Paperclip, and supporting runtimes. Production-impacting updates require exact scope, audit, and rollback.`,
        'quality_review',
        'high',
        projectId,
        ticket?.ticket_counter || null,
        'agent-zero-jarvis',
        'scheduler',
        now,
        now,
        JSON.stringify(['auto-updates', 'agent-hub', 'owner-visible-proof']),
        JSON.stringify(metadata),
        1,
      )
      taskId = Number(insert.lastInsertRowid)
    }

    db.prepare(`
      INSERT INTO comments (task_id, author, content, created_at, workspace_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      taskId,
      'scheduler',
      `Agent auto-update ${mode} run: ${actionable.length} component(s) need update or blocker review. No secrets exposed. OpenCloud intermediary false.`,
      now,
      1,
    )
    db_helpers.logActivity('agent_update_check', 'task', taskId, 'scheduler', `Agent update control plane refreshed ${actionable.length} component(s)`, metadata, 1)
    return taskId
  } catch (err) {
    logger.warn({ err }, 'Failed to create/update agent auto-update visible task')
    return null
  }
}

export async function runAgentUpdateCoordinator(
  mode: AgentUpdateMode = 'check',
  options: { visibleTask?: boolean } = {},
): Promise<AgentUpdateRun> {
  const autoApplyEnabled = isAutoApplyEnabled()
  const results: AgentUpdateResult[] = []

  for (const component of AGENT_UPDATE_COMPONENTS) {
    if (!component.auto_check_enabled) continue
    const probe = await fetchJson(component.status_url)
    const result = statusFromPayload(component, probe)
    if (mode === 'apply-safe' && result.update_available) {
      const canApply = autoApplyEnabled &&
        component.auto_apply_supported &&
        Boolean(component.apply_url) &&
        Boolean(component.apply_target) &&
        !component.requires_sudo_or_polkit &&
        !component.requires_owner_restart &&
        component.safe_policy.includes('exact')
      if (canApply && component.apply_target) {
        const apply = await postJson(component.apply_url, { target: component.apply_target })
        const payloadOk = apply.data?.ok !== false
        if (apply.ok && payloadOk) {
          result.action_taken = 'applied'
          result.blocker = null
          result.state = 'current'
          result.update_available = false
        } else {
          result.action_taken = 'blocked'
          result.blocker = apply.data?.message || apply.data?.error || 'auto_apply_failed'
          result.state = 'blocked'
        }
      } else {
        result.action_taken = 'blocked'
        result.blocker = 'auto_apply_not_enabled_or_not_exact_scope_certified'
        result.state = 'blocked'
      }
    }
    results.push(result)
  }

  const taskId = options.visibleTask === false ? null : ensureVisibleUpdateTask(results, mode)
  if (taskId) {
    for (const result of results) {
      if (result.update_available || result.blocker) result.visible_task_id = taskId
    }
  }

  const blockers = results
    .filter((result) => result.blocker)
    .map((result) => `${result.id}:${result.blocker}`)

  return {
    ok: blockers.length === 0,
    mode,
    route: '/api/bridge/agent-updates/status',
    timestamp: new Date().toISOString(),
    auto_apply_enabled: autoApplyEnabled,
    components: results,
    applied_count: results.filter((result) => result.action_taken === 'applied').length,
    queued_task_count: results.filter((result) => result.visible_task_id).length,
    blocker_count: blockers.length,
    status: blockers.length ? 'BLOCKED' : 'PASS',
    blockers,
    secrets_exposed: false,
    credential_values_exposed: false,
    public_exposure_created: false,
    opencloud_intermediary: false,
  }
}
