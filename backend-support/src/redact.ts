// Redaction helpers — every owner-facing field gets passed through these
// before it leaves the backend. No raw filesystem paths, no bearer tokens,
// no private host:port strings. The contract is "blank slate after redaction".

const ABS_PATH_RE = /(?:\/[A-Za-z0-9._-]+){2,}/g
const HOME_PATH_RE = /\/home\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*/g
const USER_PATH_RE = /\/Users\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*/g
const PRIVATE_HOST_RE = /\b(?:127\.0\.0\.1|localhost|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?\b/g
const SECRET_KEY_RE =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|xox[abp]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|firecrawl-[A-Za-z0-9_-]{16,}|[A-Fa-f0-9]{40,})\b/g
const BEARER_RE = /Bearer\s+[A-Za-z0-9._-]{8,}/gi
const ENV_KV_RE = /(API_KEY|TOKEN|SECRET|PASSWORD|PASSCODE|ACCESS_KEY|SESSION_KEY|COOKIE)=([^\s"']+)/gi

const REDACTED = '[redacted]'

export function redactString(value: string): string {
  if (!value) return value
  return value
    .replace(BEARER_RE, 'Bearer [redacted]')
    .replace(SECRET_KEY_RE, REDACTED)
    .replace(ENV_KV_RE, (_match, key) => `${key}=[redacted]`)
    .replace(USER_PATH_RE, '/Users/[redacted]')
    .replace(HOME_PATH_RE, '/home/[redacted]')
    .replace(PRIVATE_HOST_RE, '[redacted-host]')
    .replace(ABS_PATH_RE, (m) =>
      // Keep API paths (/api/...) and short relative-looking paths visible; redact the rest.
      /^\/api(?:\/|$)/.test(m) || /^\/gateway(?:\/|$)/.test(m) || /^\/agent[s-]/.test(m)
        ? m
        : REDACTED,
    )
}

export function redactObject<T>(value: T): T {
  if (value == null) return value
  if (typeof value === 'string') return redactString(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => redactObject(v)) as unknown as T
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactObject(v)
    }
    return out as unknown as T
  }
  return value
}

// Non-global private host check so call ordering doesn't affect the result
// (.test() on a /g regex is stateful and bites us if we share the constant).
const PRIVATE_HOST_CHECK = /^(?:127\.0\.0\.1|localhost|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|::1|\[::1\])$/

// Origin redaction: strip private hosts, keep only protocol + sanitized authority placeholder.
export function redactOrigin(rawOrigin: string): string {
  if (!rawOrigin) return '[redacted-origin]'
  try {
    const url = new URL(rawOrigin)
    if (PRIVATE_HOST_CHECK.test(url.hostname) || url.hostname === 'localhost') {
      return `${url.protocol}//[redacted-host]`
    }
    return `${url.protocol}//${url.hostname}`
  } catch {
    return '[redacted-origin]'
  }
}
