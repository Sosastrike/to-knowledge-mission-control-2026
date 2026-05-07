import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getGatewayNodeDetail, loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const registry = await loadGatewayRegistry()
  const detail = getGatewayNodeDetail(registry, 'playwright_mcp')
  if (!detail) {
    return NextResponse.json({
      ok: false,
      error: 'gateway_node_not_found',
      node_id: 'playwright_mcp',
      execution_enabled: false,
      writes_enabled: false,
    }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } })
}
