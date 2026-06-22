import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'

export const JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID = 'telegram_exact_send'
export const JARVIS_TELEGRAM_DELIVERY_ACTION = 'telegram.owner_message.send'
export const JARVIS_TELEGRAM_DELIVERY_SESSION_SCOPE = 'telegram_owner_message_send'

type TelegramDeliveryInput = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
}

type TelegramDeliveryRecord = {
  id: string
  at: string
  message_label: string
  message_preview: string
  provider: 'telegram'
  target: 'owner_chat'
  message_id: number | null
  external_delivery_performed: boolean
  credential_values_exposed: false
  raw_chat_id_exposed: false
}

type TelegramSendResult = {
  ok: boolean
  message_id?: number
  status?: number
  blocker?: string
}

type TelegramDeliveryDeps = {
  env?: Record<string, string | undefined>
  sendTelegram?: (input: { botToken: string; chatId: string; text: string }) => Promise<TelegramSendResult>
  writeRecord?: (record: TelegramDeliveryRecord) => TelegramDeliveryRecord
}

export type TelegramDeliveryResult = {
  ok: boolean
  adapter_id: typeof JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID
  action: string
  message_sent: boolean
  delivery_id: string | null
  message_id: number | null
  message_label: string | null
  message_preview: string | null
  external_delivery_performed: boolean
  credential_values_exposed: false
  raw_chat_id_exposed: false
  exact_blocker: string | null
}

const storePath = join(config.dataDir, 'jarvis-telegram-deliveries.json')

function readRecords(): TelegramDeliveryRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRecords(rows: TelegramDeliveryRecord[]) {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function defaultWriteRecord(record: TelegramDeliveryRecord) {
  writeRecords([record, ...readRecords()])
  return record
}

function clean(value: unknown, fallback: string, max = 500) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || fallback)
    .replace(/(?:\/home\/tony|\/tmp|\/var\/folders)[^\s`'"\])}]*/g, '<server-local-path>')
    .slice(0, max)
}

function blockResult(action: string, blocker: string): TelegramDeliveryResult {
  return {
    ok: false,
    adapter_id: JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID,
    action: action || 'unknown',
    message_sent: false,
    delivery_id: null,
    message_id: null,
    message_label: null,
    message_preview: null,
    external_delivery_performed: false,
    credential_values_exposed: false,
    raw_chat_id_exposed: false,
    exact_blocker: blocker,
  }
}

async function defaultSendTelegram(input: { botToken: string; chatId: string; text: string }): Promise<TelegramSendResult> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${input.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    })
    const payload = await response.json().catch(() => null) as { ok?: boolean; result?: { message_id?: number }; description?: string } | null
    if (!response.ok || !payload?.ok) {
      return { ok: false, status: response.status, blocker: response.status === 401 ? 'telegram_credential_rejected' : 'telegram_send_failed' }
    }
    return { ok: true, status: response.status, message_id: payload.result?.message_id || undefined }
  } catch {
    return { ok: false, blocker: 'telegram_upstream_unreachable' }
  }
}

export async function executeJarvisTelegramOwnerMessageSend(
  request: TelegramDeliveryInput,
  deps: TelegramDeliveryDeps = {},
): Promise<TelegramDeliveryResult> {
  const action = typeof request.action === 'string' ? request.action.trim() : ''
  const scope = request.scope && typeof request.scope === 'object' && !Array.isArray(request.scope) ? request.scope : {}
  if (
    action !== JARVIS_TELEGRAM_DELIVERY_ACTION ||
    scope.system !== 'telegram' ||
    scope.operation !== 'send_owner_message' ||
    scope.target !== 'owner_chat'
  ) {
    return blockResult(action, 'exact_scope_required_telegram_owner_message_send')
  }

  const env = deps.env || process.env
  const botToken = env.TELEGRAM_BOT_TOKEN || env.JARVIS_TELEGRAM_BOT_TOKEN || env.AGENT_ZERO_TELEGRAM_BOT_TOKEN
  const chatId = env.TELEGRAM_OWNER_CHAT_ID || env.TELEGRAM_ALLOWED_CHAT_ID
  if (!botToken || !chatId) {
    return blockResult(action, 'telegram_credential_required')
  }

  const input = request.input && typeof request.input === 'object' && !Array.isArray(request.input) ? request.input : {}
  const messageLabel = clean(input.message_label, 'jarvis_full_go_proof', 120).replace(/[^a-zA-Z0-9_.:-]/g, '_')
  const message = clean(input.message, 'Jarvis exact-scope Telegram delivery proof. No secrets exposed.', 500)
  if (!message || /https?:\/\//i.test(message) || /@\w+/.test(message)) {
    return blockResult(action, 'telegram_safe_message_required')
  }

  const sendTelegram = deps.sendTelegram || defaultSendTelegram
  const sent = await sendTelegram({ botToken, chatId, text: message })
  if (!sent.ok) {
    return blockResult(action, sent.blocker || 'telegram_send_failed')
  }

  const record: TelegramDeliveryRecord = {
    id: `jtd_${randomUUID()}`,
    at: new Date().toISOString(),
    message_label: messageLabel,
    message_preview: message.slice(0, 180),
    provider: 'telegram',
    target: 'owner_chat',
    message_id: sent.message_id || null,
    external_delivery_performed: true,
    credential_values_exposed: false,
    raw_chat_id_exposed: false,
  }
  const written = (deps.writeRecord || defaultWriteRecord)(record)

  return {
    ok: true,
    adapter_id: JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID,
    action: JARVIS_TELEGRAM_DELIVERY_ACTION,
    message_sent: true,
    delivery_id: written.id,
    message_id: written.message_id,
    message_label: written.message_label,
    message_preview: written.message_preview,
    external_delivery_performed: true,
    credential_values_exposed: false,
    raw_chat_id_exposed: false,
    exact_blocker: null,
  }
}
