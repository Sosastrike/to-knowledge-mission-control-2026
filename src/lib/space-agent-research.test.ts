import { describe, expect, it } from 'vitest'

import { classifySpaceAgentResearch, classifySpaceAgentResearchOperation, createSpaceAgentJob, createSpaceAgentPolicy, createSpaceAgentResearchPacket, createWebResearchIntent, createYouTubeResearchPacket } from './space-agent-research'

describe('Space Agent Research Packet', () => {
  it('classifies browser, web, YouTube, video, page extraction, and Firecrawl research', () => {
    expect(classifySpaceAgentResearch('Open a browser and inspect this site')).toBe('browser')
    expect(classifySpaceAgentResearch('Search the web for public articles')).toBe('web')
    expect(classifySpaceAgentResearch('Inspect this YouTube video')).toBe('youtube')
    expect(classifySpaceAgentResearch('Summarize this video')).toBe('video')
    expect(classifySpaceAgentResearch('Extract this webpage')).toBe('page_extraction')
    expect(classifySpaceAgentResearch('Use Firecrawl to scrape the page')).toBe('firecrawl')
  })

  it('classifies Space Agent research operations for phases 031-040', () => {
    expect(classifySpaceAgentResearchOperation('Search the web for public sources')).toBe('web_search')
    expect(classifySpaceAgentResearchOperation('Read this website page')).toBe('page_read')
    expect(classifySpaceAgentResearchOperation('Use Firecrawl to scrape a page')).toBe('firecrawl_scrape')
    expect(classifySpaceAgentResearchOperation('Use Firecrawl to crawl a site')).toBe('firecrawl_crawl')
    expect(classifySpaceAgentResearchOperation('Use Firecrawl map on a site')).toBe('firecrawl_map')
    expect(classifySpaceAgentResearchOperation('Use Firecrawl extract for structured data')).toBe('firecrawl_extract')
    expect(classifySpaceAgentResearchOperation('Perform browser interaction on a public page')).toBe('browser_interaction')
    expect(classifySpaceAgentResearchOperation('Inspect this YouTube video')).toBe('youtube_video_inspection')
    expect(classifySpaceAgentResearchOperation('Capture screenshot and page state')).toBe('screenshot_page_state')
    expect(classifySpaceAgentResearchOperation('Agents normally cannot access this site/video')).toBe('inaccessible_site_or_video')
    expect(classifySpaceAgentResearchOperation('Good morning. Who are you?')).toBe('research_not_needed')
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
      research_type: 'page_extraction',
      research_operation: 'page_read',
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
      owner_credentials_for_browser_requires_approval: true,
      copyrighted_video_download_blocked_by_default: true,
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
      job_id: packet.space_agent_job.job_id,
      original_request: 'Inspect this public YouTube video and return sources',
      assigned_supervisor: 'agent_zero',
      status: 'ready',
      research_stage_owner: 'space_agent',
      returns_to: 'agent_zero',
      responsible_agent: 'agent_zero',
      recommended_next_agent: 'agent_zero',
      research_type: 'youtube',
      research_operation: 'youtube_video_inspection',
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
    expect(packet.confidence).toBe('low')
    expect(packet.source_list).toEqual([])
    expect(packet.evidence_snippets).toEqual([])
    expect(packet.blockers).toEqual([])
    expect(packet.urls).toEqual([])
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

    const browserAction = packet.browser_actions[0]

    expect(packet.returns_to).toBe('hermes')
    expect(packet.web_research_intent.schema).toBe('web_research_intent_v1')
    expect(packet.space_agent_job.schema).toBe('space_agent_job_v1')
    expect(packet.policy.schema).toBe('space_agent_policy_v1')
    expect(browserAction.web_research_intent_id).toBe(packet.web_research_intent.intent_id)
    expect(browserAction).toMatchObject({
      url: 'https://example.com/post',
      timestamp: '2026-05-06T12:00:00.000Z',
      action_type: 'inspect',
      returns_evidence: true,
      hidden_state_returned: false,
      stays_inside_space_agent: true,
    })
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

  it('includes Gateway handoff fields for sources, findings, confidence, snippets, citations, blockers, and next agent', () => {
    const packet = createSpaceAgentResearchPacket({
      request: 'Research a public article and return evidence',
      requestedBy: 'owner',
      responsibleAgent: 'hermes',
      generatedAt: '2026-05-06T18:00:00.000Z',
      evidence: [
        { evidence_id: 'ev-high', source_id: 'web-source-1', summary: 'The article says Gateway routes research to Space Agent.', quote: 'Gateway routes research to Space Agent.', source_type: 'web', url: 'https://example.com/article', confidence: 'high' },
        { evidence_id: 'ev-med', source_id: 'yt-source-1', summary: 'The video metadata supports the same route.', source_type: 'youtube', url: 'https://www.youtube.com/watch?v=abc123', confidence: 'medium' },
      ],
      webSources: [{ source_id: 'web-source-1', url: 'https://example.com/article', title: 'Gateway article', access: 'public', status: 'checked' }],
      youtubeSources: [{ source_id: 'yt-source-1', video_url: 'https://www.youtube.com/watch?v=abc123', title: 'Gateway video', transcript_status: 'available' }],
      browserActions: [{ action: 'inspect', target: 'https://example.com/article', summary: 'Public page inspection summary.' }],
    })

    expect(packet.job_id).toBe(packet.space_agent_job.job_id)
    expect(packet.original_request).toBe('Research a public article and return evidence')
    expect(packet.assigned_supervisor).toBe('agent_zero')
    expect(packet.recommended_next_agent).toBe('hermes')
    expect(packet.findings).toEqual([
      'The article says Gateway routes research to Space Agent.',
      'The video metadata supports the same route.',
    ])
    expect(packet.confidence).toBe('medium')
    expect(packet.evidence_snippets).toEqual(expect.arrayContaining([
      expect.objectContaining({ evidence_id: 'ev_high', snippet: 'Gateway routes research to Space Agent.', url: 'https://example.com/article', confidence: 'high' }),
      expect.objectContaining({ evidence_id: 'ev_med', snippet: 'The video metadata supports the same route.', url: 'https://www.youtube.com/watch?v=abc123', confidence: 'medium' }),
    ]))
    expect(packet.source_list).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_id: 'web_source_1', source_type: 'web_source', title: 'Gateway article', url: 'https://example.com/article', status: 'checked' }),
      expect.objectContaining({ source_id: 'yt_source_1', source_type: 'youtube_source', title: 'Gateway video', url: 'https://www.youtube.com/watch?v=abc123', status: 'available' }),
      expect.objectContaining({ source_type: 'browser_action', url: 'https://example.com/article', status: 'planned' }),
    ]))
    expect(packet.citations).toEqual(['https://example.com/article', 'https://www.youtube.com/watch?v=abc123'])
    expect(packet.urls).toEqual(packet.citations)
    expect(packet.blockers).toEqual([])
  })

  it('includes explicit blockers and low confidence when research is blocked or limited', () => {
    const packet = createSpaceAgentResearchPacket({
      request: 'Bypass the paywall and scrape a private account',
      generatedAt: '2026-05-06T18:30:00.000Z',
      webSources: [{ url: 'https://example.com/private', status: 'blocked', blocked_reason: 'private_source_blocked' }],
      browserActions: [{ action: 'inspect', target: 'https://example.com/private', summary: 'Bypass the paywall and scrape a private account' }],
    })

    expect(packet.status).toBe('blocked')
    expect(packet.confidence).toBe('low')
    expect(packet.blockers).toEqual(expect.arrayContaining(['paywall_bypass_not_allowed', 'private_source_blocked']))
    expect(packet.source_list).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: 'https://example.com/private', status: 'blocked', blocked_reason: 'private_source_blocked' }),
      expect.objectContaining({ source_type: 'browser_action', status: 'blocked', blocked_reason: 'paywall_bypass_not_allowed' }),
    ]))
  })

  it('requires browser actions to attach to WebResearchIntent and log URL, timestamp, and action type', () => {
    const packet = createSpaceAgentResearchPacket({
      request: 'Capture screenshot and page state for a public page',
      generatedAt: '2026-05-06T14:00:00.000Z',
      browserActions: [{ action: 'screenshot', target: 'https://example.com', summary: 'Capture page text, screenshot reference, and metadata only.' }],
    })

    expect(packet.web_research_intent.schema).toBe('web_research_intent_v1')
    expect(packet.browser_actions[0]).toMatchObject({
      web_research_intent_id: packet.web_research_intent.intent_id,
      action: 'screenshot',
      action_type: 'screenshot',
      url: 'https://example.com',
      timestamp: '2026-05-06T14:00:00.000Z',
      allowed_capture: ['page_text', 'screenshot_reference', 'metadata'],
      returns_evidence: true,
      hidden_state_returned: false,
      stays_inside_space_agent: true,
      blocked_reason: null,
    })
  })

  it('blocks browser actions that request owner credentials, paywall bypass, private account scraping, or copyrighted video download', () => {
    const cases = [
      {
        request: 'Use my saved login credentials to inspect the page',
        blocker: 'owner_credentials_not_approved',
      },
      {
        request: 'Bypass the paywall and capture the article',
        blocker: 'paywall_bypass_not_allowed',
      },
      {
        request: 'Scrape a private account dashboard',
        blocker: 'private_account_scrape_not_approved',
      },
      {
        request: 'Download a copyrighted YouTube video',
        blocker: 'copyrighted_video_download_blocked_by_default',
      },
    ]

    for (const item of cases) {
      const packet = createSpaceAgentResearchPacket({
        request: item.request,
        generatedAt: '2026-05-06T15:00:00.000Z',
        browserActions: [{ action: 'inspect', target: 'https://example.com/private', summary: item.request }],
      })

      expect(packet.status).toBe('blocked')
      expect(packet.blocked_reason).toBe(item.blocker)
      expect(packet.policy.route_decision).toBe('blocked')
      expect(packet.browser_actions[0]).toMatchObject({
        status: 'blocked',
        blocked_reason: item.blocker,
        exact_blocker: item.blocker,
        uses_owner_credentials: false,
        owner_credentials_approved: false,
        paywall_bypass_allowed: false,
        private_account_scrape_allowed: false,
        copyrighted_video_download_allowed: false,
      })
    }
  })



  it('creates a YouTubeResearchPacket with metadata, transcript claims, chapters, and Gateway return route', () => {
    const packet = createYouTubeResearchPacket({
      request: 'Inspect this YouTube video using official metadata and transcript first: https://www.youtube.com/watch?v=abc123',
      requestedBy: 'agent_zero',
      generatedAt: '2026-05-06T16:00:00.000Z',
      videoUrl: 'https://www.youtube.com/watch?v=abc123',
      title: 'Gateway Demo',
      channel: 'Knowledge vs AI',
      publishDate: '2026-05-01',
      description: 'A public demo video about Gateway routing.',
      transcriptSegments: [
        { segment_id: 'intro', start_seconds: 0, end_seconds: 8, text: 'Gateway routes research to Space Agent and returns evidence to Agent Zero.' },
        { segment_id: 'policy', start_seconds: 9, end_seconds: 18, text: 'Browser and video work stays read only unless Gateway policy approves more.' },
      ],
      chapters: [{ title: 'Gateway overview', start_seconds: 0, end_seconds: 60 }],
      frameCaptureAllowed: true,
      frameCaptures: [{ timestamp_seconds: 12, reference: 'gateway-managed-frame-12' }],
    })

    expect(packet).toMatchObject({
      schema: 'youtube_research_packet_v1',
      mode: 'youtube_research_packet',
      status: 'ready',
      research_stage_owner: 'space_agent',
      returns_to: 'agent_zero',
      official_paths_first: true,
      allowed_paths: ['official', 'transcript', 'metadata'],
      full_video_download_allowed: false,
      full_video_download_blocked_by_default: true,
      transcript_status: 'available',
      captions_available: true,
      metadata: {
        title: 'Gateway Demo',
        channel: 'Knowledge vs AI',
        publish_date: '2026-05-01',
        url: 'https://www.youtube.com/watch?v=abc123',
        description: 'A public demo video about Gateway routing.',
        metadata_status: 'available',
      },
    })
    expect(packet.youtube_research_intent).toMatchObject({
      schema: 'youtube_research_intent_v1',
      official_paths_first: true,
      source_priority: ['official', 'transcript', 'metadata'],
      full_video_download_allowed: false,
      video_id: 'abc123',
    })
    expect(packet.transcript_segments).toHaveLength(2)
    expect(packet.chapters[0]).toMatchObject({ schema: 'youtube_chapter_v1', title: 'Gateway overview' })
    expect(packet.key_claims.map((claim) => claim.claim)).toEqual(expect.arrayContaining(['Gateway routes research to Space Agent and returns evidence to Agent Zero.']))
    expect(packet.frame_captures[0]).toMatchObject({ status: 'allowed', reference: 'gateway-managed-frame-12', no_raw_paths: true })
    expect(packet.route.hops).toEqual(['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'])
    expect(packet.return_route.hops).toEqual(['space_agent', 'gateway', 'agent_zero'])
    expect(packet.no_secrets_exposed).toBe(true)
    expect(packet.no_raw_paths).toBe(true)
  })

  it('returns limited YouTube packet when transcript is unavailable and blocks full video download by default', () => {
    const limited = createYouTubeResearchPacket({
      request: 'Inspect this YouTube video metadata: https://youtu.be/xyz789',
      generatedAt: '2026-05-06T17:00:00.000Z',
      videoUrl: 'https://youtu.be/xyz789',
      title: 'No Transcript Demo',
      channel: 'Knowledge vs AI',
    })

    expect(limited.status).toBe('limited')
    expect(limited.transcript_status).toBe('missing')
    expect(limited.blocked_reason).toBe('youtube_transcript_unavailable')
    expect(limited.limitations).toContain('Transcript or captions unavailable; key claims are limited to supplied metadata and cannot be treated as transcript-backed.')
    expect(limited.key_claims).toEqual([])

    const blocked = createYouTubeResearchPacket({
      request: 'Download a copyrighted YouTube video from https://youtu.be/xyz789',
      generatedAt: '2026-05-06T17:30:00.000Z',
      videoUrl: 'https://youtu.be/xyz789',
      transcriptSegments: [{ text: 'This transcript exists but download is still not allowed.' }],
      frameCaptures: [{ timestamp_seconds: 30, reference: 'should-not-leak-local-frame' }],
    })

    expect(blocked.status).toBe('blocked')
    expect(blocked.full_video_download_allowed).toBe(false)
    expect(blocked.blocked_reason).toBe('copyrighted_video_download_blocked_by_default')
    expect(blocked.frame_captures[0]).toMatchObject({
      status: 'blocked',
      reference: null,
      blocked_reason: 'youtube_frame_capture_tooling_not_approved',
      no_raw_paths: true,
    })
  })

  it('hands unclear or non-research requests back as research not needed', () => {
    const packet = createSpaceAgentResearchPacket({
      request: 'Good morning. Who are you?',
      requestedBy: 'owner',
    })

    expect(packet.research_operation).toBe('research_not_needed')
    expect(packet.research_needed).toBe(false)
    expect(packet.web_research_intent.requires_live_web).toBe(false)
    expect(packet.owner_visible_summary).toContain('research not needed')
    expect(packet.return_route.hops).toEqual(['space_agent', 'gateway', 'agent_zero'])
    expect(packet.tool_execution_enabled).toBe(false)
    expect(packet.external_writes_enabled).toBe(false)
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
