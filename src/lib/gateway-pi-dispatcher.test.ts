import { describe, expect, it } from 'vitest'

import { createGatewayCapability, createGatewayRegistryFromAgentNetwork } from './gateway-model'
import { buildPiDispatcherStatusPayload, recommendPiGatewayRoute } from './gateway-pi-dispatcher'

const baseRegistry = createGatewayRegistryFromAgentNetwork({
  generatedAt: '2026-05-05T12:00:00.000Z',
  hermes: { installed: true, reachable: true, authConfigured: true },
})
const registry = {
  ...baseRegistry,
  capabilities: [
    ...baseRegistry.capabilities,
    createGatewayCapability({ id: 'model_ollama_local', label: 'Ollama local model', kind: 'model', status: 'connected', source_node: 'llm_gateway' }),
    createGatewayCapability({ id: 'model_openrouter_sonnet', label: 'OpenRouter Claude Sonnet', kind: 'model', status: 'connected', source_node: 'llm_gateway' }),
  ],
}

describe('Pi full-access Gateway agent', () => {
  it('reports Pi as a full-access Gateway agent with Jarvis-gated production execution', () => {
    const status = buildPiDispatcherStatusPayload(registry, '2026-05-05T12:00:00.000Z')

    expect(status).toMatchObject({
      mode: 'pi_full_access_gateway_status',
      canonical_gateway_node: 'pi',
      role: 'Full Access Gateway Agent',
      authority: 'gateway_brokered_full_access_under_jarvis',
      status: 'full_access',
      execution_enabled: true,
      writes_enabled: true,
      external_writes_enabled: false,
      tools_enabled: true,
      full_access_to_tools: true,
      full_access_to_skills: true,
      full_access_to_mcp: true,
      credential_values_exposed: false,
      production_execution_requires_jarvis_concurrence: true,
      commander: false,
      replaces_agent_zero: false,
      runtime: {
        installed: true,
        reachable: true,
        mode: 'mission_control_nuclear_gateway_direct_line',
        public_exposure: false,
        blocker: null,
      },
    })
    expect(status.role).toBe('Full Access Gateway Agent')
    expect(status.safe_probe.mode).toBe('pi_full_access_gateway_recommendation')
    expect(JSON.stringify(status)).not.toMatch(/\/home\/tony|auth\.json|sk-[A-Za-z0-9]/i)
  })

  it('recommends routes without executing and keeps Agent Zero as commander', () => {
    const recommendation = recommendPiGatewayRoute(registry, { ownerRequest: 'Who is the commander now?' })

    expect(recommendation.shadow_mode).toBe(false)
    expect(recommendation.recommended_agent).toBe('agent_zero')
    expect(recommendation.selected_route.via).toEqual(['owner', 'gateway', 'agent_zero'])
    expect(recommendation.execution_enabled).toBe(true)
    expect(recommendation.writes_enabled).toBe(true)
    expect(recommendation.owner_visible_summary).toContain('Agent Zero')
  })

  it('distinguishes read, write, execute, and mixed operations', () => {
    expect(recommendPiGatewayRoute(registry, { ownerRequest: 'Show Gateway status' }).operation_type).toBe('read')
    expect(recommendPiGatewayRoute(registry, { ownerRequest: 'Upload the report to Drive' }).operation_type).toBe('write')
    expect(recommendPiGatewayRoute(registry, { ownerRequest: 'Restart Mission Control' }).operation_type).toBe('execute')
    expect(recommendPiGatewayRoute(registry, { ownerRequest: 'Run and upload the report' }).operation_type).toBe('mixed')
  })

  it('blocks forbidden and unknown connector actions with exact reasons', () => {
    const forbidden = recommendPiGatewayRoute(registry, { ownerRequest: 'Open a raw root shell' })
    const unknown = recommendPiGatewayRoute(registry, { ownerRequest: 'Use UnknownCRM to update a record' })

    expect(forbidden.ok).toBe(false)
    expect(forbidden.policy_result).toBe('blocked')
    expect(forbidden.blocked_reason).toBe('raw_root_shell_forbidden_by_gateway_policy')
    expect(unknown.ok).toBe(false)
    expect(unknown.blocked_reason).toBe('unknown_connector_not_registered')
    expect(unknown.owner_visible_summary).not.toMatch(/done/i)
  })

  it('picks low-cost models for small tasks and strong models for hard tasks', () => {
    const small = recommendPiGatewayRoute(registry, { ownerRequest: 'Use a model for a small classification task' })
    const hard = recommendPiGatewayRoute(registry, { ownerRequest: 'Use a model for complex architecture synthesis' })

    expect(small.recommended_model).toBe('model_ollama_local')
    expect(hard.recommended_model).toBe('model_openrouter_sonnet')
  })

  it('recommends Space Agent for web, Firecrawl, browser, YouTube, screenshot, and inaccessible-site research stages', () => {
    const prompts = [
      'Search the web for current sources',
      'Read this website page',
      'Use Firecrawl to scrape a page',
      'Use Firecrawl to crawl a site',
      'Use Firecrawl map on a site',
      'Use Firecrawl extract for structured data',
      'Perform browser interaction on a public page',
      'Inspect this YouTube video and extract sources',
      'Capture screenshot and page state',
      'Agents normally cannot access this site/video',
    ]

    for (const ownerRequest of prompts) {
      const recommendation = recommendPiGatewayRoute(registry, { ownerRequest })
      expect(recommendation.recommended_agent).toBe('space_agent')
      expect(recommendation.selected_route.target).toBe('space_agent')
      expect(recommendation.selected_route.via).toEqual(['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'])
      expect(recommendation.recommended_mini_agent_type).toBe('research')
      expect(recommendation.execution_enabled).toBe(true)
      expect(recommendation.writes_enabled).toBe(true)
      expect(recommendation.rationale).toContain('Space Agent')
    }
  })

  it('does not recommend Space Agent for non-research or protected-write work', () => {
    const prompts = [
      'Good morning. Who are you?',
      'Patch a TypeScript bug in the repo',
      'Upload the report to OneDrive',
      'Send an email through AgentMail',
      'Execute Build-Wiki Run Now',
      'Write a Zapier record',
      'Generate a HeyGen video',
      'Remember this in MemPalace',
      'Check SMB/Fork 2 prerequisites',
    ]

    for (const ownerRequest of prompts) {
      const recommendation = recommendPiGatewayRoute(registry, { ownerRequest })
      expect(recommendation.recommended_agent).not.toBe('space_agent')
      expect(recommendation.selected_route.target).not.toBe('space_agent')
      expect(recommendation.execution_enabled).toBe(true)
      expect(recommendation.writes_enabled).toBe(true)
    }
  })

  it('recommends Hermes for skill design and mini-agents for small scoped tasks', () => {
    const skill = recommendPiGatewayRoute(registry, { ownerRequest: 'Design a workflow skill for email triage' })
    const mini = recommendPiGatewayRoute(registry, { ownerRequest: 'Summarize a small scoped research task with a mini-agent' })

    expect(skill.recommended_agent).toBe('hermes')
    expect(skill.selected_route.target).toBe('hermes')
    expect(mini.recommended_agent).toBe('mini_agent')
    expect(mini.recommended_mini_agent_type).toBe('research')
    expect(mini.selected_route.target).toBe('mini_agents')
  })

  it('proves the required Pi Gateway route matrix with Jarvis-gated production execution', () => {
    const cases = [
      ['Read this website and summarize it', 'space_agent', null],
      ['Use Firecrawl to scrape this public page', 'space_agent', 'firecrawl_credential_required'],
      ['Extract the transcript from this public YouTube video', 'space_agent', null],
      ['Design a workflow skill for email triage', 'hermes', null],
      ['Create a workforce task and assign a co-worker', 'paperclip', 'paperclip_task_write_requires_bridge_session'],
      ['Execute a mini-agent skill through OpenClaw runtime', 'openclaw_plus', 'openclaw_runtime_execution_requires_bridge_session'],
      ['Deliver this report to Google Drive', 'delivery_adapter', 'delivery_adapter_requires_bridge_session_and_configured_connector'],
      ['Use UnknownCRM to update a record', 'blocked', 'unknown_connector_not_registered'],
    ] as const

    for (const [ownerRequest, target, blocker] of cases) {
      const recommendation = recommendPiGatewayRoute(registry, { ownerRequest })
      expect(recommendation.selected_route.target).toBe(target)
      expect(recommendation.blocked_reason).toBe(blocker)
      expect(recommendation.execution_enabled).toBe(true)
      expect(recommendation.writes_enabled).toBe(true)
      expect(recommendation.selected_route.via).toContain('gateway')
      expect(recommendation.owner_visible_summary).not.toMatch(/done/i)
    }
  })
})
