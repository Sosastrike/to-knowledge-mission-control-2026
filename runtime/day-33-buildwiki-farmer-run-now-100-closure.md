# Day 33 — Build-Wiki / Farmer Run Now 100% Closure

Date: 2026-05-09
Lane: Build-Wiki/Farmer Run Now
Status: CLOSED WITH SERVICE_DOWN
Blocker classification: SERVICE_DOWN
Exact blocker: `buildwiki_run_now_systemctl_failed`

## What Was Implemented

- Added a regression assertion that the persisted Run Now approval scope is exact and locked:
  - action: `buildwiki.run_now`
  - target service: `opencloud-docs-farmer.service`
  - command: `systemctl --user start opencloud-docs-farmer.service`
  - Fork 1 only
  - no SMB
  - no Fork 2
  - no external farmers
  - no second vault
  - no immediate execution
- Verified the existing Run Now implementation remains approval-first:
  - Request run creates approval.
  - Approval pending is visible.
  - Owner approval dispatches only the exact service command.
  - Failed service dispatch records failed run state and audit.
  - UI/status surfaces show failed rather than fake completion.

## Files Changed

- `src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts`
- `runtime/day-33-buildwiki-farmer-run-now-proof.json`
- `runtime/day-33-buildwiki-farmer-run-now-100-closure.md`
- `runtime/day-33-buildwiki-farmer-run-now-100-closure.pdf`

## Routes / Endpoints Verified

- `GET /api/bridge/brain-sync/build-wiki/status`
- `GET /api/bridge/brain-sync/build-wiki/run-now`
- `GET /api/bridge/brain-sync/build-wiki/run-now/[id]`
- `POST /api/bridge/brain-sync/build-wiki/run-now`
- `POST /api/bridge/approval-requests/[id]/approve`
- `POST /api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch`

## UI Behavior

Owner-facing Build-Wiki/Farmer Run Now state is truthful:

- `run_now.ui_state`: `failed`
- `run_now.run_state`: `failed`
- `run_now.approval_state`: `approved`
- dispatch surface: `approval_route_exact_scope_dispatch`
- target service: `opencloud-docs-farmer.service`
- controls:
  - Run Now: `OWNER_APPROVAL_REQUIRED`
  - Pause sync: not wired in this hop
  - Resume sync: owner approval required
  - Add local source: owner approval required
  - External farmer: credential required
  - Logs/raw/wiki views: read-only

No fake Run Now success is shown.

## Service / Runtime Proof

Local Mission Control standalone runtime:
- Bind: `127.0.0.1:3337`
- `/login`: `200`
- unauthenticated Build-Wiki status route: `401`
- authenticated Build-Wiki status route: `200`
- authenticated Run Now read route: `200`
- authenticated Run Now id route: `200`

Run Now proof:
- target service: `opencloud-docs-farmer.service`
- UI state: `failed`
- run state: `failed`
- no SMB/Fork 2 enabled: `true`
- exact scope proven by Day 32 dispatch proof: `true`
- failed run recorded by Day 32 dispatch proof: `true`
- successful dispatch covered by test: `true`
- unsafe output detected: `false`

Proof artifact:
- `runtime/day-33-buildwiki-farmer-run-now-proof.json`

## Tests Run

- `pnpm test 'src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts'`
  - PASS: 1 file / 3 tests
- `pnpm run typecheck`
  - PASS
- `pnpm run build`
  - PASS
- `pnpm test`
  - PASS: 156 files / 1324 tests
- `git diff --check`
  - PASS
- `node scripts/check-protected-file-invariants.mjs`
  - PASS
- `.env` diff check
  - PASS, no `.env` changes

## Remaining Blocker

`SERVICE_DOWN`: the exact `opencloud-docs-farmer.service` command cannot complete in this runtime.

The app-side Run Now lane is closed because:
- request creation is implemented and tested
- approval-first behavior is implemented and tested
- exact service scope is implemented and tested
- no-SMB/Fork 2/external-farmer constraints are asserted
- failed dispatch/audit is proven live
- success dispatch is covered by test
- UI/status surfaces show the failure truthfully

Owner/admin action to move from service-down to live success:
- Run the proof on the runtime host where `systemctl --user start opencloud-docs-farmer.service` is available to the Mission Control service user.

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No SMB / Fork 2 / external farmers.
- No second vault.
- No Zapier writes.
- No HeyGen generation.
- No broad connector execution.
- No fake Run Now success.
- No raw local paths exposed in proof/report artifacts.

## Commit / Push

Day 33 source/report commit:
- this commit

Push:
- pending commit and push

## Rollback

Source/report rollback:

```bash
git revert <day33_commit_sha>
```

## Next Day Started

Day 34 — Farmer Service Status 100% Closure starts automatically after this report is committed and pushed.
