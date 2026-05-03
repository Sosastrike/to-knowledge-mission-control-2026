import { describe, expect, it } from 'vitest'
import {
  AGENT_ZERO_LIVE_REGISTRY_STATES,
  buildAgentZeroReadOnlyContext,
  type AgentZeroBrainSourceRegistryItem,
  type AgentZeroIntegrationCapability,
  type AgentZeroModelProviderSummary,
  type AgentZeroToolRegistryItem,
} from './agent-zero-bridge'

const integration = (
  id: string,
  name: string,
  status: AgentZeroIntegrationCapability['status'],
  missingCredential = false,
): AgentZeroIntegrationCapability => ({
  id,
  name,
  category: id === 'firecrawl' ? 'crawler' : id === 'heygen' ? 'media' : id === 'zapier' ? 'automation' : id === 'telegram' || id === 'whatsapp' ? 'messaging' : 'storage',
  status,
  credential_present: !missingCredential && status !== 'blocked',
  missing_credential: missingCredential,
  credential_names: [`${id.toUpperCase()}_TOKEN`],
  credential_values_exposed: false,
  read_only: true,
  write_enabled: false,
  requires_bridge_session: true,
  execution_enabled: false,
  direct_access: false,
  proxy_access: true,
  tool_count: status === 'blocked' ? 0 : 1,
  source: 'test_registry',
  blocked_reason: status === 'blocked' ? `${id}_blocked` : null,
  notes: `${name} test capability.`,
})

const brain = (
  id: 'obsidian' | 'mempalace' | 'graphify',
  name: string,
  writeAdapter: AgentZeroBrainSourceRegistryItem['write_adapter'] = 'blocked',
): AgentZeroBrainSourceRegistryItem => ({
  id,
  name,
  status: 'connected',
  raw_state: 'connected',
  status_visible: true,
  read_available: true,
  write_available: writeAdapter === 'available',
  blocked: false,
  blocked_reason: null,
  read_blocked_reason: null,
  write_blocked_reason: writeAdapter === 'available' ? null : `${id}_write_adapter_disabled`,
  read_adapter: 'available',
  write_adapter: writeAdapter,
  read_content_enabled: true,
  write_content_enabled: false,
  memory_writes_enabled: false,
  direct_access: false,
  proxy_access: true,
  path_status: 'present',
  index_status: 'connected',
  last_sync_at: '2026-05-03T00:00:00.000Z',
  last_attempt_at: null,
  last_error: null,
  available_read_apis: ['/api/bridge/brain-sync/status'],
  available_write_apis: writeAdapter === 'available' ? ['/api/bridge/agent-zero/execute'] : [],
  blockers: writeAdapter === 'available' ? [] : [`${id}_write_adapter_disabled`],
  summary: `${name} is visible through Mission Control.`,
  notes: 'Test brain registry item.',
})

describe('Agent Zero live ecosystem registry', () => {
  it('exposes one required registry with exact status vocabulary', () => {
    const modelProvider: AgentZeroModelProviderSummary = {
      id: 'openrouter',
      name: 'OpenRouter',
      status: 'configured',
      credential_present: true,
      credential_names: ['OPENROUTER_API_KEY'],
      credential_values_exposed: false,
      model_count: 2,
      models: ['openrouter/anthropic/claude-sonnet-4', 'openrouter/openai/gpt-4.1'],
      best_use_case: 'Model routing through Mission Control.',
      execution_mode: 'Bridge Session required.',
      execution_enabled: false,
      bridge_session_required: true,
      direct_access: false,
      proxy_access: true,
      blocked_reason: null,
    }
    const tool: AgentZeroToolRegistryItem = {
      id: 'report.create',
      name: 'Create report',
      status: 'connected',
      source: 'mission_control',
      category: 'report',
      mcp_server_name: null,
      schema_available: true,
      read_only: true,
      write_enabled: false,
      requires_bridge_session: false,
      missing_credential: false,
      direct_access: false,
      proxy_access: true,
      execution_enabled: false,
      writes_enabled: false,
      blocked_reason: null,
    }

    const context = buildAgentZeroReadOnlyContext({
      providerIds: ['agent_zero', 'openrouter', 'zapier'],
      providerRegistry: [
        { id: 'agent_zero', name: 'Agent Zero', state: 'active', category: 'agent', execution_enabled: false, direct_access: false, proxy_access: true },
        { id: 'openrouter', name: 'OpenRouter', state: 'configured', category: 'model', execution_enabled: false, direct_access: false, proxy_access: true },
      ],
      agents: [{ id: 'agent_zero', status: 'active', role: 'commander', execution_enabled: false, direct_access: false, proxy_access: true }],
      modelCatalog: [
        { alias: 'sonnet', provider: 'openrouter', name: 'openrouter/anthropic/claude-sonnet-4' },
      ],
      modelProviderRegistry: [modelProvider],
      skillNames: ['reporting'],
      skillRegistry: [],
      integrationRegistry: [
        integration('firecrawl', 'Firecrawl', 'blocked', true),
        integration('zapier', 'Zapier', 'connected'),
        integration('heygen', 'HeyGen', 'configured'),
        integration('email', 'Email providers', 'blocked', true),
        integration('google_drive', 'Google Drive', 'blocked', true),
        integration('onedrive', 'OneDrive', 'blocked', true),
        integration('telegram', 'Telegram', 'connected'),
        integration('whatsapp', 'WhatsApp', 'blocked', true),
      ],
      toolRegistry: [tool],
      mcpServers: [{
        name: 'zapier',
        status: 'connected',
        transport: 'http',
        tool_count: 4,
        reachable: true,
        schema_available: true,
        blocked_reason: null,
        tools_endpoint: '/api/mcp/servers/zapier/tools',
      }],
      mcpToolSchemaSummary: {
        tools_total: 4,
        schema_available: true,
        required_fields: ['instructions'],
        read_tools_total: 2,
        write_tools_total: 2,
      },
      mcpVisible: true,
      zapierVisible: true,
      zapierToolsTotal: 4,
      googleDriveVisible: false,
      oneDriveVisible: false,
      heygenVisible: true,
      heygenSchemaVisible: true,
      brainRegistry: [
        brain('obsidian', 'Obsidian'),
        brain('mempalace', 'MemPalace', 'available'),
        brain('graphify', 'Graphify'),
      ],
      buildWikiFarmerStatus: undefined,
      timerActive: true,
      bridgeSessionAvailable: false,
    })

    const registry = context.live_registry
    const ids = new Set(registry.items.map((item) => item.id))
    expect(registry.mode).toBe('agent_zero_live_ecosystem_registry')
    expect(registry.vocabulary).toEqual([...AGENT_ZERO_LIVE_REGISTRY_STATES])
    expect(registry.missing_required_items).toEqual([])
    for (const required of registry.required_items) expect(ids.has(required)).toBe(true)
    for (const item of registry.items) {
      expect(item.credential_values_exposed).toBe(false)
      expect(item.states.length).toBeGreaterThan(0)
      for (const state of item.states) expect(AGENT_ZERO_LIVE_REGISTRY_STATES).toContain(state)
    }
    expect(registry.items.find((item) => item.id === 'google_drive')?.states).toContain('missing credential')
    expect(registry.items.find((item) => item.id === 'mempalace')?.states).toContain('write-enabled')
    expect(JSON.stringify(registry)).not.toMatch(/sk-[A-Za-z0-9]|AIzaSy|xox[baprs]-/)
  })
})
