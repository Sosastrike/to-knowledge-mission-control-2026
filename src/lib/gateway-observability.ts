import type { GatewayFlow, GatewayHealth, GatewayRegistry, GatewaySelectedRoute, GatewayStatus } from './gateway-model'
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
  node_health: Record<string, GatewayHealth>
  last_successful_route: GatewaySelectedRoute | null
  last_blocker: string | null
  failure_reason: string | null
  no_secrets_logging: GatewayFlow['no_secrets_logging']
  cost_tokens: number | null
  cost_usd: number | null
}

export type GatewayAuditRecord = {
  audit_id: string
  trace_id: string
  event: 'policy_decision' | 'execution_decision' | 'external_write_decision' | 'bridge_session_decision' | 'no_secrets_logging'
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
  node_health: Array<{
    node_id: string
    status: GatewayStatus
    summary: string
    score: number | null
    last_seen: string | null
  }>
  last_successful_route: GatewaySelectedRoute | null
  last_blocker: string | null
  audit_log: GatewayAuditRecord[]
  policy_decision_log: GatewayAuditRecord[]
  external_write_log: GatewayAuditRecord[]
  bridge_session_log: GatewayAuditRecord[]
  failure_reasons: Array<{ flow_id: string; reason: string }>
  no_secrets_logging: {
    enabled: true
    secrets_exposed: false
    records: GatewayAuditRecord[]
  }
  metrics: {
    route_count: number
    recorded_latency_count: number
    average_latency_ms: number | null
    health: {
      total_nodes: number
      by_status: Record<string, number>
      last_heartbeat: string | null
      per_node: Array<{
        node_id: string
        status: GatewayStatus
        summary: string
        score: number | null
        last_seen: string | null
      }>
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
  const policyExecutionLog = traces.flatMap((trace) => auditRecordsFromTrace(trace, registry.generated_at))
  const externalWriteLog = buildExternalWriteLog(traces, registry.generated_at)
  const bridgeSessionLog = buildBridgeSessionLog(traces, registry.generated_at)
  const noSecretsLog = buildNoSecretsLog(traces, registry.generated_at)
  const auditLog = [...policyExecutionLog, ...externalWriteLog, ...bridgeSessionLog, ...noSecretsLog]
  const nodeHealth = buildNodeHealth(registry)
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
    node_health: nodeHealth,
    last_successful_route: lastSuccessfulRoute(flows),
    last_blocker: lastBlocker(flows),
    audit_log: auditLog,
    policy_decision_log: policyExecutionLog.filter((record) => record.event === 'policy_decision'),
    external_write_log: externalWriteLog,
    bridge_session_log: bridgeSessionLog,
    failure_reasons: failureReasons(flows),
    no_secrets_logging: {
      enabled: true,
      secrets_exposed: false,
      records: noSecretsLog,
    },
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
    node_health: cloneTraceNodeHealth(flow.node_health),
    last_successful_route: flow.last_successful_route ? { ...flow.last_successful_route, hops: [...flow.last_successful_route.hops] } : null,
    last_blocker: sanitizeTextOrNull(flow.last_blocker),
    failure_reason: sanitizeTextOrNull(flow.failure_reason),
    no_secrets_logging: {
      ...flow.no_secrets_logging,
      protected_fields: [...flow.no_secrets_logging.protected_fields],
    },
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

function buildNodeHealth(registry: GatewayRegistry): GatewayObservabilityPayload['node_health'] {
  return registry.nodes.map((node) => ({
    node_id: gatewayObservabilityId(node.id),
    status: node.health.status,
    summary: sanitizeText(node.health.summary),
    score: node.health.score,
    last_seen: node.health.last_seen,
  }))
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
    per_node: buildNodeHealth(registry),
  }
}

function buildExternalWriteLog(traces: GatewayTraceRecord[], generatedAt: string): GatewayAuditRecord[] {
  return traces.map((trace) => ({
    audit_id: gatewayObservabilityId(`audit_${trace.trace_id}_external_write`),
    trace_id: trace.trace_id,
    event: 'external_write_decision',
    route_target: trace.target,
    status: trace.status,
    allowed: false,
    blocked_reason: trace.external_write ? trace.blocker || 'external_write_requires_bridge_session_scope' : null,
    external_write: trace.external_write,
    execution_enabled: false,
    recorded_at: generatedAt,
  }))
}

function buildBridgeSessionLog(traces: GatewayTraceRecord[], generatedAt: string): GatewayAuditRecord[] {
  return traces.map((trace) => {
    const requiresSession = trace.execution_decision === 'bridge_session_required'
    return {
      audit_id: gatewayObservabilityId(`audit_${trace.trace_id}_bridge_session`),
      trace_id: trace.trace_id,
      event: 'bridge_session_decision',
      route_target: trace.target,
      status: trace.status,
      allowed: !requiresSession,
      blocked_reason: requiresSession ? trace.blocker || 'bridge_session_required' : null,
      external_write: trace.external_write,
      execution_enabled: false,
      recorded_at: generatedAt,
    }
  })
}

function buildNoSecretsLog(traces: GatewayTraceRecord[], generatedAt: string): GatewayAuditRecord[] {
  return traces.map((trace) => ({
    audit_id: gatewayObservabilityId(`audit_${trace.trace_id}_no_secrets`),
    trace_id: trace.trace_id,
    event: 'no_secrets_logging',
    route_target: trace.target,
    status: trace.status,
    allowed: true,
    blocked_reason: null,
    external_write: false,
    execution_enabled: false,
    recorded_at: generatedAt,
  }))
}

function lastSuccessfulRoute(flows: GatewayFlow[]): GatewaySelectedRoute | null {
  for (const flow of [...flows].reverse()) {
    if (!flow.last_successful_route) continue
    return { ...flow.last_successful_route, hops: [...flow.last_successful_route.hops] }
  }
  return null
}

function lastBlocker(flows: GatewayFlow[]): string | null {
  for (const flow of [...flows].reverse()) {
    const blocker = sanitizeTextOrNull(flow.last_blocker || flow.failure_reason)
    if (blocker) return blocker
  }
  return null
}

function failureReasons(flows: GatewayFlow[]): Array<{ flow_id: string; reason: string }> {
  return flows
    .map((flow) => ({ flow_id: gatewayObservabilityId(flow.flow_id), reason: sanitizeTextOrNull(flow.failure_reason) }))
    .filter((item): item is { flow_id: string; reason: string } => Boolean(item.reason))
}

function cloneTraceNodeHealth(nodeHealth: Record<string, GatewayHealth>): Record<string, GatewayHealth> {
  return Object.fromEntries(
    Object.entries(nodeHealth).map(([nodeId, health]) => [gatewayObservabilityId(nodeId), { ...health, summary: sanitizeText(health.summary) }]),
  )
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
