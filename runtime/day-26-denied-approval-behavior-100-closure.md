# Day 26 - Denied Approval Behavior

Date: 2026-05-09
Branch: to-knowledge-mc
Status: CLOSED
Blocker class: NONE
Code change: none
Report commit: pending
Rollback: no execution rollback required; report-only rollback is `git revert <day26_report_commit_sha>`
Next day started: Day 27 - Failed Execution Behavior

## Closure Decision

Day 26 is closed.

Denied Bridge approvals are proven to remain non-executing. The live proof created one exact Build-Wiki Run Now approval request, denied it, verified a denial audit row, verified zero connector run rows, then confirmed later approve and dispatch attempts were blocked.

## Inventory

Existing denial implementation:

- `POST /api/bridge/approval-requests/{id}/deny`
- `src/lib/bridge-approval-lifecycle.ts`
- `src/lib/bridge-approval-ui-state.ts`
- `src/app/api/bridge/approval-requests/route.ts`
- `src/lib/build-wiki-run-now.ts`
- `POST /api/bridge/brain-sync/build-wiki/run-now/{id}/dispatch`

Existing tests covering the denial surface:

- `src/lib/bridge-approval-lifecycle.test.ts`
- `src/lib/bridge-approval-ui-state.test.ts`
- `src/app/api/bridge/approval-requests/[id]/approve/route.test.ts`
- `src/app/api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch/route.test.ts`

No source change was required for this day. The implementation already had the required denial route, lifecycle state, UI state mapping, and dispatch guard. This day produced live proof and a report artifact.

## Live Proof

Proof artifact:

`runtime/day-26-denied-approval-proof.json`

Approval id:

`apr_60a7825c-5ac3-4560-b9c7-cb6867720037`

Exact scope:

- connector: `skill.build_wiki`
- action: `buildwiki.run_now`
- target key: `opencloud-docs-farmer.service`
- fork: Fork 1 only

Create response:

- status: 201
- mode: `run_now_approval_requested_no_execution`
- accepted for execution: false
- execution enabled: false

Deny response:

- status: 200
- mode: `approval_request_denied_no_execution`
- approval state: `denied`
- decision: `denied`
- accepted for execution: false
- execution enabled: false
- writes enabled: false
- denial audit event present: true
- next action: `Approval is denied. The protected action must not execute.`

## Non-Execution Proof

Runtime database proof:

- approval state: `denied`
- resolved: true
- connector run count for denied approval: 0
- audit outcomes:
  - `approval_requested`
  - `denied`

Post-denial approve attempt:

- status: 409
- mode: `approval_request_approve_blocked`
- blocked reason: `approval_request_already_resolved`
- accepted for execution: false
- execution enabled: false
- Build-Wiki dispatch present: false

Post-denial dispatch attempt:

- status: 409
- mode: `run_now_dispatch_blocked`
- blocked reason: `approval_state_not_approved`
- accepted for execution: false
- execution enabled: false

Unauthenticated denial attempt:

- status: 401

## UI / API State

Read route after denial:

- status: 200
- UI state: `denied`
- approval state: `denied`
- run present: false

Status route after denial:

- status: 200
- Run Now UI state: `denied`

This means the UI can show a denied terminal state without pretending an execution happened.

## Verification

Fresh checks run for Day 26:

- `git diff --check`: pass
- `pnpm run typecheck`: pass
- focused tests: pass, 4 files / 11 tests
- `node scripts/check-protected-file-invariants.mjs`: pass
- live denied approval proof: pass
- `.env` diff check: clean

Build and full test suite were already run for the current source commit during Day 25. Day 26 changed no source files.

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public exposure added.
- No connector execution occurred.
- No service command was run for the denied approval.
- No SMB.
- No Fork 2.
- No external farmers.
- No fake Done or fake success.

## Files Added

- `runtime/day-26-denied-approval-proof.json`
- `runtime/day-26-denied-approval-behavior-100-closure.md`
- `runtime/day-26-denied-approval-behavior-100-closure.pdf`

## Remaining Blockers

None for denied approval behavior.

## Day 27 Start

Day 27 - Failed Execution Behavior begins next.

Goal:

Prove failed execution records a safe failure state, safe error metadata, no secret output, and clear owner-facing retry/rollback guidance.
