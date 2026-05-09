# Day 15 - Gateway Native Implementation Decision 100% Closure

Date: 2026-05-09
Branch: to-knowledge-mc
Lane: Gateway Native Implementation Decision
Status: DEVELOPER-SIDE CLOSED
Blocker class: OWNER_GATED for authenticated owner visual confirmation
Code commit: 25f577e
Rollback: git revert 25f577e

## Scope

Day 15 decides and proves the Gateway implementation path.

Decision: keep the accepted FULL v3 designer HTML mounted directly inside Mission Control through the Gateway frame, rather than rebuilding the screens as a custom React interpretation. This follows the owner/designer instruction that the design files are the visual contract and should not be redesigned.

This closes the developer-side trapped-frame defect. It is not owner visual GO until the owner confirms the fixed production UI in the authenticated browser.

## Inventory Findings

Files and surfaces inspected:

- src/components/gateway/DesignerGatewayMockFrame.tsx
- src/proxy.ts
- src/app/gateway/page.tsx
- src/app/gateway/agent-hub/page.tsx
- src/app/gateway/agent-hub/paperclip/page.tsx
- src/app/gateway/routes/page.tsx
- src/app/gateway/registry/page.tsx
- src/app/gateway/policies/page.tsx
- src/app/gateway/health/page.tsx
- src/app/gateway/dispatcher/page.tsx
- src/app/gateway/token-governor/page.tsx
- src/app/gateway/bridge-session/page.tsx
- src/app/gateway/node-detail/page.tsx
- src/app/gateway/mobile-tablet/page.tsx
- public/designer-mission-control/design/gateway/*.html
- public/designer-mission-control/design/gateway/shared/tokens.css
- public/designer-mission-control/design/gateway/shared/render.js

Accepted direct mock routes remain:

- `/gateway` -> `Gateway Overview.html`
- `/gateway/routes` -> `Gateway Routes.html`
- `/gateway/registry` -> `Gateway Registry.html`
- `/gateway/policies` -> `Gateway Policies.html`
- `/gateway/health` -> `Gateway Health.html`
- `/gateway/dispatcher` -> `Dispatcher.html`
- `/gateway/token-governor` -> `Token Governor.html`
- `/gateway/agent-hub` -> `Agent Hub.html`
- `/gateway/agent-hub/paperclip` -> `Paperclip.html`
- `/gateway/bridge-session` -> `Bridge Session Flow.html`
- `/gateway/node-detail` -> `Gateway Node Detail.html`
- `/gateway/mobile-tablet` -> `Gateway Mobile Tablet.html`

## Root Cause Found

The previous scroll/navigation work removed the outer `h-screen overflow-hidden` trap, but browser proof still showed the Agent Hub frame stuck at the default iframe height of 150px.

Two precise causes were found:

1. Designer asset route framing was blocked:
   - `/designer-mission-control/...` returned `X-Frame-Options: DENY`
   - its CSP used `frame-ancestors 'none'`
   - effect: the Gateway iframe could not reliably render the same-origin designer asset.

2. The iframe height sync missed already-loaded frames:
   - when the iframe loaded before the React effect listener attached, no height sync ran
   - effect: the iframe stayed at 150px even when the mock document was much taller.

## What Was Implemented

- Kept the direct designer mock mounting path.
- Allowed only protected designer assets to be framed by same-origin Gateway pages:
  - designer route: `X-Frame-Options: SAMEORIGIN`
  - designer route CSP: `frame-ancestors 'self'`
- Kept normal Mission Control/Gateway pages protected from framing:
  - app pages still return `X-Frame-Options: DENY`
  - app page CSP still uses `frame-ancestors 'none'`
- Added an immediate iframe height sync path when the iframe document is already loaded:
  - checks `iframe.contentDocument?.readyState === 'complete'`
  - calls the same load handler and ResizeObserver setup
  - preserves `scrolling='yes'`
- Added a regression guardrail:
  - exact FULL v3 designer files are mounted by route
  - no return to `h-screen w-full overflow-hidden`
  - iframe height sync, ResizeObserver, and exits remain present
  - designer assets stay same-origin frameable while app pages stay frame-denied.

## Files Changed

- src/components/gateway/DesignerGatewayMockFrame.tsx
- src/proxy.ts
- src/proxy.test.ts
- src/lib/gateway-native-frame-decision.test.ts

No designer HTML, shared tokens, shared classes, `.env`, credentials, governance files, or parked artifacts were changed.

## Runtime / Browser Proof

Committed source:

- 25f577e

Standalone deployment:

- Build/deploy script rebuilt committed HEAD 25f577e.
- The deploy script reported:
  - deployed commit: 25f577e
  - pid: 47142
  - port: 3337
- The deploy child exited before route smoke, matching the known standalone child-exit behavior in this local proof environment.
- Controlled proof runtime was started in a local-only screen-backed process:
  - host: 127.0.0.1
  - port: 3337
  - pid: 47252

Browser proof:

- route: `/gateway/agent-hub`
- viewport: 1480x900
- auth method: local proof cookie only, no owner secrets
- iframe source: `/designer-mission-control/design/gateway/Agent%20Hub.html`
- body scroll height: 12539
- iframe height: 12484
- iframe inline height: `12484px`
- iframe ready state: complete
- iframe body height: 12572
- page can scroll: true
- wheel scroll result: `scrollY=700`
- max scroll: 12519
- exits visible:
  - Mission Control Home: true
  - Gateway Overview: true
  - Agent Hub: true
- designer asset headers:
  - `X-Frame-Options: SAMEORIGIN`
  - CSP contains `frame-ancestors 'self'`
- Gateway page header:
  - `X-Frame-Options: DENY`

Result: PASS.

## Route Smoke

Smoke base: http://127.0.0.1:3337

Unauthenticated route behavior:

- `/login`: 200
- `/gateway`: 307 to `/login`
- `/gateway/agent-hub`: 307 to `/login`
- `/gateway/agent-hub/paperclip`: 307 to `/login`
- `/gateway/dispatcher`: 307 to `/login`
- `/gateway/token-governor`: 307 to `/login`
- `/gateway/bridge-session`: 307 to `/login`
- `/agents`: 307 to `/login`
- `/agent-network`: 307 to `/login`

Protected action invariant:

- scripts/check-protected-actions-locked.mjs against http://127.0.0.1:3337
- ok: true
- checked: 11
- protected actions remained locked.

## Tests Run

- pnpm test src/proxy.test.ts src/lib/gateway-native-frame-decision.test.ts src/lib/mission-control-shell.test.ts
  - 3 files passed
  - 12 tests passed
- git diff --check
  - passed
- pnpm run typecheck
  - passed
- pnpm run build
  - passed
- pnpm test
  - 147 files passed
  - 1296 tests passed
- node scripts/check-protected-file-invariants.mjs
  - ok: true
- staged secret scan
  - ok: true
  - checked files: 4
- .env diff check
  - clean

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No fake GO.
- No fake owner visual proof.
- No fake buttons added.
- No designer mock redesign.
- No Gateway FULL v3 token/class changes.
- No parked artifacts staged.
- Designer assets are frameable only by same-origin pages.
- Main Mission Control/Gateway app pages remain protected from external framing.

## Remaining Blocker

Blocker: owner_authenticated_gateway_frame_retest_required

Classification: OWNER_GATED

Owner retest needed:

- Log in to Mission Control.
- Open `/gateway`.
- Open `/gateway/agent-hub`.
- Confirm the FULL v3 mock renders rather than a blank/static frame.
- Scroll up/down normally.
- Confirm Mission Control Home, Gateway Overview, and Agent Hub exits are visible.
- Confirm browser back and visible exits are usable.

## Closeout Ledger

- Day number and lane: Day 15 - Gateway Native Implementation Decision
- Status: DEVELOPER-SIDE CLOSED
- Blocker classification: OWNER_GATED
- Commit hash: 25f577e
- Push result: pushed to origin/to-knowledge-mc
- Deployed commit: 25f577e
- Runtime proof: local-only standalone proof on 127.0.0.1:3337, pid 47252
- Rollback command: git revert 25f577e
- Next day automatically started: Day 16 - Gateway Designer Fidelity 100% Closure
