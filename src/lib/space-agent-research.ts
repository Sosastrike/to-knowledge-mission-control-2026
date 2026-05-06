export type SpaceAgentResearchType = 'browser' | 'web' | 'youtube' | 'video' | 'firecrawl' | 'page_extraction' | 'general'

export type SpaceAgentRequester = 'owner' | 'agent_zero' | 'hermes' | 'pi' | 'gateway'
export type SpaceAgentResponsibleAgent = 'agent_zero' | 'hermes' | 'pi' | 'responsible_specialist_agent'
export type SpaceAgentRouteDecision = 'allowed' | 'blocked' | 'requires_session' | 'missing_credential'

export type WebResearchIntent = {
  intent_id: string
  schema: 'web_research_intent_v1'
  request_summary: string
  research_type: SpaceAgentResearchType
  requested_by: SpaceAgentRequester
  responsible_agent: SpaceAgentResponsibleAgent
  requires_live_web: boolean
  requires_browser: boolean
  requires_youtube: boolean
  requires_firecrawl: boolean
  private_or_login_boundary: boolean
  created_at: string
  no_secrets_exposed: true
  no_raw_paths: true
  blocked_reason: string | null
}

export type SpaceAgentPolicy = {
  schema: 'space_agent_policy_v1'
  gateway_route_required: true
  pi_recommendation_required: true
  agent_zero_approval_required: true
  bridge_session_required: boolean
  bridge_session_reason: string | null
  read_only_research_default: true
  browser_interaction_enabled: false
  external_writes_enabled: false
  tool_execution_enabled: false
  secrets_allowed: false
  raw_paths_allowed: false
  no_fake_done: true
  login_boundary_respected: true
  paywall_private_content_blocked: true
  route_decision: SpaceAgentRouteDecision
  blocked_reason: string | null
}

export type SpaceAgentResearchRoute = {
  route_id: 'owner_gateway_pi_agent_zero_space_agent_research'
  source: 'owner'
  target: 'space_agent'
  hops: ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent']
  pi_recommendation: 'space_agent'
  agent_zero_approval: 'required'
  execution_mode: 'read_only_research_packet'
  policy_decision: SpaceAgentRouteDecision
  blocked_reason: string | null
}

export type SpaceAgentReturnRoute = {
  route_id: 'space_agent_gateway_responsible_agent_return'
  source: 'space_agent'
  target: SpaceAgentResponsibleAgent
  hops: string[]
  returns_packet: true
  owner_facing_response_owner: 'agent_zero'
  execution_mode: 'read_only_research_packet_return'
}

export type WebSource = {
  source_id: string
  schema: 'web_source_v1'
  type: 'web_source'
  url: string | null
  title: string | null
  domain: string | null
  access: 'public' | 'owner_approved' | 'blocked' | 'unknown'
  status: 'candidate' | 'checked' | 'blocked'
  last_checked: string | null
  blocked_reason: string | null
}

export type YouTubeSource = {
  source_id: string
  schema: 'youtube_source_v1'
  type: 'youtube_source'
  video_url: string | null
  video_id: string | null
  title: string | null
  channel: string | null
  metadata_status: 'candidate' | 'available' | 'blocked' | 'unknown'
  transcript_status: 'not_checked' | 'available' | 'blocked' | 'missing' | 'unknown'
  blocked_reason: string | null
}

export type EvidenceItem = {
  evidence_id: string
  schema: 'evidence_item_v1'
  source_id: string | null
  source_type: 'web' | 'youtube' | 'browser' | 'firecrawl' | 'gateway_registry' | 'unknown'
  summary: string
  quote: string | null
  url: string | null
  confidence: 'low' | 'medium' | 'high'
  collected_at: string | null
  no_secrets_exposed: true
}

export type BrowserActionSummary = {
  action_id: string
  schema: 'browser_action_summary_v1'
  action: 'open' | 'navigate' | 'inspect' | 'extract' | 'search' | 'none'
  target: string | null
  status: 'planned' | 'blocked' | 'summarized'
  read_only: true
  browser_interaction_enabled: false
  execution_enabled: false
  summary: string
  blocked_reason: string | null
}

export type SpaceAgentJob = {
  job_id: string
  schema: 'space_agent_job_v1'
  status: 'ready' | 'blocked'
  intent: WebResearchIntent
  assigned_agent: 'space_agent'
  dispatcher: 'pi'
  supervisor: 'agent_zero'
  responsible_agent: SpaceAgentResponsibleAgent
  route: SpaceAgentResearchRoute
  return_route: SpaceAgentReturnRoute
  policy: SpaceAgentPolicy
  requires_bridge_session: boolean
  blocked_reason: string | null
  execution_enabled: false
  writes_enabled: false
  owner_visible_summary: string
}

export type ResearchPacket = {
  packet_id: string
  schema: 'research_packet_v1'
  mode: 'space_agent_research_packet'
  status: 'ready' | 'blocked'
  research_stage_owner: 'space_agent'
  returns_to: SpaceAgentResponsibleAgent
  requested_by: SpaceAgentRequester
  responsible_agent: SpaceAgentResponsibleAgent
  research_type: SpaceAgentResearchType
  request_summary: string
  web_research_intent: WebResearchIntent
  space_agent_job: SpaceAgentJob
  route: SpaceAgentResearchRoute
  return_route: SpaceAgentReturnRoute
  policy: SpaceAgentPolicy
  evidence: EvidenceItem[]
  web_sources: WebSource[]
  youtube_sources: YouTubeSource[]
  browser_actions: BrowserActionSummary[]
  allowed_surfaces: string[]
  forbidden_surfaces: string[]
  required_gateway_route: 'owner_gateway_pi_agent_zero_space_agent_research'
  requires_bridge_session: boolean
  bridge_session_reason: string | null
  browser_interaction_enabled: false
  external_writes_enabled: false
  tool_execution_enabled: false
  firecrawl_status: 'available_from_registry' | 'blocked_missing_credential' | 'not_requested'
  youtube_status: 'research_packet_only' | 'not_requested'
  login_boundary_respected: true
  paywall_private_content_blocked: true
  no_secrets_exposed: true
  no_raw_paths: true
  findings: string[]
  citations: string[]
  blocked_reason: string | null
  owner_visible_summary: string
}

export type SpaceAgentResearchPacket = ResearchPacket

export type SpaceAgentResearchPacketInput = {
  request: string
  requestedBy?: SpaceAgentRequester
  responsibleAgent?: SpaceAgentResponsibleAgent
  generatedAt?: string
  firecrawlConfigured?: boolean
  evidence?: Array<Partial<EvidenceItem> & { summary: string }>
  webSources?: Array<Partial<WebSource>>
  youtubeSources?: Array<Partial<YouTubeSource>>
  browserActions?: Array<Partial<BrowserActionSummary>>
}

const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z'
const PRIVATE_OR_LOGIN_PATTERN = /\b(?:login|log in|sign in|private|paywall|paid content|credential|password|cookie|session token)\b/i
const SECRETISH_PATTERN = /(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?FILE)\s*[:=]\s*[^,\s}]+)/gi
const RAW_PATH_PATTERN = /(?:\/home\/tony|\/a0\/|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi

export function createWebResearchIntent(input: SpaceAgentResearchPacketInput): WebResearchIntent {
  const request = sanitize(input.request)
  const researchType = classifySpaceAgentResearch(request)
  const privateBoundary = PRIVATE_OR_LOGIN_PATTERN.test(request)
  return {
    intent_id: normalizeId(`web_research_intent_${researchType}_${input.generatedAt || DEFAULT_GENERATED_AT}`),
    schema: 'web_research_intent_v1',
    request_summary: request,
    research_type: researchType,
    requested_by: input.requestedBy || 'gateway',
    responsible_agent: normalizeResponsibleAgent(input.responsibleAgent, input.requestedBy),
    requires_live_web: researchType !== 'general',
    requires_browser: researchType === 'browser' || researchType === 'page_extraction',
    requires_youtube: researchType === 'youtube' || researchType === 'video' || /youtube|you tube|video/i.test(request),
    requires_firecrawl: researchType === 'firecrawl' || /fire\s*crawl|firecrawl|crawl|scrape/i.test(request),
    private_or_login_boundary: privateBoundary,
    created_at: input.generatedAt || DEFAULT_GENERATED_AT,
    no_secrets_exposed: true,
    no_raw_paths: true,
    blocked_reason: privateBoundary ? 'private_or_login_boundary_requires_owner_approved_credentials_and_bridge_session_scope' : null,
  }
}

export function createSpaceAgentPolicy(intent: WebResearchIntent, input: { firecrawlConfigured?: boolean } = {}): SpaceAgentPolicy {
  const firecrawlMissing = intent.requires_firecrawl && !input.firecrawlConfigured
  const blockedReason = intent.blocked_reason || (firecrawlMissing ? 'firecrawl_missing_credential_research_packet_can_still_use_browser_or_web_fallback_if_available' : null)
  const bridgeSessionReason = intent.private_or_login_boundary
    ? 'private_or_login_boundary_requires_owner_approved_credentials_and_bridge_session_scope'
    : null
  return {
    schema: 'space_agent_policy_v1',
    gateway_route_required: true,
    pi_recommendation_required: true,
    agent_zero_approval_required: true,
    bridge_session_required: Boolean(bridgeSessionReason),
    bridge_session_reason: bridgeSessionReason,
    read_only_research_default: true,
    browser_interaction_enabled: false,
    external_writes_enabled: false,
    tool_execution_enabled: false,
    secrets_allowed: false,
    raw_paths_allowed: false,
    no_fake_done: true,
    login_boundary_respected: true,
    paywall_private_content_blocked: true,
    route_decision: bridgeSessionReason ? 'blocked' : firecrawlMissing ? 'missing_credential' : 'allowed',
    blocked_reason: blockedReason,
  }
}

export function createSpaceAgentJob(input: SpaceAgentResearchPacketInput): SpaceAgentJob {
  const intent = createWebResearchIntent(input)
  const policy = createSpaceAgentPolicy(intent, { firecrawlConfigured: input.firecrawlConfigured })
  const route = createSpaceAgentResearchRoute(policy)
  const returnRoute = createSpaceAgentReturnRoute(intent.responsible_agent)
  const blockedReason = policy.bridge_session_reason || policy.blocked_reason
  const status = policy.bridge_session_reason ? 'blocked' : 'ready'
  return {
    job_id: normalizeId(`space_agent_job_${intent.intent_id}`),
    schema: 'space_agent_job_v1',
    status,
    intent,
    assigned_agent: 'space_agent',
    dispatcher: 'pi',
    supervisor: 'agent_zero',
    responsible_agent: intent.responsible_agent,
    route,
    return_route: returnRoute,
    policy,
    requires_bridge_session: policy.bridge_session_required,
    blocked_reason: blockedReason,
    execution_enabled: false,
    writes_enabled: false,
    owner_visible_summary: status === 'blocked'
      ? `Space Agent job is blocked: ${blockedReason}.`
      : 'Space Agent job is ready for read-only Research Packet preparation through Gateway.',
  }
}

export function createSpaceAgentResearchPacket(input: SpaceAgentResearchPacketInput): SpaceAgentResearchPacket {
  const job = createSpaceAgentJob(input)
  const intent = job.intent
  const researchType = intent.research_type
  const firecrawlStatus: SpaceAgentResearchPacket['firecrawl_status'] = intent.requires_firecrawl
    ? input.firecrawlConfigured
      ? 'available_from_registry'
      : 'blocked_missing_credential'
    : 'not_requested'
  const evidence = normalizeEvidence(input.evidence, input.generatedAt)
  const webSources = normalizeWebSources(input.webSources, input.generatedAt)
  const youtubeSources = normalizeYouTubeSources(input.youtubeSources)
  const browserActions = normalizeBrowserActions(input.browserActions)
  const citations = collectCitations(evidence, webSources, youtubeSources)

  return {
    packet_id: normalizeId(`space_agent_${researchType}_${input.generatedAt || DEFAULT_GENERATED_AT}`),
    schema: 'research_packet_v1',
    mode: 'space_agent_research_packet',
    status: job.status,
    research_stage_owner: 'space_agent',
    returns_to: job.responsible_agent,
    requested_by: intent.requested_by,
    responsible_agent: job.responsible_agent,
    research_type: researchType,
    request_summary: intent.request_summary,
    web_research_intent: intent,
    space_agent_job: job,
    route: job.route,
    return_route: job.return_route,
    policy: job.policy,
    evidence,
    web_sources: webSources,
    youtube_sources: youtubeSources,
    browser_actions: browserActions,
    allowed_surfaces: ['public web pages', 'owner-approved browser pages', 'public YouTube metadata/transcripts when available', 'Gateway Firecrawl status'],
    forbidden_surfaces: ['private accounts without approved credentials', 'paywalled/private content bypass', 'external writes', 'Zapier writes', 'HeyGen generation', 'SMB mounts', 'raw secret files'],
    required_gateway_route: 'owner_gateway_pi_agent_zero_space_agent_research',
    requires_bridge_session: job.requires_bridge_session,
    bridge_session_reason: job.policy.bridge_session_reason,
    browser_interaction_enabled: false,
    external_writes_enabled: false,
    tool_execution_enabled: false,
    firecrawl_status: firecrawlStatus,
    youtube_status: intent.requires_youtube ? 'research_packet_only' : 'not_requested',
    login_boundary_respected: true,
    paywall_private_content_blocked: true,
    no_secrets_exposed: true,
    no_raw_paths: true,
    findings: evidence.map((item) => item.summary),
    citations,
    blocked_reason: job.blocked_reason,
    owner_visible_summary: job.blocked_reason
      ? `Space Agent prepared a research packet with blocker: ${job.blocked_reason}.`
      : `Space Agent can prepare a ${researchType} research packet and return responsibility to ${job.responsible_agent}.`,
  }
}

export function classifySpaceAgentResearch(request: string): SpaceAgentResearchType {
  const text = sanitize(request).toLowerCase()
  if (/fire\s*crawl|firecrawl|crawl|scrape/.test(text)) return 'firecrawl'
  if (/youtube|you tube/.test(text)) return 'youtube'
  if (/video/.test(text)) return 'video'
  if (/extract|webpage|web page|page/.test(text)) return 'page_extraction'
  if (/browser|browse/.test(text)) return 'browser'
  if (/web|article|search|online/.test(text)) return 'web'
  return 'general'
}

function createSpaceAgentResearchRoute(policy: SpaceAgentPolicy): SpaceAgentResearchRoute {
  return {
    route_id: 'owner_gateway_pi_agent_zero_space_agent_research',
    source: 'owner',
    target: 'space_agent',
    hops: ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'],
    pi_recommendation: 'space_agent',
    agent_zero_approval: 'required',
    execution_mode: 'read_only_research_packet',
    policy_decision: policy.route_decision,
    blocked_reason: policy.blocked_reason,
  }
}

function createSpaceAgentReturnRoute(responsibleAgent: SpaceAgentResponsibleAgent): SpaceAgentReturnRoute {
  return {
    route_id: 'space_agent_gateway_responsible_agent_return',
    source: 'space_agent',
    target: responsibleAgent,
    hops: ['space_agent', 'gateway', responsibleAgent],
    returns_packet: true,
    owner_facing_response_owner: 'agent_zero',
    execution_mode: 'read_only_research_packet_return',
  }
}

function normalizeResponsibleAgent(value: SpaceAgentResponsibleAgent | null | undefined, requestedBy: SpaceAgentRequester | undefined): SpaceAgentResponsibleAgent {
  if (value && ['agent_zero', 'hermes', 'pi', 'responsible_specialist_agent'].includes(value)) return value
  if (requestedBy === 'agent_zero' || requestedBy === 'hermes' || requestedBy === 'pi') return requestedBy
  return 'agent_zero'
}

function normalizeEvidence(value: SpaceAgentResearchPacketInput['evidence'], generatedAt: string | undefined): EvidenceItem[] {
  return (value || []).map((item, index) => ({
    evidence_id: normalizeId(item.evidence_id || `evidence_${index + 1}`),
    schema: 'evidence_item_v1',
    source_id: item.source_id ? normalizeId(item.source_id) : null,
    source_type: item.source_type || 'unknown',
    summary: sanitize(item.summary),
    quote: item.quote ? sanitize(item.quote) : null,
    url: item.url ? sanitize(item.url) : null,
    confidence: item.confidence || 'medium',
    collected_at: item.collected_at || generatedAt || null,
    no_secrets_exposed: true,
  }))
}

function normalizeWebSources(value: SpaceAgentResearchPacketInput['webSources'], generatedAt: string | undefined): WebSource[] {
  return (value || []).map((item, index) => ({
    source_id: normalizeId(item.source_id || `web_source_${index + 1}`),
    schema: 'web_source_v1',
    type: 'web_source',
    url: item.url ? sanitize(item.url) : null,
    title: item.title ? sanitize(item.title) : null,
    domain: item.domain ? sanitize(item.domain) : domainFromUrl(item.url || null),
    access: item.access || 'unknown',
    status: item.status || 'candidate',
    last_checked: item.last_checked || generatedAt || null,
    blocked_reason: item.blocked_reason ? sanitize(item.blocked_reason) : null,
  }))
}

function normalizeYouTubeSources(value: SpaceAgentResearchPacketInput['youtubeSources']): YouTubeSource[] {
  return (value || []).map((item, index) => ({
    source_id: normalizeId(item.source_id || `youtube_source_${index + 1}`),
    schema: 'youtube_source_v1',
    type: 'youtube_source',
    video_url: item.video_url ? sanitize(item.video_url) : null,
    video_id: item.video_id ? sanitize(item.video_id) : videoIdFromUrl(item.video_url || null),
    title: item.title ? sanitize(item.title) : null,
    channel: item.channel ? sanitize(item.channel) : null,
    metadata_status: item.metadata_status || 'candidate',
    transcript_status: item.transcript_status || 'not_checked',
    blocked_reason: item.blocked_reason ? sanitize(item.blocked_reason) : null,
  }))
}

function normalizeBrowserActions(value: SpaceAgentResearchPacketInput['browserActions']): BrowserActionSummary[] {
  return (value || []).map((item, index) => ({
    action_id: normalizeId(item.action_id || `browser_action_${index + 1}`),
    schema: 'browser_action_summary_v1',
    action: item.action || 'inspect',
    target: item.target ? sanitize(item.target) : null,
    status: item.status || 'planned',
    read_only: true,
    browser_interaction_enabled: false,
    execution_enabled: false,
    summary: sanitize(item.summary || 'Read-only browser research action summary.'),
    blocked_reason: item.blocked_reason ? sanitize(item.blocked_reason) : null,
  }))
}

function collectCitations(evidence: EvidenceItem[], webSources: WebSource[], youtubeSources: YouTubeSource[]): string[] {
  return [
    ...evidence.map((item) => item.url).filter((url): url is string => Boolean(url)),
    ...webSources.map((item) => item.url).filter((url): url is string => Boolean(url)),
    ...youtubeSources.map((item) => item.video_url).filter((url): url is string => Boolean(url)),
  ]
}

function domainFromUrl(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).hostname
  } catch {
    return null
  }
}

function videoIdFromUrl(value: string | null): string | null {
  if (!value) return null
  const match = value.match(/[?&]v=([^&]+)/) || value.match(/youtu\.be\/([^?]+)/)
  return match ? sanitize(match[1]) : null
}

function sanitize(value: string): string {
  return String(value || '')
    .replace(SECRETISH_PATTERN, '[redacted-secret]')
    .replace(RAW_PATH_PATTERN, '[redacted-path]')
    .trim()
}

function normalizeId(value: string): string {
  return sanitize(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'space_agent_research_packet'
}
