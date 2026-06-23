import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { callModelRouteApi, modelRouteTargetAgent, normalizeModelRouteRequest } from '@/lib/agent-platform-model-route-api'

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
  const selection = normalizeModelRouteRequest(body)
  if (!selection.requested_route_id) return NextResponse.json({ ok: false, error: 'requested_route_id_required' }, { status: 400 })
  const result = await callModelRouteApi({ user: auth.user, targetAgentId: agentId, action: 'request_model_switch', payload: { job_id: jobId, destination_route_id: selection.requested_route_id, fallback_policy: selection.fallback_policy } })
  return NextResponse.json(result.payload, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}
