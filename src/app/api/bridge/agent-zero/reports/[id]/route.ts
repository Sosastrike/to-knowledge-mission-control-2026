import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { readAgentZeroReport, readAgentZeroReportFile } from '@/lib/agent-zero-report-delivery'

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
  const markdown = readAgentZeroReportFile(id, 'markdown')
  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_report_detail',
    report,
    markdown_preview: markdown ? markdown.bytes.toString('utf8').slice(0, 8000) : null,
    safety: {
      raw_local_paths_exposed: false,
      task_ids_in_normal_replies: false,
      protected_actions_executed: false,
      external_writes_executed: false,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
