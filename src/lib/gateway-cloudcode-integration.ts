import {
  ROUTE_METADATA,
  ROUTE_SMOKE_TARGETS,
  buildAgentHealth,
  buildBuildWikiStatus,
  classifyError,
  classifyErrors,
  evaluateRunNowGate,
  getBreadcrumbTrail,
  getRouteMetadata,
  normalizeGatewayStatus,
  type AgentProbeInput,
  type ClassifiedError,
  type ComponentStatus,
  type RouteMetadata,
  type RouteSmokeReport,
} from './cloudcode-backend-support'
import { buildCanonicalAgentRegistryPayload } from './canonical-agent-registry'

type AnyRecord = Record<string, any>

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' ? value as AnyRecord : {}
}

function asArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((item): item is AnyRecord => item && typeof item === 'object') : []
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function gatewaySummaryToComponent(summary: unknown, fallbackId: string, fallbackLabel: string): AnyRecord {
  const raw = asRecord(summary)
  const blockers = stringArray(raw.blockers)
  const blocker = firstString(blockers[0], raw.blocker, raw.blocked_reason)
  const rawStatus = firstString(raw.status, raw.health?.status, raw.state) || 'unknown'
  const status = rawStatus === 'connected' ? 'READY' : rawStatus

  return {
    id: firstString(raw.id) || fallbackId,
    label: firstString(raw.label) || fallbackLabel,
    status,
    reachable: !blocker && status !== 'blocked',
    configured: status !== 'missing',
    credential_configured: !/credential/i.test(blocker || ''),
    service_running: status === 'connected' ? true : status === 'blocked' ? false : undefined,
    blocker,
    next_action: blocker ? 'Resolve this blocker before owner-facing UI can show the lane as ready.' : null,
    proof_available: status === 'connected',
  }
}

function providerToComponent(provider: AnyRecord): AnyRecord {
  const blocker = firstString(provider.blocker, provider.blocked_reason)
  const rawStatus = firstString(provider.status) || (provider.connected ? 'connected' : 'unknown')
  return {
    id: firstString(provider.id) || 'provider',
    label: firstString(provider.label, provider.name) || 'Provider',
    status: rawStatus === 'connected' ? 'READY' : rawStatus,
    reachable: provider.connected === true || provider.reachable === true,
    configured: provider.configured !== false,
    credential_configured: provider.credential_configured !== false,
    service_running: null,
    blocker,
    next_action: blocker ? 'Resolve provider blocker before using this route.' : null,
    proof_available: provider.connected === true || provider.reachable === true,
  }
}

function blockerKind(message: string): ClassifiedError['kind'] {
  const classified = classifyError({
    message,
    context: {
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      requires_owner_approval: /owner|approval|bridge/i.test(message),
    },
  })
  return classified.kind
}

function explicitBlocker(message: string, ownerMessage?: string): AnyRecord {
  return {
    kind: blockerKind(message),
    owner_message: ownerMessage || message,
    technical_detail: message,
    next_action: /owner|approval|bridge/i.test(message)
      ? 'Owner approval or Bridge Session scope is required before execution.'
      : 'Codex keeps this lane blocked until the backend condition is resolved.',
    codex_can_fix: !/owner|approval|credential/i.test(message),
    owner_action_required: /owner|approval|credential/i.test(message),
  }
}

function gatewayShellTarget(route: string): string {
  if (route === '/gateway/agent-hub' || route === '/agent-network' || route === '/agents') return '/gateway?tab=agent-hub'
  if (route === '/gateway/agent-hub/paperclip') return '/gateway?tab=paperclip'
  if (route.startsWith('/gateway/agent-hub/')) return '/gateway?tab=agent-hub'
  if (route === '/gateway/routes') return '/gateway?tab=routes'
  if (route === '/gateway/registry') return '/gateway?tab=registry'
  if (route === '/gateway/policies') return '/gateway?tab=policies'
  if (route === '/gateway/health') return '/gateway?tab=health'
  if (route === '/gateway/dispatcher') return '/gateway?tab=dispatcher'
  if (route === '/gateway/token-governor') return '/gateway?tab=governor'
  if (route === '/gateway/bridge-session') return '/gateway?tab=bridge'
  if (route === '/gateway/node-detail') return '/gateway?tab=node-detail'
  if (route === '/gateway/mobile-tablet') return '/gateway?tab=mobile'
  return route
}

function gatewayStatusBlockers(raw: AnyRecord): AnyRecord[] {
  const blockers: AnyRecord[] = []
  for (const summary of [raw.agent_zero, raw.hermes]) {
    for (const blocker of stringArray(asRecord(summary).blockers)) {
      if (blocker) blockers.push(explicitBlocker(blocker))
    }
  }
  for (const blocker of asArray(raw.blockers)) blockers.push(blocker)
  for (const message of stringArray(raw.buildwiki_openclaw?.blockers)) {
    if (message) blockers.push(explicitBlocker(message, 'Build-Wiki / Farmer action is gated.'))
  }
  return blockers
}

export function buildCloudCodeNavigation(route: string) {
  const safeRoute = route.startsWith('/') ? route : `/${route}`
  const current = getRouteMetadata(safeRoute)
  const breadcrumbs = current ? getBreadcrumbTrail(safeRoute) : []

  if (!current) {
    return {
      ok: false,
      current: null,
      breadcrumbs,
      all_routes: ROUTE_METADATA,
      targets: {
        mission_control_home: '/',
        safe_back: '/',
        gateway_overview: '/gateway',
        agent_hub: '/gateway?tab=agent-hub',
      },
      classified_error: classifyError({
        http_status: 404,
        message: `route missing: ${safeRoute}`,
        technical_detail: 'Gateway route metadata did not contain this route.',
      }),
    }
  }

  return {
    ok: true,
    current,
    breadcrumbs,
    all_routes: ROUTE_METADATA,
    targets: {
      mission_control_home: current.mission_control_home_target,
      safe_back: gatewayShellTarget(current.safe_back_target),
      gateway_overview: '/gateway',
      agent_hub: '/gateway?tab=agent-hub',
    },
    classified_error: null,
  }
}

export function buildCloudCodeGatewayStatus(rawStatus: AnyRecord) {
  const raw = asRecord(rawStatus)
  const buildwiki = asRecord(raw.buildwiki_openclaw)
  const normalized_status = normalizeGatewayStatus({
    generated_at: firstString(raw.generated_at),
    execution_enabled: raw.execution_enabled === true,
    writes_enabled: raw.writes_enabled === true,
    external_writes_enabled: raw.external_writes_enabled === true,
    agents: [
      gatewaySummaryToComponent(raw.agent_zero, 'agent_zero', 'Agent Zero'),
      gatewaySummaryToComponent(raw.hermes, 'hermes', 'Hermes'),
    ],
    providers: asArray(raw.llm_gateway?.providers).map(providerToComponent),
    tools: [
      ...asArray(raw.mcp_gateway?.servers).map(providerToComponent),
      ...asArray(raw.mcp_gateway?.tools_integrations).map(providerToComponent),
    ],
    connectors: asArray(raw.brain_systems).map(providerToComponent),
    bridge: {
      status: raw.bridge_mcp?.visible ? 'read_only' : 'blocked',
      approval_persistence_ready: true,
      audit_chain_ready: true,
      runner_available: false,
      blocker: 'owner_approval_pending',
      next_action: 'Owner approves exact Bridge Session scope before execution.',
    },
    buildwiki_farmer: {
      status: buildwiki.service_active ? 'live' : 'read_only',
      service_running: typeof buildwiki.service_active === 'boolean' ? buildwiki.service_active : null,
      timer_active: typeof buildwiki.timer_active === 'boolean' ? buildwiki.timer_active : null,
      approval_state: null,
      ui_state: buildwiki.service_active ? 'running' : 'idle',
      last_run_finished_at: firstString(buildwiki.last_run_status),
      last_run_exit_code: null,
      blocker: firstString(buildwiki.blockers?.[0]),
      next_action: 'Run Now remains Bridge Session and owner-approval gated.',
    },
    blockers: gatewayStatusBlockers(raw),
  })

  return {
    cloudcode_backend_support: {
      applied: true,
      source: 'cloudcode-backend-support-handoff',
      helpers: [
        'normalizeGatewayStatus',
        'ROUTE_METADATA',
        'getBreadcrumbTrail',
        'classifyErrors',
      ],
    },
    canonical_agent_registry: buildCanonicalAgentRegistryPayload('authority'),
    normalized_status,
    owner_status: normalized_status.overall_status,
    canonical_status: normalized_status.overall_status,
    route_metadata: buildCloudCodeNavigation('/gateway'),
    classified_errors: classifyErrors([
      ...normalized_status.blockers.map((blocker) => ({
        message: blocker.technical_detail || blocker.owner_message,
        technical_detail: blocker.technical_detail,
        context: {
          execution_enabled: raw.execution_enabled === true,
          writes_enabled: raw.writes_enabled === true,
          external_writes_enabled: raw.external_writes_enabled === true,
          requires_owner_approval: blocker.owner_action_required,
        },
      })),
      {
        message: 'external writes disabled in read-only Gateway status route',
        context: { external_writes_enabled: false, execution_enabled: false, writes_enabled: false },
      },
    ]),
  }
}

export function agentHubIdToCloudCodeIds(id: string): string[] {
  const normalized = id.toLowerCase().replace(/_/g, '-')
  if (normalized === 'agent-zero') return ['agent_zero']
  if (normalized === 'pi' || normalized === 'pi-mono') return ['pi']
  if (normalized === 'openclaw' || normalized === 'openclaw+' || normalized === 'openclaw-plus') return ['openclaw_plus']
  if (normalized === 'spaceagent' || normalized === 'space-agent') {
    return ['spaceagent_playwright', 'spaceagent_youtube', 'spaceagent_firecrawl']
  }
  return [normalized]
}

function agentHubProbe(agent: AnyRecord): AgentProbeInput[] {
  const blocker = firstString(agent.blocked_reason, agent.blocker, agent.blockers?.[0])
  const ids = agentHubIdToCloudCodeIds(firstString(agent.id, agent.name) || 'unknown')
  return ids.map((id) => ({
    id,
    reachable: agent.connected === true || agent.live_interface_proven === true || agent.owner_status?.can_read === true,
    configured: agent.configured !== false,
    credential_configured: !/credential/i.test(blocker || ''),
    service_running: /runtime_not_reachable|service_not_running|sandbox_service_not_running/i.test(blocker || '')
      ? false
      : (agent.connected === true ? true : null),
    last_seen: firstString(agent.last_success, agent.owner_status?.last_seen),
    blocker,
    next_action: blocker ? 'Resolve the exact blocker before this agent can become live.' : null,
    proof_available: agent.called_true_proven === true || agent.live_interface_proven === true,
  }))
}

export function buildCloudCodeAgentHealth(agentHubPayload: AnyRecord): ComponentStatus[] {
  const browserAutomation = asRecord(agentHubPayload.space_agent_browser_automation)
  const hasSpaceAgentCards = asArray(browserAutomation.cards).length > 0
  const probes = [
    ...asArray(agentHubPayload.agents)
      .filter((agent) => !(hasSpaceAgentCards && agentHubIdToCloudCodeIds(firstString(agent.id, agent.name) || '').some((id) => id.startsWith('spaceagent_'))))
      .flatMap(agentHubProbe),
    ...spaceAgentBrowserAutomationProbes(browserAutomation),
  ]
  return buildAgentHealth(probes, {
    executionEnabled: agentHubPayload.execution_enabled === true,
  })
}

export function selectCloudCodeAgentHealthRows(agentHubAgentId: string, health: readonly ComponentStatus[]): ComponentStatus[] {
  const ids = new Set(agentHubIdToCloudCodeIds(agentHubAgentId))
  return health.filter((row) => ids.has(row.id))
}

export function selectCloudCodeAgentHealth(agentHubAgentId: string, health: readonly ComponentStatus[]): ComponentStatus | null {
  return selectCloudCodeAgentHealthRows(agentHubAgentId, health)[0] || null
}

function spaceAgentBrowserAutomationProbes(browserAutomation: AnyRecord): AgentProbeInput[] {
  const cards = asArray(browserAutomation.cards)
  if (cards.length === 0) return []
  return cards.map((card) => {
    const id = firstString(card.id)
    const blocker = firstString(card.blocker)
    const connected = card.connected === true
    const configured = card.configured === true
    const status = firstString(card.status)
    if (id === 'playwright_mcp') {
      return {
        id: 'spaceagent_playwright',
        reachable: connected,
        configured: true,
        credential_configured: true,
        service_running: connected,
        blocker,
        next_action: blocker ? 'Start or expose the local Playwright MCP service before browser automation can be marked ready.' : null,
        proof_available: connected,
      }
    }
    if (id === 'youtube_research') {
      const proven = configured && !blocker
      return {
        id: 'spaceagent_youtube',
        reachable: proven,
        configured: proven,
        credential_configured: true,
        service_running: proven,
        blocker,
        next_action: blocker ? 'Keep YouTube limited until transcript connector proof is available.' : null,
        proof_available: proven,
      }
    }
    if (id === 'firecrawl') {
      return {
        id: 'spaceagent_firecrawl',
        reachable: false,
        configured: true,
        credential_configured: configured,
        service_running: null,
        blocker: blocker || (status === 'blocked' ? 'firecrawl_credential_required' : null),
        next_action: configured ? 'Prove the Firecrawl backend adapter with one read-only smoke.' : 'Owner must provide the approved Firecrawl credential source.',
        proof_available: false,
      }
    }
    return {
      id: firstString(card.id) || 'spaceagent_playwright',
      reachable: connected,
      configured,
      credential_configured: !/credential/i.test(blocker || ''),
      service_running: connected || null,
      blocker,
      next_action: blocker ? 'Resolve this SpaceAgent blocker before marking the card ready.' : null,
      proof_available: connected,
    }
  })
}

function publicApprovalToBuildWiki(raw: AnyRecord | null | undefined, run: AnyRecord | null | undefined) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: firstString(raw.id, raw.approval_request_id) || 'buildwiki_run_now_request',
    status: firstString(raw.status, raw.approval_state) || 'pending',
    run_status: firstString(run?.status, run?.run_state) || null,
    run_exit_code: typeof run?.exit_code === 'number' ? run.exit_code : null,
    run_summary: firstString(run?.summary, run?.error),
    expires_at_iso: firstString(raw.expires_at, raw.expires_at_iso),
    decision_at_iso: firstString(raw.resolved_at, raw.decision_at_iso),
  }
}

export function buildCloudCodeBuildWikiTruth(statusPayload: AnyRecord) {
  const serviceProbe = asRecord(statusPayload.service_probe)
  const runNow = asRecord(statusPayload.run_now)
  const telegram = runNow.approval && typeof runNow.approval === 'object'
    ? publicApprovalToBuildWiki(asRecord(runNow.approval), asRecord(runNow.run))
    : null
  const systemd = {
    active_state: firstString(serviceProbe.service_active_state),
    sub_state: firstString(serviceProbe.service_sub_state),
    timer_active: typeof serviceProbe.timer_active === 'boolean' ? serviceProbe.timer_active : null,
    last_run_finished_at: firstString(serviceProbe.last_run_exited_at),
    last_run_exit_code: typeof serviceProbe.last_exit_status === 'number' ? serviceProbe.last_exit_status : null,
  }

  return {
    cloudcode_backend_support: {
      applied: true,
      source: 'cloudcode-backend-support-handoff',
      helpers: ['buildBuildWikiStatus', 'evaluateRunNowGate'],
    },
    buildwiki_farmer: buildBuildWikiStatus({ telegram, systemd }),
    run_now_gate: evaluateRunNowGate({
      telegram,
      bridge: {
        approval_persistence_ready: runNow.persistence_ready === true,
        runner_available: serviceProbe.systemctl_available !== false,
      },
      global_execution_enabled: false,
    }),
  }
}

export function buildSafeRouteSmokeTable(report: RouteSmokeReport) {
  return report.routes.map((route) => {
    const target = ROUTE_SMOKE_TARGETS.find((item) => item.path === route.path)
    return {
      label: target?.owner_safe_label || route.path,
      path: route.path,
      expected_auth: route.expected_auth,
      http_status: route.actual_http_status,
      status: route.status_label,
      failure_reason: route.failure_reason,
      redirect_target: route.redirect_target,
      last_checked_at: route.last_checked_at,
    }
  })
}

export type CloudCodeNavigation = ReturnType<typeof buildCloudCodeNavigation>
export type CloudCodeRouteMetadata = RouteMetadata
