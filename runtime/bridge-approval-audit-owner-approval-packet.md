# Bridge Approval/Audit Persistence Owner Approval Packet

Generated: 2026-04-30T09:21:00-04:00

Purpose: prepare the next owner-gated step for Mission Control protected actions. This packet does not apply the production migration and does not enable connector execution.

## Current State

- Bridge Mode preflight: live, read-only.
- Connector readiness: live, read-only.
- Protected action probes: locked with HTTP 423.
- Approval queue UI: visible as read-only/backend-required.
- Approval request creation: not persisted in production.
- Connector execution: disabled.
- Zapier writes: disabled.
- Production DB migration: not applied.
- Runtime safety was verified at `fd14f1d`; this packet refresh adds documentation only and does not change runtime code.
- Current safety posture: 23 overnight read-only checks passing, 0 failures.
- Full unit tests: 82 files, 931 tests passing.

## What Owner Would Approve

Approve only the approval/audit persistence migration for Mission Control:

- Create `bridge_approval_requests`.
- Create `bridge_audit_events`.
- Create `bridge_action_locks`.
- Create `bridge_connector_runs`.
- Create supporting indexes.
- Allow Mission Control to persist approval requests and approval/deny decisions.

This does **not** approve connector execution, Zapier writes, external automation, memory writes, routing changes, or agent-to-agent protected execution.

## Migration File

```text
/home/tony/mission-control/docs/migrations/proposed-bridge-approval-audit-20260429.sql
```

## Required Pre-Apply Test

Run this copied-DB test first. It copies the live DB to a temp path, applies the migration only to the temp DB, verifies tables/indexes, verifies approval lifecycle state, verifies rollback, and deletes the temp DB.

```bash
cd /home/tony/mission-control
export PATH=/home/tony/.nvm/versions/node/v24.14.1/bin:$PATH
MISSION_CONTROL_DB_PATH=/home/tony/mission-control/.data/mission-control.db bash scripts/test-bridge-approval-migration.sh
```

Expected result:

```text
SUCCESS: production DB was not modified.
```

## Production Backup Command

Run only after owner approval:

```bash
cd /home/tony/mission-control
mkdir -p runtime/db-backups
cp -a .data/mission-control.db "runtime/db-backups/mission-control.db.pre-bridge-approval-$(date +%Y%m%d-%H%M%S).db"
```

## Production Apply Command

Run only after owner approval and backup:

```bash
cd /home/tony/mission-control
sqlite3 .data/mission-control.db < docs/migrations/proposed-bridge-approval-audit-20260429.sql
```

## Post-Apply Verification

```bash
cd /home/tony/mission-control
export PATH=/home/tony/.nvm/versions/node/v24.14.1/bin:$PATH
node scripts/check-approval-readiness-live.mjs http://127.0.0.1:3337
node scripts/check-protected-actions-locked.mjs http://127.0.0.1:3337
node scripts/check-overnight-readonly-safety.mjs http://127.0.0.1:3337
curl -sS -o /dev/null -w 'tkmc_login=%{http_code}\n' https://tkmc.knowledge-vs-ai.com/login
```

Expected after migration:

- Approval readiness state becomes `PERSISTENCE_READY_EXECUTION_STILL_LOCKED`.
- Queue becomes readable.
- Protected actions remain locked unless a request is explicitly approved.
- Connector execution still remains disabled.
- Zapier writes still remain disabled.

## Rollback Strategy

Preferred rollback is DB file restore from the pre-apply backup:

```bash
cd /home/tony/mission-control
systemctl is-active mission-control.service
cp -a runtime/db-backups/<approved-backup-file>.db .data/mission-control.db
```

If table-only rollback is needed, drop only the new Bridge tables and indexes in this order:

```sql
DROP INDEX IF EXISTS idx_bridge_connector_runs_idempotency;
DROP INDEX IF EXISTS idx_bridge_connector_runs_correlation;
DROP INDEX IF EXISTS idx_bridge_connector_runs_approval;
DROP INDEX IF EXISTS idx_bridge_connector_runs_state;
DROP INDEX IF EXISTS idx_bridge_action_locks_active_unique;
DROP INDEX IF EXISTS idx_bridge_action_locks_expiry;
DROP INDEX IF EXISTS idx_bridge_action_locks_connector_action;
DROP INDEX IF EXISTS idx_bridge_audit_events_outcome;
DROP INDEX IF EXISTS idx_bridge_audit_events_correlation;
DROP INDEX IF EXISTS idx_bridge_audit_events_approval;
DROP INDEX IF EXISTS idx_bridge_audit_events_connector_time;
DROP INDEX IF EXISTS idx_bridge_approval_requests_idempotency;
DROP INDEX IF EXISTS idx_bridge_approval_requests_scope;
DROP INDEX IF EXISTS idx_bridge_approval_requests_correlation;
DROP INDEX IF EXISTS idx_bridge_approval_requests_state;
DROP TABLE IF EXISTS bridge_connector_runs;
DROP TABLE IF EXISTS bridge_action_locks;
DROP TABLE IF EXISTS bridge_audit_events;
DROP TABLE IF EXISTS bridge_approval_requests;
```

## What Remains Blocked After Migration

- Connector execution runners.
- Zapier writes.
- FireCrawl runs.
- n8n workflow execution.
- Viral Crawl video execution from UI.
- Skills install/enable/disable actions.
- Tony routing/voice/memory/governance changes.
- Telegram approval send/callback wiring.

## Owner Approval Needed

Exact owner approval phrase for this gate:

```text
Approve Bridge Approval/Audit Production Migration
```

Without that approval, production DB must remain unchanged and approval queue must remain backend-required/read-only.
