import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { recordAgentZeroBridgeSessionAudit } from '@/lib/agent-zero-bridge-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const result = recordAgentZeroBridgeSessionAudit({
    sessionId: typeof body.session_id === 'string' ? body.session_id : null,
    requester: {
      userId: auth.user.id || null,
      username: auth.user.username || auth.user.display_name || 'mission-control',
      workspaceId: auth.user.workspace_id || 1,
      tenantId: auth.user.tenant_id || 1,
    },
    action: typeof body.action === 'string' ? body.action : 'agent_zero.action',
    target: typeof body.target === 'string' ? body.target : null,
    outcome: typeof body.outcome === 'string' ? body.outcome : 'allowed',
    metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata as Record<string, unknown>
      : {},
  })

  return NextResponse.json({
    ok: result.ok,
    mode: result.ok ? 'agent_zero_bridge_session_action_audited' : 'agent_zero_bridge_session_action_blocked',
    generated_at: new Date().toISOString(),
    audit_event: result.audit_event,
    bridge_session: result.session,
    execution_enabled: result.execution_enabled,
    accepted_for_execution: result.execution_enabled,
    blocked_reason: result.blocked_reason,
    no_approval_spam: true,
    next_action: result.ok
      ? 'Continue inside the active Bridge Session scope. Do not request another approval for this small step.'
      : 'Open and approve an Agent Zero Bridge Session before auditing/executing scoped actions.',
  }, {
    status: result.http_status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
