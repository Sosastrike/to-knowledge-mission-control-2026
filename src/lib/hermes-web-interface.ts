import { RON_WEASLEY_IDENTITY } from '@/lib/hermes-boundaries'

export const HERMES_LEGACY_WEB_INTERFACE_BASE = '/gateway/agent-hub/hermes'
export const HERMES_WEB_INTERFACE_BASE = '/gateway/agent-hub/ron'
export const HERMES_COMMAND_CENTER_ROUTE = `${HERMES_WEB_INTERFACE_BASE}/config`
export const HERMES_STANDALONE_LOOPBACK_URL = 'http://127.0.0.1:8787/'
export const HERMES_STANDALONE_PROXY_ROUTE = `${HERMES_WEB_INTERFACE_BASE}/webui/app`

export const HERMES_WEB_INTERFACE_MODES = [
  'overview',
  'config',
  'status',
  'routes',
  'brain-map',
  'tool-map',
  'skill-registry',
  'mini-agent-registry',
  'pipelines',
  'tasks',
  'logs',
  'dispatch-plan',
  'jarvis-concurrence',
] as const

export type HermesWebInterfaceMode = (typeof HERMES_WEB_INTERFACE_MODES)[number]

export type HermesWebInterfacePage = {
  mode: HermesWebInterfaceMode
  label: string
  href: string
  apiRoute: string
  method: 'GET' | 'POST'
  section: string
  description: string
}

function page(
  mode: HermesWebInterfaceMode,
  label: string,
  apiRoute: string,
  method: 'GET' | 'POST',
  section: string,
  description: string,
): HermesWebInterfacePage {
  return {
    mode,
    label,
    href: mode === 'overview' ? HERMES_WEB_INTERFACE_BASE : `${HERMES_WEB_INTERFACE_BASE}/${mode}`,
    apiRoute,
    method,
    section,
    description,
  }
}

export const HERMES_WEB_INTERFACE_PAGES: readonly HermesWebInterfacePage[] = [
  page('overview', 'Ron Weasley Overview', '/api/bridge/hermes/status', 'GET', 'Ron Weasley Overview', 'Mission Control command center for Ron Weasley as Nuclear Dispatcher under Jarvis.'),
  page('config', 'Configuration', '/api/bridge/hermes-webui/status', 'GET', 'Status / readiness', 'Ron Weasley WebUI and direct-line Gateway configuration state.'),
  page('status', 'Status', '/api/bridge/hermes/status', 'GET', 'Status / readiness', 'Canonical Ron Weasley identity, readiness, and authority state.'),
  page('routes', 'Routes', '/api/bridge/hermes/capability-map', 'GET', 'Active dispatch plans', 'Ron Weasley route/capability surface and safe command map.'),
  page('brain-map', 'Brain Map', '/api/bridge/hermes/brain-map', 'GET', 'Brain / memory map', 'Brain, memory, and knowledge surfaces Ron can read or recommend against.'),
  page('tool-map', 'Tool Map', '/api/bridge/hermes/tool-map', 'GET', 'Tool map', 'Gateway and tool-provider map available to Ron under Jarvis authority.'),
  page('skill-registry', 'Skill Registry', '/api/bridge/hermes/skill-registry', 'GET', 'Skill registry', 'Ron Weasley skill/foundry registry and draftable skill lanes.'),
  page('mini-agent-registry', 'Mini-Agent Registry', '/api/bridge/hermes/mini-agent-registry', 'GET', 'Mini-agent registry', 'Ron Weasley mini-agent templates, scopes, and authority boundaries.'),
  page('pipelines', 'Pipelines', '/api/bridge/hermes/workflow-compiler', 'GET', 'Workflow compiler', 'Workflow compiler, pipeline drafting, and Jarvis concurrence gates.'),
  page('tasks', 'Tasks', '/api/tasks', 'GET', 'Active dispatch plans', 'Owner-visible task proof and Ron Weasley-related work items.'),
  page('logs', 'Logs / Audit / Rollback', '/api/gateway/agent-hub/agents/hermes/audit', 'GET', 'Logs / audit / rollback', 'Ron Weasley audit, route trace, rollback, and no-state proof surface.'),
  page('dispatch-plan', 'Dispatch Plan', '/api/bridge/hermes/dispatch-plan', 'POST', 'Active dispatch plans', 'Create an internal Ron Weasley dispatch draft; production impact still requires Jarvis concurrence.'),
  page('jarvis-concurrence', 'Request Jarvis Concurrence', '/api/bridge/hermes/jarvis-concurrence-request', 'POST', 'Jarvis concurrence queue', 'Request Jarvis review for production-impacting Ron Weasley plans.'),
]

export const HERMES_WEB_INTERFACE_ACTIONS = [
  { label: 'Open Ron Weasley WebUI', href: HERMES_STANDALONE_PROXY_ROUTE },
  { label: 'Open command center', href: HERMES_COMMAND_CENTER_ROUTE },
  { label: 'Status', href: `${HERMES_WEB_INTERFACE_BASE}/status` },
  { label: 'Brain Map', href: `${HERMES_WEB_INTERFACE_BASE}/brain-map` },
  { label: 'Tool Map', href: `${HERMES_WEB_INTERFACE_BASE}/tool-map` },
  { label: 'Skill Registry', href: `${HERMES_WEB_INTERFACE_BASE}/skill-registry` },
  { label: 'Mini-Agent Registry', href: `${HERMES_WEB_INTERFACE_BASE}/mini-agent-registry` },
  { label: 'Dispatch Plan', href: `${HERMES_WEB_INTERFACE_BASE}/dispatch-plan` },
  { label: 'Request Jarvis Concurrence', href: `${HERMES_WEB_INTERFACE_BASE}/jarvis-concurrence` },
  { label: 'View Pipeline', href: `${HERMES_WEB_INTERFACE_BASE}/pipelines` },
  { label: 'View Audit', href: `${HERMES_WEB_INTERFACE_BASE}/logs` },
] as const

export const HERMES_WEB_INTERFACE_SECTIONS = [
  'Ron Weasley Overview',
  'Status / readiness',
  'Active dispatch plans',
  'Jarvis concurrence queue',
  'Brain / memory map',
  'Tool map',
  'Skill registry',
  'Mini-agent registry',
  'Workflow compiler',
  'Paperclip intelligence',
  'n8n / Zapier optimization',
  'Agent performance optimizer',
  'Logs / audit / rollback',
] as const

export function getHermesWebInterfacePage(mode: string): HermesWebInterfacePage | null {
  return HERMES_WEB_INTERFACE_PAGES.find((pageDef) => pageDef.mode === mode) || null
}

export function isHermesWebInterfaceMode(mode: string): mode is HermesWebInterfaceMode {
  return HERMES_WEB_INTERFACE_MODES.includes(mode as HermesWebInterfaceMode)
}

export function buildHermesWebInterfaceProof() {
  return {
    ok: true,
    status: 'HERMES_WEBUI_MISSION_CONTROL_SURFACE_READY',
    final_status_target: 'HERMES_WEBUI_MISSION_CONTROL_READY',
    owner_surface: HERMES_WEB_INTERFACE_BASE,
    legacy_owner_surface_alias: HERMES_LEGACY_WEB_INTERFACE_BASE,
    identity: {
      jarvis: 'commander_owner_operator',
      hermes: 'legacy_route_alias_for_ron_weasley',
      canonical_name: RON_WEASLEY_IDENTITY.canonical_name,
      short_name: RON_WEASLEY_IDENTITY.short_name,
      full_title: RON_WEASLEY_IDENTITY.full_title,
      legacy_names: RON_WEASLEY_IDENTITY.legacy_names,
      opencloud: 'supporting_runtime_only',
      opencloud_intermediary: false,
    },
    pages: HERMES_WEB_INTERFACE_PAGES.map(({ mode, href, apiRoute, method }) => ({ mode, href, apiRoute, method })),
    actions: HERMES_WEB_INTERFACE_ACTIONS,
    sections: HERMES_WEB_INTERFACE_SECTIONS,
    no_fake_buttons: HERMES_WEB_INTERFACE_ACTIONS.every((action) => Boolean(action.href)),
    standalone_webui: {
      url: HERMES_STANDALONE_LOOPBACK_URL,
      proxy_route: HERMES_STANDALONE_PROXY_ROUTE,
      scope: 'mission_control_authenticated_proxy_to_loopback_only_surface',
      status: 'PROTECTED_LOOPBACK_PROXY_REQUIRED_FOR_STANDALONE_READY',
      health_route: '/api/bridge/hermes-webui/health',
      mission_control_command_center_is_primary: true,
    },
  }
}
