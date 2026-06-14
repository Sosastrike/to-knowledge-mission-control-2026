// Parity tests for GatewayShell. The point is to prove three contracts the
// owner-facing UI must always honour:
//   1. Every GATEWAY_TABS entry points at a real file under public/design/gateway/.
//   2. iframeSrcFor returns a basePath-aware, URL-encoded path (D5).
//   3. activeTabFrom resolves both deep-link segments and ?tab= query.
// These tests do NOT spin up Next or React — they exercise the pure helpers
// exported from the shell so they run in plain vitest without a JSDOM dep.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  AGENT_INTERFACE_LINKS,
  GATEWAY_TABS,
  activeTabFrom,
  controlViewFromPath,
  gatewayActionForButton,
  iframeSrcFor,
  type GatewayTab,
} from '../src/components/gateway/GatewayShell'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const MOCKS_ROOT = join(HERE, '..', 'public', 'design', 'gateway')
const GATEWAY_SHELL_SOURCE = readFileSync(
  join(HERE, '..', 'src', 'components', 'gateway', 'GatewayShell.tsx'),
  'utf8',
)
const GATEWAY_OVERVIEW_SOURCE = readFileSync(join(MOCKS_ROOT, 'Gateway Overview.html'), 'utf8')
const GATEWAY_DATA_SOURCE = readFileSync(join(MOCKS_ROOT, 'shared', 'gateway-data.js'), 'utf8')

function searchParamsOf(qs: string): URLSearchParams {
  return new URLSearchParams(qs)
}

describe('GATEWAY_TABS — contract with the static mocks', () => {
  it('declares exactly ten owner-facing sub-tabs (D7)', () => {
    expect(GATEWAY_TABS.length).toBe(10)
  })

  it('every tab points at a file that exists on disk', () => {
    for (const tab of GATEWAY_TABS) {
      const abs = join(MOCKS_ROOT, tab.src)
      expect(existsSync(abs), `missing mock for tab ${tab.id} → ${tab.src}`).toBe(true)
    }
  })

  it('tab ids and segs are unique', () => {
    const ids = new Set(GATEWAY_TABS.map((t) => t.id))
    const segs = new Set(GATEWAY_TABS.map((t) => t.seg))
    expect(ids.size).toBe(GATEWAY_TABS.length)
    expect(segs.size).toBe(GATEWAY_TABS.length)
  })

  it('Overview is the canonical first tab', () => {
    expect(GATEWAY_TABS[0].id).toBe('overview')
  })
})

describe('iframeSrcFor — URL encoding (D5) + basePath', () => {
  const overview: GatewayTab = GATEWAY_TABS.find((t) => t.id === 'overview')!
  const agentHub: GatewayTab = GATEWAY_TABS.find((t) => t.id === 'agent-hub')!

  it('keeps designer filenames with spaces intact at the storage layer', () => {
    expect(agentHub.src).toBe('Agent Hub.html')
  })

  it('encodes spaces in the URL it hands to the iframe', () => {
    expect(iframeSrcFor(agentHub)).toBe('/design/gateway/Agent%20Hub.html')
    expect(iframeSrcFor(overview)).toBe('/design/gateway/Gateway%20Overview.html')
  })

  it('passes the Zapier trace query only to Gateway Overview', () => {
    expect(iframeSrcFor(overview, searchParamsOf('trace=zapier'))).toBe('/design/gateway/Gateway%20Overview.html?trace=zapier')
    expect(iframeSrcFor(agentHub, searchParamsOf('trace=zapier'))).toBe('/design/gateway/Agent%20Hub.html')
  })

  it('never emits a leading double slash', () => {
    for (const t of GATEWAY_TABS) {
      const src = iframeSrcFor(t)
      expect(src.startsWith('//')).toBe(false)
      expect(src.startsWith('/design/gateway/')).toBe(true)
    }
  })

  it('never leaks an absolute filesystem path', () => {
    for (const t of GATEWAY_TABS) {
      const src = iframeSrcFor(t)
      expect(src).not.toMatch(/^\/Users\//)
      expect(src).not.toMatch(/^\/home\//)
      expect(src).not.toMatch(/^\/Volumes\//)
    }
  })
})

describe('Gateway Overview Zapier visual wire contract', () => {
  it('keeps the canonical Agent Zero to Zapier edge in graph data', () => {
    expect(GATEWAY_DATA_SOURCE).toContain("from: 'agent.zero', to: 'int.zapier'")
    expect(GATEWAY_DATA_SOURCE).toContain("status: 'green'")
    expect(GATEWAY_DATA_SOURCE).toContain('Certified exact-scope Zapier actions are available.')
    expect(GATEWAY_DATA_SOURCE).toContain('guardrail_reason')
    expect(GATEWAY_DATA_SOURCE).not.toContain("int.zapier',       name: 'Zapier',            type: 'tool',    lane: 'right_integration', status: 'yellow'")
    expect(GATEWAY_DATA_SOURCE).not.toContain('zapier_credential_required')
    expect(GATEWAY_DATA_SOURCE).not.toContain('adapter_missing')
  })

  it('renders trace hooks and owner graph controls for the Zapier wire', () => {
    expect(GATEWAY_OVERVIEW_SOURCE).toContain("data-from")
    expect(GATEWAY_OVERVIEW_SOURCE).toContain("data-to")
    expect(GATEWAY_OVERVIEW_SOURCE).toContain("edge.from === 'agent.zero' && edge.to === 'int.zapier'")
    expect(GATEWAY_OVERVIEW_SOURCE).toContain('zapier-link')
    expect(GATEWAY_OVERVIEW_SOURCE).toContain('Fit Graph')
    expect(GATEWAY_OVERVIEW_SOURCE).toContain('Center Gateway')
    expect(GATEWAY_OVERVIEW_SOURCE).toContain('Trace Zapier')
    expect(GATEWAY_OVERVIEW_SOURCE).toContain('data-trace-target="zapier"')
  })

  it('exposes a Gateway shell link to the Zapier trace view', () => {
    expect(GATEWAY_SHELL_SOURCE).toContain('/gateway/overview?trace=zapier')
    expect(GATEWAY_SHELL_SOURCE).toContain('Trace Zapier Wire')
    expect(GATEWAY_SHELL_SOURCE).toContain('gateway-trace-zapier-link')
  })
})

describe('activeTabFrom — URL → tab resolution', () => {
  it('falls back to Overview when nothing matches', () => {
    expect(activeTabFrom('/', null).id).toBe('overview')
    expect(activeTabFrom('/gateway', null).id).toBe('overview')
    expect(activeTabFrom('/gateway', searchParamsOf('')).id).toBe('overview')
  })

  it('resolves ?tab=<id> query form', () => {
    expect(activeTabFrom('/gateway', searchParamsOf('tab=agent-hub')).id).toBe('agent-hub')
    expect(activeTabFrom('/gateway', searchParamsOf('tab=governor')).id).toBe('governor')
  })

  it('resolves /gateway/<seg> path form', () => {
    expect(activeTabFrom('/gateway/dispatcher', null).id).toBe('dispatcher')
    expect(activeTabFrom('/gateway/token-governor', null).id).toBe('governor')
    expect(activeTabFrom('/gateway/bridge-session', null).id).toBe('bridge')
  })

  it('resolves /gateway/agent-hub/paperclip drill-down', () => {
    expect(activeTabFrom('/gateway/agent-hub/paperclip', null).id).toBe('paperclip')
  })

  it('?tab= wins over path when both are present (legacy precedence)', () => {
    expect(
      activeTabFrom('/gateway/dispatcher', searchParamsOf('tab=agent-hub')).id,
    ).toBe('agent-hub')
  })

  it('ignores unknown tab ids and segments', () => {
    expect(activeTabFrom('/gateway/does-not-exist', null).id).toBe('overview')
    expect(activeTabFrom('/gateway', searchParamsOf('tab=garbage')).id).toBe('overview')
  })
})

describe('gatewayActionForButton — runtime wiring for designer mock buttons', () => {
  it('routes Agent Zero hero buttons to live owner surfaces', () => {
    expect(gatewayActionForButton({ label: 'Open chat', pageTitle: 'Agent Zero · Commander' })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/agent-zero/chat',
    })
    expect(gatewayActionForButton({ label: 'View audit', pageTitle: 'Agent Zero · Commander' })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/health',
    })
  })

  it('routes delegate open buttons to the matching Gateway pages', () => {
    expect(gatewayActionForButton({ label: 'open', nearbyText: 'Hermes · Nuclear Dispatcher · Jarvis concurrence required' })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/ron/webui/app',
    })
    expect(gatewayActionForButton({ label: 'open', nearbyText: 'Build-Wiki worker · workflow runner OpenCloud n8n' })).toMatchObject({
      kind: 'frame',
      href: '/design/gateway/OpenCloud%20Workers.html',
    })
    expect(gatewayActionForButton({ label: 'memory', nearbyText: 'Tony · retired commander memory inheritance only · read-only' })).toMatchObject({
      kind: 'frame',
      href: '/design/gateway/Brain%20Systems.html',
    })
  })

  it('maps Delivery Connector Open/Test buttons to readiness probes instead of no-ops', () => {
    expect(gatewayActionForButton({
      label: 'Open',
      pageTitle: 'Delivery · Connectors',
      nearbyText: 'AgentMail Primary mail client. Send/receive/draft/list. AZ-only for sends; Hermes can draft.',
    })).toMatchObject({
      kind: 'status',
      endpoint: '/api/bridge/agentmail-readiness',
    })
    expect(gatewayActionForButton({ label: 'Test', nearbyText: 'Firecrawl Web fetch' })).toMatchObject({
      kind: 'status',
      endpoint: '/api/firecrawl/status',
    })
    expect(gatewayActionForButton({ label: 'Configure', nearbyText: 'Slack Team channel posts' })).toMatchObject({
      kind: 'gated',
    })
  })

  it('opens proven owner UI links directly instead of routing them through Bridge Session', () => {
    expect(gatewayActionForButton({
      label: 'Open localhost',
      pageTitle: 'Agent Hub · Control Center',
      nearbyText: 'Agent Zero Commander owner UI restored',
    })).toMatchObject({
      kind: 'openExternal',
      href: 'http://100.116.35.95:50080/',
    })
    expect(gatewayActionForButton({
      label: 'Open in new tab',
      pageTitle: 'Paperclip',
      nearbyText: 'Paperclip workforce control plane Tailnet UI reachable',
    })).toMatchObject({
      kind: 'openExternal',
      href: '/gateway/agent-hub/paperclip/ui',
    })
    expect(gatewayActionForButton({
      label: 'Open localhost',
      pageTitle: 'Agent Hub · Control Center',
      nearbyText: 'Owner → Gateway → Agent Zero / Pi / Hermes → Paperclip workforce control plane',
    })).toMatchObject({
      kind: 'openExternal',
      href: '/gateway/agent-hub/paperclip/ui',
    })
    expect(gatewayActionForButton({
      label: 'Open UI',
      nearbyText: 'OpenClaw+ tunnel live owner tunnel',
    })).toMatchObject({
      kind: 'openExternal',
      href: 'http://127.0.0.1:18789/',
    })
  })

  it('keeps protected execution verbs behind Bridge Session', () => {
    for (const label of ['Send command', 'Upload report', 'Write memory', 'Execute workflow', 'Run now', 'Generate PDF', 'Start', 'Stop', 'Restart', 'Deploy']) {
      expect(gatewayActionForButton({ label, nearbyText: 'protected owner action' })).toMatchObject({
        kind: 'gated',
      })
    }
  })

  it('routes owner control buttons to human Gateway pages instead of raw JSON APIs', () => {
    expect(gatewayActionForButton({
      label: 'Open Config',
      nearbyText: 'Hermes lieutenant service active owner proxy not wired',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/hermes/config',
    })
    expect(gatewayActionForButton({
      label: 'Open Chat',
      nearbyText: 'Agent Zero commander UI restored',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/agent-zero/chat',
    })
    expect(gatewayActionForButton({
      label: 'Open Tools',
      nearbyText: 'SpaceAgent Playwright Firecrawl YouTube',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/tools',
    })
    expect(gatewayActionForButton({
      label: 'Open Tools',
      nearbyText: 'Paperclip workforce control plane company claim required',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/paperclip/tools',
    })
    expect(gatewayActionForButton({
      label: 'Health',
      nearbyText: 'Paperclip workforce control plane Tailnet UI reachable',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/paperclip/status',
    })
    expect(gatewayActionForButton({
      label: 'Status only',
      nearbyText: 'Paperclip workforce control plane Tailnet UI reachable',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/paperclip/status',
    })
    expect(gatewayActionForButton({
      label: 'Audit',
      nearbyText: 'Paperclip workforce control plane Tailnet UI reachable',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/paperclip/audit',
    })
    expect(gatewayActionForButton({
      label: 'Help',
      nearbyText: 'Paperclip workforce control plane Tailnet UI reachable',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/paperclip/help',
    })
    expect(gatewayActionForButton({
      label: 'Telegram Agent',
      nearbyText: 'Paperclip workforce control plane Tailnet UI reachable',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/paperclip/telegram-agent',
    })
    expect(gatewayActionForButton({
      label: 'Open Recommendations',
      nearbyText: 'Pi route optimizer Gateway inventory',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/pi/recommend',
    })
    expect(gatewayActionForButton({
      label: 'Recheck health',
      nearbyText: 'Paperclip workforce control plane Tailnet UI reachable',
    })).toMatchObject({
      kind: 'status',
      endpoint: '/api/bridge/paperclip/status',
    })
  })
})

describe('controlViewFromPath — Paperclip normalized owner routes', () => {
  it('normalizes the stale /gateway/agents/paperclip route to the readable Paperclip status page', () => {
    expect(controlViewFromPath('/gateway/agents/paperclip', null)).toMatchObject({
      kind: 'agent',
      slug: 'paperclip',
      mode: 'status',
    })
    expect(controlViewFromPath('/gateway/agent-hub/paperclip', null)).toMatchObject({
      kind: 'agent',
      slug: 'paperclip',
      mode: 'status',
    })
  })

  it('supports the full Paperclip ECO control route map', () => {
    for (const mode of ['config', 'ui', 'status', 'tools', 'companies', 'agents', 'issues', 'audit', 'help', 'telegram-agent']) {
      expect(controlViewFromPath(`/gateway/agent-hub/paperclip/${mode}`, null)).toMatchObject({
        kind: 'agent',
        slug: 'paperclip',
        mode,
      })
    }
  })
})

describe('AGENT_INTERFACE_LINKS — owner access control center', () => {
  const requiredSurfaces = [
    'Agent Zero',
    'Ron Weasley',
    'Pi',
    'SpaceAgent',
    'Paperclip',
    'OpenClaw+',
    'Playwright MCP',
    'Firecrawl',
    'YouTube',
    'Bridge Session',
    'Telegram',
    'AgentMail',
    'Zapier',
    'Google Drive',
    'OneDrive',
  ]

  it('contains every required agent and supporting surface exactly once', () => {
    expect(AGENT_INTERFACE_LINKS.map((row) => row.name)).toEqual(requiredSurfaces)
  })

  it('exposes the full owner access control contract for every row', () => {
    for (const row of AGENT_INTERFACE_LINKS) {
      expect(row.buttons).toHaveProperty('ui')
      expect(row.buttons).toHaveProperty('config')
      expect(row.buttons).toHaveProperty('brain')
      expect(row.buttons).toHaveProperty('chat')
      expect(row.buttons).toHaveProperty('tools')
      expect(row.buttons).toHaveProperty('health')
      expect(row.proxyRoute).toMatch(/^\/|^$/)
      expect(row.authRequired).toBe(true)
      expect(row.status.length).toBeGreaterThan(0)
      expect((row.blocker || row.guardrail || '').length).toBeGreaterThan(0)
      expect(row.nextFix.length).toBeGreaterThan(0)
      expect(row.proxyRoute).not.toBe('/api/spaceagent/status')
    }
  })

  it('does not fake local/Tailnet URLs for blocked or local-only services', () => {
    const byName = new Map(AGENT_INTERFACE_LINKS.map((row) => [row.name, row]))
    expect(byName.get('Agent Zero')?.buttons.ui).toMatchObject({
      enabled: true,
      href: 'http://100.116.35.95:50080/',
    })
    expect(byName.get('Agent Zero')?.tailnetUrl).toBe('http://100.116.35.95:50080/')
    expect(byName.get('Agent Zero')?.blocker).toContain('owner_hard_stops_only_remaining')
    expect(byName.get('Ron Weasley')?.tailnetUrl).toBeNull()
    expect(byName.get('Playwright MCP')?.tailnetUrl).toBeNull()
    expect(byName.get('Playwright MCP')?.localUrl).toBe('server-local only: 127.0.0.1:8931')
    expect(byName.get('Paperclip')?.buttons.ui).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/paperclip/ui',
    })
    expect(byName.get('Paperclip')?.buttons.health).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/paperclip/status',
    })
  })

  it('maps enabled Health buttons to readable Gateway status panels, not raw JSON or HTML assets', () => {
    for (const row of AGENT_INTERFACE_LINKS) {
      const health = row.buttons.health
      if (!health.enabled || !health.href) continue
      expect(health.href, `${row.name} health must be a human Gateway route`).toMatch(/^\/gateway\//)
      expect(health.href).not.toContain('.html')
      expect(health.href).not.toMatch(/^https?:\/\//)
      expect(health.href).not.toMatch(/^\/api\//)
    }
  })

  it('routes owner-facing Config/Tools actions to Gateway UI pages, not JSON APIs', () => {
    const byName = new Map(AGENT_INTERFACE_LINKS.map((row) => [row.name, row]))
    expect(byName.get('Agent Zero')?.buttons.config).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/agent-zero/config',
    })
    expect(byName.get('Ron Weasley')?.buttons.config).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/ron/config',
    })
    expect(byName.get('PI Dispatcher')?.buttons.config).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/pi/config',
    })
    expect(byName.get('SpaceAgent')?.buttons.config).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/spaceagent/config',
    })
    expect(byName.get('Paperclip')?.buttons.config).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/paperclip/config',
    })
    expect(byName.get('OpenClaw+')?.buttons.config).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/openclaw/config',
    })
    for (const row of AGENT_INTERFACE_LINKS) {
      const tools = row.buttons.tools
      if (!tools.enabled || !tools.href) continue
      if (row.name === 'Paperclip') {
        expect(tools.href, 'Paperclip tools should be a Paperclip-specific human UI wrapper').toBe('/gateway/agent-hub/paperclip/tools')
      } else {
        expect(tools.href, `${row.name} tools should be a human UI wrapper`).toBe('/gateway/tools')
      }
    }
  })

  it('exposes Pi, SpaceAgent, and Paperclip owner localhost/UI surfaces instead of disabled status-only rows', () => {
    const byName = new Map(AGENT_INTERFACE_LINKS.map((row) => [row.name, row]))

    expect(byName.get('PI Dispatcher')).toMatchObject({
      localUrl: 'http://127.0.0.1:3337/gateway/agent-hub/pi/config',
      tailnetUrl: 'http://100.116.35.95:3337/gateway/agent-hub/pi/config',
      buttons: {
        ui: { enabled: true, href: '/gateway/agent-hub/pi/config' },
        chat: { enabled: true, href: '/gateway/agent-hub/pi/recommend' },
      },
    })

    expect(byName.get('SpaceAgent')).toMatchObject({
      localUrl: 'http://127.0.0.1:3337/gateway/agent-hub/spaceagent/config',
      tailnetUrl: 'http://100.116.35.95:3337/gateway/agent-hub/spaceagent/config',
      buttons: {
        ui: { enabled: true, href: '/gateway/agent-hub/spaceagent/config' },
        chat: { enabled: true, href: '/gateway/agent-hub/spaceagent/research' },
      },
    })

    expect(byName.get('Paperclip')).toMatchObject({
      localUrl: 'http://127.0.0.1:3337/gateway/agent-hub/paperclip/ui',
      tailnetUrl: 'http://100.116.35.95:3100/ECO/dashboard',
      buttons: {
        ui: { enabled: true, href: '/gateway/agent-hub/paperclip/ui' },
      },
    })
  })

  it('uses the requested owner-facing truth table labels', () => {
    const byName = new Map(AGENT_INTERFACE_LINKS.map((row) => [row.name, row]))
    expect(byName.get('Agent Zero')?.status).toContain('exact-scope execution certified')
    expect(byName.get('Agent Zero')?.blocker).toContain('owner_hard_stops_only_remaining')
    expect(byName.get('Ron Weasley')?.status).toContain('FULL_ACCESS_DELEGATED')
    expect(byName.get('Ron Weasley')?.blocker).toContain('standalone_hermes_webui_proxy_required_if_8787_unreachable')
    expect(byName.get('PI Dispatcher')?.status).toContain('READ_ONLY / DISPATCHER REGISTERED')
    expect(byName.get('PI Dispatcher')?.blocker).toContain('protected_execution_requires_owner_scope')
    expect(byName.get('SpaceAgent')?.status).toContain('Mission Control UI ready')
    expect(byName.get('SpaceAgent')?.blocker).toContain('interactive_browser_actions_require_bridge_session')
    expect(byName.get('Paperclip')?.status).toContain('INSTALLED / READY')
    expect(byName.get('Paperclip')?.blocker).toContain('paperclip_writes_bridge_gated')
    expect(byName.get('OpenClaw+')?.status).toContain('tunnel live')
    expect(byName.get('OpenClaw+')?.blocker).toContain('openclaw_doctor_runtime_not_reachable')
  })

  it('routes Paperclip UI launches through workspace truth instead of a hard-coded ECO shortcut', () => {
    const paperclip = AGENT_INTERFACE_LINKS.find((row) => row.name === 'Paperclip')
    expect(paperclip?.buttons.ui).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/paperclip/ui',
    })
    expect(paperclip?.blocker).toContain('selector-backed')
    expect(GATEWAY_SHELL_SOURCE).toContain('PaperclipWorkspaceSelectorPanel')
    expect(GATEWAY_SHELL_SOURCE).toContain('/api/bridge/paperclip/workspace-truth')
    expect(GATEWAY_SHELL_SOURCE).toContain('data-testid="paperclip-workspace-selector"')
    expect(GATEWAY_SHELL_SOURCE).toContain('data-paperclip-hard-coded-eco-only')
    expect(GATEWAY_SHELL_SOURCE).toContain('data-paperclip-workspace-open-enabled')
    expect(GATEWAY_SHELL_SOURCE).not.toContain('ECO only for owner-facing Paperclip work')
  })
})

describe('AgentInterfaceInventory layout contract', () => {
  it('has visible collapse, expand, close, and reopen controls', () => {
    expect(GATEWAY_SHELL_SOURCE).toContain('data-testid="agent-interface-collapse"')
    expect(GATEWAY_SHELL_SOURCE).toContain('data-testid="agent-interface-expand"')
    expect(GATEWAY_SHELL_SOURCE).toContain('data-testid="agent-interface-close"')
    expect(GATEWAY_SHELL_SOURCE).toContain('data-testid="agent-interface-reopen"')
  })

  it('does not use an absolute desktop overlay for the owner interface links panel', () => {
    expect(GATEWAY_SHELL_SOURCE).not.toContain('.gateway-shell .agent-interface-panel{position:absolute')
    expect(GATEWAY_SHELL_SOURCE).toContain('.gateway-shell .gw-content')
    expect(GATEWAY_SHELL_SOURCE).toContain('.gateway-shell .gw-access-rail')
  })

  it('labels the owner rail as a functional Agent Control Center', () => {
    expect(GATEWAY_SHELL_SOURCE).toContain('Agent Control Center')
    expect(GATEWAY_SHELL_SOURCE).not.toContain('Owner Interface Links</span>')
  })

  it('contains readable owner panels for tools, config, chat, recommendations, and research', () => {
    expect(GATEWAY_SHELL_SOURCE).toContain('GatewayToolsPanel')
    expect(GATEWAY_SHELL_SOURCE).toContain('AgentControlPanel')
    expect(GATEWAY_SHELL_SOURCE).toContain('Chat / Test')
    expect(GATEWAY_SHELL_SOURCE).toContain('Recommendations')
    expect(GATEWAY_SHELL_SOURCE).toContain('Research')
    expect(GATEWAY_SHELL_SOURCE).toContain('Issues / Tasks')
    expect(GATEWAY_SHELL_SOURCE).toContain('Telegram Agent')
    expect(GATEWAY_SHELL_SOURCE).toContain('telegram_agent_connect')
    expect(GATEWAY_SHELL_SOURCE).toContain('PI can read provider registry')
    expect(GATEWAY_SHELL_SOURCE).toContain('BRAIN_READINESS_FALLBACK')
    expect(GATEWAY_SHELL_SOURCE).toContain('brain_readiness_endpoint_not_readable_or_owner_auth_required')
  })
})
