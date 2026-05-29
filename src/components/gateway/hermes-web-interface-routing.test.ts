import { describe, expect, it } from 'vitest'

import { AGENT_INTERFACE_LINKS, agentControlLinksFor, controlViewFromPath, gatewayActionForButton } from './GatewayShell'
import { attachGatewayActionHandler } from './gateway-actions'

describe('Ron Weasley WebUI Gateway routing', () => {
  it('resolves every required Ron Weasley Mission Control page to the legacy Hermes control surface', () => {
    for (const [path, mode] of [
      ['/gateway/agent-hub/hermes', 'overview'],
      ['/gateway/agent-hub/ron', 'overview'],
      ['/gateway/agent-hub/hermes/config', 'config'],
      ['/gateway/agent-hub/ron/config', 'config'],
      ['/gateway/agent-hub/hermes/status', 'status'],
      ['/gateway/agent-hub/ron/status', 'status'],
      ['/gateway/agent-hub/hermes/routes', 'routes'],
      ['/gateway/agent-hub/hermes/brain-map', 'brain-map'],
      ['/gateway/agent-hub/hermes/tool-map', 'tool-map'],
      ['/gateway/agent-hub/hermes/skill-registry', 'skill-registry'],
      ['/gateway/agent-hub/hermes/mini-agent-registry', 'mini-agent-registry'],
      ['/gateway/agent-hub/hermes/pipelines', 'pipelines'],
      ['/gateway/agent-hub/hermes/tasks', 'tasks'],
      ['/gateway/agent-hub/hermes/logs', 'logs'],
      ['/gateway/agent-hub/hermes/dispatch-plan', 'dispatch-plan'],
      ['/gateway/agent-hub/hermes/jarvis-concurrence', 'jarvis-concurrence'],
    ] as const) {
      expect(controlViewFromPath(path, null), path).toMatchObject({
        kind: 'agent',
        slug: 'hermes',
        mode,
      })
    }
  })

  it('routes Ron Weasley buttons to real Mission Control pages instead of raw JSON or fake handlers', () => {
    for (const [label, href] of [
      ['Open UI', '/gateway/agent-hub/ron/webui/app'],
      ['Open command center', '/gateway/agent-hub/ron/config'],
      ['Status', '/gateway/agent-hub/ron/status'],
      ['Brain Map', '/gateway/agent-hub/ron/brain-map'],
      ['Tool Map', '/gateway/agent-hub/ron/tool-map'],
      ['Skill Registry', '/gateway/agent-hub/ron/skill-registry'],
      ['Mini-Agent Registry', '/gateway/agent-hub/ron/mini-agent-registry'],
      ['Dispatch Plan', '/gateway/agent-hub/ron/dispatch-plan'],
      ['Request Jarvis Concurrence', '/gateway/agent-hub/ron/jarvis-concurrence'],
      ['View Pipeline', '/gateway/agent-hub/ron/pipelines'],
      ['View Audit', '/gateway/agent-hub/ron/logs'],
    ] as const) {
      expect(gatewayActionForButton({
        label,
        pageTitle: 'Agent Hub · Control Center',
        nearbyText: 'Ron Weasley Nuclear Dispatcher under Jarvis',
      }), label).toMatchObject({
        kind: 'navigate',
        href,
      })
    }
  })

  it('separates Ron Weasley WebUI, command center, and direct-line chat button states', () => {
    const buttons = agentControlLinksFor('hermes')

    expect(buttons.ui).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/ron/webui/app',
    })
    expect(buttons.ui.href).not.toBe('/gateway/agent-hub/hermes/config')
    expect(buttons.config).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/ron/config',
    })
    expect(buttons.chat).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/ron/webui/app',
    })
  })

  it('uses owner-openable Tailnet/proxy URLs instead of server-local localhost buttons', () => {
    const agentZero = AGENT_INTERFACE_LINKS.find((agent) => agent.name === 'Agent Zero')
    const ron = AGENT_INTERFACE_LINKS.find((agent) => agent.name === 'Ron Weasley')

    expect(agentZero?.tailnetUrl).toBe('http://100.116.35.95:50080/')
    expect(agentZero?.buttons.ui).toMatchObject({
      enabled: true,
      href: 'http://100.116.35.95:50080/',
    })
    expect(JSON.stringify(agentZero?.buttons)).not.toMatch(/localhost|127\.0\.0\.1/)

    expect(ron?.localUrl).toBeNull()
    expect(ron?.buttons.ui).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/ron/webui/app',
    })
    expect(`${ron?.blocker} ${ron?.nextFix}`).toContain('localhost is server-local')
    expect(JSON.stringify(ron?.buttons)).not.toMatch(/localhost|127\.0\.0\.1/)
  })

  it('routes Paperclip Open UI to the workspace selector instead of a stuck status panel or one-company shortcut', () => {
    const buttons = agentControlLinksFor('paperclip')
    const paperclip = AGENT_INTERFACE_LINKS.find((agent) => agent.name === 'Paperclip')

    expect(buttons.ui).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/paperclip/ui',
    })
    expect(paperclip?.buttons.ui).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/paperclip/ui',
    })
    expect(controlViewFromPath('/gateway/agent-hub/paperclip', null)).toMatchObject({
      kind: 'agent',
      slug: 'paperclip',
      mode: 'ui',
    })
    expect(controlViewFromPath('/gateway/agent-hub/paperclip/ui', null)).toMatchObject({
      kind: 'agent',
      slug: 'paperclip',
      mode: 'ui',
    })
    expect(gatewayActionForButton({
      label: 'Open UI',
      pageTitle: 'Agent Hub · Control Center',
      nearbyText: 'Paperclip Workforce Control Plane',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/paperclip/ui',
    })
  })

  it('keeps Paperclip Open UI on the Paperclip host even when the Agent Hub card text also mentions Ron Weasley', () => {
    expect(gatewayActionForButton({
      label: 'Open UI',
      pageTitle: 'Agent Hub · Control Center',
      nearbyText: [
        'Paperclip Workforce Control Plane',
        'Owner URL http://100.116.35.95:3100/ECO/dashboard',
        'Ron Weasley builds skills and workflows for the wider system.',
      ].join(' · '),
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/paperclip/ui',
    })
  })

  it('routes legacy Agent Hub Open localhost buttons to real owner-accessible surfaces', () => {
    expect(gatewayActionForButton({
      label: 'Open localhost',
      pageTitle: 'Agent Hub · Control Center',
      nearbyText: 'Ron Weasley Nuclear Dispatcher Skill and Workflow Builder',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/ron/webui/app',
    })

    expect(gatewayActionForButton({
      label: 'Open localhost',
      pageTitle: 'Agent Hub · Control Center',
      nearbyText: 'Agent Zero Commander',
    })).toMatchObject({
      kind: 'openExternal',
      href: 'http://100.116.35.95:50080/',
    })
  })

  it('delegates Agent Hub iframe clicks for buttons rendered after initial wiring', () => {
    type ClickHandler = (event: {
      target: unknown
      preventDefault: () => void
      stopPropagation: () => void
      stopImmediatePropagation: () => void
    }) => void

    let clickHandler: ClickHandler | undefined
    const opened: string[] = []
    const globalWithWindow = globalThis as unknown as { window?: unknown }
    const previousWindow = globalWithWindow.window
    const makeNode = () => ({
      className: '',
      href: '',
      id: '',
      rel: '',
      style: {} as Record<string, string>,
      target: '',
      textContent: '',
      replaceChildren() {},
    })
    const card = { textContent: 'Agent Zero Commander' }
    const button = {
      textContent: 'Open UI',
      parentElement: card,
      closest: (selector: string) => selector === 'button' ? button : card,
      matches: () => false,
    }
    const doc = {
      title: 'Agent Hub · Control Center',
      body: { appendChild() {} },
      documentElement: { dataset: {} },
      head: { appendChild() {} },
      addEventListener: (_type: string, handler: ClickHandler) => {
        clickHandler = handler
      },
      contains: (node: unknown) => node === button,
      createElement: makeNode,
      getElementById: () => null,
    }
    const ownerWindow = {
      location: { href: '' },
      open: (href: string) => {
        opened.push(href)
        return { opener: null, focus() {} }
      },
    }

    globalWithWindow.window = ownerWindow
    try {
      const iframe = {
        contentDocument: doc,
        contentWindow: ownerWindow,
      } as unknown as HTMLIFrameElement
      attachGatewayActionHandler(iframe)

      const handler = clickHandler as ClickHandler | undefined
      expect(handler).toBeTypeOf('function')
      handler?.({
        target: button,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
      })

      expect(opened).toEqual(['http://100.116.35.95:50080/'])
    } finally {
      globalWithWindow.window = previousWindow
    }
  })
})
