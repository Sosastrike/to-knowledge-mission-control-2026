# Gateway Drop-In Final Mount Report

Date: 2026-05-09
Status: PARTIAL GO
Blocker class: OWNER_GATED

## Objective

Mount the owner-provided Gateway drop-in design as the production Gateway visual surface without rebuilding, restyling, or changing HTML/CSS/class names.

## Result

- The approved `Gateway-DropIn-v1-FINAL` designer files were copied into the existing Gateway designer asset mount.
- `/gateway/agent-hub` continues to mount `Agent Hub.html`.
- `/gateway/agent-hub/paperclip` continues to mount `Paperclip.html`.
- The React frame no longer adds custom wrapper navigation or visual chrome around the designer mock.
- The previous fixed-height clipping behavior remains removed; the frame expands to the mounted document height and allows native vertical scrolling.
- `shared/agent-data.js` was preserved so `window.AGENTS` is still hydrated from `/api/gateway/agent-hub/status`.
- `shared/gateway-data.js` was rehydrated from read-only Gateway APIs:
  - `/api/gateway/nodes`
  - `/api/gateway/status`

## CloudCode Package

CloudCode backend-support package: not consumed in this correction.

Reason: this hop was explicitly scoped to mounting the owner-provided drop-in UI as-is and restoring existing read-only data hydration. The CloudCode package remains queued for the next truth-rendering pass where status normalization, breadcrumbs, and route smoke tables can be wired without altering the approved visual contract.

## Files Changed

- `public/designer-mission-control/design/gateway/Agent Hub.html`
- `public/designer-mission-control/design/gateway/Agent Zero Commander.html`
- `public/designer-mission-control/design/gateway/Brain Systems.html`
- `public/designer-mission-control/design/gateway/Bridge Session Flow.html`
- `public/designer-mission-control/design/gateway/Delivery Connectors.html`
- `public/designer-mission-control/design/gateway/Dispatcher.html`
- `public/designer-mission-control/design/gateway/Gateway Mobile Tablet.html`
- `public/designer-mission-control/design/gateway/Gateway Routes.html`
- `public/designer-mission-control/design/gateway/Hermes Lieutenant.html`
- `public/designer-mission-control/design/gateway/OpenCloud Workers.html`
- `public/designer-mission-control/design/gateway/shared/gateway-data.js`
- `public/designer-mission-control/design/gateway/shared/render.js`
- `public/designer-mission-control/design/gateway/shared/tokens.css`
- `src/components/gateway/DesignerGatewayMockFrame.tsx`
- `src/lib/gateway-agent-hub-designer-data.test.ts`
- `src/lib/gateway-native-frame-decision.test.ts`
- `src/lib/mission-control-shell.test.ts`

## Routes Affected

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

## Validation

- `git diff --check`: PASS
- `pnpm run typecheck`: PASS
- `pnpm run build`: PASS
- `pnpm test`: PASS, 167 files / 1347 tests
- `node scripts/check-protected-file-invariants.mjs`: PASS
- `.env` diff check: clean
- Staged secret scan: PASS
- `/login`: 200
- Unauthenticated Gateway routes: protected redirects to `/login`
- `node scripts/check-mission-control-route-rendering.mjs http://127.0.0.1:3337`: PASS

Proof artifact:

- `runtime/gateway-dropin-route-rendering-proof.json`

## Runtime

- Mission Control production runtime restarted on `127.0.0.1:3337`.
- Runtime PID after restart: `98651`.
- No public local exposure added.
- No `.env` changes.
- No secrets printed.

## Commit

- Commit: `836e059`
- Message: `fix(gateway): mount approved drop-in UI`

## Rollback

```bash
git revert 836e059
```

## Remaining Blocker

Owner authenticated visual retest is still required before Gateway UI can be marked GO.

Current status remains PARTIAL GO until the owner confirms:

- `/gateway/agent-hub` visually matches the approved drop-in mock.
- Page scroll works naturally.
- Owner is not trapped.
- Agent Hub and Paperclip surfaces remain truthful and navigable.
