import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { buildSpaceAgentStatusPayload } from '@/lib/space-agent-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const generatedAt = new Date().toISOString()
  const registry = await loadGatewayRegistry()
  return NextResponse.json(buildSpaceAgentStatusPayload(registry, generatedAt), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
