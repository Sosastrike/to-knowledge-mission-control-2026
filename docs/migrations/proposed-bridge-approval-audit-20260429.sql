-- PROPOSED ONLY - DO NOT APPLY WITHOUT OWNER APPROVAL
-- Bridge Mode approval/audit persistence migration.
-- Target DB: /home/tony/mission-control/.data/mission-control.db
-- This migration adds tables only; it does not enable connector execution.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bridge_approval_requests (
  id TEXT PRIMARY KEY,
  workspace_id INTEGER NOT NULL DEFAULT 1,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  connector TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  target_key TEXT NOT NULL DEFAULT '',
  requester TEXT NOT NULL,
  requester_user_id INTEGER,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  approval_state TEXT NOT NULL CHECK (approval_state IN ('pending', 'approved', 'denied', 'expired', 'revoked')),
  protected_category TEXT NOT NULL CHECK (
    protected_category IN (
      'agent_execution',
      'memory',
      'routing',
      'external_automation',
      'research',
      'tooling',
      'skills',
      'model_routing',
      'infrastructure',
      'credentials',
      'other'
    )
  ),
  approval_scope_json TEXT NOT NULL DEFAULT '{}',
  scope_hash TEXT NOT NULL,
  reason TEXT,
  required_approver TEXT NOT NULL DEFAULT 'owner',
  rollback_available INTEGER NOT NULL DEFAULT 0 CHECK (rollback_available IN (0, 1)),
  rollback_ref TEXT,
  expires_at TEXT,
  resolved_at TEXT,
  resolved_by TEXT,
  resolved_by_user_id INTEGER,
  resolution_reason TEXT,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bridge_audit_events (
  id TEXT PRIMARY KEY,
  workspace_id INTEGER NOT NULL DEFAULT 1,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  approval_request_id TEXT,
  actor TEXT NOT NULL,
  actor_user_id INTEGER,
  connector TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  target_key TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL CHECK (
    outcome IN (
      'blocked',
      'approval_requested',
      'approved',
      'denied',
      'revoked',
      'expired',
      'allowed',
      'running',
      'failed',
      'completed',
      'rolled_back'
    )
  ),
  payload_hash TEXT,
  before_ref TEXT,
  after_ref TEXT,
  rollback_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (approval_request_id) REFERENCES bridge_approval_requests(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bridge_action_locks (
  id TEXT PRIMARY KEY,
  workspace_id INTEGER NOT NULL DEFAULT 1,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  connector TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  target_key TEXT NOT NULL DEFAULT '',
  scope_hash TEXT NOT NULL,
  lock_state TEXT NOT NULL CHECK (lock_state IN ('locked', 'unlocked')),
  approval_request_id TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (approval_request_id) REFERENCES bridge_approval_requests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bridge_connector_runs (
  id TEXT PRIMARY KEY,
  workspace_id INTEGER NOT NULL DEFAULT 1,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  connector TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  target_key TEXT NOT NULL DEFAULT '',
  approval_request_id TEXT,
  audit_event_id TEXT,
  run_state TEXT NOT NULL CHECK (run_state IN ('planned', 'blocked', 'running', 'failed', 'completed', 'rolled_back')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  input_hash TEXT,
  output_hash TEXT,
  rollback_ref TEXT,
  started_at TEXT,
  finished_at TEXT,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (approval_request_id) REFERENCES bridge_approval_requests(id) ON DELETE SET NULL,
  FOREIGN KEY (audit_event_id) REFERENCES bridge_audit_events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bridge_approval_requests_state
  ON bridge_approval_requests(workspace_id, tenant_id, approval_state, connector, action);

CREATE INDEX IF NOT EXISTS idx_bridge_approval_requests_correlation
  ON bridge_approval_requests(correlation_id);

CREATE INDEX IF NOT EXISTS idx_bridge_approval_requests_scope
  ON bridge_approval_requests(workspace_id, tenant_id, connector, action, target_key, scope_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bridge_approval_requests_idempotency
  ON bridge_approval_requests(workspace_id, tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bridge_audit_events_connector_time
  ON bridge_audit_events(workspace_id, tenant_id, connector, created_at);

CREATE INDEX IF NOT EXISTS idx_bridge_audit_events_approval
  ON bridge_audit_events(approval_request_id, created_at);

CREATE INDEX IF NOT EXISTS idx_bridge_audit_events_correlation
  ON bridge_audit_events(correlation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_bridge_audit_events_outcome
  ON bridge_audit_events(workspace_id, tenant_id, outcome, created_at);

CREATE INDEX IF NOT EXISTS idx_bridge_action_locks_connector_action
  ON bridge_action_locks(workspace_id, tenant_id, connector, action, target_key, scope_hash, lock_state);

CREATE INDEX IF NOT EXISTS idx_bridge_action_locks_expiry
  ON bridge_action_locks(lock_state, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bridge_action_locks_active_unique
  ON bridge_action_locks(workspace_id, tenant_id, connector, action, target_key, scope_hash)
  WHERE lock_state = 'unlocked';

CREATE INDEX IF NOT EXISTS idx_bridge_connector_runs_state
  ON bridge_connector_runs(workspace_id, tenant_id, connector, run_state, created_at);

CREATE INDEX IF NOT EXISTS idx_bridge_connector_runs_approval
  ON bridge_connector_runs(approval_request_id, created_at);

CREATE INDEX IF NOT EXISTS idx_bridge_connector_runs_correlation
  ON bridge_connector_runs(correlation_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bridge_connector_runs_idempotency
  ON bridge_connector_runs(workspace_id, tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
