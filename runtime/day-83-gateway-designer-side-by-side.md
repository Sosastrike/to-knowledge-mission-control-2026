# Day 83 — Gateway Designer Side-by-Side

Lane: Gateway UX final pass
Status: Developer-side closed, production owner-auth retest gated
Blocker class: OWNER_GATED
Checked at: 2026-05-12T03:20:00Z

## What Was Implemented

- Added a protected raw Gateway design asset route at `/design/gateway/[[...path]]`.
- Pointed `GatewayShell.jsx` iframe tabs at `/design/gateway/*.html`, matching the designer's direct verification path.
- Kept approved mock HTML/CSS/class names untouched.
- Kept the live read-only `window.AGENTS` / Gateway data hydration files in place.
- Added route/security tests proving the new raw design route serves mounted designer files without rewriting and remains behind the owner session gate.
- Added the new raw design URLs to the protected route smoke contract so future smokes fail if they become public.

## Files Changed

- `public/designer-mission-control/src/gateway/GatewayShell.jsx`
- `scripts/protected-route-smoke-contract.mjs`
- `src/app/design/gateway/[[...path]]/route.ts`
- `src/app/design/gateway/route.test.ts`
- `src/lib/gateway-native-frame-decision.test.ts`
- `src/lib/mission-control-shell.test.ts`
- `src/lib/protected-route-smoke-contract.test.ts`
- `src/proxy.ts`
- `src/proxy.test.ts`
- `runtime/day-83-gateway-designer-side-by-side/proof.json`
- `runtime/day-83-gateway-designer-side-by-side/protected-route-smoke.json`
- `runtime/day-83-gateway-designer-side-by-side/direct-design-agent-hub.png`
- `runtime/day-83-gateway-designer-side-by-side/gateway-shell-agent-hub.png`

## Routes / Endpoints Changed

- Added `GET /design/gateway/[[...path]]`
- Added `HEAD /design/gateway/[[...path]]`
- Gateway shell now frames:
  - `/design/gateway/Gateway Overview.html`
  - `/design/gateway/Agent Hub.html`
  - `/design/gateway/Paperclip.html`
  - `/design/gateway/Dispatcher.html`
  - `/design/gateway/Token Governor.html`
  - `/design/gateway/Bridge Session Flow.html`
  - `/design/gateway/Gateway Health.html`
  - `/design/gateway/Gateway Routes.html`
  - `/design/gateway/Gateway Registry.html`
  - `/design/gateway/Gateway Policies.html`
  - `/design/gateway/Gateway Node Detail.html`
  - `/design/gateway/Gateway Mobile Tablet.html`

## UI Behavior

- `/gateway?tab=agent-hub` redirects to the designer Mission Control shell and opens Gateway with the Agent Hub tab active.
- The Agent Hub iframe source is `/design/gateway/Agent Hub.html`.
- `/design/gateway/Agent Hub.html` is directly verifiable as the raw mounted designer file once an owner session exists.
- Unauthenticated `/design/gateway/*` requests redirect to `/login`, preserving no-public-local-exposure.
- No React reimplementation, Next page wrapper, HTML rewrite, CSS rewrite, or class-name rewrite was introduced.

## Service / Runtime Behavior

- Local proof server: `pnpm exec next dev --hostname 127.0.0.1 --port 3337`
- Runtime proof:
  - unauthenticated `/design/gateway/Agent%20Hub.html` -> `/login`
  - authenticated local proof cookie `/design/gateway/Agent%20Hub.html` -> `200`, `Content-Type: text/html; charset=utf-8`
  - fetched route SHA-256 matched `public/designer-mission-control/design/gateway/Agent Hub.html`
  - `/gateway?tab=agent-hub` -> `/designer-mission-control/Mission%20Control.html?page=gateway&tab=agent-hub`
  - Gateway iframe source -> `/design/gateway/Agent Hub.html`
- Production/systemd restart was not performed in this local runtime because `systemctl` is not available.

## Tests Run

- `pnpm exec vitest run src/app/design/gateway/route.test.ts src/proxy.test.ts src/lib/gateway-native-frame-decision.test.ts src/lib/mission-control-shell.test.ts src/lib/protected-route-smoke-contract.test.ts`
  - 5 files passed, 25 tests passed
- `pnpm run typecheck`
  - passed
- `pnpm run build`
  - passed; build output includes dynamic `/design/gateway/[[...path]]`
- `pnpm test`
  - 202 files passed, 1498 tests passed
- `node scripts/check-protected-file-invariants.mjs`
  - passed; no protected changes
- `node scripts/secret-scan-contract.mjs`
  - passed; blocker class `NONE`
- `node scripts/raw-exposure-scan-contract.mjs`
  - passed; blocker class `NONE`
- `git diff --check`
  - passed
- `.env` diff check
  - no diff
- `node scripts/protected-route-smoke-contract.mjs http://127.0.0.1:3337`
  - passed after warming `/docs`; 44 routes checked, 0 failures

## Proof Artifacts

- `runtime/day-83-gateway-designer-side-by-side/proof.json`
- `runtime/day-83-gateway-designer-side-by-side/protected-route-smoke.json`
- `runtime/day-83-gateway-designer-side-by-side/direct-design-agent-hub.png`
- `runtime/day-83-gateway-designer-side-by-side/gateway-shell-agent-hub.png`

## Remaining Blocker

OWNER_GATED:

- Owner-authenticated production browser retest is still required after the deployed runtime is restarted to this commit.
- This local proof environment does not expose `systemctl`, so production service restart proof could not be executed here.
- Live API hydration inside the static iframe returned 401 under a synthetic local cookie, which is expected without a real owner session. The raw mock serving path and iframe mount are proven.

## Rollback Command

After commit:

```bash
git revert <day-83-commit>
```

Before commit:

```bash
git restore public/designer-mission-control/src/gateway/GatewayShell.jsx scripts/protected-route-smoke-contract.mjs src/proxy.ts src/proxy.test.ts src/lib/gateway-native-frame-decision.test.ts src/lib/mission-control-shell.test.ts src/lib/protected-route-smoke-contract.test.ts
rm -rf src/app/design runtime/day-83-gateway-designer-side-by-side
```

## Commit / Push

- Commit hash: pending
- Push result: pending

## Next Day

Day 84 — Agent Hub Designer Side-by-Side has automatically started after this Day 83 developer-side closure.
