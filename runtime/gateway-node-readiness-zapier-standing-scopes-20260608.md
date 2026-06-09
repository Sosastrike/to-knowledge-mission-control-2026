# Gateway Node Readiness + Zapier Standing Scopes

Generated: 2026-06-08

## Summary

Implemented card-level Gateway node readiness to match the deployed edge-readiness grammar. Cards now distinguish live, read-only, approval-gated, standby, disabled, and blocked states instead of relying only on legacy `node.status`. Zapier now exposes an always-on read-only discovery/status standing scope while arbitrary writes, Zap creation, social posting, and broad execution remain blocked.

## Root Cause

Gateway graph edges had explicit readiness, but node cards still rendered from static fallback `node.status`, `summary`, and stale copy. That made read-only/standby systems look gray/offline and left Zapier with misleading per-execution approval wording.

## Files Changed

- `src/lib/gateway-graph-node-readiness.ts`
- `src/app/api/gateway/graph/node-readiness/route.ts`
- `src/lib/zapier-standing-scopes.ts`
- `src/lib/zapier-approved-action-library.ts`
- `src/app/api/bridge/zapier/status/route.ts`
- `src/components/gateway/GatewayShell.tsx`
- `public/design/gateway/Gateway Overview.html`
- `public/design/gateway/shared/gateway-data.js`
- `public/design/gateway/shared/render.js`
- `public/design/gateway/shared/tokens.css`
- `public/design/gateway/shared/node-card.css`
- mirrored Gateway design/drop-in static files
- targeted readiness/Zapier tests

## Routes Added Or Changed

- Added `GET /api/gateway/graph/node-readiness`
- Updated `GET /api/bridge/zapier/status`
- Existing `GET /api/bridge/zapier/approved-actions` now includes standing-scope metadata.

## Current Node States

- HTML: read-only/standby surface, reason `html_surface_registered_no_runtime_bridge`
- Firefox: standby, reason `firefox_runtime_not_connected`
- Reports: read-only/cyan, `Preview ready · delivery guarded`
- Webhooks: standby/gray, `Receiver ready · waiting for events`
- Events: standby/gray, `Event bus ready · no recent events`
- Zapier: read-only/cyan, `Zapier discovery ready · writes guarded`
- AgentMail: approval-gated/yellow, `AgentMail ready · approval-gated sending`
- xAI Grok: blocked/red, `xai_grok_permission_or_billing_required`

## Zapier Standing Scope

Active scope:

- `zapier.scope.discovery_and_status`
- mode: read-only
- writes enabled: false
- broad execution enabled: false
- external writes executed: false

Allowed read-only discovery/status actions:

- `zapier.connection_probe`
- `zapier.tool_list`
- `zapier.zap_metadata_read`
- `zapier.execution_status_check`

Out-of-scope actions return `zapier_action_outside_standing_scope` and remain approval-required.

## UI Behavior

- Cards consume node readiness for dot/accent/summary/statusline.
- Lock icon now means writes/execution guarded, not offline.
- Inspector shows node readiness and edge readiness separately.
- Graph Health shows node count, node mapping errors, edge count, edge mapping errors, and separate node/edge asset versions.
- Gateway legend remains: green live, cyan read-only active, yellow approval/degraded, gray standby, red blocked.

## Verification

Active runtime: `/home/tony/mission-control`

Targeted tests on active runtime:

```text
pnpm exec vitest run src/lib/gateway-graph-edge-readiness.test.ts src/lib/gateway-graph-edge-readiness-route.test.ts src/lib/gateway-graph-node-readiness.test.ts src/lib/gateway-graph-node-readiness-route.test.ts src/lib/gateway-graph-edge-ui.test.ts src/lib/zapier-standing-scopes.test.ts src/lib/zapier-approved-action-library.test.ts
```

Result: 7 files passed, 25 tests passed.

Server verification:

- `pnpm run typecheck`: passed on active runtime
- `pnpm run build`: passed on active runtime
- `mission-control.service`: active
- runtime cwd: `/home/tony/mission-control/.next/standalone`

Route smoke:

- `/login`: 200
- `/gateway`: 307 unauthenticated redirect
- `/api/gateway/graph/node-readiness`: 401 unauthenticated
- `/api/gateway/graph/edge-readiness`: 401 unauthenticated
- `/api/bridge/zapier/status`: 401 unauthenticated
- `/api/bridge/zapier/approved-actions`: 401 unauthenticated
- `/api/agentmail/status`: 401 unauthenticated

## Safety Proof

- No Zapier writes executed.
- No broad connector execution enabled.
- No Zap creation enabled.
- No social posting enabled.
- No webhook/report delivery writes enabled.
- No SMB mount.
- No external farmers.
- No `.env` or `.env.local` changes.
- Key-material scan on touched source/static/standalone files found no provider keys, bearer tokens, Bitwarden sessions, or env secret assignments.

## Deployment Note

The local clean worktree cannot complete full typecheck/build because many runtime source files are not tracked in git but are present on the active server. The active runtime contains those files, and full typecheck/build passed there. Deployment was applied by directory-preserving selected-file sync to the active runtime, followed by production build and restart of only `mission-control.service`.

## Rollback

Rollback code by reverting the node-readiness/Zapier-standing-scope files from the prior deployed tree, then run:

```bash
cd /home/tony/mission-control
pnpm run build
sudo systemctl restart mission-control.service
```

No credential rollback is required because no secrets or `.env` values were changed.
