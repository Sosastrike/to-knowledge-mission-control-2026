import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildAgentZeroEcosystemContext } from '@/lib/agent-zero-ecosystem-context'
import {
  getAgentZeroApiKeyState,
  probeAgentZeroRuntime,
  sendAgentZeroReadOnlyMessage,
} from '@/lib/agent-zero-bridge'

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
    mode: 'agent_zero_read_only_test_channel',
    generated_at: new Date().toISOString(),
    label: 'Agent Zero - read-only ecosystem test',
    runtime: runtimeStatus,
    agent_zero_api_key_configured: apiKey.present,
    context,
    ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem',
    bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session',
    status: runtimeStatus.reachable
      ? (apiKey.present ? 'ready_for_read_only_chat' : 'blocked_missing_agent_zero_api_key')
      : 'unreachable',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    next_action: apiKey.present
      ? 'Use POST /api/bridge/agent-zero/test-chat for read-only live Agent Zero context tests.'
      : 'Owner must configure an Agent Zero external API key for Mission Control before live chat can be proxied.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let message = ''
  try {
    const body = await request.json()
    message = typeof body?.message === 'string' ? body.message.trim() : ''
  } catch {
    message = ''
  }

  if (!message) {
    return NextResponse.json(
      {
        ok: false,
        error: 'message_required',
        execution_enabled: false,
        writes_enabled: false,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const context = await buildAgentZeroEcosystemContext()
  const result = await sendAgentZeroReadOnlyMessage({
    ownerMessage: message.slice(0, 4000),
    context,
  })

  return NextResponse.json({
    ...result,
    label: 'Agent Zero - read-only ecosystem test',
    context_sent: context,
    ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem',
    bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session',
    safety: {
      execution_enabled: false,
      writes_enabled: false,
      zapier_writes_enabled: false,
      heygen_generation_enabled: false,
      smb_enabled: false,
      farmer_execution_enabled: false,
    },
    next_action: result.ok
      ? 'Review Agent Zero answer against the read-only context; execution remains disabled.'
      : 'Configure Agent Zero external API access or resolve the runtime blocker, then rerun the read-only test.',
  }, {
    status: result.ok ? 200 : result.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
