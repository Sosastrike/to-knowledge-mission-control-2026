import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  AGENT_ZERO_BRIDGE_SESSION_ACTION,
  AGENT_ZERO_BRIDGE_SESSION_DURATION_HOURS,
  AGENT_ZERO_BRIDGE_SESSION_OWNER_PROMPT,
  createOrReuseAgentZeroBridgeSession,
  readLatestAgentZeroBridgeSession,
} from '@/lib/agent-zero-bridge-session'
import { getAgentZeroApiKeyState, probeAgentZeroRuntime } from '@/lib/agent-zero-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [runtimeStatus, apiKey, sessionRead] = await Promise.all([
    probeAgentZeroRuntime(),
    Promise.resolve(getAgentZeroApiKeyState()),
    Promise.resolve(readLatestAgentZeroBridgeSession({
      workspaceId: auth.user.workspace_id || 1,
      tenantId: auth.user.tenant_id || 1,
      sync: true,
    })),
  ])

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_bridge_session_status',
    generated_at: new Date().toISOString(),
    runtime: {
      reachable: runtimeStatus.reachable,
      health_ok: runtimeStatus.health_ok,
      http_status: runtimeStatus.http_status,
      version: runtimeStatus.version,
    },
    agent_zero_api_key_configured: apiKey.present,
    persistence_ready: sessionRead.persistence_ready,
    bridge_session: sessionRead.session,
    execution_enabled: sessionRead.session.execution_enabled,
    writes_enabled: sessionRead.session.execution_enabled,
    no_approval_spam: true,
    approval_contract: {
      action: AGENT_ZERO_BRIDGE_SESSION_ACTION,
      prompt: AGENT_ZERO_BRIDGE_SESSION_OWNER_PROMPT,
      duration_hours: AGENT_ZERO_BRIDGE_SESSION_DURATION_HOURS,
      one_prompt_per_pending_or_active_session: true,
      repeated_small_step_approvals_required: false,
    },
    safety: {
      docker_socket_enabled: false,
      root_system_access_enabled: false,
      arbitrary_shell_enabled: false,
      secrets_exposed: false,
      direct_agent_zero_root_access: false,
      every_action_requires_session_audit: true,
      session_expires_automatically: true,
    },
    next_action: sessionRead.session.execution_enabled
      ? 'Use bridge_session.session_id with scoped Agent Zero adapters. Each adapter action must write a Bridge Session audit event.'
      : sessionRead.session.status === 'pending_approval'
        ? 'Owner approval is already pending. Reuse this request; do not create another prompt.'
        : 'POST this route to create one owner approval request for a 12-hour Agent Zero Bridge Session.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const result = createOrReuseAgentZeroBridgeSession({
    requester: {
      userId: auth.user.id || null,
      username: auth.user.username || auth.user.display_name || 'mission-control',
      workspaceId: auth.user.workspace_id || 1,
      tenantId: auth.user.tenant_id || 1,
    },
    durationHours: AGENT_ZERO_BRIDGE_SESSION_DURATION_HOURS,
    scope: typeof body.scope === 'string' ? body.scope : undefined,
  })

  return NextResponse.json({
    ok: result.ok,
    mode: result.session.execution_enabled
      ? 'agent_zero_bridge_session_active'
      : 'agent_zero_bridge_session_approval_required',
    generated_at: new Date().toISOString(),
    persistence_ready: result.persistence_ready,
    approval_request_created: result.approval_request_created,
    duplicate_prompt_prevented: result.reused_existing,
    no_approval_spam: true,
    approval_needed: !result.session.execution_enabled,
    owner_approval_prompt: AGENT_ZERO_BRIDGE_SESSION_OWNER_PROMPT,
    bridge_session: result.session,
    execution_enabled: result.session.execution_enabled,
    accepted_for_execution: result.session.execution_enabled,
    writes_enabled: result.session.execution_enabled,
    agent_zero_called: false,
    request_dispatched: false,
    next_action: result.next_action,
  }, {
    status: result.http_status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
