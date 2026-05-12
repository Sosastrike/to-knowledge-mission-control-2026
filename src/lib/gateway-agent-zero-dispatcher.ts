import type { GatewayRegistry } from './gateway-model'
import type { GatewayRouteClassification } from './gateway-route-planner'
import { planGatewayRoute } from './gateway-route-planner'
import type { GatewayRouteDecision } from './gateway-policy'
import {
  buildCanonicalAgentRegistryPayload,
  getCanonicalAgentById,
  type CanonicalAgentRegistryPayloadEntry,
} from './canonical-agent-registry'

export type AgentZeroGatewayDispatchPlan = {
  ok: true
  mode: 'agent_zero_dispatcher_route_plan'
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
  requires_bridge_session: boolean
  policy_result: {
    route_decision: GatewayRouteDecision
    allowed: boolean
    requires_bridge_session: boolean
    blocked_reason: string | null
  }
  blocker: string | null
  rationale: string
  audit_event: AgentZeroDispatcherAuditEvent
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  dispatch_executed: false
  bridge_session_required_for_execution: true
  secrets_exposed: false
  raw_paths_exposed: false
}

export type AgentZeroDispatcherAuditEvent = {
  event: 'agent_zero.dispatcher.route_planned'
  route_target: string
  decision: GatewayRouteDecision
  blocked_reason: string | null
  agent_zero_in_route: boolean
  external_write: false
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
  recorded_at: string
}

export type AgentZeroDispatcherStatusPayload = {
  ok: true
  mode: 'agent_zero_dispatcher_status'
  generated_at: string
  agent_id: 'agent-zero'
  registry_node_id: 'agent_zero'
  canonical_agent_registry: CanonicalAgentRegistryPayloadEntry[]
  commander: true
  role: 'Commander'
  authority: 'final_commander'
  status: 'dispatcher_ready'
  route_or_service_checked: '/api/gateway/dispatcher/agent-zero'
  safe_probe: AgentZeroGatewayDispatchPlan
  audit_trail: AgentZeroDispatcherAuditEvent[]
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  dispatch_executed: false
  bridge_session_required_for_execution: true
  no_secrets_exposed: true
  raw_paths_exposed: false
  owner_visible_summary: string
}

export function planAgentZeroGatewayDispatch(
  registry: GatewayRegistry,
  input: { ownerRequest: string; generatedAt?: string },
): AgentZeroGatewayDispatchPlan {
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
  const auditEvent: AgentZeroDispatcherAuditEvent = {
    event: 'agent_zero.dispatcher.route_planned',
    route_target: plan.dispatch_target,
    decision: plan.route_decision,
    blocked_reason: plan.blocker,
    agent_zero_in_route: agentZeroInRoute,
    external_write: false,
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
    recorded_at: generatedAt,
  }

  return {
    ok: true,
    mode: 'agent_zero_dispatcher_route_plan',
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
    requires_bridge_session: plan.requires_bridge_session,
    policy_result: {
      route_decision: plan.route_decision,
      allowed: plan.policy_decision.allowed,
      requires_bridge_session: plan.policy_decision.bridge_session_required,
      blocked_reason: plan.blocker,
    },
    blocker: plan.blocker,
    rationale: plan.rationale,
    audit_event: auditEvent,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    dispatch_executed: false,
    bridge_session_required_for_execution: true,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

export function buildAgentZeroDispatcherStatusPayload(
  registry: GatewayRegistry,
  generatedAt = new Date().toISOString(),
): AgentZeroDispatcherStatusPayload {
  const agentZero = getCanonicalAgentById('agent-zero')
  const safeProbe = planAgentZeroGatewayDispatch(registry, {
    ownerRequest: 'Who is commander and what agents can you see?',
    generatedAt,
  })

  return {
    ok: true,
    mode: 'agent_zero_dispatcher_status',
    generated_at: generatedAt,
    agent_id: 'agent-zero',
    registry_node_id: 'agent_zero',
    canonical_agent_registry: buildCanonicalAgentRegistryPayload('authority'),
    commander: true,
    role: 'Commander',
    authority: 'final_commander',
    status: 'dispatcher_ready',
    route_or_service_checked: '/api/gateway/dispatcher/agent-zero',
    safe_probe: safeProbe,
    audit_trail: [safeProbe.audit_event],
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    dispatch_executed: false,
    bridge_session_required_for_execution: true,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    owner_visible_summary: `${agentZero?.name || 'Agent Zero'} is the final commander. Gateway dispatcher planning is read-only; protected execution still requires an owner-approved Bridge Session.`,
  }
}
