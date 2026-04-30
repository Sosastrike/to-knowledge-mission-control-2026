'use client'

// ─────────────────────────────────────────────────────────────────────
// src/components/agent-network/AgentNetworkClient.tsx
//
// Client wrapper for the Agent Network Phase A page.
//
// Responsibilities:
//   - Fetch live agent list from existing /api/agents (mission-control's
//     own registry, behind requireRole('viewer'))
//   - Render tier-laned canvas (commander · lieutenant · specialist · worker)
//   - Render external/tailnet section (Agent Zero · Hermes sandbox ·
//     OpenClaw Gateway · Bridge Mode)
//   - Show "PHASE A — READ-ONLY" header chip
//   - Every disabled mutation control carries a visible
//     "Phase B — owner setup required" pill (no silent grays)
//
// Phase A explicitly does NOT:
//   - call any mutation endpoint (no POST/PATCH/DELETE)
//   - subscribe to SSE
//   - render approval state changes
//   - mutate Tony / Agent Zero / governance / credentials
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import styles from './agent-network.module.css'

interface AgentRow {
  id?: string
  name?: string
  status?: string
  health?: string
  last_heartbeat?: number
  channels?: string[]
  skills?: string[]
  role?: string
  template?: string
  workspace_id?: number
}

interface HermesInfo {
  installed: boolean
  path: string | null
  version: string | null
}

interface BridgeInfo {
  plansFound: number
  paths: string[]
}

type ProviderState =
  | 'active'
  | 'configured'
  | 'missing_credential'
  | 'degraded'
  | 'sandbox'
  | 'backup'
  | 'unknown'

interface BridgeProviderStatus {
  id: string
  name: string
  category: string
  state: ProviderState
  last_checked: number
  detail?: {
    endpoint?: string | null
    version?: string | null
    http_status?: number | null
    latency_ms?: number | null
    credential_name?: string | null
    credential_present?: boolean
    notes?: string
    error?: string | null
  }
  next_action?: string | null
}

interface BridgeProvidersPayload {
  ok?: boolean
  providers?: BridgeProviderStatus[]
  summary?: {
    total?: number
    by_state?: Record<string, number>
  }
  error?: string
}

interface BridgeCapabilityAgent {
  id: string
  display_name: string
  role: string
  status: string
  execution_permission: string
  available_models?: string[]
  available_tools?: string[]
  available_skills?: string[]
  available_integrations?: string[]
  available_mcps?: string[]
  provider_routes?: string[]
  approval_gates?: string[]
  restrictions?: string[]
  memory_brain_sync_status?: string
  harness_event_routing_status?: string
  cost_rate_limits?: string[]
  blockers?: string[]
  next_action?: string
  can_execute?: boolean
}

interface BridgeCapabilityPayload {
  ok?: boolean
  mode?: string
  no_execution_enabled?: boolean
  no_memory_writes_enabled?: boolean
  no_connector_writes_enabled?: boolean
  agents?: BridgeCapabilityAgent[]
  summary?: {
    agents_total?: number
    executable_agents?: number
    read_only_or_observe_agents?: number
    tools_total?: number
    connector_writes_enabled?: number
    protected_actions_locked?: boolean
  }
  error?: string
}

interface ConnectorReadiness {
  id: string
  label: string
  role: string
  state: string
  risk_level?: string
  read_only_endpoint: string | null
  execution_endpoint: string | null
  canonical_paths?: {
    status?: string | null
    inventory?: string | null
    execution?: string | null
    approval?: string | null
    setup?: string | null
  }
  ui_contract?: {
    status_card_state?: string
    primary_button_state?: string
    primary_button_label?: string
    disabled_message?: string
  }
  credential_names?: string[]
  credentials_present_by_name?: Record<string, boolean>
  approval_required_for_execution?: boolean
  audit_required_for_execution?: boolean
  writes_enabled?: boolean
  execution_enabled?: boolean
  current_safe_actions?: string[]
  blocked_actions?: string[]
  owner_approval_required_before?: string[]
  deferred_or_redundant_paths?: string[]
  blocker?: string | null
  next_action?: string
}

interface ConnectorReadinessPayload {
  ok?: boolean
  mode?: string
  no_execution_enabled?: boolean
  no_connector_writes_enabled?: boolean
  connectors?: ConnectorReadiness[]
  summary?: {
    total?: number
    by_state?: Record<string, number>
    execution_enabled?: number
    writes_enabled?: number
    owner_approval_required_for_execution?: number
  }
  error?: string
}

interface BridgePreflightResult {
  id?: string
  persistence?: string
  execution_enabled?: boolean
  approval_request_created?: boolean
  approved_for_execution?: boolean
  agent_id?: string
  task_type?: string
  connector?: string | null
  decision?: string
  reason?: string
  http_status_if_attempted?: number
  selected_route?: {
    primary?: string
    fallback?: string
    notes?: string[]
  }
  selected_tools?: string[]
  selected_models?: string[]
  selected_skills?: string[]
  selected_integrations?: string[]
  selected_mcps?: string[]
  approval_gates?: string[]
  restrictions?: string[]
  credential_names?: string[]
  credentials_present_by_name?: Record<string, boolean>
  missing_credentials?: string[]
  fallback_routes?: string[]
  telegram_approval_required?: boolean
  next_action?: string
}

interface BridgePreflightPayload {
  ok?: boolean
  mode?: string
  generated_at?: string
  preflight?: BridgePreflightResult
  error?: string
}

interface ApprovalReadinessPayload {
  ok?: boolean
  mode?: string
  no_execution_enabled?: boolean
  no_connector_writes_enabled?: boolean
  no_fake_approval_requests?: boolean
  production_migration_applied?: boolean
  current_state?: string
  approval_queue_state?: string
  db?: {
    db_exists?: boolean
    db_path?: string
    db_size_bytes?: number
    readable?: boolean
    tables_present?: string[]
    tables_missing?: string[]
    indexes_present?: string[]
    indexes_missing?: string[]
    error?: string | null
  }
  migration?: {
    proposed_sql_path?: string
    proposed_sql_present?: boolean
    temp_db_test_script_path?: string
    temp_db_test_script_present?: boolean
    production_apply_requires_owner_approval?: boolean
    temp_db_test_command_now?: string
  }
  required_tables?: string[]
  required_indexes?: string[]
  next_action?: string
  error?: string
}

interface ApprovalQueuePayload {
  ok?: boolean
  mode?: string
  persistence?: string
  approval_queue_connected?: boolean
  approvals?: Array<{
    id?: string
    connector?: string
    action?: string
    approval_state?: string
    risk_level?: string
    created_at?: string
  }>
  summary?: {
    total?: number
    pending?: number
    approved?: number
    denied?: number
    expired?: number
    revoked?: number
  }
  ui_placeholder?: {
    title?: string
    state?: string
    message?: string
    next_backend_step?: string
    no_fake_approval_requests?: boolean
    approval_request_created?: boolean
    protected_actions_locked?: boolean
    protected_action_http_status?: number
  }
  next_action?: string
  error?: string
}

interface ExecutiveReportPreviewPayload {
  ok?: boolean
  mode?: string
  generated_at?: string
  no_execution_enabled?: boolean
  no_persistence_enabled?: boolean
  no_telegram_send_enabled?: boolean
  no_pdf_written?: boolean
  plain_language_summary?: string
  detailed_report_markdown?: string
  pdf_status?: string
  telegram_approval_status?: string
  next_action?: string
  error?: string
}

interface TelegramApprovalPreviewPayload {
  ok?: boolean
  mode?: string
  generated_at?: string
  no_execution_enabled?: boolean
  no_persistence_enabled?: boolean
  no_telegram_send_enabled?: boolean
  approval_request_created?: boolean
  preview?: {
    channel?: string
    recipient?: string
    send_state?: string
    persistence_state?: string
    callback_state?: string
    message_preview?: string
    buttons?: Array<{ label?: string; state?: string }>
  }
  next_action?: string
  error?: string
}

interface ButtonContractItem {
  route: string
  label: string
  endpoint: string | null
  method: string
  state: string
  current_backend_state?: string
  credential_names?: string[]
  approval_required?: boolean
  audit_required?: boolean
  blocked_http_status?: number | null
  execution_enabled?: boolean
  protected_execution_enabled?: boolean
  should_render_as_disabled?: boolean
  fake_success_allowed?: boolean
  safe_ui_behavior?: string
  note?: string
}

interface ButtonContractsPayload {
  ok?: boolean
  generated_at?: string
  no_fake_success?: boolean
  protected_execution_enabled?: boolean
  buttons?: ButtonContractItem[]
  route_summary?: Array<{
    route: string
    total: number
    by_state?: Record<string, number>
    protected_actions?: number
    audit_required?: number
    blocked_buttons?: number
    executable_now?: number
    missing_backend?: number
    missing_credentials?: number
  }>
  summary?: {
    total?: number
    by_state?: Record<string, number>
    protected_actions?: number
    audit_required?: number
    blocked_buttons?: number
    executable_now?: number
  }
  error?: string
}

interface BridgeCostsPayload {
  ok?: boolean
  mode?: string
  generated_at?: string
  no_execution_enabled?: boolean
  no_budget_enforcement_enabled?: boolean
  no_provider_routing_changes_enabled?: boolean
  window_days?: number
  summary?: {
    total_tokens?: number
    estimated_cost?: number
    request_count?: number
    agent_count?: number
  }
  agents?: Array<{
    agent?: string
    total_tokens?: number
    estimated_cost?: number
    request_count?: number
    last_active?: string | null
  }>
  governance?: {
    current_state?: string
    expensive_job_threshold?: string
    route_changes?: string
    fallback_policy?: string
    approval_required_for?: string[]
  }
  rate_limits?: {
    enforcement_state?: string
    bridge_specific_limits?: string
    agent_loop_detection?: string
    no_autonomous_expensive_loops?: boolean
  }
  next_action?: string
  error?: string
}

interface OwnerGate {
  id: string
  title: string
  category: string
  state: string
  priority: number
  approval_required?: boolean
  credential_names?: string[]
  execution_enabled?: boolean
  writes_enabled?: boolean
  current_safe_behavior?: string
  blocker?: string
  next_action?: string
}

interface BridgeOwnerGatesPayload {
  ok?: boolean
  mode?: string
  generated_at?: string
  no_execution_enabled?: boolean
  no_connector_writes_enabled?: boolean
  no_secret_values_exposed?: boolean
  production_db_migration_applied?: boolean
  gates?: OwnerGate[]
  summary?: {
    total?: number
    by_state?: Record<string, number>
    owner_approval_required?: number
    credential_related?: number
    execution_enabled?: number
    writes_enabled?: number
  }
  canonical_next_step?: string
  error?: string
}

interface Props {
  hermes: HermesInfo
  bridge: BridgeInfo
}

// Static reference for the 4 tiers (per spec §1)
const TIER_DEFS: Array<{ id: string; label: string; sub: string }> = [
  { id: 'commander', label: 'Commander', sub: 'Owner-assistant; routes work, sets priorities' },
  { id: 'lieutenant', label: 'Lieutenants', sub: 'Cluster owners; report to commanders' },
  { id: 'specialist', label: 'Specialists', sub: 'Domain-specific workers' },
  { id: 'worker', label: 'Workers', sub: 'Long-running task agents' },
]

// Static role assignment for known agents (mirrors the canonical registry's
// seed data so the layout has correct tier placement before live RBAC lands).
// Phase B replaces this with the `agents.tier` column from spec §2.
const KNOWN_TIER_OF: Record<string, string> = {
  tony:       'commander',
  main:       'commander',  // alias used by /api/agents
  archivist:  'specialist',
  atlas:      'lieutenant',
  builder:    'specialist',
  echo:       'worker',
  forge:      'lieutenant',
  growth:     'specialist',
  loom:       'specialist',
  operator:   'lieutenant',
  pacman:     'specialist',
  qa:         'specialist',
  researcher: 'specialist',
}

const KNOWN_PROTECTED: Record<string, boolean> = {
  tony: true,
  main: true,
  // agent_zero is handled in the External section (it's not in MC's /api/agents)
}

// ── Phase B pill (visible — never silently grayed) ────────────────
function PhaseBPill({ label = 'Phase B — owner setup required' }: { label?: string }) {
  return <span className={styles.phaseBPill}>{label}</span>
}

function StatusDot({ status }: { status: string | undefined }) {
  const cls =
    status === 'active' || status === 'online'
      ? styles.dotOnline
      : status === 'idle'
      ? styles.dotIdle
      : status === 'degraded'
      ? styles.dotDegraded
      : styles.dotOffline
  return <span className={cls} aria-label={`status: ${status || 'unknown'}`} />
}

function providerStateLabel(state: ProviderState | undefined) {
  return (state || 'unknown').replace(/_/g, ' ')
}

function ProviderCard({ provider }: { provider: BridgeProviderStatus }) {
  const detail = provider.detail || {}
  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status={provider.state} />
          <strong className={styles.providerName}>{provider.name}</strong>
        </div>
        <span className={`${styles.providerState} ${styles[`providerState_${provider.state}`] || ''}`}>
          {providerStateLabel(provider.state)}
        </span>
      </div>
      <div className={styles.providerMeta}>
        <span>{provider.category}</span>
        {detail.http_status != null && <span>HTTP {detail.http_status}</span>}
        {detail.latency_ms != null && <span>{detail.latency_ms}ms</span>}
        {detail.credential_name && (
          <span>
            {detail.credential_name}: {detail.credential_present ? 'present' : 'missing'}
          </span>
        )}
      </div>
      {detail.endpoint && <div className={styles.providerEndpoint}>{detail.endpoint}</div>}
      {detail.notes && <p className={styles.providerNotes}>{detail.notes}</p>}
      {provider.next_action && <p className={styles.providerAction}>{provider.next_action}</p>}
    </div>
  )
}

function joinPreview(items: string[] | undefined, emptyOrLimit: string | number = 'none declared') {
  const limit = typeof emptyOrLimit === 'number' ? emptyOrLimit : 3
  const empty = typeof emptyOrLimit === 'string' ? emptyOrLimit : 'none declared'
  if (!items || items.length === 0) return empty
  return items.slice(0, limit).join(' · ') + (items.length > limit ? ` · +${items.length - limit}` : '')
}

function CapabilityAgentCard({ agent }: { agent: BridgeCapabilityAgent }) {
  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status={agent.status} />
          <strong className={styles.providerName}>{agent.display_name}</strong>
        </div>
        <span className={styles.providerState}>{agent.can_execute ? 'execute approved' : agent.execution_permission}</span>
      </div>
      <div className={styles.providerMeta}>
        <span>{agent.status}</span>
        <span>{agent.role}</span>
      </div>
      <p className={styles.providerNotes}>Models: {joinPreview(agent.available_models)}</p>
      <p className={styles.providerNotes}>Tools: {joinPreview(agent.available_tools)}</p>
      <p className={styles.providerNotes}>Skills: {joinPreview(agent.available_skills)}</p>
      <p className={styles.providerNotes}>Integrations: {joinPreview(agent.available_integrations)}</p>
      <p className={styles.providerNotes}>MCPs: {joinPreview(agent.available_mcps)}</p>
      <p className={styles.providerNotes}>Routes: {joinPreview(agent.provider_routes)}</p>
      <p className={styles.providerNotes}>Approval gates: {joinPreview(agent.approval_gates)}</p>
      <p className={styles.providerNotes}>Restrictions: {joinPreview(agent.restrictions)}</p>
      <p className={styles.providerNotes}>Cost/rate limits: {joinPreview(agent.cost_rate_limits)}</p>
      <p className={styles.providerNotes}>Brain Sync: {agent.memory_brain_sync_status || 'read-only status only'}</p>
      <p className={styles.providerNotes}>Harness: {agent.harness_event_routing_status || 'read-only status only'}</p>
      {agent.blockers && agent.blockers.length > 0 && (
        <p className={styles.providerAction}>Blocked: {joinPreview(agent.blockers)}</p>
      )}
      {agent.next_action && <p className={styles.providerAction}>{agent.next_action}</p>}
    </div>
  )
}

function ConnectorCard({ connector }: { connector: ConnectorReadiness }) {
  const credentialStates = Object.entries(connector.credentials_present_by_name || {})
    .map(([name, present]) => `${name}: ${present ? 'present' : 'missing'}`)

  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status={connector.state === 'READ_ONLY' ? 'active' : 'degraded'} />
          <strong className={styles.providerName}>{connector.label}</strong>
        </div>
        <span className={styles.providerState}>{connector.state.replace(/_/g, ' ')}</span>
      </div>
      <div className={styles.providerMeta}>
        <span>{connector.role}</span>
        {connector.risk_level && <span>risk: {connector.risk_level}</span>}
        <span>writes: {connector.writes_enabled ? 'enabled' : 'locked'}</span>
        <span>execution: {connector.execution_enabled ? 'enabled' : 'disabled'}</span>
        <span>approval: {connector.approval_required_for_execution ? 'required' : 'not required'}</span>
        <span>audit: {connector.audit_required_for_execution ? 'required' : 'not required'}</span>
      </div>
      {connector.ui_contract && (
        <p className={styles.providerNotes}>
          Button state: {connector.ui_contract.primary_button_state || connector.state} · {connector.ui_contract.primary_button_label || 'No action'}
        </p>
      )}
      {connector.ui_contract?.disabled_message && (
        <p className={styles.providerAction}>{connector.ui_contract.disabled_message}</p>
      )}
      {connector.read_only_endpoint && <div className={styles.providerEndpoint}>read: {connector.read_only_endpoint}</div>}
      {connector.execution_endpoint && <div className={styles.providerEndpoint}>execute locked: {connector.execution_endpoint}</div>}
      {connector.canonical_paths && (
        <p className={styles.providerNotes}>
          Canonical paths: status {connector.canonical_paths.status || 'n/a'} · inventory {connector.canonical_paths.inventory || 'n/a'} · approval {connector.canonical_paths.approval || 'n/a'} · setup {connector.canonical_paths.setup || 'n/a'}
        </p>
      )}
      {connector.credential_names && connector.credential_names.length > 0 && (
        <p className={styles.providerNotes}>Credential names: {connector.credential_names.join(' · ')}</p>
      )}
      {credentialStates.length > 0 && (
        <p className={styles.providerNotes}>Credential status: {joinPreview(credentialStates, 4)}</p>
      )}
      {connector.current_safe_actions && connector.current_safe_actions.length > 0 && (
        <p className={styles.providerNotes}>Safe now: {joinPreview(connector.current_safe_actions, 3)}</p>
      )}
      {connector.blocked_actions && connector.blocked_actions.length > 0 && (
        <p className={styles.providerAction}>Locked actions: {joinPreview(connector.blocked_actions, 4)}</p>
      )}
      {connector.owner_approval_required_before && connector.owner_approval_required_before.length > 0 && (
        <p className={styles.providerNotes}>Owner approval before: {joinPreview(connector.owner_approval_required_before, 3)}</p>
      )}
      {connector.deferred_or_redundant_paths && connector.deferred_or_redundant_paths.length > 0 && (
        <p className={styles.providerNotes}>Deferred/redundant: {joinPreview(connector.deferred_or_redundant_paths, 2)}</p>
      )}
      {connector.blocker && <p className={styles.providerAction}>Blocked: {connector.blocker}</p>}
      {connector.next_action && <p className={styles.providerNotes}>{connector.next_action}</p>}
    </div>
  )
}

function PreflightCard({
  title,
  payload,
}: {
  title: string
  payload: BridgePreflightPayload | null
}) {
  const preflight = payload?.preflight
  if (!preflight) {
    return (
      <div className={styles.providerCard}>
        <div className={styles.providerHead}>
          <strong className={styles.providerName}>{title}</strong>
          <span className={styles.providerState}>waiting</span>
        </div>
        <p className={styles.providerNotes}>No preflight result loaded yet.</p>
      </div>
    )
  }

  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status={preflight.decision === 'ALLOWED_READ_ONLY' ? 'active' : 'degraded'} />
          <strong className={styles.providerName}>{title}</strong>
        </div>
        <span className={styles.providerState}>{(preflight.decision || 'unknown').replace(/_/g, ' ')}</span>
      </div>
      <div className={styles.providerMeta}>
        <span>agent: {preflight.agent_id || 'unknown'}</span>
        <span>task: {preflight.task_type || 'unknown'}</span>
        <span>execution: {preflight.execution_enabled ? 'enabled' : 'disabled'}</span>
        <span>persistence: {preflight.persistence || 'unknown'}</span>
        <span>approval created: {preflight.approval_request_created ? 'yes' : 'no'}</span>
      </div>
      {preflight.reason && <p className={styles.providerNotes}>{preflight.reason}</p>}
      {preflight.selected_route && (
        <div className={styles.preflightRoute}>
          <span>Primary: {preflight.selected_route.primary || 'none'}</span>
          <span>Fallback: {preflight.selected_route.fallback || 'none'}</span>
        </div>
      )}
      <p className={styles.providerNotes}>Tools: {joinPreview(preflight.selected_tools)}</p>
      <p className={styles.providerNotes}>Models: {joinPreview(preflight.selected_models)}</p>
      <p className={styles.providerNotes}>Skills: {joinPreview(preflight.selected_skills)}</p>
      <p className={styles.providerNotes}>Integrations: {joinPreview(preflight.selected_integrations)}</p>
      <p className={styles.providerNotes}>MCPs: {joinPreview(preflight.selected_mcps)}</p>
      {preflight.missing_credentials && preflight.missing_credentials.length > 0 && (
        <p className={styles.providerAction}>Missing credentials: {preflight.missing_credentials.join(' · ')}</p>
      )}
      {preflight.approval_gates && preflight.approval_gates.length > 0 && (
        <p className={styles.providerAction}>Approval gates: {joinPreview(preflight.approval_gates)}</p>
      )}
      {preflight.restrictions && preflight.restrictions.length > 0 && (
        <p className={styles.providerNotes}>Restrictions: {joinPreview(preflight.restrictions)}</p>
      )}
      {preflight.next_action && <p className={styles.providerAction}>{preflight.next_action}</p>}
    </div>
  )
}

function ApprovalReadinessCard({ payload }: { payload: ApprovalReadinessPayload | null }) {
  if (!payload) {
    return (
      <div className={styles.providerCard}>
        <div className={styles.providerHead}>
          <strong className={styles.providerName}>Approval/Audit Readiness</strong>
          <span className={styles.providerState}>waiting</span>
        </div>
        <p className={styles.providerNotes}>No approval readiness result loaded yet.</p>
      </div>
    )
  }

  const db = payload.db || {}
  const migration = payload.migration || {}
  const missingTables = db.tables_missing || []
  const missingIndexes = db.indexes_missing || []

  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status={payload.production_migration_applied ? 'active' : 'degraded'} />
          <strong className={styles.providerName}>Approval/Audit Readiness</strong>
        </div>
        <span className={styles.providerState}>{(payload.current_state || 'unknown').replace(/_/g, ' ')}</span>
      </div>
      <div className={styles.providerMeta}>
        <span>queue: {payload.approval_queue_state || 'unknown'}</span>
        <span>execution: {payload.no_execution_enabled ? 'disabled' : 'unknown'}</span>
        <span>writes: {payload.no_connector_writes_enabled ? 'locked' : 'unknown'}</span>
        <span>fake approvals: {payload.no_fake_approval_requests ? 'blocked' : 'unknown'}</span>
      </div>
      <p className={styles.providerNotes}>
        DB: {db.db_exists ? 'present' : 'missing'} · readable: {db.readable ? 'yes' : 'no'} · size: {db.db_size_bytes ?? 0} bytes
      </p>
      <p className={styles.providerNotes}>
        Tables: {(db.tables_present || []).length}/{(payload.required_tables || []).length || 4} present
        {missingTables.length > 0 ? ` · missing ${missingTables.length}` : ''}
      </p>
      <p className={styles.providerNotes}>
        Indexes: {(db.indexes_present || []).length}/{(payload.required_indexes || []).length || 15} present
        {missingIndexes.length > 0 ? ` · missing ${missingIndexes.length}` : ''}
      </p>
      {db.error && <p className={styles.providerAction}>DB status: {db.error}</p>}
      <p className={styles.providerNotes}>
        Migration proposal: {migration.proposed_sql_present ? 'present' : 'missing'} · temp test script: {migration.temp_db_test_script_present ? 'present' : 'missing'}
      </p>
      {payload.next_action && <p className={styles.providerAction}>{payload.next_action}</p>}
    </div>
  )
}

function ApprovalQueueCard({ payload }: { payload: ApprovalQueuePayload | null }) {
  if (!payload) {
    return (
      <div className={styles.providerCard}>
        <div className={styles.providerHead}>
          <strong className={styles.providerName}>Approval Queue</strong>
          <span className={styles.providerState}>waiting</span>
        </div>
        <p className={styles.providerNotes}>No approval queue result loaded yet.</p>
      </div>
    )
  }

  const placeholder = payload.ui_placeholder || {}
  const summary = payload.summary || {}
  const approvals = payload.approvals || []

  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status={payload.approval_queue_connected ? 'active' : 'degraded'} />
          <strong className={styles.providerName}>{placeholder.title || 'Approval Queue'}</strong>
        </div>
        <span className={styles.providerState}>{placeholder.state || (payload.approval_queue_connected ? 'READ_ONLY' : 'BACKEND_REQUIRED')}</span>
      </div>
      <div className={styles.providerMeta}>
        <span>persistence: {payload.persistence || 'not applied'}</span>
        <span>pending: {summary.pending ?? 0}</span>
        <span>total: {summary.total ?? approvals.length}</span>
        <span>HTTP blocked: {placeholder.protected_action_http_status || 423}</span>
      </div>
      {placeholder.message && <p className={styles.providerNotes}>{placeholder.message}</p>}
      <p className={styles.providerNotes}>
        Protected actions locked: {placeholder.protected_actions_locked ? 'yes' : 'unknown'} · fake approvals: {placeholder.no_fake_approval_requests ? 'blocked' : 'unknown'} · approval created: {placeholder.approval_request_created ? 'yes' : 'no'}
      </p>
      {approvals.length > 0 ? (
        <ul className={styles.connectorList}>
          {approvals.slice(0, 5).map((approval) => (
            <li key={approval.id || `${approval.connector}-${approval.action}`}>
              <span>{approval.connector || 'unknown'} · {approval.action || 'unknown'}</span>
              <strong>{approval.approval_state || 'unknown'}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.providerNotes}>No persistent approvals are visible yet because the production approval/audit migration is not applied.</p>
      )}
      {placeholder.next_backend_step && <p className={styles.providerAction}>Next backend step: {placeholder.next_backend_step}</p>}
      {payload.next_action && <p className={styles.providerAction}>{payload.next_action}</p>}
    </div>
  )
}

function CostGovernanceCard({ payload }: { payload: BridgeCostsPayload | null }) {
  if (!payload) {
    return (
      <div className={styles.providerCard}>
        <div className={styles.providerHead}>
          <strong className={styles.providerName}>Cost / Rate Governance</strong>
          <span className={styles.providerState}>waiting</span>
        </div>
        <p className={styles.providerNotes}>No cost/rate result loaded yet.</p>
      </div>
    )
  }

  const summary = payload.summary || {}
  const governance = payload.governance || {}
  const rateLimits = payload.rate_limits || {}

  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status={payload.ok ? 'active' : 'degraded'} />
          <strong className={styles.providerName}>Cost / Rate Governance</strong>
        </div>
        <span className={styles.providerState}>{payload.mode || 'read-only'}</span>
      </div>
      <div className={styles.providerMeta}>
        <span>{payload.window_days ?? 30}d window</span>
        <span>{summary.agent_count ?? 0} agents</span>
        <span>{summary.request_count ?? 0} requests</span>
        <span>execution: {payload.no_execution_enabled ? 'disabled' : 'unknown'}</span>
      </div>
      <p className={styles.providerNotes}>Tokens: {(summary.total_tokens ?? 0).toLocaleString()}</p>
      <p className={styles.providerNotes}>Estimated cost: ${Number(summary.estimated_cost ?? 0).toFixed(4)}</p>
      <p className={styles.providerNotes}>Fallback policy: {governance.fallback_policy || 'Claude CLI primary; fallbacks locked'}</p>
      <p className={styles.providerNotes}>Rate limits: {rateLimits.enforcement_state || 'read-only visibility only'}</p>
      <p className={styles.providerNotes}>Approval required for: {joinPreview(governance.approval_required_for)}</p>
      {payload.error && <p className={styles.providerAction}>Cost visibility status: {payload.error}</p>}
      {payload.next_action && <p className={styles.providerAction}>{payload.next_action}</p>}
    </div>
  )
}

function OwnerGateCard({ gate }: { gate: OwnerGate }) {
  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status={gate.state === 'READ_ONLY' ? 'active' : 'degraded'} />
          <strong className={styles.providerName}>{gate.title}</strong>
        </div>
        <span className={styles.providerState}>{gate.state.replace(/_/g, ' ')}</span>
      </div>
      <div className={styles.providerMeta}>
        <span>priority {gate.priority}</span>
        <span>{gate.category.replace(/_/g, ' ')}</span>
        <span>execution: {gate.execution_enabled ? 'enabled' : 'disabled'}</span>
        <span>writes: {gate.writes_enabled ? 'enabled' : 'locked'}</span>
      </div>
      {gate.current_safe_behavior && <p className={styles.providerNotes}>{gate.current_safe_behavior}</p>}
      {gate.credential_names && gate.credential_names.length > 0 && (
        <p className={styles.providerNotes}>Credential names: {gate.credential_names.join(' · ')}</p>
      )}
      {gate.blocker && <p className={styles.providerAction}>Blocked: {gate.blocker}</p>}
      {gate.next_action && <p className={styles.providerNotes}>{gate.next_action}</p>}
    </div>
  )
}

function ExecutiveReportPreviewCard({ payload }: { payload: ExecutiveReportPreviewPayload | null }) {
  if (!payload) {
    return (
      <div className={styles.providerCard}>
        <div className={styles.providerHead}>
          <strong className={styles.providerName}>Executive Report Preview</strong>
          <span className={styles.providerState}>waiting</span>
        </div>
        <p className={styles.providerNotes}>Waiting for a read-only preflight result before preparing a preview.</p>
      </div>
    )
  }

  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status="active" />
          <strong className={styles.providerName}>Executive Report Preview</strong>
        </div>
        <span className={styles.providerState}>read only</span>
      </div>
      <div className={styles.providerMeta}>
        <span>pdf: {payload.pdf_status || 'BACKEND_REQUIRED'}</span>
        <span>telegram: {payload.telegram_approval_status || 'BACKEND_REQUIRED'}</span>
        <span>execution: {payload.no_execution_enabled ? 'disabled' : 'unknown'}</span>
        <span>persistence: {payload.no_persistence_enabled ? 'not connected' : 'unknown'}</span>
      </div>
      {payload.plain_language_summary && (
        <p className={styles.providerNotes}>{payload.plain_language_summary}</p>
      )}
      {payload.detailed_report_markdown && (
        <pre className={styles.reportPreview}>
          {payload.detailed_report_markdown.split('\n').slice(0, 12).join('\n')}
        </pre>
      )}
      {payload.next_action && <p className={styles.providerAction}>{payload.next_action}</p>}
    </div>
  )
}

function TelegramApprovalPreviewCard({ payload }: { payload: TelegramApprovalPreviewPayload | null }) {
  if (!payload?.preview) {
    return (
      <div className={styles.providerCard}>
        <div className={styles.providerHead}>
          <strong className={styles.providerName}>Tony → Telegram Approval Preview</strong>
          <span className={styles.providerState}>waiting</span>
        </div>
        <p className={styles.providerNotes}>No Telegram approval preview loaded yet.</p>
      </div>
    )
  }

  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status="degraded" />
          <strong className={styles.providerName}>Tony → Telegram Approval Preview</strong>
        </div>
        <span className={styles.providerState}>{payload.preview.send_state || 'DISABLED'}</span>
      </div>
      <div className={styles.providerMeta}>
        <span>channel: {payload.preview.channel || 'Tony -> Telegram'}</span>
        <span>persistence: {payload.preview.persistence_state || 'not connected'}</span>
        <span>callback: {payload.preview.callback_state || 'BACKEND_REQUIRED'}</span>
        <span>created: {payload.approval_request_created ? 'yes' : 'no'}</span>
      </div>
      {payload.preview.message_preview && (
        <pre className={styles.reportPreview}>{payload.preview.message_preview}</pre>
      )}
      {payload.preview.buttons && payload.preview.buttons.length > 0 && (
        <p className={styles.providerNotes}>
          Buttons: {payload.preview.buttons.map((button) => `${button.label || 'button'}=${button.state || 'BACKEND_REQUIRED'}`).join(' · ')}
        </p>
      )}
      {payload.next_action && <p className={styles.providerAction}>{payload.next_action}</p>}
    </div>
  )
}

// ── per-agent card ────────────────────────────────────────────────
function AgentCard({ agent }: { agent: AgentRow }) {
  const id = agent.id || agent.name || 'unknown'
  const isProtected = KNOWN_PROTECTED[id.toLowerCase()] === true
  const status = agent.status || (agent.health ?? 'unknown')
  return (
    <div className={isProtected ? `${styles.agentCard} ${styles.agentCardProtected}` : styles.agentCard}>
      <div className={styles.agentCardHead}>
        <StatusDot status={status} />
        <strong className={styles.agentName}>{(agent.name || id).toString()}</strong>
        {isProtected && <span className={styles.lockChip} title="Tony / Agent 0 cannot be modified">🔒 Protected</span>}
      </div>
      <div className={styles.agentMeta}>
        {agent.role && <span className={styles.metaItem}>role: {agent.role}</span>}
        {agent.template && <span className={styles.metaItem}>template: {agent.template}</span>}
        <span className={styles.metaItem}>status: {status || 'unknown'}</span>
        {typeof agent.last_heartbeat === 'number' && (
          <span className={styles.metaItem}>
            last heartbeat: {new Date(agent.last_heartbeat).toLocaleString()}
          </span>
        )}
      </div>
      <div className={styles.agentActions}>
        <button type="button" disabled className={styles.btnDisabled}>
          Rename
          <PhaseBPill />
        </button>
        <button type="button" disabled className={styles.btnDisabled}>
          Promote
          <PhaseBPill />
        </button>
        <button type="button" disabled className={styles.btnDisabled}>
          Retire
          <PhaseBPill />
        </button>
        <button type="button" disabled className={styles.btnDisabled}>
          Connect Engine
          <PhaseBPill />
        </button>
      </div>
    </div>
  )
}

// ── external entity card (Agent Zero, Hermes, Gateway, Bridge) ────
function ExternalCard({
  title,
  badge,
  description,
  details,
  showPhaseB = true,
}: {
  title: string
  badge?: string
  description: string
  details: Array<{ label: string; value: string }>
  showPhaseB?: boolean
}) {
  return (
    <div className={styles.externalCard}>
      <div className={styles.externalHead}>
        <strong className={styles.externalTitle}>{title}</strong>
        {badge && <span className={styles.externalBadge}>{badge}</span>}
      </div>
      <p className={styles.externalDescription}>{description}</p>
      <dl className={styles.externalDetails}>
        {details.map((d, i) => (
          <div key={i} className={styles.externalDetailRow}>
            <dt>{d.label}</dt>
            <dd>{d.value}</dd>
          </div>
        ))}
      </dl>
      {showPhaseB && (
        <div className={styles.agentActions}>
          <button type="button" disabled className={styles.btnDisabled}>
            Configure
            <PhaseBPill />
          </button>
        </div>
      )}
    </div>
  )
}

function ButtonContractCard({ button }: { button: ButtonContractItem }) {
  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status={button.state === 'LIVE' || button.state === 'READ_ONLY' ? 'active' : 'degraded'} />
          <strong className={styles.providerName}>{button.label}</strong>
        </div>
        <span className={styles.providerState}>{button.state.replace(/_/g, ' ')}</span>
      </div>
      <div className={styles.providerMeta}>
        <span>{button.route}</span>
        <span>{button.method}</span>
        {button.blocked_http_status ? <span>HTTP {button.blocked_http_status}</span> : <span>read/status</span>}
        <span>execute: {button.execution_enabled ? 'yes' : 'no'}</span>
      </div>
      {button.endpoint && <div className={styles.providerEndpoint}>{button.endpoint}</div>}
      {button.credential_names && button.credential_names.length > 0 && (
        <p className={styles.providerNotes}>Credentials: {button.credential_names.join(' · ')}</p>
      )}
      {button.safe_ui_behavior && <p className={styles.providerNotes}>{button.safe_ui_behavior}</p>}
      {button.note && <p className={styles.providerAction}>{button.note}</p>}
    </div>
  )
}

function ButtonRouteSummaryCard({ route }: { route: NonNullable<ButtonContractsPayload['route_summary']>[number] }) {
  const blocked = route.blocked_buttons ?? 0
  const missingBackend = route.missing_backend ?? 0
  const missingCredentials = route.missing_credentials ?? 0
  const stateBits = Object.entries(route.by_state || {})
    .filter(([, count]) => count > 0)
    .map(([state, count]) => `${state.replace(/_/g, ' ')} ${count}`)
    .join(' · ')

  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status={blocked > 0 ? 'degraded' : 'active'} />
          <strong className={styles.providerName}>{route.route}</strong>
        </div>
        <span className={styles.providerState}>{route.total} actions</span>
      </div>
      <div className={styles.providerMeta}>
        <span>safe now: {route.executable_now ?? 0}</span>
        <span>blocked: {blocked}</span>
        <span>protected: {route.protected_actions ?? 0}</span>
        <span>audit: {route.audit_required ?? 0}</span>
      </div>
      {stateBits && <p className={styles.providerNotes}>{stateBits}</p>}
      {(missingBackend > 0 || missingCredentials > 0) && (
        <p className={styles.providerAction}>
          Needs backend: {missingBackend} · needs credential: {missingCredentials}
        </p>
      )}
    </div>
  )
}

// ── tier section ──────────────────────────────────────────────────
function TierSection({
  tier,
  agents,
}: {
  tier: { id: string; label: string; sub: string }
  agents: AgentRow[]
}) {
  if (agents.length === 0) {
    return (
      <section className={styles.tierSection}>
        <header className={styles.tierHeader}>
          <h2 className={styles.tierTitle}>{tier.label}</h2>
          <span className={styles.tierSub}>{tier.sub}</span>
        </header>
        <div className={styles.emptyTier}>(none in this tier)</div>
      </section>
    )
  }
  return (
    <section className={styles.tierSection}>
      <header className={styles.tierHeader}>
        <h2 className={styles.tierTitle}>{tier.label}</h2>
        <span className={styles.tierSub}>{tier.sub}</span>
        <span className={styles.tierCount}>{agents.length}</span>
      </header>
      <div className={styles.tierGrid}>
        {agents.map((a) => (
          <AgentCard key={a.id || a.name} agent={a} />
        ))}
      </div>
    </section>
  )
}

export function AgentNetworkClient({ hermes, bridge }: Props) {
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [providers, setProviders] = useState<BridgeProvidersPayload | null>(null)
  const [providerState, setProviderState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [providerError, setProviderError] = useState<string>('')
  const [capabilities, setCapabilities] = useState<BridgeCapabilityPayload | null>(null)
  const [capabilityState, setCapabilityState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [capabilityError, setCapabilityError] = useState<string>('')
  const [connectors, setConnectors] = useState<ConnectorReadinessPayload | null>(null)
  const [connectorState, setConnectorState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [connectorError, setConnectorError] = useState<string>('')
  const [statusPreflight, setStatusPreflight] = useState<BridgePreflightPayload | null>(null)
  const [zapierPreflight, setZapierPreflight] = useState<BridgePreflightPayload | null>(null)
  const [preflightState, setPreflightState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [preflightError, setPreflightError] = useState<string>('')
  const [approvalReadiness, setApprovalReadiness] = useState<ApprovalReadinessPayload | null>(null)
  const [approvalReadinessState, setApprovalReadinessState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [approvalReadinessError, setApprovalReadinessError] = useState<string>('')
  const [approvalQueue, setApprovalQueue] = useState<ApprovalQueuePayload | null>(null)
  const [approvalQueueState, setApprovalQueueState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [approvalQueueError, setApprovalQueueError] = useState<string>('')
  const [executivePreview, setExecutivePreview] = useState<ExecutiveReportPreviewPayload | null>(null)
  const [executivePreviewState, setExecutivePreviewState] = useState<'waiting' | 'loading' | 'ok' | 'error'>('waiting')
  const [executivePreviewError, setExecutivePreviewError] = useState<string>('')
  const [telegramApprovalPreview, setTelegramApprovalPreview] = useState<TelegramApprovalPreviewPayload | null>(null)
  const [telegramApprovalPreviewState, setTelegramApprovalPreviewState] = useState<'waiting' | 'loading' | 'ok' | 'error'>('waiting')
  const [telegramApprovalPreviewError, setTelegramApprovalPreviewError] = useState<string>('')
  const [buttonContracts, setButtonContracts] = useState<ButtonContractsPayload | null>(null)
  const [buttonContractsState, setButtonContractsState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [buttonContractsError, setButtonContractsError] = useState<string>('')
  const [costs, setCosts] = useState<BridgeCostsPayload | null>(null)
  const [costsState, setCostsState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [costsError, setCostsError] = useState<string>('')
  const [ownerGates, setOwnerGates] = useState<BridgeOwnerGatesPayload | null>(null)
  const [ownerGatesState, setOwnerGatesState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [ownerGatesError, setOwnerGatesError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/agents', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`)
        }
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : (data?.agents ?? [])
        setAgents(list)
        setLoadState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMsg((err as Error).message || 'fetch failed')
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/bridge/providers', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as BridgeProvidersPayload
      })
      .then((data) => {
        if (cancelled) return
        setProviders(data)
        setProviderState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setProviderError((err as Error).message || 'fetch failed')
        setProviderState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/bridge/capability-matrix', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as BridgeCapabilityPayload
      })
      .then((data) => {
        if (cancelled) return
        setCapabilities(data)
        setCapabilityState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setCapabilityError((err as Error).message || 'fetch failed')
        setCapabilityState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/bridge/connector-readiness', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as ConnectorReadinessPayload
      })
      .then((data) => {
        if (cancelled) return
        setConnectors(data)
        setConnectorState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setConnectorError((err as Error).message || 'fetch failed')
        setConnectorState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/bridge/button-contracts', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as ButtonContractsPayload
      })
      .then((data) => {
        if (cancelled) return
        setButtonContracts(data)
        setButtonContractsState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setButtonContractsError((err as Error).message || 'fetch failed')
        setButtonContractsState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/bridge/costs?days=30', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as BridgeCostsPayload
      })
      .then((data) => {
        if (cancelled) return
        setCosts(data)
        setCostsState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setCostsError((err as Error).message || 'fetch failed')
        setCostsState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/bridge/owner-gates', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as BridgeOwnerGatesPayload
      })
      .then((data) => {
        if (cancelled) return
        setOwnerGates(data)
        setOwnerGatesState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setOwnerGatesError((err as Error).message || 'fetch failed')
        setOwnerGatesState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const requestPreflight = (body: Record<string, unknown>) =>
      fetch('/api/bridge/preflight', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as BridgePreflightPayload
      })

    Promise.all([
      requestPreflight({
        agent_id: 'tony',
        task_type: 'status_check',
        owner_goal: 'Show current Mission Control Bridge Mode status.',
        requested_action: 'read status only',
      }),
      requestPreflight({
        agent_id: 'tony',
        task_type: 'connector_write',
        connector: 'zapier',
        owner_goal: 'Example protected Zapier write check.',
        requested_action: 'send or update through Zapier',
      }),
    ])
      .then(([statusResult, zapierResult]) => {
        if (cancelled) return
        setStatusPreflight(statusResult)
        setZapierPreflight(zapierResult)
        setPreflightState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setPreflightError((err as Error).message || 'fetch failed')
        setPreflightState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/bridge/approval-readiness', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as ApprovalReadinessPayload
      })
      .then((data) => {
        if (cancelled) return
        setApprovalReadiness(data)
        setApprovalReadinessState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setApprovalReadinessError((err as Error).message || 'fetch failed')
        setApprovalReadinessState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/bridge/approval-requests', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as ApprovalQueuePayload
      })
      .then((data) => {
        if (cancelled) return
        setApprovalQueue(data)
        setApprovalQueueState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setApprovalQueueError((err as Error).message || 'fetch failed')
        setApprovalQueueState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!statusPreflight?.preflight) return

    let cancelled = false
    const preflight = statusPreflight.preflight
    setExecutivePreviewState('loading')

    fetch('/api/bridge/executive-report-preview', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_goal: 'review the latest Bridge Mode preflight result',
        expected_outcome: 'see the selected route, blockers, and next safe action before any protected work',
        task_type: preflight.task_type,
        preflight_decision: preflight.decision,
        selected_route: preflight.selected_route?.primary,
        fallback_route: preflight.selected_route?.fallback,
        selected_tools: preflight.selected_tools,
        selected_models: preflight.selected_models,
        selected_skills: preflight.selected_skills,
        selected_integrations: preflight.selected_integrations,
        approval_gates: preflight.approval_gates,
        missing_credentials: preflight.missing_credentials,
        risks: ['Protected execution remains disabled until approval/audit persistence is approved.'],
        next_action: preflight.next_action || 'Keep this in read-only mode until approval persistence and audit logging are wired.',
      }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as ExecutiveReportPreviewPayload
      })
      .then((data) => {
        if (cancelled) return
        setExecutivePreview(data)
        setExecutivePreviewState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setExecutivePreviewError((err as Error).message || 'fetch failed')
        setExecutivePreviewState('error')
      })

    return () => {
      cancelled = true
    }
  }, [statusPreflight])

  useEffect(() => {
    if (!zapierPreflight?.preflight) return

    let cancelled = false
    const preflight = zapierPreflight.preflight
    setTelegramApprovalPreviewState('loading')

    fetch('/api/bridge/telegram-approval-preview', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_goal: 'approve a protected Zapier connector write after Bridge Mode preflight',
        action_label: 'Protected Zapier write',
        risk_level: 'high',
        selected_route: preflight.selected_route?.primary,
        approval_gates: preflight.approval_gates,
        missing_credentials: preflight.missing_credentials,
        report_url: null,
        expires_in_minutes: 30,
      }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as TelegramApprovalPreviewPayload
      })
      .then((data) => {
        if (cancelled) return
        setTelegramApprovalPreview(data)
        setTelegramApprovalPreviewState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setTelegramApprovalPreviewError((err as Error).message || 'fetch failed')
        setTelegramApprovalPreviewState('error')
      })

    return () => {
      cancelled = true
    }
  }, [zapierPreflight])

  // Bucket the agents by tier
  const buckets: Record<string, AgentRow[]> = {
    commander: [],
    lieutenant: [],
    specialist: [],
    worker: [],
    other: [],
  }
  for (const a of agents) {
    const id = (a.id || a.name || '').toLowerCase()
    const tier = KNOWN_TIER_OF[id] || 'other'
    buckets[tier].push(a)
  }

  return (
    <main className={styles.root} data-theme="mc">
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>Agent Network</h1>
          <span className={styles.phaseChip}>Phase A — Read-Only</span>
        </div>
        <p className={styles.pageSub}>
          Production-safe view of the current agent constellation. Mutations and live event streams are gated to Phase B per <code>path-a-section-2-agent-network-refinement.md</code>.
        </p>
      </header>

      <div className={styles.banner}>
        <strong>Bridge Mode preflight is mandatory.</strong> Every agent must pass through Bridge Mode before acting. Bridge Mode selects the correct tools, models, skills, integrations, MCPs, fallback routes, and approval gates for the task. If Bridge Mode says approval, credential, or backend work is required, the agent must stop that action instead of guessing or faking success.
      </div>

      {/* Top stats strip */}
      <section className={styles.statsStrip}>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{loadState === 'loading' ? '…' : agents.length}</div>
          <div className={styles.statLabel}>Agents in registry</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{hermes.installed ? '✓' : '—'}</div>
          <div className={styles.statLabel}>Hermes sandbox</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{bridge.plansFound}</div>
          <div className={styles.statLabel}>Bridge plans on disk</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{capabilities?.summary?.connector_writes_enabled ?? 0}</div>
          <div className={styles.statLabel}>Connector writes enabled</div>
        </div>
      </section>

      {/* Loading / error banner */}
      {loadState === 'loading' && (
        <div className={styles.banner}>Loading agents from <code>/api/agents</code>…</div>
      )}
      {loadState === 'error' && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <strong>Could not load agents:</strong> {errorMsg}. Static reference cards below remain accurate.
        </div>
      )}

      {/* Tier-laned canvas */}
      <section className={styles.canvas}>
        {TIER_DEFS.map((t) => (
          <TierSection key={t.id} tier={t} agents={buckets[t.id]} />
        ))}
        {buckets.other.length > 0 && (
          <TierSection
            tier={{ id: 'other', label: 'Other / Unbucketed', sub: 'Tier not yet declared in registry' }}
            agents={buckets.other}
          />
        )}
      </section>

      {/* Bridge Mode capability matrix — read-only MVP */}
      <section className={styles.providerSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>Bridge Mode Capability Matrix</h2>
          <span className={styles.tierSub}>
            Live read-only MVP from <code>/api/bridge/capability-matrix</code>
          </span>
        </header>
        {capabilityState === 'loading' && (
          <div className={styles.banner}>Loading Bridge Mode matrix from <code>/api/bridge/capability-matrix</code>…</div>
        )}
        {capabilityState === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <strong>Could not load Bridge Mode matrix:</strong> {capabilityError}
          </div>
        )}
        {capabilityState === 'ok' && (
          <>
            <div className={styles.providerSummary}>
              <span>mode: {capabilities?.mode || 'read-only'}</span>
              <span>{capabilities?.summary?.agents_total ?? capabilities?.agents?.length ?? 0} agents</span>
              <span>{capabilities?.summary?.executable_agents ?? 0} executable in approved lane</span>
              <span>{capabilities?.summary?.read_only_or_observe_agents ?? 0} observe/read-only</span>
              <span>{capabilities?.summary?.tools_total ?? 0} tools</span>
              <span>writes enabled: {capabilities?.summary?.connector_writes_enabled ?? 0}</span>
              <span>protected locked: {capabilities?.summary?.protected_actions_locked ? 'yes' : 'unknown'}</span>
            </div>
            <div className={styles.providerGrid}>
              {(capabilities?.agents || []).map((agent) => (
                <CapabilityAgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Bridge Mode cost/rate governance — read-only visibility */}
      <section className={styles.providerSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>Cost / Rate Governance</h2>
          <span className={styles.tierSub}>
            Read-only token and rate-limit visibility from <code>/api/bridge/costs</code>
          </span>
        </header>
        {costsState === 'loading' && (
          <div className={styles.banner}>Loading cost/rate visibility from <code>/api/bridge/costs</code>…</div>
        )}
        {costsState === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <strong>Could not load cost/rate visibility:</strong> {costsError}
          </div>
        )}
        {costsState === 'ok' && (
          <>
            <div className={styles.providerSummary}>
              <span>mode: {costs?.mode || 'bridge_cost_rate_read_only'}</span>
              <span>execution: {costs?.no_execution_enabled ? 'disabled' : 'unknown'}</span>
              <span>budget enforcement: {costs?.no_budget_enforcement_enabled ? 'not enabled' : 'unknown'}</span>
              <span>provider routing changes: {costs?.no_provider_routing_changes_enabled ? 'locked' : 'unknown'}</span>
            </div>
            <div className={styles.preflightNotice}>
              Cost/rate governance is visibility only. Bridge Mode can show usage and policy, but it does not change model routes, enforce budgets, or allow expensive jobs until approval/audit persistence is approved.
            </div>
            <div className={styles.providerGrid}>
              <CostGovernanceCard payload={costs} />
              {(costs?.agents || []).slice(0, 3).map((agent) => (
                <div className={styles.providerCard} key={agent.agent || 'unknown'}>
                  <div className={styles.providerHead}>
                    <strong className={styles.providerName}>{agent.agent || 'unknown agent'}</strong>
                    <span className={styles.providerState}>read only</span>
                  </div>
                  <div className={styles.providerMeta}>
                    <span>{(agent.total_tokens ?? 0).toLocaleString()} tokens</span>
                    <span>{agent.request_count ?? 0} requests</span>
                    <span>${Number(agent.estimated_cost ?? 0).toFixed(4)}</span>
                  </div>
                  {agent.last_active && <p className={styles.providerNotes}>Last active: {new Date(agent.last_active).toLocaleString()}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Owner gates — read-only blocker visibility */}
      <section className={styles.providerSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>Owner Gates / Blockers</h2>
          <span className={styles.tierSub}>
            Read-only approval and credential blockers from <code>/api/bridge/owner-gates</code>
          </span>
        </header>
        {ownerGatesState === 'loading' && (
          <div className={styles.banner}>Loading owner gates from <code>/api/bridge/owner-gates</code>…</div>
        )}
        {ownerGatesState === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <strong>Could not load owner gates:</strong> {ownerGatesError}
          </div>
        )}
        {ownerGatesState === 'ok' && (
          <>
            <div className={styles.providerSummary}>
              <span>mode: {ownerGates?.mode || 'bridge_owner_gates_read_only'}</span>
              <span>{ownerGates?.summary?.total ?? ownerGates?.gates?.length ?? 0} gates</span>
              <span>owner approval: {ownerGates?.summary?.owner_approval_required ?? 0}</span>
              <span>credential related: {ownerGates?.summary?.credential_related ?? 0}</span>
              <span>execution enabled: {ownerGates?.summary?.execution_enabled ?? 0}</span>
              <span>writes enabled: {ownerGates?.summary?.writes_enabled ?? 0}</span>
              {Object.entries(ownerGates?.summary?.by_state || {}).map(([state, count]) => (
                <span key={state}>{state.replace(/_/g, ' ')}: {count}</span>
              ))}
            </div>
            <div className={styles.preflightNotice}>
              Owner gates are visibility only. Mission Control is not sending approval requests, changing credentials, applying migrations, enabling connector execution, or writing to Zapier from this panel.
            </div>
            <div className={styles.providerGrid}>
              {(ownerGates?.gates || []).slice(0, 6).map((gate) => (
                <OwnerGateCard key={gate.id} gate={gate} />
              ))}
            </div>
            {ownerGates?.canonical_next_step && (
              <div className={styles.preflightNotice}>{ownerGates.canonical_next_step}</div>
            )}
          </>
        )}
      </section>

      {/* Bridge Mode preflight visibility — no execution */}
      <section className={styles.providerSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>Latest Bridge Mode Preflight</h2>
          <span className={styles.tierSub}>
            Read-only route selection from <code>/api/bridge/preflight</code>
          </span>
        </header>
        {preflightState === 'loading' && (
          <div className={styles.banner}>Loading read-only preflight from <code>/api/bridge/preflight</code>…</div>
        )}
        {preflightState === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <strong>Could not load Bridge Mode preflight:</strong> {preflightError}
          </div>
        )}
        {preflightState === 'ok' && (
          <>
            <div className={styles.providerSummary}>
              <span>mode: {statusPreflight?.mode || 'bridge_preflight_read_only'}</span>
              <span>status check: {statusPreflight?.preflight?.decision || 'unknown'}</span>
              <span>Zapier write check: {zapierPreflight?.preflight?.decision || 'unknown'}</span>
              <span>execution: disabled</span>
              <span>approval request: not created</span>
            </div>
            <div className={styles.preflightNotice}>
              Zapier protected writes check credentials first. If credentials are missing, Bridge Mode reports <strong>CREDENTIAL_REQUIRED</strong>. Once credentials exist, writes still remain locked as <strong>OWNER_APPROVAL_REQUIRED</strong> / HTTP 423 until approval persistence, audit chain, and scoped execution are implemented.
            </div>
            <div className={styles.providerGrid}>
              <PreflightCard title="Current status preflight" payload={statusPreflight} />
              <PreflightCard title="Protected Zapier write preflight" payload={zapierPreflight} />
            </div>
          </>
        )}
      </section>

      {/* Button contract states — no silent actions */}
      <section className={styles.providerSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>Button Contract States</h2>
          <span className={styles.tierSub}>
            Live UI action contract from <code>/api/bridge/button-contracts</code>
          </span>
        </header>
        {buttonContractsState === 'loading' && (
          <div className={styles.banner}>Loading button contracts from <code>/api/bridge/button-contracts</code>…</div>
        )}
        {buttonContractsState === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <strong>Could not load button contracts:</strong> {buttonContractsError}
          </div>
        )}
        {buttonContractsState === 'ok' && (
          <>
            <div className={styles.providerSummary}>
              <span>{buttonContracts?.summary?.total ?? buttonContracts?.buttons?.length ?? 0} actions mapped</span>
              <span>protected actions: {buttonContracts?.summary?.protected_actions ?? 0}</span>
              <span>audit required: {buttonContracts?.summary?.audit_required ?? 0}</span>
              <span>blocked: {buttonContracts?.summary?.blocked_buttons ?? 0}</span>
              <span>safe now: {buttonContracts?.summary?.executable_now ?? 0}</span>
              <span>fake success: {buttonContracts?.no_fake_success ? 'blocked' : 'unknown'}</span>
            </div>
            <div className={styles.preflightNotice}>
              Every visible action must map to exactly one state: LIVE, READ_ONLY, BACKEND_REQUIRED, CREDENTIAL_REQUIRED, OWNER_APPROVAL_REQUIRED, or DISABLED. Missing backend, missing credential, and owner-approval states must be visible and must not fake success.
            </div>
            {buttonContracts?.route_summary && buttonContracts.route_summary.length > 0 && (
              <>
                <h3 className={styles.subhead}>Route coverage</h3>
                <div className={styles.providerGrid}>
                  {buttonContracts.route_summary.map((route) => (
                    <ButtonRouteSummaryCard key={route.route} route={route} />
                  ))}
                </div>
              </>
            )}
            <h3 className={styles.subhead}>Blocked or read-only action details</h3>
            <div className={styles.providerGrid}>
              {(buttonContracts?.buttons || [])
                .filter((button) => button.state !== 'LIVE')
                .slice(0, 12)
                .map((button) => (
                  <ButtonContractCard key={`${button.route}:${button.label}:${button.endpoint || 'local'}`} button={button} />
                ))}
            </div>
          </>
        )}
      </section>

      {/* Executive report preview — no PDF, no Telegram send */}
      <section className={styles.providerSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>Executive Report Preview</h2>
          <span className={styles.tierSub}>
            Read-only preview from <code>/api/bridge/executive-report-preview</code>
          </span>
        </header>
        {executivePreviewState === 'waiting' && (
          <div className={styles.banner}>Waiting for latest Bridge Mode preflight before preparing an executive summary preview…</div>
        )}
        {executivePreviewState === 'loading' && (
          <div className={styles.banner}>Loading read-only executive report preview…</div>
        )}
        {executivePreviewState === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <strong>Could not load executive report preview:</strong> {executivePreviewError}
          </div>
        )}
        {executivePreviewState === 'ok' && (
          <>
            <div className={styles.providerSummary}>
              <span>mode: {executivePreview?.mode || 'executive_report_preview_read_only'}</span>
              <span>PDF: {executivePreview?.pdf_status || 'BACKEND_REQUIRED'}</span>
              <span>Telegram approval: {executivePreview?.telegram_approval_status || 'BACKEND_REQUIRED'}</span>
              <span>execution: disabled</span>
              <span>persistence: not connected</span>
            </div>
            <div className={styles.preflightNotice}>
              This is a preview only. Mission Control is not writing a PDF, sending Telegram approvals, creating approval records, or executing any connector action yet.
            </div>
            <div className={styles.providerGrid}>
              <ExecutiveReportPreviewCard payload={executivePreview} />
            </div>
          </>
        )}
      </section>

      {/* Telegram approval preview — no send, no approval creation */}
      <section className={styles.providerSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>Telegram Approval Preview</h2>
          <span className={styles.tierSub}>
            Disabled Tony-to-Telegram preview from <code>/api/bridge/telegram-approval-preview</code>
          </span>
        </header>
        {telegramApprovalPreviewState === 'waiting' && (
          <div className={styles.banner}>Waiting for protected-action preflight before preparing a Telegram approval preview…</div>
        )}
        {telegramApprovalPreviewState === 'loading' && (
          <div className={styles.banner}>Loading disabled Telegram approval preview…</div>
        )}
        {telegramApprovalPreviewState === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <strong>Could not load Telegram approval preview:</strong> {telegramApprovalPreviewError}
          </div>
        )}
        {telegramApprovalPreviewState === 'ok' && (
          <>
            <div className={styles.providerSummary}>
              <span>mode: {telegramApprovalPreview?.mode || 'telegram_approval_preview_read_only'}</span>
              <span>send: disabled</span>
              <span>callback: backend required</span>
              <span>approval created: no</span>
              <span>execution: disabled</span>
            </div>
            <div className={styles.preflightNotice}>
              This preview shows the future owner approval message only. Mission Control is not sending Telegram messages, creating approval rows, or unlocking protected execution.
            </div>
            <div className={styles.providerGrid}>
              <TelegramApprovalPreviewCard payload={telegramApprovalPreview} />
            </div>
          </>
        )}
      </section>

      {/* Approval/audit readiness — no migration */}
      <section className={styles.providerSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>Approval Queue (Tony → Telegram)</h2>
          <span className={styles.tierSub}>
            Read-only readiness. Approval channel is <strong>Tony → Telegram</strong>; Mission Control records the decision.
          </span>
        </header>
        {approvalReadinessState === 'loading' && (
          <div className={styles.banner}>Loading approval readiness from <code>/api/bridge/approval-readiness</code>…</div>
        )}
        {approvalReadinessState === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <strong>Could not load approval readiness:</strong> {approvalReadinessError}
          </div>
        )}
        {approvalReadinessState === 'ok' && (
          <>
            <div className={styles.providerSummary}>
              <span>mode: {approvalReadiness?.mode || 'approval_audit_readiness_read_only'}</span>
              <span>state: {approvalReadiness?.current_state || 'unknown'}</span>
              <span>queue: {approvalReadiness?.approval_queue_state || 'unknown'}</span>
              <span>migration applied: {approvalReadiness?.production_migration_applied ? 'yes' : 'no'}</span>
              <span>execution: disabled</span>
            </div>
            <div className={styles.preflightNotice}>
              <p>
                Approval Queue is being prepared. Protected actions cannot execute yet. When enabled,
                agents will send approval requests to <strong>Tony</strong>, and Tony will send the
                owner one-click <strong>Approve / Deny</strong> messages in <strong>Telegram</strong>.
              </p>
              <p>
                Tony is the approval representative to the owner. Agents do not contact the owner directly
                for every approval — Tony consolidates and represents.
              </p>
              <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                <li>Current state: <strong>{approvalReadiness?.production_migration_applied ? 'READ_ONLY' : 'BACKEND_REQUIRED'}</strong></li>
                <li>Approval channel: <strong>Tony → Telegram</strong></li>
                <li>Execution state: <strong>locked</strong></li>
                <li>What is missing: {approvalReadiness?.production_migration_applied ? 'Telegram approval callback + owner-approved execution runners' : 'approval/audit DB persistence + Telegram approval callback'}</li>
                <li>Pending approvals: <strong>{approvalQueue?.summary?.pending ?? 0}</strong>{approvalQueue?.approval_queue_connected ? ' visible in read-only mode' : ' (queue not connected)'}</li>
                <li>Next backend step: approval/audit migration + Telegram approval queue API</li>
              </ul>
              <p style={{ marginTop: 8 }}>
                This panel does not apply migrations, send approvals, or unlock connector execution.
                It only reflects readiness.
              </p>
            </div>
            <div className={styles.providerGrid}>
              <ApprovalReadinessCard payload={approvalReadiness} />
              {approvalQueueState === 'loading' && (
                <div className={styles.providerCard}>
                  <div className={styles.providerHead}>
                    <strong className={styles.providerName}>Approval Queue</strong>
                    <span className={styles.providerState}>loading</span>
                  </div>
                  <p className={styles.providerNotes}>Loading read-only approval queue from <code>/api/bridge/approval-requests</code>…</p>
                </div>
              )}
              {approvalQueueState === 'error' && (
                <div className={styles.providerCard}>
                  <div className={styles.providerHead}>
                    <strong className={styles.providerName}>Approval Queue</strong>
                    <span className={styles.providerState}>error</span>
                  </div>
                  <p className={styles.providerAction}>Could not load approval queue: {approvalQueueError}</p>
                </div>
              )}
              {approvalQueueState === 'ok' && <ApprovalQueueCard payload={approvalQueue} />}
            </div>
          </>
        )}
      </section>

      {/* Connector readiness — no execution */}
      <section className={styles.providerSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>Connector Readiness</h2>
          <span className={styles.tierSub}>
            Read-only connector state from <code>/api/bridge/connector-readiness</code>
          </span>
        </header>
        {connectorState === 'loading' && (
          <div className={styles.banner}>Loading connector readiness from <code>/api/bridge/connector-readiness</code>…</div>
        )}
        {connectorState === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <strong>Could not load connector readiness:</strong> {connectorError}
          </div>
        )}
        {connectorState === 'ok' && (
          <>
            <div className={styles.providerSummary}>
              <span>mode: {connectors?.mode || 'read-only'}</span>
              <span>{connectors?.summary?.total ?? connectors?.connectors?.length ?? 0} connectors</span>
              <span>execution enabled: {connectors?.summary?.execution_enabled ?? 0}</span>
              <span>writes enabled: {connectors?.summary?.writes_enabled ?? 0}</span>
              <span>approval required: {connectors?.summary?.owner_approval_required_for_execution ?? 0}</span>
              {Object.entries(connectors?.summary?.by_state || {}).map(([state, count]) => (
                <span key={state}>{state.replace(/_/g, ' ')}: {count}</span>
              ))}
            </div>
            <div className={styles.providerGrid}>
              {(connectors?.connectors || []).map((connector) => (
                <ConnectorCard key={connector.id} connector={connector} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Bridge provider registry — read-only */}
      <section className={styles.providerSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>Bridge Provider Registry</h2>
          <span className={styles.tierSub}>
            Live read-only snapshot from <code>/api/bridge/providers</code>
          </span>
        </header>
        {providerState === 'loading' && (
          <div className={styles.banner}>Loading provider status from <code>/api/bridge/providers</code>…</div>
        )}
        {providerState === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <strong>Could not load provider status:</strong> {providerError}
          </div>
        )}
        {providerState === 'ok' && (
          <>
            <div className={styles.providerSummary}>
              <span>{providers?.summary?.total ?? providers?.providers?.length ?? 0} providers</span>
              {Object.entries(providers?.summary?.by_state || {}).map(([state, count]) => (
                <span key={state}>{providerStateLabel(state as ProviderState)}: {count}</span>
              ))}
            </div>
            <div className={styles.providerGrid}>
              {(providers?.providers || []).map((provider) => (
                <ProviderCard key={provider.id} provider={provider} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* External / tailnet entities */}
      <section className={styles.externalSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>External / Tailnet</h2>
          <span className={styles.tierSub}>
            Entities outside the Mission Control registry — read-only Phase A view
          </span>
        </header>
        <div className={styles.externalGrid}>
          <ExternalCard
            title="Agent Zero"
            badge="Tailnet-only"
            description="External agent runtime. Container running on Tailnet IP only — no public exposure. Phase A: visibility only."
            details={[
              { label: 'Image', value: 'agent0ai/agent-zero:latest' },
              { label: 'Tailnet endpoint', value: '100.116.35.95:50080' },
              { label: 'Public exposure', value: 'NONE (by design)' },
              { label: 'Mount', value: '/home/tony/agent-zero-deploy/data → /a0' },
              { label: 'Phase A access', value: 'read-only' },
            ]}
          />
          <ExternalCard
            title="Hermes Agent"
            badge={hermes.installed ? 'Sandbox installed' : 'Not installed'}
            description={
              hermes.installed
                ? 'Sandbox-only install. CLI works under isolated HERMES_HOME. Not operational in production.'
                : 'Sandbox folder not detected. Install per /home/tony/claudeclaw/runtime/hermes-sandbox-install-report.md.'
            }
            details={[
              { label: 'Path', value: hermes.path || '(not present)' },
              { label: 'Version', value: hermes.version || '(unknown)' },
              { label: 'Production wiring', value: 'NONE — sandbox-only' },
              { label: 'HERMES_HOME', value: '/home/tony/sandbox/hermes-home-* (isolated)' },
              { label: 'Phase A access', value: 'read-only status display' },
            ]}
          />
          <ExternalCard
            title="OpenClaw Gateway"
            badge="HTTP 200"
            description="Local gateway providing OpenClaw runtime services. Read-only health surface."
            details={[
              { label: 'Local endpoint', value: 'http://127.0.0.1:18789' },
              { label: 'Public endpoint', value: 'https://gw.knowledge-vs-ai.com' },
              { label: 'Status (last check)', value: '200 OK (healthy)' },
              { label: 'Phase A access', value: 'read-only health' },
            ]}
            showPhaseB={false}
          />
          <ExternalCard
            title="Bridge Mode"
            badge={capabilities?.mode ? 'Read-only MVP live' : bridge.plansFound > 0 ? `${bridge.plansFound} plans on disk` : 'No plans found'}
            description="Central tool/model/skill/integration tunnel. Read-only MVP is live; protected execution remains locked."
            details={[
              { label: 'Capability matrix', value: '/api/bridge/capability-matrix' },
              { label: 'Connector readiness', value: '/api/bridge/connector-readiness' },
              { label: 'Execution enabled', value: capabilities?.no_execution_enabled ? 'NO' : 'unknown' },
              { label: 'Connector writes', value: String(capabilities?.summary?.connector_writes_enabled ?? 0) },
              { label: 'Status', value: 'READ-ONLY MVP — approval/audit persistence required before execution' },
            ]}
            showPhaseB={false}
          />
        </div>
      </section>

      {/* Footer with Phase B notice */}
      <footer className={styles.footer}>
        <div className={styles.footerNote}>
          <strong>Phase B</strong> — full mutation surface (8 DB tables · ~18 API routes · SSE for brain_sync &amp; harness · TTL job for approvals · server-enforced HTTP 423 for Tony/Agent 0 · audit-chain double-emit) is gated on per-item owner approval. See <code>.designer-review/path-a-section-2-agent-network-refinement.md</code>.
        </div>
        <div className={styles.footerMeta}>
          <span>© 2025 To-Knowledge</span>
          <span className={styles.footerDot} />
          <span>Path A · Section 2 · Phase A</span>
          <span className={styles.footerDot} />
          <span>Read-only</span>
        </div>
      </footer>
    </main>
  )
}
