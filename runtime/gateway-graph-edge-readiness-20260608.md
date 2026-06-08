# Gateway Graph Edge Readiness Diagnostics

Generated: 2026-06-08

## Scope

- Active runtime: `/home/tony/mission-control`
- Service: `mission-control.service`
- Runtime cwd verified: `/home/tony/mission-control/.next/standalone`
- Change type: read-only diagnostics and UI explanation for Gateway graph edges
- External writes executed: false
- Broad connector execution enabled: false
- `.env` / `.env.local` modified: false

## Root Cause

The Gateway graph previously colored SVG lines from node card status plus the edge relation string. A node could be present or green while the edge still had no edge-specific runtime heartbeat, event, or success proof. Those edges defaulted to gray without explaining whether they were standby, read-only, approval-gated, or blocked.

## Edge Statuses

| Edge | Status | Color | Primary reason | Next action |
| --- | --- | --- | --- | --- |
| HTML -> Gateway | read_only | cyan | `html_surface_registered_no_runtime_bridge` | Configure Browser Runtime Bridge only if active browser control is required. |
| Firefox -> Gateway | standby | gray | `firefox_runtime_not_connected` | Start or verify the browser runtime bridge/session. |
| Reports -> Gateway | read_only | cyan | `report_preview_ready_delivery_not_enabled` | Request owner approval before report delivery/write paths. |
| Webhooks -> Gateway | standby | gray | `webhook_receiver_ready_no_recent_events` | Send a signed test event or verify webhook heartbeat. |
| Events -> Gateway | standby | gray | `event_bus_ready_no_recent_events` | Verify event stream heartbeat before expecting a green edge. |

## Added Route

- `GET /api/gateway/graph/edge-readiness`
- Auth: protected viewer route; unauthenticated smoke returned `401`
- Payload includes per-edge:
  - `edge_id`
  - `source`
  - `target`
  - `domain`
  - `status`
  - `color`
  - `primary_reason`
  - `blockers`
  - `last_heartbeat_at`
  - `last_success_at`
  - `last_event_at`
  - `next_action`

## UI Behavior

- Gateway SVG paths now use explicit edge-readiness color classes.
- Hover/focus shows a compact edge tooltip.
- Click opens the existing inspector with:
  - current color
  - status
  - primary reason
  - blockers
  - heartbeat/success/event timestamps
  - next action
- Gray standby edges explicitly show: `Node registered, edge standby.`
- Added Gateway edge legend:
  - Green: live
  - Cyan: read-only active
  - Yellow: approval/degraded
  - Gray: standby/no heartbeat
  - Red: failed/blocked

## Safety

- Did not force any edge green.
- Did not enable browser automation writes.
- Did not enable webhook writes.
- Did not enable report delivery writes.
- Did not enable Zapier, HeyGen, or external connector writes.
- Did not mount SMB.
- Did not run external farmers.
- Did not create a second vault.
- Did not expose credentials, tokens, cookies, authorization headers, or env values.

## Verification

- Targeted tests on server:
  - `pnpm exec vitest run src/lib/gateway-graph-edge-readiness.test.ts src/lib/gateway-graph-edge-readiness-route.test.ts src/lib/gateway-graph-edge-ui.test.ts`
  - Result: passed, 7 tests
- Server typecheck:
  - `pnpm run typecheck`
  - Result: passed
- Server build:
  - `pnpm run build`
  - Result: passed
- Diff check:
  - `git diff --check`
  - Result: passed
- Route smoke:
  - `/login`: `200`
  - `/gateway`: `307` unauthenticated redirect/protection
  - `/agentmail`: `307` unauthenticated redirect/protection
  - `/api/gateway/graph/edge-readiness`: `401` unauthenticated
  - `/api/gateway/models`: `401` unauthenticated
- Deployed static asset proof:
  - `/home/tony/mission-control/.next/standalone/public/design/gateway/Gateway Overview.html` contains `/api/gateway/graph/edge-readiness`
  - Deployed Gateway data contains `html_surface_registered_no_runtime_bridge`
- Service:
  - `mission-control.service` active
  - Runtime cwd: `/home/tony/mission-control/.next/standalone`

## Secret Safety

- `.env` diff: none
- `.env.local` diff: none
- Secret scan on touched files and generated report: no credential values found
- Note: tests intentionally contain regex strings such as `Bearer`, `Authorization`, and `sk-` to assert that payloads do not contain secrets. Those are guard strings, not credentials.

## Files Changed

- `src/lib/gateway-graph-edge-readiness.ts`
- `src/app/api/gateway/graph/edge-readiness/route.ts`
- `src/lib/gateway-graph-edge-readiness.test.ts`
- `src/lib/gateway-graph-edge-readiness-route.test.ts`
- `src/lib/gateway-graph-edge-ui.test.ts`
- `public/design/gateway/Gateway Overview.html`
- `public/design/gateway/shared/gateway-data.js`
- `design/gateway/shared/gateway-data.js`
- `runtime/gateway-graph-edge-readiness-20260608.md`

## Rollback

Revert the Gateway graph edge-readiness commit, rebuild, and restart only:

```bash
cd /home/tony/mission-control
git revert <commit-sha>
pnpm run build
sudo systemctl restart mission-control.service
```
