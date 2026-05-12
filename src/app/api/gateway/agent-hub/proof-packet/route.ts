import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildAgentStatusConsistencyReport } from '@/lib/agent-status-consistency'
import { buildCloudCodeAgentHealth } from '@/lib/gateway-cloudcode-integration'
import { attachOpenClawGatewayRuntimeStatus, attachSpaceAgentBrowserAutomationStatus, buildAgentHubStatusPayload } from '@/lib/gateway-agent-hub'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { buildMultiAgentProofPacket } from '@/lib/multi-agent-proof-packet'
import { buildRuntimeHealthPayload } from '@/lib/runtime-health'
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
  const agentHubPayload = attachOpenClawGatewayRuntimeStatus(
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
  const cloudcodeHealth = buildCloudCodeAgentHealth(agentHubPayload as any)
  const consistencyReport = buildAgentStatusConsistencyReport(agentHubPayload, cloudcodeHealth)
  const runtimeHealth = buildRuntimeHealthPayload({ port: new URL(request.url).port || process.env.PORT || '3337' })
  const proofPacket = buildMultiAgentProofPacket({
    agentHubPayload,
    cloudcodeHealth,
    consistencyReport,
    runtimeCommit: runtimeHealth.source_commit,
  })

  return NextResponse.json({
    ...proofPacket,
    agent_status_consistency: {
      ok: consistencyReport.ok,
      issues: consistencyReport.issues,
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
