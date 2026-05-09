# Day 36 — Farmer Rollback / Disable 100% Closure

Date: 2026-05-09
Lane: Brain / Build-Wiki / Farmer
Status: CLOSED AS SERVICE_DOWN
Blocker class: SERVICE_DOWN

## Objective

Publish safe rollback / disable guidance for the Fork 1 Build-Wiki Farmer without creating a fake disable button, broad execution path, SMB/Fork 2 path, external farmer path, or second vault.

## What Was Implemented

- Added a read-only `rollback_disable` contract to `GET /api/bridge/brain-sync/build-wiki/status`.
- Exposed owner/admin host runbook steps for stopping the oneshot service and disabling the timer.
- Kept all disable controls non-executable from Mission Control.
- Added the rollback/disable state to the Mission Control Build-Wiki card as `RUNBOOK_ONLY`.
- Added tests proving the runbook is exact, read-only, scoped to Fork 1, and secret/path safe.

## Files Changed

- `src/app/api/bridge/brain-sync/build-wiki/status/route.ts`
- `src/app/api/bridge/brain-sync/build-wiki/status/route.test.ts`
- `src/components/agent-network/AgentNetworkClient.tsx`

## Routes Changed

- `GET /api/bridge/brain-sync/build-wiki/status`

New response field:

```json
{
  "rollback_disable": {
    "read_only": true,
    "execution_enabled": false,
    "writes_enabled": false,
    "disable_controls_enabled": false,
    "bridge_session_required_for_future_disable_control": true,
    "service_unit": "opencloud-docs-farmer.service",
    "timer_unit": "opencloud-docs-farmer.timer"
  }
}
```

## UI Behavior

- Mission Control shows Rollback / Disable as `RUNBOOK_ONLY`.
- The Build-Wiki card displays the owner/admin runbook.
- Mission Control does not execute stop/disable controls from the status card.
- Run Now remains the only wired Build-Wiki action in this hop.

## Owner/Admin Runbook

```bash
systemctl --user stop opencloud-docs-farmer.service
systemctl --user disable --now opencloud-docs-farmer.timer
systemctl --user status opencloud-docs-farmer.service opencloud-docs-farmer.timer
```

## Service / Runtime Behavior

- Runtime restarted on `127.0.0.1:3337`.
- Runtime PID after restart: `46361`.
- Production/local proof commit: `9ac74c9934425ecc900bfcf266135350dd3a84df`.
- No public local exposure was added.
- `systemctl` is not available in this local runtime context, so live service/timer stop proof remains blocked by `systemctl_command_not_found_in_local_runtime`.

## Tests Run

- `pnpm test src/app/api/bridge/brain-sync/build-wiki/status/route.test.ts`
- `git diff --check`
- `node scripts/check-protected-file-invariants.mjs`
- `.env` diff check
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`

Full test result:

- Test files: 157 passed
- Tests: 1326 passed

## Runtime Proof

Proof artifact:

- `runtime/day-36-farmer-rollback-disable-proof.json`

Verified:

- `/login` returned 200.
- Unauthenticated status route returned a protected response.
- Authenticated status route returned 200.
- `rollback_disable.read_only=true`.
- `execution_enabled=false`.
- `writes_enabled=false`.
- `disable_controls_enabled=false`.
- Runbook is exactly scoped to `opencloud-docs-farmer.service` and `opencloud-docs-farmer.timer`.
- No disable execution was attempted.
- No SMB/Fork 2/external farmer path was added.
- No raw local paths or secret-shaped values were exposed in the status payload.

## Safety

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No broad connector execution.
- No SMB mount.
- No Fork 2.
- No external farmers.
- No second vault.
- No fake button: disable is runbook-only.

## Commit / Push

Source commit:

```text
9ac74c9934425ecc900bfcf266135350dd3a84df
```

Push result:

```text
origin/to-knowledge-mc contains 9ac74c9934425ecc900bfcf266135350dd3a84df
```

## Rollback

```bash
git revert 9ac74c9934425ecc900bfcf266135350dd3a84df
```

## Remaining Blocker

```text
SERVICE_DOWN: systemctl_command_not_found_in_local_runtime
```

This does not block developer-side Day 36 closure because Mission Control now exposes the exact rollback/disable runbook safely and does not pretend it executed the stop/disable action.

## Next Day Started

Day 37 — Brain Status Page is next.
