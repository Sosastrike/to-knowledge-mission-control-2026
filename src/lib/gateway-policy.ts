import { logger } from './logger'
import type { GatewayRouteClassification } from './gateway-route-planner'
import type { GatewayStatus } from './gateway-model'

export const GATEWAY_POLICY_BADGES = ['read_only', 'session_required', 'blocked', 'active'] as const

export type GatewayPolicyBadge = (typeof GATEWAY_POLICY_BADGES)[number]

export type GatewayPolicyDecisionStatus = GatewayPolicyBadge

export type GatewayProtectedScope =
  | 'buildwiki.run_now'
  | 'zapier.write'
  | 'heygen.generate'
  | 'google_drive.upload'
  | 'onedrive.upload'
  | 'agentmail.send'
  | 'brain.write'
  | 'protected_action.execute'

export type GatewayPolicyEvaluationInput = {
  classification: GatewayRouteClassification
  ownerRequest: string
  routeTarget: string
  capabilityId?: string | null
  capabilityStatus?: GatewayStatus | string | null
  capabilityBlockers?: string[]
  routeBlocker?: string | null
  requiresBridgeSession?: boolean
  bridgeSessionActive?: boolean
  allowedScopes?: string[]
  allowedEmailDomains?: string[]
  recipientEmail?: string | null
}

export type GatewayPolicyDecision = {
  ok: boolean
  mode: 'gateway_policy_decision'
  status: GatewayPolicyDecisionStatus
  badge: GatewayPolicyBadge
  allowed: boolean
  read_only: boolean
  bridge_session_required: boolean
  active_bridge_session: boolean
  write_requested: boolean
  external_write_requested: boolean
  protected_action: boolean
  required_scope: GatewayProtectedScope | null
  scope_allowed: boolean
  domain_restricted: boolean
  domain_allowed: boolean
  redaction_required: true
  route_auth_required: true
  audit_required: boolean
  blocked_reason: string | null
  owner_output_policy: {
    no_keys_tokens_auth_files: true
    no_raw_paths: true
    no_task_ids: true
    no_internal_stage_names: true
  }
}

export type GatewayPolicyAuditEvent = {
  action: 'gateway.policy.decision'
  route_target: string
  status: GatewayPolicyDecisionStatus
  badge: GatewayPolicyBadge
  allowed: boolean
  blocked_reason: string | null
  required_scope: GatewayProtectedScope | null
  external_write_requested: boolean
  active_bridge_session: boolean
}

const SECRETISH_PATTERN =
  /(sk-[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?FILE)\s*[:=]\s*[^,\s}]+)/gi
const RAW_PATH_PATTERN = /(?:\/home\/tony|\/a0\/(?:usr|tmp|var)|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi
const TASK_ID_PATTERN = /\b(?:task|session|approval|report)[_-][a-z0-9][a-z0-9_-]{5,}\b/gi
const INTERNAL_STAGE_PATTERN = /\b(?:Failed stage|Error stage|Traceback|Stack trace|file_recall)\b/gi

export function evaluateGatewayPolicy(input: GatewayPolicyEvaluationInput): GatewayPolicyDecision {
  const text = normalize(input.ownerRequest)
  const routeBlocker = sanitizeBlocker(input.routeBlocker)
  const capabilityBlocker = sanitizeBlocker(input.capabilityBlockers?.[0])
  const capabilityBlocked = input.capabilityStatus === 'blocked' || input.capabilityStatus === 'missing'
  const requiredScope = getRequiredScope(input.classification, text, input.capabilityId, input.routeTarget)
  const writeRequested = isWriteIntent(input.classification, text)
  const externalWriteRequested = isExternalWrite(input.classification, text, input.capabilityId, input.routeTarget)
  const protectedAction = Boolean(requiredScope) || input.classification === 'protected_action'
  const bridgeSessionRequired = Boolean(input.requiresBridgeSession || writeRequested || externalWriteRequested || protectedAction)
  const activeBridgeSession = Boolean(input.bridgeSessionActive)
  const scopeAllowed = !requiredScope || input.allowedScopes?.includes(requiredScope) || input.allowedScopes?.includes('all_registered_tools') || false
  const recipientEmail = extractRecipientEmail(input.recipientEmail || input.ownerRequest)
  const domainRestricted = Boolean(
    requiredScope === 'agentmail.send' ||
    (/agentmail|email|reply|send mail/.test(text) && /send|reply/.test(text)),
  )
  const domainAllowed = !domainRestricted || isAllowedEmail(recipientEmail, input.allowedEmailDomains || [])

  let blockedReason = routeBlocker || (capabilityBlocked ? capabilityBlocker || 'gateway_capability_blocked' : null)
  if (!blockedReason && domainRestricted && !domainAllowed) {
    blockedReason = recipientEmail ? 'agentmail_domain_not_allowed' : 'agentmail_recipient_not_approved'
  }
  if (!blockedReason && externalWriteRequested && !activeBridgeSession) {
    blockedReason = 'active_bridge_session_required_for_external_write'
  }
  if (!blockedReason && protectedAction && !activeBridgeSession) {
    blockedReason = 'active_bridge_session_required_for_protected_action'
  }
  if (!blockedReason && requiredScope && !scopeAllowed) {
    blockedReason = `bridge_session_scope_missing:${requiredScope}`
  }

  const allowed = !blockedReason
  const status: GatewayPolicyDecisionStatus = !allowed
    ? 'blocked'
    : activeBridgeSession && (externalWriteRequested || protectedAction)
      ? 'active'
      : bridgeSessionRequired
        ? 'session_required'
        : 'read_only'

  return {
    ok: allowed,
    mode: 'gateway_policy_decision',
    status,
    badge: status,
    allowed,
    read_only: status === 'read_only',
    bridge_session_required: bridgeSessionRequired,
    active_bridge_session: activeBridgeSession,
    write_requested: writeRequested,
    external_write_requested: externalWriteRequested,
    protected_action: protectedAction,
    required_scope: requiredScope,
    scope_allowed: scopeAllowed,
    domain_restricted: domainRestricted,
    domain_allowed: domainAllowed,
    redaction_required: true,
    route_auth_required: true,
    audit_required: !allowed || status === 'active',
    blocked_reason: blockedReason,
    owner_output_policy: {
      no_keys_tokens_auth_files: true,
      no_raw_paths: true,
      no_task_ids: true,
      no_internal_stage_names: true,
    },
  }
}

export function redactGatewayOwnerOutput(value: string): string {
  return String(value || '')
    .replace(SECRETISH_PATTERN, '[redacted]')
    .replace(RAW_PATH_PATTERN, '[path redacted]')
    .replace(TASK_ID_PATTERN, '[id redacted]')
    .replace(INTERNAL_STAGE_PATTERN, '[internal detail redacted]')
}

export function gatewayPolicyBadges(decision: GatewayPolicyDecision): GatewayPolicyBadge[] {
  const badges = new Set<GatewayPolicyBadge>()
  badges.add(decision.badge)
  if (decision.bridge_session_required) badges.add('session_required')
  if (!decision.allowed) badges.add('blocked')
  if (decision.read_only) badges.add('read_only')
  if (decision.status === 'active') badges.add('active')
  return [...badges]
}

export function auditGatewayPolicyDecision(
  decision: GatewayPolicyDecision,
  routeTarget: string,
  auditSink?: (event: GatewayPolicyAuditEvent) => void,
): GatewayPolicyAuditEvent | null {
  if (!decision.audit_required) return null
  const event: GatewayPolicyAuditEvent = {
    action: 'gateway.policy.decision',
    route_target: routeTarget,
    status: decision.status,
    badge: decision.badge,
    allowed: decision.allowed,
    blocked_reason: decision.blocked_reason,
    required_scope: decision.required_scope,
    external_write_requested: decision.external_write_requested,
    active_bridge_session: decision.active_bridge_session,
  }
  auditSink?.(event)
  logger.info(event, 'Gateway policy decision')
  return event
}

function getRequiredScope(
  classification: GatewayRouteClassification,
  text: string,
  capabilityId: string | null | undefined,
  routeTarget: string,
): GatewayProtectedScope | null {
  const haystack = `${text} ${capabilityId || ''} ${routeTarget}`.toLowerCase()
  if (/build[-\s]?wiki|farmer|run now/.test(haystack)) return 'buildwiki.run_now'
  if (/zapier/.test(haystack) && /write|create|update|send|execute|run/.test(haystack)) return 'zapier.write'
  if (/heygen/.test(haystack) && /generate|create|render|execute|run/.test(haystack)) return 'heygen.generate'
  if (/one[_\s-]?drive|onedrive/.test(haystack) && /upload|attach|write|send/.test(haystack)) return 'onedrive.upload'
  if (/google[_\s-]?drive|drive/.test(haystack) && /upload|attach|write|send/.test(haystack)) return 'google_drive.upload'
  if (/agentmail|email|send mail|reply/.test(haystack) && /send|reply|write/.test(haystack)) return 'agentmail.send'
  if (classification === 'memory' && /write|save|remember|append|update|create|tag|link/.test(haystack)) return 'brain.write'
  if (classification === 'protected_action') return 'protected_action.execute'
  return null
}

function isWriteIntent(classification: GatewayRouteClassification, text: string): boolean {
  return ['upload', 'protected_action'].includes(classification) ||
    /write|save|send|reply|upload|attach|generate|create video|run now|execute|start|stop|restart|delete|destroy|mount/.test(text)
}

function isExternalWrite(classification: GatewayRouteClassification, text: string, capabilityId?: string | null, routeTarget?: string): boolean {
  const haystack = `${text} ${capabilityId || ''} ${routeTarget || ''}`.toLowerCase()
  return ['upload', 'protected_action'].includes(classification) ||
    /zapier|heygen|google[_\s-]?drive|one[_\s-]?drive|onedrive|agentmail|email|telegram attachment|build[-\s]?wiki|farmer/.test(haystack) &&
    /write|send|reply|upload|attach|generate|run now|execute|start|dispatch/.test(haystack)
}

function extractRecipientEmail(value: string): string | null {
  return String(value || '').match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i)?.[0].toLowerCase() || null
}

function isAllowedEmail(email: string | null, allowedDomains: string[]): boolean {
  if (!email) return false
  const domain = email.split('@').pop() || ''
  return allowedDomains.some((entry) => {
    const normalized = entry.toLowerCase().replace(/^@/, '')
    return normalized.includes('@') ? email === normalized : domain === normalized
  })
}

function sanitizeBlocker(value: string | null | undefined): string | null {
  const text = redactGatewayOwnerOutput(String(value || '').trim())
  return text || null
}

function normalize(value: string): string {
  return redactGatewayOwnerOutput(value).toLowerCase()
}
