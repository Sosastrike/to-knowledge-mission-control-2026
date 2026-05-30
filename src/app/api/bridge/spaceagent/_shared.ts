import { NextRequest, NextResponse } from 'next/server'

import { requireRoleOrAgentScope } from '@/lib/auth'

export const SPACEAGENT_READ_SCOPES = [
  'spaceagent.read',
  'spaceagent.gateway_read',
  'spaceagent.brain_read',
  'spaceagent.tool_read',
]

export const SPACEAGENT_DRAFT_SCOPES = [
  'spaceagent.recommend',
  'spaceagent.draft',
  'spaceagent.task_plan',
  'spaceagent.report_draft',
]

export const SPACEAGENT_CONCURRENCE_SCOPES = [
  'spaceagent.jarvis_concurrence_request',
]

type Builder = () => Record<string, unknown>
type Writer = (input: Record<string, unknown>) => {
  ok: boolean
  exact_blocker?: string
  [key: string]: unknown
}

export function spaceAgentRead(request: NextRequest, builder: Builder) {
  const auth = requireRoleOrAgentScope(request, 'viewer', SPACEAGENT_READ_SCOPES)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    ok: true,
    token_source: auth.user.agent_scopes?.length ? 'agent_scoped_token' : 'human_session_or_global_admin',
    master_api_key_used: auth.user.username === 'api',
    ...builder(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

function statusForSpaceAgentWrite(result: ReturnType<Writer>) {
  if (result.ok) return 200
  if (result.exact_blocker === 'invalid_payload') return 400
  if (result.exact_blocker === 'owner_hard_stop_required') return 403
  return 423
}

export async function spaceAgentWrite(request: NextRequest, writer: Writer, concurrence = false) {
  const auth = requireRoleOrAgentScope(
    request,
    'operator',
    concurrence ? SPACEAGENT_CONCURRENCE_SCOPES : SPACEAGENT_DRAFT_SCOPES,
  )
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const parsed = await request.json().catch(() => ({}))
  const input = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
  const result = writer(input)

  return NextResponse.json({
    token_source: auth.user.agent_scopes?.length ? 'agent_scoped_token' : 'human_session_or_global_admin',
    master_api_key_used: auth.user.username === 'api',
    ...result,
  }, {
    status: statusForSpaceAgentWrite(result),
    headers: { 'Cache-Control': 'no-store' },
  })
}
