import { execFile } from 'node:child_process'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(() => true),
  }
})

vi.mock('@/lib/paperclip-gateway-inventory', () => ({
  buildPaperclipGatewayInventorySummary: () => ({
    route: 'bridge.paperclip.gateway-inventory',
    credential_values_exposed: false,
  }),
}))

const execFileMock = vi.mocked(execFile)

describe('paperclipLiveStatus', () => {
  beforeEach(() => {
    vi.resetModules()
    execFileMock.mockReset()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        deploymentMode: 'authenticated',
        bootstrapStatus: 'ready',
        bootstrapInviteActive: false,
      }),
    })))
  })

  it('reports the recovered TKG, ECO, and ITT workspaces from the live Paperclip snapshot', async () => {
    execFileMock.mockImplementation(((_command, _args, _options, callback) => {
      if (!callback) throw new Error('expected execFile callback')
      const done = callback as (error: Error | null, stdout: string, stderr: string) => void
      done(null, JSON.stringify({
        companies: [
          { name: 'To Knowledge Gateway', issue_prefix: 'TOK', active_user_members: 2, agents: 10, issues: 0 },
          { name: 'E copier Solutions', issue_prefix: 'ECO', active_user_members: 2, agents: 7, issues: 38 },
          { name: 'E copier ITT', issue_prefix: 'ECOA', active_user_members: 1, agents: 2, issues: 31 },
        ],
        agents: [],
        issues: [],
      }), '')
      return {} as ReturnType<typeof execFile>
    }) as typeof execFile)

    const { paperclipLiveStatus } = await import('@/lib/paperclip-live-status')
    const status = await paperclipLiveStatus('companies')

    expect(status.company_access_status).toBe('ready')
    expect(status.expected_workspaces_ready).toBe(true)
    expect(status.legacy_company_warning).toBeNull()
    expect(status.companies).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'To Knowledge Gateway', issue_prefix: 'TOK', route_prefix: 'TKG', access: 'owner_accessible' }),
      expect.objectContaining({ name: 'E copier Solutions', issue_prefix: 'ECO', route_prefix: 'ECO', access: 'owner_accessible' }),
      expect.objectContaining({ name: 'E copier ITT', issue_prefix: 'ECOA', route_prefix: 'ITT', access: 'owner_accessible' }),
    ]))
    expect(status.workspace_route_aliases).toEqual(expect.arrayContaining([
      expect.objectContaining({ issue_prefix: 'TOK', route_prefix: 'TKG' }),
      expect.objectContaining({ issue_prefix: 'ECO', route_prefix: 'ECO' }),
      expect.objectContaining({ issue_prefix: 'ECOA', route_prefix: 'ITT' }),
    ]))
  })
})
