import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireRoleMock = vi.fn()
const requireRoleOrAgentScopeMock = vi.fn()
const mutationLimiterMock = vi.fn(() => null)
const prepareMock = vi.fn()
const runMock = vi.fn(() => ({ changes: 1, lastInsertRowid: 99 }))
const fakeBearer = 'Bearer ' + 'SHOULD_NOT_LEAK_012345678901234567890'

vi.mock('@/lib/auth', () => ({ requireRole: requireRoleMock, requireRoleOrAgentScope: requireRoleOrAgentScopeMock }))
vi.mock('@/lib/rate-limit', () => ({ mutationLimiter: mutationLimiterMock }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/db', () => ({
  getDatabase: vi.fn(() => ({ prepare: prepareMock })),
  db_helpers: {
    logActivity: vi.fn(),
  },
}))

describe('/api/tasks/[id]/events', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireRoleMock.mockReturnValue({ user: { username: 'operator', workspace_id: 1, role: 'operator' } })
    requireRoleOrAgentScopeMock.mockReturnValue({ user: { username: 'operator', workspace_id: 1, role: 'operator' } })

    prepareMock.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM tasks WHERE id = ? AND workspace_id = ?')) {
        return {
          get: vi.fn(() => ({
            id: 7,
            title: 'Visible task',
            status: 'quality_review',
            metadata: JSON.stringify({
              timeline: [
                {
                  event: 'BRAIN_SYNC_PROOF',
                  proof: 'route returned exact state',
                  created_at: '2026-05-25T00:00:00.000Z',
                  status: 'passed',
                },
              ],
            }),
            workspace_id: 1,
            updated_at: 1779750000,
          })),
        }
      }
      if (sql.includes('SELECT id, author, content, created_at FROM comments')) {
        return {
          all: vi.fn(() => [
            {
              id: 12,
              author: 'codex',
              content: `Autonomous proof event. ${fakeBearer}`,
              created_at: 1779750100,
            },
          ]),
        }
      }
      if (sql.includes('INSERT INTO comments')) return { run: runMock }
      if (sql.includes('UPDATE tasks SET metadata')) return { run: runMock }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    })
  })

  it('returns 401 unauthenticated before reading task events', async () => {
    requireRoleMock.mockReturnValue({ error: 'Unauthorized', status: 401 })
    requireRoleOrAgentScopeMock.mockReturnValue({ error: 'Unauthorized', status: 401 })
    const { GET, POST } = await import('@/app/api/tasks/[id]/events/route')
    const getResponse = await GET(new NextRequest('http://localhost/api/tasks/7/events'), { params: Promise.resolve({ id: '7' }) })
    const postResponse = await POST(new NextRequest('http://localhost/api/tasks/7/events', { method: 'POST', body: '{}' }), { params: Promise.resolve({ id: '7' }) })

    expect(getResponse.status).toBe(401)
    expect(postResponse.status).toBe(401)
    expect(prepareMock).not.toHaveBeenCalled()
  })

  it('returns metadata timeline and comment events with redacted previews', async () => {
    const { GET } = await import('@/app/api/tasks/[id]/events/route')
    const response = await GET(new NextRequest('http://localhost/api/tasks/7/events'), { params: Promise.resolve({ id: '7' }) })
    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      route: '/api/tasks/7/events',
      task_id: 7,
      source: 'sqlite_tasks_comments_and_metadata_timeline',
      secrets_exposed: false,
      raw_env_values_exposed: false,
    })
    expect(payload.events.map((event: { source: string }) => event.source)).toEqual(['metadata.timeline', 'comments'])
    expect(serialized).toContain('BRAIN_SYNC_PROOF')
    expect(serialized).not.toContain('SHOULD_NOT_LEAK')
    expect(serialized).toContain('[REDACTED_BEARER]')
  })

  it('appends safe task events and rejects high-confidence secrets', async () => {
    const { POST } = await import('@/app/api/tasks/[id]/events/route')
    const safeResponse = await POST(new NextRequest('http://localhost/api/tasks/7/events', {
      method: 'POST',
      body: JSON.stringify({ event: 'DIRECT_LINE_VALIDATED', proof: 'opencloud_intermediary=false', status: 'passed' }),
      headers: { 'content-type': 'application/json' },
    }), { params: Promise.resolve({ id: '7' }) })
    const safePayload = await safeResponse.json()

    expect(safeResponse.status).toBe(201)
    expect(safePayload).toMatchObject({
      ok: true,
      event: {
        event: 'DIRECT_LINE_VALIDATED',
        proof: 'opencloud_intermediary=false',
        status: 'passed',
      },
      secrets_exposed: false,
    })
    expect(requireRoleOrAgentScopeMock).toHaveBeenCalledWith(expect.any(NextRequest), 'operator', ['ron.task_event_write', 'sofia.task_event_write', 'spaceagent.task_event_write'])
    expect(runMock).toHaveBeenCalled()

    const secretResponse = await POST(new NextRequest('http://localhost/api/tasks/7/events', {
      method: 'POST',
      body: JSON.stringify({ event: 'BAD', proof: fakeBearer }),
      headers: { 'content-type': 'application/json' },
    }), { params: Promise.resolve({ id: '7' }) })
    const secretPayload = await secretResponse.json()

    expect(secretResponse.status).toBe(400)
    expect(secretPayload).toMatchObject({
      error: 'task_event_secret_value_rejected',
      secrets_exposed: false,
    })
  })
})
