# Day 34 — Farmer Service Status 100% Closure

Date: 2026-05-09
Lane: Build-Wiki/Farmer service status
Status: CLOSED WITH SERVICE_DOWN
Blocker classification: SERVICE_DOWN
Exact blocker: `systemctl_command_not_found_in_local_runtime`

## What Was Implemented

- Added an explicit safe `service_probe` to the Build-Wiki/Farmer status route.
- The status route now reports farmer service/timer state even when the external registry row or active farmer metadata is unavailable.
- Added regression coverage proving the status route:
  - exposes `opencloud-docs-farmer.service`
  - exposes `opencloud-docs-farmer.timer`
  - reports `systemctl_command_not_found_in_local_runtime` when the local runtime cannot run systemctl
  - does not expose raw local paths
  - does not expose secrets
  - preserves single-vault / no-env / no-secret notices

## Files Changed

Source:
- `src/app/api/bridge/brain-sync/build-wiki/status/route.ts`
- `src/app/api/bridge/brain-sync/build-wiki/status/route.test.ts`

Artifacts:
- `runtime/day-34-farmer-service-status-proof.json`
- `runtime/day-34-farmer-service-status-100-closure.md`
- `runtime/day-34-farmer-service-status-100-closure.pdf`

## Routes / Endpoints Changed

- Updated `GET /api/bridge/brain-sync/build-wiki/status`

New response field:
- `service_probe`

`service_probe` includes:
- `systemctl_available`
- `blocker`
- `service_unit`
- `timer_unit`
- `timer_active`
- `timer_unit_file_state`
- `service_active_state`
- `service_sub_state`
- `last_result`
- `last_exit_status`
- `next_run_at`
- `last_run_at`
- `last_run_started_at`
- `last_run_exited_at`

## UI Behavior

Mission Control / Brain Sync / Build-Wiki UI can now show farmer service truth even when active farmer metadata is missing:

- service: `opencloud-docs-farmer.service`
- timer: `opencloud-docs-farmer.timer`
- blocker: `systemctl_command_not_found_in_local_runtime`
- Run Now remains owner-approval gated.
- Resume sync remains owner-approval gated.
- External farmer remains credential-gated.
- Logs/raw/wiki views remain read-only.

No fake service-active or timer-active state is shown.

## Service / Runtime Proof

Local Mission Control standalone runtime:
- Bind: `127.0.0.1:3337`
- Source commit: `0d0803b`
- Runtime PID after restart: `39222`
- `/login`: `200`
- unauthenticated Build-Wiki status: `401`
- authenticated Build-Wiki status: `200`

Live `service_probe`:
- `systemctl_available: false`
- `blocker: systemctl_command_not_found_in_local_runtime`
- `service_unit: opencloud-docs-farmer.service`
- `timer_unit: opencloud-docs-farmer.timer`
- `timer_active: false`
- `timer_unit_file_state: unknown`
- `service_active_state: unknown`
- `service_sub_state: unknown`
- `last_result: unknown`

Run Now state remains truthful:
- target service: `opencloud-docs-farmer.service`
- UI state: `failed`
- approval state: `approved`
- run state: `failed`
- dispatch surface: `approval_route_exact_scope_dispatch`

Proof artifact:
- `runtime/day-34-farmer-service-status-proof.json`

## Tests Run

- `pnpm test 'src/app/api/bridge/brain-sync/build-wiki/status/route.test.ts'`
  - PASS: 1 file / 1 test
- `pnpm run typecheck`
  - PASS
- `pnpm run build`
  - PASS
- `pnpm test`
  - PASS: 157 files / 1325 tests
- `git diff --check`
  - PASS
- `node scripts/check-protected-file-invariants.mjs`
  - PASS
- Staged secret/raw-path scan
  - pending report commit
- `.env` diff check
  - PASS, no `.env` changes

## Remaining Blocker

`SERVICE_DOWN`: this local runtime cannot execute or inspect the systemd user unit because `systemctl` is unavailable.

Owner/admin action to move this lane to live service proof:
- Run Mission Control on the runtime host where `systemctl --user` is available to the service user.
- Verify:
  - `systemctl --user is-active opencloud-docs-farmer.timer`
  - `systemctl --user is-active opencloud-docs-farmer.service`
  - `GET /api/bridge/brain-sync/build-wiki/status` shows real timer/service values.

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
- No fake service-active state.
- No raw local paths exposed in proof/report artifacts.

## Commit / Push

Source commit:
- `0d0803b` — `feat(buildwiki): expose farmer service probe`

Report commit:
- this report artifact commit

Push:
- pending report commit and push

## Rollback

Source rollback:

```bash
git revert 0d0803b
```

Report rollback:

```bash
git revert <day34_report_commit_sha>
```

## Next Day Started

Day 35 — Farmer Audit Trail 100% Closure starts automatically after this report is committed and pushed.
