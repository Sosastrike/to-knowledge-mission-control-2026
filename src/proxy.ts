import crypto from 'node:crypto'
import os from 'node:os'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { buildMissionControlCsp, buildNonceRequestHeaders } from '@/lib/csp'
import { MC_SESSION_COOKIE_NAME, LEGACY_MC_SESSION_COOKIE_NAME } from '@/lib/session-cookie'

/** Constant-time string comparison using Node.js crypto. */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function envFlag(name: string): boolean {
  const raw = process.env[name]
  if (raw === undefined) return false
  const v = String(raw).trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function normalizeHostname(raw: string): string {
  return raw.trim().replace(/^\[|\]$/g, '').split(':')[0].replace(/\.$/, '').toLowerCase()
}

function parseForwardedHost(forwarded: string | null): string[] {
  if (!forwarded) return []
  const hosts: string[] = []
  for (const part of forwarded.split(',')) {
    const match = /(?:^|;)\s*host="?([^";]+)"?/i.exec(part)
    if (match?.[1]) hosts.push(match[1])
  }
  return hosts
}

function getRequestHostCandidates(request: NextRequest): string[] {
  const rawCandidates = [
    ...(request.headers.get('x-forwarded-host') || '').split(','),
    ...(request.headers.get('x-original-host') || '').split(','),
    ...(request.headers.get('x-forwarded-server') || '').split(','),
    ...parseForwardedHost(request.headers.get('forwarded')),
    request.headers.get('host') || '',
    request.nextUrl.host || '',
    request.nextUrl.hostname || '',
  ]

  const candidates = rawCandidates
    .map(normalizeHostname)
    .filter(Boolean)

  return [...new Set(candidates)]
}

function getImplicitAllowedHosts(): string[] {
  const candidates = [
    'localhost',
    '127.0.0.1',
    '::1',
    normalizeHostname(os.hostname()),
  ].filter(Boolean)

  return [...new Set(candidates)]
}

function hostMatches(pattern: string, hostname: string): boolean {
  const p = normalizeHostname(pattern)
  const h = normalizeHostname(hostname)
  if (!p || !h) return false

  // "*.example.com" matches "a.example.com" (but not bare "example.com")
  if (p.startsWith('*.')) {
    const suffix = p.slice(2)
    return h.endsWith(`.${suffix}`)
  }

  // "100.*" matches "100.64.0.1"
  if (p.endsWith('.*')) {
    const prefix = p.slice(0, -1)
    return h.startsWith(prefix)
  }

  return h === p
}

function isGoogleAuthConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID)
}

function isMicrosoftAuthConfigured(): boolean {
  return !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID)
}

function nextResponseWithNonce(request: NextRequest): { response: NextResponse; nonce: string } {
  const nonce = crypto.randomBytes(16).toString('base64')
  const googleEnabled = isGoogleAuthConfigured()
  const microsoftEnabled = isMicrosoftAuthConfigured()
  const requestHeaders = buildNonceRequestHeaders({
    headers: request.headers,
    nonce,
    googleEnabled,
    microsoftEnabled,
  })
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  return { response, nonce }
}

function buildDesignerMissionControlCsp(): string {
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'self'`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `style-src-attr 'unsafe-inline'`,
    `connect-src 'self' ws: wss: http://127.0.0.1:* http://localhost:* https://cdn.jsdelivr.net`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `frame-src 'self'`,
    `worker-src 'self' blob:`,
  ].join('; ')
}

function addSecurityHeaders(response: NextResponse, _request: NextRequest, nonce?: string): NextResponse {
  const requestId = crypto.randomUUID()
  const pathname = _request.nextUrl.pathname
  const isDesignerMissionControl = pathname === '/designer-mission-control' || pathname.startsWith('/designer-mission-control/')
  response.headers.set('X-Request-Id', requestId)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', isDesignerMissionControl ? 'SAMEORIGIN' : 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  if (isDesignerMissionControl) {
    response.headers.set('Content-Security-Policy', buildDesignerMissionControlCsp())
  } else {
    const googleEnabled = isGoogleAuthConfigured()
    const microsoftEnabled = isMicrosoftAuthConfigured()
    const effectiveNonce = nonce || crypto.randomBytes(16).toString('base64')
    response.headers.set('Content-Security-Policy', buildMissionControlCsp({ nonce: effectiveNonce, googleEnabled, microsoftEnabled }))
  }

  return response
}

function extractApiKeyFromRequest(request: NextRequest): string {
  const direct = (request.headers.get('x-api-key') || '').trim()
  if (direct) return direct

  const authorization = (request.headers.get('authorization') || '').trim()
  if (!authorization) return ''

  const [scheme, ...rest] = authorization.split(/\s+/)
  if (!scheme || rest.length === 0) return ''
  const normalized = scheme.toLowerCase()
  if (normalized === 'bearer' || normalized === 'apikey' || normalized === 'token') {
    return rest.join(' ').trim()
  }
  return ''
}

function gatewayCompatibilityDestination(pathname: string): string | null {
  const exact: Record<string, string> = {
    '/gateway/routes': '/gateway?tab=routes',
    '/gateway/registry': '/gateway?tab=registry',
    '/gateway/policies': '/gateway?tab=policies',
    '/gateway/health': '/gateway?tab=health',
    '/gateway/dispatcher': '/gateway?tab=dispatcher',
    '/gateway/token-governor': '/gateway?tab=governor',
    '/gateway/agent-hub': '/gateway?tab=agent-hub',
    '/gateway/agent-hub/paperclip': '/gateway?tab=paperclip',
    '/gateway/bridge-session': '/gateway?tab=bridge',
    '/gateway/node-detail': '/gateway?tab=node-detail',
    '/gateway/mobile-tablet': '/gateway?tab=mobile',
  }
  if (exact[pathname]) return exact[pathname]
  if (pathname.startsWith('/gateway/agent-hub/')) return '/gateway?tab=agent-hub'
  return null
}

function redirectToGatewayCompatibility(request: NextRequest, destination: string): NextResponse {
  const url = request.nextUrl.clone()
  const [pathname, search = ''] = destination.split('?')
  url.pathname = pathname
  url.search = search ? `?${search}` : ''
  return NextResponse.redirect(url)
}

export function proxy(request: NextRequest) {
  // Network access control.
  // In production: default-deny unless explicitly allowed.
  // In dev/test: allow all hosts unless overridden.
  const requestHosts = getRequestHostCandidates(request)
  const allowAnyHost = envFlag('MC_ALLOW_ANY_HOST') || process.env.NODE_ENV !== 'production'
  const allowedPatterns = String(process.env.MC_ALLOWED_HOSTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const implicitAllowedHosts = getImplicitAllowedHosts()

  const enforceAllowlist = !allowAnyHost && allowedPatterns.length > 0
  const isAllowedHost = !enforceAllowlist
    || requestHosts.some((hostName) =>
      implicitAllowedHosts.some((candidate) => hostMatches(candidate, hostName))
      || allowedPatterns.some((pattern) => hostMatches(pattern, hostName))
    )

  if (!isAllowedHost) {
    return addSecurityHeaders(new NextResponse('Forbidden', { status: 403 }), request)
  }

  const { pathname } = request.nextUrl

  // CSRF Origin validation for mutating requests
  const method = request.method.toUpperCase()
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const origin = request.headers.get('origin')
    if (origin) {
      let originHost: string
      try { originHost = new URL(origin).host } catch { originHost = '' }
      const requestHost = request.headers.get('host')?.split(',')[0]?.trim()
        || request.nextUrl.host
        || ''
      if (originHost && requestHost && originHost !== requestHost) {
        return addSecurityHeaders(NextResponse.json({ error: 'CSRF origin mismatch' }, { status: 403 }), request)
      }
    }
  }

  // Allow login, setup, auth API, docs, and container health probe without session
  const isPublicHealthProbe = pathname === '/api/status' && request.nextUrl.searchParams.get('action') === 'health'
  if (pathname === '/login' || pathname === '/setup' || pathname.startsWith('/api/auth/') || pathname === '/api/setup' || pathname === '/api/docs' || pathname === '/docs' || isPublicHealthProbe) {
    const { response, nonce } = nextResponseWithNonce(request)
    return addSecurityHeaders(response, request, nonce)
  }

  // Check for session cookie
  const sessionToken = request.cookies.get(MC_SESSION_COOKIE_NAME)?.value || request.cookies.get(LEGACY_MC_SESSION_COOKIE_NAME)?.value

  // API routes: accept session cookie OR API key
  if (pathname.startsWith('/api/')) {
    const configuredApiKey = (process.env.API_KEY || '').trim()
    const apiKey = extractApiKeyFromRequest(request)
    const hasValidApiKey = Boolean(configuredApiKey && apiKey && safeCompare(apiKey, configuredApiKey))

    // Agent-scoped keys are validated in route auth (DB-backed) and should be
    // allowed to pass through proxy auth gate.
    const looksLikeAgentApiKey = /^mca_[a-f0-9]{48}$/i.test(apiKey)

    if (sessionToken || hasValidApiKey || looksLikeAgentApiKey) {
      const { response, nonce } = nextResponseWithNonce(request)
      return addSecurityHeaders(response, request, nonce)
    }

    return addSecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), request)
  }

  // Page routes: allow if session cookie present
  if (sessionToken) {
    const gatewayDestination = gatewayCompatibilityDestination(pathname)
    if (gatewayDestination) {
      return addSecurityHeaders(redirectToGatewayCompatibility(request, gatewayDestination), request)
    }
    const { response, nonce } = nextResponseWithNonce(request)
    return addSecurityHeaders(response, request, nonce)
  }

  // Proxy auth: allow if request comes from a trusted proxy with a username header
  const proxyAuthHeader = (process.env.MC_PROXY_AUTH_HEADER || '').trim()
  const trustedIpsRaw = (process.env.MC_PROXY_AUTH_TRUSTED_IPS || '').trim()
  if (proxyAuthHeader && trustedIpsRaw) {
    const trustedIps = new Set(trustedIpsRaw.split(',').map(s => s.trim()).filter(Boolean))
    const proxyUsername = (request.headers.get(proxyAuthHeader) || '').trim()
    const realIp = (request.headers.get('x-real-ip') || '').trim()
    if (proxyUsername && realIp && trustedIps.has(realIp)) {
      const gatewayDestination = gatewayCompatibilityDestination(pathname)
      if (gatewayDestination) {
        return addSecurityHeaders(redirectToGatewayCompatibility(request, gatewayDestination), request)
      }
      const { response, nonce } = nextResponseWithNonce(request)
      return addSecurityHeaders(response, request, nonce)
    }
  }

  // Redirect to login
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  return addSecurityHeaders(NextResponse.redirect(loginUrl), request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)']
}
