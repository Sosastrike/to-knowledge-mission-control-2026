
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildModelRouteSelectionPayload,
  containsInternalRouteValue,
  groupModelRoutes,
  modelRouteDisplayName,
  normalizeModelRouteCatalog,
  type AgentModelRouteState,
  type AgentPlatformModelRoute,
  type FallbackPolicy,
  type ModelSelectionScope,
} from '@/lib/agent-platform-model-routes'

const SCOPE_LABELS: Record<ModelSelectionScope, string> = {
  THIS_TURN: 'This turn',
  THIS_JOB: 'This job',
  THIS_SESSION: 'This session',
  AGENT_DEFAULT: 'Agent default',
}

const POLICY_LABELS: Record<FallbackPolicy, string> = {
  STRICT: 'Strict',
  ASK_BEFORE_FALLBACK: 'Ask before fallback',
  AUTO_FALLBACK: 'Auto fallback',
}

function routeById(routes: AgentPlatformModelRoute[], routeId?: string | null) {
  return routeId ? routes.find((route) => route.route_id === routeId) || null : null
}

export function AgentModelRoutePicker({
  agentId,
  jobId = null,
  routeState = {},
  onDraftChange,
  onSelection,
}: {
  agentId: string
  jobId?: string | null
  routeState?: AgentModelRouteState
  onDraftChange?: (draft: { requested_route_id: string | null; selection_scope: ModelSelectionScope; fallback_policy: FallbackPolicy; provider_lock: string | null; deployment_lock: string | null }) => void
  onSelection?: (payload: AgentModelRouteState & Record<string, unknown>) => void
}) {
  const [routes, setRoutes] = useState<AgentPlatformModelRoute[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState(routeState.requested_route_id || '')
  const [scope, setScope] = useState<ModelSelectionScope>(routeState.selection_scope || 'THIS_JOB')
  const [policy, setPolicy] = useState<FallbackPolicy>(routeState.fallback_policy || 'STRICT')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSelection, setLastSelection] = useState<AgentModelRouteState | null>(null)

  const selectedRoute = routeById(routes, selectedRouteId)
  const requestedRoute = routeById(routes, routeState.requested_route_id || lastSelection?.requested_route_id || selectedRouteId)
  const effectiveRoute = routeById(routes, routeState.effective_route_id || lastSelection?.effective_route_id || null)
  const unsafePayload = containsInternalRouteValue({ routes, routeState, lastSelection })
  const grouped = useMemo(() => groupModelRoutes(routes), [routes])

  useEffect(() => {
    let active = true
    fetch(`/api/agent-platform/agents/${encodeURIComponent(agentId)}/model-routes`, { cache: 'no-store', credentials: 'include' })
      .then(async (response) => normalizeModelRouteCatalog(await response.json().catch(() => ({}))))
      .then((payload) => {
        if (!active) return
        setRoutes(payload.routes || [])
        setError(payload.error || null)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'model_route_catalog_failed')
      })
    return () => { active = false }
  }, [agentId])

  useEffect(() => {
    onDraftChange?.({
      requested_route_id: selectedRouteId || null,
      selection_scope: scope,
      fallback_policy: policy,
      provider_lock: selectedRoute?.provider_id || null,
      deployment_lock: selectedRoute?.deployment_type === 'local' || selectedRoute?.deployment_type === 'self_hosted' ? selectedRoute.deployment_type : null,
    })
  }, [onDraftChange, policy, scope, selectedRoute?.deployment_type, selectedRoute?.provider_id, selectedRouteId])

  const applySelection = useCallback(async () => {
    if (!selectedRouteId) return
    setPending(true)
    setError(null)
    try {
      const payload = buildModelRouteSelectionPayload({
        requested_route_id: selectedRouteId,
        selection_scope: scope,
        fallback_policy: policy,
        provider_lock: selectedRoute?.provider_id || null,
        deployment_lock: selectedRoute?.deployment_type === 'local' || selectedRoute?.deployment_type === 'self_hosted' ? selectedRoute.deployment_type : null,
      })
      const endpoint = jobId
        ? `/api/agent-platform/jobs/${encodeURIComponent(jobId)}/model-route?agent_id=${encodeURIComponent(agentId)}`
        : `/api/agent-platform/agents/${encodeURIComponent(agentId)}/model-default`
      const response = await fetch(endpoint, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({})) as AgentModelRouteState & Record<string, unknown>
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : `model_route_http_${response.status}`)
      setLastSelection(body)
      onSelection?.(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'model_route_selection_failed')
    } finally {
      setPending(false)
    }
  }, [agentId, jobId, onSelection, policy, scope, selectedRoute?.deployment_type, selectedRoute?.provider_id, selectedRouteId])

  return (
    <article className="control-card" data-testid="agent-model-route-picker">
      <strong>Model Route</strong>
      <div className="control-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <label>
          <small>Scope</small>
          <select aria-label="Model selection scope" value={scope} onChange={(event) => setScope(event.target.value as ModelSelectionScope)}>
            {(Object.keys(SCOPE_LABELS) as ModelSelectionScope[]).map((value) => <option key={value} value={value}>{SCOPE_LABELS[value]}</option>)}
          </select>
        </label>
        <label>
          <small>Fallback</small>
          <select aria-label="Fallback policy" value={policy} onChange={(event) => setPolicy(event.target.value as FallbackPolicy)}>
            {(Object.keys(POLICY_LABELS) as FallbackPolicy[]).map((value) => <option key={value} value={value}>{POLICY_LABELS[value]}</option>)}
          </select>
        </label>
      </div>
      <small data-testid="fallback-policy-help">
        {policy === 'STRICT' ? 'No automatic fallback.' : policy === 'ASK_BEFORE_FALLBACK' ? 'Work pauses when the route fails.' : 'Another compatible route may process the request.'}
      </small>
      <div data-testid="model-route-groups" style={{ display: 'grid', gap: 8 }}>
        {grouped.length === 0 ? <small>No model routes reported by the backend.</small> : grouped.map((group) => (
          <div key={group.label} style={{ display: 'grid', gap: 6 }}>
            <strong>{group.label}</strong>
            {group.routes.map((route) => (
              <label key={route.route_id} data-testid={`model-route-option-${route.route_id}`} style={{ display: 'grid', gap: 2, opacity: route.available ? 1 : .58 }}>
                <span>
                  <input
                    type="radio"
                    name={`model-route-${agentId}`}
                    value={route.route_id}
                    checked={selectedRouteId === route.route_id}
                    disabled={!route.available}
                    onChange={() => setSelectedRouteId(route.route_id)}
                  />{' '}
                  {modelRouteDisplayName(route)}
                </span>
                <small>{route.health_state} · {route.latency_class} · {route.cost_class} · context {route.context_limit || 'unknown'}</small>
                {!route.available && <small>Unavailable: {route.disabled_reason || 'route unavailable'}</small>}
              </label>
            ))}
          </div>
        ))}
      </div>
      <button type="button" className="control-action" onClick={() => void applySelection()} disabled={!selectedRouteId || pending} data-testid="model-route-apply">
        {pending ? 'Requesting...' : jobId ? 'Request Model Route' : 'Set Agent Default Route'}
      </button>
      <div data-testid="model-route-requested-actual" style={{ display: 'grid', gap: 4 }}>
        <small>Requested: {requestedRoute ? `${requestedRoute.provider_display_name} / ${requestedRoute.provider_model_id}` : routeState.requested_route_id || 'none'}</small>
        <small>Scope: {routeState.selection_scope || lastSelection?.selection_scope || scope}</small>
        <small>Fallback policy: {routeState.fallback_policy || lastSelection?.fallback_policy || policy}</small>
        <small>Actual: {effectiveRoute ? `${effectiveRoute.provider_display_name} / ${effectiveRoute.provider_model_id}` : routeState.effective_route_id || lastSelection?.effective_route_id || 'Awaiting backend route selection'}</small>
        <small>State: {routeState.route_state || lastSelection?.route_state || 'AWAITING_BACKEND_SELECTION'}</small>
        {routeState.fallback_reason && <small>Fallback reason: {routeState.fallback_reason}</small>}
        {routeState.fallback_approved_by && <small>Fallback approved by: {routeState.fallback_approved_by}</small>}
        <small>internal origins exposed: {unsafePayload ? 'blocked' : 'no'}</small>
      </div>
      {error && <small data-testid="model-route-error">{error}</small>}
    </article>
  )
}
