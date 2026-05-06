import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getGatewayNodeDetail, loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const registry = await loadGatewayRegistry()
  const detail = getGatewayNodeDetail(registry, 'space_agent')
  if (!detail) {
    return NextResponse.json({
      ok: false,
      error: 'space_agent_gateway_node_not_found',
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
    }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json({
    ...detail,
    alias_route: '/api/gateway/nodes/space-agent',
    canonical_route: '/api/gateway/nodes/space_agent',
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
