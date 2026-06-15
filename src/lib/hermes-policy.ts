export const HERMES_OPERATING_MODES = [
  'observe',
  'recommend',
  'draft',
  'dispatch',
  'optimize',
  'execute_with_jarvis',
  'nuclear_dispatcher',
] as const

export type HermesOperatingMode = typeof HERMES_OPERATING_MODES[number]

export const HERMES_READINESS_STATES = [
  'observe_ready',
  'recommendation_ready',
  'draft_ready',
  'dispatch_plan_ready',
  'jarvis_delegated_ready',
  'jarvis_concurrence_required',
  'blocked_by_policy',
] as const

export const HERMES_ALLOWED_ACTIONS = [
  'read Mission Control status',
  'read Gateway inventory',
  'read agent roster',
  'read tool/provider/MCP readiness',
  'read Brain and memory status',
  'read Jarvis command registry parity map',
  'execute certified exact-scope adapters when Jarvis signs a delegation packet',
  'create internal recommendations',
  'create internal task plans',
  'create draft skills',
  'create mini-agent task blueprints',
  'create optimization reports',
  'create workflow plans',
  'create route recommendations',
  'create non-destructive internal records',
] as const

export const HERMES_JARVIS_APPROVAL_REQUIRED_FOR = [
  'creating new executable adapters',
  'changing agent responsibilities',
  'changing production workflows',
  'modifying Mission Control source',
  'changing Gateway routing',
  'changing Brain/memory policies',
  'changing Paperclip workflows',
  'enabling external connector execution',
  'creating automation that affects external systems',
  'changing provider/model selection logic',
  'deploying anything to production',
] as const

export const HERMES_OWNER_HARD_STOPS = [
  '.env edits',
  'credential injection',
  'raw secret access',
  'public exposure changes',
  'DNS/Caddy/Tailscale/firewall changes',
  'destructive deletion',
  'disabling auth/audit/rollback/redaction',
  'broad connector execution',
  'social posting',
  'email sends outside certified scope',
  'Drive/OneDrive broad access',
  'spending above approved cap',
] as const

export const HERMES_FORBIDDEN_ACTIONS = [
  'replace Jarvis',
  'bypass Jarvis',
  'bypass Bridge Session',
  'broad connector execution',
  'access secrets',
  'print tokens',
  'print cookies',
  'print auth files',
  'delete production data',
  'modify source without Jarvis concurrence',
  'send external messages',
  'activate workflows',
  'create Zaps',
  'post to social media',
] as const

const ownerHardStopPattern =
  /((?:read|access|print|expose|dump|show|cat|inject|edit|modify|use).{0,80}(?:\.env|credential|secret|tokens?|cookies?|password|auth file)|(?:\.env)\s+(?:edit|write|modify|read)|public exposure|dns|caddy|tailscale|firewall|destructive|delete production|disable auth|disable audit|disable rollback|social posting|social media|post to social|instagram|drive broad|onedrive broad|spend|spending)/i

const jarvisApprovalPattern =
  /(send email|email send|zapier|create zap|activate workflow|execute workflow|external connector|production workflow|modify source|change gateway routing|provider route|model route|paperclip workflow|automation that affects external|deploy)/i

const secretValuePatterns = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /xox[baprs]-[A-Za-z0-9-]+/g,
  /ghp_[A-Za-z0-9_]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
  /[0-9]{9,}:[A-Za-z0-9_-]{20,}/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
]

export function redactHermesValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return secretValuePatterns.reduce((text, pattern) => text.replace(pattern, '<redacted-secret>'), value)
      .replace(/\/home\/[^/\s]+/g, '/<redacted-home>')
      .replace(/\/Users\/[^/\s]+/g, '/<redacted-home>')
  }
  if (Array.isArray(value)) return value.map(redactHermesValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const lower = key.toLowerCase()
      if (lower.includes('secret') || lower.includes('token') || lower.includes('password') || lower.includes('cookie')) {
        return [key, '<redacted>']
      }
      return [key, redactHermesValue(item)]
    }))
  }
  return value
}

function policyText(input: unknown): string {
  if (!input || typeof input !== 'object') return String(input || '')
  if (Array.isArray(input)) return input.map(policyText).join(' ')
  return Object.entries(input as Record<string, unknown>)
    .filter(([key]) => !['forbidden_actions', 'disallowed', 'rollback', 'expected_outcome'].includes(key))
    .map(([, value]) => policyText(value))
    .join(' ')
}

export type HermesPolicyEvaluation =
  | { allowed: false; exact_blocker: 'owner_hard_stop_required'; required_authority: 'jarvis_plus_owner_hard_stop' }
  | { allowed: false; exact_blocker: 'jarvis_approval_required'; required_authority: 'jarvis_concurrence' }
  | { allowed: true; exact_blocker: null; required_authority: 'hermes_internal_record' }

export function evaluateHermesPolicy(input: unknown): HermesPolicyEvaluation {
  const text = policyText(input)
    .replace(/\b(?:without|no|never)\s+(?:raw\s+)?secrets?\b/gi, 'no_sensitive_values')
    .replace(/\b(?:without|no|never)\s+(?:raw\s+)?tokens?\b/gi, 'no_sensitive_values')
  if (ownerHardStopPattern.test(text)) {
    return {
      allowed: false as const,
      exact_blocker: 'owner_hard_stop_required',
      required_authority: 'jarvis_plus_owner_hard_stop',
    }
  }
  if (jarvisApprovalPattern.test(text)) {
    return {
      allowed: false as const,
      exact_blocker: 'jarvis_approval_required',
      required_authority: 'jarvis_concurrence',
    }
  }
  return {
    allowed: true as const,
    exact_blocker: null,
    required_authority: 'hermes_internal_record',
  }
}
