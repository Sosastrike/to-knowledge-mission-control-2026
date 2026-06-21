import { NextResponse } from 'next/server'
import { destroySession, getUserFromRequest } from '@/lib/auth'
import { logAuditEvent } from '@/lib/db'
import {
  MC_SESSION_COOKIE_NAME,
  getMcSessionCookieNames,
  getMcSessionCookieOptions,
  isRequestSecure,
  parseMcSessionCookieValues,
} from '@/lib/session-cookie'

function requestOriginMatchesHost(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    const originHost = new URL(origin).host
    const requestHost = request.headers.get('host')?.split(',')[0]?.trim() || new URL(request.url).host
    return Boolean(originHost && requestHost && originHost === requestHost)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!requestOriginMatchesHost(request)) {
    return NextResponse.json({ ok: false, error: 'CSRF origin mismatch' }, { status: 403 })
  }

  const user = getUserFromRequest(request)
  const cookieHeader = request.headers.get('cookie') || ''
  const tokens = parseMcSessionCookieValues(cookieHeader)

  if (!user || tokens.length === 0) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
  }

  for (const token of tokens) {
    destroySession(token)
  }

  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  logAuditEvent({ action: 'logout', actor: user.username, actor_id: user.id, ip_address: ipAddress })

  const response = NextResponse.json({ ok: true, authenticated: false })
  const isSecureRequest = isRequestSecure(request)
  for (const cookieName of getMcSessionCookieNames()) {
    response.cookies.set(cookieName, '', {
      ...getMcSessionCookieOptions({
        maxAgeSeconds: 0,
        isSecureRequest: isSecureRequest || cookieName === MC_SESSION_COOKIE_NAME,
      }),
    })
  }

  return response
}
