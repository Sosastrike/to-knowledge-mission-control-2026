import type Database from 'better-sqlite3'
import { getDatabase } from '@/lib/db'

export type GatewayBridgeRuntimeState = 'active' | 'inactive' | 'paused' | 'restarting' | 'error'

export type GatewayBridgeRuntimeStatus = {
  ok: true
  source: 'gateway_bridge_runtime'
  generated_at: string
  runtime_id: 'gateway-runtime'
  mode: 'persistent_gateway_runtime_bridge'
  state: GatewayBridgeRuntimeState
  enabled: boolean
  autostart: boolean
  emergency_stop: boolean
  started_at: string | null
  last_heartbeat_at: string | null
  updated_at: string
  execution_enabled: boolean
  exact_blocker: string | null
  action_bridge_session_required: false
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
}

type RuntimeRow = {
  id: string
  state: GatewayBridgeRuntimeState
  enabled: number
  autostart: number
  emergency_stop: number
  started_at: string | null
  last_heartbeat_at: string | null
  updated_at: string
}

const RUNTIME_ID = 'gateway-runtime'
const SAFE_FLAGS = {
  credential_values_exposed: false,
  tokens_exposed: false,
  env_values_exposed: false,
} as const

function nowIso() {
  return new Date().toISOString()
}

export function ensureGatewayBridgeRuntimeSchema(db: Database.Database = getDatabase()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gateway_bridge_runtime (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      autostart INTEGER NOT NULL DEFAULT 1,
      emergency_stop INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      last_heartbeat_at TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gateway_bridge_runtime_audit (
      id TEXT PRIMARY KEY,
      runtime_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      result TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
  const existing = db.prepare(`SELECT id FROM gateway_bridge_runtime WHERE id = ?`).get(RUNTIME_ID)
  if (!existing) {
    const at = nowIso()
    db.prepare(`
      INSERT INTO gateway_bridge_runtime (id, state, enabled, autostart, emergency_stop, started_at, last_heartbeat_at, updated_at)
      VALUES (?, 'active', 1, 1, 0, ?, ?, ?)
    `).run(RUNTIME_ID, at, at, at)
    recordGatewayBridgeRuntimeAudit(db, 'gateway_bridge_runtime_autostarted', 'system', 'ok', 'persistent_gateway_runtime_bridge_active')
  }
}

function rowToStatus(row: RuntimeRow): GatewayBridgeRuntimeStatus {
  const executionEnabled = Boolean(row.enabled) && !Boolean(row.emergency_stop) && row.state === 'active'
  let exactBlocker: string | null = null
  if (row.emergency_stop) exactBlocker = 'gateway_bridge_runtime_emergency_stopped'
  else if (!row.enabled) exactBlocker = 'gateway_bridge_runtime_disabled'
  else if (row.state !== 'active') exactBlocker = `gateway_bridge_runtime_${row.state}`
  return {
    ok: true,
    source: 'gateway_bridge_runtime',
    generated_at: nowIso(),
    runtime_id: RUNTIME_ID,
    mode: 'persistent_gateway_runtime_bridge',
    state: row.state,
    enabled: Boolean(row.enabled),
    autostart: Boolean(row.autostart),
    emergency_stop: Boolean(row.emergency_stop),
    started_at: row.started_at,
    last_heartbeat_at: row.last_heartbeat_at,
    updated_at: row.updated_at,
    execution_enabled: executionEnabled,
    exact_blocker: exactBlocker,
    action_bridge_session_required: false,
    ...SAFE_FLAGS,
  }
}

export function getGatewayBridgeRuntimeStatus(db: Database.Database = getDatabase()): GatewayBridgeRuntimeStatus {
  ensureGatewayBridgeRuntimeSchema(db)
  const row = db.prepare(`
    SELECT id, state, enabled, autostart, emergency_stop, started_at, last_heartbeat_at, updated_at
    FROM gateway_bridge_runtime
    WHERE id = ?
  `).get(RUNTIME_ID) as RuntimeRow | undefined
  if (!row) {
    const at = nowIso()
    return {
      ok: true,
      source: 'gateway_bridge_runtime',
      generated_at: at,
      runtime_id: RUNTIME_ID,
      mode: 'persistent_gateway_runtime_bridge',
      state: 'inactive',
      enabled: false,
      autostart: true,
      emergency_stop: false,
      started_at: null,
      last_heartbeat_at: null,
      updated_at: at,
      execution_enabled: false,
      exact_blocker: 'gateway_bridge_runtime_inactive',
      action_bridge_session_required: false,
      ...SAFE_FLAGS,
    }
  }
  return rowToStatus(row)
}

function recordGatewayBridgeRuntimeAudit(db: Database.Database, action: string, actor: string, result: string, detail: string) {
  const at = nowIso()
  const id = `gbr_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
  db.prepare(`
    INSERT INTO gateway_bridge_runtime_audit (id, runtime_id, action, actor, result, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, RUNTIME_ID, action.slice(0, 120), actor.slice(0, 80), result.slice(0, 80), detail.slice(0, 220), at)
}

function updateRuntime(db: Database.Database, patch: Partial<Pick<RuntimeRow, 'state' | 'enabled' | 'emergency_stop' | 'started_at' | 'last_heartbeat_at'>>, actor: string, action: string, detail: string) {
  ensureGatewayBridgeRuntimeSchema(db)
  const current = getGatewayBridgeRuntimeStatus(db)
  const next = {
    state: patch.state ?? current.state,
    enabled: patch.enabled ?? (current.enabled ? 1 : 0),
    emergency_stop: patch.emergency_stop ?? (current.emergency_stop ? 1 : 0),
    started_at: patch.started_at === undefined ? current.started_at : patch.started_at,
    last_heartbeat_at: patch.last_heartbeat_at === undefined ? current.last_heartbeat_at : patch.last_heartbeat_at,
    updated_at: nowIso(),
  }
  db.prepare(`
    UPDATE gateway_bridge_runtime
    SET state = ?, enabled = ?, emergency_stop = ?, started_at = ?, last_heartbeat_at = ?, updated_at = ?
    WHERE id = ?
  `).run(next.state, next.enabled, next.emergency_stop, next.started_at, next.last_heartbeat_at, next.updated_at, RUNTIME_ID)
  recordGatewayBridgeRuntimeAudit(db, action, actor, 'ok', detail)
  return getGatewayBridgeRuntimeStatus(db)
}

export function enableGatewayBridgeRuntime(db: Database.Database = getDatabase(), actor = 'owner') {
  const at = nowIso()
  return updateRuntime(db, { state: 'active', enabled: 1, emergency_stop: 0, started_at: at, last_heartbeat_at: at }, actor, 'gateway_bridge_runtime_enabled', 'persistent_gateway_runtime_bridge_enabled')
}

export function disableGatewayBridgeRuntime(db: Database.Database = getDatabase(), actor = 'owner') {
  return updateRuntime(db, { state: 'paused', enabled: 0, emergency_stop: 1 }, actor, 'gateway_bridge_runtime_disabled', 'persistent_gateway_runtime_bridge_paused_by_owner')
}

export function restartGatewayBridgeRuntime(db: Database.Database = getDatabase(), actor = 'owner') {
  const at = nowIso()
  return updateRuntime(db, { state: 'active', enabled: 1, emergency_stop: 0, started_at: at, last_heartbeat_at: at }, actor, 'gateway_bridge_runtime_restarted', 'persistent_gateway_runtime_bridge_restarted')
}

export function heartbeatGatewayBridgeRuntime(db: Database.Database = getDatabase(), actor = 'runtime') {
  const at = nowIso()
  return updateRuntime(db, { state: 'active', enabled: 1, emergency_stop: 0, last_heartbeat_at: at }, actor, 'gateway_bridge_runtime_heartbeat', 'persistent_gateway_runtime_bridge_heartbeat')
}

export function gatewayBridgeRuntimeGate(db: Database.Database = getDatabase()) {
  const status = getGatewayBridgeRuntimeStatus(db)
  return {
    executionEnabled: status.execution_enabled,
    exactBlocker: status.exact_blocker,
    runtimeActive: status.execution_enabled,
    runtimeState: status.state,
    runtimeId: status.runtime_id,
    mode: status.mode,
    actionBridgeSessionRequired: false,
    ...SAFE_FLAGS,
  }
}
