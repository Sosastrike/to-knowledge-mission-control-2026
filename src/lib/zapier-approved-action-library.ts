export type ZapierApprovedActionState =
  | 'certified_available'
  | 'prepared_internal_only'
  | 'prepared_metadata_only'

export type ZapierApprovedAction = {
  id: string
  adapter_id: 'zapier_exact_action_execute'
  action: string
  state: ZapierApprovedActionState
  input_schema: Record<string, unknown>
  allowed_target: string
  audit_required: true
  rollback_or_no_state_proof: string
  broad_action_refusal_proof: 'broad_zapier_action_returns_hard_refusal'
  writes_enabled: false
  external_execution_enabled: boolean
  credential_values_exposed: false
  forbidden_actions: string[]
}

export const ZAPIER_GATEWAY_CARD_COPY = {
  status: 'Connected / configured',
  detail: 'Certified exact-scope Zapier actions are available.',
  guardrail: 'Broad Zap creation, live social posting, and arbitrary Zapier execution require approved scope.',
} as const

const commonForbiddenActions = [
  'broad Zapier execution',
  'arbitrary Zap creation',
  'live Instagram/social posting',
  'credential printing',
  'unscoped external write',
]

function action(input: Omit<ZapierApprovedAction, 'adapter_id' | 'audit_required' | 'broad_action_refusal_proof' | 'writes_enabled' | 'credential_values_exposed' | 'forbidden_actions'>): ZapierApprovedAction {
  return {
    adapter_id: 'zapier_exact_action_execute',
    audit_required: true,
    broad_action_refusal_proof: 'broad_zapier_action_returns_hard_refusal',
    writes_enabled: false,
    credential_values_exposed: false,
    forbidden_actions: [...commonForbiddenActions],
    ...input,
  }
}

export const ZAPIER_APPROVED_ACTIONS: ZapierApprovedAction[] = [
  action({
    id: 'connection_probe',
    action: 'zapier.connection_probe',
    state: 'certified_available',
    input_schema: {
      type: 'object',
      properties: {
        idempotency_key: { type: 'string', maxLength: 180 },
      },
      additionalProperties: false,
    },
    allowed_target: 'zapier_mcp_connection',
    rollback_or_no_state_proof: 'No Zapier state changes. Rollback archives only the Mission Control audit/rollback proof for the exact probe.',
    external_execution_enabled: true,
  }),
  action({
    id: 'tool_list',
    action: 'zapier.tool_list',
    state: 'prepared_metadata_only',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: 120 },
      },
      additionalProperties: false,
    },
    allowed_target: 'zapier_mcp_tool_inventory',
    rollback_or_no_state_proof: 'Read-only metadata. No Zapier write, Zap run, or external state change occurs.',
    external_execution_enabled: false,
  }),
  action({
    id: 'zap_metadata_read',
    action: 'zapier.zap_metadata_read',
    state: 'prepared_metadata_only',
    input_schema: {
      type: 'object',
      properties: {
        zap_identifier: { type: 'string', maxLength: 160 },
      },
      required: ['zap_identifier'],
      additionalProperties: false,
    },
    allowed_target: 'zapier_metadata_only',
    rollback_or_no_state_proof: 'Read-only metadata. No Zap edit, creation, activation, or trigger run occurs.',
    external_execution_enabled: false,
  }),
  action({
    id: 'approved_internal_trigger',
    action: 'zapier.approved_internal_trigger',
    state: 'prepared_internal_only',
    input_schema: {
      type: 'object',
      properties: {
        trigger_name: { type: 'string', maxLength: 120 },
        dry_run: { const: true },
      },
      required: ['trigger_name', 'dry_run'],
      additionalProperties: false,
    },
    allowed_target: 'mission_control_internal_queue_only',
    rollback_or_no_state_proof: 'Internal dry-run/queue record only until a separate exact external trigger is certified.',
    external_execution_enabled: false,
  }),
  action({
    id: 'crm_lead_draft_or_queue',
    action: 'zapier.crm_lead_draft_or_queue',
    state: 'prepared_internal_only',
    input_schema: {
      type: 'object',
      properties: {
        lead_summary: { type: 'string', maxLength: 2000 },
        destination: { enum: ['internal_draft_queue'] },
      },
      required: ['lead_summary', 'destination'],
      additionalProperties: false,
    },
    allowed_target: 'mission_control_internal_draft_queue',
    rollback_or_no_state_proof: 'Internal draft can be deleted by exact draft id. No CRM/Zapier write occurs in v1.',
    external_execution_enabled: false,
  }),
  action({
    id: 'social_post_draft',
    action: 'zapier.social_post_draft',
    state: 'prepared_internal_only',
    input_schema: {
      type: 'object',
      properties: {
        platform: { type: 'string', maxLength: 80 },
        draft_text: { type: 'string', maxLength: 2200 },
        destination: { enum: ['internal_draft_queue'] },
      },
      required: ['platform', 'draft_text', 'destination'],
      additionalProperties: false,
    },
    allowed_target: 'mission_control_social_draft_queue_only',
    rollback_or_no_state_proof: 'Internal draft can be deleted by exact draft id. Live social posting remains separately gated.',
    external_execution_enabled: false,
  }),
  action({
    id: 'owner_notification',
    action: 'zapier.owner_notification',
    state: 'prepared_internal_only',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', maxLength: 1200 },
        channel: { enum: ['mission_control_internal_notice'] },
      },
      required: ['message', 'channel'],
      additionalProperties: false,
    },
    allowed_target: 'mission_control_owner_notice_queue',
    rollback_or_no_state_proof: 'Internal owner notice record only. External sends require their own delivery adapter.',
    external_execution_enabled: false,
  }),
  action({
    id: 'execution_status_check',
    action: 'zapier.execution_status_check',
    state: 'prepared_metadata_only',
    input_schema: {
      type: 'object',
      properties: {
        execution_identifier: { type: 'string', maxLength: 160 },
      },
      required: ['execution_identifier'],
      additionalProperties: false,
    },
    allowed_target: 'zapier_execution_metadata_only',
    rollback_or_no_state_proof: 'Read-only execution metadata. No Zapier action is invoked or replayed.',
    external_execution_enabled: false,
  }),
]

export function buildZapierApprovedActionLibrary() {
  const certifiedActions = ZAPIER_APPROVED_ACTIONS.filter((item) => item.state === 'certified_available')
  return {
    route: 'bridge.zapier.approved-actions',
    status: 'CONNECTED_CONFIGURED',
    card_copy: ZAPIER_GATEWAY_CARD_COPY,
    adapter_id: 'zapier_exact_action_execute',
    canonical_execution_route: '/api/bridge/agent-zero/execute',
    actions: ZAPIER_APPROVED_ACTIONS.map((item) => ({ ...item })),
    certified_actions: certifiedActions.map((item) => item.action),
    prepared_actions: ZAPIER_APPROVED_ACTIONS.filter((item) => item.state !== 'certified_available').map((item) => item.action),
    execution_enabled: certifiedActions.length > 0,
    writes_enabled: false,
    external_writes_enabled: false,
    broad_execution_enabled: false,
    no_zapier_writes_by_default: true,
    credential_values_exposed: false,
    no_secrets_exposed: true,
    broad_action_refusal_proof: 'broad_zapier_action_returns_hard_refusal',
    note: 'Approved Zapier library entries are exact-scope only. Prepared internal/metadata actions do not create Zaps, run Zaps, or post socially.',
  }
}
