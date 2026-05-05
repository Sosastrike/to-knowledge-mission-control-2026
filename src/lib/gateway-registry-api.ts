import type { AgentZeroReadOnlyContext } from './agent-zero-bridge'
import { buildAgentZeroEcosystemContext } from './agent-zero-ecosystem-context'
import {
  createGatewayCapability,
  createGatewayFlow,
  createGatewayHealth,
  createGatewayRegistryFromAgentNetwork,
  normalizeGatewayStatus,
  type GatewayCapability,
  type GatewayCapabilityKind,
  type GatewayEdge,
  type GatewayExecutionMode,
  type GatewayFlow,
  type GatewayHealth,
  type GatewayNode,
  type GatewayNodeKind,
  type GatewayPolicy,
  type GatewayRegistry,
  type GatewayStatus,
} from './gateway-model'
import { GATEWAY_POLICY_BADGES, type GatewayPolicyBadge } from './gateway-policy'

type GatewayRegistryBuildInput = {
  context?: AgentZeroReadOnlyContext | null
  generatedAt?: string
}

export type GatewayStatusPayload = {
  ok: true
  mode: 'gateway_status_read_only'
  generated_at: string
  status: GatewayStatus
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  totals: {
    nodes: number
    edges: number
    capabilities: number
    flows: number
    policies: number
    blocked: number
    degraded: number
  }
  agent_zero: GatewayNodeStatusSummary
  hermes: GatewayNodeStatusSummary
  bridge_mcp: {
    visible: boolean
    providers: number
    mcp_servers: number
    mcp_tools_visible: boolean
    execution_enabled: false
  }
  brain_systems: Array<GatewayNodeStatusSummary & {
    read_enabled: boolean
    write_enabled: boolean
  }>
  safety: {
    auth_required: true
    secrets_exposed: false
    raw_paths_exposed: false
    bridge_session_required_for_writes: true
  }
}

export type GatewayNodeDetailPayload = {
  ok: true
  generated_at: string
  node: GatewayNode
  inbound_edges: GatewayEdge[]
  outbound_edges: GatewayEdge[]
  capabilities: GatewayCapability[]
  execution_enabled: false
  writes_enabled: false
}

export type GatewayFlowsPayload = {
  ok: true
  mode: 'gateway_flows_read_only'
  generated_at: string
  flows: GatewayFlow[]
  execution_enabled: false
  writes_enabled: false
}

export type GatewayPoliciesPayload = {
  ok: true
  mode: 'gateway_policies_read_only'
  generated_at: string
  policies: Record<string, GatewayPolicy>
  summary: {
    auth_required: true
    bridge_session_required_for_writes: true
    external_writes_enabled: false
    secret_safe: true
    raw_shell_enabled: false
    docker_socket_enabled: false
  }
  badges: GatewayPolicyBadge[]
}

type GatewayNodeStatusSummary = {
  id: string
  label: string
  status: GatewayStatus
  health: GatewayHealth
  blockers: string[]
}

type UnknownRecord = Record<string, unknown>

const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z'

const SECRETISH_PATTERN =
  /(sk-[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*[:=]\s*[^,\s}]+)/gi
const RAW_PATH_PATTERN = /(?:\/home\/tony|\/a0\/(?:usr|tmp|var)|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi

export async function loadGatewayRegistry(): Promise<GatewayRegistry> {
  const generatedAt = new Date().toISOString()
  const context = await buildAgentZeroEcosystemContext().catch(() => null)
  return buildGatewayRegistrySnapshot({ context, generatedAt })
}

export function buildGatewayRegistrySnapshot(input: GatewayRegistryBuildInput = {}): GatewayRegistry {
  const generatedAt = input.generatedAt || DEFAULT_GENERATED_AT
  const context = input.context || null
  const hermes = deriveHermesStatus(context)
  const base = createGatewayRegistryFromAgentNetwork({ generatedAt, hermes })

  const extraNodes = buildGatewayNodes(context, generatedAt)
  const nodes = dedupeById([...base.nodes, ...extraNodes])
  const edges = dedupeEdges([...base.edges, ...buildGatewayEdges(context, generatedAt)])
  const capabilities = dedupeById([
    ...base.capabilities,
    ...buildGatewayCapabilities(context, generatedAt),
  ])
  const health = Object.fromEntries(nodes.map((node) => [node.id, node.health]))

  return {
    ...base,
    generated_at: generatedAt,
    nodes,
    edges,
    capabilities,
    health,
    policies: {
      ...base.policies,
      gateway_read_only: {
        auth_required: true,
        bridge_session_required: false,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_bridge_session_write: {
        auth_required: true,
        bridge_session_required: true,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_external_action_blocked: {
        auth_required: true,
        bridge_session_required: true,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_route_auth_required: {
        auth_required: true,
        bridge_session_required: false,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_redaction_required: {
        auth_required: true,
        bridge_session_required: false,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_agentmail_domain_restricted: {
        auth_required: true,
        bridge_session_required: true,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_protected_scope_required: {
        auth_required: true,
        bridge_session_required: true,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
    },
  }
}

export function buildGatewayStatusPayload(registry: GatewayRegistry): GatewayStatusPayload {
  const flows = buildGatewayFlows(registry)
  const agentZero = summarizeNode(registry, 'agent_zero', 'Agent Zero')
  const hermes = summarizeNode(registry, 'hermes', 'Hermes')
  const bridge = registry.nodes.find((node) => node.id === 'bridge_mcp')
  const mcpServers = registry.capabilities.filter((capability) => capability.kind === 'mcp_server')
  const providers = registry.capabilities.filter((capability) => capability.id.startsWith('bridge_provider_'))
  const brainSystems = ['brain_sync', 'obsidian', 'mempalace', 'graphify', 'buildwiki'].map((id) => {
    const summary = summarizeNode(registry, id, id)
    const capabilities = registry.capabilities.filter((capability) => capability.source_node === id || capability.id.includes(id))
    return {
      ...summary,
      read_enabled: capabilities.some((capability) => capability.read_enabled),
      write_enabled: capabilities.some((capability) => capability.write_enabled),
    }
  })
  const blocked = registry.nodes.filter((node) => node.status === 'blocked').length +
    registry.capabilities.filter((capability) => capability.status === 'blocked').length
  const degraded = registry.nodes.filter((node) => node.status === 'degraded').length +
    registry.capabilities.filter((capability) => capability.status === 'degraded').length

  return {
    ok: true,
    mode: 'gateway_status_read_only',
    generated_at: registry.generated_at,
    status: blocked > 0 || degraded > 0 ? 'degraded' : 'connected',
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    totals: {
      nodes: registry.nodes.length,
      edges: registry.edges.length,
      capabilities: registry.capabilities.length,
      flows: flows.length,
      policies: Object.keys(registry.policies).length,
      blocked,
      degraded,
    },
    agent_zero: agentZero,
    hermes,
    bridge_mcp: {
      visible: Boolean(bridge),
      providers: providers.length,
      mcp_servers: mcpServers.length,
      mcp_tools_visible: mcpServers.some((capability) => capability.read_enabled),
      execution_enabled: false,
    },
    brain_systems: brainSystems,
    safety: {
      auth_required: true,
      secrets_exposed: false,
      raw_paths_exposed: false,
      bridge_session_required_for_writes: true,
    },
  }
}

export function getGatewayNodeDetail(registry: GatewayRegistry, id: string): GatewayNodeDetailPayload | null {
  const normalizedId = gatewayId(id)
  const node = registry.nodes.find((item) => item.id === normalizedId)
  if (!node) return null
  return {
    ok: true,
    generated_at: registry.generated_at,
    node,
    inbound_edges: registry.edges.filter((edge) => edge.target === node.id),
    outbound_edges: registry.edges.filter((edge) => edge.source === node.id),
    capabilities: registry.capabilities.filter((capability) => capability.source_node === node.id),
    execution_enabled: false,
    writes_enabled: false,
  }
}

export function buildGatewayFlowsPayload(registry: GatewayRegistry): GatewayFlowsPayload {
  return {
    ok: true,
    mode: 'gateway_flows_read_only',
    generated_at: registry.generated_at,
    flows: buildGatewayFlows(registry),
    execution_enabled: false,
    writes_enabled: false,
  }
}

export function buildGatewayPoliciesPayload(registry: GatewayRegistry): GatewayPoliciesPayload {
  return {
    ok: true,
    mode: 'gateway_policies_read_only',
    generated_at: registry.generated_at,
    policies: registry.policies,
    summary: {
      auth_required: true,
      bridge_session_required_for_writes: true,
      external_writes_enabled: false,
      secret_safe: true,
      raw_shell_enabled: false,
      docker_socket_enabled: false,
    },
    badges: [...GATEWAY_POLICY_BADGES],
  }
}

function buildGatewayFlows(registry: GatewayRegistry): GatewayFlow[] {
  const edgeFlows = registry.edges.map((edge) => {
    const target = registry.nodes.find((node) => node.id === edge.target)
    const policy = edge.requires_session
      ? registry.policies.gateway_bridge_session_write || registry.policies.bridge_session_required
      : registry.policies.gateway_read_only || registry.policies.read_only
    const executionMode: GatewayExecutionMode = edge.requires_session ? 'bridge_session' : 'read_only'
    return createGatewayFlow({
      flow_id: gatewayId(`flow_${edge.source}_${edge.target}_${edge.kind}`),
      request: {
        source: edge.source,
        target: edge.target,
        purpose: `Gateway ${edge.kind} route from ${edge.source} to ${edge.target}`,
      },
      route: {
        source: edge.source,
        target: edge.target,
        edge_kind: edge.kind,
        hops: edge.source === 'owner' ? [edge.source, edge.target] : ['owner', 'gateway', edge.source, edge.target],
      },
      policy,
      execution_mode: executionMode,
      audit: {
        audit_id: null,
        events: ['gateway_flow_registered_read_only'],
        external_write: false,
        secrets_exposed: false,
      },
      result: {
        status: edge.status,
        summary: target ? `${target.label} route is ${edge.status}.` : `Route target ${edge.target} is not registered.`,
        blocker: edge.blocker,
      },
    })
  })
  const hermesCollaborationFlow = buildHermesCollaborationFlow(registry)
  return hermesCollaborationFlow ? [...edgeFlows, hermesCollaborationFlow] : edgeFlows
}

function buildHermesCollaborationFlow(registry: GatewayRegistry): GatewayFlow | null {
  const agentZero = registry.nodes.find((node) => node.id === 'agent_zero')
  const hermes = registry.nodes.find((node) => node.id === 'hermes')
  const agentZeroToHermes = registry.edges.find((edge) => edge.source === 'agent_zero' && edge.target === 'hermes')
  const hermesToAgentZero = registry.edges.find((edge) => edge.source === 'hermes' && edge.target === 'agent_zero')
  if (!agentZero || !hermes || !agentZeroToHermes || !hermesToAgentZero) return null

  const blocker = agentZeroToHermes.blocker || hermesToAgentZero.blocker || hermes.blockers[0] || null
  const status: GatewayStatus = blocker
    ? (hermes.status === 'blocked' || hermes.status === 'missing' ? 'blocked' : 'degraded')
    : (hermes.status === 'connected' ? 'connected' : 'read_only')
  const policy = registry.policies.gateway_read_only || registry.policies.read_only

  return createGatewayFlow({
    flow_id: 'flow_agent_zero_hermes_collaboration',
    request: {
      source: 'agent_zero',
      target: 'hermes',
      purpose: 'Agent Zero delegates skill and workflow planning to Hermes, then reviews the plan before any execution.',
    },
    route: {
      source: 'agent_zero',
      target: 'agent_zero',
      edge_kind: 'delegation',
      hops: ['agent_zero', 'hermes', 'agent_zero'],
    },
    policy,
    execution_mode: 'read_only',
    audit: {
      audit_id: null,
      events: ['gateway_collaboration_flow_registered_read_only', 'agent_zero_remains_commander', 'hermes_plan_only_no_execution'],
      external_write: false,
      secrets_exposed: false,
    },
    result: {
      status,
      summary: blocker
        ? `Hermes collaboration is degraded: ${blocker}.`
        : 'Agent Zero can dispatch planning requests to Hermes and retain final command authority.',
      blocker,
    },
  })
}

function buildGatewayNodes(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayNode[] {
  const modelCount = asArray(pick(context, 'models', 'catalog')).length
  const integrationCount = asArray(pick(context, 'integrations', 'registry')).length
  const toolCount = asArray(pick(context, 'tools', 'registry')).length
  const mcpCount = asArray(pick(context, 'mcp', 'servers')).length
  return [
    makeNode({
      id: 'gateway',
      label: 'Gateway',
      kind: 'api',
      status: 'connected',
      capabilities: ['route', 'govern', 'observe', 'control'],
      lastSeen: generatedAt,
    }),
    makeNode({
      id: 'models',
      label: 'Model Registry',
      kind: 'model',
      status: modelCount > 0 ? 'read_only' : 'degraded',
      capabilities: ['OpenRouter', 'OpenAI', 'Claude/Anthropic', 'Codex/ChatGPT', 'Ollama', 'NVIDIA', 'Gemini', 'Groq'],
      blockers: modelCount > 0 ? [] : ['model_registry_empty_or_not_visible'],
      lastSeen: generatedAt,
    }),
    makeNode({
      id: 'mcp_tools',
      label: 'MCP Tools',
      kind: 'mcp_server',
      status: mcpCount > 0 ? 'read_only' : 'degraded',
      capabilities: ['server list', 'tool schemas', 'read-only visibility'],
      blockers: mcpCount > 0 ? [] : ['mcp_servers_not_visible'],
      lastSeen: generatedAt,
    }),
    makeNode({
      id: 'tools',
      label: 'Tools',
      kind: 'tool',
      status: toolCount > 0 ? 'read_only' : 'degraded',
      capabilities: ['registered adapters', 'tool schemas', 'Bridge Session gated execution'],
      blockers: toolCount > 0 ? [] : ['tool_registry_empty_or_not_visible'],
      lastSeen: generatedAt,
    }),
    makeNode({
      id: 'integrations',
      label: 'Integrations',
      kind: 'api',
      status: integrationCount > 0 ? 'read_only' : 'degraded',
      capabilities: ['AgentMail', 'Firecrawl', 'Google Drive', 'OneDrive', 'Zapier', 'HeyGen'],
      blockers: integrationCount > 0 ? [] : ['integration_registry_empty_or_not_visible'],
      lastSeen: generatedAt,
    }),
    makeNode({
      id: 'events',
      label: 'Gateway Events',
      kind: 'event',
      status: 'read_only',
      capabilities: ['incoming webhooks', 'incoming email', 'Telegram', 'schedules'],
      lastSeen: generatedAt,
    }),
    ...buildProviderNodes(context, generatedAt),
    ...buildMcpServerNodes(context, generatedAt),
  ]
}

function buildGatewayEdges(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayEdge[] {
  const providerEdges = buildProviderNodes(context, generatedAt).map((node) =>
    makeEdge('bridge_mcp', node.id, 'mcp-call', true, generatedAt, node.blockers[0] || null),
  )
  const mcpEdges = buildMcpServerNodes(context, generatedAt).map((node) =>
    makeEdge('mcp_tools', node.id, 'mcp-call', true, generatedAt, node.blockers[0] || null),
  )
  return [
    makeEdge('owner', 'gateway', 'command', false, generatedAt, null),
    makeEdge('gateway', 'agent_zero', 'command', false, generatedAt, null),
    makeEdge('gateway', 'bridge_mcp', 'mcp-call', true, generatedAt, null),
    makeEdge('gateway', 'models', 'model-call', true, generatedAt, null),
    makeEdge('gateway', 'tools', 'tool-call', true, generatedAt, null),
    makeEdge('gateway', 'integrations', 'tool-call', true, generatedAt, null),
    makeEdge('gateway', 'events', 'event', false, generatedAt, null),
    makeEdge('gateway', 'brain_sync', 'memory', true, generatedAt, null),
    makeEdge('hermes', 'agent_zero', 'delegation', false, generatedAt, null),
    makeEdge('bridge_mcp', 'mcp_tools', 'mcp-call', true, generatedAt, null),
    ...providerEdges,
    ...mcpEdges,
  ]
}

function buildGatewayCapabilities(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayCapability[] {
  return [
    createGatewayCapability({
      id: 'agent_zero.commander',
      label: 'Agent Zero commander',
      kind: 'agent',
      status: 'connected',
      source_node: 'agent_zero',
      last_seen: generatedAt,
    }),
    createGatewayCapability({
      id: 'hermes.lieutenant',
      label: 'Hermes lieutenant planning',
      kind: 'agent',
      status: deriveHermesStatus(context).blocker ? 'degraded' : 'connected',
      source_node: 'hermes',
      blockers: blockersList(deriveHermesStatus(context).blocker),
      last_seen: generatedAt,
    }),
    ...providerCapabilities(context, generatedAt),
    ...mcpCapabilities(context, generatedAt),
    ...modelCapabilities(context, generatedAt),
    ...toolCapabilities(context, generatedAt),
    ...skillCapabilities(context, generatedAt),
    ...integrationCapabilities(context, generatedAt),
    ...brainCapabilities(context, generatedAt),
  ]
}

function providerCapabilities(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayCapability[] {
  return asRecords(pick(context, 'bridge', 'provider_registry')).map((provider) => {
    const id = gatewayId(String(provider.id || provider.name || 'provider'))
    return createGatewayCapability({
      id: `bridge_provider_${id}`,
      label: cleanLabel(provider.name, id),
      kind: capabilityKindForCategory(String(provider.category || provider.type || 'api')),
      status: statusFromAccess(provider.access, provider.state),
      source_node: `bridge_provider_${id}`,
      requires_session: true,
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
      blockers: statusFromAccess(provider.access, provider.state) === 'blocked' ? [`${id}_blocked`] : [],
      last_seen: generatedAt,
    })
  })
}

function mcpCapabilities(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayCapability[] {
  return asRecords(pick(context, 'mcp', 'servers')).map((server) => {
    const id = gatewayId(String(server.name || 'mcp_server'))
    const blocker = stringOrNull(server.blocked_reason)
    return createGatewayCapability({
      id: `mcp_${id}`,
      label: cleanLabel(server.name, id),
      kind: 'mcp_server',
      status: Boolean(server.reachable) && !blocker ? 'read_only' : 'blocked',
      source_node: `mcp_${id}`,
      requires_session: true,
      read_enabled: Boolean(server.schema_available || server.reachable),
      write_enabled: false,
      execution_enabled: false,
      blockers: blockersList(blocker),
      last_seen: generatedAt,
    })
  })
}

function modelCapabilities(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayCapability[] {
  return asRecords(pick(context, 'models', 'provider_registry')).map((provider) => {
    const id = gatewayId(String(provider.id || provider.name || 'model_provider'))
    const blocker = stringOrNull(provider.blocked_reason)
    return createGatewayCapability({
      id: `model_${id}`,
      label: cleanLabel(provider.name, id),
      kind: 'model',
      status: statusFromAccess(provider.status, provider.status),
      source_node: 'models',
      requires_session: Boolean(provider.bridge_session_required ?? true),
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
      required_credentials: asStringArray(provider.credential_names),
      blockers: blockersList(blocker),
      last_seen: generatedAt,
    })
  })
}

function toolCapabilities(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayCapability[] {
  return asRecords(pick(context, 'tools', 'registry')).map((tool) => {
    const id = gatewayId(String(tool.id || tool.name || 'tool'))
    const blocker = stringOrNull(tool.blocked_reason)
    return createGatewayCapability({
      id: `tool_${id}`,
      label: cleanLabel(tool.name, id),
      kind: 'tool',
      status: statusFromAccess(tool.status, tool.status),
      source_node: 'tools',
      requires_session: Boolean(tool.requires_bridge_session),
      read_enabled: Boolean(tool.read_only ?? true),
      write_enabled: Boolean(tool.write_enabled),
      execution_enabled: false,
      blockers: blockersList(blocker),
      last_seen: generatedAt,
    })
  })
}

function skillCapabilities(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayCapability[] {
  return asRecords(pick(context, 'skills', 'registry')).map((skill) => {
    const id = gatewayId(String(skill.id || skill.name || 'skill'))
    const blockers = blockersList(
      ...asStringArray(skill.blocked_reasons),
      ...asStringArray(skill.missing_dependencies),
      stringOrNull(skill.blocked_reason),
    )
    return createGatewayCapability({
      id: `skill_${id}`,
      label: cleanLabel(skill.name, id),
      kind: 'skill',
      status: blockers.some(Boolean) ? 'blocked' : statusFromAccess(skill.status, skill.status),
      source_node: 'openclaw_plus',
      requires_session: true,
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
      required_tools: asStringArray(skill.required_tools),
      required_credentials: asStringArray(skill.required_credentials),
      blockers,
      last_seen: generatedAt,
    })
  })
}

function integrationCapabilities(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayCapability[] {
  return asRecords(pick(context, 'integrations', 'registry')).map((integration) => {
    const id = gatewayId(String(integration.id || integration.name || 'integration'))
    const blocker = stringOrNull(integration.blocked_reason)
    const missingCredential = Boolean(integration.missing_credential)
    return createGatewayCapability({
      id: `integration_${id}`,
      label: cleanLabel(integration.name, id),
      kind: 'integration',
      status: missingCredential || blocker ? 'blocked' : statusFromAccess(integration.status, integration.status),
      source_node: 'integrations',
      requires_session: Boolean(integration.requires_bridge_session ?? true),
      read_enabled: Boolean(integration.read_only ?? true),
      write_enabled: Boolean(integration.write_enabled),
      execution_enabled: false,
      required_credentials: asStringArray(integration.credential_names),
      blockers: blockersList(blocker, missingCredential ? 'missing_credential' : null),
      last_seen: generatedAt,
    })
  })
}

function brainCapabilities(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayCapability[] {
  const registry = asRecords(pick(context, 'brain', 'registry'))
  const buildwiki = pickRecord(context, 'opencloud_buildwiki')
  const items = registry.length > 0 ? registry : [
    { id: 'obsidian', name: 'Obsidian', status: 'degraded', read_available: false, write_available: false, blocked_reason: 'brain_registry_not_visible' },
    { id: 'mempalace', name: 'MemPalace', status: 'degraded', read_available: false, write_available: false, blocked_reason: 'brain_registry_not_visible' },
    { id: 'graphify', name: 'Graphify', status: 'degraded', read_available: false, write_available: false, blocked_reason: 'brain_registry_not_visible' },
  ]
  return [
    ...items.map((brain) => {
      const id = gatewayId(String(brain.id || brain.source || brain.name || 'brain'))
      const blocker = stringOrNull(brain.blocked_reason) || stringOrNull(brain.write_blocked_reason)
      return createGatewayCapability({
        id: `brain_${id}`,
        label: cleanLabel(brain.name || brain.source, id),
        kind: 'brain',
        status: statusFromAccess(brain.status, brain.raw_state),
        source_node: id,
        requires_session: true,
        read_enabled: Boolean(brain.read_available || brain.read_content_enabled || brain.status === 'connected'),
        write_enabled: Boolean(brain.write_available),
        execution_enabled: false,
        blockers: blockersList(blocker),
        last_seen: generatedAt,
      })
    }),
    createGatewayCapability({
      id: 'brain_buildwiki',
      label: 'Build-Wiki / Farmer',
      kind: 'brain',
      status: buildwiki && Object.keys(buildwiki).length > 0 ? 'read_only' : 'degraded',
      source_node: 'buildwiki',
      requires_session: true,
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
      blockers: buildwiki && Object.keys(buildwiki).length > 0 ? [] : ['buildwiki_status_not_visible'],
      last_seen: generatedAt,
    }),
  ]
}

function buildProviderNodes(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayNode[] {
  return asRecords(pick(context, 'bridge', 'provider_registry')).map((provider) => {
    const id = gatewayId(String(provider.id || provider.name || 'provider'))
    return makeNode({
      id: `bridge_provider_${id}`,
      label: cleanLabel(provider.name, id),
      kind: nodeKindForCategory(String(provider.category || provider.type || 'api')),
      status: statusFromAccess(provider.access, provider.state),
      capabilities: ['Bridge provider', String(provider.category || 'provider')],
      blockers: statusFromAccess(provider.access, provider.state) === 'blocked' ? [`${id}_blocked`] : [],
      lastSeen: generatedAt,
    })
  })
}

function buildMcpServerNodes(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayNode[] {
  return asRecords(pick(context, 'mcp', 'servers')).map((server) => {
    const id = gatewayId(String(server.name || 'mcp_server'))
    const blocker = stringOrNull(server.blocked_reason)
    return makeNode({
      id: `mcp_${id}`,
      label: cleanLabel(server.name, id),
      kind: 'mcp_server',
      status: Boolean(server.reachable) && !blocker ? 'read_only' : 'blocked',
      capabilities: ['MCP tools', 'schema summaries'],
      blockers: blockersList(blocker),
      lastSeen: generatedAt,
    })
  })
}

function deriveHermesStatus(context: AgentZeroReadOnlyContext | null) {
  const hermes = asRecords(pick(context, 'agents', 'items')).find((item) => gatewayId(String(item.id || '')) === 'hermes')
  if (!context) {
    return {
      installed: true,
      reachable: false,
      authConfigured: false,
      blocker: 'agent_zero_ecosystem_context_not_loaded',
    }
  }
  if (!hermes) {
    return {
      installed: true,
      reachable: false,
      authConfigured: false,
      blocker: 'hermes_status_not_visible_in_gateway_registry',
    }
  }
  const status = String(hermes.status || '').toLowerCase()
  const connected = ['active', 'connected', 'healthy'].some((value) => status.includes(value))
  const blocked = ['blocked', 'missing', 'offline', 'unreachable'].some((value) => status.includes(value))
  return {
    installed: true,
    reachable: connected,
    authConfigured: connected,
    blocker: connected
      ? null
      : blocked
        ? 'hermes_live_chat_not_proven'
        : 'hermes_degraded_or_pending_live_proof',
  }
}

function makeNode(input: {
  id: string
  label: string
  kind: GatewayNodeKind
  status: GatewayStatus
  capabilities: string[]
  blockers?: Array<string | null | undefined>
  lastSeen: string
}): GatewayNode {
  const blockers = input.blockers?.filter(Boolean).map(String) || []
  const status = blockers.length > 0 && input.status === 'connected' ? 'degraded' : input.status
  return {
    id: gatewayId(input.id),
    label: sanitizeText(input.label),
    kind: input.kind,
    status,
    owner: 'ecosystem',
    visibility: 'owner_visible',
    health: createGatewayHealth(status, blockers[0] || `${input.label} ${status}`, input.lastSeen),
    capabilities: input.capabilities.map(sanitizeText),
    blockers,
  }
}

function makeEdge(
  source: string,
  target: string,
  kind: GatewayEdge['kind'],
  requiresSession: boolean,
  generatedAt: string,
  blocker: string | null,
): GatewayEdge {
  return {
    source: gatewayId(source),
    target: gatewayId(target),
    kind,
    allowed: !blocker,
    requires_session: requiresSession,
    status: blocker ? 'blocked' : 'connected',
    blocker,
    last_seen: generatedAt,
  }
}

function summarizeNode(registry: GatewayRegistry, id: string, fallbackLabel: string): GatewayNodeStatusSummary {
  const normalizedId = gatewayId(id)
  const node = registry.nodes.find((item) => item.id === normalizedId)
  if (node) {
    return {
      id: node.id,
      label: node.label,
      status: node.status,
      health: node.health,
      blockers: node.blockers,
    }
  }
  const health = createGatewayHealth('missing', `${fallbackLabel} is missing from the Gateway registry.`, null)
  return {
    id: normalizedId,
    label: fallbackLabel,
    status: 'missing',
    health,
    blockers: [`${normalizedId}_missing_from_gateway_registry`],
  }
}

function statusFromAccess(...values: unknown[]): GatewayStatus {
  for (const value of values) {
    const normalized = String(value || '').toLowerCase()
    if (!normalized) continue
    if (normalized.includes('missing')) return 'missing'
    if (normalized.includes('blocked') || normalized.includes('disabled')) return 'blocked'
    if (normalized.includes('degraded') || normalized.includes('pending') || normalized.includes('sandbox')) return 'degraded'
    if (normalized.includes('write')) return 'write_enabled'
    if (normalized.includes('execute') || normalized.includes('active')) return 'connected'
    if (normalized.includes('connected') || normalized.includes('configured') || normalized.includes('visible')) return 'read_only'
    if (normalized.includes('read')) return 'read_only'
  }
  return normalizeGatewayStatus(String(values[0] || 'degraded'))
}

function nodeKindForCategory(category: string): GatewayNodeKind {
  const normalized = category.toLowerCase()
  if (normalized.includes('model')) return 'model'
  if (normalized.includes('mcp')) return 'mcp_server'
  if (normalized.includes('tool')) return 'tool'
  if (normalized.includes('agent')) return 'agent'
  if (normalized.includes('brain') || normalized.includes('memory')) return 'brain'
  if (normalized.includes('event')) return 'event'
  if (normalized.includes('opencloud')) return 'opencloud'
  return 'api'
}

function capabilityKindForCategory(category: string): GatewayCapabilityKind {
  const normalized = category.toLowerCase()
  if (normalized.includes('model')) return 'model'
  if (normalized.includes('mcp')) return 'mcp_server'
  if (normalized.includes('tool')) return 'tool'
  if (normalized.includes('agent')) return 'agent'
  if (normalized.includes('brain') || normalized.includes('memory')) return 'brain'
  if (normalized.includes('api')) return 'api'
  return 'integration'
}

function pick(root: unknown, ...path: string[]): unknown {
  let current: unknown = root
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as UnknownRecord)[key]
  }
  return current
}

function pickRecord(root: unknown, ...path: string[]): UnknownRecord {
  const value = pick(root, ...path)
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asRecords(value: unknown): UnknownRecord[] {
  return asArray(value).filter((item): item is UnknownRecord => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => sanitizeText(String(item))).filter(Boolean) : []
}

function blockersList(...values: Array<string | null | undefined>): string[] {
  return values.map((value) => sanitizeText(String(value || '').trim())).filter(Boolean)
}

function stringOrNull(value: unknown): string | null {
  const text = sanitizeText(String(value || '').trim())
  return text || null
}

function cleanLabel(value: unknown, fallback: string): string {
  return sanitizeText(String(value || fallback).replace(/[_-]+/g, ' '))
}

function sanitizeText(value: string): string {
  return value.replace(SECRETISH_PATTERN, '[redacted]').replace(RAW_PATH_PATTERN, '[path redacted]').trim()
}

function gatewayId(value: string): string {
  return sanitizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'gateway_item'
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function dedupeEdges(edges: GatewayEdge[]): GatewayEdge[] {
  const seen = new Set<string>()
  return edges.filter((edge) => {
    const key = `${edge.source}:${edge.target}:${edge.kind}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
