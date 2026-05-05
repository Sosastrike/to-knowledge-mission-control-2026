import { describe, expect, it } from 'vitest'
import {
  GATEWAY_NODE_KINDS,
  GATEWAY_STATUS_STATES,
  createGatewayCapability,
  createGatewayFlow,
  createGatewayRegistryFromAgentNetwork,
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
    expect(bridge).toMatchObject({ kind: 'mcp_server', status: 'connected' })
    expect(brainNodes).toEqual(expect.arrayContaining(['brain_sync', 'obsidian', 'mempalace', 'graphify', 'buildwiki']))
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
    expect(flow.policy).toEqual(policy)
    expect(flow.execution_mode).toBe('bridge_session')
    expect(flow.audit.external_write).toBe(false)
    expect(flow.audit.secrets_exposed).toBe(false)
    expect(flow.result.status).toBe('read_only')
  })
})
