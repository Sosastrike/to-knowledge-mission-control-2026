import { describe, expect, it } from 'vitest'

import {
  buildGatewayMiniAgentOperatingSystem,
  createGatewayMiniAgentProposal,
  routeMiniAgentRequest,
} from './gateway-mini-agent-os'
import { createGatewayRegistryFromAgentNetwork } from './gateway-model'

const registry = createGatewayRegistryFromAgentNetwork({
  generatedAt: '2026-05-05T12:00:00.000Z',
  hermes: { installed: true, reachable: true, authConfigured: true },
})

describe('Gateway mini-agent operating system', () => {
  it('keeps the core hierarchy intact and adds Pi without replacing Agent Zero', () => {
    const os = buildGatewayMiniAgentOperatingSystem(registry)
    const agentZero = registry.nodes.find((node) => node.id === 'agent_zero')
    const hermes = registry.nodes.find((node) => node.id === 'hermes')
    const pi = registry.nodes.find((node) => node.id === 'pi')
    const tonyNodes = registry.nodes.filter((node) => node.id.startsWith('tony'))

    expect(os.hierarchy.owner).toBe('final_authority')
    expect(os.hierarchy.gateway).toBe('routing_policy_documentation_memory_audit_hub')
    expect(os.hierarchy.agent_zero).toBe('commander')
    expect(os.hierarchy.hermes).toBe('lieutenant_skill_workflow_builder')
    expect(os.hierarchy.pi).toBe('dispatcher_candidate_route_optimizer_tool_use_advisor')
    expect(agentZero).toMatchObject({ kind: 'commander', owner: 'owner', visibility: 'owner_visible' })
    expect(hermes).toMatchObject({ kind: 'lieutenant', visibility: 'owner_visible' })
    expect(pi).toMatchObject({ kind: 'mini_agent', status: 'read_only', visibility: 'owner_visible' })
    expect(registry.nodes.filter((node) => node.id === 'agent_zero')).toHaveLength(1)
    expect(tonyNodes.every((node) => node.visibility === 'archived' && node.status === 'legacy_archived')).toBe(true)
    expect(os.registry.tony_active_authority).toBe(false)
    expect(os.registry.opencloud_retained).toBe(true)
  })

  it('requires every mini-agent proposal to have supervisor, scope, memory TTL, and audit trail', () => {
    const proposal = createGatewayMiniAgentProposal(registry, {
      name: 'Research Scout',
      purpose: 'Summarize a safe registry source for Agent Zero.',
      parent_supervisor: 'hermes',
      scope: ['read-only discovery', 'draft summary', 'report back to Agent Zero'],
      memory_ttl_hours: 72,
      allowed_capabilities: ['mini_agents.gateway_supervision'],
    })

    expect(proposal.ok).toBe(true)
    expect(proposal.mini_agent).toMatchObject({
      id: 'mini_agent_research_scout',
      parent_supervisor: 'hermes',
      command_authority: 'agent_zero',
      memory_ttl_hours: 72,
      allowed_capabilities: ['mini_agents_gateway_supervision'],
    })
    expect(proposal.route).toMatchObject({
      supervisor: 'hermes',
      command_authority: 'agent_zero',
      requires_bridge_session: true,
      execution_enabled: false,
      writes_enabled: false,
      audit_required: true,
    })
    expect(proposal.route?.hops).toEqual(['owner', 'gateway', 'agent_zero', 'gateway', 'hermes', 'gateway', 'mini_agent_research_scout'])
    expect(proposal.audit_trail.map((event) => event.event)).toEqual(expect.arrayContaining([
      'gateway.mini_agent.proposal',
      'gateway.mini_agent.supervisor',
      'gateway.mini_agent.memory_ttl',
    ]))
    expect(proposal.accepted_for_activation).toBe(false)
    expect(proposal.execution_enabled).toBe(false)
    expect(proposal.writes_enabled).toBe(false)
    expect(proposal.blocked_reason).toBe('mini_agent_activation_requires_bridge_session_and_registered_runtime_adapter')
  })

  it('blocks second Agent Zero attempts and forbidden access scopes', () => {
    const secondAgentZero = createGatewayMiniAgentProposal(registry, {
      name: 'Agent Zero',
      purpose: 'Duplicate commander',
      parent_supervisor: 'pi',
      scope: ['planning'],
    })
    const rootScope = createGatewayMiniAgentProposal(registry, {
      name: 'Unsafe Worker',
      purpose: 'Unsafe request',
      parent_supervisor: 'agent_zero',
      scope: ['use root shell and docker socket'],
    })

    expect(secondAgentZero.ok).toBe(false)
    expect(secondAgentZero.blocked_reason).toBe('mini_agent_name_reserved_existing_agent_or_authority')
    expect(rootScope.ok).toBe(false)
    expect(rootScope.blocked_reason).toBe('mini_agent_scope_contains_forbidden_access')
    expect(rootScope.safety).toMatchObject({
      no_raw_root_shell: true,
      no_docker_socket: true,
      no_direct_secret_reads: true,
      no_second_agent_zero: true,
    })
  })

  it('routes Pi as an advisor candidate through Agent Zero and Gateway, not as commander', () => {
    const route = routeMiniAgentRequest(registry, {
      name: 'Tool Route Advisor',
      parent_supervisor: 'pi',
      scope: ['recommend Gateway route'],
    })

    expect(route.supervisor).toBe('pi')
    expect(route.command_authority).toBe('agent_zero')
    expect(route.hops).toEqual(['owner', 'gateway', 'agent_zero', 'gateway', 'pi', 'gateway', 'mini_agent_tool_route_advisor'])
    expect(route.execution_enabled).toBe(false)
    expect(route.blocked_reason).toBe('mini_agent_activation_requires_bridge_session_and_registered_runtime_adapter')
  })

  it('keeps owner-facing proposal output free of raw paths, secrets, and fake completion', () => {
    const rawPath = ['', 'home', 'tony', 'private', 'note.md'].join('/')
    const secretish = ['TOKEN', 'secret-value'].join('=')
    const proposal = createGatewayMiniAgentProposal(registry, {
      name: 'Path Cleaner',
      purpose: `Clean ${rawPath} ${secretish}`,
      parent_supervisor: 'agent_zero',
      scope: ['read-only report'],
    })
    const serialized = JSON.stringify(proposal)

    expect(serialized).not.toContain(rawPath)
    expect(serialized).not.toContain(secretish)
    expect(serialized).not.toMatch(/\bdone\b/i)
    expect(proposal.safety.no_secrets_exposed).toBe(true)
    expect(proposal.safety.no_fake_done).toBe(true)
  })
})
