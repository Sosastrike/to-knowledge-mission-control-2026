export const AZURE_AD_PROVIDER = 'azure-ad' as const
export const AZURE_AD_STATE_COOKIE = 'mc-azure-ad-oauth-state'

export const AZURE_AD_SCOPES = ['openid', 'profile', 'email', 'offline_access', 'User.Read'] as const

export interface AzureAdConfig {
  clientId: string
  clientSecret: string
  tenantId: string
}

export interface AzureAdProfile {
  id: string
  displayName: string
  email: string
  userPrincipalName?: string | null
}

export interface AzureAdTokenResponse {
  access_token?: string
  id_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  error?: string
  error_description?: string
}

export function getAzureAdConfig(): AzureAdConfig | null {
  const clientId = (process.env.AZURE_AD_CLIENT_ID || '').trim()
  const clientSecret = (process.env.AZURE_AD_CLIENT_SECRET || '').trim()
  const tenantId = (process.env.AZURE_AD_TENANT_ID || '').trim()

  if (!clientId || !clientSecret || !tenantId) return null
  return { clientId, clientSecret, tenantId }
}

export function isAzureAdConfigured(): boolean {
  return Boolean(getAzureAdConfig())
}

export function getAzureAdRequestOrigin(request: Request): string {
  const forwardedHost = (request.headers.get('x-forwarded-host') || '').split(',')[0]?.trim()
  const forwardedProto = (request.headers.get('x-forwarded-proto') || '').split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host') || new URL(request.url).host
  let proto = forwardedProto || new URL(request.url).protocol.replace(':', '') || 'http'
  const hostname = host.replace(/^\[/, '').replace(/\]$/, '').split(':')[0]
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  if (proto === 'http' && !isLocalHost) proto = 'https'
  return `${proto}://${host}`
}

export function getAzureAdRedirectUri(request: Request): string {
  const configured = (process.env.AZURE_AD_REDIRECT_URI || '').trim()
  if (configured) return configured
  return `${getAzureAdRequestOrigin(request)}/api/auth/callback/azure-ad`
}

export function buildAzureAdAuthorizationUrl(input: {
  request: Request
  state: string
}): string {
  const config = getAzureAdConfig()
  if (!config) throw new Error('Microsoft 365 sign-in requires owner setup')

  const authorizeUrl = new URL(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/authorize`)
  authorizeUrl.searchParams.set('client_id', config.clientId)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('redirect_uri', getAzureAdRedirectUri(input.request))
  authorizeUrl.searchParams.set('response_mode', 'query')
  authorizeUrl.searchParams.set('scope', AZURE_AD_SCOPES.join(' '))
  authorizeUrl.searchParams.set('state', input.state)
  authorizeUrl.searchParams.set('prompt', 'select_account')
  return authorizeUrl.toString()
}

export async function exchangeAzureAdCode(input: {
  request: Request
  code: string
}): Promise<AzureAdTokenResponse> {
  const config = getAzureAdConfig()
  if (!config) throw new Error('Microsoft 365 sign-in requires owner setup')

  const body = new URLSearchParams()
  body.set('client_id', config.clientId)
  body.set('client_secret', config.clientSecret)
  body.set('code', input.code)
  body.set('grant_type', 'authorization_code')
  body.set('redirect_uri', getAzureAdRedirectUri(input.request))

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({})) as AzureAdTokenResponse
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Microsoft token exchange failed')
  }
  return payload
}

export async function fetchAzureAdProfile(accessToken: string): Promise<AzureAdProfile> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({})) as {
    id?: string
    displayName?: string
    mail?: string | null
    userPrincipalName?: string | null
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Microsoft Graph profile lookup failed')
  }

  const id = String(payload.id || '').trim()
  const email = String(payload.mail || payload.userPrincipalName || '').trim().toLowerCase()
  if (!id || !email) {
    throw new Error('Microsoft profile did not include a usable id and email')
  }

  return {
    id,
    email,
    displayName: String(payload.displayName || email.split('@')[0] || 'Microsoft 365 User').trim(),
    userPrincipalName: payload.userPrincipalName || null,
  }
}
