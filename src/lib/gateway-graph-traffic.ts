import {
  buildGatewayGraphTopology,
  GatewayGraphTopologyEdge,
  GatewayGraphTopologyPayload,
  GatewayGraphTopologyRouteGroup,
  GatewayGraphTopologyStatus,
} from '@/lib/gateway-graph-topology'

export type GatewayGraphTrafficSourceStatus = 'readable' | 'unavailable'
export type GatewayGraphTrafficSourceId =
  | 'model_request_logs'
  | 'connector_readiness_events'
  | 'agentmail_events'
  | 'gateway_event_bus'
  | 'knowledge_runtime_events'

export type GatewayGraphTrafficStatus =
  | 'active'
  | 'ready_no_recent_traffic'
  | 'unavailable'
  | 'stale'

export type GatewayGraphTrafficSource = {
  source_id: GatewayGraphTrafficSourceId
  status: GatewayGraphTrafficSourceStatus
  inspected_at: string
  route_groups?: GatewayGraphTopologyRouteGroup[]
  edge_ids?: string[]
  primary_reason?: string
}

export type GatewayGraphEdgeActivity = {
  edge_id: string
  events?: number
  requests?: number
  bytes_in?: number
  bytes_out?: number
  occurred_at: string
  source_id: GatewayGraphTrafficSourceId
}

export type GatewayGraphTrafficEdge = {
  edge_id: string
  route_group: GatewayGraphTopologyRouteGroup
  source_node_id: string
  target_node_id: string
  events_last_60s: number
  requests_last_60s: number
  bytes_in_last_60s: number
  bytes_out_last_60s: number
  last_event_at: string | null
  last_request_at: string | null
  traffic_status: GatewayGraphTrafficStatus
  telemetry_source: GatewayGraphTrafficSourceId | null
  primary_reason: string
}

export type GatewayGraphTrafficPayload = {
  ok: true
  source: 'gateway_graph_traffic'
  telemetry_snapshot_id: string
  generated_at: string
  runtime_id: 'mission-control'
  asset_version: 'gateway-traffic-v1'
  traffic_source: 'live' | 'partial' | 'unavailable'
  telemetry_sources_inspected: GatewayGraphTrafficSource[]
  edges: GatewayGraphTrafficEdge[]
  summary: {
    total_edges: number
    active_traffic_edges: number
    ready_no_recent_traffic_edges: number
    stale_telemetry_edges: number
    unavailable_telemetry_edges: number
  }
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
  external_writes_executed: false
  broad_connector_execution_enabled: false
}

const SOURCE_ROUTE_GROUPS: Record<GatewayGraphTrafficSourceId, GatewayGraphTopologyRouteGroup[]> = {
  model_request_logs: ['models'],
  connector_readiness_events: ['integrations', 'storage', 'reports', 'zapier'],
  agentmail_events: ['agentmail'],
  gateway_event_bus: ['inputs', 'webhooks', 'events'],
  knowledge_runtime_events: ['knowledge'],
}

const READY_STATUSES: GatewayGraphTopologyStatus[] = ['live', 'read_only', 'guarded']

function trafficSnapshotIdFor(generatedAt: string): string {
  return `gateway-traffic-${generatedAt.replace(/[^0-9A-Za-z]/g, '')}`
}

function secondsBetween(laterIso: string, earlierIso: string): number {
  const later = Date.parse(laterIso)
  const earlier = Date.parse(earlierIso)
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.floor((later - earlier) / 1000))
}

function sourceCoversEdge(source: GatewayGraphTrafficSource, edge: GatewayGraphTopologyEdge): boolean {
  if (source.edge_ids?.includes(edge.edge_id)) return true
  const routeGroups = source.route_groups || SOURCE_ROUTE_GROUPS[source.source_id] || []
  return routeGroups.includes(edge.route_group)
}

function readableSourceForEdge(sources: GatewayGraphTrafficSource[], edge: GatewayGraphTopologyEdge) {
  return sources.find((source) => source.status === 'readable' && sourceCoversEdge(source, edge)) || null
}

function activityForEdge(activities: GatewayGraphEdgeActivity[], edge: GatewayGraphTopologyEdge, source: GatewayGraphTrafficSource | null) {
  return activities
    .filter((activity) => activity.edge_id === edge.edge_id && (!source || activity.source_id === source.source_id))
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))[0] || null
}

function trafficEdgeFromTopology(input: {
  edge: GatewayGraphTopologyEdge
  generatedAt: string
  sources: GatewayGraphTrafficSource[]
  activities: GatewayGraphEdgeActivity[]
}): GatewayGraphTrafficEdge {
  const source = readableSourceForEdge(input.sources, input.edge)
  if (!source) {
    return {
      edge_id: input.edge.edge_id,
      route_group: input.edge.route_group,
      source_node_id: input.edge.source_node_id,
      target_node_id: input.edge.target_node_id,
      events_last_60s: 0,
      requests_last_60s: 0,
      bytes_in_last_60s: 0,
      bytes_out_last_60s: 0,
      last_event_at: null,
      last_request_at: null,
      traffic_status: 'unavailable',
      telemetry_source: null,
      primary_reason: 'traffic_data_unavailable',
    }
  }

  const activity = activityForEdge(input.activities, input.edge, source)
  const ageSeconds = activity ? secondsBetween(input.generatedAt, activity.occurred_at) : Number.POSITIVE_INFINITY
  const recent = Boolean(activity && ageSeconds <= 60)
  const events = recent ? Math.max(0, activity?.events || 0) : 0
  const requests = recent ? Math.max(0, activity?.requests || 0) : 0
  const active = events + requests > 0
  const stale = Boolean(activity && !active)
  const ready = READY_STATUSES.includes(input.edge.status)

  return {
    edge_id: input.edge.edge_id,
    route_group: input.edge.route_group,
    source_node_id: input.edge.source_node_id,
    target_node_id: input.edge.target_node_id,
    events_last_60s: events,
    requests_last_60s: requests,
    bytes_in_last_60s: active ? Math.max(0, activity?.bytes_in || 0) : 0,
    bytes_out_last_60s: active ? Math.max(0, activity?.bytes_out || 0) : 0,
    last_event_at: activity && (activity.events || 0) > 0 ? activity.occurred_at : null,
    last_request_at: activity && (activity.requests || 0) > 0 ? activity.occurred_at : null,
    traffic_status: active
      ? 'active'
      : stale
        ? 'stale'
        : ready
          ? 'ready_no_recent_traffic'
          : 'unavailable',
    telemetry_source: source.source_id,
    primary_reason: active
      ? 'trusted_recent_traffic_observed'
      : stale
        ? 'telemetry_stale'
        : ready
          ? 'ready_no_recent_traffic'
          : 'traffic_data_unavailable',
  }
}

function summarize(edges: GatewayGraphTrafficEdge[]): GatewayGraphTrafficPayload['summary'] {
  return {
    total_edges: edges.length,
    active_traffic_edges: edges.filter((edge) => edge.traffic_status === 'active').length,
    ready_no_recent_traffic_edges: edges.filter((edge) => edge.traffic_status === 'ready_no_recent_traffic').length,
    stale_telemetry_edges: edges.filter((edge) => edge.traffic_status === 'stale').length,
    unavailable_telemetry_edges: edges.filter((edge) => edge.traffic_status === 'unavailable').length,
  }
}

function trafficSourceFor(edges: GatewayGraphTrafficEdge[], sources: GatewayGraphTrafficSource[]): GatewayGraphTrafficPayload['traffic_source'] {
  if (!sources.some((source) => source.status === 'readable')) return 'unavailable'
  if (edges.some((edge) => edge.traffic_status === 'active')) return 'live'
  return 'partial'
}

export function buildGatewayGraphTrafficSnapshot({
  generatedAt = new Date().toISOString(),
  topology = buildGatewayGraphTopology(generatedAt),
  trustedSources = [],
  edgeActivity = [],
}: {
  generatedAt?: string
  topology?: GatewayGraphTopologyPayload
  trustedSources?: GatewayGraphTrafficSource[]
  edgeActivity?: GatewayGraphEdgeActivity[]
} = {}): GatewayGraphTrafficPayload {
  const sources = trustedSources.map((source) => ({
    ...source,
    route_groups: source.route_groups || SOURCE_ROUTE_GROUPS[source.source_id] || [],
  }))
  const edges = topology.edges.map((edge) => trafficEdgeFromTopology({
    edge,
    generatedAt,
    sources,
    activities: edgeActivity,
  }))

  return {
    ok: true,
    source: 'gateway_graph_traffic',
    telemetry_snapshot_id: trafficSnapshotIdFor(generatedAt),
    generated_at: generatedAt,
    runtime_id: 'mission-control',
    asset_version: 'gateway-traffic-v1',
    traffic_source: trafficSourceFor(edges, sources),
    telemetry_sources_inspected: sources,
    edges,
    summary: summarize(edges),
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    external_writes_executed: false,
    broad_connector_execution_enabled: false,
  }
}

export function buildGatewayGraphTrafficFromRuntime(generatedAt = new Date().toISOString()) {
  return buildGatewayGraphTrafficSnapshot({
    generatedAt,
    topology: buildGatewayGraphTopology(generatedAt),
    trustedSources: [
      {
        source_id: 'model_request_logs',
        status: 'unavailable',
        inspected_at: generatedAt,
        primary_reason: 'model_request_log_source_not_connected',
      },
      {
        source_id: 'connector_readiness_events',
        status: 'unavailable',
        inspected_at: generatedAt,
        primary_reason: 'connector_readiness_event_source_not_connected',
      },
      {
        source_id: 'agentmail_events',
        status: 'unavailable',
        inspected_at: generatedAt,
        primary_reason: 'agentmail_event_telemetry_source_not_connected',
      },
      {
        source_id: 'gateway_event_bus',
        status: 'unavailable',
        inspected_at: generatedAt,
        primary_reason: 'gateway_event_bus_telemetry_source_not_connected',
      },
      {
        source_id: 'knowledge_runtime_events',
        status: 'unavailable',
        inspected_at: generatedAt,
        primary_reason: 'knowledge_runtime_event_source_not_connected',
      },
    ],
  })
}
