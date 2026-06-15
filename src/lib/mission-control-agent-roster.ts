import { AGENT_LOCAL_INTERFACES } from '@/lib/agent-local-interfaces'
import { RON_WEASLEY_IDENTITY } from '@/lib/hermes-boundaries'
import { SOFIA_DEPUTY_IDENTITY } from '@/lib/sofia-identity'
import { buildRuntimeBoundaryPacket, buildRuntimeBoundaryTelegramStatus } from '@/lib/runtime-boundaries'

export type MissionControlAgent = {
  id: string
  label: string
  role: string
  classification?: 'mission_control_agent' | 'dispatcher' | 'runtime_system'
  status: string
  status_endpoint: string
  visible_to_gateway: boolean
  visible_to_PI: boolean
  visible_to_agent_runtime: boolean
  execution_allowed: boolean
  bridge_required: boolean
  adapter_present: boolean
  credential_policy: string
  health: string
  blocker: string
  aliases?: string[]
  runtime_identity?: string
  runtime_location?: string
  runtime_hosting?: string
}

export const MISSION_CONTROL_AGENTS: MissionControlAgent[] = [
  {
    id: 'agent-zero',
    label: 'Agent Zero (Jarvis)',
    role: 'Commander / protected-action reviewer',
    classification: 'mission_control_agent',
    status: 'OPERATIONAL GO / CERTIFIED EXACT-SCOPE EXECUTION',
    status_endpoint: '/api/bridge/agent-zero/status',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: true,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'credential_names_only_no_secret_values',
    health: 'operational_go',
    blocker: 'owner_hard_stops_only_remaining',
    aliases: ['Jarvis'],
    runtime_identity: 'separate_agent_zero_runtime',
    runtime_location: '/home/tony/agent-zero-deploy/data',
    runtime_hosting: 'agent-zero Docker container exposed on Tailnet port 50080',
  },
  {
    id: 'pi',
    label: 'Pi',
    role: 'Full Access Gateway Agent',
    classification: 'mission_control_agent',
    status: 'FULL ACCESS / DIRECT GATEWAY PIPELINE',
    status_endpoint: '/api/bridge/pi/status',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: true,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'gateway_brokered_names_only_no_secret_values',
    health: 'operational_go',
    blocker: 'production_execution_requires_jarvis_concurrence',
  },
  {
    id: 'hermes',
    label: RON_WEASLEY_IDENTITY.canonical_name,
    role: 'Nuclear Dispatcher / optimization and workflow architect',
    classification: 'mission_control_agent',
    status: 'FULL_ACCESS_DELEGATED / DIRECT GATEWAY LINE',
    status_endpoint: '/api/bridge/hermes/full-access/status',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: true,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'no_direct_secret_access_jarvis_brokered',
    health: 'jarvis_delegated_ready',
    blocker: 'jarvis_signed_exact_scope_delegation_required',
    aliases: [...RON_WEASLEY_IDENTITY.legacy_names, RON_WEASLEY_IDENTITY.short_name, 'Nuclear Dispatcher'],
    runtime_identity: 'separate_hermes_nuclear_dispatcher',
    runtime_location: 'Mission Control Ron Weasley direct-line routes under legacy /api/bridge/hermes aliases',
    runtime_hosting: 'Mission Control/Gateway direct line; Jarvis remains final signer for exact-scope execution',
  },
  {
    id: SOFIA_DEPUTY_IDENTITY.agent_id,
    label: `${SOFIA_DEPUTY_IDENTITY.display_name} — ${SOFIA_DEPUTY_IDENTITY.title}`,
    role: SOFIA_DEPUTY_IDENTITY.role,
    classification: 'mission_control_agent',
    status: 'CONFIGURED / DIRECT GATEWAY LINE - INTERNAL DRAFTS ONLY',
    status_endpoint: '/api/bridge/sofia/status',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: false,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'no_direct_secret_access_internal_records_only',
    health: 'configured',
    blocker: 'production_execution_requires_ron_plus_jarvis_concurrence',
    aliases: ['Sofia Deputy', 'Deputy Nuclear Dispatcher'],
    runtime_identity: 'mission_control_sofia_deputy_dispatcher',
    runtime_location: 'Mission Control Sofia direct-line routes under /api/bridge/sofia',
    runtime_hosting: 'Mission Control/Gateway direct line; internal recommendations only',
  },
  {
    id: 'paperclip',
    label: 'Paperclip',
    role: 'Workforce Control Plane',
    classification: 'mission_control_agent',
    status: 'INSTALLED / READY - WRITES BRIDGE-GATED',
    status_endpoint: '/api/bridge/paperclip/status',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: false,
    execution_allowed: false,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'paperclip_login_required_no_password_stored',
    health: 'read_only_ready',
    blocker: 'paperclip_writes_bridge_gated',
  },
  {
    id: 'spaceagent',
    label: 'SpaceAgent',
    role: 'Browser / Playwright / Firecrawl / YouTube research specialist',
    classification: 'mission_control_agent',
    status: 'CONFIGURED / FIRST-CLASS DIRECT GATEWAY LINE',
    status_endpoint: '/api/bridge/spaceagent/status',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: false,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'gateway_brokered_no_secret_values',
    health: 'configured_first_class_direct_line',
    blocker: 'production_execution_requires_jarvis_concurrence',
    aliases: ['Space Agent', 'space-agent'],
    runtime_identity: 'mission_control_spaceagent_direct_line',
    runtime_location: 'Mission Control SpaceAgent routes under canonical /api/bridge/spaceagent with legacy /space-agent aliases',
    runtime_hosting: 'Mission Control/Gateway direct line; Playwright MCP, Firecrawl, and YouTube are tools, not SpaceAgent identity',
  },
  {
    id: 'openclaw-plus',
    label: 'OpenClaw+',
    role: 'Gateway / shared skills runtime layer, not Agent Zero',
    classification: 'runtime_system',
    status: 'TUNNEL LIVE / DOCTOR CLI BLOCKED',
    status_endpoint: '/api/openclaw-plus/status',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: false,
    execution_allowed: false,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'owner_tunnel_only_no_public_exposure',
    health: 'partial',
    blocker: 'openclaw_doctor_runtime_not_reachable',
    runtime_identity: 'openclaw_gateway_runtime',
    runtime_location: '/home/tony/.openclaw',
    runtime_hosting: 'openclaw-gateway.service on loopback port 18789',
  },
]

export const REAL_MISSION_CONTROL_AGENTS = MISSION_CONTROL_AGENTS
  .filter((agent) => agent.classification !== 'runtime_system')

export const SUPPORTING_RUNTIME_SYSTEMS = MISSION_CONTROL_AGENTS
  .filter((agent) => agent.classification === 'runtime_system')

export const LOCAL_AGENT_ZERO_PROFILES = [
  'Developer',
  'Researcher',
  'Hacker',
  'Agent Zero profile',
  'Default profile',
]

export const PAPERCLIP_ECO_AGENTS = [
  'CEO',
  'CMO',
  'CTO',
  'Avatar Specialist',
  'Field Service Advisor',
  'Social Coordinator',
  'Video Producer',
]

export function buildJarvisTelegramIdentityStatus() {
  return buildRuntimeBoundaryTelegramStatus()
}

function agentById(id: string) {
  return MISSION_CONTROL_AGENTS.find((agent) => agent.id === id) || null
}

function agentStatus(id: string, missingStatus: string) {
  return agentById(id) ? 'agent_registered' : missingStatus
}

function localInterfaceStatus(id: string) {
  const match = AGENT_LOCAL_INTERFACES.find((item) => item.id === id)
  return match ? {
    id: match.id,
    label: match.name,
    mission_control_route: match.mission_control_route,
    mission_control_ui: match.mission_control_ui || null,
    local_interface_status: match.status,
    exact_blocker: match.exact_blocker,
  } : null
}

export function buildCanonicalAgentRoster() {
  const pi = agentById('pi')
  const hermes = agentById('hermes')
  const spaceAgent = agentById('spaceagent')
  const paperclip = agentById('paperclip')
  const openclawPlus = agentById('openclaw-plus')
  const telegramIdentity = buildJarvisTelegramIdentityStatus()
  const runtimeBoundaryPacket = buildRuntimeBoundaryPacket()

  return {
    route: 'bridge.agent-zero.agent-roster',
    mode: 'canonical_mission_control_agent_roster',
    runtime_boundaries: runtimeBoundaryPacket.runtime_boundaries,
    canonical_self_report: runtimeBoundaryPacket.canonical_self_report,
    regression_guards: runtimeBoundaryPacket.regression_guards,
    source_endpoints_checked: {
      mission_control_agents: '/api/agents',
      dispatcher_status: '/api/bridge/dispatcher/status',
      agent_zero_ecosystem: '/api/bridge/agent-zero/ecosystem',
      pi_status: '/api/bridge/pi/status',
      paperclip_agents: '/api/bridge/paperclip/agents',
      paperclip_gateway_inventory: '/api/bridge/paperclip/gateway-inventory',
      agent_local_interfaces: '/api/agent-local-interfaces',
    },
    mission_control_operator: {
      id: 'agent-zero',
      label: 'Agent Zero (Jarvis)',
      runtime_identity: 'Agent Zero',
      owner_facing_assistant_name: 'Jarvis',
      classification: 'mission_control_owner_operator',
      aliases: ['Jarvis'],
      separate_runtime: true,
      not_inside_openclaw: true,
      runtime_location: 'Agent Zero data/runtime (path redacted from owner-facing summary)',
      runtime_hosting: 'agent-zero Docker container exposed on Tailnet port 50080',
      openclaw_relationship: 'OpenClaw is a gateway/shared runtime layer only; it is not the Agent Zero brain or Telegram identity.',
      telegram_identity: telegramIdentity,
      execution_route: '/api/bridge/agent-zero/execute',
      canonical_self_report: runtimeBoundaryPacket.canonical_self_report,
    },
    mission_control_agents: REAL_MISSION_CONTROL_AGENTS.map((agent) => ({
      ...agent,
      classification: agent.classification || (agent.id === 'pi' ? 'dispatcher' : 'mission_control_agent'),
      source: '/api/agents',
    })),
    confirmed_mission_control_agent_names: REAL_MISSION_CONTROL_AGENTS.map((agent) => agent.label),
    supporting_runtime_systems: SUPPORTING_RUNTIME_SYSTEMS.map((system) => ({
      ...system,
      classification: 'runtime_system',
      source: '/api/agents',
      mission_control_agent: false,
      agent_zero_runtime: false,
      relationship_to_agent_zero: system.id === 'openclaw-plus'
        ? 'shared Gateway/skills/runtime layer visible to Agent Zero; not Agent Zero itself'
        : 'supporting runtime system',
    })),
    openclaw_status: openclawPlus
      ? 'runtime_system_visible_not_agent_zero'
      : 'missing_from_runtime_registry',
    identity_boundary_statement: runtimeBoundaryPacket.canonical_self_report,
    telegram_identity: telegramIdentity,
    local_agent_zero_profiles: LOCAL_AGENT_ZERO_PROFILES,
    local_agent_zero_profile_records: LOCAL_AGENT_ZERO_PROFILES.map((name) => ({
      name,
      classification: 'local_agent_zero_delegation_profile',
      mission_control_agent: false,
      source: 'Agent Zero local runtime profiles',
    })),
    local_profiles_owner_explanation: 'Developer, Researcher, Hacker, Agent Zero profile, and Default profile are local Agent Zero delegation profiles, not Mission Control agents.',
    paperclip_eco_agents: PAPERCLIP_ECO_AGENTS.map((name) => ({
      name,
      classification: 'paperclip_eco_agent',
      company_scope: 'ECO',
      source: '/api/bridge/paperclip/agents',
      execution_allowed: false,
      writes_bridge_gated: true,
    })),
    dispatcher_agents: pi ? [{
      id: pi.id,
      label: pi.label,
      classification: 'dispatcher',
      status_endpoint: pi.status_endpoint,
      execution_allowed: false,
      writes_enabled: false,
      bridge_required_for_protected_actions: true,
    }] : [],
    provider_or_runtime_agents: [] as Array<{
      id: string
      label: string
      classification: string
      status_endpoint: string
      exact_blocker: string
    }>,
    gateway_local_interfaces: ['agent-zero', 'pi', 'hermes', 'paperclip', 'spaceagent', 'openclaw-plus']
      .map(localInterfaceStatus)
      .filter(Boolean),
    paperclip_status: paperclip ? 'agent_registered_read_only_ready' : 'missing_from_registry',
    pi_status: pi ? 'dispatcher_registered' : 'missing_from_registry',
    hermes_status: hermes
      ? 'full_access_delegated_direct_line_registered'
      : 'provider_visible_but_not_agent_registered',
    sofia_status: agentById('sofia') ? 'deputy_dispatcher_direct_line_registered' : 'missing_from_registry',
    space_agent_status: spaceAgent
      ? 'agent_registered'
      : 'missing_from_registry',
    missing_expected_agents: [
      hermes ? null : {
        id: 'hermes',
        expected_name: RON_WEASLEY_IDENTITY.canonical_name,
        legacy_names: RON_WEASLEY_IDENTITY.legacy_names,
        status: 'provider_visible_but_not_agent_registered',
        missing_from: ['/api/agents'],
      },
      spaceAgent ? null : {
        id: 'spaceagent',
        expected_name: 'SpaceAgent',
        status: 'missing_from_registry',
        missing_from: ['/api/agents', '/api/agent-local-interfaces'],
      },
    ].filter(Boolean),
    stale_entries_reclassified: LOCAL_AGENT_ZERO_PROFILES.map((name) => ({
      name,
      from: 'reported_as_mission_control_agent',
      to: 'local_agent_zero_delegation_profile',
    })),
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    credential_values_exposed: false,
    no_secret_values_returned: true,
    next_action: 'Jarvis must use this route as the roster source of truth and must not present local Agent Zero profiles as the full Mission Control agent roster.',
  }
}

export function buildCanonicalAgentRosterSummary() {
  const roster = buildCanonicalAgentRoster()
  return {
    endpoint: '/api/bridge/agent-zero/agent-roster',
    mission_control_agent_count: roster.mission_control_agents.length,
    mission_control_agents: roster.confirmed_mission_control_agent_names,
    supporting_runtime_systems: roster.supporting_runtime_systems.map((system) => system.label),
    identity_boundary_statement: roster.identity_boundary_statement,
    runtime_boundaries: roster.runtime_boundaries,
    canonical_self_report: roster.canonical_self_report,
    agent_zero_runtime_location: roster.mission_control_operator.runtime_location,
    openclaw_status: roster.openclaw_status,
    telegram_identity: roster.telegram_identity,
    local_agent_zero_profiles: roster.local_agent_zero_profiles,
    paperclip_eco_agents: roster.paperclip_eco_agents.map((agent) => agent.name),
    dispatcher_agents: roster.dispatcher_agents.map((agent) => agent.label),
    hermes_status: roster.hermes_status,
    space_agent_status: roster.space_agent_status,
    local_profiles_owner_explanation: roster.local_profiles_owner_explanation,
    credential_values_exposed: false,
  }
}
