import { describe, expect, it } from 'vitest'
import {
  GATEWAY_NODE_KINDS,
  GATEWAY_ROLE_MATRIX,
  GATEWAY_STATUS_STATES,
  createGatewayCapability,
  createGatewayFlow,
  createGatewayRegistryFromAgentNetwork,
  getGatewayRoleMatrixEntry,
  normalizeGatewayStatus,
  type GatewayPolicy,
} from './gateway-model'

describe('canonical Gateway graph model', () => {
  it('defines the requested Gateway status model', () => {
    expect([...GATEWAY_STATUS_STATES]).toEqual([
      'connected',
      'degraded',
      'blocked',
      'missing',
      'read_only',
      'write_enabled',
      'execution_enabled',
      'legacy_archived',
    ])

    expect([...GATEWAY_NODE_KINDS]).toEqual([
      'owner',
      'gateway',
      'commander',
      'lieutenant',
      'specialist_agent',
      'mini_agent',
      'skill',
      'tool',
      'model',
      'mcp_server',
      'api',
      'event',
      'data_source',
      'brain_system',
      'runtime_engine',
      'buildwiki_farmer',
      'workforce_layer',
      'delivery_channel',
    ])

    expect(normalizeGatewayStatus('active')).toBe('connected')
    expect(normalizeGatewayStatus('pending')).toBe('degraded')
    expect(normalizeGatewayStatus('retired')).toBe('blocked')
    expect(normalizeGatewayStatus('readonly')).toBe('read_only')
    expect(normalizeGatewayStatus('not-found')).toBe('missing')
  })

  it('defines the Space Agent Gateway role matrix and not-commander policy', () => {
    const roleIds = GATEWAY_ROLE_MATRIX.map((entry) => entry.id)
    const agentZero = getGatewayRoleMatrixEntry('agent_zero')
    const hermes = getGatewayRoleMatrixEntry('hermes')
    const pi = getGatewayRoleMatrixEntry('pi')
    const spaceAgent = getGatewayRoleMatrixEntry('space_agent')
    const paperclip = getGatewayRoleMatrixEntry('paperclip')
    const existingAgents = getGatewayRoleMatrixEntry('existing_agents')
    const openClaw = getGatewayRoleMatrixEntry('openclaw_plus')

    expect(roleIds).toEqual(expect.arrayContaining([
      'owner',
      'gateway',
      'agent_zero',
      'hermes',
      'pi',
      'space_agent',
      'paperclip',
      'existing_agents',
      'mini_agents',
      'openclaw_plus',
    ]))
    expect(agentZero).toMatchObject({ role: 'commander', commander: true, active: true })
    expect(agentZero?.supervises).toEqual(expect.arrayContaining(['space_agent', 'paperclip', 'hermes', 'pi']))
    expect(hermes).toMatchObject({ role: 'lieutenant_skill_workflow_builder', can_design: true, commander: false })
    expect(hermes?.policy_tags).toContain('can_design_space_agent_skills')
    expect(pi).toMatchObject({ role: 'gateway_dispatcher_candidate_route_optimizer_tool_use_advisor', can_recommend: true, commander: false })
    expect(pi?.policy_tags).toContain('can_recommend_space_agent_for_web_research')
    expect(spaceAgent).toMatchObject({
      role: 'browser_web_youtube_research',
      commander: false,
      active: true,
      archived: false,
      execution_mode: 'read_only_research_packet_by_default',
    })
    expect(spaceAgent?.reports_to).toEqual(expect.arrayContaining(['gateway', 'agent_zero']))
    expect(spaceAgent?.policy_tags).toEqual(expect.arrayContaining([
      'space_agent_not_commander',
      'research_packet_only_by_default',
      'no_external_writes_without_bridge_session',
    ]))
    expect(paperclip).toMatchObject({
      role: 'workforce_company_task_orchestration_layer',
      commander: false,
      active: false,
      archived: false,
      execution_mode: 'sandbox_audit_only_until_dependency_audit_clean_or_owner_waiver',
    })
    expect(paperclip?.reports_to).toEqual(expect.arrayContaining(['gateway', 'agent_zero']))
    expect(paperclip?.policy_tags).toEqual(expect.arrayContaining([
      'paperclip_not_commander',
      'no_public_exposure',
      'bridge_session_required_for_workforce_mutations',
      'production_install_blocked_by_dependency_audit',
      'paperclip_before_openclaw_plus',
      'workforce_control_plane',
    ]))
    expect(existingAgents).toMatchObject({
      role: 'retained_specialist_workforce',
      commander: false,
      active: true,
      archived: false,
      execution_mode: 'gateway_route_and_bridge_session_required_for_side_effects',
    })
    expect(existingAgents?.reports_to).toEqual(expect.arrayContaining(['openclaw_plus', 'paperclip', 'agent_zero']))
    expect(existingAgents?.policy_tags).toEqual(expect.arrayContaining([
      'existing_agents_retained',
      'paperclip_does_not_replace_existing_agents',
      'agent_zero_supervision_required',
    ]))
    expect(openClaw).toMatchObject({ role: 'runtime_skills_engine', commander: false, active: true })
    expect(openClaw?.reports_to).toEqual(expect.arrayContaining(['paperclip', 'gateway', 'agent_zero']))
    expect(openClaw?.policy_tags).toEqual(expect.arrayContaining(['runtime_skills_engine', 'paperclip_supervised_runtime']))
    expect(getGatewayRoleMatrixEntry('tony_legacy')).toBeNull()
  })

  it('normalizes tools, models, skills, and integrations into GatewayCapability', () => {
    const capability = createGatewayCapability({
      id: 'OpenRouter Models',
      label: 'OpenRouter models',
      kind: 'model',
      status: 'read_only',
      required_credentials: ['openrouter_api_key'],
      required_tools: ['bridge_model_registry'],
      blockers: ['credential_source_not_confirmed'],
      available_to: ['agent_zero', 'hermes'],
      execution_requirements: ['bridge_session_required_for_execution'],
      source_node: 'bridge_mcp',
    })

    expect(capability).toMatchObject({
      id: 'openrouter_models',
      label: 'OpenRouter models',
      kind: 'model',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
      requires_session: false,
      source_node: 'bridge_mcp',
      available_to: ['agent_zero', 'hermes'],
      execution_requirements: ['bridge_session_required_for_execution'],
      blockers: ['credential_source_not_confirmed'],
    })
  })

  it('adapts the canonical Gateway hierarchy data into a GatewayRegistry', () => {
    const registry = createGatewayRegistryFromAgentNetwork({
      generatedAt: '2026-05-04T12:00:00.000Z',
      hermes: { installed: true, reachable: true, authConfigured: false },
    })

    const nodeIds = registry.nodes.map((node) => node.id)
    const agentZero = registry.nodes.find((node) => node.id === 'agent_zero')
    const hermes = registry.nodes.find((node) => node.id === 'hermes')
    const spaceAgent = registry.nodes.find((node) => node.id === 'space_agent')
    const paperclip = registry.nodes.find((node) => node.id === 'paperclip')
    const existingAgents = registry.nodes.find((node) => node.id === 'existing_agents')
    const bridge = registry.nodes.find((node) => node.id === 'bridge_mcp')
    const brainNodes = registry.nodes.filter((node) => node.kind === 'brain_system' || node.kind === 'buildwiki_farmer').map((node) => node.id)

    expect(registry.version).toBe('gateway_registry_v1')
    expect(registry.generated_at).toBe('2026-05-04T12:00:00.000Z')
    expect(nodeIds).toEqual(
      expect.arrayContaining([
        'owner',
        'gateway',
        'agent_zero',
        'hermes',
        'space_agent',
        'paperclip',
        'existing_agents',
        'mini_agents',
        'openclaw_plus',
        'bridge_mcp',
        'brain_sync',
        'obsidian',
        'mempalace',
        'graphify',
        'buildwiki',
      ]),
    )
    expect(registry.nodes.filter((node) => node.id === 'agent_zero')).toHaveLength(1)
    expect(agentZero).toMatchObject({
      kind: 'commander',
      status: 'connected',
      owner: 'owner',
      visibility: 'owner_visible',
    })
    expect(hermes).toMatchObject({
      kind: 'lieutenant',
      status: 'degraded',
      blockers: ['hermes_auth_not_configured'],
    })
    expect(spaceAgent).toMatchObject({
      kind: 'specialist_agent',
      role: 'browser_web_youtube_research',
      parent: 'gateway',
      supervisors: ['agent_zero', 'hermes', 'pi'],
      execution_state: 'read_only_by_default',
      web_access: 'gated_by_policy',
      browser_interaction: 'gated_by_policy',
      youtube_inspection: 'gated_by_policy',
      external_writes: 'disabled',
      status: 'read_only',
      visibility: 'owner_visible',
      capabilities: expect.arrayContaining([
        'browser_web_youtube_research',
        'Firecrawl search capability',
        'Firecrawl scrape capability',
        'Firecrawl crawl capability',
        'Firecrawl map capability',
        'Firecrawl extract capability',
        'Firecrawl interact/browser capability gated by configuration',
        'web access gated by policy',
        'browser interaction gated by policy',
        'YouTube inspection gated by policy',
        'external writes disabled',
        'Gateway-routed structured Research Packets',
        'subordinate research stage, not commander',
      ]),
    })
    expect(spaceAgent?.status_details).toMatchObject({
      firecrawl_status: 'blocked_until_gateway_registry_confirms_credential',
      firecrawl_credential_configured: false,
      firecrawl_search: 'blocked_missing_credential',
      firecrawl_scrape: 'blocked_missing_credential',
      firecrawl_crawl: 'blocked_missing_credential',
      firecrawl_map: 'blocked_missing_credential',
      firecrawl_extract: 'blocked_missing_credential',
      firecrawl_interact_browser: 'blocked_missing_credential',
      firecrawl_blocked_reason: 'firecrawl_missing_credential',
      browser_status: 'playwright_mcp_local_only_read_only_evidence_available_bridge_session_required_for_interactive_actions',
      youtube_support: 'metadata_description_transcript_chapters_key_claims_when_available',
      latest_research_jobs: 'none_recorded_yet',
      handoff_target: 'agent_zero_by_default',
      blockers_summary: 'firecrawl_missing_credential; interactive_browser_actions_require_bridge_session',
      secrets_exposed: false,
    })
    expect(paperclip).toMatchObject({
      label: 'Paperclip Workforce Control Plane',
      kind: 'workforce_layer',
      role: 'workforce_company_task_orchestration_layer',
      parent: 'gateway',
      supervisors: ['agent_zero', 'gateway'],
      execution_state: 'proposal_only_until_bridge_session',
      external_writes: 'requires_bridge_session',
      status: 'blocked',
      visibility: 'owner_visible',
      blockers: [
        'production_install_blocked_by_dependency_audit',
        'paperclip_service_not_configured',
        'bridge_session_required_for_workforce_mutations',
      ],
      capabilities: expect.arrayContaining([
        'co-worker agent orchestration',
        'daily task assignment',
        'simultaneous job supervision',
        'recurring heartbeats',
        'budget and cost tracking',
        'issues, tasks, and work products',
        'governance and approval records',
      ]),
    })
    expect(paperclip?.status_details).toMatchObject({
      repo_audit_status: 'sandbox_audit_complete',
      sandbox_install: 'passed_with_ignore_scripts',
      token_scan: 'passed',
      dependency_audit: 'blocked',
      dependency_audit_total: 30,
      dependency_audit_high: 11,
      dependency_audit_moderate: 17,
      dependency_audit_low: 2,
      production_install_status: 'blocked_until_dependency_audit_clean_or_owner_waiver',
      service_status: 'not_configured',
      local_tailnet_ui_link: 'loopback:3100',
      company_count_source: '/api/bridge/paperclip/companies',
      active_agents_source: '/api/bridge/paperclip/agents',
      active_issues_source: '/api/bridge/paperclip/issues',
      budget_status_source: '/api/bridge/paperclip/status',
      heartbeat_status_source: '/api/bridge/paperclip/status',
      bridge_status_endpoint: '/api/bridge/paperclip/status',
      tasks_endpoint: '/api/bridge/paperclip/tasks',
      proposals_endpoint: '/api/bridge/paperclip/proposals',
      research_tasks_endpoint: '/api/bridge/paperclip/research-tasks',
      corrected_gateway_chain: 'owner -> gateway -> agent_zero_pi_hermes -> paperclip -> openclaw_plus -> mini_agents_specialist_agents_skills_tools_reports_approvals',
      paperclip_layer: 'workforce_control_plane',
      openclaw_plus_layer: 'runtime_skills_engine',
      paperclip_before_openclaw_plus: true,
      space_agent_appears_as_paperclip_agent: true,
      space_agent_can_receive_web_research_task: true,
      space_agent_can_receive_youtube_research_task: true,
      space_agent_can_receive_firecrawl_task: true,
      paperclip_tracks_research_issue_requires_bridge_session: true,
      paperclip_work_product_storage_requires_bridge_session: true,
      gateway_validates_research_evidence: true,
      agent_zero_routes_research_next_step: true,
      responsible_agent_completes_final_task_from_research_packet: true,
      hermes_can_design_workflow_task_templates: true,
      hermes_can_propose_mini_agent_specs: true,
      hermes_can_draft_paperclip_routines: true,
      hermes_can_create_skill_proposal_documents: true,
      hermes_cannot_activate_execution_without_agent_zero_gateway: true,
      allowed_assignments: 'hermes, space_agent, pi_review, mini_agent',
      agent_zero_reviews_completion: true,
      paperclip_issue_creation_requires_bridge_session: true,
      gateway_handoff_logging: true,
      public_exposure: false,
      external_writes_enabled: false,
      bridge_session_required_for_mutations: true,
      secrets_exposed: false,
    })
    expect(existingAgents).toMatchObject({
      kind: 'specialist_agent',
      role: 'retained_specialist_workforce',
      parent: 'openclaw_plus',
      supervisors: ['openclaw_plus', 'paperclip', 'agent_zero', 'gateway'],
      execution_state: 'bridge_session_required',
      external_writes: 'requires_bridge_session',
      status: 'read_only',
      visibility: 'owner_visible',
      blockers: ['execution_requires_gateway_route_and_bridge_session_scope'],
      capabilities: expect.arrayContaining([
        'retained specialist workforce',
        'Gateway-routed assignments',
        'Agent Zero supervision',
        'historical agent IDs retained',
        'no replacement by Paperclip',
        'Paperclip workforce supervision',
        'OpenClaw+ runtime execution',
      ]),
    })
    expect(existingAgents?.status_details).toMatchObject({
      retained: true,
      paperclip_replaces_existing_agents: false,
      paperclip_supervises_workforce_metadata: true,
      openclaw_plus_executes_specialist_agents: true,
      agent_zero_commander: true,
      gateway_route_required: true,
      bridge_session_required_for_execution: true,
      secrets_exposed: false,
    })
    expect(bridge).toMatchObject({ kind: 'mcp_server', status: 'connected' })
    expect(brainNodes).toEqual(expect.arrayContaining(['brain_sync', 'obsidian', 'mempalace', 'graphify', 'buildwiki']))
  })

  it('marks Space Agent capability as supervised research, not command authority', () => {
    const registry = createGatewayRegistryFromAgentNetwork()
    const capability = registry.capabilities.find((item) => item.id === 'space_agent_research_packet')

    expect(capability).toMatchObject({
      source_node: 'space_agent',
      status: 'read_only',
      execution_enabled: false,
      available_to: ['agent_zero', 'hermes', 'pi'],
      status_details: {
        role: 'browser_web_youtube_research',
        specialty: 'web_browser_youtube_firecrawl_research_specialist',
        execution_state: 'read_only_by_default',
        web_access: 'gated_by_policy',
        browser_interaction: 'gated_by_policy',
        youtube_inspection: 'gated_by_policy',
        external_writes: 'disabled',
        firecrawl_credential_configured: false,
        firecrawl_search: 'blocked_missing_credential',
        firecrawl_scrape: 'blocked_missing_credential',
        firecrawl_crawl: 'blocked_missing_credential',
        firecrawl_map: 'blocked_missing_credential',
        firecrawl_extract: 'blocked_missing_credential',
        firecrawl_interact_browser: 'blocked_missing_credential',
        firecrawl_blocked_reason: 'firecrawl_missing_credential',
        browser_status: 'playwright_mcp_local_only_read_only_evidence_available_bridge_session_required_for_interactive_actions',
        youtube_support: 'metadata_description_transcript_chapters_key_claims_when_available',
        latest_research_jobs: 'none_recorded_yet',
        handoff_target: 'agent_zero_by_default',
        blockers_summary: 'firecrawl_missing_credential; interactive_browser_actions_require_bridge_session',
        returns_to: 'agent_zero',
        subordinate_to_gateway: true,
        agent_zero_commander: true,
        hermes_skill_builder: true,
        pi_can_recommend: true,
        mini_agents_are_subordinate_workers: true,
        openclaw_plus_worker_runtime: true,
        space_agent_is_commander: false,
        policy: 'space_agent_not_commander',
      },
    })
    expect(registry.policies.space_agent_not_commander).toMatchObject({
      auth_required: true,
      write_allowed: false,
      secret_safe: true,
      external_allowed: false,
    })
  })

  it('marks Paperclip as a sandboxed workforce layer, not command authority', () => {
    const registry = createGatewayRegistryFromAgentNetwork()
    const capability = registry.capabilities.find((item) => item.id === 'paperclip_workforce_operations')

    expect(capability).toMatchObject({
      source_node: 'paperclip',
      status: 'blocked',
      execution_enabled: false,
      available_to: ['agent_zero', 'hermes', 'pi'],
      blockers: [
        'production_install_blocked_by_dependency_audit',
        'paperclip_service_not_configured',
      ],
      status_details: {
        role: 'workforce_company_task_orchestration_layer',
        corrected_gateway_chain: 'owner -> gateway -> agent_zero_pi_hermes -> paperclip -> openclaw_plus -> mini_agents_specialist_agents_skills_tools_reports_approvals',
        paperclip_layer: 'workforce_control_plane',
        openclaw_plus_layer: 'runtime_skills_engine',
        paperclip_before_openclaw_plus: true,
        repo_audit_status: 'sandbox_audit_complete',
        sandbox_install: 'passed_with_ignore_scripts',
        token_scan: 'passed',
        dependency_audit: 'blocked',
        dependency_audit_total: 30,
        dependency_audit_high: 11,
        dependency_audit_moderate: 17,
        dependency_audit_low: 2,
        production_install_status: 'blocked_until_dependency_audit_clean_or_owner_waiver',
        tasks_endpoint: '/api/bridge/paperclip/tasks',
        proposals_endpoint: '/api/bridge/paperclip/proposals',
        dispatcher_recommendations_endpoint: '/api/bridge/paperclip/dispatcher-recommendations',
        research_tasks_endpoint: '/api/bridge/paperclip/research-tasks',
        space_agent_appears_as_paperclip_agent: true,
        space_agent_can_receive_web_research_task: true,
        space_agent_can_receive_youtube_research_task: true,
        space_agent_can_receive_firecrawl_task: true,
        paperclip_tracks_research_issue_requires_bridge_session: true,
        paperclip_work_product_storage_requires_bridge_session: true,
        gateway_validates_research_evidence: true,
        agent_zero_routes_research_next_step: true,
        responsible_agent_completes_final_task_from_research_packet: true,
        pi_can_see_task_queue: true,
        pi_can_recommend_agent_assignment: true,
        pi_can_recommend_budget_route: true,
        pi_can_recommend_model_provider_route: true,
        pi_can_recommend_mini_agent_creation: true,
        pi_cannot_execute_without_gateway_policy: true,
        pi_output_advisory_until_proven: true,
        agent_zero_final_route_decision_required: true,
        gateway_logs_final_route_decision: true,
        hermes_can_design_workflow_task_templates: true,
        hermes_can_propose_mini_agent_specs: true,
        hermes_can_draft_paperclip_routines: true,
        hermes_can_create_skill_proposal_documents: true,
        hermes_cannot_activate_execution_without_agent_zero_gateway: true,
        allowed_assignments: 'hermes, space_agent, pi_review, mini_agent',
        agent_zero_reviews_completion: true,
        paperclip_issue_creation_requires_bridge_session: true,
        coworker_agent_schema: 'paperclip_coworker_agent_v1',
        coworker_supervisor_required: true,
        coworker_purpose_required: true,
        coworker_task_scope_required: true,
        coworker_budget_required: true,
        coworker_memory_ttl_required: true,
        coworker_allowed_tools_required: true,
        coworker_forbidden_tools_required: true,
        coworker_expiration_condition_required: true,
        coworker_audit_trail_required: true,
        coworker_activation_requires_bridge_session: true,
        coworker_lifecycle_states: 'proposed, awaiting_approval, approved, running, blocked, completed, failed, expired, archived, reviewed_by_agent_zero',
        coworker_lifecycle_tracking_only: true,
        coworker_running_requires_bridge_session: true,
        coworker_reviewed_by_agent_zero_state: true,
        coworker_policy_checks: 'request_type, credential_mode, bridge_session, owner_approval, mini_agent_scope, forbidden_tools, memory_policy, audit_requirement, output_contract',
        coworker_route_decisions: 'allowed, blocked, requires_session, missing_credential',
        coworker_policy_blocks_on_failed_rule: true,
        gateway_handoff_logging: true,
        public_exposure: false,
        external_writes_enabled: false,
        bridge_session_required_for_mutations: true,
        paperclip_is_commander: false,
        secrets_exposed: false,
      },
    })
    expect(capability?.execution_requirements).toEqual(expect.arrayContaining([
      'gateway_route_required',
      'agent_zero_command_authority_required',
      'bridge_session_required_for_workforce_mutations',
      'no_public_exposure',
      'production_install_blocked_until_dependency_audit_clean_or_owner_waiver',
    ]))
    expect(registry.policies.paperclip_no_public_exposure).toMatchObject({
      auth_required: true,
      write_allowed: false,
      secret_safe: true,
      external_allowed: false,
    })
    expect(registry.policies.paperclip_workforce_mutations_bridge_session_required).toMatchObject({
      auth_required: true,
      bridge_session_required: true,
      secret_safe: true,
      external_allowed: false,
    })
  })

  it('keeps deleted legacy controllers out of active Gateway routes', () => {
    const registry = createGatewayRegistryFromAgentNetwork()
    const deletedLegacyNodes = registry.nodes.filter((node) => node.id === 'legacy_deleted_controller')
    expect(deletedLegacyNodes).toHaveLength(0)
  })

  it('maps Gateway hierarchy relationships into Gateway edge types', () => {
    const registry = createGatewayRegistryFromAgentNetwork({ generatedAt: '2026-05-04T12:00:00.000Z' })

    expect(registry.edges).toContainEqual({
      source: 'owner',
      target: 'agent_zero',
      kind: 'command',
      allowed: true,
      requires_session: false,
      status: 'connected',
      blocker: null,
      last_seen: '2026-05-04T12:00:00.000Z',
    })
    expect(registry.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'gateway', target: 'agent_zero', kind: 'command' }),
        expect.objectContaining({ source: 'agent_zero', target: 'hermes', kind: 'delegation' }),
        expect.objectContaining({ source: 'agent_zero', target: 'space_agent', kind: 'delegation' }),
        expect.objectContaining({ source: 'space_agent', target: 'agent_zero', kind: 'report' }),
        expect.objectContaining({ source: 'gateway', target: 'paperclip', kind: 'delegation', status: 'blocked' }),
        expect.objectContaining({ source: 'agent_zero', target: 'paperclip', kind: 'delegation', status: 'blocked' }),
        expect.objectContaining({ source: 'paperclip', target: 'openclaw_plus', kind: 'tool-call' }),
        expect.objectContaining({ source: 'openclaw_plus', target: 'paperclip', kind: 'report' }),
        expect.objectContaining({ source: 'paperclip', target: 'agent_zero', kind: 'report' }),
        expect.objectContaining({ source: 'gateway', target: 'existing_agents', kind: 'delegation', status: 'blocked' }),
        expect.objectContaining({ source: 'agent_zero', target: 'existing_agents', kind: 'delegation', status: 'blocked' }),
        expect.objectContaining({ source: 'existing_agents', target: 'agent_zero', kind: 'report' }),
        expect.objectContaining({ source: 'openclaw_plus', target: 'bridge_mcp', kind: 'mcp-call' }),
        expect.objectContaining({ source: 'openclaw_plus', target: 'existing_agents', kind: 'delegation' }),
        expect.objectContaining({ source: 'openclaw_plus', target: 'mini_agents', kind: 'delegation' }),
        expect.objectContaining({ source: 'agent_zero', target: 'brain_sync', kind: 'memory' }),
        expect.objectContaining({ source: 'gateway', target: 'mini_agents', kind: 'delegation' }),
        expect.objectContaining({ source: 'mini_agents', target: 'agent_zero', kind: 'report' }),
        expect.objectContaining({ source: 'mini_agents', target: 'hermes', kind: 'report' }),
      ]),
    )
  })

  it('keeps policy and flow objects explicit about auth, sessions, writes, and external access', () => {
    const policy: GatewayPolicy = {
      auth_required: true,
      bridge_session_required: true,
      write_allowed: false,
      secret_safe: true,
      external_allowed: false,
    }
    const flow = createGatewayFlow({
      flow_id: 'flow_safe_test',
      request: {
        source: 'owner',
        target: 'agent_zero',
        purpose: 'Ask Agent Zero to inspect Gateway registry',
      },
      route: {
        source: 'owner',
        target: 'agent_zero',
        edge_kind: 'command',
        hops: ['owner', 'gateway', 'agent_zero'],
      },
      policy,
      execution_mode: 'bridge_session',
      audit: {
        audit_id: null,
        events: ['policy_checked'],
        external_write: false,
        secrets_exposed: false,
      },
      result: {
        status: 'read_only',
        summary: 'Gateway registry read only',
        blocker: null,
      },
    })

    expect(flow.source).toBe('owner')
    expect(flow.target).toBe('agent_zero')
    expect(flow.requested_action).toBe('Ask Agent Zero to inspect Gateway registry')
    expect(flow.selected_route.hops).toEqual(['owner', 'gateway', 'agent_zero'])
    expect(flow.policy_result).toMatchObject({
      route_decision: 'requires_session',
      allowed: false,
      requires_bridge_session: true,
      blocked_reason: null,
    })
    expect(flow.bridge_session_id).toBeNull()
    expect(flow.status).toBe('read_only')
    expect(flow.node_health).toEqual({})
    expect(flow.last_successful_route).toBeNull()
    expect(flow.last_blocker).toBeNull()
    expect(flow.failure_reason).toBeNull()
    expect(flow.audit_log.map((entry) => entry.event)).toEqual(expect.arrayContaining([
      'gateway.policy.decision',
      'gateway.external_write.decision',
      'gateway.bridge_session.decision',
      'gateway.no_secrets.logging',
    ]))
    expect(flow.policy_decision_log[0]).toMatchObject({ decision: 'requires_session', secrets_exposed: false })
    expect(flow.external_write_log[0]).toMatchObject({ decision: 'not_requested', external_write: false })
    expect(flow.bridge_session_log[0]).toMatchObject({ decision: 'required', allowed: false })
    expect(flow.no_secrets_logging).toMatchObject({ enabled: true, secrets_exposed: false })
    expect(flow.policy).toEqual(policy)
    expect(flow.execution_mode).toBe('bridge_session')
    expect(flow.audit.external_write).toBe(false)
    expect(flow.audit.secrets_exposed).toBe(false)
    expect(flow.result.status).toBe('read_only')
  })
})
