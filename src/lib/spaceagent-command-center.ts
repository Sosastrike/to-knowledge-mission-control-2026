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

export const SPACEAGENT_PIPELINE_NAME = 'SpaceAgent Gateway Integration Pipeline'

export const SPACEAGENT_PIPELINE_TEMPLATES = [
  {
    id: 'spaceagent_readiness_probe',
    label: 'SpaceAgent readiness probe',
    route: '/api/bridge/spaceagent/readiness',
    state: 'READ_ONLY_READY',
    external_execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: false,
  },
  {
    id: 'spaceagent_recommendation_draft',
    label: 'SpaceAgent recommendation draft',
    route: '/api/bridge/spaceagent/recommendation',
    state: 'WRITE_GATED',
    external_execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
  },
  {
    id: 'spaceagent_report_draft',
    label: 'SpaceAgent report draft',
    route: '/api/bridge/spaceagent/report-draft',
    state: 'WRITE_GATED',
    external_execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
  },
  {
    id: 'owner_visible_task_update',
    label: 'Owner-visible task update',
    route: '/api/tasks/:id/events',
    state: 'WRITE_GATED',
    external_execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
  },
  {
    id: 'jarvis_concurrence_gate',
    label: 'Jarvis concurrence gate',
    route: '/api/bridge/spaceagent/jarvis-concurrence-request',
    state: 'WRITE_GATED',
    external_execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
  },
] as const

export const SPACEAGENT_BRAIN_SOURCE_LABELS = [
  'mission_control_live',
  'gateway_tool_state',
  'paperclip_state',
  'ron_dispatch_advice',
  'spaceagent_report',
] as const

export const SPACEAGENT_BRAIN_LANES = [
  { id: 'brain_bridge_gateway', route: '/api/bridge/brain-sync/gateway-status', state: 'READY', writes_enabled: false },
  { id: 'brain_bridge_events', route: '/api/bridge/brain-sync/events', state: 'LIVE_READ_ONLY', writes_enabled: false },
  { id: 'obsidian', route: '/api/bridge/brain-sync/obsidian/status', state: 'LIVE_READ_ONLY', writes_enabled: false },
  { id: 'mempalace', route: '/api/bridge/brain-sync/mempalace/status', state: 'LIVE_READ_ONLY', writes_enabled: false },
  { id: 'graphify', route: '/api/bridge/brain-sync/graphify/status', state: 'LIVE_READ_ONLY', writes_enabled: false },
  { id: 'build_wiki', route: '/api/bridge/brain-sync/build-wiki/status', state: 'EVENT_STREAM_REQUIRED', writes_enabled: false },
  { id: 'memory_approvals', route: '/api/bridge/brain-sync/memory-approvals/status', state: 'WRITE_GATED', writes_enabled: false },
  { id: 'memory_write_request', route: '/api/bridge/brain-sync/memory/write-request', state: 'WRITE_GATED', writes_enabled: false },
] as const

export const SPACEAGENT_TOOL_MAP = [
  {
    id: 'gateway.status.read',
    label: 'Gateway Status Read',
    route: '/api/gateway/status',
    classification: 'READ_ONLY' as SpaceAgentToolClassification,
    state: 'READ_ONLY_READY',
    execution_enabled: false,
    credential_brokered: false,
  },
  {
    id: 'brain.status.read',
    label: 'Brain Status Read',
    route: '/api/bridge/spaceagent/brain-status',
    classification: 'READ_ONLY' as SpaceAgentToolClassification,
    state: 'READ_ONLY_READY',
    execution_enabled: false,
    credential_brokered: false,
  },
  {
    id: 'paperclip.workspace.read',
    label: 'Paperclip Workspace Read',
    route: '/api/bridge/paperclip/workspace-truth',
    classification: 'READ_ONLY' as SpaceAgentToolClassification,
    state: 'READ_ONLY_READY',
    execution_enabled: false,
    credential_brokered: false,
  },
  {
    id: 'task.list.read',
    label: 'Mission Control Task Read',
    route: '/api/tasks',
    classification: 'READ_ONLY' as SpaceAgentToolClassification,
    state: 'READ_ONLY_READY',
    execution_enabled: false,
    credential_brokered: false,
  },
  {
    id: 'task.event.write',
    label: 'Visible Task Event Draft',
    route: '/api/tasks/:id/events',
    classification: 'WRITE_GATED' as SpaceAgentToolClassification,
    state: 'WRITE_GATED',
    execution_enabled: false,
    credential_brokered: false,
  },
  {
    id: 'report.draft',
    label: 'Report Draft',
    route: '/api/bridge/spaceagent/report-draft',
    classification: 'WRITE_GATED' as SpaceAgentToolClassification,
    state: 'WRITE_GATED',
    execution_enabled: false,
    credential_brokered: false,
  },
  {
    id: 'jarvis.concurrence.request',
    label: 'Jarvis Concurrence Request',
    route: '/api/bridge/spaceagent/jarvis-concurrence-request',
    classification: 'WRITE_GATED' as SpaceAgentToolClassification,
    state: 'WRITE_GATED',
    execution_enabled: false,
    credential_brokered: false,
  },
  { id: 'public_webpage_read', label: 'Public Webpage Read', route: '/api/firecrawl/reader', classification: 'READ_ONLY' as SpaceAgentToolClassification, state: 'READ_ONLY_READY', execution_enabled: false, credential_brokered: true },
  { id: 'youtube_transcript', label: 'YouTube Transcript', route: '/api/youtube/transcript', classification: 'PERMISSION_REQUIRED' as SpaceAgentToolClassification, state: 'PERMISSION_REQUIRED', execution_enabled: false, credential_brokered: false },
  { id: 'firecrawl.read', label: 'Firecrawl Read', route: '/api/firecrawl/reader', classification: 'CREDENTIAL_REQUIRED' as SpaceAgentToolClassification, state: 'CREDENTIAL_REQUIRED', execution_enabled: false, credential_brokered: true },
  { id: 'playwright_mcp_local_only', label: 'Playwright MCP Local Evidence', route: '/api/bridge/playwright-mcp/status', classification: 'PERMISSION_REQUIRED' as SpaceAgentToolClassification, state: 'BRIDGE_SESSION_REQUIRED', execution_enabled: false, credential_brokered: false },
  { id: 'broad_connector_execution', label: 'Broad Connector Execution', route: null, classification: 'UNSAFE_DISABLED' as SpaceAgentToolClassification, state: 'UNSAFE_DISABLED', execution_enabled: false, credential_brokered: false },
] as const

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
    brain_status_route: '/api/bridge/spaceagent/brain-status',
    authority_route: '/api/bridge/spaceagent/authority',
    tool_map_route: '/api/bridge/spaceagent/tool-map',
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
    brain_bridge_proof_required: true,
    pipeline_proof_required: true,
    authenticated_owner_session_proof_required: true,
    writes_enabled: false,
    blockers: [
      'final_authenticated_direct_line_probe_pending',
      'pipeline_run_proof_pending',
      'jarvis_concurrence_required_for_production',
      'memory_write_execution_requires_approval_gate',
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
    may_recommend_memory_corrections: true,
    may_request_memory_write_approval: true,
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
    tools: SPACEAGENT_TOOL_MAP,
    brain_access: {
      read_status: 'READ_ONLY_READY',
      brain_status_route: '/api/bridge/spaceagent/brain-status',
      canonical_truth_read: 'READ_ONLY_READY',
      memory_write_execution: 'WRITE_GATED',
      memory_write_request_only: true,
      source_labels: SPACEAGENT_BRAIN_SOURCE_LABELS,
      live_routes_outrank_stale_memory: true,
      stale_memory_detection: 'mark_historical_before_removal',
    },
    brain_lanes: SPACEAGENT_BRAIN_LANES,
    pipeline_templates: SPACEAGENT_PIPELINE_TEMPLATES,
    pipeline_status_route: '/api/bridge/spaceagent/pipeline-status',
    tool_map_route: '/api/bridge/spaceagent/tool-map',
    writes_enabled: false,
  }
}


export function buildSpaceAgentToolMap() {
  const classifications = SPACEAGENT_TOOL_MAP.reduce<Record<SpaceAgentToolClassification, number>>((counts, tool) => {
    counts[tool.classification] += 1
    return counts
  }, {
    READ_ONLY: 0,
    WRITE_GATED: 0,
    CREDENTIAL_REQUIRED: 0,
    PERMISSION_REQUIRED: 0,
    UNSAFE_DISABLED: 0,
  })

  return {
    ...commonInvariants(),
    route: 'bridge.spaceagent.tool-map',
    status: 'SPACEAGENT_TOOL_MAP_GATEWAY_BROKERED',
    tool_count: SPACEAGENT_TOOL_MAP.length,
    classifications,
    tools: SPACEAGENT_TOOL_MAP,
    mcp_visibility: {
      registry_route: '/api/mcp',
      playwright_mcp_status_route: '/api/bridge/playwright-mcp/status',
      execution_policy: 'read_only_or_bridge_session_exact_scope',
    },
    provider_model_visibility: {
      route: '/api/bridge/providers',
      state: 'READ_ONLY_READY',
      raw_provider_keys_exposed: false,
    },
    credential_policy: {
      broker_route: '/api/bridge/credentials/status',
      values_exposed: false,
      brokered_credentials_by_name_only: true,
      agents_receive_raw_credentials: false,
    },
    proof: {
      gateway_brokered: true,
      no_opencloud_intermediary: true,
      no_external_execution: true,
      credential_values_exposed: false,
      rollback_id: 'no_state_spaceagent_tool_map',
      rollback_command: 'Remove /api/bridge/spaceagent/tool-map and SpaceAgent tool-map metadata; no external tool state changed.',
    },
    writes_enabled: false,
    execution_enabled: false,
    external_execution_enabled: false,
  }
}

export function buildSpaceAgentPipelineStatus() {
  return {
    ...commonInvariants(),
    route: 'bridge.spaceagent.pipeline-status',
    status: 'SPACEAGENT_PIPELINE_REGISTERED_INTERNAL_ONLY',
    pipeline: {
      id: 'spaceagent_gateway_integration_pipeline',
      name: SPACEAGENT_PIPELINE_NAME,
      agent_id: SPACEAGENT_IDENTITY.agent_id,
      direct_gateway_connection: true,
      gateway_route: SPACEAGENT_IDENTITY.gateway_route,
      conversation_owner: SPACEAGENT_IDENTITY.conversation_owner,
      reports_to: SPACEAGENT_IDENTITY.reports_to,
      final_authority: SPACEAGENT_IDENTITY.final_authority,
      opencloud_intermediary_allowed: false,
      no_external_execution_without_exact_scope: true,
    },
    templates: SPACEAGENT_PIPELINE_TEMPLATES,
    workflow_templates: SPACEAGENT_PIPELINE_TEMPLATES.map((template, index) => ({
      template_id: index + 1,
      ...template,
      no_state_proof: true,
      audit_required: template.bridge_session_required,
    })),
    proof: {
      pipeline_visible: true,
      no_external_execution: true,
      no_opencloud_intermediary: true,
      credential_values_exposed: false,
      rollback_id: 'no_state_spaceagent_pipeline_status',
      rollback_command: 'Remove /api/bridge/spaceagent/pipeline-status and SpaceAgent pipeline metadata; no production state changed.',
    },
    writes_enabled: false,
    execution_enabled: false,
    external_execution_enabled: false,
    credential_values_exposed: false,
  }
}

export function buildSpaceAgentBrainStatus() {
  return {
    ...commonInvariants(),
    route: 'bridge.spaceagent.brain-status',
    status: 'SPACEAGENT_BRAIN_BRIDGE_CONNECTED_READ_ONLY',
    brain_bridge: {
      gateway_connected: true,
      gateway_route: '/api/bridge/brain-sync/gateway-status',
      opencloud_intermediary_allowed: false,
      read_only_canonical_truth: true,
      source_labels: SPACEAGENT_BRAIN_SOURCE_LABELS,
      live_routes_outrank_stale_memory: true,
    },
    lanes: SPACEAGENT_BRAIN_LANES,
    memory_policy: {
      can_read_canonical_truth: true,
      can_recommend_corrections: true,
      can_request_memory_write: true,
      can_execute_memory_write: false,
      memory_write_execution_route: '/api/bridge/brain-sync/memory/write-execute',
      memory_write_request_route: '/api/bridge/brain-sync/memory/write-request',
      approval_route: '/api/bridge/brain-sync/memory-approvals/status',
      stale_memory_rule: 'live_routes_outrank_stale_memory',
      historical_mark_before_removal: true,
      broad_memory_deletion_allowed: false,
      raw_secret_memory_writes_allowed: false,
    },
    proof: {
      brain_bridge_visible: true,
      gateway_connected: true,
      opencloud_used: false,
      opencloud_intermediary: false,
      no_opencloud_intermediary: true,
      credential_values_exposed: false,
      rollback_id: 'no_state_spaceagent_brain_status',
      rollback_command: 'Remove /api/bridge/spaceagent/brain-status and SpaceAgent Brain metadata; no memory state changed.',
    },
    writes_enabled: false,
    execution_enabled: false,
    external_execution_enabled: false,
    credential_values_exposed: false,
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
