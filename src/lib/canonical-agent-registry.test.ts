import { describe, expect, it } from 'vitest'

import {
  CANONICAL_AGENT_HUB_ORDER,
  CANONICAL_AGENT_REGISTRY,
  buildCanonicalAgentRegistryPayload,
  getCanonicalAgentById,
  getCanonicalAgentRegistry,
  normalizeCanonicalAgentId,
} from './canonical-agent-registry'

describe('canonical agent registry', () => {
  it('defines the single owner-facing roster without Tony as active commander', () => {
    expect(CANONICAL_AGENT_REGISTRY.map((agent) => agent.id)).toEqual([
      'agent-zero',
      'hermes',
      'pi-mono',
      'spaceagent',
      'paperclip',
      'openclaw-plus',
    ])
    expect(CANONICAL_AGENT_HUB_ORDER).toEqual([
      'paperclip',
      'agent-zero',
      'hermes',
      'spaceagent',
      'pi-mono',
      'openclaw-plus',
    ])

    expect(getCanonicalAgentById('agent_zero')).toMatchObject({
      id: 'agent-zero',
      role: 'Commander',
      commander: true,
    })
    expect(getCanonicalAgentById('pi')).toMatchObject({
      id: 'pi-mono',
      role: 'Dispatcher / Route Optimizer Candidate',
      advisoryOnly: true,
      executionEnabled: false,
      writesEnabled: false,
    })
    expect(getCanonicalAgentById('paperclip')?.authorityRank)
      .toBeLessThan(getCanonicalAgentById('openclaw-plus')?.authorityRank || 99)
    expect(JSON.stringify(CANONICAL_AGENT_REGISTRY)).not.toMatch(/Tony|legacy_deleted_controller/i)
  })

  it('normalizes aliases and preserves the designer Agent Hub card order', () => {
    expect(normalizeCanonicalAgentId('Agent Zero')).toBe('agent-zero')
    expect(normalizeCanonicalAgentId('space_agent')).toBe('spaceagent')
    expect(normalizeCanonicalAgentId('OpenClaw+')).toBe('openclaw-plus')
    expect(normalizeCanonicalAgentId('pi')).toBe('pi-mono')
    expect(normalizeCanonicalAgentId('tony')).toBeNull()

    expect(getCanonicalAgentRegistry('agent_hub').map((agent) => agent.id)).toEqual(CANONICAL_AGENT_HUB_ORDER)
  })

  it('builds an owner-safe payload for Gateway, Agent Hub, dispatcher, and reports', () => {
    const payload = buildCanonicalAgentRegistryPayload('authority')

    expect(payload.map((agent) => agent.id)).toEqual([
      'agent-zero',
      'hermes',
      'pi-mono',
      'spaceagent',
      'paperclip',
      'openclaw-plus',
    ])
    expect(payload.find((agent) => agent.id === 'agent-zero')).toMatchObject({
      commander: true,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(payload.find((agent) => agent.id === 'paperclip')?.authority_rank)
      .toBeLessThan(payload.find((agent) => agent.id === 'openclaw-plus')?.authority_rank || 99)
    expect(JSON.stringify(payload)).not.toMatch(/\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}|Tony/i)
  })
})
