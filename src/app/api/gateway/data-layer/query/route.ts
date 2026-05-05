import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { buildGatewayDataLayer, queryData } from '@/lib/gateway-data-layer'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const registry = await loadGatewayRegistry()
  const layer = buildGatewayDataLayer(registry)
  const result = queryData(layer, body)

  return NextResponse.json(
    {
      ...result,
      generated_at: layer.generated_at,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      secrets_exposed: false,
    },
    { status: result.ok ? 200 : 403 },
  )
}
