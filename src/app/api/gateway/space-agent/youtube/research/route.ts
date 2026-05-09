import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createSpaceAgentYouTubeConnectorPacket } from '@/lib/space-agent-youtube-connector'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RESPONSIBLE_AGENTS = new Set(['agent_zero', 'hermes', 'pi', 'responsible_specialist_agent'])

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const ownerRequest = typeof body.request === 'string'
    ? body.request.trim()
    : typeof body.message === 'string'
      ? body.message.trim()
      : ''
  if (!ownerRequest) {
    return NextResponse.json({
      ok: false,
      error: 'request_required',
      no_secrets_exposed: true,
      no_raw_paths: true,
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const responsibleAgent = typeof body.responsible_agent === 'string' && RESPONSIBLE_AGENTS.has(body.responsible_agent)
    ? body.responsible_agent as 'agent_zero' | 'hermes' | 'pi' | 'responsible_specialist_agent'
    : 'agent_zero'

  const result = await createSpaceAgentYouTubeConnectorPacket({
    request: ownerRequest,
    responsibleAgent,
    requestedBy: 'gateway',
  })

  const httpStatus = result.packet.status === 'blocked' ? 423 : 200
  return NextResponse.json({
    ok: result.ok,
    mode: 'space_agent_youtube_connector',
    blocked_reason: result.blocked_reason,
    connector_status: result.connector_status,
    canonical_status: result.connector_status.canonical_status,
    blocker_class: result.connector_status.blocker_class,
    packet: result.packet,
    no_secrets_exposed: true,
    no_raw_paths: true,
    no_fake_done: true,
  }, { status: httpStatus, headers: { 'Cache-Control': 'no-store' } })
}
