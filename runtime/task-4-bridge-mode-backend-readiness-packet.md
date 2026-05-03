# Task 4 — Full Bridge Mode Backend Readiness Packet

Generated: 2026-05-02 14:58 America/New_York
Scope: planning/readiness only. No DB migration was applied.

## Current Readiness Snapshot

- Mission Control HEAD: `3284b7e`
- Current Mission Control DB already contains:
  - `bridge_approval_requests`
  - `bridge_audit_events`
  - `bridge_action_locks`
  - `bridge_connector_runs`
- Proposed migration file exists:
  - `/home/tony/mission-control/docs/migrations/proposed-bridge-approval-audit-20260429.sql`
- New read-only routes are committed but require service restart before live process picks them up.

## Exact DB Tables Needed

### Approval / Protected Action Core

| Table | Purpose | Current note |
|---|---|---|
| `bridge_approval_requests` | Canonical protected-action request record with scope hash, idempotency key, TTL, requester, risk level, state. | Present in DB; verify schema before relying on it. |
| `bridge_audit_events` | Append-only audit chain for request created, approved, denied, expired, running, completed, failed, rolled back. | Present in DB; must be append-only. |
| `bridge_action_locks` | Exact-scope action locks with expiry and idempotency enforcement. | Present in DB; must fail closed. |
| `bridge_connector_runs` | Execution/run record for approved exact-scope action. | Present in DB; should stay exact-scope only. |

### Bridge Mode / Harness Production Backend

| Table | Purpose | Needed before |
|---|---|---|
| `bridge_preflight_events` | Log every mandatory Bridge preflight decision and selected route. | Enforcing preflight for all agents. |
| `bridge_agent_capability_snapshots` | Versioned snapshot of agent tools/models/skills/integrations/MCPs/restrictions. | Historical capability audits and UI diffing. |
| `bridge_harness_events` | Durable Harness routing/event timeline. | Live Harness routing and SSE updates. |
| `bridge_harness_routes` | Route decisions from task type to agent/tool/provider. | Production Harness routing. |
| `bridge_memory_sync_events` | Brain Sync source freshness/read events and future write proposals. | Live Brain Sync visibility beyond current read-only route. |
| `bridge_file_handoff_events` | DB mirror or index for file handoff JSONL facts. | Search/filter/reporting in Mission Control. |
| `bridge_runner_heartbeats` | Runner availability and last successful check. | Prevent asking approval when runner is missing. |
| `bridge_execution_dead_letters` | Failed/blocked action queue with exact reason. | Owner review and retry without duplicate approvals. |

## Exact API Routes Needed

### Already Present Or Committed

- `GET /api/bridge/providers`
- `GET /api/bridge/button-contracts`
- `GET /api/bridge/capability-matrix`
- `GET /api/bridge/preflight`
- `GET /api/bridge/approval-requests`
- `GET /api/bridge/approval-readiness`
- `GET /api/bridge/agent-zero/status`
- `GET /api/bridge/hermes/status`
- `GET /api/bridge/brain-sync/status`
- `GET /api/bridge/harness/status`

### Needed For Full Production Backend

- `POST /api/bridge/preflight/events`
- `GET /api/bridge/preflight/events`
- `POST /api/bridge/approval-requests`
- `POST /api/bridge/approval-requests/:id/dispatch`
- `GET /api/bridge/approval-requests/:id/audit`
- `GET /api/bridge/harness/events`
- `GET /api/bridge/harness/stream`
- `POST /api/bridge/harness/routes/plan`
- `POST /api/bridge/harness/routes/approve`
- `GET /api/bridge/brain-sync/events`
- `GET /api/bridge/brain-sync/stream`
- `GET /api/bridge/file-handoffs`
- `GET /api/bridge/runners`
- `GET /api/bridge/dead-letters`

All mutation routes must be protected and must return HTTP `423` until canonical Tony Telegram approval, audit, and exact-scope runner checks pass.

## SSE / Live Update Requirements

- `GET /api/bridge/harness/stream`
  - Emits ticket routing updates, agent activity, provider activity, runner state, dead letters.
- `GET /api/bridge/brain-sync/stream`
  - Emits source freshness, stale warnings, file handoff changes, approval/task history freshness.
- `GET /api/bridge/approval-requests/stream`
  - Emits pending/approved/denied/expired/running/completed/failed changes.

SSE must be read-only and must never trigger execution.

## TTL Cleanup Requirements

- Expire pending approval requests after `expires_at`.
- Release expired action locks.
- Mark old runner heartbeats stale.
- Move expired pending UI cards to history.
- Never delete audit events.
- Never delete production records as cleanup; use supersession/rollback rows.

## HTTP 423 Protected-Action Enforcement

HTTP `423 Locked` must be returned when:

- Action is protected and no approval exists.
- Approval is pending, denied, expired, revoked, or scope-mismatched.
- Runner is missing, locked, or unavailable.
- Exact tool name does not match approval scope.
- Idempotency lock exists.
- Emergency stop is enabled.
- Web approval attempts try to decide an action.

## Audit Chain Requirements

Every protected action must have:

1. `approval_requested`
2. `message_sent`
3. `approved` or `denied` or `expired`
4. `run_started` only after approval and exact-scope validation
5. `completed` or `failed`
6. optional `rolled_back` / `superseded`

Audit rows must include correlation ID, idempotency key, scope hash, actor, connector/action, and redacted metadata. No secrets.

## Rollback Plan

- DB rollback: apply an owner-approved down migration only after snapshot backup.
- Runtime rollback: `git revert <commit>` for code changes.
- Action rollback: append `rolled_back` / `superseded` audit event; never destructively delete audit rows.
- UI rollback: hide full backend panels behind read-only mode if routes fail.

## Migration Risk

| Risk | Mitigation |
|---|---|
| Schema mismatch with existing DB tables | Run schema diff against `.data/mission-control.db` before applying anything. |
| Duplicate approval systems | Keep Tony Telegram as canonical decision source. |
| Runner executes twice | Use idempotency key, scope hash, and action lock. |
| UI shows stale pending approvals | Active queue must filter only real pending requests. |
| Secrets in audit metadata | Redaction and staged secret scan before write. |

## Owner Approval Wording

Suggested future approval:

> Approve applying the Bridge Mode backend persistence migration to `/home/tony/mission-control/.data/mission-control.db`, enabling only audited exact-scope protected-action records, Harness/Brain Sync read streams, HTTP 423 enforcement, TTL cleanup, and append-only audit logging. Do not enable broad connector execution, Zapier writes, MemPalace writes, external farmers, or web approval decisions.
