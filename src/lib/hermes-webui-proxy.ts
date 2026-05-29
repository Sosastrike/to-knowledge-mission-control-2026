import { NextRequest } from 'next/server'

export const RON_WEBUI_PROXY_BASE_PATH = '/gateway/agent-hub/ron/webui'
export const HERMES_WEBUI_LEGACY_PROXY_BASE_PATH = '/gateway/agent-hub/hermes/webui'
export const HERMES_WEBUI_PROXY_BASE_PATH = RON_WEBUI_PROXY_BASE_PATH
export const DEFAULT_HERMES_WEBUI_LOOPBACK_URL = 'http://127.0.0.1:8787/'

const REQUEST_HEADER_ALLOWLIST = new Set([
  'accept',
  'accept-language',
  'content-type',
  'if-modified-since',
  'if-none-match',
  'range',
  'user-agent',
  'x-hermes-csrf-token',
])

const RESPONSE_HEADER_ALLOWLIST = new Set([
  'accept-ranges',
  'cache-control',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
])

const SAFE_WEBUI_SESSION_ID = /^[A-Za-z0-9._:-]{1,200}$/

function configuredLoopbackUrl() {
  return (process.env.HERMES_WEBUI_URL || DEFAULT_HERMES_WEBUI_LOOPBACK_URL).trim()
}

export function isAllowedHermesWebUiLoopbackUrl(raw = configuredLoopbackUrl()) {
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol)
      && !url.username
      && !url.password
      && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

export function buildHermesWebUiProxyTarget(pathParts: string[] = [], search = '') {
  const base = configuredLoopbackUrl()
  if (!isAllowedHermesWebUiLoopbackUrl(base)) {
    return {
      ok: false as const,
      target: null,
      blocker: 'hermes_webui_url_must_be_loopback',
    }
  }

  const url = new URL(base)
  const upstreamPathParts = pathParts.length === 1 && pathParts[0] === 'app' ? [] : pathParts
  const safePath = upstreamPathParts
    .filter((part) => part.length > 0)
    .map((part) => encodeURIComponent(part))
    .join('/')
  url.pathname = safePath ? `/${safePath}` : '/'
  url.search = search

  return {
    ok: true as const,
    target: url,
    blocker: null,
  }
}

export function deriveHermesWebUiSessionIdFromUrl(raw: string | null | undefined) {
  if (!raw) return null

  try {
    const url = new URL(raw, 'http://mission-control.local')
    const marker = '/session/'
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex < 0) return null

    const encodedSessionId = url.pathname.slice(markerIndex + marker.length).split('/')[0]
    if (!encodedSessionId) return null

    const sessionId = decodeURIComponent(encodedSessionId)
    return SAFE_WEBUI_SESSION_ID.test(sessionId) ? sessionId : null
  } catch {
    return null
  }
}

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasUsableSessionId(body: Record<string, unknown>) {
  return typeof body.session_id === 'string' && body.session_id.trim().length > 0
}

export function shouldRepairHermesWebUiChatStartBody(
  method: string,
  upstreamPathname: string,
  body: unknown,
): body is Record<string, unknown> {
  return method.toUpperCase() === 'POST'
    && upstreamPathname === '/api/chat/start'
    && isPlainJsonObject(body)
    && !hasUsableSessionId(body)
}

export function repairHermesWebUiChatStartBody(
  method: string,
  upstreamPathname: string,
  body: unknown,
  sessionUrl: string | null | undefined,
) {
  if (!shouldRepairHermesWebUiChatStartBody(method, upstreamPathname, body)) {
    return {
      repaired: false as const,
      body,
      sessionId: null,
    }
  }

  const sessionId = deriveHermesWebUiSessionIdFromUrl(sessionUrl)
  if (!sessionId) {
    return {
      repaired: false as const,
      body,
      sessionId: null,
    }
  }

  return {
    repaired: true as const,
    body: {
      ...body,
      session_id: sessionId,
    },
    sessionId,
  }
}

function hermesOnlyCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return ''
  const cookies = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => /^hermes[_-]/i.test(part) || /^hermes_session=/i.test(part))
  return cookies.join('; ')
}

export function buildHermesWebUiProxyRequestHeaders(request: NextRequest) {
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    const normalized = key.toLowerCase()
    if (REQUEST_HEADER_ALLOWLIST.has(normalized)) headers.set(key, value)
  })

  const hermesCookies = hermesOnlyCookieHeader(request.headers.get('cookie'))
  if (hermesCookies) headers.set('cookie', hermesCookies)
  headers.set('x-mission-control-proxy', 'hermes-webui')
  return headers
}

function rewriteProxyPath(raw: string) {
  try {
    const url = new URL(raw, DEFAULT_HERMES_WEBUI_LOOPBACK_URL)
    if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) return raw
    if (url.pathname === '/') return `${HERMES_WEBUI_PROXY_BASE_PATH}/app${url.search}`
    return `${HERMES_WEBUI_PROXY_BASE_PATH}${url.pathname}${url.search}`
  } catch {
    return raw
  }
}

function rewriteSetCookiePath(raw: string) {
  return raw
    .replace(/;\s*Domain=[^;]*/gi, '')
    .replace(/;\s*Path=[^;]*/gi, `; Path=${HERMES_WEBUI_PROXY_BASE_PATH}`)
}

export function buildHermesWebUiProxyResponseHeaders(upstreamHeaders: Headers) {
  const headers = new Headers()
  upstreamHeaders.forEach((value, key) => {
    const normalized = key.toLowerCase()
    if (RESPONSE_HEADER_ALLOWLIST.has(normalized)) headers.set(key, value)
    if (normalized === 'location') headers.set('location', rewriteProxyPath(value))
  })

  const withGetSetCookie = upstreamHeaders as Headers & { getSetCookie?: () => string[] }
  const setCookies = typeof withGetSetCookie.getSetCookie === 'function'
    ? withGetSetCookie.getSetCookie()
    : upstreamHeaders.get('set-cookie')
      ? [upstreamHeaders.get('set-cookie') as string]
      : []

  for (const cookie of setCookies) {
    headers.append('set-cookie', rewriteSetCookiePath(cookie))
  }

  headers.set('x-mission-control-hermes-webui-proxy', 'true')
  headers.set('cache-control', headers.get('cache-control') || 'no-store')
  return headers
}

export function hermesWebUiUnavailableHtml(blocker: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ron Weasley WebUI Unavailable</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #111827; color: #f8fafc; }
    main { max-width: 760px; margin: 12vh auto; padding: 32px; }
    h1 { font-size: 28px; margin: 0 0 12px; }
    p { color: #cbd5e1; line-height: 1.55; }
    code { background: rgba(148, 163, 184, .16); border: 1px solid rgba(148, 163, 184, .24); border-radius: 6px; padding: 2px 6px; }
    a { color: #67e8f9; }
  </style>
</head>
<body>
  <main>
    <h1>Ron Weasley WebUI is not reachable</h1>
    <p>The Mission Control proxy is installed, but the loopback Ron Weasley WebUI service did not answer.</p>
    <p><strong>Blocker:</strong> <code>${blocker.replace(/[<>&"]/g, '')}</code></p>
    <p>Mission Control command center remains available at <a href="/gateway/agent-hub/ron/config">/gateway/agent-hub/ron/config</a>.</p>
  </main>
</body>
</html>`
}
