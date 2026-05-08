import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { uploadAgentZeroReportToTelegram } from '@/lib/agent-zero-telegram-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await uploadAgentZeroReportToTelegram({
    requester: {
      userId: auth.user.id,
      username: auth.user.username,
      workspaceId: auth.user.workspace_id,
      tenantId: auth.user.tenant_id,
    },
    reportId: typeof body.report_id === 'string' ? body.report_id : null,
    bridgeSessionId: typeof body.bridge_session_id === 'string' ? body.bridge_session_id : null,
  })

  const httpStatus = result.ok ? 200 : result.status === 'failed' ? 502 : 423
  return NextResponse.json(result, { status: httpStatus, headers: { 'Cache-Control': 'no-store' } })
}
