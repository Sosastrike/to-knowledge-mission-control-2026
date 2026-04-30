import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getZapierToolBridge } from '@/lib/zapier-tool-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const payload = await getZapierToolBridge()
  return NextResponse.json({
    ...payload,
    endpoint: '/api/bridge/zapier/status',
    canonical_tools_endpoint: '/api/bridge/zapier/tools',
    canonical_search_endpoint: '/api/bridge/zapier/tools/search?q=heygen',
    note: 'Read-only Zapier Tool Bridge. No Zapier tools are invoked.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

