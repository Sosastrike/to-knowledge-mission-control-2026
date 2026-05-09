import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  auditRun: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/provider-subscriptions', () => ({
  getProviderSubscriptionFlags: vi.fn(() => ({})),
  getProviderFromModel: vi.fn(() => 'unknown'),
}))

vi.mock('@/lib/db', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn((sql: string) => {
      if (sql.includes('SELECT') && sql.includes('FROM token_usage') && sql.includes('COUNT(*)')) {
        return {
          get: vi.fn(() => ({
            request_count: 3,
            input_tokens: 1200,
            output_tokens: 800,
            session_count: 2,
          })),
        }
      }
      if (sql.includes('SELECT') && sql.includes('FROM token_usage')) {
        return {
          all: vi.fn(() => []),
        }
      }
      return {
        run: mocks.auditRun,
      }
    }),
  })),
}))

describe('Gateway Token Governor route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({
      user: {
        id: 1,
        username: 'owner',
        role: 'admin',
        workspace_id: 1,
      },
    })
  })

  it('returns readiness status without enabling execution or writes', async () => {
    const route = await import('./route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/token-governor'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      mode: 'gateway_token_governor_status',
      canonical_status: 'READY',
      enforcement_enabled: true,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      provider_route_changes_enabled: false,
      usage_summary: {
        request_count: 3,
        input_tokens: 1200,
        output_tokens: 800,
        session_count: 2,
      },
    })
  })

  it('blocks exhausted preflight requests and persists a safe audit event', async () => {
    const route = await import('./route')
    const response = await route.POST(new NextRequest('http://localhost/api/gateway/token-governor', {
      method: 'POST',
      body: JSON.stringify({
        scope: 'agent',
        subject_id: 'agent-zero',
        subject_name: 'Agent Zero',
        model: 'claude-sonnet',
        spent_cents: 8800,
        projected_cents: 300,
        budget_cents: 10000,
      }),
    }))
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toMatchObject({
      ok: false,
      mode: 'gateway_token_governor_preflight',
      decision: 'block',
      blocked_reason: 'token_governor_budget_exhausted',
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      audit_persisted: true,
    })
    expect(mocks.auditRun).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(payload)).not.toMatch(/sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|\/Users\/|\/home\/|auth\.json/i)
  })

  it('rejects unauthenticated requests before reading token usage', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
    const route = await import('./route')

    const response = await route.GET(new NextRequest('http://localhost/api/gateway/token-governor'))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: 'Authentication required' })
  })
})
