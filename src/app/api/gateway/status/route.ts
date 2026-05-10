import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildCloudCodeGatewayStatus } from '@/lib/gateway-cloudcode-integration'
import { buildGatewayStatusPayload, loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const registry = await loadGatewayRegistry()
  const rawStatus = buildGatewayStatusPayload(registry)
  return NextResponse.json({
    ...rawStatus,
    ...buildCloudCodeGatewayStatus(rawStatus as any),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
