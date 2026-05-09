# Day 25 - Safe Scoped Execution / Build-Wiki Run Now

Date: 2026-05-09
Branch: to-knowledge-mc
Status: DEVELOPER-SIDE CLOSED / SERVICE_DOWN
Commit: 39fc228347ac7fc1b9908413b3e622bd650734f7
Rollback: git revert 39fc228
Next day started: Day 26 - Denied Approval Behavior

## Closure Decision

Day 25 is closed for developer-side implementation and proof harness.

It is not GO for the Farmer service. The approved scoped execution path was created, persisted, audited, and attempted, but the local runtime could not start `opencloud-docs-farmer.service`.

Blocker classification: SERVICE_DOWN

Exact blocker:

`opencloud_docs_farmer_service_not_started_in_local_runtime`

Observed service blocker:

`systemctl_user_unavailable_or_unit_inactive`

## Implemented

- Wired Build-Wiki / Farmer Run Now behind Bridge approval.
- Added exact-scope dispatch after owner approval only.
- Kept the action restricted to:
  - action: `buildwiki.run_now`
  - connector: `skill.build_wiki`
  - target: `opencloud-docs-farmer.service`
- The create route now creates an approval request and does not execute.
- The approval route now dispatches only exact Build-Wiki Run Now approvals.
- The manual dispatch route delegates to the same shared exact-scope dispatcher.
- Dispatch uses fixed arguments only:
  - `/usr/bin/systemctl --user start opencloud-docs-farmer.service`
- No SMB, Fork 2, external farmers, Zapier writes, HeyGen, Gmail/Slack/YouTube/Web farmers, or second vault were enabled.
- Failed dispatch returns `ok:false`; no fake success is reported.
- Run/audit persistence records the failed service dispatch.

## Files Changed

Code commit `39fc228` changed:

- `src/lib/build-wiki-run-now-dispatch.ts`
- `src/app/api/bridge/approval-requests/[id]/approve/route.ts`
- `src/app/api/bridge/approval-requests/[id]/approve/route.test.ts`
- `src/app/api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch/route.ts`
- `src/app/api/bridge/brain-sync/build-wiki/run-now/route.ts`
- `src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts`
- `src/app/api/bridge/brain-sync/build-wiki/status/route.ts`
- `src/app/api/bridge/button-contracts/route.ts`
- `src/components/agent-network/AgentNetworkClient.tsx`
- `src/lib/agent-zero-bridge.ts`
- `src/lib/agent-zero-ecosystem-context.ts`

This report commit adds proof artifacts only.

## Routes Changed

- `POST /api/bridge/brain-sync/build-wiki/run-now`
  - Creates the approval request.
  - Does not execute.
  - Returns approval and dispatch route pointers.

- `GET /api/bridge/brain-sync/build-wiki/run-now`
  - Returns current Run Now UI state.

- `POST /api/bridge/approval-requests/{id}/approve`
  - Resolves the approval.
  - If and only if the approval scope is exact Build-Wiki Run Now, dispatches the fixed Farmer service command.

- `POST /api/bridge/brain-sync/build-wiki/run-now/{id}/dispatch`
  - Manual exact-scope dispatch wrapper.
  - Uses the same shared dispatcher as the approval route.

- `GET /api/bridge/brain-sync/build-wiki/status`
  - Reports the approval-first dispatch surface and current Run Now state.

## UI Behavior

Expected owner-visible flow is now:

1. Request run
2. Approval pending
3. Owner approval
4. Run dispatched
5. Completed or failed

Current runtime result after owner approval:

`Run dispatched / failed`

The UI must not claim completion while `opencloud-docs-farmer.service` is unavailable.

## Approval Request Behavior

Proof approval id:

`apr_6221b0b8-3d9f-4b49-821c-236e4cc88b24`

Create response:

- status: 201
- mode: `run_now_approval_requested_no_execution`
- approval request created: true
- execution enabled: false
- accepted for execution: false

Approve response:

- status: 502
- mode: `approval_request_approved_buildwiki_run_now_dispatched_failed`
- accepted for execution: true
- execution enabled: true
- blocked reason: `buildwiki_run_now_systemctl_failed`
- target service: `opencloud-docs-farmer.service`

This is the correct honest result for an approved action whose service cannot be started by the current runtime.

## Audit Behavior

Rows proved in the runtime database:

- `bridge_approval_requests`
  - connector: `skill.build_wiki`
  - action: `buildwiki.run_now`
  - target key: `opencloud-docs-farmer.service`
  - approval state: `approved`

- `bridge_connector_runs`
  - action: `buildwiki.run_now`
  - target key: `opencloud-docs-farmer.service`
  - run state: `failed`
  - audit pointer present

- `bridge_audit_events`
  - `approval_requested`
  - `approved`
  - `failed`

## Runtime / Deploy Proof

Local standalone proof runtime:

- bind: `127.0.0.1:3337`
- PID: `21292`
- HEAD: `39fc228`
- `/login`: 200
- no public exposure added
- no `.env` changes
- no secrets printed

Deployment artifact note:

The standalone bundle needed generated-artifact repair before it could boot locally: the already-built `.next/server` output and installed package store were synced into `.next/standalone`. This did not change source files or `.env`. It should be turned into a formal deploy-pipeline fix in the runtime lane if it repeats.

## Route Smoke

Unauthenticated checks:

- `/login`: 200
- `/api/bridge/brain-sync/build-wiki/status`: 401
- `/api/bridge/brain-sync/build-wiki/run-now`: 401
- `/api/bridge/button-contracts`: 401

Authenticated checks:

- `/api/bridge/brain-sync/build-wiki/status`: 200
- `/api/bridge/brain-sync/build-wiki/run-now`: 200
- `/api/bridge/button-contracts`: 200

Auth used the runtime API key context without printing the key.

## Verification

Fresh verification completed for the Day 25 code commit:

- `git diff --check`: pass
- `pnpm run typecheck`: pass
- `pnpm run build`: pass
- `pnpm test`: pass, 153 files / 1316 tests
- `node scripts/check-protected-file-invariants.mjs`: pass
- staged secret scan: pass
- `.env` diff check: clean
- route smoke: pass
- approved Run Now proof: approval/audit/run rows pass, service dispatch blocked by SERVICE_DOWN

## Proof Artifacts

- `runtime/day-25-safe-scoped-execution-proof.json`
- `runtime/day-25-route-smoke.json`
- `runtime/day-25-restart-proof.json`

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No raw local path exposed in UI behavior.
- No fake send/upload/run completion.
- No SMB mount.
- No Fork 2.
- No external farmers.
- No Zapier writes.
- No HeyGen generation.

## Push Result

Code commit pushed:

`39fc228347ac7fc1b9908413b3e622bd650734f7`

Report/proof commit is expected after this report is rendered and staged.

## Remaining Blocker

`SERVICE_DOWN`: the local runtime cannot start or confirm `opencloud-docs-farmer.service` / timer through `systemctl --user`.

Owner/admin action if service should execute on this host:

1. Install or expose `opencloud-docs-farmer.service` in the runtime user service manager.
2. Ensure the Mission Control runtime user can run:
   - `systemctl --user start opencloud-docs-farmer.service`
   - `systemctl --user is-active opencloud-docs-farmer.service`
   - `systemctl --user is-active opencloud-docs-farmer.timer`
3. Restart Mission Control if the service manager environment changes.
4. Re-run the approved Build-Wiki Run Now proof.

## Day 26 Start

Day 26 - Denied Approval Behavior begins next.

Goal:

Prove a denied Bridge approval never executes, records denial audit, and returns a truthful denied UI/API state.
