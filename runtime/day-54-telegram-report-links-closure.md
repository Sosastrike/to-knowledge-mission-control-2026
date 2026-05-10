# Day 54 - Telegram Report Links Closure

Date: 2026-05-10T16:12:00Z
Branch: to-knowledge-mc
Base commit before Day 54: 293075d
Status: DEVELOPER-SIDE CLOSED / PUBLIC TELEGRAM LINK SEND GATED

## Lane

Telegram report links and protected Mission Control report URLs.

## What changed

- Added a protected report-link contract for Agent Zero reports.
- Added safe public-origin normalization so local/private origins are not sent as owner-facing public links.
- Added `GET /api/bridge/agent-zero/reports/[id]/links`.
- Added `report_links` to:
  - `POST /api/bridge/agent-zero/reports`
  - `GET /api/bridge/agent-zero/reports`
  - `GET /api/bridge/agent-zero/reports/[id]`
- Added a Day 54 runtime guard script proving report links are auth-gated, local-safe, and free of raw paths/secrets.

## Files changed

- `src/lib/agent-zero-report-delivery.ts`
- `src/lib/agent-zero-report-delivery.test.ts`
- `src/app/api/bridge/agent-zero/reports/route.ts`
- `src/app/api/bridge/agent-zero/reports/[id]/route.ts`
- `src/app/api/bridge/agent-zero/reports/[id]/links/route.ts`
- `scripts/check-telegram-report-links-guard.mjs`
- `runtime/day-54-telegram-report-links-guard-smoke.json`
- `runtime/day-54-route-rendering-smoke.json`
- `runtime/day-54-telegram-report-links-closure.md`
- `runtime/day-54-telegram-report-links-closure.pdf`

## Routes changed or verified

- `POST /api/bridge/agent-zero/reports`
- `GET /api/bridge/agent-zero/reports`
- `GET /api/bridge/agent-zero/reports/[id]`
- `GET /api/bridge/agent-zero/reports/[id]/links`
- `GET /api/bridge/agent-zero/reports/[id]/pdf`
- `GET /api/bridge/agent-zero/reports/[id]/markdown`

## UI and owner-facing behavior

- Owner-visible report responses now include `report_links`.
- Link bundles mark:
  - `auth_required: true`
  - `protected: true`
  - `raw_local_paths_exposed: false`
  - `public_local_exposure: false`
- Local runtime origins such as `127.0.0.1` are rejected for public Telegram report links and reported as `mission_control_public_url_required`.
- If a safe public Mission Control origin is available, the bundle can produce absolute HTTPS links.
- No Telegram message is marked sent by this lane.

## Service/runtime behavior

- Local production-style runtime restarted on `127.0.0.1:3337`.
- Runtime PID after restart: `28918`.
- `/login` returned `200`.
- No public local exposure was added.
- No `.env` changes were made.
- No secrets were printed.
- No external Telegram send was attempted.

## Proof artifacts

- `runtime/day-54-telegram-report-links-guard-smoke.json`
  - `ok: true`
  - checked: `6`
  - created report: `201`
  - unauthenticated links endpoint: `401`
  - authenticated links endpoint: `200`
  - PDF unauthenticated: `401`
  - Markdown unauthenticated: `401`
  - unsafe text detected: `false`
- `runtime/day-54-route-rendering-smoke.json`
  - `ok: true`
  - failures: `0`

## Tests and checks

- Red test verified missing helper first:
  - `buildAgentZeroReportLinks is not a function`
  - `normalizeMissionControlPublicOrigin is not a function`
- Focused tests:
  - `pnpm exec vitest run src/lib/agent-zero-report-delivery.test.ts --pool=forks --no-file-parallelism --reporter verbose`
  - Result: `1 file / 8 tests passed`
- Script syntax:
  - `node --check scripts/check-telegram-report-links-guard.mjs`
- Typecheck:
  - `pnpm run typecheck`
- Build:
  - `pnpm run build`
  - Build includes `/api/bridge/agent-zero/reports/[id]/links`
- Full tests:
  - `pnpm test`
  - Result: `179 files / 1406 tests passed`
- Runtime guard:
  - `node scripts/check-telegram-report-links-guard.mjs http://127.0.0.1:3337 runtime/day-54-telegram-report-links-guard-smoke.json`
- Route rendering:
  - `node scripts/check-mission-control-route-rendering.mjs http://127.0.0.1:3337 > runtime/day-54-route-rendering-smoke.json`
- Diff whitespace:
  - `git diff --check`
- Protected-file invariant:
  - `node scripts/check-protected-file-invariants.mjs`
- `.env` diff:
  - clean

## Blocker classification

- Developer-side implementation: `NONE`
- Public Telegram report link send: `OWNER_GATED` until owner-approved Telegram send scope exists.
- Absolute public report URL on local runtime: `OWNER_GATED` / `SERVICE_DOWN` until the request is served from the owner-approved public Mission Control origin.
- Telegram connector: `CREDENTIAL_GATED` if Telegram credentials are not configured.

## Safety confirmation

- No `.env` edits.
- No secret output.
- No auth weakening.
- No fake sent status.
- No fake Done.
- No raw local paths in report-link payloads.
- No public local origin exposed as a Telegram link.
- No Zapier writes.
- No SMB/Fork 2.
- No external farmers.

## Rollback

After commit:

`git revert <day54_commit_sha>`

## Commit and push

Pending at report creation. The commit hash and push result will be recorded after exact-path staging, staged secret scan, commit, and push.

## Next day started

After Day 54 commit/push, continue automatically to Day 55: AgentMail readiness.
