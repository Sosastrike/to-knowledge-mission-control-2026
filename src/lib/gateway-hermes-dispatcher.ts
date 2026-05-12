import type { GatewayRegistry } from './gateway-model'
import type { GatewayRouteClassification } from './gateway-route-planner'
import { planGatewayRoute } from './gateway-route-planner'
import type { GatewayRouteDecision } from './gateway-policy'
import type { MissionControlCanonicalStatus, MissionControlClosureBlockerClass } from './agent-zero-bridge'
import {
  buildCanonicalAgentRegistryPayload,
  type CanonicalAgentRegistryPayloadEntry,
} from './canonical-agent-registry'

export type HermesGatewayDispatchPlan = {
  ok: true
  mode: 'hermes_dispatcher_route_plan'
  generated_at: string
  owner_request: string
  classification: GatewayRouteClassification
  route: {
    primary_target: string
    dispatch_target: string
    via: string[]
    final_commander: 'agent_zero'
  }
  agent_zero_in_route: boolean
  hermes_in_route: boolean
  requires_bridge_session: boolean
  policy_result: {
    route_decision: GatewayRouteDecision
    allowed: boolean
    requires_bridge_session: boolean
    blocked_reason: string | null
  }
  blocker: string | null
  rationale: string
  audit_event: HermesDispatcherAuditEvent
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  live_adapter_status: 'blocked_safe_live_chat_adapter_not_configured'
  hermes_called: false
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  dispatch_executed: false
  bridge_session_required_for_execution: true
  secrets_exposed: false
  raw_paths_exposed: false
}

export type HermesDispatcherAuditEvent = {
  event: 'hermes.dispatcher.route_planned'
  route_target: string
  decision: GatewayRouteDecision
  blocked_reason: string | null
  agent_zero_in_route: boolean
  hermes_in_route: boolean
  hermes_called: false
  external_write: false
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
  recorded_at: string
}

export type HermesDispatcherStatusPayload = {
  ok: true
  mode: 'hermes_dispatcher_status'
  generated_at: string
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  blocker: 'hermes_safe_live_chat_adapter_not_configured'
  node_id: 'hermes'
  agent_hub_id: 'hermes'
  canonical_gateway_node: 'hermes'
  canonical_agent_registry: CanonicalAgentRegistryPayloadEntry[]
  role: 'lieutenant / skill and workflow specialist'
  authority: 'lieutenant_read_only'
  commander: false
  agent_zero_is_commander: true
  status: 'blocked_safe_live_chat_adapter_not_configured'
  live_adapter_status: 'blocked_safe_live_chat_adapter_not_configured'
  status_endpoint: '/api/bridge/hermes/status'
  test_chat_endpoint: '/api/bridge/hermes/test-chat'
  route_or_service_checked: '/api/gateway/dispatcher/hermes'
  safe_probe: HermesGatewayDispatchPlan
  audit_trail: HermesDispatcherAuditEvent[]
  hermes_called: false
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  dispatch_executed: false
  bridge_session_required_for_execution: true
  no_secrets_exposed: true
  raw_paths_exposed: false
  owner_visible_summary: string
}

const HERMES_ADAPTER_BLOCKER = 'hermes_safe_live_chat_adapter_not_configured' as const
const HERMES_LIVE_ADAPTER_STATUS = 'blocked_safe_live_chat_adapter_not_configured' as const

export function planHermesGatewayDispatch(
  registry: GatewayRegistry,
  input: { ownerRequest: string; generatedAt?: string },
): HermesGatewayDispatchPlan {
  const generatedAt = input.generatedAt || registry.generated_at
  const plan = planGatewayRoute(registry, {
    ownerRequest: input.ownerRequest,
    source: 'owner',
    generatedAt,
  })
  const routeVia = Array.from(new Set(plan.route_via))
  const agentZeroInRoute = plan.primary_target === 'agent_zero' ||
    plan.dispatch_target === 'agent_zero' ||
    routeVia.includes('agent_zero')
  const hermesInRoute = plan.dispatch_target === 'hermes' || routeVia.includes('hermes')
  const blocker = hermesInRoute ? HERMES_ADAPTER_BLOCKER : 'hermes_not_selected_for_this_request'
  const auditEvent: HermesDispatcherAuditEvent = {
    event: 'hermes.dispatcher.route_planned',
    route_target: plan.dispatch_target,
    decision: plan.route_decision,
    blocked_reason: blocker,
    agent_zero_in_route: agentZeroInRoute,
    hermes_in_route: hermesInRoute,
    hermes_called: false,
    external_write: false,
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
    recorded_at: generatedAt,
  }

  return {
    ok: true,
    mode: 'hermes_dispatcher_route_plan',
    generated_at: generatedAt,
    owner_request: plan.flow.request.prompt || '',
    classification: plan.classification,
    route: {
      primary_target: plan.primary_target,
      dispatch_target: plan.dispatch_target,
      via: routeVia,
      final_commander: 'agent_zero',
    },
    agent_zero_in_route: agentZeroInRoute,
    hermes_in_route: hermesInRoute,
    requires_bridge_session: plan.requires_bridge_session,
    policy_result: {
      route_decision: plan.route_decision,
      allowed: plan.policy_decision.allowed,
      requires_bridge_session: plan.policy_decision.bridge_session_required,
      blocked_reason: plan.blocker,
    },
    blocker,
    rationale: hermesInRoute
      ? `${plan.rationale} Hermes live chat remains blocked until the safe no-tool/no-write adapter is configured and proven.`
      : 'Hermes was not selected for this owner request; Agent Zero remains final commander.',
    audit_event: auditEvent,
    canonical_status: 'BLOCKED',
    blocker_class: 'BLOCKED',
    live_adapter_status: HERMES_LIVE_ADAPTER_STATUS,
    hermes_called: false,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    dispatch_executed: false,
    bridge_session_required_for_execution: true,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

export function buildHermesDispatcherStatusPayload(
  registry: GatewayRegistry,
  generatedAt = new Date().toISOString(),
): HermesDispatcherStatusPayload {
  const safeProbe = planHermesGatewayDispatch(registry, {
    ownerRequest: 'Design a workflow skill for owner approval.',
    generatedAt,
  })

  return {
    ok: true,
    mode: 'hermes_dispatcher_status',
    generated_at: generatedAt,
    canonical_status: 'BLOCKED',
    blocker_class: 'BLOCKED',
    blocker: HERMES_ADAPTER_BLOCKER,
    node_id: 'hermes',
    agent_hub_id: 'hermes',
    canonical_gateway_node: 'hermes',
    canonical_agent_registry: buildCanonicalAgentRegistryPayload('authority'),
    role: 'lieutenant / skill and workflow specialist',
    authority: 'lieutenant_read_only',
    commander: false,
    agent_zero_is_commander: true,
    status: HERMES_LIVE_ADAPTER_STATUS,
    live_adapter_status: HERMES_LIVE_ADAPTER_STATUS,
    status_endpoint: '/api/bridge/hermes/status',
    test_chat_endpoint: '/api/bridge/hermes/test-chat',
    route_or_service_checked: '/api/gateway/dispatcher/hermes',
    safe_probe: safeProbe,
    audit_trail: [safeProbe.audit_event],
    hermes_called: false,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    dispatch_executed: false,
    bridge_session_required_for_execution: true,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    owner_visible_summary: 'Hermes is Agent Zero lieutenant for skills and workflow design. Live Hermes chat remains blocked until the safe no-tool/no-write adapter is configured and proven.',
  }
}
