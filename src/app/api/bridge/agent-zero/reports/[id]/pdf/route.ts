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
  const file = readAgentZeroReportFile(id, 'pdf')
  if (!file) {
    return NextResponse.json({ ok: false, error: 'agent_zero_report_pdf_not_found' }, { status: 404 })
  }
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${file.filename.replace(/[^a-z0-9._-]/gi, '_')}"`,
    },
  })
}
