import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { buildPiDispatcherStatusPayload, recommendPiGatewayRoute } from '@/lib/gateway-pi-dispatcher'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const registry = await loadGatewayRegistry()
  return NextResponse.json(
    buildPiDispatcherStatusPayload(registry, new Date().toISOString(), '/api/gateway/dispatcher/pi'),
    { headers: { 'Cache-Control': 'no-store' } },
  )
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
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const requester = input.requester === 'owner' || input.requester === 'agent_zero' || input.requester === 'hermes' || input.requester === 'gateway'
    ? input.requester
    : 'gateway'
  const generatedAt = new Date().toISOString()
  const registry = await loadGatewayRegistry()
  const recommendation = recommendPiGatewayRoute(registry, {
    ownerRequest,
    requester,
    generatedAt,
  })

  return NextResponse.json({
    ok: true,
    mode: 'pi_dispatcher_shadow_recommendation_route',
    generated_at: generatedAt,
    recommendation,
    audit_event: {
      event: 'pi.dispatcher.recommendation.generated',
      route_target: recommendation.selected_route.target,
      decision: recommendation.policy_result,
      blocked_reason: recommendation.blocked_reason,
      external_write: false,
      execution_enabled: false,
      writes_enabled: false,
      secrets_exposed: false,
      recorded_at: generatedAt,
    },
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
