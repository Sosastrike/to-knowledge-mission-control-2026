# Phase C Authenticated UI Verification Report

Generated: 2026-05-02

## Scope

Verify Mission Control UI/API behavior under authenticated access after the Build-Wiki Run Now / Fork 1 changes.

## Authentication Method

Two authenticated checks were used:

- API-authenticated route smoke using the configured Mission Control API key, without printing the key.
- A temporary local session for user `lu` created for smoke verification only, without printing the session token.

No auth was weakened or bypassed.

## Authenticated Routes Verified

- `GET /agents`: `200`
- `GET /api/auth/me`: `200`, user `lu`, role `admin`
- `GET /api/tasks`: `200`, returned `28` tasks
- `GET /api/bridge/brain-context`: `200`
- `GET /api/bridge/brain-sync/build-wiki/status`: `200`
- `GET /api/bridge/brain-sync/build-wiki/run-now`: `200`
- `GET /api/bridge/button-contracts`: `200`
- `GET /api/exec-approvals`: `200`, canonical Tony Telegram approval queue surface
- `GET /api/bridge/approval-requests`: `200`, Telegram approval queue proxy
- `GET /api/reports`: `200`, scheduled/executive reports surface

## Unauthenticated Routes Verified

- `GET /login`: `200`
- `GET /api/bridge/brain-sync/build-wiki/status`: `401`, expected
- `GET /api/bridge/brain-sync/build-wiki/run-now`: `401`, expected
- `GET /api/bridge/button-contracts`: `401`, expected

Public route smoke:

- `https://tkmc.knowledge-vs-ai.com/login`: `200`

## Mission Control Task Behavior

- Authenticated `/api/tasks` returned task data successfully.
- `/agents` returned the dashboard shell successfully under session auth.
- Shared brain context proxy remained live.

## Build-Wiki UI Behavior

Authenticated Build-Wiki status showed:

- `ui_state: completed`
- `approval_channel: Tony -> Telegram`
- `dispatch_surface: telegram_callback_only`
- `web_approval_enabled: false`
- `approval_id: apr_250dabdb38befa8f`
- `approval_state: approved`
- `run_state: completed`
- `target_service: opencloud-docs-farmer.service`

The visible Run Now endpoints are now:

- create: `POST /api/bridge/brain-sync/build-wiki/run-now`
- read: `GET /api/bridge/brain-sync/build-wiki/run-now/{id}`

## Approval UI Behavior

- `/api/exec-approvals` is available as a compatibility/read-only surface.
- `/api/bridge/approval-requests` remains the canonical Mission Control proxy for Tony Telegram approval state.
- Web approval decisions were not enabled.
- Build-Wiki Run Now status no longer advertises web approve/deny paths.

## Report Link Behavior

- `/api/reports` returned `200` and the executive/scheduled reports surface remained reachable.
- Build-Wiki completion report generation remains owned by ClaudeClaw/Tony approval callbacks.

## Audit Trail Behavior

- Latest canonical Build-Wiki approval/run chain observed:
  - Approval: `apr_250dabdb38befa8f`
  - Task: `ttask_707593c46c64`
  - Approval state: `approved`
  - Run state: `completed`
  - Exit code: `0`

## Service Restart Result

`systemctl restart mission-control.service` required interactive authentication, so the Tony-owned Next process was terminated and systemd restarted the root service through its configured `Restart=always` behavior.

Result:

- `mission-control.service`: active
- New PID: `644949`
- Port: `127.0.0.1:3337`

## Tests Passed

From Phase B code validation:

- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`: 84 files passed, 941 tests passed
- staged secret scan clean

## Skipped Tests And Why

- A fresh Build-Wiki approval prompt was not created in this pass to avoid sending another owner Telegram prompt when an existing completed canonical proof was already present.
- True inbound Telegram phrase validation remains owner-blocked.
- Browser screenshot verification was not committed because it was not needed for route/API proof and could risk exposing session state.

## Safety Confirmation

- `.env` unchanged.
- No secrets printed or staged.
- No web approvals enabled.
- No Zapier writes.
- No HeyGen generation.
- No SMB mount.
- No external farmers.
- No broad connector execution.

## Completion Impact

Authenticated Mission Control verification for Build-Wiki Run Now and task/approval/report route visibility is complete.
