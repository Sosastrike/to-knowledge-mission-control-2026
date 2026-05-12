import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
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

  it('keeps shell controls keyboard and screen-reader accessible without modifying mock pages', () => {
    const styles = readSource('public/designer-mission-control/styles.css')
    const shell = readSource('public/designer-mission-control/src/shell.jsx')
    const workspaceRail = readSource('public/designer-mission-control/src/replicas/WorkspaceRail.jsx')
    const notifications = readSource('public/designer-mission-control/src/notifications-drawer.jsx')
    const gatewayShell = readSource('public/designer-mission-control/src/gateway/GatewayShell.jsx')

    expect(styles).toContain('.icon-btn:focus-visible')
    expect(styles).toContain('.topbar-search:focus-visible')
    expect(styles).toContain('.persona:focus-visible')
    expect(styles).toContain('.ws-rail-btn:focus-visible')

    expect(shell).toContain('<button type="button" className="topbar-search"')
    expect(shell).toContain('aria-label="Open Mission Control search"')
    expect(shell).toContain('aria-label="Open settings quick panel"')
    expect(shell).toContain('aria-label={`Preview role permissions as ${persona.name}`}')
    expect(shell).not.toContain('<input placeholder="Search tickets, agents, settings…" readOnly/>')

    expect(workspaceRail).toContain('<nav className="ws-rail" aria-label="Workspace">')
    expect(workspaceRail).toContain('type="button"')
    expect(workspaceRail).toContain('aria-label={p.label}')
    expect(workspaceRail).toContain("aria-current={active ? 'page' : undefined}")

    expect(notifications).toContain('aria-label={label}')
    expect(notifications).toContain('aria-label="Close notifications"')

    expect(gatewayShell).toContain('<button')
    expect(gatewayShell).toContain('type="button"')
    expect(gatewayShell).toContain('.gateway-shell .gw-side .gw-tab:focus-visible')
    expect(gatewayShell).toContain('aria-label={t.label + ')
    expect(gatewayShell).toContain("aria-current={t.id === active ? 'page' : undefined}")
    expect(gatewayShell).toContain("aria-label={'Gateway frame showing ' + tab.label}")
  })

  it('keeps owner-facing shell errors classified and redacted', () => {
    const missionControlHtml = readSource('public/designer-mission-control/Mission Control.html')
    const ownerErrorCopy = readSource('public/designer-mission-control/src/owner-error-copy.jsx')
    const notificationBus = readSource('public/designer-mission-control/src/notification-bus.jsx')
    const loginPage = readSource('public/designer-mission-control/src/login-page.jsx')
    const skillsPage = readSource('public/designer-mission-control/src/skills-page.jsx')
    const errorBoundary = readSource('src/components/ErrorBoundary.tsx')

    expect(missionControlHtml).toContain('src/owner-error-copy.jsx')
    expect(ownerErrorCopy).toContain('OWNER_GATED')
    expect(ownerErrorCopy).toContain('CREDENTIAL_GATED')
    expect(ownerErrorCopy).toContain('SERVICE_DOWN')
    expect(ownerErrorCopy).toContain('BACKEND_MISSING')
    expect(ownerErrorCopy).toContain('ROUTE_MISSING')
    expect(ownerErrorCopy).toContain('AUTH_REQUIRED')
    expect(ownerErrorCopy).toContain('EXECUTION_DISABLED')
    expect(ownerErrorCopy).toContain('WRITE_DISABLED')
    expect(ownerErrorCopy).toContain('EXTERNAL_WRITE_DISABLED')
    expect(ownerErrorCopy).toContain('UNKNOWN')
    expect(ownerErrorCopy).toContain('[redacted-user-path]')
    expect(ownerErrorCopy).toContain('[redacted-secret]')
    expect(ownerErrorCopy).toContain('[redacted-host]')

    expect(notificationBus).toContain('window.OwnerErrorCopy.notificationEntry(entry)')
    expect(loginPage).toContain('window.ownerFacingErrorText')
    expect(skillsPage).toContain('window.ownerFacingErrorText')
    expect(errorBoundary).toContain('classifyToolError')
    expect(errorBoundary).not.toContain(`{error?.message || t('unexpectedError')}`)
  })

  it('classifies browser shell errors without exposing raw paths, hosts, or secrets', () => {
    const ownerErrorCopy = readSource('public/designer-mission-control/src/owner-error-copy.jsx')
    const context: { window: any } = { window: {} }
    runInNewContext(ownerErrorCopy, context)

    const classified = context.window.OwnerErrorCopy.classify({
      status: 503,
      message: 'connect ECONNREFUSED http://127.0.0.1:9999',
      technical_detail: 'service failed with API_KEY=secret-value at /Users/sosastrike/private/auth.json',
    })
    const notification = context.window.OwnerErrorCopy.notificationEntry({
      kind: 'error',
      title: 'Probe failed',
      detail: 'API_KEY=secret-value /Users/sosastrike/private http://127.0.0.1:9999',
    })

    expect(classified).toMatchObject({
      kind: 'SERVICE_DOWN',
      owner_message: 'The backing service is unreachable.',
    })
    expect(notification.detail).toContain('CREDENTIAL_GATED:')
    expect(JSON.stringify({ classified, notification })).not.toContain('secret-value')
    expect(JSON.stringify({ classified, notification })).not.toContain('/Users/sosastrike')
    expect(JSON.stringify({ classified, notification })).not.toContain('127.0.0.1')
    expect(JSON.stringify({ classified, notification })).not.toContain('auth.json')
  })
})
