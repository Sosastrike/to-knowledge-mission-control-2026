import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getSpaceAgentJobPayload } from '@/lib/space-agent-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const payload = getSpaceAgentJobPayload(id, new Date().toISOString())
  return NextResponse.json(payload, {
    status: payload.ok ? 200 : 404,
    headers: { 'Cache-Control': 'no-store' },
  })
}
