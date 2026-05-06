import { describe, expect, it } from 'vitest'

import {
  classifySpaceAgentResearchOperation,
  createSpaceAgentResearchPacket,
} from './space-agent-research'

const generatedAt = '2026-05-06T00:00:00.000Z'

function expectReadOnlyPacket(packet: ReturnType<typeof createSpaceAgentResearchPacket>) {
  expect(packet.browser_interaction_enabled).toBe(false)
  expect(packet.external_writes_enabled).toBe(false)
  expect(packet.tool_execution_enabled).toBe(false)
  expect(packet.no_secrets_exposed).toBe(true)
  expect(packet.no_raw_paths).toBe(true)
  expect(packet.route.hops).toEqual(['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'])
  expect(packet.return_route.hops).toEqual(['space_agent', 'gateway', 'agent_zero'])
}

describe('Space Agent web scenario planning', () => {
  it('plans simple website, article, product, and pricing page reads without execution', () => {
    const cases = [
      {
        phase: 211,
        request: 'Read this website page: https://example.com/docs',
        url: 'https://example.com/docs',
        title: 'Documentation page',
      },
      {
        phase: 213,
        request: 'Extract the article from https://example.com/articles/gateway',
        url: 'https://example.com/articles/gateway',
        title: 'Gateway article',
      },
      {
        phase: 214,
        request: 'Extract the product page details from https://example.com/products/gateway',
        url: 'https://example.com/products/gateway',
        title: 'Gateway product page',
      },
      {
        phase: 215,
        request: 'Read the pricing page at https://example.com/pricing',
        url: 'https://example.com/pricing',
        title: 'Gateway pricing page',
      },
    ]

    for (const item of cases) {
      const packet = createSpaceAgentResearchPacket({
        request: item.request,
        requestedBy: 'owner',
        responsibleAgent: 'agent_zero',
        generatedAt,
        firecrawlConfigured: false,
        webSources: [{ source_id: `phase-${item.phase}`, url: item.url, title: item.title, access: 'public' }],
      })

      expect(classifySpaceAgentResearchOperation(item.request)).toBe('page_read')
      expect(packet.status).toBe('ready')
      expect(packet.research_type).toBe('page_extraction')
      expect(packet.research_operation).toBe('page_read')
      expect(packet.web_sources[0]).toMatchObject({
        url: item.url,
        title: item.title,
        status: 'candidate',
        blocked_reason: null,
      })
      expect(packet.citations).toContain(item.url)
      expectReadOnlyPacket(packet)
    }
  })

  it('plans Firecrawl scenarios for JavaScript-heavy pages, crawl, site map, and search without running them', () => {
    const cases = [
      {
        phase: 212,
        request: 'Use Firecrawl to scrape this JavaScript-heavy page: https://example.com/app',
        operation: 'firecrawl_scrape',
      },
      {
        phase: 216,
        request: 'Use Firecrawl to crawl this multi-page documentation site: https://example.com/docs',
        operation: 'firecrawl_crawl',
      },
      {
        phase: 217,
        request: 'Use Firecrawl map to build a site map for https://example.com',
        operation: 'firecrawl_map',
      },
      {
        phase: 218,
        request: 'Search the web for current Gateway research examples',
        operation: 'web_search',
      },
    ] as const

    for (const item of cases) {
      const packet = createSpaceAgentResearchPacket({
        request: item.request,
        requestedBy: 'owner',
        responsibleAgent: 'agent_zero',
        generatedAt,
        firecrawlConfigured: item.operation !== 'web_search',
      })

      expect(classifySpaceAgentResearchOperation(item.request)).toBe(item.operation)
      expect(packet.research_operation).toBe(item.operation)
      expect(packet.status).toBe('ready')
      if (item.operation.startsWith('firecrawl_')) {
        expect(packet.firecrawl_status).toBe('available_from_registry')
        expect(packet.web_research_intent.requires_firecrawl).toBe(true)
      } else {
        expect(packet.firecrawl_status).toBe('not_requested')
        expect(packet.web_research_intent.requires_live_web).toBe(true)
      }
      expect(packet.findings).toEqual([])
      expectReadOnlyPacket(packet)
    }
  })

  it('marks blocked and invalid URLs explicitly without exposing internal targets', () => {
    const blocked = createSpaceAgentResearchPacket({
      request: 'Read this blocked URL: http://127.0.0.1/admin',
      requestedBy: 'owner',
      responsibleAgent: 'agent_zero',
      generatedAt,
      webSources: [{ source_id: 'blocked-url', url: 'http://127.0.0.1/admin', title: 'Internal admin' }],
    })
    const invalid = createSpaceAgentResearchPacket({
      request: 'Read this invalid URL: not-a-url',
      requestedBy: 'owner',
      responsibleAgent: 'agent_zero',
      generatedAt,
      webSources: [{ source_id: 'invalid-url', url: 'not-a-url', title: 'Invalid URL' }],
    })

    expect(blocked.web_sources[0]).toMatchObject({
      url: null,
      access: 'blocked',
      status: 'blocked',
      blocked_reason: 'blocked_url_not_allowed',
    })
    expect(blocked.blockers).toContain('blocked_url_not_allowed')
    expect(JSON.stringify(blocked)).not.toContain('127.0.0.1')
    expectReadOnlyPacket(blocked)

    expect(invalid.web_sources[0]).toMatchObject({
      url: null,
      access: 'blocked',
      status: 'blocked',
      blocked_reason: 'invalid_url',
    })
    expect(invalid.blockers).toContain('invalid_url')
    expect(invalid.citations).not.toContain('not-a-url')
    expectReadOnlyPacket(invalid)
  })
})
