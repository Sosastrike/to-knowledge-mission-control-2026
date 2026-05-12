import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildBridgeApprovalProofReplayPacket } from '@/lib/bridge-approval-proof-packet'
import { buildRuntimeHealthPayload } from '@/lib/runtime-health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const runtimeHealth = buildRuntimeHealthPayload({ port: new URL(request.url).port || process.env.PORT || '3337' })
  const packet = buildBridgeApprovalProofReplayPacket({
    runtimeCommit: runtimeHealth.source_commit,
  })

  return NextResponse.json({
    ...packet,
    endpoint: '/api/bridge/approval-proof-packet',
    note: 'Read-only Bridge approval proof replay. No approval is created in production and no Run Now, connector write, external write, Zapier action, HeyGen action, or systemctl command is executed.',
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
