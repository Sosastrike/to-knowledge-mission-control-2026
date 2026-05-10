import Database from 'better-sqlite3'
import { readAgentZeroReportFile } from './agent-zero-report-delivery'
import {
  readLatestAgentZeroBridgeSession,
  recordAgentZeroBridgeSessionAudit,
  type AgentZeroBridgeSessionObject,
  type AgentZeroBridgeSessionRequester,
} from './agent-zero-bridge-session'
import type { MissionControlCanonicalStatus, MissionControlClosureBlockerClass } from './agent-zero-bridge'

const TELEGRAM_TOKEN_KEYS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_TOKEN', 'BOT_TOKEN'] as const
const TELEGRAM_CHAT_KEYS = ['AGENT_ZERO_OWNER_TELEGRAM_CHAT_ID', 'TELEGRAM_OWNER_CHAT_ID', 'TELEGRAM_CHAT_ID'] as const
const TELEGRAM_UPLOAD_REPORT_SCOPE = 'telegram.upload_report_pdf' as const

function firstEnv(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function configuredState() {
  const token = firstEnv(TELEGRAM_TOKEN_KEYS)
  const ownerChatId = firstEnv(TELEGRAM_CHAT_KEYS)
  return {
    token,
    ownerChatId,
    configured: Boolean(token && ownerChatId),
    missing: [
      ...(token ? [] : ['TELEGRAM_BOT_TOKEN']),
      ...(ownerChatId ? [] : ['AGENT_ZERO_OWNER_TELEGRAM_CHAT_ID']),
    ],
  }
}

export type AgentZeroTelegramDeliveryStatus = {
  ok: true
  provider: 'telegram'
  mode: 'agent_zero_telegram_delivery_adapter'
  status: 'configured' | 'blocked'
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  connector_configured: boolean
  execution_enabled: false
  writes_enabled: false
  required_scope: typeof TELEGRAM_UPLOAD_REPORT_SCOPE
  bridge_session_required: true
  external_write_requires_bridge_session: true
  credential_present: boolean
  credential_values_exposed: false
  owner_channel_configured: boolean
  missing_credentials: string[]
  blocked_reason: string | null
  active_commander: 'agent_zero'
  owner_command_route: 'agent_zero'
  tony_active: false
  inbound_owner_validation_model: 'owner_chat_id_match_required'
  dry_run_endpoint: '/api/bridge/telegram-approval-preview'
  upload_endpoint: '/api/bridge/agent-zero/telegram/upload-report'
  proof_packet: AgentZeroTelegramProofPacket
  normal_reply: string
  no_fake_done: true
  no_tokens_exposed: true
}

export type AgentZeroTelegramProofPacket = {
  lane: 'Telegram owner command lane'
  timestamp: string
  runtime_commit: string | null
  route_or_service_checked: string
  result: MissionControlCanonicalStatus
  blocker: string | null
  blocker_class: MissionControlClosureBlockerClass
  audit_pointer: string | null
  safe_log_pointer: string | null
  rollback_command: string
  active_commander: 'agent_zero'
  owner_command_route: 'agent_zero'
  tony_active: false
  connector_configured: boolean
  credential_present: boolean
  owner_channel_configured: boolean
  bridge_session_required: true
  required_scope: typeof TELEGRAM_UPLOAD_REPORT_SCOPE
  send_enabled_without_bridge: false
  inbound_owner_validation_required: true
  fake_delivery_allowed: false
  secrets_exposed: false
  raw_paths_exposed: false
}

export type AgentZeroTelegramUploadResult = {
  ok: boolean
  provider: 'telegram'
  action: 'telegram.upload_report_pdf'
  status: 'completed' | 'blocked' | 'failed'
  accepted_for_execution: boolean
  execution_enabled: false
  writes_enabled: false
  bridge_session_required: true
  owner_approval_required: true
  required_scope: typeof TELEGRAM_UPLOAD_REPORT_SCOPE
  connector_configured: boolean
  report_link: string | null
  telegram_message_id: number | null
  audit_event_id: string | null
  blocked_reason: string | null
  normal_reply: string
  no_fake_done: true
  no_tokens_exposed: true
}

function buildTelegramProofPacket(input: {
  configured: boolean
  credentialPresent: boolean
  ownerChannelConfigured: boolean
  blockedReason: string | null
  canonicalStatus: MissionControlCanonicalStatus
  blockerClass: MissionControlClosureBlockerClass
}): AgentZeroTelegramProofPacket {
  return {
    lane: 'Telegram owner command lane',
    timestamp: new Date().toISOString(),
    runtime_commit: null,
    route_or_service_checked: '/api/bridge/agent-zero/telegram/status',
    result: input.canonicalStatus,
    blocker: input.blockedReason,
    blocker_class: input.blockerClass,
    audit_pointer: null,
    safe_log_pointer: null,
    rollback_command: 'git revert <day-09-telegram-owner-command-commit>',
    active_commander: 'agent_zero',
    owner_command_route: 'agent_zero',
    tony_active: false,
    connector_configured: input.configured,
    credential_present: input.credentialPresent,
    owner_channel_configured: input.ownerChannelConfigured,
    bridge_session_required: true,
    required_scope: TELEGRAM_UPLOAD_REPORT_SCOPE,
    send_enabled_without_bridge: false,
    inbound_owner_validation_required: true,
    fake_delivery_allowed: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

export function getAgentZeroTelegramDeliveryStatus(): AgentZeroTelegramDeliveryStatus {
  const state = configuredState()
  const blockedReason = state.configured ? 'active_bridge_session_required' : 'telegram_report_delivery_adapter_not_configured'
  const canonicalStatus: MissionControlCanonicalStatus = state.configured ? 'OWNER_GATED' : 'CREDENTIAL_GATED'
  const blockerClass: MissionControlClosureBlockerClass = state.configured ? 'OWNER_GATED' : 'CREDENTIAL_GATED'
  return {
    ok: true,
    provider: 'telegram',
    mode: 'agent_zero_telegram_delivery_adapter',
    status: state.configured ? 'configured' : 'blocked',
    canonical_status: canonicalStatus,
    blocker_class: blockerClass,
    connector_configured: state.configured,
    execution_enabled: false,
    writes_enabled: false,
    required_scope: TELEGRAM_UPLOAD_REPORT_SCOPE,
    bridge_session_required: true,
    external_write_requires_bridge_session: true,
    credential_present: Boolean(state.token),
    credential_values_exposed: false,
    owner_channel_configured: Boolean(state.ownerChatId),
    missing_credentials: state.missing,
    blocked_reason: blockedReason,
    active_commander: 'agent_zero',
    owner_command_route: 'agent_zero',
    tony_active: false,
    inbound_owner_validation_model: 'owner_chat_id_match_required',
    dry_run_endpoint: '/api/bridge/telegram-approval-preview',
    upload_endpoint: '/api/bridge/agent-zero/telegram/upload-report',
    proof_packet: buildTelegramProofPacket({
      configured: state.configured,
      credentialPresent: Boolean(state.token),
      ownerChannelConfigured: Boolean(state.ownerChatId),
      blockedReason,
      canonicalStatus,
      blockerClass,
    }),
    normal_reply: state.configured
      ? 'Telegram report delivery is configured, but sending requires an active approved Bridge Session.'
      : 'Telegram report delivery is blocked because bot token or owner chat channel is not configured.',
    no_fake_done: true,
    no_tokens_exposed: true,
  }
}

function blockedResult(input: {
  connectorConfigured: boolean
  reportLink?: string | null
  reason: string
  normalReply: string
}): AgentZeroTelegramUploadResult {
  return {
    ok: false,
    provider: 'telegram',
    action: 'telegram.upload_report_pdf',
    status: 'blocked',
    accepted_for_execution: false,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    owner_approval_required: true,
    required_scope: TELEGRAM_UPLOAD_REPORT_SCOPE,
    connector_configured: input.connectorConfigured,
    report_link: input.reportLink || null,
    telegram_message_id: null,
    audit_event_id: null,
    blocked_reason: input.reason,
    normal_reply: input.normalReply,
    no_fake_done: true,
    no_tokens_exposed: true,
  }
}

function telegramDeliveryInScope(session: AgentZeroBridgeSessionObject): boolean {
  const joined = [
    ...session.allowed_delivery_surfaces,
    ...session.allowed_integrations,
    ...session.allowed_tools,
  ].join(' ')
  return joined.includes('all_registered_delivery_surfaces')
    || joined.includes('telegram.delivery_if_route_configured')
    || joined.includes(TELEGRAM_UPLOAD_REPORT_SCOPE)
}

export async function uploadAgentZeroReportToTelegram(input: {
  db?: Database.Database
  requester: AgentZeroBridgeSessionRequester
  reportId?: string | null
  bridgeSessionId?: string | null
}): Promise<AgentZeroTelegramUploadResult> {
  const status = getAgentZeroTelegramDeliveryStatus()
  const report = input.reportId ? readAgentZeroReportFile(input.reportId, 'pdf') : null
  const reportLink = report?.manifest.mission_control_url || null

  if (!report) {
    return blockedResult({
      connectorConfigured: status.connector_configured,
      reportLink,
      reason: 'agent_zero_report_not_found',
      normalReply: 'Telegram PDF delivery is blocked because the report was not found in Mission Control.',
    })
  }

  const bridge = readLatestAgentZeroBridgeSession({
    db: input.db,
    workspaceId: input.requester.workspaceId,
    tenantId: input.requester.tenantId,
  }).session

  if (!bridge.session_id || bridge.status !== 'active' || !bridge.execution_enabled) {
    const reason = bridge.blocked_reason || (bridge.status === 'pending_approval' ? 'owner_approval_pending' : 'active_bridge_session_required')
    return blockedResult({
      connectorConfigured: status.connector_configured,
      reportLink,
      reason,
      normalReply: 'Telegram PDF delivery is blocked until an approved active Bridge Session is available.',
    })
  }

  if (input.bridgeSessionId && bridge.session_id !== input.bridgeSessionId) {
    return blockedResult({
      connectorConfigured: status.connector_configured,
      reportLink,
      reason: 'bridge_session_mismatch',
      normalReply: 'Telegram PDF delivery is blocked because the provided Bridge Session does not match the active approved session.',
    })
  }

  if (!telegramDeliveryInScope(bridge)) {
    return blockedResult({
      connectorConfigured: status.connector_configured,
      reportLink,
      reason: 'telegram_delivery_not_in_bridge_session_scope',
      normalReply: 'Telegram PDF delivery is blocked because the active Bridge Session does not include Telegram delivery scope.',
    })
  }

  if (!status.connector_configured) {
    return blockedResult({
      connectorConfigured: false,
      reportLink,
      reason: 'telegram_report_delivery_adapter_not_configured',
      normalReply: 'Telegram PDF delivery is blocked because the Telegram bot token or owner chat channel is not configured.',
    })
  }

  const audit = recordAgentZeroBridgeSessionAudit({
    db: input.db,
    sessionId: bridge.session_id,
    requester: input.requester,
    agentId: 'agent_zero',
    action: TELEGRAM_UPLOAD_REPORT_SCOPE,
    target: report.manifest.id,
    outcome: 'approved_for_send',
    metadata: {
      provider: 'telegram',
      report_id: report.manifest.id,
      report_pdf_url: report.manifest.pdf_url,
      bridge_session_required: true,
      no_fake_done: true,
      no_tokens_exposed: true,
    },
  })

  if (!audit.ok || !audit.audit_event?.id) {
    return blockedResult({
      connectorConfigured: status.connector_configured,
      reportLink,
      reason: audit.blocked_reason || 'telegram_delivery_audit_required',
      normalReply: 'Telegram PDF delivery is blocked because the Bridge Session audit record could not be written.',
    })
  }

  const token = firstEnv(TELEGRAM_TOKEN_KEYS)!
  const chatId = firstEnv(TELEGRAM_CHAT_KEYS)!
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const form = new FormData()
    form.set('chat_id', chatId)
    form.set('caption', `Agent Zero report: ${report.manifest.title}`.slice(0, 1000))
    form.set('document', new Blob([new Uint8Array(report.bytes)], { type: 'application/pdf' }), report.filename)

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })

    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    const ok = response.ok && body && typeof body === 'object' && body.ok === true
    if (!ok) {
      return {
        ok: false,
        provider: 'telegram',
        action: 'telegram.upload_report_pdf',
        status: 'failed',
        accepted_for_execution: false,
        execution_enabled: false,
        writes_enabled: false,
        bridge_session_required: true,
        owner_approval_required: true,
        required_scope: TELEGRAM_UPLOAD_REPORT_SCOPE,
        connector_configured: true,
        report_link: reportLink,
        telegram_message_id: null,
        audit_event_id: audit.audit_event.id,
        blocked_reason: `telegram_api_error_${response.status}`,
        normal_reply: 'Telegram PDF delivery failed at the Telegram API boundary. No fake delivery was reported.',
        no_fake_done: true,
        no_tokens_exposed: true,
      }
    }

    const messageIdRaw = (body as Record<string, unknown>)?.result && typeof (body as any).result === 'object'
      ? (body as any).result.message_id
      : null
    const messageId = typeof messageIdRaw === 'number' ? messageIdRaw : null
    return {
      ok: true,
      provider: 'telegram',
      action: 'telegram.upload_report_pdf',
      status: 'completed',
      accepted_for_execution: true,
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required: true,
      owner_approval_required: true,
      required_scope: TELEGRAM_UPLOAD_REPORT_SCOPE,
      connector_configured: true,
      report_link: reportLink,
      telegram_message_id: messageId,
      audit_event_id: audit.audit_event.id,
      blocked_reason: null,
      normal_reply: 'Telegram PDF delivery completed through Agent Zero owner channel with approved scope.',
      no_fake_done: true,
      no_tokens_exposed: true,
    }
  } catch {
    return {
      ok: false,
      provider: 'telegram',
      action: 'telegram.upload_report_pdf',
      status: 'failed',
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required: true,
      owner_approval_required: true,
      required_scope: TELEGRAM_UPLOAD_REPORT_SCOPE,
      connector_configured: true,
      report_link: reportLink,
      telegram_message_id: null,
      audit_event_id: audit.audit_event.id,
      blocked_reason: 'telegram_api_request_failed',
      normal_reply: 'Telegram PDF delivery failed before confirmation from Telegram API.',
      no_fake_done: true,
      no_tokens_exposed: true,
    }
  } finally {
    clearTimeout(timeout)
  }
}
