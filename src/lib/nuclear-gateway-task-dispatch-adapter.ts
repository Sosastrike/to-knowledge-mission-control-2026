import {
  buildAgentMessageEnvelope,
  resolveAgentRoutingLine,
  routeTraceForLine,
  type AgentMessageEnvelope,
} from '@/lib/agent-routing-lines'
import { createHash } from 'node:crypto'
import { logAuditEvent } from '@/lib/db'
import {
  buildAgentLineTraceLive,
  externalAgentReceiveTraceSources,
  hasExternalAgentReceiveProof,
} from '@/lib/agent-line-trace'
import { isOpenCloudIdentity } from '@/lib/opencloud-authority-policy'

export const NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTER_PHASE = 'phase_6_task_dispatch_adapter_contract' as const

export type NuclearGatewayTaskDispatchKind =
  | 'task_dispatch_new_session'
  | 'task_dispatch_target_session'
  | 'aegis_review'
  | 'task_broadcast'

export type NuclearGatewayTaskDispatchAdapter = {
  id: NuclearGatewayTaskDispatchKind
  label: string
  legacy_dependency: string
  nuclear_gateway_adapter: string
  route: string
  direct_line_required: true
  message_envelope_required: true
  visible_task_required: true
  audit_required: true
  rollback_required: true
  bridge_session_required: true
  jarvis_concurrence_required: true
  openclaw_allowed_role: 'not_allowed'
  opencloud_allowed_role: 'not_allowed'
  openclaw_hidden_intermediary_allowed: false
  conversation_owner_must_equal_target: true
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  credential_values_exposed: false
  status: 'SOURCE_READY_EXECUTION_BLOCKED'
  blocker: string
}

export type NuclearGatewayTaskDispatchPreviewInput = {
  dispatch_kind?: NuclearGatewayTaskDispatchKind | string | null
  task_id?: string | number | null
  target_agent?: string | null
  message?: string | null
  source_channel?: string | null
  target_session?: string | null
  visible_task_id?: string | number | null
  receive_trace_nonce?: string | null
  receive_trace_agent?: string | null
}

export type NuclearGatewayTaskDispatchPreview = {
  ok: boolean
  route: 'bridge.nuclear-gateway.task-dispatch-adapter.preview'
  phase: typeof NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTER_PHASE
  exact_blocker: string | null
  dispatch_kind: NuclearGatewayTaskDispatchKind | null
  task_id: string | null
  target_session: string | null
  target_agent: string | null
  conversation_owner: string | null
  direct_line_used: boolean
  route_trace: string[]
  envelope_preview: AgentMessageEnvelope | null
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  openclaw_used: false
  openclaw_hidden_intermediary_allowed: false
  credential_values_exposed: false
  no_secrets_exposed: true
  required_next_proof: string[]
  receive_trace_proof?: {
    status: 'PASS' | 'MISSING' | 'FAIL'
    nonce: string | null
    target_agent: string | null
    direct_line_used: boolean
    message_received_by_agent: boolean
    response_sent: boolean
    openclaw_used: boolean
    local_gateway_probe: boolean
    external_receive_verified: boolean
    verification_sources: string[]
    blocker: string | null
    raw_message_body_exposed: false
  }
  audit_preview?: {
    action: 'nuclear_gateway.task_dispatch.preview'
    actor: 'nuclear-gateway'
    target_type: 'direct_agent_line'
    target: string
    payload_values_exposed: false
    audit_write_required_before_execution: true
  }
  rollback_or_no_state_proof?: {
    proof_type: 'NO_STATE_PREVIEW_ONLY'
    no_runtime_mutation: true
    no_external_write: true
    rollback_required: false
    rollback_ref: 'no_state_preview_only'
  }
  audit_write_proof?: {
    audit_written: true
    action: 'nuclear_gateway.task_dispatch.preview'
    raw_message_body_exposed: false
    credential_values_exposed: false
  }
}

function adapter(input: Omit<NuclearGatewayTaskDispatchAdapter,
  | 'direct_line_required'
  | 'message_envelope_required'
  | 'visible_task_required'
  | 'audit_required'
  | 'rollback_required'
  | 'bridge_session_required'
  | 'jarvis_concurrence_required'
  | 'openclaw_allowed_role'
  | 'opencloud_allowed_role'
  | 'openclaw_hidden_intermediary_allowed'
  | 'conversation_owner_must_equal_target'
  | 'execution_enabled'
  | 'writes_enabled'
  | 'external_writes_enabled'
  | 'credential_values_exposed'
  | 'status'
>): NuclearGatewayTaskDispatchAdapter {
  return {
    ...input,
    direct_line_required: true,
    message_envelope_required: true,
    visible_task_required: true,
    audit_required: true,
    rollback_required: true,
    bridge_session_required: true,
    jarvis_concurrence_required: true,
    openclaw_allowed_role: 'not_allowed',
    opencloud_allowed_role: 'not_allowed',
    openclaw_hidden_intermediary_allowed: false,
    conversation_owner_must_equal_target: true,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    credential_values_exposed: false,
    status: 'SOURCE_READY_EXECUTION_BLOCKED',
  }
}

export const NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTERS: NuclearGatewayTaskDispatchAdapter[] = [
  adapter({
    id: 'task_dispatch_new_session',
    label: 'Task dispatch to a new direct agent line session',
    legacy_dependency: 'src/lib/task-dispatch.ts: runOpenClaw gateway call agent --expect-final',
    nuclear_gateway_adapter: 'direct_agent_line.task_dispatch.new_session',
    route: '/api/bridge/agent-routing/send',
    blocker: 'direct_line_task_dispatch_live_receive_proof_required',
  }),
  adapter({
    id: 'task_dispatch_target_session',
    label: 'Task dispatch to an existing target session',
    legacy_dependency: 'src/lib/task-dispatch.ts: callOpenClawGateway chat.send when metadata.target_session exists',
    nuclear_gateway_adapter: 'direct_agent_line.task_dispatch.target_session',
    route: '/api/bridge/agent-routing/send',
    blocker: 'target_session_direct_line_handoff_live_proof_required',
  }),
  adapter({
    id: 'aegis_review',
    label: 'Aegis quality review direct-line adapter',
    legacy_dependency: 'src/lib/task-dispatch.ts: runOpenClaw gateway call agent for Aegis review',
    nuclear_gateway_adapter: 'certified_adapter.task_review.aegis',
    route: '/api/bridge/agent-routing/send',
    blocker: 'aegis_review_direct_line_adapter_live_proof_required',
  }),
  adapter({
    id: 'task_broadcast',
    label: 'Task broadcast direct-line fanout adapter',
    legacy_dependency: 'src/app/api/tasks/[id]/broadcast/route.ts: runOpenClaw sessions_send',
    nuclear_gateway_adapter: 'certified_adapter.task_broadcast.direct_line',
    route: '/api/bridge/agent-routing/send',
    blocker: 'task_broadcast_direct_line_fanout_live_proof_required',
  }),
]

function normalizeKind(value: unknown): NuclearGatewayTaskDispatchKind | null {
  const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_')
  return NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTERS.some((item) => item.id === normalized)
    ? normalized as NuclearGatewayTaskDispatchKind
    : null
}

function auditPreview(target: string) {
  return {
    action: 'nuclear_gateway.task_dispatch.preview' as const,
    actor: 'nuclear-gateway' as const,
    target_type: 'direct_agent_line' as const,
    target,
    payload_values_exposed: false as const,
    audit_write_required_before_execution: true as const,
  }
}

function noStatePreviewProof() {
  return {
    proof_type: 'NO_STATE_PREVIEW_ONLY' as const,
    no_runtime_mutation: true as const,
    no_external_write: true as const,
    rollback_required: false as const,
    rollback_ref: 'no_state_preview_only' as const,
  }
}

function messageHash(value: unknown) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16)
}

function receiveTraceProof(targetAgent: string, input: NuclearGatewayTaskDispatchPreviewInput) {
  const nonce = String(input.receive_trace_nonce || '').trim()
  if (!nonce) {
    return {
      status: 'MISSING' as const,
      nonce: null,
      target_agent: targetAgent || null,
      direct_line_used: false,
      message_received_by_agent: false,
      response_sent: false,
      openclaw_used: false,
      local_gateway_probe: false,
      external_receive_verified: false,
      verification_sources: [],
      blocker: 'receive_trace_nonce_required',
      raw_message_body_exposed: false as const,
    }
  }

  const live = buildAgentLineTraceLive({
    agent: input.receive_trace_agent || targetAgent,
    nonce,
  })
  const record = live.traces[0]
  if (!record) {
    return {
      status: 'MISSING' as const,
      nonce,
      target_agent: targetAgent || null,
      direct_line_used: false,
      message_received_by_agent: false,
      response_sent: false,
      openclaw_used: false,
      local_gateway_probe: false,
      external_receive_verified: false,
      verification_sources: [],
      blocker: 'receive_trace_record_not_found',
      raw_message_body_exposed: false as const,
    }
  }

  const externalSources = externalAgentReceiveTraceSources(record.verification_sources)
  const externalReceiveVerified = hasExternalAgentReceiveProof(record)
  const valid = record.target_agent === targetAgent && externalReceiveVerified

  return {
    status: valid ? 'PASS' as const : 'FAIL' as const,
    nonce: record.nonce,
    target_agent: record.target_agent,
    direct_line_used: record.direct_line_used,
    message_received_by_agent: record.message_received_by_agent,
    response_sent: record.response_sent,
    openclaw_used: record.openclaw_used,
    local_gateway_probe: record.local_gateway_probe,
    external_receive_verified: externalReceiveVerified,
    verification_sources: externalSources,
    blocker: valid ? null : record.blocker || (externalReceiveVerified ? 'receive_trace_not_live_external_pass' : 'receive_trace_external_verification_source_required'),
    raw_message_body_exposed: false as const,
  }
}

export function writeNuclearGatewayTaskDispatchPreviewAudit(
  preview: NuclearGatewayTaskDispatchPreview,
  input: NuclearGatewayTaskDispatchPreviewInput = {},
) {
  if (!preview.ok || !preview.audit_preview) return null

  logAuditEvent({
    action: preview.audit_preview.action,
    actor: preview.audit_preview.actor,
    target_type: preview.audit_preview.target_type,
    detail: {
      phase: preview.phase,
      dispatch_kind: preview.dispatch_kind,
      task_id: preview.task_id,
      visible_task_id: input.visible_task_id == null ? null : String(input.visible_task_id),
      target_session_present: Boolean(preview.target_session),
      target_agent: preview.target_agent,
      conversation_owner: preview.conversation_owner,
      direct_line_used: preview.direct_line_used,
      route_trace: preview.route_trace,
      message_hash: messageHash(input.message),
      execution_enabled: preview.execution_enabled,
      writes_enabled: preview.writes_enabled,
      external_writes_enabled: preview.external_writes_enabled,
      openclaw_used: preview.openclaw_used,
      openclaw_hidden_intermediary_allowed: preview.openclaw_hidden_intermediary_allowed,
      rollback_or_no_state_proof: preview.rollback_or_no_state_proof,
      raw_message_body_exposed: false,
      credential_values_exposed: false,
    },
  })

  return {
    audit_written: true as const,
    action: 'nuclear_gateway.task_dispatch.preview' as const,
    raw_message_body_exposed: false as const,
    credential_values_exposed: false as const,
  }
}

export function buildNuclearGatewayTaskDispatchAdapterStatus() {
  return {
    ok: true,
    route: 'bridge.nuclear-gateway.task-dispatch-adapter',
    phase: NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTER_PHASE,
    status: 'SOURCE_READY_EXECUTION_BLOCKED',
    architecture: 'owner -> mission-control -> nuclear-gateway -> direct-agent-line -> certified-adapter-or-mcp-api-tool',
    adapters_count: NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTERS.length,
    adapters: NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTERS.map((item) => ({ ...item })),
    openclaw_runtime_invoked: false,
    openclaw_conversation_owner_allowed: false,
    openclaw_hidden_intermediary_allowed: false,
    openclaw_default_gateway_allowed: false,
    openclaw_credential_broker_allowed: false,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    credential_values_exposed: false,
    no_secrets_exposed: true,
    receive_trace_required: true,
    rollback_or_no_state_proof: noStatePreviewProof(),
    required_next_proof: [
      'authenticated_direct_line_send_receive_probe',
      'visible_task_event_written',
      'audit_record_written',
      'mission_control_service_refreshed_after_source_cutover',
    ],
  }
}

export function buildNuclearGatewayTaskDispatchPreview(
  input: NuclearGatewayTaskDispatchPreviewInput = {},
): NuclearGatewayTaskDispatchPreview {
  const dispatchKind = normalizeKind(input.dispatch_kind || 'task_dispatch_new_session')
  const targetAgent = String(input.target_agent || '').trim()
  const taskId = input.task_id == null ? null : String(input.task_id)
  const targetSession = input.target_session == null ? null : String(input.target_session)
  const message = String(input.message || '').trim()

  const requiredNextProof = [
    'live_agent_receive_probe',
    'audit_record',
    'rollback_or_no_state_proof',
  ]

  if (!dispatchKind) {
    return {
      ok: false,
      route: 'bridge.nuclear-gateway.task-dispatch-adapter.preview',
      phase: NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTER_PHASE,
      exact_blocker: 'task_dispatch_kind_not_registered',
      dispatch_kind: null,
      task_id: taskId,
      target_session: targetSession,
      target_agent: targetAgent || null,
      conversation_owner: null,
      direct_line_used: false,
      route_trace: [],
      envelope_preview: null,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      openclaw_used: false,
      openclaw_hidden_intermediary_allowed: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      required_next_proof: requiredNextProof,
    }
  }

  if (!targetAgent || !message) {
    return {
      ok: false,
      route: 'bridge.nuclear-gateway.task-dispatch-adapter.preview',
      phase: NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTER_PHASE,
      exact_blocker: !targetAgent ? 'target_agent_required' : 'message_required',
      dispatch_kind: dispatchKind,
      task_id: taskId,
      target_session: targetSession,
      target_agent: targetAgent || null,
      conversation_owner: null,
      direct_line_used: false,
      route_trace: [],
      envelope_preview: null,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      openclaw_used: false,
      openclaw_hidden_intermediary_allowed: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      required_next_proof: requiredNextProof,
    }
  }

  const line = resolveAgentRoutingLine(targetAgent)
  if (!line) {
    return {
      ok: false,
      route: 'bridge.nuclear-gateway.task-dispatch-adapter.preview',
      phase: NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTER_PHASE,
      exact_blocker: 'target_agent_direct_line_not_registered',
      dispatch_kind: dispatchKind,
      task_id: taskId,
      target_session: targetSession,
      target_agent: targetAgent,
      conversation_owner: null,
      direct_line_used: false,
      route_trace: [],
      envelope_preview: null,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      openclaw_used: false,
      openclaw_hidden_intermediary_allowed: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      required_next_proof: requiredNextProof,
    }
  }

  if (isOpenCloudIdentity(line.agent_id) || line.direct_line_active === false) {
    return {
      ok: false,
      route: 'bridge.nuclear-gateway.task-dispatch-adapter.preview',
      phase: NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTER_PHASE,
      exact_blocker: 'openclaw_cannot_be_task_dispatch_conversation_owner',
      dispatch_kind: dispatchKind,
      task_id: taskId,
      target_session: targetSession,
      target_agent: line.agent_id,
      conversation_owner: line.conversation_owner,
      direct_line_used: false,
      route_trace: routeTraceForLine(line),
      envelope_preview: null,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      openclaw_used: false,
      openclaw_hidden_intermediary_allowed: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      required_next_proof: requiredNextProof,
    }
  }

  const envelope = buildAgentMessageEnvelope({
    target_agent: line.agent_id,
    target_system: dispatchKind,
    source_channel: input.source_channel || 'nuclear_gateway_task_dispatch',
    message,
    normalized_request: message,
    conversation_id: taskId ? `task-${taskId}` : undefined,
    intermediaries: [],
    delegated_to: [],
    tools_called: [],
  }, line, {
    visible_task_id: input.visible_task_id == null ? null : String(input.visible_task_id),
    audit_id: null,
    rollback_id: null,
  })
  const traceProof = receiveTraceProof(line.agent_id, input)
  const receiveProofPassed = traceProof.status === 'PASS'

  return {
    ok: true,
    route: 'bridge.nuclear-gateway.task-dispatch-adapter.preview',
    phase: NUCLEAR_GATEWAY_TASK_DISPATCH_ADAPTER_PHASE,
    exact_blocker: receiveProofPassed
      ? 'execution_blocked_until_runtime_cutover_and_jarvis_concurrence'
      : 'execution_blocked_until_live_receive_trace_proof',
    dispatch_kind: dispatchKind,
    task_id: taskId,
    target_session: targetSession,
    target_agent: line.agent_id,
    conversation_owner: line.conversation_owner,
    direct_line_used: envelope.direct_line_used,
    route_trace: envelope.route_trace,
    envelope_preview: envelope,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    openclaw_used: false,
    openclaw_hidden_intermediary_allowed: false,
    credential_values_exposed: false,
    no_secrets_exposed: true,
    required_next_proof: requiredNextProof,
    receive_trace_proof: traceProof,
    audit_preview: auditPreview(line.agent_id),
    rollback_or_no_state_proof: noStatePreviewProof(),
  }
}
