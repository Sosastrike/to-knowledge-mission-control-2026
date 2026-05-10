import {
  describeOwnerFacingStatus,
  OWNER_FACING_STATUS_STATES,
  ownerSafeStatusText,
  type OwnerFacingBlockerClass,
  type OwnerFacingStatus,
  type OwnerFacingStatusDescriptor,
} from './owner-status'
import type { ZapierToolRecord } from './zapier-tool-bridge'

export type HeyGenSchemaZapierInput = {
  canonical_status: OwnerFacingStatus
  blocker_class: OwnerFacingBlockerClass
  blocker: string | null
  heygen_found: boolean
  exact_heygen_tool_name: string | null
  required_fields: string[] | null
  heygen_tools: Array<Pick<ZapierToolRecord,
    | 'tool_name'
    | 'write_classification'
    | 'required_fields'
    | 'execution_enabled'
    | 'description'
    | 'category'
  >>
  execution_enabled: false
  writes_enabled: false
  no_zapier_writes: true
}

export type HeyGenSchemaReadinessInput = {
  zapier: HeyGenSchemaZapierInput
  payload?: Record<string, unknown> | null
}

export type HeyGenSchemaReadinessPayload = {
  ok: true
  mode: 'heygen_schema_readiness'
  canonical_status: OwnerFacingStatus
  blocker_class: OwnerFacingBlockerClass
  owner_status: OwnerFacingStatusDescriptor
  blocker: string | null
  schema_available: boolean
  tool_name: string | null
  required_fields: string[]
  payload_checked: boolean
  payload_valid: boolean | null
  missing_fields: string[]
  accepted_for_generation: false
  execution_enabled: false
  writes_enabled: false
  no_heygen_generation: true
  no_zapier_writes: true
  bridge_session_required: true
  approval_required_for_generation: true
  allowed_owner_statuses: typeof OWNER_FACING_STATUS_STATES
  next_action: string
}

function preferredToolRequiredFields(zapier: HeyGenSchemaZapierInput): string[] {
  if (Array.isArray(zapier.required_fields)) return zapier.required_fields
  const preferred = zapier.heygen_tools.find((tool) => tool.tool_name === zapier.exact_heygen_tool_name)
    || zapier.heygen_tools[0]
  return Array.isArray(preferred?.required_fields) ? preferred.required_fields : []
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

function chooseUnavailableBlocker(zapier: HeyGenSchemaZapierInput): string {
  return ownerSafeStatusText(zapier.blocker)
    || 'heygen_schema_not_visible'
}

export function evaluateHeyGenSchemaReadiness(input: HeyGenSchemaReadinessInput): HeyGenSchemaReadinessPayload {
  const zapier = input.zapier
  const schemaAvailable = Boolean(zapier.heygen_found && zapier.exact_heygen_tool_name)
  const requiredFields = schemaAvailable ? preferredToolRequiredFields(zapier) : []
  const payloadChecked = input.payload !== undefined
  const payload = input.payload || {}
  const missingFields = schemaAvailable && payloadChecked
    ? requiredFields.filter((field) => !hasValue(payload[field]))
    : []
  const payloadValid = schemaAvailable && payloadChecked
    ? missingFields.length === 0
    : null

  const blocker = !schemaAvailable
    ? chooseUnavailableBlocker(zapier)
    : payloadValid === false
      ? 'heygen_payload_missing_required_fields'
      : null

  const ownerStatus = describeOwnerFacingStatus({
    rawStatus: !schemaAvailable
      ? zapier.canonical_status
      : payloadValid === false
        ? 'blocked'
        : 'ready',
    blockers: blocker ? [blocker] : [],
    connected: schemaAvailable,
    configured: schemaAvailable,
    readEnabled: schemaAvailable,
    writeEnabled: false,
    executionEnabled: false,
    requiresBridgeSession: true,
    preferReadyWhenReadable: true,
  })

  return {
    ok: true,
    mode: 'heygen_schema_readiness',
    canonical_status: ownerStatus.status,
    blocker_class: ownerStatus.blocker_class,
    owner_status: ownerStatus,
    blocker,
    schema_available: schemaAvailable,
    tool_name: schemaAvailable ? zapier.exact_heygen_tool_name : null,
    required_fields: requiredFields,
    payload_checked: payloadChecked,
    payload_valid: payloadValid,
    missing_fields: missingFields,
    accepted_for_generation: false,
    execution_enabled: false,
    writes_enabled: false,
    no_heygen_generation: true,
    no_zapier_writes: true,
    bridge_session_required: true,
    approval_required_for_generation: true,
    allowed_owner_statuses: OWNER_FACING_STATUS_STATES,
    next_action: schemaAvailable
      ? 'Schema is visible for validation only. Request an exact Bridge Session approval before any HeyGen generation.'
      : 'Connect HeyGen in Zapier MCP, then rerun the read-only schema readiness check.',
  }
}
