import type { GatewayFlow, GatewayRegistry, GatewayStatus } from './gateway-model'
import { buildGatewayFlowsPayload } from './gateway-registry-api'
import { planGatewayRoute, type GatewayRoutePlan } from './gateway-route-planner'

export type GatewayTraceRecord = {
  trace_id: string
  source: string
  gateway: 'gateway'
  target: string
  route: string[]
  status: GatewayStatus
  result_summary: string
  blocker: string | null
  policy_decision: string
  execution_decision: 'read_only' | 'blocked' | 'bridge_session_required' | 'execution_enabled'
  duration_ms: number | null
  duration_source: 'recorded' | 'not_recorded' | 'replay_measurement'
  external_write: boolean
  cost_tokens: number | null
  cost_usd: number | null
}

export type GatewayAuditRecord = {
  audit_id: string
  trace_id: string
  event: 'policy_decision' | 'execution_decision'
  route_target: string
  status: GatewayStatus
  allowed: boolean
  blocked_reason: string | null
  external_write: boolean
  execution_enabled: false
  recorded_at: string
}

export type GatewayObservabilityPayload = {
  ok: true
  mode: 'gateway_observability_read_only'
  generated_at: string
  traces: GatewayTraceRecord[]
  audit_log: GatewayAuditRecord[]
  metrics: {
    route_count: number
    recorded_latency_count: number
    average_latency_ms: number | null
    health: {
      total_nodes: number
      by_status: Record<string, number>
      last_heartbeat: string | null
    }
    blockers: Array<{ reason: string; count: number }>
    external_writes: {
      tracked: number
      allowed_after_session: number
      blocked_without_session: number
      execution_enabled: false
    }
    llm_usage: Array<{
      provider: string
      status: GatewayStatus
      usage_available: boolean
      total_tokens: number | null
      cost_usd: number | null
    }>
  }
  replay_safe_mode: {
    enabled: true
    route: '/api/gateway/replay'
    plan_only: true
    execution_enabled: false
    writes_enabled: false
  }
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
}

export type GatewayReplayPayload = {
  ok: true
  mode: 'gateway_route_replay_safe_mode'
  generated_at: string
  replay_safe_mode: true
  request: string
  plan: GatewayRoutePlan
  trace: GatewayTraceRecord
  audit_log: GatewayAuditRecord[]
  execution_enabled: false
  writes_enabled: false
  external_write_executed: false
  secrets_exposed: false
}

const SECRETISH_PATTERN =
  /(sk-[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*(?:=\s*[^,\s}]+|:\s+[^,\s}]+))/gi
const RAW_PATH_PATTERN = /(?:\/home\/tony|\/a0\/(?:usr|tmp|var)|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi

export function buildGatewayObservabilityPayload(registry: GatewayRegistry): GatewayObservabilityPayload {
  const flows = buildGatewayFlowsPayload(registry).flows
  const traces = flows.map((flow) => traceFromFlow(flow))
  const auditLog = traces.flatMap((trace) => auditRecordsFromTrace(trace, registry.generated_at))
  const recordedDurations = traces
    .map((trace) => trace.duration_ms)
    .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration))
  const averageLatency = recordedDurations.length > 0
    ? Math.round(recordedDurations.reduce((total, value) => total + value, 0) / recordedDurations.length)
    : null

  return {
    ok: true,
    mode: 'gateway_observability_read_only',
    generated_at: registry.generated_at,
    traces,
    audit_log: auditLog,
    metrics: {
      route_count: traces.length,
      recorded_latency_count: recordedDurations.length,
      average_latency_ms: averageLatency,
      health: buildHealthMetrics(registry),
      blockers: buildBlockerMetrics(registry, traces),
      external_writes: buildExternalWriteMetrics(traces),
      llm_usage: buildLlmUsagePlaceholders(registry),
    },
    replay_safe_mode: {
      enabled: true,
      route: '/api/gateway/replay',
      plan_only: true,
      execution_enabled: false,
      writes_enabled: false,
    },
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
  }
}

export function replayGatewayRoute(registry: GatewayRegistry, ownerRequest: string): GatewayReplayPayload {
  const started = Date.now()
  const request = sanitizeText(ownerRequest).slice(0, 500)
  const plan = planGatewayRoute(registry, { ownerRequest: request, generatedAt: registry.generated_at })
  const durationMs = Math.max(0, Date.now() - started)
  const trace = traceFromFlow(plan.flow, {
    durationMs,
    durationSource: 'replay_measurement',
    policyDecision: plan.policy_decision.route_decision,
    executionDecision: plan.blocked
      ? 'blocked'
      : plan.requires_bridge_session
        ? 'bridge_session_required'
        : 'read_only',
  })
  return {
    ok: true,
    mode: 'gateway_route_replay_safe_mode',
    generated_at: registry.generated_at,
    replay_safe_mode: true,
    request,
    plan,
    trace,
    audit_log: auditRecordsFromTrace(trace, registry.generated_at),
    execution_enabled: false,
    writes_enabled: false,
    external_write_executed: false,
    secrets_exposed: false,
  }
}

function traceFromFlow(
  flow: GatewayFlow,
  options: {
    durationMs?: number | null
    durationSource?: GatewayTraceRecord['duration_source']
    policyDecision?: string
    executionDecision?: GatewayTraceRecord['execution_decision']
  } = {},
): GatewayTraceRecord {
  const executionDecision = options.executionDecision ||
    (flow.execution_mode === 'blocked'
      ? 'blocked'
      : flow.execution_mode === 'bridge_session'
        ? 'bridge_session_required'
        : flow.execution_mode === 'execution_enabled'
          ? 'execution_enabled'
          : 'read_only')
  return {
    trace_id: gatewayObservabilityId(`trace_${flow.flow_id}`),
    source: gatewayObservabilityId(flow.request.source || flow.route.source),
    gateway: 'gateway',
    target: gatewayObservabilityId(flow.route.target || flow.request.target),
    route: flow.route.hops.map(gatewayObservabilityId),
    status: flow.result.status,
    result_summary: sanitizeText(flow.result.summary),
    blocker: sanitizeTextOrNull(flow.result.blocker),
    policy_decision: options.policyDecision || (flow.policy.bridge_session_required ? 'session_required' : 'read_only'),
    execution_decision: executionDecision,
    duration_ms: options.durationMs ?? null,
    duration_source: options.durationSource || 'not_recorded',
    external_write: Boolean(flow.audit.external_write),
    cost_tokens: null,
    cost_usd: null,
  }
}

function auditRecordsFromTrace(trace: GatewayTraceRecord, generatedAt: string): GatewayAuditRecord[] {
  return [
    {
      audit_id: gatewayObservabilityId(`audit_${trace.trace_id}_policy`),
      trace_id: trace.trace_id,
      event: 'policy_decision',
      route_target: trace.target,
      status: trace.status,
      allowed: trace.status !== 'blocked' && trace.status !== 'missing',
      blocked_reason: trace.blocker,
      external_write: trace.external_write,
      execution_enabled: false,
      recorded_at: generatedAt,
    },
    {
      audit_id: gatewayObservabilityId(`audit_${trace.trace_id}_execution`),
      trace_id: trace.trace_id,
      event: 'execution_decision',
      route_target: trace.target,
      status: trace.execution_decision === 'blocked' ? 'blocked' : trace.status,
      allowed: trace.execution_decision !== 'blocked' && trace.execution_decision !== 'execution_enabled',
      blocked_reason: trace.execution_decision === 'blocked' ? trace.blocker : null,
      external_write: trace.external_write,
      execution_enabled: false,
      recorded_at: generatedAt,
    },
  ]
}

function buildHealthMetrics(registry: GatewayRegistry): GatewayObservabilityPayload['metrics']['health'] {
  const byStatus = registry.nodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.status] = (acc[node.status] || 0) + 1
    return acc
  }, {})
  const lastHeartbeat = registry.nodes
    .map((node) => node.health.last_seen)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || null
  return {
    total_nodes: registry.nodes.length,
    by_status: byStatus,
    last_heartbeat: lastHeartbeat,
  }
}

function buildBlockerMetrics(registry: GatewayRegistry, traces: GatewayTraceRecord[]): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>()
  for (const blocker of [
    ...registry.nodes.flatMap((node) => node.blockers),
    ...registry.capabilities.flatMap((capability) => capability.blockers),
    ...traces.map((trace) => trace.blocker).filter((value): value is string => Boolean(value)),
  ]) {
    const reason = sanitizeText(blocker)
    if (!reason) continue
    counts.set(reason, (counts.get(reason) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([reason, count]) => ({ reason, count }))
}

function buildExternalWriteMetrics(traces: GatewayTraceRecord[]): GatewayObservabilityPayload['metrics']['external_writes'] {
  const tracked = traces.filter((trace) => trace.external_write || trace.execution_decision === 'bridge_session_required').length
  const blockedWithoutSession = traces.filter((trace) =>
    trace.execution_decision === 'blocked' &&
    /bridge_session|external_write|protected_action|write/.test(trace.blocker || ''),
  ).length
  return {
    tracked,
    allowed_after_session: 0,
    blocked_without_session: blockedWithoutSession,
    execution_enabled: false,
  }
}

function buildLlmUsagePlaceholders(registry: GatewayRegistry): GatewayObservabilityPayload['metrics']['llm_usage'] {
  return registry.capabilities
    .filter((capability) => capability.kind === 'model')
    .map((capability) => ({
      provider: capability.id.replace(/^model_/, ''),
      status: capability.status,
      usage_available: false,
      total_tokens: null,
      cost_usd: null,
    }))
}

function sanitizeTextOrNull(value: string | null | undefined): string | null {
  const text = sanitizeText(String(value || '').trim())
  return text || null
}

function sanitizeText(value: string): string {
  return value.replace(SECRETISH_PATTERN, '[redacted]').replace(RAW_PATH_PATTERN, '[path redacted]').trim()
}

function gatewayObservabilityId(value: string): string {
  return sanitizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'gateway_observability'
}
