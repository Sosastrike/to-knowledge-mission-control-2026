import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildAgentZeroEcosystemContext } from '@/lib/agent-zero-ecosystem-context'
import { logAuditEvent } from '@/lib/db'
import {
  AGENT_ZERO_HERMES_HANDOFF_ROUTE,
  HERMES_COLLABORATION_TASK_TYPES,
  HERMES_FORBIDDEN_TASKS,
  ownerSafeAgentZeroHermesResponse,
  requestAgentZeroHermesCollaboration,
  type HermesCollaborationAuditEvent,
} from '@/lib/agent-zero-hermes-collaboration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function auditRecorder(user: { id?: number | null; username?: string | null; display_name?: string | null }) {
  return (event: HermesCollaborationAuditEvent) => {
    logAuditEvent({
      action: event.action,
      actor: event.actor,
      actor_id: user.id || undefined,
      target_type: event.target_type,
      detail: {
        ...event.detail,
        requested_by: user.username || user.display_name || 'mission-control',
      },
    })
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_hermes_collaboration_protocol',
    generated_at: new Date().toISOString(),
    route: AGENT_ZERO_HERMES_HANDOFF_ROUTE,
    label: 'Agent Zero to Hermes collaboration handoff',
    communication_protocol: {
      requester: 'agent_zero',
      responder: 'hermes',
      request_flow: 'Agent Zero sends task/workflow requests to Hermes; Hermes returns plan/spec/recommendation only.',
      response_contract: 'concise structured plan, no raw paths, no raw IDs in owner replies, no fake access',
      conversation_correlation: {
        request_id_tracked: true,
        agent_zero_task_id_tracked: true,
        hermes_response_id_tracked: true,
        raw_ids_exposed_to_owner: false,
      },
      handoff_audit: 'Every handoff is recorded in Mission Control audit_log with internal correlation metadata.',
      ui_summary: 'Gateway shows this route as the Agent Zero to Hermes dispatch surface; reports may mention Hermes contribution when this route is used.',
    },
    supported_task_types: HERMES_COLLABORATION_TASK_TYPES,
    forbidden_tasks: HERMES_FORBIDDEN_TASKS,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    loop_guard: {
      max_depth: 2,
      repeated_agent_loops_blocked: true,
    },
    timeout: {
      default_ms: 3000,
      blocked_response: 'Hermes is blocked by timeout; Agent Zero should continue without claiming Hermes completed the work.',
    },
    next_action: 'POST task_type and prompt to request a Hermes plan/spec/recommendation. This route never runs external tools.',
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

  const context = await buildAgentZeroEcosystemContext()
  const result = await requestAgentZeroHermesCollaboration({
    context,
    taskType: typeof body.task_type === 'string' ? body.task_type : '',
    prompt: typeof body.prompt === 'string' ? body.prompt : '',
    agentZeroTaskId: typeof body.agent_zero_task_id === 'string' ? body.agent_zero_task_id : null,
    previousHermesResponseId: typeof body.previous_hermes_response_id === 'string' ? body.previous_hermes_response_id : null,
    agentChain: Array.isArray(body.agent_chain) ? body.agent_chain.map(String) : ['agent_zero'],
    handoffDepth: typeof body.handoff_depth === 'number' ? body.handoff_depth : 0,
    timeoutMs: typeof body.timeout_ms === 'number' ? body.timeout_ms : undefined,
    auditRecorder: auditRecorder(auth.user),
  })

  return NextResponse.json({
    ...ownerSafeAgentZeroHermesResponse(result),
    generated_at: new Date().toISOString(),
    route: AGENT_ZERO_HERMES_HANDOFF_ROUTE,
    next_action: result.ok
      ? 'Agent Zero may review the Hermes recommendation. Any execution still requires registered adapters and Bridge Session scope.'
      : 'Agent Zero should report the Hermes blocker honestly or continue without Hermes.',
  }, {
    status: result.http_status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
