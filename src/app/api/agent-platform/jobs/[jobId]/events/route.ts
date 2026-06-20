import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { fetchAgentPlatformDiagnostics, findAgentPlatformJob, normalizeAgentPlatformAgentId } from '@/lib/agent-platform-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ jobId: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { jobId } = await params
  const targetAgentId = normalizeAgentPlatformAgentId(request.nextUrl.searchParams.get('agent_id') || 'agent_zero') || 'agent_zero'
  const result = await fetchAgentPlatformDiagnostics({ user: auth.user, targetAgentId, includeEvents: true })
  const job = findAgentPlatformJob(result.diagnostics, jobId)
  if (!job) return NextResponse.json({ ok: false, error: 'job_not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({
    ok: true,
    mode: 'agent_platform_job_events',
    job_id: job.job_id,
    task_id: job.task_id,
    events: result.diagnostics.events.filter((event) => event.job_id === job.job_id || event.task_id === job.task_id),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
