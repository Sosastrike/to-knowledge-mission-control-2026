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
import {
  HERMES_COMMAND_CENTER_ROUTE,
  HERMES_STANDALONE_PROXY_ROUTE,
  HERMES_WEB_INTERFACE_ACTIONS,
  HERMES_WEB_INTERFACE_BASE,
  HERMES_WEB_INTERFACE_MODES,
  HERMES_WEB_INTERFACE_PAGES,
  HERMES_WEB_INTERFACE_SECTIONS,
  getHermesWebInterfacePage,
  isHermesWebInterfaceMode,
  type HermesWebInterfaceMode,
} from '@/lib/hermes-web-interface'
import { ZAPIER_GATEWAY_CARD_COPY } from '@/lib/zapier-approved-action-library'
import { PAPERCLIP_ECO_DASHBOARD, PAPERCLIP_ECO_WINDOW_NAME, attachGatewayActionHandler } from './gateway-actions'

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

function gatewayFrameSrcFor(t: Tab, q?: URLSearchParams | null): string {
  const src = encodeURI(`${BASE}/design/gateway/${t.src}`)
  if (t.id === 'overview' && q?.get('trace') === 'zapier') return `${src}?trace=zapier`
  return src
}

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
  detail?: string
  guardrail?: string
  blocker: string
  nextFix: string
  buttons: AgentAccessButtons
}

type AgentInterfacePanelMode = 'expanded' | 'collapsed'

type PaperclipWorkspaceLaunch = {
  workspace_name: string
  issue_prefix: string | null
  canonical_launch_url: string | null
  open_enabled: boolean
  disabled_reason: string | null
}

type PaperclipWorkspaceTruthPayload = {
  ok?: boolean
  generated_at?: string
  live_workspace_names?: string[]
  expected_owner_workspaces?: string[]
  missing_expected_workspaces?: string[]
  workspace_selector_required?: boolean
  mismatch_detected?: boolean
  hard_coded_eco_only?: false
  selected_default_workspace?: string | null
  workspace_launches?: PaperclipWorkspaceLaunch[]
  execution_enabled?: false
  writes_enabled?: false
  credential_values_exposed?: false
  no_secrets_exposed?: true
  next_action?: string
  blocker?: string
  error?: string
}

const enabled = (href: string): AgentAccessButton => ({ enabled: true, href, blocker: '' })
const disabled = (blocker: string): AgentAccessButton => ({ enabled: false, href: null, blocker })
const GATEWAY_TOOLS_ROUTE = '/gateway/tools'
const GATEWAY_BRAIN_ROUTE = '/gateway/brain'
const HERMES_DIRECT_LINE_CHAT_PROOF = 'Ron Weasley local direct-line proof is present; Mission Control proxy certification requires the authenticated browser proof run.'
const agentControlRoute = (slug: string, mode: string): string => `/gateway/agent-hub/${slug}/${mode}`
const paperclipControlRoute = (mode: string): string => agentControlRoute('paperclip', mode)
const AGENT_AUTO_UPDATE_STATUS_ROUTE = '/api/bridge/agent-updates/status'
const AGENT_AUTO_UPDATE_RUN_ROUTE = '/api/bridge/agent-updates/run'
const AUTO_UPDATE_SAFE_TARGETS = ['Ron Weasley WebUI', 'Ron Weasley Agent'] as const
const AUTO_UPDATE_VISIBLE_TASK_TARGETS = ['Mission Control', 'Agent Zero / Jarvis', 'SpaceAgent', 'Pi', 'Paperclip', 'OpenClaw / OpenCloud Supporting Runtime Only'] as const
const GATEWAY_ROUTE_TRUTH_STATUS_ROUTE = '/api/gateway/agent-hub/status'
const GATEWAY_ROUTE_TRUTH_ROUTES = ['/api/gateway/status', '/api/gateway/registry', '/api/gateway/flows', '/api/bridge/playwright-mcp/status'] as const
const GATEWAY_ROUTE_TRUTH_LEGACY_FIXES = ['/tools -> /gateway/tools', '/routes -> /api/gateway/flows', '/health -> /api/gateway/status'] as const

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
    status: 'operational · exact-scope execution certified',
    blocker: 'owner_hard_stops_only_remaining · Jarvis has an active owner Bridge Session and certified exact-scope execution adapters. Raw secrets, .env edits, public exposure, broad connector execution, and credential injection remain hard stops.',
    nextFix: 'Continue the Jarvis Full GO adapter sprint through exact-scope routes with audit and rollback. Do not mark broad external connectors unlocked until their own adapter proof exists.',
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
    name: 'Ron Weasley',
    service: 'Mission Control Ron Weasley WebUI + optional loopback standalone',
    localBind: 'server-local 127.0.0.1',
    port: '8787 · server-local loopback only',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/bridge/hermes/webui/status',
    authRequired: true,
    status: 'FULL_ACCESS_DELEGATED · direct Nuclear Gateway line',
    blocker: 'standalone_hermes_webui_proxy_required_if_8787_unreachable · localhost is server-local; owner browser access must use the Mission Control authenticated proxy. Writes/executions still require Jarvis delegation. OpenClaw and ClaudeClaw are not in the path.',
    nextFix: 'Use /gateway/agent-hub/ron/webui/app for the actual Ron Weasley WebUI app and /gateway/agent-hub/ron/config for the Mission Control command center. Legacy /gateway/agent-hub/hermes routes remain aliases. Direct-line chat is available through the Ron WebUI proxy; protected writes and execution still require Jarvis concurrence.',
    buttons: {
      ui: enabled(HERMES_STANDALONE_PROXY_ROUTE),
      config: enabled(HERMES_COMMAND_CENTER_ROUTE),
      brain: enabled(`${HERMES_WEB_INTERFACE_BASE}/brain-map`),
      chat: enabled(HERMES_STANDALONE_PROXY_ROUTE),
      tools: enabled(`${HERMES_WEB_INTERFACE_BASE}/tool-map`),
      health: enabled(`${HERMES_WEB_INTERFACE_BASE}/status`),
    },
  },
  {
    name: 'Pi',
    service: 'Mission Control full-access Gateway pipeline',
    localBind: 'Mission Control authenticated Gateway',
    port: 'Gateway-brokered',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/bridge/pi/status',
    authRequired: true,
    status: 'FULL ACCESS / DIRECT GATEWAY PIPELINE',
    blocker: 'production_execution_requires_jarvis_concurrence · Pi has brokered Gateway access but production-impacting execution stays Jarvis-gated. No raw secrets, cookies, .env values, or auth files are exposed.',
    nextFix: 'Use Pi as a full-access Gateway agent. Tools, skills, MCPs, providers, Brain reads, visible task events, exact-scope adapter requests, and pipeline requests route directly through Nuclear Gateway.',
    buttons: {
      ui: enabled(agentControlRoute('pi', 'config')),
      config: enabled(agentControlRoute('pi', 'config')),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: enabled(agentControlRoute('pi', 'recommend')),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(agentControlRoute('pi', 'config')),
    },
  },
  {
    name: 'SpaceAgent',
    service: 'Mission Control SpaceAgent direct line; Playwright MCP is a local tool',
    localBind: '127.0.0.1',
    port: '8931 via Playwright MCP',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/bridge/spaceagent/status',
    authRequired: true,
    status: 'configured · first-class direct-line agent · Jarvis final authority',
    blocker: 'production_execution_requires_jarvis_concurrence · firecrawl_credential_required · interactive_browser_actions_require_bridge_session · Playwright MCP is local-only on server 127.0.0.1:8931.',
    nextFix: 'Manage SpaceAgent through the canonical /api/bridge/spaceagent/* routes. Playwright MCP, Firecrawl, and YouTube are tools under SpaceAgent, not identity routes; production-impacting actions require Jarvis concurrence.',
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
    blocker: 'paperclip_writes_bridge_gated · Paperclip workspace truth is read-only and selector-backed. Real task creation and company/team bootstrap remain exact-scope adapter gated.',
    nextFix: 'Use the Paperclip workspace selector to open visible workspaces. Blocked workspaces must show a disabled reason; no Paperclip writes run from this surface.',
    buttons: {
      ui: enabled(paperclipControlRoute('ui')),
      config: enabled(paperclipControlRoute('config')),
      brain: disabled('paperclip_brain_surface_not_configured · Paperclip work-product/memory surface has not been proven yet.'),
      chat: disabled('paperclip_chat_surface_not_configured · No safe Paperclip chat/task-prompt surface is proven.'),
      tools: enabled(paperclipControlRoute('tools')),
      health: enabled(paperclipControlRoute('status')),
    },
  },
  {
    name: 'OpenClaw / OpenCloud',
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
      chat: disabled('OpenClaw/OpenCloud is supporting runtime only and not an agent line.'),
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
    proxyRoute: '/api/bridge/spaceagent/status',
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
    status: 'active · exact-scope execution enabled',
    blocker: 'owner_hard_stops_only_remaining · Bridge Session is active for Jarvis certified adapters; raw secrets, .env edits, credential injection, public exposure, destructive actions, and broad connector execution remain hard stops.',
    nextFix: 'Continue exact-scope adapter expansion through audit and rollback. Do not enable broad connectors outside an approved adapter scope.',
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
    status: 'blocked',
    blocker: 'agentmail_inbox_limit_exceeded · AgentMail inbox limit exceeded. 5 inboxes could not be provisioned: Pi, Agent Zero, Bridge Unit, Mission Control Monitor, Audit Archive.',
    nextFix: 'Increase AgentMail inbox capacity or explicitly approve a safe reuse mapping in AgentMail Local Control. Do not treat Bridge Session as the primary blocker until inboxes and scoped credentials are ready.',
    buttons: {
      ui: enabled('/agentmail'),
      config: enabled(GATEWAY_TOOLS_ROUTE),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('AgentMail send/reply is disabled. Current primary blocker: agentmail_inbox_limit_exceeded. Bridge Session is a later send gate after inboxes, scoped credentials, permissions, and approval are ready.'),
      tools: enabled(GATEWAY_TOOLS_ROUTE),
      health: enabled(GATEWAY_TOOLS_ROUTE),
    },
  },
  {
    name: 'Zapier',
    service: 'Zapier MCP connector through Gateway',
    localBind: 'none',
    port: 'MCP brokered',
    localUrl: null,
    tailnetUrl: null,
    proxyRoute: '/api/bridge/zapier/status',
    authRequired: true,
    status: ZAPIER_GATEWAY_CARD_COPY.status,
    detail: ZAPIER_GATEWAY_CARD_COPY.detail,
    guardrail: ZAPIER_GATEWAY_CARD_COPY.guardrail,
    blocker: '',
    nextFix: 'Use /api/bridge/zapier/approved-actions to inspect the exact approved-action library. Jarvis still executes only through /api/bridge/agent-zero/execute.',
    buttons: {
      ui: disabled('Zapier has no owner UI embedded in Mission Control; use the Gateway tools/status surfaces.'),
      config: enabled(GATEWAY_TOOLS_ROUTE),
      brain: enabled(GATEWAY_BRAIN_ROUTE),
      chat: disabled('Zapier is a connector, not a chat surface.'),
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

export function agentControlLinksFor(slug: string): AgentAccessButtons {
  const normalized = slug.trim().toLowerCase()
  const agent = AGENT_INTERFACE_LINKS.find((item) => {
    const name = item.name.toLowerCase()
    return name === normalized || name.replace(/\s+/g, '-') === normalized || name.replace(/\s+/g, '') === normalized
  })

  if (normalized === 'hermes') {
    return {
      ui: enabled(HERMES_STANDALONE_PROXY_ROUTE),
      config: enabled(HERMES_COMMAND_CENTER_ROUTE),
      brain: enabled(`${HERMES_WEB_INTERFACE_BASE}/brain-map`),
      chat: enabled(HERMES_STANDALONE_PROXY_ROUTE),
      tools: enabled(`${HERMES_WEB_INTERFACE_BASE}/tool-map`),
      health: enabled(`${HERMES_WEB_INTERFACE_BASE}/status`),
    }
  }

  return agent?.buttons || {
    ui: disabled('Agent interface is not registered.'),
    config: disabled('Agent configuration route is not registered.'),
    brain: disabled('Agent brain route is not registered.'),
    chat: disabled('Agent chat route is not registered.'),
    tools: disabled('Agent tools route is not registered.'),
    health: disabled('Agent health route is not registered.'),
  }
}

function externalLinkTarget(href: string): { target: string; rel?: string } {
  if (href === PAPERCLIP_ECO_DASHBOARD) return { target: PAPERCLIP_ECO_WINDOW_NAME }
  if (/^https?:\/\//.test(href)) return { target: '_blank', rel: 'noreferrer' }
  return { target: '' }
}

function LinkButton({ button, children }: { button: AgentAccessButton; children: string }) {
  if (!button.enabled || !button.href) {
    return <button type="button" className="agent-link disabled" title={button.blocker} disabled>{children}</button>
  }
  const target = externalLinkTarget(button.href)
  return (
    <a
      className="agent-link"
      href={button.href}
      target={target.target || undefined}
      rel={target.rel}
      onClick={(event) => event.stopPropagation()}
    >
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
      {!isCollapsed && (
        <>
          <AgentAutoUpdatePanel />
          <GatewayRouteCdpTruthPanel />
        </>
      )}
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
              <small>{agent.detail || agent.blocker}</small>
              {agent.guardrail ? (
                <small>guardrail: {agent.guardrail}</small>
              ) : (
                <small>next fix: {agent.nextFix}</small>
              )}
            </div>
            <div className="agent-row-actions">
              <LinkButton button={agent.buttons.ui}>Open UI</LinkButton>
              <LinkButton button={agent.buttons.config}>Open Config</LinkButton>
              <LinkButton button={agent.buttons.brain}>Open Brain</LinkButton>
              <LinkButton button={agent.buttons.chat}>{agent.name === 'Pi' ? 'Open Pi' : agent.name === 'SpaceAgent' ? 'Open Research' : 'Open Chat'}</LinkButton>
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

function AgentAutoUpdatePanel() {
  return (
    <section className="agent-update-panel" aria-label="Agent Auto-Update Control Plane" data-status-route={AGENT_AUTO_UPDATE_STATUS_ROUTE} data-run-route={AGENT_AUTO_UPDATE_RUN_ROUTE}>
      <div className="agent-update-head">
        <strong>Agent Auto-Update Control Plane</strong>
        <span>every 6h · exact scoped auto-apply</span>
      </div>
      <p>Ron Weasley can self-update through certified loopback targets; unsafe or uncertified updates become visible tasks with rollback proof. OpenCloud intermediary: false.</p>
      <div className="agent-update-actions">
        <a href={AGENT_AUTO_UPDATE_STATUS_ROUTE}>Open update status</a>
        <code>{AGENT_AUTO_UPDATE_RUN_ROUTE}</code>
      </div>
      <div className="agent-update-targets">
        <div>
          <span>Certified auto-apply</span>
          <small>{AUTO_UPDATE_SAFE_TARGETS.join(' · ')}</small>
        </div>
        <div>
          <span>Visible task only</span>
          <small>{AUTO_UPDATE_VISIBLE_TASK_TARGETS.join(' · ')}</small>
        </div>
      </div>
    </section>
  )
}

function GatewayRouteCdpTruthPanel() {
  return (
    <section className="agent-update-panel gateway-route-truth-panel" aria-label="Gateway Route / CDP Truth" data-status-route={GATEWAY_ROUTE_TRUTH_STATUS_ROUTE}>
      <div className="agent-update-head">
        <strong>Gateway Route / CDP Truth</strong>
        <span>ROUTE_MAP_REQUIRED · CDP_NOT_RUNNING until live MCP proof</span>
      </div>
      <p>Route truth is served from source-enumerated Mission Control Nuclear Gateway endpoints. Bare /tools, /routes, and /health are legacy misses; Playwright MCP/CDP remains local-only with no public exposure.</p>
      <div className="agent-update-actions">
        <a href={GATEWAY_ROUTE_TRUTH_STATUS_ROUTE}>Open route/CDP status</a>
        <code>{GATEWAY_ROUTE_TRUTH_STATUS_ROUTE}</code>
      </div>
      <div className="agent-update-targets">
        <div>
          <span>Canonical routes</span>
          <small>{GATEWAY_ROUTE_TRUTH_ROUTES.join(' · ')}</small>
        </div>
        <div>
          <span>Legacy corrections</span>
          <small>{GATEWAY_ROUTE_TRUTH_LEGACY_FIXES.join(' · ')}</small>
        </div>
      </div>
    </section>
  )
}

type AgentSlug = 'agent-zero' | 'hermes' | 'pi' | 'spaceagent' | 'paperclip' | 'openclaw'
type BaseAgentPanelMode = 'config' | 'chat' | 'recommend' | 'research' | 'ui' | 'tools' | 'companies' | 'agents' | 'issues' | 'status' | 'audit' | 'help' | 'telegram-agent'
type AgentPanelMode = BaseAgentPanelMode | HermesWebInterfaceMode
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
    status: 'operational · exact-scope execution certified',
    endpoint: '/api/agent-zero/status',
    uiHref: 'http://100.116.35.95:50080/',
    blocker: 'owner_hard_stops_only_remaining',
    nextAction: 'Jarvis can execute certified exact-scope adapters through Mission Control now. Remaining blocks are owner-hard-stop categories and connectors that still need credentials or adapter proof.',
    modes: ['config', 'chat'],
  },
  hermes: {
    slug: 'hermes',
    name: 'Ron Weasley',
    role: 'Nuclear Dispatcher · optimization and workflow architect',
    status: 'FULL_ACCESS_DELEGATED · direct Nuclear Gateway line',
    endpoint: '/api/bridge/hermes/webui/status',
    uiHref: HERMES_STANDALONE_PROXY_ROUTE,
    blocker: 'jarvis_signed_exact_scope_delegation_required · hermes_webui_proxy_or_service_required',
    nextAction: 'Use Open UI for the actual Ron Weasley WebUI app through the authenticated Mission Control proxy. Use Open Command Center for the internal Mission Control Ron Weasley control page. Direct-line chat is disabled until the real Ron Weasley chat adapter is installed.',
    modes: [...HERMES_WEB_INTERFACE_MODES],
  },
  pi: {
    slug: 'pi',
    name: 'Pi',
    role: 'Full Access Gateway Agent',
    status: 'FULL ACCESS / DIRECT GATEWAY PIPELINE',
    endpoint: '/api/bridge/pi/status',
    uiHref: agentControlRoute('pi', 'config'),
    blocker: 'production_execution_requires_jarvis_concurrence',
    nextAction: 'Pi has direct brokered Gateway access to tools, skills, MCPs, providers, Brain reads, visible task events, exact-scope adapter requests, and pipeline requests. Production-impacting execution remains Jarvis-gated.',
    modes: ['config', 'recommend', 'tools'],
  },
  spaceagent: {
    slug: 'spaceagent',
    name: 'SpaceAgent',
    role: 'Independent specialized agent · Gateway pipeline',
    status: 'configured · first-class direct-line agent · Jarvis final authority',
    endpoint: '/api/bridge/spaceagent/status',
    uiHref: null,
    blocker: 'production_execution_requires_jarvis_concurrence · firecrawl_credential_required · interactive_browser_actions_require_bridge_session',
    nextAction: 'Use canonical /api/bridge/spaceagent/* for status, readiness, capability, authority, report drafts, and Jarvis concurrence requests. Tools stay brokered through Gateway and exact-scope adapters.',
    modes: ['config', 'research'],
  },
  paperclip: {
    slug: 'paperclip',
    name: 'Paperclip',
    role: 'Workforce control plane',
    status: 'INSTALLED / READY - WRITES BRIDGE-GATED',
    endpoint: '/api/bridge/paperclip/status',
    uiHref: paperclipControlRoute('ui'),
    blocker: 'paperclip_writes_bridge_gated',
    nextAction: 'Use the Paperclip workspace selector for visible companies. Real task writes, comments, company bootstrap, and agent hires remain Bridge-gated exact-scope adapter actions.',
    modes: ['config', 'ui', 'status', 'tools', 'companies', 'agents', 'issues', 'audit', 'help', 'telegram-agent'],
  },
  openclaw: {
    slug: 'openclaw',
    name: 'OpenClaw / OpenCloud',
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
  overview: 'Command Center',
  config: 'Config',
  chat: 'Chat / Test',
  recommend: 'Recommendations',
  research: 'Research',
  ui: 'Workspace UI',
  tools: 'Tools',
  companies: 'Companies',
  agents: 'Agents',
  issues: 'Issues / Tasks',
  status: 'Status',
  routes: 'Routes',
  'brain-map': 'Brain Map',
  'tool-map': 'Tool Map',
  'skill-registry': 'Skill Registry',
  'mini-agent-registry': 'Mini-Agent Registry',
  pipelines: 'Pipelines',
  tasks: 'Tasks',
  logs: 'Logs / Audit',
  'dispatch-plan': 'Dispatch Plan',
  'jarvis-concurrence': 'Jarvis Concurrence',
  audit: 'Audit',
  help: 'Help',
  'telegram-agent': 'Telegram Agent',
}

const AGENT_PANEL_MODE_VALUES: readonly AgentPanelMode[] = [
  'config',
  'chat',
  'recommend',
  'research',
  'ui',
  'tools',
  'companies',
  'agents',
  'issues',
  'status',
  'audit',
  'help',
  'telegram-agent',
  ...HERMES_WEB_INTERFACE_MODES,
]

const CONTROL_MODE_MATCH = `(${AGENT_PANEL_MODE_VALUES.join('|')})`

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
    return { kind: 'agent', slug: 'paperclip', mode: 'ui' }
  }
  if (parts[1] === 'agent-hub' && (parts[2] === 'hermes' || parts[2] === 'ron') && !parts[3]) {
    return { kind: 'agent', slug: 'hermes', mode: 'overview' }
  }
  if (parts[1] === 'agent-hub' && parts[2] && parts[3]) {
    const slug = (parts[2] === 'ron' ? 'hermes' : parts[2]) as AgentSlug
    const mode = parts[3] as AgentPanelMode
    const agentDef = AGENT_CONTROL_DEFS[slug]
    if (agentDef && (slug === 'hermes' ? AGENT_PANEL_MODE_VALUES.includes(mode) : agentDef.modes.includes(mode))) {
      return { kind: 'agent', slug, mode }
    }
  }
  if (parts[1] === 'agents' && parts[2] === 'paperclip') {
    const requestedMode = parts[3] as AgentPanelMode | undefined
    const mode = requestedMode && ['config', 'tools', 'companies', 'agents', 'issues', 'status', 'audit', 'help', 'telegram-agent'].includes(requestedMode)
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
  agent_visibility: 'Agent Zero, Ron Weasley, Pi, SpaceAgent, Paperclip, and OpenClaw/OpenCloud supporting runtime must consume Brain through Nuclear Gateway status/contracts only',
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

function RonProxyProofControl() {
  const [state, setState] = useState<{
    phase: 'loading' | 'ready' | 'running' | 'error'
    status?: number
    payload?: Record<string, unknown>
    error?: string
  }>({ phase: 'loading' })

  const loadProof = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      const response = await fetch('/api/bridge/ron/runtime-proof', { credentials: 'include', cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      setState({
        phase: 'ready',
        status: response.status,
        payload: payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {},
      })
    } catch (error) {
      setState({ phase: 'error', error: error instanceof Error ? error.message : 'runtime proof unavailable' })
    }
  }, [])

  useEffect(() => {
    void loadProof()
  }, [loadProof])

  const runProof = useCallback(async () => {
    setState((current) => ({ ...current, phase: 'running', error: undefined }))
    try {
      const response = await fetch('/api/bridge/ron/runtime-proof', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'run_mission_control_proxy_proof' }),
      })
      const payload = await response.json().catch(() => null)
      const record = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
      if (!response.ok) {
        setState({
          phase: 'error',
          status: response.status,
          payload: record,
          error: firstStatusString(record.exact_blocker, record.error) || 'ron_proxy_proof_failed',
        })
        return
      }
      await loadProof()
    } catch (error) {
      setState({ phase: 'error', error: error instanceof Error ? error.message : 'ron_proxy_proof_failed' })
    }
  }, [loadProof])

  const payload = state.payload || {}
  const components = payload.components && typeof payload.components === 'object' && !Array.isArray(payload.components)
    ? payload.components as Record<string, unknown>
    : {}
  const proxy = components.mission_control_proxy && typeof components.mission_control_proxy === 'object' && !Array.isArray(components.mission_control_proxy)
    ? components.mission_control_proxy as Record<string, unknown>
    : {}
  const certified = proxy.authenticated_proxy_send_receive_proof === true
  const blocker = firstStatusString(proxy.exact_blocker, payload.blocker, state.error) || 'none'

  return (
    <section className="control-status ron-proxy-proof-panel" data-testid="ron-proxy-proof-panel">
      <div className="status-head">
        <strong>Mission Control Proxy Proof</strong>
        <span>{certified ? 'certified' : state.phase === 'running' ? 'running' : blocker}</span>
      </div>
      <div className="control-actions-row" aria-label="Ron proxy proof actions">
        <button type="button" onClick={() => void runProof()} disabled={state.phase === 'running'} className="control-action">
          {state.phase === 'running' ? 'Running Ron Proxy Proof...' : 'Run Ron Proxy Proof'}
        </button>
        <button type="button" onClick={() => void loadProof()} disabled={state.phase === 'running'} className="control-action">
          Refresh runtime proof
        </button>
      </div>
      <dl>
        <div>
          <dt>target agent</dt>
          <dd>ron-weasley</dd>
        </div>
        <div>
          <dt>conversation owner</dt>
          <dd>ron-weasley</dd>
        </div>
        <div>
          <dt>direct line used</dt>
          <dd>{certified ? 'true' : 'pending authenticated proof'}</dd>
        </div>
        <div>
          <dt>OpenCloud / OpenClaw intermediary</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>response received</dt>
          <dd>{proxy.response_received === true ? 'true' : 'pending'}</dd>
        </div>
        <div>
          <dt>session id exposed</dt>
          <dd>{proxy.session_id_value_exposed === false ? 'false' : 'false'}</dd>
        </div>
        <div>
          <dt>tokens/cookies exposed</dt>
          <dd>{proxy.tokens_cookies_exposed === false ? 'false' : 'false'}</dd>
        </div>
        <div>
          <dt>visible task event</dt>
          <dd>{proxy.visible_task_event_written === true ? 'written' : 'pending'}</dd>
        </div>
      </dl>
      {state.phase === 'error' && (
        <div className="control-status warning">
          <strong>Ron proxy proof blocker</strong>
          <span>{blocker}</span>
        </div>
      )}
    </section>
  )
}

function ControlLink({ href, children, disabled }: { href: string | null; children: string; disabled?: boolean }) {
  if (!href || disabled) return <button type="button" className="control-action disabled" disabled>{children}</button>
  const target = externalLinkTarget(href)
  return (
    <a
      className="control-action"
      href={href}
      target={target.target || undefined}
      rel={target.rel}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  )
}

function PaperclipWorkspaceSelectorPanel() {
  const [state, setState] = useState<{
    phase: 'loading' | 'ready' | 'error'
    status?: number
    payload?: PaperclipWorkspaceTruthPayload
    error?: string
  }>({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/bridge/paperclip/workspace-truth', { credentials: 'include' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (cancelled) return
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          setState({ phase: 'ready', status: response.status, payload: payload as PaperclipWorkspaceTruthPayload })
          return
        }
        setState({ phase: 'error', status: response.status, error: 'Workspace truth route did not return JSON.' })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ phase: 'error', error: error instanceof Error ? error.message : 'unknown error' })
      })
    return () => { cancelled = true }
  }, [])

  if (state.phase === 'loading') {
    return (
      <section className="control-status muted" data-testid="paperclip-workspace-selector">
        Loading Paperclip workspace truth...
      </section>
    )
  }

  if (state.phase === 'error') {
    return (
      <section className="control-status warning" data-testid="paperclip-workspace-selector">
        <strong>Workspace selector unavailable</strong>
        <span>{state.error}</span>
        <small>No Paperclip writes were attempted.</small>
      </section>
    )
  }

  const payload = state.payload || {}
  const launches = payload.workspace_launches || []
  const authRequired = state.status === 401
  return (
    <section className="control-status" data-testid="paperclip-workspace-selector" data-paperclip-hard-coded-eco-only={String(payload.hard_coded_eco_only === false ? false : true)}>
      <div className="status-head">
        <strong>Paperclip Workspace Selector</strong>
        <span>HTTP {state.status ?? 'unknown'} · hard-coded ECO only: {payload.hard_coded_eco_only === false ? 'false' : 'unknown'}</span>
      </div>
      {authRequired ? (
        <div className="control-status warning">
          <strong>Owner authentication required</strong>
          <span>Sign in to Mission Control to load Paperclip workspace truth. No Paperclip writes were attempted.</span>
        </div>
      ) : (
        <>
          <dl>
            <div>
              <dt>visible workspaces</dt>
              <dd>{(payload.live_workspace_names || []).join(', ') || 'none visible'}</dd>
            </div>
            <div>
              <dt>selected default</dt>
              <dd>{payload.selected_default_workspace || 'none'}</dd>
            </div>
            <div>
              <dt>mismatch detected</dt>
              <dd>{payload.mismatch_detected ? 'yes' : 'no'}</dd>
            </div>
            <div>
              <dt>writes</dt>
              <dd>{payload.writes_enabled === false ? 'disabled' : 'unknown'}</dd>
            </div>
          </dl>
          <div className="workspace-launch-grid" aria-label="Paperclip workspace launches">
            {launches.map((workspace) => {
              const target = workspace.canonical_launch_url ? externalLinkTarget(workspace.canonical_launch_url) : { target: undefined, rel: undefined }
              return (
                <article
                  key={workspace.workspace_name}
                  className="control-card"
                  data-paperclip-workspace={workspace.workspace_name}
                  data-paperclip-workspace-open-enabled={String(workspace.open_enabled)}
                >
                  <strong>{workspace.workspace_name}</strong>
                  <span>{workspace.issue_prefix || 'no issue prefix'} · {workspace.open_enabled ? 'visible' : 'blocked'}</span>
                  <small>{workspace.open_enabled ? workspace.canonical_launch_url : workspace.disabled_reason || 'workspace launch blocked'}</small>
                  {workspace.open_enabled && workspace.canonical_launch_url ? (
                    <div className="workspace-launch-actions">
                      <a className="control-action" href={workspace.canonical_launch_url} target={target.target || undefined} rel={target.rel}>Open UI</a>
                      <a className="control-action" href={workspace.canonical_launch_url} target="_blank" rel="noreferrer">Open in New Tab</a>
                    </div>
                  ) : (
                    <button type="button" className="control-action disabled" disabled>{workspace.disabled_reason || 'workspace blocked'}</button>
                  )}
                </article>
              )
            })}
          </div>
          <small>{payload.next_action || 'Workspace truth is read-only; writes require exact-scope adapter proof.'}</small>
        </>
      )}
    </section>
  )
}

function GatewayToolsPanel() {
  const connectors = AGENT_INTERFACE_LINKS.filter((row) => ['Telegram', 'AgentMail', 'Zapier', 'Google Drive', 'OneDrive', 'Firecrawl', 'YouTube', 'Playwright MCP'].includes(row.name))
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

const HERMES_SECTION_COPY: Record<(typeof HERMES_WEB_INTERFACE_SECTIONS)[number], string> = {
  'Ron Weasley Overview': 'Nuclear Dispatcher identity, direct line, and Jarvis authority boundary.',
  'Status / readiness': 'Live readiness, delegated full-access state, service health, and blockers.',
  'Active dispatch plans': 'Internal dispatch-plan drafting routes. Production impact requires Jarvis concurrence.',
  'Jarvis concurrence queue': 'Concurrence requests for production-impacting Ron Weasley plans.',
  'Brain / memory map': 'Brain Bridge, memory hygiene, canonical truth, and stale-context protection.',
  'Tool map': 'Gateway tools, read-only research tools, exact-scope execution adapters, and blocked broad actions.',
  'Skill registry': 'Skill Foundry, skill drafts, versioning, and test-plan lanes.',
  'Mini-agent registry': 'Mini-agent templates, scopes, task market, temporary memory, and authority limits.',
  'Workflow compiler': 'Workflow drafts, compiler patterns, pipeline readiness, and automation recommendations.',
  'Paperclip intelligence': 'Paperclip recommendations and workforce planning only; writes remain credential/adapter gated.',
  'n8n / Zapier optimization': 'n8n/Zapier optimization intelligence without broad connector execution.',
  'Agent performance optimizer': 'Provider/model routing, quality scoring, retry logic, and performance recommendations.',
  'Logs / audit / rollback': 'Read-only audit, route trace, rollback/no-state proof, and visible task evidence.',
}

function HermesCommandCenterPanel({ mode }: { mode: AgentPanelMode }) {
  if (mode === 'chat') {
    return (
      <main className="control-page hermes-command-center" data-testid="agent-control-hermes-chat">
        <header className="control-hero">
          <p>Ron Weasley · Direct-Line Chat</p>
          <h1>Ron Weasley Direct-Line Chat Installed</h1>
          <span>
            Text direct-line proof passed through the Mission Control Ron WebUI proxy. Required path remains:
            Owner → Mission Control → Nuclear Gateway → Ron Weasley, with OpenCloud hidden intermediary false.
          </span>
        </header>
        <section className="control-actions-row" aria-label="Ron Weasley chat blocked actions">
          <ControlLink href={HERMES_STANDALONE_PROXY_ROUTE}>Open UI</ControlLink>
          <ControlLink href={HERMES_COMMAND_CENTER_ROUTE}>Open Command Center</ControlLink>
          <ControlLink href={`${HERMES_WEB_INTERFACE_BASE}/routes`}>Trace Routes</ControlLink>
        </section>
        <section className="control-grid">
          <article className="control-card">
            <strong>Status</strong>
            <span>{HERMES_DIRECT_LINE_CHAT_PROOF}</span>
          </article>
          <article className="control-card">
            <strong>Direct line requirement</strong>
            <span>Owner messages must route through Mission Control and Nuclear Gateway to Ron Weasley, never through OpenCloud as a hidden dispatcher.</span>
          </article>
          <article className="control-card">
            <strong>Next safe action</strong>
            <span>Use the Ron WebUI proxy for direct-line chat. Keep production-impacting writes behind Jarvis concurrence and exact-scope audit.</span>
          </article>
        </section>
      </main>
    )
  }

  const hermesMode = isHermesWebInterfaceMode(mode) ? mode : 'overview'
  const page = getHermesWebInterfacePage(hermesMode) || HERMES_WEB_INTERFACE_PAGES[0]
  const readEndpoint = page.method === 'GET' ? page.apiRoute : '/api/bridge/hermes/status'
  const relatedPages = HERMES_WEB_INTERFACE_PAGES.filter((candidate) => candidate.section === page.section)

  return (
    <main className="control-page hermes-command-center" data-testid={`agent-control-hermes-${hermesMode}`}>
      <header className="control-hero">
        <p>Ron Weasley · Nuclear Dispatcher under Jarvis</p>
        <h1>Ron Weasley Command Center · {page.label}</h1>
        <span>
          Mission Control and Nuclear Gateway are the primary Ron Weasley control path. OpenCloud/OpenClaw is supporting runtime only,
          not Ron Weasley, not Jarvis, and not an owner-facing intermediary.
        </span>
      </header>
      <section className="control-actions-row" aria-label="Ron Weasley command center actions">
        {HERMES_WEB_INTERFACE_ACTIONS.map((action) => (
          <ControlLink key={action.label} href={action.href}>{action.label}</ControlLink>
        ))}
      </section>
      <section className="control-grid hermes-proof-grid">
        <article className="control-card">
          <strong>Direct line</strong>
          <span>Owner → Mission Control → Nuclear Gateway → Ron Weasley. OpenCloud hidden intermediary: false.</span>
        </article>
        <article className="control-card">
          <strong>Authority</strong>
          <span>Ron Weasley can recommend, dispatch, draft, optimize, and plan. Production-impacting work requires Jarvis concurrence.</span>
        </article>
        <article className="control-card">
          <strong>Standalone WebUI</strong>
          <span>Owner access uses /gateway/agent-hub/ron/webui/app. The backing 127.0.0.1:8787 service is server-local; localhost is server-local.</span>
        </article>
      </section>
      {(hermesMode === 'status' || hermesMode === 'config' || hermesMode === 'overview') && <RonProxyProofControl />}
      <section className="control-grid hermes-section-grid" aria-label="Ron Weasley command center sections">
        {HERMES_WEB_INTERFACE_SECTIONS.map((section) => (
          <article key={section} className="control-card">
            <strong>{section}</strong>
            <span>{HERMES_SECTION_COPY[section]}</span>
          </article>
        ))}
      </section>
      <section className="control-grid hermes-route-grid" aria-label="Ron Weasley page route proof">
        <article className="control-card">
          <strong>Current page</strong>
          <span>{page.description}</span>
          <small>{page.href}</small>
        </article>
        <article className="control-card">
          <strong>API route</strong>
          <span>{page.method} {page.apiRoute}</span>
          <small>{page.method === 'POST' ? 'Draft/action route is shown as a real contract here; it is not executed by opening this page.' : 'Readable status route loads below.'}</small>
        </article>
        <article className="control-card">
          <strong>Related pages</strong>
          <span>{relatedPages.map((candidate) => candidate.label).join(' · ') || page.label}</span>
          <small>No empty onclick handlers. Every visible control links to a Mission Control route.</small>
        </article>
      </section>
      {page.method === 'POST' && (
        <section className="control-grid hermes-post-contract">
          <article className="control-card">
            <strong>{page.label} contract</strong>
            <span>This page proves the route exists and explains the workflow. It does not submit a POST without an owner/operator action and audit context.</span>
          </article>
          <article className="control-card">
            <strong>Jarvis gate</strong>
            <span>Any production-impacting result from {page.apiRoute} must move through Jarvis concurrence before execution.</span>
          </article>
          <article className="control-card">
            <strong>Rollback / no-state</strong>
            <span>Drafts are internal records. External connectors, production writes, credentials, and public exposure remain blocked without exact-scope proof.</span>
          </article>
        </section>
      )}
      <ReadableStatusPanel endpoint={readEndpoint} />
    </main>
  )
}

function AgentControlPanel({ slug, mode }: { slug: AgentSlug; mode: AgentPanelMode }) {
  if (slug === 'hermes') return <HermesCommandCenterPanel mode={mode} />

  const agent = AGENT_CONTROL_DEFS[slug]
  const label = CONTROL_MODE_LABELS[mode]
  const modeCopy: Record<AgentPanelMode, string> = {
    overview: 'Mission Control command center for the selected agent.',
    config: 'Inspect runtime, owner access, blockers, and next safe configuration actions.',
    chat: 'Safe chat/test surface. If a real chat route is not proven, this page only shows status and the exact blocker.',
    recommend: 'Full Access Gateway Agent recommendation surface. Gateway brokers tools, skills, MCPs, providers, visible task events, exact-scope adapter requests, and pipeline requests while production execution remains Jarvis-gated.',
    research: 'Research control surface for browser evidence packets, Firecrawl readiness, and YouTube transcript state.',
    ui: 'Paperclip workspace selector for the three-company owner profile. Open a visible company through its Tailnet dashboard link; writes remain Bridge-gated.',
    tools: 'Readable tool inventory. Real task creation remains Bridge-gated; this page does not perform writes.',
    companies: 'Read-only company inventory from the Paperclip bridge. Workspace visibility comes from workspace-truth, not an ECO-only shortcut.',
    agents: 'Read-only Paperclip workforce roster for the selected visible workspace. No task execution happens from this page.',
    issues: 'Read-only issue/task queue for Paperclip. Creating or changing tasks still requires Bridge approval.',
    status: 'Readable Paperclip health and workspace selector status. This page does not parse HTML as JSON.',
    routes: 'Readable route/capability map for the selected agent.',
    'brain-map': 'Readable Brain and memory map for the selected agent.',
    'tool-map': 'Readable Gateway tool map for the selected agent.',
    'skill-registry': 'Readable skill registry for the selected agent.',
    'mini-agent-registry': 'Readable mini-agent registry for the selected agent.',
    pipelines: 'Readable pipeline/workflow state for the selected agent.',
    tasks: 'Readable owner-visible task proof for the selected agent.',
    logs: 'Readable logs, audit, rollback, and no-state proof for the selected agent.',
    'dispatch-plan': 'Readable dispatch-plan contract for the selected agent.',
    'jarvis-concurrence': 'Readable Jarvis concurrence request contract for the selected agent.',
    audit: 'Read-only Paperclip audit surface. If no audit sink is connected, this page shows an empty state instead of redirecting.',
    help: 'Paperclip owner help for workspace launches and Bridge-gated write policy.',
    'telegram-agent': 'Read-only planning surface for a future Telegram-capable Paperclip agent. No connector execution happens here.',
  }
  const isPaperclip = slug === 'paperclip'
  const isPi = slug === 'pi'
  const statusEndpoint = isPaperclip && mode === 'tools'
    ? '/api/bridge/paperclip/gateway-inventory'
    : isPaperclip && ['companies', 'agents', 'issues'].includes(mode)
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
        {isPaperclip && <ControlLink href={paperclipControlRoute('telegram-agent')}>Telegram Agent</ControlLink>}
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
            <span>Workspace access is selector-backed by /api/bridge/paperclip/workspace-truth. Mission Control no longer hard-codes ECO when multiple Paperclip workspaces are visible.</span>
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
      {isPaperclip && <PaperclipWorkspaceSelectorPanel />}
      {isPaperclip && (mode === 'tools' || mode === 'agents' || mode === 'telegram-agent') && (
        <section className="control-grid paperclip-only">
          <article className="control-card">
            <strong>Telegram Agent</strong>
            <span>Telegram Agent is not enabled yet. Creating or connecting a Telegram-capable Paperclip agent requires Bridge Session, exact scope, owner approval, audit trail, and rollback.</span>
          </article>
          <article className="control-card">
            <strong>Candidate agents</strong>
            <span>CEO, CMO, CTO, Avatar Specialist, Field Service Advisor, Social Coordinator, and Video Producer can be reviewed as candidates. No Telegram bridge execution is started from this page.</span>
          </article>
          <article className="control-card">
            <strong>Gated request shape</strong>
            <small>connector: paperclip · action: telegram_agent_connect · company: ECO · target: selected_agent · status: owner_approval_required / bridge_gated</small>
          </article>
        </section>
      )}
      {isPaperclip && mode === 'telegram-agent' && (
        <section className="control-grid paperclip-only">
          {['CEO', 'CMO', 'CTO', 'Avatar Specialist', 'Field Service Advisor', 'Social Coordinator', 'Video Producer'].map((candidate) => (
            <article key={candidate} className="control-card">
              <strong>{candidate}</strong>
              <span>not_connected</span>
              <small>owner_approval_required · bridge_gated · read-only planning only</small>
            </article>
          ))}
        </section>
      )}
      {isPi && (
        <section className="control-grid pi-only">
          <article className="control-card">
            <strong>Gateway visibility</strong>
            <span>Pi has full brokered Gateway visibility across provider registry, capability matrix, MCP health, agent roster, Bridge readiness, skills, tools, Brain reads, visible tasks, and pipeline requests.</span>
          </article>
          <article className="control-card">
            <strong>Direct Gateway pipeline</strong>
            <span>Pi is not a dispatcher. The direct line is owner to Mission Control to Nuclear Gateway to Pi, with tools and skills brokered by Gateway.</span>
          </article>
          <article className="control-card">
            <strong>Bridge policy</strong>
            <span>Writes, adapter execution, and production-impacting actions require exact scope, Jarvis concurrence, audit trail, rollback, and no raw secret exposure.</span>
          </article>
        </section>
      )}
      {isPi && mode === 'recommend' && (
        <section className="control-grid pi-only">
          {[
            ['Web research', 'Recommend SpaceAgent, Firecrawl, or Playwright based on current blockers.'],
            ['Workflow design', 'Use the Gateway pipeline to work with Ron Weasley for skill/workflow planning through the Nuclear Dispatcher command center.'],
            ['Workforce task', 'Recommend Paperclip for workspace-scoped workforce organization; writes stay gated.'],
            ['Runtime action', 'Use OpenClaw/OpenCloud only as an explicit supporting runtime/tool after Bridge approval and runtime proof.'],
            ['Provider/model choice', 'Read provider registry and token governor state without seeing secrets.'],
            ['Brain visibility', 'Read Brain readiness status; memory writes remain Bridge-gated.'],
          ].map(([title, copy]) => (
            <article key={title} className="control-card">
              <strong>{title}</strong>
              <span>{copy}</span>
            </article>
          ))}
        </section>
      )}
      {isPaperclip && mode === 'tools' && (
        <section className="control-grid paperclip-only">
          <article className="control-card">
            <strong>Paperclip Native Tools</strong>
            <span>Open UI, config, status, companies, agents, issues, audit, and help are inspection routes only.</span>
          </article>
          <article className="control-card">
            <strong>Mission Control Nuclear Gateway Tools</strong>
            <span>Providers, models, skills, MCP tools, integrations, and Zapier visibility come from /api/bridge/paperclip/gateway-inventory for Paperclip agents.</span>
          </article>
          <article className="control-card">
            <strong>Zapier visibility</strong>
            <span>Zapier is visible in Gateway and connected/configured. Certified exact-scope Zapier actions are available; broad Zap creation, live social posting, and arbitrary execution require approved scope.</span>
          </article>
          <article className="control-card">
            <strong>Bridge-gated tools</strong>
            <span>Task creation, comments, issue edits, uploads, sends, Zapier actions, and workforce mutations remain locked until Bridge Session approval, adapter proof, audit, and rollback exist.</span>
          </article>
          <article className="control-card">
            <strong>Company scope</strong>
            <span>Owner-facing Paperclip workspace scope comes from the live workspace selector. Blocked workspaces must show a readable disabled reason.</span>
          </article>
          <article className="control-card">
            <strong>Agent context rule</strong>
            <span>Paperclip agents should answer Gateway questions from the read-only inventory, and must not say Zapier is missing when it is visible, connected/configured, and exact-scope approved.</span>
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
            <span>Read-only workspace status is available. No Paperclip write or task mutation is enabled from Mission Control.</span>
          </article>
        </section>
      )}
      {isPaperclip && mode === 'help' && (
        <section className="control-grid paperclip-only">
          <article className="control-card">
            <strong>Open UI</strong>
            <span>Use the workspace selector. Each visible workspace gets Open UI and Open in New Tab links; blocked workspaces show a disabled reason.</span>
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
        .gateway-shell .gw-side .trace-link{display:inline-flex;margin-top:8px;color:#78f2e2;text-decoration:none;font-weight:700}
        .gateway-shell .gw-side .trace-link:hover{text-decoration:underline}
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
        .gateway-shell .agent-update-panel{display:grid;gap:8px;margin:0 0 10px;border:1px solid rgba(56,189,151,.28);border-radius:8px;background:rgba(16,37,32,.72);padding:10px;color:#d9fff6}
        .gateway-shell .agent-update-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
        .gateway-shell .agent-update-head strong{font-size:12px;color:#f8fafc}
        .gateway-shell .agent-update-head span{font-size:10.5px;color:#7ee7dc;text-align:right}
        .gateway-shell .agent-update-panel p{margin:0;font-size:11px;line-height:1.4;color:#b6c8c3}
        .gateway-shell .agent-update-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .gateway-shell .agent-update-actions a,.gateway-shell .agent-update-actions code{border:1px solid rgba(89,211,194,.48);border-radius:6px;background:#102520;color:#78f2e2;padding:5px 7px;text-decoration:none;font-size:10.5px;font-weight:700;overflow-wrap:anywhere}
        .gateway-shell .agent-update-targets{display:grid;gap:6px}
        .gateway-shell .agent-update-targets div{display:grid;gap:2px;border:1px solid rgba(255,255,255,.08);border-radius:6px;background:rgba(0,0,0,.18);padding:7px}
        .gateway-shell .agent-update-targets span{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#9be7df;font-weight:800}
        .gateway-shell .agent-update-targets small{font-size:10.5px;line-height:1.35;color:#c8d4df}
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
        .gateway-shell .workspace-launch-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}
        .gateway-shell .workspace-launch-actions{display:flex;flex-wrap:wrap;gap:8px}
        @media (max-width:1100px){.gateway-shell{grid-template-columns:180px minmax(0,1fr)}.gateway-shell .gw-content.has-access.access-expanded,.gateway-shell .gw-content.has-access.access-collapsed{grid-template-columns:1fr}.gateway-shell .gw-access-rail{order:-1;max-height:none;border-left:0;border-bottom:1px solid rgba(255,255,255,.10)}.gateway-shell .agent-interface-panel{min-height:0;max-height:48vh}.gateway-shell .agent-row-actions{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media (max-width:1100px){.gateway-shell .control-grid,.gateway-shell .workspace-launch-grid{grid-template-columns:1fr 1fr}.gateway-shell .control-status dl{grid-template-columns:1fr}}
        @media (max-width:760px){.gateway-shell{grid-template-columns:1fr}.gateway-shell .gw-side{position:relative;border-right:0;border-bottom:1px solid rgba(255,255,255,.10)}.gateway-shell .agent-row-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.gateway-shell .control-page{padding:20px}.gateway-shell .control-grid,.gateway-shell .workspace-launch-grid{grid-template-columns:1fr}}
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
          <br />
          <a className="trace-link" href="/gateway/overview?trace=zapier" data-testid="gateway-trace-zapier-link">
            Trace Zapier Wire
          </a>
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
                src={gatewayFrameSrcFor(active, sp)}
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
export function iframeSrcFor(t: Tab, q?: URLSearchParams | null): string { return gatewayFrameSrcFor(t, q) }
export function controlViewFromPath(pathname: string | null, q: URLSearchParams | null): GatewayControlView | null {
  return controlViewFrom(pathname, q)
}
export type { Tab as GatewayTab }
