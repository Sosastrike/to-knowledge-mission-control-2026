import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { replayGatewayRoute } from '@/lib/gateway-observability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const ownerRequest = typeof body?.owner_request === 'string' ? body.owner_request : ''
  const registry = await loadGatewayRegistry()
  return NextResponse.json(replayGatewayRoute(registry, ownerRequest), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
