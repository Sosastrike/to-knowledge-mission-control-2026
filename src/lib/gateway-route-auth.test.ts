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
    const spaceAgentBrowserStatus = await import('@/app/api/gateway/space-agent/browser/status/route')
    const spaceAgentBrowserJobs = await import('@/app/api/gateway/space-agent/browser/jobs/route')
    const playwrightMcpNode = await import('@/app/api/gateway/nodes/playwright-mcp/route')
    const playwrightMcpStatus = await import('@/app/api/bridge/playwright-mcp/status/route')
    const playwrightMcpSmoke = await import('@/app/api/bridge/playwright-mcp/smoke/route')
    const playwrightEvidence = await import('@/app/api/gateway/space-agent/playwright-mcp/evidence/route')
    const paperclipStatus = await import('@/app/api/bridge/paperclip/status/route')
    const paperclipCompanies = await import('@/app/api/bridge/paperclip/companies/route')
    const paperclipAgents = await import('@/app/api/bridge/paperclip/agents/route')
    const paperclipIssues = await import('@/app/api/bridge/paperclip/issues/route')
    const paperclipTasks = await import('@/app/api/bridge/paperclip/tasks/route')
    const paperclipProposals = await import('@/app/api/bridge/paperclip/proposals/route')
    const paperclipDispatcherRecommendations = await import('@/app/api/bridge/paperclip/dispatcher-recommendations/route')
    const paperclipResearchTasks = await import('@/app/api/bridge/paperclip/research-tasks/route')
    const paperclipTestChat = await import('@/app/api/bridge/paperclip/test-chat/route')
    const paperclipWorkforceFlow = await import('@/app/api/bridge/paperclip/workforce-flow/route')
    const agentHubStatus = await import('@/app/api/gateway/agent-hub/status/route')
    const agentHubRegistry = await import('@/app/api/gateway/agent-hub/registry/route')
    const agentHubAgents = await import('@/app/api/gateway/agent-hub/agents/route')
    const agentHubAgent = await import('@/app/api/gateway/agent-hub/agents/[id]/route')
    const agentHubAgentHealth = await import('@/app/api/gateway/agent-hub/agents/[id]/health/route')
    const agentHubAgentRoutes = await import('@/app/api/gateway/agent-hub/agents/[id]/routes/route')
    const agentHubAgentAudit = await import('@/app/api/gateway/agent-hub/agents/[id]/audit/route')

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
        body: JSON.stringify({ node_id: 'openclaw_plus', action: 'run' }),
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
      spaceAgentBrowserStatus.GET(new NextRequest('http://localhost/api/gateway/space-agent/browser/status')),
      spaceAgentBrowserJobs.GET(new NextRequest('http://localhost/api/gateway/space-agent/browser/jobs')),
      playwrightMcpNode.GET(new NextRequest('http://localhost/api/gateway/nodes/playwright-mcp')),
      playwrightMcpStatus.GET(new NextRequest('http://localhost/api/bridge/playwright-mcp/status')),
      playwrightMcpSmoke.POST(new NextRequest('http://localhost/api/bridge/playwright-mcp/smoke', { method: 'POST' })),
      playwrightEvidence.GET(new NextRequest('http://localhost/api/gateway/space-agent/playwright-mcp/evidence')),
      playwrightEvidence.POST(new NextRequest('http://localhost/api/gateway/space-agent/playwright-mcp/evidence', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com' }),
      })),
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
      paperclipDispatcherRecommendations.GET(new NextRequest('http://localhost/api/bridge/paperclip/dispatcher-recommendations')),
      paperclipDispatcherRecommendations.POST(new NextRequest('http://localhost/api/bridge/paperclip/dispatcher-recommendations', {
        method: 'POST',
        body: JSON.stringify({ owner_request: 'Recommend route' }),
      })),
      paperclipResearchTasks.GET(new NextRequest('http://localhost/api/bridge/paperclip/research-tasks')),
      paperclipResearchTasks.POST(new NextRequest('http://localhost/api/bridge/paperclip/research-tasks', {
        method: 'POST',
        body: JSON.stringify({ request: 'Research a public page.' }),
      })),
      paperclipTestChat.POST(new NextRequest('http://localhost/api/bridge/paperclip/test-chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Can you see Paperclip?' }),
      })),
      paperclipWorkforceFlow.GET(new NextRequest('http://localhost/api/bridge/paperclip/workforce-flow')),
      paperclipWorkforceFlow.POST(new NextRequest('http://localhost/api/bridge/paperclip/workforce-flow', {
        method: 'POST',
        body: JSON.stringify({ owner_request: 'Route a workforce task.', assignee: 'hermes' }),
      })),
      agentHubStatus.GET(new NextRequest('http://localhost/api/gateway/agent-hub/status')),
      agentHubRegistry.GET(new NextRequest('http://localhost/api/gateway/agent-hub/registry')),
      agentHubAgents.GET(new NextRequest('http://localhost/api/gateway/agent-hub/agents')),
      agentHubAgent.GET(new NextRequest('http://localhost/api/gateway/agent-hub/agents/agent-zero'), {
        params: Promise.resolve({ id: 'agent-zero' }),
      }),
      agentHubAgentHealth.GET(new NextRequest('http://localhost/api/gateway/agent-hub/agents/hermes/health'), {
        params: Promise.resolve({ id: 'hermes' }),
      }),
      agentHubAgentRoutes.GET(new NextRequest('http://localhost/api/gateway/agent-hub/agents/paperclip/routes'), {
        params: Promise.resolve({ id: 'paperclip' }),
      }),
      agentHubAgentAudit.GET(new NextRequest('http://localhost/api/gateway/agent-hub/agents/pi-mono/audit'), {
        params: Promise.resolve({ id: 'pi-mono' }),
      }),
    ]

    const responses = await Promise.all(checks)
    for (const response of responses) {
      expect([401, 403]).toContain(response.status)
      expect(await response.json()).toMatchObject({ error: 'Authentication required' })
    }
  })
})
