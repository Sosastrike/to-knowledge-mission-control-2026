import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  buildAgentZeroDispatcherStatusPayload,
  planAgentZeroGatewayDispatch,
} from '@/lib/gateway-agent-zero-dispatcher'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const registry = await loadGatewayRegistry()
  return NextResponse.json(buildAgentZeroDispatcherStatusPayload(registry), {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const ownerRequest = typeof input.owner_request === 'string'
    ? input.owner_request
    : typeof input.ownerRequest === 'string'
      ? input.ownerRequest
      : ''

  if (!ownerRequest.trim()) {
    return NextResponse.json({
      ok: false,
      error: 'owner_request_required',
      execution_enabled: false,
      writes_enabled: false,
      dispatch_executed: false,
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const registry = await loadGatewayRegistry()
  const dispatch = planAgentZeroGatewayDispatch(registry, {
    ownerRequest,
    generatedAt: new Date().toISOString(),
  })

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_dispatcher_route',
    generated_at: dispatch.generated_at,
    dispatch,
    audit_event: dispatch.audit_event,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    dispatch_executed: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
