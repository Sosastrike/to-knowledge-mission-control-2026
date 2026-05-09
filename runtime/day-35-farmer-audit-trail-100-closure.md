# Day 35 — Farmer Audit Trail 100% Closure

Date: 2026-05-09
Lane: Build-Wiki / Farmer audit trail
Status: 100% developer-side closure with SERVICE_DOWN blocker
Blocker class: SERVICE_DOWN
Exact blocker: systemctl_command_not_found_in_local_runtime

## What Was Implemented

- Added a read-only Build-Wiki Run Now history reader over:
  - bridge_approval_requests
  - bridge_connector_runs
  - bridge_audit_events
- Exposed Run Now history through:
  - GET /api/bridge/brain-sync/build-wiki/run-now
  - GET /api/bridge/brain-sync/build-wiki/status
- Updated the Mission Control Build-Wiki card to show recent Run Now audit history:
  - approval state
  - run state
  - result label
  - audit event count
  - request and finish timestamps
- Preserved the exact execution scope:
  - action: buildwiki.run_now
  - target: opencloud-docs-farmer.service
- No new write path was added.
- No SMB, Fork 2, external farmer, Zapier, HeyGen, second vault, or broad connector execution was enabled.

## Files Changed

- src/lib/build-wiki-run-now.ts
- src/app/api/bridge/brain-sync/build-wiki/run-now/route.ts
- src/app/api/bridge/brain-sync/build-wiki/status/route.ts
- src/components/agent-network/AgentNetworkClient.tsx
- src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts
- src/app/api/bridge/brain-sync/build-wiki/status/route.test.ts

## Routes Changed

- GET /api/bridge/brain-sync/build-wiki/run-now
  - Now includes history and history_count.
- GET /api/bridge/brain-sync/build-wiki/status
  - Now includes run_now.history and run_now.history_count.

## UI Behavior

- Build-Wiki Live Status now displays recent Run Now audit history when present.
- The Run Now control remains approval-gated.
- The UI does not claim the farmer ran unless the persisted run row shows completion.
- Failed dispatches are shown as service_down, not fake success.

## Service / Runtime Behavior

- Runtime restarted on 127.0.0.1:3337.
- Final proof PID: 43554.
- Deployed commit: 6faf904.
- Login route returned 200.
- Unauthenticated Run Now route returned 401.
- Authenticated Run Now route returned 200.
- Authenticated Build-Wiki status route returned 200.
- Authenticated approval audit report returned 200.
- Live Run Now history count: 8.
- Live status route Run Now history count: 8.
- Live approval audit report Build-Wiki Run Now request count: 8.

## Tests Run

- git diff --check: PASS
- pnpm run typecheck: PASS
- pnpm run build: PASS
- pnpm test: PASS
  - 157 files
  - 1326 tests
- Focused tests:
  - src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts: PASS
  - src/app/api/bridge/brain-sync/build-wiki/status/route.test.ts: PASS
- scripts/check-protected-file-invariants.mjs: PASS
- Staged secret scan: PASS
- .env diff check: PASS

## Proof Artifact

- runtime/day-35-farmer-audit-trail-proof.json

Proof summary:

- ok: true
- source_commit: 6faf904
- deployed_commit: 6faf904
- runtime_pid: 43554
- run_now_history_count: 8
- status_route_history_count: 8
- audit_report_buildwiki_run_now_requests: 8
- no_secret_values_detected: true
- no_raw_paths_detected: true
- no_public_exposure: true

## Remaining Blocker

The app-side audit trail is closed, but the host service dispatch remains blocked because systemctl is not available from the current local runtime context.

Blocker:

- systemctl_command_not_found_in_local_runtime

This keeps the lane at SERVICE_DOWN until the runtime host exposes user-level systemd/systemctl for:

- opencloud-docs-farmer.service
- opencloud-docs-farmer.timer

## Rollback

- git revert 6faf904

## Commit / Push

- Source commit: 6faf904
- Push: origin/to-knowledge-mc updated

## Safety Confirmation

- No .env changes.
- No secrets printed.
- No raw local paths exposed in route payload proof.
- No auth weakening.
- No public local exposure.
- No fake Done.
- No fake Run Now success.
- No SMB/Fork 2.
- No external farmers.
- No Zapier writes.
- No HeyGen generation.

## Next Day Started

Day 36 — Farmer rollback / disable is starting automatically.
