# CloudCode → Luis Gateway drop-in closeout

**Date:** 2026-05-11
**Branch:** `cloudcode/gateway-dropin-integration`
**Lane owner:** CloudCode (per D1)
**Scope:** Gateway designer drop-in only — Codex's 100-day plan untouched.

---

## 1. ADR decision application summary

ADR-001 (Hybrid / Option C) was Luis-accepted with D1–D7. This package
applies each decision:

| Decision | Applied where |
| --- | --- |
| D1 — Coordination | New branch `cloudcode/gateway-dropin-integration` off the parent. No edits to `connector-readiness-route.ts`, `build-wiki-run-now-route.ts`, `dashboard.ts`, `AgentNetworkClient.tsx`, the legacy `designer-mission-control/[[...path]]` proxy, or any file Codex was active on. |
| D2 — Missing package | Re-searched: `Mission-Control-Gateway-FULL-v3` PRESENT at `/Volumes/Personal-Drive/Chrome Files 2026/handoff 3/Mission-Control-Gateway-FULL-v3/`. Reported below. Used `Gateway-DropIn-v1-FINAL` for the production drop-in as Luis authorised. |
| D3 — Next 15 / App Router | `GatewayShell.tsx` is a `'use client'` component with explicit React hook imports, `usePathname` + `useSearchParams` + `useRouter`, default export, basePath-aware iframe src. The mock HTML / CSS files are byte-identical to the package — verified by the design-lock manifest. |
| D4 — CSP | Path-scoped CSP at `middleware.gateway-csp.partial.ts`. Only `/design/gateway/*` gets `script-src 'self' 'unsafe-inline'` (justified inline). Parent CSP unchanged. iframe `sandbox="allow-scripts"`. |
| D5 — Filename spaces | All 22 HTML mocks and the shared assets keep their original names. `iframeSrcFor()` runs `encodeURI()`; tests prove `Agent Hub.html` → `/design/gateway/Agent%20Hub.html`. No rename. |
| D6 — Design Lock | `design-lock/gateway-manifest.json` records SHA-256 + byte-size for all 31 files. `scripts/compute-design-lock.mjs` regenerates it; `scripts/verify-design-lock.mjs` is the CI guard. `tests/design-lock.test.ts` is the in-process parity test. |
| D7 — Canonical surface | Single canonical route `src/app/gateway/page.tsx`. Deep links resolve through `next.config.partial.js` rewrites. Legacy `designer-mission-control/[[...path]]` retained as documented. |

---

## 2. Package found / missing status

```
Mission-Control-Gateway-FULL-v3 : PRESENT
  Path: /Volumes/Personal-Drive/Chrome Files 2026/handoff 3/Mission-Control-Gateway-FULL-v3/
  File count: 89 files (excluding .DS_Store)
  Contains: Login.html, Mission Control.html, styles.css, full src/ (33 jsx files,
            agent-network/, backend/, replicas/), design/gateway/ (26 files),
            DEVELOPER-INTEGRATION-NOTE.md.
  Treated as REFERENCE shell — NOT applied in this PR (full reference-shell
  parity is out of scope for this lane per D2).

Gateway-DropIn-v1-FINAL        : PRESENT
  Path: /Volumes/Personal-Drive/To-Knowledge Mission Control Code By Lu S/handoff/
        Gateway-DropIn-v1-FINAL/
  File count: 31 design files + GatewayShell.jsx + README-INTEGRATION.md
  Used as the production drop-in source for this PR.
```

CloudCode does **not** claim full Mission Control reference-shell parity.
Per D2 we proceeded with the drop-in scope only.

---

## 3. Exact file counts

```
$ find Gateway-DropIn-v1-FINAL/design/gateway -type f \! -name ".DS_Store" | wc -l
  31

$ find gateway-dropin/public/design/gateway -type f | wc -l
  31

$ find gateway-dropin/public/design/gateway -maxdepth 1 -name '*.html' | wc -l
  21    # top-level HTML mocks

$ ls gateway-dropin/public/design/gateway/shared/
  agent-data.js  gateway-data.js  node-card.css  render.js  tokens.css  topbar.html
```

Source ↔ staged file counts match exactly. No mock content was modified
(confirmed by the design-lock manifest test).

---

## 4. GatewayShell production adaptation summary

Original (`Gateway-DropIn-v1-FINAL/src/gateway/GatewayShell.jsx`, 97 lines)
was Babel-in-browser style: relied on global `React`, used relative iframe
src `'design/gateway/...'`, attached itself via `Object.assign(window, …)`.

Adapted (`gateway-dropin/src/components/gateway/GatewayShell.tsx`,
177 lines, fully strict TypeScript):

- `'use client'` directive.
- `import { useCallback, useEffect, useMemo, useState } from 'react'` — no
  global React.
- `import { usePathname, useRouter, useSearchParams } from 'next/navigation'`
  for App Router URL state.
- `BASE_PATH` resolved from `process.env.NEXT_PUBLIC_BASE_PATH` at module
  scope so SSR + client render produce the same `<iframe src=>`.
- `iframeSrcFor(tab)` uses `encodeURI()` — filenames with spaces become
  `%20` (D5). Tests prove the encoding.
- `activeTabFrom(pathname, searchParams)` resolves either `?tab=` or
  `/gateway/<segment>` to a tab id, with drill-down `/gateway/agent-hub/paperclip`
  → `paperclip`. Falls back to `overview`.
- `<iframe sandbox="allow-scripts">` (no `allow-same-origin` yet — D4).
- Default export `GatewayPage` mounted in `src/app/gateway/page.tsx`.
- No re-implementation of the mock HTML or CSS. The shell does not even
  render their content; it just iframes them.
- Test selectors added: `data-testid="gateway-tab-<id>"` and
  `data-testid="gateway-iframe"` (acceptance test E uses this pattern).

---

## 5. CSP decision and scope

**Decision:** Path-scoped CSP exception only — `/design/gateway/*` gets a
local CSP. Parent Mission Control CSP is unchanged.

**Header value (built by `buildGatewayMockCsp()`):**

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
frame-src 'self';
frame-ancestors 'self';
form-action 'self';
base-uri 'self';
object-src 'none'
```

**Why `'unsafe-inline'` is acceptable here (documented in `middleware.gateway-csp.partial.ts`):**
the designer mocks contain inline `<script>` blocks (e.g. Agent Hub.html
line 305). The iframe in `GatewayShell.tsx` sandboxes them with
`sandbox="allow-scripts"` only — no `allow-same-origin` — so even if an
inline script were compromised, the iframe runs in a null opaque origin
and cannot read Mission Control cookies, storage, or DOM.

**Test coverage:** `tests/csp-scope.test.ts` (11 tests) verifies the scope
boundary, every relaxation, and absence of wildcards/http: in `script-src`.

---

## 6. Filename handling decision

Per D5 — **no rename**. All 22 HTML mocks and the shared assets ship with
their original names (spaces included). The iframe src is produced by
`encodeURI()`. Acceptance test A's literal URL form is supported:

```
https://<domain>/design/gateway/Agent Hub.html   ← browser address bar form
https://<domain>/design/gateway/Agent%20Hub.html ← what the iframe fetches
```

Both resolve to the same file. A future kebab-case rename is a separate
proposal.

---

## 7. Design-lock manifest / hash result

```
$ node scripts/compute-design-lock.mjs
wrote 31 entries to design-lock/gateway-manifest.json

$ node scripts/verify-design-lock.mjs
design-lock OK: 31 files match manifest
```

Manifest schema `gateway-design-lock@1`, 31 entries, each with relative
path, byte count, and SHA-256. Examples:

```
Agent Hub.html            38609 bytes  sha256 220a5a3a04643ad5...
Bridge Session Flow.html  ... ... bytes  sha256 ...
Gateway Overview.html     ... ... bytes  sha256 ...
shared/agent-data.js      ... ... bytes  sha256 ...
shared/render.js          ... ... bytes  sha256 ...
```

`tests/design-lock.test.ts` re-verifies on every test run (in-process).
Hash drift fails CI. Per D6 the fix is **register the approved files**,
not modify the mocks to match an old hash.

---

## 8. Route rewrites added

`next.config.partial.js` documents 11 rewrites the implementer merges
into the production `next.config.js` async `rewrites()`:

```
/gateway/overview            → /gateway?tab=overview
/gateway/agent-hub           → /gateway?tab=agent-hub
/gateway/agent-hub/paperclip → /gateway?tab=paperclip
/gateway/paperclip           → /gateway?tab=paperclip
/gateway/dispatcher          → /gateway?tab=dispatcher
/gateway/token-governor      → /gateway?tab=governor
/gateway/bridge-session      → /gateway?tab=bridge
/gateway/health              → /gateway?tab=health
/gateway/routes              → /gateway?tab=routes
/gateway/registry            → /gateway?tab=registry
/gateway/policies            → /gateway?tab=policies
```

All are **rewrites** (D7), not redirects. The URL stays `/gateway/<segment>`
in the browser address bar.

---

## 9. Old wrapper files removed / retained

Search for pre-existing Gateway wrappers in this worktree returned **zero
hits** under `app/gateway/**`, `pages/gateway/**`, `pages/api/gateway-page/**`.
Nothing in this worktree needs deleting.

Retained (D7, by design):

- `remote-mc/src/app/designer-mission-control/[[...path]]/page.tsx` —
  legacy/reference/diagnostic catch-all. Not canonical Gateway surface.
- `remote-mission-control/AgentNetworkClient.tsx` (and copies in
  `mission-control-canon/` and `src/components/agent-network/`) — canonical
  Agent Network surface. Not Gateway.

On the production server (`srv1568353:/home/tony/mission-control/`) the
implementer should run the same search before applying the patch:

```
find apps/mission-control/src/app/gateway -type f 2>/dev/null
find apps/mission-control/src/pages/gateway -type f 2>/dev/null
find apps/mission-control/src/pages/api/gateway-page -type f 2>/dev/null
```

If any pre-existing wrappers are found there, they should be removed
(D7 — single canonical surface).

---

## 10. Proofs

### Static mock URL proof (production target — to run after deploy)

```
curl -fsS "https://<domain>/design/gateway/Agent%20Hub.html" | head -3
# Expected: <!doctype html>...<title>Gateway · Agent Hub</title>
```

CloudCode did **not** run this against production — the production server
is not reachable from this worktree. The implementer or owner runs the
curl after deploy and pastes the result.

### `/gateway` proof (production target)

```
curl -fsS "https://<domain>/gateway" | grep -c 'gateway-shell'
# Expected: 1 (the GatewayShell wrapper class)
```

### Deep-link proof (production target)

```
for tab in overview agent-hub paperclip dispatcher token-governor \
           bridge-session health routes registry policies; do
  printf '%-30s ' "$tab"
  curl -fsS -o /dev/null -w '%{http_code}\n' "https://<domain>/gateway/$tab"
done
# Expected: all 200, none redirected (rewrites, not redirects).
```

### Mission Control rail proof (production target)

After deploy, navigate to `/` and confirm the left rail still shows:
Dashboard, Brain Sync, Agent Network, MiroFish, Meetings, Channels,
Alerts, Schedule, Settings, Gateway. CloudCode did not modify any rail
file — the entries should be exactly what existed pre-patch plus Gateway.

### SpaceAgent panel proof (production target)

In `/gateway/agent-hub`, the iframed `Agent Hub.html` renders the
SpaceAgent panel with Browser Automation → Playwright MCP in gray (not
installed). This is the designer mock as shipped; the design-lock
manifest proves it hasn't been touched.

For acceptance-test stability the recommendation is to add
`data-testid="playwright-mcp-status"` inside the mock during the next
designer revision (not done here — would break the design lock).

---

## 11. Typecheck

```
$ npx tsc -p tsconfig.json --noEmit
(no output — exit 0)
```

Captured in `proof/typecheck.txt`.

---

## 12. Build

The production Next.js build runs against the merged Mission Control v2
tree on `srv1568353`. CloudCode cannot reach that server from this
worktree. **The implementer or owner runs `pnpm build` after merging
the patch** and reports back.

What CloudCode CAN attest:

- All package source files typecheck under strict TypeScript with the
  same `target: ES2022`, `moduleResolution: Bundler`, `jsx: preserve`
  posture as Mission Control v2.
- `next@15.0.3`, `react@18.3.1`, `react-dom@18.3.1` versions resolved
  locally without conflict.
- No `'use server'`, no top-level await, no SSR-only API calls in
  `GatewayShell.tsx` — it is a clean client component.

---

## 13. Tests

```
$ npx vitest run
 ✓ tests/design-lock.test.ts        (4 tests)
 ✓ tests/csp-scope.test.ts          (11 tests)
 ✓ tests/gateway-shell.test.ts      (14 tests)

 Test Files  3 passed (3)
 Tests       29 passed (29)
```

Captured in `proof/vitest.txt`. Suites cover:

- GATEWAY_TABS / on-disk parity (every tab points at a file that exists).
- `iframeSrcFor` URL encoding (D5).
- `activeTabFrom` URL → tab resolution (every deep link form).
- CSP scope boundary + every relaxation justification.
- Design-lock manifest correctness + drift detection.

---

## 14. Route smoke

The route-smoke helper from the prior `@cloudcode/backend-support` package
(commit `491fe09` on `cloudcode/backend-support-gateway-status`) can be
run against the production origin after deploy:

```
node backend-support/scripts/route-smoke.cli.mjs --base https://<domain>
# Expected: /gateway → LIVE, /api/gateway/status → LIVE (or READY when
# execution is owner-gated), no SERVICE_DOWN.
```

CloudCode did **not** run this against production (no remote reachability
from this worktree). The CLI is verified working locally — see
`backend-support/proof/route-smoke.cli.txt` from the prior PR.

---

## 15. Secret scan / `.env` diff

```
$ git diff --stat -- '*.env*' .env
(empty — no .env files touched)

$ grep -rE 'sk-[A-Za-z0-9]{20,}|xox[abp]-...|ghp_...|AKIA...|AIza...|Bearer ...' \
     gateway-dropin/ --include=*.ts --include=*.tsx --include=*.mjs \
     --include=*.js --include=*.json --include=*.md
(no matches)
```

Captured in `proof/secret-scan.txt`. No `.env` change, no secrets in any
package file.

---

## 16. Commit hash

(filled in after the commit step runs)

---

## 17. Push result

```
git remote -v
(no remote configured — same as the backend-support delivery)
```

**Push not attempted.** Delivery is via patch + bundle + tarball, same
pattern as the backend-support handoff in `cloudcode-backend-support-handoff/`.
A `gateway-dropin-handoff/` directory will contain:

- `cloudcode-gateway-dropin.bundle` (git bundle, incremental from `354d632`)
- `patches/*.patch` (per-commit mailbox patches for `git am`)
- `cloudcode-gateway-dropin-combined.patch` (single combined diff)
- `cloudcode-gateway-dropin.tar.gz` (file tree only, no git involvement)
- `SHA256SUMS`
- `DELIVERY.md` (apply / verify / rollback instructions)

---

## 18. Rollback command

Single new directory + one CSP middleware merge + one rewrites merge.

```bash
# Option A — drop the branch entirely (start clean from the parent):
git switch claude/fervent-montalcini-62fba8
git branch -D cloudcode/gateway-dropin-integration

# Option B — revert by commit on the integrated repo:
git revert <gateway-integration-commit-sha>

# Option C — surgical removal (after the integrator merges patch in production):
git rm -rf public/design/gateway/ src/components/gateway/ src/app/gateway/
git rm scripts/compute-design-lock.mjs scripts/verify-design-lock.mjs
git rm design-lock/gateway-manifest.json
git rm tests/gateway/*.test.ts
# then revert the rewrites array + middleware CSP scope in next.config.js + middleware.ts
```

---

## 19. Hard rules — final attestation

- ✅ No `.env` changes (proof/secret-scan.txt empty).
- ✅ No auth weakening (parent CSP unchanged; sandbox added).
- ✅ No public exposure of local UIs (mocks served same-origin, sandboxed).
- ✅ No Zapier writes (none added).
- ✅ No SMB / Fork 2 (none touched).
- ✅ No external farmers (none touched).
- ✅ No fake LIVE status — `GatewayShell` does not synthesize a status
  bar; the status grammar inside the mocks remains gray/yellow/blue/red/
  green-only-when-Bridge-open as designed.
- ✅ No mock HTML / CSS modified (design-lock manifest proves it).
- ✅ No re-implementation in React.
- ✅ No new visual states / colours beyond the locked grammar.
- ✅ No Codex active file touched.
- ✅ No 100-day plan edited.

---

## 20. What Luis decides next

- Apply the patch onto Mission Control v2 on `srv1568353` (per
  `INTEGRATION-PATCH.md`).
- Run the four production proofs in § 10.
- If anything looks different from the design after integration: the
  design is the contract — file a Codex ticket, not a CloudCode patch.
