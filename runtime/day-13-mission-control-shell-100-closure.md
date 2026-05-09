# Day 13 - Mission Control Shell 100% Closure

Date: 2026-05-09
Branch: to-knowledge-mc
Lane: Mission Control Shell
Status: DEVELOPER-SIDE CLOSED
Blocker class: OWNER_GATED for authenticated owner visual confirmation
Code commit: 92c130b
Rollback: git revert 92c130b

## Scope

Day 13 closes the developer-side shell/layout defect that could trap or clip long routed pages. The goal was to make the Mission Control root shell stop forcing every page into a single fixed viewport and allow natural document scrolling for Gateway FULL v3 and other long Mission Control surfaces.

This is not owner visual GO. Authenticated owner retest remains required before the Gateway/Mission Control visual lane can move beyond PARTIAL GO.

## Inventory Findings

The shell-level offender was:

- src/app/layout.tsx
  - previous wrapper: h-screen overflow-hidden bg-background text-foreground
  - impact: every routed page lived inside a fixed-height clipped shell unless that page managed its own internal scroll perfectly.

Related surfaces inspected:

- src/components/gateway/DesignerGatewayMockFrame.tsx
  - already uses min-h-screen
  - iframe scrolling remains enabled
  - visible exits remain present:
    - Mission Control Home
    - Gateway Overview
    - Agent Hub
- src/app/tkmc/page.tsx
  - remains a concrete Mission Control home route.
- src/app/[[...panel]]/route.ts
  - still protects main app entrypoints and redirects unauthenticated users toward /login.
- src/components/layout/nav-rail.tsx
  - Gateway entry remains present in the navigation structure.

## What Was Implemented

- Replaced the root forced viewport wrapper with a natural document-height wrapper:
  - from: h-screen overflow-hidden
  - to: min-h-screen
- Added a regression guardrail test:
  - src/lib/mission-control-shell.test.ts
- The test asserts:
  - the root shell does not use h-screen overflow-hidden
  - the Gateway designer frame remains scrollable
  - the Gateway designer frame keeps visible exits to /tkmc, /gateway, and /gateway/agent-hub
  - /tkmc remains a real Mission Control home route, not a redirect stub.

## Files Changed

- src/app/layout.tsx
- src/lib/mission-control-shell.test.ts

No designer tokens, designer mock HTML, Gateway FULL v3 class names, or accepted visual contract files were changed.

## Routes / UI Behavior

Expected behavior after this change:

- Long pages can use native document scroll instead of being clipped by the root shell.
- Gateway FULL v3 mounted mock pages are no longer fighting an outer h-screen overflow-hidden root.
- Existing protected route behavior is preserved.
- Existing Gateway exit navigation is preserved.
- No fake buttons were added.

## Runtime / Deployment

Source commit pushed:

- 92c130b

Standalone deployment:

- Build/deploy script rebuilt commit 92c130b.
- The deploy script again reported a standalone PID and then its child exited before route smoke.
- Controlled proof runtime was started in a local-only screen-backed process:
  - host: 127.0.0.1
  - port: 3337
  - pid: 38987

This proof runtime was local-only. No public listener remained.

## Route Smoke

Smoke base: http://127.0.0.1:3337

Unauthenticated route behavior:

- /login: 200
- /tkmc: 307 to /login
- /gateway: 307 to /login
- /gateway/agent-hub: 307 to /login
- /gateway/token-governor: 307 to /login
- /agents: 307 to /login
- /agent-network: 307 to /login

Protected action invariant:

- scripts/check-protected-actions-locked.mjs against http://127.0.0.1:3337
- ok: true
- checked: 11
- protected actions remained locked.

Authenticated visual shell proof:

- Not performed because this runtime does not have an owner browser session.
- Remaining blocker: owner_authenticated_visual_shell_retest_required

## Tests Run

- pnpm test src/lib/mission-control-shell.test.ts
  - 1 file passed
  - 3 tests passed
- git diff --check
  - passed
- pnpm run typecheck
  - passed
- pnpm run build
  - passed
- pnpm test
  - 145 files passed
  - 1284 tests passed
- node scripts/check-protected-file-invariants.mjs
  - ok: true
- staged secret scan
  - no matches
- .env diff check
  - clean

## Safety Confirmation

- No .env changes.
- No secrets printed.
- No auth weakening.
- No fake owner visual proof.
- No fake GO.
- No fake buttons added.
- No designer mock redesign.
- No Gateway FULL v3 token/class changes.
- No parked artifacts staged.
- Final proof runtime bound to 127.0.0.1 only.

## Remaining Blocker

Blocker: owner_authenticated_visual_shell_retest_required

Classification: OWNER_GATED

Owner retest needed:

- Log in to Mission Control.
- Open /tkmc.
- Open /gateway.
- Open /gateway/agent-hub.
- Confirm pages scroll naturally and are not clipped by the Mission Control shell.
- Confirm owner can return to Mission Control Home and Gateway Overview.

## Closeout Ledger

- Day number and lane: Day 13 - Mission Control Shell
- Status: DEVELOPER-SIDE CLOSED
- Blocker classification: OWNER_GATED
- Commit hash: 92c130b
- Push result: pushed to origin/to-knowledge-mc
- Deployed commit: 92c130b
- Runtime proof: local-only standalone proof on 127.0.0.1:3337, pid 38987
- Rollback command: git revert 92c130b
- Next day automatically started: Day 14 - Mission Control Navigation / Back 100% Closure
