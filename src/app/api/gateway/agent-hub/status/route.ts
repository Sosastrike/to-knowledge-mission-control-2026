import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { attachSpaceAgentBrowserAutomationStatus, buildAgentHubStatusPayload } from '@/lib/gateway-agent-hub'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { getPlaywrightMcpStatus } from '@/lib/playwright-mcp'
import { buildSpaceAgentBrowserAutomationPayload } from '@/lib/space-agent-browser-automation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const registry = await loadGatewayRegistry()
  const generatedAt = new Date().toISOString()
  const playwrightMcp = await getPlaywrightMcpStatus()
  const payload = attachSpaceAgentBrowserAutomationStatus(
    buildAgentHubStatusPayload(registry),
    buildSpaceAgentBrowserAutomationPayload({ generatedAt, playwrightMcp }),
  )

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
