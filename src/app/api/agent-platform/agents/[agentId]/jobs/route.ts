import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  buildAgentPlatformSubmissionBody,
  callAgentZeroPlatformApi,
  fetchAgentPlatformDiagnostics,
  normalizeAgentPlatformAgentId,
} from '@/lib/agent-platform-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ agentId: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { agentId: rawAgentId } = await params
  const agentId = normalizeAgentPlatformAgentId(rawAgentId)
  if (!agentId) return NextResponse.json({ ok: false, error: 'unknown_or_test_agent_not_allowed' }, { status: 404 })

  const result = await fetchAgentPlatformDiagnostics({
    user: auth.user,
    targetAgentId: agentId,
    includeEvents: request.nextUrl.searchParams.get('include_events') === 'true',
    includeResults: request.nextUrl.searchParams.get('include_results') === 'true',
  })
  return NextResponse.json({
    ...result.diagnostics,
    upstream_ok: result.upstream_ok,
    upstream_error: result.upstream_error,
  }, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { agentId: rawAgentId } = await params
  const agentId = normalizeAgentPlatformAgentId(rawAgentId)
  if (!agentId) return NextResponse.json({ ok: false, error: 'unknown_or_test_agent_not_allowed' }, { status: 404 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ ok: false, error: 'message_required' }, { status: 400 })

  const upstreamBody = buildAgentPlatformSubmissionBody({
    user: auth.user,
    targetAgentId: agentId,
    message,
    inputMode: 'QUEUE',
    idempotencyKey: typeof body.idempotency_key === 'string' ? body.idempotency_key : undefined,
    conversationId: typeof body.conversation_id === 'string' ? body.conversation_id : undefined,
    taskId: typeof body.task_id === 'string' ? body.task_id : undefined,
  })
  const upstream = await callAgentZeroPlatformApi('/api/api_message', upstreamBody, 15000)
  return NextResponse.json(upstream.payload, {
    status: upstream.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
