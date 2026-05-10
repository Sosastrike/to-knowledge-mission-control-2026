import Database from 'better-sqlite3'
import { createBridgeApprovalRequest } from './bridge-approval-request-store'
import {
  readLatestAgentZeroBridgeSession,
  recordAgentZeroBridgeSessionAudit,
  type AgentZeroBridgeSessionObject,
  type AgentZeroBridgeSessionRequester,
} from './agent-zero-bridge-session'
import { getAgentMailReadiness } from './agentmail-readiness'
import type { MissionControlCanonicalStatus, MissionControlClosureBlockerClass } from './agent-zero-bridge'

export const AGENTMAIL_SEND_SCOPE = 'agentmail.send' as const
export const AGENTMAIL_SEND_ROUTE = '/api/bridge/agent-zero/agentmail/send' as const

const CREDENTIAL_KEYS = ['AGENTMAIL_API_KEY', 'AGENTMAIL_TOKEN'] as const
const SEND_ENDPOINT_KEY = 'AGENTMAIL_SEND_ENDPOINT' as const
const ALLOW_LIST_KEYS = ['AGENTMAIL_ALLOWED_DOMAINS', 'AGENTMAIL_ALLOWED_RECIPIENTS'] as const

type AgentMailDeliveryStatus = {
  ok: true
  provider: 'agentmail'
  mode: 'agentmail_delivery'
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  blocked_reason: string | null
  credential_present: boolean
  send_endpoint_configured: boolean
  allow_list_configured: boolean
  execution_enabled: false
  writes_enabled: false
  bridge_session_required: true
  required_scope: typeof AGENTMAIL_SEND_SCOPE
  send_endpoint: typeof AGENTMAIL_SEND_ROUTE
  no_email_sent: true
  no_fake_done: true
  no_tokens_exposed: true
}

export type AgentMailSendResult = {
  ok: boolean
  provider: 'agentmail'
  action: typeof AGENTMAIL_SEND_SCOPE
  status: 'blocked' | 'approval_pending' | 'sending' | 'completed' | 'failed'
  accepted_for_execution: boolean
  execution_enabled: false
  writes_enabled: false
  bridge_session_required: true
  owner_approval_required: true
  required_scope: typeof AGENTMAIL_SEND_SCOPE
  credential_present: boolean
  send_connector_configured: boolean
  recipient_domain: string | null
  approval_request_created: boolean
  approval_request_reused: boolean
  approval_request_id: string | null
  approval_state: string | null
  audit_event_id: string | null
  agentmail_message_id: string | null
  blocked_reason: string | null
  normal_reply: string
  no_email_sent: boolean
  no_fake_done: true
  no_tokens_exposed: true
}

function firstEnv(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function splitList(value: string | undefined): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function recipientDomain(recipient: string | null): string | null {
  const trimmed = String(recipient || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return null
  return trimmed.split('@').pop() || null
}

function recipientAllowed(recipient: string, domain: string | null): boolean {
  const normalizedRecipient = recipient.trim().toLowerCase()
  const allowedRecipients = splitList(process.env.AGENTMAIL_ALLOWED_RECIPIENTS)
  const allowedDomains = splitList(process.env.AGENTMAIL_ALLOWED_DOMAINS)
  if (allowedRecipients.includes(normalizedRecipient)) return true
  return Boolean(domain && allowedDomains.includes(domain))
}

function sendInBridgeScope(session: AgentZeroBridgeSessionObject): boolean {
  const joined = [
    ...session.allowed_delivery_surfaces,
    ...session.allowed_integrations,
    ...session.allowed_tools,
  ].join(' ')
  return joined.includes('all_registered_delivery_surfaces')
    || joined.includes('agentmail_if_connector_configured')
    || joined.includes('agentmail_if_configured')
    || joined.includes(AGENTMAIL_SEND_SCOPE)
}

function blockedResult(input: {
  reason: string
  credentialPresent: boolean
  sendConnectorConfigured: boolean
  recipientDomain?: string | null
  normalReply: string
  approvalRequestCreated?: boolean
  approvalRequestReused?: boolean
  approvalRequestId?: string | null
  approvalState?: string | null
  status?: AgentMailSendResult['status']
}): AgentMailSendResult {
  return {
    ok: false,
    provider: 'agentmail',
    action: AGENTMAIL_SEND_SCOPE,
    status: input.status || 'blocked',
    accepted_for_execution: false,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    owner_approval_required: true,
    required_scope: AGENTMAIL_SEND_SCOPE,
    credential_present: input.credentialPresent,
    send_connector_configured: input.sendConnectorConfigured,
    recipient_domain: input.recipientDomain || null,
    approval_request_created: Boolean(input.approvalRequestCreated),
    approval_request_reused: Boolean(input.approvalRequestReused),
    approval_request_id: input.approvalRequestId || null,
    approval_state: input.approvalState || null,
    audit_event_id: null,
    agentmail_message_id: null,
    blocked_reason: input.reason,
    normal_reply: input.normalReply,
    no_email_sent: true,
    no_fake_done: true,
    no_tokens_exposed: true,
  }
}

function messageIdFromResponse(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  const direct = record.id || record.message_id
  if (typeof direct === 'string' && direct.trim()) return direct.trim().slice(0, 120)
  if (typeof direct === 'number') return String(direct)
  const result = record.result
  if (result && typeof result === 'object') {
    const nested = (result as Record<string, unknown>).id || (result as Record<string, unknown>).message_id
    if (typeof nested === 'string' && nested.trim()) return nested.trim().slice(0, 120)
    if (typeof nested === 'number') return String(nested)
  }
  return null
}

export function getAgentMailDeliveryStatus(): AgentMailDeliveryStatus {
  const readiness = getAgentMailReadiness()
  const credentialPresent = Boolean(firstEnv(CREDENTIAL_KEYS) || process.env.AGENTMAIL_API_KEY_FILE)
  const sendEndpointConfigured = Boolean(process.env[SEND_ENDPOINT_KEY]?.trim())
  const allowListConfigured = ALLOW_LIST_KEYS.some((key) => Boolean(process.env[key]?.trim()))
  const blockedReason = !credentialPresent
    ? 'agentmail_credential_required'
    : !sendEndpointConfigured
      ? 'agentmail_send_connector_not_configured'
      : !allowListConfigured
        ? 'agentmail_domain_allow_list_required'
        : 'active_bridge_session_required'
  const canonicalStatus: MissionControlCanonicalStatus = !credentialPresent
    ? 'CREDENTIAL_GATED'
    : !sendEndpointConfigured
      ? 'BLOCKED'
      : !allowListConfigured
        ? 'OWNER_GATED'
        : 'OWNER_GATED'
  const blockerClass: MissionControlClosureBlockerClass = readiness.blocker_class === 'NONE'
    ? 'OWNER_GATED'
    : readiness.blocker_class

  return {
    ok: true,
    provider: 'agentmail',
    mode: 'agentmail_delivery',
    canonical_status: canonicalStatus,
    blocker_class: blockerClass,
    blocked_reason: blockedReason,
    credential_present: credentialPresent,
    send_endpoint_configured: sendEndpointConfigured,
    allow_list_configured: allowListConfigured,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    required_scope: AGENTMAIL_SEND_SCOPE,
    send_endpoint: AGENTMAIL_SEND_ROUTE,
    no_email_sent: true,
    no_fake_done: true,
    no_tokens_exposed: true,
  }
}

export async function sendAgentMailMessage(input: {
  db?: Database.Database
  requester: AgentZeroBridgeSessionRequester
  bridgeSessionId?: string | null
  recipient?: string | null
  subject?: string | null
  text?: string | null
  idempotencyKey?: string | null
}): Promise<AgentMailSendResult> {
  const credential = firstEnv(CREDENTIAL_KEYS)
  const endpoint = process.env[SEND_ENDPOINT_KEY]?.trim() || ''
  const recipient = String(input.recipient || '').trim().toLowerCase()
  const domain = recipientDomain(recipient)
  const subject = String(input.subject || '').trim()
  const text = String(input.text || '').trim()
  const sendConnectorConfigured = Boolean(credential && endpoint)

  if (!credential) {
    return blockedResult({
      reason: 'agentmail_credential_required',
      credentialPresent: false,
      sendConnectorConfigured: false,
      recipientDomain: domain,
      normalReply: 'AgentMail send is blocked because the AgentMail credential is not configured.',
    })
  }

  if (!endpoint) {
    return blockedResult({
      reason: 'agentmail_send_connector_not_configured',
      credentialPresent: true,
      sendConnectorConfigured: false,
      recipientDomain: domain,
      normalReply: 'AgentMail send is blocked because the AgentMail send connector endpoint is not configured.',
    })
  }

  if (!domain || !subject || !text) {
    return blockedResult({
      reason: 'agentmail_payload_invalid',
      credentialPresent: true,
      sendConnectorConfigured,
      recipientDomain: domain,
      normalReply: 'AgentMail send is blocked because recipient, subject, and text are required.',
    })
  }

  if (!recipientAllowed(recipient, domain)) {
    return blockedResult({
      reason: 'agentmail_recipient_not_allowed',
      credentialPresent: true,
      sendConnectorConfigured,
      recipientDomain: domain,
      normalReply: 'AgentMail send is blocked because the recipient is outside the approved domain/recipient allow-list.',
    })
  }

  const bridge = readLatestAgentZeroBridgeSession({
    db: input.db,
    workspaceId: input.requester.workspaceId,
    tenantId: input.requester.tenantId,
    sync: true,
  }).session

  if (!bridge.session_id || bridge.status !== 'active' || !bridge.execution_enabled) {
    const approval = createBridgeApprovalRequest({
      db: input.db,
      requester: input.requester,
      connector: 'agentmail',
      action: AGENTMAIL_SEND_SCOPE,
      target: domain,
      targetKey: AGENTMAIL_SEND_SCOPE,
      riskLevel: 'high',
      protectedCategory: 'external_automation',
      approvalScope: {
        route: AGENTMAIL_SEND_ROUTE,
        required_scope: AGENTMAIL_SEND_SCOPE,
        recipient_domain: domain,
        bridge_session_required: true,
        external_write: true,
        no_fake_done: true,
      },
      reason: 'AgentMail send requires owner approval, an active Bridge Session, and an allow-listed recipient.',
      idempotencyKey: input.idempotencyKey || `agentmail.send:${input.requester.workspaceId}:${input.requester.tenantId}:${domain}:${subject}`,
    })
    return blockedResult({
      reason: bridge.blocked_reason || (bridge.status === 'pending_approval' ? 'owner_approval_pending' : 'active_bridge_session_required'),
      credentialPresent: true,
      sendConnectorConfigured,
      recipientDomain: domain,
      normalReply: 'AgentMail send is approval pending and will not execute until the owner approves a scoped Bridge Session.',
      approvalRequestCreated: approval.approval_request_created,
      approvalRequestReused: approval.approval_request_reused,
      approvalRequestId: approval.approval_request_id,
      approvalState: approval.approval_state,
      status: 'approval_pending',
    })
  }

  if (input.bridgeSessionId && input.bridgeSessionId !== bridge.session_id) {
    return blockedResult({
      reason: 'bridge_session_mismatch',
      credentialPresent: true,
      sendConnectorConfigured,
      recipientDomain: domain,
      normalReply: 'AgentMail send is blocked because the provided Bridge Session does not match the active approved session.',
    })
  }

  if (!sendInBridgeScope(bridge)) {
    return blockedResult({
      reason: 'agentmail_send_not_in_bridge_session_scope',
      credentialPresent: true,
      sendConnectorConfigured,
      recipientDomain: domain,
      normalReply: 'AgentMail send is blocked because the active Bridge Session does not include AgentMail send scope.',
    })
  }

  const audit = recordAgentZeroBridgeSessionAudit({
    db: input.db,
    sessionId: bridge.session_id,
    requester: input.requester,
    agentId: 'agent_zero',
    action: AGENTMAIL_SEND_SCOPE,
    target: domain,
    outcome: 'approved_for_send',
    metadata: {
      provider: 'agentmail',
      recipient_domain: domain,
      bridge_session_required: true,
      no_fake_done: true,
      no_tokens_exposed: true,
    },
  })

  if (!audit.ok || !audit.audit_event?.id) {
    return blockedResult({
      reason: audit.blocked_reason || 'agentmail_delivery_audit_required',
      credentialPresent: true,
      sendConnectorConfigured,
      recipientDomain: domain,
      normalReply: 'AgentMail send is blocked because the Bridge Session audit record could not be written.',
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${credential}`,
      },
      body: JSON.stringify({ to: recipient, subject, text }),
      signal: controller.signal,
    })
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    const ok = response.ok && (!(body && typeof body === 'object' && 'ok' in body) || (body as Record<string, unknown>).ok !== false)
    if (!ok) {
      return {
        ok: false,
        provider: 'agentmail',
        action: AGENTMAIL_SEND_SCOPE,
        status: 'failed',
        accepted_for_execution: false,
        execution_enabled: false,
        writes_enabled: false,
        bridge_session_required: true,
        owner_approval_required: true,
        required_scope: AGENTMAIL_SEND_SCOPE,
        credential_present: true,
        send_connector_configured: true,
        recipient_domain: domain,
        approval_request_created: false,
        approval_request_reused: false,
        approval_request_id: bridge.approval_request_id,
        approval_state: 'approved',
        audit_event_id: audit.audit_event.id,
        agentmail_message_id: null,
        blocked_reason: `agentmail_api_error_${response.status}`,
        normal_reply: 'AgentMail send failed at the connector boundary. No fake delivery was reported.',
        no_email_sent: true,
        no_fake_done: true,
        no_tokens_exposed: true,
      }
    }

    return {
      ok: true,
      provider: 'agentmail',
      action: AGENTMAIL_SEND_SCOPE,
      status: 'completed',
      accepted_for_execution: true,
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required: true,
      owner_approval_required: true,
      required_scope: AGENTMAIL_SEND_SCOPE,
      credential_present: true,
      send_connector_configured: true,
      recipient_domain: domain,
      approval_request_created: false,
      approval_request_reused: false,
      approval_request_id: bridge.approval_request_id,
      approval_state: 'approved',
      audit_event_id: audit.audit_event.id,
      agentmail_message_id: messageIdFromResponse(body),
      blocked_reason: null,
      normal_reply: 'AgentMail send completed through the approved Agent Zero Bridge Session.',
      no_email_sent: false,
      no_fake_done: true,
      no_tokens_exposed: true,
    }
  } catch {
    return {
      ok: false,
      provider: 'agentmail',
      action: AGENTMAIL_SEND_SCOPE,
      status: 'failed',
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required: true,
      owner_approval_required: true,
      required_scope: AGENTMAIL_SEND_SCOPE,
      credential_present: true,
      send_connector_configured: true,
      recipient_domain: domain,
      approval_request_created: false,
      approval_request_reused: false,
      approval_request_id: bridge.approval_request_id,
      approval_state: 'approved',
      audit_event_id: audit.audit_event.id,
      agentmail_message_id: null,
      blocked_reason: 'agentmail_api_request_failed',
      normal_reply: 'AgentMail send failed before confirmation from the AgentMail connector.',
      no_email_sent: true,
      no_fake_done: true,
      no_tokens_exposed: true,
    }
  } finally {
    clearTimeout(timeout)
  }
}
