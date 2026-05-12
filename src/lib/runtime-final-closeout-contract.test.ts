import { describe, expect, it } from 'vitest'
import {
  REQUIRED_RUNTIME_CLOSEOUT_LANES,
  buildRuntimeFinalCloseoutReport,
} from './runtime-final-closeout-contract'

describe('runtime final closeout contract', () => {
  it('requires every runtime/deployment/security lane from Days 63-71', () => {
    expect(REQUIRED_RUNTIME_CLOSEOUT_LANES.map((lane) => lane.id)).toEqual([
      'deployment_pipeline',
      'runtime_health_dashboard',
      'protected_route_smoke',
      'authenticated_route_smoke',
      'secret_scan',
      'raw_path_public_exposure',
      'rollback_plan',
      'monitoring_failure_states',
      'restart_proof',
    ])
  })

  it('passes when all developer-side runtime artifacts are clean and owner-auth remains truthfully gated', () => {
    const report = buildRuntimeFinalCloseoutReport({
      checked_at: '2026-05-12T00:00:00.000Z',
      source_commit: 'abc1234',
      source_branch: 'to-knowledge-mc',
      artifacts: {
        deployment_pipeline: { ok: true, failures: [] },
        runtime_health_dashboard: { ok: true, status: 'LIVE', blockers: [] },
        protected_route_smoke: { ok: true, routes_checked: 41, failures: [] },
        authenticated_route_smoke: {
          ok: true,
          blocker_class: 'OWNER_GATED',
          authenticated_smoke_proven: false,
          owner_visual_proof_claimed: false,
          blocker: 'owner_authenticated_browser_session_required',
          failures: [],
        },
        secret_scan: { ok: true, blocker_class: 'NONE', blockers: [] },
        raw_path_public_exposure: { ok: true, blocker_class: 'NONE', blockers: [] },
        rollback_plan: { ok: true, blocker_class: 'NONE', missing_rollback_reports: [] },
        monitoring_failure_states: {
          ok: true,
          no_fake_live_status: true,
          no_external_writes_executed: true,
          summary: {
            surfaces_checked: 16,
          },
        },
        restart_proof: { ok: true, blocker_class: 'NONE', failures: [] },
      },
    })

    expect(report.ok).toBe(true)
    expect(report.blocker_class).toBe('OWNER_GATED')
    expect(report.status).toBe('PARTIAL GO')
    expect(report.owner_gated_lanes).toEqual(['authenticated_route_smoke'])
    expect(report.failures).toEqual([])
  })

  it('blocks final runtime closeout when a required artifact fails', () => {
    const report = buildRuntimeFinalCloseoutReport({
      checked_at: '2026-05-12T00:00:00.000Z',
      source_commit: 'abc1234',
      source_branch: 'to-knowledge-mc',
      artifacts: {
        deployment_pipeline: { ok: false, failures: [{ check: 'listener', error: 'missing' }] },
        runtime_health_dashboard: { ok: true, status: 'LIVE', blockers: [] },
        protected_route_smoke: { ok: true, routes_checked: 41, failures: [] },
        authenticated_route_smoke: { ok: true, blocker_class: 'OWNER_GATED', authenticated_smoke_proven: false, owner_visual_proof_claimed: false, failures: [] },
        secret_scan: { ok: true, blocker_class: 'NONE', blockers: [] },
        raw_path_public_exposure: { ok: true, blocker_class: 'NONE', blockers: [] },
        rollback_plan: { ok: true, blocker_class: 'NONE', missing_rollback_reports: [] },
        monitoring_failure_states: { ok: true, no_fake_live_status: true, no_external_writes_executed: true, summary: { surfaces_checked: 16 } },
        restart_proof: { ok: true, blocker_class: 'NONE', failures: [] },
      },
    })

    expect(report.ok).toBe(false)
    expect(report.blocker_class).toBe('BLOCKED')
    expect(report.status).toBe('BLOCKED')
    expect(report.failures).toEqual([
      expect.objectContaining({ lane: 'deployment_pipeline' }),
    ])
  })

  it('does not allow authenticated owner visual proof to be claimed without proof', () => {
    const report = buildRuntimeFinalCloseoutReport({
      checked_at: '2026-05-12T00:00:00.000Z',
      source_commit: 'abc1234',
      source_branch: 'to-knowledge-mc',
      artifacts: {
        deployment_pipeline: { ok: true, failures: [] },
        runtime_health_dashboard: { ok: true, status: 'LIVE', blockers: [] },
        protected_route_smoke: { ok: true, routes_checked: 41, failures: [] },
        authenticated_route_smoke: {
          ok: true,
          blocker_class: 'NONE',
          authenticated_smoke_proven: false,
          owner_visual_proof_claimed: true,
          failures: [],
        },
        secret_scan: { ok: true, blocker_class: 'NONE', blockers: [] },
        raw_path_public_exposure: { ok: true, blocker_class: 'NONE', blockers: [] },
        rollback_plan: { ok: true, blocker_class: 'NONE', missing_rollback_reports: [] },
        monitoring_failure_states: { ok: true, no_fake_live_status: true, no_external_writes_executed: true, summary: { surfaces_checked: 16 } },
        restart_proof: { ok: true, blocker_class: 'NONE', failures: [] },
      },
    })

    expect(report.ok).toBe(false)
    expect(report.failures).toEqual([
      expect.objectContaining({
        lane: 'authenticated_route_smoke',
        reason: 'owner_visual_proof_claimed_without_authenticated_smoke',
      }),
    ])
  })
})
