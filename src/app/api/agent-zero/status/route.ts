import { NextRequest, NextResponse } from 'next/server'
import { inspectAgentZeroReadiness } from '@/lib/agent-zero-readiness'
import { buildTelegramJarvisRouteStatus } from '@/lib/gateway-telegram-jarvis-route'
import { authRequired } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const readiness = inspectAgentZeroReadiness()
  const telegramJarvisRoute = buildTelegramJarvisRouteStatus()
  const normalChatReady = telegramJarvisRoute.status === 'direct'
  const protectedActionState = readiness.missing_credentials.length > 0 ? 'CREDENTIAL_GATED' : 'OWNER_GATED'
  const protectedActionBlockers = Array.isArray(readiness.blockers) ? readiness.blockers : []

  return NextResponse.json({
    ok: normalChatReady,
    route: 'agent-zero.status',
    owner_facing_name: 'Agent Zero (Jarvis)',
    aliases: ['Jarvis'],
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
      state: protectedActionState,
      external_actions_require_scope: telegramJarvisRoute.external_actions_require_scope,
      bridge_session_or_exact_scope_required: true,
      writes_enabled_without_scope: false,
      connector_execution_without_scope: false,
      missing_legacy_direct_credentials: readiness.missing_credentials,
      blockers: protectedActionBlockers,
      note: 'Normal Telegram chat is separate from protected external action execution. Missing legacy Agent Zero direct API credentials do not block normal Jarvis chat.',
    },
    telegram_jarvis_route_status_endpoint: '/api/gateway/telegram-jarvis-route/status',
    bridge_status_endpoint: '/api/bridge/agent-zero/status',
    ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem',
    bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session',
    ...readiness,
    // Keep the corrected owner-facing state last so legacy protected-action
    // readiness cannot relabel ordinary chat as credential-gated or blocked.
    blockers: telegramJarvisRoute.blockers,
    normal_chat_blockers: telegramJarvisRoute.blockers,
    protected_action_blockers: protectedActionBlockers,
    state: normalChatReady ? 'READY' : 'DEGRADED',
    current_backend_state: normalChatReady ? 'READY' : 'DEGRADED',
    blocker_class: normalChatReady ? 'NONE' : 'DEGRADED',
    execution_enabled: false,
    writes_enabled: false,
    protected_execution_enabled: false,
    credential_values_exposed: false,
  })
}
