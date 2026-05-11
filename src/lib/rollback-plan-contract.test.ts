import { describe, expect, it } from 'vitest'
import {
  CORE_ROLLBACK_LANES,
  buildRollbackPlanReport,
  checkRollbackText,
} from '../../scripts/rollback-plan-contract.mjs'

const buildReport = buildRollbackPlanReport as unknown as (input: Record<string, unknown>) => Record<string, any>
const checkText = checkRollbackText as unknown as (path: string, text: string) => Record<string, any>

describe('rollback plan contract', () => {
  it('covers all primary Mission Control / Gateway closure lanes', () => {
    expect(CORE_ROLLBACK_LANES.map((lane) => lane.id)).toEqual(expect.arrayContaining([
      'mission-control',
      'gateway-agent-hub',
      'agent-zero',
      'hermes',
      'pi',
      'spaceagent',
      'paperclip',
      'openclaw-plus',
      'bridge-session',
      'buildwiki-farmer',
      'delivery-connectors',
      'brain',
      'runtime-deployment',
      'security',
      'ux',
    ]))
  })

  it('accepts closeout text with an explicit rollback command', () => {
    const result = checkText('runtime/day-99-example.md', [
      '# Example',
      'Rollback:',
      'git revert abc1234',
    ].join('\n'))

    expect(result.ok).toBe(true)
    expect(result.reason).toBe('rollback_present')
  })

  it('rejects closeout text that does not include rollback guidance', () => {
    const result = checkText('runtime/day-99-example.md', '# Example\nNo rollback here.')

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('rollback_missing')
  })

  it('builds a blocking report when any required closeout lacks rollback guidance', () => {
    const report = buildReport({
      checked_at: '2026-05-11T00:00:00.000Z',
      closeout_results: [
        { path: 'runtime/day-63-runtime.md', ok: true, reason: 'rollback_present' },
        { path: 'runtime/day-64-runtime.md', ok: false, reason: 'rollback_missing' },
      ],
    })

    expect(report.ok).toBe(false)
    expect(report.blocker_class).toBe('BLOCKED')
    expect(report.missing_rollback_reports).toEqual([
      expect.objectContaining({ path: 'runtime/day-64-runtime.md' }),
    ])
  })

  it('passes when all checked closeouts have rollback guidance', () => {
    const report = buildReport({
      checked_at: '2026-05-11T00:00:00.000Z',
      closeout_results: [
        { path: 'runtime/day-63-runtime.md', ok: true, reason: 'rollback_present' },
      ],
    })

    expect(report.ok).toBe(true)
    expect(report.blocker_class).toBe('NONE')
    expect(report.rollback_values_printed).toBe(false)
  })
})
