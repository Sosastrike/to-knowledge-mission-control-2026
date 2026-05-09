import { notFound } from 'next/navigation'
import { DesignerGatewayMockFrame } from '@/components/gateway/DesignerGatewayMockFrame'

export const dynamic = 'force-dynamic'

type AgentHubAgentDetailRouteProps = {
  params: Promise<{ id: string }>
}

const AGENT_DETAIL_TITLES: Record<string, string> = {
  'agent-zero': 'Gateway Agent Hub / Agent Zero',
  hermes: 'Gateway Agent Hub / Hermes',
  paperclip: 'Gateway Agent Hub / Paperclip',
  spaceagent: 'Gateway Agent Hub / SpaceAgent',
  'space-agent': 'Gateway Agent Hub / SpaceAgent',
  'pi-mono': 'Gateway Agent Hub / Pi-mono',
  pi: 'Gateway Agent Hub / Pi-mono',
  'openclaw-plus': 'Gateway Agent Hub / OpenClaw+',
  openclaw: 'Gateway Agent Hub / OpenClaw+',
  'openclaw+': 'Gateway Agent Hub / OpenClaw+',
}

const AGENT_DETAIL_FRAGMENTS: Record<string, string> = {
  'agent-zero': 'agent-zero',
  hermes: 'hermes',
  paperclip: 'paperclip',
  spaceagent: 'space-agent',
  'space-agent': 'space-agent',
  'pi-mono': 'pi-mono',
  pi: 'pi-mono',
  'openclaw-plus': 'openclaw-plus',
  openclaw: 'openclaw-plus',
  'openclaw+': 'openclaw-plus',
}

function normalizeRouteId(value: string): string {
  return decodeURIComponent(value).trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')
}

export default async function AgentHubAgentDetailRoutePage({ params }: AgentHubAgentDetailRouteProps) {
  const { id } = await params
  const normalized = normalizeRouteId(id)
  const fragment = AGENT_DETAIL_FRAGMENTS[normalized]
  const title = AGENT_DETAIL_TITLES[normalized]
  if (!fragment || !title) notFound()

  return <DesignerGatewayMockFrame title={title} page='Agent Hub.html' fragment={fragment} />
}
