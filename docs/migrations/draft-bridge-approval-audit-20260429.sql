-- DEPRECATED DRAFT - DO NOT APPLY
-- Canonical proposal: docs/migrations/proposed-bridge-approval-audit-20260429.sql
-- Kept only as rollback/history context for the original sketch.
-- Do not use this file for production or temp-copy migration testing.
--
-- DRAFT ONLY - DO NOT APPLY
-- Bridge Mode approval/audit persistence sketch.
-- This file is intentionally not wired into the production migration runner.
-- Owner approval is required before any production DB migration is applied.

CREATE TABLE IF NOT EXISTS bridge_approval_requests (
  id TEXT PRIMARY KEY,
  connector TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  requester TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  approval_state TEXT NOT NULL CHECK (approval_state IN ('pending', 'approved', 'denied', 'expired', 'revoked')),
  protected_category TEXT NOT NULL,
  approval_scope_json TEXT NOT NULL DEFAULT '{}',
  reason TEXT,
  required_approver TEXT NOT NULL DEFAULT 'owner',
  expires_at TEXT,
  resolved_at TEXT,
  resolved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bridge_audit_events (
  id TEXT PRIMARY KEY,
  approval_request_id TEXT,
  actor TEXT NOT NULL,
  connector TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('allowed', 'blocked', 'failed', 'completed', 'rolled_back')),
  payload_hash TEXT,
  before_ref TEXT,
  after_ref TEXT,
  rollback_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (approval_request_id) REFERENCES bridge_approval_requests(id)
);

CREATE TABLE IF NOT EXISTS bridge_action_locks (
  id TEXT PRIMARY KEY,
  connector TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  lock_state TEXT NOT NULL CHECK (lock_state IN ('locked', 'unlocked')),
  approval_request_id TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (approval_request_id) REFERENCES bridge_approval_requests(id)
);

CREATE TABLE IF NOT EXISTS bridge_connector_runs (
  id TEXT PRIMARY KEY,
  connector TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  approval_request_id TEXT,
  audit_event_id TEXT,
  run_state TEXT NOT NULL CHECK (run_state IN ('planned', 'blocked', 'running', 'failed', 'completed')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  input_hash TEXT,
  output_hash TEXT,
  rollback_ref TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (approval_request_id) REFERENCES bridge_approval_requests(id),
  FOREIGN KEY (audit_event_id) REFERENCES bridge_audit_events(id)
);

CREATE INDEX IF NOT EXISTS idx_bridge_approval_requests_state
  ON bridge_approval_requests(approval_state, connector, action);

CREATE INDEX IF NOT EXISTS idx_bridge_audit_events_connector_time
  ON bridge_audit_events(connector, created_at);

CREATE INDEX IF NOT EXISTS idx_bridge_action_locks_connector_action
  ON bridge_action_locks(connector, action, lock_state);

CREATE INDEX IF NOT EXISTS idx_bridge_connector_runs_state
  ON bridge_connector_runs(connector, run_state, created_at);
