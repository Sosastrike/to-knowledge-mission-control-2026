# Day 08 Phase 1 — OpenClaw+ Doctor Repair

## Objective
Improve OpenClaw+ doctor reachability in Mission Control runtime without weakening security, changing `.env`, or performing destructive host actions.

## Actions Performed
1. Implemented resilient OpenClaw+ CLI resolution in runtime command execution:
   - Added fallback binary probe order for OpenClaw+ doctor/runtime commands.
   - Added non-destructive fallback sequence:
     - configured `OPENCLAW_BIN`
     - `CLAWDBOT_BIN` (if set)
     - `OPENCLAW_FALLBACK_BIN` (if set)
     - `openclaw`
     - `clawdbot`
     - `claudeclaw`
2. Preserved existing state-dir safety behavior:
   - Continued enforcing `OPENCLAW_STATE_DIR` during command execution.
3. Kept auth model unchanged:
   - No role/auth gate changes.
   - No auth weakening.

## Files Changed
- `src/lib/command.ts`

## Commands / Routes Used
- `pnpm run typecheck`
- `pnpm test`
- `pnpm run build`
- `git diff --check`
- Runtime binary probe:
  - `command -v openclaw`
  - `command -v clawdbot`

## Test Results
- Typecheck: PASS
- Tests: PASS (`138` files / `1247` tests)
- Build: PASS
- Diff check: PASS

## Production Proof / Outcome
- Mission Control now attempts multiple OpenClaw+ binary names before returning runtime-not-reachable.
- This reduces false negatives caused by host binary naming differences.
- In the current host runtime, no OpenClaw+ binary is available in PATH, so live doctor execution remains blocked.

## Current Blockers
- `openclaw_doctor_runtime_not_reachable`
  - Reason: No reachable OpenClaw+ CLI binary found on host runtime PATH.

## Owner/Admin Action Package
1. Install or expose one approved OpenClaw+ CLI binary on the runtime host:
   - preferred: `openclaw`
   - supported fallback aliases: `clawdbot` or `claudeclaw`
2. Ensure runtime service PATH includes the installed binary directory.
3. Re-run:
   - `GET /api/openclaw/doctor` (authenticated admin)
   - `POST /api/openclaw/doctor` (authenticated admin, fix pass)

## Rollback
- `git revert <commit_sha_for_this_phase>`

## No-Secrets / Safety Confirmation
- No secrets printed.
- No auth files printed.
- No token values printed.
- No `.env` changes.
- No auth weakening.
- No public local service exposure added.

## Updated Percentage (Scoped)
- OpenClaw+ (doctor reachability lane): increased in implementation-readiness reliability only.
- OpenClaw+ does **not** move to GO until authenticated live doctor execution succeeds.

## Exact Next Step
Proceed to Day 08 Phase 2 (OpenClaw+ runtime service proof) and, in parallel, execute non-owner-dependent connector/runtime proofs while preserving existing owner-gated blockers.
