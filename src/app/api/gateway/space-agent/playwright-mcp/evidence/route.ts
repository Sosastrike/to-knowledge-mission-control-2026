import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createPlaywrightBrowserEvidencePacket, getPlaywrightMcpEvidenceIndex } from '@/lib/playwright-mcp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json(getPlaywrightMcpEvidenceIndex(new Date().toISOString()), {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let url = ''
  try {
    const body = await request.json()
    if (body && typeof body === 'object' && !Array.isArray(body) && typeof (body as Record<string, unknown>).url === 'string') {
      url = ((body as Record<string, unknown>).url as string).trim()
    }
  } catch {
    url = ''
  }

  const packet = await createPlaywrightBrowserEvidencePacket({
    url: url || undefined,
    generatedAt: new Date().toISOString(),
  })

  return NextResponse.json(packet, {
    status: packet.ok ? 200 : packet.bridge_session_required ? 423 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
