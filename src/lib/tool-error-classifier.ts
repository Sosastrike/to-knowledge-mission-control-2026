export const TOOL_ERROR_KINDS = [
  'OWNER_GATED',
  'CREDENTIAL_GATED',
  'SERVICE_DOWN',
  'BACKEND_MISSING',
  'ROUTE_MISSING',
  'AUTH_REQUIRED',
  'EXECUTION_DISABLED',
  'WRITE_DISABLED',
  'EXTERNAL_WRITE_DISABLED',
  'UNKNOWN',
] as const

export type ToolErrorKind = (typeof TOOL_ERROR_KINDS)[number]

export type ToolErrorClassifierInput = {
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

export type ClassifiedToolError = {
  kind: ToolErrorKind
  owner_message: string
  technical_detail: string
  next_action: string
  codex_can_fix: boolean
  owner_action_required: boolean
}

type Pattern = {
  kind: ToolErrorKind
  match: (signal: ToolErrorClassifierInput) => boolean
}

const RX_OWNER = /(owner.?gated|owner.?approval|telegram approval|awaiting owner|awaiting approval)/i
const RX_CRED = /(credential|api[_ -]?key|missing.*token|missing.*secret|unauthorized.*key|FIRECRAWL_API_KEY|N8N_API_KEY|ZAPIER_(?:MCP|ACCESS|API))/i
const RX_SERVICE = /(service.*(?:down|unavailable|not running)|systemd.*inactive|systemctl.*failed|connection.?refused|ECONNREFUSED|ENOTFOUND|EAI_AGAIN)/i
const RX_BACKEND = /(backend.*missing|adapter.*missing|not implemented|not_implemented|not supported|unsupported|stub|TODO)/i
const RX_ROUTE = /(route.*missing|404|HTTP 404|page not found)/i
const RX_AUTH = /(401|HTTP 401|authentication.*required|unauthori[sz]ed|please log in|sign in)/i
const RX_LOCKED = /(423|HTTP 423|locked|owner.?approval.?required|approval.?gated)/i
const RX_DISABLED = /(execution.*disabled|writes.*disabled|external.*writes.*disabled|read[_ -]?only mode)/i

const PATTERNS: Pattern[] = [
  { kind: 'OWNER_GATED', match: (signal) => Boolean(signal.context?.requires_owner_approval) },
  { kind: 'OWNER_GATED', match: (signal) => Boolean(signal.message && (RX_OWNER.test(signal.message) || RX_LOCKED.test(signal.message))) },
  { kind: 'OWNER_GATED', match: (signal) => signal.http_status === 423 },
  { kind: 'AUTH_REQUIRED', match: (signal) => signal.http_status === 401 || Boolean(signal.message && RX_AUTH.test(signal.message)) },
  { kind: 'OWNER_GATED', match: (signal) => signal.http_status === 403 },
  { kind: 'CREDENTIAL_GATED', match: (signal) => signal.context?.has_credential === false },
  { kind: 'CREDENTIAL_GATED', match: (signal) => Boolean(signal.message && RX_CRED.test(signal.message)) },
  { kind: 'SERVICE_DOWN', match: (signal) => signal.http_status === 502 || signal.http_status === 503 || signal.http_status === 504 },
  { kind: 'SERVICE_DOWN', match: (signal) => Boolean(signal.message && RX_SERVICE.test(signal.message)) },
  { kind: 'BACKEND_MISSING', match: (signal) => signal.context?.has_backend === false },
  { kind: 'BACKEND_MISSING', match: (signal) => Boolean(signal.message && RX_BACKEND.test(signal.message)) },
  { kind: 'ROUTE_MISSING', match: (signal) => signal.http_status === 404 },
  { kind: 'ROUTE_MISSING', match: (signal) => Boolean(signal.message && RX_ROUTE.test(signal.message)) },
  { kind: 'WRITE_DISABLED', match: (signal) => signal.context?.writes_enabled === false && Boolean(signal.message && /writes?.*disabled|read[_ -]?only/i.test(signal.message)) },
  { kind: 'EXTERNAL_WRITE_DISABLED', match: (signal) => signal.context?.external_writes_enabled === false && Boolean(signal.message && /external.*write/i.test(signal.message)) },
  { kind: 'EXECUTION_DISABLED', match: (signal) => signal.context?.execution_enabled === false },
  { kind: 'EXECUTION_DISABLED', match: (signal) => Boolean(signal.message && RX_DISABLED.test(signal.message)) },
]

const TEMPLATES: Record<ToolErrorKind, {
  owner: string
  next: string
  codex_can_fix: boolean
  owner_action_required: boolean
}> = {
  OWNER_GATED: {
    owner: 'Owner approval is required.',
    next: 'Owner approves the exact scoped action through Mission Control or Telegram.',
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
    next: 'Owner or admin restores the service, or Codex records the exact SERVICE_DOWN blocker.',
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
    owner: 'This route is not wired yet.',
    next: 'Codex adds the missing Mission Control or Gateway route.',
    codex_can_fix: true,
    owner_action_required: false,
  },
  AUTH_REQUIRED: {
    owner: 'Sign-in is required.',
    next: 'Owner signs in through Mission Control before retrying.',
    codex_can_fix: false,
    owner_action_required: true,
  },
  EXECUTION_DISABLED: {
    owner: 'Execution is disabled in the current safety mode.',
    next: 'Owner enables execution only when the exact Bridge scope is approved.',
    codex_can_fix: false,
    owner_action_required: true,
  },
  WRITE_DISABLED: {
    owner: 'Writes are disabled in the current safety mode.',
    next: 'Owner enables writes only for an approved scoped action.',
    codex_can_fix: false,
    owner_action_required: true,
  },
  EXTERNAL_WRITE_DISABLED: {
    owner: 'External writes are disabled in the current safety mode.',
    next: 'Owner enables external writes only for an approved scoped connector action.',
    codex_can_fix: false,
    owner_action_required: true,
  },
  UNKNOWN: {
    owner: 'The blocker is not classified yet.',
    next: 'Codex reads safe logs and adds a classifier rule for this signal.',
    codex_can_fix: true,
    owner_action_required: false,
  },
}

const ABS_PATH_RE = /(?:\/[A-Za-z0-9._-]+){2,}/g
const HOME_PATH_RE = /\/home\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*/g
const USER_PATH_RE = /\/Users\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*/g
const PRIVATE_HOST_RE = /\b(?:127\.0\.0\.1|localhost|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?\b/g
const SECRET_KEY_RE = /\b(?:sk-[A-Za-z0-9_-]{16,}|xox[abp]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|firecrawl-[A-Za-z0-9_-]{16,}|[A-Fa-f0-9]{40,})\b/g
const BEARER_RE = /Bearer\s+[A-Za-z0-9._-]{8,}/gi
const ENV_KV_RE = /(API_KEY|TOKEN|SECRET|PASSWORD|PASSCODE|ACCESS_KEY|SESSION_KEY|COOKIE)=([^\s"']+)/gi
const AUTH_FILE_RE = /\b(?:auth\.json|\.env(?:\.[A-Za-z0-9_-]+)?|credentials\.json)\b/gi

function redactString(value: string): string {
  if (!value) return value
  return value
    .replace(BEARER_RE, 'Bearer [redacted]')
    .replace(SECRET_KEY_RE, '[redacted]')
    .replace(ENV_KV_RE, (_match, key) => `${key}=[redacted]`)
    .replace(AUTH_FILE_RE, '[redacted-auth-file]')
    .replace(USER_PATH_RE, '/Users/[redacted]')
    .replace(HOME_PATH_RE, '/home/[redacted]')
    .replace(PRIVATE_HOST_RE, '[redacted-host]')
    .replace(ABS_PATH_RE, (match) =>
      /^\/api(?:\/|$)/.test(match) || /^\/gateway(?:\/|$)/.test(match) || /^\/agent[s-]/.test(match)
        ? match
        : '[redacted]',
    )
}

export function classifyToolError(input: ToolErrorClassifierInput): ClassifiedToolError {
  const matched = PATTERNS.find((pattern) => {
    try {
      return pattern.match(input)
    } catch {
      return false
    }
  })
  const kind = matched?.kind || 'UNKNOWN'
  const template = TEMPLATES[kind]
  const technicalDetail = redactString(String(input.technical_detail ?? input.message ?? '')).slice(0, 240) || `kind=${kind}`

  return {
    kind,
    owner_message: template.owner,
    technical_detail: technicalDetail,
    next_action: input.hint ? redactString(String(input.hint)).slice(0, 240) : template.next,
    codex_can_fix: template.codex_can_fix,
    owner_action_required: template.owner_action_required,
  }
}

export function classifyToolErrors(inputs: readonly ToolErrorClassifierInput[]): ClassifiedToolError[] {
  const output: ClassifiedToolError[] = []
  const seen = new Set<string>()

  for (const input of inputs) {
    const classified = classifyToolError(input)
    const key = `${classified.kind}|${classified.owner_message}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(classified)
  }

  return output
}
