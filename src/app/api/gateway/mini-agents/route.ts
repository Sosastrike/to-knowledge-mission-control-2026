import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import {
  buildGatewayMiniAgentOperatingSystem,
  createGatewayMiniAgentProposal,
} from '@/lib/gateway-mini-agent-os'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const registry = await loadGatewayRegistry()
  return NextResponse.json(buildGatewayMiniAgentOperatingSystem(registry), {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, unknown> = {}
  try {
    const parsed = await request.json()
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    body = {}
  }

  const registry = await loadGatewayRegistry()
  const proposal = createGatewayMiniAgentProposal(registry, {
    name: typeof body.name === 'string' ? body.name : null,
    purpose: typeof body.purpose === 'string' ? body.purpose : null,
    parent_supervisor: typeof body.parent_supervisor === 'string' ? body.parent_supervisor : null,
    scope: Array.isArray(body.scope) ? body.scope.map(String) : (typeof body.scope === 'string' ? body.scope : null),
    memory_ttl_hours: typeof body.memory_ttl_hours === 'number' ? body.memory_ttl_hours : null,
    requested_by: 'gateway_api',
    reusable: typeof body.reusable === 'boolean' ? body.reusable : null,
    bridge_session_id: typeof body.bridge_session_id === 'string' ? body.bridge_session_id : null,
    allowed_capabilities: Array.isArray(body.allowed_capabilities) ? body.allowed_capabilities.map(String) : null,
  })

  return NextResponse.json(proposal, {
    status: proposal.ok ? 200 : 400,
    headers: { 'Cache-Control': 'no-store' },
  })
}
