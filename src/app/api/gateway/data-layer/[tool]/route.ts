import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { buildGatewayDataLayer, dataLayerResponseForTool } from '@/lib/gateway-data-layer'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ tool: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  await requireRole(request, 'viewer')
  const { tool } = await context.params
  const registry = await loadGatewayRegistry()
  const layer = buildGatewayDataLayer(registry)
  const result = dataLayerResponseForTool(layer, tool, request.nextUrl.searchParams)

  if (result === null) {
    return NextResponse.json(
      {
        ok: false,
        error: 'gateway_data_layer_tool_not_found',
        tool,
        available_tools: layer.discovery_tools,
      },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    mode: `gateway_data_layer_${tool}`,
    tool,
    generated_at: layer.generated_at,
    result,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    secrets_exposed: false,
  })
}
