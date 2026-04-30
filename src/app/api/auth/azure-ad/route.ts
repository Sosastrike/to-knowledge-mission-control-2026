import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { AZURE_AD_STATE_COOKIE, buildAzureAdAuthorizationUrl, getAzureAdRequestOrigin, isAzureAdConfigured } from '@/lib/azure-ad-auth'
import { isRequestSecure } from '@/lib/session-cookie'
import { loginLimiter } from '@/lib/rate-limit'

function redirectToLogin(request: NextRequest, message: string) {
  const url = new URL('/login', getAzureAdRequestOrigin(request))
  url.searchParams.set('authError', message)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const rateCheck = loginLimiter(request)
  if (rateCheck) return rateCheck

  if (!isAzureAdConfigured()) {
    return redirectToLogin(request, 'Microsoft 365 sign-in requires owner setup')
  }

  const state = randomBytes(32).toString('hex')
  const response = NextResponse.redirect(buildAzureAdAuthorizationUrl({ request, state }))
  response.cookies.set(AZURE_AD_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isRequestSecure(request),
    sameSite: 'lax',
    path: '/api/auth/callback/azure-ad',
    maxAge: 10 * 60,
  })
  return response
}
