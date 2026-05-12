import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createBridgeApprovalRequest } from '@/lib/bridge-approval-request-store'
import { buildPaperclipGatewayTaskPayload } from '@/lib/paperclip-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    ok: true,
    mode: 'paperclip_gateway_task_route_read_only',
    generated_at: new Date().toISOString(),
    agent_zero_can_see_paperclip_status: true,
    paperclip_status_endpoint: '/api/bridge/paperclip/status',
    paperclip_tasks_endpoint: '/api/bridge/paperclip/tasks',
    allowed_requester: 'agent_zero',
    allowed_assignments: ['hermes', 'space_agent', 'pi_review', 'mini_agent'],
    selected_route: ['agent_zero', 'gateway', 'paperclip'],
    direct_paperclip_access_allowed: false,
    bridge_session_required: true,
    issue_recording: 'blocked_until_bridge_session_and_write_adapter',
    status_tracking: 'read_only_via_/api/bridge/paperclip/issues',
    gateway_handoff_logging: true,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let parsed: Record<string, unknown> = {}
  try {
    const body = await request.json()
    parsed = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  } catch {
    parsed = {}
  }

  const payload = await buildPaperclipGatewayTaskPayload({
    requester: typeof parsed.requester === 'string' ? parsed.requester : 'agent_zero',
    assignee: typeof parsed.assignee === 'string' ? parsed.assignee : null,
    title: typeof parsed.title === 'string' ? parsed.title : null,
    requestedAction: typeof parsed.requested_action === 'string'
      ? parsed.requested_action
      : (typeof parsed.requestedAction === 'string' ? parsed.requestedAction : null),
    generatedAt: new Date().toISOString(),
    bridgeSessionActive: false,
  })

  const approval = payload.policy_result === 'requires_session' && payload.requester === 'agent_zero' && payload.assignee !== 'blocked'
    ? createBridgeApprovalRequest({
      requester: {
        userId: Number.isInteger(auth.user.id) ? auth.user.id : null,
        username: auth.user.username || auth.user.display_name || 'mission-control',
        workspaceId: auth.user.workspace_id || 1,
        tenantId: auth.user.tenant_id || 1,
      },
      connector: 'paperclip',
      action: 'paperclip.task.create',
      target: payload.assignee,
      targetKey: `paperclip.task.create:${payload.assignee}`,
      riskLevel: 'medium',
      protectedCategory: 'agent_execution',
      approvalScope: {
        route: '/api/bridge/paperclip/tasks',
        requester: payload.requester,
        assignee: payload.assignee,
        title: payload.task_issue.title,
        requested_action: payload.requested_action,
        bridge_session_required: true,
        write_adapter_configured: false,
        direct_paperclip_access_allowed: false,
      },
      reason: `Paperclip task creation for ${payload.assignee} requires owner approval and an active Bridge Session before any Paperclip write.`,
      rollbackAvailable: false,
      rollbackRef: null,
      idempotencyKey: `paperclip.task.create:${auth.user.workspace_id || 1}:${auth.user.tenant_id || 1}:${payload.assignee}:${payload.task_issue.title}`,
    })
    : null

  return NextResponse.json({
    ...payload,
    owner_approval_required: true,
    bridge_session_required: true,
    approval_request_created: approval?.approval_request_created ?? false,
    approval_request_reused: approval?.approval_request_reused ?? false,
    approval_id: approval?.approval_request_id || null,
    approval_state: approval?.approval_state || null,
    audit_event_id: approval?.audit_event_id || null,
    approval_blocked_reason: approval?.blocked_reason || null,
    accepted_for_execution: false,
    request_dispatched: false,
    next_action: approval?.next_action || payload.response_text,
  }, {
    status: payload.policy_result === 'requires_session' ? 409 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
