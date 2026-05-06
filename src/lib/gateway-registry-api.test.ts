import { describe, expect, it } from 'vitest'
import type { AgentZeroReadOnlyContext } from './agent-zero-bridge'
import {
  buildGatewayFlowsPayload,
  buildGatewayPoliciesPayload,
  buildGatewayNodesPayload,
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
        model_count: 2,
        models: ['openrouter/anthropic/claude-sonnet-4', 'openrouter/openai/gpt-4.1'],
      },
      {
        id: 'openai',
        name: 'OpenAI',
        status: 'configured',
        credential_present: true,
        credential_names: ['OPENAI_API_KEY'],
        bridge_session_required: true,
        blocked_reason: null,
        models: ['openai/gpt-4.1'],
      },
      {
        id: 'anthropic',
        name: 'Anthropic / Claude',
        status: 'configured',
        credential_present: true,
        credential_names: ['ANTHROPIC_API_KEY'],
        bridge_session_required: true,
        blocked_reason: null,
        models: ['anthropic/claude-sonnet-4'],
      },
      {
        id: 'google',
        name: 'Gemini / Google',
        status: 'blocked',
        credential_present: false,
        credential_names: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
        bridge_session_required: true,
        blocked_reason: 'missing_credential',
        models: [],
      },
      {
        id: 'ollama',
        name: 'Ollama / Local',
        status: 'connected',
        credential_present: false,
        credential_names: [],
        bridge_session_required: true,
        blocked_reason: null,
        models: ['llama3.2'],
      },
      {
        id: 'groq',
        name: 'Groq',
        status: 'configured',
        credential_present: true,
        credential_names: ['GROQ_API_KEY'],
        bridge_session_required: true,
        blocked_reason: null,
        models: ['groq/llama-3.3'],
      },
    ],
    catalog: [
      { alias: 'sonnet', provider: 'openrouter', name: 'openrouter/anthropic/claude-sonnet-4' },
      { alias: 'gpt-4.1', provider: 'openai', name: 'openai/gpt-4.1' },
      { alias: 'claude', provider: 'anthropic', name: 'anthropic/claude-sonnet-4' },
      { alias: 'gemini', provider: 'google', name: 'google/gemini-2.5-pro' },
      { alias: 'llama', provider: 'ollama', name: 'llama3.2' },
    ],
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
        schema_visible: false,
        reachable: false,
        blocked_reason: 'missing_credential',
      },
      {
        id: 'zapier',
        name: 'Zapier',
        status: 'configured',
        read_only: true,
        write_enabled: false,
        requires_bridge_session: true,
        missing_credential: false,
        credential_present: true,
        credential_names: ['ZAPIER_TOKEN'],
        schema_visible: true,
        reachable: true,
        tool_count: 4,
        blocked_reason: null,
      },
      {
        id: 'heygen',
        name: 'HeyGen',
        status: 'configured',
        read_only: true,
        write_enabled: false,
        requires_bridge_session: true,
        missing_credential: false,
        credential_present: true,
        credential_names: ['HEYGEN_API_KEY'],
        schema_visible: true,
        reachable: true,
        blocked_reason: null,
      },
      {
        id: 'agentmail',
        name: 'AgentMail',
        status: 'configured',
        read_only: true,
        write_enabled: false,
        requires_bridge_session: true,
        missing_credential: false,
        credential_present: true,
        credential_names: ['AGENTMAIL_API_KEY'],
        incoming_status: 'connected',
        outgoing_status: 'blocked_pending_bridge_session',
        domain_rules: 'owner_domain_only',
        blocked_reason: null,
      },
      {
        id: 'google_drive',
        name: 'Google Drive',
        status: 'blocked',
        read_only: true,
        write_enabled: false,
        requires_bridge_session: true,
        missing_credential: true,
        credential_names: ['GOOGLE_DRIVE_CREDENTIALS'],
        upload_connector_configured: false,
        folder_lookup_available: false,
        blocked_reason: 'missing_credential',
      },
      {
        id: 'onedrive',
        name: 'OneDrive',
        status: 'configured',
        read_only: true,
        write_enabled: false,
        requires_bridge_session: true,
        missing_credential: false,
        credential_present: true,
        credential_names: ['ONEDRIVE_TOKEN'],
        upload_connector_configured: true,
        folder_lookup_available: true,
        blocked_reason: null,
      },
      {
        id: 'n8n',
        name: 'n8n',
        status: 'blocked',
        read_only: true,
        write_enabled: false,
        requires_bridge_session: true,
        missing_credential: true,
        credential_names: ['N8N_API_KEY'],
        installed: false,
        running: false,
        reachable: false,
        api_key_configured: false,
        blocked_reason: 'n8n_not_installed',
      },
      {
        id: 'codex_chatgpt',
        name: 'Codex/ChatGPT plugin',
        status: 'connected',
        read_only: true,
        write_enabled: false,
        requires_bridge_session: true,
        missing_credential: false,
        credential_names: [],
        billing_mode: 'subscription',
        blocked_reason: null,
      },
    ],
  },
  brain: {
    registry: [
      {
        id: 'brain_sync',
        name: 'Brain Sync',
        status: 'connected',
        read_available: true,
        write_available: false,
        blocked_reason: null,
      },
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
    timer: {
      unit: 'opencloud-docs-farmer.timer',
      active: true,
      active_state: 'active',
      next_run_at: '2026-05-04T12:00:00.000Z',
    },
    service: {
      unit: 'opencloud-docs-farmer.service',
      active: false,
      active_state: 'inactive',
      sub_state: 'dead',
      last_result: 'success',
    },
    last_run: {
      status: 'completed',
      result: 'success',
      source: 'read_only_status',
    },
    run_now: {
      action: 'buildwiki.run_now',
      target_service: 'opencloud-docs-farmer.service',
      dispatch_scope: 'opencloud-docs-farmer.service',
      owner_approval_required: true,
      bridge_session_required: true,
      execution_enabled: false,
      blocked_reason: 'active_bridge_session_required_for_buildwiki_run_now',
    },
    fork_state: {
      fork1: { status: 'available', service_scope: 'opencloud-docs-farmer.service' },
      fork2: { status: 'blocked', smb_mounted: false, blocker: 'smb_mount_not_verified' },
    },
    smb: { required_for_fork2: true, mounted: false, blocker: 'smb_mount_not_verified' },
    direct_opencloud_access_visible: false,
    skills_tools_available: [
      'Build-Wiki status',
      'Farmer timer status',
      'Farmer service status',
      'Run Now adapter metadata',
      'OpenCloud worker/runtime capability catalog',
    ],
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
    expect(nodes.has('space_agent')).toBe(true)
    expect(nodes.has('bridge_mcp')).toBe(true)
    expect(nodes.has('mcp_gateway')).toBe(true)
    expect(nodes.has('integration_zapier')).toBe(true)
    expect(nodes.has('integration_heygen')).toBe(true)
    expect(nodes.has('integration_firecrawl')).toBe(true)
    expect(nodes.has('integration_agentmail')).toBe(true)
    expect(nodes.has('integration_google_drive')).toBe(true)
    expect(nodes.has('integration_onedrive')).toBe(true)
    expect(nodes.has('integration_n8n')).toBe(true)
    expect(nodes.has('llm_gateway')).toBe(true)
    expect(nodes.has('model_openrouter')).toBe(true)
    expect(nodes.has('model_openai')).toBe(true)
    expect(nodes.has('model_codex_chatgpt')).toBe(true)
    expect(nodes.has('model_claude_anthropic')).toBe(true)
    expect(nodes.has('model_ollama')).toBe(true)
    expect(nodes.has('model_nvidia')).toBe(true)
    expect(nodes.has('model_groq')).toBe(true)
    expect(nodes.has('model_gemini')).toBe(true)
    expect(nodes.has('brain')).toBe(true)
    expect(nodes.has('opencloud')).toBe(true)
    expect(nodes.has('obsidian')).toBe(true)
    expect(nodes.has('mempalace')).toBe(true)
    expect(nodes.has('skills')).toBe(true)
    expect(nodes.has('data_sources')).toBe(true)
    expect(registry.nodes.find((node) => node.id === 'opencloud')?.capabilities).toEqual(expect.arrayContaining([
      'worker/runtime engine',
      'skills/tools source',
      'Build-Wiki/Farmer support layer',
      'future mini-agent creation layer',
      'not deletion target',
    ]))
    expect(nodes.has('graphify')).toBe(true)
    expect(nodes.has('buildwiki')).toBe(true)
    expect(capabilities.has('mcp_zapier')).toBe(true)
    expect(capabilities.has('model_openrouter')).toBe(true)
    expect(capabilities.has('model_openai')).toBe(true)
    expect(capabilities.has('model_codex_chatgpt')).toBe(true)
    expect(capabilities.has('model_claude_anthropic')).toBe(true)
    expect(capabilities.has('model_ollama')).toBe(true)
    expect(capabilities.has('model_nvidia')).toBe(true)
    expect(capabilities.has('model_groq')).toBe(true)
    expect(capabilities.has('model_gemini')).toBe(true)
    expect(capabilities.has('brain_obsidian')).toBe(true)
    expect(capabilities.has('brain_buildwiki')).toBe(true)
    expect(capabilities.has('opencloud_dependency')).toBe(true)
    expect(capabilities.has('integration_firecrawl')).toBe(true)
    expect(capabilities.has('space_agent_research_packet')).toBe(true)
    expect(registry.capabilities.find((capability) => capability.id === 'integration_firecrawl')?.blockers).toContain('missing_credential')
    const spaceAgent = registry.capabilities.find((capability) => capability.id === 'space_agent_research_packet')
    expect(spaceAgent).toMatchObject({
      kind: 'agent',
      source_node: 'space_agent',
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
      available_to: ['agent_zero', 'hermes', 'pi'],
    })
    expect(spaceAgent?.status_details).toMatchObject({
      commander_replacement: false,
      returns_to: 'agent_zero',
      execution_enabled: false,
    })
    const mcpZapier = registry.capabilities.find((capability) => capability.id === 'mcp_zapier')
    expect(mcpZapier?.status_details).toMatchObject({
      mcp_list_route: '/api/mcp/list',
      tools_route: '/api/mcp/servers/zapier/tools',
      tool_count: 4,
      reachable: true,
      schema_available: true,
      read_only_schema_visible: true,
      writes_require_bridge_session: true,
      execution_enabled: false,
    })
    const zapier = registry.capabilities.find((capability) => capability.id === 'integration_zapier')
    expect(zapier?.source_node).toBe('integration_zapier')
    expect(zapier?.status_details).toMatchObject({
      read_only_schema_visible: true,
      write_enabled: false,
      writes_require_bridge_session: true,
      credential_configured: true,
    })
    const heygen = registry.capabilities.find((capability) => capability.id === 'integration_heygen')
    expect(heygen?.status_details).toMatchObject({
      read_only_schema_visible: true,
      generation_requires_bridge_session: true,
      execution_enabled: false,
    })
    const agentmail = registry.capabilities.find((capability) => capability.id === 'integration_agentmail')
    expect(agentmail?.status_details).toMatchObject({
      incoming_status: 'connected',
      outgoing_status: 'blocked_pending_bridge_session',
      domain_rules: 'owner_domain_only',
    })
    const googleDrive = registry.capabilities.find((capability) => capability.id === 'integration_google_drive')
    expect(googleDrive?.blockers).toContain('missing_credential')
    expect(googleDrive?.status_details).toMatchObject({
      upload_connector_configured: false,
      folder_lookup_available: false,
      uploads_require_bridge_session: true,
    })
    const oneDrive = registry.capabilities.find((capability) => capability.id === 'integration_onedrive')
    expect(oneDrive?.status_details).toMatchObject({
      upload_connector_configured: true,
      folder_lookup_available: true,
      uploads_require_bridge_session: true,
    })
    const n8n = registry.capabilities.find((capability) => capability.id === 'integration_n8n')
    expect(n8n?.status_details).toMatchObject({
      installed: false,
      running: false,
      reachable: false,
      api_key_configured: false,
    })
    expect(n8n?.blockers).toContain('n8n_not_installed')
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
    const buildWiki = registry.capabilities.find((capability) => capability.id === 'brain_buildwiki')
    expect(buildWiki?.status_details).toMatchObject({
      run_now_action: 'buildwiki.run_now',
      run_now_target_service: 'opencloud-docs-farmer.service',
      timer_unit: 'opencloud-docs-farmer.timer',
      service_unit: 'opencloud-docs-farmer.service',
      dispatch_scope: 'opencloud-docs-farmer.service',
      skills_tools_available: 'Build-Wiki status, Farmer service status, Farmer timer status, OpenCloud worker/runtime capability catalog, Run Now adapter metadata',
      bridge_session_required_actions: 'buildwiki.run_now, buildwiki.write, opencloud.worker_execution, mini_agent_creation_activation',
      bridge_session_required: true,
      owner_approval_required: true,
      farmer_execution_enabled: false,
      fork1_state: 'available',
      fork2_state: 'blocked',
      smb_mounted: false,
      smb_blocker: 'smb_mount_not_verified',
      fork2_blocker: 'smb_mount_not_verified',
    })
    expect(buildWiki?.execution_requirements).toContain('run_now_scope:opencloud-docs-farmer.service')
    expect(buildWiki?.blockers).toEqual(expect.arrayContaining(['active_bridge_session_required_for_buildwiki_run_now', 'smb_mount_not_verified']))
    const openCloud = registry.capabilities.find((capability) => capability.id === 'opencloud_dependency')
    expect(openCloud?.status_details).toMatchObject({
      worker_runtime_engine: true,
      skills_tools_source: true,
      buildwiki_farmer_support_layer: true,
      future_mini_agent_creation_layer: true,
      opencloud_deletion_target: false,
      opencloud_disable_target: false,
      opencloud_destroy_allowed: false,
      retained_in_gateway: true,
      requires_bridge_session: true,
      decommission_safe: false,
      dependency_for: 'buildwiki_farmer',
      skills_tools_available: 'Build-Wiki status, Farmer service status, Farmer timer status, OpenCloud worker/runtime capability catalog, Run Now adapter metadata',
      bridge_session_required_actions: 'buildwiki.run_now, buildwiki.write, opencloud.worker_execution, mini_agent_creation_activation',
      blocked_reason: null,
    })
    expect(openCloud?.blockers).toEqual([])
    const openRouter = registry.capabilities.find((capability) => capability.id === 'model_openrouter')
    expect(openRouter?.status_details).toMatchObject({
      configured: true,
      model_count: 2,
      fallback_provider: 'openai',
      raw_tracebacks_exposed: false,
    })
    const codex = registry.capabilities.find((capability) => capability.id === 'model_codex_chatgpt')
    expect(codex?.status_details).toMatchObject({
      plugin_connected: true,
      api_billing_in_use: false,
      billing_mode: 'chatgpt_subscription_plugin',
    })
    const claude = registry.capabilities.find((capability) => capability.id === 'model_claude_anthropic')
    expect(claude?.status_details).toMatchObject({
      api_key_configured: true,
      api_billing_in_use: true,
      oauth_subscription_configured: false,
      billing_mode: 'anthropic_api_key_billing_possible_not_default_for_plugin',
    })
    expect(registry.capabilities.find((capability) => capability.id === 'model_gemini')?.blockers).toContain('missing_credential')
    expect(registry.capabilities.find((capability) => capability.id === 'model_nvidia')?.blockers).toContain('nvidia_not_configured_or_not_visible_in_provider_registry')
    expect(JSON.stringify(registry)).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|\/home\/tony/)
  })

  it('summarizes Gateway health, nodes, flows, and policies without enabling writes', () => {
    const registry = buildGatewayRegistrySnapshot({ context, generatedAt: '2026-05-04T00:00:00.000Z' })
    const status = buildGatewayStatusPayload(registry)
    const nodes = buildGatewayNodesPayload(registry)
    const node = getGatewayNodeDetail(registry, 'agent-zero')
    const flows = buildGatewayFlowsPayload(registry)
    const policies = buildGatewayPoliciesPayload(registry)

    expect(status.agent_zero.status).toBe('connected')
    expect(status.hermes.status).toBe('degraded')
    expect(status.bridge_mcp.mcp_servers).toBeGreaterThan(0)
    expect(status.mcp_gateway).toMatchObject({
      visible: true,
      status: 'read_only',
      mcp_list_route: '/api/mcp/list',
      mcp_tools_route_template: '/api/mcp/servers/:id/tools',
      policy: {
        read_only_schema_visible: true,
        writes_require_bridge_session: true,
        generation_requires_bridge_session: true,
        uploads_require_bridge_session: true,
        no_external_write_without_session: true,
      },
    })
    expect(status.mcp_gateway.servers.find((server) => server.id === 'zapier')).toMatchObject({
      reachable: true,
      schema_available: true,
      tool_count: 4,
      tools_route: '/api/mcp/servers/zapier/tools',
    })
    expect(status.mcp_gateway.tools_integrations.map((item) => item.id)).toEqual(expect.arrayContaining(['zapier', 'heygen', 'firecrawl', 'agentmail', 'google_drive', 'onedrive', 'n8n']))
    expect(status.mcp_gateway.tools_integrations.find((item) => item.id === 'firecrawl')).toMatchObject({
      status: 'blocked',
      blocker: 'missing_credential',
    })
    expect(status.llm_gateway.visible).toBe(true)
    expect(status.llm_gateway.status).toBe('read_only')
    expect(status.llm_gateway.providers.map((provider) => provider.id)).toEqual(expect.arrayContaining(['openrouter', 'openai', 'codex_chatgpt', 'claude_anthropic', 'ollama', 'nvidia', 'groq', 'gemini']))
    expect(status.llm_gateway.providers.find((provider) => provider.id === 'openrouter')).toMatchObject({
      configured: true,
      model_count: 2,
      fallback_provider: 'openai',
    })
    expect(status.llm_gateway.providers.find((provider) => provider.id === 'claude_anthropic')?.billing_mode).toBe('anthropic_api_key_billing_possible_not_default_for_plugin')
    expect(status.llm_gateway.routing_policy).toMatchObject({
      fallback_enabled: true,
      raw_tracebacks_exposed: false,
    })
    expect(status.brain_systems.find((item) => item.id === 'mempalace')?.write_enabled).toBe(true)
    expect(status.buildwiki_opencloud).toMatchObject({
      visible: true,
      opencloud_status: 'read_only',
      worker_runtime_engine: true,
      skills_tools_source: true,
      buildwiki_farmer_support_layer: true,
      future_mini_agent_creation_layer: true,
      timer_active: true,
      timer_unit: 'opencloud-docs-farmer.timer',
      service_active: false,
      service_unit: 'opencloud-docs-farmer.service',
      last_run_status: 'completed',
      run_now_action: 'buildwiki.run_now',
      run_now_target_service: 'opencloud-docs-farmer.service',
      dispatch_scope: 'opencloud-docs-farmer.service',
      bridge_session_required: true,
      owner_approval_required: true,
      farmer_execution_enabled: false,
      fork1_state: 'available',
      fork2_state: 'blocked',
      fork2_smb_mounted: false,
      fork2_blocker: 'smb_mount_not_verified',
      smb_mounted: false,
      smb_blocker: 'smb_mount_not_verified',
      opencloud_dependency_visible: true,
      opencloud_deletion_target: false,
      opencloud_disable_target: false,
      opencloud_destroy_allowed: false,
    })
    expect(status.buildwiki_opencloud.opencloud_roles).toEqual(expect.arrayContaining([
      'worker/runtime engine',
      'skills/tools source',
      'Build-Wiki/Farmer support layer',
      'future mini-agent creation layer',
    ]))
    expect(status.buildwiki_opencloud.skills_tools_available).toContain('Run Now adapter metadata')
    expect(status.buildwiki_opencloud.bridge_session_required_actions).toContain('opencloud.worker_execution')
    expect(status.execution_enabled).toBe(false)
    expect(nodes.mode).toBe('gateway_nodes_read_only')
    expect(nodes.execution_enabled).toBe(false)
    const requiredNodeFields = [
      'id',
      'name',
      'type',
      'status',
      'connected',
      'configured',
      'read_enabled',
      'write_enabled',
      'execution_enabled',
      'requires_bridge_session',
      'blocked_reason',
      'last_success',
      'last_error',
    ]
    const agentZeroNode = nodes.nodes.find((item) => item.id === 'agent_zero')
    expect(agentZeroNode).toBeTruthy()
    for (const field of requiredNodeFields) expect(agentZeroNode).toHaveProperty(field)
    expect(agentZeroNode).toMatchObject({
      name: 'Agent Zero',
      type: 'commander',
      connected: true,
      configured: true,
      read_enabled: true,
      execution_enabled: false,
    })
    const nodeTypes = new Set(nodes.nodes.map((item) => item.type))
    expect([...nodeTypes]).toEqual(expect.arrayContaining([
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
    ]))
    expect(nodes.nodes.find((item) => item.id === 'gateway')).toMatchObject({ type: 'gateway' })
    expect(nodes.nodes.find((item) => item.id === 'buildwiki')).toMatchObject({ type: 'buildwiki_farmer' })
    expect(nodes.nodes.find((item) => item.id === 'opencloud')).toMatchObject({ type: 'opencloud_worker' })
    expect(nodes.nodes.find((item) => item.id === 'integration_agentmail')).toMatchObject({ type: 'delivery_channel' })
    expect(node?.node.label).toBe('Agent Zero')
    expect(node?.node.name).toBe('Agent Zero')
    expect(node?.node.type).toBe('commander')
    expect(node?.node.connected).toBe(true)
    expect(node?.node.configured).toBe(true)
    expect(node?.node.read_enabled).toBe(true)
    expect(node?.node.write_enabled).toBe(false)
    expect(node?.node.execution_enabled).toBe(false)
    expect(node?.node.requires_bridge_session).toBe(true)
    expect(node?.node.blocked_reason).toBeNull()
    expect(flows.flows.length).toBeGreaterThan(0)
    const flowMap = new Map(flows.flows.map((flow) => [flow.flow_id, flow]))
    expect(flowMap.get('flow_owner_gateway_agent_zero')).toMatchObject({
      source: 'owner',
      target: 'agent_zero',
      requested_action: 'owner_command',
      selected_route: { hops: ['owner', 'gateway', 'agent_zero'] },
      policy_result: { route_decision: 'allowed', requires_bridge_session: false },
      bridge_session_id: null,
      failure_reason: null,
      no_secrets_logging: { enabled: true, secrets_exposed: false },
    })
    expect(flowMap.get('flow_owner_gateway_agent_zero')?.node_health.agent_zero?.status).toBe('connected')
    expect(flowMap.get('flow_owner_gateway_agent_zero')?.last_successful_route?.target).toBe('agent_zero')
    expect(flowMap.get('flow_agent_zero_gateway_hermes')).toMatchObject({
      source: 'agent_zero',
      target: 'hermes',
      requested_action: 'skill_workflow_planning',
      selected_route: { hops: ['agent_zero', 'gateway', 'hermes'] },
    })
    expect(flowMap.get('flow_agent_zero_gateway_space_agent_research')).toMatchObject({
      source: 'agent_zero',
      target: 'space_agent',
      requested_action: 'research_packet',
      selected_route: { hops: ['agent_zero', 'gateway', 'space_agent'] },
      policy_result: { route_decision: 'allowed', requires_bridge_session: false },
      execution_mode: 'read_only',
    })
    expect(flowMap.get('flow_agent_zero_gateway_openclaw_skill')).toMatchObject({
      source: 'agent_zero',
      target: 'openclaw_plus',
      requested_action: 'openclaw_skill_route',
      policy_result: { route_decision: 'requires_session', requires_bridge_session: true },
    })
    expect(flowMap.get('flow_agent_zero_gateway_mcp_tool')).toMatchObject({
      source: 'agent_zero',
      target: 'mcp_gateway',
      requested_action: 'mcp_tool_route',
      policy_result: { route_decision: 'requires_session', requires_bridge_session: true },
    })
    expect(flowMap.get('flow_agent_zero_gateway_opencloud_worker')).toMatchObject({
      source: 'agent_zero',
      target: 'opencloud',
      requested_action: 'opencloud_worker_route',
      policy_result: { route_decision: 'requires_session', requires_bridge_session: true },
      bridge_session_log: [expect.objectContaining({ decision: 'required', secrets_exposed: false })],
      external_write_log: [expect.objectContaining({ external_write: false, secrets_exposed: false })],
    })
    const collaboration = flowMap.get('flow_agent_zero_hermes_collaboration')
    expect(collaboration?.route.hops).toEqual(['agent_zero', 'gateway', 'hermes', 'gateway', 'agent_zero'])
    expect(collaboration?.selected_route.hops).toEqual(['agent_zero', 'gateway', 'hermes', 'gateway', 'agent_zero'])
    expect(collaboration?.execution_mode).toBe('read_only')
    expect(collaboration?.audit.events).toContain('gateway_collaboration_flow_registered_read_only')
    expect(collaboration?.audit.events).toContain('agent_zero_remains_commander')
    expect(collaboration?.audit.events).toContain('hermes_plan_only_no_execution')
    expect(collaboration?.audit.external_write).toBe(false)
    expect(flows.execution_enabled).toBe(false)
    expect(policies.summary.auth_required).toBe(true)
    expect(policies.summary.external_writes_enabled).toBe(false)
    expect(policies.route_decisions).toEqual(['allowed', 'blocked', 'requires_session', 'missing_credential'])
    expect(policies.rules.map((rule) => rule.id)).toEqual(expect.arrayContaining([
      'read_only_discovery',
      'bridge_session_required',
      'external_write_scoped',
      'protected_action_approval',
      'no_raw_paths',
      'no_secrets',
      'no_fake_done',
      'no_docker_socket',
      'no_raw_root_shell',
      'no_direct_secret_reads',
    ]))
    expect(Object.keys(policies.policies)).toEqual(expect.arrayContaining([
      'gateway_read_only_discovery',
      'gateway_bridge_session_required',
      'gateway_external_write_scoped',
      'gateway_protected_action_approval',
      'gateway_no_raw_paths',
      'gateway_no_secrets',
      'gateway_no_fake_done',
      'gateway_no_docker_socket',
      'gateway_no_raw_root_shell',
      'gateway_no_direct_secret_reads',
    ]))
    expect(policies.security_proof.policies).toMatchObject({
      auth_required: true,
      tailscale_or_mission_control_auth_required: true,
      bridge_session_required_for_writes: true,
      external_writes_blocked_without_session: true,
      protected_scopes_enforced: true,
      no_fake_done: true,
      public_hermes_ui_exposed: false,
      raw_shell_enabled: false,
      root_shell_enabled: false,
      docker_socket_enabled: false,
      direct_secret_reads_enabled: false,
    })
    expect(policies.security_proof.forbidden_surfaces.map((surface) => surface.id)).toEqual(expect.arrayContaining([
      'raw_root_shell',
      'docker_socket',
      'direct_secret_reads',
      'public_hermes_ui',
    ]))
    expect(JSON.stringify(policies)).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|\/home\/tony|auth\.json/)
  })
})
