# Gateway Pattern A Drop-In Correction

Date: 2026-05-10
Status: IMPLEMENTED - owner retest still required before GO
Branch: to-knowledge-mc

## Objective

Correct the Gateway FULL v3 integration so the designer mock remains the production UI contract.

## Root Cause

The live Gateway leaf routes were implemented as Next page wrappers that mounted the designer pages inside a React/Next page frame. That created visual drift, wrapper chrome, and scroll/container behavior that did not match the designer mock.

## Designer Decision Applied

Pattern A was applied:

- `/gateway` is the only Next Gateway surface.
- `/gateway` redirects into the static designer Mission Control shell with `page=gateway`.
- Gateway sub-pages are internal GatewayShell tabs.
- Legacy leaf URLs redirect to `/gateway?tab=...`.
- GatewayShell loads raw static mock HTML via iframe from absolute same-origin static asset paths.
- Mock HTML, mock CSS, shared tokens, and class names were not edited.

## Files Changed

- `next.config.js`
- `public/designer-mission-control/src/gateway/GatewayShell.jsx`
- `public/designer-mission-control/src/app.jsx`
- `src/app/gateway/page.tsx`
- `src/app/agents/route.ts`
- `src/app/[[...panel]]/route.ts`
- `src/lib/navigation.ts`
- `src/lib/gateway-cloudcode-integration.ts`
- Gateway/navigation tests

## Routes Changed

- `/gateway` -> `/designer-mission-control/Mission%20Control.html?page=gateway`
- `/gateway/agent-hub` -> `/gateway?tab=agent-hub`
- `/gateway/agent-hub/paperclip` -> `/gateway?tab=paperclip`
- `/gateway/routes` -> `/gateway?tab=routes`
- `/gateway/registry` -> `/gateway?tab=registry`
- `/gateway/policies` -> `/gateway?tab=policies`
- `/gateway/health` -> `/gateway?tab=health`
- `/gateway/dispatcher` -> `/gateway?tab=dispatcher`
- `/gateway/token-governor` -> `/gateway?tab=governor`
- `/gateway/bridge-session` -> `/gateway?tab=bridge`
- `/gateway/node-detail` -> `/gateway?tab=node-detail`
- `/gateway/mobile-tablet` -> `/gateway?tab=mobile`

## Deleted Wrapper Pages

The following Next wrappers were removed so they cannot re-render or reinterpret the mocks:

- `src/app/gateway/routes/page.tsx`
- `src/app/gateway/registry/page.tsx`
- `src/app/gateway/policies/page.tsx`
- `src/app/gateway/health/page.tsx`
- `src/app/gateway/dispatcher/page.tsx`
- `src/app/gateway/token-governor/page.tsx`
- `src/app/gateway/agent-hub/page.tsx`
- `src/app/gateway/agent-hub/paperclip/page.tsx`
- `src/app/gateway/agent-hub/[id]/page.tsx`
- `src/app/gateway/bridge-session/page.tsx`
- `src/app/gateway/node-detail/page.tsx`
- `src/app/gateway/mobile-tablet/page.tsx`

## Data Truth

`shared/agent-data.js` remains the data-wiring file for Agent Hub. It reads `/api/gateway/agent-hub/status` and maps live/gated/blocked states into the designer status grammar. The mock rendering code remains unchanged.

## Verification So Far

Focused tests passed:

- `src/lib/gateway-native-frame-decision.test.ts`
- `src/lib/mission-control-shell.test.ts`
- `src/app/gateway-route-alias.test.ts`
- `src/lib/navigation.test.ts`
- `src/lib/gateway-cloudcode-integration.test.ts`
- `src/app/api/gateway/status/route.test.ts`
- `src/app/api/gateway/navigation/route.test.ts`

Result: 8 files / 34 tests passed.

Full validation run:

- `git diff --check`: passed.
- `pnpm run typecheck`: passed after clearing stale generated `.next/types`.
- `pnpm run build`: passed; deleted Gateway wrapper pages no longer appear as app routes.
- `pnpm test`: passed, 181 files / 1414 tests.
- `scripts/check-protected-file-invariants.mjs`: passed.
- `.env` diff check: no diff.
- `scripts/check-mission-control-route-rendering.mjs`: passed, 46 routes and 8 designer pages checked.

Runtime smoke on `127.0.0.1:3337`:

- `/login` returns 200.
- `/gateway` redirects to `/login` when unauthenticated.
- `/gateway/agent-hub` redirects to `/gateway?tab=agent-hub`.
- `/gateway/agent-hub/paperclip` redirects to `/gateway?tab=paperclip`.
- `/gateway/routes` redirects to `/gateway?tab=routes`.
- Designer static assets remain protected when unauthenticated.

## Owner Retest Required

Gateway UI is not GO until owner confirms:

- `/gateway` shows the FULL v3 Gateway shell.
- `/gateway?tab=agent-hub` shows the designer Agent Hub mock.
- The owner can navigate through Mission Control rail and Gateway internal tabs.
- Agent Hub scrolls normally.
- No fake buttons, raw paths, secrets, or fake live status are visible.

## Blocker Classification

OWNER_GATED: owner visual retest required after deploy/restart.

## Rollback

After commit:

`git revert <gateway_pattern_a_commit_sha>`
