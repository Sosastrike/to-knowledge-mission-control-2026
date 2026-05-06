export type SpaceAgentResearchType = 'browser' | 'web' | 'youtube' | 'video' | 'firecrawl' | 'page_extraction' | 'general'

export type SpaceAgentResearchOperation =
  | 'web_search'
  | 'page_read'
  | 'firecrawl_scrape'
  | 'firecrawl_crawl'
  | 'firecrawl_map'
  | 'firecrawl_extract'
  | 'browser_interaction'
  | 'youtube_video_inspection'
  | 'screenshot_page_state'
  | 'inaccessible_site_or_video'
  | 'general_research'
  | 'research_not_needed'

export type SpaceAgentRequester = 'owner' | 'agent_zero' | 'hermes' | 'pi' | 'gateway'
export type SpaceAgentResponsibleAgent = 'agent_zero' | 'hermes' | 'pi' | 'responsible_specialist_agent'
export type SpaceAgentRouteDecision = 'allowed' | 'blocked' | 'requires_session' | 'missing_credential'
export type BrowserActionKind = 'open' | 'navigate' | 'inspect' | 'extract' | 'search' | 'screenshot' | 'page_state' | 'none'
export type BrowserCaptureKind = 'page_text' | 'screenshot_reference' | 'metadata'
export type BrowserActionBlocker = 'owner_credentials_not_approved' | 'paywall_bypass_not_allowed' | 'private_account_scrape_not_approved' | 'copyrighted_video_download_blocked_by_default' | null

export type WebResearchIntent = {
  intent_id: string
  schema: 'web_research_intent_v1'
  request_summary: string
  research_type: SpaceAgentResearchType
  research_operation: SpaceAgentResearchOperation
  research_needed: boolean
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
  owner_credentials_for_browser_requires_approval: true
  copyrighted_video_download_blocked_by_default: true
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

export type YouTubeResearchSourcePath = 'official' | 'transcript' | 'metadata'

export type YouTubeResearchIntent = {
  intent_id: string
  schema: 'youtube_research_intent_v1'
  request_summary: string
  requested_by: SpaceAgentRequester
  responsible_agent: SpaceAgentResponsibleAgent
  video_url: string | null
  video_id: string | null
  official_paths_first: true
  source_priority: YouTubeResearchSourcePath[]
  metadata_required: true
  transcript_or_captions_preferred: true
  frame_capture_allowed: boolean
  full_video_download_allowed: false
  created_at: string
  no_secrets_exposed: true
  no_raw_paths: true
  blocked_reason: string | null
}

export type YouTubeMetadata = {
  schema: 'youtube_metadata_v1'
  title: string | null
  channel: string | null
  publish_date: string | null
  url: string | null
  description: string | null
  metadata_status: 'available' | 'missing' | 'unknown'
}

export type YouTubeTranscriptSegment = {
  segment_id: string
  schema: 'youtube_transcript_segment_v1'
  start_seconds: number | null
  end_seconds: number | null
  text: string
  source: 'official_transcript' | 'captions' | 'metadata' | 'unknown'
  no_secrets_exposed: true
}

export type YouTubeChapter = {
  chapter_id: string
  schema: 'youtube_chapter_v1'
  title: string
  start_seconds: number | null
  end_seconds: number | null
  source: 'official_chapters' | 'description' | 'metadata' | 'unknown'
}

export type YouTubeKeyClaim = {
  claim_id: string
  schema: 'youtube_key_claim_v1'
  claim: string
  source_segment_ids: string[]
  confidence: 'low' | 'medium' | 'high'
  needs_verification: boolean
}

export type YouTubeFrameCapture = {
  capture_id: string
  schema: 'youtube_frame_capture_v1'
  status: 'allowed' | 'blocked' | 'not_requested'
  timestamp_seconds: number | null
  reference: string | null
  blocked_reason: string | null
  no_raw_paths: true
}

export type YouTubeResearchPacket = {
  packet_id: string
  schema: 'youtube_research_packet_v1'
  mode: 'youtube_research_packet'
  status: 'ready' | 'limited' | 'blocked'
  research_stage_owner: 'space_agent'
  returns_to: SpaceAgentResponsibleAgent
  requested_by: SpaceAgentRequester
  responsible_agent: SpaceAgentResponsibleAgent
  youtube_research_intent: YouTubeResearchIntent
  route: SpaceAgentResearchRoute
  return_route: SpaceAgentReturnRoute
  metadata: YouTubeMetadata
  transcript_status: 'available' | 'missing' | 'blocked' | 'unknown'
  captions_available: boolean
  transcript_segments: YouTubeTranscriptSegment[]
  chapters: YouTubeChapter[]
  key_claims: YouTubeKeyClaim[]
  frame_captures: YouTubeFrameCapture[]
  allowed_paths: YouTubeResearchSourcePath[]
  official_paths_first: true
  full_video_download_allowed: false
  full_video_download_blocked_by_default: true
  blocked_reason: string | null
  limitations: string[]
  citations: string[]
  no_secrets_exposed: true
  no_raw_paths: true
  owner_visible_summary: string
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

export type ResearchPacketSourceSummary = {
  source_id: string
  source_type: EvidenceItem['source_type'] | WebSource['type'] | YouTubeSource['type'] | 'browser_action'
  title: string | null
  url: string | null
  status: string
  blocked_reason: string | null
}

export type ResearchEvidenceSnippet = {
  evidence_id: string
  source_id: string | null
  snippet: string
  url: string | null
  confidence: EvidenceItem['confidence']
}

export type BrowserActionSummary = {
  action_id: string
  schema: 'browser_action_summary_v1'
  web_research_intent_id: string
  action: BrowserActionKind
  action_type: BrowserActionKind
  target: string | null
  url: string | null
  timestamp: string | null
  status: 'planned' | 'blocked' | 'summarized'
  read_only: true
  browser_interaction_enabled: false
  execution_enabled: false
  uses_owner_credentials: false
  owner_credentials_approved: false
  paywall_bypass_allowed: false
  private_account_scrape_allowed: false
  copyrighted_video_download_allowed: false
  allowed_capture: BrowserCaptureKind[]
  returns_evidence: true
  hidden_state_returned: false
  stays_inside_space_agent: true
  summary: string
  blocked_reason: string | null
  exact_blocker: BrowserActionBlocker
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
  job_id: string
  original_request: string
  assigned_supervisor: 'agent_zero'
  status: 'ready' | 'blocked'
  research_stage_owner: 'space_agent'
  returns_to: SpaceAgentResponsibleAgent
  requested_by: SpaceAgentRequester
  responsible_agent: SpaceAgentResponsibleAgent
  recommended_next_agent: SpaceAgentResponsibleAgent
  research_type: SpaceAgentResearchType
  research_operation: SpaceAgentResearchOperation
  research_needed: boolean
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
  source_list: ResearchPacketSourceSummary[]
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
  confidence: EvidenceItem['confidence']
  evidence_snippets: ResearchEvidenceSnippet[]
  citations: string[]
  urls: string[]
  blockers: string[]
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

export type YouTubeResearchPacketInput = SpaceAgentResearchPacketInput & {
  videoUrl?: string
  title?: string | null
  channel?: string | null
  publishDate?: string | null
  description?: string | null
  captionsAvailable?: boolean
  transcriptSegments?: Array<Partial<YouTubeTranscriptSegment> & { text: string }>
  chapters?: Array<Partial<YouTubeChapter> & { title: string }>
  frameCaptureAllowed?: boolean
  frameCaptures?: Array<Partial<YouTubeFrameCapture>>
}

const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z'
const OWNER_CREDENTIAL_BROWSER_PATTERN = /\b(?:use|using|with|owner|my|saved|stored).{0,30}(?:credential|credentials|password|cookie|cookies|session|login|sign in|auth)\b/i
const PAYWALL_BYPASS_PATTERN = /\b(?:bypass|circumvent|evade|break through|unlock|work around).{0,40}(?:paywall|paid content|subscriber|subscription)|(?:paywall|paid content|subscriber|subscription).{0,40}(?:bypass|circumvent|evade|unlock|work around)\b/i
const PRIVATE_ACCOUNT_SCRAPE_PATTERN = /\b(?:scrape|crawl|extract|download|copy|inspect).{0,50}(?:private account|private profile|private page|private inbox|dm|direct message|account dashboard)\b/i
const COPYRIGHTED_VIDEO_DOWNLOAD_PATTERN = /\b(?:download|rip|save|copy).{0,50}(?:copyrighted|protected|paid|subscriber|subscription|youtube|video|movie|course|webinar)\b/i
const PRIVATE_OR_LOGIN_PATTERN = /\b(?:login|log in|sign in|private|paywall|paid content|credential|password|cookie|session token)\b/i
const SECRETISH_PATTERN = /(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?FILE)\s*[:=]\s*[^,\s}]+)/gi
const RAW_PATH_PATTERN = /(?:\/home\/tony|\/a0\/|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi

export function createWebResearchIntent(input: SpaceAgentResearchPacketInput): WebResearchIntent {
  const request = sanitize(input.request)
  const researchType = classifySpaceAgentResearch(request)
  const researchOperation = classifySpaceAgentResearchOperation(request)
  const researchNeeded = researchOperation !== 'research_not_needed'
  const privateBoundary = PRIVATE_OR_LOGIN_PATTERN.test(request)
  const browserBlocker = getBrowserActionPolicyBlocker(request)
  return {
    intent_id: normalizeId(`web_research_intent_${researchType}_${input.generatedAt || DEFAULT_GENERATED_AT}`),
    schema: 'web_research_intent_v1',
    request_summary: request,
    research_type: researchType,
    research_operation: researchOperation,
    research_needed: researchNeeded,
    requested_by: input.requestedBy || 'gateway',
    responsible_agent: normalizeResponsibleAgent(input.responsibleAgent, input.requestedBy),
    requires_live_web: researchNeeded,
    requires_browser: researchType === 'browser' || researchType === 'page_extraction' || ['browser_interaction', 'screenshot_page_state', 'inaccessible_site_or_video'].includes(researchOperation),
    requires_youtube: researchType === 'youtube' || researchType === 'video' || researchOperation === 'youtube_video_inspection' || /youtube|you tube|video/i.test(request),
    requires_firecrawl: researchType === 'firecrawl' || researchOperation.startsWith('firecrawl_') || /fire\s*crawl|firecrawl|crawl|scrape/i.test(request),
    private_or_login_boundary: privateBoundary,
    created_at: input.generatedAt || DEFAULT_GENERATED_AT,
    no_secrets_exposed: true,
    no_raw_paths: true,
    blocked_reason: browserBlocker || (privateBoundary ? 'private_or_login_boundary_requires_owner_approved_credentials_and_bridge_session_scope' : null),
  }
}

export function createSpaceAgentPolicy(intent: WebResearchIntent, input: { firecrawlConfigured?: boolean } = {}): SpaceAgentPolicy {
  const firecrawlMissing = intent.requires_firecrawl && !input.firecrawlConfigured
  const blockedReason = intent.blocked_reason || (firecrawlMissing ? 'firecrawl_missing_credential_research_packet_can_still_use_browser_or_web_fallback_if_available' : null)
  const hardBlocked = Boolean(intent.blocked_reason)
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
    owner_credentials_for_browser_requires_approval: true,
    copyrighted_video_download_blocked_by_default: true,
    paywall_private_content_blocked: true,
    route_decision: hardBlocked || bridgeSessionReason ? 'blocked' : firecrawlMissing ? 'missing_credential' : 'allowed',
    blocked_reason: blockedReason,
  }
}

export function createSpaceAgentJob(input: SpaceAgentResearchPacketInput): SpaceAgentJob {
  const intent = createWebResearchIntent(input)
  const policy = createSpaceAgentPolicy(intent, { firecrawlConfigured: input.firecrawlConfigured })
  const route = createSpaceAgentResearchRoute(policy)
  const returnRoute = createSpaceAgentReturnRoute(intent.responsible_agent)
  const blockedReason = policy.blocked_reason || policy.bridge_session_reason
  const status = policy.route_decision === 'blocked' ? 'blocked' : 'ready'
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
    owner_visible_summary: !intent.research_needed
      ? 'research not needed; Space Agent should hand back through Gateway.'
      : status === 'blocked'
        ? `Space Agent job is blocked: ${blockedReason}.`
        : 'Space Agent job is ready for read-only Research Packet preparation through Gateway.',
  }
}


export function createYouTubeResearchPacket(input: YouTubeResearchPacketInput): YouTubeResearchPacket {
  const basePacket = createSpaceAgentResearchPacket({
    ...input,
    request: input.request || 'Inspect this YouTube video',
  })
  const videoUrl = sanitize(input.videoUrl || firstYouTubeUrl(input.request) || input.youtubeSources?.[0]?.video_url || '') || null
  const transcriptSegments = normalizeYouTubeTranscriptSegments(input.transcriptSegments, input.generatedAt)
  const captionsAvailable = Boolean(input.captionsAvailable || transcriptSegments.length > 0)
  const transcriptStatus: YouTubeResearchPacket['transcript_status'] = transcriptSegments.length > 0
    ? 'available'
    : basePacket.blocked_reason
      ? 'blocked'
      : 'missing'
  const metadata = normalizeYouTubeMetadata(input, videoUrl)
  const chapters = normalizeYouTubeChapters(input.chapters)
  const frameCaptures = normalizeYouTubeFrameCaptures(input.frameCaptures, Boolean(input.frameCaptureAllowed))
  const downloadBlocked = getBrowserActionPolicyBlocker(input.request) === 'copyrighted_video_download_blocked_by_default'
  const transcriptLimited = transcriptStatus === 'missing'
  const blockedReason = basePacket.blocked_reason || (downloadBlocked ? 'copyrighted_video_download_blocked_by_default' : transcriptLimited ? 'youtube_transcript_unavailable' : null)
  const status: YouTubeResearchPacket['status'] = basePacket.status === 'blocked' || downloadBlocked
    ? 'blocked'
    : transcriptLimited
      ? 'limited'
      : 'ready'
  const limitations = [
    transcriptLimited ? 'Transcript or captions unavailable; key claims are limited to supplied metadata and cannot be treated as transcript-backed.' : null,
    frameCaptures.some((capture) => capture.status === 'blocked') ? 'Frame capture requested but blocked because tooling approval is missing.' : null,
    downloadBlocked ? 'Full video download is blocked by default unless explicitly authorized and legal.' : null,
  ].filter((item): item is string => Boolean(item))

  return {
    packet_id: normalizeId(`youtube_research_${metadata.video_id || videoUrl || input.generatedAt || DEFAULT_GENERATED_AT}`),
    schema: 'youtube_research_packet_v1',
    mode: 'youtube_research_packet',
    status,
    research_stage_owner: 'space_agent',
    returns_to: basePacket.returns_to,
    requested_by: basePacket.requested_by,
    responsible_agent: basePacket.responsible_agent,
    youtube_research_intent: createYouTubeResearchIntent(input, metadata, videoUrl, blockedReason),
    route: basePacket.route,
    return_route: basePacket.return_route,
    metadata,
    transcript_status: transcriptStatus,
    captions_available: captionsAvailable,
    transcript_segments: transcriptSegments,
    chapters,
    key_claims: extractYouTubeKeyClaims(transcriptSegments),
    frame_captures: frameCaptures,
    allowed_paths: ['official', 'transcript', 'metadata'],
    official_paths_first: true,
    full_video_download_allowed: false,
    full_video_download_blocked_by_default: true,
    blocked_reason: blockedReason,
    limitations,
    citations: [metadata.url, ...basePacket.citations].filter((value): value is string => Boolean(value)),
    no_secrets_exposed: true,
    no_raw_paths: true,
    owner_visible_summary: status === 'blocked'
      ? `YouTube research is blocked: ${blockedReason}.`
      : status === 'limited'
        ? `YouTube research packet is limited: ${blockedReason}.`
        : 'YouTube research packet is ready with metadata, transcript-backed claims when available, and Gateway return route.',
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
  const browserActions = normalizeBrowserActions(input.browserActions, intent, input.generatedAt)
  const citations = collectCitations(evidence, webSources, youtubeSources)
  const sourceList = collectResearchSources(evidence, webSources, youtubeSources, browserActions)
  const blockers = collectResearchBlockers(job, webSources, youtubeSources, browserActions)

  return {
    packet_id: normalizeId(`space_agent_${researchType}_${input.generatedAt || DEFAULT_GENERATED_AT}`),
    schema: 'research_packet_v1',
    mode: 'space_agent_research_packet',
    job_id: job.job_id,
    original_request: intent.request_summary,
    assigned_supervisor: job.supervisor,
    status: job.status,
    research_stage_owner: 'space_agent',
    returns_to: job.responsible_agent,
    requested_by: intent.requested_by,
    responsible_agent: job.responsible_agent,
    recommended_next_agent: job.responsible_agent,
    research_type: researchType,
    research_operation: intent.research_operation,
    research_needed: intent.research_needed,
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
    source_list: sourceList,
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
    confidence: deriveResearchConfidence(evidence, blockers),
    evidence_snippets: collectEvidenceSnippets(evidence),
    citations,
    urls: citations,
    blockers,
    blocked_reason: job.blocked_reason,
    owner_visible_summary: !intent.research_needed
      ? `research not needed; Space Agent hands back to ${job.responsible_agent} through Gateway.`
      : job.blocked_reason
        ? `Space Agent prepared a research packet with blocker: ${job.blocked_reason}.`
        : `Space Agent can prepare a ${intent.research_operation} research packet and return responsibility to ${job.responsible_agent}.`,
  }
}

export function classifySpaceAgentResearch(request: string): SpaceAgentResearchType {
  const text = sanitize(request).toLowerCase()
  const operation = classifySpaceAgentResearchOperation(text)
  if (operation.startsWith('firecrawl_')) return 'firecrawl'
  if (operation === 'youtube_video_inspection') return /youtube|you tube/.test(text) ? 'youtube' : 'video'
  if (operation === 'screenshot_page_state' || operation === 'browser_interaction' || operation === 'inaccessible_site_or_video') return 'browser'
  if (operation === 'page_read') return 'page_extraction'
  if (operation === 'web_search') return 'web'
  if (/fire\s*crawl|firecrawl|crawl|scrape/.test(text)) return 'firecrawl'
  if (/youtube|you tube/.test(text)) return 'youtube'
  if (/video/.test(text)) return 'video'
  if (/extract|webpage|web page|page/.test(text)) return 'page_extraction'
  if (/browser|browse/.test(text)) return 'browser'
  if (/web|article|search|online/.test(text)) return 'web'
  return 'general'
}

export function classifySpaceAgentResearchOperation(request: string): SpaceAgentResearchOperation {
  const text = sanitize(request).toLowerCase()
  const firecrawl = /fire\s*crawl|firecrawl/.test(text)
  if (/agents? (?:normally )?(?:cannot|can't) access|(?:cannot|can't) access (?:this |the )?(?:site|website|webpage|page|video)|not accessible to agents?|site\/video/.test(text)) return 'inaccessible_site_or_video'
  if (/screenshot|screen shot|page[-\s]?state|visual state|capture (?:the )?page|page capture/.test(text)) return 'screenshot_page_state'
  if (firecrawl && /\bmap(?:ping)?\b|site map|sitemap/.test(text)) return 'firecrawl_map'
  if (firecrawl && /\bextract(?:ion)?\b|structured data|extract data/.test(text)) return 'firecrawl_extract'
  if (firecrawl && /\bcrawl(?:ing)?\b/.test(text)) return 'firecrawl_crawl'
  if (firecrawl && /\bscrape|scraping|scraper\b/.test(text)) return 'firecrawl_scrape'
  if (/youtube|you tube|video inspection|inspect (?:this |the )?video|video source|video transcript|video metadata|\bvideo\b/.test(text)) return 'youtube_video_inspection'
  if (/browser interaction|page interaction|interact with (?:a |the )?page|click|navigate|open (?:a |the )?(?:browser|site|page)|browse/.test(text)) return 'browser_interaction'
  if (/web search|search the web|search web|live search|online search|search online/.test(text)) return 'web_search'
  if (/read (?:a |the |this )?(?:website|webpage|web page|page|article)|website reading|page reading|webpage reading|article|webpage|web page|url/.test(text)) return 'page_read'
  if (/\bweb\b|online research|live web|public site|public page/.test(text)) return 'web_search'
  return 'research_not_needed'
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

function createYouTubeResearchIntent(input: YouTubeResearchPacketInput, metadata: YouTubeMetadata & { video_id?: string | null }, videoUrl: string | null, blockedReason: string | null): YouTubeResearchIntent {
  return {
    intent_id: normalizeId(`youtube_research_intent_${metadata.video_id || videoUrl || input.generatedAt || DEFAULT_GENERATED_AT}`),
    schema: 'youtube_research_intent_v1',
    request_summary: sanitize(input.request),
    requested_by: input.requestedBy || 'gateway',
    responsible_agent: normalizeResponsibleAgent(input.responsibleAgent, input.requestedBy),
    video_url: videoUrl,
    video_id: metadata.video_id || videoIdFromUrl(videoUrl),
    official_paths_first: true,
    source_priority: ['official', 'transcript', 'metadata'],
    metadata_required: true,
    transcript_or_captions_preferred: true,
    frame_capture_allowed: Boolean(input.frameCaptureAllowed),
    full_video_download_allowed: false,
    created_at: input.generatedAt || DEFAULT_GENERATED_AT,
    no_secrets_exposed: true,
    no_raw_paths: true,
    blocked_reason: blockedReason,
  }
}

function normalizeYouTubeMetadata(input: YouTubeResearchPacketInput, videoUrl: string | null): YouTubeMetadata & { video_id?: string | null } {
  const source = input.youtubeSources?.[0]
  const title = input.title ?? source?.title ?? null
  const channel = input.channel ?? source?.channel ?? null
  const url = videoUrl || source?.video_url || null
  const description = input.description ?? null
  return {
    schema: 'youtube_metadata_v1',
    title: title ? sanitize(title) : null,
    channel: channel ? sanitize(channel) : null,
    publish_date: input.publishDate ? sanitize(input.publishDate) : null,
    url: url ? sanitize(url) : null,
    description: description ? sanitize(description) : null,
    metadata_status: title || channel || url || description ? 'available' : 'missing',
    video_id: source?.video_id || videoIdFromUrl(url),
  }
}

function normalizeYouTubeTranscriptSegments(value: YouTubeResearchPacketInput['transcriptSegments'], generatedAt: string | undefined): YouTubeTranscriptSegment[] {
  return (value || []).map((item, index) => ({
    segment_id: normalizeId(item.segment_id || `youtube_transcript_segment_${index + 1}`),
    schema: 'youtube_transcript_segment_v1' as const,
    start_seconds: typeof item.start_seconds === 'number' ? item.start_seconds : null,
    end_seconds: typeof item.end_seconds === 'number' ? item.end_seconds : null,
    text: sanitize(item.text),
    source: item.source || 'official_transcript',
    no_secrets_exposed: true as const,
  })).filter((item) => item.text.length > 0)
}

function normalizeYouTubeChapters(value: YouTubeResearchPacketInput['chapters']): YouTubeChapter[] {
  return (value || []).map((item, index) => ({
    chapter_id: normalizeId(item.chapter_id || `youtube_chapter_${index + 1}`),
    schema: 'youtube_chapter_v1' as const,
    title: sanitize(item.title),
    start_seconds: typeof item.start_seconds === 'number' ? item.start_seconds : null,
    end_seconds: typeof item.end_seconds === 'number' ? item.end_seconds : null,
    source: item.source || 'official_chapters',
  })).filter((item) => item.title.length > 0)
}

function normalizeYouTubeFrameCaptures(value: YouTubeResearchPacketInput['frameCaptures'], frameCaptureAllowed: boolean): YouTubeFrameCapture[] {
  return (value || []).map((item, index) => {
    const requestedReference = item.reference ? sanitize(item.reference) : null
    const blocked = !frameCaptureAllowed
    return {
      capture_id: normalizeId(item.capture_id || `youtube_frame_capture_${index + 1}`),
      schema: 'youtube_frame_capture_v1' as const,
      status: blocked ? 'blocked' : requestedReference ? 'allowed' : 'not_requested',
      timestamp_seconds: typeof item.timestamp_seconds === 'number' ? item.timestamp_seconds : null,
      reference: blocked ? null : requestedReference,
      blocked_reason: blocked ? 'youtube_frame_capture_tooling_not_approved' : item.blocked_reason ? sanitize(item.blocked_reason) : null,
      no_raw_paths: true as const,
    }
  })
}

function extractYouTubeKeyClaims(segments: YouTubeTranscriptSegment[]): YouTubeKeyClaim[] {
  return segments.slice(0, 12).map((segment, index) => ({
    claim_id: normalizeId(`youtube_key_claim_${index + 1}`),
    schema: 'youtube_key_claim_v1' as const,
    claim: summarizeClaim(segment.text),
    source_segment_ids: [segment.segment_id],
    confidence: 'medium' as const,
    needs_verification: true as const,
  })).filter((claim) => claim.claim.length > 0)
}

function summarizeClaim(value: string): string {
  const cleaned = sanitize(value).replace(/\s+/g, ' ')
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned
  return sentence.length > 220 ? `${sentence.slice(0, 217).trim()}...` : sentence
}

function firstYouTubeUrl(value: string): string | null {
  const match = sanitize(value).match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[^\s]+|youtu\.be\/[^\s]+)/i)
  return match ? match[0] : null
}

function normalizeBrowserActions(value: SpaceAgentResearchPacketInput['browserActions'], intent: WebResearchIntent, generatedAt: string | undefined): BrowserActionSummary[] {
  return (value || []).map((item, index) => normalizeBrowserAction(item, index, intent, generatedAt))
}

function normalizeBrowserAction(item: Partial<BrowserActionSummary>, index: number, intent: WebResearchIntent, generatedAt: string | undefined): BrowserActionSummary {
  const action = item.action || 'inspect'
  const target = item.target ? sanitize(item.target) : null
  const policyBlocker = getBrowserActionPolicyBlocker([intent.request_summary, target, item.summary || ''].filter(Boolean).join(' '))
  const blockedReason = item.blocked_reason ? sanitize(item.blocked_reason) : policyBlocker
  return {
    action_id: normalizeId(item.action_id || `browser_action_${index + 1}`),
    schema: 'browser_action_summary_v1',
    web_research_intent_id: intent.intent_id,
    action,
    action_type: action,
    target,
    url: target && /^https?:\/\//i.test(target) ? target : null,
    timestamp: item.timestamp || generatedAt || null,
    status: blockedReason ? 'blocked' : item.status || 'planned',
    read_only: true,
    browser_interaction_enabled: false,
    execution_enabled: false,
    uses_owner_credentials: false,
    owner_credentials_approved: false,
    paywall_bypass_allowed: false,
    private_account_scrape_allowed: false,
    copyrighted_video_download_allowed: false,
    allowed_capture: ['page_text', 'screenshot_reference', 'metadata'],
    returns_evidence: true,
    hidden_state_returned: false,
    stays_inside_space_agent: true,
    summary: sanitize(item.summary || 'Read-only browser research action summary; evidence only, no hidden state.'),
    blocked_reason: blockedReason,
    exact_blocker: policyBlocker,
  }
}

function collectCitations(evidence: EvidenceItem[], webSources: WebSource[], youtubeSources: YouTubeSource[]): string[] {
  return dedupeStrings([
    ...evidence.map((item) => item.url).filter((url): url is string => Boolean(url)),
    ...webSources.map((item) => item.url).filter((url): url is string => Boolean(url)),
    ...youtubeSources.map((item) => item.video_url).filter((url): url is string => Boolean(url)),
  ])
}

function collectResearchSources(evidence: EvidenceItem[], webSources: WebSource[], youtubeSources: YouTubeSource[], browserActions: BrowserActionSummary[]): ResearchPacketSourceSummary[] {
  return [
    ...webSources.map((source): ResearchPacketSourceSummary => ({
      source_id: source.source_id,
      source_type: source.type,
      title: source.title,
      url: source.url,
      status: source.status,
      blocked_reason: source.blocked_reason,
    })),
    ...youtubeSources.map((source): ResearchPacketSourceSummary => ({
      source_id: source.source_id,
      source_type: source.type,
      title: source.title,
      url: source.video_url,
      status: source.transcript_status || source.metadata_status,
      blocked_reason: source.blocked_reason,
    })),
    ...browserActions.map((action): ResearchPacketSourceSummary => ({
      source_id: action.action_id,
      source_type: 'browser_action',
      title: action.action_type,
      url: action.url,
      status: action.status,
      blocked_reason: action.blocked_reason,
    })),
    ...evidence.filter((item) => item.url).map((item): ResearchPacketSourceSummary => ({
      source_id: item.source_id || item.evidence_id,
      source_type: item.source_type,
      title: null,
      url: item.url,
      status: 'evidence',
      blocked_reason: null,
    })),
  ]
}

function collectEvidenceSnippets(evidence: EvidenceItem[]): ResearchEvidenceSnippet[] {
  return evidence.map((item) => ({
    evidence_id: item.evidence_id,
    source_id: item.source_id,
    snippet: item.quote || item.summary,
    url: item.url,
    confidence: item.confidence,
  }))
}

function deriveResearchConfidence(evidence: EvidenceItem[], blockers: string[]): EvidenceItem['confidence'] {
  if (blockers.length > 0) return 'low'
  if (evidence.length === 0) return 'low'
  if (evidence.every((item) => item.confidence === 'high')) return 'high'
  if (evidence.some((item) => item.confidence === 'low')) return 'low'
  return 'medium'
}

function collectResearchBlockers(job: SpaceAgentJob, webSources: WebSource[], youtubeSources: YouTubeSource[], browserActions: BrowserActionSummary[]): string[] {
  return dedupeStrings([
    job.blocked_reason,
    job.policy.blocked_reason,
    job.policy.bridge_session_reason,
    ...webSources.map((source) => source.blocked_reason),
    ...youtubeSources.map((source) => source.blocked_reason),
    ...browserActions.map((action) => action.blocked_reason),
  ].filter((value): value is string => Boolean(value)))
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values))
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

function getBrowserActionPolicyBlocker(value: string | null | undefined): BrowserActionBlocker {
  const text = sanitize(value || '')
  if (OWNER_CREDENTIAL_BROWSER_PATTERN.test(text)) return 'owner_credentials_not_approved'
  if (PAYWALL_BYPASS_PATTERN.test(text)) return 'paywall_bypass_not_allowed'
  if (PRIVATE_ACCOUNT_SCRAPE_PATTERN.test(text)) return 'private_account_scrape_not_approved'
  if (COPYRIGHTED_VIDEO_DOWNLOAD_PATTERN.test(text)) return 'copyrighted_video_download_blocked_by_default'
  return null
}

function normalizeId(value: string): string {
  return sanitize(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'space_agent_research_packet'
}
