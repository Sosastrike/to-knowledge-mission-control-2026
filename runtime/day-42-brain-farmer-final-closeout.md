# Day 42 — Brain / Farmer Final Closeout

Date: 2026-05-09
Status: PARTIAL PASS
Blocker class: SERVICE_DOWN
Exact blocker: `systemctl_command_not_found_in_local_runtime`

## Lane

Brain / Build-Wiki / Farmer final closeout for the Day 33-41 workstream.

## Objective

Verify the Brain / Farmer lane after the Run Now approval path, service-status endpoint, audit trail, rollback guidance, Brain status, knowledge report, governance guardrails, and security sweep work. Close developer-side implementation where possible and record exact runtime blockers without faking service proof.

## Inventory

Reviewed active Brain / Farmer surfaces:

- `GET /api/bridge/brain-sync/build-wiki/status`
- `GET /api/bridge/brain-sync/knowledge-report`
- `GET /api/bridge/brain-sync/build-wiki/run-now`
- `POST /api/bridge/brain-sync/build-wiki/run-now`
- `GET /api/bridge/brain-sync/build-wiki/files`
- `GET /api/bridge/brain-sync/build-wiki/logs`
- Bridge approval persistence tables
- Bridge audit persistence tables
- Build-Wiki Run Now approval scope
- Farmer service/timer probe behavior

## Implemented In This Lane

No new source changes were required after the Day 41 security fix. The Day 42 closeout validates the already implemented Brain / Farmer path and records the remaining service-manager blocker honestly.

Confirmed developer-side behavior:

- Run Now creates a scoped Bridge approval request for `buildwiki.run_now`.
- Run Now does not execute immediately.
- The approval target is scoped only to `opencloud-docs-farmer.service`.
- The dispatch command remains exactly `systemctl --user start opencloud-docs-farmer.service` after owner approval.
- Approval/audit rows persist.
- No connector run is created before approval/dispatch.
- No SMB, Fork 2, external farmer, or second vault path is enabled.
- Brain / Farmer API responses do not expose raw host paths or secret-shaped values in the checked routes.

## Files Changed

No source files changed in Day 42.

Report/proof artifacts:

- `runtime/day-42-brain-farmer-final-closeout.md`
- `runtime/day-42-brain-farmer-final-closeout.pdf`
- `runtime/day-42-brain-farmer-final-closeout-proof.json`

## Routes Changed

No routes changed in Day 42.

Routes verified:

- `GET /api/bridge/brain-sync/build-wiki/status`
- `GET /api/bridge/brain-sync/knowledge-report`
- `GET /api/bridge/brain-sync/build-wiki/run-now`
- `POST /api/bridge/brain-sync/build-wiki/run-now`
- `GET /api/bridge/brain-sync/build-wiki/files?type=all&limit=5`
- `GET /api/bridge/brain-sync/build-wiki/logs?lines=20`

## UI / Owner-Facing Behavior

Owner-facing Brain / Farmer state remains truthful:

- Run Now means request owner approval, not immediate execution.
- Pending approval is visible through the Bridge approval model.
- Dispatch/completion are not claimed until the approved dispatch actually occurs.
- Service/timer status cannot be called live in this runtime because the local service manager command is unavailable.
- The exact blocker is `SERVICE_DOWN:systemctl_command_not_found_in_local_runtime`.

## Runtime / Service Behavior

Runtime proof used Mission Control on `127.0.0.1:3337`.

- Runtime PID: `72421`
- Runtime source commit: `9f6d8c5d6e2a906302a85378d6de3b151bbc77a4`
- Current branch head during proof: `bbca4f8af11d315f4a1e56848e11ae9c2471b972`

Farmer service/timer proof:

- `systemctl` is not available in the local runtime shell.
- Farmer service active state: unknown.
- Farmer timer active state: unknown.
- Live start/dispatch was not attempted.
- No Build-Wiki/Farmer execution occurred.

## Runtime Proof

Proof artifact:

- `runtime/day-42-brain-farmer-final-closeout-proof.json`

Results:

- Routes checked: 6
- Approval request created/reused: PASS
- Approval state: `pending`
- Approval action: `buildwiki.run_now`
- Approval target: `opencloud-docs-farmer.service`
- Audit outcome: `approval_requested`
- Connector runs created before approval: 0
- Response leak violations: 0
- Service blocker: `SERVICE_DOWN:systemctl_command_not_found_in_local_runtime`

The proof used authenticated runtime API access with a non-secret placeholder session cookie for the proxy prefilter. No credential value was printed.

## Validation

- `git diff --check`: PASS
- `pnpm run typecheck`: PASS
- `pnpm run build`: PASS
- `pnpm test`: PASS — 163 files / 1336 tests
- `node scripts/check-protected-file-invariants.mjs`: PASS
- Staged secret scan: PASS
- `.env` diff: clean

During validation, stale generated build artifacts under `.next/standalone 2` and `.next/cache 2` were removed. These were generated artifacts only, not source or owner data.

## Blocker Classification

`SERVICE_DOWN`

Reason:

- The local runtime cannot prove or dispatch the Farmer service because `systemctl` is unavailable in this runtime context.
- The implementation is ready for the Linux user-service runtime where `systemctl --user start opencloud-docs-farmer.service` is available.

Owner/admin action if service proof is required on this host:

- Run Mission Control/Farmer proof in a runtime with `systemctl --user`.
- Confirm the runtime service user can inspect/start `opencloud-docs-farmer.service`.
- Confirm `opencloud-docs-farmer.timer` if timer proof is required.

## Commit / Push

Source commit already deployed for the last code change in this lane:

- `9f6d8c5` — `fix(brain): redact build wiki file paths`

Day 42 report/proof commit:

- Recorded after this report is committed and pushed.

## Rollback

Rollback source change from this Brain/Farmer lane:

```bash
git revert 9f6d8c5
```

Rollback Day 42 report/proof commit:

```bash
git revert <day42_report_commit_sha>
```

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No raw host path leaks found in checked Brain / Farmer responses.
- No memory or governance changes.
- No Build-Wiki execution.
- No SMB/Fork 2.
- No external farmers.
- No second vault.
- No fake service/timer proof.

## Closeout Decision

Day 42 developer-side closeout is complete with a `SERVICE_DOWN` blocker for live Linux user-service proof. The lane does not get a fake GO. The next lane is Day 43 — MCP Server Registry.

## Next Day Started

Day 43 — MCP Server Registry is the active next lane.
