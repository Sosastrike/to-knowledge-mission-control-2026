import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createBridgeApprovalRequest } from '@/lib/bridge-approval-request-store'
import { evaluateHeyGenSchemaReadiness } from '@/lib/heygen-schema-readiness'
import { getZapierToolBridge } from '@/lib/zapier-tool-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REQUIRED_SCOPE = 'heygen.generate'

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function payloadFromBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  const nested = record.payload
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>
  }
  return record
}

function sortedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort((a, b) => a.localeCompare(b))
}

function stablePayloadHash(value: Record<string, unknown>): string {
  const normalized = JSON.stringify(Object.fromEntries(sortedKeys(value).map((key) => [key, value[key]])))
  return createHash('sha256').update(normalized).digest('hex')
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return jsonResponse({ ok: false, error: auth.error }, auth.status)

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const payload = payloadFromBody(body) || {}
  const zapier = await getZapierToolBridge('heygen')
  const readiness = evaluateHeyGenSchemaReadiness({ zapier, payload })

  const base = {
    endpoint: '/api/bridge/heygen/exact-scope-proof',
    required_scope: REQUIRED_SCOPE,
    accepted_for_execution: false,
    execution_enabled: false,
    writes_enabled: false,
    no_heygen_generation: true,
    no_zapier_writes: true,
    bridge_session_required: true,
    owner_approval_required: true,
    approval_required_for_generation: true,
  }

  if (!readiness.schema_available) {
    return jsonResponse({
      ok: false,
      mode: 'heygen_exact_scope_blocked',
      ...base,
      approval_request_created: false,
      blocker: readiness.blocker || 'heygen_schema_not_visible',
      schema_readiness: readiness,
      next_action: 'Connect HeyGen in Zapier MCP and rerun schema readiness before requesting exact-scope generation approval.',
    }, 503)
  }

  if (readiness.payload_valid !== true) {
    return jsonResponse({
      ok: false,
      mode: 'heygen_exact_scope_blocked',
      ...base,
      approval_request_created: false,
      blocker: readiness.blocker || 'heygen_payload_missing_required_fields',
      missing_fields: readiness.missing_fields,
      schema_readiness: readiness,
      next_action: 'Provide only the fields required by the visible HeyGen schema before requesting owner approval.',
    }, 400)
  }

  const payloadHash = stablePayloadHash(payload)
  const toolName = readiness.tool_name || 'heygen_tool_not_selected'
  const requester = {
    userId: Number.isInteger(auth.user.id) ? auth.user.id : null,
    username: auth.user.username || auth.user.display_name || 'mission-control',
    workspaceId: auth.user.workspace_id || 1,
    tenantId: auth.user.tenant_id || 1,
  }
  const approval = createBridgeApprovalRequest({
    requester,
    connector: 'zapier.heygen',
    action: REQUIRED_SCOPE,
    target: toolName,
    targetKey: toolName,
    riskLevel: 'high',
    protectedCategory: 'external_automation',
    approvalScope: {
      required_scope: REQUIRED_SCOPE,
      tool_name: toolName,
      payload_hash: payloadHash,
      payload_fields_present: sortedKeys(payload),
      required_fields: readiness.required_fields,
      no_heygen_generation: true,
      no_zapier_writes: true,
      bridge_session_required: true,
    },
    reason: 'Owner approval required before exact-scope HeyGen generation proof can execute.',
    rollbackAvailable: false,
    rollbackRef: null,
    idempotencyKey: typeof body.idempotency_key === 'string'
      ? body.idempotency_key
      : `heygen.generate:${requester.workspaceId}:${requester.tenantId}:${toolName}:${payloadHash}`,
    correlationId: typeof body.correlation_id === 'string'
      ? body.correlation_id
      : `corr_${randomUUID()}`,
  })

  return jsonResponse({
    ok: approval.ok,
    mode: approval.ok ? 'heygen_exact_scope_approval_requested' : 'heygen_exact_scope_approval_blocked',
    ...base,
    canonical_status: approval.ok ? 'OWNER_GATED' : 'BLOCKED',
    blocker_class: approval.ok ? 'OWNER_GATED' : 'BLOCKED',
    approval_request_created: approval.approval_request_created,
    approval_request_reused: approval.approval_request_reused,
    approval_id: approval.approval_request_id,
    approval_state: approval.approval_state,
    audit_event_id: approval.audit_event_id,
    blocker: approval.blocked_reason,
    schema_readiness: readiness,
    payload_hash: payloadHash,
    next_action: approval.next_action,
  }, approval.http_status)
}
