import { describe, expect, it } from 'vitest'
import {
  buildRestartProofReport,
  hasUnsafeRestartProofText,
  isLocalOnlyBaseUrl,
} from '../../scripts/restart-proof-contract.mjs'

const buildReport = buildRestartProofReport as unknown as (input: Record<string, unknown>) => Record<string, any>

describe('restart proof contract', () => {
  it('allows only local-only proof targets by default', () => {
    expect(isLocalOnlyBaseUrl('http://127.0.0.1:3337')).toBe(true)
    expect(isLocalOnlyBaseUrl('http://localhost:3337')).toBe(true)
    expect(isLocalOnlyBaseUrl('http://0.0.0.0:3337')).toBe(false)
    expect(isLocalOnlyBaseUrl('https://tkmc.example.com')).toBe(false)
  })

  it('fails when the listener PID did not change after a restart', () => {
    const report = buildReport({
      checked_at: '2026-05-12T00:00:00.000Z',
      base_url: 'http://127.0.0.1:3337',
      source_commit: 'abc1234',
      source_branch: 'to-knowledge-mc',
      before_pid: '123',
      after_pid: '123',
      listener_pids: ['123'],
      api_auth_configured: true,
      login_probe: { status: 200, mission_control_present: true, unsafe_text_detected: false },
      runtime_health_probe: {
        status: 200,
        payload_ok: true,
        runtime_status: 'LIVE',
        bind_expected_host: '127.0.0.1',
        no_public_exposure_added: true,
        unsafe_text_detected: false,
      },
      failure_states_probe: {
        status: 200,
        payload_ok: true,
        no_fake_live_status: true,
        no_external_writes_executed: true,
        unsafe_text_detected: false,
      },
    })

    expect(report.ok).toBe(false)
    expect(report.blocker_class).toBe('BLOCKED')
    expect(report.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({ check: 'pid_changed', error: 'restart_pid_did_not_change' }),
    ]))
  })

  it('passes when the restart changed PID and local runtime probes are healthy', () => {
    const report = buildReport({
      checked_at: '2026-05-12T00:00:00.000Z',
      base_url: 'http://127.0.0.1:3337',
      source_commit: 'abc1234',
      source_branch: 'to-knowledge-mc',
      before_pid: '123',
      after_pid: '456',
      listener_pids: ['456'],
      api_auth_configured: true,
      login_probe: { status: 200, mission_control_present: true, unsafe_text_detected: false },
      runtime_health_probe: {
        status: 200,
        payload_ok: true,
        runtime_status: 'LIVE',
        bind_expected_host: '127.0.0.1',
        no_public_exposure_added: true,
        unsafe_text_detected: false,
      },
      failure_states_probe: {
        status: 200,
        payload_ok: true,
        no_fake_live_status: true,
        no_external_writes_executed: true,
        unsafe_text_detected: false,
      },
    })

    expect(report.ok).toBe(true)
    expect(report.blocker_class).toBe('NONE')
    expect(report.rollback).toContain('git revert <day-71-restart-proof-commit-sha>')
  })

  it('detects unsafe text without printing secret values', () => {
    const userPath = ['/Users', 'owner', 'private'].join('/')
    const bearer = ['Bearer', 'abcdefghijklmnop'].join(' ')
    const secret = ['sk', '12345678901234567890'].join('-')

    expect(hasUnsafeRestartProofText(`${userPath} ${bearer} ${secret}`)).toBe(true)
    expect(hasUnsafeRestartProofText('Mission Control restart proof is healthy')).toBe(false)
  })
})
