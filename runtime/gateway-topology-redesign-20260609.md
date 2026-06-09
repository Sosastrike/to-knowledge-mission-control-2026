# Gateway Topology Redesign + Approval Semantics Cleanup - 2026-06-09

## Summary
- Implemented the Gateway overview as an operator map instead of a direct line hairball.
- Deployed to active runtime: `/home/tony/mission-control`.
- Restarted only `mission-control.service`.
- No external writes, Zapier writes, HeyGen writes, browser writes, webhook writes, report delivery writes, SMB mounts, external farmers, `.env` edits, `.env.local` edits, second vault, or secret exposure occurred.

## Root Cause
- Gateway lines were drawn as direct card-to-card Bezier paths and fixed rails without checking card or warning-chip geometry.
- Gateway Graph Health and Tweaks/Hero controls lived inside the working canvas.
- Node cards used legacy status semantics, so guarded/read-only systems looked gray or broken.
- Approval states were scattered across cards instead of consolidated into an operator approval surface.

## Files Changed
- `public/design/gateway/Gateway Overview.html`
- `gateway-dropin/public/design/gateway/Gateway Overview.html`
- `public/design/gateway/shared/gateway-data.js`
- `gateway-dropin/public/design/gateway/shared/gateway-data.js`
- `public/design/gateway/shared/render.js`
- `gateway-dropin/public/design/gateway/shared/render.js`
- `src/lib/gateway-graph-node-readiness.ts`
- `src/lib/gateway-graph-edge-readiness.ts`
- `src/lib/gateway-approval-center.ts`
- `src/app/api/gateway/approvals/center/route.ts`
- Gateway readiness/approval tests for edge UI, node readiness, edge readiness, Zapier scopes, and Approval Center.

## UI / Topology Changes
- Added Gateway View Controls: Fit, Reset, Center Dispatcher, Center Selected, Edit Layout, Save Layout, Reset Layout, Operator, Trace, Diagnostics, and Quiet modes.
- Added local UI preference persistence under `gateway_overview_ui_v1`; stores only viewport, card positions, drawer state, edge mode, and visual toggles.
- Added card drag/reposition in layout edit mode.
- Added card-overlap-safe routed pathlines with visible-endpoint filtering and card-avoiding orthogonal grid routing.
- Added Operator Mode as default; Trace, Diagnostics, and Quiet modes are opt-in.
- Moved Gateway Graph Health and legends into the collapsible `Gateway Diagnostics` drawer.
- Moved Tweaks/Hero Treatment into the collapsible `View Settings` drawer.
- Added the protected read-only Gateway Approval Center surface at `/api/gateway/approvals/center`.

## Readiness Semantics
- Green: live.
- Cyan/blue: read-only active.
- Yellow: guarded / approval-gated.
- Gray: standby / no heartbeat.
- Red: blocked.
- Muted gray: disabled / not installed.
- Lock icon now means writes/execution/delivery/credentials/billing/policy are guarded, not offline.

## AgentMail
- Final wording: `AgentMail ready · approval-gated sending`.
- Setup state: `approval_gated_send_ready`.
- Per-send state: `no_pending_send_request`.
- Removed stale global `Bridge Session required to send mail` from deployed Gateway static/runtime assets.
- `owner_approval_required` is not shown as a global AgentMail failure.

## Zapier
- Final wording: `Zapier discovery ready · writes guarded`.
- Standing read-only discovery scope: `zapier.scope.discovery_and_status`.
- Broad Zapier writes remain disabled.
- Out-of-scope Zapier actions remain approval-required.
- Removed stale default copy: `Owner pre-approval required per execution scope`.

## Approval Center Classification
- AgentMail: standing scope active / approval-gated send ready.
- Zapier: standing read-only discovery scope active / writes guarded.
- OpenCloud / OCTM: approval needed for runtime execution scope.
- Palacio / MemPalace: approval needed for memory writes.
- Brain Sync: approval needed for sync writes.
- GBrain: read-only active; no tool invocation enabled.
- Build-Wiki: run guarded by exact scope.
- HeyGen: generation guarded.
- Google Drive / OneDrive: uploads guarded.
- Reports: preview ready / delivery guarded.
- Webhooks: signed outbound delivery guarded.
- Events: event bus ready / no recent events.

## Geometry Proof
- Local headless Playwright geometry pass against `public/design/gateway/Gateway Overview.html`:
  - visible card count: 39
  - card overlap count: 0
  - sampled edge/card intersections: 0
  - sampled edge/warning-chip intersections: 0
  - Gateway View Controls present: true
  - default edge mode: `edges mode-operator`
- Server static script syntax checks passed for both main and gateway-dropin Gateway Overview files.

## Checks Run
- Server targeted tests:
  - `pnpm exec vitest run src/lib/gateway-graph-edge-ui.test.ts src/lib/gateway-graph-node-readiness.test.ts src/lib/gateway-graph-node-readiness-route.test.ts src/lib/gateway-graph-edge-readiness.test.ts src/lib/gateway-approval-center.test.ts src/lib/gateway-approval-center-route.test.ts src/lib/zapier-standing-scopes.test.ts src/lib/zapier-approved-action-library.test.ts`
  - Result: 8 files passed, 33 tests passed.
- Server typecheck:
  - `pnpm run typecheck`
  - Result: passed.
- Server build:
  - `pnpm run build`
  - Result: passed; standalone static assets synced.
- Route smoke on `127.0.0.1:3337`:
  - `/login`: 200
  - `/agentmail`: 307 unauthenticated redirect
  - `/gateway`: 307 unauthenticated redirect
  - `/api/gateway/graph/node-readiness`: 401 unauthenticated
  - `/api/gateway/graph/edge-readiness`: 401 unauthenticated
  - `/api/gateway/approvals/center`: 401 unauthenticated
  - `/api/bridge/zapier/status`: 401 unauthenticated
  - `/api/agentmail/status`: 401 unauthenticated

## Service Status
- `mission-control.service`: active running.
- Runtime cwd: `/home/tony/mission-control/.next/standalone`.
- Server process: `next-server (v16.2.3)`.

## Secret Safety
- Boundary-aware scan over touched Gateway source, static assets, Approval Center route, and deployed standalone Gateway assets found no key/token/cookie/authorization-header values.
- `.env` diff: empty.
- `.env.local` diff: empty.
- No credentials were added to client bundle or reports.

## Deployment Notes
- Active server worktree was already heavily dirty before this hop; no hard reset was used.
- The narrow Gateway patch was applied on top of the active runtime and verified there.
- A local clean-branch commit/push records the implemented source changes.

## Rollback
- Code rollback: revert the Gateway topology commit on branch `codex/agentmail-hosted-connect-20260606`, rebuild, and restart `mission-control.service`.
- Runtime rollback on the dirty server, if needed: restore the touched files from the previous deployment backup or reverse-apply the Gateway topology patch, then run `pnpm run build` and `sudo systemctl restart mission-control.service`.
