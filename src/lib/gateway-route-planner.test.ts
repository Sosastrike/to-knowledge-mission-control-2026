import { describe, expect, it } from 'vitest'
import type { AgentZeroReadOnlyContext } from './agent-zero-bridge'
import { buildGatewayRegistrySnapshot } from './gateway-registry-api'
import { classifyGatewayOwnerRequest, planGatewayRoute } from './gateway-route-planner'

const context = {
  agents: {
    items: [
      { id: 'agent_zero', status: 'active', role: 'commander', execution_enabled: false, direct_access: false, proxy_access: true },
      { id: 'hermes', status: 'connected', role: 'lieutenant', execution_enabled: false, direct_access: false, proxy_access: true },
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
      { name: 'zapier', status: 'connected', reachable: true, schema_available: true, blocked_reason: null },
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
        models: ['openrouter/anthropic/claude-sonnet-4'],
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
    ],
    catalog: [
      { alias: 'sonnet', provider: 'openrouter', name: 'openrouter/anthropic/claude-sonnet-4' },
      { alias: 'gpt-4.1', provider: 'openai', name: 'openai/gpt-4.1' },
    ],
  },
  tools: {
    registry: [
      { id: 'report.create', name: 'Create report', status: 'connected', read_only: true, write_enabled: false, requires_bridge_session: false, blocked_reason: null },
    ],
  },
  skills: {
    registry: [
      {
        id: 'reporting',
        name: 'Reporting',
        status: 'connected',
        required_tools: ['report.create'],
        required_credentials: [],
        blocked_reasons: [],
        blocked_dependencies: [],
        missing_dependencies: [],
        execution_requirements: ['bridge_session_required_for_execution'],
        available_to: ['agent_zero', 'hermes'],
        available_to_agents: ['agent_zero', 'hermes'],
        blocked_reason: null,
      },
    ],
  },
  integrations: {
    registry: [
      { id: 'firecrawl', name: 'Firecrawl', status: 'blocked', read_only: true, write_enabled: false, requires_bridge_session: true, missing_credential: true, credential_names: ['FIRECRAWL_API_KEY'], blocked_reason: 'missing_credential' },
      { id: 'zapier', name: 'Zapier', status: 'configured', read_only: true, write_enabled: false, requires_bridge_session: true, missing_credential: false, credential_present: true, credential_names: ['ZAPIER_TOKEN'], schema_visible: true, blocked_reason: null },
      { id: 'heygen', name: 'HeyGen', status: 'configured', read_only: true, write_enabled: false, requires_bridge_session: true, missing_credential: false, credential_present: true, credential_names: ['HEYGEN_API_KEY'], schema_visible: true, blocked_reason: null },
      { id: 'agentmail', name: 'AgentMail', status: 'configured', read_only: true, write_enabled: false, requires_bridge_session: true, missing_credential: false, credential_present: true, credential_names: ['AGENTMAIL_API_KEY'], incoming_status: 'connected', outgoing_status: 'blocked_pending_bridge_session', domain_rules: 'owner_domain_only', blocked_reason: null },
      { id: 'onedrive', name: 'OneDrive', status: 'configured', read_only: true, write_enabled: false, requires_bridge_session: true, missing_credential: false, credential_present: true, upload_connector_configured: true, folder_lookup_available: true, credential_names: ['ONEDRIVE_TOKEN'], blocked_reason: null },
      { id: 'n8n', name: 'n8n', status: 'blocked', read_only: true, write_enabled: false, requires_bridge_session: true, missing_credential: true, credential_names: ['N8N_API_KEY'], installed: false, running: false, reachable: false, api_key_configured: false, blocked_reason: 'n8n_not_installed' },
      { id: 'telegram', name: 'Telegram', status: 'configured', read_only: true, write_enabled: false, requires_bridge_session: true, missing_credential: false, credential_names: ['TELEGRAM_BOT_TOKEN'], blocked_reason: null },
    ],
  },
  brain: {
    registry: [
      { id: 'obsidian', name: 'Obsidian', status: 'connected', read_available: true, write_available: false, blocked_reason: null },
      { id: 'mempalace', name: 'MemPalace', status: 'connected', read_available: true, write_available: true, blocked_reason: null },
      { id: 'graphify', name: 'Graphify', status: 'connected', read_available: true, write_available: false, blocked_reason: 'write_adapter_disabled' },
    ],
  },
  opencloud_buildwiki: { visible: true, timer_active: true, farmer_execution_enabled: false },
} as unknown as AgentZeroReadOnlyContext

const registry = buildGatewayRegistrySnapshot({ context, generatedAt: '2026-05-04T00:00:00.000Z' })

describe('Gateway route planner', () => {
  it('classifies owner requests into Gateway route types', () => {
    expect(classifyGatewayOwnerRequest('Good morning. Who are you?')).toBe('chat')
    expect(classifyGatewayOwnerRequest('Make a plan for tomorrow')).toBe('plan')
    expect(classifyGatewayOwnerRequest('Design a skill for email triage')).toBe('skill')
    expect(classifyGatewayOwnerRequest('Use Firecrawl to check a page')).toBe('tool')
    expect(classifyGatewayOwnerRequest('Use OpenRouter for a model-heavy reasoning task')).toBe('model')
    expect(classifyGatewayOwnerRequest('Remember this in MemPalace')).toBe('memory')
    expect(classifyGatewayOwnerRequest('Prepare Build-Wiki Run Now')).toBe('sync')
    expect(classifyGatewayOwnerRequest('Upload the report to Google Drive')).toBe('upload')
    expect(classifyGatewayOwnerRequest('Create a PDF report')).toBe('report')
    expect(classifyGatewayOwnerRequest('Restart Mission Control')).toBe('protected_action')
    expect(classifyGatewayOwnerRequest('Incoming Telegram message from owner')).toBe('event')
  })

  it('routes default owner commands to Agent Zero', () => {
    const plan = planGatewayRoute(registry, { ownerRequest: 'Who is commander?' })
    expect(plan.classification).toBe('chat')
    expect(plan.primary_target).toBe('agent_zero')
    expect(plan.dispatch_target).toBe('agent_zero')
    expect(plan.route_via).toEqual(['owner', 'gateway', 'agent_zero'])
    expect(plan.requires_bridge_session).toBe(false)
    expect(plan.route_decision).toBe('allowed')
    expect(plan.policy_decision.route_decision).toBe('allowed')
    expect(plan.execution_enabled).toBe(false)
  })

  it('routes skill and workflow design to Hermes through Agent Zero', () => {
    const plan = planGatewayRoute(registry, { ownerRequest: 'Design a workflow skill for email triage' })
    expect(plan.classification).toBe('skill')
    expect(plan.primary_target).toBe('agent_zero')
    expect(plan.dispatch_target).toBe('hermes')
    expect(plan.route_via).toEqual(['owner', 'gateway', 'agent_zero', 'hermes'])
    expect(plan.flow.source).toBe('owner')
    expect(plan.flow.target).toBe('hermes')
    expect(plan.flow.requested_action).toBe('skill')
    expect(plan.flow.selected_route.hops).toEqual(['owner', 'gateway', 'agent_zero', 'hermes'])
    expect(plan.flow.policy_result.route_decision).toBe('allowed')
    expect(plan.flow.route.edge_kind).toBe('delegation')
    expect(plan.blocked).toBe(false)
    expect(plan.route_decision).toBe('allowed')
  })

  it('routes skill execution to Agent Zero and OpenClaw+ with Bridge Session gating', () => {
    const plan = planGatewayRoute(registry, { ownerRequest: 'Execute the Reporting skill' })

    expect(plan.classification).toBe('skill')
    expect(plan.primary_target).toBe('agent_zero')
    expect(plan.dispatch_target).toBe('openclaw_plus')
    expect(plan.route_via).toEqual(['owner', 'gateway', 'agent_zero', 'openclaw_plus'])
    expect(plan.requires_bridge_session).toBe(true)
    expect(plan.blocked).toBe(true)
    expect(plan.route_decision).toBe('requires_session')
    expect(plan.blocker).toBe('active_bridge_session_required_for_write')
  })

  it('routes model-heavy requests to model providers through Gateway policy', () => {
    const plan = planGatewayRoute(registry, { ownerRequest: 'Use OpenRouter for a model-heavy reasoning task' })
    expect(plan.classification).toBe('model')
    expect(plan.selected_capability?.id).toBe('model_openrouter')
    expect(plan.dispatch_target).toBe('model_openrouter')
    expect(plan.route_via).toEqual(['owner', 'gateway', 'agent_zero', 'llm_gateway', 'model_openrouter'])
    expect(plan.flow.route.edge_kind).toBe('model-call')
    expect(plan.requires_bridge_session).toBe(true)
    expect(plan.execution_enabled).toBe(false)
  })

  it('falls back to a configured model provider without exposing raw provider tracebacks', () => {
    const fallbackContext = {
      ...context,
      models: {
        ...context.models,
        provider_registry: [
          {
            id: 'openrouter',
            name: 'OpenRouter',
            status: 'blocked',
            credential_present: true,
            credential_names: ['OPENROUTER_API_KEY'],
            bridge_session_required: true,
            blocked_reason: 'LiteLLM Traceback: OpenRouter upstream exception',
            models: [],
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
        ],
      },
    } as unknown as AgentZeroReadOnlyContext
    const fallbackRegistry = buildGatewayRegistrySnapshot({ context: fallbackContext, generatedAt: '2026-05-04T00:00:00.000Z' })
    const plan = planGatewayRoute(fallbackRegistry, { ownerRequest: 'Use OpenRouter for a model-heavy reasoning task' })

    expect(plan.classification).toBe('model')
    expect(plan.selected_capability?.id).toBe('model_openai')
    expect(plan.dispatch_target).toBe('model_openai')
    expect(plan.rationale).toContain('fallback')
    expect(plan.rationale).not.toMatch(/Traceback|LiteLLM|upstream exception/)
    expect(plan.selected_capability?.status_details.raw_tracebacks_exposed).toBe(false)
  })

  it('routes MCP and tool calls through Bridge/MCP and blocks unavailable tools honestly', () => {
    const zapier = planGatewayRoute(registry, { ownerRequest: 'Show Zapier MCP tools' })
    const firecrawl = planGatewayRoute(registry, { ownerRequest: 'Use Firecrawl right now' })
    const agentmail = planGatewayRoute(registry, { ownerRequest: 'Show AgentMail status' })
    const n8n = planGatewayRoute(registry, { ownerRequest: 'Can n8n run workflows?' })

    expect(zapier.classification).toBe('tool')
    expect(zapier.dispatch_target).toBe('integration_zapier')
    expect(zapier.route_via).toEqual(['owner', 'gateway', 'agent_zero', 'mcp_gateway', 'integration_zapier'])
    expect(zapier.requires_bridge_session).toBe(true)
    expect(firecrawl.blocked).toBe(true)
    expect(firecrawl.route_decision).toBe('missing_credential')
    expect(firecrawl.blocker).toBe('missing_credential')
    expect(agentmail.dispatch_target).toBe('integration_agentmail')
    expect(agentmail.selected_capability?.status_details.domain_rules).toBe('owner_domain_only')
    expect(n8n.dispatch_target).toBe('integration_n8n')
    expect(n8n.blocked).toBe(true)
    expect(n8n.blocker).toBe('n8n_not_installed')
  })

  it('routes Brain, Build-Wiki sync, report, upload, and event requests to the right Gateway nodes', () => {
    const brain = planGatewayRoute(registry, { ownerRequest: 'Can you read Obsidian?' })
    const sync = planGatewayRoute(registry, { ownerRequest: 'Prepare Build-Wiki Run Now' })
    const report = planGatewayRoute(registry, { ownerRequest: 'Create a PDF report' })
    const upload = planGatewayRoute(registry, { ownerRequest: 'Upload to OneDrive' })
    const event = planGatewayRoute(registry, { ownerRequest: 'Incoming webhook event from AgentMail' })

    expect(brain.classification).toBe('memory')
    expect(brain.dispatch_target).toBe('obsidian')
    expect(sync.classification).toBe('sync')
    expect(sync.dispatch_target).toBe('buildwiki')
    expect(sync.requires_bridge_session).toBe(true)
    expect(report.classification).toBe('report')
    expect(report.dispatch_target).toBe('tools')
    expect(upload.classification).toBe('upload')
    expect(upload.dispatch_target).toBe('integration_onedrive')
    expect(upload.blocked).toBe(true)
    expect(upload.route_decision).toBe('requires_session')
    expect(upload.blocker).toBe('active_bridge_session_required_for_external_write')
    expect(event.classification).toBe('event')
    expect(event.dispatch_target).toBe('events')
  })

  it('blocks protected actions with exact Bridge Session policy reasons', () => {
    const plan = planGatewayRoute(registry, { ownerRequest: 'Restart Mission Control now' })
    expect(plan.classification).toBe('protected_action')
    expect(plan.blocked).toBe(true)
    expect(plan.route_decision).toBe('requires_session')
    expect(plan.blocker).toBe('active_bridge_session_required_for_protected_action')
    expect(plan.flow.policy_result.route_decision).toBe('requires_session')
    expect(plan.flow.policy_result.requires_bridge_session).toBe(true)
    expect(plan.flow.policy.bridge_session_required).toBe(true)
    expect(plan.flow.audit.external_write).toBe(false)
    expect(plan.flow.audit.secrets_exposed).toBe(false)
  })
})
