import { describe, expect, it } from 'vitest'
import type { AgentZeroReadOnlyContext } from './agent-zero-bridge'
import {
  buildGatewayFlowsPayload,
  buildGatewayPoliciesPayload,
  buildGatewayRegistrySnapshot,
  buildGatewayStatusPayload,
  getGatewayNodeDetail,
} from './gateway-registry-api'

const context = {
  agents: {
    items: [
      { id: 'agent_zero', status: 'active', role: 'commander', execution_enabled: false, direct_access: false, proxy_access: true },
      { id: 'hermes', status: 'degraded', role: 'lieutenant', execution_enabled: false, direct_access: false, proxy_access: true },
    ],
  },
  bridge: {
    provider_registry: [
      { id: 'openrouter', name: 'OpenRouter', state: 'configured', category: 'model', access: 'connected', execution_enabled: false },
      { id: 'zapier', name: 'Zapier', state: 'configured', category: 'mcp', access: 'connected', execution_enabled: false },
    ],
  },
  mcp: {
    servers: [
      {
        name: 'zapier',
        status: 'connected',
        transport: 'http',
        tool_count: 4,
        reachable: true,
        schema_available: true,
        blocked_reason: null,
        tools_endpoint: '/api/mcp/servers/zapier/tools',
      },
    ],
  },
  models: {
    provider_registry: [
      {
        id: 'openrouter',
        name: 'OpenRouter',
        status: 'configured',
        credential_present: true,
        credential_names: ['OPENROUTER_API_KEY'],
        bridge_session_required: true,
        blocked_reason: null,
      },
    ],
    catalog: [{ alias: 'sonnet', provider: 'openrouter', name: 'openrouter/anthropic/claude-sonnet-4' }],
  },
  tools: {
    registry: [
      {
        id: 'report.create',
        name: 'Create report',
        status: 'connected',
        read_only: true,
        write_enabled: false,
        requires_bridge_session: false,
        blocked_reason: null,
      },
    ],
  },
  skills: {
    registry: [
      {
        id: 'openclaw_plus:email-triage',
        name: 'Email triage',
        source: 'openclaw_plus',
        source_label: 'OpenClaw+ shared skills',
        status: 'visible',
        required_tools: ['agentmail'],
        required_credentials: ['AGENTMAIL_API_KEY'],
        available_to: ['agent_zero'],
        available_to_agents: ['hermes'],
        execution_requirements: ['bridge_session_required_for_execution'],
        blocked_reasons: ['credential:AGENTMAIL_API_KEY:missing'],
        blocked_dependencies: ['tool:agentmail:execution_disabled_in_read_only_context'],
        missing_dependencies: ['credential:AGENTMAIL_API_KEY'],
        blocked_reason: 'credential:AGENTMAIL_API_KEY:missing',
      },
      {
        id: 'reporting',
        name: 'Reporting',
        source: 'openclaw_plus',
        source_label: 'OpenClaw+',
        description: 'Create owner-facing reports.',
        status: 'connected',
        required_tools: ['report.create'],
        required_credentials: [],
        blocked_reasons: [],
        missing_dependencies: [],
        blocked_reason: null,
      },
    ],
  },
  integrations: {
    registry: [
      {
        id: 'firecrawl',
        name: 'Firecrawl',
        status: 'blocked',
        read_only: true,
        write_enabled: false,
        requires_bridge_session: true,
        missing_credential: true,
        credential_names: ['FIRECRAWL_API_KEY'],
        blocked_reason: 'missing_credential',
      },
      {
        id: 'agentmail',
        name: 'AgentMail',
        status: 'configured',
        read_only: true,
        write_enabled: false,
        requires_bridge_session: true,
        missing_credential: false,
        credential_names: ['AGENTMAIL_API_KEY'],
        blocked_reason: null,
      },
    ],
  },
  brain: {
    registry: [
      {
        id: 'obsidian',
        name: 'Obsidian',
        status: 'connected',
        read_available: true,
        write_available: false,
        blocked_reason: null,
      },
      {
        id: 'mempalace',
        name: 'MemPalace',
        status: 'connected',
        read_available: true,
        write_available: true,
        blocked_reason: null,
      },
      {
        id: 'graphify',
        name: 'Graphify',
        status: 'connected',
        read_available: true,
        write_available: false,
        blocked_reason: 'write_adapter_disabled',
      },
    ],
  },
  opencloud_buildwiki: {
    visible: true,
    timer_active: true,
    farmer_execution_enabled: false,
  },
} as unknown as AgentZeroReadOnlyContext

describe('Gateway registry API model', () => {
  it('builds a read-only Gateway registry with Agent Zero, Hermes, Bridge/MCP, and Brain systems', () => {
    const registry = buildGatewayRegistrySnapshot({ context, generatedAt: '2026-05-04T00:00:00.000Z' })
    const nodes = new Set(registry.nodes.map((node) => node.id))
    const capabilities = new Set(registry.capabilities.map((capability) => capability.id))

    expect(nodes.has('gateway')).toBe(true)
    expect(nodes.has('agent_zero')).toBe(true)
    expect(nodes.has('hermes')).toBe(true)
    expect(nodes.has('bridge_mcp')).toBe(true)
    expect(nodes.has('obsidian')).toBe(true)
    expect(nodes.has('mempalace')).toBe(true)
    expect(nodes.has('graphify')).toBe(true)
    expect(nodes.has('buildwiki')).toBe(true)
    expect(capabilities.has('mcp_zapier')).toBe(true)
    expect(capabilities.has('brain_obsidian')).toBe(true)
    expect(capabilities.has('brain_buildwiki')).toBe(true)
    expect(capabilities.has('integration_firecrawl')).toBe(true)
    expect(registry.capabilities.find((capability) => capability.id === 'integration_firecrawl')?.blockers).toContain('missing_credential')
    const skill = registry.capabilities.find((capability) => capability.id === 'skill_openclaw_plus_email_triage')
    expect(skill).toMatchObject({
      kind: 'skill',
      source_node: 'openclaw_plus',
      requires_session: true,
      execution_enabled: false,
      available_to: ['agent_zero', 'hermes'],
      required_tools: ['agentmail'],
      required_credentials: ['AGENTMAIL_API_KEY'],
    })
    expect(skill?.execution_requirements).toContain('bridge_session_required_for_execution')
    expect(skill?.blockers).toEqual(expect.arrayContaining(['credential:AGENTMAIL_API_KEY:missing', 'tool:agentmail:execution_disabled_in_read_only_context']))
    expect(JSON.stringify(registry)).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|\/home\/tony/)
  })

  it('summarizes Gateway health, nodes, flows, and policies without enabling writes', () => {
    const registry = buildGatewayRegistrySnapshot({ context, generatedAt: '2026-05-04T00:00:00.000Z' })
    const status = buildGatewayStatusPayload(registry)
    const node = getGatewayNodeDetail(registry, 'agent-zero')
    const flows = buildGatewayFlowsPayload(registry)
    const policies = buildGatewayPoliciesPayload(registry)

    expect(status.agent_zero.status).toBe('connected')
    expect(status.hermes.status).toBe('degraded')
    expect(status.bridge_mcp.mcp_servers).toBeGreaterThan(0)
    expect(status.brain_systems.find((item) => item.id === 'mempalace')?.write_enabled).toBe(true)
    expect(status.execution_enabled).toBe(false)
    expect(node?.node.label).toBe('Agent Zero')
    expect(flows.flows.length).toBeGreaterThan(0)
    const collaboration = flows.flows.find((flow) => flow.flow_id === 'flow_agent_zero_hermes_collaboration')
    expect(collaboration?.route.hops).toEqual(['agent_zero', 'hermes', 'agent_zero'])
    expect(collaboration?.execution_mode).toBe('read_only')
    expect(collaboration?.audit.events).toContain('gateway_collaboration_flow_registered_read_only')
    expect(collaboration?.audit.events).toContain('agent_zero_remains_commander')
    expect(collaboration?.audit.events).toContain('hermes_plan_only_no_execution')
    expect(collaboration?.audit.external_write).toBe(false)
    expect(flows.execution_enabled).toBe(false)
    expect(policies.summary.auth_required).toBe(true)
    expect(policies.summary.external_writes_enabled).toBe(false)
  })
})
