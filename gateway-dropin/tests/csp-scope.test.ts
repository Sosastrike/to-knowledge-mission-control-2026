import { describe, expect, it } from 'vitest'
import {
  GATEWAY_MOCK_PATH_PREFIX,
  buildGatewayMockCsp,
  isGatewayMockPath,
} from '../middleware.gateway-csp.partial'

describe('isGatewayMockPath — scope is /design/gateway/* only', () => {
  it('matches the canonical scope', () => {
    expect(isGatewayMockPath('/design/gateway/Agent Hub.html')).toBe(true)
    expect(isGatewayMockPath('/design/gateway/shared/agent-data.js')).toBe(true)
  })

  it('does not match Mission Control routes', () => {
    expect(isGatewayMockPath('/')).toBe(false)
    expect(isGatewayMockPath('/gateway')).toBe(false)
    expect(isGatewayMockPath('/gateway/agent-hub')).toBe(false)
    expect(isGatewayMockPath('/api/gateway/status')).toBe(false)
    expect(isGatewayMockPath('/agents')).toBe(false)
  })

  it('does not match the legacy designer-mission-control catch-all', () => {
    expect(isGatewayMockPath('/designer-mission-control/whatever')).toBe(false)
  })

  it('uses the documented prefix constant', () => {
    expect(GATEWAY_MOCK_PATH_PREFIX).toBe('/design/gateway/')
  })
})

describe('buildGatewayMockCsp — owner-safe relaxations only', () => {
  const csp = buildGatewayMockCsp()

  it('keeps default-src locked to self', () => {
    expect(csp).toMatch(/default-src 'self'/)
  })

  it('relaxes script-src to self + unsafe-inline (D4 justification)', () => {
    expect(csp).toMatch(/script-src 'self' 'unsafe-inline'/)
  })

  it('relaxes style-src to self + unsafe-inline (D4 justification)', () => {
    expect(csp).toMatch(/style-src 'self' 'unsafe-inline'/)
  })

  it('blocks plugins / objects', () => {
    expect(csp).toMatch(/object-src 'none'/)
  })

  it('locks frame-ancestors to self (only Mission Control may iframe)', () => {
    expect(csp).toMatch(/frame-ancestors 'self'/)
  })

  it('never includes wildcard or http: in script-src', () => {
    const m = /script-src[^;]+/.exec(csp)!
    expect(m[0]).not.toMatch(/\*/)
    expect(m[0]).not.toMatch(/http:/)
  })

  it('never enables external connect-src (data wiring stays same-origin)', () => {
    expect(csp).toMatch(/connect-src 'self'/)
  })
})
