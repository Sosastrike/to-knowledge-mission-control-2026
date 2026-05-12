import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildConnectorProofReplayPacket } from '@/lib/connector-proof-packet'
import { buildRuntimeHealthPayload } from '@/lib/runtime-health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const runtimeHealth = buildRuntimeHealthPayload({ port: new URL(request.url).port || process.env.PORT || '3337' })
  const packet = await buildConnectorProofReplayPacket({
    runtimeCommit: runtimeHealth.source_commit,
  })

  return NextResponse.json({
    ...packet,
    endpoint: '/api/bridge/connector-proof-packet',
    note: 'Read-only connector proof replay. No Telegram send, AgentMail send, Drive upload, OneDrive upload, Zapier write, or HeyGen generation is executed.',
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
