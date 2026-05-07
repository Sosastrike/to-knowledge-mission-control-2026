export type SpaceAgentDocumentationSectionId =
  | 'role_boundaries'
  | 'firecrawl_capabilities'
  | 'youtube_capabilities'
  | 'browser_policy'
  | 'handoff_format'
  | 'mini_agent_templates'
  | 'memory_ttl'
  | 'blocked_cases'
  | 'rollback_disable'

export type SpaceAgentDocumentationSection = {
  id: SpaceAgentDocumentationSectionId
  title: string
  summary: string
  bullets: string[]
}

export type SpaceAgentDocumentationPage = {
  page_id: 'space_agent_gateway_documentation'
  title: 'Space Agent Gateway Documentation'
  subtitle: string
  last_verified_at: string
  owner_visible: true
  agent_id: 'space_agent'
  commander: 'agent_zero'
  lieutenant: 'hermes'
  dispatcher_candidate: 'pi'
  execution_enabled: false
  writes_enabled: false
  sections: SpaceAgentDocumentationSection[]
  no_secrets_exposed: true
  no_raw_paths: true
}

export function buildSpaceAgentDocumentationPage(generatedAt = '2026-05-06T00:00:00.000Z'): SpaceAgentDocumentationPage {
  return {
    page_id: 'space_agent_gateway_documentation',
    title: 'Space Agent Gateway Documentation',
    subtitle: 'Browser, web, YouTube, and Firecrawl research specialist under Gateway supervision.',
    last_verified_at: generatedAt,
    owner_visible: true,
    agent_id: 'space_agent',
    commander: 'agent_zero',
    lieutenant: 'hermes',
    dispatcher_candidate: 'pi',
    execution_enabled: false,
    writes_enabled: false,
    sections: [
      {
        id: 'role_boundaries',
        title: 'Role And Boundaries',
        summary: 'Space Agent is a research specialist, not commander and not an execution owner.',
        bullets: [
          'Routes through Gateway, Pi recommendation, and Agent Zero command authority.',
          'Returns evidence to the responsible agent instead of owning the final task.',
          'Does not replace Agent Zero, Hermes, Pi, OpenClaw+, Bridge/MCP, or Brain systems.',
        ],
      },
      {
        id: 'firecrawl_capabilities',
        title: 'Firecrawl Capabilities',
        summary: 'Firecrawl is represented as a research capability with credential-aware blocked states.',
        bullets: [
          'Supports search, scrape, crawl, map, extract, and browser-interaction capability records.',
          'Reports missing credential or adapter blockers without faking access.',
          'Does not perform external writes or broad connector execution.',
        ],
      },
      {
        id: 'youtube_capabilities',
        title: 'YouTube Capabilities',
        summary: 'YouTube research prefers official metadata, transcripts, captions, chapters, and cited claims.',
        bullets: [
          'Returns a YouTubeResearchPacket with metadata, transcript status, key claims, limitations, and citations.',
          'Does not download full videos by default.',
          'Reports transcript or frame-capture limitations as blocked or limited states.',
        ],
      },
      {
        id: 'browser_policy',
        title: 'Browser Policy',
        summary: 'Browser work is research-only unless an approved Gateway policy allows more.',
        bullets: [
          'No owner credentials, paywall bypass, private account scraping, or copyrighted video download by default.',
          'Allowed outputs are page text, screenshot references, metadata, evidence snippets, and citations.',
          'Every browser action records URL, timestamp, action type, and blocker when applicable.',
        ],
      },
      {
        id: 'handoff_format',
        title: 'Handoff Format',
        summary: 'Research returns as a Gateway-validated ResearchPacket and lifecycle handoff.',
        bullets: [
          'ResearchPacket includes job ID, original request, supervisor, sources, findings, confidence, evidence snippets, citations, blockers, and recommended next agent.',
          'Gateway validates the packet before Pi review, Hermes workflow drafting, Agent Zero decision, and downstream handoff.',
          'Space Agent exits after handoff unless Gateway requests more research.',
        ],
      },
      {
        id: 'mini_agent_templates',
        title: 'Mini-Agent Templates',
        summary: 'Space Agent can request scoped web-research mini-agents under Agent Zero authority.',
        bullets: [
          'Hermes provides the Space Research mini-agent template.',
          'Pi recommends fan-out in shadow mode only.',
          'Mini-agents receive limited URL/source scope and return sub-ResearchPackets only.',
        ],
      },
      {
        id: 'memory_ttl',
        title: 'Memory TTL',
        summary: 'Space Research memory is temporary and promotion to Brain requires review.',
        bullets: [
          'Default task TTL is 24 hours.',
          'Short task TTL is 30 minutes.',
          'Project research TTL extension requires owner approval and Brain promotion requires Agent Zero or owner review.',
        ],
      },
      {
        id: 'blocked_cases',
        title: 'Blocked Cases',
        summary: 'Gateway blocks unsafe or out-of-scope Space Agent research.',
        bullets: [
          'No secrets, raw cookies, session tokens, raw local paths, or auth files in memory or owner output.',
          'No browsing outside assigned mini-agent URL/source scope.',
          'No Zapier writes, HeyGen generation, SMB mount, farmer execution, raw root shell, Docker socket, or direct secret reads.',
        ],
      },
      {
        id: 'rollback_disable',
        title: 'Rollback / Disable',
        summary: 'Disable Space Agent routes without deleting retained ecosystem systems.',
        bullets: [
          'Revert the Space Agent Gateway commits to disable the contract changes.',
          'Disable Space Agent Gateway research routes while retaining external checkout, agents, OpenClaw+, Brain, and Bridge/MCP data.',
          'Do not delete existing agents or create a second Agent Zero during rollback.',
        ],
      },
    ],
    no_secrets_exposed: true,
    no_raw_paths: true,
  }
}
