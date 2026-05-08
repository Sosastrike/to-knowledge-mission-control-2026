import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getPlaywrightMcpStatus } from '@/lib/playwright-mcp'
import { buildSpaceAgentBrowserAutomationPayload } from '@/lib/space-agent-browser-automation'
import { isYouTubeTranscriptConnectorAvailable } from '@/lib/space-agent-youtube-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const generatedAt = new Date().toISOString()
  const playwrightMcp = await getPlaywrightMcpStatus()
  return NextResponse.json(buildSpaceAgentBrowserAutomationPayload({ generatedAt, playwrightMcp, youtubeTranscriptConnectorProven: isYouTubeTranscriptConnectorAvailable() }), {
    status: playwrightMcp.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
