# Day 31 — Bridge + Build-Wiki Integration 100% Closure

Date: 2026-05-09
Lane: Bridge + Build-Wiki/Farmer Run Now integration
Status: CLOSED WITH SERVICE_DOWN
Blocker classification: SERVICE_DOWN
Exact blocker: `systemctl_command_not_found_in_local_runtime`

## What Was Implemented

The Build-Wiki/Farmer Run Now path is wired behind Bridge approval:

- Owner/operator request creates an approval request for `buildwiki.run_now`.
- The request is scoped only to `opencloud-docs-farmer.service`.
- The request does not execute immediately.
- The approval route auto-dispatches only exact Build-Wiki Run Now approvals.
- The dispatch helper runs only:
  - `systemctl --user start opencloud-docs-farmer.service`
- Out-of-scope approvals do not dispatch.
- Dispatch writes a connector run row and audit event when the service command is attempted.

No new source change was needed in this day because the implementation source was already present on the current branch and verified fresh during this closeout.

## Files Changed

Day 31 report/proof artifacts:
- `runtime/day-31-bridge-buildwiki-integration-proof.json`
- `runtime/day-31-bridge-buildwiki-integration-100-closure.md`
- `runtime/day-31-bridge-buildwiki-integration-100-closure.pdf`

Relevant source already in lineage:
- `src/app/api/bridge/brain-sync/build-wiki/run-now/route.ts`
- `src/app/api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch/route.ts`
- `src/app/api/bridge/approval-requests/[id]/approve/route.ts`
- `src/lib/build-wiki-run-now.ts`
- `src/lib/build-wiki-run-now-dispatch.ts`

Primary source commit:
- `39fc228` — `feat(bridge): dispatch buildwiki run now after approval`

## Routes / Endpoints Changed

No new endpoint changed in Day 31.

Verified endpoints:
- `GET /api/bridge/brain-sync/build-wiki/run-now`
- `POST /api/bridge/brain-sync/build-wiki/run-now`
- `POST /api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch`
- `POST /api/bridge/approval-requests/[id]/approve`

Expected behavior:
- `POST /api/bridge/brain-sync/build-wiki/run-now` creates a pending `buildwiki.run_now` approval.
- It returns a dispatch route and approval route.
- It sets `execution_enabled: false`.
- It sets `accepted_for_execution: false`.
- It sets `writes_enabled: false`.
- The service is not started until the owner approval route resolves the request.

## UI Behavior

The UI can truthfully show the Run Now flow:

- Request run
- Approval pending
- Approved
- Run dispatched / completed
- Failed with exact blocker

No fake Run Now completion is enabled.
No pause/resume/add-source/external-farmer/SMB controls were wired in this day.

## Service / Runtime Proof

Local Mission Control standalone runtime:
- Bind: `127.0.0.1:3337`
- `/login`: `200`
- Unauthenticated `POST /api/bridge/brain-sync/build-wiki/run-now`: `401`
- Authenticated `GET /api/bridge/brain-sync/build-wiki/run-now`: `200`
- Authenticated `POST /api/bridge/brain-sync/build-wiki/run-now`: `201`

Live Run Now approval request:
- approval id: `apr_92b091fb-5818-4344-9cb3-a1694dc2d1a3`
- approval state: `pending`
- required scope: `buildwiki.run_now`
- target service: `opencloud-docs-farmer.service`
- execution enabled: `false`
- accepted for execution: `false`
- writes enabled: `false`
- dispatch route present: `true`
- approval route present: `true`

Persistence proof:
- approval row found: `true`
- audit row found: `true`
- audit outcome: `approval_requested`

Runtime service proof:
- `systemctl` is not available in the local runtime shell.
- Timer status: `systemctl_command_not_found_in_local_runtime`
- Service status: `systemctl_command_not_found_in_local_runtime`
- Live service dispatch was not performed in this environment.

Proof artifact:
- `runtime/day-31-bridge-buildwiki-integration-proof.json`

## Tests Run

- `pnpm test 'src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts' 'src/app/api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch/route.test.ts' 'src/app/api/bridge/approval-requests/[id]/approve/route.test.ts'`
  - PASS: 3 files / 8 tests

Fresh full-source validation from the current source lineage before this proof/report commit:
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
- Staged secret/raw-path scan
  - PASS
- `.env` diff check
  - PASS, no `.env` changes

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No SMB / Fork 2 / external farmers.
- No second vault.
- No Zapier writes.
- No HeyGen generation.
- No connector broad execution.
- No fake Run Now success.
- No service command was executed before approval.

## Commit / Push

Source commit:
- `39fc228` — `feat(bridge): dispatch buildwiki run now after approval`

Day 31 report commit:
- this report artifact commit

Push:
- pending report commit and push

## Rollback

Source rollback:

```bash
git revert 39fc228
```

Report rollback:

```bash
git revert <day31_report_commit_sha>
```

## Next Day Started

Day 32 — Bridge Final Closeout starts automatically after this report is committed and pushed.
