import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { getDatabase } from '@/lib/db'

export const AGENT_ZERO_BRIDGE_SESSION_CONNECTOR = 'agent_zero'
export const AGENT_ZERO_BRIDGE_SESSION_ACTION = 'agent_zero.bridge_session.open'
export const AGENT_ZERO_BRIDGE_SESSION_TARGET = 'bridge_session'
export const AGENT_ZERO_BRIDGE_SESSION_TARGET_KEY = 'agent_zero:bridge_session:mission'
export const AGENT_ZERO_BRIDGE_SESSION_DURATION_HOURS = 12
export const AGENT_ZERO_BRIDGE_SESSION_RISK_LEVEL = 'medium'
export const AGENT_ZERO_BRIDGE_SESSION_CATEGORY = 'agent_execution'

export const AGENT_ZERO_BRIDGE_SESSION_OWNER_PROMPT = [
  'Approval needed: Open Agent Zero Bridge Session.',
  'Scope: Agent Zero may use all registered tools, skills, models, integrations, Brain adapters, Build-Wiki actions, and delivery surfaces available in this environment for this mission. Hermes may assist as lieutenant for planning, design, recommendations, and explicitly allowed registered adapters only.',
  'Duration: 12 hours.',
  'Rule: Every Agent Zero and Hermes action is audited. Agent Zero remains commander and approves/delegates Hermes actions. Neither agent may fake completion, request repeated approvals, use raw root shell, use the Docker socket, or read secrets directly.',
  'Approve or deny?',
].join('\n')

export type AgentZeroBridgeSessionState = 'not_requested' | 'pending_approval' | 'active' | 'denied' | 'expired' | 'revoked' | 'blocked'

export type AgentZeroBridgeSessionAuditEntry = {
  id: string
  session_id: string
  approval_request_id: string | null
  actor: string
  actor_user_id: number | null
  action: string
  target: string | null
  outcome: string
  metadata: Record<string, unknown>
  created_at: string
}

export type AgentZeroBridgeSessionObject = {
  session_id: string | null
  owner_id: number | null
  agent_id: 'agent_zero'
  participants: Array<{
    agent_id: 'agent_zero' | 'hermes'
    role: 'commander' | 'lieutenant_skill_workflow_specialist'
    authority: string
    planning_enabled: boolean
    execution_enabled: boolean
    execution_requires_explicit_scope: boolean
  }>
  agent_zero_authority: {
    commander: true
    approves_and_delegates_hermes_actions: true
    final_owner_facing_responsibility: true
  }
  hermes_permissions: {
    role: 'lieutenant_skill_workflow_specialist'
    default_allowed_actions: string[]
    explicit_execution_actions: string[]
    execution_enabled: boolean
    execution_requires_agent_zero_delegation: true
    execution_requires_explicit_session_scope: true
    external_email_requires_domain_allow_list: true
    blocked_actions: string[]
  }
  started_at: string | null
  expires_at: string | null
  scope: string
  allowed_tools: string[]
  allowed_integrations: string[]
  allowed_models: string[]
  allowed_skills: string[]
  allowed_brain_access: string[]
  allowed_delivery_surfaces: string[]
  blocked_scopes: string[]
  safety_contract: {
    one_bridge_session_approval_model: true
    no_approval_spam: true
    every_action_audited: true
    every_agent_zero_and_hermes_action_audited: true
    no_fake_completion: true
    raw_root_shell_enabled: false
    docker_socket_enabled: false
    direct_secret_reads_enabled: false
    raw_arbitrary_filesystem_enabled: false
  }
  audit_log: AgentZeroBridgeSessionAuditEntry[]
  execution_enabled: boolean
  bridge_session_required: boolean
  status: AgentZeroBridgeSessionState
  approval_request_id: string | null
  approval_state: string | null
  approval_prompt: string
  duplicate_prompt_prevented: boolean
  no_approval_spam: true
  blocked_reason: string | null
  note: string
}

type ApprovalRow = {
  id: string
  approval_state: string
  expires_at: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

type SessionRow = {
  id: string
  workspace_id: number
  tenant_id: number
  approval_request_id: string
  owner_id: number | null
  agent_id: string
  session_state: string
  started_at: string | null
  expires_at: string | null
  scope_json: string
  allowed_tools_json: string
  allowed_integrations_json: string
  allowed_models_json: string
  allowed_brain_access_json: string
  execution_enabled: number
  correlation_id: string
  created_at: string
  updated_at: string
}

export type AgentZeroBridgeSessionRead = {
  persistence_ready: boolean
  session: AgentZeroBridgeSessionObject
}

export type AgentZeroBridgeSessionCreateResult = AgentZeroBridgeSessionRead & {
  ok: boolean
  approval_request_created: boolean
  reused_existing: boolean
  http_status: number
  next_action: string
}

export type AgentZeroBridgeSessionAuditResult = {
  ok: boolean
  http_status: number
  audit_event: AgentZeroBridgeSessionAuditEntry | null
  session: AgentZeroBridgeSessionObject
  execution_enabled: boolean
  blocked_reason: string | null
}

export type AgentZeroBridgeSessionRequester = {
  userId: number | null
  username: string
  workspaceId: number
  tenantId: number
}

export type BridgeSessionAgentId = 'agent_zero' | 'hermes'

export type HermesBridgeSessionActionKind =
  | 'plan'
  | 'design'
  | 'suggest'
  | 'draft_report'
  | 'draft_skill_spec'
  | 'obsidian_write'
  | 'mempalace_write'
  | 'buildwiki_suggest'
  | 'buildwiki_execute'
  | 'external_email_send'
  | 'registered_adapter_execute'
  | 'raw_shell'
  | 'docker_socket'
  | 'secret_read'

export type HermesBridgeSessionActionReadiness = {
  ok: boolean
  agent_id: 'hermes'
  action: HermesBridgeSessionActionKind
  execution_enabled: boolean
  allowed: boolean
  delegated_by_agent_zero: boolean
  bridge_session_active: boolean
  registered_adapter_required: true
  connector_configured: boolean | null
  domain_allowed: boolean | null
  blocked_reason: string | null
  normal_reply: string
  audit_required: true
}

const DEFAULT_SCOPE = 'Agent Zero may use all registered Mission Control / Bridge tools, skills, models, agents, integrations, Brain adapters, Build-Wiki actions, and delivery surfaces available in this environment for this mission. Hermes participates as lieutenant for planning/design/recommendations by default and may execute only explicitly allowed registered adapters delegated by Agent Zero.'
const DEFAULT_ALLOWED_TOOLS = [
  'all_registered_tools',
  'all_registered_execution_adapters',
  'mission_control.status',
  'bridge.providers.list',
  'mcp.tools.schema_read',
  'mcp.tool.execute',
  'agent_zero.reports.create',
  'buildwiki.run_now',
  'google_drive.delivery_adapter_if_configured',
  'onedrive.delivery_adapter_if_configured',
]
const DEFAULT_ALLOWED_INTEGRATIONS = [
  'all_registered_integrations',
  'mission_control',
  'bridge',
  'mcp',
  'zapier_schema_read_only',
  'google_drive_if_connector_configured',
  'onedrive_if_connector_configured',
  'agentmail_if_configured',
  'build_wiki_farmer_scoped',
  'telegram_status_delivery_if_route_configured',
]
const DEFAULT_ALLOWED_MODELS = ['openrouter_if_configured', 'openai_if_configured', 'anthropic_if_configured', 'gemini_if_configured', 'groq_if_configured', 'local_models_if_configured']
const DEFAULT_ALLOWED_SKILLS = ['all_registered_skills', 'openclaw_plus_shared_runtime', 'agent_zero_skills', 'hermes_skills', 'mission_control_repo_skills']
const DEFAULT_ALLOWED_BRAIN_ACCESS = ['all_registered_brain_adapters', 'brain_sync.status', 'obsidian.read_adapter', 'obsidian.write_adapter', 'mempalace.read_adapter', 'mempalace.write_adapter', 'graphify.status', 'brain_watchers.status']
const DEFAULT_ALLOWED_DELIVERY_SURFACES = ['all_registered_delivery_surfaces', 'mission_control.report.attach', 'telegram.delivery_if_route_configured', 'agentmail_if_connector_configured', 'google_drive_if_connector_configured', 'onedrive_if_connector_configured']
const HERMES_DEFAULT_ALLOWED_ACTIONS = [
  'hermes.plan',
  'hermes.design',
  'hermes.suggest',
  'hermes.workflow_plan',
  'hermes.integration_mapping',
  'hermes.failure_analysis',
  'hermes.docs_report_outline',
]
const HERMES_EXPLICIT_EXECUTION_ACTIONS = [
  'hermes.report.draft',
  'hermes.skill_spec.draft',
  'hermes.obsidian.write_via_adapter',
  'hermes.mempalace.write_via_adapter',
  'hermes.registered_adapter.execute_if_scoped',
]
const HERMES_BLOCKED_ACTIONS = [
  'hermes.raw_shell',
  'hermes.root_access',
  'hermes.docker_socket',
  'hermes.direct_secret_read',
  'hermes.external_email_without_allow_list',
  'hermes.buildwiki_direct_execution',
  'hermes.unregistered_adapter',
]
const BLOCKED_SCOPES = ['broad_shell', 'docker_socket', 'root_system_access', 'credential_exfiltration', 'auth_bypass', 'smb_mount_without_separate_smb_phase', 'memory_write_without_explicit_owner_scope', 'hermes_direct_buildwiki_execution', 'hermes_external_email_without_domain_allow_list', 'hermes_unregistered_adapter_execution']

function defaultSafetyContract(): AgentZeroBridgeSessionObject['safety_contract'] {
  return {
    one_bridge_session_approval_model: true,
    no_approval_spam: true,
    every_action_audited: true,
    every_agent_zero_and_hermes_action_audited: true,
    no_fake_completion: true,
    raw_root_shell_enabled: false,
    docker_socket_enabled: false,
    direct_secret_reads_enabled: false,
    raw_arbitrary_filesystem_enabled: false,
  }
}

function defaultParticipants(executionEnabled = false): AgentZeroBridgeSessionObject['participants'] {
  return [
    {
      agent_id: 'agent_zero',
      role: 'commander',
      authority: 'Agent Zero remains commander and approves/delegates Hermes actions within the owner-approved Bridge Session.',
      planning_enabled: true,
      execution_enabled: executionEnabled,
      execution_requires_explicit_scope: true,
    },
    {
      agent_id: 'hermes',
      role: 'lieutenant_skill_workflow_specialist',
      authority: 'Hermes assists Agent Zero with planning, skill design, workflows, automation plans, failure analysis, report drafts, and explicitly scoped registered adapters only.',
      planning_enabled: true,
      execution_enabled: executionEnabled,
      execution_requires_explicit_scope: true,
    },
  ]
}

function defaultAgentZeroAuthority(): AgentZeroBridgeSessionObject['agent_zero_authority'] {
  return {
    commander: true,
    approves_and_delegates_hermes_actions: true,
    final_owner_facing_responsibility: true,
  }
}

function defaultHermesPermissions(executionEnabled = false): AgentZeroBridgeSessionObject['hermes_permissions'] {
  return {
    role: 'lieutenant_skill_workflow_specialist',
    default_allowed_actions: HERMES_DEFAULT_ALLOWED_ACTIONS,
    explicit_execution_actions: HERMES_EXPLICIT_EXECUTION_ACTIONS,
    execution_enabled: executionEnabled,
    execution_requires_agent_zero_delegation: true,
    execution_requires_explicit_session_scope: true,
    external_email_requires_domain_allow_list: true,
    blocked_actions: HERMES_BLOCKED_ACTIONS,
  }
}

function isoNow(now = new Date()): string {
  return now.toISOString()
}

function isoPlusHours(hours: number, now = new Date()): string {
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString()
}

function parseTime(value: string | null): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function stableJson(value: unknown): string {
  if (!value || typeof value !== 'object') return '{}'
  const normalize = (nested: unknown): unknown => {
    if (Array.isArray(nested)) return nested.map(normalize)
    if (!nested || typeof nested !== 'object') return nested
    return Object.keys(nested as Record<string, unknown>).sort().reduce((acc, key) => {
      acc[key] = normalize((nested as Record<string, unknown>)[key])
      return acc
    }, {} as Record<string, unknown>)
  }
  return JSON.stringify(normalize(value))
}

function jsonArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map((item) => String(item)).filter(Boolean)
    } catch {
      return fallback
    }
  }
  return fallback
}

function jsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").get(name) as { name?: string } | undefined
  return row?.name === name
}

export function ensureAgentZeroBridgeSessionTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bridge_sessions (
      id TEXT PRIMARY KEY,
      workspace_id INTEGER NOT NULL DEFAULT 1,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      approval_request_id TEXT NOT NULL UNIQUE,
      owner_id INTEGER,
      agent_id TEXT NOT NULL,
      session_state TEXT NOT NULL CHECK (session_state IN ('pending_approval', 'active', 'denied', 'expired', 'revoked')),
      started_at TEXT,
      expires_at TEXT NOT NULL,
      scope_json TEXT NOT NULL DEFAULT '{}',
      allowed_tools_json TEXT NOT NULL DEFAULT '[]',
      allowed_integrations_json TEXT NOT NULL DEFAULT '[]',
      allowed_models_json TEXT NOT NULL DEFAULT '[]',
      allowed_brain_access_json TEXT NOT NULL DEFAULT '[]',
      execution_enabled INTEGER NOT NULL DEFAULT 0 CHECK (execution_enabled IN (0, 1)),
      correlation_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS bridge_session_audit_events (
      id TEXT PRIMARY KEY,
      workspace_id INTEGER NOT NULL DEFAULT 1,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      session_id TEXT NOT NULL,
      approval_request_id TEXT,
      actor TEXT NOT NULL,
      actor_user_id INTEGER,
      agent_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      outcome TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (session_id) REFERENCES bridge_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bridge_sessions_agent_state ON bridge_sessions(workspace_id, tenant_id, agent_id, session_state, expires_at);
    CREATE INDEX IF NOT EXISTS idx_bridge_sessions_approval ON bridge_sessions(approval_request_id);
    CREATE INDEX IF NOT EXISTS idx_bridge_session_audit_session ON bridge_session_audit_events(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_bridge_session_audit_action ON bridge_session_audit_events(action, created_at);
  `)
}

export function agentZeroBridgeSessionPersistenceReady(db: Database.Database): boolean {
  return tableExists(db, 'bridge_approval_requests') && tableExists(db, 'bridge_audit_events') && tableExists(db, 'bridge_sessions') && tableExists(db, 'bridge_session_audit_events')
}

export function defaultAgentZeroBridgeSessionObject(input: Partial<AgentZeroBridgeSessionObject> = {}): AgentZeroBridgeSessionObject {
  return {
    session_id: input.session_id || null,
    owner_id: typeof input.owner_id === 'number' ? input.owner_id : null,
    agent_id: 'agent_zero',
    participants: input.participants || defaultParticipants(Boolean(input.execution_enabled)),
    agent_zero_authority: input.agent_zero_authority || defaultAgentZeroAuthority(),
    hermes_permissions: input.hermes_permissions || defaultHermesPermissions(Boolean(input.execution_enabled)),
    started_at: input.started_at || null,
    expires_at: input.expires_at || null,
    scope: input.scope || DEFAULT_SCOPE,
    allowed_tools: input.allowed_tools || DEFAULT_ALLOWED_TOOLS,
    allowed_integrations: input.allowed_integrations || DEFAULT_ALLOWED_INTEGRATIONS,
    allowed_models: input.allowed_models || DEFAULT_ALLOWED_MODELS,
    allowed_skills: input.allowed_skills || DEFAULT_ALLOWED_SKILLS,
    allowed_brain_access: input.allowed_brain_access || DEFAULT_ALLOWED_BRAIN_ACCESS,
    allowed_delivery_surfaces: input.allowed_delivery_surfaces || DEFAULT_ALLOWED_DELIVERY_SURFACES,
    blocked_scopes: input.blocked_scopes || BLOCKED_SCOPES,
    safety_contract: input.safety_contract || defaultSafetyContract(),
    audit_log: input.audit_log || [],
    execution_enabled: Boolean(input.execution_enabled),
    bridge_session_required: true,
    status: input.status || 'not_requested',
    approval_request_id: input.approval_request_id || null,
    approval_state: input.approval_state || null,
    approval_prompt: AGENT_ZERO_BRIDGE_SESSION_OWNER_PROMPT,
    duplicate_prompt_prevented: Boolean(input.duplicate_prompt_prevented),
    no_approval_spam: true,
    blocked_reason: input.blocked_reason || null,
    note: input.note || 'Agent Zero needs one owner-approved Bridge Session before scoped execution can run. Hermes may plan/design/suggest by default and execute only explicitly scoped registered adapters delegated by Agent Zero.',
  }
}

function readAuditLog(db: Database.Database, sessionId: string): AgentZeroBridgeSessionAuditEntry[] {
  const rows = db.prepare(`
    SELECT id, session_id, approval_request_id, actor, actor_user_id, action, target, outcome, metadata_json, created_at
    FROM bridge_session_audit_events
    WHERE session_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(sessionId) as Array<Omit<AgentZeroBridgeSessionAuditEntry, 'metadata'> & { metadata_json: string }>
  return rows.map((row) => ({
    id: row.id,
    session_id: row.session_id,
    approval_request_id: row.approval_request_id,
    actor: row.actor,
    actor_user_id: row.actor_user_id,
    action: row.action,
    target: row.target,
    outcome: row.outcome,
    metadata: jsonObject(row.metadata_json),
    created_at: row.created_at,
  }))
}

function readApproval(db: Database.Database, approvalId: string): ApprovalRow | null {
  const row = db.prepare(`
    SELECT id, approval_state, expires_at, resolved_at, resolved_by, created_at
    FROM bridge_approval_requests
    WHERE id = ?
    LIMIT 1
  `).get(approvalId) as ApprovalRow | undefined
  return row || null
}

function deriveState(session: SessionRow, approval: ApprovalRow | null, now = new Date()): AgentZeroBridgeSessionState {
  const expiresAtMs = parseTime(session.expires_at)
  if (expiresAtMs && expiresAtMs <= now.getTime()) return 'expired'
  if (!approval) return 'blocked'
  if (approval.approval_state === 'denied') return 'denied'
  if (approval.approval_state === 'revoked') return 'revoked'
  if (approval.approval_state === 'expired') return 'expired'
  if (approval.approval_state === 'approved') return 'active'
  return 'pending_approval'
}

function sessionObjectFromRow(db: Database.Database, session: SessionRow, approval: ApprovalRow | null, now = new Date()): AgentZeroBridgeSessionObject {
  const state = deriveState(session, approval, now)
  const executionEnabled = state === 'active'
  const scope = jsonObject(session.scope_json)
  return defaultAgentZeroBridgeSessionObject({
    session_id: session.id,
    owner_id: session.owner_id,
    started_at: executionEnabled ? (session.started_at || approval?.resolved_at || session.created_at) : session.started_at,
    expires_at: session.expires_at,
    scope: String(scope.scope || DEFAULT_SCOPE),
    allowed_tools: jsonArray(session.allowed_tools_json, DEFAULT_ALLOWED_TOOLS),
    allowed_integrations: jsonArray(session.allowed_integrations_json, DEFAULT_ALLOWED_INTEGRATIONS),
    allowed_models: jsonArray(session.allowed_models_json, DEFAULT_ALLOWED_MODELS),
    allowed_skills: jsonArray(scope.allowed_skills, DEFAULT_ALLOWED_SKILLS),
    allowed_brain_access: jsonArray(session.allowed_brain_access_json, DEFAULT_ALLOWED_BRAIN_ACCESS),
    allowed_delivery_surfaces: jsonArray(scope.allowed_delivery_surfaces, DEFAULT_ALLOWED_DELIVERY_SURFACES),
    blocked_scopes: jsonArray(scope.blocked_scopes, BLOCKED_SCOPES),
    safety_contract: defaultSafetyContract(),
    audit_log: readAuditLog(db, session.id),
    execution_enabled: executionEnabled,
    participants: defaultParticipants(executionEnabled),
    agent_zero_authority: defaultAgentZeroAuthority(),
    hermes_permissions: defaultHermesPermissions(executionEnabled),
    status: state,
    approval_request_id: session.approval_request_id,
    approval_state: approval?.approval_state || null,
    duplicate_prompt_prevented: state === 'pending_approval' || state === 'active',
    blocked_reason: state === 'blocked' ? 'bridge_session_approval_row_missing' : state === 'pending_approval' ? 'owner_approval_pending' : state === 'expired' ? 'bridge_session_expired' : state === 'denied' ? 'owner_denied_bridge_session' : state === 'revoked' ? 'bridge_session_revoked' : null,
    note: executionEnabled
      ? 'Agent Zero has a time-limited Bridge Session. Actions must remain inside allowed scope and must be audited.'
      : 'One owner approval opens the Agent Zero Bridge Session. Do not create duplicate prompts for the same pending session.',
  })
}

function syncSessionState(db: Database.Database, session: SessionRow, approval: ApprovalRow | null, now = new Date()): SessionRow {
  const state = deriveState(session, approval, now)
  const nextState = state === 'blocked' || state === 'not_requested' ? session.session_state : state
  const executionEnabled = nextState === 'active' ? 1 : 0
  const startedAt = nextState === 'active' ? (session.started_at || approval?.resolved_at || isoNow(now)) : session.started_at
  if (session.session_state === nextState && session.execution_enabled === executionEnabled && session.started_at === startedAt) return session
  db.prepare(`
    UPDATE bridge_sessions
    SET session_state = ?, execution_enabled = ?, started_at = ?, updated_at = ?
    WHERE id = ?
  `).run(nextState, executionEnabled, startedAt, isoNow(now), session.id)
  const updated = db.prepare(`SELECT * FROM bridge_sessions WHERE id = ? LIMIT 1`).get(session.id) as SessionRow | undefined
  return updated || { ...session, session_state: nextState, execution_enabled: executionEnabled, started_at: startedAt }
}

function latestSessionRow(db: Database.Database, workspaceId = 1, tenantId = 1): SessionRow | null {
  const row = db.prepare(`
    SELECT * FROM bridge_sessions
    WHERE workspace_id = ? AND tenant_id = ? AND agent_id = 'agent_zero'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(workspaceId, tenantId) as SessionRow | undefined
  return row || null
}

export function readLatestAgentZeroBridgeSession(input: { db?: Database.Database; workspaceId?: number; tenantId?: number; sync?: boolean; now?: Date } = {}): AgentZeroBridgeSessionRead {
  let ownedDb: Database.Database | null = null
  const db = input.db || (() => {
    ownedDb = getDatabase()
    return ownedDb
  })()
  try {
    if (!agentZeroBridgeSessionPersistenceReady(db)) {
      return {
        persistence_ready: false,
        session: defaultAgentZeroBridgeSessionObject({
          status: 'blocked',
          blocked_reason: 'bridge_session_persistence_not_applied',
          note: 'Bridge Session tables or approval/audit tables are missing.',
        }),
      }
    }
    const row = latestSessionRow(db, input.workspaceId || 1, input.tenantId || 1)
    if (!row) return { persistence_ready: true, session: defaultAgentZeroBridgeSessionObject() }
    const approval = readApproval(db, row.approval_request_id)
    const synced = input.sync === false ? row : syncSessionState(db, row, approval, input.now)
    return { persistence_ready: true, session: sessionObjectFromRow(db, synced, approval, input.now) }
  } catch (error) {
    return {
      persistence_ready: false,
      session: defaultAgentZeroBridgeSessionObject({
        status: 'blocked',
        blocked_reason: error instanceof Error ? error.message.slice(0, 200) : 'bridge_session_read_failed',
      }),
    }
  } finally {
    if (input.db) {
      try { ownedDb?.close() } catch { /* noop */ }
    }
  }
}

function scopeHash(scopeJson: string, workspaceId: number, tenantId: number): string {
  return createHash('sha256')
    .update([workspaceId, tenantId, AGENT_ZERO_BRIDGE_SESSION_CONNECTOR, AGENT_ZERO_BRIDGE_SESSION_ACTION, AGENT_ZERO_BRIDGE_SESSION_TARGET_KEY, scopeJson].join('|'))
    .digest('hex')
}

function payloadHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function realUserIdOrNull(db: Database.Database, value: number | null): number | null {
  if (!value || !Number.isInteger(value) || value <= 0) return null
  const row = db.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').get(value) as { id?: number } | undefined
  return row?.id || null
}

export function createOrReuseAgentZeroBridgeSession(input: {
  db?: Database.Database
  requester: AgentZeroBridgeSessionRequester
  durationHours?: number
  scope?: string
  now?: Date
}): AgentZeroBridgeSessionCreateResult {
  let ownedDb: Database.Database | null = null
  const db = input.db || (() => {
    ownedDb = getDatabase()
    return ownedDb
  })()
  const now = input.now || new Date()
  try {
    if (!agentZeroBridgeSessionPersistenceReady(db)) {
      return {
        ok: false,
        http_status: 423,
        persistence_ready: false,
        approval_request_created: false,
        reused_existing: false,
        session: defaultAgentZeroBridgeSessionObject({
          status: 'blocked',
          blocked_reason: 'bridge_session_persistence_not_applied',
        }),
        next_action: 'Apply Bridge Session persistence before creating an Agent Zero execution session approval.',
      }
    }

    const existing = latestSessionRow(db, input.requester.workspaceId, input.requester.tenantId)
    if (existing) {
      const existingApproval = readApproval(db, existing.approval_request_id)
      const synced = syncSessionState(db, existing, existingApproval, now)
      const existingView = sessionObjectFromRow(db, synced, existingApproval, now)
      if (existingView.status === 'pending_approval' || existingView.status === 'active') {
        return {
          ok: true,
          http_status: 200,
          persistence_ready: true,
          approval_request_created: false,
          reused_existing: true,
          session: existingView,
          next_action: existingView.status === 'active'
            ? 'Use the active Bridge Session id for scoped Agent Zero actions; each action must write a session audit event.'
            : 'Owner approval is already pending. Reuse this approval request instead of sending another prompt.',
        }
      }
    }

    const durationHours = Math.max(1, Math.min(12, Math.floor(input.durationHours || AGENT_ZERO_BRIDGE_SESSION_DURATION_HOURS)))
    const sessionId = `bs_${randomUUID()}`
    const approvalId = `apr_${randomUUID()}`
    const bridgeAuditId = `audit_${randomUUID()}`
    const sessionAuditId = `bsa_${randomUUID()}`
    const correlationId = `corr_${randomUUID()}`
    const ownerId = realUserIdOrNull(db, input.requester.userId)
    const scope = String(input.scope || DEFAULT_SCOPE).slice(0, 1000)
    const scopeJson = stableJson({
      scope,
      duration_hours: durationHours,
      one_bridge_session_approval_model: true,
      no_approval_spam: true,
      every_action_audited: true,
      no_fake_completion: true,
      raw_root_shell_enabled: false,
      docker_socket_enabled: false,
      direct_secret_reads_enabled: false,
      raw_arbitrary_filesystem_enabled: false,
      participants: defaultParticipants(false),
      agent_zero_authority: defaultAgentZeroAuthority(),
      hermes_permissions: defaultHermesPermissions(false),
      rule: 'Agent Zero must not fake completion, spam approvals, use raw root shell, use Docker socket, or read secrets directly.',
      allowed_tools: DEFAULT_ALLOWED_TOOLS,
      allowed_integrations: DEFAULT_ALLOWED_INTEGRATIONS,
      allowed_models: DEFAULT_ALLOWED_MODELS,
      allowed_skills: DEFAULT_ALLOWED_SKILLS,
      allowed_brain_access: DEFAULT_ALLOWED_BRAIN_ACCESS,
      allowed_delivery_surfaces: DEFAULT_ALLOWED_DELIVERY_SURFACES,
      blocked_scopes: BLOCKED_SCOPES,
      safety_contract: defaultSafetyContract(),
    })
    const hash = scopeHash(scopeJson, input.requester.workspaceId, input.requester.tenantId)
    const idempotencyKey = `agent_zero_bridge_session:${input.requester.workspaceId}:${input.requester.tenantId}:${hash.slice(0, 24)}`
    const expiresAt = isoPlusHours(durationHours, now)
    const requesterName = input.requester.username || 'mission-control'

    const created = db.transaction(() => {
      const duplicateApproval = db.prepare(`
        SELECT id, approval_state
        FROM bridge_approval_requests
        WHERE workspace_id = ? AND tenant_id = ? AND idempotency_key = ?
        LIMIT 1
      `).get(input.requester.workspaceId, input.requester.tenantId, idempotencyKey) as { id: string; approval_state: string } | undefined
      if (duplicateApproval) {
        const duplicateSession = db.prepare(`SELECT * FROM bridge_sessions WHERE approval_request_id = ? LIMIT 1`).get(duplicateApproval.id) as SessionRow | undefined
        if (duplicateSession) return { session: duplicateSession, approvalId: duplicateApproval.id, reused: true }
      }

      db.prepare(`
        INSERT INTO bridge_approval_requests (
          id, workspace_id, tenant_id, connector, action, target, target_key,
          requester, requester_user_id, risk_level, approval_state, protected_category,
          approval_scope_json, scope_hash, reason, required_approver, rollback_available,
          rollback_ref, expires_at, correlation_id, idempotency_key
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 'owner', 0, NULL, ?, ?, ?
        )
      `).run(
        approvalId,
        input.requester.workspaceId,
        input.requester.tenantId,
        AGENT_ZERO_BRIDGE_SESSION_CONNECTOR,
        AGENT_ZERO_BRIDGE_SESSION_ACTION,
        AGENT_ZERO_BRIDGE_SESSION_TARGET,
        AGENT_ZERO_BRIDGE_SESSION_TARGET_KEY,
        requesterName,
        ownerId,
        AGENT_ZERO_BRIDGE_SESSION_RISK_LEVEL,
        AGENT_ZERO_BRIDGE_SESSION_CATEGORY,
        scopeJson,
        hash,
        AGENT_ZERO_BRIDGE_SESSION_OWNER_PROMPT,
        expiresAt,
        correlationId,
        idempotencyKey,
      )

      db.prepare(`
        INSERT INTO bridge_sessions (
          id, workspace_id, tenant_id, approval_request_id, owner_id, agent_id,
          session_state, started_at, expires_at, scope_json, allowed_tools_json,
          allowed_integrations_json, allowed_models_json, allowed_brain_access_json,
          execution_enabled, correlation_id
        ) VALUES (?, ?, ?, ?, ?, 'agent_zero', 'pending_approval', NULL, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        sessionId,
        input.requester.workspaceId,
        input.requester.tenantId,
        approvalId,
        ownerId,
        expiresAt,
        scopeJson,
        JSON.stringify(DEFAULT_ALLOWED_TOOLS),
        JSON.stringify(DEFAULT_ALLOWED_INTEGRATIONS),
        JSON.stringify(DEFAULT_ALLOWED_MODELS),
        JSON.stringify(DEFAULT_ALLOWED_BRAIN_ACCESS),
        correlationId,
      )

      db.prepare(`
        INSERT INTO bridge_audit_events (
          id, workspace_id, tenant_id, approval_request_id, actor, actor_user_id,
          connector, action, target, target_key, outcome, payload_hash, metadata_json, correlation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approval_requested', ?, ?, ?)
      `).run(
        bridgeAuditId,
        input.requester.workspaceId,
        input.requester.tenantId,
        approvalId,
        requesterName,
        ownerId,
        AGENT_ZERO_BRIDGE_SESSION_CONNECTOR,
        AGENT_ZERO_BRIDGE_SESSION_ACTION,
        AGENT_ZERO_BRIDGE_SESSION_TARGET,
        AGENT_ZERO_BRIDGE_SESSION_TARGET_KEY,
        payloadHash(scopeJson),
        stableJson({
          source: 'mission-control-agent-zero-bridge-session',
          approval_prompt: AGENT_ZERO_BRIDGE_SESSION_OWNER_PROMPT,
          one_bridge_session_approval_model: true,
          no_approval_spam: true,
          every_action_audited: true,
          every_agent_zero_and_hermes_action_audited: true,
          no_fake_completion: true,
          blocked_scopes: BLOCKED_SCOPES,
          safety_contract: defaultSafetyContract(),
          participants: defaultParticipants(false),
          agent_zero_authority: defaultAgentZeroAuthority(),
          hermes_permissions: defaultHermesPermissions(false),
          execution_enabled: false,
        }),
        correlationId,
      )

      db.prepare(`
        INSERT INTO bridge_session_audit_events (
          id, workspace_id, tenant_id, session_id, approval_request_id, actor, actor_user_id,
          agent_id, action, target, outcome, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'agent_zero', 'bridge_session.approval_requested', ?, 'approval_requested', ?)
      `).run(
        sessionAuditId,
        input.requester.workspaceId,
        input.requester.tenantId,
        sessionId,
        approvalId,
        requesterName,
        ownerId,
        AGENT_ZERO_BRIDGE_SESSION_TARGET,
        stableJson({
          approval_prompt: AGENT_ZERO_BRIDGE_SESSION_OWNER_PROMPT,
          expires_at: expiresAt,
          one_bridge_session_approval_model: true,
          no_approval_spam: true,
          every_action_audited: true,
          every_agent_zero_and_hermes_action_audited: true,
          blocked_scopes: BLOCKED_SCOPES,
          participants: defaultParticipants(false),
          hermes_permissions: defaultHermesPermissions(false),
        }),
      )

      const session = db.prepare(`SELECT * FROM bridge_sessions WHERE id = ? LIMIT 1`).get(sessionId) as SessionRow
      return { session, approvalId, reused: false }
    })()

    const approval = readApproval(db, created.approvalId)
    const view = sessionObjectFromRow(db, created.session, approval, now)
    return {
      ok: true,
      http_status: created.reused ? 200 : 201,
      persistence_ready: true,
      approval_request_created: !created.reused,
      reused_existing: created.reused,
      session: view,
      next_action: created.reused
        ? 'Owner approval is already pending. Reuse this approval request instead of sending another prompt.'
        : 'Send the single owner approval prompt, then activate Agent Zero actions only after approval_state becomes approved.',
    }
  } catch (error) {
    return {
      ok: false,
      http_status: 500,
      persistence_ready: false,
      approval_request_created: false,
      reused_existing: false,
      session: defaultAgentZeroBridgeSessionObject({
        status: 'blocked',
        blocked_reason: error instanceof Error ? error.message.slice(0, 200) : 'bridge_session_create_failed',
      }),
      next_action: 'Fix Bridge Session persistence before opening Agent Zero execution access.',
    }
  } finally {
    if (input.db) {
      try { ownedDb?.close() } catch { /* noop */ }
    }
  }
}

export function recordAgentZeroBridgeSessionAudit(input: {
  db?: Database.Database
  sessionId?: string | null
  requester: AgentZeroBridgeSessionRequester
  agentId?: BridgeSessionAgentId
  action: string
  target?: string | null
  outcome?: string
  metadata?: Record<string, unknown>
  now?: Date
}): AgentZeroBridgeSessionAuditResult {
  let ownedDb: Database.Database | null = null
  const db = input.db || (() => {
    ownedDb = getDatabase()
    return ownedDb
  })()
  try {
    const read = readLatestAgentZeroBridgeSession({ db, workspaceId: input.requester.workspaceId, tenantId: input.requester.tenantId, sync: true, now: input.now })
    const active = read.session.status === 'active' && read.session.execution_enabled
    const sessionId = input.sessionId || read.session.session_id
    if (!read.persistence_ready || !active || !sessionId || sessionId !== read.session.session_id) {
      return {
        ok: false,
        http_status: 423,
        audit_event: null,
        session: read.session,
        execution_enabled: false,
        blocked_reason: !read.persistence_ready ? 'bridge_session_persistence_not_applied' : !active ? 'active_bridge_session_required' : 'bridge_session_id_mismatch',
      }
    }

    const auditId = `bsa_${randomUUID()}`
    const actor = input.requester.username || 'mission-control'
    const ownerId = realUserIdOrNull(db, input.requester.userId)
    const agentId: BridgeSessionAgentId = input.agentId === 'hermes' ? 'hermes' : 'agent_zero'
    const metadataJson = stableJson({
      ...(input.metadata || {}),
      bridge_session_scope_checked: true,
      no_repeated_owner_approval: true,
      audited_agent_id: agentId,
      agent_zero_remains_commander: true,
      hermes_execution_requires_delegation: true,
    })
    db.prepare(`
      INSERT INTO bridge_session_audit_events (
        id, workspace_id, tenant_id, session_id, approval_request_id, actor, actor_user_id,
        agent_id, action, target, outcome, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditId,
      input.requester.workspaceId,
      input.requester.tenantId,
      sessionId,
      read.session.approval_request_id,
      actor,
      ownerId,
      agentId,
      String(input.action || 'agent_zero.action').slice(0, 160),
      input.target ? String(input.target).slice(0, 260) : null,
      String(input.outcome || 'allowed').slice(0, 80),
      metadataJson,
    )
    const updated = readLatestAgentZeroBridgeSession({ db, workspaceId: input.requester.workspaceId, tenantId: input.requester.tenantId, sync: true, now: input.now })
    const event = updated.session.audit_log.find((row) => row.id === auditId) || null
    return {
      ok: true,
      http_status: 201,
      audit_event: event,
      session: updated.session,
      execution_enabled: true,
      blocked_reason: null,
    }
  } catch (error) {
    return {
      ok: false,
      http_status: 500,
      audit_event: null,
      session: defaultAgentZeroBridgeSessionObject({
        status: 'blocked',
        blocked_reason: error instanceof Error ? error.message.slice(0, 200) : 'bridge_session_audit_failed',
      }),
      execution_enabled: false,
      blocked_reason: error instanceof Error ? error.message.slice(0, 200) : 'bridge_session_audit_failed',
    }
  } finally {
    if (input.db) {
      try { ownedDb?.close() } catch { /* noop */ }
    }
  }
}

export function getAgentZeroBridgeSessionBlockedScopes(): string[] {
  return BLOCKED_SCOPES
}

function actionInSessionScope(session: AgentZeroBridgeSessionObject, action: string): boolean {
  const joined = [
    ...session.allowed_tools,
    ...session.allowed_integrations,
    ...session.allowed_models,
    ...session.allowed_skills,
    ...session.allowed_brain_access,
    ...session.allowed_delivery_surfaces,
    ...session.hermes_permissions.explicit_execution_actions,
  ].join(' ')
  return joined.includes(action)
    || (action.includes('report') && joined.includes('hermes.report.draft'))
    || (action.includes('skill') && joined.includes('hermes.skill_spec.draft'))
    || (action.includes('obsidian') && joined.includes('obsidian.write_adapter'))
    || (action.includes('mempalace') && joined.includes('mempalace.write_adapter'))
    || ((action.includes('agentmail') || action === 'external_email_send') && joined.includes('agentmail_if_configured'))
    || (action.includes('registered_adapter') && joined.includes('all_registered_execution_adapters'))
}

export function evaluateHermesBridgeSessionAction(input: {
  session: AgentZeroBridgeSessionObject
  action: HermesBridgeSessionActionKind
  delegatedByAgentZero?: boolean
  connectorConfigured?: boolean | null
  domainAllowed?: boolean | null
}): HermesBridgeSessionActionReadiness {
  const session = input.session
  const active = session.status === 'active' && session.execution_enabled
  const delegated = Boolean(input.delegatedByAgentZero)
  const connectorConfigured = typeof input.connectorConfigured === 'boolean' ? input.connectorConfigured : null
  const domainAllowed = typeof input.domainAllowed === 'boolean' ? input.domainAllowed : null
  const planningAllowed = input.action === 'plan' || input.action === 'design' || input.action === 'suggest' || input.action === 'buildwiki_suggest'

  let blockedReason: string | null = null
  if (input.action === 'raw_shell') blockedReason = 'hermes_raw_shell_forbidden'
  else if (input.action === 'docker_socket') blockedReason = 'hermes_docker_socket_forbidden'
  else if (input.action === 'secret_read') blockedReason = 'hermes_direct_secret_read_forbidden'
  else if (!active && !planningAllowed) blockedReason = session.blocked_reason || 'active_bridge_session_required'
  else if (!delegated && !planningAllowed) blockedReason = 'agent_zero_delegation_required'
  else if (input.action === 'buildwiki_execute') blockedReason = 'hermes_may_suggest_buildwiki_agent_zero_must_execute_scoped_adapter'
  else if ((input.action === 'external_email_send' || input.action === 'registered_adapter_execute') && connectorConfigured === false) blockedReason = 'connector_missing_or_not_configured'
  else if (input.action === 'external_email_send' && domainAllowed !== true) blockedReason = 'agentmail_domain_allow_list_required'
  else if (!planningAllowed && !actionInSessionScope(session, input.action)) blockedReason = 'hermes_action_not_in_bridge_session_scope'

  const allowed = !blockedReason
  const executionEnabled = allowed && !planningAllowed

  return {
    ok: allowed,
    agent_id: 'hermes',
    action: input.action,
    execution_enabled: executionEnabled,
    allowed,
    delegated_by_agent_zero: delegated,
    bridge_session_active: active,
    registered_adapter_required: true,
    connector_configured: connectorConfigured,
    domain_allowed: domainAllowed,
    blocked_reason: blockedReason,
    normal_reply: allowed
      ? planningAllowed
        ? 'Hermes may plan, design, or suggest. Agent Zero remains commander for review and any execution.'
        : 'Hermes may use the scoped registered adapter delegated by Agent Zero inside the active Bridge Session.'
      : `Hermes is blocked: ${(blockedReason || 'unknown').replace(/[_-]+/g, ' ')}.`,
    audit_required: true,
  }
}
