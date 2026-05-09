import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

const gatewayMockRoutes: Array<[routePath: string, designerFile: string]> = [
  ['src/app/gateway/page.tsx', 'Gateway Overview.html'],
  ['src/app/gateway/routes/page.tsx', 'Gateway Routes.html'],
  ['src/app/gateway/registry/page.tsx', 'Gateway Registry.html'],
  ['src/app/gateway/policies/page.tsx', 'Gateway Policies.html'],
  ['src/app/gateway/health/page.tsx', 'Gateway Health.html'],
  ['src/app/gateway/dispatcher/page.tsx', 'Dispatcher.html'],
  ['src/app/gateway/token-governor/page.tsx', 'Token Governor.html'],
  ['src/app/gateway/agent-hub/page.tsx', 'Agent Hub.html'],
  ['src/app/gateway/agent-hub/paperclip/page.tsx', 'Paperclip.html'],
  ['src/app/gateway/bridge-session/page.tsx', 'Bridge Session Flow.html'],
  ['src/app/gateway/node-detail/page.tsx', 'Gateway Node Detail.html'],
  ['src/app/gateway/mobile-tablet/page.tsx', 'Gateway Mobile Tablet.html'],
]

describe('Gateway native frame architecture decision', () => {
  it('keeps the accepted FULL v3 designer files as the mounted visual contract', () => {
    for (const [routePath, designerFile] of gatewayMockRoutes) {
      const source = readSource(routePath)

      expect(source).toContain('DesignerGatewayMockFrame')
      expect(source).toContain(`page='${designerFile}'`)
      expect(source).not.toContain('GatewayControlShell')
    }
  })

  it('lets Mission Control own page scroll while preserving same-origin mock fidelity', () => {
    const frame = readSource('src/components/gateway/DesignerGatewayMockFrame.tsx')

    expect(frame).toContain("<main className='min-h-screen w-full")
    expect(frame).not.toContain('h-screen w-full overflow-hidden')
    expect(frame).toContain("scrolling='yes'")
    expect(frame).toContain('iframe.style.height')
    expect(frame).toContain('ResizeObserver')
    expect(frame).toContain("iframe.contentDocument?.readyState === 'complete'")
    expect(frame).toContain("href='/tkmc'")
    expect(frame).toContain("href='/gateway'")
    expect(frame).toContain("href='/gateway/agent-hub'")
    expect(frame).toContain('fragment?: string')
    expect(frame).toContain('encodeURIComponent(fragment)')
  })

  it('routes Agent Hub agent detail pages into the accepted Agent Hub designer detail tabs', () => {
    const route = readSource('src/app/gateway/agent-hub/[id]/page.tsx')

    expect(route).toContain("page='Agent Hub.html'")
    expect(route).toContain('fragment={fragment}')
    expect(route).toContain("'agent-zero': 'agent-zero'")
    expect(route).toContain("'space-agent': 'space-agent'")
    expect(route).toContain("'pi-mono': 'pi-mono'")
    expect(route).toContain("'openclaw-plus': 'openclaw-plus'")
    expect(route).toContain('notFound()')
  })

  it('serves designer assets with same-origin frame headers instead of blocking the Gateway frame', () => {
    const proxy = readSource('src/proxy.ts')

    expect(proxy).toContain("frame-ancestors 'self'")
    expect(proxy).toContain("isDesignerMissionControl ? 'SAMEORIGIN' : 'DENY'")
  })
})
