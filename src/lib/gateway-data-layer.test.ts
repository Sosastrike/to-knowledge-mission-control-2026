import { describe, expect, it } from 'vitest'

import { createGatewayCapability, createGatewayHealth, type GatewayRegistry } from './gateway-model'
import {
  buildGatewayDataLayer,
  executeAction,
  getAgents,
  getSkills,
  getSystems,
  getTools,
  queryData,
} from './gateway-data-layer'

const registry: GatewayRegistry = {
  generated_at: '2026-05-04T12:00:00.000Z',
  version: 'gateway_registry_v1',
  nodes: [
    {
      id: 'agent_zero',
      label: 'Agent Zero',
      kind: 'commander',
      status: 'connected',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      health: createGatewayHealth('connected', 'Agent Zero commander track is live in Gateway context.'),
      capabilities: ['chat', 'report', 'dispatch'],
      blockers: [],
    },
    {
      id: 'hermes',
      label: 'Hermes',
      kind: 'lieutenant',
      status: 'degraded',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      health: createGatewayHealth('degraded', 'Hermes is visible but hermes_called:true remains unproven.'),
      capabilities: ['skill_design', 'workflow_planning'],
      blockers: ['hermes_called_not_proven'],
    },
    {
      id: 'opencloud',
      label: 'OpenCloud / Build-Wiki',
      kind: 'opencloud',
      status: 'connected',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      health: createGatewayHealth('read_only', 'OpenCloud is retained as a worker/runtime engine.'),
      capabilities: ['buildwiki_status', 'farmer_status'],
      blockers: [],
    },
    {
      id: 'gateway_events',
      label: 'Gateway Events',
      kind: 'event',
      status: 'connected',
      owner: 'gateway',
      visibility: 'owner_visible',
      health: createGatewayHealth('read_only', 'Gateway event stream is read-only.'),
      capabilities: ['events'],
      blockers: [],
    },
  ],
  edges: [],
  capabilities: [
    createGatewayCapability({
      id: 'skill.report',
      label: 'Report Skill',
      kind: 'skill',
      source_node: 'openclaw_runtime',
      status_details: { summary: 'Shared report skill is visible.' },
      status: 'connected',
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
    }),
    createGatewayCapability({
      id: 'tool.report.create',
      label: 'Create Report Tool',
      kind: 'tool',
      status: 'write_enabled',
      read_enabled: true,
      write_enabled: true,
      execution_enabled: false,
      requires_session: true,
    }),
    createGatewayCapability({
      id: 'mcp.zapier',
      label: 'Zapier MCP',
      kind: 'mcp_server',
      source_node: 'bridge_mcp',
      status_details: { summary: 'Zapier schemas are visible; writes are gated.' },
      status: 'read_only',
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
      requires_session: true,
    }),
    createGatewayCapability({
      id: 'api.firecrawl',
      label: 'Firecrawl',
      kind: 'api',
      source_node: 'bridge_mcp',
      status: 'blocked',
      read_enabled: false,
      write_enabled: false,
      execution_enabled: false,
      blockers: ['missing_credential'],
      required_credentials: ['firecrawl_api_key'],
      status_details: { summary: 'Firecrawl is blocked until credentials are configured.' },
    }),
    createGatewayCapability({
      id: 'model.openrouter',
      label: 'OpenRouter',
      kind: 'model',
      source_node: 'bridge_models',
      status_details: { summary: 'OpenRouter is listed in the model registry.' },
      status: 'read_only',
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
    }),
    createGatewayCapability({
      id: 'brain.obsidian',
      label: 'Obsidian',
      kind: 'brain',
      source_node: 'brain_registry',
      status_details: { summary: 'Obsidian is visible as a Brain system.' },
      status: 'read_only',
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
    }),
    createGatewayCapability({
      id: 'delivery.telegram',
      label: 'Telegram Delivery',
      kind: 'integration',
      source_node: 'delivery',
      status_details: { summary: 'Telegram delivery is blocked until adapter proof passes.' },
      status: 'blocked',
      read_enabled: false,
      write_enabled: false,
      execution_enabled: false,
      requires_session: true,
      blockers: ['delivery_adapter_not_proven'],
    }),
  ],
  policies: {},
  health: { gateway: createGatewayHealth('degraded', 'Synthetic registry for data layer tests.') },
}

describe('Gateway Data Layer', () => {
  it('normalizes every registry entry into owner-safe discovery nodes', () => {
    const layer = buildGatewayDataLayer(registry)

    expect(layer.discovery_tools).toContain('getSystems')
    expect(layer.discovery_tools).toContain('executeAction')
    expect(layer.nodes.length).toBeGreaterThanOrEqual(10)
    expect(layer.nodes.every((node) => typeof node.owner_visible_summary === 'string')).toBe(true)
    expect(layer.nodes.every((node) => typeof node.read_enabled === 'boolean')).toBe(true)
    expect(layer.nodes.every((node) => typeof node.execution_enabled === 'boolean')).toBe(true)
  })

  it('exposes systems, agents, skills, and tools before execution', () => {
    const layer = buildGatewayDataLayer(registry)

    expect(getSystems(layer).map((system) => system.id)).toContain('system.opencloud_worker')
    expect(getAgents(layer).map((agent) => agent.name)).toContain('Agent Zero')
    expect(getSkills(layer).map((skill) => skill.name)).toContain('Report Skill')
    expect(getTools(layer).map((tool) => tool.name)).toContain('Zapier MCP')
  })

  it('keeps OpenCloud as a retained worker/runtime node, not a deletion target', () => {
    const layer = buildGatewayDataLayer(registry)
    const opencloud = layer.nodes.find((node) => node.id === 'opencloud')

    expect(opencloud).toMatchObject({
      type: 'opencloud_worker',
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
    })
    expect(opencloud?.semantic_context).toContain('not a deletion target')
  })

  it('allows read-only query only when the node is readable', () => {
    const layer = buildGatewayDataLayer(registry)

    const readable = queryData(layer, { node_id: 'agent_zero' })
    expect(readable.ok).toBe(true)
    expect(readable.rows[0]?.name).toBe('Agent Zero')

    const blocked = queryData(layer, { node_id: 'capability.api.firecrawl' })
    expect(blocked.ok).toBe(false)
    expect(blocked.blocked_reason).toBe('missing_credential')
  })

  it('blocks executeAction unless a registered adapter and Bridge Session are available', () => {
    const layer = buildGatewayDataLayer(registry)
    const result = executeAction(layer, { node_id: 'tool.report.create', action: 'create_report' })

    expect(result.ok).toBe(false)
    expect(result.execution_enabled).toBe(false)
    expect(result.requires_bridge_session).toBe(true)
    expect(result.blocked_reason).toContain('bridge_session')
  })
})
