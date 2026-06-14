import {
  buildGatewayGraphEdgeReadiness,
  GatewayGraphEdgeReadiness,
  GatewayGraphEdgeStatus,
} from '@/lib/gateway-graph-edge-readiness'
import {
  buildGatewayGraphNodeReadiness,
  GatewayGraphNodeReadiness,
  GatewayGraphNodeStatus,
} from '@/lib/gateway-graph-node-readiness'

export type GatewayGraphTopologyRouteGroup =
  | 'models'
  | 'inputs'
  | 'knowledge'
  | 'storage'
  | 'integrations'
  | 'reports'
  | 'webhooks'
  | 'events'
  | 'agentmail'
  | 'zapier'
  | 'browser'

export type GatewayGraphTopologyStatus =
  | 'live'
  | 'read_only'
  | 'guarded'
  | 'standby'
  | 'blocked'
  | 'disabled'

export type GatewayGraphTopologyRelationship = 'structural' | 'readiness'

export type GatewayGraphTrafficState =
  | 'live_recent'
  | 'ready_no_recent_traffic'
  | 'standby_no_heartbeat'
  | 'traffic_data_unavailable'
  | 'blocked'
  | 'disabled'

export type GatewayGraphTrafficCounters = {
  events_last_60s: number
  requests_last_60s: number
  bytes_in_last_60s: number
  bytes_out_last_60s: number
}

export type GatewayGraphTopologyNode = {
  node_id: string
  label: string
  domain: string
  status: GatewayGraphTopologyStatus
  route_group: GatewayGraphTopologyRouteGroup
  primary_reason: string
  next_action: string
  last_heartbeat_at: string | null
  last_success_at: string | null
  virtual?: boolean
}

export type GatewayGraphTopologyEdge = {
  edge_id: string
  source_node_id: string
  target_node_id: string
  domain: string
  relationship: GatewayGraphTopologyRelationship
  status: GatewayGraphTopologyStatus
  route_group: GatewayGraphTopologyRouteGroup
  last_heartbeat_at: string | null
  last_event_at: string | null
  last_success_at: string | null
  traffic: GatewayGraphTrafficCounters
  traffic_state: GatewayGraphTrafficState
  primary_reason: string
  blockers: string[]
  next_action: string
  source_label: string
  target_label: string
}

export type GatewayGraphTopologyPayload = {
  ok: true
  source: 'gateway_graph_topology'
  snapshot_id: string
  generated_at: string
  runtime_id: 'mission-control'
  asset_version: 'gateway-topology-v1'
  traffic_data_source: 'unavailable'
  live_traffic_available: false
  nodes: GatewayGraphTopologyNode[]
  edges: GatewayGraphTopologyEdge[]
  graph_mapping_errors: string[]
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
  external_writes_executed: false
  broad_connector_execution_enabled: false
}

export type GatewayGraphSyncStatus = 'healthy' | 'stale' | 'degraded' | 'failed'

export type GatewayGraphSyncStatusPayload = {
  ok: true
  source: 'gateway_graph_sync_status'
  generated_at: string
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
  external_writes_executed: false
  broad_connector_execution_enabled: false
  graph_sync: {
    status: GatewayGraphSyncStatus
    snapshot_id: string
    last_live_fetch_at: string | null
    last_static_fallback_at: string | null
    topology_node_count: number
    rendered_node_count: number
    topology_edge_count: number
    rendered_edge_count: number
    missing_node_mappings: string[]
    missing_edge_mappings: string[]
    stale_edges: string[]
    status_mismatches: string[]
    traffic_mismatches: string[]
    primary_blocker: string | null
  }
}

type EdgeNodeMap = Record<string, { source_node_id: string; target_node_id: string; route_group: GatewayGraphTopologyRouteGroup }>

const ZERO_TRAFFIC: GatewayGraphTrafficCounters = {
  events_last_60s: 0,
  requests_last_60s: 0,
  bytes_in_last_60s: 0,
  bytes_out_last_60s: 0,
}

const EDGE_NODE_MAP: EdgeNodeMap = {
  'model.openrouter_to_gateway': { source_node_id: 'model.openrouter', target_node_id: 'gateway.core', route_group: 'models' },
  'model.openai_codex_to_gateway': { source_node_id: 'model.openai', target_node_id: 'gateway.core', route_group: 'models' },
  'model.claude_to_gateway': { source_node_id: 'model.claude', target_node_id: 'gateway.core', route_group: 'models' },
  'model.ollama_to_gateway': { source_node_id: 'model.ollama', target_node_id: 'gateway.core', route_group: 'models' },
  'model.nvidia_to_gateway': { source_node_id: 'model.nvidia', target_node_id: 'gateway.core', route_group: 'models' },
  'model.gemini_to_gateway': { source_node_id: 'model.gemini', target_node_id: 'gateway.core', route_group: 'models' },
  'model.groq_to_gateway': { source_node_id: 'model.groq', target_node_id: 'gateway.core', route_group: 'models' },
  'model.xai_grok_to_gateway': { source_node_id: 'model.xai_grok', target_node_id: 'gateway.core', route_group: 'models' },
  'browser.html_surface_to_gateway': { source_node_id: 'browser.html_surface', target_node_id: 'gateway.core', route_group: 'browser' },
  'browser.firefox_to_gateway': { source_node_id: 'browser.firefox', target_node_id: 'gateway.core', route_group: 'browser' },
  'reports.gateway_to_reports': { source_node_id: 'gateway.core', target_node_id: 'int.reports', route_group: 'reports' },
  'webhooks.inbound_to_gateway': { source_node_id: 'input.webhook', target_node_id: 'gateway.core', route_group: 'webhooks' },
  'events.event_bus_to_gateway': { source_node_id: 'input.event', target_node_id: 'gateway.core', route_group: 'events' },
  'agentmail.gateway_to_agentmail': { source_node_id: 'gateway.core', target_node_id: 'int.agentmail', route_group: 'agentmail' },
  'connector.zapier_to_gateway': { source_node_id: 'int.zapier', target_node_id: 'gateway.core', route_group: 'zapier' },
  'connector.google_drive_to_gateway': { source_node_id: 'int.gdrive', target_node_id: 'gateway.core', route_group: 'storage' },
  'connector.onedrive_to_gateway': { source_node_id: 'int.onedrive', target_node_id: 'gateway.core', route_group: 'storage' },
  'connector.external_apis_to_gateway': { source_node_id: 'int.apis', target_node_id: 'gateway.core', route_group: 'integrations' },
  'connector.mcp_servers_to_gateway': { source_node_id: 'int.mcp', target_node_id: 'gateway.core', route_group: 'integrations' },
  'connector.tools_registry_to_gateway': { source_node_id: 'int.tools', target_node_id: 'gateway.core', route_group: 'integrations' },
  'connector.firecrawl_to_gateway': { source_node_id: 'int.firecrawl', target_node_id: 'gateway.core', route_group: 'integrations' },
  'connector.heygen_to_gateway': { source_node_id: 'int.heygen', target_node_id: 'gateway.core', route_group: 'integrations' },
}

function snapshotIdFor(generatedAt: string): string {
  return `gateway-topology-${generatedAt.replace(/[^0-9A-Za-z]/g, '')}`
}

function topologyStatusFromNode(status: GatewayGraphNodeStatus): GatewayGraphTopologyStatus {
  switch (status) {
    case 'live':
      return 'live'
    case 'read_only':
      return 'read_only'
    case 'approval_required':
    case 'degraded':
      return 'guarded'
    case 'blocked':
      return 'blocked'
    case 'disabled':
      return 'disabled'
    case 'standby':
    default:
      return 'standby'
  }
}

function topologyStatusFromEdge(status: GatewayGraphEdgeStatus): GatewayGraphTopologyStatus {
  switch (status) {
    case 'active':
    case 'ready':
      return 'live'
    case 'read_only':
      return 'read_only'
    case 'approval_required':
    case 'degraded':
      return 'guarded'
    case 'blocked':
      return 'blocked'
    case 'disabled':
      return 'disabled'
    case 'standby':
    case 'unknown':
    default:
      return 'standby'
  }
}

function routeGroupForNode(node: Pick<GatewayGraphNodeReadiness, 'node_id' | 'domain'>): GatewayGraphTopologyRouteGroup {
  if (node.node_id === 'int.agentmail') return 'agentmail'
  if (node.node_id === 'int.zapier') return 'zapier'
  if (node.node_id === 'input.webhook' || node.domain === 'webhook') return 'webhooks'
  if (node.node_id === 'input.event') return 'events'
  if (node.node_id === 'int.reports' || node.domain === 'report') return 'reports'
  if (node.node_id === 'int.gdrive' || node.node_id === 'int.onedrive' || node.node_id === 'int.datastores' || node.domain === 'storage' || node.domain === 'data') return 'storage'
  if (node.node_id.startsWith('brain.') || node.domain === 'brain') return 'knowledge'
  if (node.node_id.startsWith('model.') || node.node_id === 'oc.parent' || node.domain === 'model' || node.domain === 'runtime') return 'models'
  if (node.node_id.startsWith('input.') || node.node_id.startsWith('agent.') || node.domain === 'input' || node.domain === 'agent') return 'inputs'
  if (node.domain === 'browser') return 'browser'
  return 'integrations'
}

function trafficStateFor(status: GatewayGraphTopologyStatus, traffic: GatewayGraphTrafficCounters): GatewayGraphTrafficState {
  if (status === 'blocked') return 'blocked'
  if (status === 'disabled') return 'disabled'
  if (traffic.events_last_60s > 0 || traffic.requests_last_60s > 0) return 'live_recent'
  return 'traffic_data_unavailable'
}

function highestPriorityStatus(statuses: GatewayGraphTopologyStatus[]): GatewayGraphTopologyStatus {
  if (statuses.includes('blocked')) return 'blocked'
  if (statuses.includes('guarded')) return 'guarded'
  if (statuses.includes('live')) return 'live'
  if (statuses.includes('read_only')) return 'read_only'
  if (statuses.includes('standby')) return 'standby'
  return 'disabled'
}

function virtualNode(node_id: string, label: string, route_group: GatewayGraphTopologyRouteGroup, status: GatewayGraphTopologyStatus, reason: string, next_action: string): GatewayGraphTopologyNode {
  return {
    node_id,
    label,
    domain: 'browser',
    status,
    route_group,
    primary_reason: reason,
    next_action,
    last_heartbeat_at: null,
    last_success_at: null,
    virtual: true,
  }
}

function topologyNodeFromReadiness(node: GatewayGraphNodeReadiness): GatewayGraphTopologyNode {
  return {
    node_id: node.node_id,
    label: node.label,
    domain: node.domain,
    status: topologyStatusFromNode(node.status),
    route_group: routeGroupForNode(node),
    primary_reason: node.primary_reason,
    next_action: node.next_action,
    last_heartbeat_at: node.last_heartbeat_at,
    last_success_at: node.last_success_at,
  }
}

function edgeWithNoTrustedTraffic(input: Omit<GatewayGraphTopologyEdge, 'traffic' | 'traffic_state'>): GatewayGraphTopologyEdge {
  return {
    ...input,
    traffic: { ...ZERO_TRAFFIC },
    traffic_state: trafficStateFor(input.status, ZERO_TRAFFIC),
  }
}

function structuralEdge(edge_id: string, route_group: GatewayGraphTopologyRouteGroup, target_node_id: string, target_label: string, status: GatewayGraphTopologyStatus, primary_reason: string, next_action: string): GatewayGraphTopologyEdge {
  return edgeWithNoTrustedTraffic({
    edge_id,
    source_node_id: 'gateway.core',
    target_node_id,
    domain: route_group,
    relationship: 'structural',
    status,
    route_group,
    last_heartbeat_at: null,
    last_event_at: null,
    last_success_at: null,
    primary_reason,
    blockers: status === 'blocked' ? [primary_reason] : [],
    next_action,
    source_label: 'Gateway Dispatcher',
    target_label,
  })
}

function readinessEdge(edge: GatewayGraphEdgeReadiness, mapping: EdgeNodeMap[string]): GatewayGraphTopologyEdge {
  const status = topologyStatusFromEdge(edge.status)
  return edgeWithNoTrustedTraffic({
    edge_id: edge.edge_id,
    source_node_id: mapping.source_node_id,
    target_node_id: mapping.target_node_id,
    domain: edge.domain,
    relationship: 'readiness',
    status,
    route_group: mapping.route_group,
    last_heartbeat_at: edge.last_heartbeat_at,
    last_event_at: edge.last_event_at,
    last_success_at: edge.last_success_at,
    primary_reason: edge.primary_reason,
    blockers: edge.blockers,
    next_action: edge.next_action,
    source_label: edge.source,
    target_label: edge.target,
  })
}

export function buildGatewayGraphTopology(generatedAt = new Date().toISOString()): GatewayGraphTopologyPayload {
  const nodeReadiness = buildGatewayGraphNodeReadiness(generatedAt)
  const edgeReadiness = buildGatewayGraphEdgeReadiness(generatedAt)
  const graphMappingErrors: string[] = []
  const nodes = nodeReadiness.nodes.map(topologyNodeFromReadiness)
  const nodeIds = new Set(nodes.map((node) => node.node_id))

  if (!nodeIds.has('browser.html_surface')) {
    nodes.push(virtualNode(
      'browser.html_surface',
      'HTML Surface',
      'browser',
      'read_only',
      'html_surface_registered_no_runtime_bridge',
      'configure_browser_runtime_bridge_if_active_control_is_required',
    ))
  }
  if (!nodeIds.has('browser.firefox')) {
    nodes.push(virtualNode(
      'browser.firefox',
      'Firefox Runtime',
      'browser',
      'standby',
      'firefox_runtime_not_connected',
      'start_or_verify_browser_runtime_bridge',
    ))
  }

  const structuralEdges: GatewayGraphTopologyEdge[] = []
  const groups = new Map<GatewayGraphTopologyRouteGroup, GatewayGraphTopologyNode[]>()
  nodes
    .filter((node) => node.node_id !== 'gateway.core' && !node.virtual)
    .forEach((node) => {
      const groupNodes = groups.get(node.route_group) || []
      groupNodes.push(node)
      groups.set(node.route_group, groupNodes)
    })

  groups.forEach((groupNodes, group) => {
    const groupStatus = highestPriorityStatus(groupNodes.map((node) => node.status))
    structuralEdges.push(structuralEdge(
      `highway.${group}.dispatcher-link`,
      group,
      'gateway.core',
      `${group} highway dispatcher link`,
      groupStatus,
      `${group}_dispatcher_highway_structural_connection`,
      'inspect_topology_data_sync_before_treating_this_as_live_traffic',
    ))
    structuralEdges.push(structuralEdge(
      `highway.${group}.trunk`,
      group,
      'gateway.core',
      `${group} highway trunk`,
      groupStatus,
      `${group}_highway_structural_connection`,
      'select_a_card_to_trace_this_highway',
    ))
    groupNodes.forEach((node) => {
      structuralEdges.push(structuralEdge(
        `highway.${group}.${node.node_id}`,
        group,
        node.node_id,
        node.label,
        node.status,
        node.primary_reason,
        node.next_action,
      ))
    })
  })

  const readinessEdges = edgeReadiness.edges.flatMap((edge) => {
    const mapping = EDGE_NODE_MAP[edge.edge_id]
    if (!mapping) {
      graphMappingErrors.push(`edge_mapping_missing:${edge.edge_id}`)
      return []
    }
    return [readinessEdge(edge, mapping)]
  })

  return {
    ok: true,
    source: 'gateway_graph_topology',
    snapshot_id: snapshotIdFor(generatedAt),
    generated_at: generatedAt,
    runtime_id: 'mission-control',
    asset_version: 'gateway-topology-v1',
    traffic_data_source: 'unavailable',
    live_traffic_available: false,
    nodes,
    edges: [...structuralEdges, ...readinessEdges],
    graph_mapping_errors: graphMappingErrors,
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    external_writes_executed: false,
    broad_connector_execution_enabled: false,
  }
}

export function buildGatewayGraphSyncStatus({
  generatedAt = new Date().toISOString(),
  topology = buildGatewayGraphTopology(generatedAt),
  renderedNodeIds,
  renderedEdgeIds,
}: {
  generatedAt?: string
  topology?: GatewayGraphTopologyPayload
  renderedNodeIds?: string[]
  renderedEdgeIds?: string[]
} = {}): GatewayGraphSyncStatusPayload {
  const topologyNodeIds = topology.nodes.map((node) => node.node_id)
  const topologyEdgeIds = topology.edges.map((edge) => edge.edge_id)
  const renderedNodes = renderedNodeIds || topologyNodeIds
  const renderedEdges = renderedEdgeIds || topologyEdgeIds
  const renderedNodeSet = new Set(renderedNodes)
  const renderedEdgeSet = new Set(renderedEdges)
  const missingNodeMappings = topologyNodeIds.filter((id) => !renderedNodeSet.has(id))
  const missingEdgeMappings = topologyEdgeIds.filter((id) => !renderedEdgeSet.has(id))
  const extraRenderedEdges = renderedEdges.filter((id) => !topologyEdgeIds.includes(id))
  const trafficMismatches = topology.edges
    .filter((edge) => edge.traffic_state === 'live_recent' && edge.traffic.events_last_60s + edge.traffic.requests_last_60s <= 0)
    .map((edge) => edge.edge_id)
  const statusMismatches = extraRenderedEdges.map((id) => `rendered_edge_without_topology:${id}`)
  const staleEdges: string[] = []
  const primaryBlocker = missingNodeMappings.length
    ? 'missing_node_mappings'
    : missingEdgeMappings.length
      ? 'missing_edge_mappings'
      : statusMismatches.length
        ? 'status_mismatches'
        : trafficMismatches.length
          ? 'traffic_mismatches'
          : null
  const syncStatus: GatewayGraphSyncStatus = primaryBlocker ? 'degraded' : 'healthy'

  return {
    ok: true,
    source: 'gateway_graph_sync_status',
    generated_at: generatedAt,
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    external_writes_executed: false,
    broad_connector_execution_enabled: false,
    graph_sync: {
      status: syncStatus,
      snapshot_id: topology.snapshot_id,
      last_live_fetch_at: topology.generated_at,
      last_static_fallback_at: null,
      topology_node_count: topology.nodes.length,
      rendered_node_count: renderedNodes.length,
      topology_edge_count: topology.edges.length,
      rendered_edge_count: renderedEdges.length,
      missing_node_mappings: missingNodeMappings,
      missing_edge_mappings: missingEdgeMappings,
      stale_edges: staleEdges,
      status_mismatches: statusMismatches,
      traffic_mismatches: trafficMismatches,
      primary_blocker: primaryBlocker,
    },
  }
}
