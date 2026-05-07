import { describe, expect, it } from 'vitest'

import { createGatewayRegistryFromAgentNetwork, getGatewayRoleMatrixEntry } from './gateway-model'
import { recommendPiGatewayRoute } from './gateway-pi-dispatcher'
import { buildSpaceAgentStatusPayload } from './space-agent-api'

const generatedAt = '2026-05-06T00:00:00.000Z'

describe('Space Agent Gateway health', () => {
  const registry = createGatewayRegistryFromAgentNetwork({ generatedAt })

  it('reports Space Agent health without enabling execution or leaking secrets', () => {
    const status = buildSpaceAgentStatusPayload(registry, generatedAt)
    const serialized = JSON.stringify(status)

    expect(status.node?.id).toBe('space_agent')
    expect(status.reachable).toBe(true)
    expect(status.health).toBe('blocked')
    expect(status.configured).toBe(false)
    expect(status.firecrawl).toMatchObject({
      credential_configured: false,
      backend_reachable: false,
      blocked_reason: 'firecrawl_missing_credential',
    })
    expect(status.browser).toMatchObject({
      configured: true,
      runtime_adapter_configured: true,
      bridge_session_required: true,
      execution_enabled: false,
    })
    expect(status.youtube).toMatchObject({
      transcript_path_configured: true,
      runtime_adapter_configured: false,
      execution_enabled: false,
    })
    expect(status.execution_enabled).toBe(false)
    expect(status.writes_enabled).toBe(false)
    expect(status.no_secrets_exposed).toBe(true)
    expect(status.raw_paths_exposed).toBe(false)
    expect(serialized).not.toMatch(/API_KEY|Bearer\s+|auth\.json|\/home\//i)
    expect(serialized).toMatch(/playwright_mcp_local_only_read_only_evidence_available/)
  })

  it('keeps Space Agent visible to Agent Zero, Hermes, and Pi through Gateway only', () => {
    const agentZero = getGatewayRoleMatrixEntry('agent_zero')
    const hermes = getGatewayRoleMatrixEntry('hermes')
    const spaceAgent = registry.nodes.find((node) => node.id === 'space_agent')
    const spaceCapabilities = registry.capabilities.filter((capability) => capability.source_node === 'space_agent')
    const edgePairs = new Set(registry.edges.map((edge) => `${edge.source}->${edge.target}:${edge.kind}`))

    expect(spaceAgent).toMatchObject({
      id: 'space_agent',
      kind: 'specialist_agent',
      execution_state: 'read_only_by_default',
      external_writes: 'disabled',
    })
    expect(agentZero?.supervises).toContain('space_agent')
    expect(hermes?.policy_tags).toContain('can_design_space_agent_skills')
    expect(spaceAgent?.supervisors).toEqual(expect.arrayContaining(['agent_zero', 'hermes', 'pi']))
    expect(spaceCapabilities.some((capability) => capability.available_to.includes('agent_zero'))).toBe(true)
    expect(spaceCapabilities.some((capability) => capability.available_to.includes('hermes'))).toBe(true)
    expect(edgePairs.has('agent_zero->space_agent:delegation')).toBe(true)
    expect(edgePairs.has('hermes->space_agent:delegation')).toBe(true)
    expect(edgePairs.has('space_agent->agent_zero:report')).toBe(true)
  })

  it('lets Pi recommend Space Agent for web research while keeping the route read-only', () => {
    const recommendation = recommendPiGatewayRoute(registry, {
      ownerRequest: 'Use Firecrawl and a browser to inspect this YouTube page for current source evidence.',
    })

    expect(recommendation.recommended_agent).toBe('space_agent')
    expect(recommendation.selected_route.target).toBe('space_agent')
    expect(recommendation.selected_route.via).toEqual(['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'])
    expect(recommendation.execution_enabled).toBe(false)
    expect(recommendation.writes_enabled).toBe(false)
    expect(recommendation.shadow_mode).toBe(true)
  })
})
