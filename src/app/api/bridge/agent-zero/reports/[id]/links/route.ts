import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildAgentZeroReportLinks, readAgentZeroReport } from '@/lib/agent-zero-report-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const report = readAgentZeroReport(id)
  if (!report) {
    return NextResponse.json({ ok: false, error: 'agent_zero_report_not_found' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_protected_report_links',
    report_id: report.id,
    report_links: buildAgentZeroReportLinks(report, request.url),
    safety: {
      auth_required: true,
      raw_local_paths_exposed: false,
      public_local_exposure: false,
      no_fake_done: true,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
