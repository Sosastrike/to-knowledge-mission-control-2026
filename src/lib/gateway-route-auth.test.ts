import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(() => ({ error: 'Authentication required', status: 401 })),
}))

vi.mock('@/lib/gateway-registry-api', () => ({
  loadGatewayRegistry: vi.fn(() => {
    throw new Error('loadGatewayRegistry should not run for unauthenticated Gateway routes')
  }),
  buildGatewayStatusPayload: vi.fn(),
  buildGatewayNodesPayload: vi.fn(),
  buildGatewayFlowsPayload: vi.fn(),
  buildGatewayPoliciesPayload: vi.fn(),
  buildGatewayEventsPayload: vi.fn(),
  getGatewayNodeDetail: vi.fn(),
}))

vi.mock('@/lib/gateway-events', () => ({
  buildGatewayEventsPayload: vi.fn(),
}))

vi.mock('@/lib/gateway-mini-agent-os', () => ({
  buildGatewayMiniAgentOperatingSystem: vi.fn(),
  createGatewayMiniAgentProposal: vi.fn(),
}))

vi.mock('@/lib/gateway-observability', () => ({
  buildGatewayObservabilityPayload: vi.fn(),
  replayGatewayRoute: vi.fn(),
}))

describe('Gateway route authentication policy', () => {
  it('rejects unauthenticated Gateway routes before registry loading', async () => {
    const registry = await import('@/app/api/gateway/registry/route')
    const status = await import('@/app/api/gateway/status/route')
    const nodesList = await import('@/app/api/gateway/nodes/route')
    const nodes = await import('@/app/api/gateway/nodes/[id]/route')
    const flows = await import('@/app/api/gateway/flows/route')
    const policies = await import('@/app/api/gateway/policies/route')
    const events = await import('@/app/api/gateway/events/route')
    const observability = await import('@/app/api/gateway/observability/route')
    const replay = await import('@/app/api/gateway/replay/route')
    const dataLayerTool = await import('@/app/api/gateway/data-layer/[tool]/route')
    const dataLayerQuery = await import('@/app/api/gateway/data-layer/query/route')
    const dataLayerExecute = await import('@/app/api/gateway/data-layer/execute/route')
    const miniAgents = await import('@/app/api/gateway/mini-agents/route')
    const spaceAgentNode = await import('@/app/api/gateway/nodes/space-agent/route')
    const spaceAgentStatus = await import('@/app/api/bridge/space-agent/status/route')
    const spaceAgentTestChat = await import('@/app/api/bridge/space-agent/test-chat/route')
    const spaceAgentResearch = await import('@/app/api/gateway/space-agent/research/route')
    const spaceAgentJob = await import('@/app/api/gateway/space-agent/jobs/[id]/route')
    const paperclipStatus = await import('@/app/api/bridge/paperclip/status/route')
    const paperclipCompanies = await import('@/app/api/bridge/paperclip/companies/route')
    const paperclipAgents = await import('@/app/api/bridge/paperclip/agents/route')
    const paperclipIssues = await import('@/app/api/bridge/paperclip/issues/route')
    const paperclipTasks = await import('@/app/api/bridge/paperclip/tasks/route')
    const paperclipProposals = await import('@/app/api/bridge/paperclip/proposals/route')
    const paperclipTestChat = await import('@/app/api/bridge/paperclip/test-chat/route')

    const checks = [
      registry.GET(new NextRequest('http://localhost/api/gateway/registry')),
      status.GET(new NextRequest('http://localhost/api/gateway/status')),
      nodesList.GET(new NextRequest('http://localhost/api/gateway/nodes')),
      nodes.GET(new NextRequest('http://localhost/api/gateway/nodes/agent_zero'), {
        params: Promise.resolve({ id: 'agent_zero' }),
      }),
      flows.GET(new NextRequest('http://localhost/api/gateway/flows')),
      policies.GET(new NextRequest('http://localhost/api/gateway/policies')),
      events.GET(new NextRequest('http://localhost/api/gateway/events')),
      observability.GET(new NextRequest('http://localhost/api/gateway/observability')),
      replay.POST(new NextRequest('http://localhost/api/gateway/replay', {
        method: 'POST',
        body: JSON.stringify({ owner_request: 'Who is commander?' }),
      })),
      dataLayerTool.GET(new NextRequest('http://localhost/api/gateway/data-layer/getSystems'), {
        params: Promise.resolve({ tool: 'getSystems' }),
      }),
      dataLayerQuery.POST(new NextRequest('http://localhost/api/gateway/data-layer/query', {
        method: 'POST',
        body: JSON.stringify({ type: 'agent' }),
      })),
      dataLayerExecute.GET(new NextRequest('http://localhost/api/gateway/data-layer/execute')),
      dataLayerExecute.POST(new NextRequest('http://localhost/api/gateway/data-layer/execute', {
        method: 'POST',
        body: JSON.stringify({ node_id: 'opencloud', action: 'run' }),
      })),
      miniAgents.GET(new NextRequest('http://localhost/api/gateway/mini-agents')),
      miniAgents.POST(new NextRequest('http://localhost/api/gateway/mini-agents', {
        method: 'POST',
        body: JSON.stringify({ name: 'research scout', purpose: 'Summarize one source', scope: ['read-only summary'] }),
      })),
      spaceAgentNode.GET(new NextRequest('http://localhost/api/gateway/nodes/space-agent')),
      spaceAgentStatus.GET(new NextRequest('http://localhost/api/bridge/space-agent/status')),
      spaceAgentTestChat.POST(new NextRequest('http://localhost/api/bridge/space-agent/test-chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Can you see Gateway?' }),
      })),
      spaceAgentResearch.POST(new NextRequest('http://localhost/api/gateway/space-agent/research', {
        method: 'POST',
        body: JSON.stringify({ request: 'Research a public source.' }),
      })),
      spaceAgentJob.GET(new NextRequest('http://localhost/api/gateway/space-agent/jobs/job-1'), {
        params: Promise.resolve({ id: 'job-1' }),
      }),
      paperclipStatus.GET(new NextRequest('http://localhost/api/bridge/paperclip/status')),
      paperclipCompanies.GET(new NextRequest('http://localhost/api/bridge/paperclip/companies')),
      paperclipAgents.GET(new NextRequest('http://localhost/api/bridge/paperclip/agents')),
      paperclipIssues.GET(new NextRequest('http://localhost/api/bridge/paperclip/issues')),
      paperclipTasks.GET(new NextRequest('http://localhost/api/bridge/paperclip/tasks')),
      paperclipTasks.POST(new NextRequest('http://localhost/api/bridge/paperclip/tasks', {
        method: 'POST',
        body: JSON.stringify({ requester: 'agent_zero', assignee: 'hermes', title: 'Plan a workflow' }),
      })),
      paperclipProposals.GET(new NextRequest('http://localhost/api/bridge/paperclip/proposals')),
      paperclipProposals.POST(new NextRequest('http://localhost/api/bridge/paperclip/proposals', {
        method: 'POST',
        body: JSON.stringify({ proposal_kind: 'mini_agent_spec', title: 'Draft spec' }),
      })),
      paperclipTestChat.POST(new NextRequest('http://localhost/api/bridge/paperclip/test-chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Can you see Paperclip?' }),
      })),
    ]

    const responses = await Promise.all(checks)
    for (const response of responses) {
      expect([401, 403]).toContain(response.status)
      expect(await response.json()).toMatchObject({ error: 'Authentication required' })
    }
  })
})
