export type AgentMailAdapterSendInput = {
  agentId: string
  inboxId: string
  credentialRef: string
  apiKey: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  text: string
  html?: string | null
  labels?: string[]
  approvalId?: string | null
  bridgeSessionId?: string | null
  gatewayDecisionId?: string | null
  fetchImpl?: typeof fetch
  baseUrl?: string
}

export type AgentMailAdapterSendResult =
  | { ok: true; message_id: string; thread_id: string | null; provider_status: string; credential_values_exposed: false; tokens_exposed: false; env_values_exposed: false }
  | { ok: false; exact_blocker: string; provider_status: string; http_status: number | null; credential_values_exposed: false; tokens_exposed: false; env_values_exposed: false }

const SAFE = { credential_values_exposed: false as const, tokens_exposed: false as const, env_values_exposed: false as const }

export function normalizeAgentMailSendError(error: { status?: number | null; code?: string | null; message?: string | null }) {
  const status = Number(error.status || 0)
  if (status === 401) return 'scoped_credential_invalid'
  if (status === 403) return 'message_send_permission_missing'
  if (status === 404) return 'agentmail_inbox_or_message_not_found'
  if (status === 429) return 'agentmail_rate_limited'
  if (status >= 500) return 'agentmail_service_unreachable'
  return 'agentmail_send_failed'
}

async function safeJson(response: Response): Promise<Record<string, any>> {
  try {
    const parsed = await response.json()
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function messageIdFromPayload(payload: Record<string, any>) {
  return String(payload.message_id || payload.id || payload.message?.message_id || payload.message?.id || '').trim()
}

function threadIdFromPayload(payload: Record<string, any>) {
  const value = payload.thread_id || payload.thread?.thread_id || payload.thread?.id || payload.message?.thread_id || null
  return value ? String(value) : null
}

export async function sendAgentMailMessage(input: AgentMailAdapterSendInput): Promise<AgentMailAdapterSendResult> {
  const fetcher = input.fetchImpl || fetch
  const baseUrl = String(input.baseUrl || process.env.AGENTMAIL_API_BASE_URL || 'https://api.agentmail.to').replace(/\/+$/, '')
  const url = `${baseUrl}/v0/inboxes/${encodeURIComponent(input.inboxId)}/messages/send`
  const body = {
    to: input.to,
    cc: input.cc || [],
    bcc: input.bcc || [],
    subject: input.subject,
    text: input.text,
    html: input.html || undefined,
    labels: input.labels || [],
    metadata: {
      source: 'mission-control',
      agent_id: input.agentId,
      approval_id: input.approvalId || null,
      bridge_session_id: input.bridgeSessionId || null,
      gateway_decision_id: input.gatewayDecisionId || null,
      credential_values_exposed: false,
    },
  }
  const response = await fetcher(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify(body),
  })
  const payload = await safeJson(response)
  if (!response.ok) {
    return {
      ok: false,
      exact_blocker: normalizeAgentMailSendError({ status: response.status, code: payload.code, message: payload.message }),
      provider_status: 'http_error',
      http_status: response.status,
      ...SAFE,
    }
  }
  return {
    ok: true,
    message_id: messageIdFromPayload(payload) || `agentmail_msg_${Date.now()}`,
    thread_id: threadIdFromPayload(payload),
    provider_status: 'sent',
    ...SAFE,
  }
}

export async function replyAgentMailMessage(input: AgentMailAdapterSendInput & { messageId: string; threadId: string }): Promise<AgentMailAdapterSendResult> {
  const fetcher = input.fetchImpl || fetch
  const baseUrl = String(input.baseUrl || process.env.AGENTMAIL_API_BASE_URL || 'https://api.agentmail.to').replace(/\/+$/, '')
  const url = `${baseUrl}/v0/inboxes/${encodeURIComponent(input.inboxId)}/messages/${encodeURIComponent(input.messageId)}/reply`
  const response = await fetcher(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify({ text: input.text, html: input.html || undefined, labels: input.labels || [] }),
  })
  const payload = await safeJson(response)
  if (!response.ok) {
    return { ok: false, exact_blocker: normalizeAgentMailSendError({ status: response.status, code: payload.code, message: payload.message }), provider_status: 'http_error', http_status: response.status, ...SAFE }
  }
  return { ok: true, message_id: messageIdFromPayload(payload) || input.messageId, thread_id: threadIdFromPayload(payload) || input.threadId, provider_status: 'sent', ...SAFE }
}

export async function testAgentMailCredential(input: { inboxId: string; apiKey: string; fetchImpl?: typeof fetch; baseUrl?: string }) {
  const fetcher = input.fetchImpl || fetch
  const baseUrl = String(input.baseUrl || process.env.AGENTMAIL_API_BASE_URL || 'https://api.agentmail.to').replace(/\/+$/, '')
  const response = await fetcher(`${baseUrl}/v0/inboxes/${encodeURIComponent(input.inboxId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${input.apiKey}` },
  })
  if (!response.ok) return { ok: false, exact_blocker: normalizeAgentMailSendError({ status: response.status }), http_status: response.status, ...SAFE }
  return { ok: true, http_status: response.status, ...SAFE }
}
