# Day 10 - Bridge Session Approvals 100% Closure

Date: 2026-05-09

Status: DEVELOPER-SIDE CLOSED, SERVICE_DOWN FOR LIVE DISPATCH

Decision: PARTIAL GO. Bridge approval lifecycle is implemented, tested, persisted, and audited. The approved Build-Wiki/Farmer Run Now dispatch was accepted for execution, but this runtime host cannot complete it because `systemctl` is not available.

## Lane

Bridge Session approvals and one safe scoped execution path:

- action: `buildwiki.run_now`
- target service: `opencloud-docs-farmer.service`
- scope: Fork 1 only
- blocked: SMB, Fork 2, external farmers, second vault

## What Was Implemented

- Added migration `054_bridge_connector_run_persistence`.
- Added `bridge_connector_runs` persistence for dispatch attempts/results.
- Added Bridge approval lifecycle helper:
  - pending to approved
  - pending to denied
  - pending to expired when expired before decision
  - audit event for approval decisions
  - no execution during approval/denial
- Changed Mission Control approval routes from Telegram-only stubs to owner-gated API state transitions:
  - `POST /api/bridge/approval-requests/:id/approve`
  - `POST /api/bridge/approval-requests/:id/deny`
- Rewired Build-Wiki Run Now:
  - `POST /api/bridge/brain-sync/build-wiki/run-now` creates a scoped approval request.
  - It does not execute immediately.
  - It writes an `approval_requested` audit event.
  - It returns `Request run -> Approval pending` state.
- Confirmed dispatch route:
  - only accepts approved `buildwiki.run_now`
  - only targets `opencloud-docs-farmer.service`
  - returns `accepted_for_execution=true` after exact-scope approval
  - writes run/audit records
  - blocks outside-scope approval ids

## Files Changed

- `src/lib/migrations.ts`
- `src/lib/bridge-approval-lifecycle.ts`
- `src/lib/bridge-approval-lifecycle.test.ts`
- `src/lib/build-wiki-run-now.ts`
- `src/app/api/bridge/approval-requests/[id]/approve/route.ts`
- `src/app/api/bridge/approval-requests/[id]/deny/route.ts`
- `src/app/api/bridge/brain-sync/build-wiki/run-now/route.ts`
- `src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts`
- `src/app/api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch/route.ts`
- `src/app/api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch/route.test.ts`

## Routes / Endpoints Changed

- `POST /api/bridge/approval-requests/:id/approve`
  - updates pending approval to `approved`
  - writes `bridge_audit_events` outcome `approved`
  - does not execute by itself

- `POST /api/bridge/approval-requests/:id/deny`
  - updates pending approval to `denied`
  - writes `bridge_audit_events` outcome `denied`
  - keeps protected action non-executable

- `GET /api/bridge/brain-sync/build-wiki/run-now`
  - reads local persisted Run Now approval/run state

- `POST /api/bridge/brain-sync/build-wiki/run-now`
  - creates exact-scope approval request
  - writes audit event
  - does not execute

- `GET /api/bridge/brain-sync/build-wiki/run-now/:id`
  - reads exact approval/run status

- `POST /api/bridge/brain-sync/build-wiki/run-now/:id/dispatch`
  - accepts only approved exact-scope `buildwiki.run_now`
  - starts only `opencloud-docs-farmer.service`
  - records run and audit
  - blocks unrelated approval ids

## UI Behavior

The backend now supports the expected Run Now UI states:

- Request run
- Approval pending
- Approved / ready to dispatch
- Dispatching
- Completed
- Failed

No fake completion state was introduced. The live runtime proof ended in `failed` because the host cannot run `systemctl`.

## Service / Runtime Behavior

Standalone loopback runtime:

- PID: 25390
- Bind: `127.0.0.1:3337`
- Public exposure: none added
- `/login`: 200
- Migration applied: `bridge_connector_runs` table present

Runtime proof:

1. Unauthenticated Run Now read:
   - `GET /api/bridge/brain-sync/build-wiki/run-now`
   - result: 401

2. Authenticated Run Now read:
   - result: 200
   - `persistence_ready=true`
   - `ui_state=idle`
   - `execution_enabled=false`

3. Create Run Now approval:
   - result: 201
   - `approval_request_created=true`
   - `approval_state=pending`
   - `target_service=opencloud-docs-farmer.service`
   - `accepted_for_execution=false`

4. Approve Run Now approval:
   - result: 200
   - `approval_state=approved`
   - audit event written
   - still `accepted_for_execution=false` because approval alone does not execute

5. Dispatch approved exact-scope request:
   - result: 502
   - `accepted_for_execution=true`
   - `execution_enabled=true`
   - `run_state=failed`
   - audit event written
   - blocker: `systemctl` unavailable on this host runtime

6. Read after dispatch attempt:
   - result: 200
   - `ui_state=failed`
   - run row exists
   - audit row exists

7. Outside-scope dispatch:
   - created unrelated `agentmail.send` approval
   - denied it
   - attempted Build-Wiki dispatch with that approval id
   - result: 422 `approval_request_out_of_scope`
   - `execution_enabled=false`

## Tests Run

- `pnpm test src/lib/bridge-approval-lifecycle.test.ts src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts src/app/api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch/route.test.ts`
  - PASS: 3 files / 8 tests
- `pnpm run typecheck`
  - PASS
- `git diff --check`
  - PASS
- `pnpm run build`
  - PASS
- `pnpm test`
  - PASS: 142 files / 1272 tests
- `node scripts/check-protected-file-invariants.mjs`
  - PASS
- `MISSION_CONTROL_API_KEY=codex-local-route-smoke-key node scripts/check-protected-actions-locked.mjs http://127.0.0.1:3337`
  - PASS: 11 protected-action probes
- Staged secret scan
  - PASS
- `.env` diff check
  - clean

## Proof Artifact

This report and PDF:

- `runtime/day-10-bridge-approvals-100-closure.md`
- `runtime/day-10-bridge-approvals-100-closure.pdf`

## Remaining Blocker

Blocker classification: SERVICE_DOWN

Exact blocker:

- `buildwiki_run_now_host_systemctl_unavailable`

Reason:

- The current proof host does not provide `systemctl`, so `systemctl --user start opencloud-docs-farmer.service` cannot complete here.
- The route still proved exact-scope acceptance, failed execution state, run persistence, audit persistence, and no fake completion.

Owner/admin action if this is production Linux:

1. Ensure the Mission Control service user can execute:
   - `systemctl --user start opencloud-docs-farmer.service`
2. Ensure the user service exists:
   - `opencloud-docs-farmer.service`
3. Ensure the timer remains configured if required:
   - `opencloud-docs-farmer.timer`
4. Re-run one approved Run Now dispatch proof.

## Commit / Push

Code commit:

- `3cd524e`

Push:

- pushed to `origin/to-knowledge-mc`

## Rollback

```bash
git revert 3cd524e
```

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public exposure.
- No SMB mounted.
- No Fork 2 enabled.
- No external farmers enabled.
- No second vault created.
- No Zapier write.
- No HeyGen generation.
- No fake Done.
- No fake completion.
- Out-of-scope action blocked.
- Only literal legacy service name used: `opencloud-docs-farmer.service`.

## Next Day Started

Day 11 - Dispatcher Core 100% Closure starts next.
