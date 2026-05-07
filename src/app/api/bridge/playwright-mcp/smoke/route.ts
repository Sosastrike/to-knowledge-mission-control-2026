import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { runPlaywrightMcpMissionControlSmoke } from '@/lib/playwright-mcp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let url: string | undefined
  try {
    const body = await request.json()
    if (body && typeof body === 'object' && !Array.isArray(body) && typeof (body as Record<string, unknown>).url === 'string') {
      url = ((body as Record<string, unknown>).url as string).trim() || undefined
    }
  } catch {
    url = undefined
  }

  const result = await runPlaywrightMcpMissionControlSmoke({ url, generatedAt: new Date().toISOString() })
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.evidence.bridge_session_required ? 423 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
