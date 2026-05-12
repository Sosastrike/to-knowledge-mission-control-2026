import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  buildMonitoringFailureStatePayload: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/monitoring-failure-states', () => ({
  buildMonitoringFailureStatePayload: mocks.buildMonitoringFailureStatePayload,
}))

import { GET } from './route'

function request(path = '/api/runtime/failure-states') {
  return new Request(`http://127.0.0.1:3337${path}`) as NextRequest
}

describe('runtime failure states route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', workspace_id: 1, tenant_id: 1 } })
    mocks.buildMonitoringFailureStatePayload.mockReturnValue({
      ok: true,
      mode: 'monitoring_failure_states',
      surfaces: [],
      no_fake_live_status: true,
      no_external_writes_executed: true,
    })
  })

  it('requires viewer auth before building the monitoring payload', async () => {
    mocks.requireRole.mockReturnValue({ error: 'unauthorized', status: 401 })

    const response = await GET(request())
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'unauthorized' })
    expect(mocks.buildMonitoringFailureStatePayload).not.toHaveBeenCalled()
  })

  it('returns the owner-safe monitoring failure-state payload with no-store caching', async () => {
    const response = await GET(request())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(payload).toMatchObject({
      ok: true,
      mode: 'monitoring_failure_states',
      no_fake_live_status: true,
      no_external_writes_executed: true,
    })
    expect(mocks.buildMonitoringFailureStatePayload).toHaveBeenCalledTimes(1)
  })
})
