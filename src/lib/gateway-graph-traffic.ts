import {
  buildGatewayGraphTopology,
  GatewayGraphTopologyEdge,
  GatewayGraphTopologyPayload,
  GatewayGraphTopologyRouteGroup,
  GatewayGraphTopologyStatus,
} from '@/lib/gateway-graph-topology'
import Database from 'better-sqlite3'
import { config } from '@/lib/config'

export type GatewayGraphTrafficSourceStatus = 'readable' | 'unavailable'
export type GatewayGraphTrafficSourceId =
  | 'model_request_logs'
  | 'connector_readiness_events'
  | 'agentmail_events'
  | 'gateway_event_bus'
  | 'knowledge_runtime_events'
  | 'report_preview_events'
  | 'zapier_discovery_events'
  | 'storage_sync_events'
  | 'bridge_queue_events'
  | 'workflow_trigger_events'
  | 'ai_app_request_events'
  | 'agent_request_events'

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

export type GatewayGraphMissingTrafficMapping = {
  source_id: GatewayGraphTrafficSourceId
  telemetry_kind: string
  observed_at: string | null
  reason: 'traffic_edge_mapping_missing'
  table: string
  provider?: string | null
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
    missing_traffic_mappings: number
  }
  missing_traffic_mappings: GatewayGraphMissingTrafficMapping[]
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
  report_preview_events: ['reports'],
  zapier_discovery_events: ['zapier'],
  storage_sync_events: ['storage'],
  bridge_queue_events: ['agentmail'],
  workflow_trigger_events: ['events', 'webhooks'],
  ai_app_request_events: ['inputs', 'models'],
  agent_request_events: ['inputs'],
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

function readableSourcesForEdge(sources: GatewayGraphTrafficSource[], edge: GatewayGraphTopologyEdge) {
  return sources.filter((source) => source.status === 'readable' && sourceCoversEdge(source, edge))
}

function activityForEdge(activities: GatewayGraphEdgeActivity[], edge: GatewayGraphTopologyEdge, sources: GatewayGraphTrafficSource[]) {
  const sourceIds = new Set(sources.map((source) => source.source_id))
  return activities
    .filter((activity) => activity.edge_id === edge.edge_id && sourceIds.has(activity.source_id))
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))[0] || null
}

function trafficEdgeFromTopology(input: {
  edge: GatewayGraphTopologyEdge
  generatedAt: string
  sources: GatewayGraphTrafficSource[]
  activities: GatewayGraphEdgeActivity[]
}): GatewayGraphTrafficEdge {
  const sources = readableSourcesForEdge(input.sources, input.edge)
  if (!sources.length) {
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

  const activity = activityForEdge(input.activities, input.edge, sources)
  const source = activity
    ? sources.find((item) => item.source_id === activity.source_id) || sources[0]
    : sources[0]
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
    missing_traffic_mappings: 0,
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
  missingTrafficMappings = [],
}: {
  generatedAt?: string
  topology?: GatewayGraphTopologyPayload
  trustedSources?: GatewayGraphTrafficSource[]
  edgeActivity?: GatewayGraphEdgeActivity[]
  missingTrafficMappings?: GatewayGraphMissingTrafficMapping[]
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
  const summary = summarize(edges)
  summary.missing_traffic_mappings = missingTrafficMappings.length

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
    summary,
    missing_traffic_mappings: missingTrafficMappings,
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    external_writes_executed: false,
    broad_connector_execution_enabled: false,
  }
}

const RUNTIME_SOURCE_IDS: GatewayGraphTrafficSourceId[] = [
  'model_request_logs',
  'connector_readiness_events',
  'agentmail_events',
  'gateway_event_bus',
  'knowledge_runtime_events',
  'report_preview_events',
  'zapier_discovery_events',
  'storage_sync_events',
  'bridge_queue_events',
  'workflow_trigger_events',
  'ai_app_request_events',
  'agent_request_events',
]

function unavailableSource(source_id: GatewayGraphTrafficSourceId, generatedAt: string, reason: string): GatewayGraphTrafficSource {
  return {
    source_id,
    status: 'unavailable',
    inspected_at: generatedAt,
    route_groups: SOURCE_ROUTE_GROUPS[source_id],
    primary_reason: reason,
  }
}

function readableSource(source_id: GatewayGraphTrafficSourceId, generatedAt: string, reason: string, edge_ids?: string[]): GatewayGraphTrafficSource {
  return {
    source_id,
    status: 'readable',
    inspected_at: generatedAt,
    route_groups: SOURCE_ROUTE_GROUPS[source_id],
    edge_ids,
    primary_reason: reason,
  }
}

function isoFromUnknownTimestamp(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 10_000_000_000 ? value : value * 1000
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  const text = String(value).trim()
  if (!text) return null
  if (/^\d+$/.test(text)) return isoFromUnknownTimestamp(Number(text))
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function tableExists(db: Database.Database, name: string): boolean {
  return Boolean(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`).get(name))
}

function columnsFor(db: Database.Database, tableName: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map((row) => row.name))
}

function safeLimitRows<T>(fn: () => T[]): T[] {
  try { return fn() } catch { return [] }
}

function addActivity(
  activities: GatewayGraphEdgeActivity[],
  input: {
    edge_id: string
    source_id: GatewayGraphTrafficSourceId
    occurred_at: string | null
    events?: number
    requests?: number
    bytes_in?: number
    bytes_out?: number
  },
) {
  if (!input.occurred_at) return
  activities.push({
    edge_id: input.edge_id,
    source_id: input.source_id,
    occurred_at: input.occurred_at,
    events: input.events,
    requests: input.requests,
    bytes_in: input.bytes_in,
    bytes_out: input.bytes_out,
  })
}

const PROVIDER_EDGE_MAP: Record<string, string> = {
  openrouter: 'model.openrouter_to_gateway',
  openai: 'model.openai_codex_to_gateway',
  codex: 'model.openai_codex_to_gateway',
  chatgpt: 'model.openai_codex_to_gateway',
  claude: 'model.claude_to_gateway',
  anthropic: 'model.claude_to_gateway',
  ollama: 'model.ollama_to_gateway',
  nvidia: 'model.nvidia_to_gateway',
  nim: 'model.nvidia_to_gateway',
  gemini: 'model.gemini_to_gateway',
  google: 'model.gemini_to_gateway',
  groq: 'model.groq_to_gateway',
  xai: 'model.xai_grok_to_gateway',
  grok: 'model.xai_grok_to_gateway',
}

function modelEdgeFor(provider: unknown, model: unknown): string | null {
  const haystack = `${provider || ''} ${model || ''}`.toLowerCase()
  for (const [needle, edgeId] of Object.entries(PROVIDER_EDGE_MAP)) {
    if (haystack.includes(needle)) return edgeId
  }
  return null
}

function edgeForAuditText(text: string): string | null {
  const lower = text.toLowerCase()
  if (lower.includes('zapier')) return 'connector.zapier_to_gateway'
  if (lower.includes('google') || lower.includes('gdrive')) return 'connector.google_drive_to_gateway'
  if (lower.includes('onedrive')) return 'connector.onedrive_to_gateway'
  if (lower.includes('firecrawl')) return 'connector.firecrawl_to_gateway'
  if (lower.includes('heygen')) return 'connector.heygen_to_gateway'
  if (lower.includes('mcp')) return 'connector.mcp_servers_to_gateway'
  if (lower.includes('tool')) return 'connector.tools_registry_to_gateway'
  if (lower.includes('report')) return 'reports.gateway_to_reports'
  if (lower.includes('webhook')) return 'webhooks.inbound_to_gateway'
  if (lower.includes('memory') || lower.includes('brain') || lower.includes('obsidian') || lower.includes('gbrain') || lower.includes('wiki')) return 'highway.knowledge.trunk'
  return null
}

function sourceIdsFromAuditEdge(edgeId: string | null): GatewayGraphTrafficSourceId[] {
  if (!edgeId) return []
  if (edgeId === 'connector.zapier_to_gateway') return ['zapier_discovery_events', 'connector_readiness_events']
  if (edgeId === 'connector.google_drive_to_gateway' || edgeId === 'connector.onedrive_to_gateway') return ['storage_sync_events', 'connector_readiness_events']
  if (edgeId === 'reports.gateway_to_reports') return ['report_preview_events']
  if (edgeId === 'webhooks.inbound_to_gateway') return ['workflow_trigger_events', 'gateway_event_bus']
  if (edgeId.startsWith('highway.knowledge.')) return ['knowledge_runtime_events']
  return ['connector_readiness_events']
}

function missingMapping(input: {
  source_id: GatewayGraphTrafficSourceId
  telemetry_kind: string
  observed_at: string | null
  table: string
  provider?: string | null
}): GatewayGraphMissingTrafficMapping {
  return {
    source_id: input.source_id,
    telemetry_kind: input.telemetry_kind.slice(0, 80),
    observed_at: input.observed_at,
    reason: 'traffic_edge_mapping_missing',
    table: input.table,
    provider: input.provider ? input.provider.slice(0, 80) : null,
  }
}

function inspectModelRuns(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[], missing: GatewayGraphMissingTrafficMapping[]): GatewayGraphTrafficSource {
  if (!tableExists(db, 'runs')) return unavailableSource('model_request_logs', generatedAt, 'runs_table_missing')
  const cols = columnsFor(db, 'runs')
  const providerExpr = cols.has('provider') ? 'provider' : 'NULL AS provider'
  const modelExpr = cols.has('model') ? 'model' : 'NULL AS model'
  const startedExpr = cols.has('started_at') ? 'started_at' : 'NULL AS started_at'
  const endedExpr = cols.has('ended_at') ? 'ended_at' : 'NULL AS ended_at'
  const rows = safeLimitRows(() => db.prepare(`
    SELECT ${providerExpr}, ${modelExpr}, ${startedExpr}, ${endedExpr}
    FROM runs
    ORDER BY COALESCE(ended_at, started_at) DESC
    LIMIT 200
  `).all() as Array<{ provider: unknown; model: unknown; started_at: unknown; ended_at: unknown }>)
  for (const row of rows) {
    const occurredAt = isoFromUnknownTimestamp(row.ended_at) || isoFromUnknownTimestamp(row.started_at)
    const edgeId = modelEdgeFor(row.provider, row.model)
    if (edgeId) addActivity(activities, { edge_id: edgeId, source_id: 'model_request_logs', occurred_at: occurredAt, requests: 1 })
    else missing.push(missingMapping({
      source_id: 'model_request_logs',
      telemetry_kind: 'model_run',
      observed_at: occurredAt,
      table: 'runs',
      provider: String(row.provider || row.model || 'unknown'),
    }))
  }
  return readableSource('model_request_logs', generatedAt, 'runs_table_read_only')
}

function inspectAgentMail(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[]): GatewayGraphTrafficSource {
  const tables = ['agentmail_events', 'agentmail_audit', 'agentmail_send_requests']
  const readableTables = tables.filter((name) => tableExists(db, name))
  if (!readableTables.length) return unavailableSource('agentmail_events', generatedAt, 'agentmail_event_tables_missing')
  for (const table of readableTables) {
    const cols = columnsFor(db, table)
    const createdExpr = cols.has('created_at') ? 'created_at' : 'NULL AS created_at'
    const updatedExpr = cols.has('updated_at') ? 'updated_at' : 'NULL AS updated_at'
    const rows = safeLimitRows(() => db.prepare(`SELECT ${createdExpr}, ${updatedExpr} FROM ${table} ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 80`).all() as Array<{ created_at: unknown; updated_at: unknown }>)
    for (const row of rows) {
      addActivity(activities, {
        edge_id: 'agentmail.gateway_to_agentmail',
        source_id: 'agentmail_events',
        occurred_at: isoFromUnknownTimestamp(row.updated_at) || isoFromUnknownTimestamp(row.created_at),
        events: table === 'agentmail_send_requests' ? 0 : 1,
        requests: table === 'agentmail_send_requests' ? 1 : 0,
      })
    }
  }
  return readableSource('agentmail_events', generatedAt, 'agentmail_tables_read_only', ['agentmail.gateway_to_agentmail'])
}

function inspectBridgeQueue(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[]): GatewayGraphTrafficSource {
  if (!tableExists(db, 'agentmail_bridge_queue')) return unavailableSource('bridge_queue_events', generatedAt, 'bridge_queue_table_missing')
  const rows = safeLimitRows(() => db.prepare(`SELECT created_at FROM agentmail_bridge_queue ORDER BY created_at DESC LIMIT 80`).all() as Array<{ created_at: unknown }>)
  for (const row of rows) {
    addActivity(activities, {
      edge_id: 'agentmail.gateway_to_agentmail',
      source_id: 'bridge_queue_events',
      occurred_at: isoFromUnknownTimestamp(row.created_at),
      events: 1,
    })
  }
  return readableSource('bridge_queue_events', generatedAt, 'bridge_queue_table_read_only', ['agentmail.gateway_to_agentmail'])
}

function inspectWebhookDeliveries(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[]): GatewayGraphTrafficSource {
  if (!tableExists(db, 'webhook_deliveries')) return unavailableSource('workflow_trigger_events', generatedAt, 'webhook_deliveries_table_missing')
  const rows = safeLimitRows(() => db.prepare(`SELECT created_at, duration_ms FROM webhook_deliveries ORDER BY created_at DESC LIMIT 80`).all() as Array<{ created_at: unknown; duration_ms: unknown }>)
  for (const row of rows) {
    addActivity(activities, {
      edge_id: 'webhooks.inbound_to_gateway',
      source_id: 'workflow_trigger_events',
      occurred_at: isoFromUnknownTimestamp(row.created_at),
      events: 1,
      bytes_in: 0,
      bytes_out: 0,
    })
  }
  return readableSource('workflow_trigger_events', generatedAt, 'webhook_deliveries_table_read_only', ['webhooks.inbound_to_gateway'])
}

function inspectReports(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[]): GatewayGraphTrafficSource {
  if (!tableExists(db, 'scheduled_reports')) return unavailableSource('report_preview_events', generatedAt, 'scheduled_reports_table_missing')
  const cols = columnsFor(db, 'scheduled_reports')
  const lastExpr = cols.has('last_run_at') ? 'last_run_at' : 'NULL AS last_run_at'
  const updatedExpr = cols.has('updated_at') ? 'updated_at' : 'NULL AS updated_at'
  const rows = safeLimitRows(() => db.prepare(`SELECT ${lastExpr}, ${updatedExpr} FROM scheduled_reports ORDER BY COALESCE(last_run_at, updated_at) DESC LIMIT 80`).all() as Array<{ last_run_at: unknown; updated_at: unknown }>)
  for (const row of rows) {
    addActivity(activities, {
      edge_id: 'reports.gateway_to_reports',
      source_id: 'report_preview_events',
      occurred_at: isoFromUnknownTimestamp(row.last_run_at) || isoFromUnknownTimestamp(row.updated_at),
      requests: 1,
    })
  }
  return readableSource('report_preview_events', generatedAt, 'scheduled_reports_table_read_only', ['reports.gateway_to_reports'])
}

function inspectGatewayActivities(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[]): GatewayGraphTrafficSource {
  if (!tableExists(db, 'activities')) return unavailableSource('gateway_event_bus', generatedAt, 'activities_table_missing')
  const rows = safeLimitRows(() => db.prepare(`SELECT created_at FROM activities ORDER BY created_at DESC LIMIT 120`).all() as Array<{ created_at: unknown }>)
  for (const row of rows) {
    addActivity(activities, {
      edge_id: 'events.event_bus_to_gateway',
      source_id: 'gateway_event_bus',
      occurred_at: isoFromUnknownTimestamp(row.created_at),
      events: 1,
    })
  }
  return readableSource('gateway_event_bus', generatedAt, 'activities_table_read_only', ['events.event_bus_to_gateway'])
}

function inspectAuditTables(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[], missing: GatewayGraphMissingTrafficMapping[]) {
  const sourceStatus = new Map<GatewayGraphTrafficSourceId, GatewayGraphTrafficSource>()
  for (const sourceId of ['connector_readiness_events', 'zapier_discovery_events', 'storage_sync_events', 'knowledge_runtime_events', 'agent_request_events', 'ai_app_request_events'] as GatewayGraphTrafficSourceId[]) {
    sourceStatus.set(sourceId, unavailableSource(sourceId, generatedAt, 'audit_source_table_missing'))
  }

  const auditTables = ['audit_log', 'audit_events', 'bridge_session_audit_events', 'bridge_audit_events']
    .filter((table) => tableExists(db, table))
  if (!auditTables.length) return Array.from(sourceStatus.values())

  for (const sourceId of sourceStatus.keys()) {
    sourceStatus.set(sourceId, readableSource(sourceId, generatedAt, 'audit_tables_read_only'))
  }

  for (const table of auditTables) {
    const cols = columnsFor(db, table)
    const textColumns = ['action', 'event', 'target', 'target_type', 'outcome', 'metadata_json', 'detail']
      .filter((column) => cols.has(column))
    const timeColumn = ['created_at', 'ts', 'timestamp', 'updated_at'].find((column) => cols.has(column))
    if (!textColumns.length || !timeColumn) continue
    const selected = [...textColumns, timeColumn].join(', ')
    const rows = safeLimitRows(() => db.prepare(`SELECT ${selected} FROM ${table} ORDER BY ${timeColumn} DESC LIMIT 160`).all() as Record<string, unknown>[])
    for (const row of rows) {
      const text = textColumns.map((column) => String(row[column] || '')).join(' ')
      const occurredAt = isoFromUnknownTimestamp(row[timeColumn])
      const edgeId = edgeForAuditText(text)
      const sourceIds = sourceIdsFromAuditEdge(edgeId)
      if (!edgeId || !sourceIds.length) {
        missing.push(missingMapping({
          source_id: 'connector_readiness_events',
          telemetry_kind: 'audit_event',
          observed_at: occurredAt,
          table,
          provider: null,
        }))
        continue
      }
      for (const sourceId of sourceIds) {
        addActivity(activities, {
          edge_id: edgeId,
          source_id: sourceId,
          occurred_at: occurredAt,
          events: 1,
        })
      }
    }
  }

  return Array.from(sourceStatus.values())
}

function unavailableRuntimeSources(generatedAt: string, reason = 'mission_control_db_unreadable'): GatewayGraphTrafficSource[] {
  return RUNTIME_SOURCE_IDS.map((sourceId) => unavailableSource(sourceId, generatedAt, reason))
}

export function buildGatewayGraphTrafficFromReadOnlyDatabase({
  generatedAt = new Date().toISOString(),
  topology = buildGatewayGraphTopology(generatedAt),
  dbPath,
}: {
  generatedAt?: string
  topology?: GatewayGraphTopologyPayload
  dbPath?: string
} = {}) {
  if (!dbPath) {
    return buildGatewayGraphTrafficSnapshot({
      generatedAt,
      topology,
      trustedSources: unavailableRuntimeSources(generatedAt, 'mission_control_db_path_missing'),
    })
  }

  let db: Database.Database | null = null
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true })
    const activities: GatewayGraphEdgeActivity[] = []
    const missing: GatewayGraphMissingTrafficMapping[] = []
    const sources: GatewayGraphTrafficSource[] = [
      inspectModelRuns(db, generatedAt, activities, missing),
      inspectAgentMail(db, generatedAt, activities),
      inspectBridgeQueue(db, generatedAt, activities),
      inspectWebhookDeliveries(db, generatedAt, activities),
      inspectReports(db, generatedAt, activities),
      inspectGatewayActivities(db, generatedAt, activities),
      ...inspectAuditTables(db, generatedAt, activities, missing),
    ]
    const sourceIds = new Set(sources.map((source) => source.source_id))
    for (const sourceId of RUNTIME_SOURCE_IDS) {
      if (!sourceIds.has(sourceId)) sources.push(unavailableSource(sourceId, generatedAt, 'telemetry_source_not_inspected'))
    }
    return buildGatewayGraphTrafficSnapshot({
      generatedAt,
      topology,
      trustedSources: sources,
      edgeActivity: activities,
      missingTrafficMappings: missing,
    })
  } catch {
    return buildGatewayGraphTrafficSnapshot({
      generatedAt,
      topology,
      trustedSources: unavailableRuntimeSources(generatedAt),
    })
  } finally {
    try { db?.close() } catch { /* read-only close best effort */ }
  }
}

export function buildGatewayGraphTrafficFromRuntime(generatedAt = new Date().toISOString()) {
  return buildGatewayGraphTrafficFromReadOnlyDatabase({
    generatedAt,
    topology: buildGatewayGraphTopology(generatedAt),
    dbPath: config.dbPath,
  })
}
