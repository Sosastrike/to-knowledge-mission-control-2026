# Build-Wiki Run Now Release Proof

Date: 2026-05-02
Mission: 10 - Build-Wiki Run Now final deployment proof

## Scope

Validation only. No duplicate owner approval prompt was created in this mission, and the farmer was not started.

## Expected Release Behavior

- Run Now uses canonical action `buildwiki.run_now`.
- The farmer does not execute before owner approval.
- Approved execution remains scoped to `systemctl --user start opencloud-docs-farmer.service`.
- Status, approval, audit, and report surfaces are visible through Mission Control routes.

## Route Smoke Evidence

Authenticated local smoke using the configured Mission Control service returned:

- `/api/bridge/brain-sync/build-wiki/status`: HTTP 200, non-empty JSON payload.
- `/api/bridge/button-contracts`: previously committed and verified as part of the read-only visibility bundle.
- `/api/bridge/approval-requests`: canonical approval state remains behind auth.

Unauthenticated route checks remain protected where required.

## Execution Safety

No `POST /api/bridge/brain-sync/build-wiki/run-now` was sent in this mission to avoid creating a duplicate owner prompt. Prior Fork 1 proof remains the live execution evidence for the approval-gated Run Now flow.

## Tests

Mission Control validation was rerun:

- `git diff --check`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `pnpm test`: 84 files passed, 941 tests passed.

## Service Status

- `mission-control.service`: active
- `opencloud-docs-farmer.timer`: active

## Blockers

None for Fork 1 read/approval surface. A fresh live click would create a real owner approval and should only be done when the owner wants another Build-Wiki run.
