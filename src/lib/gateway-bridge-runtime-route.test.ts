import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = vi.hoisted(() => {
  type AuthResult = { error: string; status: number } | { role: string }
  return {
    requireRole: vi.fn<() => AuthResult>(() => ({ error: 'unauthorized', status: 401 })),
  }
})

vi.mock('@/lib/auth', () => authMock)

const runtimeMock = vi.hoisted(() => ({
  getGatewayBridgeRuntimeStatus: vi.fn(() => ({
    ok: true,
    source: 'gateway_bridge_runtime',
    runtime_id: 'gateway-runtime',
    mode: 'persistent_gateway_runtime_bridge',
    state: 'active',
    enabled: true,
    execution_enabled: true,
    exact_blocker: null,
    action_bridge_session_required: false,
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
  })),
  enableGatewayBridgeRuntime: vi.fn(() => ({ state: 'active', execution_enabled: true })),
  disableGatewayBridgeRuntime: vi.fn(() => ({ state: 'paused', execution_enabled: false })),
  restartGatewayBridgeRuntime: vi.fn(() => ({ state: 'active', execution_enabled: true })),
  heartbeatGatewayBridgeRuntime: vi.fn(() => ({ state: 'active', execution_enabled: true })),
}))

vi.mock('@/lib/gateway-bridge-runtime', () => runtimeMock)

describe('Gateway Runtime Bridge routes', () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.requireRole.mockReset()
    authMock.requireRole.mockReturnValue({ error: 'unauthorized', status: 401 })
  })

  it('returns 401 unauthenticated for status and mutation routes', async () => {
    const status = await import('@/app/api/gateway/bridge-runtime/status/route')
    const enable = await import('@/app/api/gateway/bridge-runtime/enable/route')
    const disable = await import('@/app/api/gateway/bridge-runtime/disable/route')
    const restart = await import('@/app/api/gateway/bridge-runtime/restart/route')
    const heartbeat = await import('@/app/api/gateway/bridge-runtime/heartbeat/route')

    const req = new NextRequest('http://localhost/api/gateway/bridge-runtime/status')
    expect((await status.GET(req)).status).toBe(401)
    expect((await enable.POST(new NextRequest('http://localhost/api/gateway/bridge-runtime/enable', { method: 'POST', body: '{}' }))).status).toBe(401)
    expect((await disable.POST(new NextRequest('http://localhost/api/gateway/bridge-runtime/disable', { method: 'POST', body: '{}' }))).status).toBe(401)
    expect((await restart.POST(new NextRequest('http://localhost/api/gateway/bridge-runtime/restart', { method: 'POST', body: '{}' }))).status).toBe(401)
    expect((await heartbeat.POST(new NextRequest('http://localhost/api/gateway/bridge-runtime/heartbeat', { method: 'POST', body: '{}' }))).status).toBe(401)
  })

  it('returns sanitized active runtime state to authenticated viewers', async () => {
    authMock.requireRole.mockReturnValue({ role: 'viewer' })
    const status = await import('@/app/api/gateway/bridge-runtime/status/route')
    const response = await status.GET(new NextRequest('http://localhost/api/gateway/bridge-runtime/status'))
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      source: 'gateway_bridge_runtime',
      state: 'active',
      execution_enabled: true,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      action_bridge_session_required: false,
    })
    expect(JSON.stringify(payload)).not.toMatch(/Bearer|sk-|am_|cookie=/i)
  })
})
