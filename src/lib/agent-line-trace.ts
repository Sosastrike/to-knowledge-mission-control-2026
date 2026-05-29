import { createHash, randomUUID } from 'node:crypto'

import {
  ensureAgentRoutingVisibleTask,
  listAgentRoutingLines,
  resolveAgentRoutingLine,
  routeTraceForLine,
  type AgentRoutingLine,
} from '@/lib/agent-routing-lines'
import { logAuditEvent } from '@/lib/db'
import { isOpenCloudIdentity } from '@/lib/opencloud-authority-policy'

export type AgentLineTraceStatus = 'PASS' | 'FAIL'

export type AgentLineTraceBlocker =
  | 'DIRECT_LINE_NOT_FOUND'
  | 'TARGET_AGENT_NOT_RECEIVED'
  | 'OPENCLOUD_HIDDEN_INTERMEDIARY_DETECTED'
  | 'HIDDEN_INTERMEDIARY_DETECTED'
  | 'WRONG_AGENT_RESPONDED'
  | 'TRANSPORT_ONLY_NO_AGENT_RECEIVE'
  | 'TELEGRAM_IDENTITY_MISMATCH'
  | 'VOICE_TRANSCRIPTION_MISSING'
  | 'RESPONSE_NOT_SENT'
  | 'TRACE_TIMEOUT'
  | 'ROUTE_TRACE_MISSING'
  | 'TEXT_OVERRIDE_IGNORED'
  | null

export type AgentLineTraceRecord = {
  trace_id: string
  nonce: string
  timestamp: string
  source_channel: string
  source_surface: string
  target_agent: string
  target_system: string
  conversation_owner: string
  direct_line_used: boolean
  route_trace: string[]
  intermediaries: string[]
  tools_called: string[]
  opencloud_used: boolean
  opencloud_role: 'supporting_tool_only' | 'not_used' | 'forbidden_hidden_intermediary'
  openclaw_used: boolean
  openclaw_role: 'supporting_tool_only' | 'not_used' | 'forbidden_hidden_intermediary'
  telegram_bot_username: string | null
  message_received_by_agent: boolean
  voice_transcribed: boolean
  response_sent: boolean
  local_gateway_probe: boolean
  verification_sources: string[]
  visible_task_id: string | null
  audit_id: string
  status: AgentLineTraceStatus
  blocker: AgentLineTraceBlocker
  credential_values_exposed: false
  raw_message_body_exposed: false
}

export type AgentLineTraceLiveSummary = {
  total: number
  pass: number
  fail: number
  local_gateway_probe: number
  external_message_probe: number
  external_receive_proof_pass: number
  local_only_pass: number
  opencloud_hidden_intermediary_detected: number
  openclaw_hidden_intermediary_detected: number
  hidden_intermediary_detected: number
  blockers: Record<string, number>
  latest_status: AgentLineTraceStatus | null
  latest_blocker: AgentLineTraceBlocker
}

export type AgentLineTraceProbeInput = {
  nonce?: unknown
  source_channel?: unknown
  source_surface?: unknown
  target_agent?: unknown
  target_system?: unknown
  route_trace?: unknown
  intermediaries?: unknown
  tools_called?: unknown
  telegram_bot_username?: unknown
  message_received_by_agent?: unknown
  voice_transcribed?: unknown
  response_sent?: unknown
  response_agent?: unknown
  mode?: unknown
  requested_output_mode?: unknown
  tts_actually_called?: unknown
  local_gateway_probe?: unknown
  verification_sources?: unknown
  create_visible_task_on_failure?: unknown
}

const TRACE_RING_LIMIT = 80
const traceRecords: AgentLineTraceRecord[] = []
export const LOCAL_ONLY_TRACE_SOURCES = [
  'mission_control_protected_probe_route',
  'mission_control_trace_route',
] as const
const LOCAL_ONLY_TRACE_SOURCE_SET = new Set<string>(LOCAL_ONLY_TRACE_SOURCES)

const TELEGRAM_BOTS: Record<string, string> = {
  'agent-zero-jarvis': '@Jarvis_88sbot',
}

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, 240) || fallback : fallback
}

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item)).filter(Boolean).slice(0, 16)
    : []
}

export function externalAgentReceiveTraceSources(sources: unknown) {
  return cleanList(sources)
    .filter((source) => !LOCAL_ONLY_TRACE_SOURCE_SET.has(source))
    .slice(0, 8)
}

export function hasExternalAgentReceiveProof(record: AgentLineTraceRecord) {
  return record.status === 'PASS'
    && record.direct_line_used
    && record.message_received_by_agent
    && record.response_sent
    && !record.openclaw_used
    && !record.local_gateway_probe
    && externalAgentReceiveTraceSources(record.verification_sources).length > 0
}

function boolValue(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function safeNonce(value: unknown) {
  const provided = cleanText(value)
  if (/^TRACE-[A-Za-z0-9_.:-]{6,120}$/.test(provided)) return provided
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)
  return `TRACE-${stamp}-${randomUUID().slice(0, 8)}`
}

function lineTarget(line: AgentRoutingLine | null, requested: string) {
  if (!line) return requested || 'unknown'
  return line.agent_id
}

function defaultRouteTrace(line: AgentRoutingLine | null) {
  if (!line || !line.direct_line_active) return []
  return routeTraceForLine(line)
}

function traceBlocker(input: {
  line: AgentRoutingLine | null
  routeTrace: string[]
  intermediaries: string[]
  targetAgent: string
  conversationOwner: string
  messageReceived: boolean
  responseSent: boolean
  responseAgent: string
  mode: string
  voiceTranscribed: boolean
  telegramBotUsername: string | null
  requestedOutputMode: string
  ttsActuallyCalled: boolean
}): AgentLineTraceBlocker {
  if (!input.line || !input.line.direct_line_active) return 'DIRECT_LINE_NOT_FOUND'
  if (input.intermediaries.some(isOpenCloudIdentity)) return 'OPENCLOUD_HIDDEN_INTERMEDIARY_DETECTED'
  if (input.intermediaries.length > 0) return 'HIDDEN_INTERMEDIARY_DETECTED'
  if (isOpenCloudIdentity(input.conversationOwner)) return 'OPENCLOUD_HIDDEN_INTERMEDIARY_DETECTED'
  if (input.routeTrace.length === 0) return 'ROUTE_TRACE_MISSING'
  if (!input.routeTrace.includes(input.targetAgent)) return 'TARGET_AGENT_NOT_RECEIVED'
  if (!input.messageReceived) return input.routeTrace.includes('transport') ? 'TRANSPORT_ONLY_NO_AGENT_RECEIVE' : 'TARGET_AGENT_NOT_RECEIVED'
  if (input.mode === 'voice' && !input.voiceTranscribed) return 'VOICE_TRANSCRIPTION_MISSING'
  if (input.telegramBotUsername && input.targetAgent === 'agent-zero-jarvis' && input.telegramBotUsername !== TELEGRAM_BOTS['agent-zero-jarvis']) return 'TELEGRAM_IDENTITY_MISMATCH'
  if (input.responseSent && input.responseAgent && input.responseAgent !== input.conversationOwner) return 'WRONG_AGENT_RESPONDED'
  if (input.requestedOutputMode === 'text' && input.ttsActuallyCalled) return 'TEXT_OVERRIDE_IGNORED'
  if (!input.responseSent) return 'RESPONSE_NOT_SENT'
  return null
}

function recordTrace(record: AgentLineTraceRecord) {
  traceRecords.unshift(record)
  traceRecords.splice(TRACE_RING_LIMIT)
}

function createFailureTask(record: AgentLineTraceRecord) {
  if (record.status !== 'FAIL' || !record.blocker) return null
  const task = ensureAgentRoutingVisibleTask({
    title: `Direct Agent Line Trace Failure — ${record.target_agent}`,
    description: `Direct line trace ${record.nonce} failed for ${record.target_agent}: ${record.blocker}.`,
    assigned_to: record.target_agent === 'unknown' ? 'agent-zero-jarvis' : record.target_agent,
    blocker: record.blocker,
    metadata: {
      trace_id: record.trace_id,
      nonce: record.nonce,
      source_surface: record.source_surface,
      target_agent: record.target_agent,
      failure_code: record.blocker,
      route_attempted: record.route_trace,
      opencloud_involvement: record.opencloud_used || record.intermediaries.some(isOpenCloudIdentity),
      response_status: record.response_sent ? 'sent' : 'not_sent',
      next_system_action: 'Fix the exact direct-line route/trace failure, then rerun scripts/agent-line-trace.sh for this agent.',
      project_continues: true,
      credential_values_exposed: false,
    },
  })
  return String(task.task_id)
}

export function buildAgentLineTraceRecord(input: AgentLineTraceProbeInput = {}): AgentLineTraceRecord {
  const requestedTarget = cleanText(input.target_agent || 'agent-zero-jarvis', 'agent-zero-jarvis')
  const line = resolveAgentRoutingLine(requestedTarget)
  const targetAgent = lineTarget(line, requestedTarget)
  const routeTrace = 'route_trace' in input ? cleanList(input.route_trace) : defaultRouteTrace(line)
  const intermediaries = cleanList(input.intermediaries)
  const toolsCalled = cleanList(input.tools_called)
  const sourceChannel = cleanText(input.source_channel, 'terminal')
  const sourceSurface = cleanText(input.source_surface, sourceChannel)
  const mode = cleanText(input.mode, sourceChannel === 'telegram_voice' ? 'voice' : 'manual')
  const messageReceived = boolValue(input.message_received_by_agent, Boolean(line?.direct_line_active))
  const responseSent = boolValue(input.response_sent, Boolean(line?.direct_line_active))
  const voiceTranscribed = boolValue(input.voice_transcribed, mode !== 'voice')
  const responseAgent = cleanText(input.response_agent)
  const telegramBotUsername = cleanText(input.telegram_bot_username) || TELEGRAM_BOTS[targetAgent] || null
  const requestedOutputMode = cleanText(input.requested_output_mode)
  const ttsActuallyCalled = boolValue(input.tts_actually_called, false)
  const localGatewayProbe = boolValue(input.local_gateway_probe, false)
  const verificationSources = cleanList(input.verification_sources)
  const conversationOwner = line?.conversation_owner || targetAgent
  const blocker = traceBlocker({
    line,
    routeTrace,
    intermediaries,
    targetAgent,
    conversationOwner,
    messageReceived,
    responseSent,
    responseAgent,
    mode,
    voiceTranscribed,
    telegramBotUsername,
    requestedOutputMode,
    ttsActuallyCalled,
  })
  const hiddenIntermediaryPresent = intermediaries.length > 0 || isOpenCloudIdentity(conversationOwner)
  const directLineUsed = Boolean(
    line?.direct_line_active
    && routeTrace.includes(targetAgent)
    && messageReceived
    && !hiddenIntermediaryPresent,
  )
  const nonce = safeNonce(input.nonce)
  const auditId = `audit_${hashText(`${nonce}:${targetAgent}`).slice(0, 20)}`
  const opencloudUsed = intermediaries.some(isOpenCloudIdentity) || toolsCalled.some(isOpenCloudIdentity)
  const opencloudRole = intermediaries.some(isOpenCloudIdentity)
    ? 'forbidden_hidden_intermediary'
    : toolsCalled.some(isOpenCloudIdentity)
      ? 'supporting_tool_only'
      : 'not_used'
  const record: AgentLineTraceRecord = {
    trace_id: `trace_${hashText(`${nonce}:${targetAgent}:${Date.now()}`).slice(0, 24)}`,
    nonce,
    timestamp: new Date().toISOString(),
    source_channel: sourceChannel,
    source_surface: sourceSurface,
    target_agent: targetAgent,
    target_system: cleanText(input.target_system, targetAgent),
    conversation_owner: conversationOwner,
    direct_line_used: directLineUsed,
    route_trace: routeTrace,
    intermediaries,
    tools_called: toolsCalled,
    opencloud_used: opencloudUsed,
    opencloud_role: opencloudRole,
    openclaw_used: opencloudUsed,
    openclaw_role: opencloudRole,
    telegram_bot_username: telegramBotUsername,
    message_received_by_agent: messageReceived,
    voice_transcribed: voiceTranscribed,
    response_sent: responseSent,
    local_gateway_probe: localGatewayProbe,
    verification_sources: localGatewayProbe
      ? Array.from(new Set(['mission_control_protected_probe_route', ...verificationSources]))
      : verificationSources,
    visible_task_id: null,
    audit_id: auditId,
    status: blocker ? 'FAIL' : 'PASS',
    blocker,
    credential_values_exposed: false,
    raw_message_body_exposed: false,
  }

  if (record.status === 'FAIL' && boolValue(input.create_visible_task_on_failure, true)) {
    record.visible_task_id = createFailureTask(record)
  }

  logAuditEvent({
    action: 'agent_line_trace.probe',
    actor: 'agent-line-trace',
    target_type: 'agent_line',
    detail: {
      trace_id: record.trace_id,
      nonce_hash: hashText(record.nonce).slice(0, 16),
      source_surface: record.source_surface,
      target_agent: record.target_agent,
      status: record.status,
      blocker: record.blocker,
      opencloud_used: record.opencloud_used,
      local_gateway_probe: record.local_gateway_probe,
      verification_sources: record.verification_sources,
      credential_values_exposed: false,
    },
  })
  recordTrace(record)
  return record
}

export function buildAgentLineTraceLive(input: { agent?: string | null; nonce?: string | null } = {}) {
  const agent = cleanText(input.agent || '')
  const nonce = cleanText(input.nonce || '')
  const traces = traceRecords.filter((record) => {
    if (agent && record.target_agent !== (resolveAgentRoutingLine(agent)?.agent_id || agent)) return false
    if (nonce && record.nonce !== nonce) return false
    return true
  })
  const summary = traces.reduce<AgentLineTraceLiveSummary>((acc, record, index) => {
    acc.total += 1
    if (record.status === 'PASS') acc.pass += 1
    if (record.status === 'FAIL') acc.fail += 1
    if (record.local_gateway_probe) acc.local_gateway_probe += 1
    if (!record.local_gateway_probe) acc.external_message_probe += 1
    if (hasExternalAgentReceiveProof(record)) acc.external_receive_proof_pass += 1
    if (record.status === 'PASS' && !hasExternalAgentReceiveProof(record)) acc.local_only_pass += 1
    if (record.blocker === 'OPENCLOUD_HIDDEN_INTERMEDIARY_DETECTED') {
      acc.opencloud_hidden_intermediary_detected += 1
      acc.openclaw_hidden_intermediary_detected += 1
    }
    if (record.blocker === 'OPENCLOUD_HIDDEN_INTERMEDIARY_DETECTED' || record.blocker === 'HIDDEN_INTERMEDIARY_DETECTED') {
      acc.hidden_intermediary_detected += 1
    }
    if (record.blocker) {
      acc.blockers[record.blocker] = (acc.blockers[record.blocker] || 0) + 1
    }
    if (index === 0) {
      acc.latest_status = record.status
      acc.latest_blocker = record.blocker
    }
    return acc
  }, {
    total: 0,
    pass: 0,
    fail: 0,
    local_gateway_probe: 0,
    external_message_probe: 0,
    external_receive_proof_pass: 0,
    local_only_pass: 0,
    opencloud_hidden_intermediary_detected: 0,
    openclaw_hidden_intermediary_detected: 0,
    hidden_intermediary_detected: 0,
    blockers: {},
    latest_status: null,
    latest_blocker: null,
  })

  return {
    route: 'bridge.agent-routing.trace.live',
    mode: 'safe_redacted_trace_records',
    generated_at: new Date().toISOString(),
    summary,
    supported_agents: listAgentRoutingLines()
      .filter((line) => line.direct_line_active)
      .map((line) => ({
        agent_id: line.agent_id,
        display_name: line.display_name,
        gateway_route: line.gateway_route,
        conversation_owner: line.conversation_owner,
        direct_line_active: line.direct_line_active,
        last_verified: line.last_verified,
        visible_task_required: line.visible_task_required,
        audit_required: line.audit_required,
        rollback_required: line.rollback_required,
        opencloud_intermediary_allowed: false,
      })),
    traces,
    trace_count: traces.length,
    credential_values_exposed: false,
    raw_message_body_exposed: false,
  }
}
