import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

import { AGENT_INTERFACE_LINKS, agentControlLinksFor, controlViewFromPath, gatewayActionForButton } from './GatewayShell'
import { attachGatewayActionHandler } from './gateway-actions'

describe('Ron Weasley WebUI Gateway routing', () => {
  it('resolves every required Ron Weasley Mission Control page to the Hermes control surface', () => {
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

  it('cuts the owner-facing Ron WebUI app route over to the shared Hermes durable job workspace', () => {
    expect(controlViewFromPath('/gateway/agent-hub/ron/webui/app', null)).toMatchObject({
      kind: 'platform-job',
      agentId: 'hermes',
    })
    expect(controlViewFromPath('/gateway/agent-hub/hermes/webui/app', null)).toMatchObject({
      kind: 'platform-job',
      agentId: 'hermes',
    })
    expect(controlViewFromPath('/gateway/agents/hermes/jobs/job_123', null)).toMatchObject({
      kind: 'platform-job',
      agentId: 'hermes',
      jobId: 'job_123',
    })
  })

  it('routes Ron Weasley buttons to real Mission Control pages instead of raw JSON or fake handlers', () => {
    for (const [label, href] of [
      ['Open UI', '/gateway/agents/hermes/jobs'],
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
      href: '/gateway/agents/hermes/jobs',
    })
    expect(buttons.ui.href).not.toBe('/gateway/agent-hub/hermes/config')
    expect(buttons.config).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/ron/config',
    })
    expect(buttons.chat).toMatchObject({
      enabled: true,
      href: '/gateway/agents/hermes/jobs',
    })
  })

  it('exposes the authenticated Ron Mission Control proxy proof action in Ron status surfaces', () => {
    const source = readFileSync('src/components/gateway/GatewayShell.tsx', 'utf8')

    expect(source).toContain('Run Ron Proxy Proof')
    expect(source).toContain('/api/bridge/ron/runtime-proof')
    expect(source).toContain('run_mission_control_proxy_proof')
    expect(source).toContain('session_id_value_exposed')
    expect(source).toContain('tokens_cookies_exposed')
    expect(source).toContain('OpenCloud / OpenClaw intermediary')
  })

  it('uses authenticated Mission Control routes for Agent Zero owner-facing UI', () => {
    const agentZero = AGENT_INTERFACE_LINKS.find((agent) => agent.name === 'Agent Zero')
    const ron = AGENT_INTERFACE_LINKS.find((agent) => agent.name === 'Ron Weasley')

    expect(agentZero?.tailnetUrl).toBeNull()
    expect(agentZero?.buttons.ui).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/agent-zero/chat',
    })
    expect(JSON.stringify(agentZero?.buttons)).not.toMatch(/localhost|127\.0\.0\.1|100\.116\.35\.95:50080/)

    expect(ron?.localUrl).toBeNull()
    expect(ron?.buttons.ui).toMatchObject({
      enabled: true,
      href: '/gateway/agents/hermes/jobs',
    })
    expect(`${ron?.localBind} ${ron?.port} ${ron?.blocker} ${ron?.nextFix}`).not.toMatch(/localhost|127\.0\.0\.1|100\.116\.35\.95:50080/)
    expect(JSON.stringify(ron?.buttons)).not.toMatch(/localhost|127\.0\.0\.1/)
  })

  it('does not let query parameters override the trusted Agent Zero shell destination', () => {
    expect(controlViewFromPath('/gateway/agent-hub/agent-zero/chat?upstream=http://100.116.35.95:50080', null)).toMatchObject({
      kind: 'agent',
      slug: 'agent-zero',
      mode: 'chat',
    })
    expect(gatewayActionForButton({
      label: 'Open UI',
      pageTitle: 'Agent Hub · Control Center',
      nearbyText: 'Agent Zero Commander upstream=http://100.116.35.95:50080',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/agent-zero/chat',
    })
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
      href: '/gateway/agents/hermes/jobs',
    })

    expect(gatewayActionForButton({
      label: 'Open localhost',
      pageTitle: 'Agent Hub · Control Center',
      nearbyText: 'Agent Zero Commander',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/agent-zero/chat',
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

      expect(opened).toEqual([])
      expect(ownerWindow.location.href).toBe('/gateway/agent-hub/agent-zero/chat')
    } finally {
      globalWithWindow.window = previousWindow
    }
  })
})
