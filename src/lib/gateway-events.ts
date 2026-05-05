import type { GatewayCapability, GatewayRegistry, GatewayStatus } from './gateway-model'

export const GATEWAY_EVENT_KINDS = [
  'telegram_message',
  'email_received',
  'report_generated',
  'approval_requested',
  'tool_completed',
  'sync_completed',
] as const

export type GatewayEventKind = (typeof GATEWAY_EVENT_KINDS)[number]

export type GatewayEventRecord = {
  id: string
  kind: GatewayEventKind
  label: string
  source: string
  target: string
  status: GatewayStatus
  occurred_at: string | null
  route: string
  summary: string
  requires_bridge_session: boolean
  write_event: boolean
  blockers: string[]
}

export type GatewayEventsPayload = {
  ok: true
  mode: 'gateway_events_read_only'
  generated_at: string
  event_definitions: Array<{
    kind: GatewayEventKind
    label: string
    source: string
    description: string
  }>
  events: GatewayEventRecord[]
  summary: {
    total: number
    connected_or_visible: number
    blocked: number
    sources: string[]
  }
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
}

const SECRETISH_PATTERN =
  /(sk-[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*(?:=\s*[^,\s}]+|:\s+[^,\s}]+))/gi
const RAW_PATH_PATTERN = /(?:\/home\/tony|\/a0\/(?:usr|tmp|var)|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi

const EVENT_DEFINITIONS: GatewayEventsPayload['event_definitions'] = [
  {
    kind: 'telegram_message',
    label: 'Telegram message',
    source: 'Telegram',
    description: 'Owner Telegram messages are normalized into Gateway events before routing to Agent Zero.',
  },
  {
    kind: 'email_received',
    label: 'Email received',
    source: 'AgentMail',
    description: 'Incoming AgentMail messages are visible as read-only Gateway events.',
  },
  {
    kind: 'report_generated',
    label: 'Report generated',
    source: 'Mission Control reports',
    description: 'Report creation and delivery adapters publish report lifecycle events.',
  },
  {
    kind: 'approval_requested',
    label: 'Approval requested',
    source: 'Bridge Session policy',
    description: 'Protected action and Bridge Session approval requests are observable in Gateway.',
  },
  {
    kind: 'tool_completed',
    label: 'Tool completed',
    source: 'Bridge/MCP',
    description: 'Registered tool completions are observed after approved adapter execution.',
  },
  {
    kind: 'sync_completed',
    label: 'Sync completed',
    source: 'Build-Wiki/Farmer',
    description: 'Farmer sync completion status is observed from the Build-Wiki status adapter.',
  },
]

export function buildGatewayEventsPayload(registry: GatewayRegistry): GatewayEventsPayload {
  const events = buildGatewayEvents(registry)
  const blocked = events.filter((event) => event.status === 'blocked' || event.status === 'missing').length
  return {
    ok: true,
    mode: 'gateway_events_read_only',
    generated_at: registry.generated_at,
    event_definitions: EVENT_DEFINITIONS,
    events,
    summary: {
      total: events.length,
      connected_or_visible: events.length - blocked,
      blocked,
      sources: EVENT_DEFINITIONS.map((definition) => definition.source),
    },
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
  }
}

function buildGatewayEvents(registry: GatewayRegistry): GatewayEventRecord[] {
  const telegram = findCapability(registry, 'integration_telegram')
  const agentMail = findCapability(registry, 'integration_agentmail')
  const report = findCapability(registry, 'tool_report_create') ||
    registry.capabilities.find((capability) => capability.kind === 'tool' && /report/i.test(capability.label))
  const mcpTool = registry.capabilities.find((capability) =>
    ['tool', 'mcp_server', 'integration'].includes(capability.kind) &&
    capability.status !== 'blocked' &&
    capability.status !== 'missing'
  )
  const buildWiki = findCapability(registry, 'brain_buildwiki')
  const approvalPolicyVisible = Boolean(registry.policies.gateway_bridge_session_write || registry.policies.bridge_session_required)

  return [
    eventFromCapability({
      registry,
      capability: telegram,
      kind: 'telegram_message',
      label: 'Telegram message received',
      source: 'telegram',
      target: 'gateway',
      route: 'gateway.event.telegram_message',
      fallbackBlocker: 'telegram_event_source_not_visible',
      visibleSummary: 'Owner Telegram messages are registered as Gateway events and route to Agent Zero.',
      missingSummary: 'Telegram event source is not visible in the Gateway registry.',
      requiresBridgeSession: false,
      writeEvent: false,
    }),
    eventFromCapability({
      registry,
      capability: agentMail,
      kind: 'email_received',
      label: 'Email received',
      source: 'agentmail',
      target: 'gateway',
      route: 'gateway.event.email_received',
      fallbackBlocker: 'agentmail_event_source_not_visible',
      visibleSummary: 'Incoming AgentMail is visible as read-only Gateway event metadata.',
      missingSummary: 'AgentMail incoming event source is not visible in the Gateway registry.',
      requiresBridgeSession: false,
      writeEvent: false,
    }),
    eventFromCapability({
      registry,
      capability: report,
      kind: 'report_generated',
      label: 'Report generated',
      source: 'mission_control_reports',
      target: 'gateway',
      route: 'gateway.event.report_generated',
      fallbackBlocker: 'report_event_source_not_visible',
      visibleSummary: 'Report generation is registered as a Gateway event source; delivery remains adapter-gated.',
      missingSummary: 'Report event source is not visible in the Gateway registry.',
      requiresBridgeSession: Boolean(report?.requires_session),
      writeEvent: true,
    }),
    makeEvent({
      registry,
      kind: 'approval_requested',
      label: 'Approval requested',
      source: 'bridge_session_policy',
      target: 'agent_zero',
      status: approvalPolicyVisible ? 'read_only' : 'blocked',
      route: 'gateway.event.approval_requested',
      summary: approvalPolicyVisible
        ? 'Bridge Session and protected-action approval requests are observable in Gateway policy events.'
        : 'Gateway approval policy is not visible.',
      requiresBridgeSession: false,
      writeEvent: false,
      blockers: approvalPolicyVisible ? [] : ['gateway_approval_policy_not_visible'],
    }),
    eventFromCapability({
      registry,
      capability: mcpTool,
      kind: 'tool_completed',
      label: 'Tool completed',
      source: mcpTool?.source_node || 'bridge_mcp',
      target: 'gateway',
      route: 'gateway.event.tool_completed',
      fallbackBlocker: 'tool_completion_event_source_not_visible',
      visibleSummary: 'Registered tool completions are observable after approved Bridge/MCP adapter execution.',
      missingSummary: 'No registered tool completion event source is visible in Gateway.',
      requiresBridgeSession: true,
      writeEvent: false,
    }),
    eventFromCapability({
      registry,
      capability: buildWiki,
      kind: 'sync_completed',
      label: 'Sync completed',
      source: 'buildwiki',
      target: 'brain',
      route: 'gateway.event.sync_completed',
      fallbackBlocker: 'buildwiki_sync_event_source_not_visible',
      visibleSummary: buildWiki
        ? `Build-Wiki/Farmer sync status is visible: ${detailString(buildWiki, 'last_run_status') || 'status available'}.`
        : 'Build-Wiki/Farmer sync event source is not visible.',
      missingSummary: 'Build-Wiki/Farmer sync event source is not visible.',
      requiresBridgeSession: true,
      writeEvent: false,
    }),
  ]
}

function eventFromCapability(input: {
  registry: GatewayRegistry
  capability: GatewayCapability | null | undefined
  kind: GatewayEventKind
  label: string
  source: string
  target: string
  route: string
  fallbackBlocker: string
  visibleSummary: string
  missingSummary: string
  requiresBridgeSession: boolean
  writeEvent: boolean
}): GatewayEventRecord {
  const blocked = !input.capability || input.capability.status === 'blocked' || input.capability.status === 'missing'
  return makeEvent({
    registry: input.registry,
    kind: input.kind,
    label: input.label,
    source: input.source,
    target: input.target,
    status: input.capability ? input.capability.status : 'blocked',
    route: input.route,
    summary: blocked ? input.missingSummary : input.visibleSummary,
    requiresBridgeSession: input.requiresBridgeSession,
    writeEvent: input.writeEvent,
    blockers: blocked
      ? blockersList(...(input.capability?.blockers || []), input.fallbackBlocker)
      : blockersList(...(input.capability?.blockers || [])),
  })
}

function makeEvent(input: {
  registry: GatewayRegistry
  kind: GatewayEventKind
  label: string
  source: string
  target: string
  status: GatewayStatus
  route: string
  summary: string
  requiresBridgeSession: boolean
  writeEvent: boolean
  blockers: string[]
}): GatewayEventRecord {
  return {
    id: gatewayEventId(`${input.kind}_${input.source}_${input.target}`),
    kind: input.kind,
    label: sanitizeText(input.label),
    source: gatewayEventId(input.source),
    target: gatewayEventId(input.target),
    status: input.blockers.length > 0 && input.status === 'connected' ? 'degraded' : input.status,
    occurred_at: input.registry.generated_at,
    route: input.route,
    summary: sanitizeText(input.summary),
    requires_bridge_session: input.requiresBridgeSession,
    write_event: input.writeEvent,
    blockers: blockersList(...input.blockers),
  }
}

function findCapability(registry: GatewayRegistry, id: string): GatewayCapability | null {
  const normalized = gatewayEventId(id)
  return registry.capabilities.find((capability) => capability.id === normalized) || null
}

function detailString(capability: GatewayCapability, key: string): string | null {
  const value = capability.status_details[key]
  if (value === null || value === undefined || value === false) return null
  const text = sanitizeText(String(value).trim())
  return text || null
}

function blockersList(...values: Array<string | null | undefined>): string[] {
  return values.map((value) => sanitizeText(String(value || '').trim())).filter(Boolean)
}

function sanitizeText(value: string): string {
  return value.replace(SECRETISH_PATTERN, '[redacted]').replace(RAW_PATH_PATTERN, '[path redacted]').trim()
}

function gatewayEventId(value: string): string {
  return sanitizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'gateway_event'
}
