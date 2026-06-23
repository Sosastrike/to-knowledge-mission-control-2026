import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_INTERFACE_LINKS, agentControlLinksFor } from '@/components/gateway/GatewayShell'
import { gatewayActionForButton } from '@/components/gateway/gateway-actions'

describe('Ron Weasley Agent Hub UI proxy', () => {
  it('exposes Ron Weasley Open UI through the authenticated Mission Control shared durable workspace', () => {
    const ron = AGENT_INTERFACE_LINKS.find((agent) => agent.name === 'Ron Weasley')

    expect(ron).toBeDefined()
    expect(ron?.buttons.ui).toMatchObject({
      enabled: true,
      href: '/gateway/agents/hermes/jobs',
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
      href: '/gateway/agents/hermes/jobs',
    })
    expect(ron?.proxyRoute).toContain('/api/bridge/hermes/webui/status')
    expect(ron?.nextFix).toContain('/gateway/agents/hermes/jobs')
  })

  it('routes design-surface Ron Weasley Open UI clicks to the shared durable workspace', () => {
    const action = gatewayActionForButton({
      label: 'Open UI',
      pageTitle: 'Agent Hub',
      nearbyText: 'Ron Weasley Nuclear Dispatcher command center',
    })

    expect(action).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agents/hermes/jobs',
    })
  })

  it('keeps Ron Weasley WebUI, command-center, and blocked-chat buttons distinct on legacy Hermes routes', () => {
    const links = agentControlLinksFor('hermes')

    expect(links.ui).toMatchObject({ enabled: true, href: '/gateway/agents/hermes/jobs' })
    expect(links.config).toMatchObject({ enabled: true, href: '/gateway/agent-hub/ron/config' })
    expect(links.brain).toMatchObject({ enabled: true, href: '/gateway/agent-hub/ron/brain-map' })
    expect(links.chat).toMatchObject({ enabled: true, href: '/gateway/agents/hermes/jobs' })
    expect(links.tools).toMatchObject({ enabled: true, href: '/gateway/agent-hub/ron/tool-map' })
    expect(links.health).toMatchObject({ enabled: true, href: '/gateway/agent-hub/ron/status' })
  })

  it('describes Ron Weasley chat as the authenticated shared durable workspace without fake test-chat copy', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/gateway/GatewayShell.tsx'), 'utf8')

    expect(source).toContain('Ron Weasley WebUI')
    expect(source).toContain('/gateway/agents/hermes/jobs')
    expect(source.toLowerCase()).not.toContain('fake test chat')
  })

  it('exposes Pi, SpaceAgent, and Paperclip through owner-openable Mission Control localhost surfaces', () => {
    const byName = new Map(AGENT_INTERFACE_LINKS.map((agent) => [agent.name, agent]))

    expect(byName.get('Pi')).toMatchObject({
      localUrl: null,
      tailnetUrl: null,
      buttons: {
        ui: { enabled: true, href: '/gateway/agent-hub/pi/config' },
        chat: { enabled: true, href: '/gateway/agent-hub/pi/recommend' },
      },
    })

    expect(byName.get('SpaceAgent')).toMatchObject({
      localUrl: null,
      tailnetUrl: null,
      buttons: {
        ui: { enabled: true, href: '/gateway/agent-hub/spaceagent/config' },
        chat: { enabled: true, href: '/gateway/agent-hub/spaceagent/research' },
      },
    })

    expect(byName.get('Paperclip')).toMatchObject({
      localUrl: null,
      tailnetUrl: 'http://100.116.35.95:3100/ECO/dashboard',
      buttons: {
        ui: { enabled: true, href: '/gateway/agent-hub/paperclip/ui' },
      },
    })
  })

  it('routes design-surface Open UI clicks for Pi, SpaceAgent, and Paperclip to human Gateway pages', () => {
    expect(gatewayActionForButton({
      label: 'Open UI',
      pageTitle: 'Agent Hub',
      nearbyText: 'Pi route optimizer Gateway inventory',
    })).toMatchObject({
      kind: 'status',
      endpoint: '/api/bridge/pi/status',
    })

    expect(gatewayActionForButton({
      label: 'Open UI',
      pageTitle: 'Agent Hub',
      nearbyText: 'SpaceAgent browser research direct line',
    })).toMatchObject({
      kind: 'status',
      endpoint: '/api/bridge/space-agent/status',
    })

    expect(gatewayActionForButton({
      label: 'Open UI',
      pageTitle: 'Agent Hub',
      nearbyText: 'Paperclip workforce control plane',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/paperclip/ui',
    })
  })
})
