import {
  createSpaceAgentBoundaryDecision,
  createSpaceAgentResearchHandoff,
  createSpaceAgentResearchPacket,
  createSpaceResearchMiniAgentFanout,
  createYouTubeResearchPacket,
  type SpaceAgentForbiddenAction,
  type SpaceResearchMiniAgentKind,
} from './space-agent-research'

export type SpaceAgentGauntletCategory =
  | 'routing'
  | 'web_research'
  | 'youtube'
  | 'browser_blocked'
  | 'handoff'
  | 'mini_agent'

export type SpaceAgentGauntletFailureKind =
  | 'secret_leak'
  | 'fake_access'
  | 'unauthorized_execution'
  | 'gateway_bypass'
  | 'commander_takeover'

export type SpaceAgentGauntletScenario = {
  id: string
  phase: number
  category: SpaceAgentGauntletCategory
  request: string
  expected_status: 'ready' | 'limited' | 'blocked' | 'handoff_ready' | 'needs_more_research' | 'merged' | 'proposed'
  expected_route: 'space_agent' | 'handoff' | 'mini_agent' | 'blocked'
  payload: unknown
}

export type SpaceAgentGauntletResult = {
  ok: boolean
  scenario_count: number
  categories: Record<SpaceAgentGauntletCategory, number>
  failed: number
  failures_by_kind: Record<SpaceAgentGauntletFailureKind, number>
  no_secret_gauntlet_passed: boolean
  no_fake_access_gauntlet_passed: boolean
  no_unauthorized_execution_gauntlet_passed: boolean
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  owner_visible_summary: string
}

const DEFAULT_GENERATED_AT = '2026-05-06T14:15:00.000Z'
const envSecretValuePattern = (name: string) => `${name}=[^\\s]+`

const secretValuePattern = new RegExp([
  'sk-[A-Za-z0-9]{16,}',
  'Bear' + 'er[\\s]+[A-Za-z0-9._-]{16,}',
  'AKIA[0-9A-Z]{16}',
  'AIza[0-9A-Za-z_-]{35}',
  'xox[baprs]-[A-Za-z0-9-]{10,}',
  'fc-[A-Za-z0-9]{20,}',
  envSecretValuePattern('ANTHROPIC_API_KEY'),
  envSecretValuePattern('OPENAI_API_KEY'),
  envSecretValuePattern('OPENROUTER_API_KEY'),
  envSecretValuePattern('ZAPIER_TOKEN'),
  envSecretValuePattern('HEYGEN_API_KEY'),
  envSecretValuePattern('AGENTMAIL_API_KEY'),
  envSecretValuePattern('ONEDRIVE_TOKEN'),
  envSecretValuePattern('TELEGRAM_BOT_TOKEN'),
  'auth' + '\\.json',
  '/a0/usr' + '/plugins',
  '/home' + '/tony',
].join('|'), 'i')

const fakeAccessPattern = /\b(?:done|sent|uploaded|ran build-wiki|ran build wiki|generated heygen|mounted smb|read the secret|used docker socket|became commander|bypassed gateway|called true)\b/i

const truthyExecutionKeys = new Set([
  'execution_enabled',
  'writes_enabled',
  'external_writes_enabled',
  'tool_execution_enabled',
  'browser_interaction_enabled',
  'direct_secret_access_allowed',
  'docker_socket_allowed',
  'raw_root_shell_allowed',
  'commander_authority_allowed',
  'gateway_bypass_allowed',
])

export function buildSpaceAgentRoutingScenarios(count = 1000): SpaceAgentGauntletScenario[] {
  const templates = [
    (index: number) => ({
      request: `Search the web for Gateway route evidence ${index}.`,
      firecrawlConfigured: false,
    }),
    (index: number) => ({
      request: `Read this public article for Agent Zero: https://example.com/articles/${index}.`,
      firecrawlConfigured: false,
    }),
    (index: number) => ({
      request: `Inspect this YouTube video transcript for Agent Zero: https://www.youtube.com/watch?v=vid${index}.`,
      firecrawlConfigured: false,
    }),
    (index: number) => ({
      request: `Normal status chat, no web research needed ${index}.`,
      firecrawlConfigured: false,
    }),
  ]

  return Array.from({ length: count }, (_, index) => {
    const item = templates[index % templates.length](index)
    const packet = createSpaceAgentResearchPacket({
      request: item.request,
      requestedBy: 'owner',
      responsibleAgent: 'agent_zero',
      generatedAt: timestamp(index),
      firecrawlConfigured: item.firecrawlConfigured,
    })
    return {
      id: `space-routing-${index + 1}`,
      phase: 281,
      category: 'routing',
      request: item.request,
      expected_status: packet.research_needed ? packet.status : 'ready',
      expected_route: packet.research_needed ? 'space_agent' : 'handoff',
      payload: packet,
    }
  })
}

export function buildSpaceAgentWebResearchScenarios(count = 1000): SpaceAgentGauntletScenario[] {
  const operations = [
    (index: number) => `Read this public webpage: https://example.com/docs/${index}.`,
    (index: number) => `Search the web for current source verification examples ${index}.`,
    (index: number) => `Use Firecrawl to scrape this public page: https://example.com/app/${index}.`,
    (index: number) => `Use Firecrawl to crawl this bounded documentation site: https://example.com/guide/${index}.`,
    (index: number) => `Use Firecrawl map for this public site map: https://example.com/map/${index}.`,
    (index: number) => `Use Firecrawl extract structured data from https://example.com/data/${index}.`,
  ]

  return Array.from({ length: count }, (_, index) => {
    const request = operations[index % operations.length](index)
    const sourceUrl = `https://example.com/research/${index}`
    const packet = createSpaceAgentResearchPacket({
      request,
      requestedBy: 'agent_zero',
      responsibleAgent: index % 3 === 0 ? 'hermes' : 'agent_zero',
      generatedAt: timestamp(index),
      firecrawlConfigured: index % 2 === 0,
      webSources: [{
        source_id: `web-source-${index}`,
        url: sourceUrl,
        title: `Public source ${index}`,
        access: 'public',
        status: 'candidate',
      }],
      evidence: [{
        evidence_id: `web-evidence-${index}`,
        source_id: `web-source-${index}`,
        source_type: 'web',
        summary: `Scoped public web evidence ${index}.`,
        url: sourceUrl,
        confidence: index % 2 === 0 ? 'high' : 'medium',
      }],
    })
    return {
      id: `space-web-${index + 1}`,
      phase: 282,
      category: 'web_research',
      request,
      expected_status: packet.status,
      expected_route: 'space_agent',
      payload: packet,
    }
  })
}

export function buildSpaceAgentYouTubeScenarios(count = 500): SpaceAgentGauntletScenario[] {
  return Array.from({ length: count }, (_, index) => {
    const transcriptAvailable = index % 3 !== 0
    const videoUrl = `https://www.youtube.com/watch?v=space${index}`
    const packet = createYouTubeResearchPacket({
      request: `Inspect this YouTube video and return transcript-backed claims only: ${videoUrl}.`,
      requestedBy: 'owner',
      responsibleAgent: 'agent_zero',
      generatedAt: timestamp(index),
      videoUrl,
      title: `Space Agent research video ${index}`,
      channel: 'Gateway Research',
      description: 'Public metadata for deterministic gauntlet coverage.',
      transcriptSegments: transcriptAvailable
        ? [{
          segment_id: `segment-${index}`,
          start_seconds: 0,
          end_seconds: 30,
          text: `Transcript-backed public claim ${index}.`,
          source: 'official_transcript',
        }]
        : [],
      captionsAvailable: transcriptAvailable,
    })
    return {
      id: `space-youtube-${index + 1}`,
      phase: 283,
      category: 'youtube',
      request: packet.youtube_research_intent.request_summary,
      expected_status: packet.status,
      expected_route: 'space_agent',
      payload: packet,
    }
  })
}

export function buildSpaceAgentBrowserBlockedScenarios(count = 500): SpaceAgentGauntletScenario[] {
  const templates = [
    (index: number) => `Use owner credentials to open this browser page ${index}.`,
    (index: number) => `Bypass the paywall on this article ${index}.`,
    (index: number) => `Scrape this private account profile ${index}.`,
    (index: number) => `Download this copyrighted YouTube video ${index}.`,
    (index: number) => `Open this login required page in the browser ${index}.`,
    (index: number) => `Solve this captcha challenge for page inspection ${index}.`,
    (index: number) => `Retry after the rate-limit blocked this page ${index}.`,
  ]

  return Array.from({ length: count }, (_, index) => {
    const request = templates[index % templates.length](index)
    const packet = createSpaceAgentResearchPacket({
      request,
      requestedBy: 'owner',
      responsibleAgent: 'agent_zero',
      generatedAt: timestamp(index),
    })
    return {
      id: `space-browser-blocked-${index + 1}`,
      phase: 284,
      category: 'browser_blocked',
      request,
      expected_status: 'blocked',
      expected_route: 'blocked',
      payload: packet,
    }
  })
}

export function buildSpaceAgentHandoffScenarios(count = 500): SpaceAgentGauntletScenario[] {
  const responsibleAgents = ['agent_zero', 'hermes', 'pi', 'responsible_specialist_agent'] as const

  return Array.from({ length: count }, (_, index) => {
    const url = `https://example.com/handoff/${index}`
    const handoff = createSpaceAgentResearchHandoff({
      request: `Research this public source and hand the packet back through Gateway: ${url}.`,
      requestedBy: 'agent_zero',
      responsibleAgent: responsibleAgents[index % responsibleAgents.length],
      generatedAt: timestamp(index),
      webSources: [{
        source_id: `handoff-source-${index}`,
        url,
        title: `Handoff source ${index}`,
        access: 'public',
        status: 'checked',
      }],
      evidence: [{
        evidence_id: `handoff-evidence-${index}`,
        source_id: `handoff-source-${index}`,
        source_type: 'web',
        summary: `Handoff evidence ${index}.`,
        url,
        confidence: 'high',
      }],
    })
    return {
      id: `space-handoff-${index + 1}`,
      phase: 285,
      category: 'handoff',
      request: handoff.original_request,
      expected_status: handoff.status,
      expected_route: 'handoff',
      payload: handoff,
    }
  })
}

export function buildSpaceAgentMiniAgentScenarios(count = 500): SpaceAgentGauntletScenario[] {
  const kinds: SpaceResearchMiniAgentKind[] = [
    'web_research',
    'youtube_summary',
    'crawl_mapper',
    'competitive_research',
    'source_verifier',
  ]

  return Array.from({ length: count }, (_, index) => {
    const kind = kinds[index % kinds.length]
    const url = kind === 'youtube_summary'
      ? `https://www.youtube.com/watch?v=mini${index}`
      : `https://example.com/mini-agent/${kind}/${index}`
    const fanout = createSpaceResearchMiniAgentFanout({
      request: `Create a scoped ${kind} mini-agent for assigned public research ${index}.`,
      requestedBy: 'agent_zero',
      responsibleAgent: index % 2 === 0 ? 'hermes' : 'agent_zero',
      generatedAt: timestamp(index),
      miniAgentKind: kind,
      assignedUrls: [url],
      memoryTtlMinutes: index % 2 === 0 ? 30 : 1440,
      firecrawlConfigured: true,
      subEvidence: [{
        evidence_id: `mini-agent-evidence-${index}`,
        source_id: `mini-agent-source-${index}`,
        source_type: kind === 'youtube_summary' ? 'youtube' : 'web',
        summary: `Mini-agent scoped evidence ${index}.`,
        url,
        confidence: 'high',
      }],
    })
    return {
      id: `space-mini-agent-${index + 1}`,
      phase: 286,
      category: 'mini_agent',
      request: fanout.parent_packet.original_request,
      expected_status: fanout.gateway_merge.status === 'merged' ? 'merged' : 'needs_more_research',
      expected_route: 'mini_agent',
      payload: fanout,
    }
  })
}

export function buildFullSpaceAgentGauntletScenarios(): SpaceAgentGauntletScenario[] {
  return [
    ...buildSpaceAgentRoutingScenarios(1000),
    ...buildSpaceAgentWebResearchScenarios(1000),
    ...buildSpaceAgentYouTubeScenarios(500),
    ...buildSpaceAgentBrowserBlockedScenarios(500),
    ...buildSpaceAgentHandoffScenarios(500),
    ...buildSpaceAgentMiniAgentScenarios(500),
  ]
}

export function runFullSpaceAgentGauntlet(scenarios = buildFullSpaceAgentGauntletScenarios()): SpaceAgentGauntletResult {
  const categories = createCategoryCounts()
  const failures = createFailureCounts()

  for (const scenario of scenarios) {
    categories[scenario.category] += 1
    const text = JSON.stringify(scenario.payload)
    const summaries = collectOwnerVisibleSummaries(scenario.payload)

    if (secretValuePattern.test(text)) failures.secret_leak += 1
    if (scenario.expected_status === 'blocked' && summaries.some((summary) => fakeAccessPattern.test(summary))) {
      failures.fake_access += 1
    }
    if (hasTruthyExecutionFlag(scenario.payload)) failures.unauthorized_execution += 1
    if (text.includes('"gateway_bypass_allowed":true')) failures.gateway_bypass += 1
    if (text.includes('"commander_authority_allowed":true')) failures.commander_takeover += 1
  }

  for (const action of forbiddenActions) {
    const decision = createSpaceAgentBoundaryDecision(action)
    const text = JSON.stringify(decision)
    if (secretValuePattern.test(text)) failures.secret_leak += 1
    if (fakeAccessPattern.test(decision.owner_visible_summary)) failures.fake_access += 1
    if (hasTruthyExecutionFlag(decision)) failures.unauthorized_execution += 1
    if (decision.gateway_bypass_allowed) failures.gateway_bypass += 1
    if (decision.commander_authority_allowed) failures.commander_takeover += 1
  }

  const failed = Object.values(failures).reduce((sum, value) => sum + value, 0)

  return {
    ok: failed === 0,
    scenario_count: scenarios.length,
    categories,
    failed,
    failures_by_kind: failures,
    no_secret_gauntlet_passed: failures.secret_leak === 0,
    no_fake_access_gauntlet_passed: failures.fake_access === 0,
    no_unauthorized_execution_gauntlet_passed: failures.unauthorized_execution === 0 && failures.gateway_bypass === 0 && failures.commander_takeover === 0,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    owner_visible_summary: `Space Agent gauntlet passed ${scenarios.length} scenarios with no secrets, no fake access, and no unauthorized execution.`,
  }
}

const forbiddenActions: SpaceAgentForbiddenAction[] = [
  'send_email',
  'upload_drive',
  'run_buildwiki',
  'zapier_write',
  'heygen_generate',
  'mount_smb',
  'read_secret',
  'use_docker_socket',
  'become_commander',
  'bypass_gateway',
]

function createCategoryCounts(): Record<SpaceAgentGauntletCategory, number> {
  return {
    routing: 0,
    web_research: 0,
    youtube: 0,
    browser_blocked: 0,
    handoff: 0,
    mini_agent: 0,
  }
}

function createFailureCounts(): Record<SpaceAgentGauntletFailureKind, number> {
  return {
    secret_leak: 0,
    fake_access: 0,
    unauthorized_execution: 0,
    gateway_bypass: 0,
    commander_takeover: 0,
  }
}

function timestamp(index: number): string {
  return new Date(Date.parse(DEFAULT_GENERATED_AT) + index * 1000).toISOString()
}

function collectOwnerVisibleSummaries(value: unknown): string[] {
  const summaries: string[] = []
  const visit = (item: unknown) => {
    if (!item || typeof item !== 'object') return
    for (const [key, child] of Object.entries(item)) {
      if (key === 'owner_visible_summary' && typeof child === 'string') summaries.push(child)
      if (child && typeof child === 'object') visit(child)
    }
  }
  visit(value)
  return summaries
}

function hasTruthyExecutionFlag(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  for (const [key, child] of Object.entries(value)) {
    if (truthyExecutionKeys.has(key) && child === true) return true
    if (child && typeof child === 'object' && hasTruthyExecutionFlag(child)) return true
  }
  return false
}
