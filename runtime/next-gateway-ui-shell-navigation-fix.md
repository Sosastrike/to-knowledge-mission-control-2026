# NEXT-4 — Gateway UI Shell Navigation Fix

## Objective
Keep Gateway owner visual proof moving from PARTIAL toward GO by fixing navigation/scroll shell defects.

## Result
PARTIAL+ (navigation and scroll hardening implemented; owner re-test still required for GO).

## Implemented
1. Added visible top exits on Gateway/Agent Hub surfaces:
   - Mission Control Home
   - Dashboard
   - Gateway Overview
   - Agent Hub
2. Added clickable breadcrumb:
   - Mission Control / Gateway / Agent Hub
3. Hardened scroll behavior for long Gateway/Agent Hub pages and added bottom padding so content below-the-fold stays reachable.
4. Added sticky top shell controls on Gateway + Agent Hub + Paperclip drill-down:
   - exits remain visible while scrolling,
   - breadcrumb remains clickable above the fold,
   - owner no longer depends on browser back to escape the page.
4. Preserved aliases:
   - `/agent-network`
   - `/agents`
5. Kept no-fake-button contract behavior.

## Commit
- pending in current workstream batch (includes additional sticky-shell + scroll hardening)

## Files (UI Fix Batch)
- `src/components/gateway/GatewayControlShell.tsx`
- `src/components/gateway-agent-hub/AgentHubControlCenter.tsx`

## Validation Snapshot
- typecheck PASS
- build PASS
- tests PASS (`138` files / `1250` tests)
- button-contract route scan PASS
- protected-file invariant scan PASS

## Blocker to GO
- Owner must confirm fixed UX in authenticated browser re-test:
  - exits visible
  - breadcrumb clickable
  - scroll natural (no trap)
  - no trap behavior

## Files Changed
- `runtime/next-gateway-ui-shell-navigation-fix.md`
- `runtime/next-gateway-ui-shell-navigation-fix.pdf`

## Next Step
Collect owner re-test confirmation and then promote this UI lane from PARTIAL to GO.
