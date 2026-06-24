import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { callModelRouteApi, modelRouteFeatureDisabledResponse, modelRouteTargetAgent } from '@/lib/agent-platform-model-route-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ taskId: string }>

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  const { taskId } = await params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const sourceAgentId = modelRouteTargetAgent(typeof body.source_agent_id === 'string' ? body.source_agent_id : null)
  const targetAgentId = modelRouteTargetAgent(typeof body.target_agent_id === 'string' ? body.target_agent_id : null)
  if (!sourceAgentId || !targetAgentId) return NextResponse.json({ ok: false, error: 'source_and_target_agent_required' }, { status: 400 })
  const result = modelRouteFeatureDisabledResponse('agent_handoff_not_active')
  return NextResponse.json(result.payload, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}
