import { describe, expect, it } from 'vitest'

import {
  createSpaceResearchMiniAgentFanout,
  createSpaceResearchMiniAgentTemplateCatalog,
  type SpaceResearchMiniAgentKind,
} from './space-agent-research'

const generatedAt = '2026-05-06T23:30:00.000Z'

const miniAgentCases: Array<{
  phase: number
  kind: SpaceResearchMiniAgentKind
  request: string
  assignedUrls: string[]
  expectedName: string
  expectedSkill: string
}> = [
  {
    phase: 251,
    kind: 'web_research',
    request: 'Research this public web source for Agent Zero.',
    assignedUrls: ['https://example.com/web-research'],
    expectedName: 'Web Research Mini-Agent',
    expectedSkill: 'space_agent.web_research_packet',
  },
  {
    phase: 252,
    kind: 'youtube_summary',
    request: 'Summarize this public YouTube video metadata and transcript.',
    assignedUrls: ['https://www.youtube.com/watch?v=abc123'],
    expectedName: 'YouTube Summary Mini-Agent',
    expectedSkill: 'space_agent.youtube_summary_packet',
  },
  {
    phase: 253,
    kind: 'crawl_mapper',
    request: 'Map this public crawl scope without running broad crawl execution.',
    assignedUrls: ['https://example.com/docs'],
    expectedName: 'Crawl Mapper Mini-Agent',
    expectedSkill: 'space_agent.crawl_mapper_packet',
  },
  {
    phase: 254,
    kind: 'competitive_research',
    request: 'Compare assigned public competitor sources.',
    assignedUrls: ['https://example.com/competitor-a', 'https://example.org/competitor-b'],
    expectedName: 'Competitive Research Mini-Agent',
    expectedSkill: 'space_agent.competitive_research_packet',
  },
  {
    phase: 255,
    kind: 'source_verifier',
    request: 'Verify assigned public sources and citation confidence.',
    assignedUrls: ['https://example.com/source-to-verify'],
    expectedName: 'Source Verifier Mini-Agent',
    expectedSkill: 'space_agent.source_verifier_packet',
  },
]

describe('Space Agent specialist mini-agent templates', () => {
  it('creates the five specialist mini-agent templates for phases 251-255', () => {
    const catalog = createSpaceResearchMiniAgentTemplateCatalog(generatedAt)

    expect(catalog.map((template) => template.template_kind)).toEqual([
      'web_research',
      'youtube_summary',
      'crawl_mapper',
      'competitive_research',
      'source_verifier',
    ])
    for (const item of miniAgentCases) {
      const template = catalog.find((entry) => entry.template_kind === item.kind)
      expect(template).toMatchObject({
        schema: 'space_research_mini_agent_template_v1',
        created_by: 'hermes',
        template_kind: item.kind,
        name: item.expectedName,
        parent_supervisor: 'agent_zero',
        requested_by: 'space_agent',
        output_contract: 'sub_research_packet',
        activation_requires: 'agent_zero_approval_and_gateway_policy',
        bridge_session_required_for_execution: true,
        execution_enabled: false,
        writes_enabled: false,
        no_secrets_exposed: true,
      })
      expect(template?.allowed_skills).toContain(item.expectedSkill)
      expect(template?.forbidden_tools).toEqual(expect.arrayContaining(['external_write', 'direct_secret_read', 'raw_root_shell', 'docker_socket']))
    }
  })

  it('creates scoped specialist mini-agents, merges their results, enforces TTL, and expires them', () => {
    for (const item of miniAgentCases) {
      const fanout = createSpaceResearchMiniAgentFanout({
        request: item.request,
        requestedBy: 'agent_zero',
        responsibleAgent: 'hermes',
        generatedAt,
        miniAgentKind: item.kind,
        assignedUrls: item.assignedUrls,
        memoryTtlMinutes: 45,
        firecrawlConfigured: true,
        webSources: item.assignedUrls.map((url, index) => ({
          source_id: `${item.kind}-source-${index + 1}`,
          url,
          title: `${item.expectedName} source ${index + 1}`,
          access: 'public',
          status: 'checked',
        })),
        subEvidence: [{
          evidence_id: `${item.kind}-evidence`,
          source_id: `${item.kind}-source-1`,
          source_type: item.kind === 'youtube_summary' ? 'youtube' : 'web',
          summary: `${item.expectedName} returned scoped evidence for Gateway.`,
          quote: 'scoped evidence',
          url: item.assignedUrls[0],
          confidence: 'high',
        }],
      })

      expect(fanout.template).toMatchObject({
        template_kind: item.kind,
        name: item.expectedName,
      })
      expect(fanout.agent_zero_approval).toMatchObject({
        approved_for_creation: true,
        activation_enabled: false,
        blocked_reason: null,
      })
      expect(fanout.pi_recommendation).toMatchObject({
        shadow_mode: true,
        recommended: true,
        recommended_mini_agent_type: 'research',
        recommended_template_kind: item.kind,
        execution_enabled: false,
        writes_enabled: false,
      })
      expect(fanout.assigned_scope).toMatchObject({
        allowed_urls: item.assignedUrls,
        memory_ttl_minutes: 45,
        browse_outside_scope_allowed: false,
        blocked_reason: null,
      })
      expect(fanout.mini_agent_definition).toMatchObject({
        name: item.expectedName,
        parent_supervisor: 'agent_zero',
        command_authority: 'agent_zero',
        memory_ttl_minutes: 45,
        lifecycle: 'proposed',
        execution_enabled: false,
        external_writes_enabled: false,
        direct_secret_access_allowed: false,
        raw_root_shell_allowed: false,
        docker_socket_allowed: false,
      })
      expect(fanout.mini_agent_definition?.allowed_skills).toContain(item.expectedSkill)
      expect(fanout.mini_agent_definition?.forbidden_tools).toEqual(expect.arrayContaining(['browse_outside_assigned_scope', 'direct_secret_read', 'docker_socket']))
      expect(fanout.mini_agent_memory).toMatchObject({
        ttl_minutes: 45,
        state: 'temporary',
        parent_supervisor: 'agent_zero',
        contains_secrets: false,
      })
      expect(fanout.sub_research_packet?.findings).toEqual([`${item.expectedName} returned scoped evidence for Gateway.`])
      expect(fanout.gateway_merge).toMatchObject({
        status: 'merged',
        findings: [`${item.expectedName} returned scoped evidence for Gateway.`],
        citations: item.assignedUrls,
        confidence: 'high',
      })
      expect(fanout.expired_mini_agent?.lifecycle).toBe('expired')
      expect(fanout.expired_memory?.state).toBe('expired')
      expect(fanout.audit_log.map((entry) => entry.event)).toEqual([
        'space_agent.mini_agent.requested',
        'hermes.space_research_template.created',
        'pi.mini_agent_fanout.recommended',
        'agent_zero.mini_agent_creation.reviewed',
        'gateway.mini_agent.scope.assigned',
        'mini_agent.sub_research_packet.returned',
        'gateway.sub_research_packet.merged',
        'gateway.mini_agent.expired',
      ])
      expect(fanout.audit_log.every((entry) => !entry.external_write && !entry.secrets_exposed)).toBe(true)
    }
  })

  it('enforces URL scope and blocks out-of-scope specialist browsing', () => {
    const fanout = createSpaceResearchMiniAgentFanout({
      request: 'Research only the assigned source.',
      generatedAt,
      miniAgentKind: 'source_verifier',
      assignedUrls: ['https://example.com/allowed-source'],
      outOfScopeUrlToCheck: 'https://example.org/out-of-scope',
      subEvidence: [{
        summary: 'This evidence should not merge because the requested URL is out of scope.',
        url: 'https://example.org/out-of-scope',
      }],
    })

    expect(fanout.scope_decision).toMatchObject({
      requested_url: 'https://example.org/out-of-scope',
      allowed: false,
      blocked_reason: 'mini_agent_browse_outside_assigned_scope_blocked',
    })
    expect(fanout.sub_research_packet).toBeNull()
    expect(fanout.gateway_merge.status).toBe('needs_more_research')
  })

  it('blocks specialist mini-agent creation when input contains secret-shaped values', () => {
    const secretLikeValue = ['Bearer', 'abcdefghijklmnopqrstuvwxyz'].join(' ')
    const fanout = createSpaceResearchMiniAgentFanout({
      request: 'Research this assigned public source.',
      generatedAt,
      miniAgentKind: 'web_research',
      assignedUrls: ['https://example.com/assigned-source'],
      subEvidence: [{
        summary: `Unsafe credential-shaped value: ${secretLikeValue}`,
        url: 'https://example.com/assigned-source',
      }],
    })

    expect(fanout.assigned_scope.blocked_reason).toBe('mini_agent_secret_input_blocked')
    expect(fanout.pi_recommendation).toMatchObject({
      recommended: false,
      blocked_reason: 'mini_agent_secret_input_blocked',
    })
    expect(fanout.agent_zero_approval).toMatchObject({
      approved_for_creation: false,
      activation_enabled: false,
      blocked_reason: 'mini_agent_secret_input_blocked',
    })
    expect(fanout.mini_agent_definition_result).toMatchObject({
      ok: false,
      policy_result: 'blocked',
      blocked_reason: 'mini_agent_secret_input_blocked',
    })
    expect(fanout.mini_agent_definition).toBeNull()
    expect(fanout.mini_agent_memory).toBeNull()
    expect(fanout.sub_research_packet).toBeNull()
    expect(fanout.expired_mini_agent).toBeNull()
    expect(fanout.expired_memory).toBeNull()
  })
})
