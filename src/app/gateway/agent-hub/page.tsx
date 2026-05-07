import { AgentHubControlCenter } from '@/components/gateway-agent-hub/AgentHubControlCenter'
import { attachSpaceAgentBrowserAutomationStatus, buildAgentHubStatusPayload } from '@/lib/gateway-agent-hub'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { buildSpaceAgentBrowserAutomationPayload } from '@/lib/space-agent-browser-automation'
import { getPlaywrightMcpStatus } from '@/lib/playwright-mcp'

export const dynamic = 'force-dynamic'

export default async function AgentHubPage() {
  const registry = await loadGatewayRegistry()
  const generatedAt = new Date().toISOString()
  const playwrightMcp = await getPlaywrightMcpStatus()
  const status = attachSpaceAgentBrowserAutomationStatus(
    buildAgentHubStatusPayload(registry),
    buildSpaceAgentBrowserAutomationPayload({ generatedAt, playwrightMcp }),
  )
  return <AgentHubControlCenter status={status} />
}
