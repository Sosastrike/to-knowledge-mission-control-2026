import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getZapierToolBridge } from '@/lib/zapier-tool-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const query = new URL(request.url).searchParams.get('q') || ''
  const payload = await getZapierToolBridge(query)
  return NextResponse.json({
    ...payload,
    endpoint: '/api/bridge/zapier/tools/search',
    searched_for: query,
    heygen_message: payload.heygen_found
      ? `HeyGen is visible through Zapier MCP as ${payload.exact_heygen_tool_name}.`
      : 'HeyGen is not visible in Zapier MCP. Owner must connect HeyGen in Zapier first.',
    note: 'Search is read-only. No Zapier tool is invoked.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

