import type { GatewayCapability, GatewayNode, GatewayRegistry, GatewayStatus } from './gateway-model'

export const GATEWAY_DATA_LAYER_NODE_TYPES = [
  'owner',
  'gateway',
  'commander',
  'lieutenant',
  'mini_agent',
  'skill',
  'tool',
  'model',
  'mcp_server',
  'api',
  'event',
  'data_source',
  'brain_system',
  'opencloud_worker',
  'buildwiki_farmer',
  'delivery_channel',
] as const

export type GatewayDataLayerNodeType = (typeof GATEWAY_DATA_LAYER_NODE_TYPES)[number]

export const GATEWAY_DATA_LAYER_STATUS_STATES = [
  'connected',
  'configured',
  'read_only',
  'write_enabled',
  'execution_enabled',
  'blocked',
  'missing',
  'degraded',
] as const

export type GatewayDataLayerStatus = (typeof GATEWAY_DATA_LAYER_STATUS_STATES)[number]

export interface GatewayDataLayerNode {
  id: string
  name: string
  type: GatewayDataLayerNodeType
  source: string
  status: GatewayDataLayerStatus
  connected: boolean
  configured: boolean
  read_enabled: boolean
  write_enabled: boolean
  execution_enabled: boolean
  requires_bridge_session: boolean
  blocked_reason: string | null
  last_success: string | null
  last_error: string | null
  owner_visible_summary: string
  semantic_context: string
}

export interface GatewayDataLayerSystem {
  id: string
  name: string
  type: GatewayDataLayerNodeType
  status: GatewayDataLayerStatus
  node_count: number
  source_count: number
  read_enabled: boolean
  write_enabled: boolean
  execution_enabled: boolean
  requires_bridge_session: boolean
  blocked_reason: string | null
  owner_visible_summary: string
}

export interface GatewayDataLayerSource {
  id: string
  system_id: string
  name: string
  type: GatewayDataLayerNodeType
  source: string
  status: GatewayDataLayerStatus
  read_enabled: boolean
  write_enabled: boolean
  execution_enabled: boolean
  requires_bridge_session: boolean
  blocked_reason: string | null
}

export interface GatewayDataLayerSchema {
  id: string
  system_id: string
  source_id: string
  name: string
  table_count: number
  owner_visible_summary: string
}

export interface GatewayDataLayerTable {
  id: string
  schema_id: string
  source_id: string
  name: string
  node_id: string
  row_access: 'read_enabled' | 'blocked'
  write_access: 'write_enabled' | 'bridge_session_required' | 'blocked'
  execution_access: 'execution_enabled' | 'bridge_session_required' | 'blocked'
  blocked_reason: string | null
}

export interface GatewayDataLayerColumn {
  id: string
  table_id: string
  name: string
  type: 'string' | 'boolean' | 'datetime' | 'status' | 'summary'
  nullable: boolean
  owner_visible: boolean
}

export interface GatewayDataLayerSnapshot {
  generated_at: string
  systems: GatewayDataLayerSystem[]
  sources: GatewayDataLayerSource[]
  schemas: GatewayDataLayerSchema[]
  tables: GatewayDataLayerTable[]
  columns: GatewayDataLayerColumn[]
  nodes: GatewayDataLayerNode[]
  discovery_tools: readonly string[]
}

export interface GatewayDataLayerQueryInput {
  node_id?: string
  table_id?: string
  system_id?: string
  limit?: number
}

export interface GatewayDataLayerQueryResult {
  ok: boolean
  mode: 'read_only_query'
  read_enabled: boolean
  rows: GatewayDataLayerNode[]
  blocked_reason: string | null
}

export interface GatewayDataLayerExecuteInput {
  node_id?: string
  action?: string
  payload?: Record<string, unknown>
  bridge_session_id?: string
}

export interface GatewayDataLayerExecuteResult {
  ok: false
  mode: 'bridge_session_required'
  execution_enabled: false
  accepted_for_execution: false
  requires_bridge_session: true
  blocked_reason: string
}

export const GATEWAY_DATA_LAYER_DISCOVERY_TOOLS = [
  'getSystems',
  'getSources',
  'getSchemas',
  'getTables',
  'getColumns',
  'getTools',
  'getSkills',
  'getAgents',
  'getModels',
  'queryData',
  'executeAction',
] as const

const STATUS_TO_DATA_LAYER_STATUS: Record<GatewayStatus, GatewayDataLayerStatus> = {
  connected: 'connected',
  read_only: 'read_only',
  write_enabled: 'write_enabled',
  execution_enabled: 'execution_enabled',
  blocked: 'blocked',
  missing: 'missing',
  degraded: 'degraded',
}

const COLUMN_TEMPLATES: Array<Omit<GatewayDataLayerColumn, 'id' | 'table_id'>> = [
  { name: 'id', type: 'string', nullable: false, owner_visible: true },
  { name: 'name', type: 'string', nullable: false, owner_visible: true },
  { name: 'type', type: 'string', nullable: false, owner_visible: true },
  { name: 'status', type: 'status', nullable: false, owner_visible: true },
  { name: 'connected', type: 'boolean', nullable: false, owner_visible: true },
  { name: 'configured', type: 'boolean', nullable: false, owner_visible: true },
  { name: 'read_enabled', type: 'boolean', nullable: false, owner_visible: true },
  { name: 'write_enabled', type: 'boolean', nullable: false, owner_visible: true },
  { name: 'execution_enabled', type: 'boolean', nullable: false, owner_visible: true },
  { name: 'requires_bridge_session', type: 'boolean', nullable: false, owner_visible: true },
  { name: 'blocked_reason', type: 'string', nullable: true, owner_visible: true },
  { name: 'last_success', type: 'datetime', nullable: true, owner_visible: true },
  { name: 'last_error', type: 'string', nullable: true, owner_visible: true },
  { name: 'owner_visible_summary', type: 'summary', nullable: false, owner_visible: true },
]

export function buildGatewayDataLayer(registry: GatewayRegistry): GatewayDataLayerSnapshot {
  const nodes = normalizeDataLayerNodes(registry)
  const systems = buildSystems(nodes)
  const sources = buildSources(nodes)
  const schemas = buildSchemas(sources)
  const tables = buildTables(nodes, sources, schemas)
  const columns = tables.flatMap((table) =>
    COLUMN_TEMPLATES.map((column) => ({
      id: gatewayDataLayerId(`${table.id}.${column.name}`),
      table_id: table.id,
      ...column,
    })),
  )

  return {
    generated_at: registry.generated_at,
    systems,
    sources,
    schemas,
    tables,
    columns,
    nodes,
    discovery_tools: GATEWAY_DATA_LAYER_DISCOVERY_TOOLS,
  }
}

export function getSystems(layer: GatewayDataLayerSnapshot): GatewayDataLayerSystem[] {
  return layer.systems
}

export function getSources(layer: GatewayDataLayerSnapshot, systemId?: string): GatewayDataLayerSource[] {
  return systemId ? layer.sources.filter((source) => source.system_id === systemId) : layer.sources
}

export function getSchemas(
  layer: GatewayDataLayerSnapshot,
  filters: { systemId?: string; sourceId?: string } = {},
): GatewayDataLayerSchema[] {
  return layer.schemas.filter((schema) => {
    if (filters.systemId && schema.system_id !== filters.systemId) return false
    if (filters.sourceId && schema.source_id !== filters.sourceId) return false
    return true
  })
}

export function getTables(
  layer: GatewayDataLayerSnapshot,
  filters: { schemaId?: string; sourceId?: string } = {},
): GatewayDataLayerTable[] {
  return layer.tables.filter((table) => {
    if (filters.schemaId && table.schema_id !== filters.schemaId) return false
    if (filters.sourceId && table.source_id !== filters.sourceId) return false
    return true
  })
}

export function getColumns(layer: GatewayDataLayerSnapshot, tableId?: string): GatewayDataLayerColumn[] {
  return tableId ? layer.columns.filter((column) => column.table_id === tableId) : layer.columns
}

export function getTools(layer: GatewayDataLayerSnapshot): GatewayDataLayerNode[] {
  return layer.nodes.filter((node) => node.type === 'tool' || node.type === 'mcp_server' || node.type === 'api')
}

export function getSkills(layer: GatewayDataLayerSnapshot): GatewayDataLayerNode[] {
  return layer.nodes.filter((node) => node.type === 'skill')
}

export function getAgents(layer: GatewayDataLayerSnapshot): GatewayDataLayerNode[] {
  return layer.nodes.filter((node) => node.type === 'owner' || node.type === 'commander' || node.type === 'lieutenant' || node.type === 'mini_agent')
}

export function getModels(layer: GatewayDataLayerSnapshot): GatewayDataLayerNode[] {
  return layer.nodes.filter((node) => node.type === 'model')
}

export function queryData(layer: GatewayDataLayerSnapshot, input: GatewayDataLayerQueryInput = {}): GatewayDataLayerQueryResult {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 200))
  const rows = layer.nodes.filter((node) => {
    if (input.node_id && node.id !== gatewayDataLayerId(input.node_id)) return false
    if (input.system_id && systemIdForNodeType(node.type) !== input.system_id) return false
    if (input.table_id) {
      const table = layer.tables.find((candidate) => candidate.id === input.table_id)
      if (!table || table.node_id !== node.id) return false
    }
    return true
  })

  if (rows.length === 0) {
    return {
      ok: false,
      mode: 'read_only_query',
      read_enabled: false,
      rows: [],
      blocked_reason: 'gateway_data_layer_node_or_table_not_found',
    }
  }

  const unreadable = rows.find((node) => !node.read_enabled)
  if (unreadable) {
    return {
      ok: false,
      mode: 'read_only_query',
      read_enabled: false,
      rows: [],
      blocked_reason: unreadable.blocked_reason ?? `gateway_data_layer_read_blocked:${unreadable.id}`,
    }
  }

  return {
    ok: true,
    mode: 'read_only_query',
    read_enabled: true,
    rows: rows.slice(0, limit),
    blocked_reason: null,
  }
}

export function executeAction(
  _layer: GatewayDataLayerSnapshot,
  _input: GatewayDataLayerExecuteInput = {},
): GatewayDataLayerExecuteResult {
  return {
    ok: false,
    mode: 'bridge_session_required',
    execution_enabled: false,
    accepted_for_execution: false,
    requires_bridge_session: true,
    blocked_reason: 'gateway_data_layer_executeAction_requires_active_bridge_session_and_registered_adapter',
  }
}

export function dataLayerResponseForTool(
  layer: GatewayDataLayerSnapshot,
  tool: string,
  searchParams: URLSearchParams = new URLSearchParams(),
): unknown {
  switch (tool) {
    case 'getSystems':
      return getSystems(layer)
    case 'getSources':
      return getSources(layer, searchParams.get('system_id') ?? undefined)
    case 'getSchemas':
      return getSchemas(layer, {
        systemId: searchParams.get('system_id') ?? undefined,
        sourceId: searchParams.get('source_id') ?? undefined,
      })
    case 'getTables':
      return getTables(layer, {
        schemaId: searchParams.get('schema_id') ?? undefined,
        sourceId: searchParams.get('source_id') ?? undefined,
      })
    case 'getColumns':
      return getColumns(layer, searchParams.get('table_id') ?? undefined)
    case 'getTools':
      return getTools(layer)
    case 'getSkills':
      return getSkills(layer)
    case 'getAgents':
      return getAgents(layer)
    case 'getModels':
      return getModels(layer)
    default:
      return null
  }
}

function normalizeDataLayerNodes(registry: GatewayRegistry): GatewayDataLayerNode[] {
  const nodes = [
    ...registry.nodes.map(dataLayerNodeFromGatewayNode),
    ...registry.capabilities.map(dataLayerNodeFromCapability),
  ]

  const byId = new Map<string, GatewayDataLayerNode>()
  for (const node of nodes) {
    const existing = byId.get(node.id)
    if (!existing || statusWeight(node.status) > statusWeight(existing.status)) {
      byId.set(node.id, node)
    }
  }
  return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name))
}

function dataLayerNodeFromGatewayNode(node: GatewayNode): GatewayDataLayerNode {
  const type = nodeTypeFromGatewayNode(node)
  const status = STATUS_TO_DATA_LAYER_STATUS[node.health.status]
  const blockedReason = safeText(node.blockers.find(Boolean) ?? null)
  const connected = ['connected', 'read_only', 'write_enabled', 'execution_enabled'].includes(status)
  const configured = status !== 'missing'
  const readEnabled = connected || status === 'configured'
  const requiresSession = node.capabilities.some((capability) => /write|execute|send|upload|run/i.test(capability))

  return {
    id: gatewayDataLayerId(node.id),
    name: safeText(node.label) ?? node.id,
    type,
    source: safeText(node.owner) ?? 'gateway_registry',
    status,
    connected,
    configured,
    read_enabled: readEnabled && status !== 'blocked',
    write_enabled: status === 'write_enabled' || status === 'execution_enabled',
    execution_enabled: status === 'execution_enabled',
    requires_bridge_session: requiresSession || status === 'write_enabled' || status === 'execution_enabled',
    blocked_reason: blockedReason,
    last_success: node.health.last_seen ?? null,
    last_error: null,
    owner_visible_summary: safeText(node.health.summary) ?? `${node.label} is represented in the Gateway registry.`,
    semantic_context: semanticContextFor(type, safeText(node.label) ?? node.id),
  }
}

function dataLayerNodeFromCapability(capability: GatewayCapability): GatewayDataLayerNode {
  const type = nodeTypeFromCapability(capability)
  const status = STATUS_TO_DATA_LAYER_STATUS[capability.status]
  const connected = capability.status !== 'blocked' && capability.status !== 'missing' && capability.read_enabled
  const configured = capability.status !== 'missing' && !capability.blockers.some((blocker) => /missing_credential/i.test(blocker))
  const readEnabled = capability.read_enabled && capability.status !== 'blocked'
  const writeEnabled = capability.write_enabled && capability.status !== 'blocked'
  const executionEnabled = capability.execution_enabled && capability.status !== 'blocked'

  return {
    id: gatewayDataLayerId(`capability.${capability.id}`),
    name: safeText(capability.label) ?? capability.id,
    type,
    source: safeText(capability.source_node ?? capability.kind) ?? 'gateway_capability_registry',
    status,
    connected,
    configured,
    read_enabled: readEnabled,
    write_enabled: writeEnabled,
    execution_enabled: executionEnabled,
    requires_bridge_session: capability.requires_session,
    blocked_reason: safeText(capability.blockers.find(Boolean) ?? null),
    last_success: capability.last_seen ?? null,
    last_error: safeText(stringStatusDetail(capability.status_details, 'last_error')),
    owner_visible_summary: safeText(stringStatusDetail(capability.status_details, 'summary')) ?? `${capability.label} is represented in the Gateway capability registry.`,
    semantic_context: semanticContextFor(type, safeText(capability.label) ?? capability.id),
  }
}

function buildSystems(nodes: GatewayDataLayerNode[]): GatewayDataLayerSystem[] {
  return GATEWAY_DATA_LAYER_NODE_TYPES.map((type) => {
    const systemNodes = nodes.filter((node) => node.type === type)
    const sourceIds = new Set(systemNodes.map((node) => node.source))
    const blocked = systemNodes.find((node) => node.blocked_reason)
    return {
      id: systemIdForNodeType(type),
      name: systemLabelForNodeType(type),
      type,
      status: aggregateStatus(systemNodes),
      node_count: systemNodes.length,
      source_count: sourceIds.size,
      read_enabled: systemNodes.some((node) => node.read_enabled),
      write_enabled: systemNodes.some((node) => node.write_enabled),
      execution_enabled: systemNodes.some((node) => node.execution_enabled),
      requires_bridge_session: systemNodes.some((node) => node.requires_bridge_session),
      blocked_reason: blocked?.blocked_reason ?? (systemNodes.length === 0 ? 'gateway_data_layer_system_has_no_registered_nodes' : null),
      owner_visible_summary: `${systemLabelForNodeType(type)} contains ${systemNodes.length} Gateway node${systemNodes.length === 1 ? '' : 's'}.`,
    }
  })
}

function buildSources(nodes: GatewayDataLayerNode[]): GatewayDataLayerSource[] {
  return nodes.map((node) => ({
    id: gatewayDataLayerId(`${systemIdForNodeType(node.type)}.${node.source}.${node.id}`),
    system_id: systemIdForNodeType(node.type),
    name: node.source,
    type: node.type,
    source: node.source,
    status: node.status,
    read_enabled: node.read_enabled,
    write_enabled: node.write_enabled,
    execution_enabled: node.execution_enabled,
    requires_bridge_session: node.requires_bridge_session,
    blocked_reason: node.blocked_reason,
  }))
}

function buildSchemas(sources: GatewayDataLayerSource[]): GatewayDataLayerSchema[] {
  return sources.map((source) => ({
    id: gatewayDataLayerId(`${source.id}.schema`),
    system_id: source.system_id,
    source_id: source.id,
    name: `${source.name} schema`,
    table_count: 1,
    owner_visible_summary: `Discovery schema for ${source.name}.`,
  }))
}

function buildTables(
  nodes: GatewayDataLayerNode[],
  sources: GatewayDataLayerSource[],
  schemas: GatewayDataLayerSchema[],
): GatewayDataLayerTable[] {
  return nodes.map((node) => {
    const source = sources.find((candidate) => candidate.system_id === systemIdForNodeType(node.type) && candidate.source === node.source && candidate.id.endsWith(node.id))
    const schema = source ? schemas.find((candidate) => candidate.source_id === source.id) : undefined
    const schemaId = schema?.id ?? gatewayDataLayerId(`${node.id}.schema`)
    return {
      id: gatewayDataLayerId(`${schemaId}.${node.id}.status`),
      schema_id: schemaId,
      source_id: source?.id ?? gatewayDataLayerId(`${node.id}.source`),
      name: `${node.name} status`,
      node_id: node.id,
      row_access: node.read_enabled ? 'read_enabled' : 'blocked',
      write_access: node.write_enabled ? 'write_enabled' : node.requires_bridge_session ? 'bridge_session_required' : 'blocked',
      execution_access: node.execution_enabled ? 'execution_enabled' : node.requires_bridge_session ? 'bridge_session_required' : 'blocked',
      blocked_reason: node.blocked_reason,
    }
  })
}

function stringStatusDetail(details: Record<string, string | number | boolean | null>, key: string): string | null {
  const value = details[key]
  return typeof value === 'string' ? value : null
}

function nodeTypeFromGatewayNode(node: GatewayNode): GatewayDataLayerNodeType {
  switch (node.kind) {
    case 'owner':
      return 'owner'
    case 'commander':
      return 'commander'
    case 'lieutenant':
      return 'lieutenant'
    case 'mini_agent':
      return 'mini_agent'
    case 'gateway':
      return 'gateway'
    case 'skill':
      return 'skill'
    case 'tool':
      return 'tool'
    case 'mcp_server':
      return 'mcp_server'
    case 'api':
      return 'api'
    case 'model':
      return 'model'
    case 'brain_system':
      return 'brain_system'
    case 'opencloud_worker':
      return 'opencloud_worker'
    case 'buildwiki_farmer':
      return 'buildwiki_farmer'
    case 'event':
      return 'event'
    case 'data_source':
      return 'data_source'
    case 'delivery_channel':
      return 'delivery_channel'
  }
}

function nodeTypeFromCapability(capability: GatewayCapability): GatewayDataLayerNodeType {
  const id = capability.id.toLowerCase()
  const label = capability.label.toLowerCase()
  if (capability.kind === 'agent') return 'mini_agent'
  if (capability.kind === 'skill') return 'skill'
  if (capability.kind === 'tool') return 'tool'
  if (capability.kind === 'mcp_server') return 'mcp_server'
  if (capability.kind === 'api') return isDeliveryCapability(id, label) ? 'delivery_channel' : 'api'
  if (capability.kind === 'model') return 'model'
  if (capability.kind === 'brain') {
    if (id.includes('buildwiki') || id.includes('farmer') || label.includes('build-wiki') || label.includes('farmer')) return 'buildwiki_farmer'
    if (id.includes('opencloud') || label.includes('opencloud')) return 'opencloud_worker'
    return 'brain_system'
  }
  if (capability.kind === 'integration') return isDeliveryCapability(id, label) ? 'delivery_channel' : 'api'
  return 'data_source'
}

function isDeliveryCapability(id: string, label: string): boolean {
  return /telegram|agentmail|mail|drive|onedrive|report|delivery|attachment|upload/.test(`${id} ${label}`)
}

function aggregateStatus(nodes: GatewayDataLayerNode[]): GatewayDataLayerStatus {
  if (nodes.length === 0) return 'missing'
  if (nodes.some((node) => node.status === 'execution_enabled')) return 'execution_enabled'
  if (nodes.some((node) => node.status === 'write_enabled')) return 'write_enabled'
  if (nodes.some((node) => node.status === 'connected')) return 'connected'
  if (nodes.some((node) => node.status === 'read_only')) return 'read_only'
  if (nodes.some((node) => node.status === 'configured')) return 'configured'
  if (nodes.some((node) => node.status === 'degraded')) return 'degraded'
  if (nodes.some((node) => node.status === 'blocked')) return 'blocked'
  return 'missing'
}

function statusWeight(status: GatewayDataLayerStatus): number {
  const order: Record<GatewayDataLayerStatus, number> = {
    missing: 0,
    blocked: 1,
    degraded: 2,
    configured: 3,
    read_only: 4,
    connected: 5,
    write_enabled: 6,
    execution_enabled: 7,
  }
  return order[status]
}

function systemIdForNodeType(type: GatewayDataLayerNodeType): string {
  return `system.${type}`
}

function systemLabelForNodeType(type: GatewayDataLayerNodeType): string {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function semanticContextFor(type: GatewayDataLayerNodeType, name: string): string {
  if (type === 'opencloud_worker') {
    return `${name} is a retained OpenCloud or Build-Wiki worker/runtime node under Gateway control, not a deletion target.`
  }
  if (type === 'buildwiki_farmer') return `${name} is a Build-Wiki/Farmer node; Run Now requires Bridge Session approval and stays scoped to the farmer service.`
  if (type === 'skill') return `${name} is a shared OpenClaw+ skill capability discoverable before activation.`
  if (type === 'owner' || type === 'commander' || type === 'lieutenant' || type === 'mini_agent') return `${name} is an agent-family node governed by Gateway policy and hierarchy.`
  if (type === 'model') return `${name} is an LLM/model route governed by Gateway routing and fallback policy.`
  if (type === 'mcp_server') return `${name} is an MCP discovery node; schemas are discovered before execution.`
  if (type === 'brain_system') return `${name} is a Brain system node with explicit read/write status.`
  if (type === 'gateway') return `${name} is the governed Gateway control point for routing, policy, observability, and registry discovery.`
  if (type === 'delivery_channel') return `${name} is a delivery node; external delivery requires policy checks and may require Bridge Session.`
  if (type === 'event') return `${name} is an event source or event stream observed by Gateway.`
  return `${name} is a Gateway data-layer node with discovery-first status and policy metadata.`
}

function gatewayDataLayerId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}

function safeText(value: string | null | undefined): string | null {
  if (!value) return null
  return value
    .replace(/(?:sk|pk|key|token|secret|password)_[A-Za-z0-9_-]{8,}/gi, '[redacted]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g, '[redacted]')
    .replace(/\/(?:home|Users)\/[^\s'"`]+/g, '[local-path-redacted]')
}
