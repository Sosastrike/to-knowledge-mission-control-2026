# NEXT-4 — Gateway UI Shell Navigation + Design Fidelity Fix

## Objective
Fix the owner-reported Gateway UI defect by enforcing the accepted FULL v3 design contract exactly, while keeping production truth and no-fake status behavior.

## Result
PARTIAL GO (implementation complete; owner re-test still required before GO).

## Actions Completed
1. Replaced custom Gateway React page surfaces with direct FULL v3 mock mounting (no redesign layer).
2. Wired these production routes directly to the designer HTML contract:
   - `/gateway` → `Gateway Overview.html`
   - `/gateway/routes` → `Gateway Routes.html`
   - `/gateway/registry` → `Gateway Registry.html`
   - `/gateway/policies` → `Gateway Policies.html`
   - `/gateway/health` → `Gateway Health.html`
   - `/gateway/dispatcher` → `Dispatcher.html`
   - `/gateway/token-governor` → `Token Governor.html`
   - `/gateway/agent-hub` → `Agent Hub.html`
   - `/gateway/agent-hub/paperclip` → `Paperclip.html`
   - `/gateway/bridge-session` → `Bridge Session Flow.html`
   - `/gateway/node-detail` → `Gateway Node Detail.html`
   - `/gateway/mobile-tablet` → `Gateway Mobile Tablet.html`
3. Kept route compatibility behavior intact (`/agents`, `/agent-network`, `/gateway-parent`, `/gateways`, `/gateway-config` are unchanged in existing redirect logic).
4. Replaced static mock-only Agent Hub data behavior with live hydration in `shared/agent-data.js`:
   - reads `/api/gateway/agent-hub/status` using authenticated same-origin request,
   - maps live agent state to locked grammar (`green/yellow/blue/red/gray`),
   - maps live SpaceAgent Browser Automation status/cards/buttons,
   - falls back to existing mock arrays if live API is unavailable.
5. Preserved rendering code and CSS token contract in the designer pages (no class renames, no token overrides).

## Commands Run
- `git diff --check`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`

## Validation Proof
- Typecheck: PASS
- Build: PASS
- Tests: PASS (`138` files / `1251` tests)
- Local protected-route smoke (unauthenticated): PASS (`307 -> /login` for `/gateway`, `/gateway/agent-hub`, `/gateway/routes`, `/gateway/bridge-session`, `/agent-network`, `/agents`)
- Gateway routes present in build output:
  - `/gateway`, `/gateway/routes`, `/gateway/registry`, `/gateway/policies`, `/gateway/health`, `/gateway/dispatcher`, `/gateway/token-governor`, `/gateway/agent-hub`, `/gateway/agent-hub/paperclip`
  - plus added: `/gateway/bridge-session`, `/gateway/node-detail`, `/gateway/mobile-tablet`

## Files Changed
- `src/components/gateway/DesignerGatewayMockFrame.tsx`
- `src/app/gateway/page.tsx`
- `src/app/gateway/routes/page.tsx`
- `src/app/gateway/registry/page.tsx`
- `src/app/gateway/policies/page.tsx`
- `src/app/gateway/health/page.tsx`
- `src/app/gateway/dispatcher/page.tsx`
- `src/app/gateway/token-governor/page.tsx`
- `src/app/gateway/agent-hub/page.tsx`
- `src/app/gateway/agent-hub/paperclip/page.tsx`
- `src/app/gateway/bridge-session/page.tsx`
- `src/app/gateway/node-detail/page.tsx`
- `src/app/gateway/mobile-tablet/page.tsx`
- `public/designer-mission-control/design/gateway/shared/agent-data.js`
- `runtime/next-gateway-ui-shell-navigation-fix.md`

## Security / Safety Checks
- No `.env` changes.
- No auth weakening.
- No new public local exposure introduced.
- No secrets/token values printed.
- No fake live/send/upload claims introduced.

## Blockers
- Owner confirmation still required to upgrade from PARTIAL GO to GO:
  - owner must confirm the authenticated `/gateway` and `/gateway/agent-hub` now visually match FULL v3 side-by-side expectation.

## Commit / Rollback
- Commit: pending (current workstream batch not committed yet).
- Planned rollback command after commit:
  - `git revert <gateway_design_fidelity_commit_sha>`

## Updated Lane Status
- Gateway owner visual lane:
  - from: `owner_visual_proof_partial_navigation_layout_defect`
  - to: `owner_visual_proof_partial_pending_owner_retest_on_fidelity_fix`

## Exact Next Step
Deploy this batch and run owner authenticated re-test checklist against `/gateway` and `/gateway/agent-hub` for final GO/partial decision.
