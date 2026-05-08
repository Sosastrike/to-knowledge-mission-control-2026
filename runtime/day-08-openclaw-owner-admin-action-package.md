# Day 08 — OpenClaw+ Owner/Admin Action Package

## Objective
Unblock authenticated OpenClaw+ doctor execution in Mission Control without weakening auth and without `.env` edits.

## Current Truth
- `GET /api/openclaw/doctor` returns `400`.
- `POST /api/openclaw/doctor` returns `400`.
- Response: `OpenClaw is not installed or not reachable`.
- Runtime user/context: `sosastrike`.
- Runtime bind: `127.0.0.1:3337` (local-only).

## Exact Blocker
- `openclaw_doctor_runtime_not_reachable`

## Root Cause
No executable OpenClaw+ CLI binary is reachable from Mission Control runtime PATH or configured fallback binary path.

## Required Owner/Admin Action
Install or expose one approved CLI binary for runtime execution:

1. Preferred binary: `openclaw`
2. Accepted fallback binaries: `clawdbot`, `claudeclaw`
3. Ensure Mission Control runtime service user can execute the binary.
4. Expose via one of:
   - runtime PATH, or
   - `OPENCLAW_BIN`, or
   - `CLAWDBOT_BIN`, or
   - `OPENCLAW_FALLBACK_BIN` (service-manager level)

## Safety Rules Preserved
- No secrets printed.
- No auth files printed.
- No `.env` changes.
- No auth weakening.
- No destructive repair.
- No deletion of agents/skills/memory/reports/governance.

## Codex Verification Steps After Owner/Admin Action
1. Restart Mission Control runtime if required by service manager.
2. Run authenticated:
   - `GET /api/openclaw/doctor`
   - `POST /api/openclaw/doctor` (safe path only)
3. Confirm doctor returns real payload with issue list/count.
4. Start Day 08 OpenClaw+ issue-reduction phase immediately after payload is live.

## Files Changed
- `runtime/day-08-openclaw-owner-admin-action-package.md`
- `runtime/day-08-openclaw-owner-admin-action-package.pdf`

## Tests / Services / Commits
- Tests: not applicable for this action package.
- Service state: Mission Control runtime remained local-only on `127.0.0.1:3337`.
- Commits: pending Day 08 batch commit.

## Rollback
- Report-only rollback: `git revert <day08_report_commit_sha>`

## No-Secrets Confirmation
- Confirmed: no secret values, tokens, or auth file contents exposed.

## Updated Percentage
- OpenClaw+ readiness can increase for blocker clarity only.
- OpenClaw+ cannot move to GO until doctor payload is live and issue reduction executes.

## Exact Next Step
Continue non-dependent Day 08 tracks (Bridge, Paperclip, Telegram, Drive/OneDrive, AgentMail, YouTube, Firecrawl parallel) while owner/admin unblocks CLI runtime.
