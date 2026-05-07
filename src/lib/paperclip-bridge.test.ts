import { describe, expect, it, vi } from 'vitest'
import {
  buildPaperclipGatewayTaskPayload,
  buildPaperclipHermesProposalPayload,
  buildPaperclipPiDispatcherRecommendationPayload,
  PAPERCLIP_COWORKER_LIFECYCLE_STATES,
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
