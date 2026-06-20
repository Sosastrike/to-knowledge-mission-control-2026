import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildAgentPlatformSubmissionBody, callAgentZeroPlatformApi, normalizeAgentPlatformAgentId } from '@/lib/agent-platform-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ jobId: string }>

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { jobId } = await params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const message = typeof body.message === 'string' ? body.message.trim() : (typeof body.reason === 'string' ? body.reason.trim() : '')
  if (!message) return NextResponse.json({ ok: false, error: 'message_required' }, { status: 400 })
  const targetAgentId = normalizeAgentPlatformAgentId(typeof body.target_agent_id === 'string' ? body.target_agent_id : request.nextUrl.searchParams.get('agent_id') || 'agent_zero') || 'agent_zero'
  const upstreamBody = buildAgentPlatformSubmissionBody({
    user: auth.user,
    targetAgentId,
    message,
    inputMode: 'CANCEL',
    jobId,
    reason: 'mission_control_job_cancel',
    requiredPermission: 'agent:cancel',
  })
  const upstream = await callAgentZeroPlatformApi('/api/api_message', upstreamBody, 15000)
  return NextResponse.json(upstream.payload, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } })
}
