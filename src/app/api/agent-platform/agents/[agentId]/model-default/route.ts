import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { callModelRouteApi, modelRouteFeatureDisabledResponse, modelRouteTargetAgent, normalizeModelRouteRequest } from '@/lib/agent-platform-model-route-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ agentId: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  const { agentId: rawAgentId } = await params
  const agentId = modelRouteTargetAgent(rawAgentId)
  if (!agentId) return NextResponse.json({ ok: false, error: 'unknown_or_test_agent_not_allowed' }, { status: 404 })
  const result = await callModelRouteApi({ user: auth.user, targetAgentId: agentId, action: 'get_agent_model_default' })
  return NextResponse.json(result.payload, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  const { agentId: rawAgentId } = await params
  const agentId = modelRouteTargetAgent(rawAgentId)
  if (!agentId) return NextResponse.json({ ok: false, error: 'unknown_or_test_agent_not_allowed' }, { status: 404 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const selection = normalizeModelRouteRequest(body)
  if (!selection.requested_route_id) return NextResponse.json({ ok: false, error: 'requested_route_id_required' }, { status: 400 })
  const result = modelRouteFeatureDisabledResponse('model_route_selection_not_active')
  return NextResponse.json(result.payload, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}
