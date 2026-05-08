import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { uploadAgentZeroReportToGoogleDrive } from '@/lib/agent-zero-google-drive-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await uploadAgentZeroReportToGoogleDrive({
    reportId: typeof body.report_id === 'string' ? body.report_id : null,
    folder: typeof body.folder === 'string' ? body.folder : null,
    bridgeSessionId: typeof body.bridge_session_id === 'string' ? body.bridge_session_id : null,
  })
  const statusPayload = result as { ok?: boolean; status?: string }
  const httpStatus = statusPayload.ok ? 200 : statusPayload.status === 'failed' ? 502 : 423
  return NextResponse.json(result, { status: httpStatus, headers: { 'Cache-Control': 'no-store' } })
}
