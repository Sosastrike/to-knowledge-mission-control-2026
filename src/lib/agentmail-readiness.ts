import type { MissionControlCanonicalStatus, MissionControlClosureBlockerClass } from './agent-zero-bridge'
import type { ToolErrorKind } from './tool-error-classifier'

const CREDENTIAL_KEYS = ['AGENTMAIL_API_KEY', 'AGENTMAIL_TOKEN', 'AGENTMAIL_API_KEY_FILE'] as const
const INCOMING_ENDPOINT_KEYS = ['AGENTMAIL_STATUS_ENDPOINT', 'AGENTMAIL_INBOX_ENDPOINT'] as const
const SEND_ENDPOINT_KEYS = ['AGENTMAIL_SEND_ENDPOINT'] as const
const ALLOW_LIST_KEYS = ['AGENTMAIL_ALLOWED_DOMAINS', 'AGENTMAIL_ALLOWED_RECIPIENTS'] as const

export type AgentMailReadinessStatus = {
  ok: true
  provider: 'agentmail'
  mode: 'agentmail_readiness'
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  blocker_kind: ToolErrorKind | 'NONE'
  blocked_reason: string | null
  credential_names: string[]
  credential_present: boolean
  credential_values_exposed: false
  incoming: {
    status: 'ready' | 'blocked'
    credential_present: boolean
    backend_configured: boolean
    status_endpoint_configured: boolean
    blocked_reason: string | null
  }
  outgoing: {
    status: 'ready' | 'blocked'
    required_scope: 'agentmail.send'
    bridge_session_required: true
    execution_enabled: false
    writes_enabled: false
    external_write: true
    credential_present: boolean
    send_connector_configured: boolean
    send_endpoint_configured: boolean
    domain_allow_list_configured: boolean
    allowed_domains: string[]
    allowed_recipients_configured: boolean
    blocked_reason: string | null
    no_email_sent: true
    no_fake_done: true
  }
  normal_reply: string
  no_email_sent: true
  no_fake_done: true
  no_tokens_exposed: true
  raw_local_paths_exposed: false
}

function firstPresent(keys: readonly string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()))
}

function parseList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
}

function allowedDomains(): string[] {
  return parseList(process.env.AGENTMAIL_ALLOWED_DOMAINS)
}

function allowedRecipientsConfigured(): boolean {
  return parseList(process.env.AGENTMAIL_ALLOWED_RECIPIENTS).length > 0
}

export function getAgentMailReadiness(): AgentMailReadinessStatus {
  const credentialPresent = firstPresent(CREDENTIAL_KEYS)
  const statusEndpointConfigured = firstPresent(INCOMING_ENDPOINT_KEYS)
  const sendEndpointConfigured = firstPresent(SEND_ENDPOINT_KEYS)
  const domains = allowedDomains()
  const recipientsConfigured = allowedRecipientsConfigured()
  const allowListConfigured = domains.length > 0 || recipientsConfigured
  const incomingBackendConfigured = statusEndpointConfigured
  const sendConnectorConfigured = credentialPresent && sendEndpointConfigured && allowListConfigured

  let canonicalStatus: MissionControlCanonicalStatus = 'READY'
  let blockerClass: MissionControlClosureBlockerClass = 'NONE'
  let blockerKind: AgentMailReadinessStatus['blocker_kind'] = 'NONE'
  let blockedReason: string | null = null

  if (!credentialPresent) {
    canonicalStatus = 'CREDENTIAL_GATED'
    blockerClass = 'CREDENTIAL_GATED'
    blockerKind = 'CREDENTIAL_GATED'
    blockedReason = 'agentmail_credential_required'
  } else if (!incomingBackendConfigured && !sendEndpointConfigured) {
    canonicalStatus = 'BLOCKED'
    blockerClass = 'BLOCKED'
    blockerKind = 'BACKEND_MISSING'
    blockedReason = 'agentmail_backend_adapter_not_configured'
  } else if (sendEndpointConfigured && !allowListConfigured) {
    canonicalStatus = 'OWNER_GATED'
    blockerClass = 'OWNER_GATED'
    blockerKind = 'OWNER_GATED'
    blockedReason = 'agentmail_domain_allow_list_required'
  }

  const incomingBlockedReason = credentialPresent
    ? (incomingBackendConfigured ? null : 'agentmail_incoming_status_endpoint_not_configured')
    : 'agentmail_credential_required'
  const outgoingBlockedReason = credentialPresent
    ? (!sendEndpointConfigured
        ? 'agentmail_send_connector_not_configured'
        : (!allowListConfigured ? 'agentmail_domain_allow_list_required' : null))
    : 'agentmail_credential_required'

  return {
    ok: true,
    provider: 'agentmail',
    mode: 'agentmail_readiness',
    canonical_status: canonicalStatus,
    blocker_class: blockerClass,
    blocker_kind: blockerKind,
    blocked_reason: blockedReason,
    credential_names: [...CREDENTIAL_KEYS],
    credential_present: credentialPresent,
    credential_values_exposed: false,
    incoming: {
      status: credentialPresent && incomingBackendConfigured ? 'ready' : 'blocked',
      credential_present: credentialPresent,
      backend_configured: incomingBackendConfigured,
      status_endpoint_configured: statusEndpointConfigured,
      blocked_reason: incomingBlockedReason,
    },
    outgoing: {
      status: sendConnectorConfigured ? 'ready' : 'blocked',
      required_scope: 'agentmail.send',
      bridge_session_required: true,
      execution_enabled: false,
      writes_enabled: false,
      external_write: true,
      credential_present: credentialPresent,
      send_connector_configured: sendConnectorConfigured,
      send_endpoint_configured: sendEndpointConfigured,
      domain_allow_list_configured: allowListConfigured,
      allowed_domains: domains,
      allowed_recipients_configured: recipientsConfigured,
      blocked_reason: outgoingBlockedReason,
      no_email_sent: true,
      no_fake_done: true,
    },
    normal_reply: blockedReason
      ? `AgentMail readiness is blocked: ${blockedReason}.`
      : 'AgentMail readiness is configured. Sending still requires an approved Bridge Session and allow-listed recipient.',
    no_email_sent: true,
    no_fake_done: true,
    no_tokens_exposed: true,
    raw_local_paths_exposed: false,
  }
}
