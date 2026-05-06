export const MINI_AGENT_LIFECYCLE_STATES = [
  'proposed',
  'approved',
  'running',
  'blocked',
  'completed',
  'expired',
  'archived',
] as const

export type MiniAgentLifecycleState = (typeof MINI_AGENT_LIFECYCLE_STATES)[number]

export const MINI_AGENT_MEMORY_STATES = [
  'temporary',
  'pending_review',
  'promoted',
  'rejected',
  'expired',
  'archived',
  'blocked',
] as const

export type MiniAgentMemoryState = (typeof MINI_AGENT_MEMORY_STATES)[number]

export const MINI_AGENT_SUPERVISORS = ['agent_zero', 'hermes', 'pi'] as const
export type MiniAgentSupervisor = (typeof MINI_AGENT_SUPERVISORS)[number]

export type MiniAgentPolicyResult = 'allowed' | 'blocked' | 'requires_session' | 'missing_credential' | 'requires_review'

export type MiniAgentAuditEvent = {
  event: string
  actor: string
  target: string
  summary: string
  recorded_at: string
  external_write: false
  secrets_exposed: false
}

export type MiniAgentDefinition = {
  id: string
  name: string
  purpose: string
  parent_supervisor: MiniAgentSupervisor
  command_authority: 'agent_zero'
  scope: string[]
  allowed_tools: string[]
  forbidden_tools: string[]
  allowed_skills: string[]
  forbidden_skills: string[]
  allowed_models: string[]
  memory_ttl_minutes: number
  output_contract: string
  kill_condition: string
  lifecycle: MiniAgentLifecycleState
  created_at: string
  expires_at: string
  audit_trail_required: true
  audit_trail: MiniAgentAuditEvent[]
  bridge_session_required_for_execution: true
  read_enabled: true
  write_enabled: false
  execution_enabled: false
  external_writes_enabled: false
  can_self_promote: false
  can_create_child_agents: false
  direct_secret_access_allowed: false
  raw_root_shell_allowed: false
  docker_socket_allowed: false
  owner_direct_channel_allowed: false
  blocked_reason: string | null
}

export type MiniAgentDefinitionInput = {
  id?: string | null
  name: string
  purpose: string
  parent_supervisor?: string | null
  scope: string[]
  allowed_tools?: string[]
  forbidden_tools?: string[]
  allowed_skills?: string[]
  forbidden_skills?: string[]
  allowed_models?: string[]
  memory_ttl_minutes?: number | null
  output_contract?: string | null
  kill_condition?: string | null
  created_at?: string | null
}

export type MiniAgentDefinitionResult = {
  ok: boolean
  mode: 'mini_agent_definition_dry_run'
  definition: MiniAgentDefinition | null
  policy_result: MiniAgentPolicyResult
  blocked_reason: string | null
  owner_visible_summary: string
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
}

export type MiniAgentMemoryProvenance = {
  source_type: 'owner_prompt' | 'gateway_context' | 'tool_result' | 'registry_snapshot' | 'agent_summary' | 'mini_agent_output' | 'external_adapter_summary'
  source_id: string | null
  source_verified_at: string | null
  created_by: string
  parent_task: string
  parent_supervisor: MiniAgentSupervisor
  confidence: 'low' | 'medium' | 'high'
}

export type MiniAgentMemory = {
  id: string
  mini_agent_id: string
  owner: 'owner'
  parent_task: string
  parent_supervisor: MiniAgentSupervisor
  source: string
  created_at: string
  expires_at: string
  ttl_minutes: number
  state: MiniAgentMemoryState
  facts: string[]
  assumptions: string[]
  unknowns: string[]
  blocked_items: string[]
  provenance: MiniAgentMemoryProvenance
  contains_secrets: false
  promoted_to: string | null
  promotion_requested_by: string | null
  promotion_reviewed_by: string | null
  promotion_reason: string | null
  audit_trail: MiniAgentAuditEvent[]
}

export type MiniAgentMemoryInput = {
  mini_agent_id: string
  parent_task: string
  parent_supervisor?: string | null
  source: string
  facts?: string[]
  assumptions?: string[]
  unknowns?: string[]
  blocked_items?: string[]
  ttl_minutes?: number | null
  created_at?: string | null
  provenance?: Partial<MiniAgentMemoryProvenance>
}

export type MiniAgentMemoryResult = {
  ok: boolean
  mode: 'mini_agent_memory_dry_run'
  memory: MiniAgentMemory | null
  policy_result: MiniAgentPolicyResult
  blocked_reason: string | null
  owner_visible_summary: string
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
}

export type MiniAgentMemoryAccessResult = {
  ok: boolean
  policy_result: MiniAgentPolicyResult
  blocked_reason: string | null
  summary_access_only: true
  audit_required: true
}

const DEFAULT_MEMORY_TTL_MINUTES = 1440
const SHORT_MEMORY_TTL_MINUTES = 30
const MAX_MEMORY_TTL_MINUTES = 10080
const RESERVED_IDS = new Set(['agent_zero', 'agent zero', 'hermes', 'pi', 'tony', 'owner', 'gateway', 'opencloud', 'openclaw', 'bridge_mcp'])
const SECRETISH_PATTERN = /(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?FILE)\s*[:=]\s*[^,\s}]+)/i
const RAW_PATH_PATTERN = /(?:\/home\/tony|\/a0\/|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi
const FORBIDDEN_SCOPE_PATTERN = /(?:root\s+shell|docker\s+socket|direct\s+secret|read\s+secrets?|print\s+secrets?|\.env|auth\.json|unrestricted|bypass\s+gateway|zapier\s+write|heygen\s+generation|mount\s+smb|delete\s+opencloud|disable\s+build[-\s]?wiki)/i

export function createMiniAgentDefinition(input: MiniAgentDefinitionInput): MiniAgentDefinitionResult {
  const createdAt = input.created_at || '1970-01-01T00:00:00.000Z'
  const name = safeText(input.name) || 'Mini-agent'
  const id = normalizeId(input.id || name)
  const supervisor = normalizeSupervisor(input.parent_supervisor)
  const purpose = safeText(input.purpose) || ''
  const scope = sanitizeList(input.scope)
  const ttl = normalizeTtl(input.memory_ttl_minutes)
  const blockedReason = validateDefinition({ id, name, purpose, scope })

  if (blockedReason) {
    return {
      ok: false,
      mode: 'mini_agent_definition_dry_run',
      definition: null,
      policy_result: 'blocked',
      blocked_reason: blockedReason,
      owner_visible_summary: `Mini-agent definition is blocked: ${blockedReason}.`,
      execution_enabled: false,
      writes_enabled: false,
      secrets_exposed: false,
    }
  }

  const definition: MiniAgentDefinition = {
    id: id.startsWith('mini_agent_') ? id : `mini_agent_${id}`,
    name,
    purpose,
    parent_supervisor: supervisor,
    command_authority: 'agent_zero',
    scope,
    allowed_tools: sanitizeList(input.allowed_tools || []),
    forbidden_tools: sanitizeList(input.forbidden_tools || ['direct_secret_read', 'raw_root_shell', 'docker_socket', 'uncontrolled_delete', 'broad_connector_execution']),
    allowed_skills: sanitizeList(input.allowed_skills || []),
    forbidden_skills: sanitizeList(input.forbidden_skills || []),
    allowed_models: sanitizeList(input.allowed_models || []),
    memory_ttl_minutes: ttl,
    output_contract: safeText(input.output_contract) || 'Return a concise supervised result to Agent Zero through Gateway.',
    kill_condition: safeText(input.kill_condition) || 'Expire at TTL, on scope completion, or on Gateway policy block.',
    lifecycle: 'proposed',
    created_at: createdAt,
    expires_at: addMinutes(createdAt, ttl),
    audit_trail_required: true,
    audit_trail: [auditEvent('gateway.mini_agent.definition.created', supervisor, `mini_agent_${id}`, 'Definition created in dry-run proposal mode.', createdAt)],
    bridge_session_required_for_execution: true,
    read_enabled: true,
    write_enabled: false,
    execution_enabled: false,
    external_writes_enabled: false,
    can_self_promote: false,
    can_create_child_agents: false,
    direct_secret_access_allowed: false,
    raw_root_shell_allowed: false,
    docker_socket_allowed: false,
    owner_direct_channel_allowed: false,
    blocked_reason: null,
  }

  return {
    ok: true,
    mode: 'mini_agent_definition_dry_run',
    definition,
    policy_result: 'requires_session',
    blocked_reason: 'mini_agent_activation_requires_bridge_session_and_registered_runtime_adapter',
    owner_visible_summary: `${definition.name} is defined as a supervised mini-agent proposal under ${supervisor}; activation is not enabled.`,
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
  }
}

export function createMiniAgentMemory(input: MiniAgentMemoryInput): MiniAgentMemoryResult {
  const createdAt = input.created_at || '1970-01-01T00:00:00.000Z'
  const supervisor = normalizeSupervisor(input.parent_supervisor)
  const ttl = normalizeTtl(input.ttl_minutes)
  const rawMemoryText = [input.source, ...(input.facts || []), ...(input.assumptions || []), ...(input.unknowns || []), ...(input.blocked_items || [])].join(' ')
  const secretBlocker = containsSecretish(rawMemoryText)
  const facts = sanitizeList(input.facts || [])
  const assumptions = sanitizeList(input.assumptions || [])
  const unknowns = sanitizeList(input.unknowns || [])
  const blockedItems = sanitizeList(input.blocked_items || [])
  const source = safeText(input.source) || 'gateway_context'
  const parentTask = normalizeId(input.parent_task)
  const miniAgentId = normalizeId(input.mini_agent_id)

  if (!miniAgentId) return blockedMemory('mini_agent_id_required')
  if (!parentTask) return blockedMemory('parent_task_required')
  if (secretBlocker) return blockedMemory('mini_agent_memory_secret_storage_forbidden')

  const provenance: MiniAgentMemoryProvenance = {
    source_type: input.provenance?.source_type || 'gateway_context',
    source_id: safeText(input.provenance?.source_id || '') || null,
    source_verified_at: safeText(input.provenance?.source_verified_at || '') || null,
    created_by: normalizeId(input.provenance?.created_by || miniAgentId),
    parent_task: parentTask,
    parent_supervisor: supervisor,
    confidence: input.provenance?.confidence || 'medium',
  }

  const memory: MiniAgentMemory = {
    id: normalizeId(`memory_${miniAgentId}_${parentTask}_${createdAt}`),
    mini_agent_id: miniAgentId,
    owner: 'owner',
    parent_task: parentTask,
    parent_supervisor: supervisor,
    source,
    created_at: createdAt,
    expires_at: addMinutes(createdAt, ttl),
    ttl_minutes: ttl,
    state: 'temporary',
    facts,
    assumptions,
    unknowns,
    blocked_items: blockedItems,
    provenance,
    contains_secrets: false,
    promoted_to: null,
    promotion_requested_by: null,
    promotion_reviewed_by: null,
    promotion_reason: null,
    audit_trail: [auditEvent('gateway.mini_agent.memory.temporary_created', miniAgentId, parentTask, 'Temporary task-scoped memory created in dry-run mode.', createdAt)],
  }

  return {
    ok: true,
    mode: 'mini_agent_memory_dry_run',
    memory,
    policy_result: 'allowed',
    blocked_reason: null,
    owner_visible_summary: 'Temporary mini-agent memory was created in task scope; promotion is not automatic.',
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
  }
}

export function expireMiniAgentMemory(memory: MiniAgentMemory, now: string): MiniAgentMemory {
  if (new Date(now).getTime() < new Date(memory.expires_at).getTime()) return { ...memory, audit_trail: [...memory.audit_trail] }
  return {
    ...memory,
    state: 'expired',
    audit_trail: [
      ...memory.audit_trail,
      auditEvent('gateway.mini_agent.memory.expired', memory.mini_agent_id, memory.parent_task, 'Temporary memory expired by TTL.', now),
    ],
  }
}

export function requestMiniAgentMemoryPromotion(memory: MiniAgentMemory, requester: 'agent_zero' | 'hermes' | 'pi' | 'mini_agent'): MiniAgentMemoryResult {
  if (memory.state !== 'temporary') return blockedMemory('memory_promotion_requires_temporary_state')
  const updated: MiniAgentMemory = {
    ...memory,
    state: 'pending_review',
    promotion_requested_by: requester,
    audit_trail: [
      ...memory.audit_trail,
      auditEvent('gateway.mini_agent.memory.promotion_requested', requester, memory.id, 'Memory promotion requires Agent Zero or owner review.', memory.created_at),
    ],
  }
  return {
    ok: true,
    mode: 'mini_agent_memory_dry_run',
    memory: updated,
    policy_result: 'requires_review',
    blocked_reason: null,
    owner_visible_summary: 'Memory promotion is pending review; no permanent memory was written.',
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
  }
}

export function reviewMiniAgentMemoryPromotion(
  memory: MiniAgentMemory,
  input: { approved: boolean; reviewer: 'agent_zero' | 'owner'; reason: string; reviewed_at?: string | null },
): MiniAgentMemoryResult {
  if (memory.state !== 'pending_review') return blockedMemory('memory_review_requires_pending_review_state')
  const reviewedAt = input.reviewed_at || memory.created_at
  const updated: MiniAgentMemory = {
    ...memory,
    state: input.approved ? 'promoted' : 'rejected',
    promoted_to: input.approved ? 'agent_zero_memory_review_queue' : null,
    promotion_reviewed_by: input.reviewer,
    promotion_reason: safeText(input.reason),
    audit_trail: [
      ...memory.audit_trail,
      auditEvent(input.approved ? 'gateway.mini_agent.memory.promoted' : 'gateway.mini_agent.memory.rejected', input.reviewer, memory.id, safeText(input.reason) || 'Memory review completed.', reviewedAt),
    ],
  }
  return {
    ok: true,
    mode: 'mini_agent_memory_dry_run',
    memory: updated,
    policy_result: input.approved ? 'allowed' : 'blocked',
    blocked_reason: input.approved ? null : 'memory_promotion_rejected',
    owner_visible_summary: input.approved ? 'Memory summary was approved for promotion with provenance.' : 'Memory promotion was rejected; no permanent memory was written.',
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
  }
}

export function canMiniAgentReadMemory(input: {
  requester_mini_agent_id: string
  memory: MiniAgentMemory
  same_task?: boolean
  sharing_allowed?: boolean
}): MiniAgentMemoryAccessResult {
  const requester = normalizeId(input.requester_mini_agent_id)
  const sameAgent = requester === input.memory.mini_agent_id
  const allowed = sameAgent || Boolean(input.same_task && input.sharing_allowed)
  return {
    ok: allowed,
    policy_result: allowed ? 'allowed' : 'blocked',
    blocked_reason: allowed ? null : 'mini_agent_cross_memory_access_not_allowed',
    summary_access_only: true,
    audit_required: true,
  }
}

export function summarizeMiniAgentMemoryForAgentZero(memory: MiniAgentMemory): string {
  const parts = [
    `Memory ${memory.state}`,
    `supervisor ${memory.parent_supervisor}`,
    `ttl ${memory.ttl_minutes} minutes`,
    `facts ${memory.facts.length}`,
    `assumptions ${memory.assumptions.length}`,
    `unknowns ${memory.unknowns.length}`,
    `blocked ${memory.blocked_items.length}`,
    `confidence ${memory.provenance.confidence}`,
  ]
  return parts.join('; ')
}

function validateDefinition(input: { id: string; name: string; purpose: string; scope: string[] }): string | null {
  if (!input.id) return 'mini_agent_id_required'
  if (RESERVED_IDS.has(input.id) || RESERVED_IDS.has(input.name.toLowerCase())) return 'mini_agent_id_reserved_existing_authority'
  if (!input.purpose) return 'mini_agent_purpose_required'
  if (input.scope.length === 0) return 'mini_agent_scope_required'
  if (input.scope.some((item) => FORBIDDEN_SCOPE_PATTERN.test(item))) return 'mini_agent_scope_contains_forbidden_access'
  return null
}

function blockedMemory(blockedReason: string): MiniAgentMemoryResult {
  return {
    ok: false,
    mode: 'mini_agent_memory_dry_run',
    memory: null,
    policy_result: 'blocked',
    blocked_reason: blockedReason,
    owner_visible_summary: `Mini-agent memory action is blocked: ${blockedReason}.`,
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
  }
}

function normalizeSupervisor(value: string | null | undefined): MiniAgentSupervisor {
  const normalized = normalizeId(value || 'agent_zero')
  return (MINI_AGENT_SUPERVISORS as readonly string[]).includes(normalized) ? normalized as MiniAgentSupervisor : 'agent_zero'
}

function normalizeTtl(value: number | null | undefined): number {
  const numeric = Number(value || DEFAULT_MEMORY_TTL_MINUTES)
  if (!Number.isFinite(numeric)) return DEFAULT_MEMORY_TTL_MINUTES
  return Math.max(SHORT_MEMORY_TTL_MINUTES, Math.min(MAX_MEMORY_TTL_MINUTES, Math.floor(numeric)))
}

function addMinutes(iso: string, minutes: number): string {
  const base = new Date(iso)
  const time = Number.isFinite(base.getTime()) ? base.getTime() : new Date('1970-01-01T00:00:00.000Z').getTime()
  return new Date(time + minutes * 60_000).toISOString()
}

function auditEvent(event: string, actor: string, target: string, summary: string, recordedAt: string): MiniAgentAuditEvent {
  return {
    event,
    actor,
    target,
    summary: safeText(summary) || event,
    recorded_at: recordedAt,
    external_write: false,
    secrets_exposed: false,
  }
}

function sanitizeList(value: readonly string[]): string[] {
  return value.map((item) => safeText(item)).filter((item): item is string => Boolean(item))
}

function safeText(value: string | null | undefined): string | null {
  const text = String(value || '')
    .replace(RAW_PATH_PATTERN, '[redacted-path]')
    .replace(SECRETISH_PATTERN, '[redacted-secret]')
    .trim()
  return text || null
}

function containsSecretish(value: string): boolean {
  return SECRETISH_PATTERN.test(value)
}

function normalizeId(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
