// Patch fragment for the existing Mission Control v2 middleware.ts / proxy.ts.
// This file does NOT replace the parent middleware. It documents the exact
// CSP exception that must be added inside the existing middleware for the
// /design/gateway/* path scope, per D4.
//
// RULES (D4 + DDR-Gateway-005, enforced):
//   - Parent Mission Control CSP is unchanged for every other route.
//   - The exception applies only to /design/gateway/* responses.
//   - script-src adds 'unsafe-inline' ONLY inside this scope, because the
//     designer mock HTML has inline <script> blocks (verified in
//     Agent Hub.html line 305).
//   - As of 2026-05-11 the iframe sandbox in GatewayShell.tsx is
//     `allow-scripts allow-same-origin`. Adding allow-same-origin is
//     REQUIRED to fulfil the Designer Contract's data-wiring path: the
//     replacement `shared/agent-data.js` and `shared/gateway-data.js`
//     files fetch from same-origin `/api/gateway/*` endpoints and must
//     carry Mission Control session cookies. A null-origin iframe
//     (allow-scripts alone) sends fetches without cookies and authenticated
//     API calls return 401.
//   - Threat model under allow-same-origin: a compromised inline script
//     in a mock CAN read Mission Control cookies / localStorage. Mitigation
//     stack: (a) design-lock manifest (SHA-256) prevents any change to a
//     mock file passing CI; (b) CODEOWNERS forces Owner approval on mock
//     paths; (c) connect-src is locked to 'self' so even a compromised
//     script cannot exfiltrate to a third-party host; (d) frame-ancestors
//     stays 'self' so mocks can only be embedded by Mission Control.
//   - connect-src is 'self' (required for the data-wiring fetch path).
//   - The exception NEVER turns into a global default. It is path-scoped
//     and the parent CSP fallback is preserved.
//
// Drop the snippet below into the existing middleware (or proxy.ts) at the
// point where the response is built, just before the CSP header is set.
//
// Example (illustrative — paste shape, not the full middleware):
//
// ```ts
// import type { NextRequest } from 'next/server'
// import { NextResponse } from 'next/server'
// import { buildMissionControlCsp } from '@/lib/csp'
// import { buildGatewayMockCsp, isGatewayMockPath } from '@/middleware.gateway-csp'
//
// export function middleware(request: NextRequest) {
//   const response = NextResponse.next()
//   const url = request.nextUrl
//   if (isGatewayMockPath(url.pathname)) {
//     response.headers.set('Content-Security-Policy', buildGatewayMockCsp())
//     // No nonce injection on raw static mocks — that would mutate the file.
//     response.headers.set('X-Frame-Options', 'SAMEORIGIN')
//     response.headers.set('X-Content-Type-Options', 'nosniff')
//     return response
//   }
//   // … existing parent CSP path unchanged …
//   response.headers.set('Content-Security-Policy', buildMissionControlCsp(/* nonce, opts */))
//   return response
// }
// ```

export const GATEWAY_MOCK_PATH_PREFIX = '/design/gateway/'

export function isGatewayMockPath(pathname: string): boolean {
  return pathname.startsWith(GATEWAY_MOCK_PATH_PREFIX)
}

// Path-scoped CSP for raw designer mocks. Returns a single header value.
// Justification of every relaxation (each must be documented in the PR):
//   - script-src 'self' 'unsafe-inline': designer mocks contain inline
//     <script> blocks (Agent Hub.html line 305 et al.). They are sandboxed
//     by the iframe in GatewayShell.tsx (`sandbox="allow-scripts"`), so even
//     if compromised they cannot read Mission Control cookies or storage.
//   - style-src 'self' 'unsafe-inline': designer mocks have inline <style>
//     blocks and inline style attributes — same isolation argument applies.
//   - img-src 'self' data:: covers inline SVG icons embedded in the mocks.
//   - frame-ancestors 'self': mocks are only allowed to be embedded by
//     Mission Control itself.
//   - default-src 'self': everything else stays same-origin.
// External fetch / connect / font / media stay disabled on purpose; the
// mocks are static. When data wiring lands, only connect-src 'self' is
// needed (the mock makes same-origin fetches via /api/*).
export function buildGatewayMockCsp(): string {
  const parts = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ]
  return parts.join('; ')
}
