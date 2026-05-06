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
      'opencloud_worker',
      'buildwiki_farmer',
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
    const openCloud = getGatewayRoleMatrixEntry('opencloud')
    const openClaw = getGatewayRoleMatrixEntry('openclaw_plus')
    const tony = getGatewayRoleMatrixEntry('tony_legacy')

    expect(roleIds).toEqual(expect.arrayContaining([
      'owner',
      'gateway',
      'agent_zero',
      'hermes',
      'pi',
      'space_agent',
      'mini_agents',
      'openclaw_plus',
      'opencloud',
      'tony_legacy',
    ]))
    expect(agentZero).toMatchObject({ role: 'commander', commander: true, active: true })
    expect(agentZero?.supervises).toEqual(expect.arrayContaining(['space_agent', 'hermes', 'pi', 'mini_agents']))
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
    expect(openCloud).toMatchObject({ role: 'worker_runtime_engine_skill_tool_agent_creation_layer', commander: false, active: true })
    expect(openCloud?.policy_tags).toContain('opencloud_retained')
    expect(openClaw).toMatchObject({ role: 'worker_runtime_skills_adapters_reports_layer', commander: false, active: true })
    expect(tony).toMatchObject({ role: 'retired_archive_only', commander: false, active: false, archived: true })
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
        'mini_agents',
        'openclaw_plus',
        'bridge_mcp',
        'brain_sync',
        'obsidian',
        'mempalace',
        'graphify',
        'buildwiki',
        'tony_legacy',
        'tony_v2',
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
        returns_to: 'agent_zero',
        subordinate_to_gateway: true,
        agent_zero_commander: true,
        hermes_skill_builder: true,
        pi_can_recommend: true,
        mini_agents_are_subordinate_workers: true,
        opencloud_openclaw_worker_runtime: true,
        tony_retired_archive_only: true,
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

  it('keeps Tony archived and out of active Gateway routes', () => {
    const registry = createGatewayRegistryFromAgentNetwork()
    const tonyNodes = registry.nodes.filter((node) => node.id.startsWith('tony'))
    const activeTonyEdges = registry.edges.filter((edge) => edge.source.startsWith('tony') || edge.target.startsWith('tony'))

    expect(tonyNodes).toHaveLength(2)
    for (const node of tonyNodes) {
      expect(node.visibility).toBe('archived')
      expect(node.status).toBe('legacy_archived')
      expect(node.blockers).toEqual(['legacy_archived'])
    }
    expect(activeTonyEdges).toEqual([])
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
        expect.objectContaining({ source: 'agent_zero', target: 'openclaw_plus', kind: 'tool-call' }),
        expect.objectContaining({ source: 'openclaw_plus', target: 'bridge_mcp', kind: 'mcp-call' }),
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
