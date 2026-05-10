import type { RouteMetadata } from './types'

// Canonical Mission Control / Gateway navigation map.
// Codex consumes this for back/home/breadcrumb wiring — the UI never invents routes.
// Adding a new section: append a row, do not reorder existing rows.
export const ROUTE_METADATA: ReadonlyArray<RouteMetadata> = [
  {
    route: '/',
    label: 'Mission Control',
    parent_route: null,
    breadcrumb_label: 'Mission Control',
    safe_back_target: '/',
    mission_control_home_target: '/',
    owner_auth_required: false,
  },
  {
    route: '/gateway',
    label: 'Gateway',
    parent_route: '/',
    breadcrumb_label: 'Gateway',
    safe_back_target: '/',
    mission_control_home_target: '/',
    owner_auth_required: true,
  },
  {
    route: '/gateway/overview',
    label: 'Gateway Overview',
    parent_route: '/gateway',
    breadcrumb_label: 'Overview',
    safe_back_target: '/gateway',
    mission_control_home_target: '/',
    owner_auth_required: true,
  },
  {
    route: '/gateway/agent-hub',
    label: 'Agent Hub',
    parent_route: '/gateway',
    breadcrumb_label: 'Agent Hub',
    safe_back_target: '/gateway',
    mission_control_home_target: '/',
    owner_auth_required: true,
  },
  {
    route: '/gateway/dispatcher',
    label: 'Dispatcher',
    parent_route: '/gateway',
    breadcrumb_label: 'Dispatcher',
    safe_back_target: '/gateway',
    mission_control_home_target: '/',
    owner_auth_required: true,
  },
  {
    route: '/gateway/token-governor',
    label: 'Token Governor',
    parent_route: '/gateway',
    breadcrumb_label: 'Token Governor',
    safe_back_target: '/gateway',
    mission_control_home_target: '/',
    owner_auth_required: true,
  },
  {
    route: '/gateway/bridge-session',
    label: 'Bridge Session',
    parent_route: '/gateway',
    breadcrumb_label: 'Bridge Session',
    safe_back_target: '/gateway',
    mission_control_home_target: '/',
    owner_auth_required: true,
  },
  {
    route: '/agent-network',
    label: 'Agent Network',
    parent_route: '/gateway/agent-hub',
    breadcrumb_label: 'Agent Network',
    safe_back_target: '/gateway/agent-hub',
    mission_control_home_target: '/',
    owner_auth_required: true,
  },
  {
    route: '/agents',
    label: 'Agents',
    parent_route: '/gateway/agent-hub',
    breadcrumb_label: 'Agents',
    safe_back_target: '/gateway/agent-hub',
    mission_control_home_target: '/',
    owner_auth_required: true,
  },
  {
    route: '/reports',
    label: 'Reports',
    parent_route: '/',
    breadcrumb_label: 'Reports',
    safe_back_target: '/',
    mission_control_home_target: '/',
    owner_auth_required: true,
  },
  {
    route: '/connectors',
    label: 'Connectors',
    parent_route: '/',
    breadcrumb_label: 'Connectors',
    safe_back_target: '/',
    mission_control_home_target: '/',
    owner_auth_required: true,
  },
  {
    route: '/agents/:agentId',
    label: 'Agent Detail',
    parent_route: '/agents',
    breadcrumb_label: 'Agent Detail',
    safe_back_target: '/agents',
    mission_control_home_target: '/',
    owner_auth_required: true,
  },
]

const BY_ROUTE = new Map<string, RouteMetadata>(ROUTE_METADATA.map((r) => [r.route, r]))

export function getRouteMetadata(route: string): RouteMetadata | null {
  if (BY_ROUTE.has(route)) return BY_ROUTE.get(route) ?? null
  // Try parameterised match: e.g. /agents/abc → /agents/:agentId
  for (const r of ROUTE_METADATA) {
    if (!r.route.includes(':')) continue
    const pattern = '^' + r.route.replace(/:[a-zA-Z_]+/g, '[^/]+') + '$'
    if (new RegExp(pattern).test(route)) return r
  }
  return null
}

export function getBreadcrumbTrail(route: string): RouteMetadata[] {
  const trail: RouteMetadata[] = []
  let current = getRouteMetadata(route)
  const visited = new Set<string>()
  while (current && !visited.has(current.route)) {
    visited.add(current.route)
    trail.unshift(current)
    if (!current.parent_route) break
    current = getRouteMetadata(current.parent_route)
  }
  return trail
}
