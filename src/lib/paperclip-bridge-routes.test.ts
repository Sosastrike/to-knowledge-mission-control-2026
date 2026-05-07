import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  buildPaperclipStatusPayload: vi.fn(),
  listPaperclipCompanies: vi.fn(),
  listPaperclipAgents: vi.fn(),
  listPaperclipIssues: vi.fn(),
  buildPaperclipGatewayTaskPayload: vi.fn(),
  buildPaperclipHermesProposalPayload: vi.fn(),
  buildPaperclipPiDispatcherRecommendationPayload: vi.fn(),
  buildPaperclipSpaceAgentResearchTaskPayload: vi.fn(),
  buildPaperclipTestTaskPayload: vi.fn(),
  buildPaperclipGatewayWorkforceFlowPayload: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/paperclip-bridge', () => ({
  buildPaperclipStatusPayload: mocks.buildPaperclipStatusPayload,
  listPaperclipCompanies: mocks.listPaperclipCompanies,
  listPaperclipAgents: mocks.listPaperclipAgents,
  listPaperclipIssues: mocks.listPaperclipIssues,
  buildPaperclipGatewayTaskPayload: mocks.buildPaperclipGatewayTaskPayload,
  buildPaperclipHermesProposalPayload: mocks.buildPaperclipHermesProposalPayload,
  buildPaperclipPiDispatcherRecommendationPayload: mocks.buildPaperclipPiDispatcherRecommendationPayload,
  buildPaperclipSpaceAgentResearchTaskPayload: mocks.buildPaperclipSpaceAgentResearchTaskPayload,
  buildPaperclipTestTaskPayload: mocks.buildPaperclipTestTaskPayload,
  buildPaperclipGatewayWorkforceFlowPayload: mocks.buildPaperclipGatewayWorkforceFlowPayload,
}))


const safeFlags = {
  execution_enabled: false,
  writes_enabled: false,
  protected_actions_enabled: false,
  no_secrets_exposed: true,
  raw_paths_exposed: false,
}

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

async function loadPaperclipRoutes() {
  return {
    status: await import('@/app/api/bridge/paperclip/status/route'),
    companies: await import('@/app/api/bridge/paperclip/companies/route'),
    agents: await import('@/app/api/bridge/paperclip/agents/route'),
    issues: await import('@/app/api/bridge/paperclip/issues/route'),
    tasks: await import('@/app/api/bridge/paperclip/tasks/route'),
    proposals: await import('@/app/api/bridge/paperclip/proposals/route'),
    dispatcher: await import('@/app/api/bridge/paperclip/dispatcher-recommendations/route'),
    research: await import('@/app/api/bridge/paperclip/research-tasks/route'),
    testChat: await import('@/app/api/bridge/paperclip/test-chat/route'),
    workforceFlow: await import('@/app/api/bridge/paperclip/workforce-flow/route'),
  }
}

function expectOwnerSafe(payload: unknown) {
  const serialized = JSON.stringify(payload)
  expect(serialized).not.toMatch(/sk-live|Bearer\s+abc123|auth\.json|sample-token-placeholder|sample-redacted-input/i)
  expect(serialized).not.toMatch(/\/home\//i)
  expect(serialized).toContain('"execution_enabled":false')
  expect(serialized).toContain('"writes_enabled":false')
}

function configureAuthenticatedMocks() {
  mocks.requireRole.mockReturnValue({ user: { id: 'owner' }, role: 'operator' })
  mocks.buildPaperclipStatusPayload.mockResolvedValue({
    ok: true,
    mode: 'paperclip_status_read_only',
    generated_at: '2026-05-07T00:00:00.000Z',
    health: 'connected',
    reachable: true,
    configured: true,
    workforce_summary: { company_count: 1, active_agents: 3, active_issues: 2, budget_status: 'within budget', heartbeat_status: 'healthy' },
    blocker: null,
    ...safeFlags,
  })
  mocks.listPaperclipCompanies.mockResolvedValue({ ok: true, mode: 'paperclip_companies_read_only', items: [{ id: 'company-1' }], count: 1, blocker: null, ...safeFlags })
  mocks.listPaperclipAgents.mockResolvedValue({ ok: true, mode: 'paperclip_agents_read_only', items: [{ id: 'agent_zero', role: 'commander' }], count: 1, blocker: null, ...safeFlags })
  mocks.listPaperclipIssues.mockResolvedValue({ ok: true, mode: 'paperclip_issues_read_only', items: [{ id: 'issue-1', title: 'Safe work item' }], count: 1, blocker: null, ...safeFlags })
  mocks.buildPaperclipGatewayTaskPayload.mockResolvedValue({
    ok: false,
    mode: 'paperclip_gateway_task_handoff',
    requester: 'agent_zero',
    assignee: 'hermes',
    policy_result: 'requires_session',
    task_issue: { paperclip_issue_recorded: false, title: 'Design email triage skill', status: 'not_created' },
    ...safeFlags,
  })
  mocks.buildPaperclipHermesProposalPayload.mockResolvedValue({
    ok: false,
    mode: 'paperclip_hermes_proposal_handoff',
    proposal_kind: 'skill_proposal_document',
    requester: 'hermes',
    storage: { paperclip_issue_recorded: false, work_product_recorded: false },
    ...safeFlags,
  })
  mocks.buildPaperclipPiDispatcherRecommendationPayload.mockResolvedValue({
    ok: false,
    mode: 'paperclip_pi_dispatcher_recommendation',
    requester: 'pi',
    recommendation: { recommended_agent: 'hermes', policy_result: 'requires_session', blocked_reason: 'active_bridge_session_and_paperclip_write_adapter_required_for_dispatcher_recommendation_storage' },
    ...safeFlags,
  })
  mocks.buildPaperclipSpaceAgentResearchTaskPayload.mockResolvedValue({
    ok: false,
    mode: 'paperclip_space_agent_research_task_handoff',
    requester: 'agent_zero',
    paperclip_tracking: { paperclip_research_issue_recorded: false },
    work_product: { paperclip_work_product_recorded: false },
    ...safeFlags,
  })
  mocks.buildPaperclipTestTaskPayload.mockResolvedValue({
    ok: false,
    mode: 'paperclip_read_only_test_task',
    paperclip_called: false,
    blocker: 'paperclip_safe_test_task_adapter_not_configured',
    ...safeFlags,
  })
  mocks.buildPaperclipGatewayWorkforceFlowPayload.mockResolvedValue({
    ok: false,
    mode: 'paperclip_gateway_workforce_flow_dry_run',
    policy_result: 'requires_session',
    worker_execution: { worker_performs_task: true, execution_enabled: false, writes_enabled: false },
    work_product: { work_product_recorded: false },
    ...safeFlags,
  })
}

describe('Paperclip bridge routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configureAuthenticatedMocks()
  })

  it('serves authenticated read-only Paperclip route contracts', async () => {
    const routes = await loadPaperclipRoutes()
    const responses = [
      await routes.status.GET(request('http://localhost/api/bridge/paperclip/status')),
      await routes.companies.GET(request('http://localhost/api/bridge/paperclip/companies')),
      await routes.agents.GET(request('http://localhost/api/bridge/paperclip/agents?companyId=company-1')),
      await routes.issues.GET(request('http://localhost/api/bridge/paperclip/issues?companyId=company-1')),
      await routes.tasks.GET(request('http://localhost/api/bridge/paperclip/tasks')),
      await routes.proposals.GET(request('http://localhost/api/bridge/paperclip/proposals')),
      await routes.dispatcher.GET(request('http://localhost/api/bridge/paperclip/dispatcher-recommendations')),
      await routes.research.GET(request('http://localhost/api/bridge/paperclip/research-tasks')),
      await routes.workforceFlow.GET(request('http://localhost/api/bridge/paperclip/workforce-flow')),
    ]

    for (const response of responses) {
      expect(response.status).toBe(200)
      const payload = await response.json()
      expect(payload.execution_enabled).toBe(false)
      expect(payload.writes_enabled).toBe(false)
      expect(payload.no_secrets_exposed).toBe(true)
    }
    expect(mocks.requireRole).toHaveBeenCalledWith(expect.any(NextRequest), 'viewer')
  })

  it('rejects unauthenticated Paperclip routes before bridge handlers run', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
    const routes = await loadPaperclipRoutes()
    const responses = [
      await routes.status.GET(request('http://localhost/api/bridge/paperclip/status')),
      await routes.companies.GET(request('http://localhost/api/bridge/paperclip/companies')),
      await routes.agents.GET(request('http://localhost/api/bridge/paperclip/agents')),
      await routes.issues.GET(request('http://localhost/api/bridge/paperclip/issues')),
      await routes.tasks.GET(request('http://localhost/api/bridge/paperclip/tasks')),
      await routes.tasks.POST(request('http://localhost/api/bridge/paperclip/tasks', { method: 'POST', body: JSON.stringify({ requester: 'agent_zero', assignee: 'hermes' }) })),
      await routes.proposals.GET(request('http://localhost/api/bridge/paperclip/proposals')),
      await routes.proposals.POST(request('http://localhost/api/bridge/paperclip/proposals', { method: 'POST', body: JSON.stringify({ title: 'Draft skill' }) })),
      await routes.dispatcher.GET(request('http://localhost/api/bridge/paperclip/dispatcher-recommendations')),
      await routes.dispatcher.POST(request('http://localhost/api/bridge/paperclip/dispatcher-recommendations', { method: 'POST', body: JSON.stringify({ owner_request: 'Recommend route' }) })),
      await routes.research.GET(request('http://localhost/api/bridge/paperclip/research-tasks')),
      await routes.research.POST(request('http://localhost/api/bridge/paperclip/research-tasks', { method: 'POST', body: JSON.stringify({ request: 'Research page' }) })),
      await routes.testChat.POST(request('http://localhost/api/bridge/paperclip/test-chat', { method: 'POST', body: JSON.stringify({ message: 'Can you see Paperclip?' }) })),
      await routes.workforceFlow.GET(request('http://localhost/api/bridge/paperclip/workforce-flow')),
      await routes.workforceFlow.POST(request('http://localhost/api/bridge/paperclip/workforce-flow', { method: 'POST', body: JSON.stringify({ owner_request: 'Route workforce task' }) })),
    ]

    for (const response of responses) {
      expect([401, 403]).toContain(response.status)
      expect(await response.json()).toMatchObject({ error: 'Authentication required' })
    }
    expect(mocks.buildPaperclipStatusPayload).not.toHaveBeenCalled()
    expect(mocks.buildPaperclipGatewayTaskPayload).not.toHaveBeenCalled()
    expect(mocks.buildPaperclipGatewayWorkforceFlowPayload).not.toHaveBeenCalled()
  })

  it('routes authenticated Paperclip POST contracts to the correct safe bridge builders', async () => {
    const routes = await loadPaperclipRoutes()
    const task = await routes.tasks.POST(request('http://localhost/api/bridge/paperclip/tasks', {
      method: 'POST',
      body: JSON.stringify({ requester: 'agent_zero', assignee: 'hermes', title: 'Design email triage skill', requested_action: 'Create planning issue only.' }),
    }))
    const proposal = await routes.proposals.POST(request('http://localhost/api/bridge/paperclip/proposals', {
      method: 'POST',
      body: JSON.stringify({ proposal_kind: 'skill_proposal_document', title: 'Hermes skill proposal', objective: 'Plan only.' }),
    }))
    const dispatcher = await routes.dispatcher.POST(request('http://localhost/api/bridge/paperclip/dispatcher-recommendations', {
      method: 'POST',
      body: JSON.stringify({ owner_request: 'Recommend a worker for a skill task.' }),
    }))
    const research = await routes.research.POST(request('http://localhost/api/bridge/paperclip/research-tasks', {
      method: 'POST',
      body: JSON.stringify({ request: 'Research a public source.', task_type: 'web_research', evidence: [{ summary: 'safe evidence' }] }),
    }))
    const testChat = await routes.testChat.POST(request('http://localhost/api/bridge/paperclip/test-chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Can you see Paperclip?' }),
    }))
    const workforce = await routes.workforceFlow.POST(request('http://localhost/api/bridge/paperclip/workforce-flow', {
      method: 'POST',
      body: JSON.stringify({ owner_request: 'Route a workforce task.', assignee: 'hermes', worker_result: 'Read-only worker result.' }),
    }))

    expect(task.status).toBe(409)
    expect(proposal.status).toBe(409)
    expect(dispatcher.status).toBe(409)
    expect(research.status).toBe(409)
    expect(testChat.status).toBe(503)
    expect(workforce.status).toBe(409)

    expect(mocks.buildPaperclipGatewayTaskPayload).toHaveBeenCalledWith(expect.objectContaining({ requester: 'agent_zero', assignee: 'hermes', title: 'Design email triage skill', requestedAction: 'Create planning issue only.', bridgeSessionActive: false }))
    expect(mocks.buildPaperclipHermesProposalPayload).toHaveBeenCalledWith(expect.objectContaining({ proposalKind: 'skill_proposal_document', title: 'Hermes skill proposal', objective: 'Plan only.' }))
    expect(mocks.buildPaperclipPiDispatcherRecommendationPayload).toHaveBeenCalledWith(expect.objectContaining({ ownerRequest: 'Recommend a worker for a skill task.' }))
    expect(mocks.buildPaperclipSpaceAgentResearchTaskPayload).toHaveBeenCalledWith(expect.objectContaining({ requester: 'agent_zero', taskType: 'web_research', request: 'Research a public source.', bridgeSessionActive: false }))
    expect(mocks.buildPaperclipTestTaskPayload).toHaveBeenCalledWith(expect.objectContaining({ message: 'Can you see Paperclip?' }))
    expect(mocks.buildPaperclipGatewayWorkforceFlowPayload).toHaveBeenCalledWith(expect.objectContaining({ ownerRequest: 'Route a workforce task.', assignee: 'hermes', workerResult: 'Read-only worker result.', bridgeSessionActive: false }))

    for (const response of [task, proposal, dispatcher, research, testChat, workforce]) {
      expectOwnerSafe(await response.json())
    }
    expect(mocks.requireRole).toHaveBeenCalledWith(expect.any(NextRequest), 'operator')
  })

  it('keeps the test-chat route blocked when the owner message is missing', async () => {
    const routes = await loadPaperclipRoutes()
    const response = await routes.testChat.POST(request('http://localhost/api/bridge/paperclip/test-chat', {
      method: 'POST',
      body: JSON.stringify({ message: '' }),
    }))

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload).toMatchObject({
      ok: false,
      error: 'message_required',
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
    })
    expect(mocks.buildPaperclipTestTaskPayload).not.toHaveBeenCalled()
  })
})
