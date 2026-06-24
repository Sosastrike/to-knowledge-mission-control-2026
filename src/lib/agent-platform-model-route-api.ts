
import type { User } from '@/lib/auth'
import { buildMissionControlActorContext, callAgentZeroPlatformApi, normalizeAgentPlatformAgentId, sanitizeAgentPlatformPayload } from '@/lib/agent-platform-bridge'
import type { FallbackPolicy, ModelSelectionScope } from '@/lib/agent-platform-model-routes'

const MODEL_PERMISSIONS: Record<User['role'], string[]> = {
  admin: [
    'models.view',
    'models.select_for_turn',
    'models.select_for_job',
    'models.select_for_session',
    'models.set_agent_default',
    'models.approve_fallback',
    'models.probe_degraded_route',
    'agents.request_handoff',
  ],
  mission_control_owner_operator: [
    'models.view',
    'models.select_for_turn',
    'models.select_for_job',
    'models.select_for_session',
    'models.set_agent_default',
    'models.approve_fallback',
    'models.probe_degraded_route',
    'agents.request_handoff',
  ],
  operator: [
    'models.view',
    'models.select_for_turn',
    'models.select_for_job',
    'models.select_for_session',
    'models.approve_fallback',
  ],
  viewer: ['models.view'],
}


export type ModelRouteDarkFeature =
  | 'model_route_selection_not_active'
  | 'model_switch_not_active'
  | 'fallback_approval_not_active'
  | 'agent_handoff_not_active'

const DARK_FEATURE_MESSAGES: Record<ModelRouteDarkFeature, string> = {
  model_route_selection_not_active: 'Model selection is not yet activated for production jobs.',
  model_switch_not_active: 'Model switching is not yet activated for production jobs.',
  fallback_approval_not_active: 'Fallback approval is not yet activated for production jobs.',
  agent_handoff_not_active: 'Agent handoff is not yet activated for production jobs.',
}

export function modelRouteFeatureDisabled(feature: ModelRouteDarkFeature) {
  return {
    ok: false,
    status_code: 409,
    error: 'feature_disabled',
    feature_disabled: feature,
    reason: feature,
    message: DARK_FEATURE_MESSAGES[feature],
    route_mutated: false,
    provider_request_made: false,
    credential_values_exposed: false,
    raw_provider_error_exposed: false,
  }
}

export function modelRouteFeatureDisabledResponse(feature: ModelRouteDarkFeature) {
  return { payload: modelRouteFeatureDisabled(feature), status: 409 }
}

export function buildModelRouteActorContext(user: User, targetAgentId: string, extraPermissions: string[] = []) {
  const base = buildMissionControlActorContext({ user, targetAgentId, requiredPermission: 'agent:diagnostics' })
  const permissions = Array.from(new Set([...(base.effective_permissions as string[]), ...MODEL_PERMISSIONS[user.role], ...extraPermissions]))
  return {
    ...base,
    effective_permissions: permissions,
    model_route_permissions_source: 'mission_control_backend_role',
  }
}

export function modelRouteTargetAgent(raw: string | null | undefined, fallback = 'agent_zero'): string | null {
  return normalizeAgentPlatformAgentId(raw || fallback)
}

export async function callModelRouteApi(input: {
  user: User
  targetAgentId: string
  action: string
  payload?: Record<string, unknown>
  timeoutMs?: number
}) {
  const body = {
    ...buildModelRouteActorContext(input.user, input.targetAgentId),
    target_agent_id: input.targetAgentId,
    action: input.action,
    ...(input.payload || {}),
  }
  const upstream = await callAgentZeroPlatformApi('/api/model_routes', body, input.timeoutMs || 15000)
  return {
    status: upstream.status,
    payload: sanitizeAgentPlatformPayload(upstream.payload),
  }
}

export function normalizeModelRouteRequest(body: Record<string, unknown>) {
  return {
    requested_route_id: typeof body.requested_route_id === 'string' ? body.requested_route_id : undefined,
    selection_scope: typeof body.selection_scope === 'string' ? body.selection_scope as ModelSelectionScope : 'THIS_JOB',
    fallback_policy: typeof body.fallback_policy === 'string' ? body.fallback_policy as FallbackPolicy : 'STRICT',
    provider_lock: typeof body.provider_lock === 'string' ? body.provider_lock : undefined,
    deployment_lock: typeof body.deployment_lock === 'string' ? body.deployment_lock : undefined,
    no_openai: body.no_openai === true,
  }
}
