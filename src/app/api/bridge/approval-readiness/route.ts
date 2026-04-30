import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { authJson } from '@/lib/designer-module-api'
import { config } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REQUIRED_TABLES = [
  'bridge_approval_requests',
  'bridge_audit_events',
  'bridge_action_locks',
  'bridge_connector_runs',
]

const REQUIRED_INDEXES = [
  'idx_bridge_approval_requests_state',
  'idx_bridge_approval_requests_correlation',
  'idx_bridge_approval_requests_scope',
  'idx_bridge_approval_requests_idempotency',
  'idx_bridge_audit_events_connector_time',
  'idx_bridge_audit_events_approval',
  'idx_bridge_audit_events_correlation',
  'idx_bridge_audit_events_outcome',
  'idx_bridge_action_locks_connector_action',
  'idx_bridge_action_locks_expiry',
  'idx_bridge_action_locks_active_unique',
  'idx_bridge_connector_runs_state',
  'idx_bridge_connector_runs_approval',
  'idx_bridge_connector_runs_correlation',
  'idx_bridge_connector_runs_idempotency',
]

const MIGRATION_PATH = join(process.cwd(), 'docs/migrations/proposed-bridge-approval-audit-20260429.sql')
const TEST_SCRIPT_PATH = join(process.cwd(), 'scripts/test-bridge-approval-migration.sh')

function objectExists(db: Database.Database, type: 'table' | 'index', name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1")
    .get(type, name) as { name?: string } | undefined
  return row?.name === name
}

function inspectDatabase(dbPath: string) {
  if (!existsSync(dbPath)) {
    return {
      db_exists: false,
      db_path: dbPath,
      db_size_bytes: 0,
      readable: false,
      tables_present: [] as string[],
      tables_missing: REQUIRED_TABLES,
      indexes_present: [] as string[],
      indexes_missing: REQUIRED_INDEXES,
      error: 'database file not found',
    }
  }

  const dbStat = statSync(dbPath)
  if (dbStat.size === 0) {
    return {
      db_exists: true,
      db_path: dbPath,
      db_size_bytes: dbStat.size,
      readable: false,
      tables_present: [] as string[],
      tables_missing: REQUIRED_TABLES,
      indexes_present: [] as string[],
      indexes_missing: REQUIRED_INDEXES,
      error: 'database file is empty',
    }
  }

  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true })
    try {
      const tablesPresent = REQUIRED_TABLES.filter((table) => objectExists(db, 'table', table))
      const indexesPresent = REQUIRED_INDEXES.filter((index) => objectExists(db, 'index', index))
      return {
        db_exists: true,
        db_path: dbPath,
        db_size_bytes: dbStat.size,
        readable: true,
        tables_present: tablesPresent,
        tables_missing: REQUIRED_TABLES.filter((table) => !tablesPresent.includes(table)),
        indexes_present: indexesPresent,
        indexes_missing: REQUIRED_INDEXES.filter((index) => !indexesPresent.includes(index)),
        error: null,
      }
    } finally {
      db.close()
    }
  } catch (error) {
    return {
      db_exists: true,
      db_path: dbPath,
      db_size_bytes: dbStat.size,
      readable: false,
      tables_present: [] as string[],
      tables_missing: REQUIRED_TABLES,
      indexes_present: [] as string[],
      indexes_missing: REQUIRED_INDEXES,
      error: error instanceof Error ? error.message.slice(0, 300) : 'database open failed',
    }
  }
}

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  const db = inspectDatabase(config.dbPath)
  const migrationReady = existsSync(MIGRATION_PATH)
  const testScriptReady = existsSync(TEST_SCRIPT_PATH)
  const tablesReady = db.tables_missing.length === 0
  const indexesReady = db.indexes_missing.length === 0
  const persistenceReady = db.readable && tablesReady && indexesReady

  return NextResponse.json({
    ok: true,
    mode: 'approval_audit_readiness_read_only',
    generated_at: new Date().toISOString(),
    no_execution_enabled: true,
    no_connector_writes_enabled: true,
    no_fake_approval_requests: true,
    production_migration_applied: persistenceReady,
    current_state: persistenceReady ? 'PERSISTENCE_READY_EXECUTION_STILL_LOCKED' : 'MIGRATION_NOT_APPLIED',
    approval_queue_state: persistenceReady ? 'backend_tables_present' : 'backend_required',
    db,
    migration: {
      proposed_sql_path: 'docs/migrations/proposed-bridge-approval-audit-20260429.sql',
      proposed_sql_present: migrationReady,
      temp_db_test_script_path: 'scripts/test-bridge-approval-migration.sh',
      temp_db_test_script_present: testScriptReady,
      production_apply_requires_owner_approval: !persistenceReady,
      production_apply_command_later: 'sqlite3 /home/tony/mission-control/.data/mission-control.db < /home/tony/mission-control/docs/migrations/proposed-bridge-approval-audit-20260429.sql',
      temp_db_test_command_now: 'MISSION_CONTROL_DB_PATH=/home/tony/mission-control/.data/mission-control.db bash /home/tony/mission-control/scripts/test-bridge-approval-migration.sh',
    },
    required_tables: REQUIRED_TABLES,
    required_indexes: REQUIRED_INDEXES,
    dependencies: {
      bridge_preflight: '/api/bridge/preflight',
      approval_contract: '/api/bridge/approval-contract',
      approval_requests_queue: '/api/bridge/approval-requests',
      button_contracts: '/api/bridge/button-contracts',
    },
    next_action: persistenceReady
      ? 'Keep protected execution locked until owner explicitly approves scoped connector execution.'
      : 'Owner approval is required before applying the approval/audit migration to production. Until then, approval queue stays backend-required.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
