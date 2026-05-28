export type CredentialPresence = {
  name: string
  present: boolean
}

export type CredentialBrokerSystemStatus = {
  system: string
  credential_names_checked: string[]
  credential_present_by_name_only: CredentialPresence[]
  values_exposed: false
  scope: string
  owner_action_required: boolean
  blocker: string | null
}

export type CredentialBrokerStatus = {
  route: 'bridge.credentials.status'
  mode: 'name_only_credential_broker'
  generated_at: string
  systems: CredentialBrokerSystemStatus[]
  values_exposed: false
  no_secrets_exposed: true
  credential_broker_owner: 'nuclear_gateway'
  openclaw_credential_broker_allowed: false
  project_continues: true
}

type CredentialSystemDefinition = {
  system: string
  scope: string
  required: boolean
  credential_names: string[]
}

const CREDENTIAL_SYSTEMS: CredentialSystemDefinition[] = [
  {
    system: 'mission-control',
    scope: 'mission_control_auth_runtime',
    required: true,
    credential_names: ['MISSION_CONTROL_API_KEY', 'MC_API_KEY'],
  },
  {
    system: 'agent-zero-jarvis',
    scope: 'commander_runtime_brokered',
    required: false,
    credential_names: ['AGENT_ZERO_API_KEY', 'JARVIS_TELEGRAM_BOT_TOKEN'],
  },
  {
    system: 'ron-weasley',
    scope: 'nuclear_dispatcher_scoped_token_brokered',
    required: false,
    credential_names: ['RON_MISSION_CONTROL_TOKEN', 'HERMES_API_KEY'],
  },
  {
    system: 'pi',
    scope: 'advisory_dispatcher_scoped_token_brokered',
    required: false,
    credential_names: ['PI_MISSION_CONTROL_TOKEN'],
  },
  {
    system: 'paperclip',
    scope: 'company_workforce_exact_scope_adapter_brokered',
    required: false,
    credential_names: ['PAPERCLIP_BOARD_API_KEY', 'PAPERCLIP_BASE_URL'],
  },
  {
    system: 'brain-bridge',
    scope: 'memory_intelligence_read_and_write_gated',
    required: false,
    credential_names: ['OBSIDIAN_VAULT_PATH', 'MEMPALACE_API_KEY', 'GRAPHIFY_API_KEY'],
  },
  {
    system: 'openclaw',
    scope: 'supporting_runtime_only_not_credential_broker',
    required: false,
    credential_names: ['OPENCLAW_GATEWAY_HOST', 'OPENCLAW_GATEWAY_PORT', 'OPENCLAW_CONFIG_PATH'],
  },
]

function normalizeSystem(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-')
  if (normalized === 'hermes' || normalized === 'hermans' || normalized === 'ron') return 'ron-weasley'
  if (normalized === 'agent-zero' || normalized === 'jarvis') return 'agent-zero-jarvis'
  if (normalized === 'brain' || normalized === 'brain-sync') return 'brain-bridge'
  if (normalized === 'opencloud' || normalized === 'openclaw-plus' || normalized === 'openclaw+') return 'openclaw'
  return normalized
}

function cleanCredentialName(value: unknown) {
  const name = String(value || '').trim().toUpperCase()
  return /^[A-Z][A-Z0-9_]{1,96}$/.test(name) ? name : null
}

export function listCredentialBrokerSystems() {
  return CREDENTIAL_SYSTEMS.map((item) => item.system)
}

export function buildCredentialBrokerSystemStatus(system: unknown, env: NodeJS.ProcessEnv = process.env): CredentialBrokerSystemStatus | null {
  const systemId = normalizeSystem(system)
  const definition = CREDENTIAL_SYSTEMS.find((item) => item.system === systemId)
  if (!definition) return null

  const credential_present_by_name_only = definition.credential_names.map((name) => ({
    name,
    present: Boolean(env[name] && String(env[name]).trim()),
  }))
  const anyPresent = credential_present_by_name_only.some((item) => item.present)

  return {
    system: definition.system,
    credential_names_checked: definition.credential_names,
    credential_present_by_name_only,
    values_exposed: false,
    scope: definition.scope,
    owner_action_required: definition.required && !anyPresent,
    blocker: definition.required && !anyPresent ? 'credential_required_via_approved_broker' : null,
  }
}

export function buildCredentialBrokerStatus(env: NodeJS.ProcessEnv = process.env): CredentialBrokerStatus {
  return {
    route: 'bridge.credentials.status',
    mode: 'name_only_credential_broker',
    generated_at: new Date().toISOString(),
    systems: CREDENTIAL_SYSTEMS.map((item) => buildCredentialBrokerSystemStatus(item.system, env)!),
    values_exposed: false,
    no_secrets_exposed: true,
    credential_broker_owner: 'nuclear_gateway',
    openclaw_credential_broker_allowed: false,
    project_continues: true,
  }
}

export function runCredentialBrokerCheck(input: {
  system?: unknown
  credential_names?: unknown
}, env: NodeJS.ProcessEnv = process.env) {
  const systemStatus = buildCredentialBrokerSystemStatus(input.system || 'mission-control', env)
  if (!systemStatus) {
    return {
      ok: false,
      exact_blocker: 'credential_system_not_registered',
      values_exposed: false,
      no_secrets_exposed: true,
      project_continues: true,
    }
  }

  const customNames = Array.isArray(input.credential_names)
    ? input.credential_names.map(cleanCredentialName).filter((name): name is string => Boolean(name)).slice(0, 20)
    : []
  const names = customNames.length > 0 ? customNames : systemStatus.credential_names_checked
  const credential_present_by_name_only = names.map((name) => ({
    name,
    present: Boolean(env[name] && String(env[name]).trim()),
  }))

  return {
    ok: true,
    route: 'bridge.credentials.broker-check',
    system: systemStatus.system,
    credential_names_checked: names,
    credential_present_by_name_only,
    values_exposed: false,
    scope: systemStatus.scope,
    owner_action_required: systemStatus.owner_action_required,
    blocker: systemStatus.blocker,
    no_secrets_exposed: true,
    project_continues: true,
  }
}
