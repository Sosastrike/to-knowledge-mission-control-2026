import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('Mission Control shell ownership', () => {
  it('lets the document own vertical page scroll at the root shell', () => {
    const layout = readSource('src/app/layout.tsx')

    expect(layout).toContain('min-h-screen bg-background text-foreground')
    expect(layout).not.toContain('h-screen overflow-hidden bg-background text-foreground')
  })

  it('keeps mounted Gateway designer pages scrollable with visible exits', () => {
    const gatewayShell = readSource('public/designer-mission-control/src/gateway/GatewayShell.jsx')
    const agentHubHtml = readSource('public/designer-mission-control/design/gateway/Agent Hub.html')
    const paperclipHtml = readSource('public/designer-mission-control/design/gateway/Paperclip.html')

    expect(gatewayShell).toContain("src: '/design/gateway/Agent Hub.html'")
    expect(gatewayShell).toContain("src: '/design/gateway/Paperclip.html'")
    expect(gatewayShell).not.toContain("src: 'design/gateway/Agent Hub.html'")
    expect(gatewayShell).not.toContain("src: 'design/gateway/Paperclip.html'")
    expect(agentHubHtml).toContain('class="gw-crumbs"')
    expect(agentHubHtml).toContain('href="index.html"')
    expect(agentHubHtml).toContain('href="Gateway Overview.html"')
    expect(agentHubHtml).toContain('href="Paperclip.html"')
    expect(paperclipHtml).toContain('class="gw-crumbs"')
    expect(paperclipHtml).toContain('href="Gateway Overview.html"')
    expect(paperclipHtml).toContain('href="Agent Hub.html"')
  })

  it('keeps /tkmc as a concrete Mission Control home route', () => {
    const home = readSource('src/app/tkmc/page.tsx')

    expect(home).toContain('PriorityDashboard')
    expect(home).not.toContain('redirect(')
  })

  it('wires the approved static GatewayShell into the designer Mission Control shell without touching mock pages', () => {
    const missionControl = readSource('public/designer-mission-control/Mission Control.html')
    const shell = readSource('public/designer-mission-control/src/shell.jsx')
    const app = readSource('public/designer-mission-control/src/app.jsx')
    const gatewayShell = readSource('public/designer-mission-control/src/gateway/GatewayShell.jsx')

    expect(missionControl).toContain('<script type="text/babel" src="src/gateway/GatewayShell.jsx"></script>')
    expect(shell).toContain("{ id: 'gateway',  label: 'Gateway'")
    expect(shell).toContain("icon: 'Network'")
    expect(app).toContain("{page === 'gateway' && <GatewayShell/>}")
    expect(app).toContain('<WorkspaceRail page={page} onPage={navigateWorkspacePage}/>')
    expect(app).toContain("window.location.href = '/gateway?tab=agent-hub'")
    expect(app).not.toContain("if (page === 'gateway') window.location.href = '/gateway'")
    expect(gatewayShell).toContain("src: '/design/gateway/Agent Hub.html'")
    expect(gatewayShell).toContain("src: '/design/gateway/Paperclip.html'")
  })

  it('lets Mission Control own Gateway page movement instead of trapping iframe scroll', () => {
    const gatewayShell = readSource('public/designer-mission-control/src/gateway/GatewayShell.jsx')

    expect(gatewayShell).toContain("const [frameHeight, setFrameHeight] = React.useState('100vh')")
    expect(gatewayShell).toContain('const frameRef = React.useRef(null)')
    expect(gatewayShell).toContain('const contentHeight = (element) =>')
    expect(gatewayShell).toContain("Math.max(canvasHeight, sideHeight)")
    expect(gatewayShell).toContain("outerHeight('.repo-note')")
    expect(gatewayShell).toContain('new ResizeObserver(resizeFrame)')
    expect(gatewayShell).toContain("document.querySelector('.main-solo')")
    expect(gatewayShell).toContain("main.scrollTo({ top: 0, behavior: 'smooth' })")
    expect(gatewayShell).toContain('grid-template-columns: 220px minmax(0, 1fr)')
    expect(gatewayShell).toContain('position: sticky')
    expect(gatewayShell).toContain('scrolling="no"')
    expect(gatewayShell).toContain('style={{ height: frameHeight }}')

    expect(gatewayShell).not.toMatch(/\.gateway-shell \{[^}]*height:\s*100%;[^}]*min-height:\s*100vh/)
    expect(gatewayShell).not.toMatch(/\.gw-frame-wrap \{[^}]*height:\s*100%;[^}]*min-height:\s*100vh/)
    expect(gatewayShell).not.toMatch(/\.gw-frame \{[^}]*height:\s*100%;[^}]*min-height:\s*100vh/)
  })

  it('keeps browser Back, Mission Control Home, and Gateway tab exits wired through real history', () => {
    const app = readSource('public/designer-mission-control/src/app.jsx')
    const workspaceRail = readSource('public/designer-mission-control/src/replicas/WorkspaceRail.jsx')
    const gatewayShell = readSource('public/designer-mission-control/src/gateway/GatewayShell.jsx')

    expect(app).toContain('const writeWorkspaceUrl = React.useCallback')
    expect(app).toContain("url.searchParams.set('page', nextPage)")
    expect(app).toContain("if (nextPage !== 'gateway') url.searchParams.delete('tab')")
    expect(app).toContain("window.history[method]({ page: nextPage }, '', url)")
    expect(app).toContain("window.addEventListener('popstate', syncWorkspaceFromUrl)")
    expect(app).toContain('<WorkspaceRail page={page} onPage={navigateWorkspacePage}/>')
    expect(app).toContain('onPageChange={navigateWorkspacePage}')
    expect(app).not.toContain('onPageChange={setPage}')

    expect(workspaceRail).toContain('onClick={()=>onPage(p.id)}')
    expect(workspaceRail).not.toContain("window.location.href = '/gateway'")

    expect(gatewayShell).toContain('if (id === active) return;')
    expect(gatewayShell).toContain("window.history.pushState({ page: 'gateway', tab: id }, '', url)")
    expect(gatewayShell).not.toContain("window.history.replaceState({}, '', url)")
  })

  it('keeps the approved fixed-width Gateway mock accessible on mobile without editing mock HTML', () => {
    const styles = readSource('public/designer-mission-control/styles.css')
    const gatewayShell = readSource('public/designer-mission-control/src/gateway/GatewayShell.jsx')

    expect(styles).toContain('@media (max-width: 900px)')
    expect(styles).toContain('flex-direction: column')
    expect(styles).toContain('overflow-x: auto')
    expect(styles).toContain('white-space: nowrap')
    expect(styles).toContain('max-width: none')
    expect(styles).toContain('#root,')
    expect(styles).toContain('max-width: 100vw')
    expect(styles).toContain('.topbar-search,')
    expect(styles).toContain('.topbar .persona,')
    expect(styles).toContain('text-overflow: ellipsis')

    expect(gatewayShell).toContain('@media (max-width: 1200px)')
    expect(gatewayShell).toContain('grid-template-columns: 220px 1480px')
    expect(gatewayShell).toContain('min-width: 1700px')
    expect(gatewayShell).toContain('.gateway-shell .gw-frame-wrap .gw-frame { width: 1480px; }')
  })
})
