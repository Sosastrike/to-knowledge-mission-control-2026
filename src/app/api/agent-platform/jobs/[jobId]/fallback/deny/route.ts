import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { callModelRouteApi, modelRouteTargetAgent } from '@/lib/agent-platform-model-route-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ jobId: string }>

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  const { jobId } = await params
  const agentId = modelRouteTargetAgent(request.nextUrl.searchParams.get('agent_id'))
  if (!agentId) return NextResponse.json({ ok: false, error: 'unknown_or_test_agent_not_allowed' }, { status: 404 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const result = await callModelRouteApi({ user: auth.user, targetAgentId: agentId, action: 'deny_fallback', payload: { job_id: jobId, reason: typeof body.reason === 'string' ? body.reason : 'fallback denied' } })
  return NextResponse.json(result.payload, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}
