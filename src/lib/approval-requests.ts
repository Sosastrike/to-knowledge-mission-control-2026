import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'

export type ApprovalState = 'pending' | 'approved' | 'denied'

export type ApprovalRequest = {
  id: string
  connector: string
  action: string
  target: string
  target_key: string
  requester: string
  risk_level: 'low' | 'medium' | 'high'
  approval_state: ApprovalState
  protected_category: string
  reason: string
  required_approver: 'owner'
  execution_enabled: false
  accepted_for_execution: false
  credential_values_exposed: false
  external_writes_enabled: false
  approval_scope: Record<string, unknown>
  idempotency_key: string | null
  correlation_id: string
  created_at: string
  updated_at: string
  resolved_at: string | null
  resolved_by: string | null
  history: Array<{
    at: string
    action: string
    actor: string
    note: string
  }>
}

type ApprovalInput = Record<string, unknown>

const storePath = join(config.dataDir, 'approval-requests.json')
const globalKey = '__missionControlApprovalRequests'

function globalStore(): ApprovalRequest[] {
  const globalWithStore = globalThis as typeof globalThis & { [globalKey]?: ApprovalRequest[] }
  if (!globalWithStore[globalKey]) globalWithStore[globalKey] = []
  return globalWithStore[globalKey]
}

function setGlobalStore(rows: ApprovalRequest[]) {
  const globalWithStore = globalThis as typeof globalThis & { [globalKey]?: ApprovalRequest[] }
  globalWithStore[globalKey] = rows
}

function readDiskStore(): ApprovalRequest[] | null {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return null
  }
}

function writeDiskStore(rows: ApprovalRequest[]) {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function loadStore(): ApprovalRequest[] {
  const disk = readDiskStore()
  if (disk) {
    setGlobalStore(disk)
    return disk
  }
  return globalStore()
}

function saveStore(rows: ApprovalRequest[]) {
  setGlobalStore(rows)
  try {
    writeDiskStore(rows)
  } catch {
    // Keep the approval UI functional on read-only deployments. The response
    // still reports the actual persistence mode so it cannot be mistaken for
    // a durable production queue.
  }
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : fallback
}

function asRisk(value: unknown): ApprovalRequest['risk_level'] {
  const risk = asString(value, 'high').toLowerCase()
  return risk === 'low' || risk === 'medium' || risk === 'high' ? risk : 'high'
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function listApprovalRequests() {
  return loadStore().sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getApprovalRequest(id: string) {
  return loadStore().find((request) => request.id === id) || null
}

export function createApprovalRequest(input: ApprovalInput) {
  const rows = loadStore()
  const idempotencyKey = asString(input.idempotency_key, '')
  const existing = idempotencyKey
    ? rows.find((request) => request.idempotency_key === idempotencyKey)
    : null
  if (existing) return { request: existing, created: false }

  const now = new Date().toISOString()
  const connector = asString(input.connector, 'skills')
  const action = asString(input.action, 'protected_action')
  const target = asString(input.target, asString(input.skill_id, asString(input.name, action)))
  const requester = asString(input.requester, asString(input.owner_username, 'owner'))
  const reason = asString(input.reason, `${action} on ${target} requires owner approval.`)
  const request: ApprovalRequest = {
    id: `apr_${randomUUID()}`,
    connector,
    action,
    target,
    target_key: asString(input.target_key, target || action),
    requester,
    risk_level: asRisk(input.risk_level),
    approval_state: 'pending',
    protected_category: asString(input.protected_category, connector),
    reason,
    required_approver: 'owner',
    execution_enabled: false,
    accepted_for_execution: false,
    credential_values_exposed: false,
    external_writes_enabled: false,
    approval_scope: asObject(input.approval_scope),
    idempotency_key: idempotencyKey || null,
    correlation_id: asString(input.correlation_id, `corr_${randomUUID()}`),
    created_at: now,
    updated_at: now,
    resolved_at: null,
    resolved_by: null,
    history: [{
      at: now,
      action: 'approval_requested',
      actor: requester,
      note: 'Request recorded. Protected execution remains disabled.',
    }],
  }

  saveStore([request, ...rows])
  return { request, created: true }
}

export function resolveApprovalRequest(id: string, state: Exclude<ApprovalState, 'pending'>, actor: string, note = '') {
  const rows = loadStore()
  const existing = rows.find((request) => request.id === id)
  if (!existing) return null

  const now = new Date().toISOString()
  const resolved: ApprovalRequest = {
    ...existing,
    approval_state: state,
    updated_at: now,
    resolved_at: now,
    resolved_by: actor,
    history: [
      ...existing.history,
      {
        at: now,
        action: state === 'approved' ? 'approval_approved' : 'approval_denied',
        actor,
        note: note || (state === 'approved'
          ? 'Owner approved the request record. Execution runner is still disabled.'
          : 'Owner denied the request.'),
      },
    ],
  }

  saveStore(rows.map((request) => (request.id === id ? resolved : request)))
  return resolved
}

export function approvalSummary(rows = listApprovalRequests()) {
  return rows.reduce((acc, request) => {
    acc.total += 1
    acc[request.approval_state] += 1
    return acc
  }, { total: 0, pending: 0, approved: 0, denied: 0 })
}

export function approvalPersistenceMode() {
  return readDiskStore() ? 'disk' : 'memory'
}
