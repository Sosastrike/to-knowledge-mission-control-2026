import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAgentZeroEcosystemAgentRecord,
  buildAgentZeroReadOnlyContext,
  buildAgentZeroReadOnlyContractReply,
  buildAgentZeroReadOnlyPrompt,
  getAgentZeroApiKeyState,
  probeAgentZeroRuntime,
  sanitizeAgentZeroOwnerReply,
  sendAgentZeroReadOnlyMessage,
} from './agent-zero-bridge'

const sharedSkillFields = (name: string, source: string) => ({
  path: `/home/tony/.openclaw/skills/${name}`,
  skill_doc_path: `/home/tony/.openclaw/skills/${name}/SKILL.md`,
  required_tools: source === 'home_claude' ? [] : ['mission_control.read'],
  required_credentials: [],
  execution_requirements: ['bridge_session_required_for_execution'],
  blocked_reasons: source === 'home_claude' ? ['skill_metadata_missing'] : [],
  runtime_layer: 'OpenClaw+' as const,
  shared_runtime: true as const,
  owner_agent: null,
  available_to_agents: ['agent_zero', 'hermes'] as Array<'agent_zero' | 'hermes'>,
  legacy_controller_owns_skill_system: false as const,
})

const sharedSkillSourceFields = (root: string) => ({
  root_path: root,
  runtime_layer: 'OpenClaw+' as const,
  shared_runtime: true as const,
  owner_agent: null,
  available_to_agents: ['agent_zero', 'hermes'] as Array<'agent_zero' | 'hermes'>,
  legacy_controller_owns_skill_system: false as const,
})

describe('Agent Zero read-only bridge connector', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

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

  it('probes Agent Zero with HTTP health endpoints and no Docker requirement', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        gitinfo: {
          version: 'v1.2.3',
          commit_hash: 'agent-zero-test-sha',
        },
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    const result = await probeAgentZeroRuntime('http://agent-zero.test', {
      env: {},
      timeoutMs: 100,
    })

    expect(fetch.mock.calls.map((call) => String(call[0]))).toEqual([
      'http://agent-zero.test/api/health',
      'http://agent-zero.test/health',
    ])
    expect(result).toMatchObject({
      reachable: true,
      health_ok: true,
      health_endpoint: 'http://agent-zero.test/health',
      selected_endpoint: 'http://agent-zero.test/health',
      probe_strategy: 'http_health_endpoints',
      docker_required: false,
      docker_status: 'not_checked',
      version: 'v1.2.3',
      commit_hash: 'agent-zero-test-sha',
    })
    expect(result.checked_endpoints).toContain('http://agent-zero.test/api/status')
  })

  it('classifies Agent Zero as credential gated when health is reachable but API auth is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      gitinfo: { commit_hash: 'agent-zero-health-sha' },
    }), { status: 200 })))

    const record = await buildAgentZeroEcosystemAgentRecord({
      baseUrl: 'http://agent-zero.test',
      env: {},
      verifyChat: false,
    })

    expect(record.state).toBe('degraded')
    expect(record.canonical_status).toBe('CREDENTIAL_GATED')
    expect(record.blocker_class).toBe('CREDENTIAL_GATED')
    expect(record.runtime_detection).toMatchObject({
      strategy: 'http_health_endpoints',
      docker_required: false,
      docker_status: 'not_checked',
      selected_endpoint: 'http://agent-zero.test/api/health',
    })
    expect(record.proof_packet).toMatchObject({
      lane: 'Agent Zero',
      runtime_commit: 'agent-zero-health-sha',
      route_or_service_checked: 'http://agent-zero.test/api/health',
      result: 'CREDENTIAL_GATED',
      blocker: 'agent_zero_external_api_key_missing',
      blocker_class: 'CREDENTIAL_GATED',
      docker_required: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    })
  })

  it('classifies Agent Zero as service down when HTTP health cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })))

    const record = await buildAgentZeroEcosystemAgentRecord({
      baseUrl: 'http://agent-zero.test',
      env: { AGENT_ZERO_API_KEY: 'redacted-test-key' },
      verifyChat: false,
    })

    expect(record.state).toBe('offline')
    expect(record.canonical_status).toBe('SERVICE_DOWN')
    expect(record.blocker_class).toBe('SERVICE_DOWN')
    expect(record.proof_packet.blocker_class).toBe('SERVICE_DOWN')
    expect(JSON.stringify(record)).not.toContain('redacted-test-key')
  })

  it('builds a read-only Mission Control context and refuses execution claims', () => {
    const context = buildAgentZeroReadOnlyContext({
      providerIds: ['tony', 'agent_zero', 'zapier'],
      providerRegistry: [
        { id: 'agent_zero', name: 'Agent Zero', state: 'connected', category: 'agent', execution_enabled: false, direct_access: false, proxy_access: true },
        { id: 'tony', name: 'Tony', state: 'active', category: 'agent', execution_enabled: false, direct_access: false, proxy_access: true },
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
      skillRegistry: [
        {
          name: 'a0-development',
          source: 'agent_zero',
          source_label: 'Agent Zero deployed skills',
          ...sharedSkillFields('a0-development', 'agent_zero'),
          description: 'Development guide for extending Agent Zero.',
          dependencies: ['SKILL.md'],
          missing_dependencies: [],
          blocked_dependencies: [],
          safe_mode: 'metadata_only',
          status: 'visible',
          execution_enabled: false,
          writes_enabled: false,
          direct_access: false,
          proxy_access: true,
          blocked_reason: null,
        },
        {
          name: 'engineering-test',
          source: 'openclaw_plus',
          source_label: 'OpenClaw+ shared runtime skills',
          ...sharedSkillFields('engineering-test', 'openclaw_plus'),
          description: 'Run tests and report results.',
          dependencies: ['scripts'],
          missing_dependencies: [],
          blocked_dependencies: ['scripts:execution_disabled_in_read_only_context'],
          safe_mode: 'metadata_only',
          status: 'visible',
          execution_enabled: false,
          writes_enabled: false,
          direct_access: false,
          proxy_access: true,
          blocked_reason: null,
        },
        {
          name: 'legacy-empty-skill',
          source: 'home_claude',
          source_label: 'Safe home Claude skills',
          ...sharedSkillFields('legacy-empty-skill', 'home_claude'),
          description: 'Skill directory is visible, but metadata is missing.',
          dependencies: [],
          missing_dependencies: ['SKILL.md_or_skill.json'],
          blocked_dependencies: [],
          safe_mode: 'blocked',
          status: 'blocked',
          execution_enabled: false,
          writes_enabled: false,
          direct_access: false,
          proxy_access: true,
          blocked_reason: 'skill_metadata_missing',
        },
      ],
      skillSources: [
        { source: 'agent_zero', label: 'Agent Zero deployed skills', ...sharedSkillSourceFields('/home/tony/agent-zero-deploy/data/skills'), status: 'visible', total: 1, safe_mode: 'metadata_only', blocked_reason: null },
        { source: 'openclaw_plus', label: 'OpenClaw+ shared runtime skills', ...sharedSkillSourceFields('/home/tony/.openclaw/skills'), status: 'visible', total: 1, safe_mode: 'metadata_only', blocked_reason: null },
        { source: 'home_claude', label: 'Safe home Claude skills', ...sharedSkillSourceFields('/home/tony/.claude/skills'), status: 'visible', total: 1, safe_mode: 'metadata_only', blocked_reason: null },
      ],
      integrationItems: [
        { id: 'mission_control', status: 'reachable', visibility: 'visible', direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
        { id: 'google_drive', status: 'visible_via_zapier_schema', visibility: 'visible', direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
      ],
      integrationRegistry: [
        {
          id: 'google_drive',
          name: 'Google Drive',
          category: 'storage',
          status: 'connected',
          credential_present: false,
          missing_credential: false,
          credential_names: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
          credential_values_exposed: false,
          read_only: true,
          write_enabled: false,
          requires_bridge_session: true,
          execution_enabled: false,
          direct_access: false,
          proxy_access: true,
          tool_count: 2,
          source: 'zapier_mcp_schema',
          blocked_reason: null,
          notes: 'Visible through schema only.',
        },
        {
          id: 'firecrawl',
          name: 'Firecrawl',
          category: 'crawler',
          status: 'blocked',
          credential_present: false,
          missing_credential: true,
          credential_names: ['FIRECRAWL_API_KEY'],
          credential_values_exposed: false,
          read_only: true,
          write_enabled: false,
          requires_bridge_session: true,
          execution_enabled: false,
          direct_access: false,
          proxy_access: true,
          tool_count: null,
          source: 'mission_control_firecrawl_status',
          blocked_reason: 'credential_required',
          notes: 'Credential required.',
        },
        {
          id: 'mcp_tools',
          name: 'MCP tools',
          category: 'mcp',
          status: 'connected',
          credential_present: true,
          missing_credential: false,
          credential_names: ['ZAPIER_MCP_URL'],
          credential_values_exposed: false,
          read_only: true,
          write_enabled: false,
          requires_bridge_session: true,
          execution_enabled: false,
          direct_access: false,
          proxy_access: true,
          tool_count: 42,
          source: 'mcp_schema_passthrough',
          blocked_reason: null,
          notes: 'Schema listing only.',
        },
      ],
      toolRegistry: [
        { id: 'mcp.zapier.tools.schema', status: 'connected', source: 'mcp_schema_passthrough', direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
        { id: 'build_wiki.farmer.status', status: 'visible', source: 'mission_control_build_wiki', direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
        {
          id: 'mcp__zapier__google_drive_upload_file',
          name: 'Google Drive Upload File',
          status: 'connected',
          source: 'mcp_schema_passthrough',
          category: 'google_drive',
          mcp_server_name: 'zapier',
          schema_available: true,
          read_only: false,
          write_enabled: false,
          requires_bridge_session: true,
          missing_credential: false,
          direct_access: false,
          proxy_access: true,
          execution_enabled: false,
          writes_enabled: false,
          blocked_reason: 'tool_invocation_disabled_in_agent_zero_read_only_context',
        },
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
      brainRegistry: [
        {
          id: 'obsidian',
          name: 'Obsidian',
          status: 'visible',
          raw_state: 'read_ready',
          status_visible: true,
          read_available: true,
          write_available: false,
          blocked: false,
          blocked_reason: null,
          read_blocked_reason: null,
          write_blocked_reason: 'obsidian_write_adapter_disabled',
          read_adapter: 'available',
          write_adapter: 'blocked',
          read_content_enabled: true,
          write_content_enabled: false,
          memory_writes_enabled: false,
          direct_access: false,
          proxy_access: true,
          path_status: 'present',
          index_status: 'visible',
          last_sync_at: '2026-05-03T13:00:00.000Z',
          last_attempt_at: '2026-05-03T13:00:00.000Z',
          last_error: null,
          available_read_apis: ['/api/bridge/brain-sync/status', '/api/bridge/brain-context'],
          available_write_apis: [],
          blockers: ['obsidian_writes_disabled'],
          summary: 'Obsidian vault status visible and shared context read adapter available.',
          notes: 'Filesystem presence is not a direct Agent Zero tool.',
        },
        {
          id: 'mempalace',
          name: 'MemPalace',
          status: 'visible',
          raw_state: 'status_only',
          status_visible: true,
          read_available: true,
          write_available: false,
          blocked: false,
          blocked_reason: null,
          read_blocked_reason: null,
          write_blocked_reason: 'mempalace_write_adapter_disabled',
          read_adapter: 'status_only',
          write_adapter: 'blocked',
          read_content_enabled: false,
          write_content_enabled: false,
          memory_writes_enabled: false,
          direct_access: false,
          proxy_access: true,
          path_status: 'present',
          index_status: 'visible',
          last_sync_at: '2026-05-03T12:00:00.000Z',
          last_attempt_at: '2026-05-03T12:00:00.000Z',
          last_error: null,
          available_read_apis: ['/api/bridge/brain-sync/status'],
          available_write_apis: [],
          blockers: ['mempalace_status_only', 'mempalace_writes_disabled'],
          summary: 'MemPalace status visible only.',
          notes: 'No production read/write adapter yet.',
        },
        {
          id: 'graphify',
          name: 'Graphify',
          status: 'visible',
          raw_state: 'healthy',
          status_visible: true,
          read_available: true,
          write_available: false,
          blocked: false,
          blocked_reason: null,
          read_blocked_reason: null,
          write_blocked_reason: 'graphify_write_adapter_disabled',
          read_adapter: 'status_only',
          write_adapter: 'blocked',
          read_content_enabled: false,
          write_content_enabled: false,
          memory_writes_enabled: false,
          direct_access: false,
          proxy_access: true,
          path_status: 'present',
          index_status: 'visible',
          last_sync_at: '2026-05-03T11:00:00.000Z',
          last_attempt_at: '2026-05-03T11:00:00.000Z',
          last_error: null,
          available_read_apis: ['/api/bridge/brain-sync/status', '/api/memory/graph'],
          available_write_apis: [],
          blockers: ['graphify_rebuild_disabled_without_owner_approval'],
          summary: 'Graphify artifact status visible.',
          notes: 'No direct Graphify control.',
        },
        {
          id: 'brain_watchers',
          name: 'Brain watchers',
          status: 'visible',
          raw_state: 'sync_snapshots_visible',
          status_visible: true,
          read_available: true,
          write_available: false,
          blocked: false,
          blocked_reason: null,
          read_blocked_reason: null,
          write_blocked_reason: 'brain_watchers_write_adapter_disabled',
          read_adapter: 'status_only',
          write_adapter: 'blocked',
          read_content_enabled: false,
          write_content_enabled: false,
          memory_writes_enabled: false,
          direct_access: false,
          proxy_access: true,
          path_status: 'not_applicable',
          index_status: 'not_connected',
          last_sync_at: '2026-05-03T13:00:00.000Z',
          last_attempt_at: null,
          last_error: null,
          available_read_apis: ['/api/bridge/brain-sync/status'],
          available_write_apis: [],
          blockers: ['watcher_status_inferred_from_sync_snapshots_no_direct_control_adapter'],
          summary: 'Watcher status inferred from snapshots.',
          notes: 'No watcher control.',
        },
      ],
      brainReadApis: [
        {
          endpoint: '/api/bridge/brain-sync/status',
          method: 'GET',
          status: 'connected',
          purpose: 'Read-only Brain Sync status.',
          read_only: true,
          write_enabled: false,
          requires_owner_approval: false,
          requires_bridge_session: false,
          execution_enabled: false,
          direct_access: false,
          proxy_access: true,
          blocked_reason: null,
        },
        {
          endpoint: '/api/bridge/brain-context',
          method: 'GET',
          status: 'connected',
          purpose: 'Shared brain context proxy.',
          read_only: true,
          write_enabled: false,
          requires_owner_approval: false,
          requires_bridge_session: false,
          execution_enabled: false,
          direct_access: false,
          proxy_access: true,
          blocked_reason: null,
        },
      ],
      brainWriteApis: [
        {
          endpoint: '/api/memory/search',
          method: 'POST',
          status: 'blocked',
          purpose: 'Index rebuild blocked for Agent Zero.',
          read_only: false,
          write_enabled: false,
          requires_owner_approval: true,
          requires_bridge_session: true,
          execution_enabled: false,
          direct_access: false,
          proxy_access: true,
          blocked_reason: 'agent_zero_read_only_context_write_disabled',
        },
      ],
      brainWatchers: {
        status: 'visible',
        status_visible: true,
        direct_control_enabled: false,
        execution_enabled: false,
        direct_access: false,
        proxy_access: true,
        last_seen_at: '2026-05-03T13:00:00.000Z',
        sources: ['obsidian', 'mempalace', 'graphify'],
        blockers: ['watcher_status_inferred_from_sync_snapshots_no_direct_control_adapter'],
        summary: 'Watcher status inferred from sync snapshots.',
      },
      brainIndexStatus: {
        status: 'visible',
        indexed_records: 123,
        indexed_sources: ['obsidian', 'mempalace', 'graphify'],
        last_indexed_at: '2026-05-03T13:00:00.000Z',
        search_read_api_available: true,
        rebuild_write_api_enabled: false,
        blockers: ['index_rebuild_write_disabled_for_agent_zero'],
      },
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
    expect(context.mission_control.surfaces).toContain('/api/bridge/agent-zero/reports')
    expect(context.mission_control.surfaces).toContain('/api/bridge/agent-zero/google-drive/status')
    expect(context.mission_control.surfaces).toContain('/api/bridge/agent-zero/onedrive/status')
    expect(context.bridge.providers).toEqual(['agent_zero', 'zapier'])
    expect(context.bridge.provider_registry.find((provider) => provider.id === 'agent_zero')?.execution_enabled).toBe(false)
    expect(context.bridge.provider_registry.find((provider) => provider.id === 'tony')).toBeUndefined()
    expect(context.bridge.provider_registry.find((provider) => provider.id === 'tony_legacy')).toBeUndefined()
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
    expect(context.agents.items.find((agent) => agent.id === 'tony')).toBeUndefined()
    expect(context.agents.items.find((agent) => agent.id === 'tony_legacy')).toBeUndefined()
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
    expect(context.skills.execution_enabled).toBe(false)
    expect(context.skills.bridge_session_required).toBe(true)
    expect(context.skills.registry.find((skill) => skill.name === 'a0-development')?.source).toBe('agent_zero')
    expect(context.skills.registry.find((skill) => skill.name === 'engineering-test')?.blocked_dependencies).toContain('scripts:execution_disabled_in_read_only_context')
    expect(context.skills.registry.find((skill) => skill.name === 'legacy-empty-skill')?.status).toBe('blocked')
    expect(context.skills.blocked_total).toBe(2)
    expect(context.skills.missing_dependencies_total).toBe(2)
    expect(context.skills.sources.map((source) => source.source)).toContain('home_claude')
    expect(context.tools.registry.find((tool) => tool.id === 'mcp.zapier.tools.schema')?.execution_enabled).toBe(false)
    expect(context.tools.registry.find((tool) => tool.id === 'mcp__zapier__google_drive_upload_file')?.write_enabled).toBe(false)
    expect(context.tools.registry.find((tool) => tool.id === 'mcp__zapier__google_drive_upload_file')?.requires_bridge_session).toBe(true)
    expect(context.tools.mcp_tools_total).toBe(1)
    expect(context.tools.write_enabled_total).toBe(0)
    expect(context.tools.bridge_session_required_total).toBe(1)
    expect(context.tools.google_drive_visible).toBe(true)
    expect(context.tools.onedrive_visible).toBe(false)
    expect(context.tools.execution_enabled).toBe(false)
    expect(context.integrations.items.every((integration) => integration.execution_enabled === false)).toBe(true)
    expect(context.integrations.registry.find((integration) => integration.id === 'google_drive')?.status).toBe('connected')
    expect(context.integrations.registry.find((integration) => integration.id === 'google_drive')?.requires_bridge_session).toBe(true)
    expect(context.integrations.registry.find((integration) => integration.id === 'firecrawl')?.missing_credential).toBe(true)
    expect(context.integrations.registry.every((integration) => integration.credential_values_exposed === false)).toBe(true)
    expect(context.integrations.write_enabled_total).toBe(0)
    expect(context.integrations.bridge_session_required_total).toBe(3)
    const obsidian = context.brain.registry.find((source) => source.id === 'obsidian')
    const mempalace = context.brain.registry.find((source) => source.id === 'mempalace')
    const graphify = context.brain.registry.find((source) => source.id === 'graphify')
    expect(context.brain.obsidian_visible).toBe(true)
    expect(obsidian?.read_content_enabled).toBe(true)
    expect(obsidian?.read_available).toBe(true)
    expect(obsidian?.write_available).toBe(false)
    expect(obsidian?.blocked).toBe(false)
    expect(obsidian?.write_content_enabled).toBe(false)
    expect(mempalace?.read_adapter).toBe('status_only')
    expect(mempalace?.read_available).toBe(true)
    expect(mempalace?.write_available).toBe(false)
    expect(mempalace?.read_content_enabled).toBe(false)
    expect(graphify?.read_available).toBe(true)
    expect(graphify?.write_adapter).toBe('blocked')
    expect(graphify?.write_available).toBe(false)
    expect(context.brain.brain_watchers.direct_control_enabled).toBe(false)
    expect(context.brain.vault_path_status.obsidian).toBe('present')
    expect(context.brain.index_status.rebuild_write_api_enabled).toBe(false)
    expect(context.brain.available_read_apis.map((api) => api.endpoint)).toContain('/api/bridge/brain-context')
    expect(context.brain.available_write_apis[0]).toMatchObject({
      endpoint: '/api/memory/search',
      method: 'POST',
      status: 'blocked',
      write_enabled: false,
      requires_owner_approval: true,
    })
    expect(context.brain.blockers).toContain('mempalace_status_only')
    expect(context.brain.memory_writes_enabled).toBe(false)
    expect(context.opencloud_buildwiki.build_wiki_status_visible).toBe(true)
    expect(context.opencloud_buildwiki.read_available).toBe(true)
    expect(context.opencloud_buildwiki.write_available).toBe(true)
    expect(context.opencloud_buildwiki.blocked).toBe(false)
    expect(context.opencloud_buildwiki.direct_opencloud_access_visible).toBe(false)
    expect(context.opencloud_buildwiki.farmer_execution_enabled).toBe(false)
    expect(context.opencloud_buildwiki.timer_active).toBe(true)
    expect(context.opencloud_buildwiki.routes.status).toMatchObject({ method: 'GET', read_only: true, execution_enabled: false })
    expect(context.opencloud_buildwiki.routes.run_now_create).toMatchObject({ method: 'POST', read_only: false, execution_enabled: false, requires_bridge_session: true })
    expect(context.opencloud_buildwiki.run_now).toMatchObject({
      action: 'buildwiki.run_now',
      target_service: 'opencloud-docs-farmer.service',
      owner_approval_required: true,
      bridge_session_required: true,
      execution_enabled: false,
      dispatch_scope: 'opencloud-docs-farmer.service',
    })
    expect(context.opencloud_buildwiki.fork_state.fork1).toMatchObject({ state: 'visible', execution_enabled: false, scope: 'opencloud-docs-farmer.service' })
    expect(context.opencloud_buildwiki.fork_state.fork2).toMatchObject({ state: 'blocked', smb_mounted: false, execution_enabled: false })
    expect(context.opencloud_buildwiki.smb).toMatchObject({ required_for_fork2: true, mounted: false, mount_status: 'blocked' })
    expect(context.delivery.agent_zero_report_delivery_status).toBe('visible')
    expect(context.delivery.agent_zero_report_create_endpoint).toBe('/api/bridge/agent-zero/reports')
    expect(context.delivery.google_drive_delivery_adapter_status).toBe('blocked')
    expect(context.delivery.google_drive_upload_connector_configured).toBe(false)
    expect(context.delivery.google_drive_status_endpoint).toBe('/api/bridge/agent-zero/google-drive/status')
    expect(context.delivery.google_drive_upload_report_endpoint).toBe('/api/bridge/agent-zero/google-drive/upload-report')
    expect(context.delivery.onedrive_delivery_adapter_status).toBe('blocked')
    expect(context.delivery.onedrive_upload_connector_configured).toBe(false)
    expect(context.delivery.onedrive_status_endpoint).toBe('/api/bridge/agent-zero/onedrive/status')
    expect(context.delivery.onedrive_upload_report_endpoint).toBe('/api/bridge/agent-zero/onedrive/upload-report')
    expect(context.delivery.agent_zero_pdf_download_endpoint).toBe('/api/bridge/agent-zero/reports/:id/pdf')
    expect(context.delivery.telegram_pdf_attachment_status).toBe('blocked')
    expect(context.delivery.mission_control_report_links_enabled).toBe(true)
    expect(context.delivery.raw_local_paths_exposed).toBe(false)
    expect(context.delivery.task_ids_in_normal_replies).toBe(false)
    expect(context.delivery.external_delivery_writes_enabled).toBe(false)
    expect(context.bridge_session.execution_enabled).toBe(false)
    expect(context.bridge_session.blocked_scopes).toContain('docker_socket')
    expect(prompt).toContain('Mission Control ecosystem test')
    expect(prompt).toContain('If bridge_session.execution_enabled is false, execution is disabled')
    expect(prompt).toContain('Do not ask for repeated approval for small steps inside the active session')
    expect(prompt).toContain('Do not enumerate your internal Agent Zero tools')
    expect(prompt).toContain('models.provider_registry')
    expect(prompt).toContain('skills.registry')
    expect(prompt).toContain('integrations.registry')
    expect(prompt).toContain('brain.registry')
    expect(prompt).toContain('direct access versus Mission Control proxy')
    expect(prompt).toContain('delivery.agent_zero_report_create_endpoint')
    expect(prompt).toContain('delivery.google_drive_status_endpoint')
    expect(prompt).toContain('Google Drive upload is blocked because the upload connector is not configured')
    expect(prompt).toContain('delivery.onedrive_status_endpoint')
    expect(prompt).toContain('OneDrive upload is blocked because the upload connector is not configured')
    expect(prompt).toContain('Do not expose local paths')
    expect(prompt).toContain('"heygen_schema_visible":true')
    expect(prompt).toContain('"execution_enabled":false')
  })

  it('suppresses Agent Zero container workdir paths in owner-facing replies', () => {
    const reply = sanitizeAgentZeroOwnerReply({
      text: 'Created **Current Status.md**.\nPath: `/a0/usr/workdir/Current Status.md`',
      ownerMessage: 'What tools can you see?',
    })

    expect(reply).not.toContain('/a0/usr/workdir')
    expect(reply).not.toContain('/home/tony')
  })

  it('replaces unsafe local artifact answers with registry-based capability replies', () => {
    const context = buildAgentZeroReadOnlyContext({
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
      ],
      mcpServers: [{ name: 'zapier', status: 'configured', tool_count: 3, reachable: true, schema_available: true }],
      skillNames: ['engineering-test'],
      integrationRegistry: [
        { id: 'firecrawl', name: 'Firecrawl', category: 'crawler', status: 'blocked', credential_present: false, missing_credential: true, credential_names: ['FIRECRAWL_API_KEY'], credential_values_exposed: false, read_only: true, write_enabled: false, requires_bridge_session: true, execution_enabled: false, direct_access: false, proxy_access: true, tool_count: null, source: 'mission_control_firecrawl_status', blocked_reason: 'credential_required', notes: 'Credential required.' },
      ],
    })
    const reply = buildAgentZeroReadOnlyContractReply({
      ownerMessage: 'What tools, models, skills, and integrations can you see?',
      context,
      upstreamText: 'Created **Mission Control Provider Summary.md**.\nPath: `/a0/usr/workdir/Mission Control Provider Summary.md`',
      upstreamReturnedLocalArtifact: true,
    })

    expect(reply).toContain('Mission Control through the live Bridge')
    expect(reply).toContain('OpenRouter')
    expect(reply).toContain('Firecrawl')
    expect(reply).not.toContain('/a0/usr/workdir')
    expect(reply).not.toMatch(/^Created /)
  })


  it('answers mixed capability and brain prompts with the full registry summary', () => {
    const context = buildAgentZeroReadOnlyContext({
      modelProviderRegistry: [
        { id: 'openrouter', name: 'OpenRouter', status: 'configured', credential_present: true, credential_names: ['OPENROUTER_API_KEY'], credential_values_exposed: false, model_count: 1, models: ['anthropic/claude-sonnet-4-6'], best_use_case: 'Router/fallback access to hosted models.', execution_mode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session', execution_enabled: false, bridge_session_required: true, direct_access: false, proxy_access: true, blocked_reason: null },
      ],
      skillNames: ['engineering-test'],
      integrationRegistry: [
        { id: 'firecrawl', name: 'Firecrawl', category: 'crawler', status: 'blocked', credential_present: false, missing_credential: true, credential_names: ['FIRECRAWL_API_KEY'], credential_values_exposed: false, read_only: true, write_enabled: false, requires_bridge_session: true, execution_enabled: false, direct_access: false, proxy_access: true, tool_count: null, source: 'mission_control_firecrawl_status', blocked_reason: 'credential_required', notes: 'Credential required.' },
      ],
      brainSources: [{ source: 'obsidian', status: 'connected', summary: 'visible' }],
    })
    const reply = buildAgentZeroReadOnlyContractReply({
      ownerMessage: 'What tools, models, skills, integrations, and brain systems can you see?',
      context,
    })

    expect(reply).toContain('Mission Control through the live Bridge')
    expect(reply).toContain('models')
    expect(reply).toContain('OpenClaw+ skills')
    expect(reply).toContain('integrations')
  })

  it('answers skill inventory prompts from the shared registry', () => {
    const context = buildAgentZeroReadOnlyContext({
      skillNames: ['engineering-test'],
      skillRegistry: [
        {
          name: 'engineering-test',
          source: 'openclaw_plus',
          source_label: 'OpenClaw+ shared runtime skills',
          ...sharedSkillFields('engineering-test', 'openclaw_plus'),
          description: 'Run tests and report results.',
          dependencies: ['scripts'],
          missing_dependencies: [],
          blocked_dependencies: ['scripts:execution_disabled_in_read_only_context'],
          safe_mode: 'metadata_only',
          status: 'visible',
          execution_enabled: false,
          writes_enabled: false,
          direct_access: false,
          proxy_access: true,
          blocked_reason: 'bridge_session_required_for_execution',
        },
      ],
    })
    const reply = buildAgentZeroReadOnlyContractReply({
      ownerMessage: 'What skills can you use?',
      context,
    })

    expect(reply).toContain('shared OpenClaw+ skills')
    expect(reply).toContain('engineering-test')
    expect(reply).toContain('Agent Zero and Hermes')
    expect(reply).toContain('shared runtime policy')
    expect(reply).toContain('Bridge Session')
  })

  it('selects a registry skill for safe report planning without executing it', () => {
    const context = buildAgentZeroReadOnlyContext({
      skillRegistry: [
        {
          name: 'engineering-test',
          source: 'openclaw_plus',
          source_label: 'OpenClaw+ shared runtime skills',
          ...sharedSkillFields('engineering-test', 'openclaw_plus'),
          description: 'Run tests and report results.',
          dependencies: ['scripts'],
          missing_dependencies: [],
          blocked_dependencies: ['scripts:execution_disabled_in_read_only_context'],
          safe_mode: 'metadata_only',
          status: 'visible',
          execution_enabled: false,
          writes_enabled: false,
          direct_access: false,
          proxy_access: true,
          blocked_reason: 'bridge_session_required_for_execution',
        },
      ],
    })
    const reply = buildAgentZeroReadOnlyContractReply({
      ownerMessage: 'Which skill would you use for a safe report task? Do not execute.',
      context,
    })

    expect(reply).toContain('engineering-test')
    expect(reply).toContain('I did not execute it')
    expect(reply).toContain('Bridge Session')
  })

  it('keeps execution-capable skills blocked without a Bridge Session', () => {
    const reply = buildAgentZeroReadOnlyContractReply({
      ownerMessage: 'Can execution-capable skills run without a Bridge Session?',
      context: buildAgentZeroReadOnlyContext(),
    })

    expect(reply).toContain('No, Sir')
    expect(reply).toContain('execution_enabled=false')
    expect(reply).toContain('requires_bridge_session=true')
    expect(reply).toContain('no skill execution occurred')
  })

  it('blocks email sends from read-only chat with a bridge session explanation', () => {
    const reply = buildAgentZeroReadOnlyContractReply({
      ownerMessage: 'Send a test email.',
      context: buildAgentZeroReadOnlyContext(),
    })

    expect(reply).toContain('Email send is blocked')
    expect(reply).toContain('Bridge Session')
    expect(reply).toContain('I did not send an email')
  })

  it('answers Tony active checks without contradictory yes wording', () => {
    const reply = buildAgentZeroReadOnlyContractReply({
      ownerMessage: 'Is Tony still active?',
      context: buildAgentZeroReadOnlyContext(),
    })

    expect(reply).toBe('No, Sir. Tony is not part of the active system. Agent Zero is the active commander.')
  })

})
