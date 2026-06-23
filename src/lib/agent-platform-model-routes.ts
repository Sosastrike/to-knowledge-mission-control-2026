
export type ModelSelectionScope = 'THIS_TURN' | 'THIS_JOB' | 'THIS_SESSION' | 'AGENT_DEFAULT'
export type FallbackPolicy = 'STRICT' | 'ASK_BEFORE_FALLBACK' | 'AUTO_FALLBACK'

export type AgentPlatformModelRoute = {
  route_id: string
  provider_id: string
  provider_display_name: string
  provider_model_id: string
  model_display_name: string
  access_path: 'direct' | 'aggregator' | 'local' | 'self_hosted' | string
  deployment_type: 'cloud' | 'local' | 'self_hosted' | string
  data_destination: string
  api_mode?: string | null
  capabilities: string[]
  context_limit: number
  output_limit: number
  streaming_support: boolean
  tool_support: boolean
  structured_output_support: boolean
  image_support: boolean
  reasoning_support: boolean
  cost_class: string
  latency_class: string
  health_state: string
  circuit_state: string
  enabled: boolean
  available: boolean
  disabled_reason?: string | null
  selectable_scopes: ModelSelectionScope[]
  fallback_support: FallbackPolicy[]
  last_successful_canary?: number | string | null
}

export type AgentModelRouteState = {
  requested_route_id?: string | null
  requested_provider_id?: string | null
  requested_model_id?: string | null
  selection_scope?: ModelSelectionScope | null
  fallback_policy?: FallbackPolicy | null
  provider_lock?: string | null
  deployment_lock?: string | null
  effective_route_id?: string | null
  effective_provider_id?: string | null
  effective_model_id?: string | null
  route_selected_at?: number | string | null
  route_state?: string | null
  fallback_reason?: string | null
  fallback_approved_by?: string | null
  transition_history?: Array<Record<string, unknown>>
}

export type ModelRouteCatalogPayload = {
  ok?: boolean
  catalog_version?: string
  target_agent_id?: string
  routes?: AgentPlatformModelRoute[]
  error?: string
}

export type ModelRouteSelectionPayload = {
  requested_route_id: string
  selection_scope: ModelSelectionScope
  fallback_policy: FallbackPolicy
  provider_lock?: string | null
  deployment_lock?: string | null
  no_openai?: boolean
}

const INTERNAL_VALUE_RE = /100\.116\.35\.95|127\.0\.0\.1|localhost|\[::1\]|:50080/i

export function containsInternalRouteValue(value: unknown): boolean {
  return INTERNAL_VALUE_RE.test(JSON.stringify(value || {}))
}

function asRoute(value: unknown): AgentPlatformModelRoute | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (typeof item.route_id !== 'string' || typeof item.provider_id !== 'string' || typeof item.provider_model_id !== 'string') return null
  return {
    route_id: item.route_id,
    provider_id: item.provider_id,
    provider_display_name: typeof item.provider_display_name === 'string' ? item.provider_display_name : item.provider_id,
    provider_model_id: item.provider_model_id,
    model_display_name: typeof item.model_display_name === 'string' ? item.model_display_name : item.provider_model_id,
    access_path: typeof item.access_path === 'string' ? item.access_path : 'direct',
    deployment_type: typeof item.deployment_type === 'string' ? item.deployment_type : 'cloud',
    data_destination: typeof item.data_destination === 'string' ? item.data_destination : 'unknown',
    api_mode: typeof item.api_mode === 'string' ? item.api_mode : null,
    capabilities: Array.isArray(item.capabilities) ? item.capabilities.filter((entry): entry is string => typeof entry === 'string') : [],
    context_limit: typeof item.context_limit === 'number' ? item.context_limit : 0,
    output_limit: typeof item.output_limit === 'number' ? item.output_limit : 0,
    streaming_support: item.streaming_support === true,
    tool_support: item.tool_support === true,
    structured_output_support: item.structured_output_support === true,
    image_support: item.image_support === true,
    reasoning_support: item.reasoning_support === true,
    cost_class: typeof item.cost_class === 'string' ? item.cost_class : 'unknown',
    latency_class: typeof item.latency_class === 'string' ? item.latency_class : 'unknown',
    health_state: typeof item.health_state === 'string' ? item.health_state : 'unknown',
    circuit_state: typeof item.circuit_state === 'string' ? item.circuit_state : 'unknown',
    enabled: item.enabled !== false,
    available: item.available === true,
    disabled_reason: typeof item.disabled_reason === 'string' ? item.disabled_reason : null,
    selectable_scopes: Array.isArray(item.selectable_scopes) ? item.selectable_scopes.filter((entry): entry is ModelSelectionScope => typeof entry === 'string') as ModelSelectionScope[] : [],
    fallback_support: Array.isArray(item.fallback_support) ? item.fallback_support.filter((entry): entry is FallbackPolicy => typeof entry === 'string') as FallbackPolicy[] : ['STRICT'],
    last_successful_canary: typeof item.last_successful_canary === 'string' || typeof item.last_successful_canary === 'number' ? item.last_successful_canary : null,
  }
}

export function normalizeModelRouteCatalog(payload: unknown): ModelRouteCatalogPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, routes: [], error: 'invalid_catalog_payload' }
  const record = payload as Record<string, unknown>
  const routes = Array.isArray(record.routes) ? record.routes.map(asRoute).filter((route): route is AgentPlatformModelRoute => Boolean(route)) : []
  return {
    ok: record.ok !== false,
    catalog_version: typeof record.catalog_version === 'string' ? record.catalog_version : undefined,
    target_agent_id: typeof record.target_agent_id === 'string' ? record.target_agent_id : undefined,
    routes,
    error: typeof record.error === 'string' ? record.error : undefined,
  }
}

export function routeGroupLabel(route: AgentPlatformModelRoute): string {
  if (route.deployment_type === 'local' || route.access_path === 'local') return 'Local / Self-hosted'
  if (route.provider_id === 'openai_direct') return 'OpenAI Direct'
  if (route.provider_id === 'google_direct') return 'Google Gemini Direct'
  if (route.provider_id === 'openrouter') return 'OpenRouter'
  return 'Other configured providers'
}

export function groupModelRoutes(routes: AgentPlatformModelRoute[]): Array<{ label: string; routes: AgentPlatformModelRoute[] }> {
  const order = ['Local / Self-hosted', 'OpenAI Direct', 'Google Gemini Direct', 'OpenRouter', 'Other configured providers']
  const groups = new Map<string, AgentPlatformModelRoute[]>()
  for (const route of routes) {
    const label = routeGroupLabel(route)
    groups.set(label, [...(groups.get(label) || []), route])
  }
  return order.filter((label) => groups.has(label)).map((label) => ({ label, routes: groups.get(label) || [] }))
}

export function modelRouteDisplayName(route: Pick<AgentPlatformModelRoute, 'provider_display_name' | 'provider_model_id' | 'access_path' | 'deployment_type'>): string {
  const path = route.access_path === 'aggregator' ? 'aggregator' : route.access_path
  return `${route.provider_display_name} / ${route.provider_model_id} (${route.deployment_type}, ${path})`
}

export function buildModelRouteSelectionPayload(input: Partial<ModelRouteSelectionPayload> & { requested_route_id: string }): ModelRouteSelectionPayload {
  return {
    requested_route_id: input.requested_route_id,
    selection_scope: input.selection_scope || 'THIS_JOB',
    fallback_policy: input.fallback_policy || 'STRICT',
    provider_lock: input.provider_lock || null,
    deployment_lock: input.deployment_lock || null,
    no_openai: input.no_openai === true,
  }
}
