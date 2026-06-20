import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { fetchAgentPlatformDiagnostics, findAgentPlatformJob, normalizeAgentPlatformAgentId, resultForJob } from '@/lib/agent-platform-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ jobId: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { jobId } = await params
  const targetAgentId = normalizeAgentPlatformAgentId(request.nextUrl.searchParams.get('agent_id') || 'agent_zero') || 'agent_zero'
  const result = await fetchAgentPlatformDiagnostics({ user: auth.user, targetAgentId, includeEvents: true, includeResults: true })
  const job = findAgentPlatformJob(result.diagnostics, jobId)
  if (!job) return NextResponse.json({ ok: false, error: 'job_not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const events = result.diagnostics.events.filter((event) => event.job_id === job.job_id || event.task_id === job.task_id)
  return NextResponse.json({
    ok: true,
    mode: 'agent_platform_job_detail',
    job,
    events,
    result: resultForJob(result.diagnostics, job.job_id),
    credential_values_exposed: false,
    no_secrets_exposed: true,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
