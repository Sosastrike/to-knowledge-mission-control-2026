import { describe, expect, it } from 'vitest'

import { buildGatewayDocsIndex, validateGatewayDocsCoverage } from './gateway-docs'
import { createGatewayHealth, createGatewayRegistryFromAgentNetwork } from './gateway-model'
import { createMiniAgentDefinition } from './gateway-mini-agent-contracts'

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
}

describe('GatewayDocs documentation system', () => {
  it('creates owner-safe docs for every Gateway node and capability', () => {
    const miniAgent = createMiniAgentDefinition({
      name: 'Research Scout',
      purpose: 'Summarize Gateway context.',
      parent_supervisor: 'agent_zero',
      scope: ['read-only discovery'],
    }).definition!
    const index = buildGatewayDocsIndex(registry, { miniAgents: [miniAgent], generatedAt: '2026-05-05T12:00:00.000Z' })

    expect(index.ok).toBe(true)
    expect(index.coverage.nodes_total).toBe(registry.nodes.length)
    expect(index.coverage.capabilities_total).toBe(registry.capabilities.length)
    expect(index.coverage.mini_agents_total).toBe(1)
    expect(index.coverage.missing_docs).toEqual([])
    expect(index.coverage.secret_findings).toEqual([])
    expect(index.docs.some((doc) => doc.registry_id === 'agent_zero' && doc.purpose.includes('Commander'))).toBe(true)
    expect(index.docs.some((doc) => doc.registry_id === 'hermes' && doc.owner_or_supervisor)).toBe(true)
    expect(index.docs.some((doc) => doc.registry_id === 'opencloud' && doc.purpose.includes('worker'))).toBe(true)
    expect(index.docs.every((doc) => typeof doc.read_enabled === 'boolean' && typeof doc.write_enabled === 'boolean' && typeof doc.execution_enabled === 'boolean')).toBe(true)
    expect(index.docs.every((doc) => Object.prototype.hasOwnProperty.call(doc, 'blocked_reason'))).toBe(true)
    expect(index.docs.every((doc) => Object.prototype.hasOwnProperty.call(doc, 'last_verified_at'))).toBe(true)
  })

  it('labels stale docs and rejects missing docs or secret-shaped contents', () => {
    const index = buildGatewayDocsIndex(registry, { generatedAt: '2026-05-15T12:00:00.000Z', freshnessHours: 24 })
    const incomplete = index.docs.filter((doc) => doc.registry_id !== 'agent_zero')
    const validation = validateGatewayDocsCoverage(registry, incomplete, { generatedAt: '2026-05-15T12:00:00.000Z' })
    const poisoned = validateGatewayDocsCoverage(registry, [
      ...index.docs,
      { ...index.docs[0], id: 'doc_poisoned', registry_id: 'poisoned', owner_visible_summary: 'TOKEN=secret-value' },
    ], { generatedAt: '2026-05-15T12:00:00.000Z' })

    expect(index.coverage.stale_docs.length).toBeGreaterThan(0)
    expect(validation.ok).toBe(false)
    expect(validation.missing_docs).toContain('agent_zero')
    expect(poisoned.secret_findings).toContainEqual({ doc_id: 'doc_poisoned', concern: 'secret_like_value' })
  })
})
