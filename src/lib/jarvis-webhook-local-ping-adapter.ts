import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'

export const JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID = 'webhook_local_ping'
export const JARVIS_WEBHOOK_LOCAL_PING_ACTION = 'webhook.internal.ping'
export const JARVIS_WEBHOOK_LOCAL_PING_SESSION_SCOPE = 'webhook_local_ping'

type WebhookLocalPingInput = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
}

type WebhookLocalPingRecord = {
  id: string
  at: string
  label: string
  message_preview: string
  external_endpoint_called: false
  public_webhook_created: false
  credential_values_exposed: false
  raw_url_exposed: false
}

type WebhookLocalPingDeps = {
  writePing?: (record: WebhookLocalPingRecord) => WebhookLocalPingRecord
}

export type WebhookLocalPingResult = {
  ok: boolean
  adapter_id: typeof JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID
  action: string
  ping_created: boolean
  ping_id: string | null
  label: string | null
  message_preview: string | null
  external_endpoint_called: false
  public_webhook_created: false
  credential_values_exposed: false
  raw_url_exposed: false
  provider_execution_called: false
  mcp_tool_invocation_called: false
  paperclip_write_called: false
  zapier_execution_called: false
  n8n_workflow_activation_called: false
  delivery_send_or_upload_called: false
  exact_blocker: string | null
}

const pingStorePath = join(config.dataDir, 'jarvis-webhook-local-pings.json')

function readPings(): WebhookLocalPingRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(pingStorePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writePings(rows: WebhookLocalPingRecord[]) {
  mkdirSync(dirname(pingStorePath), { recursive: true })
  writeFileSync(pingStorePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function defaultWritePing(record: WebhookLocalPingRecord) {
  writePings([record, ...readPings()])
  return record
}

function clean(value: unknown, fallback: string, max = 500) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || fallback)
    .replace(/https?:\/\/[^\s`'"]+/gi, '[redacted_url]')
    .replace(/(?:\/home\/tony|\/tmp|\/var\/folders)[^\s`'"\])}]*/g, '<server-local-path>')
    .slice(0, max)
}

function hasForbiddenUrl(value: string) {
  return /https?:\/\//i.test(value) || /\b(?:webhook\.site|hooks\.zapier\.com|n8n|ngrok|localhost:\d+|127\.0\.0\.1:\d+)\b/i.test(value)
}

function block(action: string, exactBlocker: string): WebhookLocalPingResult {
  return {
    ok: false,
    adapter_id: JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID,
    action: action || 'unknown',
    ping_created: false,
    ping_id: null,
    label: null,
    message_preview: null,
    external_endpoint_called: false,
    public_webhook_created: false,
    credential_values_exposed: false,
    raw_url_exposed: false,
    provider_execution_called: false,
    mcp_tool_invocation_called: false,
    paperclip_write_called: false,
    zapier_execution_called: false,
    n8n_workflow_activation_called: false,
    delivery_send_or_upload_called: false,
    exact_blocker: exactBlocker,
  }
}

export function executeJarvisWebhookLocalPing(
  request: WebhookLocalPingInput,
  deps: WebhookLocalPingDeps = {},
): WebhookLocalPingResult {
  const action = typeof request.action === 'string' ? request.action.trim() : ''
  const scope = request.scope && typeof request.scope === 'object' && !Array.isArray(request.scope) ? request.scope : {}
  if (
    action !== JARVIS_WEBHOOK_LOCAL_PING_ACTION ||
    scope.system !== 'webhook' ||
    scope.operation !== 'invoke_local_test' ||
    scope.target !== 'mission_control_internal_ping'
  ) {
    return block(action, 'exact_scope_required_webhook_local_ping')
  }

  const input = request.input && typeof request.input === 'object' && !Array.isArray(request.input) ? request.input : {}
  const rawLabel = typeof input.payload_label === 'string' ? input.payload_label.trim() : ''
  if (!rawLabel || hasForbiddenUrl(rawLabel) || rawLabel.includes('/') || rawLabel.includes('@')) {
    return block(action, 'webhook_local_ping_label_required')
  }

  const rawMessage = typeof input.message === 'string' ? input.message.trim() : ''
  if (hasForbiddenUrl(rawMessage)) {
    return block(action, 'webhook_local_ping_external_url_forbidden')
  }

  const message = clean(rawMessage, 'Jarvis executed a local Mission Control webhook ping. No external endpoint was called.', 1000)
  const record: WebhookLocalPingRecord = {
    id: `whp_${randomUUID()}`,
    at: new Date().toISOString(),
    label: clean(rawLabel, 'jarvis-local-webhook-ping', 120),
    message_preview: message.slice(0, 180),
    external_endpoint_called: false,
    public_webhook_created: false,
    credential_values_exposed: false,
    raw_url_exposed: false,
  }
  const written = (deps.writePing || defaultWritePing)(record)

  return {
    ok: true,
    adapter_id: JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID,
    action: JARVIS_WEBHOOK_LOCAL_PING_ACTION,
    ping_created: true,
    ping_id: written.id,
    label: written.label,
    message_preview: written.message_preview,
    external_endpoint_called: false,
    public_webhook_created: false,
    credential_values_exposed: false,
    raw_url_exposed: false,
    provider_execution_called: false,
    mcp_tool_invocation_called: false,
    paperclip_write_called: false,
    zapier_execution_called: false,
    n8n_workflow_activation_called: false,
    delivery_send_or_upload_called: false,
    exact_blocker: null,
  }
}
