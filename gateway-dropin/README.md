# @cloudcode/gateway-dropin

Drop-in package that mounts the approved Gateway designer mocks inside the
production Mission Control v2 surface (Next 15 App Router) so `/gateway`
renders pixel-identical to the designer mocks. No re-implementation, no
drift, no fake LIVE status.

## What this package is

CloudCode owns the Gateway designer integration lane (per Luis D1). This
package is the entire deliverable for that lane:

- The 31 approved designer files, staged under `public/design/gateway/`
  with their original filenames preserved (spaces kept per D5).
- A Next 15 App Router-adapted `GatewayShell.tsx` that iframes each mock
  with proper encoded paths, basePath-aware src, and `sandbox="allow-scripts"`
  isolation.
- A single canonical route at `src/app/gateway/page.tsx`.
- A `next.config.js` rewrites block for deep links
  (`/gateway/agent-hub` → `/gateway?tab=agent-hub`, etc.).
- A path-scoped CSP exception that lives **only** under `/design/gateway/*`
  — parent Mission Control CSP is untouched.
- A design-lock manifest with SHA-256 hashes for all 31 files plus the
  compute + verify scripts that enforce it.
- A vitest suite that proves the URL → tab resolution, the URL encoding,
  the CSP scope, and the design-lock parity.

## What this package is NOT

- Not a re-implementation of any designer mock. The mock IS the contract.
- Not a redesign. Tab list, hints, styles inside `GatewayShell` are exactly
  what the original drop-in shipped.
- Not the canonical Agent Network or `designer-mission-control` surface
  — those remain as documented in D7.
- Not the data-wiring PR. Replacing `shared/agent-data.js` with an API-backed
  version is a future, separate change. The 31 mocks stay byte-identical.
- Not a push or remote-deploy. The package is delivered as a patch + tarball.

## Decisions baked in (D1–D7 from Luis)

| Decision | This package's behaviour |
| --- | --- |
| D1 — Coordination | CloudCode owns Gateway designer integration; Codex retains 100-day plan ownership and leaves the Gateway lane alone. |
| D2 — Missing package | `Mission-Control-Gateway-FULL-v3` is PRESENT on the drive but at `/Volumes/Personal-Drive/Chrome Files 2026/handoff 3/Mission-Control-Gateway-FULL-v3/` (not in the `handoff/` folder Luis referenced). We use `Gateway-DropIn-v1-FINAL` for the production drop-in; the FULL-v3 reference shell is out of scope here. |
| D3 — Next 15 / App Router | `GatewayShell.jsx` → `GatewayShell.tsx`, `'use client'`, `import { useState, useEffect, useCallback, useMemo } from 'react'`, `usePathname` + `useSearchParams` + `useRouter`, default export. Mock HTML/CSS untouched. |
| D4 — CSP | Path-scoped `Content-Security-Policy` for `/design/gateway/*` only. `script-src 'self' 'unsafe-inline'` is justified inline. Parent CSP unchanged. iframe `sandbox="allow-scripts"` (no `allow-same-origin` until data wiring needs it). |
| D5 — Filename spaces | Files copied verbatim with spaces. `iframeSrcFor` runs `encodeURI()` so the URL is `Agent%20Hub.html`. No rename. |
| D6 — Design Lock | SHA-256 manifest at `design-lock/gateway-manifest.json` (31 entries). Compute + verify scripts ship alongside. Owner unlock workflow = re-run compute, review the diff. |
| D7 — Canonical surface | `/gateway` is the only canonical Gateway surface. Deep links resolve through rewrites. `designer-mission-control/[[...path]]` is retained as legacy/diagnostic. |

## Layout

```
gateway-dropin/
├── README.md                            (overview — this file)
├── INTEGRATION-PATCH.md                 (where each file goes in production)
├── HANDOFF.md                           (closeout report for Luis)
├── package.json                         (local devDeps only)
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── public/design/gateway/               (31 designer files — names preserved)
├── src/
│   ├── app/gateway/page.tsx             (the single /gateway route)
│   └── components/gateway/
│       └── GatewayShell.tsx             (Next 15 App Router-adapted shell)
├── next.config.partial.js               (rewrites — merge into prod config)
├── middleware.gateway-csp.partial.ts    (CSP exception — merge into prod middleware)
├── design-lock/
│   └── gateway-manifest.json            (31 SHA-256 entries)
├── scripts/
│   ├── compute-design-lock.mjs          (one-shot: regenerate manifest)
│   └── verify-design-lock.mjs           (CI guard: fail on drift)
├── tests/
│   ├── gateway-shell.test.ts            (14 tests)
│   ├── csp-scope.test.ts                (11 tests)
│   └── design-lock.test.ts              (4 tests)
└── proof/                               (typecheck, vitest, secret scan, design-lock)
```

## Local commands

```bash
cd gateway-dropin
npm install                       # local-only devDeps
npm run typecheck                 # tsc --noEmit
npm run test                      # vitest run (29 tests)
npm run design-lock:compute       # regenerate manifest
npm run design-lock:verify        # CI guard
```
