import { describe, expect, it } from 'vitest'

import { classifySpaceAgentResearch, createSpaceAgentJob, createSpaceAgentPolicy, createSpaceAgentResearchPacket, createWebResearchIntent } from './space-agent-research'

describe('Space Agent Research Packet', () => {
  it('classifies browser, web, YouTube, video, page extraction, and Firecrawl research', () => {
    expect(classifySpaceAgentResearch('Open a browser and inspect this site')).toBe('browser')
    expect(classifySpaceAgentResearch('Search the web for public articles')).toBe('web')
    expect(classifySpaceAgentResearch('Inspect this YouTube video')).toBe('youtube')
    expect(classifySpaceAgentResearch('Summarize this video')).toBe('video')
    expect(classifySpaceAgentResearch('Extract this webpage')).toBe('page_extraction')
    expect(classifySpaceAgentResearch('Use Firecrawl to scrape the page')).toBe('firecrawl')
  })

  it('creates WebResearchIntent, SpaceAgentJob, and SpaceAgentPolicy schemas for Gateway routing', () => {
    const intent = createWebResearchIntent({
      request: 'Inspect a public article and collect evidence',
      requestedBy: 'owner',
      generatedAt: '2026-05-06T10:00:00.000Z',
    })
    const policy = createSpaceAgentPolicy(intent, { firecrawlConfigured: true })
    const job = createSpaceAgentJob({
      request: 'Inspect a public article and collect evidence',
      requestedBy: 'owner',
      generatedAt: '2026-05-06T10:00:00.000Z',
      firecrawlConfigured: true,
    })

    expect(intent).toMatchObject({
      schema: 'web_research_intent_v1',
      research_type: 'web',
      requested_by: 'owner',
      responsible_agent: 'agent_zero',
      requires_live_web: true,
      private_or_login_boundary: false,
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(policy).toMatchObject({
      schema: 'space_agent_policy_v1',
      gateway_route_required: true,
      pi_recommendation_required: true,
      agent_zero_approval_required: true,
      route_decision: 'allowed',
      external_writes_enabled: false,
      tool_execution_enabled: false,
      secrets_allowed: false,
      raw_paths_allowed: false,
    })
    expect(job).toMatchObject({
      schema: 'space_agent_job_v1',
      assigned_agent: 'space_agent',
      dispatcher: 'pi',
      supervisor: 'agent_zero',
      responsible_agent: 'agent_zero',
      execution_enabled: false,
      writes_enabled: false,
      route: {
        route_id: 'owner_gateway_pi_agent_zero_space_agent_research',
        hops: ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'],
      },
      return_route: {
        route_id: 'space_agent_gateway_responsible_agent_return',
        hops: ['space_agent', 'gateway', 'agent_zero'],
      },
    })
  })

  it('creates a research-only packet that returns responsibility to Agent Zero', () => {
    const packet = createSpaceAgentResearchPacket({
      request: 'Inspect this public YouTube video and return sources',
      requestedBy: 'agent_zero',
      generatedAt: '2026-05-05T12:00:00.000Z',
    })

    expect(packet).toMatchObject({
      mode: 'space_agent_research_packet',
      status: 'ready',
      research_stage_owner: 'space_agent',
      returns_to: 'agent_zero',
      responsible_agent: 'agent_zero',
      research_type: 'youtube',
      required_gateway_route: 'owner_gateway_pi_agent_zero_space_agent_research',
      route: {
        route_id: 'owner_gateway_pi_agent_zero_space_agent_research',
        hops: ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'],
        pi_recommendation: 'space_agent',
        agent_zero_approval: 'required',
      },
      return_route: {
        route_id: 'space_agent_gateway_responsible_agent_return',
        hops: ['space_agent', 'gateway', 'agent_zero'],
      },
      browser_interaction_enabled: false,
      external_writes_enabled: false,
      tool_execution_enabled: false,
      youtube_status: 'research_packet_only',
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(packet.forbidden_surfaces).toEqual(expect.arrayContaining(['external writes', 'raw secret files']))
    expect(packet.owner_visible_summary).toContain('Space Agent')
  })

  it('marks Firecrawl credential blockers without faking access', () => {
    const packet = createSpaceAgentResearchPacket({
      request: 'Use Firecrawl to crawl a page',
      firecrawlConfigured: false,
    })

    expect(packet.status).toBe('ready')
    expect(packet.firecrawl_status).toBe('blocked_missing_credential')
    expect(packet.blocked_reason).toBe('firecrawl_missing_credential_research_packet_can_still_use_browser_or_web_fallback_if_available')
    expect(packet.external_writes_enabled).toBe(false)
  })

  it('blocks private/login boundary work behind owner-approved scope', () => {
    const packet = createSpaceAgentResearchPacket({
      request: 'Log in with credentials and inspect a private page',
      firecrawlConfigured: true,
    })

    expect(packet.status).toBe('blocked')
    expect(packet.requires_bridge_session).toBe(true)
    expect(packet.bridge_session_reason).toBe('private_or_login_boundary_requires_owner_approved_credentials_and_bridge_session_scope')
    expect(packet.login_boundary_respected).toBe(true)
    expect(packet.paywall_private_content_blocked).toBe(true)
  })

  it('normalizes evidence, web sources, YouTube sources, and browser action summaries', () => {
    const packet = createSpaceAgentResearchPacket({
      request: 'Research a public YouTube source and summarize evidence',
      requestedBy: 'hermes',
      generatedAt: '2026-05-06T12:00:00.000Z',
      evidence: [{ summary: 'Public page confirms the launch note.', source_type: 'web', url: 'https://example.com/post' }],
      webSources: [{ url: 'https://example.com/post', title: 'Launch note', access: 'public', status: 'checked' }],
      youtubeSources: [{ video_url: 'https://www.youtube.com/watch?v=abc123', title: 'Demo', transcript_status: 'unknown' }],
      browserActions: [{ action: 'inspect', target: 'https://example.com/post', summary: 'Inspect public page only.' }],
    })

    expect(packet.returns_to).toBe('hermes')
    expect(packet.web_research_intent.schema).toBe('web_research_intent_v1')
    expect(packet.space_agent_job.schema).toBe('space_agent_job_v1')
    expect(packet.policy.schema).toBe('space_agent_policy_v1')
    expect(packet.evidence[0]).toMatchObject({ schema: 'evidence_item_v1', source_type: 'web', no_secrets_exposed: true })
    expect(packet.web_sources[0]).toMatchObject({ schema: 'web_source_v1', domain: 'example.com', status: 'checked' })
    expect(packet.youtube_sources[0]).toMatchObject({ schema: 'youtube_source_v1', video_id: 'abc123' })
    expect(packet.browser_actions[0]).toMatchObject({
      schema: 'browser_action_summary_v1',
      read_only: true,
      browser_interaction_enabled: false,
      execution_enabled: false,
    })
    expect(packet.citations).toEqual(expect.arrayContaining(['https://example.com/post', 'https://www.youtube.com/watch?v=abc123']))
  })

  it('redacts secret-shaped values and raw local paths', () => {
    const packet = createSpaceAgentResearchPacket({
      request: 'Research /tmp/private and redact a synthetic access token',
    })

    expect(packet.request_summary).not.toContain('/tmp/private')
    expect(packet.request_summary).toContain('[redacted-path]')
    expect(packet.no_secrets_exposed).toBe(true)
  })
})
