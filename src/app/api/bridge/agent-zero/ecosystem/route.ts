import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildAgentZeroEcosystemContext } from '@/lib/agent-zero-ecosystem-context'
import { getAgentZeroApiKeyState, probeAgentZeroRuntime } from '@/lib/agent-zero-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [runtimeStatus, apiKey, context] = await Promise.all([
    probeAgentZeroRuntime(),
    Promise.resolve(getAgentZeroApiKeyState()),
    buildAgentZeroEcosystemContext(),
  ])

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_ecosystem_context_read_only',
    generated_at: new Date().toISOString(),
    agent_zero_api_key_configured: apiKey.present,
    runtime: {
      reachable: runtimeStatus.reachable,
      health_ok: runtimeStatus.health_ok,
      http_status: runtimeStatus.http_status,
      version: runtimeStatus.version,
      chat_endpoint: runtimeStatus.chat_endpoint,
    },
    context,
    safety: {
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_execution_enabled: false,
      zapier_writes_enabled: false,
      heygen_generation_enabled: false,
      smb_enabled: false,
      farmer_execution_enabled: false,
      docker_socket_enabled: false,
      secrets_returned: false,
    },
    next_action: 'Use /api/bridge/agent-zero/test-chat to send this read-only ecosystem context to Agent Zero. Use /api/bridge/agent-zero/bridge-session for the locked execution contract; no execution is enabled here.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
