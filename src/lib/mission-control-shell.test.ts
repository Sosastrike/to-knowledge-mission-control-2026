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
    const frame = readSource('src/components/gateway/DesignerGatewayMockFrame.tsx')
    const agentHubHtml = readSource('public/designer-mission-control/design/gateway/Agent Hub.html')
    const paperclipHtml = readSource('public/designer-mission-control/design/gateway/Paperclip.html')

    expect(frame).toContain("<main className='min-h-screen w-full")
    expect(frame).toContain("scrolling='yes'")
    expect(frame).not.toContain("href='/tkmc'")
    expect(frame).not.toContain("href='/gateway'")
    expect(frame).not.toContain("href='/gateway/agent-hub'")
    expect(frame).not.toContain('h-screen w-full overflow-hidden')
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
    expect(app).not.toContain("if (page === 'gateway') window.location.href = '/gateway'")
    expect(gatewayShell).toContain("src: 'design/gateway/Agent Hub.html'")
    expect(gatewayShell).toContain("src: 'design/gateway/Paperclip.html'")
  })
})
