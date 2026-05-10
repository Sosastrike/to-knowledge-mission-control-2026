import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { sendAgentMailMessage } from '@/lib/agentmail-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await sendAgentMailMessage({
    requester: {
      userId: auth.user.id,
      username: auth.user.username,
      workspaceId: auth.user.workspace_id,
      tenantId: auth.user.tenant_id,
    },
    bridgeSessionId: typeof body.bridge_session_id === 'string' ? body.bridge_session_id : null,
    recipient: typeof body.recipient === 'string' ? body.recipient : null,
    subject: typeof body.subject === 'string' ? body.subject : null,
    text: typeof body.text === 'string' ? body.text : null,
    idempotencyKey: typeof body.idempotency_key === 'string' ? body.idempotency_key : null,
  })

  const httpStatus = result.ok ? 200 : result.status === 'failed' ? 502 : 423
  return NextResponse.json(result, {
    status: httpStatus,
    headers: { 'Cache-Control': 'no-store' },
  })
}
