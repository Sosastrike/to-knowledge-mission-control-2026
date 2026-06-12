import { NextRequest } from 'next/server'
import { inspectAgentZeroReadiness } from '@/lib/agent-zero-readiness'
import { inspectAgentZeroHealth } from '@/lib/agent-zero-health'
import { bridgeSessionContract } from '@/lib/bridge-session-contract'
import { buildExecutionReadinessMatrix } from '@/lib/execution-readiness-matrix'
import { buildJarvisAuthorityMatrix } from '@/lib/jarvis-authority-matrix'
import { jarvisExecutionRouterStatus } from '@/lib/jarvis-execution-router'
import { buildJarvisFullGoCapabilityState, buildJarvisFullGoOperationalCertification } from '@/lib/jarvis-full-go-command-center'
import { buildJarvisAccessTruth } from '@/lib/jarvis-access-truth'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'
import { buildCanonicalAgentRosterSummary } from '@/lib/mission-control-agent-roster'
import { buildJarvisBrainSyncAccessSummary } from '@/lib/jarvis-brain-sync-access'
import { buildRuntimeBoundaryPacket } from '@/lib/runtime-boundaries'
import { buildTelegramJarvisRouteStatus } from '@/lib/gateway-telegram-jarvis-route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const [readiness, health] = await Promise.all([
    Promise.resolve(inspectAgentZeroReadiness()),
    inspectAgentZeroHealth(),
  ])
  const bridgeSession = bridgeSessionContract()
  const matrix = buildExecutionReadinessMatrix()
  const authority = buildJarvisAuthorityMatrix()
  const executionRouter = jarvisExecutionRouterStatus()
  const jarvisAccessTruth = buildJarvisAccessTruth()
  const agentRoster = buildCanonicalAgentRosterSummary()
  const fullGoCapabilityState = buildJarvisFullGoCapabilityState()
  const operationalCertification = buildJarvisFullGoOperationalCertification()
  const brainSyncAccess = buildJarvisBrainSyncAccessSummary()
  const runtimeBoundary = buildRuntimeBoundaryPacket()
  const telegramJarvisRoute = buildTelegramJarvisRouteStatus()
  const protectedActionBlockers = [
    bridgeSession.exact_blocker,
    ...readiness.missing_credentials.map((name) => `${name.toLowerCase()}_missing`),
  ].filter(Boolean)

  return readOnly({
    route: 'bridge.agent-zero.status',
    agent_id: 'agent_zero',
    technical_name: 'Agent Zero',
    owner_facing_name: 'Agent Zero (Jarvis)',
    aliases: ['Jarvis'],
    role: 'primary commander / Bridge Session execution requester',
    mission_control_role: 'mission_control_owner_operator',
    runtime_boundaries: runtimeBoundary.runtime_boundaries,
    canonical_self_report: runtimeBoundary.canonical_self_report,
    telegram_identity: runtimeBoundary.telegram_identity,
    status: telegramJarvisRoute.status === 'direct'
        ? 'DIRECT CHAT READY / PROTECTED ACTIONS SCOPED'
        : health.overall_status === 'LIVE'
          ? 'ADVANCED PARTIAL GO / EXECUTION ADAPTERS EXPANDING'
          : 'READ_ONLY / HEALTH DEGRADED',
    normal_chat: {
      route: telegramJarvisRoute.route,
      status: telegramJarvisRoute.status,
      destination_agent: telegramJarvisRoute.destination_agent,
      display_name: telegramJarvisRoute.display_name,
      bridge_required: telegramJarvisRoute.normal_chat_bridge_required,
      direct_gateway_line: telegramJarvisRoute.status === 'direct',
      tony_in_path: telegramJarvisRoute.tony_in_path,
      legacy_brain_in_path: telegramJarvisRoute.legacy_brain_in_path,
      opencloud_in_path: telegramJarvisRoute.opencloud_in_path,
      octm_in_path: telegramJarvisRoute.octm_in_path,
      buildwiki_in_path: telegramJarvisRoute.buildwiki_in_path,
      voice_transport: telegramJarvisRoute.voice_transport,
      blockers: telegramJarvisRoute.blockers,
    },
    protected_actions: {
      bridge_session_or_exact_scope_required: true,
      external_actions_require_scope: telegramJarvisRoute.external_actions_require_scope,
      writes_enabled_without_scope: false,
      connector_execution_without_scope: false,
      blockers: protectedActionBlockers,
      note: 'These blockers apply only to protected external actions, not to ordinary Jarvis Telegram chat.',
    },
    full_go_status: jarvisAccessTruth.full_go_status,
    jarvis_access_truth: jarvisAccessTruth,
    health,
    readiness,
    bridge_session: bridgeSession,
    authority_summary: authority.summary,
    report_readiness: {
      preview_enabled: true,
      send_enabled: false,
      delivery_enabled: false,
      exact_blocker: bridgeSession.exact_blocker,
      endpoint: '/api/bridge/agent-zero/reports',
    },
    bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session',
    execute_endpoint: '/api/bridge/agent-zero/execute',
    authority_endpoint: '/api/bridge/agent-zero/authority',
    internal_write_endpoint: '/api/bridge/agent-zero/internal-write',
    workflows_endpoint: '/api/bridge/agent-zero/workflows',
    certification_endpoint: '/api/bridge/agent-zero/certification',
    agent_roster_endpoint: '/api/bridge/agent-zero/agent-roster',
    full_go_dashboard_endpoint: '/api/bridge/agent-zero/full-go/dashboard',
    full_go_capability_state: fullGoCapabilityState,
    operational_certification: operationalCertification,
    operational_certification_endpoint: '/api/bridge/agent-zero/full-go/operational-certification',
    agent_roster: agentRoster,
    brain_sync_access: brainSyncAccess,
    execution_router: executionRouter,
    execution_enabled: jarvisAccessTruth.exact_scope_execution_enabled,
    protected_execution_enabled: jarvisAccessTruth.exact_scope_execution_enabled,
    external_writes_enabled: executionRouter.external_writes_enabled,
    exact_scope_execution_enabled: jarvisAccessTruth.exact_scope_execution_enabled,
    provider_mcp_counts: {
      matrix_entries: matrix.summary.total,
      read_allowed: matrix.summary.read_allowed,
      write_allowed: matrix.summary.write_allowed,
      execution_allowed: matrix.summary.execution_allowed,
      bridge_required: matrix.summary.bridge_required,
    },
    exact_blockers: telegramJarvisRoute.blockers,
    protected_action_blockers: protectedActionBlockers,
    next_action: operationalCertification.jarvis_ready_to_operate
      ? 'Jarvis normal chat is direct through Gateway. Protected external actions continue through certified exact-scope adapters and must not expose secrets or bypass Gateway policy.'
      : 'Jarvis normal chat is direct through Gateway. Protected-action blockers are listed separately; they do not block ordinary Telegram chat.',
  })
}
