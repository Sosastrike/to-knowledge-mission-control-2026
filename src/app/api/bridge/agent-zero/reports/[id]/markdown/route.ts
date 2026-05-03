import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { readAgentZeroReportFile } from '@/lib/agent-zero-report-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const file = readAgentZeroReportFile(id, 'markdown')
  if (!file) {
    return NextResponse.json({ ok: false, error: 'agent_zero_report_markdown_not_found' }, { status: 404 })
  }
  return new NextResponse(file.bytes.toString('utf8'), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file.filename.replace(/[^a-z0-9._-]/gi, '_')}"`,
    },
  })
}
