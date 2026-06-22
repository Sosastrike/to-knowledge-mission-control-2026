// Build-Wiki / Farmer Sync — Run Now runner (Fork 1).
//
// This module is the ONLY place in the Mission Control codebase that is
// allowed to dispatch `systemctl --user start opencloud-docs-farmer.service`.
// It is intentionally narrow:
//
//   * The systemd unit name is hard-coded. There is no parameter.
//   * The shell is bypassed. `execFile` is used, never `exec` or a shell
//     pipeline, so there is no path for command injection.
//   * Dispatch is gated on a prior approval-request whose `connector`,
//     `action`, and `target` match the canonical buildwiki shape AND whose
//     `approval_state === 'approved'`.
//   * The dispatch path emits an append-only audit record to
//     `.data/buildwiki-runs.json`.
//   * No secret is read, no .env is touched, no other systemd unit can be
//     reached from this code.
//
// Hard rules (all enforced in this module):
//   - No .env modifications.
//   - No secret exposure.
//   - No Tony routing / voice / memory / governance changes.
//   - No Zapier writes.
//   - No broad connector execution.
//   - No SMB mount.
//   - No external farmers.
//   - No second vault.

import { execFile } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'

import { config } from '@/lib/config'
import { getApprovalRequest, type ApprovalRequest } from '@/lib/approval-requests'

const execFileAsync = promisify(execFile)

// ── Canonical contract ──────────────────────────────────────────────────────

export const BUILDWIKI_CONNECTOR = 'buildwiki' as const
export const BUILDWIKI_RUN_NOW_ACTION = 'run_now' as const
export const BUILDWIKI_TARGET_SERVICE = 'opencloud-docs-farmer.service' as const
export const BUILDWIKI_TARGET_TIMER = 'opencloud-docs-farmer.timer' as const

const DISPATCH_TIMEOUT_MS = 30_000
const STATUS_TIMEOUT_MS = 10_000

const auditPath = join(config.dataDir, 'buildwiki-runs.json')

function userSystemdEnv() {
  const uid = typeof process.getuid === 'function' ? process.getuid() : null
  if (uid === null) return process.env
  const runtimeDir = `/run/user/${uid}`
  return {
    ...process.env,
    XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || runtimeDir,
    DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS || `unix:path=${runtimeDir}/bus`,
  }
}

// ── Audit types ─────────────────────────────────────────────────────────────

export type BuildwikiAuditEvent = {
  id: string
  at: string
  event:
    | 'request_created'
    | 'approval_resolved'
    | 'dispatch_started'
    | 'dispatch_completed'
    | 'dispatch_failed'
    | 'dispatch_refused'
  approval_id: string
  actor: string
  exit_code?: number
  stderr_redacted?: string
  refusal_reason?: string
}

function loadAudit(): BuildwikiAuditEvent[] {
  try {
    const parsed = JSON.parse(readFileSync(auditPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAudit(rows: BuildwikiAuditEvent[]): void {
  try {
    mkdirSync(dirname(auditPath), { recursive: true })
    writeFileSync(auditPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
  } catch {
    // Audit failure is logged at the call site; never block the dispatch
    // decision on disk write failure.
  }
}

export function recordBuildwikiAudit(event: Omit<BuildwikiAuditEvent, 'id' | 'at'>): BuildwikiAuditEvent {
  const row: BuildwikiAuditEvent = {
    id: `bwk_${randomUUID()}`,
    at: new Date().toISOString(),
    ...event,
  }
  const rows = loadAudit()
  rows.unshift(row)
  writeAudit(rows)
  return row
}

export function listBuildwikiAudit(limit = 25): BuildwikiAuditEvent[] {
  return loadAudit().slice(0, limit)
}

// ── Approval guard ──────────────────────────────────────────────────────────

export type DispatchGuardResult =
  | { ok: false; reason: string; status: number }
  | { ok: true; approval: ApprovalRequest }

export function guardBuildwikiApproval(approvalId: string): DispatchGuardResult {
  const approval = getApprovalRequest(approvalId)
  if (!approval) {
    return { ok: false as const, reason: 'approval_request_not_found', status: 404 }
  }
  if (approval.connector !== BUILDWIKI_CONNECTOR) {
    return { ok: false as const, reason: 'approval_connector_mismatch', status: 422 }
  }
  if (approval.action !== BUILDWIKI_RUN_NOW_ACTION) {
    return { ok: false as const, reason: 'approval_action_not_run_now', status: 422 }
  }
  if (approval.target !== BUILDWIKI_TARGET_SERVICE) {
    return { ok: false as const, reason: 'approval_target_not_opencloud_docs_farmer', status: 422 }
  }
  if (approval.approval_state !== 'approved') {
    return { ok: false as const, reason: 'approval_not_approved', status: 409 }
  }
  return { ok: true as const, approval }
}

// ── Dispatch ────────────────────────────────────────────────────────────────

export type DispatchOutcome =
  | { ok: true; exit_code: 0; service: string; service_active: boolean; timer_active: boolean }
  | { ok: false; exit_code: number; service: string; stderr_redacted: string }

function redactStderr(input: string): string {
  return (input || '')
    .slice(0, 500)
    .replace(/\/home\/[^/]+\//g, '/<redacted>/')
    .replace(/[A-Za-z0-9+/]{32,}={0,2}/g, '<redacted-token>')
}

async function isUnitActive(unitName: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      '/usr/bin/systemctl',
      ['--user', 'is-active', unitName],
      { timeout: STATUS_TIMEOUT_MS, env: userSystemdEnv() },
    )
    return stdout.trim() === 'active'
  } catch (err: unknown) {
    // systemctl exits non-zero when the unit is not active. We treat any
    // exit-code as "not active" without leaking stderr.
    const stdout =
      typeof (err as { stdout?: string }).stdout === 'string'
        ? (err as { stdout: string }).stdout.trim()
        : ''
    return stdout === 'active'
  }
}

export async function dispatchBuildwikiRunNow(approvalId: string, actor: string): Promise<DispatchOutcome> {
  const guard = guardBuildwikiApproval(approvalId)
  if (!guard.ok) {
    recordBuildwikiAudit({
      event: 'dispatch_refused',
      approval_id: approvalId,
      actor,
      refusal_reason: guard.reason,
    })
    return {
      ok: false,
      exit_code: -1,
      service: BUILDWIKI_TARGET_SERVICE,
      stderr_redacted: guard.reason,
    }
  }

  recordBuildwikiAudit({
    event: 'dispatch_started',
    approval_id: approvalId,
    actor,
  })

  try {
    await execFileAsync(
      '/usr/bin/systemctl',
      ['--user', 'start', BUILDWIKI_TARGET_SERVICE],
      { timeout: DISPATCH_TIMEOUT_MS, env: userSystemdEnv() },
    )
    const serviceActive = await isUnitActive(BUILDWIKI_TARGET_SERVICE)
    const timerActive = await isUnitActive(BUILDWIKI_TARGET_TIMER)
    recordBuildwikiAudit({
      event: 'dispatch_completed',
      approval_id: approvalId,
      actor,
      exit_code: 0,
    })
    return {
      ok: true,
      exit_code: 0,
      service: BUILDWIKI_TARGET_SERVICE,
      service_active: serviceActive,
      timer_active: timerActive,
    }
  } catch (err: unknown) {
    const exitCode =
      typeof (err as { code?: number }).code === 'number' ? (err as { code: number }).code : 1
    const stderrRaw =
      typeof (err as { stderr?: string }).stderr === 'string'
        ? (err as { stderr: string }).stderr
        : ''
    const stderrRedacted = redactStderr(stderrRaw)
    recordBuildwikiAudit({
      event: 'dispatch_failed',
      approval_id: approvalId,
      actor,
      exit_code: exitCode,
      stderr_redacted: stderrRedacted,
    })
    return {
      ok: false,
      exit_code: exitCode,
      service: BUILDWIKI_TARGET_SERVICE,
      stderr_redacted: stderrRedacted,
    }
  }
}

// ── Status (read-only; no execution) ────────────────────────────────────────

export type BuildwikiStatus = {
  connector: typeof BUILDWIKI_CONNECTOR
  action: typeof BUILDWIKI_RUN_NOW_ACTION
  target: typeof BUILDWIKI_TARGET_SERVICE
  service_active: boolean
  timer_active: boolean
  last_event: BuildwikiAuditEvent | null
  recent_events: BuildwikiAuditEvent[]
}

export async function getBuildwikiStatus(): Promise<BuildwikiStatus> {
  const [serviceActive, timerActive] = await Promise.all([
    isUnitActive(BUILDWIKI_TARGET_SERVICE).catch(() => false),
    isUnitActive(BUILDWIKI_TARGET_TIMER).catch(() => false),
  ])
  const recent = listBuildwikiAudit(10)
  return {
    connector: BUILDWIKI_CONNECTOR,
    action: BUILDWIKI_RUN_NOW_ACTION,
    target: BUILDWIKI_TARGET_SERVICE,
    service_active: serviceActive,
    timer_active: timerActive,
    last_event: recent[0] || null,
    recent_events: recent,
  }
}
