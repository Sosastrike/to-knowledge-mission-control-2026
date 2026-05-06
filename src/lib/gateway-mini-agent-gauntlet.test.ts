import { describe, expect, it } from 'vitest'

import { createGatewayCapability, createGatewayHealth, createGatewayRegistryFromAgentNetwork } from './gateway-model'
import { runMiniAgentGatewayGauntlet } from './gateway-mini-agent-gauntlet'

const baseRegistry = createGatewayRegistryFromAgentNetwork({
  generatedAt: '2026-05-05T12:00:00.000Z',
  hermes: { installed: true, reachable: true, authConfigured: true },
})
const opencloudNode = {
  id: 'opencloud',
  label: 'OpenCloud',
  kind: 'opencloud_worker' as const,
  status: 'read_only' as const,
  owner: 'ecosystem',
  visibility: 'owner_visible' as const,
  health: createGatewayHealth('read_only', 'OpenCloud retained as worker/runtime engine.', '2026-05-05T12:00:00.000Z'),
  capabilities: ['worker/runtime engine', 'future mini-agent creation layer'],
  blockers: [],
}
const registry = {
  ...baseRegistry,
  nodes: [...baseRegistry.nodes, opencloudNode],
  health: { ...baseRegistry.health, opencloud: opencloudNode.health },
  capabilities: [
    ...baseRegistry.capabilities,
    createGatewayCapability({ id: 'model_ollama_local', label: 'Ollama local model', kind: 'model', status: 'connected', source_node: 'llm_gateway' }),
    createGatewayCapability({ id: 'model_openrouter_sonnet', label: 'OpenRouter Claude Sonnet', kind: 'model', status: 'connected', source_node: 'llm_gateway' }),
  ],
}

describe('Mini-Agent Gateway gauntlet', () => {
  it('runs 1,000 deterministic dry-run scenarios without execution or secrets', () => {
    const result = runMiniAgentGatewayGauntlet(registry, 1000)

    expect(result.ok).toBe(true)
    expect(result.scenario_count).toBe(1000)
    expect(result.failed).toBe(0)
    expect(result.execution_enabled).toBe(false)
    expect(result.writes_enabled).toBe(false)
    expect(result.external_writes_enabled).toBe(false)
    expect(result.secrets_exposed).toBe(false)
    expect(Object.values(result.categories).every((count) => count > 0)).toBe(true)
    expect(result.owner_visible_summary).toContain('1000')
  })
})
