import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  executeAgentZeroBridgeAction,
  listAgentZeroExecutionAdapters,
} from '@/lib/agent-zero-execution-gateway'
import { readLatestAgentZeroBridgeSession } from '@/lib/agent-zero-bridge-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const session = readLatestAgentZeroBridgeSession({
    workspaceId: auth.user.workspace_id || 1,
    tenantId: auth.user.tenant_id || 1,
    sync: true,
  })

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_bridge_execution_gateway_registry',
    generated_at: new Date().toISOString(),
    bridge_session_required: true,
    execution_enabled: session.session.execution_enabled,
    writes_enabled: session.session.execution_enabled,
    bridge_session: session.session,
    adapters: listAgentZeroExecutionAdapters(),
    safety: {
      raw_shell_enabled: false,
      arbitrary_filesystem_enabled: false,
      root_enabled: false,
      docker_socket_enabled: false,
      direct_secret_reads_enabled: false,
      every_execution_audited: true,
      result_checked: true,
      no_fake_done: true,
    },
    next_action: session.session.execution_enabled
      ? 'POST a registered action with bridge_session_id. The gateway will run only the scoped adapter and audit the result.'
      : 'Open and approve an Agent Zero Bridge Session before POSTing adapter actions.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, unknown> = {}
  try {
    const parsed = await request.json()
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    body = {}
  }

  const action = typeof body.action === 'string' ? body.action.trim() : ''
  if (!action) {
    return NextResponse.json({
      ok: false,
      error: 'action_required',
      mode: 'agent_zero_bridge_execution_gateway',
      execution_enabled: false,
      accepted_for_execution: false,
      adapters: listAgentZeroExecutionAdapters(),
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const payload = body.input && typeof body.input === 'object' && !Array.isArray(body.input)
    ? body.input as Record<string, unknown>
    : {}
  const result = await executeAgentZeroBridgeAction({
    requester: {
      userId: auth.user.id || null,
      username: auth.user.username || auth.user.display_name || 'mission-control',
      workspaceId: auth.user.workspace_id || 1,
      tenantId: auth.user.tenant_id || 1,
    },
    bridgeSessionId: typeof body.bridge_session_id === 'string' ? body.bridge_session_id : null,
    action,
    input: payload,
  })

  return NextResponse.json(result, {
    status: result.http_status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
