import type { AgentZeroReadOnlyContext } from './agent-zero-bridge'
import { buildAgentZeroEcosystemContext } from './agent-zero-ecosystem-context'
import { BUILDWIKI_ACTION_RUN_NOW, BUILDWIKI_TARGET_SERVICE } from './build-wiki-run-now'
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
  type GatewayFlowPolicyResult,
  type GatewayHealth,
  type GatewayNode,
  type GatewayNodeKind,
  type GatewayPolicy,
  type GatewayRegistry,
  type GatewayStatus,
} from './gateway-model'
import {
  GATEWAY_POLICY_BADGES,
  GATEWAY_POLICY_RULES,
  GATEWAY_ROUTE_DECISIONS,
  type GatewayPolicyBadge,
  type GatewayPolicyRule,
} from './gateway-policy'
import { buildGatewaySecurityProof, type GatewaySecurityProof } from './gateway-security-proof'

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
  mcp_gateway: {
    visible: boolean
    status: GatewayStatus
    mcp_list_route: string
    mcp_tools_route_template: string
    servers: Array<{
      id: string
      label: string
      status: GatewayStatus
      reachable: boolean
      schema_available: boolean
      tool_count: number
      tools_route: string | null
      blocker: string | null
    }>
    tools_integrations: Array<{
      id: string
      label: string
      status: GatewayStatus
      read_only_schema_visible: boolean
      write_enabled: boolean
      requires_bridge_session: boolean
      credential_configured: boolean
      blocker: string | null
    }>
    policy: {
      read_only_schema_visible: true
      writes_require_bridge_session: true
      generation_requires_bridge_session: true
      uploads_require_bridge_session: true
      no_external_write_without_session: true
    }
  }
  llm_gateway: {
    visible: boolean
    status: GatewayStatus
    providers: Array<{
      id: string
      label: string
      status: GatewayStatus
      connected: boolean
      configured: boolean
      model_count: number
      fallback_provider: string | null
      blocker: string | null
      auth_method: string | null
      billing_mode: string | null
    }>
    routing_policy: {
      default_provider: string | null
      fallback_enabled: true
      raw_tracebacks_exposed: false
      task_classes: string
    }
  }
  brain_systems: Array<GatewayNodeStatusSummary & {
    read_enabled: boolean
    write_enabled: boolean
  }>
  buildwiki_opencloud: {
    visible: boolean
    opencloud_status: GatewayStatus
    opencloud_roles: string[]
    worker_runtime_engine: true
    skills_tools_source: true
    buildwiki_farmer_support_layer: true
    future_mini_agent_creation_layer: true
    timer_active: boolean
    timer_unit: string
    timer_state: string | null
    service_active: boolean
    service_unit: string
    service_state: string | null
    last_run_status: string | null
    run_now_action: string
    run_now_target_service: string
    dispatch_scope: string
    skills_tools_available: string[]
    bridge_session_required_actions: string[]
    bridge_session_required: true
    owner_approval_required: true
    farmer_execution_enabled: false
    fork1_state: string | null
    fork1_scope: string | null
    fork2_state: string | null
    fork2_smb_mounted: boolean
    fork2_blocker: string | null
    smb_mounted: boolean
    smb_blocker: string | null
    opencloud_dependency_visible: boolean
    opencloud_deletion_target: false
    opencloud_disable_target: false
    opencloud_destroy_allowed: false
    blockers: string[]
  }
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
  node: GatewayApiNode
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
  route_decisions: typeof GATEWAY_ROUTE_DECISIONS
  rules: GatewayPolicyRule[]
  security_proof: GatewaySecurityProof
}

export type GatewayApiNode = GatewayNode & {
  name: string
  type: GatewayNodeKind
  connected: boolean
  configured: boolean
  read_enabled: boolean
  write_enabled: boolean
  execution_enabled: boolean
  requires_bridge_session: boolean
  blocked_reason: string | null
  last_success: string | null
  last_error: string | null
}

export type GatewayNodesPayload = {
  ok: true
  mode: 'gateway_nodes_read_only'
  generated_at: string
  nodes: GatewayApiNode[]
  execution_enabled: false
  writes_enabled: false
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

const OPENCLOUD_GATEWAY_ROLES = [
  'worker/runtime engine',
  'skills/tools source',
  'Build-Wiki/Farmer support layer',
  'future mini-agent creation layer',
] as const

const OPENCLOUD_SKILLS_TOOLS_FALLBACK = [
  'Build-Wiki status',
  'Farmer timer status',
  'Farmer service status',
  'Run Now adapter metadata',
  'OpenCloud worker/runtime capability catalog',
] as const

const OPENCLOUD_BRIDGE_SESSION_ACTIONS = [
  'buildwiki.run_now',
  'buildwiki.write',
  'opencloud.worker_execution',
  'mini_agent_creation_activation',
] as const

const SECRETISH_PATTERN =
  /(sk-[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*(?:=\s*[^,\s}]+|:\s+[^,\s}]+))/gi
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
  const nodes = enrichSpaceAgentFirecrawlNode(dedupeById([...base.nodes, ...extraNodes]), context)
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
      gateway_read_only_discovery: {
        auth_required: true,
        bridge_session_required: false,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_bridge_session_required: {
        auth_required: true,
        bridge_session_required: true,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_external_write_scoped: {
        auth_required: true,
        bridge_session_required: true,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_protected_action_approval: {
        auth_required: true,
        bridge_session_required: true,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_no_raw_paths: {
        auth_required: true,
        bridge_session_required: false,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_no_secrets: {
        auth_required: true,
        bridge_session_required: false,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_no_fake_done: {
        auth_required: true,
        bridge_session_required: false,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_no_docker_socket: {
        auth_required: true,
        bridge_session_required: false,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_no_raw_root_shell: {
        auth_required: true,
        bridge_session_required: false,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
      gateway_no_direct_secret_reads: {
        auth_required: true,
        bridge_session_required: false,
        write_allowed: false,
        secret_safe: true,
        external_allowed: false,
      },
    },
  }
}


export function buildGatewayNodesPayload(registry: GatewayRegistry): GatewayNodesPayload {
  return {
    ok: true,
    mode: 'gateway_nodes_read_only',
    generated_at: registry.generated_at,
    nodes: registry.nodes.map((node) => toGatewayApiNode(registry, node)),
    execution_enabled: false,
    writes_enabled: false,
  }
}

export function buildGatewayStatusPayload(registry: GatewayRegistry): GatewayStatusPayload {
  const flows = buildGatewayFlows(registry)
  const agentZero = summarizeNode(registry, 'agent_zero', 'Agent Zero')
  const hermes = summarizeNode(registry, 'hermes', 'Hermes')
  const bridge = registry.nodes.find((node) => node.id === 'bridge_mcp')
  const mcpServers = registry.capabilities.filter((capability) => capability.kind === 'mcp_server')
  const providers = registry.capabilities.filter((capability) => capability.id.startsWith('bridge_provider_'))
  const modelProviderCapabilities = registry.capabilities.filter((capability) => capability.kind === 'model' && capability.id.startsWith('model_'))
  const llmGateway = summarizeLlmGateway(modelProviderCapabilities)
  const mcpGateway = summarizeMcpToolGateway(registry.capabilities)
  const brainSystems = ['brain_sync', 'obsidian', 'mempalace', 'graphify', 'buildwiki'].map((id) => {
    const summary = summarizeNode(registry, id, id)
    const capabilities = registry.capabilities.filter((capability) => capability.source_node === id || capability.id.includes(id))
    return {
      ...summary,
      read_enabled: capabilities.some((capability) => capability.read_enabled),
      write_enabled: capabilities.some((capability) => capability.write_enabled),
    }
  })
  const buildWikiCapability = registry.capabilities.find((capability) => capability.id === 'brain_buildwiki')
  const openCloudCapability = registry.capabilities.find((capability) => capability.id === 'opencloud_dependency')
  const buildWikiOpenCloud = summarizeBuildWikiOpenCloud(buildWikiCapability, openCloudCapability)
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
    mcp_gateway: mcpGateway,
    llm_gateway: llmGateway,
    brain_systems: brainSystems,
    buildwiki_opencloud: buildWikiOpenCloud,
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
    node: toGatewayApiNode(registry, node),
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
  const securityProof = buildGatewaySecurityProof(registry)
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
    route_decisions: GATEWAY_ROUTE_DECISIONS,
    rules: GATEWAY_POLICY_RULES,
    security_proof: securityProof,
  }
}


function toGatewayApiNode(registry: GatewayRegistry, node: GatewayNode): GatewayApiNode {
  const relatedCapabilities = registry.capabilities.filter((capability) => capability.source_node === node.id)
  const relatedEdges = registry.edges.filter((edge) => edge.source === node.id || edge.target === node.id)
  const blockedReason = node.blockers.find(Boolean) || relatedCapabilities.flatMap((capability) => capability.blockers).find(Boolean) || null
  const statusConnected = ['connected', 'read_only', 'write_enabled', 'execution_enabled'].includes(node.status)
  const capabilityReadEnabled = relatedCapabilities.some((capability) => capability.read_enabled)
  const capabilityWriteEnabled = relatedCapabilities.some((capability) => capability.write_enabled)
  const capabilityExecutionEnabled = relatedCapabilities.some((capability) => capability.execution_enabled)
  const requiresBridgeSession = relatedCapabilities.some((capability) => capability.requires_session) || relatedEdges.some((edge) => edge.requires_session)
  const missingCredential = /missing_credential|credential:.*:missing/i.test(blockedReason || '')
  const lastSuccess = statusConnected ? node.health.last_seen : null
  const lastError = node.status === 'blocked' || node.status === 'degraded' || node.status === 'legacy_archived'
    ? blockedReason || node.health.summary
    : null

  return {
    ...node,
    name: node.label,
    type: node.kind,
    connected: statusConnected,
    configured: node.status !== 'missing' && node.status !== 'legacy_archived' && !missingCredential,
    read_enabled: (statusConnected || capabilityReadEnabled) && node.status !== 'blocked' && node.status !== 'missing',
    write_enabled: node.status === 'write_enabled' || node.status === 'execution_enabled' || capabilityWriteEnabled,
    execution_enabled: node.status === 'execution_enabled' || capabilityExecutionEnabled,
    requires_bridge_session: requiresBridgeSession,
    blocked_reason: blockedReason,
    last_success: lastSuccess,
    last_error: lastError,
  }
}

function buildGatewayFlows(registry: GatewayRegistry): GatewayFlow[] {
  const edgeFlows = registry.edges.map((edge) => {
    const target = registry.nodes.find((node) => node.id === edge.target)
    const policy = edge.requires_session
      ? registry.policies.gateway_bridge_session_write || registry.policies.bridge_session_required
      : registry.policies.gateway_read_only || registry.policies.read_only
    const executionMode: GatewayExecutionMode = edge.requires_session ? 'bridge_session' : 'read_only'
    const hops = gatewayFlowHops(edge.source, edge.target)
    const blocker = edge.blocker || null
    return createGatewayFlow({
      flow_id: gatewayId(`flow_${edge.source}_${edge.target}_${edge.kind}`),
      source: edge.source,
      target: edge.target,
      requested_action: edge.kind,
      selected_route: {
        source: edge.source,
        target: edge.target,
        edge_kind: edge.kind,
        hops,
      },
      policy_result: gatewayFlowPolicyResult(edge.requires_session, blocker),
      bridge_session_id: null,
      status: edge.status,
      node_health: gatewayFlowNodeHealth(registry, hops),
      request: {
        source: edge.source,
        target: edge.target,
        purpose: `Gateway ${edge.kind} route from ${edge.source} to ${edge.target}`,
      },
      route: {
        source: edge.source,
        target: edge.target,
        edge_kind: edge.kind,
        hops,
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
        blocker,
      },
    })
  })
  const canonicalFlows = buildCanonicalGatewayFlows(registry)
  const hermesCollaborationFlow = buildHermesCollaborationFlow(registry)
  return dedupeGatewayFlows(hermesCollaborationFlow ? [...canonicalFlows, ...edgeFlows, hermesCollaborationFlow] : [...canonicalFlows, ...edgeFlows])
}

function buildCanonicalGatewayFlows(registry: GatewayRegistry): GatewayFlow[] {
  const readOnlyPolicy = registry.policies.gateway_read_only || registry.policies.read_only
  const bridgeSessionPolicy = registry.policies.gateway_bridge_session_write || registry.policies.bridge_session_required
  const definitions = [
    {
      flow_id: 'flow_owner_gateway_agent_zero',
      source: 'owner',
      target: 'agent_zero',
      requested_action: 'owner_command',
      edge_kind: 'command' as const,
      hops: ['owner', 'gateway', 'agent_zero'],
      requires_session: false,
      purpose: 'Owner commands route through Gateway to Agent Zero as commander.',
    },
    {
      flow_id: 'flow_agent_zero_gateway_hermes',
      source: 'agent_zero',
      target: 'hermes',
      requested_action: 'skill_workflow_planning',
      edge_kind: 'delegation' as const,
      hops: ['agent_zero', 'gateway', 'hermes'],
      requires_session: false,
      purpose: 'Agent Zero dispatches planning-only skill and workflow requests to Hermes through Gateway.',
    },
    {
      flow_id: 'flow_agent_zero_gateway_space_agent_research',
      source: 'agent_zero',
      target: 'space_agent',
      requested_action: 'research_packet',
      edge_kind: 'delegation' as const,
      hops: ['agent_zero', 'gateway', 'space_agent'],
      requires_session: false,
      purpose: 'Agent Zero routes web search, page reading, Firecrawl scrape/crawl/map/extract, browser interaction, YouTube/video inspection, screenshot/page-state, and normally inaccessible site/video research stages to Space Agent; Space Agent returns a Research Packet.',
    },
    {
      flow_id: 'flow_hermes_gateway_agent_zero_paperclip_proposal',
      source: 'hermes',
      target: 'paperclip',
      requested_action: 'paperclip_proposal_document',
      edge_kind: 'delegation' as const,
      hops: ['hermes', 'gateway', 'agent_zero', 'paperclip'],
      requires_session: true,
      purpose: 'Hermes can read the Paperclip skills/task registry and draft workflow templates, mini-agent specs, routines, and skill proposal documents. Paperclip issue/work-product storage is blocked until Agent Zero/Gateway approval, Bridge Session scope, and a configured Paperclip write adapter exist.',
    },
    {
      flow_id: 'flow_pi_gateway_agent_zero_paperclip_dispatch_recommendation',
      source: 'pi',
      target: 'paperclip',
      requested_action: 'paperclip_dispatch_recommendation',
      edge_kind: 'delegation' as const,
      hops: ['pi', 'gateway', 'agent_zero', 'paperclip'],
      requires_session: true,
      purpose: 'Pi can see the Paperclip task queue and recommend agent assignment, budget route, model/provider route, and mini-agent creation. Pi output is advisory until proven; Paperclip recommendation storage is blocked until Agent Zero final decision, Gateway policy, Bridge Session scope, and a configured Paperclip write adapter exist.',
    },
    {
      flow_id: 'flow_agent_zero_gateway_paperclip_task_issue',
      source: 'agent_zero',
      target: 'paperclip',
      requested_action: 'paperclip_task_issue',
      edge_kind: 'delegation' as const,
      hops: ['agent_zero', 'gateway', 'paperclip'],
      requires_session: true,
      purpose: 'Agent Zero can see Paperclip status and route workforce task issue requests through Gateway. Paperclip issue creation, assignment to Hermes, SpaceAgent, Pi review, or mini-agents, status tracking, and completion review require Bridge Session scope and a configured Paperclip write adapter.',
    },
    {
      flow_id: 'flow_agent_zero_gateway_paperclip_space_agent_research_task',
      source: 'agent_zero',
      target: 'paperclip',
      requested_action: 'paperclip_space_agent_research_task',
      edge_kind: 'delegation' as const,
      hops: ['agent_zero', 'gateway', 'paperclip', 'space_agent', 'gateway', 'agent_zero'],
      requires_session: true,
      purpose: 'Agent Zero can route Paperclip-managed SpaceAgent web research, YouTube research, and Firecrawl research tasks through Gateway. SpaceAgent returns a Research Packet, Paperclip tracks the research issue/work product only after Bridge Session scope and a configured Paperclip write adapter, Gateway validates evidence, and Agent Zero routes the next responsible agent.',
    },
    {
      flow_id: 'flow_owner_gateway_pi_agent_zero_space_agent_research',
      source: 'owner',
      target: 'space_agent',
      requested_action: 'web_research_intent',
      edge_kind: 'delegation' as const,
      hops: ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'],
      requires_session: false,
      purpose: 'Owner web research requests route through Gateway to Pi recommendation, Agent Zero approval, and Space Agent research packet preparation.',
    },
    {
      flow_id: 'flow_space_agent_gateway_responsible_agent_return',
      source: 'space_agent',
      target: 'agent_zero',
      requested_action: 'research_packet_return',
      edge_kind: 'report' as const,
      hops: ['space_agent', 'gateway', 'agent_zero'],
      requires_session: false,
      purpose: 'Space Agent returns structured Research Packets through Gateway to the responsible agent; Agent Zero owns owner-facing response by default.',
    },
    {
      flow_id: 'flow_agent_zero_gateway_openclaw_skill',
      source: 'agent_zero',
      target: 'openclaw_plus',
      requested_action: 'openclaw_skill_route',
      edge_kind: 'tool-call' as const,
      hops: ['agent_zero', 'gateway', 'openclaw_plus'],
      requires_session: true,
      purpose: 'Agent Zero routes OpenClaw+ skill usage through Gateway; execution-capable skills require Bridge Session scope.',
    },
    {
      flow_id: 'flow_agent_zero_gateway_mcp_tool',
      source: 'agent_zero',
      target: 'mcp_gateway',
      requested_action: 'mcp_tool_route',
      edge_kind: 'mcp-call' as const,
      hops: ['agent_zero', 'gateway', 'mcp_gateway'],
      requires_session: true,
      purpose: 'Agent Zero routes MCP tool discovery and tool-call planning through Gateway; execution remains policy-gated.',
    },
    {
      flow_id: 'flow_agent_zero_gateway_opencloud_worker',
      source: 'agent_zero',
      target: 'opencloud',
      requested_action: 'opencloud_worker_route',
      edge_kind: 'sync' as const,
      hops: ['agent_zero', 'gateway', 'opencloud'],
      requires_session: true,
      purpose: 'Agent Zero routes OpenCloud worker/runtime requests through Gateway; OpenCloud remains a retained worker layer.',
    },
  ]

  return definitions.map((definition) => {
    const target = registry.nodes.find((node) => node.id === definition.target)
    const blocker = target?.blockers[0] || (target ? null : 'gateway_flow_target_missing')
    const status = blocker ? 'blocked' : target?.status || 'missing'
    const policy = definition.requires_session ? bridgeSessionPolicy : readOnlyPolicy
    return createGatewayFlow({
      flow_id: definition.flow_id,
      source: definition.source,
      target: definition.target,
      requested_action: definition.requested_action,
      selected_route: {
        source: definition.source,
        target: definition.target,
        edge_kind: definition.edge_kind,
        hops: definition.hops,
      },
      policy_result: gatewayFlowPolicyResult(definition.requires_session, blocker),
      bridge_session_id: null,
      status,
      node_health: gatewayFlowNodeHealth(registry, definition.hops),
      request: {
        source: definition.source,
        target: definition.target,
        purpose: definition.purpose,
      },
      route: {
        source: definition.source,
        target: definition.target,
        edge_kind: definition.edge_kind,
        hops: definition.hops,
      },
      policy,
      execution_mode: definition.requires_session ? 'bridge_session' : 'read_only',
      audit: {
        audit_id: null,
        events: ['gateway_canonical_flow_registered_read_only'],
        external_write: false,
        secrets_exposed: false,
      },
      result: {
        status,
        summary: blocker ? `Gateway canonical flow is blocked: ${blocker}.` : definition.purpose,
        blocker,
      },
    })
  })
}

function gatewayFlowNodeHealth(registry: GatewayRegistry, hops: readonly string[]): Record<string, GatewayHealth> {
  return Object.fromEntries(
    hops.map((nodeId) => {
      const node = registry.nodes.find((item) => item.id === nodeId)
      const health = registry.health[nodeId] || node?.health || null
      return health ? [nodeId, { ...health }] : null
    }).filter((entry): entry is [string, GatewayHealth] => Boolean(entry)),
  )
}

function gatewayFlowHops(source: string, target: string): string[] {
  if (source === 'owner' && target === 'gateway') return ['owner', 'gateway']
  if (source === 'gateway') return ['owner', 'gateway', target]
  if (target === 'gateway') return [source, 'gateway']
  return [source, 'gateway', target]
}

function gatewayFlowPolicyResult(requiresBridgeSession: boolean, blocker: string | null): GatewayFlowPolicyResult {
  const missingCredential = Boolean(blocker && /credential|api_key|token|auth/i.test(blocker))
  return {
    route_decision: blocker ? (missingCredential ? 'missing_credential' : 'blocked') : (requiresBridgeSession ? 'requires_session' : 'allowed'),
    allowed: !blocker && !requiresBridgeSession,
    requires_bridge_session: requiresBridgeSession,
    blocked_reason: blocker,
  }
}

function dedupeGatewayFlows(flows: GatewayFlow[]): GatewayFlow[] {
  const seen = new Set<string>()
  return flows.filter((flow) => {
    if (seen.has(flow.flow_id)) return false
    seen.add(flow.flow_id)
    return true
  })
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

  const hops = ['agent_zero', 'gateway', 'hermes', 'gateway', 'agent_zero']
  return createGatewayFlow({
    flow_id: 'flow_agent_zero_hermes_collaboration',
    source: 'agent_zero',
    target: 'hermes',
    requested_action: 'skill_workflow_planning',
    selected_route: {
      source: 'agent_zero',
      target: 'hermes',
      edge_kind: 'delegation',
      hops,
    },
    policy_result: gatewayFlowPolicyResult(false, blocker),
    bridge_session_id: null,
    status,
    node_health: gatewayFlowNodeHealth(registry, hops),
    request: {
      source: 'agent_zero',
      target: 'hermes',
      purpose: 'Agent Zero delegates skill and workflow planning to Hermes, then reviews the plan before any execution.',
    },
    route: {
      source: 'agent_zero',
      target: 'hermes',
      edge_kind: 'delegation',
      hops,
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
  const skillCount = asArray(pick(context, 'skills', 'registry')).length
  const brainRegistry = asRecords(pick(context, 'brain', 'registry'))
  const buildwiki = pickRecord(context, 'opencloud_buildwiki')
  const buildwikiVisible = hasRecordValues(buildwiki)
  const brainVisible = brainRegistry.length > 0 || buildwikiVisible
  const modelProviderNodes = buildModelProviderNodes(context, generatedAt)
  const modelProviderVisible = modelProviderNodes.some((node) => node.status !== 'blocked' && node.status !== 'missing')
  const gatewayToolIntegrationNodes = buildGatewayToolIntegrationNodes(context, generatedAt)
  const gatewayToolIntegrationVisible = gatewayToolIntegrationNodes.some((node) => node.status !== 'blocked' && node.status !== 'missing')
  return [
    makeNode({
      id: 'gateway',
      label: 'Gateway',
      kind: 'gateway',
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
      id: 'llm_gateway',
      label: 'LLM Gateway',
      kind: 'model',
      status: modelProviderVisible ? 'read_only' : 'degraded',
      capabilities: ['model routing', 'provider fallback', 'billing/auth visibility', 'traceback redaction'],
      blockers: modelProviderVisible ? [] : ['llm_provider_registry_empty_or_blocked'],
      lastSeen: generatedAt,
    }),
    ...modelProviderNodes,
    makeNode({
      id: 'mcp_gateway',
      label: 'MCP / Tool Gateway',
      kind: 'mcp_server',
      status: mcpCount > 0 || gatewayToolIntegrationVisible ? 'read_only' : 'degraded',
      capabilities: ['MCP server list', 'tool schema summaries', 'read-only integration status', 'session-gated writes'],
      blockers: mcpCount > 0 || gatewayToolIntegrationVisible ? [] : ['mcp_tool_gateway_sources_not_visible'],
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
      id: 'skills',
      label: 'Skills',
      kind: 'skill',
      status: skillCount > 0 ? 'read_only' : 'degraded',
      capabilities: ['OpenClaw+ shared skills', 'Hermes skill proposals', 'Bridge Session gated activation'],
      blockers: skillCount > 0 ? [] : ['skill_registry_empty_or_not_visible'],
      lastSeen: generatedAt,
    }),
    makeNode({
      id: 'data_sources',
      label: 'Data Sources',
      kind: 'data_source',
      status: brainVisible || integrationCount > 0 ? 'read_only' : 'degraded',
      capabilities: ['system discovery', 'source discovery', 'schemas', 'tables', 'columns'],
      blockers: brainVisible || integrationCount > 0 ? [] : ['data_sources_not_visible'],
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
    ...gatewayToolIntegrationNodes,
    makeNode({
      id: 'events',
      label: 'Gateway Events',
      kind: 'event',
      status: 'read_only',
      capabilities: ['incoming webhooks', 'incoming email', 'Telegram', 'schedules'],
      lastSeen: generatedAt,
    }),
    makeNode({
      id: 'brain',
      label: 'Brain',
      kind: 'brain_system',
      status: brainVisible ? 'read_only' : 'degraded',
      capabilities: ['Brain Sync', 'Obsidian', 'MemPalace', 'Graphify', 'Build-Wiki/Farmer'],
      blockers: brainVisible ? [] : ['brain_registry_not_visible'],
      lastSeen: generatedAt,
    }),
    makeNode({
      id: 'opencloud',
      label: 'OpenCloud',
      kind: 'opencloud_worker',
      status: buildwikiVisible ? 'read_only' : 'degraded',
      capabilities: [
        ...OPENCLOUD_GATEWAY_ROLES,
        'OpenCloud skills/tools',
        'Build-Wiki worker runtime',
        'not deletion target',
      ],
      blockers: buildwikiVisible ? [] : ['opencloud_dependency_status_not_visible'],
      lastSeen: generatedAt,
    }),
    ...buildProviderNodes(context, generatedAt),
    ...buildMcpServerNodes(context, generatedAt),
  ]
}

function buildGatewayEdges(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayEdge[] {
  const gatewayToolIntegrationNodes = buildGatewayToolIntegrationNodes(context, generatedAt)
  const providerEdges = buildProviderNodes(context, generatedAt).map((node) =>
    makeEdge('bridge_mcp', node.id, 'mcp-call', true, generatedAt, node.blockers[0] || null),
  )
  const mcpEdges = buildMcpServerNodes(context, generatedAt).map((node) =>
    makeEdge('mcp_tools', node.id, 'mcp-call', true, generatedAt, node.blockers[0] || null),
  )
  const mcpGatewayServerEdges = buildMcpServerNodes(context, generatedAt).map((node) =>
    makeEdge('mcp_gateway', node.id, 'mcp-call', true, generatedAt, node.blockers[0] || null),
  )
  const mcpGatewayToolEdges = gatewayToolIntegrationNodes.map((node) =>
    makeEdge('mcp_gateway', node.id, 'tool-call', true, generatedAt, node.blockers[0] || null),
  )
  const modelEdges = buildModelProviderNodes(context, generatedAt).map((node) =>
    makeEdge('llm_gateway', node.id, 'model-call', true, generatedAt, node.blockers[0] || null),
  )
  return [
    makeEdge('owner', 'gateway', 'command', false, generatedAt, null),
    makeEdge('gateway', 'agent_zero', 'command', false, generatedAt, null),
    makeEdge('gateway', 'bridge_mcp', 'mcp-call', true, generatedAt, null),
    makeEdge('gateway', 'mcp_gateway', 'mcp-call', true, generatedAt, null),
    makeEdge('gateway', 'models', 'model-call', true, generatedAt, null),
    makeEdge('gateway', 'llm_gateway', 'model-call', true, generatedAt, null),
    makeEdge('gateway', 'tools', 'tool-call', true, generatedAt, null),
    makeEdge('gateway', 'integrations', 'tool-call', true, generatedAt, null),
    makeEdge('gateway', 'skills', 'tool-call', true, generatedAt, null),
    makeEdge('gateway', 'data_sources', 'sync', false, generatedAt, null),
    makeEdge('gateway', 'events', 'event', false, generatedAt, null),
    makeEdge('gateway', 'brain', 'memory', false, generatedAt, null),
    makeEdge('gateway', 'brain_sync', 'memory', true, generatedAt, null),
    makeEdge('brain', 'brain_sync', 'memory', false, generatedAt, null),
    makeEdge('data_sources', 'brain', 'sync', false, generatedAt, null),
    makeEdge('brain', 'obsidian', 'memory', true, generatedAt, null),
    makeEdge('brain', 'mempalace', 'memory', true, generatedAt, null),
    makeEdge('brain', 'graphify', 'memory', true, generatedAt, null),
    makeEdge('brain', 'buildwiki', 'sync', true, generatedAt, null),
    makeEdge('buildwiki', 'opencloud', 'sync', true, generatedAt, null),
    makeEdge('hermes', 'agent_zero', 'delegation', false, generatedAt, null),
    makeEdge('bridge_mcp', 'mcp_tools', 'mcp-call', true, generatedAt, null),
    makeEdge('mcp_gateway', 'mcp_tools', 'mcp-call', true, generatedAt, null),
    ...providerEdges,
    ...mcpEdges,
    ...mcpGatewayServerEdges,
    ...mcpGatewayToolEdges,
    ...modelEdges,
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
    ...gatewayToolIntegrationCapabilities(context, generatedAt),
    ...spaceAgentFirecrawlCapabilities(context, generatedAt),
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
    const reachable = Boolean(server.reachable ?? statusFromAccess(server.status, server.state) !== 'blocked')
    const schemaAvailable = Boolean(server.schema_available || server.schema_visible)
    const toolCount = numericValue(server.tool_count) ?? numericValue(server.tools_count) ?? 0
    const toolsRoute = stringOrNull(server.tools_endpoint) || `/api/mcp/servers/${id}/tools`
    return createGatewayCapability({
      id: `mcp_${id}`,
      label: cleanLabel(server.name, id),
      kind: 'mcp_server',
      status: reachable && !blocker ? 'read_only' : 'blocked',
      source_node: `mcp_${id}`,
      requires_session: true,
      read_enabled: Boolean(schemaAvailable || reachable),
      write_enabled: false,
      execution_enabled: false,
      blockers: blockersList(blocker),
      status_details: {
        mcp_list_route: '/api/mcp/list',
        tools_route: toolsRoute,
        tool_count: toolCount,
        reachable,
        schema_available: schemaAvailable,
        read_only_schema_visible: Boolean(schemaAvailable || reachable),
        writes_require_bridge_session: true,
        execution_enabled: false,
        transport: stringOrNull(server.transport),
      },
      last_seen: generatedAt,
    })
  })
}

type GatewayToolIntegrationDefinition = {
  id: string
  label: string
  aliases: string[]
  nodeKind: GatewayNodeKind
  credentialNames: string[]
  capabilities: string[]
  missingBlocker: string
}

type GatewayToolIntegrationView = {
  definition: GatewayToolIntegrationDefinition
  id: string
  nodeId: string
  label: string
  status: GatewayStatus
  blocker: string | null
  credentialConfigured: boolean
  reachable: boolean
  readOnlySchemaVisible: boolean
  writeEnabled: boolean
  uploadConnectorConfigured: boolean
  folderLookupAvailable: boolean
  generationRequiresBridgeSession: boolean
  writesRequireBridgeSession: boolean
  incomingStatus: string | null
  outgoingStatus: string | null
  domainRules: string | null
  installed: boolean
  running: boolean
  apiKeyConfigured: boolean
  sourceKind: string
}

const GATEWAY_TOOL_INTEGRATION_DEFINITIONS: GatewayToolIntegrationDefinition[] = [
  {
    id: 'zapier',
    label: 'Zapier',
    aliases: ['zapier'],
    nodeKind: 'mcp_server',
    credentialNames: ['ZAPIER_TOKEN', 'ZAPIER_API_KEY'],
    capabilities: ['MCP tool schemas', 'Zapier action catalog', 'session-gated writes'],
    missingBlocker: 'zapier_not_configured_or_not_visible_in_gateway_registry',
  },
  {
    id: 'heygen',
    label: 'HeyGen',
    aliases: ['heygen', 'hey gen'],
    nodeKind: 'api',
    credentialNames: ['HEYGEN_API_KEY'],
    capabilities: ['schema visibility', 'generation request planning', 'session-gated generation'],
    missingBlocker: 'heygen_not_configured_or_not_visible_in_gateway_registry',
  },
  {
    id: 'firecrawl',
    label: 'Firecrawl',
    aliases: ['firecrawl', 'fire crawl'],
    nodeKind: 'tool',
    credentialNames: ['FIRECRAWL_API_KEY'],
    capabilities: [
      'credential status',
      'read-only crawl status',
      'adapter visibility',
      'Firecrawl search capability',
      'Firecrawl scrape capability',
      'Firecrawl crawl capability',
      'Firecrawl map capability',
      'Firecrawl extract capability',
      'Firecrawl interact/browser capability gated by configuration',
    ],
    missingBlocker: 'firecrawl_not_configured_or_not_visible_in_gateway_registry',
  },
  {
    id: 'agentmail',
    label: 'AgentMail',
    aliases: ['agentmail', 'agent mail', 'email'],
    nodeKind: 'delivery_channel',
    credentialNames: ['AGENTMAIL_API_KEY'],
    capabilities: ['incoming mail status', 'outgoing mail status', 'domain allow-list rules'],
    missingBlocker: 'agentmail_not_configured_or_not_visible_in_gateway_registry',
  },
  {
    id: 'google_drive',
    label: 'Google Drive',
    aliases: ['google drive', 'gdrive', 'drive'],
    nodeKind: 'delivery_channel',
    credentialNames: ['GOOGLE_DRIVE_CREDENTIALS', 'GOOGLE_SERVICE_ACCOUNT_JSON'],
    capabilities: ['folder lookup status', 'upload connector status', 'session-gated report delivery'],
    missingBlocker: 'google_drive_not_configured_or_not_visible_in_gateway_registry',
  },
  {
    id: 'onedrive',
    label: 'OneDrive',
    aliases: ['onedrive', 'one drive', 'microsoft drive'],
    nodeKind: 'delivery_channel',
    credentialNames: ['ONEDRIVE_TOKEN', 'MICROSOFT_GRAPH_TOKEN'],
    capabilities: ['folder lookup status', 'upload connector status', 'session-gated report delivery'],
    missingBlocker: 'onedrive_not_configured_or_not_visible_in_gateway_registry',
  },
  {
    id: 'n8n',
    label: 'n8n',
    aliases: ['n8n', 'workflow automation'],
    nodeKind: 'event',
    credentialNames: ['N8N_API_KEY'],
    capabilities: ['installed status', 'running status', 'reachability', 'API key configured status'],
    missingBlocker: 'n8n_not_installed_or_not_visible_in_gateway_registry',
  },
]

function buildGatewayToolIntegrationNodes(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayNode[] {
  return buildGatewayToolIntegrationViews(context).map((view) => makeNode({
    id: view.nodeId,
    label: view.label,
    kind: view.definition.nodeKind,
    status: view.status,
    capabilities: view.definition.capabilities,
    blockers: blockersList(view.blocker),
    lastSeen: generatedAt,
  }))
}

function gatewayToolIntegrationCapabilities(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayCapability[] {
  return buildGatewayToolIntegrationViews(context).map((view) => createGatewayCapability({
    id: `integration_${view.id}`,
    label: view.label,
    kind: 'integration',
    status: view.status,
    source_node: view.nodeId,
    requires_session: true,
    read_enabled: view.readOnlySchemaVisible || view.reachable || view.credentialConfigured,
    available_to: ['agent_zero', 'hermes'],
    execution_requirements: [
      'gateway_schema_visibility_read_only',
      'bridge_session_required_for_writes',
    ],
    write_enabled: false,
    execution_enabled: false,
    required_credentials: view.definition.credentialNames,
    blockers: blockersList(view.blocker),
    status_details: {
      connected: view.status === 'connected',
      configured: view.status !== 'blocked' && view.status !== 'missing',
      credential_configured: view.credentialConfigured,
      reachable: view.reachable,
      read_only_schema_visible: view.readOnlySchemaVisible,
      write_enabled: view.writeEnabled,
      writes_require_bridge_session: view.writesRequireBridgeSession,
      generation_requires_bridge_session: view.generationRequiresBridgeSession,
      uploads_require_bridge_session: view.id === 'google_drive' || view.id === 'onedrive',
      upload_connector_configured: view.uploadConnectorConfigured,
      folder_lookup_available: view.folderLookupAvailable,
      incoming_status: view.incomingStatus,
      outgoing_status: view.outgoingStatus,
      domain_rules: view.domainRules,
      installed: view.installed,
      running: view.running,
      api_key_configured: view.apiKeyConfigured,
      source_kind: view.sourceKind,
      execution_enabled: false,
      blocked_reason: view.blocker,
    },
    last_seen: generatedAt,
  }))
}

function buildGatewayToolIntegrationViews(context: AgentZeroReadOnlyContext | null): GatewayToolIntegrationView[] {
  const integrations = asRecords(pick(context, 'integrations', 'registry'))
  const tools = asRecords(pick(context, 'tools', 'registry'))
  const providers = asRecords(pick(context, 'bridge', 'provider_registry'))
  const mcpServers = asRecords(pick(context, 'mcp', 'servers'))
  const n8nRecord = pickRecord(context, 'n8n')
  const allSources = [...integrations, ...tools, ...providers, ...mcpServers]

  return GATEWAY_TOOL_INTEGRATION_DEFINITIONS.map((definition) => {
    const explicitSource = definition.id === 'n8n' && hasRecordValues(n8nRecord) ? n8nRecord : undefined
    const source = explicitSource || findByAliases(allSources, definition.aliases)
    const missingCredential = Boolean(source?.missing_credential)
    const sourceStatus = source ? statusFromAccess(source.status, source.state, source.access, source.raw_state, source.active_state) : 'blocked'
    const blocker = stringOrNull(source?.blocked_reason) ||
      stringOrNull(source?.blocker) ||
      (missingCredential ? 'missing_credential' : null) ||
      (!source ? definition.missingBlocker : null)
    const reachable = Boolean(source?.reachable ?? source?.connected ?? (source && sourceStatus !== 'blocked' && sourceStatus !== 'missing'))
    const schemaVisible = Boolean(
      source?.schema_available ||
      source?.schema_visible ||
      source?.tools_visible ||
      source?.tool_schema_visible ||
      source?.read_only ||
      numericValue(source?.tool_count),
    )
    const credentialConfigured = Boolean(
      source?.credential_present ||
      source?.credential_configured ||
      source?.auth_configured ||
      source?.api_key_configured ||
      (!missingCredential && source && definition.credentialNames.length === 0),
    )
    const installed = Boolean(source?.installed ?? (source && definition.id !== 'n8n'))
    const running = Boolean(source?.running ?? source?.active ?? (definition.id !== 'n8n' && reachable))
    const writeEnabled = Boolean(source?.write_enabled)
    const uploadConnectorConfigured = Boolean(source?.upload_connector_configured || source?.upload_adapter_configured || source?.upload_configured)
    const folderLookupAvailable = Boolean(source?.folder_lookup_available || source?.folder_lookup || source?.folder_lookup_configured)
    const status: GatewayStatus = blocker ? 'blocked' : sourceStatus

    return {
      definition,
      id: definition.id,
      nodeId: `integration_${definition.id}`,
      label: definition.label,
      status,
      blocker,
      credentialConfigured,
      reachable,
      readOnlySchemaVisible: Boolean(schemaVisible || reachable),
      writeEnabled,
      uploadConnectorConfigured,
      folderLookupAvailable,
      generationRequiresBridgeSession: definition.id === 'heygen',
      writesRequireBridgeSession: true,
      incomingStatus: stringOrNull(source?.incoming_status) || stringOrNull(source?.imap_status),
      outgoingStatus: stringOrNull(source?.outgoing_status) || stringOrNull(source?.smtp_status) || stringOrNull(source?.rest_send_status),
      domainRules: stringOrNull(source?.domain_rules) || stringOrNull(source?.allowlist_policy),
      installed,
      running,
      apiKeyConfigured: Boolean(source?.api_key_configured || source?.credential_present || source?.credential_configured),
      sourceKind: explicitSource ? 'n8n_status' : source ? 'gateway_registry' : 'missing',
    } satisfies GatewayToolIntegrationView
  })
}


const SPACE_AGENT_FIRECRAWL_OPERATIONS = [
  { id: 'search', label: 'Firecrawl search', operation: 'firecrawl_search', bridgeSession: false },
  { id: 'scrape', label: 'Firecrawl scrape', operation: 'firecrawl_scrape', bridgeSession: false },
  { id: 'crawl', label: 'Firecrawl crawl', operation: 'firecrawl_crawl', bridgeSession: false },
  { id: 'map', label: 'Firecrawl map', operation: 'firecrawl_map', bridgeSession: false },
  { id: 'extract', label: 'Firecrawl extract', operation: 'firecrawl_extract', bridgeSession: false },
  { id: 'interact_browser', label: 'Firecrawl interact/browser', operation: 'firecrawl_interact_browser', bridgeSession: true },
] as const

type SpaceAgentFirecrawlOperation = (typeof SPACE_AGENT_FIRECRAWL_OPERATIONS)[number]

function enrichSpaceAgentFirecrawlNode(nodes: GatewayNode[], context: AgentZeroReadOnlyContext | null): GatewayNode[] {
  const firecrawl = getFirecrawlToolIntegrationView(context)
  const details = spaceAgentFirecrawlStatusDetails(firecrawl)
  const capabilityLabels = SPACE_AGENT_FIRECRAWL_OPERATIONS.map((operation) => `${operation.label} capability`)

  return nodes.map((node) => {
    if (node.id !== 'space_agent') return node
    return {
      ...node,
      capabilities: dedupeStrings([...node.capabilities, ...capabilityLabels]),
      status_details: {
        ...(node.status_details || {}),
        ...details,
      },
    }
  })
}

function spaceAgentFirecrawlCapabilities(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayCapability[] {
  const firecrawl = getFirecrawlToolIntegrationView(context)
  const blocker = spaceAgentFirecrawlBlocker(firecrawl)
  const credentialConfigured = Boolean(firecrawl?.credentialConfigured)
  const backendReachable = Boolean(firecrawl?.reachable || firecrawl?.readOnlySchemaVisible)
  const status: GatewayStatus = blocker ? 'blocked' : 'read_only'

  return SPACE_AGENT_FIRECRAWL_OPERATIONS.map((operation) => createGatewayCapability({
    id: `space_agent.firecrawl.${operation.id}`,
    label: operation.label,
    kind: 'tool',
    status,
    source_node: 'space_agent',
    read_enabled: !blocker,
    write_enabled: false,
    execution_enabled: false,
    requires_session: operation.bridgeSession,
    available_to: ['agent_zero', 'hermes', 'pi'],
    required_credentials: ['FIRECRAWL_API_KEY'],
    required_tools: ['firecrawl'],
    execution_requirements: spaceAgentFirecrawlRequirements(operation),
    blockers: blockersList(blocker),
    status_details: {
      operation: operation.operation,
      firecrawl_credential_configured: credentialConfigured,
      firecrawl_backend_reachable: backendReachable,
      read_only_research: true,
      write_enabled: false,
      execution_enabled: false,
      requires_bridge_session: operation.bridgeSession,
      external_writes_enabled: false,
      blocked_reason: blocker,
      source_kind: firecrawl?.sourceKind || 'missing',
      secrets_exposed: false,
    },
    last_seen: generatedAt,
  }))
}

function getFirecrawlToolIntegrationView(context: AgentZeroReadOnlyContext | null): GatewayToolIntegrationView | null {
  return buildGatewayToolIntegrationViews(context).find((view) => view.id === 'firecrawl') || null
}

function spaceAgentFirecrawlStatusDetails(firecrawl: GatewayToolIntegrationView | null): Record<string, string | boolean | null> {
  const blocker = spaceAgentFirecrawlBlocker(firecrawl)
  const credentialConfigured = Boolean(firecrawl?.credentialConfigured)
  const operationState = blocker
    ? (blocker.includes('credential') ? 'blocked_missing_credential' : 'blocked_gateway_dependency')
    : 'available_read_only_research'

  return {
    firecrawl_status: blocker ? 'blocked' : 'available_read_only_research',
    firecrawl_credential_configured: credentialConfigured,
    firecrawl_search: operationState,
    firecrawl_scrape: operationState,
    firecrawl_crawl: operationState,
    firecrawl_map: operationState,
    firecrawl_extract: operationState,
    firecrawl_interact_browser: blocker ? operationState : 'gated_by_gateway_policy',
    firecrawl_blocked_reason: blocker,
    firecrawl_source_visible: Boolean(firecrawl),
    firecrawl_read_only_schema_visible: Boolean(firecrawl?.readOnlySchemaVisible),
    firecrawl_backend_reachable: Boolean(firecrawl?.reachable),
    browser_status: blocker ? 'blocked_until_firecrawl_ready_or_manual_browser_adapter_configured' : 'read_only_gated_by_gateway_policy',
    youtube_support: 'metadata_description_transcript_chapters_key_claims_when_available',
    latest_research_jobs: 'none_recorded_yet',
    handoff_target: 'agent_zero_by_default',
    blockers_summary: blocker || 'none',
    secrets_exposed: false,
  }
}

function spaceAgentFirecrawlBlocker(firecrawl: GatewayToolIntegrationView | null): string | null {
  if (!firecrawl) return 'firecrawl_not_visible_in_gateway_registry'
  if (!firecrawl.credentialConfigured) return 'firecrawl_missing_credential'
  if (firecrawl.blocker) return firecrawl.blocker === 'missing_credential' ? 'firecrawl_missing_credential' : firecrawl.blocker
  if (!firecrawl.reachable && !firecrawl.readOnlySchemaVisible) return 'firecrawl_backend_adapter_missing'
  return null
}

function spaceAgentFirecrawlRequirements(operation: SpaceAgentFirecrawlOperation): string[] {
  return [
    'gateway_route_required',
    'space_agent_research_packet_required',
    'firecrawl_credential_required',
    'firecrawl_operations_block_when_credential_missing',
    'no_external_writes',
    ...(operation.bridgeSession ? ['bridge_session_required_for_browser_interaction'] : ['read_only_discovery_first']),
  ]
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

type LlmProviderDefinition = {
  id: string
  label: string
  aliases: string[]
  credentialNames: string[]
  authMethod: string
  billingMode: string
  taskClasses: string[]
  fallbackOrder: string[]
  missingBlocker: string
  modelAliases?: string[]
}

type LlmProviderView = {
  definition: LlmProviderDefinition
  id: string
  nodeId: string
  label: string
  status: GatewayStatus
  connected: boolean
  configured: boolean
  modelCount: number
  models: string[]
  fallbackProvider: string | null
  blocker: string | null
  authMethod: string
  billingMode: string
  apiBillingInUse: boolean
  apiKeyConfigured: boolean
  oauthSubscriptionConfigured: boolean
  pluginConnected: boolean
  bestUseCase: string | null
}

const LLM_PROVIDER_DEFINITIONS: LlmProviderDefinition[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    aliases: ['openrouter', 'open router'],
    credentialNames: ['OPENROUTER_API_KEY'],
    authMethod: 'api_key_or_mission_control_proxy',
    billingMode: 'OpenRouter/provider billing when execution is approved',
    taskClasses: ['default routing', 'hosted model fallback', 'model catalog'],
    fallbackOrder: ['openai', 'claude_anthropic', 'ollama'],
    missingBlocker: 'openrouter_not_configured_or_not_visible_in_provider_registry',
    modelAliases: ['openrouter'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    aliases: ['openai', 'gpt'],
    credentialNames: ['OPENAI_API_KEY'],
    authMethod: 'api_key_or_mission_control_proxy',
    billingMode: 'OpenAI API billing only if explicitly configured for execution',
    taskClasses: ['general assistant', 'report drafting', 'coding support'],
    fallbackOrder: ['openrouter', 'codex_chatgpt', 'ollama'],
    missingBlocker: 'openai_not_configured_or_not_visible_in_provider_registry',
    modelAliases: ['openai', 'gpt', 'o3', 'o4', 'codex'],
  },
  {
    id: 'codex_chatgpt',
    label: 'Codex/ChatGPT',
    aliases: ['codex', 'chatgpt', 'codex_chatgpt'],
    credentialNames: [],
    authMethod: 'codex_chatgpt_oauth_plugin',
    billingMode: 'ChatGPT subscription when plugin auth is connected; no API billing by default',
    taskClasses: ['coding helper', 'reasoning helper', 'repo planning'],
    fallbackOrder: ['openai', 'openrouter', 'ollama'],
    missingBlocker: 'codex_chatgpt_plugin_not_connected',
    modelAliases: ['codex', 'openai'],
  },
  {
    id: 'claude_anthropic',
    label: 'Claude/Anthropic',
    aliases: ['anthropic', 'claude', 'claude_anthropic'],
    credentialNames: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    authMethod: 'claude_code_oauth_preferred_api_key_not_default',
    billingMode: 'Claude Code subscription if OAuth is configured; Anthropic API billing only when explicitly chosen',
    taskClasses: ['deep reasoning', 'coding review', 'long analysis', 'planning'],
    fallbackOrder: ['openrouter', 'openai', 'ollama'],
    missingBlocker: 'claude_anthropic_not_configured_or_oauth_not_proven',
    modelAliases: ['anthropic', 'claude'],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    aliases: ['ollama', 'local'],
    credentialNames: [],
    authMethod: 'local_adapter',
    billingMode: 'local runtime; no external API billing',
    taskClasses: ['local fallback', 'private/offline tasks'],
    fallbackOrder: ['openrouter', 'openai'],
    missingBlocker: 'ollama_not_configured_or_not_visible_in_provider_registry',
    modelAliases: ['ollama', 'local'],
  },
  {
    id: 'nvidia',
    label: 'NVIDIA',
    aliases: ['nvidia'],
    credentialNames: ['NVIDIA_API_KEY'],
    authMethod: 'api_key_or_gateway_provider',
    billingMode: 'NVIDIA/provider billing when execution is approved',
    taskClasses: ['gpu/provider-backed inference'],
    fallbackOrder: ['openrouter', 'openai'],
    missingBlocker: 'nvidia_not_configured_or_not_visible_in_provider_registry',
    modelAliases: ['nvidia'],
  },
  {
    id: 'groq',
    label: 'Groq',
    aliases: ['groq'],
    credentialNames: ['GROQ_API_KEY'],
    authMethod: 'api_key_or_gateway_provider',
    billingMode: 'Groq/provider billing when execution is approved',
    taskClasses: ['low latency inference', 'fast lightweight routing'],
    fallbackOrder: ['openrouter', 'openai', 'ollama'],
    missingBlocker: 'groq_not_configured_or_not_visible_in_provider_registry',
    modelAliases: ['groq'],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    aliases: ['gemini', 'google', 'google_ai'],
    credentialNames: ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    authMethod: 'api_key_or_gateway_provider',
    billingMode: 'Google/Gemini API billing when execution is approved',
    taskClasses: ['long context', 'multimodal', 'Google-family reasoning'],
    fallbackOrder: ['openrouter', 'openai', 'claude_anthropic'],
    missingBlocker: 'gemini_not_configured_or_not_visible_in_provider_registry',
    modelAliases: ['google', 'gemini'],
  },
]

function modelCapabilities(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayCapability[] {
  return buildLlmProviderViews(context).map((view) => createGatewayCapability({
    id: `model_${view.id}`,
    label: view.label,
    kind: 'model',
    status: view.status,
    source_node: view.nodeId,
    requires_session: true,
    read_enabled: view.configured || view.connected,
    available_to: ['agent_zero', 'hermes'],
    execution_requirements: ['bridge_session_required_for_model_execution', 'gateway_model_fallback_enabled'],
    write_enabled: false,
    execution_enabled: false,
    required_credentials: view.definition.credentialNames,
    blockers: blockersList(view.blocker),
    status_details: {
      connected: view.connected,
      configured: view.configured,
      model_count: view.modelCount,
      models: view.models.slice(0, 12).join(', ') || null,
      fallback_provider: view.fallbackProvider,
      fallback_available: Boolean(view.fallbackProvider),
      fallback_order: view.definition.fallbackOrder.join(', '),
      task_classes: view.definition.taskClasses.join(', '),
      auth_method: view.authMethod,
      billing_mode: view.billingMode,
      api_key_configured: view.apiKeyConfigured,
      api_billing_in_use: view.apiBillingInUse,
      oauth_subscription_configured: view.oauthSubscriptionConfigured,
      plugin_connected: view.pluginConnected,
      raw_tracebacks_exposed: false,
      failure_fallback_policy: 'redact_litellm_openrouter_tracebacks_and_use_configured_fallback_or_blocked_status',
      best_use_case: view.bestUseCase,
    },
    last_seen: generatedAt,
  }))
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
      ...asStringArray(skill.blocked_dependencies),
      ...asStringArray(skill.missing_dependencies),
      stringOrNull(skill.blocked_reason),
    )
    const availableTo = uniqueStringArray([
      ...asStringArray(skill.available_to),
      ...asStringArray(skill.available_to_agents),
      'agent_zero',
      'hermes',
    ])
    const executionRequirements = uniqueStringArray([
      ...asStringArray(skill.execution_requirements),
      'bridge_session_required_for_execution',
    ])
    return createGatewayCapability({
      id: `skill_${id}`,
      label: cleanLabel(skill.name, id),
      kind: 'skill',
      status: blockers.some(Boolean) ? 'blocked' : statusFromAccess(skill.status, skill.status),
      source_node: 'openclaw_plus',
      requires_session: true,
      read_enabled: true,
      available_to: availableTo,
      execution_requirements: executionRequirements,
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
  const canonicalIntegrationIds = new Set(GATEWAY_TOOL_INTEGRATION_DEFINITIONS.map((definition) => definition.id))
  return asRecords(pick(context, 'integrations', 'registry')).filter((integration) => {
    const id = gatewayId(String(integration.id || integration.name || 'integration'))
    return !canonicalIntegrationIds.has(id)
  }).map((integration) => {
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
  const buildwikiVisible = hasRecordValues(buildwiki)
  const registryIds = new Set(registry.map((brain) => gatewayId(String(brain.id || brain.source || brain.name || 'brain'))))
  const items = registry.length > 0 ? [...registry] : [
    { id: 'obsidian', name: 'Obsidian', status: 'degraded', read_available: false, write_available: false, blocked_reason: 'brain_registry_not_visible' },
    { id: 'mempalace', name: 'MemPalace', status: 'degraded', read_available: false, write_available: false, blocked_reason: 'brain_registry_not_visible' },
    { id: 'graphify', name: 'Graphify', status: 'degraded', read_available: false, write_available: false, blocked_reason: 'brain_registry_not_visible' },
  ]
  if (!registryIds.has('brain_sync')) {
    items.unshift({
      id: 'brain_sync',
      name: 'Brain Sync',
      status: context ? 'connected' : 'degraded',
      read_available: Boolean(context),
      write_available: false,
      blocked_reason: context ? null : 'brain_registry_not_visible',
    })
  }

  const brainItems = items.map((brain) => {
    const id = gatewayId(String(brain.id || brain.source || brain.name || 'brain'))
    const blocker = stringOrNull(brain.blocked_reason) || stringOrNull(brain.write_blocked_reason)
    const readEnabled = Boolean(brain.read_available || brain.read_content_enabled || brain.status === 'connected')
    const writeAvailable = Boolean(brain.write_available)
    const queryAvailable = Boolean(brain.query_available ?? readEnabled)
    const visible = Boolean(brain.status_visible ?? brain.visible ?? (readEnabled || writeAvailable || queryAvailable))
    return createGatewayCapability({
      id: `brain_${id}`,
      label: cleanLabel(brain.name || brain.source, id),
      kind: 'brain',
      status: statusFromAccess(brain.status, brain.raw_state),
      source_node: id,
      requires_session: true,
      read_enabled: readEnabled,
      available_to: ['agent_zero', 'hermes'],
      execution_requirements: ['bridge_session_required_for_brain_writes'],
      write_enabled: writeAvailable,
      execution_enabled: false,
      blockers: blockersList(blocker),
      status_details: {
        visible,
        read_available: readEnabled,
        write_available: writeAvailable,
        query_available: queryAvailable,
        write_enabled: false,
        blocked_reason: blocker,
      },
      last_seen: generatedAt,
    })
  })

  const timer = pickRecord(buildwiki, 'timer')
  const service = pickRecord(buildwiki, 'service')
  const lastRun = pickRecord(buildwiki, 'last_run')
  const runNow = pickRecord(buildwiki, 'run_now')
  const forkState = pickRecord(buildwiki, 'fork_state')
  const fork1 = pickRecord(forkState, 'fork1')
  const fork2 = pickRecord(forkState, 'fork2')
  const smb = pickRecord(buildwiki, 'smb')
  const runNowBlocker = stringOrNull(runNow.blocked_reason)
  const fork2Blocker = stringOrNull(fork2.blocker)
  const smbBlocker = stringOrNull(smb.blocker)
  const timerUnit = stringOrNull(timer.unit) || 'opencloud-docs-farmer.timer'
  const serviceUnit = stringOrNull(service.unit) || BUILDWIKI_TARGET_SERVICE
  const opencloudSkillsTools = uniqueStringArray([
    ...asStringArray(buildwiki.skills_tools_available),
    ...asStringArray(buildwiki.skills),
    ...asStringArray(buildwiki.tools),
  ])
  const skillsToolsAvailable = opencloudSkillsTools.length > 0
    ? opencloudSkillsTools
    : [...OPENCLOUD_SKILLS_TOOLS_FALLBACK]
  const skillsToolsSummary = skillsToolsAvailable.join(', ')
  const bridgeSessionActionsSummary = OPENCLOUD_BRIDGE_SESSION_ACTIONS.join(', ')
  const buildWikiBlockers = buildwikiVisible
    ? blockersList(runNowBlocker, fork2Blocker, smbBlocker)
    : ['buildwiki_status_not_visible']

  const buildWikiCapability = createGatewayCapability({
    id: 'brain_buildwiki',
    label: 'Build-Wiki / Farmer',
    kind: 'brain',
    status: buildwikiVisible ? 'read_only' : 'degraded',
    source_node: 'buildwiki',
    requires_session: true,
    read_enabled: buildwikiVisible,
    available_to: ['agent_zero', 'hermes'],
    execution_requirements: [
      'bridge_session_required_for_buildwiki_run_now',
      `run_now_scope:${BUILDWIKI_TARGET_SERVICE}`,
    ],
    write_enabled: false,
    execution_enabled: false,
    required_tools: ['systemd_user_opencloud_docs_farmer_status'],
    blockers: buildWikiBlockers,
    status_details: {
      visible: buildwikiVisible,
      timer_active: Boolean(buildwiki.timer_active ?? timer.active),
      timer_unit: timerUnit,
      timer_state: stringOrNull(timer.active_state),
      service_active: Boolean(service.active),
      service_unit: serviceUnit,
      service_state: stringOrNull(service.active_state),
      last_run_status: stringOrNull(lastRun.status),
      last_run_result: stringOrNull(lastRun.result),
      run_now_action: stringOrNull(runNow.action) || BUILDWIKI_ACTION_RUN_NOW,
      run_now_target_service: stringOrNull(runNow.target_service) || BUILDWIKI_TARGET_SERVICE,
      dispatch_scope: stringOrNull(runNow.dispatch_scope) || BUILDWIKI_TARGET_SERVICE,
      skills_tools_available: skillsToolsSummary,
      bridge_session_required_actions: bridgeSessionActionsSummary,
      owner_approval_required: true,
      bridge_session_required: true,
      fork1_state: stringOrNull(fork1.status),
      fork1_scope: stringOrNull(fork1.service_scope) || BUILDWIKI_TARGET_SERVICE,
      fork2_state: stringOrNull(fork2.status) || 'blocked',
      fork2_smb_mounted: Boolean(fork2.smb_mounted),
      fork2_blocker: fork2Blocker || smbBlocker || 'smb_fork2_requires_verified_mount_and_owner_approval',
      smb_mounted: Boolean(smb.mounted),
      smb_blocker: smbBlocker || fork2Blocker || 'smb_fork2_requires_verified_mount_and_owner_approval',
      farmer_execution_enabled: false,
      worker_runtime_engine: true,
      skills_tools_source: true,
      buildwiki_farmer_support_layer: true,
      future_mini_agent_creation_layer: true,
      opencloud_direct_access_visible: Boolean(buildwiki.direct_opencloud_access_visible),
      opencloud_deletion_target: false,
      opencloud_disable_target: false,
      opencloud_destroy_allowed: false,
    },
    last_seen: generatedAt,
  })

  const openCloudCapability = createGatewayCapability({
    id: 'opencloud_dependency',
    label: 'OpenCloud worker/runtime engine',
    kind: 'api',
    status: buildwikiVisible ? 'read_only' : 'degraded',
    source_node: 'opencloud',
    requires_session: true,
    read_enabled: buildwikiVisible,
    available_to: ['agent_zero', 'hermes'],
    execution_requirements: [
      'bridge_session_required_for_worker_execution',
      'bridge_session_required_for_skill_tool_activation',
      'bridge_session_required_for_future_mini_agent_creation',
      'opencloud_not_deletion_target',
    ],
    write_enabled: false,
    execution_enabled: false,
    blockers: buildwikiVisible ? [] : ['opencloud_dependency_status_not_visible'],
    status_details: {
      visible: buildwikiVisible,
      dependency_for: 'buildwiki_farmer',
      worker_runtime_engine: true,
      skills_tools_source: true,
      buildwiki_farmer_support_layer: true,
      future_mini_agent_creation_layer: true,
      retained_in_gateway: true,
      requires_bridge_session: true,
      opencloud_roles: OPENCLOUD_GATEWAY_ROLES.join(', '),
      skills_tools_available: skillsToolsSummary,
      bridge_session_required_actions: bridgeSessionActionsSummary,
      timer_unit: timerUnit,
      service_unit: serviceUnit,
      opencloud_deletion_target: false,
      opencloud_disable_target: false,
      opencloud_destroy_allowed: false,
      decommission_safe: false,
      direct_opencloud_access_visible: Boolean(buildwiki.direct_opencloud_access_visible),
      farmer_execution_enabled: false,
      fork1_scope: stringOrNull(fork1.service_scope) || BUILDWIKI_TARGET_SERVICE,
      fork2_state: stringOrNull(fork2.status) || 'blocked',
      fork2_smb_mounted: Boolean(fork2.smb_mounted),
      fork2_blocker: fork2Blocker || smbBlocker || 'smb_fork2_requires_verified_mount_and_owner_approval',
      blocked_reason: buildwikiVisible ? null : 'opencloud_dependency_status_not_visible',
    },
    last_seen: generatedAt,
  })

  return [...brainItems, buildWikiCapability, openCloudCapability]
}

function buildModelProviderNodes(context: AgentZeroReadOnlyContext | null, generatedAt: string): GatewayNode[] {
  return buildLlmProviderViews(context).map((view) => makeNode({
    id: view.nodeId,
    label: view.label,
    kind: 'model',
    status: view.status,
    capabilities: [
      `${view.modelCount} visible models`,
      `auth: ${view.authMethod}`,
      view.fallbackProvider ? `fallback: ${view.fallbackProvider}` : 'fallback unavailable',
    ],
    blockers: view.blocker ? [view.blocker] : [],
    lastSeen: generatedAt,
  }))
}

function buildLlmProviderViews(context: AgentZeroReadOnlyContext | null): LlmProviderView[] {
  const providers = asRecords(pick(context, 'models', 'provider_registry'))
  const integrations = asRecords(pick(context, 'integrations', 'registry'))
  const catalog = asRecords(pick(context, 'models', 'catalog'))
  const views = LLM_PROVIDER_DEFINITIONS.map((definition) => {
    const provider = findByAliases(providers, definition.aliases)
    const integration = findByAliases(integrations, definition.aliases)
    const source = provider || integration || null
    const sourceStatus = source ? statusFromAccess(source.status, source.state, source.access, source.raw_state) : 'blocked'
    const blocked = !source || sourceStatus === 'blocked' || sourceStatus === 'missing'
    const blocker = sanitizeModelBlocker(stringOrNull(source?.blocked_reason) || (blocked ? definition.missingBlocker : null))
    const models = modelNamesForProvider(definition, provider, catalog)
    const modelCount = numericValue(provider?.model_count) ?? models.length
    const apiKeyConfigured = Boolean(provider?.credential_present || integration?.credential_present)
    const oauthSubscriptionConfigured = Boolean(
      source && (
        String(source.auth_method || source.auth || '').toLowerCase().includes('oauth') ||
        String(source.billing || source.billing_mode || '').toLowerCase().includes('subscription') ||
        String(source.status || '').toLowerCase().includes('connected') && ['codex_chatgpt', 'claude_anthropic'].includes(definition.id)
      ),
    )
    const pluginConnected = Boolean(source && ['codex_chatgpt', 'claude_anthropic'].includes(definition.id) && !blocked)
    const status = blocked ? 'blocked' : sourceStatus
    const connected = status === 'connected' || Boolean(source?.connected)
    const configured = !blocked && (connected || ['read_only', 'write_enabled', 'execution_enabled'].includes(status) || Boolean(source?.credential_present))
    return {
      definition,
      id: definition.id,
      nodeId: `model_${definition.id}`,
      label: definition.label,
      status,
      connected,
      configured,
      modelCount,
      models,
      fallbackProvider: null,
      blocker,
      authMethod: authMethodForProvider(definition, { apiKeyConfigured, oauthSubscriptionConfigured, pluginConnected }),
      billingMode: billingModeForProvider(definition, { apiKeyConfigured, oauthSubscriptionConfigured, pluginConnected }),
      apiBillingInUse: Boolean(apiKeyConfigured && !oauthSubscriptionConfigured && definition.credentialNames.length > 0),
      apiKeyConfigured,
      oauthSubscriptionConfigured,
      pluginConnected,
      bestUseCase: stringOrNull(provider?.best_use_case) || definition.taskClasses.join(', '),
    } satisfies LlmProviderView
  })

  return views.map((view) => ({
    ...view,
    fallbackProvider: fallbackProviderFor(view, views),
  }))
}

function fallbackProviderFor(view: LlmProviderView, views: LlmProviderView[]): string | null {
  return view.definition.fallbackOrder.find((candidate) => {
    const target = views.find((item) => item.id === candidate)
    return target && target.status !== 'blocked' && target.status !== 'missing'
  }) || null
}

function modelNamesForProvider(definition: LlmProviderDefinition, provider: UnknownRecord | undefined, catalog: UnknownRecord[]): string[] {
  const explicitModels = asStringArray(provider?.models)
  if (explicitModels.length > 0) return explicitModels.slice(0, 40)
  const aliases = definition.modelAliases || definition.aliases
  const catalogNames = catalog.filter((model) => {
    const haystack = `${model.provider || ''} ${model.name || ''} ${model.alias || ''}`.toLowerCase()
    return aliases.some((alias) => haystack.includes(alias.toLowerCase()))
  }).map((model) => sanitizeText(String(model.name || model.alias || '')).trim()).filter(Boolean)
  if (definition.id === 'openrouter' && catalogNames.length === 0) {
    return catalog.map((model) => sanitizeText(String(model.name || model.alias || '')).trim()).filter(Boolean).slice(0, 40)
  }
  return Array.from(new Set(catalogNames)).slice(0, 40)
}

function authMethodForProvider(
  definition: LlmProviderDefinition,
  state: { apiKeyConfigured: boolean; oauthSubscriptionConfigured: boolean; pluginConnected: boolean },
): string {
  if (definition.id === 'claude_anthropic') {
    if (state.oauthSubscriptionConfigured) return 'claude_code_oauth_subscription'
    if (state.apiKeyConfigured) return 'anthropic_api_key_configured_api_billing_possible'
  }
  if (definition.id === 'codex_chatgpt') {
    return state.pluginConnected ? 'codex_chatgpt_oauth_plugin_connected' : definition.authMethod
  }
  return definition.authMethod
}

function billingModeForProvider(
  definition: LlmProviderDefinition,
  state: { apiKeyConfigured: boolean; oauthSubscriptionConfigured: boolean; pluginConnected: boolean },
): string {
  if (definition.id === 'claude_anthropic') {
    if (state.oauthSubscriptionConfigured) return 'claude_code_subscription'
    if (state.apiKeyConfigured) return 'anthropic_api_key_billing_possible_not_default_for_plugin'
  }
  if (definition.id === 'codex_chatgpt') {
    return state.pluginConnected ? 'chatgpt_subscription_plugin' : definition.billingMode
  }
  return definition.billingMode
}

function summarizeLlmGateway(capabilities: GatewayCapability[]): GatewayStatusPayload['llm_gateway'] {
  const modelProviders = capabilities.filter((capability) => LLM_PROVIDER_DEFINITIONS.some((definition) => `model_${definition.id}` === capability.id))
  const visibleProviders = modelProviders.filter((capability) => capability.status !== 'blocked' && capability.status !== 'missing')
  return {
    visible: modelProviders.length > 0,
    status: visibleProviders.length > 0 ? 'read_only' : 'degraded',
    providers: modelProviders.map((capability) => ({
      id: capability.id.replace(/^model_/, ''),
      label: capability.label,
      status: capability.status,
      connected: detailBoolean(capability.status_details, 'connected'),
      configured: detailBoolean(capability.status_details, 'configured'),
      model_count: numericValue(capability.status_details.model_count) ?? 0,
      fallback_provider: detailString(capability.status_details, 'fallback_provider'),
      blocker: capability.blockers[0] || null,
      auth_method: detailString(capability.status_details, 'auth_method'),
      billing_mode: detailString(capability.status_details, 'billing_mode'),
    })),
    routing_policy: {
      default_provider: visibleProviders[0]?.id.replace(/^model_/, '') || null,
      fallback_enabled: true,
      raw_tracebacks_exposed: false,
      task_classes: 'chat, plan, coding, reasoning, long-context, local fallback, low-latency, multimodal',
    },
  }
}

function summarizeMcpToolGateway(capabilities: GatewayCapability[]): GatewayStatusPayload['mcp_gateway'] {
  const mcpServers = capabilities.filter((capability) => capability.kind === 'mcp_server')
  const toolIntegrations = capabilities.filter((capability) =>
    GATEWAY_TOOL_INTEGRATION_DEFINITIONS.some((definition) => capability.id === `integration_${definition.id}`),
  )
  const visibleItems = [...mcpServers, ...toolIntegrations].filter((capability) => capability.status !== 'blocked' && capability.status !== 'missing')
  return {
    visible: mcpServers.length > 0 || toolIntegrations.length > 0,
    status: visibleItems.length > 0 ? 'read_only' : 'degraded',
    mcp_list_route: '/api/mcp/list',
    mcp_tools_route_template: '/api/mcp/servers/:id/tools',
    servers: mcpServers.map((capability) => ({
      id: capability.id.replace(/^mcp_/, ''),
      label: capability.label,
      status: capability.status,
      reachable: detailBoolean(capability.status_details, 'reachable'),
      schema_available: detailBoolean(capability.status_details, 'schema_available'),
      tool_count: numericValue(capability.status_details.tool_count) ?? 0,
      tools_route: detailString(capability.status_details, 'tools_route'),
      blocker: capability.blockers[0] || null,
    })),
    tools_integrations: toolIntegrations.map((capability) => ({
      id: capability.id.replace(/^integration_/, ''),
      label: capability.label,
      status: capability.status,
      read_only_schema_visible: detailBoolean(capability.status_details, 'read_only_schema_visible'),
      write_enabled: detailBoolean(capability.status_details, 'write_enabled'),
      requires_bridge_session: capability.requires_session,
      credential_configured: detailBoolean(capability.status_details, 'credential_configured'),
      blocker: capability.blockers[0] || null,
    })),
    policy: {
      read_only_schema_visible: true,
      writes_require_bridge_session: true,
      generation_requires_bridge_session: true,
      uploads_require_bridge_session: true,
      no_external_write_without_session: true,
    },
  }
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

function summarizeBuildWikiOpenCloud(
  buildWikiCapability: GatewayCapability | undefined,
  openCloudCapability: GatewayCapability | undefined,
): GatewayStatusPayload['buildwiki_opencloud'] {
  const details = buildWikiCapability?.status_details || {}
  const openCloudDetails = openCloudCapability?.status_details || {}
  const blockers = blockersList(...(buildWikiCapability?.blockers || []), ...(openCloudCapability?.blockers || []))
  const skillsToolsAvailable = detailStringArray(details, 'skills_tools_available', [...OPENCLOUD_SKILLS_TOOLS_FALLBACK])
  const bridgeSessionRequiredActions = detailStringArray(details, 'bridge_session_required_actions', [...OPENCLOUD_BRIDGE_SESSION_ACTIONS])
  const opencloudRoles = detailStringArray(openCloudDetails, 'opencloud_roles', [...OPENCLOUD_GATEWAY_ROLES])
  return {
    visible: Boolean(buildWikiCapability),
    opencloud_status: openCloudCapability?.status || 'missing',
    opencloud_roles: opencloudRoles,
    worker_runtime_engine: true,
    skills_tools_source: true,
    buildwiki_farmer_support_layer: true,
    future_mini_agent_creation_layer: true,
    timer_active: detailBoolean(details, 'timer_active'),
    timer_unit: detailString(details, 'timer_unit') || 'opencloud-docs-farmer.timer',
    timer_state: detailString(details, 'timer_state'),
    service_active: detailBoolean(details, 'service_active'),
    service_unit: detailString(details, 'service_unit') || BUILDWIKI_TARGET_SERVICE,
    service_state: detailString(details, 'service_state'),
    last_run_status: detailString(details, 'last_run_status'),
    run_now_action: detailString(details, 'run_now_action') || BUILDWIKI_ACTION_RUN_NOW,
    run_now_target_service: detailString(details, 'run_now_target_service') || BUILDWIKI_TARGET_SERVICE,
    dispatch_scope: detailString(details, 'dispatch_scope') || BUILDWIKI_TARGET_SERVICE,
    skills_tools_available: skillsToolsAvailable,
    bridge_session_required_actions: bridgeSessionRequiredActions,
    bridge_session_required: true,
    owner_approval_required: true,
    farmer_execution_enabled: false,
    fork1_state: detailString(details, 'fork1_state'),
    fork1_scope: detailString(details, 'fork1_scope'),
    fork2_state: detailString(details, 'fork2_state') || 'blocked',
    fork2_smb_mounted: detailBoolean(details, 'fork2_smb_mounted'),
    fork2_blocker: detailString(details, 'fork2_blocker') || 'smb_fork2_requires_verified_mount_and_owner_approval',
    smb_mounted: detailBoolean(details, 'smb_mounted'),
    smb_blocker: detailString(details, 'smb_blocker') || 'smb_fork2_requires_verified_mount_and_owner_approval',
    opencloud_dependency_visible: Boolean(openCloudCapability),
    opencloud_deletion_target: false,
    opencloud_disable_target: false,
    opencloud_destroy_allowed: false,
    blockers,
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
  if (normalized.includes('commander')) return 'commander'
  if (normalized.includes('lieutenant')) return 'lieutenant'
  if (normalized.includes('agent')) return 'mini_agent'
  if (normalized.includes('brain') || normalized.includes('memory')) return 'brain_system'
  if (normalized.includes('event')) return 'event'
  if (normalized.includes('opencloud')) return 'opencloud_worker'
  if (normalized.includes('delivery') || normalized.includes('mail') || normalized.includes('drive')) return 'delivery_channel'
  if (normalized.includes('data') || normalized.includes('source')) return 'data_source'
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

function findByAliases(records: UnknownRecord[], aliases: string[]): UnknownRecord | undefined {
  return records.find((record) => {
    const haystack = `${record.id || ''} ${record.name || ''} ${record.provider || ''}`.toLowerCase()
    return aliases.some((alias) => haystack.includes(alias.toLowerCase()))
  })
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function sanitizeModelBlocker(value: string | null): string | null {
  if (!value) return null
  const sanitized = sanitizeText(value)
  if (/traceback|stack trace|litellm|presidio|openrouter.*(?:exception|error)/i.test(sanitized)) {
    return 'model_provider_error_redacted_fallback_required'
  }
  return sanitized
}

function hasRecordValues(record: UnknownRecord): boolean {
  return Object.keys(record).length > 0
}

function detailString(details: GatewayCapability['status_details'], key: string): string | null {
  const value = details[key]
  if (value === null || value === undefined || value === false) return null
  const text = sanitizeText(String(value).trim())
  return text || null
}

function detailBoolean(details: GatewayCapability['status_details'], key: string): boolean {
  const value = details[key]
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = String(value || '').toLowerCase()
  return ['true', '1', 'yes', 'active', 'connected', 'read_only', 'write_enabled'].includes(normalized)
}

function detailStringArray(details: GatewayCapability['status_details'], key: string, fallback: string[]): string[] {
  const value = detailString(details, key)
  if (!value) return fallback
  return uniqueStringArray(value.split(',').map((item) => item.trim()))
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

function uniqueStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => sanitizeText(value)).filter(Boolean))).sort((a, b) => a.localeCompare(b))
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
