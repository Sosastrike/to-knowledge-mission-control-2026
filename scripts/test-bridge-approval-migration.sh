#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE_DB="${MISSION_CONTROL_DB_PATH:-$ROOT_DIR/.data/mission-control.db}"
MIGRATION_SQL="$ROOT_DIR/docs/migrations/proposed-bridge-approval-audit-20260429.sql"

if [[ ! -f "$LIVE_DB" ]]; then
  echo "ERROR: live DB not found at $LIVE_DB" >&2
  exit 1
fi

if [[ ! -f "$MIGRATION_SQL" ]]; then
  echo "ERROR: migration SQL not found at $MIGRATION_SQL" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 is required" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
TMP_DB="$TMP_DIR/mission-control-bridge-approval-test.db"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cp -a "$LIVE_DB" "$TMP_DB"

echo "Copied live DB to temp DB only: $TMP_DB"
echo "Applying proposed migration to temp DB only..."
sqlite3 "$TMP_DB" < "$MIGRATION_SQL"

required_tables=(
  bridge_approval_requests
  bridge_audit_events
  bridge_action_locks
  bridge_connector_runs
)

required_indexes=(
  idx_bridge_approval_requests_state
  idx_bridge_approval_requests_correlation
  idx_bridge_approval_requests_scope
  idx_bridge_approval_requests_idempotency
  idx_bridge_audit_events_connector_time
  idx_bridge_audit_events_approval
  idx_bridge_audit_events_correlation
  idx_bridge_audit_events_outcome
  idx_bridge_action_locks_connector_action
  idx_bridge_action_locks_expiry
  idx_bridge_action_locks_active_unique
  idx_bridge_connector_runs_state
  idx_bridge_connector_runs_approval
  idx_bridge_connector_runs_correlation
  idx_bridge_connector_runs_idempotency
)

for table in "${required_tables[@]}"; do
  found="$(sqlite3 "$TMP_DB" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';")"
  if [[ "$found" != "$table" ]]; then
    echo "ERROR: missing table $table" >&2
    exit 1
  fi
done

for index in "${required_indexes[@]}"; do
  found="$(sqlite3 "$TMP_DB" "SELECT name FROM sqlite_master WHERE type='index' AND name='$index';")"
  if [[ "$found" != "$index" ]]; then
    echo "ERROR: missing index $index" >&2
    exit 1
  fi
done

echo "Tables and indexes verified on temp DB."

echo "Checking insert path on temp DB..."
sqlite3 "$TMP_DB" <<'SQL'
PRAGMA foreign_keys = ON;
INSERT INTO bridge_approval_requests (
  id, workspace_id, tenant_id, connector, action, target, target_key,
  requester, risk_level, approval_state, protected_category,
  approval_scope_json, scope_hash, reason, correlation_id, idempotency_key
) VALUES (
  'test_apr_1', 1, 1, 'zapier', 'tool.invoke', 'gmail.send_email', 'gmail.send_email',
  'migration-test', 'high', 'pending', 'external_automation',
  '{"tool":"gmail.send_email"}', 'scopehash_test_1', 'temp DB migration test',
  'corr_test_1', 'idem_test_1'
);

INSERT INTO bridge_audit_events (
  id, workspace_id, tenant_id, approval_request_id, actor, connector, action,
  target, target_key, outcome, payload_hash, correlation_id
) VALUES (
  'test_audit_1', 1, 1, 'test_apr_1', 'migration-test', 'zapier', 'tool.invoke',
  'gmail.send_email', 'gmail.send_email', 'approval_requested', 'payloadhash_test_1',
  'corr_test_1'
);

INSERT INTO bridge_action_locks (
  id, workspace_id, tenant_id, connector, action, target, target_key,
  scope_hash, lock_state, approval_request_id, expires_at
) VALUES (
  'test_lock_1', 1, 1, 'zapier', 'tool.invoke', 'gmail.send_email', 'gmail.send_email',
  'scopehash_test_1', 'locked', 'test_apr_1', '2099-01-01T00:00:00.000Z'
);

INSERT INTO bridge_connector_runs (
  id, workspace_id, tenant_id, connector, action, target, target_key,
  approval_request_id, audit_event_id, run_state, risk_level, input_hash,
  correlation_id, idempotency_key
) VALUES (
  'test_run_1', 1, 1, 'zapier', 'tool.invoke', 'gmail.send_email', 'gmail.send_email',
  'test_apr_1', 'test_audit_1', 'planned', 'high', 'inputhash_test_1',
  'corr_test_1', 'run_idem_test_1'
);
SQL

inserted="$(sqlite3 "$TMP_DB" "SELECT (SELECT COUNT(*) FROM bridge_approval_requests) || '|' || (SELECT COUNT(*) FROM bridge_audit_events) || '|' || (SELECT COUNT(*) FROM bridge_action_locks) || '|' || (SELECT COUNT(*) FROM bridge_connector_runs);")"
if [[ "$inserted" != "1|1|1|1" ]]; then
  echo "ERROR: temp DB insert verification failed: $inserted" >&2
  exit 1
fi

echo "Insert path verified on temp DB."

echo "Testing rollback on temp DB only..."
sqlite3 "$TMP_DB" <<'SQL'
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
SQL

remaining="$(sqlite3 "$TMP_DB" "SELECT COUNT(*) FROM sqlite_master WHERE name IN ('bridge_approval_requests','bridge_audit_events','bridge_action_locks','bridge_connector_runs');")"
if [[ "$remaining" != "0" ]]; then
  echo "ERROR: rollback left bridge tables behind: $remaining" >&2
  exit 1
fi

echo "Rollback verified on temp DB."
echo "SUCCESS: production DB was not modified."
