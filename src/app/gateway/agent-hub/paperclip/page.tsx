import { notFound } from 'next/navigation'
import { AgentHubPaperclipPage } from '@/components/gateway-agent-hub/AgentHubControlCenter'
import {
  buildAgentHubAgentAuditPayload,
  buildAgentHubAgentRoutesPayload,
  getAgentHubAgentPayload,
} from '@/lib/gateway-agent-hub'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const dynamic = 'force-dynamic'

export default async function AgentHubPaperclipRoutePage() {
  const registry = await loadGatewayRegistry()
  const detail = getAgentHubAgentPayload(registry, 'paperclip')
  const routes = buildAgentHubAgentRoutesPayload(registry, 'paperclip')
  const audit = buildAgentHubAgentAuditPayload(registry, 'paperclip')
  if (!detail || !routes || !audit) notFound()
  return <AgentHubPaperclipPage detail={detail} routes={routes} audit={audit} />
}
