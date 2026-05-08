import Database from 'better-sqlite3'
import { readAgentZeroReportFile } from './agent-zero-report-delivery'
import { readLatestAgentZeroBridgeSession, type AgentZeroBridgeSessionRequester } from './agent-zero-bridge-session'

const TELEGRAM_TOKEN_KEYS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_TOKEN', 'BOT_TOKEN'] as const
const TELEGRAM_CHAT_KEYS = ['AGENT_ZERO_OWNER_TELEGRAM_CHAT_ID', 'TELEGRAM_OWNER_CHAT_ID', 'TELEGRAM_CHAT_ID'] as const

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
  connector_configured: boolean
  execution_enabled: false
  writes_enabled: false
  bridge_session_required: true
  external_write_requires_bridge_session: true
  credential_present: boolean
  credential_values_exposed: false
  owner_channel_configured: boolean
  missing_credentials: string[]
  blocked_reason: string | null
  normal_reply: string
  no_fake_done: true
  no_tokens_exposed: true
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
  connector_configured: boolean
  report_link: string | null
  telegram_message_id: number | null
  blocked_reason: string | null
  normal_reply: string
  no_fake_done: true
  no_tokens_exposed: true
}

export function getAgentZeroTelegramDeliveryStatus(): AgentZeroTelegramDeliveryStatus {
  const state = configuredState()
  return {
    ok: true,
    provider: 'telegram',
    mode: 'agent_zero_telegram_delivery_adapter',
    status: state.configured ? 'configured' : 'blocked',
    connector_configured: state.configured,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    external_write_requires_bridge_session: true,
    credential_present: Boolean(state.token),
    credential_values_exposed: false,
    owner_channel_configured: Boolean(state.ownerChatId),
    missing_credentials: state.missing,
    blocked_reason: state.configured ? 'active_bridge_session_required' : 'telegram_report_delivery_adapter_not_configured',
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
    connector_configured: input.connectorConfigured,
    report_link: input.reportLink || null,
    telegram_message_id: null,
    blocked_reason: input.reason,
    normal_reply: input.normalReply,
    no_fake_done: true,
    no_tokens_exposed: true,
  }
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

  if (!status.connector_configured) {
    return blockedResult({
      connectorConfigured: false,
      reportLink,
      reason: 'telegram_report_delivery_adapter_not_configured',
      normalReply: 'Telegram PDF delivery is blocked because the Telegram bot token or owner chat channel is not configured.',
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
        connector_configured: true,
        report_link: reportLink,
        telegram_message_id: null,
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
      connector_configured: true,
      report_link: reportLink,
      telegram_message_id: messageId,
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
      connector_configured: true,
      report_link: reportLink,
      telegram_message_id: null,
      blocked_reason: 'telegram_api_request_failed',
      normal_reply: 'Telegram PDF delivery failed before confirmation from Telegram API.',
      no_fake_done: true,
      no_tokens_exposed: true,
    }
  } finally {
    clearTimeout(timeout)
  }
}
