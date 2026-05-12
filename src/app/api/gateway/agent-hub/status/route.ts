import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildAgentStatusConsistencyReport } from '@/lib/agent-status-consistency'
import { buildCloudCodeAgentHealth } from '@/lib/gateway-cloudcode-integration'
import { attachOpenClawGatewayRuntimeStatus, attachSpaceAgentBrowserAutomationStatus, buildAgentHubStatusPayload } from '@/lib/gateway-agent-hub'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { getFirecrawlStatus } from '@/lib/firecrawl-status'
import { getOpenClawGatewayRuntimeStatus } from '@/lib/openclaw-gateway-runtime'
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
  const [playwrightMcp, openclawRuntime] = await Promise.all([
    getPlaywrightMcpStatus(),
    getOpenClawGatewayRuntimeStatus({ generatedAt }),
  ])
  const firecrawl = getFirecrawlStatus()
  const youtube = getYouTubeTranscriptConnectorStatus()
  const payload = attachOpenClawGatewayRuntimeStatus(
    attachSpaceAgentBrowserAutomationStatus(
      buildAgentHubStatusPayload(registry),
      buildSpaceAgentBrowserAutomationPayload({
        generatedAt,
        playwrightMcp,
        firecrawlCredentialConfigured: firecrawl.key_present,
        youtubeTranscriptConnectorProven: youtube.transcript_connector_proven,
      }),
    ),
    openclawRuntime,
  )

  const cloudcodeAgentHealth = buildCloudCodeAgentHealth(payload as any)
  const agentStatusConsistency = buildAgentStatusConsistencyReport(payload, cloudcodeAgentHealth)

  return NextResponse.json({
    ...payload,
    agent_status_consistency: agentStatusConsistency,
    cloudcode_backend_support: {
      applied: true,
      source: 'cloudcode-backend-support-handoff',
      helpers: ['buildAgentHealth'],
    },
    cloudcode_agent_health: cloudcodeAgentHealth,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
