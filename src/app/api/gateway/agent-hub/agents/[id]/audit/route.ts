import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildAgentHubAgentAuditPayload } from '@/lib/gateway-agent-hub'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const registry = await loadGatewayRegistry()
  const payload = buildAgentHubAgentAuditPayload(registry, id)
  if (!payload) {
    return NextResponse.json({
      ok: false,
      error: 'agent_hub_agent_not_found',
      agent_id: id,
      execution_enabled: false,
      writes_enabled: false,
    }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
}
