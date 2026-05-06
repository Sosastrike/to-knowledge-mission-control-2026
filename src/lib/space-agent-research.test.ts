import { describe, expect, it } from 'vitest'

import { classifySpaceAgentResearch, classifySpaceAgentResearchOperation, createSpaceAgentJob, createSpaceAgentPolicy, createSpaceAgentResearchHandoff, createSpaceResearchMemory, createSpaceAgentResearchPacket, createSpaceResearchMiniAgentFanout, evaluateSpaceResearchMiniAgentScope, expireSpaceResearchMemory, requestSpaceResearchMemoryBrainPromotion, reviewSpaceResearchMemoryBrainPromotion, createWebResearchIntent, createYouTubeResearchPacket } from './space-agent-research'

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
      space_agent_job: {
        job_id: job.job_id,
        parent_gateway_flow: 'flow_agent_zero_gateway_space_agent_research',
        supervisor: 'agent_zero',
        task_type: 'scrape',
        scope: {
          allowed_domains: [],
          allowed_urls: [],
          forbidden_domains: [],
          requires_login: false,
        },
        tools_allowed: ['firecrawl_search', 'browser_readonly', 'youtube_transcript', 'firecrawl_scrape'],
        tools_forbidden: ['email_send', 'drive_upload', 'zapier_write', 'heygen_generation', 'smb_mount', 'raw_shell', 'docker_socket'],
        memory: {
          ttl: '24h',
          promote_to_brain: false,
        },
        output: 'research_packet',
      },
      gateway_route_decision: {
        owner_request: 'Inspect a public article and collect evidence',
        classified_as: 'page_read',
        requires_space_agent: true,
        reason: 'browser_or_page_interaction_requires_space_agent_research_specialist',
        pi_recommendation: 'space_agent',
        agent_zero_decision: 'approve_space_agent_research',
        hermes_needed: false,
        bridge_session_required: false,
        selected_worker: 'space_agent',
        blocked_reason: null,
      },
    })
  })

  it('creates the canonical space_agent_job envelope with scoped tools and memory', () => {
    const job = createSpaceAgentJob({
      request: 'Use Firecrawl to crawl https://example.com/docs and return a research packet.',
      requestedBy: 'hermes',
      responsibleAgent: 'agent_zero',
      generatedAt: '2026-05-06T22:30:00.000Z',
      firecrawlConfigured: true,
      webSources: [
        { url: 'https://example.com/docs', title: 'Docs', access: 'public' },
        { url: 'https://research.example.org/page', title: 'Research page', access: 'public' },
      ],
    })

    expect(job.space_agent_job).toEqual({
      job_id: job.job_id,
      parent_gateway_flow: 'flow_agent_zero_gateway_space_agent_research',
      supervisor: 'hermes',
      task_type: 'crawl',
      scope: {
        allowed_domains: ['example.com', 'research.example.org'],
        allowed_urls: ['https://example.com/docs', 'https://research.example.org/page'],
        forbidden_domains: [],
        requires_login: false,
      },
      tools_allowed: ['firecrawl_search', 'browser_readonly', 'youtube_transcript', 'firecrawl_crawl'],
      tools_forbidden: ['email_send', 'drive_upload', 'zapier_write', 'heygen_generation', 'smb_mount', 'raw_shell', 'docker_socket'],
      memory: {
        ttl: '24h',
        promote_to_brain: false,
      },
      output: 'research_packet',
    })
    expect(JSON.stringify(job.space_agent_job)).not.toMatch(/API_KEY|Bearer\s+|auth\.json|\/home\//i)
  })

  it('creates the Gateway route decision envelope for Space Agent selection and handback', () => {
    const researchJob = createSpaceAgentJob({
      request: 'Use Firecrawl to scrape https://example.com/research and let Hermes design a workflow.',
      requestedBy: 'agent_zero',
      responsibleAgent: 'hermes',
      generatedAt: '2026-05-06T22:45:00.000Z',
      firecrawlConfigured: true,
    })
    const chatJob = createSpaceAgentJob({
      request: 'Good morning. Who are you?',
      requestedBy: 'owner',
      generatedAt: '2026-05-06T22:46:00.000Z',
      firecrawlConfigured: true,
    })

    expect(researchJob.gateway_route_decision).toEqual({
      owner_request: 'Use Firecrawl to scrape https://example.com/research and let Hermes design a workflow.',
      classified_as: 'firecrawl_scrape',
      requires_space_agent: true,
      reason: 'firecrawl_research_requires_space_agent_research_specialist',
      pi_recommendation: 'space_agent',
      agent_zero_decision: 'approve_space_agent_research',
      hermes_needed: true,
      bridge_session_required: false,
      selected_worker: 'space_agent',
      blocked_reason: null,
    })
    expect(chatJob.gateway_route_decision).toEqual({
      owner_request: 'Good morning. Who are you?',
      classified_as: 'research_not_needed',
      requires_space_agent: false,
      reason: 'request_does_not_require_live_web_browser_youtube_or_firecrawl_research',
      pi_recommendation: 'handoff_without_research',
      agent_zero_decision: 'handoff_without_research',
      hermes_needed: false,
      bridge_session_required: false,
      selected_worker: null,
      blocked_reason: null,
    })
    expect(JSON.stringify(researchJob.gateway_route_decision)).not.toMatch(/API_KEY|Bearer\s+|auth\.json|\/home\//i)
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
      gateway_route_decision: {
        requires_space_agent: true,
        selected_worker: 'space_agent',
        agent_zero_decision: 'approve_space_agent_research',
      },
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

  it('includes the canonical owner-safe research_packet envelope', () => {
    const packet = createSpaceAgentResearchPacket({
      request: 'Use Firecrawl to scrape a public article and send the research to Hermes',
      requestedBy: 'owner',
      responsibleAgent: 'hermes',
      generatedAt: '2026-05-06T22:00:00.000Z',
      firecrawlConfigured: true,
      evidence: [{
        evidence_id: 'canonical-ev-1',
        source_id: 'canonical-web-1',
        summary: 'Gateway routes public research to Space Agent and returns findings to Hermes.',
        quote: 'research to Space Agent',
        source_type: 'web',
        url: 'https://example.com/canonical',
        confidence: 'high',
      }],
      webSources: [{
        source_id: 'canonical-web-1',
        url: 'https://example.com/canonical',
        title: 'Canonical Gateway Research',
        access: 'public',
        status: 'checked',
      }],
    })

    expect(packet.research_packet).toMatchObject({
      packet_id: `canonical_${packet.job_id}`,
      requested_by: 'owner',
      assigned_by: 'agent_zero',
      route: {
        gateway_flow_id: 'flow_agent_zero_gateway_space_agent_research',
        dispatcher: 'pi',
        commander: 'agent_zero',
        research_agent: 'space_agent',
        return_to: 'hermes',
      },
      request: {
        raw_owner_request: 'Use Firecrawl to scrape a public article and send the research to Hermes',
        normalized_intent: 'firecrawl_scrape',
        source_type: 'firecrawl',
      },
      sources: [{
        url: 'https://example.com/canonical',
        title: 'Canonical Gateway Research',
        type: 'firecrawl',
        retrieved_at: '2026-05-06T22:00:00.000Z',
        method: 'firecrawl_scrape',
        status: 'success',
      }],
      findings: {
        summary: 'Gateway routes public research to Space Agent and returns findings to Hermes.',
        key_points: ['Gateway routes public research to Space Agent and returns findings to Hermes.'],
        evidence: [expect.objectContaining({
          evidence_id: 'canonical_ev_1',
          snippet: 'research to Space Agent',
          url: 'https://example.com/canonical',
          confidence: 'high',
        })],
        contradictions: [],
        confidence: 'high',
      },
      blockers: [],
      recommended_next_agent: 'hermes',
      no_external_write: true,
    })
    expect(packet.research_packet.handoff_summary).toContain('Space Agent')
    expect(JSON.stringify(packet.research_packet)).not.toMatch(/API_KEY|Bearer\s+|auth\.json|\/home\//i)
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

  it('creates the Gateway handoff lifecycle from Space Agent research to Agent Zero and Hermes', () => {
    const handoff = createSpaceAgentResearchHandoff({
      request: 'Research a public article so Hermes can design a workflow',
      requestedBy: 'agent_zero',
      responsibleAgent: 'hermes',
      generatedAt: '2026-05-06T19:00:00.000Z',
      evidence: [
        {
          evidence_id: 'workflow-source',
          source_id: 'public-article',
          summary: 'The article describes a repeatable research workflow.',
          quote: 'A repeatable research workflow',
          source_type: 'web',
          url: 'https://example.com/workflow',
          confidence: 'high',
        },
      ],
      webSources: [{ source_id: 'public-article', url: 'https://example.com/workflow', title: 'Workflow article', status: 'checked', access: 'public' }],
    })

    expect(handoff).toMatchObject({
      schema: 'space_agent_research_handoff_v1',
      mode: 'gateway_space_agent_research_handoff',
      status: 'handoff_ready',
      job_id: handoff.packet.job_id,
      packet_id: handoff.packet.packet_id,
      original_request: 'Research a public article so Hermes can design a workflow',
      research_task_received: true,
      research_performed: true,
      research_packet_returned: true,
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(handoff.stages).toEqual([
      'research_task_received',
      'research_performed',
      'research_packet_returned',
      'gateway_validated_research_packet',
      'pi_reviewed_route_quality',
      'hermes_prepared_workflow_option',
      'agent_zero_decided_next_action',
      'responsible_agent_received_handoff',
      'space_agent_exited_task',
      'gateway_recorded_handoff_audit',
    ])
    expect(handoff.gateway_validation).toMatchObject({
      schema: 'gateway_research_packet_validation_v1',
      validator: 'gateway',
      valid: true,
      decision: 'accepted',
      source_count: 2,
      evidence_count: 1,
      citations_count: 1,
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(handoff.pi_quality_review).toMatchObject({
      schema: 'pi_research_quality_review_v1',
      reviewer: 'pi',
      shadow_mode: true,
      route_quality: 'pass',
      recommendation: 'handoff_to_responsible_agent',
      recommended_next_agent: 'hermes',
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(handoff.hermes_workflow_draft).toMatchObject({
      schema: 'hermes_research_workflow_draft_v1',
      reviewer: 'hermes',
      mode: 'workflow_design_only',
      available: true,
      activation_requires: 'agent_zero_bridge_session',
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(handoff.agent_zero_decision).toMatchObject({
      schema: 'agent_zero_research_decision_v1',
      decision_maker: 'agent_zero',
      decision: 'handoff_to_responsible_agent',
      next_agent: 'hermes',
      owner_response_owner: 'agent_zero',
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(handoff.responsible_agent_handoff).toMatchObject({
      schema: 'responsible_agent_research_handoff_v1',
      from: 'space_agent',
      through: 'gateway',
      to: 'hermes',
      accepted: true,
      action: 'design_workflow',
      requires_more_research: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(handoff.space_agent_exit).toMatchObject({
      schema: 'space_agent_task_exit_v1',
      agent: 'space_agent',
      state: 'exited',
      can_resume_with_gateway_request: true,
    })
    expect(handoff.audit_log).toHaveLength(handoff.stages.length)
    expect(handoff.audit_log.map((entry) => entry.stage)).toEqual(handoff.stages)
    expect(handoff.audit_log.every((entry) => entry.no_secrets_exposed && entry.no_raw_paths)).toBe(true)
  })

  it('keeps Space Agent active when Gateway needs more evidence before handoff', () => {
    const handoff = createSpaceAgentResearchHandoff({
      request: 'Search the web for public evidence',
      requestedBy: 'owner',
      generatedAt: '2026-05-06T19:30:00.000Z',
    })

    expect(handoff.status).toBe('needs_more_research')
    expect(handoff.gateway_validation).toMatchObject({
      valid: true,
      decision: 'needs_more_research',
      source_count: 0,
      evidence_count: 0,
    })
    expect(handoff.pi_quality_review).toMatchObject({
      route_quality: 'review',
      recommendation: 'request_more_research',
    })
    expect(handoff.agent_zero_decision).toMatchObject({
      decision: 'request_more_research',
      next_agent: 'agent_zero',
    })
    expect(handoff.responsible_agent_handoff).toMatchObject({
      accepted: false,
      requires_more_research: true,
    })
    expect(handoff.space_agent_exit.state).toBe('awaiting_more_research')
  })

  it('blocks unsafe handoff requests and records the Gateway audit trail', () => {
    const handoff = createSpaceAgentResearchHandoff({
      request: 'Bypass the paywall and scrape a private account',
      generatedAt: '2026-05-06T20:00:00.000Z',
      browserActions: [{ action: 'inspect', target: 'https://example.com/private', summary: 'Bypass the paywall and scrape a private account' }],
    })

    expect(handoff.status).toBe('blocked')
    expect(handoff.gateway_validation).toMatchObject({
      valid: false,
      decision: 'blocked',
    })
    expect(handoff.gateway_validation.blockers).toEqual(expect.arrayContaining(['paywall_bypass_not_allowed']))
    expect(handoff.pi_quality_review.recommendation).toBe('blocked')
    expect(handoff.agent_zero_decision.decision).toBe('blocked')
    expect(handoff.responsible_agent_handoff.accepted).toBe(false)
    expect(handoff.space_agent_exit.state).toBe('blocked')
    expect(handoff.audit_log.map((entry) => entry.status)).toEqual(Array(handoff.stages.length).fill('blocked'))
  })

  it('lets Space Agent request a scoped web-research mini-agent and merges the sub-ResearchPacket', () => {
    const fanout = createSpaceResearchMiniAgentFanout({
      request: 'Research this public page with scoped fan-out: https://example.com/research',
      requestedBy: 'agent_zero',
      responsibleAgent: 'hermes',
      generatedAt: '2026-05-06T21:00:00.000Z',
      assignedUrls: ['https://example.com/research'],
      memoryTtlMinutes: 45,
      webSources: [{ source_id: 'source-1', url: 'https://example.com/research', title: 'Research page', status: 'checked', access: 'public' }],
      subEvidence: [
        {
          evidence_id: 'sub-1',
          source_id: 'source-1',
          source_type: 'web',
          summary: 'The scoped source says Space Agent can use a subordinate research mini-agent.',
          quote: 'subordinate research mini-agent',
          url: 'https://example.com/research',
          confidence: 'high',
        },
      ],
    })

    expect(fanout).toMatchObject({
      schema: 'space_research_mini_agent_fanout_v1',
      mode: 'space_agent_requested_web_research_mini_agent',
      mini_agent_expires_after_task: true,
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(fanout.template).toMatchObject({
      schema: 'space_research_mini_agent_template_v1',
      created_by: 'hermes',
      parent_supervisor: 'agent_zero',
      requested_by: 'space_agent',
      output_contract: 'sub_research_packet',
      bridge_session_required_for_execution: true,
      execution_enabled: false,
    })
    expect(fanout.agent_zero_approval).toMatchObject({
      approver: 'agent_zero',
      approved_for_creation: true,
      activation_enabled: false,
    })
    expect(fanout.pi_recommendation).toMatchObject({
      reviewer: 'pi',
      shadow_mode: true,
      recommended: true,
      recommended_mini_agent_type: 'research',
      fanout_count: 1,
      execution_enabled: false,
    })
    expect(fanout.assigned_scope).toMatchObject({
      allowed_urls: ['https://example.com/research'],
      memory_ttl_minutes: 45,
      browse_outside_scope_allowed: false,
      blocked_reason: null,
    })
    expect(fanout.scope_decision).toMatchObject({ requested_url: 'https://example.com/research', allowed: true, blocked_reason: null })
    expect(fanout.mini_agent_definition).toMatchObject({
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
    expect(fanout.mini_agent_definition?.forbidden_tools).toEqual(expect.arrayContaining(['browse_outside_assigned_scope', 'direct_secret_read', 'docker_socket']))
    expect(fanout.mini_agent_memory).toMatchObject({
      ttl_minutes: 45,
      state: 'temporary',
      parent_supervisor: 'agent_zero',
      contains_secrets: false,
    })
    expect(fanout.sub_research_packet).toMatchObject({
      schema: 'research_packet_v1',
      research_stage_owner: 'space_agent',
      recommended_next_agent: 'hermes',
    })
    expect(fanout.sub_research_packet?.findings).toEqual(['The scoped source says Space Agent can use a subordinate research mini-agent.'])
    expect(fanout.gateway_merge).toMatchObject({
      schema: 'gateway_sub_research_merge_v1',
      status: 'merged',
      findings: ['The scoped source says Space Agent can use a subordinate research mini-agent.'],
      citations: ['https://example.com/research'],
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
  })

  it('blocks mini-agent browsing outside assigned URL scope', () => {
    const fanout = createSpaceResearchMiniAgentFanout({
      request: 'Search the web and read only this assigned page: https://example.com/allowed',
      generatedAt: '2026-05-06T21:15:00.000Z',
      assignedUrls: ['https://example.com/allowed'],
      outOfScopeUrlToCheck: 'https://example.org/not-allowed',
      subEvidence: [{ summary: 'This should not be used because scope check blocks the URL.', url: 'https://example.org/not-allowed' }],
    })

    expect(fanout.agent_zero_approval.approved_for_creation).toBe(true)
    expect(fanout.scope_decision).toMatchObject({
      requested_url: 'https://example.org/not-allowed',
      allowed: false,
      blocked_reason: 'mini_agent_browse_outside_assigned_scope_blocked',
    })
    expect(evaluateSpaceResearchMiniAgentScope(fanout.assigned_scope, 'https://example.com/allowed').allowed).toBe(true)
    expect(fanout.sub_research_packet).toBeNull()
    expect(fanout.gateway_merge.status).toBe('needs_more_research')
  })

  it('blocks Space Agent mini-agent fan-out when no limited source scope exists', () => {
    const fanout = createSpaceResearchMiniAgentFanout({
      request: 'Research this topic later',
      generatedAt: '2026-05-06T21:30:00.000Z',
    })

    expect(fanout.assigned_scope.blocked_reason).toBe('mini_agent_source_scope_required')
    expect(fanout.pi_recommendation).toMatchObject({
      recommended: false,
      fanout_count: 0,
      blocked_reason: 'mini_agent_source_scope_required',
    })
    expect(fanout.agent_zero_approval).toMatchObject({
      approved_for_creation: false,
      activation_enabled: false,
      blocked_reason: 'mini_agent_source_scope_required',
    })
    expect(fanout.mini_agent_definition_result).toMatchObject({
      ok: false,
      policy_result: 'blocked',
      blocked_reason: 'mini_agent_scope_required',
    })
    expect(fanout.mini_agent_memory_result).toMatchObject({
      ok: false,
      policy_result: 'blocked',
      blocked_reason: 'mini_agent_definition_missing',
    })
    expect(fanout.sub_research_packet).toBeNull()
    expect(fanout.expired_mini_agent).toBeNull()
    expect(fanout.expired_memory).toBeNull()
  })

  it('creates SpaceResearchMemory with default 24-hour TTL and separated facts and assumptions', () => {
    const result = createSpaceResearchMemory({
      source_url: 'https://example.com/research',
      source_id: 'source-1',
      evidence_summary: 'The source describes Gateway-routed Space Agent research.',
      facts: ['Space Agent returns ResearchPacket evidence.'],
      assumptions: ['The page remains publicly reachable.'],
      created_at: '2026-05-06T22:00:00.000Z',
    })

    expect(result).toMatchObject({
      ok: true,
      mode: 'space_research_memory_dry_run',
      policy_result: 'allowed',
      execution_enabled: false,
      writes_enabled: false,
      secrets_exposed: false,
    })
    expect(result.memory).toMatchObject({
      schema: 'space_research_memory_v1',
      state: 'temporary',
      source_url: 'https://example.com/research',
      evidence_summary: 'The source describes Gateway-routed Space Agent research.',
      facts: ['Space Agent returns ResearchPacket evidence.'],
      assumptions: ['The page remains publicly reachable.'],
      ttl_minutes: 1440,
      ttl_mode: 'default_task',
      expires_at: '2026-05-07T22:00:00.000Z',
      contains_secrets: false,
      raw_cookies_session_tokens_stored: false,
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(result.memory?.promotion_to_brain).toMatchObject({
      requested: false,
      reviewed: false,
      approved: false,
      promoted_to: null,
      blocked_reason: 'brain_promotion_requires_agent_zero_or_owner_review',
    })
  })

  it('uses short 30-minute TTL for short research tasks and expires automatically', () => {
    const result = createSpaceResearchMemory({
      source_url: 'https://example.com/short',
      evidence_summary: 'Short-lived page check result.',
      ttl_mode: 'short_task',
      created_at: '2026-05-06T22:30:00.000Z',
    })

    expect(result.memory).toMatchObject({
      ttl_minutes: 30,
      ttl_mode: 'short_task',
      expires_at: '2026-05-06T23:00:00.000Z',
    })

    const expired = expireSpaceResearchMemory(result.memory!, '2026-05-06T23:01:00.000Z')
    expect(expired.state).toBe('expired')
    expect(expired.audit_trail.map((event) => event.event)).toEqual(expect.arrayContaining(['space_research.memory.expired']))
  })

  it('requires owner approval for project research TTL extension', () => {
    const pending = createSpaceResearchMemory({
      source_url: 'https://example.com/project',
      evidence_summary: 'Project research source summary.',
      ttl_mode: 'project_research',
      ttl_minutes: 10080,
      created_at: '2026-05-06T23:00:00.000Z',
    })
    const approved = createSpaceResearchMemory({
      source_url: 'https://example.com/project',
      evidence_summary: 'Project research source summary.',
      ttl_mode: 'project_research',
      ttl_minutes: 10080,
      project_extension_owner_approved: true,
      created_at: '2026-05-06T23:00:00.000Z',
    })

    expect(pending).toMatchObject({
      ok: true,
      policy_result: 'requires_review',
      blocked_reason: 'project_research_ttl_extension_requires_owner_approval',
    })
    expect(pending.memory).toMatchObject({
      ttl_minutes: 1440,
      project_extension_requested: true,
      project_extension_owner_approved: false,
      blockers: ['project_research_ttl_extension_requires_owner_approval'],
    })
    expect(approved).toMatchObject({ ok: true, policy_result: 'allowed', blocked_reason: null })
    expect(approved.memory).toMatchObject({
      ttl_minutes: 10080,
      project_extension_requested: true,
      project_extension_owner_approved: true,
      expires_at: '2026-05-13T23:00:00.000Z',
    })
  })

  it('blocks secrets, raw cookies, and session tokens from SpaceResearchMemory', () => {
    const secret = createSpaceResearchMemory({
      source_url: 'https://example.com',
      evidence_summary: 'Do not store SECRET=value-not-real',
    })
    const cookie = createSpaceResearchMemory({
      source_url: 'https://example.com',
      evidence_summary: 'Raw cookie=sessionid123 should not be stored.',
    })
    const session = createSpaceResearchMemory({
      source_url: 'https://example.com',
      evidence_summary: 'Raw session_token=abcdef123456 should not be stored.',
    })

    expect(secret).toMatchObject({ ok: false, policy_result: 'blocked', blocked_reason: 'space_research_memory_secret_storage_forbidden' })
    expect(cookie).toMatchObject({ ok: false, policy_result: 'blocked', blocked_reason: 'space_research_memory_raw_cookie_or_session_token_forbidden' })
    expect(session).toMatchObject({ ok: false, policy_result: 'blocked', blocked_reason: 'space_research_memory_raw_cookie_or_session_token_forbidden' })
  })

  it('promotes useful SpaceResearchMemory to Brain only after Agent Zero or owner review', () => {
    const created = createSpaceResearchMemory({
      source_url: 'https://example.com/brain',
      evidence_summary: 'Research useful enough for Brain review.',
      facts: ['Gateway promotion requires review.'],
      created_at: '2026-05-07T00:00:00.000Z',
    })
    const requested = requestSpaceResearchMemoryBrainPromotion(created.memory!, 'hermes')
    const approved = reviewSpaceResearchMemoryBrainPromotion(requested.memory!, {
      approved: true,
      reviewer: 'agent_zero',
      reason: 'Useful verified research summary.',
      reviewed_at: '2026-05-07T00:10:00.000Z',
    })

    expect(requested).toMatchObject({
      ok: true,
      policy_result: 'requires_review',
      blocked_reason: null,
    })
    expect(requested.memory).toMatchObject({
      state: 'pending_brain_review',
      promotion_to_brain: {
        requested: true,
        reviewed: false,
        approved: false,
        promoted_to: null,
        blocked_reason: 'brain_promotion_pending_agent_zero_or_owner_review',
      },
    })
    expect(approved).toMatchObject({ ok: true, policy_result: 'allowed', blocked_reason: null })
    expect(approved.memory).toMatchObject({
      state: 'promoted_to_brain',
      promotion_to_brain: {
        requested: true,
        reviewed: true,
        approved: true,
        reviewer: 'agent_zero',
        promoted_to: 'brain_review_queue',
        blocked_reason: null,
      },
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
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
