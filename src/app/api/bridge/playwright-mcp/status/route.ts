import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getPlaywrightMcpStatus } from '@/lib/playwright-mcp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const status = await getPlaywrightMcpStatus()
  return NextResponse.json({
    ...status,
    generated_at: new Date().toISOString(),
  }, {
    status: status.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
