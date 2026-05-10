import { describe, expect, it } from 'vitest'
import {
  ROUTE_METADATA,
  getBreadcrumbTrail,
  getRouteMetadata,
} from '../route-metadata.js'

describe('ROUTE_METADATA', () => {
  it('contains every spec section', () => {
    const routes = ROUTE_METADATA.map((r) => r.route)
    for (const r of [
      '/',
      '/gateway',
      '/gateway/overview',
      '/gateway/agent-hub',
      '/gateway/agent-hub/paperclip',
      '/gateway/agent-hub/:agentId',
      '/gateway/routes',
      '/gateway/registry',
      '/gateway/policies',
      '/gateway/health',
      '/gateway/dispatcher',
      '/gateway/token-governor',
      '/gateway/bridge-session',
      '/gateway/status',
      '/gateway/brain',
      '/gateway/space-agent',
      '/gateway/node-detail',
      '/gateway/mobile-tablet',
      '/agent-network',
      '/agents',
      '/reports',
      '/connectors',
    ]) {
      expect(routes).toContain(r)
    }
  })

  it('every safe_back_target points to an existing route', () => {
    const all = new Set(ROUTE_METADATA.map((r) => r.route))
    for (const r of ROUTE_METADATA) {
      expect(all.has(r.safe_back_target)).toBe(true)
    }
  })

  it('every parent_route either is null or exists', () => {
    const all = new Set(ROUTE_METADATA.map((r) => r.route))
    for (const r of ROUTE_METADATA) {
      if (r.parent_route !== null) expect(all.has(r.parent_route)).toBe(true)
    }
  })

  it('home is reachable from every leaf', () => {
    for (const r of ROUTE_METADATA) {
      expect(r.mission_control_home_target).toBe('/')
    }
  })
})

describe('getRouteMetadata', () => {
  it('returns null on unknown routes', () => {
    expect(getRouteMetadata('/does-not-exist')).toBeNull()
  })

  it('matches parameterised routes', () => {
    const meta = getRouteMetadata('/agents/abc-123')
    expect(meta).not.toBeNull()
    expect(meta!.route).toBe('/agents/:agentId')
  })

  it('matches mounted Agent Hub detail routes', () => {
    const meta = getRouteMetadata('/gateway/agent-hub/agent-zero')
    expect(meta).not.toBeNull()
    expect(meta!.route).toBe('/gateway/agent-hub/:agentId')
  })
})

describe('getBreadcrumbTrail', () => {
  it('produces a root → leaf trail', () => {
    const trail = getBreadcrumbTrail('/gateway/agent-hub').map((r) => r.route)
    expect(trail).toEqual(['/', '/gateway', '/gateway/agent-hub'])
  })

  it('handles routes with no parent', () => {
    const trail = getBreadcrumbTrail('/').map((r) => r.route)
    expect(trail).toEqual(['/'])
  })

  it('produces the Paperclip route trail under Agent Hub', () => {
    const trail = getBreadcrumbTrail('/gateway/agent-hub/paperclip').map((r) => r.route)
    expect(trail).toEqual(['/', '/gateway', '/gateway/agent-hub', '/gateway/agent-hub/paperclip'])
  })

  it('returns [] for unknown route', () => {
    expect(getBreadcrumbTrail('/no-such-route')).toEqual([])
  })
})
