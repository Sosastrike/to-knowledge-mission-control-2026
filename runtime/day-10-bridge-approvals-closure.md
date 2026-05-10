# Day 10 — Bridge Session Approvals Closure

Date: 2026-05-10T02:16:57Z

Status: DEVELOPER-SIDE CLOSED, OWNER_GATED FOR LIVE APPROVED EXECUTION

## Lane

Bridge Session approval lifecycle.

## What Changed

- Fixed the Build-Wiki / Farmer Run Now read model so a pending approval past `expires_at` renders as terminal `expired`, not `pending_approval`.
- Added a regression test proving the Run Now GET route reports expired pending approvals truthfully.
- Did not alter Bridge auth, owner approval rules, execution scope, `.env`, secrets, or external write behavior.

## Files Changed

- `src/lib/build-wiki-run-now.ts`
- `src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts`
- `runtime/day-10-bridge-approvals-closure.md`
- `runtime/day-10-bridge-approvals-closure.pdf`

## Routes / Endpoints Verified

- `GET /api/bridge/approval-readiness`
- `GET /api/bridge/approval-contract`
- `GET /api/bridge/approval-requests?limit=5`
- `GET /api/bridge/approval-requests/audit-report`
- `GET /api/bridge/brain-sync/build-wiki/run-now`
- `POST /api/bridge/brain-sync/build-wiki/run-now`
- route render smoke for Mission Control / Gateway protected pages and Bridge APIs

## Live Runtime Proof

Production-like local runtime was rebuilt and restarted on `127.0.0.1:3337`.

New runtime PID: `29809`

Run Now stale-expiration proof before creating a new request:

- latest old Build-Wiki request: `apr_5f8fd696-5469-4569-bacf-653efde203c5`
- approval state in DB: `pending`
- `expires_at`: `2026-05-09T23:40:00.565Z`
- UI state after fix: `expired`
- terminal: `true`
- execution enabled: `false`
- accepted for execution: `false`

New exact-scope approval request created for proof only:

- approval id: `apr_9a5acdcd-4106-477c-8cde-3f1a52b7ea76`
- audit event id: `audit_a7572e8a-0ebe-427f-9040-02fb378aebf4`
- action: `buildwiki.run_now`
- target service: `opencloud-docs-farmer.service`
- UI state: `pending_approval`
- execution enabled: `false`
- accepted for execution: `false`
- writes enabled: `false`
- next action: owner approval required before dispatch

Approval queue after proof:

- total approvals: `15`
- pending: `2`
- active pending: `2`
- approved: `7`
- denied: `3`
- expired: `3`
- running: `0`
- completed: `0`
- failed: `0`

Active pending requests:

- `apr_9a5acdcd-4106-477c-8cde-3f1a52b7ea76` — `buildwiki.run_now`, blocker `owner_approval_required_before_execution`
- `apr_b1367ff0-6f12-41d2-a601-8cf7445a2b3f` — `agent_zero.execute`, blocker `owner_approval_required_before_execution`

## UI Behavior

- Bridge queue is readable.
- Pending approvals show yellow owner-gated state.
- Expired Run Now approvals no longer look pending.
- Run Now proof request stays approval-gated.
- No fake run, send, upload, or done state was emitted.

## Service / Runtime Behavior

- `POST /api/bridge/brain-sync/build-wiki/run-now` created only an approval request and audit row.
- It did not run `systemctl`.
- `systemctl --user start opencloud-docs-farmer.service` remains reachable only through the scoped dispatch path after owner approval.
- No SMB/Fork 2, Zapier write, HeyGen generation, external farmer, or second vault was enabled.

## Tests / Verification

- `git diff --check`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`
- Targeted Bridge lifecycle tests:
  - `src/lib/bridge-approval-lifecycle.test.ts`
  - `src/lib/bridge-approval-ui-state.test.ts`
  - `src/app/api/bridge/approval-requests/[id]/approve/route.test.ts`
  - `src/app/api/bridge/approval-requests/[id]/deny/route.test.ts`
  - `src/app/api/bridge/approval-requests/audit-report/route.test.ts`
  - `src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts`
  - `src/app/api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch/route.test.ts`
- Full test result: `171` test files, `1358` tests passed.
- Route rendering smoke: `ok: true`, `46` routes checked, `8` designer pages checked, `0` failures.

## Safety Confirmation

- No `.env` change.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No raw local paths added to owner-facing output.
- No fake LIVE/GO/Done status.
- No external write executed.

## Remaining Blocker

Blocker class: `OWNER_GATED`

Exact blocker: `owner_approval_required_before_execution`

Reason: the live proof created an exact-scope approval request, but did not approve or dispatch it. A real approved execution requires owner approval of `apr_9a5acdcd-4106-477c-8cde-3f1a52b7ea76`.

## Rollback

Code rollback after commit:

```bash
git revert <day10_bridge_commit_sha>
```

Live request rollback / cleanup:

- deny `apr_9a5acdcd-4106-477c-8cde-3f1a52b7ea76`, or let it expire.
- do not dispatch it unless owner explicitly approves the exact scope.

## Commit / Push

- Commit hash: recorded after this report commit is created.
- Push result: recorded after push.

## Next Day

Day 11 — Dispatcher Core starts automatically after this Day 10 commit and push.
