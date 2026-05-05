import { logger } from './logger'
import type { GatewayRouteClassification } from './gateway-route-planner'
import type { GatewayStatus } from './gateway-model'

export const GATEWAY_POLICY_BADGES = ['read_only', 'session_required', 'blocked', 'active'] as const
export const GATEWAY_ROUTE_DECISIONS = ['allowed', 'blocked', 'requires_session', 'missing_credential'] as const

export type GatewayPolicyBadge = (typeof GATEWAY_POLICY_BADGES)[number]
export type GatewayRouteDecision = (typeof GATEWAY_ROUTE_DECISIONS)[number]

export type GatewayPolicyDecisionStatus = GatewayPolicyBadge

export type GatewayPolicyRule = {
  id: string
  label: string
  enforcement: 'allow' | 'block' | 'requires_session' | 'redact'
  route_decision_on_violation: GatewayRouteDecision
}

export const GATEWAY_POLICY_RULES: GatewayPolicyRule[] = [
  { id: 'read_only_discovery', label: 'Read-only discovery routes can inspect status, catalogs, schemas, tools, skills, and models without execution.', enforcement: 'allow', route_decision_on_violation: 'blocked' },
  { id: 'bridge_session_required', label: 'Side-effectful writes and execution require an active Bridge Session.', enforcement: 'requires_session', route_decision_on_violation: 'requires_session' },
  { id: 'external_write_scoped', label: 'External writes are blocked unless the active Bridge Session includes the exact scope.', enforcement: 'requires_session', route_decision_on_violation: 'blocked' },
  { id: 'protected_action_approval', label: 'Protected actions require owner approval and Bridge Session scope before execution.', enforcement: 'requires_session', route_decision_on_violation: 'requires_session' },
  { id: 'no_raw_paths', label: 'Owner-facing output must not expose raw local runtime paths.', enforcement: 'redact', route_decision_on_violation: 'blocked' },
  { id: 'no_secrets', label: 'Owner-facing output must not expose secrets, tokens, API keys, auth files, or .env values.', enforcement: 'redact', route_decision_on_violation: 'blocked' },
  { id: 'no_fake_done', label: 'Gateway responses must not claim Done when delivery, execution, or connector access is blocked.', enforcement: 'block', route_decision_on_violation: 'blocked' },
  { id: 'no_docker_socket', label: 'Gateway does not grant agents Docker socket access.', enforcement: 'block', route_decision_on_violation: 'blocked' },
  { id: 'no_raw_root_shell', label: 'Gateway does not grant agents raw root shell access.', enforcement: 'block', route_decision_on_violation: 'blocked' },
  { id: 'no_direct_secret_reads', label: 'Gateway does not grant direct secret-reading access.', enforcement: 'block', route_decision_on_violation: 'blocked' },
]

export type GatewayProtectedScope =
  | 'buildwiki.run_now'
  | 'zapier.write'
  | 'heygen.generate'
  | 'google_drive.upload'
  | 'onedrive.upload'
  | 'agentmail.send'
  | 'brain.write'
  | 'protected_action.execute'
  | 'skill.execute'

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
  route_decision: GatewayRouteDecision
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
  docker_socket_allowed: false
  raw_root_shell_allowed: false
  direct_secret_reads_allowed: false
  blocked_reason: string | null
  owner_output_policy: {
    no_keys_tokens_auth_files: true
    no_raw_paths: true
    no_task_ids: true
    no_internal_stage_names: true
    no_fake_done: true
    no_docker_socket: true
    no_raw_root_shell: true
    no_direct_secret_reads: true
  }
}

export type GatewayPolicyAuditEvent = {
  action: 'gateway.policy.decision'
  route_target: string
  status: GatewayPolicyDecisionStatus
  route_decision: GatewayRouteDecision
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
  const forbiddenBlocker = forbiddenSurfaceBlocker(text)
  const routeBlocker = sanitizeBlocker(input.routeBlocker)
  const capabilityBlocker = sanitizeBlocker(input.capabilityBlockers?.[0])
  const capabilityBlocked = input.capabilityStatus === 'blocked' || input.capabilityStatus === 'missing' || input.capabilityStatus === 'missing_credential'
  const missingCredential = isMissingCredentialBlocker(routeBlocker) || isMissingCredentialBlocker(capabilityBlocker) || input.capabilityStatus === 'missing_credential'
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

  let blockedReason = forbiddenBlocker || routeBlocker || (capabilityBlocked ? capabilityBlocker || 'gateway_capability_blocked' : null)
  if (!blockedReason && domainRestricted && !domainAllowed) {
    blockedReason = recipientEmail ? 'agentmail_domain_not_allowed' : 'agentmail_recipient_not_approved'
  }
  if (!blockedReason && input.classification === 'protected_action' && !activeBridgeSession) {
    blockedReason = 'active_bridge_session_required_for_protected_action'
  }
  if (!blockedReason && externalWriteRequested && !activeBridgeSession) {
    blockedReason = 'active_bridge_session_required_for_external_write'
  }
  if (!blockedReason && writeRequested && bridgeSessionRequired && !activeBridgeSession) {
    blockedReason = 'active_bridge_session_required_for_write'
  }
  if (!blockedReason && protectedAction && !activeBridgeSession) {
    blockedReason = 'active_bridge_session_required_for_protected_action'
  }
  if (!blockedReason && requiredScope && !scopeAllowed) {
    blockedReason = `bridge_session_scope_missing:${requiredScope}`
  }

  const allowed = !blockedReason
  const routeDecision = routeDecisionFor({ allowed, blockedReason, missingCredential })
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
    route_decision: routeDecision,
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
    docker_socket_allowed: false,
    raw_root_shell_allowed: false,
    direct_secret_reads_allowed: false,
    blocked_reason: blockedReason,
    owner_output_policy: {
      no_keys_tokens_auth_files: true,
      no_raw_paths: true,
      no_task_ids: true,
      no_internal_stage_names: true,
      no_fake_done: true,
      no_docker_socket: true,
      no_raw_root_shell: true,
      no_direct_secret_reads: true,
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
    route_decision: decision.route_decision,
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
  if (classification === 'skill' && /\b(?:execute|run|activate|install|promote|write)\b.*\bskill\b|\bskill\b.*\b(?:execute|run|activate|install|promote|write)\b/.test(haystack)) {
    return 'skill.execute'
  }
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

function routeDecisionFor(input: { allowed: boolean; blockedReason: string | null; missingCredential: boolean }): GatewayRouteDecision {
  if (input.allowed) return 'allowed'
  if (input.missingCredential || isMissingCredentialBlocker(input.blockedReason)) return 'missing_credential'
  if (/active_bridge_session_required/.test(input.blockedReason || '')) return 'requires_session'
  return 'blocked'
}

function isMissingCredentialBlocker(value: string | null | undefined): boolean {
  return /missing_credential|credential_required|missing credential/i.test(String(value || ''))
}

function forbiddenSurfaceBlocker(text: string): string | null {
  if (/docker\s+socket|docker\.sock|\/var\/run\/docker\.sock/.test(text)) return 'docker_socket_forbidden_by_gateway_policy'
  if (/raw\s+root|root\s+shell|sudo\s+(?:su|-i|bash|sh)|run\s+as\s+root|uid=0/.test(text)) return 'raw_root_shell_forbidden_by_gateway_policy'
  if (/(?:cat|print|show|dump|read|open)\b.*(?:secret|token|api\s*key|auth\s*file|auth\.json|\.env)/.test(text)) return 'direct_secret_read_forbidden_by_gateway_policy'
  return null
}

function sanitizeBlocker(value: string | null | undefined): string | null {
  const text = redactGatewayOwnerOutput(String(value || '').trim())
  return text || null
}

function normalize(value: string): string {
  return redactGatewayOwnerOutput(value).toLowerCase()
}
