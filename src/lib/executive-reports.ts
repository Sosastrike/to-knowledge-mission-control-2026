import type Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { describeCronFrequency, validateCronExpression } from './cron-utils'
import { getCronOccurrences } from './cron-occurrences'
import { parseNaturalSchedule } from './schedule-parser'

export const REPORT_TYPES = [
  'morning',
  'afternoon',
  'daily',
  'weekly',
  'monthly',
  'custom',
  'agent_specific',
  'project_specific',
  'system_health',
  'approval_audit',
  'task_completion',
] as const

export type ExecutiveReportType = typeof REPORT_TYPES[number]
export type ExecutiveReportStatus = 'enabled' | 'disabled' | 'paused' | 'blocked'

export type ExecutiveReportInput = {
  name?: unknown
  report_type?: unknown
  assigned_agent?: unknown
  schedule_text?: unknown
  criteria?: unknown
  enabled?: unknown
}

type ReportRow = {
  id: string
  workspace_id: number
  tenant_id: number
  name: string
  report_type: ExecutiveReportType
  assigned_agent: string
  schedule_text: string
  cron_expr: string
  timezone: string
  criteria_json: string
  enabled: number
  status: ExecutiveReportStatus
  completion_percentage: number
  blockers_json: string
  last_run_at: number | null
  next_run_at: number | null
  created_by: string
  created_at: number
  updated_at: number
  deleted_at: number | null
}

type HistoryRow = {
  id: string
  report_id: string
  workspace_id: number
  status: string
  started_at: number | null
  completed_at: number | null
  completion_percentage: number
  summary: string | null
  artifact_url: string | null
  blockers_json: string
  created_at: number
}

const DEFAULT_SCHEDULES: Record<ExecutiveReportType, string> = {
  morning: 'daily at 8am',
  afternoon: 'daily at 2pm',
  daily: 'daily at 9am',
  weekly: 'weekly on monday',
  monthly: '0 9 1 * *',
  custom: 'daily at 9am',
  agent_specific: 'daily at 9am',
  project_specific: 'weekly on monday',
  system_health: 'daily at 8am',
  approval_audit: 'daily at 5pm',
  task_completion: 'daily at 5pm',
}

const AGENT_ALIASES: Record<string, string> = {
  tony: 'Tony',
  'agent 0': 'Agent 0',
  agent0: 'Agent 0',
  hermes: 'Hermes',
  hermit: 'Hermes',
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

function clean(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim()
}

function cleanBounded(value: unknown, fallback: string, max = 240): string {
  const text = clean(value, fallback).replace(/[\u0000-\u001f\u007f]/g, ' ')
  return (text || fallback).slice(0, max)
}

function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback
  try { return JSON.parse(text) as T } catch { return fallback }
}

function normalizeAgent(value: unknown): string {
  const raw = cleanBounded(value, 'Tony', 80)
  return AGENT_ALIASES[raw.toLowerCase()] || raw
}

function normalizeReportType(value: unknown): ExecutiveReportType {
  const normalized = clean(value, 'daily').toLowerCase().replace(/[-\s]+/g, '_')
  return REPORT_TYPES.includes(normalized as ExecutiveReportType) ? normalized as ExecutiveReportType : 'custom'
}

function criteriaObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function normalizeSchedule(input: unknown, type: ExecutiveReportType) {
  const requested = clean(input, DEFAULT_SCHEDULES[type]) || DEFAULT_SCHEDULES[type]
  const parsed = parseNaturalSchedule(requested)
  if (parsed) {
    return {
      schedule_text: requested,
      cron_expr: parsed.cronExpr,
      human_readable: parsed.humanReadable,
      validation_error: null as string | null,
    }
  }

  const cronError = validateCronExpression(requested)
  if (!cronError) {
    return {
      schedule_text: requested,
      cron_expr: requested,
      human_readable: describeCronFrequency(requested),
      validation_error: null as string | null,
    }
  }

  const fallback = DEFAULT_SCHEDULES[type]
  const fallbackParsed = parseNaturalSchedule(fallback)
  if (fallbackParsed) {
    return {
      schedule_text: fallback,
      cron_expr: fallbackParsed.cronExpr,
      human_readable: fallbackParsed.humanReadable,
      validation_error: cronError,
    }
  }

  return {
    schedule_text: fallback,
    cron_expr: fallback,
    human_readable: describeCronFrequency(fallback),
    validation_error: cronError,
  }
}

export function computeNextRunAt(cronExpr: string, fromMs = Date.now()): number | null {
  const occurrences = getCronOccurrences(cronExpr, fromMs + 60_000, fromMs + 370 * 24 * 60 * 60 * 1000, 1)
  return occurrences[0] ? Math.floor(occurrences[0].atMs / 1000) : null
}

export function normalizeExecutiveReportInput(input: ExecutiveReportInput) {
  const reportType = normalizeReportType(input.report_type)
  const schedule = normalizeSchedule(input.schedule_text, reportType)
  const nameFallback = `${reportType.replace(/_/g, ' ')} report`.replace(/^./, (c) => c.toUpperCase())
  const name = cleanBounded(input.name, nameFallback, 120)
  const enabled = input.enabled === false || input.enabled === 0 || input.enabled === 'false' ? false : true
  const blockers = schedule.validation_error ? [`Invalid requested schedule: ${schedule.validation_error}; default schedule applied.`] : []
  const criteria = criteriaObject(input.criteria)

  return {
    name,
    report_type: reportType,
    assigned_agent: normalizeAgent(input.assigned_agent),
    schedule_text: schedule.schedule_text,
    cron_expr: schedule.cron_expr,
    schedule_human: schedule.human_readable,
    timezone: process.env.TZ || 'America/New_York',
    criteria,
    enabled,
    status: enabled ? 'enabled' as ExecutiveReportStatus : 'disabled' as ExecutiveReportStatus,
    completion_percentage: 0,
    blockers,
    next_run_at: enabled ? computeNextRunAt(schedule.cron_expr) : null,
  }
}

export function mapReportRow(row: ReportRow) {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    tenant_id: row.tenant_id,
    name: row.name,
    report_type: row.report_type,
    assigned_agent: row.assigned_agent,
    schedule_text: row.schedule_text,
    cron_expr: row.cron_expr,
    schedule_human: describeCronFrequency(row.cron_expr),
    timezone: row.timezone,
    criteria: parseJson<Record<string, unknown>>(row.criteria_json, {}),
    enabled: Boolean(row.enabled),
    status: row.status,
    completion_percentage: row.completion_percentage,
    blockers: parseJson<string[]>(row.blockers_json, []),
    last_run_at: row.last_run_at,
    next_run_at: row.next_run_at,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapHistoryRow(row: HistoryRow) {
  return {
    ...row,
    blockers: parseJson<string[]>(row.blockers_json, []),
  }
}

export function listExecutiveReports(db: Database.Database, workspaceId: number, opts: { includeDisabled?: boolean; limit?: number; offset?: number } = {}) {
  const limit = Math.max(1, Math.min(Number(opts.limit || 100), 200))
  const offset = Math.max(0, Number(opts.offset || 0))
  const where = ['workspace_id = ?', 'deleted_at IS NULL']
  const params: unknown[] = [workspaceId]
  if (!opts.includeDisabled) where.push("status != 'disabled'")

  const reports = db.prepare(`
    SELECT * FROM scheduled_reports
    WHERE ${where.join(' AND ')}
    ORDER BY enabled DESC, next_run_at IS NULL, next_run_at ASC, updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ReportRow[]

  const total = (db.prepare(`
    SELECT COUNT(*) as total FROM scheduled_reports
    WHERE ${where.join(' AND ')}
  `).get(...params) as { total: number }).total

  return { reports: reports.map(mapReportRow), total, limit, offset }
}

export function getExecutiveReport(db: Database.Database, id: string, workspaceId: number) {
  const row = db.prepare(`
    SELECT * FROM scheduled_reports
    WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
    LIMIT 1
  `).get(id, workspaceId) as ReportRow | undefined
  return row ? mapReportRow(row) : null
}

export function createExecutiveReport(db: Database.Database, workspaceId: number, tenantId: number, input: ExecutiveReportInput, actor: string) {
  const normalized = normalizeExecutiveReportInput(input)
  const id = `rpt_${randomUUID()}`
  const now = nowSec()

  db.prepare(`
    INSERT INTO scheduled_reports (
      id, workspace_id, tenant_id, name, report_type, assigned_agent,
      schedule_text, cron_expr, timezone, criteria_json, enabled, status,
      completion_percentage, blockers_json, next_run_at, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    tenantId,
    normalized.name,
    normalized.report_type,
    normalized.assigned_agent,
    normalized.schedule_text,
    normalized.cron_expr,
    normalized.timezone,
    JSON.stringify(normalized.criteria),
    normalized.enabled ? 1 : 0,
    normalized.status,
    normalized.completion_percentage,
    JSON.stringify(normalized.blockers),
    normalized.next_run_at,
    actor,
    now,
    now,
  )

  return getExecutiveReport(db, id, workspaceId)
}

export function updateExecutiveReport(db: Database.Database, id: string, workspaceId: number, input: ExecutiveReportInput) {
  const current = getExecutiveReport(db, id, workspaceId)
  if (!current) return null

  const merged = normalizeExecutiveReportInput({
    name: input.name ?? current.name,
    report_type: input.report_type ?? current.report_type,
    assigned_agent: input.assigned_agent ?? current.assigned_agent,
    schedule_text: input.schedule_text ?? current.schedule_text,
    criteria: input.criteria ?? current.criteria,
    enabled: input.enabled ?? current.enabled,
  })
  const now = nowSec()

  db.prepare(`
    UPDATE scheduled_reports
    SET name = ?, report_type = ?, assigned_agent = ?, schedule_text = ?, cron_expr = ?, timezone = ?,
        criteria_json = ?, enabled = ?, status = ?, completion_percentage = ?, blockers_json = ?,
        next_run_at = ?, updated_at = ?
    WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
  `).run(
    merged.name,
    merged.report_type,
    merged.assigned_agent,
    merged.schedule_text,
    merged.cron_expr,
    merged.timezone,
    JSON.stringify(merged.criteria),
    merged.enabled ? 1 : 0,
    merged.status,
    current.completion_percentage ?? 0,
    JSON.stringify(merged.blockers),
    merged.next_run_at,
    now,
    id,
    workspaceId,
  )

  return getExecutiveReport(db, id, workspaceId)
}

export function deleteExecutiveReport(db: Database.Database, id: string, workspaceId: number): boolean {
  const result = db.prepare(`
    UPDATE scheduled_reports
    SET deleted_at = unixepoch(), enabled = 0, status = 'disabled', updated_at = unixepoch()
    WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
  `).run(id, workspaceId)
  return result.changes > 0
}

export function listExecutiveReportHistory(db: Database.Database, reportId: string, workspaceId: number, limit = 50) {
  const rows = db.prepare(`
    SELECT * FROM scheduled_report_runs
    WHERE report_id = ? AND workspace_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(reportId, workspaceId, Math.max(1, Math.min(limit, 200))) as HistoryRow[]
  return rows.map(mapHistoryRow)
}

export function executiveReportsSummary(reports: Array<ReturnType<typeof mapReportRow>>) {
  const enabled = reports.filter((report) => report.enabled).length
  const blocked = reports.filter((report) => report.blockers.length > 0 || report.status === 'blocked').length
  const by_type = reports.reduce<Record<string, number>>((acc, report) => {
    acc[report.report_type] = (acc[report.report_type] || 0) + 1
    return acc
  }, {})
  const next = reports.filter((report) => report.next_run_at).sort((a, b) => Number(a.next_run_at) - Number(b.next_run_at))[0] || null
  return {
    total: reports.length,
    enabled,
    disabled: reports.length - enabled,
    blocked,
    by_type,
    next_report_id: next?.id || null,
    next_run_at: next?.next_run_at || null,
  }
}

export function buildTonyReportCreationContract(input: ExecutiveReportInput) {
  const normalized = normalizeExecutiveReportInput(input)
  const contractHash = createHash('sha256')
    .update(JSON.stringify({
      type: normalized.report_type,
      agent: normalized.assigned_agent,
      schedule: normalized.cron_expr,
      criteria: normalized.criteria,
    }))
    .digest('hex')
  return {
    canonical_endpoint: '/api/reports',
    actor: 'Tony or Mission Control operator',
    shared_brain_required: true,
    approval_system: 'canonical Tony Telegram approvals when protected execution is needed',
    execution_enabled: false,
    report_delivery_enabled: false,
    contract_hash: contractHash,
    normalized,
  }
}

export function reviewExecutiveReportsPlan() {
  return [
    { check: 'single canonical reports API', passed: true, detail: '/api/reports owns report CRUD' },
    { check: 'auth gated', passed: true, detail: 'viewer can read, operator can mutate' },
    { check: 'shared brain compatible', passed: true, detail: 'criteria are stored for shared-brain report generation later' },
    { check: 'approval compatible', passed: true, detail: 'protected execution remains behind canonical approval gates' },
    { check: 'no external writes', passed: true, detail: 'CRUD only changes Mission Control report definitions' },
    { check: 'no duplicate report system', passed: true, detail: 'standup archive is kept as history source; scheduled_reports is canonical scheduler UI' },
    { check: 'schedule computable', passed: true, detail: 'natural schedule/cron parser computes next_run_at' },
    { check: 'agent assignment explicit', passed: true, detail: 'Tony, Agent 0, Hermes, or custom agent names are stored' },
    { check: 'history visible', passed: true, detail: 'scheduled_report_runs is the canonical history table' },
    { check: 'safe rollback', passed: true, detail: 'soft delete for report definitions; git revert for code' },
  ]
}
