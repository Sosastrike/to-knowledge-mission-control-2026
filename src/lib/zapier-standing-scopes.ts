export type ZapierStandingScopeStatus = 'active' | 'paused' | 'expired' | 'revoked'

export type ZapierRuntimeStatus = 'active' | 'degraded' | 'paused' | 'blocked'

export type ZapierStandingScope = {
  scope_id: string
  name: string
  status: ZapierStandingScopeStatus
  allowed_agents: string[]
  allowed_zaps: string[]
  allowed_actions: string[]
  allowed_apps: string[]
  allowed_destinations: string[]
  max_runs_per_hour: number
  max_runs_per_day: number
  requires_payload_preview: boolean
  audit_required: true
  created_by_owner: true
  expires_at: string | null
  writes_enabled: boolean
  execution_enabled: boolean
}

export type ZapierStandingScopesPayload = {
  zapier_runtime: {
    mode: 'always_on'
    enabled: true
    status: ZapierRuntimeStatus
    owner_enabled: true
    emergency_stop: false
    writes_default: 'blocked_unless_scope_approved'
    discovery: 'enabled'
    inventory: 'enabled'
    audit_required: true
  }
  standing_scopes: ZapierStandingScope[]
  standing_scope_summary: {
    active_scopes: number
    read_only_scopes: number
    execution_scopes: number
    writes_enabled: boolean
    broad_execution_enabled: false
  }
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
  external_writes_enabled: false
  broad_execution_enabled: false
}

export type ZapierStandingScopeDecision = {
  allowed: boolean
  approval_required: boolean
  scope_id: string | null
  writes_enabled: boolean
  execution_enabled: boolean
  broad_execution_enabled: false
  exact_blocker: string | null
  next_action: string
}

export const ZAPIER_DISCOVERY_SCOPE_ID = 'zapier.scope.discovery_and_status'

export const ZAPIER_DISCOVERY_ACTIONS = [
  'zapier.connection_probe',
  'zapier.tool_list',
  'zapier.zap_metadata_read',
  'zapier.execution_status_check',
] as const

export function buildZapierStandingScopes(): ZapierStandingScopesPayload {
  const standingScopes: ZapierStandingScope[] = [
    {
      scope_id: ZAPIER_DISCOVERY_SCOPE_ID,
      name: 'Zapier discovery and status',
      status: 'active',
      allowed_agents: ['agent.zero', 'hermes', 'pi', 'gateway'],
      allowed_zaps: [],
      allowed_actions: [...ZAPIER_DISCOVERY_ACTIONS],
      allowed_apps: ['zapier'],
      allowed_destinations: ['zapier_mcp_connection', 'zapier_mcp_tool_inventory', 'zapier_metadata_only', 'zapier_execution_metadata_only'],
      max_runs_per_hour: 120,
      max_runs_per_day: 1000,
      requires_payload_preview: false,
      audit_required: true,
      created_by_owner: true,
      expires_at: null,
      writes_enabled: false,
      execution_enabled: false,
    },
  ]

  const activeScopes = standingScopes.filter((scope) => scope.status === 'active')
  const executionScopes = activeScopes.filter((scope) => scope.execution_enabled || scope.writes_enabled)

  return {
    zapier_runtime: {
      mode: 'always_on',
      enabled: true,
      status: 'active',
      owner_enabled: true,
      emergency_stop: false,
      writes_default: 'blocked_unless_scope_approved',
      discovery: 'enabled',
      inventory: 'enabled',
      audit_required: true,
    },
    standing_scopes: standingScopes,
    standing_scope_summary: {
      active_scopes: activeScopes.length,
      read_only_scopes: activeScopes.filter((scope) => !scope.writes_enabled && !scope.execution_enabled).length,
      execution_scopes: executionScopes.length,
      writes_enabled: executionScopes.some((scope) => scope.writes_enabled),
      broad_execution_enabled: false,
    },
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    external_writes_enabled: false,
    broad_execution_enabled: false,
  }
}

export function evaluateZapierStandingScopeRequest(input: {
  action: string
  agent_id: string
  destination: string
}): ZapierStandingScopeDecision {
  const scopes = buildZapierStandingScopes().standing_scopes
  const matchingScope = scopes.find((scope) => {
    return scope.status === 'active'
      && scope.allowed_actions.includes(input.action)
      && scope.allowed_agents.includes(input.agent_id)
      && scope.allowed_destinations.includes(input.destination)
      && !scope.writes_enabled
      && !scope.execution_enabled
  })

  if (matchingScope) {
    return {
      allowed: true,
      approval_required: false,
      scope_id: matchingScope.scope_id,
      writes_enabled: false,
      execution_enabled: false,
      broad_execution_enabled: false,
      exact_blocker: null,
      next_action: 'Use read-only Zapier discovery/status scope. Writes remain guarded.',
    }
  }

  return {
    allowed: false,
    approval_required: true,
    scope_id: null,
    writes_enabled: false,
    execution_enabled: false,
    broad_execution_enabled: false,
    exact_blocker: 'zapier_action_outside_standing_scope',
    next_action: 'Approval required for out-of-scope Zapier action',
  }
}
