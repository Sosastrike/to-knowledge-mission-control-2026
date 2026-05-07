import { AgentHubControlCenter } from '@/components/gateway-agent-hub/AgentHubControlCenter'
import { buildAgentHubStatusPayload } from '@/lib/gateway-agent-hub'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const dynamic = 'force-dynamic'

export default async function AgentHubPage() {
  const registry = await loadGatewayRegistry()
  const status = buildAgentHubStatusPayload(registry)
  return <AgentHubControlCenter status={status} />
}
