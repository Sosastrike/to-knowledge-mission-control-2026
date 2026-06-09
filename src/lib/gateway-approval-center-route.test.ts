import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => {
  type AuthResult = { error: string; status: number } | { user: { role: string } }
  return {
    requireRole: vi.fn<() => AuthResult>(() => ({ error: 'Authentication required', status: 401 })),
  }
})

vi.mock('@/lib/auth', () => authMock)

describe('/api/gateway/approvals/center route', () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.requireRole.mockReset()
    authMock.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
  })

  it('returns 401 to unauthenticated callers', async () => {
    const route = await import('@/app/api/gateway/approvals/center/route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/approvals/center'))

    expect(response.status).toBe(401)
  })

  it('returns a sanitized read-only approval center for authenticated viewers', async () => {
    authMock.requireRole.mockReturnValue({ user: { role: 'viewer' } })
    const route = await import('@/app/api/gateway/approvals/center/route')
    const response = await route.GET(new NextRequest('http://localhost/api/gateway/approvals/center'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(authMock.requireRole).toHaveBeenCalledWith(expect.any(NextRequest), 'viewer')
    expect(payload).toMatchObject({
      ok: true,
      source: 'gateway_approval_center',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_executed: false,
      broad_connector_execution_enabled: false,
    })
    expect(payload.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ component: 'AgentMail', state: 'standing_scope_active' }),
      expect.objectContaining({ component: 'Zapier', standing_scope_id: 'zapier.scope.discovery_and_status' }),
      expect.objectContaining({ component: 'OpenCloud / OCTM', state: 'approval_needed' }),
    ]))
    expect(payload.standing_scope_proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope_id: 'scope.knowledge.read.preview',
        status: 'preview_only',
        write_enabled: false,
        execute_enabled: false,
      }),
      expect.objectContaining({
        scope_id: 'zapier.scope.discovery_and_status',
        status: 'already_active_read_only',
        write_enabled: false,
        execute_enabled: false,
      }),
    ]))
    expect(payload.standing_scope_proposal_summary).toMatchObject({
      write_scopes_activation_enabled: false,
      execute_scopes_activation_enabled: false,
    })
    expect(JSON.stringify(payload)).not.toMatch(
      /Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i,
    )
  })
})
