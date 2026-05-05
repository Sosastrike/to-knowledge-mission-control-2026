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
    const buildWiki = registry.capabilities.find((capability) => capability.id === 'brain_buildwiki')
    expect(buildWiki?.status_details).toMatchObject({
      run_now_action: 'buildwiki.run_now',
      run_now_target_service: 'opencloud-docs-farmer.service',
      dispatch_scope: 'opencloud-docs-farmer.service',
      bridge_session_required: true,
      owner_approval_required: true,
      farmer_execution_enabled: false,
      fork1_state: 'available',
      fork2_state: 'blocked',
      smb_mounted: false,
      smb_blocker: 'smb_mount_not_verified',
    })
    expect(buildWiki?.execution_requirements).toContain('run_now_scope:opencloud-docs-farmer.service')
    expect(buildWiki?.blockers).toEqual(expect.arrayContaining(['active_bridge_session_required_for_buildwiki_run_now', 'smb_mount_not_verified']))
    const openCloud = registry.capabilities.find((capability) => capability.id === 'opencloud_dependency')
    expect(openCloud?.status_details).toMatchObject({
      opencloud_deletion_target: false,
      decommission_safe: false,
      dependency_for: 'buildwiki_farmer',
    })
    expect(openCloud?.blockers).toContain('opencloud_destroy_not_safe_keep_dependency')
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
    const node = getGatewayNodeDetail(registry, 'agent-zero')
    const flows = buildGatewayFlowsPayload(registry)
    const policies = buildGatewayPoliciesPayload(registry)

    expect(status.agent_zero.status).toBe('connected')
    expect(status.hermes.status).toBe('degraded')
    expect(status.bridge_mcp.mcp_servers).toBeGreaterThan(0)
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
      timer_active: true,
      service_active: false,
      last_run_status: 'completed',
      run_now_action: 'buildwiki.run_now',
      run_now_target_service: 'opencloud-docs-farmer.service',
      dispatch_scope: 'opencloud-docs-farmer.service',
      bridge_session_required: true,
      owner_approval_required: true,
      farmer_execution_enabled: false,
      fork1_state: 'available',
      fork2_state: 'blocked',
      smb_mounted: false,
      smb_blocker: 'smb_mount_not_verified',
      opencloud_dependency_visible: true,
      opencloud_deletion_target: false,
    })
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
