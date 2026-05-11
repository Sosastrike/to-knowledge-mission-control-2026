import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  execFileSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('node:child_process', () => ({
  default: {
    execFileSync: mocks.execFileSync,
  },
  execFileSync: mocks.execFileSync,
}))

vi.mock('node:fs', () => ({
  default: {
    existsSync: mocks.existsSync,
    readFileSync: mocks.readFileSync,
    statSync: mocks.statSync,
  },
  existsSync: mocks.existsSync,
  readFileSync: mocks.readFileSync,
  statSync: mocks.statSync,
}))

import { GET } from './route'

function request(path = '/api/runtime/health') {
  return new Request(`http://127.0.0.1:3337${path}`) as NextRequest
}

function expectSafeRuntimePayload(payload: unknown) {
  const text = JSON.stringify(payload)
  const forbidden = [
    ['/', 'Users', '/'].join(''),
    ['/', 'home', '/'].join(''),
    ['Bearer', ' '].join(''),
    ['sk', '-'].join('') + '[A-Za-z0-9_-]{20,}',
    ['API', '_KEY='].join(''),
    ['AUTH', '_PASS='].join(''),
  ]
  expect(text).not.toMatch(new RegExp(forbidden.join('|')))
}

describe('runtime health route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', workspace_id: 1, tenant_id: 1 } })
    mocks.existsSync.mockReturnValue(true)
    mocks.readFileSync.mockReturnValue('12345\n')
    mocks.statSync.mockReturnValue({ mtime: new Date('2026-05-10T23:59:00.000Z'), mtimeMs: Date.parse('2026-05-10T23:59:00.000Z') })
    mocks.execFileSync.mockImplementation((command: string, args: string[]) => {
      if (command === 'git' && args.join(' ') === 'rev-parse --short HEAD') return 'abc1234\n'
      if (command === 'git' && args.join(' ') === 'branch --show-current') return 'to-knowledge-mc\n'
      if (command === 'bash') return '12345\n'
      return ''
    })
  })

  it('returns safe deployment/runtime health without raw paths or secrets', async () => {
    const response = await GET(request())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      status: 'LIVE',
      source_commit: 'abc1234',
      source_branch: 'to-knowledge-mc',
      bind: {
        expected_host: '127.0.0.1',
        override_env: 'MC_HOSTNAME',
        no_public_exposure_added: true,
      },
      standalone: {
        bundle_present: true,
        pid_file: '.next/standalone/server.pid',
        pid_from_file: '12345',
        listener_pids: ['12345'],
        pid_matches_listener: true,
        runtime_cwd_mode: 'source_tree',
      },
      deployment: {
        rollback_command: 'git revert <runtime-health-commit-sha> && MC_HOSTNAME=127.0.0.1 PORT=3337 bash scripts/start-standalone.sh',
      },
    })
    expect(payload.deployment.last_build_at).toBe('2026-05-10T23:59:00.000Z')
    expectSafeRuntimePayload(payload)
  })

  it('detects standalone cwd mode without reporting raw filesystem paths', async () => {
    mocks.existsSync.mockImplementation((path: string) => {
      if (path.includes('/.next/standalone/')) return false
      return /(?:^|\/)(server\.js|server\.pid)$/.test(path) || path.endsWith('/.next/static')
    })

    const response = await GET(request())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      status: 'LIVE',
      standalone: {
        bundle_present: true,
        pid_file: '.next/standalone/server.pid',
        pid_from_file: '12345',
        listener_pids: ['12345'],
        pid_matches_listener: true,
        runtime_cwd_mode: 'standalone',
      },
    })
    expectSafeRuntimePayload(payload)
  })

  it('requires viewer auth', async () => {
    mocks.requireRole.mockReturnValue({ error: 'unauthorized', status: 401 })

    const response = await GET(request())
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'unauthorized' })
  })
})
