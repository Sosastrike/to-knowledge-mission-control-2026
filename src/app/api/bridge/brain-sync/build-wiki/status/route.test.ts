import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authJson: vi.fn(),
  execFileSync: vi.fn(),
  dbPath: '/tmp/nonexistent-buildwiki-status-test.db',
}))

vi.mock('@/lib/designer-module-api', () => ({
  authJson: mocks.authJson,
}))

vi.mock('@/lib/config', () => ({
  config: {
    get dbPath() {
      return mocks.dbPath
    },
  },
}))

vi.mock('@/lib/build-wiki-telegram-run-now', () => ({
  readLatestTelegramBuildWikiRunNowApproval: vi.fn(async () => null),
}))

vi.mock('node:child_process', () => ({
  default: {
    execFileSync: mocks.execFileSync,
    execFile: vi.fn(),
  },
  execFile: vi.fn(),
  execFileSync: mocks.execFileSync,
}))

import { GET } from './route'

function request() {
  return new Request('http://mission-control.test/api/bridge/brain-sync/build-wiki/status', {
    method: 'GET',
  }) as NextRequest
}

describe('Build-Wiki status route service probe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authJson.mockReturnValue(null)
    mocks.execFileSync.mockImplementation(() => {
      throw new Error('systemctl unavailable in test runtime')
    })
  })

  it('returns a safe service probe even when systemctl and registry data are unavailable', async () => {
    const response = await GET(request())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.service_probe).toMatchObject({
      systemctl_available: false,
      blocker: 'systemctl_command_not_found_in_local_runtime',
      service_unit: 'opencloud-docs-farmer.service',
      timer_unit: 'opencloud-docs-farmer.timer',
      timer_active: false,
      service_active_state: 'unknown',
      last_result: 'unknown',
    })
    expect(payload.notices).toMatchObject({
      no_secret_exposure: true,
      no_env_writes: true,
      single_vault: true,
      run_now_dispatch_scope: 'opencloud-docs-farmer.service',
    })
    expect(payload.run_now).toMatchObject({
      history: [],
      history_count: 0,
    })
    expect(JSON.stringify(payload)).not.toMatch(/\/home\/|\/Users\/|sk-[A-Za-z0-9]{20,}|Bearer\s+/)
  })
})
