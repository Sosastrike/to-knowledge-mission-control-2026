export type MissionControlCspInput = {
  nonce: string
  googleEnabled: boolean
  microsoftEnabled?: boolean
}

const GOOGLE_AUTH_ORIGINS = ['https://accounts.google.com']
const GOOGLE_IMAGE_ORIGINS = ['https://*.googleusercontent.com', 'https://lh3.googleusercontent.com']
const MICROSOFT_CONNECT_ORIGINS = ['https://login.microsoftonline.com', 'https://graph.microsoft.com']
const MICROSOFT_FRAME_ORIGINS = ['https://login.microsoftonline.com']

function joinOrigins(enabled: boolean, origins: string[]): string {
  return enabled ? ` ${origins.join(' ')}` : ''
}

export function buildMissionControlCsp(input: MissionControlCspInput): string {
  const { nonce, googleEnabled, microsoftEnabled = false } = input
  const googleAuthOrigins = joinOrigins(googleEnabled, GOOGLE_AUTH_ORIGINS)
  const googleImageOrigins = joinOrigins(googleEnabled, GOOGLE_IMAGE_ORIGINS)
  const microsoftConnectOrigins = joinOrigins(microsoftEnabled, MICROSOFT_CONNECT_ORIGINS)
  const microsoftFrameOrigins = joinOrigins(microsoftEnabled, MICROSOFT_FRAME_ORIGINS)

  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' blob:${googleAuthOrigins}`,
    `style-src 'self' 'unsafe-inline'`,
    `style-src-elem 'self' 'unsafe-inline'${googleAuthOrigins}`,
    `style-src-attr 'unsafe-inline'`,
    `connect-src 'self' ws: wss: http://127.0.0.1:* http://localhost:* https://cdn.jsdelivr.net${googleAuthOrigins}${microsoftConnectOrigins}`,
    `img-src 'self' data: blob:${googleImageOrigins}`,
    `font-src 'self' data:`,
    `frame-src 'self'${googleAuthOrigins}${microsoftFrameOrigins}`,
    `form-action 'self'${microsoftFrameOrigins}`,
    `worker-src 'self' blob:`,
  ].join('; ')
}

export function buildNonceRequestHeaders(input: {
  headers: Headers
  nonce: string
  googleEnabled: boolean
  microsoftEnabled?: boolean
}): Headers {
  const requestHeaders = new Headers(input.headers)
  const csp = buildMissionControlCsp({
    nonce: input.nonce,
    googleEnabled: input.googleEnabled,
    microsoftEnabled: input.microsoftEnabled,
  })

  requestHeaders.set('x-nonce', input.nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  return requestHeaders
}
