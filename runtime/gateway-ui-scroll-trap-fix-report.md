# Gateway UI Scroll Trap Fix Report

## Objective
Remove the Gateway Agent Hub scroll trap while keeping FULL v3 mock mounting intact.

## Actions
1. Updated `DesignerGatewayMockFrame` to remove viewport clipping lock.
2. Switched mount layout to a flex column with scrollable content region.
3. Kept designer HTML pages as mounted source (no mock-token rewrite).

## Files Changed
- `src/components/gateway/DesignerGatewayMockFrame.tsx`

## Implementation Summary
- Replaced:
  - `h-screen overflow-hidden`
- With:
  - `flex h-full min-h-0 flex-col`
  - frame container `flex-1 min-h-0 overflow-y-auto`
  - iframe `scrolling='yes'` + explicit minimum display height

## Proof
- Local validation passed:
  - `git diff --check`
  - `pnpm run typecheck`
  - `pnpm run build`
  - `pnpm test` (138 files / 1251 tests)
- Protected route smoke still returns login redirect for unauthenticated access on Gateway surfaces.

## Blocker
- Owner-authenticated visual confirmation still required after deploy.

## No-Secrets Confirmation
- No secrets printed.
- No auth weakening.
- No `.env` change.

## Next Step
Deploy the UI fix, then run owner visual retest on `/gateway` and `/gateway/agent-hub`.
