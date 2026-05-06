import { describe, expect, it } from 'vitest'

import { buildSpaceAgentDocumentationPage } from './space-agent-docs'

describe('Space Agent Gateway documentation page', () => {
  it('documents phases 171-180 with owner-safe boundaries and rollback steps', () => {
    const page = buildSpaceAgentDocumentationPage('2026-05-06T12:00:00.000Z')
    const sectionIds = page.sections.map((section) => section.id)
    const serialized = JSON.stringify(page)

    expect(page).toMatchObject({
      page_id: 'space_agent_gateway_documentation',
      title: 'Space Agent Gateway Documentation',
      agent_id: 'space_agent',
      commander: 'agent_zero',
      lieutenant: 'hermes',
      dispatcher_candidate: 'pi',
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
      no_raw_paths: true,
    })
    expect(sectionIds).toEqual([
      'role_boundaries',
      'firecrawl_capabilities',
      'youtube_capabilities',
      'browser_policy',
      'handoff_format',
      'mini_agent_templates',
      'memory_ttl',
      'blocked_cases',
      'rollback_disable',
    ])
    expect(serialized).toContain('ResearchPacket includes job ID')
    expect(serialized).toContain('Default task TTL is 24 hours.')
    expect(serialized).toContain('Revert the Space Agent Gateway commits')
    expect(serialized).toContain('No owner credentials, paywall bypass, private account scraping, or copyrighted video download by default.')
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|auth\.json|\/home\/tony|\/a0\/usr\/plugins/)
  })
})
