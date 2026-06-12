import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const routeSpecs = [
  ['status', '@/app/api/agentmail/status/route'],
  ['inboxes', '@/app/api/agentmail/inboxes/route'],
  ['events', '@/app/api/agentmail/events/route'],
  ['bridge-queue', '@/app/api/agentmail/bridge-queue/route'],
  ['approvals', '@/app/api/agentmail/approvals/route'],
  ['audit', '@/app/api/agentmail/audit/route'],
  ['connect/status', '@/app/api/agentmail/connect/status/route'],
  ['send-access/status', '@/app/api/agentmail/send-access/status/route'],
  ['bridge-session/status', '@/app/api/agentmail/bridge-session/status/route'],
] as const

const postRouteSpecs = [
  ['connect/sync', '@/app/api/agentmail/connect/sync/route'],
  ['connect/test', '@/app/api/agentmail/connect/test/route'],
  ['connect/provision-preview', '@/app/api/agentmail/connect/provision-preview/route'],
  ['connect/provision-request', '@/app/api/agentmail/connect/provision-request/route'],
  ['connect/provision-approve', '@/app/api/agentmail/connect/provision-approve/route'],
  ['connect/provision-apply', '@/app/api/agentmail/connect/provision-apply/route'],
  ['bridge-session/request', '@/app/api/agentmail/bridge-session/request/route'],
  ['bridge-session/approve', '@/app/api/agentmail/bridge-session/approve/route'],
  ['bridge-session/revoke', '@/app/api/agentmail/bridge-session/revoke/route'],
  ['send/preview', '@/app/api/agentmail/send/preview/route'],
  ['send/request', '@/app/api/agentmail/send/request/route'],
  ['send/approve', '@/app/api/agentmail/send/approve/route'],
  ['send/dispatch', '@/app/api/agentmail/send/dispatch/route'],
  ['credentials/provision-preview', '@/app/api/agentmail/credentials/provision-preview/route'],
  ['credentials/provision-request', '@/app/api/agentmail/credentials/provision-request/route'],
  ['credentials/provision-approve', '@/app/api/agentmail/credentials/provision-approve/route'],
  ['credentials/provision-apply', '@/app/api/agentmail/credentials/provision-apply/route'],
] as const

describe('AgentMail local control API routes', () => {
  it.each(routeSpecs)('%s returns 401 without Mission Control auth', async (name, modulePath) => {
    const mod = await import(modulePath)
    const response = await mod.GET(new Request(`http://localhost/api/agentmail/${name}`) as any)

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: expect.any(String),
    })
  })

  it.each(postRouteSpecs)('%s POST returns 401 without Mission Control auth', async (name, modulePath) => {
    const mod = await import(modulePath)
    const response = await mod.POST(new Request(`http://localhost/api/agentmail/${name}`, { method: 'POST' }) as any)

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: expect.any(String),
    })
  })

  it('renders required Local Control panels and Gateway links to it', () => {
    const page = readFileSync(path.join(process.cwd(), 'src/app/agentmail/page.tsx'), 'utf8')
    const gateway = readFileSync(path.join(process.cwd(), 'src/components/gateway/GatewayShell.tsx'), 'utf8')
    const localControl = readFileSync(path.join(process.cwd(), 'src/lib/agentmail-local-control.ts'), 'utf8')
    const actions = readFileSync(path.join(process.cwd(), 'src/app/agentmail/AgentMailConnectActions.tsx'), 'utf8')

    for (const label of ['Connect AgentMail', 'Send Access', 'Bridge Session', 'Agent Send Readiness', 'Permission Matrix', 'Safe Send Test', 'Scoped Credential', 'Real Send Adapter', 'Hosted Console', 'Google/SSO Status', 'MCP OAuth Status', 'API Key Fallback', 'Last Sync', 'Local Status', 'Inbox Registry', 'Event Console', 'Bridge Queue', 'Approvals', 'Audit']) {
      expect(page).toContain(label)
    }
    expect(page).toContain('AGENTMAIL_CONSOLE_URL')
    expect(page).toContain('Back to Gateway')
    expect(page).toContain('Back to Mission Control')
    expect(page).not.toContain('action="/api/agentmail/connect/test"')
    expect(page).not.toContain('action="/api/agentmail/connect/provision-preview"')
    expect(actions).toContain("'/api/agentmail/connect/test'")
    expect(actions).toContain("'/api/agentmail/connect/provision-preview'")
    expect(actions).toContain("'/api/agentmail/connect/provision-request'")
    expect(actions).toContain("'/api/agentmail/connect/provision-approve'")
    expect(actions).toContain("'/api/agentmail/connect/provision-apply'")
    expect(actions).toContain("'/api/agentmail/connect/capacity-resolution'")
    expect(actions).toContain('fetch(path')
    expect(actions).toContain('setState')
    expect(actions).not.toContain('href={AGENTMAIL_MCP_URL}')
    expect(localControl).toContain('https://console.agentmail.to')
    expect(localControl).not.toContain('https://app.agentmail.to')
    expect(localControl).toContain('https://mcp.agentmail.to/mcp')
    expect(actions).toContain('AgentMail Console opened in a new tab')
    expect(actions).not.toContain('Connect HTML')
    expect(actions).not.toContain('Open HTML Console')
    expect(page).not.toContain('localhost as the primary')
    expect(page).toContain('Outbound email remains approval-gated')
    expect(gateway).toContain("ui: enabled('/agentmail')")
  })

  it('hydrates sync preview actions from live AgentMail inbox listing when runtime credentials exist', () => {
    const syncRoute = readFileSync(path.join(process.cwd(), 'src/app/api/agentmail/connect/sync/route.ts'), 'utf8')
    const previewRoute = readFileSync(path.join(process.cwd(), 'src/app/api/agentmail/connect/provision-preview/route.ts'), 'utf8')
    const actions = readFileSync(path.join(process.cwd(), 'src/app/agentmail/AgentMailConnectActions.tsx'), 'utf8')

    expect(syncRoute).toContain('listAgentMailBootstrapInboxes')
    expect(previewRoute).toContain('buildAgentMailInboxProvisioningPreview')
    expect(actions).toContain('live_inboxes=')
  })

})
