'use client'

import { useEffect, useMemo, useState } from 'react'

type ApiState<T> = {
  loading: boolean
  error: string | null
  data: T | null
}

type GatewayStatusPayload = {
  generated_at?: string
  status?: string
  totals?: {
    nodes?: number
    blocked?: number
    degraded?: number
    capabilities?: number
    flows?: number
  }
  safety?: {
    auth_required?: boolean
    secrets_exposed?: boolean
    bridge_session_required_for_writes?: boolean
  }
}

type GatewayNode = {
  id: string
  name?: string
  display_name?: string
  type?: string
  system_type?: string
  color_token?: string
  blocked_reason?: string | null
  read_enabled?: boolean
  write_enabled?: boolean
  execution_enabled?: boolean
  bridge_required?: boolean
  auth_required?: boolean
  local_ui_url?: string | null
  route_count?: number
  audit_count?: number
}

type GatewayNodesPayload = {
  nodes?: GatewayNode[]
}

type GatewayEdge = {
  source?: string
  target?: string
  kind?: string
  gated?: boolean
  active?: boolean
  blocker?: string | null
  blocked_reason?: string | null
}

type GatewayRegistryPayload = {
  registry?: {
    nodes?: GatewayNode[]
    edges?: GatewayEdge[]
  }
}

type MiniAgentPayload = {
  mini_agents?: Array<Record<string, unknown>>
  agents?: Array<Record<string, unknown>>
  proposals?: Array<Record<string, unknown>>
  blocker?: string
}

type GatewayDecision = {
  id?: string
  source?: string
  target?: string
  requested_action?: string
  route_decision?: string
  requires_bridge_session?: boolean
  blocked_reason?: string | null
  color_token?: string
}

type GatewayDecisionsPayload = {
  decisions?: GatewayDecision[]
}

type GatewayBridgeSessionsPayload = {
  source?: string
  summary?: {
    active_count?: number
    pending_count?: number
    expired_count?: number
    revoked_count?: number
    openclaw_intermediary_detected?: boolean
    credential_values_exposed?: boolean
  }
  bridge_sessions?: Array<{
    agent_id?: string
    display_name?: string
    state?: string
    execution_enabled?: boolean
    direct_line_active?: boolean
    gateway_connected?: boolean
    color_token?: string
    blocked_reason?: string | null
  }>
}

type GatewayModelProvider = {
  id?: string
  name?: string
  display_name?: string
  status?: string
  color_token?: string
  reachable?: boolean
  credential_configured?: boolean
  execution_enabled?: boolean
  exact_blocker?: string | null
  api_key_exact_blocker?: string | null
  validation_status?: string
  api_key_probe_status?: string
  model_count?: number
  bridge_required?: boolean
  execution_readiness?: {
    status?: string
    required_bridge_session_scope?: string
    bridge_session_active?: boolean
    bridge_session_scope_present?: boolean
    token_governor_proven?: boolean
    cost_governor_required?: boolean
    exact_blocker?: string | null
  }
  provider_error_summary?: {
    code?: string | null
    type?: string | null
    status?: string | null
    message?: string | null
    credential_values_exposed?: boolean
    tokens_exposed?: boolean
    env_values_exposed?: boolean
  } | null
}

type GatewayModelsPayload = {
  source?: string
  generated_at?: string
  providers?: GatewayModelProvider[]
  summary?: {
    reachable_count?: number
    credential_values_exposed?: boolean
    tokens_exposed?: boolean
    env_values_exposed?: boolean
  }
}

const APIs = {
  status: '/api/gateway/status',
  nodes: '/api/gateway/nodes',
  registry: '/api/gateway/registry',
  miniAgents: '/api/gateway/mini-agents',
  decisions: '/api/gateway/dispatcher-decisions',
  bridgeSessions: '/api/gateway/bridge-sessions',
  models: '/api/gateway/models',
} as const

const MODEL_PIPELINE_TARGETS = ['model_gemini', 'model_groq', 'model_xai_grok', 'model_nvidia'] as const
const MODEL_PROVIDER_BY_TARGET: Record<typeof MODEL_PIPELINE_TARGETS[number], string> = {
  model_gemini: 'gemini',
  model_groq: 'groq',
  model_xai_grok: 'xai_grok',
  model_nvidia: 'nvidia',
}

const XAI_GROK_PERMISSION_BLOCKER = 'xai_grok_permission_or_billing_required'
const XAI_GROK_CONSOLE_NOTE = 'Check xAI Console: confirm the API key is active, same team, API billing or prepaid credits are active, API permission is enabled, the team/key is not blocked, and mTLS is not required.'

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`)
  }
  return await response.json() as T
}

function colorClass(color: string | undefined): string {
  if (color && ['green', 'yellow', 'blue', 'red', 'gray', 'purple', 'orange'].includes(color)) return color
  return 'gray'
}

function boolFlag(value: boolean | undefined): string {
  return value ? 'yes' : 'no'
}

function providerForTarget(providers: GatewayModelProvider[], target: typeof MODEL_PIPELINE_TARGETS[number]): GatewayModelProvider | null {
  const providerId = MODEL_PROVIDER_BY_TARGET[target]
  return providers.find((provider) => provider.id === providerId) || null
}

function normalizedProviderBlocker(provider: GatewayModelProvider | null): string | null {
  if (!provider) return null
  const blocker = provider.exact_blocker || provider.api_key_exact_blocker || null
  if (provider.id === 'xai_grok' && blocker === 'xai_grok_probe_http_403') return XAI_GROK_PERMISSION_BLOCKER
  return blocker
}

function providerBlocker(provider: GatewayModelProvider | null, node: GatewayNode | null, edge: GatewayEdge | undefined): string {
  if (!provider) {
    return node?.blocked_reason || edge?.blocked_reason || edge?.blocker || (node?.bridge_required ? 'bridge_session_required' : 'backend_required')
  }
  const normalizedBlocker = normalizedProviderBlocker(provider)
  if (provider.id === 'xai_grok' && normalizedBlocker === XAI_GROK_PERMISSION_BLOCKER) {
    return XAI_GROK_PERMISSION_BLOCKER
  }
  const providerError = provider.provider_error_summary
  const providerErrorText = providerError && (providerError.code || providerError.status || providerError.type || providerError.message)
    ? [providerError.code, providerError.status, providerError.type, providerError.message].filter(Boolean).join(' · ')
    : null
  const blocker = providerErrorText || normalizedBlocker
  if (blocker === 'gateway_bridge_runtime_inactive' || blocker === 'gateway_bridge_runtime_paused' || blocker === 'gateway_bridge_runtime_disabled') {
    return 'Gateway Runtime Bridge is not active; model execution is paused until the runtime bridge is restored'
  }
  if (blocker === 'bridge_session_required') {
    return 'Action Bridge Session required for sensitive side-effect execution'
  }
  if (blocker === 'token_governor_not_proven') {
    return 'read/status connected; token/cost governor proof required before paid execution'
  }
  return blocker || 'model_execution_requires_gateway_runtime_bridge_and_cost_governor'
}

function providerPipelineColor(provider: GatewayModelProvider | null, node: GatewayNode | null): string {
  const blocker = normalizedProviderBlocker(provider)
  if (provider?.provider_error_summary || /40[13]|permission|forbidden|unauthorized/i.test(String(blocker || ''))) {
    return 'red'
  }
  if (provider?.reachable || provider?.credential_configured) return 'green'
  return provider?.color_token || node?.color_token || 'gray'
}

function isXaiPermissionBlocked(provider: GatewayModelProvider | null): boolean {
  return provider?.id === 'xai_grok' && normalizedProviderBlocker(provider) === XAI_GROK_PERMISSION_BLOCKER
}

function useGatewayOverviewData(): ApiState<{
  status: GatewayStatusPayload
  nodes: GatewayNodesPayload
  registry: GatewayRegistryPayload
  miniAgents: MiniAgentPayload
  decisions: GatewayDecisionsPayload
  bridgeSessions: GatewayBridgeSessionsPayload
  models: GatewayModelsPayload
}> {
  const [state, setState] = useState<ApiState<{
    status: GatewayStatusPayload
    nodes: GatewayNodesPayload
    registry: GatewayRegistryPayload
    miniAgents: MiniAgentPayload
    decisions: GatewayDecisionsPayload
    bridgeSessions: GatewayBridgeSessionsPayload
    models: GatewayModelsPayload
  }>>({ loading: true, error: null, data: null })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, error: null, data: null })
    Promise.all([
      loadJson<GatewayStatusPayload>(APIs.status),
      loadJson<GatewayNodesPayload>(APIs.nodes),
      loadJson<GatewayRegistryPayload>(APIs.registry),
      loadJson<MiniAgentPayload>(APIs.miniAgents),
      loadJson<GatewayDecisionsPayload>(APIs.decisions),
      loadJson<GatewayBridgeSessionsPayload>(APIs.bridgeSessions),
      loadJson<GatewayModelsPayload>(APIs.models),
    ])
      .then(([status, nodes, registry, miniAgents, decisions, bridgeSessions, models]) => {
        if (!cancelled) setState({ loading: false, error: null, data: { status, nodes, registry, miniAgents, decisions, bridgeSessions, models } })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ loading: false, error: error instanceof Error ? error.message : 'backend_required', data: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

export default function GatewayNucleusOverview() {
  const state = useGatewayOverviewData()
  const nodes = state.data?.nodes.nodes || []
  const registryNodes = state.data?.registry.registry?.nodes || []
  const registryEdges = state.data?.registry.registry?.edges || []
  const criticalNodes = useMemo(() => {
    const priority = ['agent_zero', 'hermes', 'space_agent', 'pi', 'paperclip', 'openclaw_plus', 'brain_sync']
    return priority
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is GatewayNode => Boolean(node))
  }, [nodes])
  const decisions = state.data?.decisions.decisions?.slice(0, 6) || []
  const bridgeSessions = state.data?.bridgeSessions.bridge_sessions || []
  const bridgeSummary = state.data?.bridgeSessions.summary
  const modelProviders = state.data?.models.providers || []
  const miniAgentCount = (state.data?.miniAgents.mini_agents || state.data?.miniAgents.agents || state.data?.miniAgents.proposals || []).length
  const totals = state.data?.status.totals
  const modelPipelineEdges = useMemo(() => {
    const nodesById = new Map([...registryNodes, ...nodes].map((node) => [node.id, node]))
    return MODEL_PIPELINE_TARGETS.map((target) => {
      const edge = registryEdges.find((edge) => edge.source === 'llm_gateway' && edge.target === target)
      const provider = providerForTarget(modelProviders, target)
      return { target, edge, node: nodesById.get(target) || null, provider }
    }).filter((item) => item.edge || item.node || item.provider)
  }, [modelProviders, nodes, registryEdges, registryNodes])

  return (
    <main className="gateway-nucleus-overview" data-testid="production-gateway-overview">
      <style>{`
        .gateway-nucleus-overview{min-height:100vh;background:#080c11;color:#eef4f8;padding:28px;display:grid;gap:18px}
        .gateway-nucleus-overview h1,.gateway-nucleus-overview h2,.gateway-nucleus-overview p{margin:0}
        .gateway-nucleus-overview .hero{display:grid;gap:8px;border-bottom:1px solid rgba(255,255,255,.10);padding-bottom:18px}
        .gateway-nucleus-overview .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6de8dd;font-weight:800}
        .gateway-nucleus-overview h1{font-size:28px;line-height:1.15;letter-spacing:0}
        .gateway-nucleus-overview .subcopy{max-width:900px;color:#9aa6b7;font-size:14px;line-height:1.5}
        .gateway-nucleus-overview .status-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
        .gateway-nucleus-overview .metric,.gateway-nucleus-overview .node,.gateway-nucleus-overview .decision,.gateway-nucleus-overview .panel{border:1px solid rgba(255,255,255,.10);border-radius:8px;background:#111923;padding:14px}
        .gateway-nucleus-overview .metric{display:grid;gap:6px}
        .gateway-nucleus-overview .metric span{font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:#7d899a;font-weight:800}
        .gateway-nucleus-overview .metric strong{font-size:24px;color:#f8fafc}
        .gateway-nucleus-overview .metric small{font-size:11px;color:#8b96a8;overflow-wrap:anywhere}
        .gateway-nucleus-overview .section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
        .gateway-nucleus-overview .section-head h2{font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:#dfe8f5}
        .gateway-nucleus-overview .section-head a{color:#76f2e3;text-decoration:none;font-size:12px;font-weight:750}
        .gateway-nucleus-overview .nodes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .gateway-nucleus-overview .node{display:grid;gap:10px}
        .gateway-nucleus-overview .node-title{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .gateway-nucleus-overview .node-title strong{font-size:15px}
        .gateway-nucleus-overview .badge{display:inline-flex;align-items:center;min-height:22px;border-radius:999px;padding:0 8px;font-size:10px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;border:1px solid rgba(255,255,255,.18);white-space:nowrap}
        .gateway-nucleus-overview .badge.green{color:#8ff8c9;background:rgba(18,98,66,.28);border-color:rgba(47,211,141,.42)}
        .gateway-nucleus-overview .badge.yellow{color:#f8df7d;background:rgba(124,91,14,.24);border-color:rgba(245,181,10,.46)}
        .gateway-nucleus-overview .badge.blue{color:#9fd1ff;background:rgba(31,80,138,.24);border-color:rgba(91,158,255,.40)}
        .gateway-nucleus-overview .badge.red{color:#ff9baa;background:rgba(127,29,47,.26);border-color:rgba(244,63,94,.42)}
        .gateway-nucleus-overview .badge.gray{color:#c2cad5;background:rgba(75,85,99,.26);border-color:rgba(148,163,184,.28)}
        .gateway-nucleus-overview .badge.purple{color:#d8c4ff;background:rgba(76,29,149,.24);border-color:rgba(167,139,250,.38)}
        .gateway-nucleus-overview .badge.orange{color:#ffc58c;background:rgba(124,74,18,.24);border-color:rgba(251,146,60,.42)}
        .gateway-nucleus-overview .node dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0}
        .gateway-nucleus-overview .node div:has(> dt){display:grid;gap:2px}
        .gateway-nucleus-overview dt{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#788498}
        .gateway-nucleus-overview dd{margin:0;font-size:12px;color:#e3ecf8}
        .gateway-nucleus-overview .blocker{font-size:12px;line-height:1.45;color:#f9c0c7;overflow-wrap:anywhere}
        .gateway-nucleus-overview .split{display:grid;grid-template-columns:1.15fr .85fr;gap:10px}
        .gateway-nucleus-overview .decision-list{display:grid;gap:8px}
        .gateway-nucleus-overview .decision{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start;padding:10px}
        .gateway-nucleus-overview .decision strong{font-size:12px;color:#f8fafc}
        .gateway-nucleus-overview .decision span{font-size:11px;color:#9aa6b7}
        .gateway-nucleus-overview .pipeline-node{border-color:rgba(109,232,221,.18);background:linear-gradient(180deg,rgba(17,25,35,.98),rgba(10,15,24,.98))}
        .gateway-nucleus-overview .bridge-action{display:inline-flex;align-items:center;width:max-content;border:1px solid rgba(245,181,10,.42);border-radius:7px;background:rgba(124,91,14,.18);color:#ffe28a;text-decoration:none;font-size:11px;font-weight:850;padding:7px 9px}
        .gateway-nucleus-overview .xai-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .gateway-nucleus-overview .xai-action{display:inline-flex;align-items:center;width:max-content;border:1px solid rgba(244,63,94,.42);border-radius:7px;background:rgba(127,29,47,.18);color:#ffb5c0;text-decoration:none;font-size:11px;font-weight:850;padding:7px 9px}
        .gateway-nucleus-overview .xai-note{font-size:11px;line-height:1.45;color:#ffcad2;overflow-wrap:anywhere}
        .gateway-nucleus-overview .pipeline-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:#97a4b7;font-size:11px}
        .gateway-nucleus-overview .pipeline-meta code{border:1px solid rgba(255,255,255,.10);border-radius:6px;background:#0d131c;padding:4px 6px;color:#8eeadd}
        .gateway-nucleus-overview .panel{display:grid;gap:10px}
        .gateway-nucleus-overview .panel code{display:inline-flex;width:max-content;max-width:100%;border:1px solid rgba(255,255,255,.10);border-radius:6px;background:#0d131c;padding:5px 7px;color:#8eeadd;overflow-wrap:anywhere}
        .gateway-nucleus-overview .empty{border:1px dashed rgba(255,255,255,.15);border-radius:8px;padding:18px;color:#8c98aa;text-align:center}
        @media (max-width:1100px){.gateway-nucleus-overview .status-grid,.gateway-nucleus-overview .nodes{grid-template-columns:repeat(2,minmax(0,1fr))}.gateway-nucleus-overview .split{grid-template-columns:1fr}}
        @media (max-width:720px){.gateway-nucleus-overview{padding:18px}.gateway-nucleus-overview .status-grid,.gateway-nucleus-overview .nodes{grid-template-columns:1fr}}
      `}</style>

      <section className="hero">
        <p className="eyebrow">Gateway Nucleus</p>
        <h1>Mission Control Gateway Overview</h1>
        <p className="subcopy">
          Production surface backed by authenticated Gateway APIs. Missing backend fields render as explicit blockers; design mock files stay preview-only.
        </p>
      </section>

      {state.error && (
        <section className="panel" role="status">
          <span className="badge yellow">backend_required</span>
          <p className="subcopy">{state.error}</p>
        </section>
      )}

      <section className="status-grid" aria-label="Gateway totals">
        <div className="metric">
          <span>Gateway status</span>
          <strong>{state.loading ? '...' : state.data?.status.status || 'backend_required'}</strong>
          <small>Generated {state.data?.status.generated_at || 'not_configured'}</small>
        </div>
        <div className="metric">
          <span>Nodes</span>
          <strong>{totals?.nodes ?? '...'}</strong>
          <small>{totals?.blocked ?? 0} blocked · {totals?.degraded ?? 0} degraded</small>
        </div>
        <div className="metric">
          <span>Routes</span>
          <strong>{totals?.flows ?? '...'}</strong>
          <small>Read-only dispatcher decisions</small>
        </div>
        <div className="metric">
          <span>Mini agents</span>
          <strong>{state.loading ? '...' : miniAgentCount}</strong>
          <small>{state.data?.miniAgents.blocker || 'Gateway-brokered registry'}</small>
        </div>
        <div className="metric">
          <span>Bridge sessions</span>
          <strong>{state.loading ? '...' : bridgeSummary?.active_count ?? 0}</strong>
          <small>{bridgeSummary?.pending_count ?? 0} pending · {bridgeSummary?.expired_count ?? 0} expired · OpenClaw owner {bridgeSummary?.openclaw_intermediary_detected ? 'blocked' : 'false'}</small>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Agent Hub Child Surface</h2>
          <a href="/gateway/agent-hub">Open Agent Hub</a>
        </div>
        <div className="nodes">
          {criticalNodes.length ? criticalNodes.map((node) => (
            <article className="node" key={node.id}>
              <div className="node-title">
                <strong>{node.display_name || node.name || node.id}</strong>
                <span className={`badge ${colorClass(node.color_token)}`}>{node.color_token || 'gray'}</span>
              </div>
              <dl>
                <div><dt>R</dt><dd>{boolFlag(node.read_enabled)}</dd></div>
                <div><dt>W</dt><dd>{boolFlag(node.write_enabled)}</dd></div>
                <div><dt>X</dt><dd>{boolFlag(node.execution_enabled)}</dd></div>
              </dl>
              <p className="blocker">{node.blocked_reason || (node.bridge_required ? 'bridge_session_required' : 'no_blocker')}</p>
              <small>{node.local_ui_url ? `UI: ${node.local_ui_url}` : 'UI: not_configured'} · routes {node.route_count ?? 0} · audit {node.audit_count ?? 0}</small>
            </article>
          )) : (
            <div className="empty">backend_required: no Gateway nodes returned yet</div>
          )}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Model Provider Pipelines</h2>
          <a href="/api/gateway/models">Provider status</a>
        </div>
        <div className="nodes">
          {modelPipelineEdges.length ? modelPipelineEdges.map(({ target, edge, node, provider }) => (
            <article className="node pipeline-node" key={target}>
              <div className="node-title">
                <strong>LLM Gateway {'->'} {provider?.display_name || provider?.name || node?.display_name || node?.name || target}</strong>
                <span className={`badge ${colorClass(providerPipelineColor(provider, node))}`}>{providerPipelineColor(provider, node)}</span>
              </div>
              <dl>
                <div><dt>R</dt><dd>{boolFlag(provider ? (provider.reachable || provider.credential_configured) : node?.read_enabled)}</dd></div>
                <div><dt>W</dt><dd>{boolFlag(node?.write_enabled)}</dd></div>
                <div><dt>X</dt><dd>{boolFlag(provider?.execution_enabled ?? node?.execution_enabled)}</dd></div>
              </dl>
              <p className="blocker">
                {providerBlocker(provider, node, edge)}
              </p>
              {provider?.exact_blocker === 'bridge_session_required' && (
                <a className="bridge-action" href="/gateway/bridge-session">Open Bridge Session</a>
              )}
              {isXaiPermissionBlocked(provider) && (
                <div className="xai-actions">
                  <a className="xai-action" href="/gateway/models?provider=xai_grok&action=diagnose">Run xAI Diagnostic</a>
                  <a className="xai-action" href="/gateway/models?provider=xai_grok&action=replace-key">Replace xAI Key</a>
                  <span className="xai-note">{XAI_GROK_CONSOLE_NOTE}</span>
                </div>
              )}
              <div className="pipeline-meta">
                <code>{provider?.id || MODEL_PROVIDER_BY_TARGET[target]}</code>
                <span>credential {boolFlag(provider?.credential_configured)}</span>
                <span>reachable {boolFlag(provider?.reachable)}</span>
                <span>models {provider?.model_count ?? 0}</span>
                <span>validation {provider?.validation_status || provider?.api_key_probe_status || 'backend_required'}</span>
                <span>readiness {provider?.execution_readiness?.status || (provider?.execution_enabled ? 'execution_enabled' : 'execution_gated')}</span>
                <span>gated {boolFlag(edge?.gated || node?.bridge_required || provider?.bridge_required !== false)}</span>
              </div>
            </article>
          )) : (
            <div className="empty">backend_required: no LLM Gateway provider edges returned yet</div>
          )}
        </div>
      </section>

      <section className="split">
        <div className="panel">
          <div className="section-head">
            <h2>Dispatcher Decisions</h2>
            <a href="/gateway/routes">Routes</a>
          </div>
          <div className="decision-list">
            {decisions.length ? decisions.map((decision) => (
              <article className="decision" key={decision.id || `${decision.source}-${decision.target}-${decision.requested_action}`}>
                <div>
                  <strong>{decision.source || 'unknown'} {'->'} {decision.target || 'unknown'}</strong>
                  <span>{decision.requested_action || 'backend_required'} · {decision.blocked_reason || 'no_blocker'}</span>
                </div>
                <span className={`badge ${colorClass(decision.color_token)}`}>{decision.route_decision || 'backend_required'}</span>
              </article>
            )) : (
              <div className="empty">backend_required: dispatcher decisions unavailable</div>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="section-head">
            <h2>Bridge Session State</h2>
            <a href="/gateway/policies">Policies</a>
          </div>
          <code>{APIs.status}</code>
          <code>{APIs.nodes}</code>
          <code>{APIs.miniAgents}</code>
          <code>{APIs.decisions}</code>
          <code>{APIs.bridgeSessions}</code>
          <div className="decision-list">
            {bridgeSessions.slice(0, 5).map((session) => (
              <article className="decision" key={session.agent_id || session.display_name}>
                <div>
                  <strong>{session.display_name || session.agent_id || 'unknown'}</strong>
                  <span>{session.blocked_reason || 'no_blocker'} · direct {boolFlag(session.direct_line_active)} · gateway {boolFlag(session.gateway_connected)}</span>
                </div>
                <span className={`badge ${colorClass(session.color_token)}`}>{session.state || 'backend_required'}</span>
              </article>
            ))}
          </div>
          <p className="subcopy">
            Auth required: {boolFlag(state.data?.status.safety?.auth_required)} · writes Bridge-gated: {boolFlag(state.data?.status.safety?.bridge_session_required_for_writes)} · secrets exposed: {boolFlag(state.data?.status.safety?.secrets_exposed)} · session credentials exposed: {boolFlag(bridgeSummary?.credential_values_exposed)}
          </p>
        </div>
      </section>
    </main>
  )
}
