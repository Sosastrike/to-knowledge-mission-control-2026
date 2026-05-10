import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createBridgeApprovalRequest } from '@/lib/bridge-approval-request-store'
import { buildToolActionApprovalPlan } from '@/lib/tool-action-approval'
import { classifyToolError } from '@/lib/tool-error-classifier'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return jsonResponse({ ok: false, error: auth.error }, auth.status)

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const plan = buildToolActionApprovalPlan({
    connector: body.connector,
    provider: body.provider,
    tool: body.tool,
    action: body.action,
    target: body.target,
    intent: body.intent,
    payload: body.payload,
  })

  const base = {
    endpoint: '/api/bridge/tool-action-approval',
    plan,
    canonical_status: plan.canonical_status,
    blocker_class: plan.blocker_class,
    required_scope: plan.required_scope,
    accepted_for_execution: false,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    owner_approval_required: true,
    no_external_writes: true,
    no_zapier_writes: plan.no_zapier_writes,
    no_heygen_generation: plan.no_heygen_generation,
  }

  if (!plan.ok) {
    const classifiedError = classifyToolError({
      http_status: 400,
      message: plan.blocker || 'unsupported tool action approval scope',
      context: { has_backend: false },
    })
    return jsonResponse({
      ok: false,
      mode: 'tool_action_approval_blocked',
      ...base,
      blocker: plan.blocker,
      classified_error: classifiedError,
      approval_request_created: false,
      next_action: plan.next_action,
    }, 400)
  }

  if (body.dry_run === true || body.preview === true) {
    return jsonResponse({
      ok: true,
      mode: 'tool_action_approval_preview',
      ...base,
      blocker: plan.blocker,
      approval_request_created: false,
      next_action: plan.next_action,
    })
  }

  const requester = {
    userId: Number.isInteger(auth.user.id) ? auth.user.id : null,
    username: auth.user.username || auth.user.display_name || 'mission-control',
    workspaceId: auth.user.workspace_id || 1,
    tenantId: auth.user.tenant_id || 1,
  }
  const approval = createBridgeApprovalRequest({
    requester,
    connector: plan.connector || 'unknown',
    action: plan.action || 'protected_action.execute',
    target: plan.target,
    targetKey: plan.target_key || plan.action || 'protected_action.execute',
    riskLevel: plan.risk_level || 'high',
    protectedCategory: plan.protected_category || 'tooling',
    approvalScope: asRecord(plan.approval_scope),
    reason: `Owner approval required before ${plan.required_scope} can execute.`,
    rollbackAvailable: false,
    rollbackRef: null,
    idempotencyKey: typeof body.idempotency_key === 'string'
      ? body.idempotency_key
      : plan.idempotency_seed || `tool_action:${randomUUID()}`,
    correlationId: typeof body.correlation_id === 'string'
      ? body.correlation_id
      : `corr_${randomUUID()}`,
  })

  return jsonResponse({
    ok: approval.ok,
    mode: approval.ok ? 'tool_action_approval_requested' : 'tool_action_approval_blocked',
    ...base,
    canonical_status: approval.ok ? 'OWNER_GATED' : 'BLOCKED',
    blocker_class: approval.ok ? 'OWNER_GATED' : 'BLOCKED',
    blocker: approval.blocked_reason || plan.blocker,
    classified_error: approval.ok
      ? null
      : classifyToolError({
        http_status: approval.http_status,
        message: approval.blocked_reason || 'approval request creation failed',
      }),
    approval_request_created: approval.approval_request_created,
    approval_request_reused: approval.approval_request_reused,
    approval_id: approval.approval_request_id,
    approval_state: approval.approval_state,
    audit_event_id: approval.audit_event_id,
    next_action: approval.next_action,
  }, approval.http_status)
}
