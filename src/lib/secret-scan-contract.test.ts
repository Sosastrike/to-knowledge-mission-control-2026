import { describe, expect, it } from 'vitest'
import {
  buildSecretScanReport,
  classifySecretScanFiles,
  SECRET_SCAN_ALLOWLIST,
} from '../../scripts/secret-scan-contract.mjs'

const buildReport = buildSecretScanReport as unknown as (input: Record<string, unknown>) => Record<string, any>
const classifyFiles = classifySecretScanFiles as unknown as (input: string[]) => Array<Record<string, any>>

describe('secret scan contract', () => {
  it('allowlists only known test fixture files for high-confidence secret patterns', () => {
    const findings = classifyFiles([
      'src/lib/__tests__/scan-credentials.test.ts',
      'backend-support/src/__tests__/redact.test.ts',
      'src/app/api/runtime/route.ts',
    ])

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'src/lib/__tests__/scan-credentials.test.ts',
        disposition: 'allowlisted_test_fixture',
      }),
      expect.objectContaining({
        path: 'backend-support/src/__tests__/redact.test.ts',
        disposition: 'allowlisted_test_fixture',
      }),
      expect.objectContaining({
        path: 'src/app/api/runtime/route.ts',
        disposition: 'unresolved',
      }),
    ]))
  })

  it('fails when a non-allowlisted file has a high-confidence secret-like match', () => {
    const report = buildReport({
      checked_at: '2026-05-11T00:00:00.000Z',
      tracked_secret_files: ['src/app/api/runtime/route.ts'],
      untracked_secret_files: [],
      protected_file_report: { ok: true, protected_changes: [] },
      env_status_paths: [],
    })

    expect(report.ok).toBe(false)
    expect(report.blocker_class).toBe('BLOCKED')
    expect(report.unresolved_secret_like_files).toEqual([
      expect.objectContaining({
        path: 'src/app/api/runtime/route.ts',
        source: 'tracked',
      }),
    ])
  })

  it('passes when only allowlisted fixtures match and no protected files are changed', () => {
    const report = buildReport({
      checked_at: '2026-05-11T00:00:00.000Z',
      tracked_secret_files: [...SECRET_SCAN_ALLOWLIST],
      untracked_secret_files: [],
      protected_file_report: { ok: true, protected_changes: [] },
      env_status_paths: [],
    })

    expect(report.ok).toBe(true)
    expect(report.blocker_class).toBe('NONE')
    expect(report.unresolved_secret_like_files).toEqual([])
    expect(report.secret_values_printed).toBe(false)
  })

  it('fails when .env paths are staged or modified', () => {
    const report = buildReport({
      checked_at: '2026-05-11T00:00:00.000Z',
      tracked_secret_files: [],
      untracked_secret_files: [],
      protected_file_report: { ok: true, protected_changes: [] },
      env_status_paths: ['.env.local'],
    })

    expect(report.ok).toBe(false)
    expect(report.blocker_class).toBe('BLOCKED')
    expect(report.blockers).toContain('.env_changed_or_untracked')
  })
})
