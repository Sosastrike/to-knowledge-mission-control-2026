import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { buildSpaceAgentTestChatPayload } from '@/lib/space-agent-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let message = ''
  try {
    const body = await request.json()
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      message = typeof (body as Record<string, unknown>).message === 'string'
        ? ((body as Record<string, unknown>).message as string).trim()
        : ''
    }
  } catch {
    message = ''
  }

  if (!message) {
    return NextResponse.json({
      ok: false,
      error: 'message_required',
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const generatedAt = new Date().toISOString()
  const registry = await loadGatewayRegistry()
  const payload = buildSpaceAgentTestChatPayload({
    message,
    registry,
    generatedAt,
  })

  return NextResponse.json(payload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
