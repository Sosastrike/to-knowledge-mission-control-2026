import { describe, expect, it } from 'vitest'
import {
  buildTonyReportCreationContract,
  computeNextRunAt,
  normalizeExecutiveReportInput,
  reviewExecutiveReportsPlan,
} from './executive-reports'

describe('Executive Reports / Scheduled Reports', () => {
  it('passes the required 10-review plan before implementation', () => {
    const checks = reviewExecutiveReportsPlan()
    expect(checks).toHaveLength(10)
    expect(checks.every((check) => check.passed)).toBe(true)
  })

  it('normalizes the owner decision report shape with an assigned agent and next run', () => {
    const report = normalizeExecutiveReportInput({
      name: 'Morning owner brief',
      report_type: 'morning',
      assigned_agent: 'agent0',
      schedule_text: 'daily at 8am',
      criteria: { owner_instructions: 'Summarize health and blockers.' },
    })

    expect(report.name).toBe('Morning owner brief')
    expect(report.report_type).toBe('morning')
    expect(report.assigned_agent).toBe('Agent 0')
    expect(report.cron_expr).toBe('0 8 * * *')
    expect(report.enabled).toBe(true)
    expect(report.next_run_at).toEqual(expect.any(Number))
  })

  it('falls back safely for invalid custom schedule text', () => {
    const report = normalizeExecutiveReportInput({
      report_type: 'weekly',
      schedule_text: 'not a schedule',
    })

    expect(report.cron_expr).toBe('0 9 * * 1')
    expect(report.blockers[0]).toContain('Invalid requested schedule')
  })

  it('computes the next run from a cron expression without executing a runner', () => {
    const next = computeNextRunAt('0 9 * * *', new Date('2026-05-01T10:00:00-04:00').getTime())
    expect(next).toBeGreaterThan(0)
  })

  it('exposes Tony report creation through the same canonical API contract', () => {
    const contract = buildTonyReportCreationContract({
      report_type: 'approval_audit',
      assigned_agent: 'Tony',
      schedule_text: 'daily at 5pm',
      criteria: { include: ['approvals', 'audit'] },
    })

    expect(contract.canonical_endpoint).toBe('/api/reports')
    expect(contract.shared_brain_required).toBe(true)
    expect(contract.execution_enabled).toBe(false)
    expect(contract.report_delivery_enabled).toBe(false)
    expect(contract.contract_hash).toHaveLength(64)
  })
})
