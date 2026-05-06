import { describe, expect, it } from 'vitest'

import { createSpaceAgentResearchCompletion } from './space-agent-research'

const generatedAt = '2026-05-06T23:00:00.000Z'

describe('Space Agent end-to-end research flow', () => {
  it('routes owner research through Gateway, Space Agent, Pi, Hermes, and Agent Zero with cited final answer', () => {
    const completion = createSpaceAgentResearchCompletion({
      request: 'Research public sources about Gateway evidence packets so Hermes can design a workflow.',
      requestedBy: 'owner',
      responsibleAgent: 'hermes',
      generatedAt,
      evidence: [
        {
          evidence_id: 'gateway-packet-evidence',
          source_id: 'gateway-public-source',
          source_type: 'web',
          summary: 'Public source says Gateway should validate evidence before downstream workflow design.',
          quote: 'Gateway should validate evidence before workflow design.',
          url: 'https://example.com/gateway-evidence',
          confidence: 'high',
        },
      ],
      webSources: [
        {
          source_id: 'gateway-public-source',
          url: 'https://example.com/gateway-evidence',
          title: 'Gateway evidence packets',
          access: 'public',
          status: 'checked',
        },
      ],
      browserActions: [
        {
          action: 'inspect',
          target: 'https://example.com/gateway-evidence',
          timestamp: generatedAt,
          summary: 'Read-only public page inspection summary.',
        },
      ],
    })

    expect(completion).toMatchObject({
      schema: 'space_agent_research_completion_v1',
      mode: 'gateway_space_agent_research_completion',
      status: 'answer_ready',
      owner_research_question_received: true,
      gateway_selected_space_agent: true,
      space_agent_researched: true,
      space_agent_returned_research_packet: true,
      gateway_validated_evidence: true,
      pi_reviewed_routing: true,
      hermes_created_workflow_from_findings: true,
      agent_zero_decided_next_step: true,
      responsible_agent_executed_next_non_web_step: true,
      final_answer_cites_research_packet: true,
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(completion.handoff.packet.route.hops).toEqual(['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'])
    expect(completion.handoff.packet.return_route.hops).toEqual(['space_agent', 'gateway', 'hermes'])
    expect(completion.handoff.gateway_validation).toMatchObject({
      validator: 'gateway',
      decision: 'accepted',
      valid: true,
      evidence_count: 1,
      citations_count: 1,
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(completion.handoff.pi_quality_review).toMatchObject({
      reviewer: 'pi',
      shadow_mode: true,
      recommendation: 'handoff_to_responsible_agent',
      recommended_next_agent: 'hermes',
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(completion.handoff.hermes_workflow_draft).toMatchObject({
      reviewer: 'hermes',
      mode: 'workflow_design_only',
      available: true,
      activation_requires: 'agent_zero_bridge_session',
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(completion.handoff.agent_zero_decision).toMatchObject({
      decision_maker: 'agent_zero',
      decision: 'handoff_to_responsible_agent',
      next_agent: 'hermes',
      owner_response_owner: 'agent_zero',
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(completion.responsible_agent_next_step).toMatchObject({
      schema: 'responsible_agent_non_web_step_v1',
      agent: 'hermes',
      action: 'workflow_draft_prepared',
      status: 'completed',
      web_research_reopened: false,
      external_write: false,
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(completion.final_answer).toMatchObject({
      schema: 'agent_zero_research_final_answer_v1',
      response_owner: 'agent_zero',
      cites_research_packet: true,
      citations: ['https://example.com/gateway-evidence'],
      blocked_reason: null,
      no_fake_done: true,
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(completion.final_answer.answer).toContain('Space Agent ResearchPacket')
    expect(completion.final_answer.answer).toContain('https://example.com/gateway-evidence')
    expect(completion.final_answer.answer).not.toContain(['/home', 'tony'].join('/'))
    expect(completion.final_answer.answer).not.toMatch(/\bDone\b/)
    expect(completion.handoff.audit_log).toHaveLength(completion.handoff.stages.length)
    expect(completion.handoff.audit_log.every((entry) => entry.no_secrets_exposed && entry.no_raw_paths)).toBe(true)
  })

  it('does not produce a final done claim when Gateway needs more evidence', () => {
    const completion = createSpaceAgentResearchCompletion({
      request: 'Search the web for public evidence about Gateway handoffs.',
      requestedBy: 'owner',
      responsibleAgent: 'agent_zero',
      generatedAt,
    })

    expect(completion.status).toBe('needs_more_research')
    expect(completion.gateway_validated_evidence).toBe(false)
    expect(completion.responsible_agent_executed_next_non_web_step).toBe(false)
    expect(completion.responsible_agent_next_step).toMatchObject({
      agent: 'agent_zero',
      action: 'findings_reviewed',
      status: 'needs_more_research',
      external_write: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(completion.final_answer).toMatchObject({
      cites_research_packet: true,
      citations: [],
      blocked_reason: 'research_packet_needs_more_evidence',
      no_fake_done: true,
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(completion.final_answer.answer).toContain('cannot finish')
    expect(completion.final_answer.answer).not.toMatch(/\bDone\b/)
  })
})
