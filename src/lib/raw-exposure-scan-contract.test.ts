import { describe, expect, it } from 'vitest'
import {
  buildRawExposureReport,
  classifyRawExposureFiles,
  RAW_EXPOSURE_ALLOWLIST,
} from '../../scripts/raw-exposure-scan-contract.mjs'

const buildReport = buildRawExposureReport as unknown as (input: Record<string, unknown>) => Record<string, any>
const classifyFiles = classifyRawExposureFiles as unknown as (input: string[]) => Array<Record<string, any>>

describe('raw exposure scan contract', () => {
  it('allowlists developer/test/report-harness files while flagging owner-facing source files', () => {
    const findings = classifyFiles([
      'src/lib/__tests__/paths.test.ts',
      'scripts/protected-route-smoke-contract.mjs',
      'src/app/gateway/page.tsx',
    ])

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'src/lib/__tests__/paths.test.ts',
        disposition: 'allowlisted_developer_fixture',
      }),
      expect.objectContaining({
        path: 'scripts/protected-route-smoke-contract.mjs',
        disposition: 'allowlisted_diagnostics_harness',
      }),
      expect.objectContaining({
        path: 'src/app/gateway/page.tsx',
        disposition: 'unresolved',
      }),
    ]))
  })

  it('fails when unresolved raw exposure files remain', () => {
    const report = buildReport({
      checked_at: '2026-05-11T00:00:00.000Z',
      raw_exposure_files: ['src/app/gateway/page.tsx'],
      public_exposure_files: [],
    })

    expect(report.ok).toBe(false)
    expect(report.blocker_class).toBe('BLOCKED')
    expect(report.blockers).toContain('unresolved_raw_local_path_exposure')
  })

  it('passes when only allowlisted diagnostics and fixtures match', () => {
    const report = buildReport({
      checked_at: '2026-05-11T00:00:00.000Z',
      raw_exposure_files: [...RAW_EXPOSURE_ALLOWLIST],
      public_exposure_files: [],
    })

    expect(report.ok).toBe(true)
    expect(report.blocker_class).toBe('NONE')
    expect(report.unresolved_raw_exposure_files).toEqual([])
    expect(report.values_printed).toBe(false)
  })
})
