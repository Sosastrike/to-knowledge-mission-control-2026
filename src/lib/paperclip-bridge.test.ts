import { describe, expect, it, vi } from 'vitest'
import {
  buildPaperclipGatewayTaskPayload,
  buildPaperclipStatusPayload,
  buildPaperclipTestTaskPayload,
  listPaperclipAgents,
  listPaperclipCompanies,
  listPaperclipIssues,
  resolvePaperclipEndpoint,
} from './paperclip-bridge'

const GENERATED_AT = '2026-05-06T00:00:00.000Z'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function expectOwnerSafe(payload: unknown) {
  const serialized = JSON.stringify(payload)
  expect(serialized).not.toMatch(/sk-live|Bearer\s+abc123|auth\.json|\/home\/tony|sample-token-placeholder|sample-redacted-input/i)
  expect(serialized).toMatch(/"execution_enabled":false/)
  expect(serialized).toMatch(/"writes_enabled":false/)
}

describe('Paperclip bridge payloads', () => {
  it('keeps Paperclip endpoint local or Tailnet only', () => {
    expect(resolvePaperclipEndpoint('http://127.0.0.1:3100')).toMatchObject({ blocker: null, ownerVisible: 'loopback:3100' })
    expect(resolvePaperclipEndpoint('http://100.10.20.30:3100')).toMatchObject({ blocker: null, ownerVisible: 'tailnet:3100' })
    expect(resolvePaperclipEndpoint('https://example.com')).toMatchObject({ blocker: 'paperclip_endpoint_not_local_or_tailnet' })
  })

  it('returns a degraded read-only status when the sandbox API is not running', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('connection refused') })
    const payload = await buildPaperclipStatusPayload({ generatedAt: GENERATED_AT, fetchImpl })

    expect(payload).toMatchObject({
      mode: 'paperclip_status_read_only',
      health: 'degraded',
      reachable: false,
      configured: false,
      ui_link: 'http://127.0.0.1:3100',
      workforce_summary: {
        company_count: null,
        active_agents: null,
        active_issues: null,
        budget_status: 'not reachable',
        heartbeat_status: 'not reachable',
      },
      blocker: 'paperclip_sandbox_service_not_running',
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expectOwnerSafe(payload)
  })

  it('sanitizes read-only company, agent, and issue inventory', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/health')) {
        return jsonResponse({ status: 'ok', version: '0.0.0', authFile: '/home/tony/.paperclip/auth.json' })
      }
      if (url.endsWith('/api/companies')) {
        return jsonResponse([
          {
            id: 'company-1',
            name: 'To Knowledge Gateway',
            issuePrefix: 'TKG',
            status: 'active',
            secretNote: 'sample-redacted-input',
          },
        ])
      }
      if (url.endsWith('/api/companies/company-1/agents')) {
        return jsonResponse({
          agents: [
            {
              id: 'agent-1',
              name: 'Agent Zero',
              role: 'commander',
              status: 'active',
              metadata: {
                gateway_role: 'commander',
                owner_visible_status: 'active_commander',
                bridge_session_required_for_execution: true,
                token: 'sample-token-placeholder',
                authFile: '/home/tony/.paperclip/auth.json',
              },
              adapterConfig: { token: 'sample-token-placeholder' },
            },
          ],
        })
      }
      if (url.endsWith('/api/companies/company-1/issues')) {
        return jsonResponse({
          issues: [
            {
              id: 'issue-1',
              identifier: 'TKG-1',
              title: 'Prepare workforce summary /Users/example/private',
              status: 'todo',
              assigneeAgentId: 'agent-1',
            },
          ],
        })
      }
      return jsonResponse({ error: 'not found' }, 404)
    })

    const status = await buildPaperclipStatusPayload({ generatedAt: GENERATED_AT, fetchImpl })
    const companies = await listPaperclipCompanies({ generatedAt: GENERATED_AT, fetchImpl })
    const agents = await listPaperclipAgents({ generatedAt: GENERATED_AT, fetchImpl })
    const issues = await listPaperclipIssues({ generatedAt: GENERATED_AT, fetchImpl })

    expect(status).toMatchObject({
      health: 'connected',
      reachable: true,
      configured: true,
      ui_link: 'http://127.0.0.1:3100',
      workforce_summary: {
        company_count: 1,
        active_agents: 1,
        active_issues: 1,
        budget_status: 'not reported',
        heartbeat_status: 'not reported',
      },
    })
    expect(companies.items[0]).toMatchObject({ id: 'company-1', name: 'To Knowledge Gateway', issue_prefix: 'TKG' })
    expect(agents.items[0]).toMatchObject({
      id: 'agent-1',
      name: 'Agent Zero',
      gateway_role: 'commander',
      bridge_session_required_for_execution: true,
    })
    expect(issues.items[0]).toMatchObject({
      id: 'issue-1',
      identifier: 'TKG-1',
      title: 'Prepare workforce summary [redacted-path]',
      assignee_agent: 'assigned',
    })
    expectOwnerSafe({ status, companies, agents, issues })
  })

  it('routes Agent Zero Paperclip task requests through Gateway without writing issues', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok' })
      if (url.endsWith('/api/companies')) return jsonResponse([{ id: 'company-1', name: 'To Knowledge Gateway' }])
      if (url.endsWith('/api/companies/company-1/agents')) return jsonResponse({ agents: [] })
      if (url.endsWith('/api/companies/company-1/issues')) return jsonResponse({ issues: [] })
      return jsonResponse({ error: 'not found' }, 404)
    })

    const hermes = await buildPaperclipGatewayTaskPayload({
      generatedAt: GENERATED_AT,
      fetchImpl,
      requester: 'agent_zero',
      assignee: 'hermes',
      title: 'Ask Hermes for an email triage workflow',
      requestedAction: 'Assign Hermes a planning task only.',
    })

    expect(hermes).toMatchObject({
      mode: 'paperclip_gateway_task_handoff',
      requester: 'agent_zero',
      assignee: 'hermes',
      selected_route: ['agent_zero', 'gateway', 'paperclip'],
      agent_zero_can_see_paperclip_status: true,
      policy_result: 'requires_session',
      policy: {
        allowed: false,
        gateway_required: true,
        direct_paperclip_access_allowed: false,
        bridge_session_required: true,
        external_write_executed: false,
        blocked_reason: 'active_bridge_session_required_for_paperclip_task_create',
      },
      assignment: {
        target: 'hermes',
        target_role: 'lieutenant_skill_workflow_builder',
        agent_zero_reviews_completion: true,
        paperclip_tracks_status: true,
      },
      task_issue: {
        paperclip_issue_recorded: false,
        issue_id: null,
        status: 'not_created',
      },
      status_tracking: {
        status: 'blocked',
        status_source: 'gateway_policy',
        completion_reviewed_by_agent_zero: false,
      },
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(hermes.gateway_handoff_log.map((entry) => entry.event)).toEqual([
      'agent_zero_requested_paperclip_task',
      'gateway_policy_checked_paperclip_task',
      'paperclip_issue_record_blocked_until_session_and_adapter',
      'agent_zero_completion_review_required',
    ])
    expect(hermes.gateway_handoff_log.every((entry) => !entry.external_write && entry.no_secrets_exposed && !entry.raw_paths_exposed)).toBe(true)
    expectOwnerSafe(hermes)
  })

  it('supports safe assignment targets for SpaceAgent, Pi review, and mini-agent requests', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok' })
      if (url.endsWith('/api/companies')) return jsonResponse([{ id: 'company-1', name: 'To Knowledge Gateway' }])
      if (url.endsWith('/api/companies/company-1/agents')) return jsonResponse({ agents: [] })
      if (url.endsWith('/api/companies/company-1/issues')) return jsonResponse({ issues: [] })
      return jsonResponse({ error: 'not found' }, 404)
    })

    const spaceAgent = await buildPaperclipGatewayTaskPayload({ generatedAt: GENERATED_AT, fetchImpl, requester: 'agent_zero', assignee: 'space-agent', title: 'Research public website' })
    const pi = await buildPaperclipGatewayTaskPayload({ generatedAt: GENERATED_AT, fetchImpl, requester: 'agent_zero', assignee: 'pi', title: 'Review route selection' })
    const miniAgent = await buildPaperclipGatewayTaskPayload({ generatedAt: GENERATED_AT, fetchImpl, requester: 'agent_zero', assignee: 'co-worker', title: 'Create scoped co-worker proposal' })

    expect(spaceAgent.assignment).toMatchObject({ target: 'space_agent', target_role: 'browser_web_youtube_firecrawl_research_specialist' })
    expect(pi.assignment).toMatchObject({ target: 'pi_review', target_role: 'dispatcher_candidate_route_optimizer_review' })
    expect(miniAgent.assignment).toMatchObject({ target: 'mini_agent', target_role: 'scoped_subordinate_worker_or_co_worker_proposal' })
    expect([spaceAgent, pi, miniAgent].every((payload) => payload.task_issue.paperclip_issue_recorded === false && payload.writes_enabled === false)).toBe(true)
  })

  it('blocks non-Agent Zero Paperclip task creation and sanitizes owner-visible text', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 'ok' }))
    const payload = await buildPaperclipGatewayTaskPayload({
      generatedAt: GENERATED_AT,
      fetchImpl,
      requester: 'hermes',
      assignee: 'hermes',
      title: 'Use API_KEY=sample-redacted-input from /Users/example/private',
    })

    expect(payload).toMatchObject({
      requester: 'blocked',
      policy_result: 'requires_session',
      policy: { blocked_reason: 'paperclip_tasks_must_be_requested_by_agent_zero_through_gateway' },
      task_issue: { title: 'Use [redacted-secret] from [redacted-path]' },
      execution_enabled: false,
      writes_enabled: false,
    })
    expectOwnerSafe(payload)
  })

  it('keeps test-task safely blocked until a no-write Paperclip adapter exists', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 'ok' }))
    const payload = await buildPaperclipTestTaskPayload({
      generatedAt: GENERATED_AT,
      fetchImpl,
      message: 'Create a task with API_KEY=sample-redacted-input and /Users/example/private',
    })

    expect(payload).toMatchObject({
      mode: 'paperclip_read_only_test_task',
      paperclip_called: false,
      paperclip_reachable: true,
      blocker: 'paperclip_safe_test_task_adapter_not_configured',
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(payload.prompt).toContain('[redacted-secret]')
    expect(payload.prompt).toContain('[redacted-path]')
    expectOwnerSafe(payload)
  })
})
