import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildCloudCodeAgentHealth } from '@/lib/gateway-cloudcode-integration'
import { attachSpaceAgentBrowserAutomationStatus, buildAgentHubStatusPayload } from '@/lib/gateway-agent-hub'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { getFirecrawlStatus } from '@/lib/firecrawl-status'
import { getPlaywrightMcpStatus } from '@/lib/playwright-mcp'
import { buildSpaceAgentBrowserAutomationPayload } from '@/lib/space-agent-browser-automation'
import { getYouTubeTranscriptConnectorStatus } from '@/lib/space-agent-youtube-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const registry = await loadGatewayRegistry()
  const generatedAt = new Date().toISOString()
  const playwrightMcp = await getPlaywrightMcpStatus()
  const firecrawl = getFirecrawlStatus()
  const youtube = getYouTubeTranscriptConnectorStatus()
  const payload = attachSpaceAgentBrowserAutomationStatus(
    buildAgentHubStatusPayload(registry),
    buildSpaceAgentBrowserAutomationPayload({
      generatedAt,
      playwrightMcp,
      firecrawlCredentialConfigured: firecrawl.key_present,
      youtubeTranscriptConnectorProven: youtube.transcript_connector_proven,
    }),
  )

  return NextResponse.json({
    ...payload,
    cloudcode_backend_support: {
      applied: true,
      source: 'cloudcode-backend-support-handoff',
      helpers: ['buildAgentHealth'],
    },
    cloudcode_agent_health: buildCloudCodeAgentHealth(payload as any),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
