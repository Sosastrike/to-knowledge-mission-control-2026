import { describe, expect, it } from 'vitest'

import {
  buildGatewayMiniAgentOperatingSystem,
  createGatewayImprovementProposal,
  createGatewayMiniAgentProposal,
  routeMiniAgentRequest,
} from './gateway-mini-agent-os'
import { createMiniAgentMemory } from './gateway-mini-agent-contracts'
import { recommendPiGatewayRoute } from './gateway-pi-dispatcher'
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
    const spaceAgent = registry.nodes.find((node) => node.id === 'space_agent')
    const tonyNodes = registry.nodes.filter((node) => node.id.startsWith('tony'))

    expect(os.hierarchy.owner).toBe('final_authority')
    expect(os.hierarchy.gateway).toBe('routing_policy_documentation_memory_audit_hub')
    expect(os.hierarchy.agent_zero).toBe('commander')
    expect(os.hierarchy.hermes).toBe('lieutenant_skill_workflow_builder')
    expect(os.hierarchy.pi).toBe('dispatcher_candidate_route_optimizer_tool_use_advisor')
    expect(os.hierarchy.space_agent).toBe('browser_web_youtube_research')
    expect(agentZero).toMatchObject({ kind: 'commander', owner: 'owner', visibility: 'owner_visible' })
    expect(hermes).toMatchObject({ kind: 'lieutenant', visibility: 'owner_visible' })
    expect(pi).toMatchObject({ kind: 'mini_agent', status: 'read_only', visibility: 'owner_visible' })
    expect(spaceAgent).toMatchObject({ kind: 'specialist_agent', status: 'read_only', visibility: 'owner_visible' })
    expect(registry.nodes.filter((node) => node.id === 'agent_zero')).toHaveLength(1)
    expect(tonyNodes.every((node) => node.visibility === 'archived' && node.status === 'legacy_archived')).toBe(true)
    expect(os.registry.tony_active_authority).toBe(false)
    expect(os.registry.opencloud_retained).toBe(true)
    expect(os.registry.space_agent_present).toBe(true)
    expect(os.registry.space_agent_commander_authority).toBe(false)
    expect(os.roles).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'space_agent',
        role: 'browser_web_youtube_research',
        can_create_proposals: false,
        can_supervise: false,
        can_execute: false,
      }),
    ]))
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

  it('records safe daily improvement loops without deploying changes', () => {
    const os = buildGatewayMiniAgentOperatingSystem(registry)
    const hermes = createGatewayImprovementProposal(registry, {
      source: 'hermes_daily_skill_proposal',
      title: 'Build-Wiki summary skill proposal',
      evidence: ['recurring report request', 'manual summary step repeated'],
      agent_zero_reviewed: true,
      tests_passed: true,
    })
    const pi = createGatewayImprovementProposal(registry, {
      source: 'pi_daily_route_improvement',
      title: 'Route small research tasks to mini-agent proposal',
      evidence: ['same route repeated four times'],
      repeated_route_count: 4,
      agent_zero_reviewed: true,
      tests_passed: true,
    })

    expect(os.improvement_loop).toMatchObject({
      hermes_daily_skill_proposals: true,
      pi_daily_route_improvements: true,
      agent_zero_review_required: true,
      gateway_logs_accepted_rejected_proposals: true,
      no_improvement_deploys_without_tests: true,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(hermes).toMatchObject({
      ok: true,
      mode: 'gateway_improvement_proposal_dry_run',
      source: 'hermes_daily_skill_proposal',
      proposer: 'hermes',
      cadence: 'daily',
      agent_zero_review: 'reviewed',
      hermes_skill_proposal: { required: true, production_write: false },
      pi_dispatcher_rule: { required: false, production_write: false },
      deployment: { allowed: false, blocked_reason: 'gateway_improvement_deployment_requires_bridge_session_and_change_review' },
      tests_required: true,
      tests_passed: true,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(pi).toMatchObject({
      ok: true,
      source: 'pi_daily_route_improvement',
      proposer: 'pi',
      pi_dispatcher_rule: { required: true, production_write: false },
      deployment: { allowed: false },
    })
  })

  it('blocks improvement deployment until Agent Zero review and tests exist', () => {
    const missingReview = createGatewayImprovementProposal(registry, {
      source: 'mini_agent_missing_tool',
      title: 'Missing source verifier tool',
      evidence: ['mini-agent reported missing read-only verifier'],
      tests_passed: true,
    })
    const missingTests = createGatewayImprovementProposal(registry, {
      source: 'mini_agent_failed_instruction',
      title: 'Instruction failed on ambiguous source list',
      evidence: ['mini-agent reported failed instruction'],
      agent_zero_reviewed: true,
      tests_passed: false,
    })

    expect(missingReview).toMatchObject({
      ok: false,
      source: 'mini_agent_missing_tool',
      proposer: 'mini_agent',
      agent_zero_review: 'required',
      hermes_skill_proposal: { required: true, production_write: false },
      mini_agent_report: { missing_tool: true, failed_instruction: false },
      blocked_reason: 'gateway_improvement_agent_zero_review_required',
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(missingTests).toMatchObject({
      ok: false,
      source: 'mini_agent_failed_instruction',
      proposer: 'mini_agent',
      hermes_skill_proposal: { required: true, production_write: false },
      mini_agent_report: { missing_tool: false, failed_instruction: true },
      blocked_reason: 'gateway_improvement_tests_required_before_deployment',
      tests_required: true,
      tests_passed: false,
    })
    expect(JSON.stringify({ missingReview, missingTests })).not.toMatch(/sk-live|Bearer\s+abc123|sample-token-placeholder/i)
  })

  it('composes the owner mission to Pi, Hermes, mini-agent, and Agent Zero return flow', () => {
    const ownerMission = 'Create a workflow for recurring research summaries with a scoped mini-agent.'
    const piRoute = recommendPiGatewayRoute(registry, { ownerRequest: ownerMission })
    const hermesPlan = createGatewayImprovementProposal(registry, {
      source: 'hermes_daily_skill_proposal',
      title: 'Recurring research summary workflow',
      evidence: ['owner mission routed through Gateway', 'Pi recommended Hermes for workflow design'],
      agent_zero_reviewed: true,
      tests_passed: true,
    })
    const miniAgent = createGatewayMiniAgentProposal(registry, {
      name: 'Research Summary Scout',
      purpose: 'Perform a scoped read-only research summary and return the result to Agent Zero.',
      parent_supervisor: 'hermes',
      scope: ['read-only research summary', 'return result to Agent Zero'],
      allowed_capabilities: ['mini_agents.gateway_supervision'],
    })
    const miniAgentResult = createMiniAgentMemory({
      mini_agent_id: miniAgent.mini_agent!.id,
      parent_task: 'owner_gateway_workflow_summary',
      parent_supervisor: 'hermes',
      source: 'mini_agent_output',
      facts: ['Scoped read-only result returned to Agent Zero.'],
      assumptions: ['No external write was needed.'],
      blocked_items: ['Activation remains Bridge Session gated.'],
    })

    expect(piRoute.recommended_agent).toBe('hermes')
    expect(piRoute.selected_route.via).toEqual(['owner', 'gateway', 'agent_zero', 'hermes'])
    expect(hermesPlan).toMatchObject({
      ok: true,
      proposer: 'hermes',
      agent_zero_review: 'reviewed',
      hermes_skill_proposal: { required: true, production_write: false },
      deployment: { allowed: false },
    })
    expect(miniAgent).toMatchObject({
      ok: true,
      mini_agent: { parent_supervisor: 'hermes', command_authority: 'agent_zero' },
      accepted_for_activation: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(miniAgent.route?.hops).toEqual(['owner', 'gateway', 'agent_zero', 'gateway', 'hermes', 'gateway', 'mini_agent_research_summary_scout'])
    expect(miniAgentResult).toMatchObject({
      ok: true,
      memory: { state: 'temporary', parent_supervisor: 'hermes', contains_secrets: false },
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(JSON.stringify({ piRoute, hermesPlan, miniAgent, miniAgentResult })).not.toMatch(/sk-live|Bearer\s+abc123|sample-token-placeholder/i)
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
