import { randomUUID } from 'node:crypto'

import { getDatabase, db_helpers } from '@/lib/db'
import { paperclipApiBaseUrl } from '@/lib/paperclip-eco-write-adapter'

export const PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID = 'paperclip_company_team_bootstrap'
export const PAPERCLIP_COMPANY_BOOTSTRAP_ACTION = 'paperclip.company.bootstrap'
export const PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION = 'paperclip.company.bootstrap_status'
export const PAPERCLIP_COMPANY_BOOTSTRAP_REQUEST_ACTION = 'paperclip.company.bootstrap_request'
export const PAPERCLIP_COMPANY_BOOTSTRAP_SESSION_SCOPE = 'paperclip_company_team_bootstrap'

export const PAPERCLIP_COMPANY_BOOTSTRAP_SCOPE = {
  system: 'paperclip',
  operation: 'company_team_bootstrap',
  company_name: 'Pacman Cybersecurity',
} as const

export const PAPERCLIP_COMPANY_BOOTSTRAP_BOARD_CREDENTIAL_NAMES = [
  'PAPERCLIP_BOARD_COMMAND_TOKEN',
  'PAPERCLIP_BOARD_API_KEY',
  'PAPERCLIP_ADMIN_API_KEY',
] as const

const COMPANY_NAME = 'Pacman Cybersecurity'
const COMPANY_TYPE = 'cybersecurity_security_operations'
const FIRST_EXECUTIVE_ROLE = 'Cybersecurity CEO'
const TEAM_ROLES = [
  'Cybersecurity CEO',
  'Security Architect',
  'SOC Analyst',
  'Compliance Officer',
  'Incident Response Lead',
  'Threat Intelligence Analyst',
  'Automation Engineer',
  'Security Content Strategist',
] as const

const INITIAL_MISSION = 'Build a cybersecurity company inside Paperclip that can plan security operations, manage security workflows, create tasks, track incidents, and coordinate with Mission Control.'

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

type PaperclipCompanyBootstrapScope = Record<string, unknown>

type PaperclipCompanyBootstrapInput = {
  action?: string
  scope?: PaperclipCompanyBootstrapScope
  input?: Record<string, unknown>
  idempotency_key?: string | null
  actor?: string | null
  boardToken?: string | null
  apiBaseUrl?: string | null
  fetchImpl?: FetchLike
  workspaceId?: number
  ownerVisibleTaskId?: number | null
  writeVisibleTask?: boolean
  credentialLookupDisabled?: boolean
}

export type PaperclipCompanyBootstrapPrepared =
  | {
      ok: true
      action: typeof PAPERCLIP_COMPANY_BOOTSTRAP_ACTION | typeof PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION | typeof PAPERCLIP_COMPANY_BOOTSTRAP_REQUEST_ACTION
      company_name: typeof COMPANY_NAME
      company_type: typeof COMPANY_TYPE
      first_executive_role: typeof FIRST_EXECUTIVE_ROLE
      team_roles: readonly string[]
      initial_mission: string
      idempotency_key: string
    }
  | {
      ok: false
      exact_blocker: string
    }

export type PaperclipCompanyBootstrapResult = {
  ok: boolean
  adapter_id: typeof PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID
  action: string
  scope: Record<string, unknown>
  exact_blocker: string | null
  native_company_create_api_present: boolean
  credential_names_checked: string[]
  credential_values_exposed: false
  execution_enabled: boolean
  writes_enabled: boolean
  external_writes_enabled: boolean
  paperclip_external_write_called: boolean
  paperclip_company_created_or_found: boolean
  paperclip_company_id_present: boolean
  paperclip_team_seed_attempted: boolean
  paperclip_agents_requested: number
  paperclip_project_created: boolean
  paperclip_issue_created: boolean
  paperclip_database_bypass_used: false
  tok_touched: false
  broad_paperclip_writes_enabled: false
  owner_visible_task: {
    attempted: boolean
    task_id: number | null
    status: 'created' | 'updated' | 'blocked' | 'skipped' | 'failed'
    progress: number
    blocker: string | null
  }
  rollback_strategy: 'official_archive_or_cancel_only' | 'none'
  rollback_steps: string[]
  proof: Record<string, unknown>
}

function cleanString(value: unknown, limit = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function cleanPositiveInt(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function normalizeScope(scope: unknown) {
  return scope && typeof scope === 'object' && !Array.isArray(scope) ? scope as Record<string, unknown> : {}
}

function scopeMatches(scope: Record<string, unknown>) {
  return (
    scope.system === PAPERCLIP_COMPANY_BOOTSTRAP_SCOPE.system &&
    scope.operation === PAPERCLIP_COMPANY_BOOTSTRAP_SCOPE.operation &&
    scope.company_name === PAPERCLIP_COMPANY_BOOTSTRAP_SCOPE.company_name
  )
}

export function preparePaperclipCompanyTeamBootstrap(input: PaperclipCompanyBootstrapInput): PaperclipCompanyBootstrapPrepared {
  const action = cleanString(input.action, 120)
  const scope = normalizeScope(input.scope)
  if (![PAPERCLIP_COMPANY_BOOTSTRAP_ACTION, PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION, PAPERCLIP_COMPANY_BOOTSTRAP_REQUEST_ACTION].includes(action)) {
    return { ok: false, exact_blocker: 'exact_action_required_paperclip_company_team_bootstrap' }
  }
  if (!scopeMatches(scope)) {
    return { ok: false, exact_blocker: 'exact_scope_required_paperclip_company_team_bootstrap' }
  }

  const inputObject = input.input && typeof input.input === 'object' && !Array.isArray(input.input) ? input.input : {}
  const requestedCompany = cleanString(inputObject.company_name, 120) || COMPANY_NAME
  if (requestedCompany !== COMPANY_NAME) {
    return { ok: false, exact_blocker: 'exact_company_required_pacman_cybersecurity' }
  }
  const serializedInput = JSON.stringify(inputObject)
  if (/\bTOK\b|TOK-/i.test(serializedInput)) {
    return { ok: false, exact_blocker: 'paperclip_tok_scope_forbidden' }
  }

  return {
    ok: true,
    action: action as PaperclipCompanyBootstrapPrepared extends { ok: true; action: infer A } ? A : never,
    company_name: COMPANY_NAME,
    company_type: COMPANY_TYPE,
    first_executive_role: FIRST_EXECUTIVE_ROLE,
    team_roles: TEAM_ROLES,
    initial_mission: INITIAL_MISSION,
    idempotency_key: cleanString(input.idempotency_key, 180) || `jarvis:paperclip-company-bootstrap:${randomUUID()}`,
  }
}

function envValue(name: string) {
  return (process.env[name] || '').trim()
}

function boardCredential(input: PaperclipCompanyBootstrapInput) {
  if (input.credentialLookupDisabled === true) return { value: '', source: null }
  const direct = cleanString(input.boardToken, 5000)
  if (direct) return { value: direct, source: 'input.boardToken' }
  for (const name of PAPERCLIP_COMPANY_BOOTSTRAP_BOARD_CREDENTIAL_NAMES) {
    const value = envValue(name)
    if (value) return { value, source: name }
  }
  return { value: '', source: null }
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text().catch(() => '')
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function arrayFromPayload(payload: Record<string, unknown> | null, key: string) {
  if (!payload) return []
  const value = payload[key]
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
  return []
}

function extractObject(payload: Record<string, unknown> | null, key: string) {
  const direct = payload?.[key]
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct as Record<string, unknown>
  return payload || {}
}

function objectId(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  return cleanString(row.id, 160) || cleanString(row.companyId, 160) || null
}

function statusBlocker(status: number, stage: string) {
  if (status === 401 || status === 403) return 'paperclip_board_admin_credential_required'
  if (status === 404) return 'paperclip_company_create_api_missing'
  return `paperclip_company_bootstrap_${stage}_failed_http_${status}`
}

function safeParseMetadata(raw: unknown) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function tableColumns(table: string) {
  try {
    const db = getDatabase()
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: string }>
    return new Set(rows.map((row) => row.name).filter((name): name is string => Boolean(name)))
  } catch {
    return new Set<string>()
  }
}

function recordVisibleTicket(input: {
  actor: string
  taskId?: number | null
  workspaceId: number
  progress: number
  status: 'in_progress' | 'awaiting_owner' | 'quality_review'
  blocker: string | null
  eventType: string
  summary: string
  idempotencyKey: string
}): PaperclipCompanyBootstrapResult['owner_visible_task'] {
  try {
    const db = getDatabase()
    const taskColumns = tableColumns('tasks')
    const now = Math.floor(Date.now() / 1000)
    const title = 'Paperclip Pacman Cybersecurity Bootstrap'
    const baseMetadata = {
      progress: input.progress,
      current_phase: input.summary,
      blocker: input.blocker,
      next_action: input.blocker ? 'Resolve exact Paperclip bootstrap blocker before repeating summary.' : 'Continue exact-scope Paperclip company/team bootstrap.',
      delivery_state: input.blocker ? 'BLOCKER_VISIBLE' : 'VISIBLE_PROGRESS_UPDATED',
      proof_visible_to_owner: true,
      paperclip_company_bootstrap: {
        adapter_id: PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID,
        company_name: COMPANY_NAME,
        company_type: COMPANY_TYPE,
        idempotency_key: input.idempotencyKey,
      },
    }
    let taskId = input.taskId || null
    let existingMetadata: Record<string, unknown> = {}
    if (!taskId) {
      const hasWorkspace = taskColumns.has('workspace_id')
      const existing = db.prepare(`
        SELECT id, metadata FROM tasks
        WHERE title = ? ${hasWorkspace ? 'AND workspace_id = ?' : ''}
        ORDER BY id DESC
        LIMIT 1
      `).get(...(hasWorkspace ? [title, input.workspaceId] : [title])) as { id?: number; metadata?: string } | undefined
      taskId = cleanPositiveInt(existing?.id)
      existingMetadata = safeParseMetadata(existing?.metadata)
    }
    const metadata = {
      ...existingMetadata,
      ...baseMetadata,
      paperclip_company_bootstrap: {
        ...(existingMetadata.paperclip_company_bootstrap && typeof existingMetadata.paperclip_company_bootstrap === 'object' ? existingMetadata.paperclip_company_bootstrap as Record<string, unknown> : {}),
        ...baseMetadata.paperclip_company_bootstrap,
      },
    }

    if (taskId) {
      const fields: string[] = []
      const params: unknown[] = []
      if (taskColumns.has('status')) {
        fields.push('status = ?')
        params.push(input.status)
      }
      if (taskColumns.has('error_message')) {
        fields.push('error_message = ?')
        params.push(input.blocker)
      }
      if (taskColumns.has('metadata')) {
        fields.push('metadata = ?')
        params.push(JSON.stringify(metadata))
      }
      if (taskColumns.has('updated_at')) {
        fields.push('updated_at = ?')
        params.push(now)
      }
      if (fields.length) {
        params.push(taskId)
        if (taskColumns.has('workspace_id')) params.push(input.workspaceId)
        db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ? ${taskColumns.has('workspace_id') ? 'AND workspace_id = ?' : ''}`).run(...params)
      }
    } else {
      const values: Record<string, unknown> = {
        title,
        description: 'Owner-visible Jarvis task for Paperclip Pacman Cybersecurity company/team bootstrap.',
        status: input.status,
        priority: 'high',
        assigned_to: 'agent-zero-jarvis',
        created_by: input.actor,
        created_at: now,
        updated_at: now,
        tags: JSON.stringify(['jarvis', 'paperclip', 'pacman-cybersecurity']),
        metadata: JSON.stringify(metadata),
        workspace_id: input.workspaceId,
        error_message: input.blocker,
        resolution: null,
      }
      const insertColumns = Object.keys(values).filter((key) => taskColumns.has(key))
      const placeholders = insertColumns.map(() => '?').join(', ')
      const result = db.prepare(`INSERT INTO tasks (${insertColumns.join(', ')}) VALUES (${placeholders})`)
        .run(...insertColumns.map((key) => values[key]))
      taskId = Number(result.lastInsertRowid)
    }

    db_helpers.logActivity(
      input.eventType,
      'task',
      taskId,
      input.actor,
      input.summary,
      {
        event_type: input.eventType,
        adapter_id: PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID,
        progress: input.progress,
        blocker: input.blocker,
        proof_link_or_id: input.idempotencyKey,
      },
      input.workspaceId,
    )

    return {
      attempted: true,
      task_id: taskId,
      status: input.blocker ? 'blocked' : input.taskId ? 'updated' : 'created',
      progress: input.progress,
      blocker: input.blocker,
    }
  } catch {
    return {
      attempted: true,
      task_id: input.taskId || null,
      status: 'failed',
      progress: input.progress,
      blocker: input.blocker || 'owner_visible_ticket_update_failed',
    }
  }
}

function skippedTask(progress: number, blocker: string | null): PaperclipCompanyBootstrapResult['owner_visible_task'] {
  return { attempted: false, task_id: null, status: 'skipped', progress, blocker }
}

function baseResult(input: {
  action: string
  scope: Record<string, unknown>
  exactBlocker: string | null
  ownerVisibleTask: PaperclipCompanyBootstrapResult['owner_visible_task']
  proof?: Record<string, unknown>
}): PaperclipCompanyBootstrapResult {
  return {
    ok: !input.exactBlocker,
    adapter_id: PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID,
    action: input.action || 'unknown',
    scope: input.scope,
    exact_blocker: input.exactBlocker,
    native_company_create_api_present: input.exactBlocker !== 'paperclip_company_create_api_missing',
    credential_names_checked: [...PAPERCLIP_COMPANY_BOOTSTRAP_BOARD_CREDENTIAL_NAMES],
    credential_values_exposed: false,
    execution_enabled: !input.exactBlocker,
    writes_enabled: !input.exactBlocker,
    external_writes_enabled: !input.exactBlocker,
    paperclip_external_write_called: false,
    paperclip_company_created_or_found: false,
    paperclip_company_id_present: false,
    paperclip_team_seed_attempted: false,
    paperclip_agents_requested: 0,
    paperclip_project_created: false,
    paperclip_issue_created: false,
    paperclip_database_bypass_used: false,
    tok_touched: false,
    broad_paperclip_writes_enabled: false,
    owner_visible_task: input.ownerVisibleTask,
    rollback_strategy: 'none',
    rollback_steps: [],
    proof: input.proof || {},
  }
}

async function postJson(fetcher: FetchLike, url: string, headers: Record<string, string>, body: Record<string, unknown>) {
  return fetcher(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  })
}

export async function executePaperclipCompanyTeamBootstrap(input: PaperclipCompanyBootstrapInput): Promise<PaperclipCompanyBootstrapResult> {
  const prepared = preparePaperclipCompanyTeamBootstrap(input)
  const action = cleanString(input.action, 120)
  const scope = normalizeScope(input.scope)
  const actor = cleanString(input.actor, 120) || 'agent-zero-jarvis'
  const workspaceId = input.workspaceId || 1
  const shouldWriteTicket = input.writeVisibleTask !== false

  if (!prepared.ok) {
    const ownerVisibleTask = shouldWriteTicket
      ? recordVisibleTicket({
          actor,
          taskId: cleanPositiveInt(input.ownerVisibleTaskId),
          workspaceId,
          progress: 0,
          status: 'awaiting_owner',
          blocker: prepared.exact_blocker,
          eventType: 'BLOCKER_FOUND',
          summary: `Paperclip company/team bootstrap blocked: ${prepared.exact_blocker}`,
          idempotencyKey: cleanString(input.idempotency_key, 180) || `jarvis:paperclip-company-bootstrap:${randomUUID()}`,
        })
      : skippedTask(0, prepared.exact_blocker)
    return baseResult({ action, scope, exactBlocker: prepared.exact_blocker, ownerVisibleTask })
  }

  const initialTicket = shouldWriteTicket
    ? recordVisibleTicket({
        actor,
        taskId: cleanPositiveInt(input.ownerVisibleTaskId),
        workspaceId,
        progress: 0,
        status: 'in_progress',
        blocker: null,
        eventType: 'COMMAND_SENT',
        summary: 'Jarvis started Paperclip Pacman Cybersecurity bootstrap through exact-scope adapter.',
        idempotencyKey: prepared.idempotency_key,
      })
    : skippedTask(0, null)

  const credential = boardCredential(input)
  if (!credential.value) {
    const task = shouldWriteTicket
      ? recordVisibleTicket({
          actor,
          taskId: initialTicket.task_id,
          workspaceId,
          progress: 20,
          status: 'awaiting_owner',
          blocker: 'paperclip_board_admin_credential_required',
          eventType: 'BLOCKER_FOUND',
          summary: 'Paperclip company/team bootstrap blocked: paperclip_board_admin_credential_required',
          idempotencyKey: prepared.idempotency_key,
        })
      : skippedTask(20, 'paperclip_board_admin_credential_required')
    return baseResult({
      action: prepared.action,
      scope,
      exactBlocker: 'paperclip_board_admin_credential_required',
      ownerVisibleTask: task,
      proof: {
        company_name: COMPANY_NAME,
        company_type: COMPANY_TYPE,
        board_credential_present: false,
        credential_names_checked: [...PAPERCLIP_COMPANY_BOOTSTRAP_BOARD_CREDENTIAL_NAMES],
        credential_values_exposed: false,
      },
    })
  }

  let apiBaseUrl: string
  try {
    apiBaseUrl = paperclipApiBaseUrl(input.apiBaseUrl)
  } catch {
    const task = shouldWriteTicket
      ? recordVisibleTicket({
          actor,
          taskId: initialTicket.task_id,
          workspaceId,
          progress: 20,
          status: 'awaiting_owner',
          blocker: 'paperclip_company_create_auth_path_missing',
          eventType: 'BLOCKER_FOUND',
          summary: 'Paperclip bootstrap blocked: Paperclip API base URL is not local, localhost, HTTPS, or Tailnet.',
          idempotencyKey: prepared.idempotency_key,
        })
      : skippedTask(20, 'paperclip_company_create_auth_path_missing')
    return baseResult({
      action: prepared.action,
      scope,
      exactBlocker: 'paperclip_company_create_auth_path_missing',
      ownerVisibleTask: task,
    })
  }

  const fetcher = input.fetchImpl || fetch
  const headers = {
    Authorization: `Bearer ${credential.value}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': prepared.idempotency_key,
  }

  const routeProbeTask = shouldWriteTicket
    ? recordVisibleTicket({
        actor,
        taskId: initialTicket.task_id,
        workspaceId,
        progress: 20,
        status: 'in_progress',
        blocker: null,
        eventType: 'ROUTE_PROBED',
        summary: 'Paperclip native company/team API routes are being probed through brokered board/admin auth.',
        idempotencyKey: prepared.idempotency_key,
      })
    : initialTicket

  const companiesUrl = `${apiBaseUrl}/companies`
  const companiesResponse = await fetcher(companiesUrl, { headers, cache: 'no-store' })
  if (!companiesResponse.ok) {
    const exactBlocker = statusBlocker(companiesResponse.status, 'company_list')
    const task = shouldWriteTicket
      ? recordVisibleTicket({
          actor,
          taskId: routeProbeTask.task_id,
          workspaceId,
          progress: 20,
          status: 'awaiting_owner',
          blocker: exactBlocker,
          eventType: 'BLOCKER_FOUND',
          summary: `Paperclip company list/create route probe blocked: ${exactBlocker}`,
          idempotencyKey: prepared.idempotency_key,
        })
      : skippedTask(20, exactBlocker)
    return baseResult({ action: prepared.action, scope, exactBlocker, ownerVisibleTask: task })
  }

  if (prepared.action === PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION || prepared.action === PAPERCLIP_COMPANY_BOOTSTRAP_REQUEST_ACTION) {
    const task = shouldWriteTicket
      ? recordVisibleTicket({
          actor,
          taskId: routeProbeTask.task_id,
          workspaceId,
          progress: prepared.action === PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION ? 20 : 40,
          status: prepared.action === PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION ? 'in_progress' : 'awaiting_owner',
          blocker: prepared.action === PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION ? null : 'paperclip_company_bootstrap_request_created',
          eventType: prepared.action === PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION ? 'ROUTE_PROBED' : 'PROOF_CAPTURED',
          summary: prepared.action === PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION
            ? 'Paperclip bootstrap status route proved the native company list API is reachable.'
            : 'Paperclip bootstrap request captured for implementation tracking; no Paperclip write executed.',
          idempotencyKey: prepared.idempotency_key,
        })
      : skippedTask(20, null)
    return {
      ...baseResult({
        action: prepared.action,
        scope,
        exactBlocker: prepared.action === PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION ? null : 'paperclip_company_bootstrap_request_created',
        ownerVisibleTask: task,
      }),
      ok: prepared.action === PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION,
      execution_enabled: prepared.action === PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION,
      writes_enabled: false,
      external_writes_enabled: false,
      proof: {
        company_name: COMPANY_NAME,
        status_probe_ran: true,
        paperclip_external_write_called: false,
      },
    }
  }

  const companyRows = arrayFromPayload(await readJson(companiesResponse), 'companies')
  let company = companyRows.find((row) => cleanString(row.name, 160) === COMPANY_NAME) || null
  let companyCreated = false

  if (!company) {
    const companyResponse = await postJson(fetcher, companiesUrl, headers, {
      name: COMPANY_NAME,
      description: `${COMPANY_NAME} - ${INITIAL_MISSION}`,
      budgetMonthlyCents: 0,
    })
    if (!companyResponse.ok) {
      const exactBlocker = statusBlocker(companyResponse.status, 'company_create')
      const task = shouldWriteTicket
        ? recordVisibleTicket({
            actor,
            taskId: routeProbeTask.task_id,
            workspaceId,
            progress: 40,
            status: 'awaiting_owner',
            blocker: exactBlocker,
            eventType: 'BLOCKER_FOUND',
            summary: `Paperclip company creation blocked: ${exactBlocker}`,
            idempotencyKey: prepared.idempotency_key,
          })
        : skippedTask(40, exactBlocker)
      return baseResult({ action: prepared.action, scope, exactBlocker, ownerVisibleTask: task })
    }
    company = extractObject(await readJson(companyResponse), 'company')
    companyCreated = true
  }

  const companyId = objectId(company)
  if (!companyId) {
    const task = shouldWriteTicket
      ? recordVisibleTicket({
          actor,
          taskId: routeProbeTask.task_id,
          workspaceId,
          progress: 40,
          status: 'awaiting_owner',
          blocker: 'paperclip_company_id_missing_after_create',
          eventType: 'BLOCKER_FOUND',
          summary: 'Paperclip company bootstrap blocked: created/found company did not return an id.',
          idempotencyKey: prepared.idempotency_key,
        })
      : skippedTask(40, 'paperclip_company_id_missing_after_create')
    return baseResult({ action: prepared.action, scope, exactBlocker: 'paperclip_company_id_missing_after_create', ownerVisibleTask: task })
  }

  const hireIds: string[] = []
  for (const role of TEAM_ROLES) {
    const hireResponse = await postJson(fetcher, `${apiBaseUrl}/companies/${encodeURIComponent(companyId)}/agent-hires`, headers, {
      name: role,
      role,
      title: role,
      adapterType: 'mission_control_bridge',
      description: `${role} for ${COMPANY_NAME}. ${INITIAL_MISSION}`,
      heartbeatEnabled: false,
      requestedBy: 'agent-zero-jarvis',
      companyType: COMPANY_TYPE,
    })
    if (!hireResponse.ok) {
      const exactBlocker = statusBlocker(hireResponse.status, 'agent_hire')
      const task = shouldWriteTicket
        ? recordVisibleTicket({
            actor,
            taskId: routeProbeTask.task_id,
            workspaceId,
            progress: 60,
            status: 'awaiting_owner',
            blocker: exactBlocker,
            eventType: 'BLOCKER_FOUND',
            summary: `Paperclip agent hire request blocked for ${role}: ${exactBlocker}`,
            idempotencyKey: prepared.idempotency_key,
          })
        : skippedTask(60, exactBlocker)
      return {
        ...baseResult({ action: prepared.action, scope, exactBlocker, ownerVisibleTask: task }),
        paperclip_external_write_called: companyCreated,
        paperclip_company_created_or_found: true,
        paperclip_company_id_present: true,
        rollback_strategy: 'official_archive_or_cancel_only',
        rollback_steps: [
          `Archive Paperclip company ${companyId} through official Paperclip company archive route if company was created by this adapter.`,
          'Cancel/reject any pending Paperclip agent-hire approvals created by this adapter.',
        ],
      }
    }
    const hirePayload = await readJson(hireResponse)
    hireIds.push(cleanString(objectId(extractObject(hirePayload, 'agent')) || objectId(extractObject(hirePayload, 'approval')) || `role:${role}`, 180))
  }

  const projectResponse = await postJson(fetcher, `${apiBaseUrl}/companies/${encodeURIComponent(companyId)}/projects`, headers, {
    name: 'Pacman Cybersecurity Operating System',
    description: INITIAL_MISSION,
    status: 'active',
  })
  if (!projectResponse.ok) {
    const exactBlocker = statusBlocker(projectResponse.status, 'project_create')
    const task = shouldWriteTicket
      ? recordVisibleTicket({
          actor,
          taskId: routeProbeTask.task_id,
          workspaceId,
          progress: 75,
          status: 'awaiting_owner',
          blocker: exactBlocker,
          eventType: 'BLOCKER_FOUND',
          summary: `Paperclip initial project creation blocked: ${exactBlocker}`,
          idempotencyKey: prepared.idempotency_key,
        })
      : skippedTask(75, exactBlocker)
    return {
      ...baseResult({ action: prepared.action, scope, exactBlocker, ownerVisibleTask: task }),
      paperclip_external_write_called: true,
      paperclip_company_created_or_found: true,
      paperclip_company_id_present: true,
      paperclip_team_seed_attempted: true,
      paperclip_agents_requested: hireIds.length,
      rollback_strategy: 'official_archive_or_cancel_only',
    }
  }
  const projectId = objectId(extractObject(await readJson(projectResponse), 'project'))

  const issueResponse = await postJson(fetcher, `${apiBaseUrl}/companies/${encodeURIComponent(companyId)}/issues`, headers, {
    title: 'Create Pacman Cybersecurity operating charter',
    description: `${INITIAL_MISSION}\n\nInitial executive: ${FIRST_EXECUTIVE_ROLE}\nInitial team: ${TEAM_ROLES.join(', ')}`,
    priority: 'high',
    projectId,
    source: 'mission_control_jarvis_bootstrap',
  })
  if (!issueResponse.ok) {
    const exactBlocker = statusBlocker(issueResponse.status, 'issue_create')
    const task = shouldWriteTicket
      ? recordVisibleTicket({
          actor,
          taskId: routeProbeTask.task_id,
          workspaceId,
          progress: 75,
          status: 'awaiting_owner',
          blocker: exactBlocker,
          eventType: 'BLOCKER_FOUND',
          summary: `Paperclip initial issue creation blocked: ${exactBlocker}`,
          idempotencyKey: prepared.idempotency_key,
        })
      : skippedTask(75, exactBlocker)
    return {
      ...baseResult({ action: prepared.action, scope, exactBlocker, ownerVisibleTask: task }),
      paperclip_external_write_called: true,
      paperclip_company_created_or_found: true,
      paperclip_company_id_present: true,
      paperclip_team_seed_attempted: true,
      paperclip_agents_requested: hireIds.length,
      paperclip_project_created: true,
      rollback_strategy: 'official_archive_or_cancel_only',
    }
  }
  const issueId = objectId(extractObject(await readJson(issueResponse), 'issue'))

  const finalTask = shouldWriteTicket
    ? recordVisibleTicket({
        actor,
        taskId: routeProbeTask.task_id,
        workspaceId,
        progress: 100,
        status: 'quality_review',
        blocker: null,
        eventType: 'PROOF_CAPTURED',
        summary: 'Paperclip Pacman Cybersecurity bootstrap proof captured. Awaiting quality review before done.',
        idempotencyKey: prepared.idempotency_key,
      })
    : skippedTask(100, null)

  return {
    ok: true,
    adapter_id: PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID,
    action: prepared.action,
    scope,
    exact_blocker: null,
    native_company_create_api_present: true,
    credential_names_checked: [...PAPERCLIP_COMPANY_BOOTSTRAP_BOARD_CREDENTIAL_NAMES],
    credential_values_exposed: false,
    execution_enabled: true,
    writes_enabled: true,
    external_writes_enabled: true,
    paperclip_external_write_called: true,
    paperclip_company_created_or_found: true,
    paperclip_company_id_present: true,
    paperclip_team_seed_attempted: true,
    paperclip_agents_requested: hireIds.length,
    paperclip_project_created: true,
    paperclip_issue_created: true,
    paperclip_database_bypass_used: false,
    tok_touched: false,
    broad_paperclip_writes_enabled: false,
    owner_visible_task: finalTask,
    rollback_strategy: 'official_archive_or_cancel_only',
    rollback_steps: [
      `Archive Paperclip company ${companyId} through the official Paperclip company archive route if this adapter created it.`,
      'Cancel/reject only the exact pending agent-hire approvals created by this adapter.',
      'Archive or close only the exact initial project and issue created by this adapter if Paperclip exposes rollback-safe routes.',
      'Do not edit the Paperclip database directly and do not touch TOK.',
    ],
    proof: {
      company_name: COMPANY_NAME,
      company_type: COMPANY_TYPE,
      company_id_present: true,
      company_created: companyCreated,
      agent_hire_requests_created: hireIds.length,
      project_id_present: Boolean(projectId),
      issue_id_present: Boolean(issueId),
      owner_visible_task_id: finalTask.task_id,
      credential_source_name: credential.source === 'input.boardToken' ? 'injected_runtime_input' : credential.source,
      credential_values_exposed: false,
    },
  }
}
