import { describe, expect, it } from 'vitest'

import { createGatewayCapability, createGatewayHealth, type GatewayRegistry } from './gateway-model'
import {
  buildGatewayDataLayer,
  executeAction,
  getAgents,
  getBlockedReasons,
  getBrainSystems,
  getIntegrations,
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
      id: 'space_agent',
      label: 'Space Agent',
      kind: 'specialist_agent',
      status: 'read_only',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      health: createGatewayHealth('read_only', 'Space Agent is a Gateway research specialist for browser, web, YouTube, and Firecrawl research packets.'),
      capabilities: ['browser research', 'web research', 'YouTube research', 'Firecrawl research coordination'],
      blockers: [],
    },
    {
      id: 'openclaw_plus',
      label: 'OpenClaw+ / Build-Wiki',
      kind: 'runtime_engine',
      status: 'connected',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      health: createGatewayHealth('read_only', 'OpenClaw+ is retained as the runtime / skills engine.'),
      capabilities: ['buildwiki_status', 'farmer_status', 'skills_tools_source', 'mini_agent_creation_layer'],
      blockers: [],
    },
    {
      id: 'paperclip',
      label: 'Paperclip',
      kind: 'workforce_layer',
      status: 'blocked',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      health: createGatewayHealth('blocked', 'Paperclip production activation is blocked by dependency audit.'),
      capabilities: ['co-worker orchestration', 'task queues', 'heartbeats', 'budgets', 'work products'],
      blockers: ['production_install_blocked_by_dependency_audit'],
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

    expect(layer.discovery_tools).toEqual(expect.arrayContaining([
      'getSystems',
      'getSources',
      'getSchemas',
      'getTools',
      'getSkills',
      'getAgents',
      'getModels',
      'getIntegrations',
      'getBrainSystems',
      'getBlockedReasons',
    ]))
    expect(layer.discovery_tools).toContain('executeAction')
    expect(layer.nodes.length).toBeGreaterThanOrEqual(10)
    expect(layer.nodes.every((node) => typeof node.owner_visible_summary === 'string')).toBe(true)
    expect(layer.nodes.every((node) => typeof node.read_enabled === 'boolean')).toBe(true)
    expect(layer.nodes.every((node) => typeof node.execution_enabled === 'boolean')).toBe(true)
  })

  it('exposes systems, agents, skills, tools, integrations, Brain systems, and blockers before execution', () => {
    const layer = buildGatewayDataLayer(registry)

    expect(getSystems(layer).map((system) => system.id)).toContain('system.runtime_engine')
    expect(getSystems(layer).map((system) => system.id)).toContain('system.workforce_layer')
    expect(getAgents(layer).map((agent) => agent.name)).toEqual(expect.arrayContaining(['Agent Zero', 'Space Agent']))
    expect(getSkills(layer).map((skill) => skill.name)).toContain('Report Skill')
    expect(getTools(layer).map((tool) => tool.name)).toContain('Zapier MCP')
    expect(getIntegrations(layer).map((integration) => integration.name)).toEqual(expect.arrayContaining([
      'Firecrawl',
      'Telegram Delivery',
    ]))
    expect(getBrainSystems(layer).map((brain) => brain.name)).toEqual(expect.arrayContaining([
      'Obsidian',
      'OpenClaw+ / Build-Wiki',
    ]))
    expect(getBlockedReasons(layer)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'missing_credential',
        count: 1,
        node_ids: expect.arrayContaining(['capability_api_firecrawl']),
        requires_bridge_session: false,
      }),
      expect.objectContaining({
        reason: 'delivery_adapter_not_proven',
        count: 1,
        node_ids: expect.arrayContaining(['capability_delivery_telegram']),
        requires_bridge_session: true,
      }),
      expect.objectContaining({
        reason: 'production_install_blocked_by_dependency_audit',
        count: 1,
        node_ids: expect.arrayContaining(['paperclip']),
        requires_bridge_session: false,
      }),
    ]))
  })

  it('keeps Paperclip visible as a blocked workforce layer before production activation', () => {
    const layer = buildGatewayDataLayer(registry)
    const paperclip = layer.nodes.find((node) => node.id === 'paperclip')

    expect(paperclip).toMatchObject({
      name: 'Paperclip',
      type: 'workforce_layer',
      status: 'blocked',
      connected: false,
      configured: true,
      read_enabled: false,
      write_enabled: false,
      execution_enabled: false,
      requires_bridge_session: false,
      blocked_reason: 'production_install_blocked_by_dependency_audit',
    })
    expect(paperclip?.semantic_context).toContain('workforce operations layer')
  })

  it('keeps Space Agent as a retained research specialist under Gateway supervision', () => {
    const layer = buildGatewayDataLayer(registry)
    const spaceAgent = layer.nodes.find((node) => node.id === 'space_agent')

    expect(spaceAgent).toMatchObject({
      type: 'specialist_agent',
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
    })
    expect(spaceAgent?.semantic_context).toContain('retained specialist agent')
    expect(spaceAgent?.semantic_context).toContain('cannot self-promote')
    expect(spaceAgent?.semantic_context).toContain('cannot bypass Gateway')
  })

  it('keeps OpenClaw+ as the retained runtime / skills engine', () => {
    const layer = buildGatewayDataLayer(registry)
    const openclaw = layer.nodes.find((node) => node.id === 'openclaw_plus')

    expect(openclaw).toMatchObject({
      type: 'runtime_engine',
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
    })
    expect(openclaw?.semantic_context).toContain('runtime / skills engine')
    expect(openclaw?.semantic_context).toContain('skills')
    expect(openclaw?.semantic_context).toContain('mini-agent execution')
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
    const before = JSON.stringify(layer)
    const result = executeAction(layer, { node_id: 'tool.report.create', action: 'create_report' })

    expect(result.ok).toBe(false)
    expect(result.execution_enabled).toBe(false)
    expect(result.accepted_for_execution).toBe(false)
    expect(result.requires_bridge_session).toBe(true)
    expect(result.blocked_reason).toContain('bridge_session')
    expect(JSON.stringify(layer)).toBe(before)
  })
})
