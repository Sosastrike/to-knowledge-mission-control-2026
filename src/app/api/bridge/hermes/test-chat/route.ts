import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildAgentZeroEcosystemContext } from '@/lib/agent-zero-ecosystem-context'
import { buildHermesReadOnlyContext, sendHermesReadOnlyMessage } from '@/lib/hermes-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const ecosystemContext = await buildAgentZeroEcosystemContext()
  const context = buildHermesReadOnlyContext(ecosystemContext)

  return NextResponse.json({
    ok: true,
    mode: 'hermes_read_only_test_chat',
    generated_at: new Date().toISOString(),
    label: 'Hermes - read-only lieutenant test',
    status_endpoint: '/api/bridge/hermes/status',
    test_chat_endpoint: '/api/bridge/hermes/test-chat',
    context,
    hermes_called: false,
    live_chat_status: 'blocked_safe_live_chat_adapter_not_configured',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    safety: {
      no_execution: true,
      no_writes: true,
      no_uploads: true,
      no_tool_invocation: true,
      no_secret_values: true,
      no_raw_paths_in_reply: true,
      no_fake_done: true,
    },
    next_action: 'POST a prompt to this route for a guarded read-only Hermes lieutenant response. The route does not execute tools or call unsafe Hermes chat adapters.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let message = ''
  try {
    const parsed = await request.json()
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      message = typeof (parsed as Record<string, unknown>).message === 'string'
        ? ((parsed as Record<string, unknown>).message as string).trim()
        : ''
    }
  } catch {
    message = ''
  }

  if (!message) {
    return NextResponse.json({
      ok: false,
      error: 'message_required',
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const ecosystemContext = await buildAgentZeroEcosystemContext()
  const result = await sendHermesReadOnlyMessage({
    ownerMessage: message.slice(0, 4000),
    context: ecosystemContext,
  })

  return NextResponse.json({
    ...result,
    generated_at: new Date().toISOString(),
    label: 'Hermes - read-only lieutenant test',
    status_endpoint: '/api/bridge/hermes/status',
    test_chat_endpoint: '/api/bridge/hermes/test-chat',
    next_action: result.hermes_called
      ? 'Review Hermes response against the read-only context. Execution remains disabled.'
      : 'Hermes live chat remains blocked until a safe no-tool/no-write adapter is configured and proven. No execution occurred.',
  }, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
