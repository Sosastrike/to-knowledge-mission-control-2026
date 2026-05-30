import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { recordJarvisAudit } from '@/lib/jarvis-audit'
import { redactHermesValue } from '@/lib/hermes-policy'
import { SPACEAGENT_ALLOWED_SCOPE, SPACEAGENT_FORBIDDEN_ACTIONS, SPACEAGENT_IDENTITY } from '@/lib/spaceagent-identity'

export type SpaceAgentToolClassification =
  | 'READ_ONLY'
  | 'WRITE_GATED'
  | 'CREDENTIAL_REQUIRED'
  | 'PERMISSION_REQUIRED'
  | 'UNSAFE_DISABLED'

type SpaceAgentRecordKind =
  | 'spaceagent_recommendation'
  | 'spaceagent_task_plan'
  | 'spaceagent_report_draft'
  | 'spaceagent_jarvis_concurrence_request'

export type SpaceAgentInternalRecord = {
  id: string
  rollback_id: string
  at: string
  kind: SpaceAgentRecordKind
  title: string
  payload: Record<string, unknown>
  requested_by: 'spaceagent'
  reports_to: 'agent-zero-jarvis'
  jarvis_final_authority: true
  opencloud_intermediary: false
  external_execution_enabled: false
  credential_values_exposed: false
  audit_hash: string
  rollback_policy: string
}

type SpaceAgentWriteResult =
  | {
      ok: true
      route: string
      mode: 'spaceagent_internal_record_written'
      record: SpaceAgentInternalRecord
      audit_record_written: true
      audit_hash: string
      rollback_id: string
      writes_enabled: true
      execution_enabled: false
      external_execution_enabled: false
      credential_values_exposed: false
      jarvis_final_authority: true
      opencloud_intermediary: false
    }
  | SpaceAgentBlockedResult

export type SpaceAgentBlockedResult = {
  ok: false
  route: 'bridge.spaceagent.execute'
  mode: 'blocked_before_execution'
  exact_blocker: 'spaceagent_requires_jarvis_concurrence'
  audit_record_written: false
  rollback_id: null
  writes_enabled: false
  execution_enabled: false
  external_execution_enabled: false
  credential_values_exposed: false
  jarvis_final_authority: true
  reports_to: 'agent-zero-jarvis'
  opencloud_intermediary: false
}

const storePath = join(config.dataDir, 'spaceagent-internal-records.json')

function readRows(): SpaceAgentInternalRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRows(rows: SpaceAgentInternalRecord[]) {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function safeString(value: unknown, fallback: string) {
  const text = String(value || '').trim()
  return text || fallback
}

function commonInvariants() {
  return {
    ...SPACEAGENT_IDENTITY,
    allowed_scope: [...SPACEAGENT_ALLOWED_SCOPE],
    forbidden_actions: [...SPACEAGENT_FORBIDDEN_ACTIONS],
    can_act_as_opencloud: false,
    can_be_hidden_intermediary: false,
    hidden_intermediary_allowed: false,
    opencloud_intermediary: false,
    openclaw_intermediary: false,
    opencloud_used: false,
    credential_values_exposed: false,
    no_secrets_exposed: true,
    raw_env_values_exposed: false,
    raw_paths_exposed: false,
    external_execution_enabled: false,
    execution_enabled: false,
    protected_execution_enabled: false,
    broad_connector_execution_enabled: false,
    public_exposure_created: false,
  }
}

export function buildSpaceAgentStatus() {
  const records = listSpaceAgentInternalRecords(20)
  return {
    ...commonInvariants(),
    route: 'bridge.spaceagent.status',
    status: 'SPACEAGENT_DIRECT_LINE_REGISTERED',
    state: 'READ_ONLY_READY',
    direct_line_route: SPACEAGENT_IDENTITY.direct_line_route,
    legacy_direct_line_route: SPACEAGENT_IDENTITY.legacy_gateway_route,
    readiness_route: '/api/bridge/spaceagent/readiness',
    authority_route: '/api/bridge/spaceagent/authority',
    capability_map_route: '/api/bridge/spaceagent/capability-map',
    recommendation_route: '/api/bridge/spaceagent/recommendation',
    task_plan_route: '/api/bridge/spaceagent/task-plan',
    report_draft_route: '/api/bridge/spaceagent/report-draft',
    jarvis_concurrence_request_route: '/api/bridge/spaceagent/jarvis-concurrence-request',
    trace_route: '/api/bridge/agent-routing/trace/live?agent=spaceagent',
    writes_enabled: false,
    internal_record_count: records.length,
    operational_scope: 'read_only_or_internal_records_exact_scope_requests_only',
  }
}

export function buildSpaceAgentReadiness() {
  return {
    ...commonInvariants(),
    route: 'bridge.spaceagent.readiness',
    status: 'SPACEAGENT_READINESS_GATEWAY_REGISTERED',
    readiness_states: ['READ_ONLY_READY', 'WRITE_GATED', 'CREDENTIAL_REQUIRED', 'BRIDGE_SESSION_REQUIRED', 'NOT_CERTIFIED'] as const,
    final_certification_status: 'NOT_CERTIFIED',
    direct_line_trace_required: true,
    agent_hub_proof_required: true,
    gateway_graph_proof_required: true,
    pipeline_proof_required: true,
    authenticated_owner_session_proof_required: true,
    writes_enabled: false,
    blockers: [
      'final_authenticated_direct_line_probe_pending',
      'pipeline_run_proof_pending',
      'jarvis_concurrence_required_for_production',
    ],
    next_safe_lane: 'run direct-line trace and internal report/concurrence proof without external execution',
  }
}

export function buildSpaceAgentAuthority() {
  return {
    ...commonInvariants(),
    route: 'bridge.spaceagent.authority',
    status: 'SPACEAGENT_AUTHORITY_POLICY_READY',
    authority_chain: ['owner', 'agent-zero-jarvis', 'spaceagent'],
    may_read_gateway_state: true,
    may_read_brain_state: true,
    may_create_internal_recommendations: true,
    may_create_task_plan_drafts: true,
    may_create_report_drafts: true,
    may_create_jarvis_concurrence_requests: true,
    may_update_visible_task_events: true,
    may_execute_external_writes: false,
    may_execute_production_changes: false,
    may_receive_raw_credentials: false,
    may_use_opencloud_as_intermediary: false,
    jarvis_concurrence_required_for_production: true,
    production_execution: SPACEAGENT_IDENTITY.production_execution,
    writes_enabled: false,
  }
}

export function buildSpaceAgentCapabilityMap() {
  return {
    ...commonInvariants(),
    route: 'bridge.spaceagent.capability-map',
    status: 'SPACEAGENT_CAPABILITY_MAP_READY',
    tools: [
      { id: 'gateway.status.read', label: 'Gateway Status Read', classification: 'READ_ONLY' as SpaceAgentToolClassification, state: 'READ_ONLY_READY', execution_enabled: false },
      { id: 'brain.status.read', label: 'Brain Status Read', classification: 'READ_ONLY' as SpaceAgentToolClassification, state: 'READ_ONLY_READY', execution_enabled: false },
      { id: 'task.list.read', label: 'Mission Control Task Read', classification: 'READ_ONLY' as SpaceAgentToolClassification, state: 'READ_ONLY_READY', execution_enabled: false },
      { id: 'task.event.write', label: 'Visible Task Event Draft', classification: 'WRITE_GATED' as SpaceAgentToolClassification, state: 'WRITE_GATED', execution_enabled: false },
      { id: 'report.draft', label: 'Report Draft', classification: 'WRITE_GATED' as SpaceAgentToolClassification, state: 'WRITE_GATED', execution_enabled: false },
      { id: 'jarvis.concurrence.request', label: 'Jarvis Concurrence Request', classification: 'WRITE_GATED' as SpaceAgentToolClassification, state: 'WRITE_GATED', execution_enabled: false },
      { id: 'public_webpage_read', label: 'Public Webpage Read', classification: 'READ_ONLY' as SpaceAgentToolClassification, state: 'READ_ONLY_READY', execution_enabled: false },
      { id: 'youtube_transcript', label: 'YouTube Transcript', classification: 'PERMISSION_REQUIRED' as SpaceAgentToolClassification, state: 'PERMISSION_REQUIRED', execution_enabled: false },
      { id: 'firecrawl.read', label: 'Firecrawl Read', classification: 'CREDENTIAL_REQUIRED' as SpaceAgentToolClassification, state: 'CREDENTIAL_REQUIRED', execution_enabled: false },
      { id: 'playwright_mcp_local_only', label: 'Playwright MCP Local Evidence', classification: 'PERMISSION_REQUIRED' as SpaceAgentToolClassification, state: 'BRIDGE_SESSION_REQUIRED', execution_enabled: false },
      { id: 'broad_connector_execution', label: 'Broad Connector Execution', classification: 'UNSAFE_DISABLED' as SpaceAgentToolClassification, state: 'UNSAFE_DISABLED', execution_enabled: false },
    ],
    brain_access: {
      read_status: 'READ_ONLY_READY',
      canonical_truth_read: 'READ_ONLY_READY',
      memory_write_execution: 'WRITE_GATED',
      memory_write_request_only: true,
    },
    pipeline_templates: [
      'spaceagent_readiness_probe',
      'spaceagent_recommendation_draft',
      'spaceagent_report_draft',
      'jarvis_concurrence_gate',
      'owner_visible_task_update',
    ],
    writes_enabled: false,
  }
}

export function listSpaceAgentInternalRecords(limit = 50) {
  return readRows().slice(0, limit)
}

function routeForRecordKind(kind: SpaceAgentRecordKind) {
  return {
    spaceagent_recommendation: 'bridge.spaceagent.recommendation',
    spaceagent_task_plan: 'bridge.spaceagent.task_plan',
    spaceagent_report_draft: 'bridge.spaceagent.report_draft',
    spaceagent_jarvis_concurrence_request: 'bridge.spaceagent.jarvis_concurrence_request',
  }[kind]
}

function createRecord(
  kind: SpaceAgentRecordKind,
  title: string,
  payload: Record<string, unknown>,
  rollbackPolicy: string,
): SpaceAgentWriteResult {
  const safePayload = redactHermesValue({
    requested_by: 'spaceagent',
    reports_to: 'agent-zero-jarvis',
    final_authority: 'agent-zero-jarvis',
    opencloud_intermediary: false,
    external_execution_enabled: false,
    credential_values_exposed: false,
    production_execution: SPACEAGENT_IDENTITY.production_execution,
    ...payload,
  }) as Record<string, unknown>
  const audit = recordJarvisAudit({
    actor: 'spaceagent',
    event: `spaceagent_${kind}`,
    target: title,
    classification: 'internal_state_write',
    detail: {
      kind,
      rollback_policy: rollbackPolicy,
      jarvis_final_authority: true,
      reports_to: 'agent-zero-jarvis',
      external_execution_enabled: false,
      payload: safePayload,
    },
  })
  const record: SpaceAgentInternalRecord = {
    id: `spa_${randomUUID()}`,
    rollback_id: `sprb_${randomUUID()}`,
    at: new Date().toISOString(),
    kind,
    title,
    payload: safePayload,
    requested_by: 'spaceagent',
    reports_to: 'agent-zero-jarvis',
    jarvis_final_authority: true,
    opencloud_intermediary: false,
    external_execution_enabled: false,
    credential_values_exposed: false,
    audit_hash: audit.hash,
    rollback_policy: rollbackPolicy,
  }
  writeRows([record, ...readRows()])

  return {
    ok: true,
    route: routeForRecordKind(kind),
    mode: 'spaceagent_internal_record_written',
    record,
    audit_record_written: true,
    audit_hash: audit.hash,
    rollback_id: record.rollback_id,
    writes_enabled: true,
    execution_enabled: false,
    external_execution_enabled: false,
    credential_values_exposed: false,
    jarvis_final_authority: true,
    opencloud_intermediary: false,
  }
}

export function createSpaceAgentRecommendation(input: {
  title: string
  recommendation: string
  target_system?: string
  risk_level?: 'low' | 'medium' | 'high'
}) {
  return createRecord(
    'spaceagent_recommendation',
    safeString(input.title, 'SpaceAgent recommendation'),
    {
      title: safeString(input.title, 'SpaceAgent recommendation'),
      recommendation: safeString(input.recommendation, ''),
      target_system: input.target_system ? String(input.target_system) : undefined,
      risk_level: input.risk_level === 'medium' || input.risk_level === 'high' ? input.risk_level : 'low',
      activation_requires: 'jarvis_concurrence_for_production',
    },
    'Archive the exact SpaceAgent recommendation record by rollback_id; no production state changed.',
  )
}

export function createSpaceAgentTaskPlan(input: {
  title: string
  objective: string
  next_safe_lane?: string
  visible_task_id?: string
}) {
  return createRecord(
    'spaceagent_task_plan',
    safeString(input.title, 'SpaceAgent task plan'),
    {
      title: safeString(input.title, 'SpaceAgent task plan'),
      objective: safeString(input.objective, ''),
      next_safe_lane: input.next_safe_lane ? String(input.next_safe_lane) : 'continue safe read-only and draft lanes',
      visible_task_id: input.visible_task_id,
      activation_requires: 'visible_task_event_and_jarvis_concurrence_for_production',
    },
    'Close the exact SpaceAgent task plan as superseded; no production state changed.',
  )
}

export function createSpaceAgentReportDraft(input: {
  title: string
  summary: string
  findings?: unknown
  visible_task_id?: string
}) {
  return createRecord(
    'spaceagent_report_draft',
    safeString(input.title, 'SpaceAgent report draft'),
    {
      title: safeString(input.title, 'SpaceAgent report draft'),
      summary: safeString(input.summary, ''),
      findings: input.findings || [],
      visible_task_id: input.visible_task_id,
      report_visibility: 'owner_visible_internal_record',
    },
    'Archive the exact SpaceAgent report draft by rollback_id; no production state changed.',
  )
}

export function createSpaceAgentJarvisConcurrenceRequest(input: {
  request_id?: string
  action_type?: string
  affected_system?: string
  reason?: string
  exact_scope?: unknown
  rollback_path?: string
  audit_path?: string
  visible_task_id?: string
}) {
  const requestId = safeString(input.request_id, 'spaceagent-jarvis-concurrence-request')
  return createRecord(
    'spaceagent_jarvis_concurrence_request',
    requestId,
    {
      ...input,
      request_id: requestId,
      requested_by: 'spaceagent',
      target_authority: 'agent-zero-jarvis',
      jarvis_response_contract: ['approved', 'rejected', 'needs_owner', 'needs_credential', 'needs_sudo'],
      jarvis_final_authority: true,
      opencloud_intermediary: false,
      credential_values_exposed: false,
    },
    input.rollback_path || 'Close the exact SpaceAgent concurrence request as superseded; Jarvis remains final authority.',
  )
}

export function refuseSpaceAgentProductionExecution(input: Record<string, unknown> = {}): SpaceAgentBlockedResult & {
  requested_action: Record<string, unknown>
} {
  return {
    ok: false,
    route: 'bridge.spaceagent.execute',
    mode: 'blocked_before_execution',
    exact_blocker: 'spaceagent_requires_jarvis_concurrence',
    requested_action: redactHermesValue(input) as Record<string, unknown>,
    audit_record_written: false,
    rollback_id: null,
    writes_enabled: false,
    execution_enabled: false,
    external_execution_enabled: false,
    credential_values_exposed: false,
    jarvis_final_authority: true,
    reports_to: 'agent-zero-jarvis',
    opencloud_intermediary: false,
  }
}
