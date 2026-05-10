import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getPlaywrightMcpStatus } from '@/lib/playwright-mcp'
import { getFirecrawlStatus } from '@/lib/firecrawl-status'
import { buildSpaceAgentBrowserAutomationPayload } from '@/lib/space-agent-browser-automation'
import { getYouTubeTranscriptConnectorStatus } from '@/lib/space-agent-youtube-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const generatedAt = new Date().toISOString()
  const playwrightMcp = await getPlaywrightMcpStatus()
  const firecrawlStatus = getFirecrawlStatus()
  const youtubeStatus = getYouTubeTranscriptConnectorStatus()
  return NextResponse.json(buildSpaceAgentBrowserAutomationPayload({
    generatedAt,
    playwrightMcp,
    firecrawlCredentialConfigured: firecrawlStatus.key_present,
    youtubeTranscriptConnectorProven: youtubeStatus.transcript_connector_proven,
  }), {
    status: playwrightMcp.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
