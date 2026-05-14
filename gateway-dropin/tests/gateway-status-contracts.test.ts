import { describe, expect, it } from 'vitest'

import { statusForGatewayApiPath } from '../src/components/gateway/gateway-status-contracts'

describe('statusForGatewayApiPath - standalone Gateway read-only status contracts', () => {
  it('reports Agent Zero as restored UI with execution still disabled', () => {
    const status = statusForGatewayApiPath(['agent-zero', 'status'])
    expect(status).toMatchObject({
      ok: true,
      state: 'READ_ONLY',
      agent_id: 'agent-zero',
      execution_enabled: false,
      go_claim_allowed: false,
      owner_access_blocker: 'agent_zero_fd_exhaustion_guard_pending',
    })
  })

  it('reports reachable local/Tailnet runtimes as read-only without enabling service control', () => {
    expect(statusForGatewayApiPath(['hermes', 'status'])).toMatchObject({
      state: 'READ_ONLY',
      local_bind_address: '127.0.0.1',
      service_control_enabled: false,
    })
    expect(statusForGatewayApiPath(['paperclip', 'status'])).toMatchObject({
      state: 'READ_ONLY',
      tailnet_url: 'http://100.116.35.95:3100/',
      service_control_enabled: false,
    })
    expect(statusForGatewayApiPath(['bridge', 'space-agent', 'status'])).toMatchObject({
      state: 'READ_ONLY',
      playwright_mcp_status: 'live_local_only',
      service_control_enabled: false,
    })
    expect(statusForGatewayApiPath(['spaceagent', 'status'])).toMatchObject({
      state: 'BLOCKED',
      service_control_enabled: false,
    })
  })

  it('returns connector readiness without enabling external writes', () => {
    const status = statusForGatewayApiPath(['bridge', 'connector-readiness'])
    expect(status).toMatchObject({
      ok: true,
      state: 'READ_ONLY',
      execution_enabled: false,
      external_writes_enabled: false,
      approval_request_created: false,
    })
    expect(Array.isArray(status.connectors)).toBe(true)
  })
})
