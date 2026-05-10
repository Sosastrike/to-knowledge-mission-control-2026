import { createHash, randomUUID } from 'node:crypto'
import {
  blockerClassForStatus,
  describeOwnerFacingStatus,
  ownerSafeStatusText,
  type OwnerFacingBlockerClass,
  type OwnerFacingStatus,
  type OwnerFacingStatusDescriptor,
} from './owner-status'
import type { GatewayProtectedScope } from './gateway-policy'

type ToolActionRiskLevel = 'low' | 'medium' | 'high'

export type ToolActionApprovalPlanInput = {
  connector?: unknown
  provider?: unknown
  tool?: unknown
  action?: unknown
  target?: unknown
  intent?: unknown
  payload?: unknown
}

export type ToolActionApprovalPlan = {
  ok: boolean
  mode: 'tool_action_approval_plan'
  canonical_status: OwnerFacingStatus
  blocker_class: OwnerFacingBlockerClass
  owner_status: OwnerFacingStatusDescriptor
  blocker: string | null
  required_scope: GatewayProtectedScope | null
  connector: string | null
  action: string | null
  target: string | null
  target_key: string | null
  risk_level: ToolActionRiskLevel | null
  protected_category: string | null
  approval_scope: Record<string, unknown>
  idempotency_seed: string | null
  accepted_for_execution: false
  execution_enabled: false
  writes_enabled: false
  bridge_session_required: true
  owner_approval_required: true
  approval_request_created: false
  no_external_writes: true
  no_zapier_writes: boolean
  no_heygen_generation: boolean
  next_action: string
}

type ScopeDefinition = {
  requiredScope: GatewayProtectedScope
  connector: string
  action: string
  riskLevel: ToolActionRiskLevel
  protectedCategory: string
}

function text(value: unknown): string {
  return ownerSafeStatusText(String(value ?? '').trim()) || ''
}

function normalize(value: unknown): string {
  return text(value).toLowerCase()
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  return payload as Record<string, unknown>
}

function sortedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort((a, b) => a.localeCompare(b)).slice(0, 80)
}

function stablePayloadHash(value: Record<string, unknown>): string {
  const normalized = JSON.stringify(Object.fromEntries(sortedKeys(value).map((key) => [key, value[key]])))
  return createHash('sha256').update(normalized).digest('hex')
}

function chooseScope(input: ToolActionApprovalPlanInput): ScopeDefinition | null {
  const haystack = [
    input.connector,
    input.provider,
    input.tool,
    input.action,
    input.target,
    input.intent,
  ].map(normalize).filter(Boolean).join(' ')

  if (!haystack) return null

  if (/heygen/.test(haystack) && /\b(generate|create|render|execute|run|video)\b/.test(haystack)) {
    return {
      requiredScope: 'heygen.generate',
      connector: 'zapier.heygen',
      action: 'heygen.generate',
      riskLevel: 'high',
      protectedCategory: 'external_automation',
    }
  }

  if (/zapier/.test(haystack) && /\b(write|create|update|delete|send|post|upload|run|execute|generate|publish)\b/.test(haystack)) {
    return {
      requiredScope: 'zapier.write',
      connector: 'zapier',
      action: 'zapier.write',
      riskLevel: 'high',
      protectedCategory: 'external_automation',
    }
  }

  if (/agentmail|email|mail/.test(haystack) && /\b(send|reply|write)\b/.test(haystack)) {
    return {
      requiredScope: 'agentmail.send',
      connector: 'agentmail',
      action: 'agentmail.send',
      riskLevel: 'medium',
      protectedCategory: 'external_delivery',
    }
  }

  if (/google[_\s-]?drive|\bdrive\b/.test(haystack) && /\b(upload|attach|write|send|move|copy)\b/.test(haystack)) {
    return {
      requiredScope: 'google_drive.upload',
      connector: 'google_drive',
      action: 'google_drive.upload',
      riskLevel: 'medium',
      protectedCategory: 'external_storage',
    }
  }

  if (/one[_\s-]?drive|onedrive/.test(haystack) && /\b(upload|attach|write|send|move|copy)\b/.test(haystack)) {
    return {
      requiredScope: 'onedrive.upload',
      connector: 'onedrive',
      action: 'onedrive.upload',
      riskLevel: 'medium',
      protectedCategory: 'external_storage',
    }
  }

  if (/\bmcp\b|mcp__/.test(haystack)) {
    if (/\b(execute|run|create|update|delete|send|post|upload|generate|publish)\b/.test(haystack)) {
      return {
        requiredScope: 'protected_action.execute',
        connector: 'mcp',
        action: 'protected_action.execute',
        riskLevel: 'high',
        protectedCategory: 'tooling',
      }
    }
  }

  return null
}

function chooseTargetKey(input: ToolActionApprovalPlanInput, definition: ScopeDefinition): string {
  const candidate = text(input.tool) || text(input.target) || definition.action
  return candidate.slice(0, 240) || definition.action
}

function blockedPlan(): ToolActionApprovalPlan {
  const ownerStatus = describeOwnerFacingStatus({
    rawStatus: 'blocked',
    blockers: ['tool_action_scope_not_supported'],
    requiresBridgeSession: true,
    requiresOwnerApproval: false,
  })

  return {
    ok: false,
    mode: 'tool_action_approval_plan',
    canonical_status: ownerStatus.status,
    blocker_class: ownerStatus.blocker_class || blockerClassForStatus(ownerStatus.status),
    owner_status: ownerStatus,
    blocker: 'tool_action_scope_not_supported',
    required_scope: null,
    connector: null,
    action: null,
    target: null,
    target_key: null,
    risk_level: null,
    protected_category: null,
    approval_scope: {},
    idempotency_seed: null,
    accepted_for_execution: false,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    owner_approval_required: true,
    approval_request_created: false,
    no_external_writes: true,
    no_zapier_writes: true,
    no_heygen_generation: true,
    next_action: 'Choose one exact supported tool action scope before requesting owner approval.',
  }
}

export function buildToolActionApprovalPlan(input: ToolActionApprovalPlanInput): ToolActionApprovalPlan {
  const definition = chooseScope(input)
  if (!definition) return blockedPlan()

  const payload = payloadRecord(input.payload)
  const payloadFields = sortedKeys(payload)
  const payloadHash = stablePayloadHash(payload)
  const target = text(input.target) || text(input.tool) || definition.action
  const targetKey = chooseTargetKey(input, definition)
  const ownerStatus = describeOwnerFacingStatus({
    rawStatus: 'owner_approval_required',
    blockers: ['owner_approval_required'],
    requiresBridgeSession: true,
    requiresOwnerApproval: true,
  })
  const approvalScope = {
    required_scope: definition.requiredScope,
    connector: definition.connector,
    action: definition.action,
    target_key: targetKey,
    payload_hash: payloadHash,
    payload_fields_present: payloadFields,
    payload_value_storage: 'hash_and_field_names_only',
    bridge_session_required: true,
    owner_approval_required: true,
    no_external_writes: true,
    no_zapier_writes: definition.connector.startsWith('zapier'),
    no_heygen_generation: definition.requiredScope === 'heygen.generate',
  }

  return {
    ok: true,
    mode: 'tool_action_approval_plan',
    canonical_status: ownerStatus.status,
    blocker_class: ownerStatus.blocker_class,
    owner_status: ownerStatus,
    blocker: 'owner_approval_required',
    required_scope: definition.requiredScope,
    connector: definition.connector,
    action: definition.action,
    target: target || null,
    target_key: targetKey,
    risk_level: definition.riskLevel,
    protected_category: definition.protectedCategory,
    approval_scope: approvalScope,
    idempotency_seed: [
      definition.connector,
      definition.action,
      targetKey,
      payloadHash,
      randomUUID(),
    ].join(':'),
    accepted_for_execution: false,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    owner_approval_required: true,
    approval_request_created: false,
    no_external_writes: true,
    no_zapier_writes: definition.connector.startsWith('zapier'),
    no_heygen_generation: definition.requiredScope === 'heygen.generate',
    next_action: 'Create this exact-scope Bridge approval request; protected execution remains disabled until owner approval.',
  }
}
