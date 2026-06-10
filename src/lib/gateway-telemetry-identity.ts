import type { GatewayGraphTopologyRouteGroup } from './gateway-graph-topology'

export type GatewayTelemetryIdentityConfidence = 'source_provided' | 'unresolved'

export type GatewayTelemetrySourceId =
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

export type GatewayCanonicalTelemetryIdentity = {
  canonical_agent_id: string
  canonical_node_id: string | null
  canonical_edge_id: string | null
  route_group: GatewayGraphTopologyRouteGroup | null
  telemetry_source_id: GatewayTelemetrySourceId
  aliases: string[]
  owner_operator?: boolean
  reason_when_unmapped?: string
}

export type GatewayTelemetryIdentityContract = {
  event_type: string
  source_system: string
  canonical_agent_id: string | null
  canonical_node_id: string | null
  canonical_edge_id: string | null
  route_group: GatewayGraphTopologyRouteGroup | null
  scope_id?: string | null
  confidence: GatewayTelemetryIdentityConfidence
  occurred_at?: string | null
  source_runtime?: string | null
  config_target?: string | null
  safe_event_summary?: string | null
  reason?: string | null
}

export const GATEWAY_CANONICAL_TELEMETRY_IDENTITIES: GatewayCanonicalTelemetryIdentity[] = [
  {
    canonical_agent_id: 'agent.zero',
    canonical_node_id: 'agent.zero',
    canonical_edge_id: 'highway.inputs.agent.zero',
    route_group: 'inputs',
    telemetry_source_id: 'agent_request_events',
    aliases: ['agent.zero', 'agent zero', 'agent-zero', 'agent_zero', 'agentzero', 'jarvis', 'jarvis88', 'zero'],
  },
  {
    canonical_agent_id: 'brain.gbrain',
    canonical_node_id: 'brain.gbrain',
    canonical_edge_id: 'highway.knowledge.brain.gbrain',
    route_group: 'knowledge',
    telemetry_source_id: 'knowledge_runtime_events',
    aliases: ['brain.gbrain', 'gbrain', 'g-brain', 'g_brain', 'google brain'],
  },
  {
    canonical_agent_id: 'agent.pi',
    canonical_node_id: null,
    canonical_edge_id: null,
    route_group: 'inputs',
    telemetry_source_id: 'agent_request_events',
    aliases: ['agent.pi', 'pi', 'pi-88', 'pi88'],
    reason_when_unmapped: 'agent_pi_not_present_in_gateway_topology',
  },
  {
    canonical_agent_id: 'gateway.dispatcher',
    canonical_node_id: 'gateway.core',
    canonical_edge_id: null,
    route_group: null,
    telemetry_source_id: 'gateway_event_bus',
    aliases: ['gateway.dispatcher', 'gateway core', 'gateway.core', 'dispatcher', 'gateway'],
    reason_when_unmapped: 'dispatcher_identity_is_topology_hub_not_agent_edge',
  },
  {
    canonical_agent_id: 'opencloud.octm',
    canonical_node_id: 'oc.parent',
    canonical_edge_id: 'highway.models.oc.parent',
    route_group: 'models',
    telemetry_source_id: 'knowledge_runtime_events',
    aliases: ['opencloud.octm', 'opencloud', 'octm', 'opencloud workers', 'oc.parent'],
  },
  {
    canonical_agent_id: 'openclaw.runtime',
    canonical_node_id: 'model.openclawplus',
    canonical_edge_id: 'highway.models.model.openclawplus',
    route_group: 'models',
    telemetry_source_id: 'agent_request_events',
    aliases: ['openclaw.runtime', 'openclaw+', 'openclawplus', 'model.openclawplus', 'openclaw runtime'],
  },
  {
    canonical_agent_id: 'mini_agents.runtime',
    canonical_node_id: 'model.miniagents',
    canonical_edge_id: 'highway.models.model.miniagents',
    route_group: 'models',
    telemetry_source_id: 'agent_request_events',
    aliases: ['mini_agents.runtime', 'mini-agents', 'mini agents', 'miniagents', 'model.miniagents'],
  },
  {
    canonical_agent_id: 'owner.tony',
    canonical_node_id: 'input.owner',
    canonical_edge_id: null,
    route_group: 'inputs',
    telemetry_source_id: 'gateway_event_bus',
    aliases: ['owner.tony', 'tony', 'owner', 'sosastrike'],
    owner_operator: true,
    reason_when_unmapped: 'owner_operator_identity_outside_gateway_agent_edges',
  },
  {
    canonical_agent_id: 'zapier.runtime',
    canonical_node_id: 'int.zapier',
    canonical_edge_id: 'highway.zapier.int.zapier',
    route_group: 'zapier',
    telemetry_source_id: 'zapier_discovery_events',
    aliases: ['zapier.runtime', 'zapier', 'int.zapier'],
  },
  {
    canonical_agent_id: 'agentmail.runtime',
    canonical_node_id: 'int.agentmail',
    canonical_edge_id: 'highway.agentmail.int.agentmail',
    route_group: 'agentmail',
    telemetry_source_id: 'agentmail_events',
    aliases: ['agentmail.runtime', 'agentmail', 'int.agentmail'],
  },
  {
    canonical_agent_id: 'buildwiki.runtime',
    canonical_node_id: 'brain.buildwiki',
    canonical_edge_id: 'highway.knowledge.brain.buildwiki',
    route_group: 'knowledge',
    telemetry_source_id: 'knowledge_runtime_events',
    aliases: ['buildwiki.runtime', 'buildwiki', 'build-wiki', 'build wiki', 'brain.buildwiki', 'opencloud docs farmer'],
  },
]

export function normalizeGatewayTelemetryIdentityAlias(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/@agentmail\.to\b/g, '')
    .replace(/[^\w.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findCanonicalGatewayTelemetryIdentity(candidates: unknown[]): GatewayCanonicalTelemetryIdentity | null {
  for (const candidate of candidates) {
    const normalized = normalizeGatewayTelemetryIdentityAlias(candidate)
    if (!normalized) continue
    for (const identity of GATEWAY_CANONICAL_TELEMETRY_IDENTITIES) {
      const aliases = [identity.canonical_agent_id, identity.canonical_node_id, identity.canonical_edge_id, ...identity.aliases]
        .filter(Boolean)
        .map(normalizeGatewayTelemetryIdentityAlias)
      if (aliases.some((alias) => alias && normalized === alias)) return identity
    }
  }
  return null
}

export function buildAgentConfigSyncIdentityContract(input: {
  openclawAgent?: {
    id?: string
    name?: string
    identity?: { name?: string; theme?: string }
    model?: { primary?: string }
  } | null
  agentName?: string | null
  action?: string | null
  occurredAt?: string | null
  sourceRuntime?: string | null
}): GatewayTelemetryIdentityContract {
  const candidates = [
    input.openclawAgent?.id,
    input.openclawAgent?.name,
    input.openclawAgent?.identity?.name,
    input.agentName,
  ]
  const identity = findCanonicalGatewayTelemetryIdentity(candidates)
  if (!identity) {
    return {
      event_type: 'agent_config_sync',
      source_system: 'agent_config',
      canonical_agent_id: null,
      canonical_node_id: null,
      canonical_edge_id: null,
      route_group: null,
      scope_id: null,
      confidence: 'unresolved',
      occurred_at: input.occurredAt || null,
      source_runtime: input.sourceRuntime || 'gateway_agent_sync',
      config_target: input.openclawAgent?.id ? `openclaw.agent:${input.openclawAgent.id}` : 'openclaw.agent:unknown',
      safe_event_summary: `agent_config_sync:${input.action || 'changed'}`,
      reason: 'canonical_identity_missing',
    }
  }

  return {
    event_type: 'agent_config_sync',
    source_system: 'agent_config',
    canonical_agent_id: identity.canonical_agent_id,
    canonical_node_id: identity.canonical_node_id,
    canonical_edge_id: identity.canonical_edge_id,
    route_group: identity.route_group,
    scope_id: null,
    confidence: 'source_provided',
    occurred_at: input.occurredAt || null,
    source_runtime: input.sourceRuntime || 'gateway_agent_sync',
    config_target: input.openclawAgent?.id ? `openclaw.agent:${input.openclawAgent.id}` : `openclaw.agent:${identity.canonical_agent_id}`,
    safe_event_summary: `agent_config_sync:${input.action || 'changed'}`,
    reason: identity.canonical_edge_id
      ? 'source_provided_canonical_identity'
      : identity.reason_when_unmapped || 'source_provided_identity_without_gateway_edge',
  }
}
