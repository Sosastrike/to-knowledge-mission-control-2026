import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { createSpaceAgentResearchPayload } from '@/lib/space-agent-api'
import type { SpaceAgentResponsibleAgent } from '@/lib/space-agent-research'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RESPONSIBLE_AGENTS = new Set(['agent_zero', 'hermes', 'pi', 'responsible_specialist_agent'])

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, unknown> = {}
  let ownerRequest = ''
  try {
    const parsed = await request.json()
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    ownerRequest = typeof body.request === 'string'
      ? body.request.trim()
      : typeof body.message === 'string'
        ? body.message.trim()
        : ''
  } catch {
    body = {}
    ownerRequest = ''
  }

  if (!ownerRequest) {
    return NextResponse.json({
      ok: false,
      error: 'request_required',
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const responsibleAgent = typeof body.responsible_agent === 'string' && RESPONSIBLE_AGENTS.has(body.responsible_agent)
    ? body.responsible_agent as SpaceAgentResponsibleAgent
    : 'agent_zero'
  const generatedAt = new Date().toISOString()
  const registry = await loadGatewayRegistry()
  const payload = createSpaceAgentResearchPayload({
    request: ownerRequest,
    responsibleAgent,
    registry,
    generatedAt,
  })
  const status = payload.packet.status === 'blocked' ? 423 : 200

  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
