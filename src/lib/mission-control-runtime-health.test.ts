import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { GET as getStaleBundleHealth } from '@/app/api/bridge/mission-control/stale-bundle-health/route'
import { buildMissionControlRuntimeHealth } from './mission-control-runtime-health'

describe('Mission Control runtime health', () => {
  it('detects a stale deleted standalone bundle without trying to restart the service', () => {
    const health = buildMissionControlRuntimeHealth({
      pid: 12345,
      processCwd: '/home/tony/mission-control/.next/standalone',
      procCwdLink: '/home/tony/mission-control/.next/standalone (deleted)',
      cwdExists: false,
      checkedAt: '2026-05-30T05:12:57.379Z',
    })

    expect(health).toMatchObject({
      status: 'STALE_BUNDLE_RESTART_REQUIRED',
      stale_next_bundle_detected: true,
      owner_action_required: true,
      owner_action: 'sudo systemctl restart mission-control.service',
      service_restart_attempted: false,
      public_exposure_changed: false,
      secrets_exposed: false,
      raw_env_values_exposed: false,
      exact_blocker: 'mission_control_service_restart_required_stale_next_bundle',
      rollback_command: 'No source rollback required for service restart; if reverting this health check use git revert <commit>.',
    })
    expect(health.cwd_summary).toEqual({
      expected_standalone_bundle: true,
      proc_cwd_contains_deleted: true,
      process_cwd_exists: false,
      path_values_redacted: true,
    })
    expect(JSON.stringify(health)).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]|mc_session|\.env/)
  })

  it('reports a current standalone bundle when cwd exists and is not deleted', () => {
    const health = buildMissionControlRuntimeHealth({
      pid: 12345,
      processCwd: '/home/tony/mission-control/.next/standalone',
      procCwdLink: '/home/tony/mission-control/.next/standalone',
      cwdExists: true,
      checkedAt: '2026-05-30T05:12:57.379Z',
    })

    expect(health).toMatchObject({
      status: 'ACTIVE_BUNDLE_CURRENT',
      stale_next_bundle_detected: false,
      owner_action_required: false,
      exact_blocker: null,
    })
  })

  it('keeps the stale bundle health route protected when unauthenticated', async () => {
    const response = await getStaleBundleHealth(new NextRequest('http://localhost/api/bridge/mission-control/stale-bundle-health'))

    expect(response.status).toBe(401)
  })
})
