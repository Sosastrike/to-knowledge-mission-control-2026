import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { buildGatewayDataLayer, executeAction } from '@/lib/gateway-data-layer'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  await requireRole(request, 'viewer')
  return NextResponse.json(
    {
      ok: false,
      mode: 'bridge_session_required',
      execution_enabled: false,
      accepted_for_execution: false,
      requires_bridge_session: true,
      blocked_reason: 'gateway_data_layer_executeAction_requires_active_bridge_session_and_registered_adapter',
      secrets_exposed: false,
    },
    { status: 403 },
  )
}

export async function POST(request: NextRequest) {
  await requireRole(request, 'operator')
  const body = await request.json().catch(() => ({}))
  const registry = await loadGatewayRegistry()
  const layer = buildGatewayDataLayer(registry)
  const result = executeAction(layer, body)

  return NextResponse.json(
    {
      ...result,
      generated_at: layer.generated_at,
      writes_enabled: false,
      external_writes_enabled: false,
      secrets_exposed: false,
    },
    { status: 403 },
  )
}
