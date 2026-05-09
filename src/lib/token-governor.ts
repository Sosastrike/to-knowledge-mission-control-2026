import { createHash } from 'crypto'

export type TokenGovernorScope = 'company' | 'agent' | 'project' | 'goal' | 'model_provider'
export type TokenGovernorDecision = 'allow' | 'warn' | 'block'
export type TokenGovernorStatus = 'within_budget' | 'warning' | 'blocked' | 'missing_budget' | 'model_restricted'

export type TokenGovernorPreflightInput = {
  scope: string
  subjectId?: string | null
  subjectName?: string | null
  model?: string | null
  spentCents?: number | null
  projectedCents?: number | null
  budgetCents?: number | null
  warningPercent?: number | null
  hardStopPercent?: number | null
  restrictedModels?: string[] | null
}

export type TokenGovernorAuditEvent = {
  event: 'token_governor.preflight'
  audit_id: string
  scope: TokenGovernorScope
  subject_id: string
  subject_name: string
  model: string | null
  decision: TokenGovernorDecision
  status: TokenGovernorStatus
  blocked_reason: string | null
  spent_cents: number
  projected_cents: number
  budget_cents: number | null
  usage_percent: number | null
  recorded_at: string
  external_write: false
  execution_enabled: false
  writes_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type TokenGovernorPreflightResult = {
  ok: boolean
  mode: 'gateway_token_governor_preflight'
  generated_at: string
  enforcement_enabled: true
  decision: TokenGovernorDecision
  status: TokenGovernorStatus
  blocker_class: 'NONE' | 'OWNER_GATED' | 'BLOCKED'
  blocked_reason: string | null
  scope: TokenGovernorScope
  subject_id: string
  subject_name: string
  model: string | null
  spent_cents: number
  projected_cents: number
  budget_cents: number | null
  usage_percent: number | null
  warning_threshold_percent: number
  hard_stop_threshold_percent: number
  audit_event: TokenGovernorAuditEvent
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  no_provider_route_change: true
  no_secrets_exposed: true
  raw_paths_exposed: false
  owner_visible_summary: string
}

const TOKEN_GOVERNOR_SCOPES: TokenGovernorScope[] = ['company', 'agent', 'project', 'goal', 'model_provider']
const DEFAULT_RESTRICTED_MODELS = [
  'claude-opus',
  'opus',
  'gpt-4.5',
  'gpt-5-high',
  'deep-research',
  'heygen',
]

export function evaluateTokenGovernorPreflight(
  input: TokenGovernorPreflightInput,
  generatedAt = new Date().toISOString(),
): TokenGovernorPreflightResult {
  const scope = normalizeTokenGovernorScope(input.scope)
  const subjectId = sanitizeTokenGovernorIdentifier(input.subjectId || `${scope}_budget`) || `${scope}_budget`
  const subjectName = sanitizeTokenGovernorText(input.subjectName || subjectId).slice(0, 160) || subjectId
  const model = sanitizeTokenGovernorText(input.model || '').slice(0, 120) || null
  const spent = normalizeCents(input.spentCents)
  const projected = normalizeCents(input.projectedCents)
  const budget = typeof input.budgetCents === 'number' && Number.isFinite(input.budgetCents) && input.budgetCents >= 0
    ? Math.round(input.budgetCents)
    : null
  const warningThreshold = normalizePercent(input.warningPercent, 75)
  const hardStopThreshold = normalizePercent(input.hardStopPercent, 90)
  const usagePercent = budget === null || budget === 0 ? null : roundPercent(((spent + projected) / budget) * 100)
  const restrictedModels = normalizeRestrictedModels(input.restrictedModels)
  const modelRestricted = Boolean(model && restrictedModels.some((pattern) => model.toLowerCase().includes(pattern)))

  let decision: TokenGovernorDecision = 'allow'
  let status: TokenGovernorStatus = 'within_budget'
  let blockerClass: TokenGovernorPreflightResult['blocker_class'] = 'NONE'
  let blockedReason: string | null = null

  if (modelRestricted) {
    decision = 'block'
    status = 'model_restricted'
    blockerClass = 'BLOCKED'
    blockedReason = 'token_governor_model_restricted'
  } else if (budget === null) {
    decision = 'block'
    status = 'missing_budget'
    blockerClass = 'OWNER_GATED'
    blockedReason = 'token_governor_budget_missing'
  } else if (usagePercent !== null && usagePercent >= hardStopThreshold) {
    decision = 'block'
    status = 'blocked'
    blockerClass = 'BLOCKED'
    blockedReason = 'token_governor_budget_exhausted'
  } else if (usagePercent !== null && usagePercent >= warningThreshold) {
    decision = 'warn'
    status = 'warning'
    blockerClass = 'NONE'
    blockedReason = 'token_governor_budget_warning'
  }

  const auditEvent: TokenGovernorAuditEvent = {
    event: 'token_governor.preflight',
    audit_id: createTokenGovernorAuditId(generatedAt, scope, subjectId, model, decision),
    scope,
    subject_id: subjectId,
    subject_name: subjectName,
    model,
    decision,
    status,
    blocked_reason: blockedReason,
    spent_cents: spent,
    projected_cents: projected,
    budget_cents: budget,
    usage_percent: usagePercent,
    recorded_at: generatedAt,
    external_write: false,
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }

  return {
    ok: decision !== 'block',
    mode: 'gateway_token_governor_preflight',
    generated_at: generatedAt,
    enforcement_enabled: true,
    decision,
    status,
    blocker_class: blockerClass,
    blocked_reason: blockedReason,
    scope,
    subject_id: subjectId,
    subject_name: subjectName,
    model,
    spent_cents: spent,
    projected_cents: projected,
    budget_cents: budget,
    usage_percent: usagePercent,
    warning_threshold_percent: warningThreshold,
    hard_stop_threshold_percent: hardStopThreshold,
    audit_event: auditEvent,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_provider_route_change: true,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    owner_visible_summary: summarizeTokenGovernorDecision(decision, blockedReason),
  }
}

export function normalizeTokenGovernorScope(value: string | null | undefined): TokenGovernorScope {
  const normalized = sanitizeTokenGovernorIdentifier(value || '').replace(/-/g, '_')
  return TOKEN_GOVERNOR_SCOPES.includes(normalized as TokenGovernorScope)
    ? normalized as TokenGovernorScope
    : 'project'
}

export function sanitizeTokenGovernorText(value: string): string {
  return value
    .replace(/\/Users\/[^\s,;)]+/gi, '[redacted-path]')
    .replace(/\/home\/[^\s,;)]+/gi, '[redacted-path]')
    .replace(/\/a0\/(?:usr|tmp|var)[^\s,;)]+/gi, '[redacted-path]')
    .replace(/\b(?:Bearer\s+)?(?:sk|fc|ghp|xoxb|xoxp)-[A-Za-z0-9._-]{12,}/gi, '<redacted-secret>')
    .replace(/\b(api[_-]?key|token|secret)\s*[=:]\s*['"]?[A-Za-z0-9._-]{12,}/gi, '$1=<redacted>')
    .trim()
}

function normalizeCents(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function normalizePercent(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(100, Math.round(value)))
    : fallback
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10
}

function sanitizeTokenGovernorIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.+-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96)
}

function normalizeRestrictedModels(values: string[] | null | undefined): string[] {
  const incoming = Array.isArray(values) && values.length > 0 ? values : DEFAULT_RESTRICTED_MODELS
  return Array.from(new Set(
    incoming
      .map((value) => sanitizeTokenGovernorText(String(value)).toLowerCase().trim())
      .filter(Boolean)
  ))
}

function createTokenGovernorAuditId(
  generatedAt: string,
  scope: TokenGovernorScope,
  subjectId: string,
  model: string | null,
  decision: TokenGovernorDecision,
): string {
  const hash = createHash('sha256')
    .update([generatedAt, scope, subjectId, model || '', decision].join('|'))
    .digest('hex')
    .slice(0, 16)
  return `tg_${hash}`
}

function summarizeTokenGovernorDecision(decision: TokenGovernorDecision, blocker: string | null): string {
  if (decision === 'allow') return 'Token Governor preflight allows the request within the configured budget. No execution happens in this check.'
  if (decision === 'warn') return 'Token Governor preflight warns that the request is close to the budget threshold. Execution still requires the caller policy path.'
  return `Token Governor preflight blocks the request: ${blocker || 'token_governor_blocked'}.`
}
