import { bridgeSessionContract } from '@/lib/bridge-session-contract'
import { jarvisExecutionRouterStatus } from '@/lib/jarvis-execution-router'
import { buildRuntimeBoundarySummary } from '@/lib/runtime-boundaries'

export type JarvisAccessTruthPacket = {
  source: 'canonical_live_mission_control_routes'
  source_routes: string[]
  generated_at: string
  route: 'telegram_gateway_agent_zero'
  destination_agent: 'agent.zero'
  normal_chat_bridge_required: false
  normal_chat_direct_ready: true
  gateway_visibility_ready: true
  bridge_session_active: boolean
  bridge_session_state: string
  exact_scope_execution_enabled: boolean
  certified_adapters: string[]
  full_go_status: 'GATEWAY_DIRECT_READY'
  unrestricted_external_execution: false
  hard_stops: string[]
  credential_blockers: string[]
  correct_self_report: string
  runtime_boundary: ReturnType<typeof buildRuntimeBoundarySummary>
  historical_stale_claims: string[]
  credential_values_exposed: false
}

export const JARVIS_ACCESS_TRUTH_ROUTES = [
  '/api/gateway/telegram-jarvis-route/status',
  '/api/bridge/agent-zero/status',
  '/api/bridge/agent-zero/bridge-session',
  '/api/bridge/agent-zero/certification',
  '/api/bridge/agent-zero/full-go/dashboard',
  '/api/bridge/agent-zero/full-go/readiness',
  '/api/bridge/agent-zero/full-go/adapter-checklist',
  '/api/bridge/agent-zero/agent-roster',
]

export const JARVIS_CORRECT_SELF_REPORT =
  'I am Agent Zero / Jarvis. Telegram goes straight through Gateway to Agent Zero for normal chat. OpenClaw+ is a supporting Gateway/runtime layer, not my identity. Normal chat does not require a Bridge Session. I can see and use the Gateway registry for models, tools, skills, MCPs, memory, and connectors; protected side-effect actions still run only through exact-scope Gateway adapters with approval, audit, and hard-stop policy.'

export function buildJarvisAccessTruth(): JarvisAccessTruthPacket {
  const bridgeSession = bridgeSessionContract()
  const executionRouter = jarvisExecutionRouterStatus()
  const jarvisSession = bridgeSession.jarvis_owner_operator_session
  const bridgeActive = bridgeSession.state === 'active'
  const certifiedActions = Array.isArray(executionRouter.certified_actions)
    ? executionRouter.certified_actions as Array<{ adapter_id?: string }>
    : []
  const certifiedAdapters = Array.from(new Set([
    ...certifiedActions
      .map((action) => action.adapter_id || '')
      .filter(Boolean),
    ...Object.entries((executionRouter.proof_counts || {}) as Record<string, number>)
      .filter(([, count]) => Number(count) > 0)
      .map(([adapter]) => adapter),
  ])).sort()

  const credentialBlockers = [
    'n8n_credentials_required_for_workflow_list',
    'paperclip_write_credential_required',
    'provider_credentials_required_per_adapter',
  ]

  return {
    source: 'canonical_live_mission_control_routes',
    source_routes: [...JARVIS_ACCESS_TRUTH_ROUTES],
    generated_at: new Date().toISOString(),
    route: 'telegram_gateway_agent_zero',
    destination_agent: 'agent.zero',
    normal_chat_bridge_required: false,
    normal_chat_direct_ready: true,
    gateway_visibility_ready: true,
    bridge_session_active: bridgeActive,
    bridge_session_state: bridgeSession.state,
    exact_scope_execution_enabled: bridgeActive && executionRouter.execution_enabled === true,
    certified_adapters: certifiedAdapters,
    full_go_status: 'GATEWAY_DIRECT_READY',
    unrestricted_external_execution: false,
    hard_stops: Array.isArray(jarvisSession.hard_stop_reasons)
      ? [...jarvisSession.hard_stop_reasons]
      : [],
    credential_blockers: credentialBlockers,
    correct_self_report: JARVIS_CORRECT_SELF_REPORT,
    runtime_boundary: buildRuntimeBoundarySummary(),
    historical_stale_claims: [
      'bridge_session_absent_claim',
      'execution_disabled_claim',
      'bridge_session_required_claim',
      'no_access_claim',
    ],
    credential_values_exposed: false,
  }
}
