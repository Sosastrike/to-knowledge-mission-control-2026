# Gateway drop-in — production integration patch

Mapping from this package layout → the production Mission Control v2 tree
on `srv1568353:/home/tony/mission-control/`. CloudCode prepared every file
in this package against the real Next 15 App Router constraints (D3, D4,
D5, D6, D7). The implementer copies each file to the destination below.

This file is the only authoritative copy of "where things go". The
verbatim acceptance criteria below mirror Luis's D1–D7 directive.

## File-by-file placement

| Source (in this package) | Destination (in Mission Control v2 repo) |
| --- | --- |
| `public/design/gateway/**/*` (31 files) | `public/design/gateway/**/*` |
| `src/components/gateway/GatewayShell.tsx` | `src/components/gateway/GatewayShell.tsx` |
| `src/app/gateway/page.tsx` | `src/app/gateway/page.tsx` |
| `next.config.partial.js` rewrites block | merge into existing `next.config.js` async rewrites() |
| `middleware.gateway-csp.partial.ts` | merge into existing `src/middleware.ts` (or `proxy.ts`) — see § "CSP middleware merge" |
| `design-lock/gateway-manifest.json` | `design-lock/gateway-manifest.json` (new file) |
| `scripts/compute-design-lock.mjs` | `scripts/compute-design-lock.mjs` |
| `scripts/verify-design-lock.mjs` | `scripts/verify-design-lock.mjs` |
| `tests/*.test.ts` | `tests/gateway/*.test.ts` (or wherever vitest finds them) |

**Files NOT copied / NOT deleted:**

- The legacy `src/app/designer-mission-control/[[...path]]/page.tsx` and
  `proxy.ts` catch-all is **retained** (D7 — legacy/reference/diagnostic).
  Not the canonical Gateway surface. Do not delete.
- `AgentNetworkClient.tsx` remains canonical for the Agent Network surface
  (D7). Not the canonical Gateway surface.
- `Mission-Control-Gateway-FULL-v3` (the broader reference shell) — confirmed
  present at `/Volumes/Personal-Drive/Chrome Files 2026/handoff 3/`. Not
  applied in this PR; the v3 package is the designer's full reference and
  is out of scope for the drop-in lane. We do not claim reference-shell
  parity in this PR.

## CSP middleware merge

The existing Mission Control middleware (or `proxy.ts`) already builds a
strict CSP via `buildMissionControlCsp(nonce, …)`. Add the path-scoped
exception **before** the parent CSP path is hit. The shape:

```ts
// at the top of middleware.ts
import { buildGatewayMockCsp, isGatewayMockPath } from './middleware.gateway-csp.partial'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  if (isGatewayMockPath(pathname)) {
    response.headers.set('Content-Security-Policy', buildGatewayMockCsp())
    response.headers.set('X-Frame-Options', 'SAMEORIGIN')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    return response
  }

  // … existing parent CSP path, unchanged …
  return response
}
```

Then either:

(a) **rename** `middleware.gateway-csp.partial.ts` → `middleware.gateway-csp.ts`
    and import from there, or
(b) copy/paste the `buildGatewayMockCsp` and `isGatewayMockPath` exports
    into the existing `middleware.ts` body.

Either is fine. Do not edit the parent CSP. Do not weaken anything outside
`/design/gateway/*`.

## next.config.js merge

If the existing `next.config.js` already has an async `rewrites()`,
**concatenate** the array returned in this package's `next.config.partial.js`
onto the existing one. If it has no `rewrites()`, lift the entire `module.exports`
shape and add the rewrites function.

## Vitest config merge

The existing repo's `vitest.config.ts` already includes everything under
`tests/`. Drop the three test files into `tests/gateway/` and they will be
discovered automatically. The tests import only from this package's source
files and `node:` builtins — no additional setup required.

## Verifying after merge

```bash
# in the production Mission Control v2 repo, after merging:
pnpm typecheck
pnpm test -- --run tests/gateway
pnpm build
node scripts/verify-design-lock.mjs

# manually:
curl -fsS "https://<domain>/design/gateway/Agent%20Hub.html" | head -20
curl -fsS "https://<domain>/gateway"           | head -20
curl -fsS "https://<domain>/gateway/agent-hub" | head -20  # should serve same HTML as /gateway
curl -fsS "https://<domain>/gateway/dispatcher" | head -20

# in DevTools, on /gateway/agent-hub:
# - inspect iframe element: src must be /design/gateway/Agent%20Hub.html
# - inspect iframe element: sandbox must be "allow-scripts"
```

## Rollback

Single new directory + one CSP middleware fragment + a rewrites block.

```bash
# A. Remove the directory and revert the two patch points:
git rm -rf public/design/gateway/ src/components/gateway/ src/app/gateway/
git checkout HEAD~1 -- src/middleware.ts next.config.js  # or whichever commit removes the merge
git rm scripts/compute-design-lock.mjs scripts/verify-design-lock.mjs
git rm design-lock/gateway-manifest.json
git rm tests/gateway/*.test.ts

# B. Or revert by commit (single feat commit):
git revert <gateway-integration-commit-sha>
```

Only paths touched: the new directory + the next.config.js rewrites array
+ the middleware CSP scope. Nothing else.
