export type AgentZeroState = 'CREDENTIAL_GATED' | 'OWNER_GATED'

export const AGENT_ZERO_REQUIRED_CREDENTIALS = ['AGENT_ZERO_BASE_URL', 'AGENT_ZERO_API_KEY']
export const AGENT_ZERO_FALLBACK_CREDENTIALS = ['AGENT_ZERO_URL', 'AGENT_ZERO_TOKEN']

const CREDENTIAL_ALIASES = {
  AGENT_ZERO_BASE_URL: ['AGENT_ZERO_BASE_URL', 'AGENT_ZERO_URL'],
  AGENT_ZERO_API_KEY: ['AGENT_ZERO_API_KEY', 'AGENT_ZERO_TOKEN'],
} as const

function hasConfiguredEnvName(names: readonly string[]): boolean {
  return names.some((name) => Boolean(process.env[name]))
}

export function inspectAgentZeroReadiness() {
  const credential_presence = Object.fromEntries(
    Object.entries(CREDENTIAL_ALIASES).map(([credentialName, aliases]) => [
      credentialName,
      hasConfiguredEnvName(aliases),
    ]),
  ) as Record<string, boolean>
  const missing_credentials = Object.entries(credential_presence)
    .filter(([, present]) => !present)
    .map(([name]) => name)
  const state: AgentZeroState = missing_credentials.length > 0 ? 'CREDENTIAL_GATED' : 'OWNER_GATED'
  const blockers = [
    ...missing_credentials.map((name) => ({
      blocker_class: 'CREDENTIAL_GATED',
      credential_name: name,
      detail: 'Missing approved Agent Zero credential/configuration name in the service environment.',
    })),
    {
      blocker_class: 'OWNER_GATED',
      detail: 'Protected Agent Zero actions remain locked until Bridge approval persistence, audit trail, rollback proof, and owner approval are live.',
    },
  ]

  return {
    state,
    current_backend_state: state,
    blocker_class: state,
    credential_names: AGENT_ZERO_REQUIRED_CREDENTIALS,
    fallback_credential_names: AGENT_ZERO_FALLBACK_CREDENTIALS,
    credential_presence,
    missing_credentials,
    readiness_endpoint: '/api/agent-zero/status',
    read_probe_endpoint: '/api/agent-zero/status',
    owner_action_type: 'agent_zero_credentials',
    no_go_claim: true,
    go_claim_allowed: false,
    promotion_summary: {
      lane_id: 'agent_zero',
      read_only_current_surface: false,
      current_surface_blocker_class: state,
      promotion_blocker_class: state,
      promotion_blocked: true,
      promotion_requirements_complete: false,
      promotion_go_claim_allowed: false,
    },
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    execution_enabled: false,
    writes_enabled: false,
    protected_execution_enabled: false,
    fake_success_allowed: false,
    tailnet_only_required: true,
    public_exposure_allowed: false,
    safe_read_probe: {
      attempted: false,
      reason: 'Read-only health probing is held until the approved service target and API credential names are present.',
    },
    bridge_action_state: 'OWNER_GATED',
    audit_state: 'OWNER_GATED',
    rollback_state: 'OWNER_GATED',
    rollback_command: 'disable Agent Zero protected request route; keep /api/agent-zero/status credential-gated and read-only',
    blockers,
    next_action: missing_credentials.length > 0
      ? 'Provide Agent Zero service target and API credential through the approved secret manager path, then prove a read-only health call.'
      : 'Prove Agent Zero read-only health, then wire protected actions through Bridge approval and audit before promotion.',
  }
}
