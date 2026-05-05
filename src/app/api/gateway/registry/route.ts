import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const registry = await loadGatewayRegistry()
  return NextResponse.json({
    ok: true,
    mode: 'gateway_registry_read_only',
    registry,
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
