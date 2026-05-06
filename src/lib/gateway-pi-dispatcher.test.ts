import { describe, expect, it } from 'vitest'

import { createGatewayCapability, createGatewayRegistryFromAgentNetwork } from './gateway-model'
import { recommendPiGatewayRoute } from './gateway-pi-dispatcher'

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

describe('Pi shadow dispatcher', () => {
  it('recommends routes without executing and keeps Agent Zero as commander', () => {
    const recommendation = recommendPiGatewayRoute(registry, { ownerRequest: 'Who is the commander now?' })

    expect(recommendation.shadow_mode).toBe(true)
    expect(recommendation.recommended_agent).toBe('agent_zero')
    expect(recommendation.selected_route.via).toEqual(['owner', 'gateway', 'agent_zero'])
    expect(recommendation.execution_enabled).toBe(false)
    expect(recommendation.writes_enabled).toBe(false)
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

  it('recommends Hermes for skill design and mini-agents for small scoped tasks', () => {
    const skill = recommendPiGatewayRoute(registry, { ownerRequest: 'Design a workflow skill for email triage' })
    const mini = recommendPiGatewayRoute(registry, { ownerRequest: 'Summarize a small scoped research task with a mini-agent' })

    expect(skill.recommended_agent).toBe('hermes')
    expect(skill.selected_route.target).toBe('hermes')
    expect(mini.recommended_agent).toBe('mini_agent')
    expect(mini.recommended_mini_agent_type).toBe('research')
    expect(mini.selected_route.target).toBe('mini_agents')
  })
})
