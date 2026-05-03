import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAgentZeroReport, listAgentZeroReports } from '@/lib/agent-zero-report-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safety() {
  return {
    execution_enabled: false,
    protected_actions_executed: false,
    external_writes_executed: false,
    telegram_attachment_sent: false,
    raw_local_paths_exposed: false,
    task_ids_in_normal_replies: false,
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get('limit') || '25')
  const reports = listAgentZeroReports({ limit })
  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_report_delivery_surface',
    generated_at: new Date().toISOString(),
    reports,
    count: reports.length,
    safety: safety(),
    next_action: 'POST to this route to create a local Agent Zero Markdown/PDF report. External delivery remains blocked unless a separate approved adapter exists.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await createAgentZeroReport({
    title: typeof body.title === 'string' ? body.title : 'Agent Zero Report',
    summary: typeof body.summary === 'string' ? body.summary : 'Agent Zero created this report through Mission Control.',
    sections: body.sections,
    requestedDelivery: body.requested_delivery || body.requestedDelivery,
    ownerMessage: typeof body.owner_message === 'string' ? body.owner_message : undefined,
    source: 'api',
  })

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_report_delivery_surface',
    report: result.report,
    attachments: result.attachments,
    normal_reply: result.report.normal_reply,
    safety: safety(),
    next_action: result.report.delivery_channels.some((channel) => channel.requested && channel.status === 'blocked')
      ? 'Open the Mission Control report link. Requested external delivery remains blocked until an approved delivery adapter exists.'
      : 'Open the Mission Control report link or download the PDF/Markdown attachment from Mission Control.',
  }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
