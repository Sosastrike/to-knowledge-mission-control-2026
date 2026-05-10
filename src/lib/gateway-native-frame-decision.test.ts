import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

const gatewayRedirectRules: Array<[source: string, destination: string]> = [
  ['/gateway/routes', '/gateway?tab=routes'],
  ['/gateway/registry', '/gateway?tab=registry'],
  ['/gateway/policies', '/gateway?tab=policies'],
  ['/gateway/health', '/gateway?tab=health'],
  ['/gateway/dispatcher', '/gateway?tab=dispatcher'],
  ['/gateway/token-governor', '/gateway?tab=governor'],
  ['/gateway/agent-hub', '/gateway?tab=agent-hub'],
  ['/gateway/agent-hub/paperclip', '/gateway?tab=paperclip'],
  ['/gateway/agent-hub/:id', '/gateway?tab=agent-hub'],
  ['/gateway/bridge-session', '/gateway?tab=bridge'],
  ['/gateway/node-detail', '/gateway?tab=node-detail'],
  ['/gateway/mobile-tablet', '/gateway?tab=mobile'],
]

const removedWrapperPages = [
  'src/app/gateway/routes/page.tsx',
  'src/app/gateway/registry/page.tsx',
  'src/app/gateway/policies/page.tsx',
  'src/app/gateway/health/page.tsx',
  'src/app/gateway/dispatcher/page.tsx',
  'src/app/gateway/token-governor/page.tsx',
  'src/app/gateway/agent-hub/page.tsx',
  'src/app/gateway/agent-hub/paperclip/page.tsx',
  'src/app/gateway/agent-hub/[id]/page.tsx',
  'src/app/gateway/bridge-session/page.tsx',
  'src/app/gateway/node-detail/page.tsx',
  'src/app/gateway/mobile-tablet/page.tsx',
]

describe('Gateway native frame architecture decision', () => {
  it('uses one GatewayShell route and redirects leaf routes into shell sub-tabs', () => {
    const gatewayPage = readSource('src/app/gateway/page.tsx')
    const gatewayShell = readSource('public/designer-mission-control/src/gateway/GatewayShell.jsx')
    const nextConfig = readSource('next.config.js')

    expect(gatewayPage).toContain('redirect(')
    expect(gatewayPage).toContain('/designer-mission-control/Mission%20Control.html?page=gateway')
    expect(gatewayShell).toContain("src: '/designer-mission-control/design/gateway/Agent Hub.html'")
    expect(gatewayShell).toContain("src: '/designer-mission-control/design/gateway/Paperclip.html'")

    for (const [source, destination] of gatewayRedirectRules) {
      expect(nextConfig).toContain(`source: '${source}'`)
      expect(nextConfig).toContain(`destination: '${destination}'`)
    }

    for (const routePath of removedWrapperPages) {
      expect(existsSync(join(process.cwd(), routePath))).toBe(false)
    }
  })

  it('does not keep a Next page iframe wrapper for accepted Gateway mock pages', () => {
    const gatewayShell = readSource('public/designer-mission-control/src/gateway/GatewayShell.jsx')

    expect(gatewayShell).toContain('function GatewayShell()')
    expect(gatewayShell).toContain('<iframe')
    expect(gatewayShell).not.toContain("src: 'design/gateway/Agent Hub.html'")
    expect(gatewayShell).not.toContain("src: 'design/gateway/Paperclip.html'")
  })

  it('routes Agent Hub agent detail URLs into the GatewayShell Agent Hub deep link', () => {
    const nextConfig = readSource('next.config.js')

    expect(nextConfig).toContain("source: '/gateway/agent-hub/:id'")
    expect(nextConfig).toContain("destination: '/gateway?tab=agent-hub'")
  })

  it('serves designer assets with same-origin frame headers instead of blocking the Gateway frame', () => {
    const proxy = readSource('src/proxy.ts')

    expect(proxy).toContain("frame-ancestors 'self'")
    expect(proxy).toContain("isDesignerMissionControl ? 'SAMEORIGIN' : 'DENY'")
  })
})
