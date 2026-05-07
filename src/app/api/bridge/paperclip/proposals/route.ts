import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildPaperclipHermesProposalPayload } from '@/lib/paperclip-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    ok: true,
    mode: 'paperclip_hermes_proposal_route_read_only',
    generated_at: new Date().toISOString(),
    hermes_can_see_paperclip_registry: true,
    paperclip_status_endpoint: '/api/bridge/paperclip/status',
    paperclip_tasks_endpoint: '/api/bridge/paperclip/tasks',
    paperclip_proposals_endpoint: '/api/bridge/paperclip/proposals',
    visible_registries: [
      { name: 'Paperclip status', endpoint: '/api/bridge/paperclip/status', access: 'read_only' },
      { name: 'Paperclip companies', endpoint: '/api/bridge/paperclip/companies', access: 'read_only' },
      { name: 'Paperclip agents', endpoint: '/api/bridge/paperclip/agents', access: 'read_only' },
      { name: 'Paperclip issues/tasks', endpoint: '/api/bridge/paperclip/issues', access: 'read_only' },
    ],
    proposal_kinds: ['workflow_task_template', 'mini_agent_spec', 'paperclip_routine', 'skill_proposal_document'],
    selected_route: ['hermes', 'gateway', 'agent_zero', 'paperclip'],
    agent_zero_review_required: true,
    owner_approval_required_if_protected_action: true,
    issue_or_work_product_storage: 'blocked_until_bridge_session_and_write_adapter',
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

  const routineSteps = Array.isArray(parsed.routine_steps)
    ? parsed.routine_steps.filter((item): item is string => typeof item === 'string')
    : null
  const miniAgentScope = Array.isArray(parsed.mini_agent_scope)
    ? parsed.mini_agent_scope.filter((item): item is string => typeof item === 'string')
    : null

  const payload = await buildPaperclipHermesProposalPayload({
    proposalKind: typeof parsed.proposal_kind === 'string' ? parsed.proposal_kind : null,
    title: typeof parsed.title === 'string' ? parsed.title : null,
    objective: typeof parsed.objective === 'string' ? parsed.objective : null,
    routineSteps,
    miniAgentScope,
    generatedAt: new Date().toISOString(),
  })

  return NextResponse.json(payload, {
    status: 409,
    headers: { 'Cache-Control': 'no-store' },
  })
}
