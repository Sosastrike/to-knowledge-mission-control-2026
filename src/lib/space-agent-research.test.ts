import { describe, expect, it } from 'vitest'

import { classifySpaceAgentResearch, createSpaceAgentResearchPacket } from './space-agent-research'

describe('Space Agent Research Packet', () => {
  it('classifies browser, web, YouTube, video, page extraction, and Firecrawl research', () => {
    expect(classifySpaceAgentResearch('Open a browser and inspect this site')).toBe('browser')
    expect(classifySpaceAgentResearch('Search the web for public articles')).toBe('web')
    expect(classifySpaceAgentResearch('Inspect this YouTube video')).toBe('youtube')
    expect(classifySpaceAgentResearch('Summarize this video')).toBe('video')
    expect(classifySpaceAgentResearch('Extract this webpage')).toBe('page_extraction')
    expect(classifySpaceAgentResearch('Use Firecrawl to scrape the page')).toBe('firecrawl')
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
      research_type: 'youtube',
      required_gateway_route: 'owner_gateway_agent_zero_space_agent',
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

  it('redacts secret-shaped values and raw local paths', () => {
    const packet = createSpaceAgentResearchPacket({
      request: 'Research /tmp/private and redact a synthetic access token',
    })

    expect(packet.request_summary).not.toContain('/tmp/private')
    expect(packet.request_summary).toContain('[redacted-path]')
    expect(packet.no_secrets_exposed).toBe(true)
  })
})
