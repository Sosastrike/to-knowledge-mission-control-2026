import { describe, expect, it, vi } from 'vitest'
import {
  buildPaperclipBoardApprovalPlan,
  buildPaperclipCredentialModePlan,
  buildPaperclipGatewayPluginPlan,
  buildPaperclipGatewayRecordMapping,
  buildPaperclipGatewayTaskPayload,
  buildPaperclipGatewayWorkforceFlowPayload,
  buildPaperclipHermesProposalPayload,
  buildPaperclipPiDispatcherRecommendationPayload,
  buildPaperclipSandboxHeartbeatPlan,
  buildPaperclipTokenGovernorPlan,
  buildPaperclipUiAccessVerificationPlan,
  buildPaperclipWorkspaceMapPlan,
  PAPERCLIP_BOARD_APPROVAL_ACTIONS,
  PAPERCLIP_CREDENTIAL_SUBJECTS,
  PAPERCLIP_GATEWAY_PLUGIN_IDS,
  PAPERCLIP_COWORKER_LIFECYCLE_STATES,
  PAPERCLIP_WORKSPACE_IDS,
  PAPERCLIP_GATEWAY_RECORD_MAPPINGS,
  PAPERCLIP_SANDBOX_HEARTBEAT_ROUTINES,
  createPaperclipCoWorkerAgentDefinition,
  transitionPaperclipCoWorkerLifecycle,
  validatePaperclipCoWorkerGatewayPolicy,
  buildPaperclipSpaceAgentResearchTaskPayload,
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

  it('falls back to Mission Control tailnet host when loopback is unreachable', async () => {
    const priorPublicUrl = process.env.MC_PUBLIC_BASE_URL
    delete process.env.PAPERCLIP_API_URL
    delete process.env.PAPERCLIP_BASE_URL
    process.env.MC_PUBLIC_BASE_URL = 'http://100.116.35.95:3337'

    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.startsWith('http://127.0.0.1:3100/')) throw new Error('connection refused')
      if (url.startsWith('http://100.116.35.95:3100/')) return jsonResponse({ status: 'ok', version: '0.0.0' })
      return jsonResponse({ error: 'not found' }, 404)
    })

    try {
      const payload = await buildPaperclipStatusPayload({ generatedAt: GENERATED_AT, fetchImpl })
      expect(payload).toMatchObject({
        health: 'degraded',
        reachable: true,
        configured: true,
        endpoint: 'tailnet:3100',
        ui_link: 'http://100.116.35.95:3100',
      })
      expect(fetchImpl).toHaveBeenCalled()
      expectOwnerSafe(payload)
    } finally {
      if (typeof priorPublicUrl === 'string') process.env.MC_PUBLIC_BASE_URL = priorPublicUrl
      else delete process.env.MC_PUBLIC_BASE_URL
    }
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
    expect(agents.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'space_agent',
        name: 'SpaceAgent',
        role: 'browser_web_youtube_firecrawl_research_specialist',
        reports_to: 'agent_zero',
        gateway_role: 'space_agent_research_specialist',
        owner_visible_status: 'read_only_paperclip_virtual_agent',
        bridge_session_required_for_execution: true,
      }),
    ]))
    expect(issues.items[0]).toMatchObject({
      id: 'issue-1',
      identifier: 'TKG-1',
      title: 'Prepare workforce summary [redacted-path]',
      assignee_agent: 'assigned',
    })
    expectOwnerSafe({ status, companies, agents, issues })
  })

  it('defines a Paperclip CoWorkerAgent with supervisor, budget, TTL, tools, expiration, and audit trail', () => {
    const result = createPaperclipCoWorkerAgentDefinition({
      id: 'research-helper',
      name: 'Research Helper',
      supervisor: 'hermes',
      purpose: 'Summarize Paperclip workforce planning evidence for Agent Zero.',
      taskScope: ['read-only registry discovery', 'return concise work product to Agent Zero'],
      budgetMaxCents: 2500,
      memoryTtlMinutes: 90,
      allowedTools: ['gateway.getSystems', 'gateway.getSources'],
      forbiddenTools: ['email_send'],
      expirationCondition: 'Expire after the assigned research planning task or TTL.',
      generatedAt: GENERATED_AT,
    })

    expect(result).toMatchObject({
      ok: true,
      mode: 'paperclip_coworker_definition_dry_run',
      policy_result: 'requires_session',
      blocked_reason: 'paperclip_coworker_activation_requires_bridge_session_and_runtime_adapter',
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expect(result.definition).toMatchObject({
      schema: 'paperclip_coworker_agent_v1',
      mode: 'paperclip_coworker_definition_dry_run',
      id: 'paperclip_coworker_research_helper',
      name: 'Research Helper',
      supervisor: 'hermes',
      command_authority: 'agent_zero',
      purpose: 'Summarize Paperclip workforce planning evidence for Agent Zero.',
      task_scope: ['read-only registry discovery', 'return concise work product to Agent Zero'],
      budget: {
        mode: 'advisory_budget_only',
        currency: 'USD',
        max_cents: 2500,
        spent_cents: 0,
        spending_authority: false,
        budget_enforced_by: 'gateway_policy_and_paperclip_tracking',
      },
      memory_ttl_minutes: 90,
      created_at: GENERATED_AT,
      allowed_tools: ['gateway.getSystems', 'gateway.getSources'],
      forbidden_tools: expect.arrayContaining(['email_send', 'direct_secret_read', 'raw_root_shell', 'docker_socket']),
      expiration_condition: 'Expire after the assigned research planning task or TTL.',
      audit_trail_required: true,
      lifecycle: 'proposed',
      bridge_session_required_for_activation: true,
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
      external_writes_enabled: false,
      direct_secret_access_allowed: false,
      raw_root_shell_allowed: false,
      docker_socket_allowed: false,
      can_self_promote: false,
      can_create_child_agents: false,
    })
    expect(result.definition?.expires_at).toBe('2026-05-06T01:30:00.000Z')
    expect(result.definition?.audit_trail).toEqual([
      expect.objectContaining({
        event: 'paperclip.coworker.definition.created',
        actor: 'hermes',
        target: 'paperclip_coworker_research_helper',
        external_write: false,
        no_secrets_exposed: true,
        raw_paths_exposed: false,
      }),
    ])
    expectOwnerSafe(result)
  })

  it('tracks every Paperclip CoWorkerAgent lifecycle state without enabling execution', () => {
    const base = createPaperclipCoWorkerAgentDefinition({
      id: 'qa-helper',
      name: 'QA Helper',
      supervisor: 'agent_zero',
      purpose: 'Review scoped work products for Agent Zero.',
      taskScope: ['read-only QA review'],
      budgetMaxCents: 1000,
      memoryTtlMinutes: 60,
      allowedTools: ['gateway.getSystems'],
      expirationCondition: 'Expire after review or TTL.',
      generatedAt: GENERATED_AT,
    }).definition!

    expect(PAPERCLIP_COWORKER_LIFECYCLE_STATES).toEqual([
      'proposed',
      'awaiting_approval',
      'approved',
      'running',
      'blocked',
      'completed',
      'failed',
      'expired',
      'archived',
      'reviewed_by_agent_zero',
    ])

    const transitioned = PAPERCLIP_COWORKER_LIFECYCLE_STATES.reduce((definition, lifecycle, index) => {
      const result = transitionPaperclipCoWorkerLifecycle({
        definition,
        lifecycle,
        actor: lifecycle === 'reviewed_by_agent_zero' ? 'agent_zero' : 'gateway',
        summary: `Lifecycle ${lifecycle} recorded.`,
        recordedAt: `2026-05-06T00:${String(index + 1).padStart(2, '0')}:00.000Z`,
      })

      expect(result).toMatchObject({
        ok: true,
        mode: 'paperclip_coworker_lifecycle_transition_dry_run',
        lifecycle,
        execution_enabled: false,
        writes_enabled: false,
        protected_actions_enabled: false,
        no_secrets_exposed: true,
        raw_paths_exposed: false,
      })
      expect(result.definition).toMatchObject({
        lifecycle,
        execution_enabled: false,
        write_enabled: false,
        external_writes_enabled: false,
      })
      expect(result.definition?.audit_trail.at(-1)).toMatchObject({
        event: `paperclip.coworker.lifecycle.${lifecycle}`,
        external_write: false,
        no_secrets_exposed: true,
        raw_paths_exposed: false,
      })
      return result.definition!
    }, base)

    expect(transitioned.lifecycle).toBe('reviewed_by_agent_zero')
    expect(transitioned.audit_trail).toHaveLength(PAPERCLIP_COWORKER_LIFECYCLE_STATES.length + 1)
    expectOwnerSafe({ transitioned, execution_enabled: false, writes_enabled: false })
  })

  it('allows read-only Paperclip CoWorkerAgent routes only when every Gateway policy check passes', () => {
    const definition = createPaperclipCoWorkerAgentDefinition({
      name: 'Registry Reader',
      supervisor: 'agent_zero',
      purpose: 'Read Gateway registry state for Agent Zero.',
      taskScope: ['read-only registry discovery'],
      allowedTools: ['gateway.getSystems'],
      memoryTtlMinutes: 30,
      expirationCondition: 'Expire after registry review.',
      generatedAt: GENERATED_AT,
    }).definition!

    const decision = validatePaperclipCoWorkerGatewayPolicy({
      definition,
      requestedAction: 'read',
      credentialMode: 'none_required',
      requestedScope: ['read-only registry discovery'],
      requestedTools: ['gateway.getSystems'],
      memoryTtlMinutes: 30,
      auditRequired: true,
      outputContract: 'Return a concise owner-visible summary with blockers and no hidden state.',
      recordedAt: GENERATED_AT,
    })

    expect(decision).toMatchObject({
      ok: true,
      mode: 'paperclip_coworker_gateway_policy_decision',
      definition_id: 'paperclip_coworker_registryreader',
      requested_action: 'read',
      credential_mode: 'none_required',
      route_decision: 'allowed',
      blocked_reason: null,
      bridge_session_required: false,
      owner_approval_required: false,
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expect(decision.checks.map((check) => [check.check, check.passed, check.decision])).toEqual([
      ['request_type', true, 'allowed'],
      ['credential_mode', true, 'allowed'],
      ['bridge_session', true, 'allowed'],
      ['owner_approval', true, 'allowed'],
      ['mini_agent_scope', true, 'allowed'],
      ['forbidden_tools', true, 'allowed'],
      ['memory_policy', true, 'allowed'],
      ['audit_requirement', true, 'allowed'],
      ['output_contract', true, 'allowed'],
    ])
    expect(decision.audit_event).toMatchObject({
      event: 'paperclip.coworker.policy.decision',
      actor: 'gateway',
      target: 'paperclip_coworker_registryreader',
      external_write: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expectOwnerSafe(decision)
  })

  it('blocks Paperclip CoWorkerAgent routes when Gateway policy checks fail', () => {
    const definition = createPaperclipCoWorkerAgentDefinition({
      name: 'Scoped Worker',
      supervisor: 'hermes',
      purpose: 'Perform scoped planning work for Agent Zero.',
      taskScope: ['read-only planning'],
      allowedTools: ['gateway.getTools'],
      memoryTtlMinutes: 30,
      expirationCondition: 'Expire after planning review.',
      generatedAt: GENERATED_AT,
    }).definition!
    const baseInput = {
      definition,
      requestedAction: 'read',
      credentialMode: 'none_required',
      requestedScope: ['read-only planning'],
      requestedTools: ['gateway.getTools'],
      memoryTtlMinutes: 30,
      auditRequired: true,
      outputContract: 'Return concise findings and blockers only.',
      recordedAt: GENERATED_AT,
    }

    const missingCredential = validatePaperclipCoWorkerGatewayPolicy({ ...baseInput, credentialMode: 'missing' })
    const missingSession = validatePaperclipCoWorkerGatewayPolicy({ ...baseInput, requestedAction: 'execute', bridgeSessionActive: false, ownerApproved: false })
    const outOfScope = validatePaperclipCoWorkerGatewayPolicy({ ...baseInput, requestedScope: ['write production issue'] })
    const forbiddenTool = validatePaperclipCoWorkerGatewayPolicy({ ...baseInput, requestedTools: ['raw_root_shell'] })
    const memoryExceeded = validatePaperclipCoWorkerGatewayPolicy({ ...baseInput, memoryTtlMinutes: 90 })
    const auditDisabled = validatePaperclipCoWorkerGatewayPolicy({ ...baseInput, auditRequired: false })
    const unsafeOutput = validatePaperclipCoWorkerGatewayPolicy({ ...baseInput, outputContract: 'Return task id and internal stage details.' })

    expect(missingCredential).toMatchObject({ ok: false, route_decision: 'missing_credential', blocked_reason: 'paperclip_coworker_missing_required_credential' })
    expect(missingSession).toMatchObject({ ok: false, route_decision: 'requires_session', blocked_reason: 'paperclip_coworker_bridge_session_required' })
    expect(outOfScope).toMatchObject({ ok: false, route_decision: 'blocked', blocked_reason: 'paperclip_coworker_scope_not_allowed' })
    expect(forbiddenTool).toMatchObject({ ok: false, route_decision: 'blocked', blocked_reason: 'paperclip_coworker_forbidden_tool_requested' })
    expect(memoryExceeded).toMatchObject({ ok: false, route_decision: 'blocked', blocked_reason: 'paperclip_coworker_memory_ttl_exceeds_policy' })
    expect(auditDisabled).toMatchObject({ ok: false, route_decision: 'blocked', blocked_reason: 'paperclip_coworker_audit_required' })
    expect(unsafeOutput).toMatchObject({ ok: false, route_decision: 'blocked', blocked_reason: 'paperclip_coworker_output_contract_required' })
    expect(missingSession.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ check: 'bridge_session', passed: false, decision: 'requires_session' }),
      expect.objectContaining({ check: 'owner_approval', passed: false, decision: 'requires_session' }),
    ]))
    expectOwnerSafe({ missingCredential, missingSession, outOfScope, forbiddenTool, memoryExceeded, auditDisabled, unsafeOutput })
  })

  it('blocks invalid lifecycle transitions and non-Agent Zero review claims', () => {
    const definition = createPaperclipCoWorkerAgentDefinition({
      name: 'Route Reviewer',
      supervisor: 'pi',
      purpose: 'Review route plans.',
      taskScope: ['read-only route review'],
      expirationCondition: 'Expire after route review.',
      generatedAt: GENERATED_AT,
    }).definition!

    const invalid = transitionPaperclipCoWorkerLifecycle({
      definition,
      lifecycle: 'self_promoted',
      actor: 'gateway',
      recordedAt: GENERATED_AT,
    })
    const wrongReviewer = transitionPaperclipCoWorkerLifecycle({
      definition,
      lifecycle: 'reviewed_by_agent_zero',
      actor: 'hermes',
      recordedAt: GENERATED_AT,
    })

    expect(invalid).toMatchObject({ ok: false, policy_result: 'blocked', blocked_reason: 'paperclip_coworker_lifecycle_unknown' })
    expect(wrongReviewer).toMatchObject({ ok: false, policy_result: 'blocked', blocked_reason: 'paperclip_coworker_review_requires_agent_zero' })
    expectOwnerSafe(invalid)
    expectOwnerSafe(wrongReviewer)
  })

  it('blocks Paperclip CoWorkerAgent definitions that miss required fields or request forbidden tools', () => {
    const missingPurpose = createPaperclipCoWorkerAgentDefinition({
      supervisor: 'agent_zero',
      taskScope: ['read-only task'],
      budgetMaxCents: 0,
      expirationCondition: 'Expire on completion.',
      generatedAt: GENERATED_AT,
    })
    const missingScope = createPaperclipCoWorkerAgentDefinition({
      supervisor: 'agent_zero',
      purpose: 'Plan safely.',
      budgetMaxCents: 0,
      expirationCondition: 'Expire on completion.',
      generatedAt: GENERATED_AT,
    })
    const forbiddenTool = createPaperclipCoWorkerAgentDefinition({
      supervisor: 'pi',
      purpose: 'Route a scoped task.',
      taskScope: ['read-only route review'],
      budgetMaxCents: 0,
      allowedTools: ['docker_socket'],
      expirationCondition: 'Expire on completion.',
      generatedAt: GENERATED_AT,
    })

    expect(missingPurpose).toMatchObject({ ok: false, policy_result: 'blocked', blocked_reason: 'paperclip_coworker_purpose_required' })
    expect(missingScope).toMatchObject({ ok: false, policy_result: 'blocked', blocked_reason: 'paperclip_coworker_task_scope_required' })
    expect(forbiddenTool).toMatchObject({ ok: false, policy_result: 'blocked', blocked_reason: 'paperclip_coworker_allowed_tool_forbidden' })
    expectOwnerSafe(missingPurpose)
    expectOwnerSafe(missingScope)
    expectOwnerSafe(forbiddenTool)
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

  it('runs the Paperclip workforce flow contract from owner request to Agent Zero report without writes', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok' })
      if (url.endsWith('/api/companies')) return jsonResponse([{ id: 'company-1', name: 'To Knowledge Gateway' }])
      if (url.endsWith('/api/companies/company-1/agents')) return jsonResponse({ agents: [] })
      if (url.endsWith('/api/companies/company-1/issues')) return jsonResponse({ issues: [] })
      return jsonResponse({ error: 'not found' }, 404)
    })

    const payload = await buildPaperclipGatewayWorkforceFlowPayload({
      generatedAt: GENERATED_AT,
      fetchImpl,
      ownerRequest: 'Create a workforce task for Hermes to design an email triage skill.',
      assignee: 'hermes',
      workerResult: 'Hermes returned a read-only workflow plan for Agent Zero review.',
    })

    expect(payload).toMatchObject({
      mode: 'paperclip_gateway_workforce_flow_dry_run',
      selected_route: ['owner', 'gateway', 'pi', 'agent_zero', 'paperclip', 'worker', 'gateway', 'agent_zero', 'owner'],
      endpoints: {
        paperclip_status: '/api/bridge/paperclip/status',
        paperclip_tasks: '/api/bridge/paperclip/tasks',
        paperclip_workforce_flow: '/api/bridge/paperclip/workforce-flow',
        paperclip_issues: '/api/bridge/paperclip/issues',
      },
      pi_route_recommendation: {
        requester: 'pi',
        advisory_contract: {
          shadow_mode: true,
          pi_can_execute: false,
          agent_zero_final_decision_required: true,
        },
      },
      agent_zero_approval: {
        commander: 'agent_zero',
        mission_approved_for_planning: true,
        mission_approved_for_execution: false,
        final_decision_authority: true,
      },
      paperclip_issue_task: {
        paperclip_creates_issue: true,
        issue_created: false,
        issue_id: null,
        status: 'not_created',
      },
      worker_assignment: {
        paperclip_assigns_worker: true,
        assigned: false,
        worker: 'hermes',
        worker_role: 'lieutenant_skill_workflow_builder',
      },
      worker_execution: {
        worker_performs_task: true,
        execution_mode: 'supplied_read_only_result',
        result_summary: 'Hermes returned a read-only workflow plan for Agent Zero review.',
        external_write: false,
        execution_enabled: false,
        writes_enabled: false,
      },
      work_product: {
        paperclip_records_work_product: true,
        work_product_recorded: false,
        work_product_id: null,
      },
      gateway_validation: {
        gateway_validates_result: true,
        valid: true,
        decision: 'accepted_for_agent_zero_report',
        blocked_reason: null,
      },
      agent_zero_owner_report: {
        agent_zero_reports_to_owner: true,
        no_fake_done: true,
      },
      audit: {
        gateway_audit_stored: true,
        paperclip_audit_stored: false,
      },
      policy_result: 'requires_session',
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expect(payload.phases.map((phase) => phase.phase)).toEqual([271, 272, 273, 274, 275, 276, 277, 278, 279, 280])
    expect(payload.phases.find((phase) => phase.phase === 280)).toMatchObject({
      status: 'blocked',
      blocked_reason: 'active_bridge_session_required_for_paperclip_task_create',
    })
    expect(payload.audit.gateway_audit_log.map((entry) => entry.event)).toEqual([
      'owner_request_entered_gateway',
      'pi_recommended_route',
      'agent_zero_approved_planning_mission',
      'gateway_validated_worker_result',
      'agent_zero_owner_report_prepared',
    ])
    expect(payload.audit.paperclip_audit_log.map((entry) => entry.status)).toEqual(['blocked', 'blocked', 'blocked', 'blocked'])
    expect(payload.audit.gateway_audit_log.every((entry) => !entry.external_write && entry.no_secrets_exposed && !entry.raw_paths_exposed)).toBe(true)
    expect(payload.audit.paperclip_audit_log.every((entry) => !entry.external_write && entry.no_secrets_exposed && !entry.raw_paths_exposed)).toBe(true)
    expectOwnerSafe(payload)
  })

  it('redacts secret-like values and local paths from Paperclip workforce flow text', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok' })
      if (url.endsWith('/api/companies')) return jsonResponse([{ id: 'company-1', name: 'To Knowledge Gateway' }])
      if (url.endsWith('/api/companies/company-1/agents')) return jsonResponse({ agents: [] })
      if (url.endsWith('/api/companies/company-1/issues')) return jsonResponse({ issues: [] })
      return jsonResponse({ error: 'not found' }, 404)
    })

    const payload = await buildPaperclipGatewayWorkforceFlowPayload({
      generatedAt: GENERATED_AT,
      fetchImpl,
      ownerRequest: 'Create a task with API_KEY=sample-redacted-input from /Users/example/private.',
      assignee: 'hermes',
      workerResult: 'Worker reviewed /Users/example/private and ignored API_KEY=sample-redacted-input.',
    })

    expect(payload.owner_request).toBe('Create a task with [redacted-secret] from [redacted-path]')
    expect(payload.worker_execution.result_summary).toBe('Worker reviewed [redacted-path] and ignored [redacted-secret]')
    expect(JSON.stringify(payload)).not.toMatch(/sample-redacted-input|\/Users\/example\/private/)
    expect(payload.execution_enabled).toBe(false)
    expect(payload.writes_enabled).toBe(false)
    expectOwnerSafe(payload)
  })

  it('keeps the Paperclip workforce flow blocked when no worker result exists', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok' })
      if (url.endsWith('/api/companies')) return jsonResponse([{ id: 'company-1', name: 'To Knowledge Gateway' }])
      if (url.endsWith('/api/companies/company-1/agents')) return jsonResponse({ agents: [] })
      if (url.endsWith('/api/companies/company-1/issues')) return jsonResponse({ issues: [] })
      return jsonResponse({ error: 'not found' }, 404)
    })

    const payload = await buildPaperclipGatewayWorkforceFlowPayload({
      generatedAt: GENERATED_AT,
      fetchImpl,
      ownerRequest: 'Route this owner mission through Paperclip.',
    })

    expect(payload.worker_execution).toMatchObject({
      worker_performs_task: false,
      execution_mode: 'not_executed',
      result_summary: null,
      blocked_reason: 'worker_result_required_before_gateway_validation_can_accept_completion',
    })
    expect(payload.gateway_validation).toMatchObject({
      valid: false,
      decision: 'blocked_pending_worker_result',
      blocked_reason: 'worker_result_required_before_gateway_validation_can_accept_completion',
    })
    expect(payload.blocked_reason).toBe('worker_result_required_before_gateway_validation_can_accept_completion')
    expect(payload.agent_zero_owner_report.owner_visible_summary).toContain('no worker result was provided')
    expectOwnerSafe(payload)
  })

  it('routes SpaceAgent research tasks through Paperclip and returns a validated Research Packet', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok' })
      if (url.endsWith('/api/companies')) return jsonResponse([{ id: 'company-1', name: 'To Knowledge Gateway' }])
      if (url.endsWith('/api/companies/company-1/agents')) return jsonResponse({ agents: [] })
      if (url.endsWith('/api/companies/company-1/issues')) return jsonResponse({ issues: [] })
      return jsonResponse({ error: 'not found' }, 404)
    })

    const payload = await buildPaperclipSpaceAgentResearchTaskPayload({
      generatedAt: GENERATED_AT,
      fetchImpl,
      requester: 'agent_zero',
      taskType: 'web_research',
      request: 'Read a public product page and summarize the evidence for Agent Zero.',
      responsibleAgent: 'agent_zero',
      evidence: [{ summary: 'The source describes a public product capability.', url: 'https://example.com/product' }],
      webSources: [{ url: 'https://example.com/product', title: 'Public Product Page', status: 'success' }],
    })

    expect(payload).toMatchObject({
      mode: 'paperclip_space_agent_research_task_handoff',
      requester: 'agent_zero',
      task_type: 'web_research',
      selected_route: ['agent_zero', 'gateway', 'paperclip', 'space_agent'],
      return_route: ['space_agent', 'gateway', 'agent_zero'],
      paperclip_agent: {
        id: 'space_agent',
        name: 'SpaceAgent',
        appears_as_paperclip_agent: true,
        role: 'browser_web_youtube_firecrawl_research_specialist',
        status: 'read_only_virtual_agent',
        supervisors: ['agent_zero', 'hermes', 'pi'],
        external_writes_enabled: false,
        bridge_session_required_for_execution: true,
      },
      task_assignment: {
        space_agent_can_receive_web_research_task: true,
        space_agent_can_receive_youtube_research_task: true,
        space_agent_can_receive_firecrawl_task: true,
        execution_enabled: false,
        writes_enabled: false,
      },
      paperclip_tracking: {
        paperclip_tracks_research_issue: true,
        paperclip_research_issue_recorded: false,
        issue_id: null,
        status: 'not_created',
        blocked_reason: 'active_bridge_session_and_paperclip_write_adapter_required_for_research_issue_and_work_product_storage',
      },
      work_product: {
        paperclip_stores_work_product: true,
        paperclip_work_product_recorded: false,
        work_product_id: null,
      },
      gateway_validation: {
        gateway_validates_evidence: true,
        decision: 'accepted',
        valid: true,
        evidence_count: 1,
        source_count: 2,
        citations_count: 1,
        blocked_reason: null,
      },
      agent_zero_next_step: {
        agent_zero_routes_next_step: true,
        decision: 'handoff_to_responsible_agent',
        next_agent: 'agent_zero',
        execution_enabled: false,
      },
      responsible_agent_completion: {
        responsible_agent_completes_final_task: true,
        responsible_agent: 'agent_zero',
        status: 'completed',
        external_write: false,
        execution_enabled: false,
        writes_enabled: false,
      },
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(payload.research_packet).toMatchObject({
      mode: 'space_agent_research_packet',
      research_stage_owner: 'space_agent',
      returns_to: 'agent_zero',
      evidence: [expect.objectContaining({ summary: 'The source describes a public product capability.' })],
      citations: ['https://example.com/product'],
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(payload.research_completion).toMatchObject({
      mode: 'gateway_space_agent_research_completion',
      status: 'answer_ready',
      space_agent_returned_research_packet: true,
      gateway_validated_evidence: true,
      agent_zero_decided_next_step: true,
      responsible_agent_executed_next_non_web_step: true,
      final_answer_cites_research_packet: true,
    })
    expect(payload.gateway_audit_log.map((entry) => entry.event)).toEqual([
      'space_agent_appears_as_paperclip_agent',
      'paperclip_research_issue_tracking_planned',
      'space_agent_research_packet_returned',
      'paperclip_work_product_storage_blocked_until_session_and_adapter',
      'gateway_validated_research_evidence',
      'agent_zero_routes_next_step',
      'responsible_agent_final_task_planned',
    ])
    expect(payload.gateway_audit_log.every((entry) => !entry.external_write && entry.no_secrets_exposed && !entry.raw_paths_exposed)).toBe(true)
    expectOwnerSafe(payload)
  })

  it('honestly pauses Paperclip SpaceAgent tasks that lack research evidence', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok' })
      if (url.endsWith('/api/companies')) return jsonResponse([{ id: 'company-1', name: 'To Knowledge Gateway' }])
      if (url.endsWith('/api/companies/company-1/agents')) return jsonResponse({ agents: [] })
      if (url.endsWith('/api/companies/company-1/issues')) return jsonResponse({ issues: [] })
      return jsonResponse({ error: 'not found' }, 404)
    })

    const payload = await buildPaperclipSpaceAgentResearchTaskPayload({
      generatedAt: GENERATED_AT,
      fetchImpl,
      requester: 'agent_zero',
      taskType: 'youtube_research',
      request: 'Inspect this YouTube video and summarize claims.',
      responsibleAgent: 'hermes',
    })

    expect(payload).toMatchObject({
      task_type: 'youtube_research',
      gateway_validation: {
        gateway_validates_evidence: true,
        decision: 'needs_more_research',
        valid: true,
        evidence_count: 0,
        source_count: 0,
        citations_count: 0,
        blocked_reason: 'Research packet is structurally safe but needs stronger evidence before downstream action.',
      },
      agent_zero_next_step: {
        agent_zero_routes_next_step: true,
        decision: 'request_more_research',
        next_agent: 'hermes',
      },
      responsible_agent_completion: {
        responsible_agent_completes_final_task: false,
        responsible_agent: 'hermes',
        status: 'needs_more_research',
      },
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(payload.gateway_audit_log.find((entry) => entry.event === 'space_agent_research_packet_returned')).toMatchObject({ status: 'needs_more_research' })
    expect(payload.response_text).toContain('research packet needs more evidence')
    expectOwnerSafe(payload)
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


  it('lets Hermes draft Paperclip workflow, mini-agent, routine, and skill proposals without storing work products', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok' })
      if (url.endsWith('/api/companies')) return jsonResponse([{ id: 'company-1', name: 'To Knowledge Gateway' }])
      if (url.endsWith('/api/companies/company-1/agents')) return jsonResponse({ agents: [] })
      if (url.endsWith('/api/companies/company-1/issues')) return jsonResponse({ issues: [] })
      return jsonResponse({ error: 'not found' }, 404)
    })

    const proposal = await buildPaperclipHermesProposalPayload({
      generatedAt: GENERATED_AT,
      fetchImpl,
      proposalKind: 'mini-agent',
      title: 'Email triage mini-agent spec with API_KEY=sample-redacted-input',
      objective: 'Draft a mini-agent that triages allowed-domain email for Agent Zero.',
      miniAgentScope: ['Read current registry', 'Return plan only'],
    })

    expect(proposal).toMatchObject({
      mode: 'paperclip_hermes_proposal_handoff',
      requester: 'hermes',
      selected_route: ['hermes', 'gateway', 'agent_zero', 'paperclip'],
      proposal_kind: 'mini_agent_spec',
      hermes_can_see_paperclip_registry: true,
      paperclip_proposals_endpoint: '/api/bridge/paperclip/proposals',
      design_authority: {
        can_design_workflow_task_template: true,
        can_propose_mini_agent_spec: true,
        can_draft_paperclip_routine: true,
        can_create_skill_proposal_document: true,
        can_activate_execution: false,
      },
      storage: {
        paperclip_issue_recorded: false,
        work_product_recorded: false,
        issue_id: null,
        work_product_id: null,
        blocked_reason: 'active_bridge_session_and_paperclip_write_adapter_required_for_issue_or_work_product_storage',
      },
      review: {
        agent_zero_review_required: true,
        owner_approval_required_if_protected_action: true,
        hermes_final_authority: false,
      },
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(proposal.proposal.mini_agent_spec.parent_supervisor).toBe('agent_zero')
    expect(proposal.proposal.mini_agent_spec.forbidden_tools).toEqual(expect.arrayContaining(['raw_shell', 'docker_socket', 'direct_secret_read']))
    expect(proposal.gateway_audit_log.map((entry) => entry.event)).toEqual([
      'hermes_read_paperclip_registry',
      'hermes_drafted_paperclip_proposal',
      'paperclip_issue_or_work_product_storage_blocked_until_session_and_adapter',
      'agent_zero_review_required',
    ])
    expect(proposal.gateway_audit_log.every((entry) => !entry.external_write && entry.no_secrets_exposed && !entry.raw_paths_exposed)).toBe(true)
    expectOwnerSafe(proposal)
  })

  it('lets Pi see Paperclip task queue and recommend advisory routes without execution', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok' })
      if (url.endsWith('/api/companies')) return jsonResponse([{ id: 'company-1', name: 'To Knowledge Gateway' }])
      if (url.endsWith('/api/companies/company-1/agents')) return jsonResponse({ agents: [] })
      if (url.endsWith('/api/companies/company-1/issues')) return jsonResponse({
        issues: [
          { id: 'issue-1', title: 'Design workflow template', status: 'todo' },
          { id: 'issue-2', title: 'Review model budget route', status: 'in_progress' },
        ],
      })
      return jsonResponse({ error: 'not found' }, 404)
    })

    const recommendation = await buildPaperclipPiDispatcherRecommendationPayload({
      generatedAt: GENERATED_AT,
      fetchImpl,
      ownerRequest: 'Recommend budget and model provider route for a small scoped mini-agent task.',
    })

    expect(recommendation).toMatchObject({
      mode: 'paperclip_pi_dispatcher_recommendation',
      requester: 'pi',
      selected_route: ['pi', 'gateway', 'agent_zero', 'paperclip'],
      task_queue_visible: true,
      paperclip_task_queue_endpoint: '/api/bridge/paperclip/issues',
      paperclip_dispatcher_recommendations_endpoint: '/api/bridge/paperclip/dispatcher-recommendations',
      queue_summary: {
        paperclip_reachable: true,
        active_issue_count: 2,
        blocker: null,
      },
      recommendation: {
        recommended_agent: 'pi_review',
        budget_route: 'low_cost_route_preferred_until_agent_zero_approves_escalation',
        model_provider_route: 'low_cost_model_route_recommended_after_gateway_policy_check',
        create_mini_agent: true,
        policy_result: 'requires_session',
        blocked_reason: 'active_bridge_session_and_paperclip_write_adapter_required_for_dispatcher_recommendation_storage',
      },
      advisory_contract: {
        shadow_mode: true,
        output_is_advisory_until_proven: true,
        pi_can_execute: false,
        gateway_policy_required: true,
        agent_zero_final_decision_required: true,
      },
      storage: {
        paperclip_recommendation_recorded: false,
        work_product_recorded: false,
      },
      final_decision: {
        agent_zero_makes_final_decision: true,
        gateway_logs_final_route_decision: true,
      },
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(recommendation.gateway_audit_log.map((entry) => entry.event)).toEqual([
      'pi_read_paperclip_task_queue',
      'pi_recommended_paperclip_task_route',
      'paperclip_dispatcher_recommendation_storage_blocked_until_session_and_adapter',
      'agent_zero_final_route_decision_required',
    ])
    expect(recommendation.gateway_audit_log.every((entry) => !entry.external_write && entry.no_secrets_exposed && !entry.raw_paths_exposed)).toBe(true)
    expectOwnerSafe(recommendation)
  })



  it("maps Gateway missions, commands, agent work, governance, reports, and blockers into Paperclip record targets without writes", () => {
    const expectedTargets = {
      gateway_mission_to_issue: ["paperclip_issue"],
      owner_command_to_issue: ["paperclip_issue"],
      mini_agent_task_to_issue: ["paperclip_issue"],
      space_agent_research_packet_to_work_product: ["paperclip_work_product"],
      hermes_skill_proposal_to_issue_work_product: ["paperclip_issue", "paperclip_work_product"],
      pi_recommendation_to_issue_comment: ["paperclip_issue_comment"],
      agent_zero_decision_to_issue_approval: ["paperclip_issue_approval"],
      bridge_session_to_governance_event: ["paperclip_governance_event"],
      completed_task_to_final_report: ["paperclip_final_report"],
      blocked_task_to_exact_blocker: ["paperclip_blocker"],
    } as const

    for (const kind of PAPERCLIP_GATEWAY_RECORD_MAPPINGS) {
      const record = buildPaperclipGatewayRecordMapping({
        kind,
        title: `Paperclip mapping for ${kind}`,
        sourceId: "gateway-flow-1",
        blocker: kind === "blocked_task_to_exact_blocker" ? "drive_upload_connector_missing" : null,
        generatedAt: GENERATED_AT,
      })

      expect(record).toMatchObject({
        ok: true,
        mode: "paperclip_gateway_record_mapping_dry_run",
        kind,
        targets: expectedTargets[kind],
        source_id: "gateway-flow-1",
        paperclip_write_recorded: false,
        paperclip_ids: [],
        policy_result: "requires_session",
        paperclip_storage_blocker: "active_bridge_session_and_paperclip_write_adapter_required_for_record_mapping_storage",
        requires_bridge_session: true,
        write_adapter_configured: false,
        external_write: false,
        execution_enabled: false,
        writes_enabled: false,
        protected_actions_enabled: false,
        no_secrets_exposed: true,
        raw_paths_exposed: false,
      })
      if (kind === "blocked_task_to_exact_blocker") {
        expect(record).toMatchObject({
          blocked_reason: "drive_upload_connector_missing",
          mapped_blocker: "drive_upload_connector_missing",
        })
      } else {
        expect(record).toMatchObject({
          blocked_reason: "active_bridge_session_and_paperclip_write_adapter_required_for_record_mapping_storage",
          mapped_blocker: null,
        })
      }
      expect(record.audit_log.every((entry) => !entry.external_write && entry.no_secrets_exposed && !entry.raw_paths_exposed)).toBe(true)
      expectOwnerSafe(record)
    }
  })

  it("blocks unknown Paperclip mapping kinds and blocked-task mappings without an exact blocker", () => {
    const unknown = buildPaperclipGatewayRecordMapping({
      kind: "owner-command-to-mystery",
      title: "Mystery mapping",
      generatedAt: GENERATED_AT,
    })
    const missingBlocker = buildPaperclipGatewayRecordMapping({
      kind: "blocked_task_to_exact_blocker",
      title: "Blocked task record",
      generatedAt: GENERATED_AT,
    })

    expect(unknown).toMatchObject({
      ok: false,
      mode: "paperclip_gateway_record_mapping_dry_run",
      kind: "unknown",
      targets: [],
      policy_result: "blocked",
      blocked_reason: "paperclip_gateway_record_mapping_kind_unknown",
      paperclip_write_recorded: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(missingBlocker).toMatchObject({
      ok: false,
      kind: "blocked_task_to_exact_blocker",
      targets: ["paperclip_blocker"],
      policy_result: "blocked",
      blocked_reason: "paperclip_task_blocked_exact_reason_required",
      mapped_blocker: "paperclip_task_blocked_exact_reason_required",
      paperclip_write_recorded: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    expectOwnerSafe({ unknown, missingBlocker })
  })

  it('defines Gateway adapter plugins for Agent Zero, Hermes, Pi, SpaceAgent, OpenClaw+', () => {
    const plan = buildPaperclipGatewayPluginPlan({
      generatedAt: GENERATED_AT,
      lifecycle: [
        { plugin: 'agent_zero_adapter', action: 'load' },
        { plugin: 'hermes_adapter', action: 'load' },
        { plugin: 'pi_adapter', action: 'load' },
        { plugin: 'space_agent_adapter', action: 'load' },
        { plugin: 'openclaw_runtime_adapter', action: 'load' },
        { plugin: 'openclaw_skills_adapter', action: 'load' },
        { plugin: 'mission_control_ui_contribution', action: 'load', safeUiContribution: true },
        { plugin: 'agent_zero_adapter', action: 'unload', loaded: true },
      ],
    })

    expect(plan).toMatchObject({
      ok: true,
      mode: 'paperclip_gateway_plugin_spec_dry_run',
      plugin_system_inspection: {
        loader: 'explicit_import_init_loader',
        registries: ['integrations', 'categories', 'nav_items', 'panels', 'tool_providers'],
        dynamic_env_loading_enabled: false,
        production_auto_load_enabled: false,
      },
      plugin_ids: [...PAPERCLIP_GATEWAY_PLUGIN_IDS],
      mission_control_ui_contribution: {
        safe_to_define: true,
        enabled: false,
      },
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expect(plan.plugins.map((plugin) => plugin.id)).toEqual([...PAPERCLIP_GATEWAY_PLUGIN_IDS])
    expect(plan.plugins).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'gateway_core', kind: 'gateway_spec', target_node: 'gateway' }),
      expect.objectContaining({ id: 'agent_zero_adapter', kind: 'agent_adapter', target_node: 'agent_zero', supervisor: 'gateway' }),
      expect.objectContaining({ id: 'hermes_adapter', kind: 'agent_adapter', target_node: 'hermes', supervisor: 'agent_zero' }),
      expect.objectContaining({ id: 'pi_adapter', kind: 'agent_adapter', target_node: 'pi_dispatcher_candidate' }),
      expect.objectContaining({ id: 'space_agent_adapter', kind: 'agent_adapter', target_node: 'space_agent' }),
      expect.objectContaining({ id: 'openclaw_runtime_adapter', kind: 'worker_adapter', target_node: 'openclaw_plus' }),
      expect.objectContaining({ id: 'openclaw_skills_adapter', kind: 'skills_adapter', target_node: 'openclaw_plus', supervisor: 'paperclip' }),
      expect.objectContaining({ id: 'mission_control_ui_contribution', kind: 'ui_contribution', registers: ['nav_item', 'panel'], ui_contribution_safe: true, ui_contribution_enabled: false }),
    ]))
    expect(plan.plugins.every((plugin) => plugin.load_mode === 'explicit_import_only' && plugin.production_auto_load_enabled === false && plugin.execution_enabled === false && plugin.writes_enabled === false)).toBe(true)
    expect(plan.lifecycle_decisions.map((decision) => decision.status)).toEqual(['loaded', 'loaded', 'loaded', 'loaded', 'loaded', 'loaded', 'loaded', 'unloaded'])
    expect(plan.lifecycle_decisions.every((decision) => decision.policy_result === 'requires_session' && decision.audit_event.no_secrets_exposed && !decision.audit_event.raw_paths_exposed)).toBe(true)
    expectOwnerSafe(plan)
  })

  it('blocks unsafe Gateway plugin load/unload requests', () => {
    const plan = buildPaperclipGatewayPluginPlan({
      generatedAt: GENERATED_AT,
      lifecycle: [
        { plugin: 'mission_control_ui_contribution', action: 'load', safeUiContribution: false },
        { plugin: 'unknown_plugin', action: 'load' },
        { plugin: 'hermes_adapter', action: 'unload', loaded: false },
      ],
    })

    expect(plan).toMatchObject({ ok: false, execution_enabled: false, writes_enabled: false })
    expect(plan.blocked.map((decision) => decision.blocked_reason)).toEqual([
      'paperclip_gateway_ui_contribution_requires_safe_smoke',
      'paperclip_gateway_plugin_unknown',
      'paperclip_gateway_plugin_not_loaded',
    ])
    expect(plan.lifecycle_decisions.every((decision) => decision.status === 'blocked' && decision.loaded_after === decision.loaded_before)).toBe(true)
    expectOwnerSafe(plan)
  })




  it('maps Mission Control, ClaudeClaw/OpenClaw+, SpaceAgent, Pi, and Paperclip workspaces with safe refs', () => {
    const plan = buildPaperclipWorkspaceMapPlan({
      generatedAt: GENERATED_AT,
      tasks: [
        {
          workspace: 'mission_control',
          action: 'code',
          taskTitle: 'Implement Gateway UI patch',
          workspaceRef: 'workspace_ref_mission_control',
          isolatedWorktreeRef: 'worktree_ref_gateway_ui_patch',
          paperclipIssueId: 'TKG-231',
          outputTitle: 'Gateway UI patch notes',
        },
        {
          workspace: 'space_agent',
          action: 'report',
          taskTitle: 'Store SpaceAgent research packet',
          workspaceRef: 'workspace_ref_space_agent',
          paperclipIssueId: 'TKG-233',
        },
      ],
    })

    expect(plan).toMatchObject({
      ok: true,
      mode: 'paperclip_workspace_map_dry_run',
      workspace_ids: [...PAPERCLIP_WORKSPACE_IDS],
      isolated_worktree_policy: {
        required_for_coding_tasks: true,
        create_from_correct_workspace_only: true,
        no_tasks_in_wrong_directory: true,
        raw_paths_owner_visible: false,
      },
      work_product_policy: {
        store_outputs_safely: true,
        protected_output_refs_only: true,
        attach_to_paperclip_issues: true,
        link_back_to_mission_control_gateway: true,
        paperclip_write_adapter_required: true,
        bridge_session_required_for_issue_writes: true,
      },
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expect(plan.workspaces.map((workspace) => workspace.id)).toEqual([
      'mission_control',
      'claudeclaw_openclaw',
      'space_agent',
      'pi',
      'paperclip',
    ])
    expect(plan.workspaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'mission_control', kind: 'gateway_control_plane', gateway_node_id: 'gateway_mission_control' }),
      expect.objectContaining({ id: 'claudeclaw_openclaw', kind: 'runtime_skills_layer', gateway_node_id: 'gateway_openclaw_runtime' }),
      expect.objectContaining({ id: 'space_agent', kind: 'research_specialist', gateway_node_id: 'space_agent' }),
      expect.objectContaining({ id: 'pi', kind: 'dispatcher_candidate', coding_tasks_allowed: false }),
      expect.objectContaining({ id: 'paperclip', kind: 'workforce_layer', gateway_node_id: 'paperclip' }),
    ]))
    expect(plan.workspaces.every((workspace) => workspace.raw_path_exposed === false && workspace.repository_ref.startsWith('repo_ref_') && workspace.workspace_ref.startsWith('workspace_ref_'))).toBe(true)
    expect(plan.task_decisions[0]).toMatchObject({
      workspace: 'mission_control',
      action: 'code',
      correct_workspace: true,
      isolated_worktree_created: true,
      isolated_worktree_ref: 'worktree_ref_gateway_ui_patch',
      safe_work_product_ref: 'paperclip_outputs_mission_control_gateway_ui_patch_notes',
      paperclip_issue_attachment_planned: true,
      paperclip_issue_attachment_recorded: false,
      mission_control_gateway_linked: true,
      mission_control_gateway_link_ref: 'gateway_link_gateway_mission_control_tkg-231',
      policy_result: 'requires_session',
      blocked_reason: null,
    })
    expect(plan.task_decisions[1]).toMatchObject({
      workspace: 'space_agent',
      action: 'report',
      isolated_worktree_created: false,
      safe_work_product_ref: 'paperclip_outputs_space_agent_store_spaceagent_research_packet',
      paperclip_issue_attachment_planned: true,
      mission_control_gateway_linked: true,
      policy_result: 'requires_session',
      blocked_reason: null,
    })
    expectOwnerSafe(plan)
  })

  it('blocks coding tasks in the wrong workspace or without isolated worktree refs', () => {
    const plan = buildPaperclipWorkspaceMapPlan({
      generatedAt: GENERATED_AT,
      tasks: [
        {
          workspace: 'mission_control',
          action: 'code',
          taskTitle: 'Wrong directory edit',
          workspaceRef: 'workspace_ref_space_agent',
          isolatedWorktreeRef: 'worktree_ref_wrong_workspace',
          paperclipIssueId: 'TKG-237',
        },
        {
          workspace: 'paperclip',
          action: 'code',
          taskTitle: 'Missing worktree edit',
          workspaceRef: 'workspace_ref_paperclip_lab',
          paperclipIssueId: 'TKG-236',
        },
        {
          workspace: 'pi',
          action: 'code',
          taskTitle: 'Pi direct coding task',
          workspaceRef: 'workspace_ref_pi_dispatcher',
          isolatedWorktreeRef: 'worktree_ref_pi_patch',
          paperclipIssueId: 'TKG-234',
        },
        {
          workspace: 'unknown_workspace',
          action: 'read',
          taskTitle: 'Unknown workspace task',
        },
      ],
    })

    expect(plan).toMatchObject({ ok: false, execution_enabled: false, writes_enabled: false })
    expect(plan.blocked.map((decision) => decision.blocked_reason)).toEqual([
      'paperclip_task_wrong_workspace_blocked',
      'paperclip_isolated_worktree_required_for_coding_task',
      'paperclip_workspace_coding_not_allowed',
      'paperclip_workspace_unknown',
    ])
    expect(plan.task_decisions.every((decision) => decision.execution_enabled === false && decision.writes_enabled === false && decision.external_write === false)).toBe(true)
    expectOwnerSafe(plan)
  })




  it('uses Paperclip secret refs and protected local auth in production/private strict secrets mode', () => {
    const plan = buildPaperclipCredentialModePlan({
      generatedAt: GENERATED_AT,
      deploymentMode: 'production',
      secretScanPassed: true,
      credentials: [
        {
          subject: 'chatgpt_codex_auth',
          authMethod: 'chatgpt_codex_oauth',
          mode: 'protected_local_auth_home',
          configured: true,
        },
        {
          subject: 'claude_anthropic_auth',
          authMethod: 'claude_code_oauth',
          mode: 'protected_secret_ref',
          secretRef: 'claude_code_oauth_subscription',
          configured: true,
        },
      ],
    })

    expect(plan).toMatchObject({
      ok: true,
      mode: 'paperclip_credential_modes_dry_run',
      deployment_mode: 'production',
      strict_secrets_mode_enabled: true,
      credential_subjects: [...PAPERCLIP_CREDENTIAL_SUBJECTS],
      credential_modes_documented: true,
      secret_scan: { tested: true, passed: true, blocked_reason: null },
      no_env_leakage: true,
      no_auth_file_leakage: true,
      owner_ui_policy: {
        show_secret_refs_only: true,
        show_secret_values: false,
        show_auth_file_paths: false,
        show_configured_booleans: true,
      },
      paperclip_policy: {
        inline_keys_allowed: false,
        secret_values_visible: false,
        production_private_strict_mode: true,
      },
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expect(plan.credentials).toEqual([
      expect.objectContaining({
        subject: 'chatgpt_codex_auth',
        auth_method: 'chatgpt_codex_oauth',
        credential_mode: 'protected_local_auth_home',
        configured: true,
        owner_visible_location: 'protected_local_auth_home',
        owner_ui_shows_secret_values: false,
        owner_ui_shows_auth_file_paths: false,
        paperclip_shows_secret_values: false,
        policy_result: 'requires_session',
        blocked_reason: null,
      }),
      expect.objectContaining({
        subject: 'claude_anthropic_auth',
        auth_method: 'claude_code_oauth',
        credential_mode: 'protected_secret_ref',
        configured: true,
        secret_ref: 'paperclip_secret_ref_claude_code_oauth_subscription',
        owner_visible_location: 'protected_secret_reference',
        api_billing_disabled: true,
        policy_result: 'requires_session',
        blocked_reason: null,
      }),
    ])
    expect(plan.credentials.every((credential) => credential.audit_log.every((entry) => !entry.external_write && entry.no_secrets_exposed && !entry.raw_paths_exposed))).toBe(true)
    expectOwnerSafe(plan)
  })

  it('blocks inline keys, env leakage, auth-file leakage, and failed staged secret scans', () => {
    const plan = buildPaperclipCredentialModePlan({
      generatedAt: GENERATED_AT,
      deploymentMode: 'private',
      secretScanPassed: false,
      credentials: [
        {
          subject: 'chatgpt_codex_auth',
          inlineValue: ['sk', 'live', 'paperclip-inline-secret-value'].join('-'),
          authFilePath: ['protected-auth-home', 'codex', 'auth' + '.json'].join('/'),
        },
        {
          subject: 'claude_anthropic_auth',
          mode: 'protected_secret_ref',
          env: { ANTHROPIC_API_KEY: ['sk', 'ant', 'paperclip-inline-secret-value'].join('-') },
        },
      ],
    })

    expect(plan).toMatchObject({
      ok: false,
      deployment_mode: 'private',
      strict_secrets_mode_enabled: true,
      secret_scan: {
        tested: true,
        passed: false,
        blocked_reason: 'paperclip_staged_secret_scan_failed',
      },
      no_env_leakage: false,
      no_auth_file_leakage: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(plan.blocked).toHaveLength(2)
    expect(plan.credentials[0]).toMatchObject({
      subject: 'chatgpt_codex_auth',
      credential_mode: 'inline_value_blocked',
      inline_key_blocked: true,
      auth_file_path_leakage_detected: true,
      owner_ui_shows_auth_file_paths: false,
      policy_result: 'missing_credential',
      blocked_reason: 'paperclip_inline_secret_value_blocked',
    })
    expect(plan.credentials[1]).toMatchObject({
      subject: 'claude_anthropic_auth',
      env_leakage_detected: true,
      owner_ui_shows_secret_values: false,
      paperclip_shows_secret_values: false,
      policy_result: 'missing_credential',
      blocked_reason: 'paperclip_env_secret_leakage_blocked',
    })
    expectOwnerSafe(plan)
  })




  it('requires board approval for co-worker hiring and protected external actions while logging Paperclip and Gateway results', () => {
    const plan = buildPaperclipBoardApprovalPlan({
      generatedAt: GENERATED_AT,
      approvals: PAPERCLIP_BOARD_APPROVAL_ACTIONS.map((action) => ({
        action,
        approvalState: 'approved',
        requestedBy: action === 'co_worker_hire' ? 'agent_zero' : 'owner_board',
        expiresAt: '2026-05-07T00:00:00.000Z',
      })),
    })

    expect(plan).toMatchObject({
      ok: true,
      mode: 'paperclip_board_approval_dry_run',
      required_actions: [...PAPERCLIP_BOARD_APPROVAL_ACTIONS],
      paperclip_results_logged: true,
      gateway_results_logged: true,
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expect(plan.decisions.map((decision) => decision.action)).toEqual([...PAPERCLIP_BOARD_APPROVAL_ACTIONS])
    expect(plan.decisions.every((decision) => decision.board_approval_required && decision.paperclip_result_logged && decision.gateway_result_logged)).toBe(true)
    expect(plan.decisions.every((decision) => decision.approval_result === 'approved' && decision.policy_result === 'requires_session')).toBe(true)
    expect(plan.decisions.every((decision) => decision.execution_allowed === false && decision.execution_enabled === false && decision.writes_enabled === false)).toBe(true)
    expect(plan.decisions.find((decision) => decision.action === 'drive_upload')).toMatchObject({ required_scope: 'google_drive.upload', external_write: true })
    expect(plan.decisions.find((decision) => decision.action === 'onedrive_upload')).toMatchObject({ required_scope: 'onedrive.upload', external_write: true })
    expect(plan.decisions.find((decision) => decision.action === 'agentmail_send')).toMatchObject({ required_scope: 'agentmail.send', external_write: true })
    expect(plan.decisions.find((decision) => decision.action === 'buildwiki_run_now')).toMatchObject({ required_scope: 'buildwiki.run_now', external_write: true })
    expect(plan.decisions.find((decision) => decision.action === 'zapier_write')).toMatchObject({ required_scope: 'zapier.write', external_write: true })
    expect(plan.decisions.find((decision) => decision.action === 'heygen_generation')).toMatchObject({ required_scope: 'heygen.generate', external_write: true })
    expect(plan.decisions.find((decision) => decision.action === 'smb_fork2')).toMatchObject({ required_scope: 'smb.fork2', external_write: true })
    expect(plan.decisions.find((decision) => decision.action === 'co_worker_hire')).toMatchObject({ required_scope: 'paperclip.coworker.hire', external_write: false })
    expect(plan.decisions.flatMap((decision) => decision.audit_log.map((entry) => entry.event))).toEqual(expect.arrayContaining([
      'paperclip_board_approval_result_logged',
      'gateway_board_approval_result_logged',
    ]))
    expectOwnerSafe(plan)
  })

  it('blocks denied, pending, unknown, and expired board approvals before execution', () => {
    const plan = buildPaperclipBoardApprovalPlan({
      generatedAt: GENERATED_AT,
      approvals: [
        { action: 'agentmail_send', approvalState: 'denied', expiresAt: '2026-05-07T00:00:00.000Z' },
        { action: 'zapier_write', approvalState: 'pending', expiresAt: '2026-05-07T00:00:00.000Z' },
        { action: 'mystery_action', approvalState: 'approved', expiresAt: '2026-05-07T00:00:00.000Z' },
        { action: 'buildwiki_run_now', approvalState: 'approved', expiresAt: '2026-05-05T00:00:00.000Z' },
      ],
    })

    expect(plan).toMatchObject({
      ok: false,
      blocked: expect.any(Array),
      expired: [expect.objectContaining({ action: 'buildwiki_run_now', approval_result: 'expired' })],
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(plan.blocked.map((decision) => decision.approval_result)).toEqual(['denied', 'pending', 'unknown_action', 'expired'])
    expect(plan.decisions.find((decision) => decision.action === 'agentmail_send')).toMatchObject({
      policy_result: 'blocked',
      blocked_reason: 'paperclip_board_approval_denied',
      execution_allowed: false,
    })
    expect(plan.decisions.find((decision) => decision.action === 'zapier_write')).toMatchObject({
      policy_result: 'blocked',
      blocked_reason: 'paperclip_board_approval_pending',
      execution_allowed: false,
    })
    expect(plan.decisions.find((decision) => decision.action === 'unknown')).toMatchObject({
      policy_result: 'blocked',
      blocked_reason: 'paperclip_board_approval_action_unknown',
      execution_allowed: false,
    })
    expect(plan.decisions.find((decision) => decision.action === 'buildwiki_run_now')).toMatchObject({
      expired: true,
      policy_result: 'blocked',
      blocked_reason: 'paperclip_board_approval_expired',
      execution_allowed: false,
    })
    expect(plan.decisions.every((decision) => decision.paperclip_result_logged && decision.gateway_result_logged)).toBe(true)
    expectOwnerSafe(plan)
  })

  it('imports Gateway Token Governor budgets into Paperclip across company, agent, project, goal, and model provider scopes', () => {
    const plan = buildPaperclipTokenGovernorPlan({
      generatedAt: GENERATED_AT,
      budgets: [
        { scope: 'company', id: 'to-knowledge-gateway', budgetCents: 10000, spentCents: 1000, projectedCents: 500 },
        { scope: 'agent', id: 'agent-zero', budgetCents: 10000, spentCents: 7300, projectedCents: 300 },
        { scope: 'project', id: 'gateway-buildout', budgetCents: 10000, spentCents: 8700, projectedCents: 400 },
        { scope: 'goal', id: 'hermes-live-proof', budgetCents: 10000, spentCents: 4000, projectedCents: 500 },
        { scope: 'model_provider', id: 'openrouter', budgetCents: 10000, spentCents: 3000, projectedCents: 200 },
      ],
    })

    expect(plan).toMatchObject({
      ok: false,
      mode: 'paperclip_token_governor_dry_run',
      concept: 'gateway_token_governor_for_paperclip',
      imported_into_paperclip: true,
      production_enforcement_enabled: false,
      budget_scopes: ['company', 'agent', 'project', 'goal', 'model_provider'],
      alert_threshold_percent: 75,
      default_hard_stop_percent: 90,
      blocked_reason: 'paperclip_token_governor_hard_stop_or_missing_budget',
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expect(plan.budgets.map((budget) => budget.scope)).toEqual(['company', 'agent', 'project', 'goal', 'model_provider'])
    expect(plan.budgets.find((budget) => budget.id === 'agent-zero')).toMatchObject({
      status: 'alert',
      decision: 'alert',
      usage_percent: 76,
      alert_at_75_percent: true,
      hard_stop_at_threshold: false,
    })
    expect(plan.budgets.find((budget) => budget.id === 'gateway-buildout')).toMatchObject({
      status: 'hard_stop',
      decision: 'hard_stop',
      usage_percent: 91,
      alert_at_75_percent: false,
      hard_stop_at_threshold: true,
      blocked_reason: 'paperclip_token_governor_hard_stop_threshold_reached',
    })
    expect(plan.alerts.map((budget) => budget.id)).toEqual(['agent-zero'])
    expect(plan.hard_stops.map((budget) => budget.id)).toEqual(['gateway-buildout'])
    expect(plan.cost_audit_events).toHaveLength(5)
    expect(plan.cost_audit_events.every((event) => event.event === 'paperclip.token_governor.cost_event' && !event.external_write && event.no_secrets_exposed && !event.raw_paths_exposed)).toBe(true)
    expectOwnerSafe(plan)
  })

  it('honors owner-defined hard-stop thresholds, pauses runaway agents, and blocks missing budgets', () => {
    const plan = buildPaperclipTokenGovernorPlan({
      generatedAt: GENERATED_AT,
      alertPercent: 75,
      hardStopPercent: 95,
      budgets: [
        { scope: 'agent', id: 'runaway-agent', budgetCents: 10000, spentCents: 2000, projectedCents: 100, runaway: true },
        { scope: 'agent', id: 'custom-threshold-agent', budgetCents: 10000, spentCents: 8000, projectedCents: 600, ownerHardStopPercent: 85 },
        { scope: 'model_provider', id: 'claude-oauth', spentCents: 1000, projectedCents: 250 },
      ],
    })

    expect(plan).toMatchObject({
      ok: false,
      default_hard_stop_percent: 95,
      blocked_reason: 'paperclip_token_governor_hard_stop_or_missing_budget',
      production_enforcement_enabled: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(plan.budgets.find((budget) => budget.id === 'runaway-agent')).toMatchObject({
      scope: 'agent',
      status: 'within_budget',
      decision: 'allowed',
      pause_runaway_agent: true,
      blocked_reason: 'paperclip_token_governor_runaway_agent_pause_required',
    })
    expect(plan.budgets.find((budget) => budget.id === 'custom-threshold-agent')).toMatchObject({
      status: 'hard_stop',
      decision: 'hard_stop',
      usage_percent: 86,
      hard_stop_threshold_percent: 85,
      hard_stop_at_threshold: true,
      pause_runaway_agent: true,
    })
    expect(plan.budgets.find((budget) => budget.id === 'claude-oauth')).toMatchObject({
      status: 'missing_budget',
      decision: 'missing_budget',
      budget_cents: null,
      usage_percent: null,
      blocked_reason: 'paperclip_token_governor_budget_missing',
    })
    expect(plan.paused_agents.map((budget) => budget.id)).toEqual(['runaway-agent', 'custom-threshold-agent'])
    expect(plan.hard_stops.map((budget) => budget.id)).toEqual(['custom-threshold-agent', 'claude-oauth'])
    expect(plan.cost_audit_events.map((event) => event.decision)).toEqual(['allowed', 'hard_stop', 'missing_budget'])
    expectOwnerSafe(plan)
  })

  it('creates sandbox-only daily Paperclip heartbeat routines without enabling execution', () => {
    const plan = buildPaperclipSandboxHeartbeatPlan({
      generatedAt: GENERATED_AT,
      sandbox: true,
      monthlyBudgetCents: 5000,
      projectedCostCents: 250,
    })

    expect(plan).toMatchObject({
      ok: true,
      mode: 'paperclip_sandbox_heartbeat_plan',
      sandbox_heartbeat_enabled: true,
      production_heartbeat_enabled: false,
      heartbeat_execution_enabled: false,
      budget_enforcement: {
        required_before_execution: true,
        monthly_budget_cents: 5000,
        projected_cost_cents: 250,
        status: 'within_budget',
        execution_blocked: false,
        blocked_reason: null,
      },
      duplicate_work_guard: {
        enabled: true,
        duplicate_work_detected: false,
        duplicates_blocked: [],
      },
      paused_agent_guard: {
        enabled: true,
        paused_agents: [],
        skipped_routines: [],
      },
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expect(plan.routines.map((routine) => routine.id)).toEqual([...PAPERCLIP_SANDBOX_HEARTBEAT_ROUTINES])
    expect(plan.routines.map((routine) => routine.status)).toEqual(PAPERCLIP_SANDBOX_HEARTBEAT_ROUTINES.map(() => 'sandbox_ready'))
    expect(plan.routines).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'daily_status', owner: 'gateway', production_enabled: false, budget_preflight_required: true }),
      expect.objectContaining({ id: 'daily_connector_health', owner: 'gateway', production_enabled: false, budget_preflight_required: true }),
      expect.objectContaining({ id: 'daily_hermes_skill_proposal', owner: 'hermes', production_enabled: false, budget_preflight_required: true }),
      expect.objectContaining({ id: 'daily_pi_dispatcher_optimization', owner: 'pi', production_enabled: false, budget_preflight_required: true }),
      expect.objectContaining({ id: 'daily_space_agent_research_queue', owner: 'space_agent', production_enabled: false, budget_preflight_required: true }),
      expect.objectContaining({ id: 'daily_agent_zero_report', owner: 'agent_zero', production_enabled: false, budget_preflight_required: true }),
    ]))
    expect(new Set(plan.duplicate_work_guard.duplicate_guard_keys).size).toBe(PAPERCLIP_SANDBOX_HEARTBEAT_ROUTINES.length)
    expect(plan.routines.every((routine) => routine.external_writes_enabled === false && routine.execution_enabled === false && routine.writes_enabled === false)).toBe(true)
    expectOwnerSafe(plan)
  })

  it('blocks Paperclip heartbeats outside sandbox, when budgets fail, when duplicates exist, and when agents are paused', () => {
    const nonSandbox = buildPaperclipSandboxHeartbeatPlan({
      generatedAt: GENERATED_AT,
      sandbox: false,
      monthlyBudgetCents: 5000,
      projectedCostCents: 250,
    })
    const missingBudget = buildPaperclipSandboxHeartbeatPlan({
      generatedAt: GENERATED_AT,
      sandbox: true,
    })
    const overBudget = buildPaperclipSandboxHeartbeatPlan({
      generatedAt: GENERATED_AT,
      sandbox: true,
      monthlyBudgetCents: 100,
      projectedCostCents: 250,
    })
    const duplicateAndPaused = buildPaperclipSandboxHeartbeatPlan({
      generatedAt: GENERATED_AT,
      sandbox: true,
      monthlyBudgetCents: 5000,
      projectedCostCents: 250,
      existingHeartbeatKeys: ['paperclip_heartbeat_daily_status_20260506'],
      pausedAgents: ['hermes', 'pi'],
    })

    expect(nonSandbox).toMatchObject({
      ok: false,
      sandbox_heartbeat_enabled: false,
      production_heartbeat_enabled: false,
      blocked_reason: 'paperclip_heartbeat_sandbox_only',
    })
    expect(nonSandbox.routines.every((routine) => routine.status === 'sandbox_only_blocked')).toBe(true)

    expect(missingBudget).toMatchObject({
      ok: false,
      budget_enforcement: {
        status: 'missing_budget',
        execution_blocked: true,
        blocked_reason: 'paperclip_heartbeat_budget_not_configured',
      },
      blocked_reason: 'paperclip_heartbeat_budget_not_configured',
    })
    expect(missingBudget.routines.every((routine) => routine.status === 'budget_blocked')).toBe(true)

    expect(overBudget).toMatchObject({
      ok: false,
      budget_enforcement: {
        status: 'over_budget',
        execution_blocked: true,
        blocked_reason: 'paperclip_heartbeat_budget_exceeded',
      },
      blocked_reason: 'paperclip_heartbeat_budget_exceeded',
    })
    expect(overBudget.routines.every((routine) => routine.status === 'budget_blocked')).toBe(true)

    expect(duplicateAndPaused).toMatchObject({
      ok: true,
      duplicate_work_guard: {
        duplicate_work_detected: true,
        duplicates_blocked: ['paperclip_heartbeat_daily_status_20260506'],
      },
      paused_agent_guard: {
        paused_agents: ['hermes', 'pi'],
        skipped_routines: ['daily_hermes_skill_proposal', 'daily_pi_dispatcher_optimization'],
      },
      blocked_reason: 'paperclip_heartbeat_duplicate_guard_blocked',
    })
    expect(duplicateAndPaused.routines.find((routine) => routine.id === 'daily_status')).toMatchObject({ status: 'duplicate_blocked' })
    expect(duplicateAndPaused.routines.find((routine) => routine.id === 'daily_hermes_skill_proposal')).toMatchObject({ status: 'paused_skipped' })
    expect(duplicateAndPaused.routines.find((routine) => routine.id === 'daily_pi_dispatcher_optimization')).toMatchObject({ status: 'paused_skipped' })
    expectOwnerSafe({ nonSandbox, missingBudget, overBudget, duplicateAndPaused })
  })


  it("confirms Paperclip UI access is blocked when the sandbox UI is not running", () => {
    const plan = buildPaperclipUiAccessVerificationPlan({
      generatedAt: GENERATED_AT,
      localUrl: "http://127.0.0.1:3100",
      tailnetUrl: "http://100.116.35.95:3100",
      localReachable: false,
      localStatusCode: 0,
      tailnetReachable: false,
      tailnetStatusCode: 0,
      ownerLoginConfirmed: false,
      mobileViewportConfirmed: false,
    })

    expect(plan).toMatchObject({
      ok: false,
      mode: "paperclip_ui_access_verification",
      local_url: "http://127.0.0.1:3100",
      local_url_confirmed: false,
      tailnet_url: "http://100.116.35.95:3100",
      tailnet_url_confirmed: false,
      owner_login_confirmed: false,
      company_dashboard_confirmed: false,
      org_chart_confirmed: false,
      issue_task_page_confirmed: false,
      budget_page_confirmed: false,
      approvals_page_confirmed: false,
      agent_detail_pages_confirmed: false,
      mobile_view_confirmed: false,
      public_exposure: false,
      tailnet_only_recommended: true,
      blocker: "paperclip_ui_not_running",
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expect(plan.surfaces.map((surface) => surface.id)).toEqual([
      "company_dashboard",
      "org_chart",
      "issues_tasks",
      "budget",
      "approvals",
      "agent_detail_pages",
    ])
    expect(plan.surfaces.every((surface) => !surface.confirmed && surface.blocker === "paperclip_ui_not_running")).toBe(true)
    expectOwnerSafe(plan)
  })

  it("confirms Paperclip owner pages and mobile view only when probes pass", () => {
    const plan = buildPaperclipUiAccessVerificationPlan({
      generatedAt: GENERATED_AT,
      localUrl: "http://127.0.0.1:3100",
      tailnetUrl: "http://100.116.35.95:3100",
      localReachable: true,
      localStatusCode: 200,
      tailnetReachable: true,
      tailnetStatusCode: 200,
      ownerLoginConfirmed: true,
      mobileViewportConfirmed: true,
      surfaces: [
        { id: "company_dashboard", reachable: true, statusCode: 200 },
        { id: "org_chart", reachable: true, statusCode: 200 },
        { id: "issues_tasks", reachable: true, statusCode: 200 },
        { id: "budget", reachable: true, statusCode: 200 },
        { id: "approvals", reachable: true, statusCode: 200 },
        { id: "agent_detail_pages", reachable: true, statusCode: 200 },
      ],
    })

    expect(plan).toMatchObject({
      ok: true,
      blocker: null,
      local_url_confirmed: true,
      tailnet_url_confirmed: true,
      owner_login_confirmed: true,
      company_dashboard_confirmed: true,
      org_chart_confirmed: true,
      issue_task_page_confirmed: true,
      budget_page_confirmed: true,
      approvals_page_confirmed: true,
      agent_detail_pages_confirmed: true,
      mobile_view_confirmed: true,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(plan.surfaces.every((surface) => surface.confirmed && surface.policy_result === "allowed" && surface.blocker === null)).toBe(true)
    expectOwnerSafe(plan)
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
