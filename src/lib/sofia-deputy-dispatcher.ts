import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { recordJarvisAudit } from '@/lib/jarvis-audit'
import { redactHermesValue } from '@/lib/hermes-policy'
import { SOFIA_ALLOWED_SCOPE, SOFIA_DEPUTY_IDENTITY } from '@/lib/sofia-identity'

type RiskLevel = 'low' | 'medium' | 'high'
type SofiaRecordKind = 'sofia_recommendation' | 'ron_review_request' | 'jarvis_concurrence_request'

export type SofiaInternalRecord = {
  id: string
  rollback_id: string
  at: string
  kind: SofiaRecordKind
  title: string
  payload: Record<string, unknown>
  requested_by: 'sofia'
  reports_to: 'ron-weasley'
  jarvis_final_authority: true
  opencloud_intermediary: false
  external_execution_enabled: false
  credential_values_exposed: false
  audit_hash: string
  rollback_policy: string
}

type SofiaWriteResult =
  | {
      ok: true
      route: string
      mode: 'sofia_internal_record_written'
      record: SofiaInternalRecord
      audit_record_written: true
      audit_hash: string
      rollback_id: string
      writes_enabled: true
      external_execution_enabled: false
      credential_values_exposed: false
      jarvis_final_authority: true
      opencloud_intermediary: false
    }
  | SofiaBlockedResult

export type SofiaBlockedResult = {
  ok: false
  route: 'bridge.sofia.execute'
  mode: 'blocked_before_execution'
  exact_blocker: 'sofia_requires_ron_and_jarvis_concurrence'
  audit_record_written: false
  rollback_id: null
  writes_enabled: false
  external_execution_enabled: false
  credential_values_exposed: false
  jarvis_final_authority: true
  reports_to: 'ron-weasley'
  opencloud_intermediary: false
}

const SOFIA_FORBIDDEN_ACTIONS = [
  'outrank Ron Weasley',
  'outrank Agent Zero / Jarvis',
  'act as OpenCloud or OpenClaw',
  'become hidden intermediary',
  'impersonate Jarvis',
  'impersonate Ron Weasley',
  'execute production-impacting actions directly',
  'access raw credentials or .env values',
  'execute broad connector actions',
  'write Paperclip production state directly',
  'execute Brain/memory writes without approval',
]

const SOFIA_PRODUCTION_APPROVAL_REQUIRED = [
  'production-impacting changes',
  'live Gateway route changes',
  'source code changes that affect production behavior',
  'new executable adapters',
  'Brain/memory write execution',
  'Paperclip production writes',
  'n8n/Zapier activation',
  'public exposure changes',
  'credential-related changes',
  'security policy changes',
  'destructive or rollback-sensitive actions',
]

const storePath = join(config.dataDir, 'sofia-internal-records.json')

function readRows(): SofiaInternalRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRows(rows: SofiaInternalRecord[]) {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function riskLevel(value: unknown): RiskLevel {
  return value === 'medium' || value === 'high' || value === 'low' ? value : 'low'
}

function safeString(value: unknown, fallback: string) {
  const text = String(value || '').trim()
  return text || fallback
}

function commonInvariants() {
  return {
    ...SOFIA_DEPUTY_IDENTITY,
    allowed_scope: [...SOFIA_ALLOWED_SCOPE],
    forbidden_actions: SOFIA_FORBIDDEN_ACTIONS,
    production_approval_required_for: SOFIA_PRODUCTION_APPROVAL_REQUIRED,
    sofia_does_not_outrank_ron: true,
    sofia_does_not_outrank_jarvis: true,
    ron_review_required_for_major_changes: true,
    jarvis_concurrence_required_for_production: true,
    jarvis_final_authority: true,
    can_act_as_opencloud: false,
    can_be_hidden_intermediary: false,
    hidden_intermediary_allowed: false,
    opencloud_intermediary: false,
    openclaw_intermediary: false,
    credential_values_exposed: false,
    no_secrets_exposed: true,
    raw_env_values_exposed: false,
    external_execution_enabled: false,
    protected_execution_enabled: false,
    broad_connector_execution_enabled: false,
  }
}

export function buildSofiaStatus() {
  const records = listSofiaInternalRecords(20)
  return {
    ...commonInvariants(),
    route: 'bridge.sofia.status',
    status: 'SOFIA_DEPUTY_DISPATCHER_READY',
    state: 'READ_ONLY',
    direct_line_active: true,
    direct_line_route: SOFIA_DEPUTY_IDENTITY.direct_line_route,
    authority_route: '/api/bridge/sofia/authority',
    capability_map_route: '/api/bridge/sofia/capability-map',
    recommendation_route: '/api/bridge/sofia/recommendation',
    ron_review_request_route: '/api/bridge/sofia/ron-review-request',
    jarvis_concurrence_request_route: '/api/bridge/sofia/jarvis-concurrence-request',
    execute_route: '/api/bridge/sofia/execute',
    operational_scope: 'ron_deputy_internal_planning_and_draft_work_only',
    writes_enabled: false,
    internal_record_count: records.length,
    ron_policy_statement: 'Sofia is Ron Weasley’s second-in-command. Sofia may help Ron improve skills, Gateway routes, mini-agent coordination, cybersecurity checks, Brain hygiene, and workflow drafts. Major or production-impacting changes still require Jarvis concurrence.',
  }
}

export function buildSofiaAuthority() {
  return {
    ...commonInvariants(),
    route: 'bridge.sofia.authority',
    status: 'SOFIA_AUTHORITY_POLICY_READY',
    authority_chain: ['owner', 'agent-zero-jarvis', 'ron-weasley', 'sofia'],
    may_create_internal_recommendations: true,
    may_create_ron_review_requests: true,
    may_create_jarvis_concurrence_requests: true,
    may_update_visible_task_drafts: true,
    may_execute_external_writes: false,
    may_execute_production_changes: false,
    production_execution: SOFIA_DEPUTY_IDENTITY.production_execution,
    writes_enabled: false,
  }
}

export function buildSofiaCapabilityMap() {
  return {
    ...commonInvariants(),
    route: 'bridge.sofia.capability-map',
    status: 'SOFIA_CAPABILITY_MAP_READY',
    production_execution: SOFIA_DEPUTY_IDENTITY.production_execution,
    capabilities: [
      { id: 'create_internal_recommendations', state: 'READY', execution_enabled: false },
      { id: 'request_ron_review', state: 'READY', execution_enabled: false },
      { id: 'request_jarvis_concurrence', state: 'READY', execution_enabled: false },
      { id: 'draft_gateway_improvements', state: 'READY', execution_enabled: false },
      { id: 'review_cybersecurity_findings', state: 'READ_ONLY', execution_enabled: false },
      { id: 'draft_brain_memory_hygiene', state: 'DRAFT_ONLY', execution_enabled: false },
      { id: 'coordinate_ron_mini_agents', state: 'DRAFT_ONLY', execution_enabled: false },
      { id: 'execute_production_changes', state: 'BLOCKED', execution_enabled: false, blocker: 'sofia_requires_ron_and_jarvis_concurrence' },
    ],
    writes_enabled: false,
  }
}

export function listSofiaInternalRecords(limit = 50) {
  return readRows().slice(0, limit)
}

function routeForRecordKind(kind: SofiaRecordKind) {
  return {
    sofia_recommendation: 'bridge.sofia.recommendation',
    ron_review_request: 'bridge.sofia.ron_review_request',
    jarvis_concurrence_request: 'bridge.sofia.jarvis_concurrence_request',
  }[kind]
}

function createRecord(kind: SofiaRecordKind, title: string, payload: Record<string, unknown>, rollbackPolicy: string): SofiaWriteResult {
  const safePayload = redactHermesValue({
    requested_by: 'sofia',
    reports_to: 'ron-weasley',
    final_authority: 'agent-zero-jarvis',
    opencloud_intermediary: false,
    external_execution_enabled: false,
    credential_values_exposed: false,
    ...payload,
  }) as Record<string, unknown>
  const audit = recordJarvisAudit({
    actor: 'sofia',
    event: `sofia_${kind}`,
    target: title,
    classification: 'internal_state_write',
    detail: {
      kind,
      rollback_policy: rollbackPolicy,
      jarvis_final_authority: true,
      reports_to: 'ron-weasley',
      external_execution_enabled: false,
      payload: safePayload,
    },
  })
  const record: SofiaInternalRecord = {
    id: `sof_${randomUUID()}`,
    rollback_id: `srb_${randomUUID()}`,
    at: new Date().toISOString(),
    kind,
    title,
    payload: safePayload,
    requested_by: 'sofia',
    reports_to: 'ron-weasley',
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
    mode: 'sofia_internal_record_written',
    record,
    audit_record_written: true,
    audit_hash: audit.hash,
    rollback_id: record.rollback_id,
    writes_enabled: true,
    external_execution_enabled: false,
    credential_values_exposed: false,
    jarvis_final_authority: true,
    opencloud_intermediary: false,
  }
}

export function createSofiaRecommendation(input: {
  title: string
  recommendation: string
  target_system?: string
  risk_level?: RiskLevel
}) {
  return createRecord(
    'sofia_recommendation',
    safeString(input.title, 'Sofia recommendation'),
    {
      title: safeString(input.title, 'Sofia recommendation'),
      recommendation: safeString(input.recommendation, ''),
      target_system: input.target_system ? String(input.target_system) : undefined,
      risk_level: riskLevel(input.risk_level),
      activation_requires: 'ron_review_or_jarvis_concurrence_for_production',
    },
    'Archive the exact Sofia recommendation record by rollback_id; no production state changed.',
  )
}

export function createSofiaRonReviewRequest(input: {
  request_id?: string
  review_topic?: string
  reason?: string
  target_reviewer?: string
  visible_task_id?: string
}) {
  const requestId = safeString(input.request_id, 'sofia-ron-review-request')
  return createRecord(
    'ron_review_request',
    requestId,
    {
      request_id: requestId,
      review_topic: safeString(input.review_topic, 'Ron review request'),
      reason: safeString(input.reason, ''),
      target_reviewer: input.target_reviewer || 'ron-weasley',
      visible_task_id: input.visible_task_id,
      activation_requires: 'ron_review_before_jarvis_concurrence_when_needed',
    },
    'Close the exact Ron review request as superseded; no production state changed.',
  )
}

export function createSofiaJarvisConcurrenceRequest(input: {
  request_id?: string
  action_type?: string
  affected_system?: string
  risk_level?: string
  exact_scope?: unknown
  reason?: string
  expected_benefit?: string
  rollback_path?: string
  audit_path?: string
  visible_task_id?: string
}) {
  const requestId = safeString(input.request_id, 'sofia-jarvis-concurrence-request')
  return createRecord(
    'jarvis_concurrence_request',
    requestId,
    {
      ...input,
      request_id: requestId,
      requested_by: 'sofia',
      reports_to: 'ron-weasley',
      target_authority: 'agent-zero-jarvis',
      jarvis_response_contract: ['approved', 'rejected', 'needs_ron_review', 'needs_owner', 'needs_credential', 'needs_sudo'],
      jarvis_final_authority: true,
      opencloud_intermediary: false,
      credential_values_exposed: false,
    },
    input.rollback_path || 'Close the exact Sofia concurrence request as superseded; Jarvis remains final authority.',
  )
}

export function refuseSofiaProductionExecution(input: Record<string, unknown> = {}): SofiaBlockedResult & { requested_action: Record<string, unknown> } {
  return {
    ok: false,
    route: 'bridge.sofia.execute',
    mode: 'blocked_before_execution',
    exact_blocker: 'sofia_requires_ron_and_jarvis_concurrence',
    requested_action: redactHermesValue(input) as Record<string, unknown>,
    audit_record_written: false,
    rollback_id: null,
    writes_enabled: false,
    external_execution_enabled: false,
    credential_values_exposed: false,
    jarvis_final_authority: true,
    reports_to: 'ron-weasley',
    opencloud_intermediary: false,
  }
}
