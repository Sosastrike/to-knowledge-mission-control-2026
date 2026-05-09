import type { OwnerFacingBlockerClass } from './owner-status'
import { ownerSafeStatusText } from './owner-status'

export const DEFAULT_AUTH_VISUAL_PROOF_ROUTES = [
  '/tkmc',
  '/gateway',
  '/gateway/agent-hub',
  '/gateway/bridge-session',
  '/gateway/agent-hub/paperclip',
] as const

export type AuthVisualProofCaptureMode = 'owner-session-capture' | 'owner-session-required'

export type AuthenticatedVisualProofPlan = {
  generated_at: string
  base_origin: string
  routes: string[]
  cookie_name: string
  owner_session_available: boolean
  capture_mode: AuthVisualProofCaptureMode
  can_capture_screenshots: boolean
  blocker_class: OwnerFacingBlockerClass
  blocker: string | null
}

export type AuthenticatedVisualProofPlanInput = {
  baseUrl: string
  routes?: string | readonly string[] | null
  cookieName?: string | null
  cookieValue?: string | null
  generatedAt?: Date
}

export function buildAuthenticatedVisualProofPlan(input: AuthenticatedVisualProofPlanInput): AuthenticatedVisualProofPlan {
  const ownerSessionAvailable = Boolean(input.cookieValue?.trim())

  return {
    generated_at: (input.generatedAt || new Date()).toISOString(),
    base_origin: safeBaseOrigin(input.baseUrl),
    routes: parseVisualProofRoutes(input.routes),
    cookie_name: normalizeCookieName(input.cookieName),
    owner_session_available: ownerSessionAvailable,
    capture_mode: ownerSessionAvailable ? 'owner-session-capture' : 'owner-session-required',
    can_capture_screenshots: ownerSessionAvailable,
    blocker_class: ownerSessionAvailable ? 'NONE' : 'OWNER_GATED',
    blocker: ownerSessionAvailable ? null : 'owner_authenticated_browser_session_required',
  }
}

export function parseVisualProofRoutes(value?: string | readonly string[] | null): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [...DEFAULT_AUTH_VISUAL_PROOF_ROUTES]

  const routes = values
    .map((item) => normalizeRoute(item))
    .filter((item): item is string => Boolean(item))

  return Array.from(new Set(routes))
}

export function safeVisualProofArtifactName(route: string): string {
  if (isRawLocalPath(route)) return 'redacted-path.png'

  const pathname = normalizeRoute(route)?.replace(/[?#].*$/, '') || '/'
  const stem = pathname
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return `${stem || 'root'}.png`
}

export function redactVisualProofText(value: string): string {
  const authFileRedacted = String(value || '')
    .replace(/(?:\/Users\/|\/home\/|\/var\/folders\/|file:\/\/)[^\s,;)]*auth\.json/gi, '[redacted-auth-file]')
    .replace(/auth\.json/gi, '[redacted-auth-file]')
  return String(ownerSafeStatusText(authFileRedacted) || '')
    .replace(/(?:^|[?&])(token|session|cookie|auth|key)=[^&\s]+/gi, '$1=[redacted]')
    .replace(/mc-session=[^;\s]+/gi, 'mc-session=[redacted]')
}

function safeBaseOrigin(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return 'http://127.0.0.1'
  }
}

function normalizeCookieName(value: string | null | undefined): string {
  const cookieName = String(value || '').trim()
  return /^[A-Za-z0-9_.-]+$/.test(cookieName) ? cookieName : 'mc-session'
}

function normalizeRoute(value: string | null | undefined): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (isRawLocalPath(raw)) return null

  let route = raw
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw)
      route = `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    return null
  }

  if (!route.startsWith('/')) route = `/${route}`
  return route.replace(/\/{2,}/g, '/')
}

function isRawLocalPath(value: string): boolean {
  return /^(?:\/Users\/|\/home\/|\/var\/folders\/|file:\/\/)/i.test(value)
}
