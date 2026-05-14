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
    expect(gatewayActionForButton({ label: 'open', nearbyText: 'Hermes · lieutenant read-bias · gated writes' })).toMatchObject({
      kind: 'frame',
      href: '/design/gateway/Hermes%20Lieutenant.html',
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
      href: 'http://100.116.35.95:3100/',
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
      label: 'Health',
      nearbyText: 'Paperclip workforce control plane Tailnet UI reachable',
    })).toMatchObject({
      kind: 'navigate',
      href: '/gateway/agent-hub/paperclip/config',
    })
  })
})

describe('AGENT_INTERFACE_LINKS — owner access control center', () => {
  const requiredSurfaces = [
    'Agent Zero',
    'Hermes',
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
      expect(row.blocker.length).toBeGreaterThan(0)
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
    expect(byName.get('Agent Zero')?.blocker).toContain('file descriptor')
    expect(byName.get('Hermes')?.tailnetUrl).toBeNull()
    expect(byName.get('Playwright MCP')?.tailnetUrl).toBeNull()
    expect(byName.get('Playwright MCP')?.localUrl).toBe('server-local only: 127.0.0.1:8931')
    expect(byName.get('Paperclip')?.buttons.ui).toMatchObject({
      enabled: true,
      href: 'http://100.116.35.95:3100/',
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
    expect(byName.get('Hermes')?.buttons.config).toMatchObject({
      enabled: true,
      href: '/gateway/agent-hub/hermes/config',
    })
    expect(byName.get('Pi')?.buttons.config).toMatchObject({
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
      expect(tools.href, `${row.name} tools should be a human UI wrapper`).toBe('/gateway/tools')
    }
  })

  it('uses the requested owner-facing truth table labels', () => {
    const byName = new Map(AGENT_INTERFACE_LINKS.map((row) => [row.name, row]))
    expect(byName.get('Agent Zero')?.status).toContain('UI restored')
    expect(byName.get('Agent Zero')?.blocker).toContain('agent_zero_fd_exhaustion_guard_pending')
    expect(byName.get('Hermes')?.status).toContain('service active')
    expect(byName.get('Hermes')?.blocker).toContain('hermes_owner_proxy_not_wired')
    expect(byName.get('Pi')?.status).toContain('advisory')
    expect(byName.get('Pi')?.blocker).toContain('pi_runtime_session_not_proven')
    expect(byName.get('SpaceAgent')?.status).toContain('Mission Control panel only')
    expect(byName.get('SpaceAgent')?.blocker).toContain('no_standalone_spaceagent_ui')
    expect(byName.get('Paperclip')?.status).toContain('UI reachable')
    expect(byName.get('Paperclip')?.blocker).toContain('paperclip_owner_company_claim_required')
    expect(byName.get('OpenClaw+')?.status).toContain('tunnel live')
    expect(byName.get('OpenClaw+')?.blocker).toContain('openclaw_doctor_runtime_not_reachable')
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
  })
})
