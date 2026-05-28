export const OPENCLOUD_ALLOWED_ROLES = [
  'supporting_runtime_system',
  'tool_provider_when_invoked',
  'mini_agent_when_invoked',
  'diagnostics_helper',
  'supporting_tool_only',
] as const

export const OPENCLOUD_FORBIDDEN_ROLES = [
  'commander',
  'owner_operator',
  'conversation_owner',
  'hidden_dispatcher',
  'telegram_identity',
  'agent_identity_proxy',
  'production_writer_without_jarvis',
  'bridge_session_owner',
  'agent_channel_listener',
  'credential_broker',
  'default_gateway',
] as const

export type OpenCloudAllowedRole = typeof OPENCLOUD_ALLOWED_ROLES[number]
export type OpenCloudForbiddenRole = typeof OPENCLOUD_FORBIDDEN_ROLES[number]

export type OpenCloudAuthorityInput = {
  target_agent?: string | null
  invoked_by?: string | null
  opencloud_role?: string | null
  conversation_owner?: string | null
  direct_line_used?: boolean | null
  visible_task_id?: string | number | null
  audit_id?: string | null
  rollback_id?: string | null
  broad_action?: boolean | null
  production_write?: boolean | null
  hidden_intermediary?: boolean | null
}

export type OpenCloudAuthorityResult = {
  allowed: boolean
  exact_blocker: string | null
  opencloud_role: OpenCloudAllowedRole | 'not_used' | 'forbidden'
  required_invoker: 'agent-zero-jarvis_or_certified_agent_route'
  visible_task_required: true
  audit_required: true
  rollback_required: true
  conversation_owner_allowed: false
  hidden_intermediary_allowed: false
  production_write_without_jarvis_allowed: false
  credential_values_exposed: false
  no_secrets_exposed: true
}

const AGENT_TARGETS = new Set([
  'agent-zero-jarvis',
  'agent_zero',
  'agent-zero',
  'jarvis',
  'ron-weasley',
  'ron',
  'hermes',
  'hermans',
  'pi',
  'paperclip',
  'spaceagent',
  'space-agent',
  'brain-bridge',
  'brain-sync',
])

const CERTIFIED_INVOKERS = new Set([
  'agent-zero-jarvis',
  'agent_zero',
  'jarvis',
  'ron-weasley',
  'ron',
  'hermes',
  'pi',
  'paperclip',
  'spaceagent',
  'space-agent',
  'mission-control-gateway',
  'mission-control',
  'nuclear-gateway',
  'mission-control-nuclear-gateway',
])

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-')
}

function result(exact_blocker: string | null, role: OpenCloudAuthorityResult['opencloud_role']): OpenCloudAuthorityResult {
  return {
    allowed: !exact_blocker,
    exact_blocker,
    opencloud_role: role,
    required_invoker: 'agent-zero-jarvis_or_certified_agent_route',
    visible_task_required: true,
    audit_required: true,
    rollback_required: true,
    conversation_owner_allowed: false,
    hidden_intermediary_allowed: false,
    production_write_without_jarvis_allowed: false,
    credential_values_exposed: false,
    no_secrets_exposed: true,
  }
}

export function isOpenCloudIdentity(value: unknown) {
  const id = normalize(value)
  return id === 'opencloud' || id === 'openclaw' || id === 'openclaw+' || id === 'openclaw-plus'
}

export function evaluateOpenCloudAuthority(input: OpenCloudAuthorityInput = {}): OpenCloudAuthorityResult {
  const target = normalize(input.target_agent)
  const owner = normalize(input.conversation_owner)
  const invokedBy = normalize(input.invoked_by)
  const requestedRole = normalize(input.opencloud_role)

  if (isOpenCloudIdentity(owner)) return result('opencloud_cannot_be_conversation_owner', 'forbidden')
  if (input.hidden_intermediary === true) return result('opencloud_hidden_intermediary_forbidden', 'forbidden')
  if (isOpenCloudIdentity(target) && requestedRole !== 'supporting-tool-only' && requestedRole !== 'supporting-runtime-system') {
    return result('opencloud_is_supporting_runtime_not_commander', 'forbidden')
  }
  if (AGENT_TARGETS.has(target) && isOpenCloudIdentity(input.invoked_by)) {
    return result('opencloud_cannot_receive_owner_message_for_target_agent', 'forbidden')
  }
  if (input.direct_line_used === false) return result('agent_direct_line_violation', 'forbidden')
  if (input.broad_action === true) return result('opencloud_broad_action_forbidden', 'forbidden')
  if (input.production_write === true && invokedBy !== 'agent-zero-jarvis' && invokedBy !== 'jarvis') {
    return result('opencloud_production_write_requires_jarvis_concurrence', 'forbidden')
  }

  const allowedRole = requestedRole === 'supporting-tool-only'
    ? 'supporting_tool_only'
    : requestedRole === 'tool-provider-when-invoked'
      ? 'tool_provider_when_invoked'
    : OPENCLOUD_ALLOWED_ROLES.find((role) => normalize(role) === requestedRole)

  if (!allowedRole) return result('opencloud_role_not_allowed', 'forbidden')
  if (!CERTIFIED_INVOKERS.has(invokedBy)) return result('opencloud_invoker_not_certified', allowedRole)
  if (!input.visible_task_id) return result('opencloud_visible_task_required', allowedRole)
  if (!input.audit_id) return result('opencloud_audit_required', allowedRole)
  if (!input.rollback_id) return result('opencloud_rollback_or_no_state_proof_required', allowedRole)

  return result(null, allowedRole)
}

export function buildOpenCloudAuthorityPolicy() {
  return {
    route: 'bridge.opencloud.authority-policy',
    opencloud_demoted: true,
    openclaw_demoted: true,
    nuclear_gateway_owner: true,
    system_type: 'supporting_runtime_system',
    conversation_owner: 'none',
    direct_line_active: false,
    allowed_roles: OPENCLOUD_ALLOWED_ROLES,
    forbidden_roles: OPENCLOUD_FORBIDDEN_ROLES,
    can_listen_to_other_agent_channels: false,
    can_modify_production_directly: false,
    can_route_owner_messages: false,
    can_be_default_gateway: false,
    can_broker_credentials: false,
    allowed_as_tool_provider: true,
    credential_values_exposed: false,
    no_secrets_exposed: true,
    project_continues: true,
  }
}
