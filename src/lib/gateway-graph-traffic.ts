import {
  buildGatewayGraphTopology,
  GatewayGraphTopologyEdge,
  GatewayGraphTopologyPayload,
  GatewayGraphTopologyRouteGroup,
  GatewayGraphTopologyStatus,
} from '@/lib/gateway-graph-topology'
import Database from 'better-sqlite3'
import { config } from '@/lib/config'
import {
  findCanonicalGatewayTelemetryIdentity,
  normalizeGatewayTelemetryIdentityAlias,
  type GatewayTelemetryIdentityContract,
  type GatewayTelemetrySourceId,
} from '@/lib/gateway-telemetry-identity'

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

export type GatewayGraphTrafficClassification =
  | 'active_recent_traffic'
  | 'ready_no_recent_traffic'
  | 'telemetry_stale'
  | 'telemetry_source_not_implemented'
  | 'telemetry_table_empty'
  | 'connector_has_no_event_log'
  | 'system_is_standby_by_design'
  | 'read_only_without_traffic_counters'
  | 'provider_route_unavailable'
  | 'auth_unavailable'

export type GatewayGraphTrafficType = 'event' | 'request' | 'mixed' | 'none'

export type GatewayGraphMissingTrafficMappingClassification =
  | 'missing_edge_id'
  | 'unknown_source_system'
  | 'legacy_route_group'
  | 'stale_static_name'
  | 'unmapped_event_type'
  | 'missing_node_alias'
  | 'auth_login_event_outside_gateway_topology'
  | 'protected_action_check_target_ambiguous'
  | 'telemetry_source_has_no_topology_edge'

export type GatewayGraphTrafficSeverity = 'info' | 'warning' | 'error'
export type GatewayGraphTrafficMappingConfidence = 'high' | 'medium' | 'low'

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
  record_id?: string | null
  telemetry_kind?: string | null
  identity_confidence?: GatewayGraphTrafficMappingConfidence | null
  identity_reason?: string | null
  source_provided_identity?: boolean | null
}

export type GatewayGraphMissingTrafficMapping = {
  source_id: GatewayGraphTrafficSourceId
  telemetry_kind: string
  source_event_type: string
  source_system: string
  observed_at: string | null
  reason: 'traffic_edge_mapping_missing'
  table: string
  provider?: string | null
  agent_id?: string | null
  agent_slug?: string | null
  runtime_id?: string | null
  route_group?: GatewayGraphTopologyRouteGroup | null
  identity_confidence?: GatewayGraphTrafficMappingConfidence | null
  identity_reason?: string | null
  source_provided_identity?: boolean | null
  candidate_node_id: string | null
  candidate_edge_id: string | null
  classification: GatewayGraphMissingTrafficMappingClassification
  recommended_mapping_fix: string
  severity: GatewayGraphTrafficSeverity
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
  traffic_classification: GatewayGraphTrafficClassification
  traffic_label: string
  traffic_type: GatewayGraphTrafficType
  telemetry_source: GatewayGraphTrafficSourceId | null
  source_record_id: string | null
  telemetry_kind: string | null
  identity_confidence: GatewayGraphTrafficMappingConfidence | null
  identity_reason: string | null
  stale_threshold_seconds: number
  recommended_next_action: string
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
    auth_login_outside_topology: number
    agent_config_sync_resolved: number
    agent_config_sync_unresolved: number
    agent_config_sync_identity_missing: number
    source_provided_canonical_identity: number
    protected_action_check_unresolved: number
    unmapped_event_type_count: number
    resolved_this_pass: number
    still_unresolved: number
    confidence: Record<GatewayGraphTrafficMappingConfidence, number>
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

const DEFAULT_STALE_THRESHOLD_SECONDS = 300

function staleThresholdSecondsForEdge(edge: GatewayGraphTopologyEdge): number {
  if (edge.route_group === 'models') return 120
  return DEFAULT_STALE_THRESHOLD_SECONDS
}

function unavailableClassificationForEdge(edge: GatewayGraphTopologyEdge): GatewayGraphTrafficClassification {
  if (edge.status === 'blocked') return 'provider_route_unavailable'
  if (edge.route_group === 'events' || edge.route_group === 'webhooks') return 'system_is_standby_by_design'
  if (edge.route_group === 'reports') return 'read_only_without_traffic_counters'
  if (edge.route_group === 'browser') return 'telemetry_source_not_implemented'
  if (edge.route_group === 'storage' || edge.route_group === 'integrations' || edge.route_group === 'zapier') {
    return 'connector_has_no_event_log'
  }
  return 'telemetry_source_not_implemented'
}

function trafficLabelFor(classification: GatewayGraphTrafficClassification): string {
  const labels: Record<GatewayGraphTrafficClassification, string> = {
    active_recent_traffic: 'Live traffic',
    ready_no_recent_traffic: 'Ready · no recent traffic',
    telemetry_stale: 'Ready · telemetry stale',
    telemetry_source_not_implemented: 'Traffic source unavailable',
    telemetry_table_empty: 'Traffic source unavailable',
    connector_has_no_event_log: 'Traffic source unavailable',
    system_is_standby_by_design: 'Standby · no heartbeat',
    read_only_without_traffic_counters: 'Traffic source unavailable',
    provider_route_unavailable: 'Blocked · exact blocker',
    auth_unavailable: 'Traffic source unavailable',
  }
  return labels[classification]
}

function recommendedNextActionForEdge(
  edge: GatewayGraphTopologyEdge,
  classification: GatewayGraphTrafficClassification,
): string {
  if (classification === 'active_recent_traffic') return 'inspect_gateway_diagnostics_for_request_details'
  if (classification === 'ready_no_recent_traffic') return 'wait_for_real_runtime_activity_or_run_read_only_probe'
  if (classification === 'telemetry_stale') {
    if (edge.route_group === 'agentmail') return 'verify_agentmail_event_listener_or_recent_readiness_probe'
    if (edge.route_group === 'models') return 'wait_for_model_request_or_run_safe_model_readiness_probe'
    if (edge.route_group === 'zapier') return 'run_read_only_zapier_discovery_probe'
    if (edge.route_group === 'reports') return 'run_report_preview_readiness_probe'
    if (edge.route_group === 'webhooks' || edge.route_group === 'events') return 'verify_event_feed_or_recent_signed_event'
    return 'refresh_read_only_gateway_telemetry_source'
  }
  if (classification === 'system_is_standby_by_design') return 'wait_for_signed_event_or_verify_event_stream_heartbeat'
  if (classification === 'read_only_without_traffic_counters') return 'run_preview_or_readiness_probe_to_create_telemetry'
  if (classification === 'connector_has_no_event_log') return 'add_read_only_connector_event_log_or_keep_idle'
  if (classification === 'provider_route_unavailable') return edge.next_action || 'inspect_exact_provider_blocker'
  return 'implement_read_only_telemetry_source_for_this_edge'
}

function trafficTypeFor(activity: GatewayGraphEdgeActivity | null): GatewayGraphTrafficType {
  if (!activity) return 'none'
  const events = Math.max(0, activity.events || 0)
  const requests = Math.max(0, activity.requests || 0)
  if (events > 0 && requests > 0) return 'mixed'
  if (requests > 0) return 'request'
  if (events > 0) return 'event'
  return 'none'
}

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
    const trafficClassification = unavailableClassificationForEdge(input.edge)
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
      traffic_classification: trafficClassification,
      traffic_label: trafficLabelFor(trafficClassification),
      traffic_type: 'none',
      telemetry_source: null,
      source_record_id: null,
      telemetry_kind: null,
      identity_confidence: null,
      identity_reason: null,
      stale_threshold_seconds: staleThresholdSecondsForEdge(input.edge),
      recommended_next_action: recommendedNextActionForEdge(input.edge, trafficClassification),
      primary_reason: 'traffic_data_unavailable',
    }
  }

  const activity = activityForEdge(input.activities, input.edge, sources)
  const source = activity
    ? sources.find((item) => item.source_id === activity.source_id) || sources[0]
    : sources[0]
  const ageSeconds = activity ? secondsBetween(input.generatedAt, activity.occurred_at) : Number.POSITIVE_INFINITY
  const staleThresholdSeconds = staleThresholdSecondsForEdge(input.edge)
  const recent = Boolean(activity && ageSeconds <= 60)
  const events = recent ? Math.max(0, activity?.events || 0) : 0
  const requests = recent ? Math.max(0, activity?.requests || 0) : 0
  const active = events + requests > 0
  const stale = Boolean(activity && !active && ageSeconds >= staleThresholdSeconds)
  const ready = READY_STATUSES.includes(input.edge.status)
  const trafficClassification: GatewayGraphTrafficClassification = active
    ? 'active_recent_traffic'
    : stale
      ? 'telemetry_stale'
      : ready
        ? 'ready_no_recent_traffic'
        : unavailableClassificationForEdge(input.edge)

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
    traffic_classification: trafficClassification,
    traffic_label: trafficLabelFor(trafficClassification),
    traffic_type: trafficTypeFor(activity),
    telemetry_source: source.source_id,
    source_record_id: activity?.record_id || null,
    telemetry_kind: activity?.telemetry_kind || null,
    identity_confidence: activity?.identity_confidence || null,
    identity_reason: activity?.identity_reason ? sanitizeTelemetryText(activity.identity_reason) : null,
    stale_threshold_seconds: staleThresholdSeconds,
    recommended_next_action: recommendedNextActionForEdge(input.edge, trafficClassification),
    primary_reason: active
      ? 'trusted_recent_traffic_observed'
      : stale
        ? 'telemetry_stale'
        : ready
          ? 'ready_no_recent_traffic'
          : 'traffic_data_unavailable',
  }
}

function summarize(
  edges: GatewayGraphTrafficEdge[],
  activities: GatewayGraphEdgeActivity[] = [],
  missing: GatewayGraphMissingTrafficMapping[] = [],
): GatewayGraphTrafficPayload['summary'] {
  const confidence: Record<GatewayGraphTrafficMappingConfidence, number> = { high: 0, medium: 0, low: 0 }
  for (const activity of activities) {
    if (activity.identity_confidence) confidence[activity.identity_confidence] += 1
  }
  for (const mapping of missing) {
    if (mapping.identity_confidence) confidence[mapping.identity_confidence] += 1
  }
  const agentConfigResolved = activities.filter((activity) => (
    activity.telemetry_kind === 'agent_config_sync' && activity.identity_confidence === 'high'
  )).length
  const agentConfigUnresolved = missing.filter((mapping) => mapping.telemetry_kind === 'agent_config_sync').length
  const agentConfigIdentityMissing = missing.filter((mapping) => (
    mapping.telemetry_kind === 'agent_config_sync' &&
    (mapping.identity_reason === 'agent_config_sync_identity_missing' || mapping.identity_reason === 'canonical_identity_missing')
  )).length
  const sourceProvidedCanonicalIdentity = activities.filter((activity) => (
    activity.telemetry_kind === 'agent_config_sync' && activity.source_provided_identity === true
  )).length + missing.filter((mapping) => (
    mapping.telemetry_kind === 'agent_config_sync' && mapping.source_provided_identity === true
  )).length
  const protectedActionCheckUnresolved = missing.filter((mapping) => (
    mapping.classification === 'protected_action_check_target_ambiguous'
  )).length

  return {
    total_edges: edges.length,
    active_traffic_edges: edges.filter((edge) => edge.traffic_status === 'active').length,
    ready_no_recent_traffic_edges: edges.filter((edge) => edge.traffic_status === 'ready_no_recent_traffic').length,
    stale_telemetry_edges: edges.filter((edge) => edge.traffic_status === 'stale').length,
    unavailable_telemetry_edges: edges.filter((edge) => edge.traffic_status === 'unavailable').length,
    missing_traffic_mappings: missing.length,
    auth_login_outside_topology: missing.filter((mapping) => mapping.classification === 'auth_login_event_outside_gateway_topology').length,
    agent_config_sync_resolved: agentConfigResolved,
    agent_config_sync_unresolved: agentConfigUnresolved,
    agent_config_sync_identity_missing: agentConfigIdentityMissing,
    source_provided_canonical_identity: sourceProvidedCanonicalIdentity,
    protected_action_check_unresolved: protectedActionCheckUnresolved,
    unmapped_event_type_count: missing.filter((mapping) => mapping.classification === 'unmapped_event_type').length,
    resolved_this_pass: agentConfigResolved,
    still_unresolved: missing.length,
    confidence,
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
  const summary = summarize(edges, edgeActivity, missingTrafficMappings)

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
    record_id?: string | null
    telemetry_kind?: string | null
    identity_confidence?: GatewayGraphTrafficMappingConfidence | null
    identity_reason?: string | null
    source_provided_identity?: boolean | null
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
    record_id: sanitizeRecordRef(input.record_id),
    telemetry_kind: sanitizeTelemetryText(input.telemetry_kind),
    identity_confidence: input.identity_confidence || null,
    identity_reason: input.identity_reason ? sanitizeTelemetryText(input.identity_reason) : null,
    source_provided_identity: input.source_provided_identity || null,
  })
}

function sanitizeTelemetryText(value: unknown, fallback = 'unknown'): string {
  const text = String(value || '').replace(/[^\w.:-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  return (text || fallback).slice(0, 80)
}

function sanitizeRecordRef(value: unknown): string | null {
  if (value == null) return null
  return sanitizeTelemetryText(value, '').slice(0, 120) || null
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

type TrafficAliasResolution = {
  edge_id: string
  source_ids: GatewayGraphTrafficSourceId[]
  source_system: string
  candidate_node_id: string
  confidence: 'high' | 'low'
}

const TRAFFIC_ALIAS_RULES: Array<{
  pattern: RegExp
  resolution: TrafficAliasResolution
}> = [
  {
    pattern: /\b(agent[-_. ]?zero|agent\.zero|jarvis|a0)\b/i,
    resolution: {
      edge_id: 'highway.inputs.agent.zero',
      source_ids: ['gateway_event_bus', 'agent_request_events'],
      source_system: 'agent_zero',
      candidate_node_id: 'agent.zero',
      confidence: 'high',
    },
  },
  {
    pattern: /\b(agent[-_. ]?hermes|agent\.hermes|hermes|ron[-_. ]?weasley)\b|\bron\b/i,
    resolution: {
      edge_id: 'highway.inputs.agent.hermes',
      source_ids: ['gateway_event_bus', 'agent_request_events'],
      source_system: 'hermes',
      candidate_node_id: 'agent.hermes',
      confidence: 'high',
    },
  },
  {
    pattern: /\b(agent[-_. ]?pi|agent\.pi|canonical_agent_id["']?\s*:\s*["']agent\.pi|pi[-_. ]?88@agentmail\.to)\b/i,
    resolution: {
      edge_id: 'highway.inputs.agent.pi',
      source_ids: ['gateway_event_bus', 'agent_request_events'],
      source_system: 'pi',
      candidate_node_id: 'agent.pi',
      confidence: 'high',
    },
  },
  {
    pattern: /\b(agent[-_. ]?space|agent\.space|space[-_. ]?agent)\b/i,
    resolution: {
      edge_id: 'highway.inputs.agent.space',
      source_ids: ['gateway_event_bus', 'agent_request_events'],
      source_system: 'space_agent',
      candidate_node_id: 'agent.space',
      confidence: 'high',
    },
  },
  {
    pattern: /\b(agent[-_. ]?paperclip|agent\.paperclip|paperclip)\b/i,
    resolution: {
      edge_id: 'highway.inputs.agent.paperclip',
      source_ids: ['gateway_event_bus', 'agent_request_events'],
      source_system: 'paperclip',
      candidate_node_id: 'agent.paperclip',
      confidence: 'high',
    },
  },
  {
    pattern: /\bwebhooks?[-_. ]?events?\b|\bworkflow[-_. ]?trigger\b/i,
    resolution: {
      edge_id: 'webhooks.inbound_to_gateway',
      source_ids: ['workflow_trigger_events', 'gateway_event_bus'],
      source_system: 'webhooks',
      candidate_node_id: 'input.webhook',
      confidence: 'high',
    },
  },
  {
    pattern: /\bbrowser[-_. ]?runtime\b|\bfirefox[-_. ]?runtime\b/i,
    resolution: {
      edge_id: 'browser.firefox_to_gateway',
      source_ids: ['connector_readiness_events'],
      source_system: 'browser',
      candidate_node_id: 'browser.firefox',
      confidence: 'high',
    },
  },
  {
    pattern: /\bagentmail[-_. ]?send\b|\bagentmail\b/i,
    resolution: {
      edge_id: 'agentmail.gateway_to_agentmail',
      source_ids: ['agentmail_events'],
      source_system: 'agentmail',
      candidate_node_id: 'int.agentmail',
      confidence: 'high',
    },
  },
  {
    pattern: /\bzapier[-_. ]?readiness\b|\bzapier\b/i,
    resolution: {
      edge_id: 'connector.zapier_to_gateway',
      source_ids: ['zapier_discovery_events', 'connector_readiness_events'],
      source_system: 'zapier',
      candidate_node_id: 'int.zapier',
      confidence: 'high',
    },
  },
  {
    pattern: /\bmodel[-_. ]?request[-_. ]?openrouter\b|\bopenrouter\b/i,
    resolution: {
      edge_id: 'model.openrouter_to_gateway',
      source_ids: ['model_request_logs'],
      source_system: 'model.openrouter',
      candidate_node_id: 'model.openrouter',
      confidence: 'high',
    },
  },
  {
    pattern: /\b(openai|openai[-_. ]?codex|chatgpt|gpt[-_. ]?4o|gpt[-_. ]?4|o3|o4[-_. ]?mini|codex)\b/i,
    resolution: {
      edge_id: 'model.openai_codex_to_gateway',
      source_ids: ['model_request_logs'],
      source_system: 'model.openai',
      candidate_node_id: 'model.openai',
      confidence: 'high',
    },
  },
  {
    pattern: /\b(claude|anthropic)\b/i,
    resolution: {
      edge_id: 'model.claude_to_gateway',
      source_ids: ['model_request_logs'],
      source_system: 'model.claude',
      candidate_node_id: 'model.claude',
      confidence: 'high',
    },
  },
  {
    pattern: /\b(ollama|local[-_. ]?llama|llama[-_. ]?local)\b/i,
    resolution: {
      edge_id: 'model.ollama_to_gateway',
      source_ids: ['model_request_logs'],
      source_system: 'model.ollama',
      candidate_node_id: 'model.ollama',
      confidence: 'high',
    },
  },
  {
    pattern: /\b(nvidia|nvidia[-_. ]?nim|\bnim\b)\b/i,
    resolution: {
      edge_id: 'model.nvidia_to_gateway',
      source_ids: ['model_request_logs'],
      source_system: 'model.nvidia',
      candidate_node_id: 'model.nvidia',
      confidence: 'high',
    },
  },
  {
    pattern: /\b(gemini|google[-_. ]?gemini)\b/i,
    resolution: {
      edge_id: 'model.gemini_to_gateway',
      source_ids: ['model_request_logs'],
      source_system: 'model.gemini',
      candidate_node_id: 'model.gemini',
      confidence: 'high',
    },
  },
  {
    pattern: /\bgroq\b/i,
    resolution: {
      edge_id: 'model.groq_to_gateway',
      source_ids: ['model_request_logs'],
      source_system: 'model.groq',
      candidate_node_id: 'model.groq',
      confidence: 'high',
    },
  },
  {
    pattern: /\bprovider[-_. ]?xai[-_. ]?grok\b|\bxai[-_. ]?grok\b|\bgrok\b/i,
    resolution: {
      edge_id: 'model.xai_grok_to_gateway',
      source_ids: ['model_request_logs'],
      source_system: 'model.xai_grok',
      candidate_node_id: 'model.xai_grok',
      confidence: 'high',
    },
  },
  {
    pattern: /\bmcp\b|\bncp\b|\bmcp[-_. ]?servers?\b|\bmcp[-_. ]?tool\b/i,
    resolution: {
      edge_id: 'connector.mcp_servers_to_gateway',
      source_ids: ['connector_readiness_events'],
      source_system: 'mcp_servers',
      candidate_node_id: 'int.mcp',
      confidence: 'high',
    },
  },
  {
    pattern: /\btools?[-_. ]?registry\b|\bskills?[-_. ]?(registry|lookup|list)\b|\btool[-_. ]?(lookup|list|inventory)\b/i,
    resolution: {
      edge_id: 'connector.tools_registry_to_gateway',
      source_ids: ['connector_readiness_events'],
      source_system: 'tools_registry',
      candidate_node_id: 'int.tools',
      confidence: 'high',
    },
  },
  {
    pattern: /\bexternal[-_. ]?apis?\b|\bapi[-_. ]?(registry|discovery|inventory)\b|\bint\.apis\b/i,
    resolution: {
      edge_id: 'connector.external_apis_to_gateway',
      source_ids: ['connector_readiness_events'],
      source_system: 'external_apis',
      candidate_node_id: 'int.apis',
      confidence: 'high',
    },
  },
  {
    pattern: /\bbuild[-_. ]?wiki\b|\bbuildwiki\b|\bopencloud[-_. ]?docs[-_. ]?farmer\b/i,
    resolution: {
      edge_id: 'highway.knowledge.brain.buildwiki',
      source_ids: ['knowledge_runtime_events'],
      source_system: 'buildwiki',
      candidate_node_id: 'brain.buildwiki',
      confidence: 'high',
    },
  },
  {
    pattern: /\bobsidian\b|\bobsidian[-_. ]?vault\b|\bbrain[-_. ]?obsidian\b/i,
    resolution: {
      edge_id: 'highway.knowledge.brain.obsidian',
      source_ids: ['knowledge_runtime_events'],
      source_system: 'obsidian',
      candidate_node_id: 'brain.obsidian',
      confidence: 'high',
    },
  },
  {
    pattern: /\bmem[-_. ]?palace\b|\bmempalace\b|\bpalacio\b|\bmain[-_. ]?policy\b/i,
    resolution: {
      edge_id: 'highway.knowledge.brain.mempalace',
      source_ids: ['knowledge_runtime_events'],
      source_system: 'mempalace',
      candidate_node_id: 'brain.mempalace',
      confidence: 'high',
    },
  },
  {
    pattern: /\bgraphify\b|\bgraffiti\b|\bgraph[-_. ]?runtime\b|\bbrain[-_. ]?graph\b/i,
    resolution: {
      edge_id: 'highway.knowledge.brain.graphify',
      source_ids: ['knowledge_runtime_events'],
      source_system: 'graphify',
      candidate_node_id: 'brain.graphify',
      confidence: 'high',
    },
  },
  {
    pattern: /\bg[-_. ]?brain\b|\bgbrain\b|\bgoogle[-_. ]?brain\b|\bbrain[-_. ]?gbrain\b/i,
    resolution: {
      edge_id: 'highway.knowledge.brain.gbrain',
      source_ids: ['knowledge_runtime_events'],
      source_system: 'gbrain',
      candidate_node_id: 'brain.gbrain',
      confidence: 'high',
    },
  },
  {
    pattern: /\bbrain[-_. ]?bridge\b|\bbrain[-_. ]?sync\b|\bbrain[-_. ]?synchronization\b/i,
    resolution: {
      edge_id: 'highway.knowledge.brain.sync',
      source_ids: ['knowledge_runtime_events'],
      source_system: 'brain_sync',
      candidate_node_id: 'brain.sync',
      confidence: 'high',
    },
  },
  {
    pattern: /\btelegram\b|\btelegram[-_. ]?owner\b|\bowner[-_. ]?telegram\b/i,
    resolution: {
      edge_id: 'highway.inputs.input.telegram',
      source_ids: ['gateway_event_bus', 'agent_request_events'],
      source_system: 'telegram',
      candidate_node_id: 'input.telegram',
      confidence: 'high',
    },
  },
]

function resolveTrafficAlias(text: string): TrafficAliasResolution | null {
  for (const rule of TRAFFIC_ALIAS_RULES) {
    if (rule.pattern.test(text)) return rule.resolution
  }
  return null
}

function edgeForAuditText(text: string): string | null {
  const lower = text.toLowerCase()
  if (/\bprotected[-_. ]?action[-_. ]?check\b/.test(lower)) return null
  const alias = resolveTrafficAlias(lower)
  if (alias?.confidence === 'high') return alias.edge_id
  if (lower.includes('zapier')) return 'connector.zapier_to_gateway'
  if (lower.includes('google drive') || lower.includes('gdrive')) return 'connector.google_drive_to_gateway'
  if (lower.includes('onedrive')) return 'connector.onedrive_to_gateway'
  if (lower.includes('firecrawl')) return 'connector.firecrawl_to_gateway'
  if (lower.includes('heygen')) return 'connector.heygen_to_gateway'
  if (lower.includes('mcp') || lower.includes('ncp')) return 'connector.mcp_servers_to_gateway'
  if (lower.includes('tool') || lower.includes('skill')) return 'connector.tools_registry_to_gateway'
  if (lower.includes('external api')) return 'connector.external_apis_to_gateway'
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
  if (edgeId.startsWith('highway.inputs.')) return ['agent_request_events', 'gateway_event_bus']
  if (edgeId.startsWith('model.')) return ['model_request_logs']
  if (edgeId.startsWith('browser.')) return ['connector_readiness_events']
  if (edgeId === 'agentmail.gateway_to_agentmail') return ['agentmail_events']
  return ['connector_readiness_events']
}

const CANONICAL_ACTIVITY_TARGET_EDGE_MAP: Record<string, string> = {
  'agent.zero': 'highway.inputs.agent.zero',
  'agent.hermes': 'highway.inputs.agent.hermes',
  'agent.pi': 'highway.inputs.agent.pi',
  'agent.space': 'highway.inputs.agent.space',
  'agent.paperclip': 'highway.inputs.agent.paperclip',
  'model.openrouter': 'model.openrouter_to_gateway',
  'model.openai': 'model.openai_codex_to_gateway',
  'model.claude': 'model.claude_to_gateway',
  'model.ollama': 'model.ollama_to_gateway',
  'model.nvidia': 'model.nvidia_to_gateway',
  'model.gemini': 'model.gemini_to_gateway',
  'model.groq': 'model.groq_to_gateway',
  'model.xai_grok': 'model.xai_grok_to_gateway',
  'int.apis': 'connector.external_apis_to_gateway',
  'int.mcp': 'connector.mcp_servers_to_gateway',
  'int.tools': 'connector.tools_registry_to_gateway',
  'int.firecrawl': 'connector.firecrawl_to_gateway',
  'int.heygen': 'connector.heygen_to_gateway',
  'int.zapier': 'connector.zapier_to_gateway',
  'int.gdrive': 'connector.google_drive_to_gateway',
  'int.onedrive': 'connector.onedrive_to_gateway',
  'int.agentmail': 'agentmail.gateway_to_agentmail',
  'int.reports': 'reports.gateway_to_reports',
  'brain.obsidian': 'highway.knowledge.brain.obsidian',
  'brain.mempalace': 'highway.knowledge.brain.mempalace',
  'brain.graphify': 'highway.knowledge.brain.graphify',
  'brain.gbrain': 'highway.knowledge.brain.gbrain',
  'brain.sync': 'highway.knowledge.brain.sync',
  'brain.buildwiki': 'highway.knowledge.brain.buildwiki',
  'input.telegram': 'highway.inputs.input.telegram',
  'input.webhook': 'webhooks.inbound_to_gateway',
  'input.event': 'events.event_bus_to_gateway',
}

function edgeForGatewayActivityTarget(row: Record<string, unknown>): string | null {
  for (const column of ['canonical_node_id', 'node_id', 'entity_id', 'target_id']) {
    const value = row[column]
    if (value == null) continue
    const key = String(value).trim().toLowerCase()
    if (CANONICAL_ACTIVITY_TARGET_EDGE_MAP[key]) return CANONICAL_ACTIVITY_TARGET_EDGE_MAP[key]
  }
  return null
}

type AgentConfigSyncIdentityResolution = {
  agent_id: string | null
  agent_slug: string | null
  provider: string | null
  runtime_id: string | null
  node_id: string | null
  edge_id: string | null
  route_group: GatewayGraphTopologyRouteGroup | null
  source_id: GatewayGraphTrafficSourceId
  confidence: GatewayGraphTrafficMappingConfidence
  reason: string
  source_provided_identity?: boolean
}

const TRAFFIC_SOURCE_IDS = new Set<GatewayGraphTrafficSourceId>([
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
])

function trafficSourceIdForTelemetryIdentity(
  value: GatewayTelemetrySourceId | string | null | undefined,
  routeGroup: GatewayGraphTopologyRouteGroup | null,
): GatewayGraphTrafficSourceId {
  if (value && TRAFFIC_SOURCE_IDS.has(value as GatewayGraphTrafficSourceId)) return value as GatewayGraphTrafficSourceId
  if (routeGroup === 'knowledge') return 'knowledge_runtime_events'
  if (routeGroup === 'agentmail') return 'agentmail_events'
  if (routeGroup === 'zapier') return 'zapier_discovery_events'
  if (routeGroup === 'models') return 'agent_request_events'
  if (routeGroup === 'inputs') return 'agent_request_events'
  if (routeGroup === 'storage') return 'storage_sync_events'
  if (routeGroup === 'reports') return 'report_preview_events'
  if (routeGroup === 'webhooks' || routeGroup === 'events') return 'gateway_event_bus'
  return 'connector_readiness_events'
}

function normalizeIdentityAlias(value: unknown): string {
  return normalizeGatewayTelemetryIdentityAlias(value)
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function detailStringValues(detail: Record<string, unknown> | null, keys: string[]): string[] {
  if (!detail) return []
  const values: string[] = []
  for (const key of keys) {
    const value = detail[key]
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' || typeof item === 'number') values.push(String(item))
      }
    } else if (typeof value === 'string' || typeof value === 'number') {
      values.push(String(value))
    }
  }
  return values
}

function firstSanitizedIdentityValue(values: unknown[]): string | null {
  for (const value of values) {
    const text = sanitizeTelemetryText(value, '')
    if (text) return text
  }
  return null
}

function routeGroupFromUnknown(value: unknown): GatewayGraphTopologyRouteGroup | null {
  const text = sanitizeTelemetryText(value, '')
  if (['models', 'inputs', 'knowledge', 'storage', 'integrations', 'reports', 'webhooks', 'events', 'agentmail', 'zapier', 'browser'].includes(text)) {
    return text as GatewayGraphTopologyRouteGroup
  }
  return null
}

function contractFromRecord(value: unknown): GatewayTelemetryIdentityContract | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const confidence = record.confidence === 'source_provided'
    ? 'source_provided'
    : record.confidence === 'unresolved' || record.mapping_confidence === 'unresolved'
      ? 'unresolved'
      : null
  const hasCanonicalField = Boolean(record.canonical_agent_id || record.canonical_node_id || record.canonical_edge_id)
  if (!confidence && !hasCanonicalField) return null
  return {
    event_type: sanitizeTelemetryText(record.event_type || 'agent_config_sync'),
    source_system: sanitizeTelemetryText(record.source_system || 'agent_config'),
    canonical_agent_id: firstSanitizedIdentityValue([record.canonical_agent_id]),
    canonical_node_id: firstSanitizedIdentityValue([record.canonical_node_id]),
    canonical_edge_id: firstSanitizedIdentityValue([record.canonical_edge_id]),
    route_group: routeGroupFromUnknown(record.route_group),
    scope_id: firstSanitizedIdentityValue([record.scope_id]),
    confidence: confidence || (hasCanonicalField ? 'source_provided' : 'unresolved'),
    occurred_at: firstSanitizedIdentityValue([record.occurred_at]),
    source_runtime: firstSanitizedIdentityValue([record.source_runtime]),
    config_target: firstSanitizedIdentityValue([record.config_target]),
    safe_event_summary: firstSanitizedIdentityValue([record.safe_event_summary]),
    reason: firstSanitizedIdentityValue([record.reason]),
  }
}

function sourceProvidedContractFromDetail(detail: Record<string, unknown> | null): GatewayTelemetryIdentityContract | null {
  if (!detail) return null
  const direct = contractFromRecord(detail)
  if (direct?.confidence === 'source_provided') return direct

  const contracts = Array.isArray(detail.identity_contracts)
    ? detail.identity_contracts.map(contractFromRecord).filter(Boolean) as GatewayTelemetryIdentityContract[]
    : []
  const sourceProvided = contracts.filter((contract) => contract.confidence === 'source_provided')
  if (sourceProvided.length === 1) return sourceProvided[0]
  if (sourceProvided.length > 1) {
    return {
      event_type: 'agent_config_sync',
      source_system: 'agent_config',
      canonical_agent_id: null,
      canonical_node_id: null,
      canonical_edge_id: null,
      route_group: null,
      scope_id: null,
      confidence: 'unresolved',
      source_runtime: 'gateway_agent_sync',
      config_target: 'openclaw.agents.list',
      safe_event_summary: 'agent_config_sync_batch',
      reason: 'multiple_source_provided_identities_in_batch',
    }
  }
  return direct
}

function resolveSourceProvidedAgentConfigIdentity(
  contract: GatewayTelemetryIdentityContract,
  topologyEdgeIds: Set<string>,
): AgentConfigSyncIdentityResolution {
  const sourceId = trafficSourceIdForTelemetryIdentity(null, contract.route_group)
  if (contract.confidence !== 'source_provided') {
    return {
      agent_id: contract.canonical_agent_id,
      agent_slug: null,
      provider: null,
      runtime_id: contract.source_runtime || null,
      node_id: null,
      edge_id: null,
      route_group: contract.route_group,
      source_id: sourceId,
      confidence: 'low',
      reason: contract.reason || 'agent_config_sync_identity_missing',
      source_provided_identity: false,
    }
  }

  if (!contract.canonical_edge_id) {
    return {
      agent_id: contract.canonical_agent_id,
      agent_slug: null,
      provider: null,
      runtime_id: contract.source_runtime || null,
      node_id: contract.canonical_node_id,
      edge_id: null,
      route_group: contract.route_group,
      source_id: sourceId,
      confidence: contract.canonical_agent_id ? 'medium' : 'low',
      reason: contract.reason || 'source_provided_identity_without_gateway_edge',
      source_provided_identity: true,
    }
  }

  if (!topologyEdgeIds.has(contract.canonical_edge_id)) {
    return {
      agent_id: contract.canonical_agent_id,
      agent_slug: null,
      provider: null,
      runtime_id: contract.source_runtime || null,
      node_id: contract.canonical_node_id,
      edge_id: null,
      route_group: contract.route_group,
      source_id: sourceId,
      confidence: 'medium',
      reason: 'source_provided_edge_missing_from_topology',
      source_provided_identity: true,
    }
  }

  return {
    agent_id: contract.canonical_agent_id,
    agent_slug: null,
    provider: null,
    runtime_id: contract.source_runtime || null,
    node_id: contract.canonical_node_id,
    edge_id: contract.canonical_edge_id,
    route_group: contract.route_group,
    source_id: sourceId,
    confidence: 'high',
    reason: 'source_provided_canonical_identity',
    source_provided_identity: true,
  }
}

function resolveCanonicalAgentTarget(
  candidates: string[],
  topologyEdgeIds: Set<string>,
): AgentConfigSyncIdentityResolution | null {
  for (const candidate of candidates) {
    const normalized = normalizeIdentityAlias(candidate)
    if (!normalized) continue
    const identity = findCanonicalGatewayTelemetryIdentity([candidate])
    if (!identity) continue
    const explicitCanonicalValues = [
      identity.canonical_agent_id,
      identity.canonical_node_id,
      identity.canonical_edge_id,
    ].filter(Boolean).map(normalizeIdentityAlias)
    if (!explicitCanonicalValues.includes(normalized)) continue
    const sourceId = trafficSourceIdForTelemetryIdentity(identity.telemetry_source_id, identity.route_group)
    if (!identity.canonical_edge_id || !identity.canonical_node_id || !identity.route_group) {
      return {
        agent_id: sanitizeTelemetryText(identity.canonical_agent_id),
        agent_slug: sanitizeTelemetryText(candidate),
        provider: null,
        runtime_id: null,
        node_id: identity.canonical_node_id,
        edge_id: null,
        route_group: identity.route_group,
        source_id: sourceId,
        confidence: 'medium',
        reason: identity.reason_when_unmapped || 'canonical_identity_has_no_gateway_topology_edge',
        source_provided_identity: false,
      }
    }
    if (!topologyEdgeIds.has(identity.canonical_edge_id)) {
        return {
          agent_id: sanitizeTelemetryText(identity.canonical_agent_id),
          agent_slug: sanitizeTelemetryText(candidate),
          provider: null,
          runtime_id: null,
          node_id: null,
          edge_id: null,
          route_group: identity.route_group,
          source_id: sourceId,
          confidence: 'medium',
          reason: 'canonical_agent_identity_found_but_topology_edge_missing',
          source_provided_identity: false,
        }
    }
    return {
      agent_id: sanitizeTelemetryText(identity.canonical_agent_id),
      agent_slug: sanitizeTelemetryText(candidate),
      provider: null,
      runtime_id: null,
      node_id: identity.canonical_node_id,
      edge_id: identity.canonical_edge_id,
      route_group: identity.route_group,
      source_id: sourceId,
      confidence: 'high',
      reason: 'explicit_canonical_agent_identity_resolved',
      source_provided_identity: false,
    }
  }
  return null
}

function resolveAgentConfigSyncIdentity(
  row: Record<string, unknown>,
  topologyEdgeIds: Set<string>,
): AgentConfigSyncIdentityResolution {
  const detail = parseJsonObject(row.detail) || parseJsonObject(row.metadata_json)
  const sourceProvidedContract = sourceProvidedContractFromDetail(detail)
  if (sourceProvidedContract) {
    return resolveSourceProvidedAgentConfigIdentity(sourceProvidedContract, topologyEdgeIds)
  }

  const explicitCandidates = [
    row.target_id,
    row.actor_id,
    row.target,
    ...detailStringValues(detail, [
      'node_id',
      'edge_id',
      'agent_id',
      'agent_slug',
      'agent',
      'agents',
      'provider',
      'runtime_id',
      'runtime',
      'name',
      'slug',
    ]),
  ].filter((value) => value != null && String(value).trim()).map(String)
  const canonical = resolveCanonicalAgentTarget(explicitCandidates, topologyEdgeIds)
  if (canonical) {
    return {
      ...canonical,
      agent_id: firstSanitizedIdentityValue([detail?.agent_id, row.target_id, canonical.agent_id]),
      agent_slug: firstSanitizedIdentityValue([detail?.agent_slug, detail?.agent, detail?.agents, canonical.agent_slug]),
      provider: firstSanitizedIdentityValue([detail?.provider]),
      runtime_id: firstSanitizedIdentityValue([detail?.runtime_id, detail?.runtime]),
    }
  }

  const explicitNames = detailStringValues(detail, ['agent_id', 'agent_slug', 'agent', 'agents', 'provider', 'runtime_id', 'runtime', 'name', 'slug'])
    .concat([row.target_id, row.actor_id, row.target].filter((value) => value != null && String(value).trim()).map(String))
  if (explicitNames.length > 0) {
    return {
      agent_id: firstSanitizedIdentityValue([detail?.agent_id, row.target_id]),
      agent_slug: firstSanitizedIdentityValue([detail?.agent_slug, detail?.agent, detail?.agents, row.target]),
      provider: firstSanitizedIdentityValue([detail?.provider]),
      runtime_id: firstSanitizedIdentityValue([detail?.runtime_id, detail?.runtime]),
      node_id: null,
      edge_id: null,
      route_group: null,
      source_id: 'agent_request_events',
      confidence: 'low',
      reason: 'agent_config_sync_identity_missing',
      source_provided_identity: false,
    }
  }

  return {
    agent_id: null,
    agent_slug: null,
    provider: null,
    runtime_id: null,
    node_id: null,
    edge_id: null,
    route_group: null,
    source_id: 'agent_request_events',
    confidence: 'low',
    reason: 'agent_config_sync_identity_missing',
    source_provided_identity: false,
  }
}

function missingMapping(input: {
  source_id: GatewayGraphTrafficSourceId
  telemetry_kind: string
  observed_at: string | null
  table: string
  provider?: string | null
  source_system?: string | null
  text?: string | null
  agentIdentity?: AgentConfigSyncIdentityResolution | null
}): GatewayGraphMissingTrafficMapping {
  const text = `${input.text || ''} ${input.provider || ''} ${input.telemetry_kind || ''}`.toLowerCase()
  const alias = resolveTrafficAlias(text)
  const looksAuth = /\blogin\b|\bauth\b/.test(text)
  const looksAgentConfig = /\bagent[-_. ]?config\b|\bagent_config_sync\b/.test(text)
  const looksProtectedActionCheck = /\bprotected[-_. ]?action[-_. ]?check\b/.test(text)
  const looksLegacyRoute = /\blegacy\b|[-_. ]route\b/.test(text)
  const looksStatic = /\bstatic\b|\bfallback\b/.test(text)
  const classification: GatewayGraphMissingTrafficMappingClassification = looksAuth
    ? 'auth_login_event_outside_gateway_topology'
    : looksAgentConfig
      ? 'missing_node_alias'
      : looksProtectedActionCheck
        ? 'protected_action_check_target_ambiguous'
        : looksLegacyRoute
          ? 'legacy_route_group'
          : looksStatic
            ? 'stale_static_name'
            : alias
              ? 'missing_edge_id'
              : input.source_system
                ? 'unmapped_event_type'
                : 'unknown_source_system'
  const candidateNodeId = looksAgentConfig ? input.agentIdentity?.node_id || null : alias?.candidate_node_id || null
  const candidateEdgeId = looksAgentConfig ? input.agentIdentity?.edge_id || null : alias?.edge_id || null
  const sourceSystem = sanitizeTelemetryText(
    input.source_system || (looksAuth ? 'auth' : looksAgentConfig ? 'agent_config' : alias?.source_system || input.provider || 'unknown'),
  )
  const recommendedMappingFix = looksAuth
    ? 'leave_unmapped_auth_events_outside_gateway_topology'
    : looksAgentConfig
      ? 'add_explicit_agent_identity_to_agent_config_sync_detail'
      : looksProtectedActionCheck
        ? 'add_exact_protected_action_target_edge_or_keep_in_approval_center'
        : alias
          ? `map_alias_to_${alias.edge_id}`
          : 'add_explicit_canonical_edge_mapping_or_keep_unmapped'
  const severity: GatewayGraphTrafficSeverity = classification === 'auth_login_event_outside_gateway_topology'
    ? 'info'
    : classification === 'unknown_source_system'
      ? 'error'
      : 'warning'
  return {
    source_id: input.source_id,
    telemetry_kind: sanitizeTelemetryText(input.telemetry_kind),
    source_event_type: sanitizeTelemetryText(input.telemetry_kind),
    source_system: sourceSystem,
    observed_at: input.observed_at,
    reason: 'traffic_edge_mapping_missing',
    table: input.table,
    provider: input.provider ? sanitizeTelemetryText(input.provider) : null,
    agent_id: input.agentIdentity?.agent_id || null,
    agent_slug: input.agentIdentity?.agent_slug || null,
    runtime_id: input.agentIdentity?.runtime_id || null,
    route_group: input.agentIdentity?.route_group || null,
    identity_confidence: input.agentIdentity?.confidence || (looksAgentConfig ? 'low' : null),
    identity_reason: input.agentIdentity?.reason || (looksAgentConfig ? 'agent_config_sync_identity_missing' : null),
    source_provided_identity: input.agentIdentity?.source_provided_identity || null,
    candidate_node_id: candidateNodeId,
    candidate_edge_id: candidateEdgeId,
    classification,
    recommended_mapping_fix: recommendedMappingFix,
    severity,
  }
}

function inspectModelRuns(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[], missing: GatewayGraphMissingTrafficMapping[]): GatewayGraphTrafficSource {
  if (!tableExists(db, 'runs')) return unavailableSource('model_request_logs', generatedAt, 'runs_table_missing')
  const cols = columnsFor(db, 'runs')
  const idExpr = cols.has('id') ? 'id' : 'NULL AS id'
  const providerExpr = cols.has('provider') ? 'provider' : 'NULL AS provider'
  const modelExpr = cols.has('model') ? 'model' : 'NULL AS model'
  const startedExpr = cols.has('started_at') ? 'started_at' : 'NULL AS started_at'
  const endedExpr = cols.has('ended_at') ? 'ended_at' : 'NULL AS ended_at'
  const rows = safeLimitRows(() => db.prepare(`
    SELECT ${idExpr}, ${providerExpr}, ${modelExpr}, ${startedExpr}, ${endedExpr}
    FROM runs
    ORDER BY COALESCE(ended_at, started_at) DESC
    LIMIT 200
  `).all() as Array<{ id: unknown; provider: unknown; model: unknown; started_at: unknown; ended_at: unknown }>)
  for (const row of rows) {
    const occurredAt = isoFromUnknownTimestamp(row.ended_at) || isoFromUnknownTimestamp(row.started_at)
    const edgeId = modelEdgeFor(row.provider, row.model)
    if (edgeId) {
      addActivity(activities, {
        edge_id: edgeId,
        source_id: 'model_request_logs',
        occurred_at: occurredAt,
        requests: 1,
        record_id: row.id ? `runs:${row.id}` : null,
        telemetry_kind: 'model_run',
      })
    }
    else missing.push(missingMapping({
      source_id: 'model_request_logs',
      telemetry_kind: 'model_run',
      observed_at: occurredAt,
      table: 'runs',
      provider: String(row.provider || row.model || 'unknown'),
      text: `${row.provider || ''} ${row.model || ''}`,
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
    const idExpr = cols.has('id') ? 'id' : 'NULL AS id'
    const createdExpr = cols.has('created_at') ? 'created_at' : 'NULL AS created_at'
    const updatedExpr = cols.has('updated_at') ? 'updated_at' : 'NULL AS updated_at'
    const rows = safeLimitRows(() => db.prepare(`SELECT ${idExpr}, ${createdExpr}, ${updatedExpr} FROM ${table} ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 80`).all() as Array<{ id: unknown; created_at: unknown; updated_at: unknown }>)
    for (const row of rows) {
      addActivity(activities, {
        edge_id: 'agentmail.gateway_to_agentmail',
        source_id: 'agentmail_events',
        occurred_at: isoFromUnknownTimestamp(row.updated_at) || isoFromUnknownTimestamp(row.created_at),
        events: table === 'agentmail_send_requests' ? 0 : 1,
        requests: table === 'agentmail_send_requests' ? 1 : 0,
        record_id: row.id ? `${table}:${row.id}` : null,
        telemetry_kind: table,
      })
    }
  }
  return readableSource('agentmail_events', generatedAt, 'agentmail_tables_read_only', ['agentmail.gateway_to_agentmail'])
}

function inspectBridgeQueue(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[]): GatewayGraphTrafficSource {
  if (!tableExists(db, 'agentmail_bridge_queue')) return unavailableSource('bridge_queue_events', generatedAt, 'bridge_queue_table_missing')
  const cols = columnsFor(db, 'agentmail_bridge_queue')
  const idExpr = cols.has('id') ? 'id' : 'NULL AS id'
  const rows = safeLimitRows(() => db.prepare(`SELECT ${idExpr}, created_at FROM agentmail_bridge_queue ORDER BY created_at DESC LIMIT 80`).all() as Array<{ id: unknown; created_at: unknown }>)
  for (const row of rows) {
    addActivity(activities, {
      edge_id: 'agentmail.gateway_to_agentmail',
      source_id: 'bridge_queue_events',
      occurred_at: isoFromUnknownTimestamp(row.created_at),
      events: 1,
      record_id: row.id ? `agentmail_bridge_queue:${row.id}` : null,
      telemetry_kind: 'agentmail_bridge_queue',
    })
  }
  return readableSource('bridge_queue_events', generatedAt, 'bridge_queue_table_read_only', ['agentmail.gateway_to_agentmail'])
}

function inspectWebhookDeliveries(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[]): GatewayGraphTrafficSource {
  if (!tableExists(db, 'webhook_deliveries')) return unavailableSource('workflow_trigger_events', generatedAt, 'webhook_deliveries_table_missing')
  const cols = columnsFor(db, 'webhook_deliveries')
  const idExpr = cols.has('id') ? 'id' : 'NULL AS id'
  const rows = safeLimitRows(() => db.prepare(`SELECT ${idExpr}, created_at, duration_ms FROM webhook_deliveries ORDER BY created_at DESC LIMIT 80`).all() as Array<{ id: unknown; created_at: unknown; duration_ms: unknown }>)
  for (const row of rows) {
    addActivity(activities, {
      edge_id: 'webhooks.inbound_to_gateway',
      source_id: 'workflow_trigger_events',
      occurred_at: isoFromUnknownTimestamp(row.created_at),
      events: 1,
      bytes_in: 0,
      bytes_out: 0,
      record_id: row.id ? `webhook_deliveries:${row.id}` : null,
      telemetry_kind: 'webhook_delivery',
    })
  }
  return readableSource('workflow_trigger_events', generatedAt, 'webhook_deliveries_table_read_only', ['webhooks.inbound_to_gateway'])
}

function inspectReports(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[]): GatewayGraphTrafficSource {
  if (!tableExists(db, 'scheduled_reports')) return unavailableSource('report_preview_events', generatedAt, 'scheduled_reports_table_missing')
  const cols = columnsFor(db, 'scheduled_reports')
  const idExpr = cols.has('id') ? 'id' : 'NULL AS id'
  const lastExpr = cols.has('last_run_at') ? 'last_run_at' : 'NULL AS last_run_at'
  const updatedExpr = cols.has('updated_at') ? 'updated_at' : 'NULL AS updated_at'
  const rows = safeLimitRows(() => db.prepare(`SELECT ${idExpr}, ${lastExpr}, ${updatedExpr} FROM scheduled_reports ORDER BY COALESCE(last_run_at, updated_at) DESC LIMIT 80`).all() as Array<{ id: unknown; last_run_at: unknown; updated_at: unknown }>)
  for (const row of rows) {
    addActivity(activities, {
      edge_id: 'reports.gateway_to_reports',
      source_id: 'report_preview_events',
      occurred_at: isoFromUnknownTimestamp(row.last_run_at) || isoFromUnknownTimestamp(row.updated_at),
      requests: 1,
      record_id: row.id ? `scheduled_reports:${row.id}` : null,
      telemetry_kind: 'report_preview',
    })
  }
  return readableSource('report_preview_events', generatedAt, 'scheduled_reports_table_read_only', ['reports.gateway_to_reports'])
}

function inspectGatewayActivities(db: Database.Database, generatedAt: string, activities: GatewayGraphEdgeActivity[]): GatewayGraphTrafficSource {
  if (!tableExists(db, 'activities')) return unavailableSource('gateway_event_bus', generatedAt, 'activities_table_missing')
  const cols = columnsFor(db, 'activities')
  const idExpr = cols.has('id') ? 'id' : 'NULL AS id'
  const textColumns = [
    'type',
    'entity_type',
    'entity_id',
    'actor',
    'description',
    'data',
    'canonical_node_id',
    'node_id',
    'target_type',
    'target_id',
    'action',
    'provider',
    'model',
    'tool',
    'route',
    'metadata',
    'metadata_json',
  ].filter((column) => cols.has(column))
  const selectColumns = textColumns.map((column) => `"${column.replace(/"/g, '""')}"`).join(', ')
  const rows = safeLimitRows(() => db.prepare(`SELECT ${idExpr}, created_at${selectColumns ? `, ${selectColumns}` : ''} FROM activities ORDER BY created_at DESC LIMIT 120`).all() as Array<Record<string, unknown> & { id: unknown; created_at: unknown }>)
  const sourceEdgeIds = new Set<string>(['events.event_bus_to_gateway'])
  for (const row of rows) {
    const text = textColumns.map((column) => row[column]).filter((value) => value != null).join(' ')
    const edgeId = edgeForGatewayActivityTarget(row) || edgeForAuditText(text) || 'events.event_bus_to_gateway'
    sourceEdgeIds.add(edgeId)
    addActivity(activities, {
      edge_id: edgeId,
      source_id: 'gateway_event_bus',
      occurred_at: isoFromUnknownTimestamp(row.created_at),
      events: edgeId.startsWith('model.') ? 0 : 1,
      requests: edgeId.startsWith('model.') ? 1 : 0,
      record_id: row.id ? `activities:${row.id}` : null,
      telemetry_kind: 'gateway_activity',
    })
  }
  return readableSource('gateway_event_bus', generatedAt, 'activities_table_read_only', Array.from(sourceEdgeIds))
}

function inspectAuditTables(
  db: Database.Database,
  generatedAt: string,
  activities: GatewayGraphEdgeActivity[],
  missing: GatewayGraphMissingTrafficMapping[],
  topology: GatewayGraphTopologyPayload,
) {
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

  const topologyEdgeIds = new Set(topology.edges.map((edge) => edge.edge_id))

  for (const table of auditTables) {
    const cols = columnsFor(db, table)
    const textColumns = ['action', 'event', 'actor', 'actor_id', 'target', 'target_type', 'target_id', 'outcome', 'metadata_json', 'detail']
      .filter((column) => cols.has(column))
    const timeColumn = ['created_at', 'ts', 'timestamp', 'updated_at'].find((column) => cols.has(column))
    const idColumn = cols.has('id') ? 'id' : null
    if (!textColumns.length || !timeColumn) continue
    const selected = [...(idColumn ? [idColumn] : []), ...textColumns, timeColumn].join(', ')
    const rows = safeLimitRows(() => db.prepare(`SELECT ${selected} FROM ${table} ORDER BY ${timeColumn} DESC LIMIT 160`).all() as Record<string, unknown>[])
    for (const row of rows) {
      const text = textColumns.map((column) => String(row[column] || '')).join(' ')
      const occurredAt = isoFromUnknownTimestamp(row[timeColumn])
      const telemetryKind = sanitizeTelemetryText(row.action || row.event || 'audit_event')
      const looksAgentConfig = telemetryKind === 'agent_config_sync' || /\bagent[-_. ]?config\b|\bagent_config_sync\b/i.test(text)
      if (looksAgentConfig) {
        const agentIdentity = resolveAgentConfigSyncIdentity(row, topologyEdgeIds)
        if (agentIdentity.confidence === 'high' && agentIdentity.edge_id) {
          if (!sourceStatus.has(agentIdentity.source_id) || sourceStatus.get(agentIdentity.source_id)?.status !== 'readable') {
            sourceStatus.set(agentIdentity.source_id, readableSource(agentIdentity.source_id, generatedAt, 'audit_tables_read_only'))
          }
          addActivity(activities, {
            edge_id: agentIdentity.edge_id,
            source_id: agentIdentity.source_id,
            occurred_at: occurredAt,
            events: 1,
            record_id: row[idColumn || ''] ? `${table}:${row[idColumn || '']}` : `${table}:agent_config_sync`,
            telemetry_kind: 'agent_config_sync',
            identity_confidence: agentIdentity.confidence,
            identity_reason: agentIdentity.reason,
            source_provided_identity: agentIdentity.source_provided_identity || false,
          })
          continue
        }
        missing.push(missingMapping({
          source_id: agentIdentity.source_id,
          telemetry_kind: 'agent_config_sync',
          observed_at: occurredAt,
          table,
          provider: agentIdentity.provider,
          source_system: 'agent_config',
          text,
          agentIdentity,
        }))
        continue
      }
      const edgeId = edgeForAuditText(text)
      const sourceIds = sourceIdsFromAuditEdge(edgeId)
      if (!edgeId || !sourceIds.length) {
        missing.push(missingMapping({
          source_id: 'connector_readiness_events',
          telemetry_kind: telemetryKind,
          observed_at: occurredAt,
          table,
          provider: null,
          source_system: String(row.target_type || row.target || ''),
          text,
        }))
        continue
      }
      for (const sourceId of sourceIds) {
        if (!sourceStatus.has(sourceId) || sourceStatus.get(sourceId)?.status !== 'readable') {
          sourceStatus.set(sourceId, readableSource(sourceId, generatedAt, 'audit_tables_read_only'))
        }
        addActivity(activities, {
          edge_id: edgeId,
          source_id: sourceId,
          occurred_at: occurredAt,
          events: 1,
          record_id: row[idColumn || ''] ? `${table}:${row[idColumn || '']}` : `${table}:${sanitizeTelemetryText(row.action || row.event || edgeId)}`,
          telemetry_kind: telemetryKind,
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
      ...inspectAuditTables(db, generatedAt, activities, missing, topology),
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
