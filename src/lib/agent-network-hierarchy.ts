import { RON_WEASLEY_IDENTITY } from '@/lib/hermes-boundaries'

export const AGENT_NETWORK_STATUS_STATES = ['connected', 'degraded', 'pending', 'blocked', 'legacy_archived'] as const

export type AgentNetworkStatusState = (typeof AGENT_NETWORK_STATUS_STATES)[number]

export type CanonicalAgentNetworkRow = {
  id: string
  name: string
  status: string
  role: string
  template: string
  channels: string[]
  skills: string[]
  support_edge?: string
  blocker?: string | null
}

export type CanonicalAgentNetworkTier = {
  id: 'commander' | 'nuclear_dispatcher' | 'runtime' | 'system' | 'archive'
  label: string
  sub: string
}

export type HermesHierarchyStatusInput = {
  installed?: boolean
  reachable?: boolean
  authConfigured?: boolean
  blocker?: string | null
}

export const HERMES_NUCLEAR_DISPATCHER_CAPABILITIES = [
  'full ecosystem visibility',
  'Jarvis command registry parity',
  'delegated exact-scope execution',
  'skills',
  'workflow planning',
  'automation design',
  'spec generation',
  'debugging support',
] as const

export const CANONICAL_AGENT_NETWORK_TIERS: CanonicalAgentNetworkTier[] = [
  { id: 'commander', label: 'Commander', sub: 'Agent Zero owns ecosystem command and reports to the Owner' },
  { id: 'nuclear_dispatcher', label: 'Nuclear Dispatcher', sub: 'Ron Weasley has a direct Gateway line with Jarvis-delegated exact-scope execution' },
  { id: 'runtime', label: 'Runtime / Skills', sub: 'OpenClaw+ / ClaudeClaw shared runtime and skill layer' },
  { id: 'system', label: 'Bridge / MCP + Brain Systems', sub: 'Tools, models, integrations, MCPs, Obsidian, MemPalace, Graphify, Brain Sync, and Build-Wiki' },
]

export const CANONICAL_AGENT_TIER_OF: Record<string, string> = {
  agent_zero: 'commander',
  'agent-zero': 'commander',
  main: 'commander',
  hermes: 'nuclear_dispatcher',
  openclaw_plus: 'runtime',
  openclaw: 'runtime',
  claudeclaw: 'runtime',
  bridge_mcp: 'system',
  brain_systems: 'system',
  tony: 'archive',
  tony_legacy: 'archive',
  'tony-legacy': 'archive',
  tony_v2: 'archive',
  'tony-v2': 'archive',
}

export const CANONICAL_AGENT_NETWORK_SEED_IDS = new Set([
  'agent_zero',
  'agent-zero',
  'main',
  'hermes',
  'openclaw_plus',
  'openclaw',
  'claudeclaw',
  'bridge_mcp',
  'brain_systems',
  'tony',
  'tony_legacy',
  'tony-legacy',
  'tony_v2',
  'tony-v2',
])

export const CANONICAL_AGENT_NETWORK_HIERARCHY = {
  version: 'agent_zero_commander_hermes_nuclear_dispatcher_v1',
  owner: {
    id: 'owner',
    name: 'Owner',
    role: 'Luis / Antonio / Creator / Owner',
  },
  commander: {
    id: 'agent_zero',
    aliases: ['agent-zero', 'main'],
    name: 'Agent Zero',
    role: 'Commander / ecosystem lead',
    status: 'active',
    reports_to: 'owner',
    execution_enabled: false,
    bridge_session_required: true,
  },
  nuclear_dispatcher: {
    id: 'hermes',
    name: RON_WEASLEY_IDENTITY.canonical_name,
    canonical_name: RON_WEASLEY_IDENTITY.canonical_name,
    short_name: RON_WEASLEY_IDENTITY.short_name,
    full_title: RON_WEASLEY_IDENTITY.full_title,
    legacy_names: RON_WEASLEY_IDENTITY.legacy_names,
    role: 'Nuclear Dispatcher / optimization and workflow architect',
    supports: 'agent_zero',
    status: 'connected' as AgentNetworkStatusState,
    status_states: AGENT_NETWORK_STATUS_STATES,
    capabilities: HERMES_NUCLEAR_DISPATCHER_CAPABILITIES,
    execution_enabled: true,
    bridge_session_required: true,
    blocker: null,
  },
  runtime: {
    id: 'openclaw_plus',
    name: 'OpenClaw+ / ClaudeClaw',
    role: 'Shared runtime, skills, adapters, reports, and governance layer',
    owner_agent: 'ecosystem',
    tony_owns_skill_system: false,
  },
  systems: [
    { id: 'bridge_mcp', name: 'Bridge/MCP', role: 'Tools, models, and integrations access layer' },
    { id: 'brain_sync', name: 'Brain Sync', role: 'Brain coordination layer' },
    { id: 'obsidian', name: 'Obsidian', role: 'Knowledge system' },
    { id: 'mempalace', name: 'MemPalace', role: 'Memory system' },
    { id: 'graphify', name: 'Graphify', role: 'Graph system' },
    { id: 'buildwiki', name: 'Build-Wiki / Farmer', role: 'Scoped worker/docs sync service under OpenClaw+' },
  ],
  retired: [
    { id: 'tony_legacy', name: 'Tony legacy', role: 'legacy_archived', status: 'legacy_archived' as AgentNetworkStatusState, hidden_by_default: true, execution_enabled: false },
    { id: 'tony_v2', name: 'Tony v2', role: 'legacy_archived', status: 'legacy_archived' as AgentNetworkStatusState, hidden_by_default: true, execution_enabled: false },
  ],
  edges: [
    { from: 'owner', to: 'agent_zero', relation: 'commands' },
    { from: 'agent_zero', to: 'hermes', relation: 'delegates_to' },
    { from: 'hermes', to: 'agent_zero', relation: 'reports_to' },
    { from: 'agent_zero', to: 'openclaw_plus', relation: 'uses_runtime' },
    { from: 'openclaw_plus', to: 'bridge_mcp', relation: 'exposes_access_layer' },
    { from: 'agent_zero', to: 'brain_sync', relation: 'operates_brain_systems' },
    { from: 'openclaw_plus', to: 'buildwiki', relation: 'syncs' },
  ],
  labels: {
    approval_queue: 'Approval Queue - Agent Zero Bridge Session',
    approval_channel: 'Agent Zero Bridge Session',
    report_identity: `Agent Zero commander with ${RON_WEASLEY_IDENTITY.full_title} support`,
    skill_owner: 'ecosystem',
  },
  skill_policy: {
    owner_agent: 'ecosystem',
    available_to: ['agent_zero', 'hermes'],
    tony_owns_skill_system: false,
  },
} as const

export function getCanonicalAgentNetworkTierDefs(): CanonicalAgentNetworkTier[] {
  return CANONICAL_AGENT_NETWORK_TIERS.map((tier) => ({ ...tier }))
}

export function normalizeAgentNetworkId(id: string | null | undefined): string {
  return String(id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function isCanonicalAgentNetworkSeedId(id: string | null | undefined): boolean {
  const normalized = normalizeAgentNetworkId(id)
  return CANONICAL_AGENT_NETWORK_SEED_IDS.has(normalized) || CANONICAL_AGENT_NETWORK_SEED_IDS.has(String(id || '').toLowerCase())
}

export function isActiveTonyHierarchyId(id: string | null | undefined): boolean {
  const normalized = normalizeAgentNetworkId(id)
  return ['tony', 'tony_legacy', 'tony_v2'].includes(normalized)
}

export function getHermesHierarchyStatus(input: HermesHierarchyStatusInput = {}): {
  state: AgentNetworkStatusState
  label: string
  blocker: string | null
} {
  if (!input.installed) {
    return { state: 'blocked', label: 'blocked', blocker: 'hermes_runtime_not_installed_or_not_detected' }
  }
  if (input.blocker) {
    return { state: 'degraded', label: 'degraded', blocker: input.blocker }
  }
  if (input.reachable && input.authConfigured) {
    return { state: 'connected', label: 'connected', blocker: null }
  }
  if (input.reachable && !input.authConfigured) {
    return { state: 'degraded', label: 'degraded', blocker: 'hermes_auth_not_configured' }
  }
  return { state: 'pending', label: 'pending live proof', blocker: 'hermes_live_health_not_proven' }
}

export function getCanonicalAgentNetworkRows(input: HermesHierarchyStatusInput = {}): CanonicalAgentNetworkRow[] {
  const hermesStatus = getHermesHierarchyStatus(input)
  return [
    {
      id: 'agent_zero',
      name: 'Agent Zero',
      status: 'active',
      role: 'Commander / ecosystem lead',
      template: 'Bridge Session required',
      channels: ['Mission Control', 'Bridge/MCP', 'Brain Sync'],
      skills: ['command', 'planning', 'adapter-scoped execution'],
      support_edge: 'Owner -> Agent Zero commander',
      blocker: null,
    },
    {
      id: 'hermes',
      name: RON_WEASLEY_IDENTITY.canonical_name,
      status: hermesStatus.state,
      role: 'Nuclear Dispatcher / optimization and workflow architect',
      template: 'Jarvis-signed exact-scope delegation required for execution',
      channels: ['Mission Control Ron Weasley direct line', 'Agent Zero delegation edge', 'Gateway tool registry'],
      skills: [...HERMES_NUCLEAR_DISPATCHER_CAPABILITIES],
      support_edge: 'Agent Zero delegates certified exact scopes to Ron Weasley as Nuclear Dispatcher',
      blocker: hermesStatus.blocker,
    },
    {
      id: 'openclaw_plus',
      name: 'OpenClaw+ / ClaudeClaw',
      status: 'connected',
      role: 'Shared runtime / skills layer',
      template: 'backend runtime retained',
      channels: ['skills registry', 'adapters', 'reports'],
      skills: ['shared skills', 'governance', 'adapters'],
      support_edge: 'OpenClaw+ runtime serves Agent Zero and Ron Weasley',
      blocker: null,
    },
    {
      id: 'bridge_mcp',
      name: 'Bridge/MCP + Brain systems',
      status: 'connected',
      role: 'Access layer and knowledge systems',
      template: 'read-only status; execution through Bridge Session',
      channels: ['Bridge providers', 'MCP servers', 'Brain systems'],
      skills: ['models', 'tools', 'integrations', 'Obsidian', 'MemPalace', 'Graphify', 'Build-Wiki'],
      support_edge: 'Bridge/MCP and Brain systems sit under Agent Zero-led runtime',
      blocker: null,
    },
  ]
}

export function isTonyActiveInHierarchy(hierarchy = CANONICAL_AGENT_NETWORK_HIERARCHY): boolean {
  const activeIds = [
    hierarchy.commander.id,
    ...hierarchy.commander.aliases,
    hierarchy.nuclear_dispatcher.id,
    hierarchy.runtime.id,
    ...hierarchy.systems.map((system) => system.id),
  ]
  return activeIds.some((id) => isActiveTonyHierarchyId(id))
}
