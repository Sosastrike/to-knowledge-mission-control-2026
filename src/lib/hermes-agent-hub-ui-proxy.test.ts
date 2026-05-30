import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_INTERFACE_LINKS, agentControlLinksFor } from '@/components/gateway/GatewayShell'
import { gatewayActionForButton } from '@/components/gateway/gateway-actions'

describe('Ron Weasley Agent Hub UI proxy', () => {
  it('exposes Ron Weasley Open UI through the authenticated Mission Control WebUI proxy', () => {
    const ron = AGENT_INTERFACE_LINKS.find((agent) => agent.name === 'Ron Weasley')

    expect(ron).toBeDefined()
    expect(ron?.buttons.ui).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/ron/webui/app',
    })
    expect(ron?.buttons.config).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/ron/config',
    })
    expect(ron?.buttons.tools).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/ron/tool-map',
    })
    expect(ron?.buttons.health).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/ron/status',
    })
    expect(ron?.buttons.chat).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/ron/webui/app',
    })
    expect(ron?.localUrl).toBeNull()
    expect(ron?.nextFix).toContain('/gateway/agent-hub/ron/webui')
    expect(`${ron?.blocker} ${ron?.nextFix}`).toContain('localhost is server-local')
  })

  it('routes design-surface Ron Weasley Open UI clicks to the WebUI proxy surface', () => {
    const action = gatewayActionForButton({
      label: 'Open UI',
      pageTitle: 'Agent Hub',
      nearbyText: 'Ron Weasley Nuclear Dispatcher command center',
    })

    expect(action).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/ron/webui/app',
    })
  })

  it('keeps Ron Weasley WebUI, command-center, and chat buttons distinct on legacy Hermes routes', () => {
    const links = agentControlLinksFor('hermes')

    expect(links.ui).toMatchObject({ enabled: true, href: '/gateway/agent-hub/ron/webui/app' })
    expect(links.config).toMatchObject({ enabled: true, href: '/gateway/agent-hub/ron/config' })
    expect(links.brain).toMatchObject({ enabled: true, href: '/gateway/agent-hub/ron/brain-map' })
    expect(links.chat).toMatchObject({ enabled: true, href: '/gateway/agent-hub/ron/webui/app' })
    expect(links.tools).toMatchObject({ enabled: true, href: '/gateway/agent-hub/ron/tool-map' })
    expect(links.health).toMatchObject({ enabled: true, href: '/gateway/agent-hub/ron/status' })
  })

  it('describes the installed WebUI proxy chat honestly without fake test-chat copy', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/gateway/GatewayShell.tsx'), 'utf8')

    expect(source).toContain('Ron Weasley Direct-Line Chat Installed')
    expect(source).toContain('Use the Ron WebUI proxy for direct-line chat')
    expect(source.toLowerCase()).not.toContain('fake test chat')
  })
})
