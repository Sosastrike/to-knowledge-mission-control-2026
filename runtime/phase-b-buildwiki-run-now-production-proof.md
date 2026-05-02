# Phase B Build-Wiki Run Now Production Proof

Generated: 2026-05-02

## Scope

Finish Fork 1 for Build-Wiki / Farmer Sync Run Now only.

The active Run Now path remains scoped to:

`opencloud-docs-farmer.service`

No Pause Sync, Resume Sync, Add Source, SMB farmer, external farmer, Gmail, Slack, YouTube, Web farmer, Zapier, HeyGen, or broad connector execution was enabled.

## Files Changed

- `src/app/api/bridge/brain-sync/build-wiki/run-now/route.ts`
- `src/app/api/bridge/brain-sync/build-wiki/status/route.ts`
- `src/app/api/bridge/button-contracts/route.ts`
- `src/lib/build-wiki-telegram-run-now.ts`
- `runtime/phase-b-buildwiki-run-now-production-proof.md`

## Endpoint / API Behavior

### `GET /api/bridge/brain-sync/build-wiki/run-now`

Now reads the canonical Tony Telegram Build-Wiki approval/run state through ClaudeClaw.

If ClaudeClaw is unavailable, it returns an honest unavailable/idle state and does not fall back to stale local Mission Control approval rows.

### `POST /api/bridge/brain-sync/build-wiki/run-now`

Still creates one canonical Tony Telegram approval request for:

`buildwiki.run_now`

It does not start the farmer service directly.

### `GET /api/bridge/brain-sync/build-wiki/status`

Now exposes Run Now state as:

- `approval_channel: "Tony -> Telegram"`
- `web_approval_enabled: false`
- `dispatch_surface: "telegram_callback_only"`

The visible Run Now endpoints are:

- create: `POST /api/bridge/brain-sync/build-wiki/run-now`
- read: `GET /api/bridge/brain-sync/build-wiki/run-now/{id}`

The status payload no longer advertises web approve/deny or manual dispatch endpoints for Run Now.

### `GET /api/bridge/button-contracts`

No longer advertises a separate Build-Wiki dispatch button contract.

## Approval Request Behavior

Mission Control requests a scoped approval from ClaudeClaw/Tony Telegram.

Canonical action:

`buildwiki.run_now`

Canonical service scope:

`opencloud-docs-farmer.service only`

Latest canonical proof found:

- Approval: `apr_250dabdb38befa8f`
- Task: `ttask_707593c46c64`
- Approval state: `approved`
- Run state: `completed`
- Exit code: `0`

## Duplicate Approval Behavior

Duplicate prevention remains owned by ClaudeClaw/Tony Telegram approval creation. This phase did not create a second approval system.

## Denial Behavior

Denial remains handled by the canonical Tony Telegram callback path. Mission Control does not expose a web approval/denial decision surface for Run Now.

## Approved Execution Behavior

Approved execution remains exact-scope only:

`systemctl --user start opencloud-docs-farmer.service`

The verified latest completed approval/run chain shows exit code `0`.

## Audit Behavior

ClaudeClaw/Tony Telegram remains the canonical audit source for the approval/run chain. Mission Control status now reads and displays the linked Telegram approval/task/run state instead of relying on stale local rows.

## Final Report Behavior

Existing ClaudeClaw approval callback report generation remains active for Build-Wiki completions. Mission Control now reads the canonical completed run state and linked task metadata.

## Validation Results

Checks passed:

- `git diff --check`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`: 84 files passed, 941 tests passed
- Authenticated temporary-server smoke with `x-api-key`

Authenticated smoke on temporary new build, port `3338`:

- `GET /api/bridge/brain-sync/build-wiki/status`: `200`
- `GET /api/bridge/brain-sync/build-wiki/run-now`: `200`
- `GET /api/bridge/button-contracts`: `200`

Observed values:

- `ui_state: completed`
- `approval_channel: Tony -> Telegram`
- `dispatch_surface: telegram_callback_only`
- `web_approval_enabled: false`
- `approval_id: apr_250dabdb38befa8f`
- `approval_state: approved`
- `run_state: completed`
- `target_service: opencloud-docs-farmer.service`
- Build-Wiki dispatch contract visible: `false`

Unauthenticated production route smoke:

- `GET /api/bridge/brain-sync/build-wiki/status`: `401`, expected
- `GET /api/bridge/brain-sync/build-wiki/run-now`: `401`, expected
- `GET /api/bridge/button-contracts`: `401`, expected

## Service Status

- `mission-control.service`: active as root system service.
- Direct `systemctl restart mission-control.service` was blocked by interactive authentication.
- A temporary local server was used to verify the new build without weakening auth.
- `claudeclaw.service`: active.
- `opencloud-docs-farmer.timer`: active.

## Safety Confirmation

- `.env` unchanged.
- No secrets printed or staged.
- No web approval enablement.
- No broad connector execution.
- No Zapier writes.
- No HeyGen generation.
- No SMB mount.
- No external farmers.
- No Tony voice, memory, or governance changes.

## Completion Impact

This phase moves Build-Wiki Run Now/Fork 1 from partially implemented to production-code-complete and test-verified, with live deployment pending service restart if root systemd authentication is still required.
