import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildAgentZeroReadOnlyContext,
  buildAgentZeroReadOnlyPrompt,
  getAgentZeroApiKeyState,
  sendAgentZeroReadOnlyMessage,
} from './agent-zero-bridge'

describe('Agent Zero read-only bridge connector', () => {
  it('reports missing external API auth without exposing a secret', () => {
    const state = getAgentZeroApiKeyState({})
    expect(state.present).toBe(false)
    expect(state.configured_env_name).toBeNull()
    expect(state.source_type).toBe('missing')
    expect(state.source_path).toBeNull()
    expect(state.redacted).toBeNull()
    expect(state.accepted_env_names).toContain('AGENT_ZERO_API_KEY')
    expect(state.accepted_file_env_name).toBe('AGENT_ZERO_API_KEY_FILE')
  })

  it('redacts configured Agent Zero API auth by name only', () => {
    const state = getAgentZeroApiKeyState({ AGENT_ZERO_API_KEY: 'secret-value' })
    expect(state.present).toBe(true)
    expect(state.configured_env_name).toBe('AGENT_ZERO_API_KEY')
    expect(state.source_type).toBe('environment')
    expect(state.redacted).toBe('AGENT_ZERO_API_KEY=<redacted>')
    expect(JSON.stringify(state)).not.toContain('secret-value')
  })

  it('reads Agent Zero API auth from a secret file and redacts the value', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-zero-key-'))
    const file = path.join(dir, 'agent-zero-api-key')
    fs.writeFileSync(file, 'file-secret-value\n', { mode: 0o600 })

    const state = getAgentZeroApiKeyState({ AGENT_ZERO_API_KEY_FILE: file })
    expect(state.present).toBe(true)
    expect(state.configured_env_name).toBe('AGENT_ZERO_API_KEY_FILE')
    expect(state.source_type).toBe('secret_file')
    expect(state.source_path).toBe(file)
    expect(state.redacted).toBe('AGENT_ZERO_API_KEY_FILE=<redacted>')
    expect(JSON.stringify(state)).not.toContain('file-secret-value')
  })

  it('blocks live Agent Zero chat before any call when auth is missing', async () => {
    const result = await sendAgentZeroReadOnlyMessage({
      ownerMessage: 'Can you see Mission Control?',
      env: {},
      context: buildAgentZeroReadOnlyContext({ providerIds: ['tony', 'agent_zero'] }),
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(503)
    expect(result.agent_zero_called).toBe(false)
    expect(result.blocker).toBe('agent_zero_external_api_key_missing')
    expect(result.execution_enabled).toBe(false)
    expect(result.writes_enabled).toBe(false)
  })

  it('builds a read-only Mission Control context and refuses execution claims', () => {
    const context = buildAgentZeroReadOnlyContext({
      providerIds: ['tony', 'agent_zero', 'zapier'],
      providerRegistry: [
        { id: 'agent_zero', name: 'Agent Zero', state: 'connected', category: 'agent', execution_enabled: false, direct_access: false, proxy_access: true },
        { id: 'openrouter', name: 'OpenRouter', state: 'visible', category: 'model_provider', execution_enabled: false, direct_access: false, proxy_access: true },
      ],
      agents: [
        { id: 'tony', status: 'active', role: 'runtime', execution_enabled: false, direct_access: false, proxy_access: true },
        { id: 'agent_zero', status: 'connected', role: 'reviewer', execution_enabled: false, direct_access: false, proxy_access: true },
      ],
      modelCatalog: [
        { alias: 'sonnet', provider: 'anthropic', name: 'anthropic/claude-sonnet-4-6' },
        { alias: 'gpt-4.1', provider: 'openai', name: 'openai/gpt-4.1' },
      ],
      modelProviderRegistry: [
        {
          id: 'openrouter',
          name: 'OpenRouter',
          status: 'connected',
          credential_present: true,
          credential_names: ['OPENROUTER_API_KEY'],
          credential_values_exposed: false,
          model_count: 2,
          models: ['anthropic/claude-sonnet-4-6', 'openai/gpt-4.1'],
          best_use_case: 'Router/fallback access to hosted models.',
          execution_mode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
          execution_enabled: false,
          bridge_session_required: true,
          direct_access: false,
          proxy_access: true,
          blocked_reason: null,
        },
        {
          id: 'anthropic',
          name: 'Anthropic / Claude',
          status: 'configured',
          credential_present: true,
          credential_names: ['ANTHROPIC_API_KEY'],
          credential_values_exposed: false,
          model_count: 1,
          models: ['anthropic/claude-sonnet-4-6'],
          best_use_case: 'High-quality reasoning and coding.',
          execution_mode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
          execution_enabled: false,
          bridge_session_required: true,
          direct_access: false,
          proxy_access: true,
          blocked_reason: null,
        },
        {
          id: 'openai',
          name: 'OpenAI',
          status: 'blocked',
          credential_present: false,
          credential_names: ['OPENAI_API_KEY'],
          credential_values_exposed: false,
          model_count: 1,
          models: ['openai/gpt-4.1'],
          best_use_case: 'General assistant work.',
          execution_mode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
          execution_enabled: false,
          bridge_session_required: true,
          direct_access: false,
          proxy_access: true,
          blocked_reason: 'openai_not_configured_or_not_visible_in_provider_registry',
        },
      ],
      skillNames: ['browser-use', 'documents'],
      integrationItems: [
        { id: 'mission_control', status: 'reachable', visibility: 'visible', direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
        { id: 'google_drive', status: 'visible_via_zapier_schema', visibility: 'visible', direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
      ],
      toolRegistry: [
        { id: 'mcp.zapier.tools.schema', status: 'connected', source: 'mcp_schema_passthrough', direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
        { id: 'build_wiki.farmer.status', status: 'visible', source: 'mission_control_build_wiki', direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
      ],
      mcpServers: [{ name: 'zapier', status: 'connected', transport: 'http', tool_count: 42, schema_available: true }],
      mcpEndpointSummaries: [
        {
          endpoint: '/api/mcp/servers/zapier/tools',
          method: 'GET',
          mcp_server_name: 'zapier',
          status: 'connected',
          reachable: true,
          tool_count: 42,
          schema_available: true,
          execution_enabled: false,
          bridge_session_required: true,
          blocked_reason: null,
          note: 'Read-only schema summary.',
        },
      ],
      mcpToolSchemaSummary: {
        tools_total: 42,
        schema_available: true,
        required_fields: ['instructions'],
        write_tools_total: 30,
        read_tools_total: 12,
      },
      mcpVisible: true,
      zapierVisible: true,
      zapierToolsTotal: 42,
      googleDriveVisible: true,
      oneDriveVisible: false,
      heygenVisible: true,
      heygenSchemaVisible: true,
      brainSources: [
        { source: 'obsidian', status: 'read_only', summary: 'vault visible' },
        { source: 'mempalace', status: 'read_only', summary: 'status visible' },
      ],
      timerActive: true,
      latestBuildWikiRunState: 'idle',
      bridgeSessionAvailable: true,
    })
    const prompt = buildAgentZeroReadOnlyPrompt('What can you see?', context)

    expect(context.mission_control.execution_enabled).toBe(false)
    expect(context.mission_control.writes_enabled).toBe(false)
    expect(context.execution_enabled).toBe(false)
    expect(context.bridge_session_required).toBe(true)
    expect(context.mission_control.status).toBe('connected')
    expect(context.mission_control.direct_access).toBe(false)
    expect(context.mission_control.proxy_access).toBe(true)
    expect(context.mission_control.surfaces).toContain('/api/bridge/agent-zero/ecosystem')
    expect(context.bridge.providers).toEqual(['agent_zero', 'tony', 'zapier'])
    expect(context.bridge.provider_registry.find((provider) => provider.id === 'agent_zero')?.execution_enabled).toBe(false)
    expect(context.bridge.mcp_servers).toEqual(['zapier'])
    expect(context.mcp.servers[0]).toMatchObject({ name: 'zapier', access: 'connected', tool_count: 42 })
    expect(context.mcp.servers[0]).toMatchObject({
      reachable: true,
      schema_available: true,
      execution_enabled: false,
      bridge_session_required: true,
      blocked_reason: null,
      tools_endpoint: '/api/mcp/servers/zapier/tools',
    })
    expect(context.mcp.endpoint_summaries[0]).toMatchObject({
      endpoint: '/api/mcp/servers/zapier/tools',
      mcp_server_name: 'zapier',
      reachable: true,
      tool_count: 42,
      schema_available: true,
      execution_enabled: false,
      bridge_session_required: true,
    })
    expect(context.mcp.tool_schema_summary.tools_total).toBe(42)
    expect(context.mcp.tool_schema_summary.required_fields).toContain('instructions')
    expect(context.mcp.execution_enabled).toBe(false)
    expect(context.mcp.writes_enabled).toBe(false)
    expect(context.agents.items.find((agent) => agent.id === 'agent_zero')?.execution_enabled).toBe(false)
    expect(context.agents.items.find((agent) => agent.id === 'tony')?.execution_enabled).toBe(false)
    expect(context.models.providers).toContain('openai')
    expect(context.models.provider_registry.find((provider) => provider.id === 'openrouter')?.status).toBe('connected')
    expect(context.models.provider_registry.find((provider) => provider.id === 'openrouter')?.credential_present).toBe(true)
    expect(context.models.provider_registry.find((provider) => provider.id === 'openrouter')?.credential_values_exposed).toBe(false)
    expect(context.models.provider_registry.find((provider) => provider.id === 'openai')?.status).toBe('blocked')
    expect(context.models.provider_registry.find((provider) => provider.id === 'openai')?.blocked_reason).toBe('openai_not_configured_or_not_visible_in_provider_registry')
    expect(context.models.execution_enabled).toBe(false)
    expect(context.models.bridge_session_required).toBe(true)
    expect(context.models.credential_values_exposed).toBe(false)
    expect(context.skills.writes_enabled).toBe(false)
    expect(context.tools.registry.find((tool) => tool.id === 'mcp.zapier.tools.schema')?.execution_enabled).toBe(false)
    expect(context.tools.google_drive_visible).toBe(true)
    expect(context.tools.onedrive_visible).toBe(false)
    expect(context.tools.execution_enabled).toBe(false)
    expect(context.integrations.items.every((integration) => integration.execution_enabled === false)).toBe(true)
    expect(context.brain.obsidian_visible).toBe(true)
    expect(context.brain.memory_writes_enabled).toBe(false)
    expect(context.opencloud_buildwiki.build_wiki_status_visible).toBe(true)
    expect(context.opencloud_buildwiki.direct_opencloud_access_visible).toBe(false)
    expect(context.opencloud_buildwiki.farmer_execution_enabled).toBe(false)
    expect(context.opencloud_buildwiki.timer_active).toBe(true)
    expect(context.delivery.external_delivery_writes_enabled).toBe(false)
    expect(context.bridge_session.execution_enabled).toBe(false)
    expect(context.bridge_session.blocked_scopes).toContain('docker_socket')
    expect(prompt).toContain('Mission Control read-only ecosystem test')
    expect(prompt).toContain('Do not run tools')
    expect(prompt).toContain('Bridge Session execution is not active')
    expect(prompt).toContain('Do not enumerate your internal Agent Zero tools')
    expect(prompt).toContain('models.provider_registry')
    expect(prompt).toContain('direct access versus Mission Control proxy')
    expect(prompt).toContain('"heygen_schema_visible":true')
    expect(prompt).toContain('"execution_enabled":false')
  })
})
