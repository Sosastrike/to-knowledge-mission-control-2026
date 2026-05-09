# Gateway UI Owner Retest Final Report (Awaiting Owner Confirmation)

## Objective
Deploy the Gateway FULL v3 UI shell fixes and prepare owner re-test for final visual decision.

## Implemented
1. Fixed mock shell row sizing mismatch in `shared/tokens.css`:
   - `.gw-shell` now explicitly models topbar + tab rail + content row.
2. Simplified route mount wrapper to avoid extra iframe-shell drift:
   - `/src/components/gateway/DesignerGatewayMockFrame.tsx`
3. Kept FULL v3 mounted HTML route structure intact.
4. Added/kept owner-safe copy cleanup on mounted pages (no active Tony/OpenCloud wording in active surfaces).

## Commit Lineage
- `46d386a` — `fix(gateway-ui): remove scroll traps and align mounted designer surfaces`
- `8093307` — `fix(deploy): make standalone probe portable across macOS bash/sed/awk`

## Validation
- `git diff --check` passed.
- `pnpm run typecheck` passed.
- `pnpm run build` passed.
- `pnpm test` passed (`138 files / 1251 tests`).
- Protected-file invariant scan passed.
- `.env` diff remains clean.

## Deployment
- Standalone deploy script now completes successfully with committed head:
  - deployed commit: `8093307`
  - probe asset verified from `/login` render

## Auth-Protection Smoke (Unauthenticated)
All listed routes return `307 -> /login` as expected:
- `/gateway`
- `/gateway/routes`
- `/gateway/registry`
- `/gateway/policies`
- `/gateway/health`
- `/gateway/dispatcher`
- `/gateway/token-governor`
- `/gateway/agent-hub`
- `/gateway/agent-hub/paperclip`
- `/gateway/bridge-session`
- `/gateway/node-detail`
- `/gateway/mobile-tablet`
- `/agent-network`
- `/agents`

## Current Decision
- Gateway owner visual lane: **PARTIAL GO**
- Reason: owner-authenticated re-test still required for final GO.

## Active Blocker
- `gateway_ui_design_fidelity_scroll_defect` remains open until owner confirms:
  1. normal scroll behavior in `/gateway/agent-hub`
  2. no trapped/blank-frame feel
  3. exits/navigation feel correct in authenticated runtime
  4. FULL v3 visual fidelity is acceptable

## No-Secrets Confirmation
- No secrets printed.
- No auth files printed.
- No `.env` changes.
- No auth weakening.

## Next Step
Owner re-test in authenticated production browser using:
- `/gateway`
- `/gateway/agent-hub`
- `/gateway/agent-hub/paperclip`
- `/agent-network` and `/agents` alias paths.
