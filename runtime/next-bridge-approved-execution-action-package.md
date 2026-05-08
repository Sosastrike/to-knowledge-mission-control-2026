# NEXT-1 — Bridge Approved Execution Action Package

## Objective
Prepare one exact owner approval path for Bridge execution instead of repeating generic `owner_approval_pending`.

## Result
PARTIAL (action package ready; owner approval still required for live execution).

## Actions Executed
1. Verified Bridge persistence tables exist:
   - `bridge_approval_requests`
   - `bridge_audit_events`
2. Queried latest pending approval and linked Bridge session from local Mission Control DB.
3. Defined one exact safe action scope and expected execution/audit behavior.

## Proof
- `bridge_approval_requests` row count: `1`
- `bridge_audit_events` row count: `1`
- latest approval:
  - `id=apr_7848d653-dee4-4d54-9e0c-ac334de2f8b7`
  - `connector=agent_zero`
  - `action=agent_zero.bridge_session.open`
  - `approval_state=pending`
- linked bridge session:
  - `id=bs_036335d2-74ff-430f-a2fa-de99258820cf`
  - `session_state=pending_approval`
  - `execution_enabled=0`
  - `approval_request_id=apr_7848d653-dee4-4d54-9e0c-ac334de2f8b7`

## Exact Approval Path
1. **Scope**: `agent_zero.bridge_session.open` for one safe read-only confirmation action.
2. **Preferred safe action**: Mission Control report-link confirmation (no external write).
3. **Expected route**: `POST /api/bridge/agent-zero/execute` with approved `bridge_session_id`.
4. **Expected audit row**: new row in `bridge_audit_events` for approved execution action.
5. **Expected expiration**: Bridge session expires at configured session expiry (`expires_at` in `bridge_sessions`).
6. **Outside-scope behavior**: blocked with scope/approval reason (must remain non-executable).

## Owner Approval Package
1. Approve pending request ID: `apr_7848d653-dee4-4d54-9e0c-ac334de2f8b7` through canonical owner approval channel.
2. Confirm approved session: `bs_036335d2-74ff-430f-a2fa-de99258820cf`.
3. Notify Codex to run one scoped execution proof and audit verification immediately.

## Explicit Blockers
- `owner_approval_pending`
- `active_bridge_session_required`

## Safety Confirmations
- No SMB/Fork 2 execution.
- No Zapier writes.
- No HeyGen generation.
- No external farmers.
- No secrets printed.
- No `.env` changes.

## Files Changed
- `runtime/next-bridge-approved-execution-action-package.md`
- `runtime/next-bridge-approved-execution-action-package.pdf`

## Next Step
Run one approved scoped action immediately after owner approval and verify:
- `accepted_for_execution=true`
- new `bridge_audit_events` row
- session expiry enforcement
- outside-scope action blocked
