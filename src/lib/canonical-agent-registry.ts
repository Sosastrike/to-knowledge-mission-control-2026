export const CANONICAL_AGENT_IDS = [
  'agent-zero',
  'hermes',
  'pi-mono',
  'spaceagent',
  'paperclip',
  'openclaw-plus',
] as const

export type CanonicalAgentId = (typeof CANONICAL_AGENT_IDS)[number]

export type CanonicalAgentHubState = 'partial_go' | 'gated' | 'pending' | 'blocked' | 'read_only'

export type CanonicalAgentRegistryEntry = {
  id: CanonicalAgentId
  aliases: readonly string[]
  registryNodeId: string
  cloudCodeHealthIds: readonly string[]
  name: string
  role: string
  layer: string
  productionTruth: string
  agentHubStatus: CanonicalAgentHubState
  liveInterfaceProven: boolean
  calledTrueProven: boolean
  interfaceSummary: string
  uiMode: 'mission_control_proxy' | 'local_only_pending' | 'tailnet_pending' | 'not_installed' | 'service_gated'
  bridgeStatusRoute: string | null
  extraBlockers: readonly string[]
  authorityRank: number
  commander: boolean
  advisoryOnly: boolean
  executionEnabled: boolean
  writesEnabled: boolean
}

export type CanonicalAgentRegistryPayloadEntry = {
  id: CanonicalAgentId
  registry_node_id: string
  cloudcode_health_ids: string[]
  name: string
  role: string
  layer: string
  authority_rank: number
  commander: boolean
  advisory_only: boolean
  execution_enabled: boolean
  writes_enabled: boolean
  agent_hub_status: CanonicalAgentHubState
  production_truth: string
  bridge_status_route: string | null
}

export const CANONICAL_AGENT_REGISTRY: readonly CanonicalAgentRegistryEntry[] = [
  {
    id: 'agent-zero',
    aliases: ['agent_zero', 'agent-zero', 'agentzero', 'commander'],
    registryNodeId: 'agent_zero',
    cloudCodeHealthIds: ['agent_zero'],
    name: 'Agent Zero',
    role: 'Commander',
    layer: 'command_authority',
    productionTruth: 'commander track; status route is visible, but live test-chat remains credential-gated until the approved Agent Zero external API key is available',
    agentHubStatus: 'blocked',
    liveInterfaceProven: false,
    calledTrueProven: false,
    interfaceSummary: 'Mission Control bridge status surface is available; live commander chat proof is credential-gated',
    uiMode: 'mission_control_proxy',
    bridgeStatusRoute: '/api/bridge/agent-zero/status',
    extraBlockers: ['agent_zero_external_api_key_missing'],
    authorityRank: 1,
    commander: true,
    advisoryOnly: false,
    executionEnabled: false,
    writesEnabled: false,
  },
  {
    id: 'hermes',
    aliases: ['hermes', 'lieutenant'],
    registryNodeId: 'hermes',
    cloudCodeHealthIds: ['hermes'],
    name: 'Hermes',
    role: 'Lieutenant / Skill + Workflow Builder',
    layer: 'planning_and_skill_design',
    productionTruth: 'safe test-chat adapter proof exists, but the standalone Hermes runtime status route remains service-down until hermes-gateway service/runtime is installed',
    agentHubStatus: 'blocked',
    liveInterfaceProven: true,
    calledTrueProven: false,
    interfaceSummary: 'Safe chat adapter has proof, but standalone Hermes runtime remains blocked',
    uiMode: 'service_gated',
    bridgeStatusRoute: '/api/bridge/hermes/status',
    extraBlockers: ['hermes_not_installed'],
    authorityRank: 2,
    commander: false,
    advisoryOnly: false,
    executionEnabled: false,
    writesEnabled: false,
  },
  {
    id: 'pi-mono',
    aliases: ['pi', 'pi_mono', 'pi-mono', 'pimono'],
    registryNodeId: 'pi',
    cloudCodeHealthIds: ['pi'],
    name: 'Pi-mono',
    role: 'Dispatcher / Route Optimizer Candidate',
    layer: 'shadow_dispatch_recommendation',
    productionTruth: 'Mission Control in-process shadow dispatcher is live for advisory route recommendations; execution and writes remain disabled',
    agentHubStatus: 'read_only',
    liveInterfaceProven: true,
    calledTrueProven: false,
    interfaceSummary: 'Shadow dispatcher candidate; recommendations only, no execution authority',
    uiMode: 'mission_control_proxy',
    bridgeStatusRoute: '/api/bridge/pi/status',
    extraBlockers: [],
    authorityRank: 3,
    commander: false,
    advisoryOnly: true,
    executionEnabled: false,
    writesEnabled: false,
  },
  {
    id: 'spaceagent',
    aliases: ['spaceagent', 'space_agent', 'space-agent', 'space agent'],
    registryNodeId: 'space_agent',
    cloudCodeHealthIds: ['spaceagent_playwright', 'spaceagent_youtube', 'spaceagent_firecrawl'],
    name: 'SpaceAgent',
    role: 'Browser / Firecrawl / YouTube Research Specialist',
    layer: 'web_research_specialist',
    productionTruth: 'YouTube transcript connector is proven for public read-only research; Playwright MCP is currently service-down and Firecrawl remains credential/backend gated',
    agentHubStatus: 'pending',
    liveInterfaceProven: true,
    calledTrueProven: false,
    interfaceSummary: 'Gateway research node visible; YouTube research is proven, while Playwright MCP and Firecrawl remain blocked by exact runtime/credential gates',
    uiMode: 'mission_control_proxy',
    bridgeStatusRoute: '/api/bridge/space-agent/status',
    extraBlockers: ['playwright_mcp_service_unreachable', 'firecrawl_credential_required', 'interactive_browser_actions_require_bridge_session'],
    authorityRank: 4,
    commander: false,
    advisoryOnly: false,
    executionEnabled: false,
    writesEnabled: false,
  },
  {
    id: 'paperclip',
    aliases: ['paperclip'],
    registryNodeId: 'paperclip',
    cloudCodeHealthIds: ['paperclip'],
    name: 'Paperclip',
    role: 'Workforce Control Plane',
    layer: 'workforce_and_task_orchestration_before_openclaw_runtime',
    productionTruth: 'service-down until the Paperclip sandbox/local or Tailnet-only runtime is running and owner login/session proof is available',
    agentHubStatus: 'blocked',
    liveInterfaceProven: false,
    calledTrueProven: false,
    interfaceSummary: 'Mission Control node visible; Paperclip sandbox service is not currently running',
    uiMode: 'local_only_pending',
    bridgeStatusRoute: '/api/bridge/paperclip/status',
    extraBlockers: ['paperclip_sandbox_service_not_running'],
    authorityRank: 5,
    commander: false,
    advisoryOnly: false,
    executionEnabled: false,
    writesEnabled: false,
  },
  {
    id: 'openclaw-plus',
    aliases: ['openclaw', 'openclaw+', 'openclaw_plus', 'openclaw-plus', 'openclawplus'],
    registryNodeId: 'openclaw_plus',
    cloudCodeHealthIds: ['openclaw_plus'],
    name: 'OpenClaw+',
    role: 'Runtime / Skills / Mini-Agent Execution Layer',
    layer: 'runtime_skills_agents_mini_agent_execution_layer',
    productionTruth: 'SERVICE_DOWN until an approved OpenClaw+ CLI/runtime binary is installed or exposed to the Mission Control runtime service user and the doctor route returns a real health payload',
    agentHubStatus: 'blocked',
    liveInterfaceProven: false,
    calledTrueProven: false,
    interfaceSummary: 'Runtime / skills / mini-agent execution layer remains visible but blocked until OpenClaw+ doctor runtime is reachable',
    uiMode: 'service_gated',
    bridgeStatusRoute: '/api/openclaw/doctor',
    extraBlockers: ['openclaw_doctor_runtime_not_reachable'],
    authorityRank: 6,
    commander: false,
    advisoryOnly: false,
    executionEnabled: false,
    writesEnabled: false,
  },
] as const

export const CANONICAL_AGENT_HUB_ORDER: readonly CanonicalAgentId[] = [
  'paperclip',
  'agent-zero',
  'hermes',
  'spaceagent',
  'pi-mono',
  'openclaw-plus',
] as const

const CANONICAL_AGENT_ALIAS_TO_ID = new Map<string, CanonicalAgentId>(
  CANONICAL_AGENT_REGISTRY.flatMap((agent) => [
    [normalizeAlias(agent.id), agent.id] as const,
    ...agent.aliases.map((alias) => [normalizeAlias(alias), agent.id] as const),
  ]),
)

export function normalizeCanonicalAgentId(value: string | null | undefined): CanonicalAgentId | null {
  const normalized = normalizeAlias(value)
  return CANONICAL_AGENT_ALIAS_TO_ID.get(normalized) || null
}

export function getCanonicalAgentById(value: string | null | undefined): CanonicalAgentRegistryEntry | null {
  const id = normalizeCanonicalAgentId(value)
  if (!id) return null
  return CANONICAL_AGENT_REGISTRY.find((agent) => agent.id === id) || null
}

export function getCanonicalAgentRegistry(order: 'authority' | 'agent_hub' = 'authority'): CanonicalAgentRegistryEntry[] {
  const orderIds = order === 'agent_hub'
    ? CANONICAL_AGENT_HUB_ORDER
    : CANONICAL_AGENT_REGISTRY.map((agent) => agent.id)
  return orderIds.map((id) => {
    const agent = getCanonicalAgentById(id)
    if (!agent) throw new Error(`Missing canonical agent registry entry: ${id}`)
    return { ...agent, aliases: [...agent.aliases], cloudCodeHealthIds: [...agent.cloudCodeHealthIds], extraBlockers: [...agent.extraBlockers] }
  })
}

export function buildCanonicalAgentRegistryPayload(order: 'authority' | 'agent_hub' = 'authority'): CanonicalAgentRegistryPayloadEntry[] {
  return getCanonicalAgentRegistry(order).map((agent) => ({
    id: agent.id,
    registry_node_id: agent.registryNodeId,
    cloudcode_health_ids: [...agent.cloudCodeHealthIds],
    name: agent.name,
    role: agent.role,
    layer: agent.layer,
    authority_rank: agent.authorityRank,
    commander: agent.commander,
    advisory_only: agent.advisoryOnly,
    execution_enabled: agent.executionEnabled,
    writes_enabled: agent.writesEnabled,
    agent_hub_status: agent.agentHubStatus,
    production_truth: agent.productionTruth,
    bridge_status_route: agent.bridgeStatusRoute,
  }))
}

function normalizeAlias(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
