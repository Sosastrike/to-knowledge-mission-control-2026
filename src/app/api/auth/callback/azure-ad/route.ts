import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth'
import { getDatabase, logAuditEvent } from '@/lib/db'
import { AZURE_AD_PROVIDER, AZURE_AD_STATE_COOKIE, exchangeAzureAdCode, fetchAzureAdProfile, getAzureAdRequestOrigin } from '@/lib/azure-ad-auth'
import { getMcSessionCookieName, getMcSessionCookieOptions, isRequestSecure } from '@/lib/session-cookie'

function redirectToLogin(request: NextRequest, message: string, code?: string) {
  const url = new URL('/login', getAzureAdRequestOrigin(request))
  url.searchParams.set('authError', message)
  if (code) url.searchParams.set('authCode', code)
  return NextResponse.redirect(url)
}

function redirectToDashboard(request: NextRequest) {
  return NextResponse.redirect(new URL('/designer-mission-control/Mission%20Control.html?page=mission', getAzureAdRequestOrigin(request)))
}

function upsertAccessRequest(input: {
  email: string
  providerUserId: string
  displayName: string
}) {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO access_requests (provider, email, provider_user_id, display_name, avatar_url, status, attempt_count, requested_at, last_attempt_at)
    VALUES (?, ?, ?, ?, NULL, 'pending', 1, (unixepoch()), (unixepoch()))
    ON CONFLICT(email, provider) DO UPDATE SET
      provider_user_id = excluded.provider_user_id,
      display_name = excluded.display_name,
      avatar_url = NULL,
      status = 'pending',
      attempt_count = access_requests.attempt_count + 1,
      last_attempt_at = (unixepoch())
  `).run(AZURE_AD_PROVIDER, input.email.toLowerCase(), input.providerUserId, input.displayName)
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get('error')
  if (error) {
    return redirectToLogin(request, `Microsoft 365 sign-in failed: ${error}`)
  }

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const expectedState = request.cookies.get(AZURE_AD_STATE_COOKIE)?.value || ''

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToLogin(request, 'Microsoft 365 sign-in state check failed')
  }

  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const token = await exchangeAzureAdCode({ request, code })
    if (!token.access_token) {
      throw new Error('Microsoft token response did not include an access token')
    }

    const profile = await fetchAzureAdProfile(token.access_token)
    const email = profile.email.toLowerCase()

    const db = getDatabase()
    const row = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.role, u.provider, u.email, u.avatar_url, u.is_approved,
             u.created_at, u.updated_at, u.last_login_at, u.workspace_id, COALESCE(w.tenant_id, 1) as tenant_id
      FROM users u
      LEFT JOIN workspaces w ON w.id = u.workspace_id
      WHERE provider = ? AND (provider_user_id = ? OR lower(email) = ?)
      ORDER BY u.id ASC
      LIMIT 1
    `).get(AZURE_AD_PROVIDER, profile.id, email) as any

    if (!row || Number(row.is_approved ?? 1) !== 1) {
      upsertAccessRequest({
        email,
        providerUserId: profile.id,
        displayName: profile.displayName,
      })

      logAuditEvent({
        action: 'azure_ad_login_pending_approval',
        actor: email,
        detail: { email, provider_user_id: profile.id },
        ip_address: ipAddress,
        user_agent: userAgent,
      })

      const response = redirectToLogin(request, 'Access request pending admin approval', 'PENDING_APPROVAL')
      response.cookies.delete(AZURE_AD_STATE_COOKIE)
      return response
    }

    db.prepare(`
      UPDATE users
      SET provider = ?, provider_user_id = ?, email = ?, avatar_url = NULL, updated_at = (unixepoch())
      WHERE id = ?
    `).run(AZURE_AD_PROVIDER, profile.id, email, row.id)

    const { token: sessionToken, expiresAt } = createSession(row.id, ipAddress, userAgent, row.workspace_id ?? 1)

    logAuditEvent({ action: 'login_azure_ad', actor: row.username, actor_id: row.id, ip_address: ipAddress, user_agent: userAgent })

    const response = redirectToDashboard(request)
    const isSecure = isRequestSecure(request)
    const cookieName = getMcSessionCookieName(isSecure)
    response.cookies.set(cookieName, sessionToken, {
      ...getMcSessionCookieOptions({ maxAgeSeconds: expiresAt - Math.floor(Date.now() / 1000), isSecureRequest: isSecure }),
    })
    response.cookies.delete(AZURE_AD_STATE_COOKIE)
    return response
  } catch (err: any) {
    logAuditEvent({
      action: 'azure_ad_login_failed',
      actor: 'azure-ad',
      detail: { reason: err?.message || 'unknown' },
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    return redirectToLogin(request, err?.message || 'Microsoft 365 sign-in failed')
  }
}
