import type { CanonicalErrorKind, ClassifiedError } from './types.js'
import { redactString } from './redact.js'

// Patterns that map raw errors / states to a canonical error kind.
// Order matters — the first hit wins. Be conservative: if nothing matches, UNKNOWN.
interface Pattern {
  kind: CanonicalErrorKind
  match: (signal: ClassifierInput) => boolean
}

export interface ClassifierInput {
  http_status?: number | null
  message?: string | null
  technical_detail?: string | null
  hint?: string | null
  context?: {
    execution_enabled?: boolean
    writes_enabled?: boolean
    external_writes_enabled?: boolean
    has_credential?: boolean
    has_backend?: boolean
    requires_owner_approval?: boolean
  }
}

const RX_OWNER = /(owner.?gated|owner.?approval|telegram approval|awaiting owner|awaiting approval)/i
const RX_CRED = /(credential|api[_ -]?key|missing.*token|missing.*secret|unauthorized.*key|FIRECRAWL_API_KEY|N8N_API_KEY|ZAPIER_(?:MCP|ACCESS|API))/i
const RX_SERVICE = /(service.*(?:down|unavailable|not running)|systemd.*inactive|systemctl.*failed|connection.?refused|ECONNREFUSED|ENOTFOUND|EAI_AGAIN)/i
const RX_BACKEND = /(backend.*missing|adapter.*missing|not implemented|not_implemented|stub|TODO)/i
const RX_ROUTE = /(route.*missing|404|HTTP 404|page not found)/i
const RX_AUTH = /(401|HTTP 401|authentication.*required|unauthor[is|iz]ed|please log in|sign in)/i
const RX_LOCKED = /(423|HTTP 423|locked|owner.?approval.?required|approval.?gated)/i
const RX_DISABLED = /(execution.*disabled|writes.*disabled|external.*writes.*disabled|read[_ -]?only mode)/i

const PATTERNS: Pattern[] = [
  { kind: 'OWNER_GATED', match: (s) => Boolean(s.context?.requires_owner_approval) },
  { kind: 'OWNER_GATED', match: (s) => Boolean(s.message && (RX_OWNER.test(s.message) || RX_LOCKED.test(s.message))) },
  { kind: 'OWNER_GATED', match: (s) => s.http_status === 423 },
  { kind: 'AUTH_REQUIRED', match: (s) => s.http_status === 401 || (Boolean(s.message) && RX_AUTH.test(s.message ?? '')) },
  { kind: 'OWNER_GATED', match: (s) => s.http_status === 403 },
  { kind: 'CREDENTIAL_GATED', match: (s) => s.context?.has_credential === false },
  { kind: 'CREDENTIAL_GATED', match: (s) => Boolean(s.message && RX_CRED.test(s.message)) },
  { kind: 'SERVICE_DOWN', match: (s) => s.http_status === 502 || s.http_status === 503 || s.http_status === 504 },
  { kind: 'SERVICE_DOWN', match: (s) => Boolean(s.message && RX_SERVICE.test(s.message)) },
  { kind: 'BACKEND_MISSING', match: (s) => s.context?.has_backend === false },
  { kind: 'BACKEND_MISSING', match: (s) => Boolean(s.message && RX_BACKEND.test(s.message)) },
  { kind: 'ROUTE_MISSING', match: (s) => s.http_status === 404 },
  { kind: 'ROUTE_MISSING', match: (s) => Boolean(s.message && RX_ROUTE.test(s.message)) },
  { kind: 'WRITE_DISABLED', match: (s) => s.context?.writes_enabled === false && Boolean(s.message && /writes?.*disabled|read[_ -]?only/i.test(s.message)) },
  { kind: 'EXTERNAL_WRITE_DISABLED', match: (s) => s.context?.external_writes_enabled === false && Boolean(s.message && /external.*write/i.test(s.message)) },
  { kind: 'EXECUTION_DISABLED', match: (s) => s.context?.execution_enabled === false },
  { kind: 'EXECUTION_DISABLED', match: (s) => Boolean(s.message && RX_DISABLED.test(s.message)) },
]

const TEMPLATES: Record<CanonicalErrorKind, { owner: string; next: string; codex_can_fix: boolean; owner_action_required: boolean }> = {
  OWNER_GATED: {
    owner: 'Owner approval is required.',
    next: 'Owner approves the action through Telegram / Mission Control.',
    codex_can_fix: false,
    owner_action_required: true,
  },
  CREDENTIAL_GATED: {
    owner: 'A required credential is missing.',
    next: 'Owner adds the credential through the approved secret path.',
    codex_can_fix: false,
    owner_action_required: true,
  },
  SERVICE_DOWN: {
    owner: 'The backing service is unreachable.',
    next: 'Owner restores or restarts the service.',
    codex_can_fix: false,
    owner_action_required: true,
  },
  BACKEND_MISSING: {
    owner: 'Backend wiring for this feature is not in place yet.',
    next: 'Codex implements the missing backend adapter inside the 100-day plan.',
    codex_can_fix: true,
    owner_action_required: false,
  },
  ROUTE_MISSING: {
    owner: 'This page is not yet wired up.',
    next: 'Codex adds the missing Mission Control / Gateway route.',
    codex_can_fix: true,
    owner_action_required: false,
  },
  AUTH_REQUIRED: {
    owner: 'Sign-in is required to access this view.',
    next: 'Owner signs in through the Mission Control login flow.',
    codex_can_fix: false,
    owner_action_required: true,
  },
  EXECUTION_DISABLED: {
    owner: 'Global execution is currently disabled.',
    next: 'Owner enables execution from the safety panel.',
    codex_can_fix: false,
    owner_action_required: true,
  },
  WRITE_DISABLED: {
    owner: 'Writes are disabled in the current safety mode.',
    next: 'Owner enables writes from the safety panel.',
    codex_can_fix: false,
    owner_action_required: true,
  },
  EXTERNAL_WRITE_DISABLED: {
    owner: 'External writes are disabled in the current safety mode.',
    next: 'Owner enables external writes from the safety panel.',
    codex_can_fix: false,
    owner_action_required: true,
  },
  UNKNOWN: {
    owner: 'Something is off with this view, but the cause is not yet classified.',
    next: 'Codex reads logs and adds a classifier rule for this signal.',
    codex_can_fix: true,
    owner_action_required: false,
  },
}

export function classifyError(input: ClassifierInput): ClassifiedError {
  const matched = PATTERNS.find((p) => {
    try { return p.match(input) } catch { return false }
  })
  const kind: CanonicalErrorKind = matched ? matched.kind : 'UNKNOWN'
  const template = TEMPLATES[kind]
  const technicalSafe = redactString(String(input.technical_detail ?? input.message ?? '')).slice(0, 240) || `kind=${kind}`
  return {
    kind,
    owner_message: template.owner,
    technical_detail: technicalSafe,
    next_action: input.hint ? redactString(String(input.hint)).slice(0, 240) : template.next,
    codex_can_fix: template.codex_can_fix,
    owner_action_required: template.owner_action_required,
  }
}

// Convenience: classify a list and dedupe by (kind, owner_message).
export function classifyErrors(inputs: ReadonlyArray<ClassifierInput>): ClassifiedError[] {
  const out: ClassifiedError[] = []
  const seen = new Set<string>()
  for (const i of inputs) {
    const c = classifyError(i)
    const key = `${c.kind}|${c.owner_message}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}
