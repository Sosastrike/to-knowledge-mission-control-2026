import { describe, expect, it } from 'vitest'
import {
  BUILDWIKI_TARGET_SERVICE,
  buildBuildWikiStatus,
  evaluateRunNowGate,
} from '../buildwiki-status.js'

describe('buildBuildWikiStatus — exact target service', () => {
  it('hard-codes the spec service name', () => {
    const out = buildBuildWikiStatus(null)
    expect(out.service_name).toBe('opencloud-docs-farmer.service')
    expect(BUILDWIKI_TARGET_SERVICE).toBe('opencloud-docs-farmer.service')
  })

  it('always reports run_now_requires_owner_approval=true', () => {
    expect(buildBuildWikiStatus(null).run_now_requires_owner_approval).toBe(true)
  })
})

describe('buildBuildWikiStatus — UI states', () => {
  it('OWNER_GATED while approval is pending', () => {
    const out = buildBuildWikiStatus({
      telegram: { id: 't1', status: 'pending', run_status: null, run_exit_code: null, run_summary: null },
    })
    expect(out.status).toBe('OWNER_GATED')
    expect(out.ui_state).toBe('pending_approval')
    expect(out.next_action).toMatch(/Telegram/)
  })

  it('LIVE while a run is in progress', () => {
    const out = buildBuildWikiStatus({
      telegram: { id: 't2', status: 'approved', run_status: 'running', run_exit_code: null, run_summary: null },
    })
    expect(out.status).toBe('LIVE')
    expect(out.ui_state).toBe('running')
  })

  it('READY when last run completed', () => {
    const out = buildBuildWikiStatus({
      telegram: { id: 't3', status: 'approved', run_status: 'completed', run_exit_code: 0, run_summary: 'ok' },
    })
    expect(out.status).toBe('READY')
    expect(out.ui_state).toBe('completed')
  })

  it('BLOCKED on denied/expired/failed states', () => {
    const denied = buildBuildWikiStatus({
      telegram: { id: 'd1', status: 'denied', run_status: null, run_exit_code: null, run_summary: null },
    })
    expect(denied.status).toBe('BLOCKED')
    expect(denied.ui_state).toBe('denied')

    const expired = buildBuildWikiStatus({
      telegram: { id: 'd2', status: 'expired', run_status: null, run_exit_code: null, run_summary: null },
    })
    expect(expired.status).toBe('BLOCKED')
    expect(expired.ui_state).toBe('expired')
  })

  it('READ_ONLY when only systemd info is present and unit is inactive', () => {
    const out = buildBuildWikiStatus({
      systemd: { active_state: 'inactive', sub_state: 'dead', timer_active: true, last_run_finished_at: '2026-05-08T01:00:00Z', last_run_exit_code: 0 },
    })
    expect(out.status).toBe('READ_ONLY')
    expect(out.service_running).toBe(false)
    expect(out.timer_active).toBe(true)
  })

  it('redacts run_summary text in blocker output', () => {
    const out = buildBuildWikiStatus({
      telegram: {
        id: 'd3',
        status: 'approved',
        run_status: 'failed',
        run_exit_code: 2,
        run_summary: 'failed with FIRECRAWL_API_KEY=fc-secret-token at /home/tony/mission-control/run.log',
      },
    })
    expect(out.status).toBe('BLOCKED')
    expect(out.blocker).not.toContain('fc-secret-token')
    expect(out.blocker).not.toContain('/home/tony')
  })
})

describe('evaluateRunNowGate', () => {
  it('disabled when global execution is off', () => {
    const out = evaluateRunNowGate({
      global_execution_enabled: false,
      bridge: { approval_persistence_ready: true, runner_available: true },
      telegram: null,
    })
    expect(out.run_now_button_enabled).toBe(false)
    expect(out.reason).toMatch(/execution is disabled/)
  })

  it('disabled when approval persistence is not ready', () => {
    const out = evaluateRunNowGate({
      global_execution_enabled: true,
      bridge: { approval_persistence_ready: false, runner_available: true },
      telegram: null,
    })
    expect(out.run_now_button_enabled).toBe(false)
    expect(out.reason).toMatch(/persistence/)
  })

  it('disabled when a request is already pending', () => {
    const out = evaluateRunNowGate({
      global_execution_enabled: true,
      bridge: { approval_persistence_ready: true, runner_available: true },
      telegram: { id: 't1', status: 'pending', run_status: null, run_exit_code: null, run_summary: null },
    })
    expect(out.run_now_button_enabled).toBe(false)
    expect(out.reason).toMatch(/pending/)
  })

  it('disabled when a run is currently running', () => {
    const out = evaluateRunNowGate({
      global_execution_enabled: true,
      bridge: { approval_persistence_ready: true, runner_available: true },
      telegram: { id: 't1', status: 'approved', run_status: 'running', run_exit_code: null, run_summary: null },
    })
    expect(out.run_now_button_enabled).toBe(false)
  })

  it('enabled when no outstanding request and bridge ready', () => {
    const out = evaluateRunNowGate({
      global_execution_enabled: true,
      bridge: { approval_persistence_ready: true, runner_available: true },
      telegram: null,
    })
    expect(out.run_now_button_enabled).toBe(true)
  })
})
