'use client'

// Mounts the approved designer mocks inside Mission Control as iframes.
// Per the Designer Contract (2026-05-11): "GatewayShell.jsx is a 50-line
// iframe holder." No status grammar, no legend, no chrome invented here.
// The mocks ARE the production page.
//
// Approved engineering adaptations:
//   - Next 15 App Router 'use client' + hooks (D3)
//   - basePath-aware src + encodeURI for filenames with spaces (D5)
//   - sandbox="allow-scripts allow-same-origin" (DDR-Gateway-005) —
//     required for the iframe's runtime back-button handler to navigate
//     window.top.
//   - DDR-Gateway-001 / -002 accessibility upgrades (<button> + 3 CSS
//     resets, README-stamped)
//   - 2026-05-12 — Gateway-Back-Button-v3-FINAL: the designer's mocks
//     now ship a `.gw-back-btn` (14 mocks) / `.gw-back` (Agent Hub.html,
//     class-name outlier) anchor with href="../../Mission Control.html".
//     Per the v3 contract: do NOT edit the mock HTML; override the href
//     at runtime in this shell. `attachBackHandler` below is the EXACT
//     handler the v3 contract specifies, extended only to cover BOTH
//     class names (matching what actually exists in the mock files —
//     "the mock IS the contract").

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { attachGatewayActionHandler } from './gateway-actions'

// Mission Control root. Verified target on production 2026-05-11.
const MISSION_CONTROL_HOME = '/'

// Designer Contract v3 (May 12, 2026) — exact handler from the spec.
// Selector includes both class names because the v3 package itself ships
// both (.gw-back-btn in 14 files, .gw-back in Agent Hub.html). Class
// inconsistency in the package; engineering accommodates without editing
// the mock files.
function attachBackHandler(iframe: HTMLIFrameElement): void {
  try {
    const doc = iframe.contentDocument
    if (!doc) return
    const buttons = doc.querySelectorAll('.gw-back-btn, .gw-back')
    buttons.forEach((btn) => {
      // Idempotent guard: avoid double-binding when iframe re-emits load.
      if ((btn as HTMLElement).dataset.ccBackWired === '1') return
      ;(btn as HTMLElement).dataset.ccBackWired = '1'
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        const top = window.top || window.parent || window
        top.location.href = MISSION_CONTROL_HOME
      })
    })
  } catch (_err) {
    /* cross-origin — ignore, per v3 contract */
  }
}

function iframeHasGatewayMock(iframe: HTMLIFrameElement): boolean {
  try {
    const href = iframe.contentWindow?.location.href || ''
    return href.includes('/design/gateway/')
  } catch (_err) {
    return false
  }
}

interface Tab { id: string; label: string; src: string; hint: string; seg: string }

const TABS: ReadonlyArray<Tab> = [
  { id: 'overview',   label: 'Overview',       src: 'Gateway Overview.html',     hint: 'Nucleus — primary',       seg: 'overview' },
  { id: 'agent-hub',  label: 'Agent Hub',      src: 'Agent Hub.html',            hint: '5 agents',                seg: 'agent-hub' },
  { id: 'paperclip',  label: 'Paperclip',      src: 'Paperclip.html',            hint: 'Workforce Control Plane', seg: 'paperclip' },
  { id: 'dispatcher', label: 'Dispatcher',     src: 'Dispatcher.html',           hint: '9-step gate',             seg: 'dispatcher' },
  { id: 'governor',   label: 'Token Governor', src: 'Token Governor.html',       hint: 'budgets',                 seg: 'token-governor' },
  { id: 'bridge',     label: 'Bridge Session', src: 'Bridge Session Flow.html',  hint: 'gating',                  seg: 'bridge-session' },
  { id: 'health',     label: 'Health',         src: 'Gateway Health.html',       hint: 'live status',             seg: 'health' },
  { id: 'routes',     label: 'Routes',         src: 'Gateway Routes.html',       hint: 'engine routes',           seg: 'routes' },
  { id: 'registry',   label: 'Registry',       src: 'Gateway Registry.html',     hint: 'nodes',                   seg: 'registry' },
  { id: 'policies',   label: 'Policies',       src: 'Gateway Policies.html',     hint: 'R/W/X',                   seg: 'policies' },
]
const BY_ID = new Map(TABS.map((t) => [t.id, t]))
const BY_SEG = new Map(TABS.map((t) => [t.seg, t]))
const BASE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) || ''

type AgentAccessButton = {
  enabled: boolean
  href: string | null
  blocker: string
}

type AgentAccessButtons = {
  ui: AgentAccessButton
  config: AgentAccessButton
  brain: AgentAccessButton
  chat: AgentAccessButton
  tools: AgentAccessButton
  health: AgentAccessButton
}

type AgentInterfaceLink = {
  name: string
  service: string
  localBind: string
  port: string
  localUrl: string | null
  tailnetUrl: string | null
  proxyRoute: string
  authRequired: true
  status: string
  blocker: string
  nextFix: string
  buttons: AgentAccessButtons
}

type AgentInterfacePanelMode = 'expanded' | 'collapsed'

const enabled = (href: string): AgentAccessButton => ({ enabled: true, href, blocker: '' })
const disabled = (blocker: string): AgentAccessButton => ({ enabled: false, href: null, blocker })
const GATEWAY_TOOLS_ROUTE = '/gateway/tools'
const GATEWAY_BRAIN_ROUTE = '/gateway/brain'
const agentControlRoute = (slug: string, mode: string): string => `/gateway/agent-hub/${slug}/${mode}`
const paperclipControlRoute = (mode: string): string => agentControlRoute('paperclip', mode)

export const AGENT_INTERFACE_LINKS: ReadonlyArray<AgentInterfaceLink> = [
  {
    name: 'Agent Zero',
    service: 'agent-zero Docker container',
    localBind: '100.116.35.95',
    port: '50080 -> container:80',
    localUrl: null,
    tailnetUrl: 'http://100.116.35.95:50080/',
    proxyRoute: '/api/agent-zero/status',
    authRequired: true,
    status: 'partial · UI restored · fd guard pending',
    blocker: 'agent_zero_fd_exhaustion_guard_pending · Owner UI, login, and /api/health recovered after an Agent Zero container restart; long-term file descriptor exhaustion guard is still pending.',
    nextFix: 'Add an Agent Zero fd-leak guard/health monitor and keep /health, /status, and /api/status documented as absent unless the upstream app adds them.',
    buttons: {
      ui: enabled('http://100.116.35.95:50080/'),
      config: enabled(agentControlRoute('agent-zero', 'config')),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: enabled(agentControlRoute('agent-zero', 'chat')),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(agentControlRoute('agent-zero', 'config')),
    },
  },
  {
    name: 'Hermes',
    service: 'hermes-gateway.service',
    localBind: '127.0.0.1',
    port: '3000',
    localUrl: 'server-local only: 127.0.0.1:3000',
    tailnetUrl: null,
    proxyRoute: '/api/hermes/status',
    authRequired: true,
    status: 'partial · service active · safe live adapter proven · owner proxy not wired',
    blocker: 'hermes_owner_proxy_not_wired · Live server-local health on 127.0.0.1:3000; no safe Tailnet/proxy UI route yet.',
    nextFix: 'Keep Hermes local-only and expose owner inspection through the Mission Control status/config panel.',
    buttons: {
      ui: disabled('Hermes binds to server localhost only; no safe owner Tailnet UI/proxy exists yet.'),
      config: enabled(agentControlRoute('hermes', 'config')),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: enabled(agentControlRoute('hermes', 'chat')),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(agentControlRoute('hermes', 'config')),
    },
  },
  {
    name: 'Pi',
    service: 'Mission Control dispatcher contract',
    localBind: 'none',
    port: 'none',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/bridge/dispatcher/status',
    authRequired: true,
    status: 'advisory · runtime not proven',
    blocker: 'pi_runtime_session_not_proven · Advisory dispatcher contract only. No standalone Pi service/UI found.',
    nextFix: 'Keep Pi advisory-only and show recommendations/blocked route reasons in Mission Control.',
    buttons: {
      ui: disabled('No standalone Pi UI/service has been found.'),
      config: enabled(agentControlRoute('pi', 'config')),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('Pi has no chat/runtime session; advisory mode only.'),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(agentControlRoute('pi', 'config')),
    },
  },
  {
    name: 'SpaceAgent',
    service: 'Mission Control SpaceAgent contract; Playwright MCP local service',
    localBind: '127.0.0.1',
    port: '8931 via Playwright MCP',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/bridge/space-agent/status',
    authRequired: true,
    status: 'partial · Mission Control panel only · Playwright local-only',
    blocker: 'no_standalone_spaceagent_ui · firecrawl_credential_required · firecrawl_backend_adapter_not_configured · youtube_transcript_connector_not_proven · Playwright MCP is local-only on server 127.0.0.1:8931.',
    nextFix: 'Manage SpaceAgent through Mission Control; keep Playwright MCP private and surface Firecrawl/YouTube blockers.',
    buttons: {
      ui: disabled('No standalone SpaceAgent UI exists.'),
      config: enabled(agentControlRoute('spaceagent', 'config')),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: enabled(agentControlRoute('spaceagent', 'research')),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(agentControlRoute('spaceagent', 'config')),
    },
  },
  {
    name: 'Paperclip',
    service: 'paperclip-lab dev runner',
    localBind: '100.116.35.95',
    port: '3100',
    localUrl: null,
    tailnetUrl: 'http://100.116.35.95:3100/ECO/dashboard',
    proxyRoute: '/api/bridge/paperclip/status',
    authRequired: true,
    status: 'INSTALLED / READY - WRITES BRIDGE-GATED',
    blocker: 'paperclip_writes_bridge_gated · Owner-accessible Paperclip company is E copier Solutions (ECO). Legacy To Knowledge Gateway (TOK) still needs owner membership repair before that company route can be used.',
    nextFix: 'Use the ECO Paperclip dashboard for owner work now. Keep real task creation Bridge-gated; repair TOK membership separately if that legacy company must remain active.',
    buttons: {
      ui: enabled('http://100.116.35.95:3100/ECO/dashboard'),
      config: enabled(paperclipControlRoute('config')),
      brain: disabled('paperclip_brain_surface_not_configured · Paperclip work-product/memory surface has not been proven yet.'),
      chat: disabled('paperclip_chat_surface_not_configured · No safe Paperclip chat/task-prompt surface is proven.'),
      tools: enabled(paperclipControlRoute('tools')),
      health: enabled(paperclipControlRoute('status')),
    },
  },
  {
    name: 'OpenClaw+',
    service: 'openclaw-gateway.service',
    localBind: '127.0.0.1',
    port: '18789 / 18791',
    localUrl: 'owner tunnel: 127.0.0.1:18789',
    tailnetUrl: null,
    proxyRoute: '/api/openclaw-plus/status',
    authRequired: true,
    status: 'tunnel live · doctor CLI blocked',
    blocker: 'openclaw_doctor_runtime_not_reachable · Direct server-local gateway is private; current owner access uses the existing SSH/Tailnet tunnel.',
    nextFix: 'Keep tunnel-only or add an authenticated Mission Control proxy; show doctor blocker until CLI is reachable.',
    buttons: {
      ui: enabled('http://127.0.0.1:18789/'),
      config: enabled(agentControlRoute('openclaw', 'config')),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('OpenClaw+ chat/control remains gated behind Agent Zero/Bridge orchestration.'),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(agentControlRoute('openclaw', 'config')),
    },
  },
  {
    name: 'Playwright MCP',
    service: 'playwright-mcp.service',
    localBind: '127.0.0.1',
    port: '8931',
    localUrl: 'server-local only: 127.0.0.1:8931',
    tailnetUrl: null,
    proxyRoute: '/api/bridge/space-agent/playwright-mcp/status',
    authRequired: true,
    status: 'live local-only',
    blocker: 'Endpoint 127.0.0.1:8931/sse is intentionally not public.',
    nextFix: 'Use SpaceAgent as the owner-facing control surface; never expose Playwright MCP publicly.',
    buttons: {
      ui: disabled('Playwright MCP is a local-only MCP transport, not an owner web UI.'),
      config: enabled(agentControlRoute('spaceagent', 'config')),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('MCP does not provide owner chat. Use SpaceAgent once its panel is wired.'),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(agentControlRoute('spaceagent', 'config')),
    },
  },
  {
    name: 'Firecrawl',
    service: 'Firecrawl connector/backend not proven',
    localBind: 'none',
    port: 'none',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/firecrawl/status',
    authRequired: true,
    status: 'blocked',
    blocker: 'FIRECRAWL_API_KEY/backend adapter proof missing.',
    nextFix: 'Add Firecrawl credential through approved secret path and prove backend adapter before enabling crawl actions.',
    buttons: {
      ui: disabled('No Firecrawl owner UI/backend is configured.'),
      config: enabled(agentControlRoute('spaceagent', 'config')),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('Firecrawl is a tool under SpaceAgent, not a chat surface.'),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(agentControlRoute('spaceagent', 'research')),
    },
  },
  {
    name: 'YouTube',
    service: 'YouTube transcript connector not proven',
    localBind: 'none',
    port: 'none',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/bridge/space-agent/status',
    authRequired: true,
    status: 'blocked',
    blocker: 'Transcript connector proof missing; full-video downloads blocked.',
    nextFix: 'Install/prove transcript connector and expose success/unavailable/fallback states through SpaceAgent.',
    buttons: {
      ui: disabled('No YouTube connector owner UI exists.'),
      config: enabled(agentControlRoute('spaceagent', 'config')),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('YouTube is a SpaceAgent tool, not a chat surface.'),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(agentControlRoute('spaceagent', 'research')),
    },
  },
  {
    name: 'Bridge Session',
    service: 'Mission Control approval queue',
    localBind: '127.0.0.1 / 100.116.35.95',
    port: '3337',
    localUrl: 'http://127.0.0.1:3337/gateway/bridge-session',
    tailnetUrl: 'http://100.116.35.95:3337/gateway/bridge-session',
    proxyRoute: '/api/bridge/approval-requests',
    authRequired: true,
    status: 'partial',
    blocker: 'Approval records available; protected execution still disabled until runner/audit/rollback proof.',
    nextFix: 'Use for scoped approval records only until dispatch runner, audit export, and rollback proof are complete.',
    buttons: {
      ui: enabled('http://100.116.35.95:3337/gateway/bridge-session'),
      config: enabled('/gateway/bridge-session'),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('Bridge is an approval surface, not a chat surface.'),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled('/gateway/bridge-session'),
    },
  },
  {
    name: 'Telegram',
    service: 'Telegram delivery connector',
    localBind: 'none',
    port: 'none',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/bridge/telegram-readiness',
    authRequired: true,
    status: 'blocked',
    blocker: 'TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_CHAT_ID must be added through the approved secret path before owner delivery can be live.',
    nextFix: 'Add bot/channel credentials through the approved secret path; prove owner-only inbound and Bridge-gated send.',
    buttons: {
      ui: disabled('Telegram has no local owner UI in Mission Control.'),
      config: enabled(GATEWAY_TOOLS_ROUTE),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('Telegram chat requires bot credential and owner channel proof.'),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(GATEWAY_TOOLS_ROUTE),
    },
  },
  {
    name: 'AgentMail',
    service: 'AgentMail delivery connector',
    localBind: 'none',
    port: 'none',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/bridge/agentmail-readiness',
    authRequired: true,
    status: 'ready · approval-gated sending',
    blocker: 'AgentMail ready · approval-gated sending. Setup is complete; per-send dispatch still requires owner approval, Gateway policy, scoped inbox credential, audit, and provider allowlist clearance.',
    nextFix: 'Use AgentMail Local Control to create a send preview and approval request. Auto-send and bulk-send remain disabled.',
    buttons: {
      ui: enabled('/agentmail'),
      config: enabled(GATEWAY_TOOLS_ROUTE),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('AgentMail sends are server-side and approval-gated. Open AgentMail Local Control to preview, approve, and audit a specific send request.'),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(GATEWAY_TOOLS_ROUTE),
    },
  },
  {
    name: 'Google Drive',
    service: 'Google Drive delivery connector',
    localBind: 'none',
    port: 'none',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/bridge/google-drive-readiness',
    authRequired: true,
    status: 'blocked',
    blocker: 'Google Drive OAuth and target-folder proof are missing; uploads remain disabled until approved.',
    nextFix: 'Complete OAuth and target folder proof through approved setup; keep uploads Bridge-gated.',
    buttons: {
      ui: disabled('No Google Drive owner launch is configured through Mission Control yet.'),
      config: enabled(GATEWAY_TOOLS_ROUTE),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('Google Drive is a delivery connector, not a chat surface.'),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(GATEWAY_TOOLS_ROUTE),
    },
  },
  {
    name: 'OneDrive',
    service: 'OneDrive / Microsoft Graph delivery connector',
    localBind: 'none',
    port: 'none',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/bridge/onedrive-readiness',
    authRequired: true,
    status: 'blocked',
    blocker: 'Microsoft Graph OAuth and OneDrive target-folder proof are missing; uploads remain disabled until approved.',
    nextFix: 'Complete Microsoft Graph OAuth and target folder proof; keep uploads Bridge-gated.',
    buttons: {
      ui: disabled('No OneDrive owner launch is configured through Mission Control yet.'),
      config: enabled(GATEWAY_TOOLS_ROUTE),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('OneDrive is a delivery connector, not a chat surface.'),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(GATEWAY_TOOLS_ROUTE),
    },
  },
] as const

function LinkButton({ button, children }: { button: AgentAccessButton; children: string }) {
  if (!button.enabled || !button.href) {
    return <button type="button" className="agent-link disabled" title={button.blocker} disabled>{children}</button>
  }
  const isExternal = /^https?:\/\//.test(button.href)
  return (
    <a className="agent-link" href={button.href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined}>
      {children}
    </a>
  )
}

function AgentInterfaceInventory({
  mode,
  onCollapse,
  onExpand,
  onClose,
}: {
  mode: AgentInterfacePanelMode
  onCollapse: () => void
  onExpand: () => void
  onClose: () => void
}) {
  const isCollapsed = mode === 'collapsed'
  return (
    <section className={`agent-interface-panel ${isCollapsed ? 'collapsed' : 'expanded'}`} aria-label="Agent Control Center">
      <div className="agent-interface-head">
        <div className="agent-interface-title">
          <span>Agent Control Center</span>
          <small>{AGENT_INTERFACE_LINKS.length} surfaces · UI, config, brain, chat, tools, health</small>
        </div>
        <div className="agent-interface-controls" aria-label="Agent Control Center controls">
          {isCollapsed ? (
            <button type="button" onClick={onExpand} data-testid="agent-interface-expand">Expand</button>
          ) : (
            <button type="button" onClick={onCollapse} data-testid="agent-interface-collapse">Collapse</button>
          )}
          <button type="button" onClick={onClose} data-testid="agent-interface-close">Close</button>
          <a href="/gateway/tools?panel=agent-interfaces">Inventory Panel</a>
        </div>
      </div>
      {isCollapsed ? (
        <div className="agent-interface-collapsed-list">
          {AGENT_INTERFACE_LINKS.map((agent) => (
            <div key={agent.name} className="agent-interface-chip">
              <strong>{agent.name}</strong>
              <span>{agent.status}</span>
            </div>
          ))}
        </div>
      ) : (
      <div className="agent-interface-list">
        {AGENT_INTERFACE_LINKS.map((agent) => (
          <article key={agent.name} className="agent-interface-row">
            <div className="agent-row-main">
              <strong>{agent.name}</strong>
              <span>{agent.status} · auth required: {agent.authRequired ? 'yes' : 'no'}</span>
              <span>service: {agent.service} · bind: {agent.localBind} · port: {agent.port}</span>
              <span>local: {agent.localUrl ?? 'not available'} · tailnet: {agent.tailnetUrl ?? 'not available'}</span>
              <span>proxy/config: {agent.proxyRoute}</span>
              <small>{agent.blocker}</small>
              <small>next fix: {agent.nextFix}</small>
            </div>
            <div className="agent-row-actions">
              <LinkButton button={agent.buttons.ui}>Open UI</LinkButton>
              <LinkButton button={agent.buttons.config}>Open Config</LinkButton>
              <LinkButton button={agent.buttons.brain}>Open Brain</LinkButton>
              <LinkButton button={agent.buttons.chat}>{agent.name === 'Pi' ? 'Open Recommend' : agent.name === 'SpaceAgent' ? 'Open Research' : 'Open Chat'}</LinkButton>
              <LinkButton button={agent.buttons.tools}>Open Tools</LinkButton>
              <LinkButton button={agent.buttons.health}>Health</LinkButton>
            </div>
          </article>
        ))}
      </div>
      )}
    </section>
  )
}

type AgentSlug = 'agent-zero' | 'hermes' | 'pi' | 'spaceagent' | 'paperclip' | 'openclaw'
type AgentPanelMode = 'config' | 'chat' | 'recommend' | 'research' | 'tools' | 'companies' | 'agents' | 'issues' | 'status' | 'audit' | 'help'
type GatewayControlView =
  | { kind: 'tools' }
  | { kind: 'brain' }
  | { kind: 'agent'; slug: AgentSlug; mode: AgentPanelMode }

type AgentControlDefinition = {
  slug: AgentSlug
  name: string
  role: string
  status: string
  endpoint: string
  uiHref: string | null
  blocker: string
  nextAction: string
  modes: AgentPanelMode[]
}

const AGENT_CONTROL_DEFS: Record<AgentSlug, AgentControlDefinition> = {
  'agent-zero': {
    slug: 'agent-zero',
    name: 'Agent Zero',
    role: 'Commander',
    status: 'partial · UI restored · fd guard pending',
    endpoint: '/api/agent-zero/status',
    uiHref: 'http://100.116.35.95:50080/',
    blocker: 'agent_zero_fd_exhaustion_guard_pending',
    nextAction: 'Use the UI for owner login/inspection. Commands and protected execution remain Bridge-gated until safe command routing is proven.',
    modes: ['config', 'chat'],
  },
  hermes: {
    slug: 'hermes',
    name: 'Hermes',
    role: 'Lieutenant · workflow specialist',
    status: 'partial · service active · safe live adapter proven · owner proxy not wired',
    endpoint: '/api/hermes/status',
    uiHref: null,
    blocker: 'hermes_owner_proxy_not_wired',
    nextAction: 'Inspect Hermes through this Mission Control panel. Do not expose server-local 127.0.0.1:3000 publicly.',
    modes: ['config', 'chat'],
  },
  pi: {
    slug: 'pi',
    name: 'Pi',
    role: 'Dispatcher / route optimizer candidate',
    status: 'advisory · runtime not proven',
    endpoint: '/api/bridge/dispatcher/status',
    uiHref: null,
    blocker: 'pi_runtime_session_not_proven',
    nextAction: 'Keep Pi advisory-only. Show route recommendations and blockers without enabling execution or writes.',
    modes: ['config', 'recommend'],
  },
  spaceagent: {
    slug: 'spaceagent',
    name: 'SpaceAgent',
    role: 'Browser · Playwright · Firecrawl · YouTube research',
    status: 'partial · Mission Control panel only · Playwright local-only',
    endpoint: '/api/bridge/space-agent/status',
    uiHref: null,
    blocker: 'no_standalone_spaceagent_ui · firecrawl_credential_required · firecrawl_backend_adapter_not_configured · youtube_transcript_connector_not_proven',
    nextAction: 'Manage research tooling here. Playwright MCP remains local-only at 127.0.0.1:8931; Firecrawl/YouTube stay blocked until credentials/connectors are proven.',
    modes: ['config', 'research'],
  },
  paperclip: {
    slug: 'paperclip',
    name: 'Paperclip',
    role: 'Workforce control plane',
    status: 'INSTALLED / READY - WRITES BRIDGE-GATED',
    endpoint: '/api/bridge/paperclip/status',
    uiHref: 'http://100.116.35.95:3100/ECO/dashboard',
    blocker: 'paperclip_writes_bridge_gated',
    nextAction: 'Use the owner-accessible ECO company dashboard for Paperclip. Real task writes remain Bridge-gated; the legacy TOK company still needs membership repair before routing there.',
    modes: ['config', 'status', 'tools', 'companies', 'agents', 'issues', 'audit', 'help'],
  },
  openclaw: {
    slug: 'openclaw',
    name: 'OpenClaw+',
    role: 'Runtime · skills · mini-agent execution',
    status: 'tunnel live · doctor CLI blocked',
    endpoint: '/api/openclaw-plus/status',
    uiHref: 'http://127.0.0.1:18789/',
    blocker: 'openclaw_doctor_runtime_not_reachable',
    nextAction: 'Use the existing owner tunnel for UI access. Keep doctor status blocked until the CLI is reachable from Mission Control runtime.',
    modes: ['config'],
  },
}

const CONTROL_MODE_LABELS: Record<AgentPanelMode, string> = {
  config: 'Config',
  chat: 'Chat / Test',
  recommend: 'Recommendations',
  research: 'Research',
  tools: 'Tools',
  companies: 'Companies',
  agents: 'Agents',
  issues: 'Issues / Tasks',
  status: 'Status',
  audit: 'Audit',
  help: 'Help',
}

const CONTROL_MODE_MATCH = '(config|chat|recommend|research|tools|companies|agents|issues|status|audit|help)'

function controlViewFrom(pathname: string | null, q: URLSearchParams | null): GatewayControlView | null {
  const control = q?.get('control')
  if (control === 'tools') return { kind: 'tools' }
  if (control === 'brain') return { kind: 'brain' }
  const controlMatch = control?.match(new RegExp(`^(agent-zero|hermes|pi|spaceagent|paperclip|openclaw)-${CONTROL_MODE_MATCH}$`))
  if (controlMatch) {
    return { kind: 'agent', slug: controlMatch[1] as AgentSlug, mode: controlMatch[2] as AgentPanelMode }
  }

  const parts = pathname?.replace(/^\/+/, '').split(/[\/?#]/) || []
  if (parts[0] !== 'gateway') return null
  if (parts[1] === 'tools') return { kind: 'tools' }
  if (parts[1] === 'brain') return { kind: 'brain' }
  if (parts[1] === 'agent-hub' && parts[2] === 'paperclip' && !parts[3]) {
    return { kind: 'agent', slug: 'paperclip', mode: 'status' }
  }
  if (parts[1] === 'agent-hub' && parts[2] && parts[3]) {
    const slug = parts[2] as AgentSlug
    const mode = parts[3] as AgentPanelMode
    if (AGENT_CONTROL_DEFS[slug] && ['config', 'chat', 'recommend', 'research', 'tools', 'companies', 'agents', 'issues', 'status', 'audit', 'help'].includes(mode)) {
      return { kind: 'agent', slug, mode }
    }
  }
  if (parts[1] === 'agents' && parts[2] === 'paperclip') {
    const requestedMode = parts[3] as AgentPanelMode | undefined
    const mode = requestedMode && ['config', 'tools', 'companies', 'agents', 'issues', 'status', 'audit', 'help'].includes(requestedMode)
      ? requestedMode
      : 'status'
    return { kind: 'agent', slug: 'paperclip', mode }
  }
  return null
}

function isSimpleStatusValue(value: unknown): value is string | number | boolean | null {
  return ['string', 'number', 'boolean'].includes(typeof value) || value === null
}

function summarizeValue(value: unknown): string {
  if (isSimpleStatusValue(value)) return String(value)
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`
  if (typeof value === 'object' && value !== null) return `${Object.keys(value).length} fields`
  return 'available'
}

function firstStatusString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

const BRAIN_READINESS_FALLBACK: Record<string, unknown> = {
  ok: false,
  state: 'READABLE_FALLBACK',
  pipeline_state: 'PARTIAL',
  endpoint: '/api/bridge/brain-readiness',
  blocker: 'brain_readiness_endpoint_not_readable_or_owner_auth_required',
  obsidian: 'read-only provenance surface expected; writes Bridge-gated',
  main_policy: 'read-only policy surface expected; writes Bridge-gated',
  brain_sync: 'status panel fallback active until backend JSON route is readable',
  graphify: 'backend status required before claiming full sync',
  build_wiki: 'Fork 1 Run Now remains Bridge-gated',
  agent_visibility: 'Agent Zero, Hermes, Pi, SpaceAgent, Paperclip, and OpenClaw+ must consume Brain through Gateway status/contracts only',
  next_action: 'Restore readable /api/bridge/brain-readiness JSON for owner sessions, then prove each agent can read the Brain status packet. Do not enable Brain writes without Bridge approval.',
  execution_enabled: false,
  writes_enabled: false,
  protected_execution_enabled: false,
}

function ReadableStatusPanel({ endpoint, fallbackPayload }: { endpoint: string; fallbackPayload?: Record<string, unknown> }) {
  const [state, setState] = useState<{
    phase: 'loading' | 'ready' | 'error'
    status?: number
    payload?: Record<string, unknown>
    error?: string
  }>({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ phase: 'loading' })
    fetch(endpoint, { credentials: 'include' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (cancelled) return
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const record = payload as Record<string, unknown>
          if (!response.ok && response.status === 401) {
            setState({
              phase: 'ready',
              status: response.status,
              payload: {
                ok: false,
                state: 'OWNER_AUTH_REQUIRED',
                endpoint,
                blocker: firstStatusString(record.error, record.blocker, record.reason) || 'owner_auth_required',
                next_action: 'Sign in to Mission Control as owner, then reopen this status panel. Brain writes remain Bridge-gated.',
                execution_enabled: false,
                writes_enabled: false,
                protected_execution_enabled: false,
              },
            })
            return
          }
          setState({ phase: 'ready', status: response.status, payload: record })
        } else if (fallbackPayload) {
          setState({ phase: 'ready', status: response.status, payload: fallbackPayload })
        } else {
          setState({ phase: 'error', status: response.status, error: 'Endpoint did not return a readable JSON status packet.' })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && fallbackPayload) {
          setState({ phase: 'ready', payload: fallbackPayload })
          return
        }
        if (!cancelled) setState({ phase: 'error', error: error instanceof Error ? error.message : 'unknown error' })
      })
    return () => { cancelled = true }
  }, [endpoint])

  if (state.phase === 'loading') {
    return <div className="control-status muted">Loading readable status from {endpoint}...</div>
  }

  if (state.phase === 'error') {
    return (
      <div className="control-status warning">
        <strong>Status panel unavailable</strong>
        <span>{state.error}</span>
        <small>Endpoint: {endpoint}</small>
      </div>
    )
  }

  const payload = state.payload || {}
  const rows = Object.entries(payload).filter(([key]) => !['credential_values', 'secrets', 'tokens'].includes(key)).slice(0, 12)
  return (
    <div className="control-status">
      <div className="status-head">
        <strong>Readable Status</strong>
        <span>HTTP {state.status ?? 'unknown'} · {endpoint}</span>
      </div>
      <dl>
        {rows.map(([key, value]) => (
          <div key={key}>
            <dt>{key.replace(/_/g, ' ')}</dt>
            <dd>{summarizeValue(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function ControlLink({ href, children, disabled }: { href: string | null; children: string; disabled?: boolean }) {
  if (!href || disabled) return <button type="button" className="control-action disabled" disabled>{children}</button>
  const isExternal = /^https?:\/\//.test(href)
  return <a className="control-action" href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined}>{children}</a>
}

function GatewayToolsPanel() {
  const connectors = AGENT_INTERFACE_LINKS.filter((row) => ['Telegram', 'AgentMail', 'Google Drive', 'OneDrive', 'Firecrawl', 'YouTube', 'Playwright MCP'].includes(row.name))
  return (
    <main className="control-page" data-testid="gateway-tools-panel">
      <header className="control-hero">
        <p>Gateway</p>
        <h1>Tools & Capability Matrix</h1>
        <span>Human-readable wrapper for read-only capability and connector status. Protected writes still require Bridge Session.</span>
      </header>
      <section className="control-grid">
        {connectors.map((connector) => (
          <article key={connector.name} className="control-card">
            <strong>{connector.name}</strong>
            <span>{connector.status}</span>
            <small>{connector.blocker}</small>
          </article>
        ))}
      </section>
      <ReadableStatusPanel endpoint="/api/bridge/capability-matrix" />
    </main>
  )
}

function BrainControlPanel() {
  return (
    <main className="control-page" data-testid="gateway-brain-panel">
      <header className="control-hero">
        <p>Gateway</p>
        <h1>Brain & Memory Status</h1>
        <span>Read-only provenance for Obsidian, main policy, Brain Sync, and memory surfaces. Writes remain Bridge-gated.</span>
      </header>
      <ReadableStatusPanel endpoint="/api/bridge/brain-readiness" fallbackPayload={BRAIN_READINESS_FALLBACK} />
    </main>
  )
}

function AgentControlPanel({ slug, mode }: { slug: AgentSlug; mode: AgentPanelMode }) {
  const agent = AGENT_CONTROL_DEFS[slug]
  const label = CONTROL_MODE_LABELS[mode]
  const modeCopy: Record<AgentPanelMode, string> = {
    config: 'Inspect runtime, owner access, blockers, and next safe configuration actions.',
    chat: 'Safe chat/test surface. If a real chat route is not proven, this page only shows status and the exact blocker.',
    recommend: 'Advisory recommendations only. Execution and writes remain disabled.',
    research: 'Research control surface for browser evidence packets, Firecrawl readiness, and YouTube transcript state.',
    tools: 'Readable tool inventory. Real task creation remains Bridge-gated; this page does not perform writes.',
    companies: 'Read-only company inventory from the Paperclip bridge. ECO is owner-accessible; TOK remains a legacy membership warning.',
    agents: 'Read-only Paperclip workforce roster for the owner-accessible company. No task execution happens from this page.',
    issues: 'Read-only issue/task queue for Paperclip. Creating or changing tasks still requires Bridge approval.',
    status: 'Readable Paperclip health and owner-accessible ECO status. This page does not parse HTML as JSON.',
    audit: 'Read-only Paperclip audit surface. If no audit sink is connected, this page shows an empty state instead of redirecting.',
    help: 'Paperclip owner help for the current buttons, ECO routing, and Bridge-gated write policy.',
  }
  const isPaperclip = slug === 'paperclip'
  const statusEndpoint = isPaperclip && ['companies', 'agents', 'issues'].includes(mode)
    ? `/api/bridge/paperclip/${mode}`
    : agent.endpoint
  const brainDisabled = isPaperclip
  const chatDisabled = isPaperclip
  const toolsHref = isPaperclip ? paperclipControlRoute('tools') : GATEWAY_TOOLS_ROUTE

  return (
    <main className="control-page" data-testid={`agent-control-${slug}-${mode}`}>
      <header className="control-hero">
        <p>{agent.role}</p>
        <h1>{agent.name} · {label}</h1>
        <span>{modeCopy[mode]}</span>
      </header>
      <section className="control-actions-row" aria-label={`${agent.name} actions`}>
        <ControlLink href={agent.uiHref}>Open UI</ControlLink>
        <ControlLink href={agentControlRoute(slug, 'config')}>Open Config</ControlLink>
        <ControlLink href={brainDisabled ? null : GATEWAY_BRAIN_ROUTE} disabled={brainDisabled}>Open Brain</ControlLink>
        {agent.modes.includes('chat') && <ControlLink href={chatDisabled ? null : agentControlRoute(slug, 'chat')} disabled={chatDisabled}>Open Chat</ControlLink>}
        {agent.modes.includes('recommend') && <ControlLink href={agentControlRoute(slug, 'recommend')}>Open Recommendations</ControlLink>}
        {agent.modes.includes('research') && <ControlLink href={agentControlRoute(slug, 'research')}>Open Research</ControlLink>}
        {isPaperclip && <ControlLink href={paperclipControlRoute('companies')}>Companies</ControlLink>}
        {isPaperclip && <ControlLink href={paperclipControlRoute('agents')}>Agents</ControlLink>}
        {isPaperclip && <ControlLink href={paperclipControlRoute('issues')}>Issues</ControlLink>}
        {isPaperclip && <ControlLink href={paperclipControlRoute('status')}>Status</ControlLink>}
        {isPaperclip && <ControlLink href={paperclipControlRoute('audit')}>Audit</ControlLink>}
        {isPaperclip && <ControlLink href={paperclipControlRoute('help')}>Help</ControlLink>}
        <ControlLink href={toolsHref}>Open Tools</ControlLink>
      </section>
      <section className="control-grid">
        <article className="control-card">
          <strong>Status</strong>
          <span>{agent.status}</span>
        </article>
        <article className="control-card">
          <strong>Exact blocker</strong>
          <span>{agent.blocker}</span>
        </article>
        <article className="control-card">
          <strong>Next action</strong>
          <span>{agent.nextAction}</span>
        </article>
      </section>
      {isPaperclip && (
        <section className="control-grid paperclip-only">
          <article className="control-card">
            <strong>Company access</strong>
            <span>E copier Solutions (ECO) is the owner-accessible Paperclip company. To Knowledge Gateway (TOK) still shows a membership warning and is not used for owner routing.</span>
          </article>
          <article className="control-card">
            <strong>Readable routes</strong>
            <span>Companies, agents, and issues are exposed as read-only bridge checks. Mission Control does not store Paperclip passwords or cookies.</span>
          </article>
          <article className="control-card">
            <strong>Write policy</strong>
            <span>Real Paperclip task creation requires Bridge Session, company access, adapter proof, audit, and rollback.</span>
          </article>
        </section>
      )}
      {isPaperclip && mode === 'tools' && (
        <section className="control-grid paperclip-only">
          <article className="control-card">
            <strong>Read-only tools</strong>
            <span>Open UI, config, status, companies, agents, issues, audit, and help are inspection routes only.</span>
          </article>
          <article className="control-card">
            <strong>Bridge-gated tools</strong>
            <span>Task creation, comments, issue edits, uploads, sends, and workforce mutations remain locked until Bridge Session approval, adapter proof, audit, and rollback exist.</span>
          </article>
          <article className="control-card">
            <strong>Company scope</strong>
            <span>ECO only for owner-facing Paperclip work. TOK remains a separate legacy company blocker and is not repaired in this hop.</span>
          </article>
        </section>
      )}
      {isPaperclip && mode === 'audit' && (
        <section className="control-grid paperclip-only">
          <article className="control-card">
            <strong>Audit source</strong>
            <span>No Paperclip audit source connected yet.</span>
          </article>
          <article className="control-card">
            <strong>Write audit policy</strong>
            <span>Future Paperclip writes must create an audit row before and after Bridge-approved dispatch.</span>
          </article>
          <article className="control-card">
            <strong>Current state</strong>
            <span>Read-only ECO status is available. No Paperclip write or task mutation is enabled from Mission Control.</span>
          </article>
        </section>
      )}
      {isPaperclip && mode === 'help' && (
        <section className="control-grid paperclip-only">
          <article className="control-card">
            <strong>Open UI</strong>
            <span>Opens the ECO Paperclip dashboard at 100.116.35.95:3100/ECO/dashboard in a new tab. It does not require Bridge Session.</span>
          </article>
          <article className="control-card">
            <strong>Read buttons</strong>
            <span>Config, status, companies, agents, issues, tools, audit, and help are safe read-only Mission Control pages.</span>
          </article>
          <article className="control-card">
            <strong>Write buttons</strong>
            <span>Any task creation, issue edit, comment, send, upload, or execution returns WRITES_BRIDGE_GATED until Bridge Session, adapter proof, scope, audit, and rollback exist.</span>
          </article>
        </section>
      )}
      <ReadableStatusPanel endpoint={statusEndpoint} />
    </main>
  )
}

function GatewayControlSurface({ view }: { view: GatewayControlView }) {
  if (view.kind === 'tools') return <GatewayToolsPanel />
  if (view.kind === 'brain') return <BrainControlPanel />
  return <AgentControlPanel slug={view.slug} mode={view.mode} />
}

function resolveTab(pathname: string | null, q: URLSearchParams | null): Tab {
  const qid = q?.get('tab')
  if (qid && BY_ID.has(qid)) return BY_ID.get(qid)!
  if (pathname) {
    const parts = pathname.replace(/^\/+/, '').split(/[\/?#]/)
    if (parts[0] === 'gateway' && parts[1]) {
      if (parts[1] === 'agent-hub' && parts[2] === 'paperclip') return BY_ID.get('paperclip')!
      if (BY_SEG.has(parts[1])) return BY_SEG.get(parts[1])!
    }
  }
  return TABS[0]
}

export default function GatewayShell() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [activeId, setActiveId] = useState<string>(() => resolveTab(pathname, sp).id)
  const [accessPanelMode, setAccessPanelMode] = useState<'expanded' | 'collapsed' | 'hidden'>('expanded')
  useEffect(() => { const t = resolveTab(pathname, sp); if (t.id !== activeId) setActiveId(t.id) }, [pathname, sp, activeId])
  const active = BY_ID.get(activeId) ?? TABS[0]
  const controlView = controlViewFrom(pathname, sp)
  const isControlView = Boolean(controlView)
  const showAccessRail = active.id === 'agent-hub' && !controlView
  const wireIframe = useCallback((iframe: HTMLIFrameElement) => {
    if (!iframeHasGatewayMock(iframe)) return false
    attachBackHandler(iframe)
    attachGatewayActionHandler(iframe)
    return true
  }, [])
  useEffect(() => {
    if (isControlView) return
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const poll = () => {
      if (cancelled) return
      const iframe = iframeRef.current
      if (iframe && wireIframe(iframe)) return
      timeout = setTimeout(poll, 50)
    }
    poll()
    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
    }
  }, [active.id, isControlView, wireIframe])
  return (
    <div className="gateway-shell">
      <style>{`
        .gateway-shell{display:grid;grid-template-columns:220px minmax(0,1fr);height:100%;min-height:100vh;background:#0a0d12;color:#f1f4f9;font-family:'Inter',system-ui,sans-serif}
        .gateway-shell .gw-side{background:#0e1218;border-right:1px solid rgba(255,255,255,.10);padding:20px 12px;overflow-y:auto}
        .gateway-shell .gw-side h3{margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:.10em;text-transform:uppercase;color:#9aa3b2;padding:0 10px}
        .gateway-shell .gw-side .sub{font-size:10.5px;color:#6b7280;padding:0 10px;margin-bottom:14px}
        .gateway-shell .gw-side .gw-tab{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:6px;font-size:12.5px;cursor:pointer;color:#cdd4df;border:1px solid transparent;margin-bottom:2px;background:transparent;width:100%;text-align:left}
        .gateway-shell .gw-side .gw-tab:hover{background:#131923;color:#f1f4f9}
        .gateway-shell .gw-side .gw-tab.active{background:#1a212d;color:#f1f4f9;border-color:rgba(255,255,255,.10)}
        .gateway-shell .gw-side .gw-tab .hint{font-size:10px;color:#6b7280;font-weight:400}
        .gateway-shell .gw-side .gw-tab.active .hint{color:#9aa3b2}
        .gateway-shell .gw-content{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;min-height:100vh;background:#0a0d12}
        .gateway-shell .gw-content.has-access.access-expanded{grid-template-columns:minmax(0,1fr) minmax(390px,520px)}
        .gateway-shell .gw-content.has-access.access-collapsed{grid-template-columns:minmax(0,1fr) 240px}
        .gateway-shell .gw-main-column{display:flex;flex-direction:column;min-width:0;min-height:100vh}
        .gateway-shell .gw-frame-wrap{background:#0a0d12;height:100%;min-height:100vh}
        .gateway-shell .gw-frame-wrap .gw-frame{width:100%;height:100%;min-height:100vh;border:0;display:block;background:#0a0d12}
        .gateway-shell .gw-access-rail{min-width:0;max-height:100vh;overflow:auto;border-left:1px solid rgba(255,255,255,.10);background:#0d121a}
        .gateway-shell .gw-access-reopen{display:flex;justify-content:flex-end;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:#0d121a}
        .gateway-shell .gw-access-reopen button{border:1px solid rgba(76,211,194,.52);border-radius:6px;background:#102520;color:#78f2e2;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer}
        .gateway-shell .agent-interface-panel{height:100%;min-height:100vh;overflow:auto;border:0;background:#0d121a;padding:12px;color:#eef4f8}
        .gateway-shell .agent-interface-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
        .gateway-shell .agent-interface-title{display:grid;gap:3px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9be7df}
        .gateway-shell .agent-interface-title small{font-size:10.5px;font-weight:600;letter-spacing:0;text-transform:none;color:#7e8998}
        .gateway-shell .agent-interface-controls{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}
        .gateway-shell .agent-interface-controls button,.gateway-shell .agent-interface-controls a{border:1px solid rgba(255,255,255,.13);border-radius:6px;background:#151c27;color:#dbe5f1;padding:6px 8px;font-size:11px;font-weight:700;text-decoration:none;cursor:pointer}
        .gateway-shell .agent-interface-controls a{color:#69b7ff}
        .gateway-shell .agent-interface-list{display:grid;gap:8px}
        .gateway-shell .agent-interface-row{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-items:start;border:1px solid rgba(255,255,255,.09);border-radius:7px;background:#121923;padding:9px}
        .gateway-shell .agent-row-main{display:grid;gap:3px;min-width:0}
        .gateway-shell .agent-row-main strong{font-size:13px;color:#f8fafc}
        .gateway-shell .agent-row-main span{font-size:11px;color:#b8c3d0;overflow-wrap:anywhere}
        .gateway-shell .agent-row-main small{font-size:11px;color:#8e9bad;line-height:1.35}
        .gateway-shell .agent-row-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;width:100%}
        .gateway-shell .agent-link{display:flex;align-items:center;justify-content:center;min-height:26px;border:1px solid rgba(89,211,194,.55);border-radius:6px;background:#102520;color:#78f2e2;text-decoration:none;font-size:11px;font-weight:650}
        .gateway-shell .agent-link.disabled{border-color:rgba(255,255,255,.11);background:#141923;color:#6d7684;cursor:not-allowed}
        .gateway-shell .agent-interface-panel.collapsed .agent-interface-head{align-items:flex-start}
        .gateway-shell .agent-interface-collapsed-list{display:grid;gap:7px}
        .gateway-shell .agent-interface-chip{display:grid;gap:2px;border:1px solid rgba(255,255,255,.08);border-radius:7px;background:#121923;padding:8px}
        .gateway-shell .agent-interface-chip strong{font-size:12px;color:#f8fafc}
        .gateway-shell .agent-interface-chip span{font-size:10.5px;color:#94a3b8;line-height:1.3}
        .gateway-shell .control-page{min-height:100vh;padding:30px;overflow:auto;background:#080c11;color:#eef4f8}
        .gateway-shell .control-hero{display:grid;gap:8px;max-width:980px;margin-bottom:18px}
        .gateway-shell .control-hero p{margin:0;color:#7ee7dc;font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:800}
        .gateway-shell .control-hero h1{margin:0;font-size:28px;line-height:1.15;letter-spacing:0}
        .gateway-shell .control-hero span{color:#9aa5b5;font-size:14px;line-height:1.5}
        .gateway-shell .control-actions-row{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
        .gateway-shell .control-action{display:inline-flex;align-items:center;justify-content:center;min-height:34px;border:1px solid rgba(89,211,194,.55);border-radius:6px;background:#102520;color:#78f2e2;padding:0 12px;text-decoration:none;font-size:12px;font-weight:750}
        .gateway-shell .control-action.disabled{border-color:rgba(255,255,255,.11);background:#141923;color:#6d7684;cursor:not-allowed}
        .gateway-shell .control-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 18px}
        .gateway-shell .control-card{display:grid;gap:7px;min-height:104px;border:1px solid rgba(255,255,255,.10);border-radius:8px;background:#121923;padding:14px}
        .gateway-shell .control-card strong{font-size:13px;color:#f8fafc}
        .gateway-shell .control-card span{font-size:12px;color:#b7c3d2;line-height:1.45;overflow-wrap:anywhere}
        .gateway-shell .control-card small{font-size:11px;color:#8f9aad;line-height:1.4;overflow-wrap:anywhere}
        .gateway-shell .control-status{border:1px solid rgba(255,255,255,.10);border-radius:8px;background:#111923;padding:14px;max-width:1100px}
        .gateway-shell .control-status.muted{color:#9aa5b5}
        .gateway-shell .control-status.warning{display:grid;gap:6px;border-color:rgba(245,181,10,.5);color:#f7d477}
        .gateway-shell .status-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px}
        .gateway-shell .status-head strong{font-size:14px;color:#f8fafc}
        .gateway-shell .status-head span{font-size:11px;color:#8f9aad}
        .gateway-shell .control-status dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0}
        .gateway-shell .control-status dl div{display:grid;gap:3px;border:1px solid rgba(255,255,255,.08);border-radius:6px;background:#0d131c;padding:10px}
        .gateway-shell .control-status dt{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:#798599}
        .gateway-shell .control-status dd{margin:0;font-size:12px;color:#dce6f2;overflow-wrap:anywhere}
        @media (max-width:1100px){.gateway-shell{grid-template-columns:180px minmax(0,1fr)}.gateway-shell .gw-content.has-access.access-expanded,.gateway-shell .gw-content.has-access.access-collapsed{grid-template-columns:1fr}.gateway-shell .gw-access-rail{order:-1;max-height:none;border-left:0;border-bottom:1px solid rgba(255,255,255,.10)}.gateway-shell .agent-interface-panel{min-height:0;max-height:48vh}.gateway-shell .agent-row-actions{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media (max-width:1100px){.gateway-shell .control-grid{grid-template-columns:1fr 1fr}.gateway-shell .control-status dl{grid-template-columns:1fr}}
        @media (max-width:760px){.gateway-shell{grid-template-columns:1fr}.gateway-shell .gw-side{position:relative;border-right:0;border-bottom:1px solid rgba(255,255,255,.10)}.gateway-shell .agent-row-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.gateway-shell .control-page{padding:20px}.gateway-shell .control-grid{grid-template-columns:1fr}}
      `}</style>
      <aside className="gw-side">
        <h3>Gateway</h3>
        <div className="sub">
          {/* "Mission Control" is a return link to the main board (engineering
              navigation only — preserves visual: inherit color/decoration/cursor).
              Designer Contract Rule 3 pre-approves accessibility/semantic
              upgrades that preserve visual parity. */}
          <a
            href="/"
            style={{ color: 'inherit', textDecoration: 'inherit', cursor: 'inherit' }}
            aria-label="Return to Mission Control board"
            data-testid="gateway-shell-return-home"
          >Mission Control</a> · Gateway
        </div>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'gw-tab' + (t.id === activeId ? ' active' : '')}
            onClick={() => { setActiveId(t.id); router.push(`/gateway/${t.seg}`) }}
            data-testid={`gateway-tab-${t.id}`}
          >
            <span>{t.label}</span>
            <span className="hint">{t.hint}</span>
          </button>
        ))}
      </aside>
      <div className={`gw-content ${showAccessRail ? `has-access access-${accessPanelMode}` : 'access-off'}`}>
        <div className="gw-main-column">
          {showAccessRail && accessPanelMode === 'hidden' && (
            <div className="gw-access-reopen">
              <button type="button" onClick={() => setAccessPanelMode('expanded')} data-testid="agent-interface-reopen">
                Agent Control Center
              </button>
            </div>
          )}
          <div className="gw-frame-wrap">
            {controlView ? (
              <GatewayControlSurface view={controlView} />
            ) : (
              <iframe
                ref={iframeRef}
                key={active.id}
                className="gw-frame"
                src={encodeURI(`${BASE}/design/gateway/${active.src}`)}
                title={`Gateway · ${active.label}`}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin"
                data-testid="gateway-iframe"
                onLoad={(e: SyntheticEvent<HTMLIFrameElement>) => {
                  wireIframe(e.currentTarget)
                }}
              />
            )}
          </div>
        </div>
        {showAccessRail && accessPanelMode !== 'hidden' && (
          <aside className="gw-access-rail" aria-label="Agent Control Center rail">
            <AgentInterfaceInventory
              mode={accessPanelMode}
              onCollapse={() => setAccessPanelMode('collapsed')}
              onExpand={() => setAccessPanelMode('expanded')}
              onClose={() => setAccessPanelMode('hidden')}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

export { TABS as GATEWAY_TABS, resolveTab as activeTabFrom }
export { gatewayActionForButton } from './gateway-actions'
export function iframeSrcFor(t: Tab): string { return encodeURI(`${BASE}/design/gateway/${t.src}`) }
export function controlViewFromPath(pathname: string | null, q: URLSearchParams | null): GatewayControlView | null {
  return controlViewFrom(pathname, q)
}
export type { Tab as GatewayTab }
