import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { buildPiDispatcherStatusPayload } from '@/lib/gateway-pi-dispatcher'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const registry = await loadGatewayRegistry()
  return NextResponse.json(buildPiDispatcherStatusPayload(registry, new Date().toISOString()), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
