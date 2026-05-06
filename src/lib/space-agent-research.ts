import {
  createMiniAgentDefinition,
  createMiniAgentMemory,
  expireMiniAgentMemory,
  type MiniAgentDefinition,
  type MiniAgentDefinitionResult,
  type MiniAgentMemory,
  type MiniAgentMemoryResult,
} from './gateway-mini-agent-contracts'

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

export type SpaceAgentHandoffStage =
  | 'research_task_received'
  | 'research_performed'
  | 'research_packet_returned'
  | 'gateway_validated_research_packet'
  | 'pi_reviewed_route_quality'
  | 'hermes_prepared_workflow_option'
  | 'agent_zero_decided_next_action'
  | 'responsible_agent_received_handoff'
  | 'space_agent_exited_task'
  | 'gateway_recorded_handoff_audit'

export type GatewayResearchPacketValidation = {
  schema: 'gateway_research_packet_validation_v1'
  validator: 'gateway'
  packet_id: string
  job_id: string
  valid: boolean
  decision: 'accepted' | 'blocked' | 'needs_more_research'
  missing_fields: string[]
  blockers: string[]
  source_count: number
  evidence_count: number
  citations_count: number
  no_secrets_exposed: true
  no_raw_paths: true
  owner_visible_summary: string
}

export type PiResearchQualityReview = {
  schema: 'pi_research_quality_review_v1'
  reviewer: 'pi'
  shadow_mode: true
  packet_id: string
  route_quality: 'pass' | 'review' | 'blocked'
  confidence: EvidenceItem['confidence']
  findings_count: number
  source_count: number
  blockers: string[]
  recommended_next_agent: SpaceAgentResponsibleAgent
  recommendation: 'handoff_to_responsible_agent' | 'request_more_research' | 'blocked'
  execution_enabled: false
  writes_enabled: false
  no_secrets_exposed: true
  owner_visible_summary: string
}

export type HermesResearchWorkflowDraft = {
  schema: 'hermes_research_workflow_draft_v1'
  reviewer: 'hermes'
  mode: 'workflow_design_only'
  packet_id: string
  available: boolean
  title: string
  purpose: string
  inputs: string[]
  proposed_steps: string[]
  blocked_reason: string | null
  requires_agent_zero_review: true
  activation_requires: 'agent_zero_bridge_session'
  execution_enabled: false
  writes_enabled: false
  no_secrets_exposed: true
  owner_visible_summary: string
}

export type AgentZeroResearchDecision = {
  schema: 'agent_zero_research_decision_v1'
  decision_maker: 'agent_zero'
  packet_id: string
  decision: 'handoff_to_responsible_agent' | 'request_more_research' | 'blocked'
  next_agent: SpaceAgentResponsibleAgent
  rationale: string
  owner_response_owner: 'agent_zero'
  execution_enabled: false
  writes_enabled: false
  no_secrets_exposed: true
}

export type ResponsibleAgentResearchHandoff = {
  schema: 'responsible_agent_research_handoff_v1'
  from: 'space_agent'
  through: 'gateway'
  to: SpaceAgentResponsibleAgent
  packet_id: string
  accepted: boolean
  action: 'review_findings' | 'design_workflow' | 'route_review' | 'manual_review'
  requires_more_research: boolean
  execution_enabled: false
  writes_enabled: false
  no_secrets_exposed: true
  owner_visible_summary: string
}

export type SpaceAgentTaskExit = {
  schema: 'space_agent_task_exit_v1'
  agent: 'space_agent'
  packet_id: string
  state: 'exited' | 'awaiting_more_research' | 'blocked'
  reason: string
  can_resume_with_gateway_request: true
  no_secrets_exposed: true
}

export type SpaceAgentHandoffAuditEvent = {
  audit_id: string
  schema: 'space_agent_handoff_audit_event_v1'
  stage: SpaceAgentHandoffStage
  actor: 'gateway' | 'space_agent' | 'pi' | 'hermes' | 'agent_zero' | SpaceAgentResponsibleAgent
  target: 'gateway' | 'space_agent' | 'pi' | 'hermes' | 'agent_zero' | SpaceAgentResponsibleAgent
  status: 'recorded' | 'blocked' | 'needs_more_research'
  blocked_reason: string | null
  recorded_at: string
  no_secrets_exposed: true
  no_raw_paths: true
}

export type SpaceAgentResearchHandoff = {
  handoff_id: string
  schema: 'space_agent_research_handoff_v1'
  mode: 'gateway_space_agent_research_handoff'
  job_id: string
  packet_id: string
  original_request: string
  status: 'handoff_ready' | 'needs_more_research' | 'blocked'
  stages: SpaceAgentHandoffStage[]
  research_task_received: true
  research_performed: boolean
  research_packet_returned: true
  gateway_validation: GatewayResearchPacketValidation
  pi_quality_review: PiResearchQualityReview
  hermes_workflow_draft: HermesResearchWorkflowDraft
  agent_zero_decision: AgentZeroResearchDecision
  responsible_agent_handoff: ResponsibleAgentResearchHandoff
  space_agent_exit: SpaceAgentTaskExit
  audit_log: SpaceAgentHandoffAuditEvent[]
  packet: ResearchPacket
  no_secrets_exposed: true
  no_raw_paths: true
  owner_visible_summary: string
}

export type SpaceResearchMiniAgentTemplate = {
  schema: 'space_research_mini_agent_template_v1'
  created_by: 'hermes'
  template_id: string
  name: 'Space Research Mini-Agent'
  purpose: string
  parent_supervisor: 'agent_zero'
  requested_by: 'space_agent'
  allowed_tools: string[]
  forbidden_tools: string[]
  output_contract: 'sub_research_packet'
  activation_requires: 'agent_zero_approval_and_gateway_policy'
  bridge_session_required_for_execution: true
  execution_enabled: false
  writes_enabled: false
  no_secrets_exposed: true
}

export type SpaceResearchMiniAgentScope = {
  schema: 'space_research_mini_agent_scope_v1'
  allowed_urls: string[]
  allowed_source_ids: string[]
  max_sources: number
  memory_ttl_minutes: number
  browse_outside_scope_allowed: false
  blocked_reason: string | null
}

export type PiMiniAgentFanoutRecommendation = {
  schema: 'pi_mini_agent_fanout_recommendation_v1'
  reviewer: 'pi'
  shadow_mode: true
  recommended: boolean
  recommended_mini_agent_type: 'research'
  fanout_count: number
  source_scope: string[]
  blocked_reason: string | null
  execution_enabled: false
  writes_enabled: false
  no_secrets_exposed: true
  owner_visible_summary: string
}

export type AgentZeroMiniAgentCreationApproval = {
  schema: 'agent_zero_mini_agent_creation_approval_v1'
  approver: 'agent_zero'
  approved_for_creation: boolean
  activation_enabled: false
  blocked_reason: string | null
  rationale: string
  no_secrets_exposed: true
}

export type SpaceResearchMiniAgentScopeDecision = {
  schema: 'space_research_mini_agent_scope_decision_v1'
  requested_url: string | null
  allowed: boolean
  blocked_reason: string | null
  no_secrets_exposed: true
  no_raw_paths: true
}

export type GatewaySubResearchMerge = {
  schema: 'gateway_sub_research_merge_v1'
  parent_packet_id: string
  sub_packet_ids: string[]
  status: 'merged' | 'blocked' | 'needs_more_research'
  source_list: ResearchPacketSourceSummary[]
  findings: string[]
  citations: string[]
  blockers: string[]
  confidence: EvidenceItem['confidence']
  no_secrets_exposed: true
  no_raw_paths: true
  owner_visible_summary: string
}

export type SpaceResearchMiniAgentAuditEvent = {
  event: string
  actor: 'space_agent' | 'hermes' | 'agent_zero' | 'pi' | 'gateway' | 'mini_agent'
  target: string
  summary: string
  recorded_at: string
  external_write: false
  secrets_exposed: false
}

export type SpaceResearchMiniAgentFanoutInput = SpaceAgentResearchPacketInput & {
  assignedUrls?: string[]
  assignedSourceIds?: string[]
  miniAgentName?: string | null
  memoryTtlMinutes?: number | null
  subEvidence?: Array<Partial<EvidenceItem> & { summary: string }>
  outOfScopeUrlToCheck?: string | null
}

export type SpaceResearchMiniAgentFanout = {
  fanout_id: string
  schema: 'space_research_mini_agent_fanout_v1'
  mode: 'space_agent_requested_web_research_mini_agent'
  parent_packet: ResearchPacket
  template: SpaceResearchMiniAgentTemplate
  agent_zero_approval: AgentZeroMiniAgentCreationApproval
  pi_recommendation: PiMiniAgentFanoutRecommendation
  assigned_scope: SpaceResearchMiniAgentScope
  scope_decision: SpaceResearchMiniAgentScopeDecision
  mini_agent_definition_result: MiniAgentDefinitionResult
  mini_agent_definition: MiniAgentDefinition | null
  mini_agent_memory_result: MiniAgentMemoryResult
  mini_agent_memory: MiniAgentMemory | null
  sub_research_packet: ResearchPacket | null
  gateway_merge: GatewaySubResearchMerge
  expired_mini_agent: MiniAgentDefinition | null
  expired_memory: MiniAgentMemory | null
  audit_log: SpaceResearchMiniAgentAuditEvent[]
  mini_agent_expires_after_task: true
  execution_enabled: false
  writes_enabled: false
  no_secrets_exposed: true
  no_raw_paths: true
  owner_visible_summary: string
}

export type SpaceResearchMemoryState = 'temporary' | 'pending_brain_review' | 'promoted_to_brain' | 'rejected' | 'expired' | 'blocked'
export type SpaceResearchMemoryTtlMode = 'short_task' | 'default_task' | 'project_research'

export type SpaceResearchMemoryAuditEvent = {
  event: string
  actor: 'space_agent' | 'gateway' | 'agent_zero' | 'hermes' | 'owner'
  target: string
  summary: string
  recorded_at: string
  external_write: false
  secrets_exposed: false
}

export type SpaceResearchMemory = {
  memory_id: string
  schema: 'space_research_memory_v1'
  state: SpaceResearchMemoryState
  source_url: string | null
  source_id: string | null
  evidence_summary: string
  facts: string[]
  assumptions: string[]
  blockers: string[]
  created_at: string
  expires_at: string
  ttl_minutes: number
  ttl_mode: SpaceResearchMemoryTtlMode
  project_extension_requested: boolean
  project_extension_owner_approved: boolean
  contains_secrets: false
  raw_cookies_session_tokens_stored: false
  promotion_to_brain: {
    requested: boolean
    reviewed: boolean
    approved: boolean
    reviewer: 'agent_zero' | 'owner' | null
    promoted_to: 'brain_review_queue' | null
    blocked_reason: string | null
  }
  audit_trail: SpaceResearchMemoryAuditEvent[]
  no_secrets_exposed: true
  no_raw_paths: true
  blocked_reason: string | null
  owner_visible_summary: string
}

export type SpaceResearchMemoryInput = {
  source_url?: string | null
  source_id?: string | null
  evidence_summary: string
  facts?: string[]
  assumptions?: string[]
  blockers?: string[]
  ttl_mode?: SpaceResearchMemoryTtlMode | null
  ttl_minutes?: number | null
  project_extension_owner_approved?: boolean | null
  created_at?: string | null
}

export type SpaceResearchMemoryResult = {
  ok: boolean
  mode: 'space_research_memory_dry_run'
  memory: SpaceResearchMemory | null
  policy_result: 'allowed' | 'blocked' | 'requires_review'
  blocked_reason: string | null
  execution_enabled: false
  writes_enabled: false
  secrets_exposed: false
  owner_visible_summary: string
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
const BLOCKED_RESEARCH_URL_PATTERN = /\bhttps?:\/\/(?:localhost|(?:[^/\s]+\.)?localhost|[^/\s]+\.local|0(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?::\d+)?[^\s`'"\])}]*/gi
const RAW_COOKIE_SESSION_PATTERN = /\b(?:cookie|cookies|session[_\s-]?token|sessionid|csrf|xsrf|jwt|refresh[_\s-]?token|access[_\s-]?token)\b\s*[:=]\s*[^,\s}]+/i
const SPACE_RESEARCH_DEFAULT_TTL_MINUTES = 1440
const SPACE_RESEARCH_SHORT_TTL_MINUTES = 30
const SPACE_RESEARCH_PROJECT_TTL_MINUTES = 10080

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

export function createSpaceAgentResearchHandoff(input: SpaceAgentResearchPacketInput): SpaceAgentResearchHandoff {
  const packet = createSpaceAgentResearchPacket(input)
  const generatedAt = input.generatedAt || DEFAULT_GENERATED_AT
  const gatewayValidation = validateResearchPacketForGateway(packet)
  const piQualityReview = reviewResearchPacketWithPi(packet, gatewayValidation)
  const hermesWorkflowDraft = draftHermesWorkflowFromResearch(packet, gatewayValidation)
  const agentZeroDecision = decideResearchNextAction(packet, gatewayValidation, piQualityReview)
  const responsibleAgentHandoff = createResponsibleAgentResearchHandoff(packet, agentZeroDecision)
  const spaceAgentExit = createSpaceAgentTaskExit(packet, agentZeroDecision)
  const status = agentZeroDecision.decision === 'blocked'
    ? 'blocked'
    : agentZeroDecision.decision === 'request_more_research'
      ? 'needs_more_research'
      : 'handoff_ready'
  const stages: SpaceAgentHandoffStage[] = [
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
  ]
  const auditLog = createSpaceAgentHandoffAuditLog({ packet, stages, status, generatedAt })

  return {
    handoff_id: normalizeId(`space_agent_handoff_${packet.packet_id}`),
    schema: 'space_agent_research_handoff_v1',
    mode: 'gateway_space_agent_research_handoff',
    job_id: packet.job_id,
    packet_id: packet.packet_id,
    original_request: packet.original_request,
    status,
    stages,
    research_task_received: true,
    research_performed: packet.research_needed,
    research_packet_returned: true,
    gateway_validation: gatewayValidation,
    pi_quality_review: piQualityReview,
    hermes_workflow_draft: hermesWorkflowDraft,
    agent_zero_decision: agentZeroDecision,
    responsible_agent_handoff: responsibleAgentHandoff,
    space_agent_exit: spaceAgentExit,
    audit_log: auditLog,
    packet,
    no_secrets_exposed: true,
    no_raw_paths: true,
    owner_visible_summary: status === 'blocked'
      ? `Gateway blocked the Space Agent handoff: ${agentZeroDecision.rationale}.`
      : status === 'needs_more_research'
        ? 'Gateway recorded the Space Agent packet and Agent Zero requested more research before handoff.'
      : `Gateway handed Space Agent research back to ${packet.responsible_agent}; Agent Zero remains the decision owner.`,
  }
}

export function createSpaceResearchMiniAgentFanout(input: SpaceResearchMiniAgentFanoutInput): SpaceResearchMiniAgentFanout {
  const generatedAt = input.generatedAt || DEFAULT_GENERATED_AT
  const parentPacket = createSpaceAgentResearchPacket(input)
  const assignedScope = createSpaceResearchMiniAgentScope(parentPacket, input)
  const template = createSpaceResearchMiniAgentTemplate(generatedAt)
  const piRecommendation = createPiMiniAgentFanoutRecommendation(parentPacket, assignedScope)
  const agentZeroApproval = createAgentZeroMiniAgentCreationApproval(parentPacket, assignedScope, piRecommendation)
  const miniAgentName = sanitize(input.miniAgentName || 'Space Research Mini-Agent')
  const miniAgentDefinitionResult = createMiniAgentDefinition({
    id: normalizeId(`space_research_${parentPacket.packet_id}`),
    name: miniAgentName,
    purpose: 'Read assigned public sources and return a sub-ResearchPacket to Space Agent through Gateway.',
    parent_supervisor: 'agent_zero',
    scope: assignedScope.allowed_urls.length
      ? assignedScope.allowed_urls.map((url) => `assigned_url:${url}`)
      : assignedScope.allowed_source_ids.map((sourceId) => `assigned_source:${sourceId}`),
    allowed_tools: ['gateway.source_scope.read', 'space_agent.research_packet.compose'],
    forbidden_tools: ['browse_outside_assigned_scope', 'external_write', 'direct_secret_read', 'raw_root_shell', 'docker_socket'],
    allowed_skills: ['space_agent.web_research_packet'],
    forbidden_skills: ['zapier_write', 'heygen_generation', 'smb_mount', 'opencloud_delete'],
    allowed_models: ['gateway_assigned_model_only'],
    memory_ttl_minutes: assignedScope.memory_ttl_minutes,
    output_contract: 'Return sub-ResearchPacket only; do not contact owner directly.',
    kill_condition: 'Expire immediately after sub-ResearchPacket handoff or when TTL ends.',
    created_at: generatedAt,
  })
  const miniAgentDefinition = miniAgentDefinitionResult.definition
  const miniAgentMemoryResult = miniAgentDefinition
    ? createMiniAgentMemory({
      mini_agent_id: miniAgentDefinition.id,
      parent_task: parentPacket.job_id,
      parent_supervisor: 'agent_zero',
      source: 'gateway_scoped_space_research_context',
      facts: assignedScope.allowed_urls.map((url) => `Assigned URL: ${url}`),
      assumptions: ['Mini-agent may only inspect assigned sources.'],
      unknowns: parentPacket.blockers,
      blocked_items: assignedScope.blocked_reason ? [assignedScope.blocked_reason] : [],
      ttl_minutes: assignedScope.memory_ttl_minutes,
      created_at: generatedAt,
      provenance: {
        source_type: 'gateway_context',
        source_id: parentPacket.packet_id,
        source_verified_at: generatedAt,
        created_by: 'space_agent',
        parent_task: parentPacket.job_id,
        parent_supervisor: 'agent_zero',
        confidence: parentPacket.confidence,
      },
    })
    : blockedMiniAgentMemoryResult('mini_agent_definition_missing')
  const miniAgentMemory = miniAgentMemoryResult.memory
  const scopeDecision = evaluateSpaceResearchMiniAgentScope(assignedScope, input.outOfScopeUrlToCheck || assignedScope.allowed_urls[0] || null)
  const subResearchPacket = agentZeroApproval.approved_for_creation && miniAgentDefinition && scopeDecision.allowed
    ? createSubResearchPacketForMiniAgent(parentPacket, input, assignedScope)
    : null
  const gatewayMerge = mergeSpaceAgentSubResearchPackets(parentPacket, subResearchPacket ? [subResearchPacket] : [])
  const expiredMiniAgent = miniAgentDefinition ? expireSpaceResearchMiniAgent(miniAgentDefinition, generatedAt) : null
  const expiredMemory = miniAgentMemory ? expireMiniAgentMemory(miniAgentMemory, addMinutes(miniAgentMemory.expires_at, 1)) : null
  const auditLog = createSpaceResearchMiniAgentAuditLog({
    generatedAt,
    parentPacket,
    miniAgentId: miniAgentDefinition?.id || 'mini_agent_blocked',
    blockedReason: agentZeroApproval.blocked_reason || assignedScope.blocked_reason || scopeDecision.blocked_reason,
  })

  return {
    fanout_id: normalizeId(`space_research_mini_agent_fanout_${parentPacket.packet_id}`),
    schema: 'space_research_mini_agent_fanout_v1',
    mode: 'space_agent_requested_web_research_mini_agent',
    parent_packet: parentPacket,
    template,
    agent_zero_approval: agentZeroApproval,
    pi_recommendation: piRecommendation,
    assigned_scope: assignedScope,
    scope_decision: scopeDecision,
    mini_agent_definition_result: miniAgentDefinitionResult,
    mini_agent_definition: miniAgentDefinition,
    mini_agent_memory_result: miniAgentMemoryResult,
    mini_agent_memory: miniAgentMemory,
    sub_research_packet: subResearchPacket,
    gateway_merge: gatewayMerge,
    expired_mini_agent: expiredMiniAgent,
    expired_memory: expiredMemory,
    audit_log: auditLog,
    mini_agent_expires_after_task: true,
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
    no_raw_paths: true,
    owner_visible_summary: agentZeroApproval.approved_for_creation
      ? 'Space Agent requested a scoped web-research mini-agent; Gateway merged the sub-ResearchPacket and expired the mini-agent after task.'
      : `Space Agent mini-agent fan-out is blocked: ${agentZeroApproval.blocked_reason || assignedScope.blocked_reason || scopeDecision.blocked_reason}.`,
  }
}

export function createSpaceResearchMemory(input: SpaceResearchMemoryInput): SpaceResearchMemoryResult {
  const createdAt = input.created_at || DEFAULT_GENERATED_AT
  const rawMemoryText = [
    input.source_url || '',
    input.source_id || '',
    input.evidence_summary || '',
    ...(input.facts || []),
    ...(input.assumptions || []),
    ...(input.blockers || []),
  ].join(' ')
  const forbiddenMemory = getSpaceResearchMemoryBlocker(rawMemoryText)
  if (forbiddenMemory) return blockedSpaceResearchMemory(forbiddenMemory)

  const ttl = resolveSpaceResearchMemoryTtl(input)
  const sourceUrl = input.source_url ? sanitize(input.source_url) : null
  const evidenceSummary = sanitize(input.evidence_summary)
  if (!evidenceSummary) return blockedSpaceResearchMemory('space_research_memory_evidence_summary_required')

  const projectExtensionRequested = input.ttl_mode === 'project_research' || Number(input.ttl_minutes || 0) > SPACE_RESEARCH_DEFAULT_TTL_MINUTES
  const projectExtensionApproved = Boolean(input.project_extension_owner_approved)
  const projectExtensionBlocker = projectExtensionRequested && !projectExtensionApproved ? 'project_research_ttl_extension_requires_owner_approval' : null

  const memory: SpaceResearchMemory = {
    memory_id: normalizeId(`space_research_memory_${sourceUrl || input.source_id || createdAt}`),
    schema: 'space_research_memory_v1',
    state: 'temporary',
    source_url: sourceUrl,
    source_id: input.source_id ? normalizeId(input.source_id) : null,
    evidence_summary: evidenceSummary,
    facts: (input.facts || []).map(sanitize).filter(Boolean),
    assumptions: (input.assumptions || []).map(sanitize).filter(Boolean),
    blockers: dedupeStrings([...(input.blockers || []).map(sanitize), projectExtensionBlocker].filter((value): value is string => Boolean(value))),
    created_at: createdAt,
    expires_at: addMinutes(createdAt, ttl),
    ttl_minutes: ttl,
    ttl_mode: input.ttl_mode || (ttl === SPACE_RESEARCH_SHORT_TTL_MINUTES ? 'short_task' : projectExtensionRequested ? 'project_research' : 'default_task'),
    project_extension_requested: projectExtensionRequested,
    project_extension_owner_approved: projectExtensionApproved,
    contains_secrets: false,
    raw_cookies_session_tokens_stored: false,
    promotion_to_brain: {
      requested: false,
      reviewed: false,
      approved: false,
      reviewer: null,
      promoted_to: null,
      blocked_reason: 'brain_promotion_requires_agent_zero_or_owner_review',
    },
    audit_trail: [
      spaceResearchMemoryAuditEvent('space_research.memory.created', 'space_agent', 'gateway', 'Temporary Space Research memory created with evidence summary and separated facts/assumptions.', createdAt),
    ],
    no_secrets_exposed: true,
    no_raw_paths: true,
    blocked_reason: projectExtensionBlocker,
    owner_visible_summary: projectExtensionBlocker
      ? 'Space Research memory was created with default-safe handling, but project TTL extension is pending owner approval.'
      : 'Space Research memory was created as temporary task-scoped memory.',
  }

  return {
    ok: true,
    mode: 'space_research_memory_dry_run',
    memory,
    policy_result: projectExtensionBlocker ? 'requires_review' : 'allowed',
    blocked_reason: projectExtensionBlocker,
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
    owner_visible_summary: memory.owner_visible_summary,
  }
}

export function requestSpaceResearchMemoryBrainPromotion(
  memory: SpaceResearchMemory,
  requester: 'space_agent' | 'hermes' | 'agent_zero' = 'space_agent',
): SpaceResearchMemoryResult {
  if (memory.state !== 'temporary') return blockedSpaceResearchMemory('brain_promotion_requires_temporary_space_research_memory')
  const updated: SpaceResearchMemory = {
    ...memory,
    state: 'pending_brain_review',
    promotion_to_brain: {
      ...memory.promotion_to_brain,
      requested: true,
      blocked_reason: 'brain_promotion_pending_agent_zero_or_owner_review',
    },
    audit_trail: [
      ...memory.audit_trail,
      spaceResearchMemoryAuditEvent('space_research.memory.brain_promotion_requested', requester, memory.memory_id, 'Brain promotion requested; no Brain write occurred.', memory.created_at),
    ],
  }
  return {
    ok: true,
    mode: 'space_research_memory_dry_run',
    memory: updated,
    policy_result: 'requires_review',
    blocked_reason: null,
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
    owner_visible_summary: 'Space Research memory promotion is pending review; no Brain write occurred.',
  }
}

export function reviewSpaceResearchMemoryBrainPromotion(
  memory: SpaceResearchMemory,
  input: { approved: boolean; reviewer: 'agent_zero' | 'owner'; reason: string; reviewed_at?: string | null },
): SpaceResearchMemoryResult {
  if (memory.state !== 'pending_brain_review') return blockedSpaceResearchMemory('brain_promotion_review_requires_pending_review_state')
  const reviewedAt = input.reviewed_at || memory.created_at
  const updated: SpaceResearchMemory = {
    ...memory,
    state: input.approved ? 'promoted_to_brain' : 'rejected',
    promotion_to_brain: {
      requested: true,
      reviewed: true,
      approved: input.approved,
      reviewer: input.reviewer,
      promoted_to: input.approved ? 'brain_review_queue' : null,
      blocked_reason: input.approved ? null : 'brain_promotion_rejected',
    },
    audit_trail: [
      ...memory.audit_trail,
      spaceResearchMemoryAuditEvent(input.approved ? 'space_research.memory.promoted_to_brain_review_queue' : 'space_research.memory.brain_promotion_rejected', input.reviewer, memory.memory_id, sanitize(input.reason) || 'Brain promotion review completed.', reviewedAt),
    ],
    owner_visible_summary: input.approved
      ? 'Space Research memory was approved for Brain review queue with provenance.'
      : 'Space Research memory promotion was rejected; no Brain write occurred.',
  }
  return {
    ok: true,
    mode: 'space_research_memory_dry_run',
    memory: updated,
    policy_result: input.approved ? 'allowed' : 'blocked',
    blocked_reason: input.approved ? null : 'brain_promotion_rejected',
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
    owner_visible_summary: updated.owner_visible_summary,
  }
}

export function expireSpaceResearchMemory(memory: SpaceResearchMemory, now: string): SpaceResearchMemory {
  if (new Date(now).getTime() < new Date(memory.expires_at).getTime()) {
    return { ...memory, audit_trail: [...memory.audit_trail] }
  }
  return {
    ...memory,
    state: 'expired',
    audit_trail: [
      ...memory.audit_trail,
      spaceResearchMemoryAuditEvent('space_research.memory.expired', 'gateway', memory.memory_id, 'Temporary Space Research memory expired automatically by TTL.', now),
    ],
    owner_visible_summary: 'Space Research memory expired automatically by TTL.',
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
  if (/read (?:a |the |this )?(?:website|webpage|web page|page|article)|website reading|page reading|webpage reading|article|webpage|web page|product page|pricing page|page details|url/.test(text)) return 'page_read'
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
  return (value || []).map((item, index) => {
    const urlSafety = classifyResearchUrl(item.url || null)
    const blockedReason = item.blocked_reason ? sanitize(item.blocked_reason) : urlSafety.blocked_reason
    return {
      source_id: normalizeId(item.source_id || `web_source_${index + 1}`),
      schema: 'web_source_v1',
      type: 'web_source',
      url: urlSafety.url,
      title: item.title ? sanitize(item.title) : null,
      domain: item.domain ? sanitize(item.domain) : domainFromUrl(urlSafety.url),
      access: blockedReason ? 'blocked' : item.access || 'unknown',
      status: blockedReason ? 'blocked' : item.status || 'candidate',
      last_checked: item.last_checked || generatedAt || null,
      blocked_reason: blockedReason,
    }
  })
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

function createSpaceResearchMiniAgentTemplate(generatedAt: string): SpaceResearchMiniAgentTemplate {
  return {
    schema: 'space_research_mini_agent_template_v1',
    created_by: 'hermes',
    template_id: normalizeId(`space_research_mini_agent_template_${generatedAt}`),
    name: 'Space Research Mini-Agent',
    purpose: 'Perform scoped read-only web research for Space Agent and return a sub-ResearchPacket.',
    parent_supervisor: 'agent_zero',
    requested_by: 'space_agent',
    allowed_tools: ['gateway.source_scope.read', 'space_agent.research_packet.compose'],
    forbidden_tools: ['browse_outside_assigned_scope', 'external_write', 'direct_secret_read', 'raw_root_shell', 'docker_socket'],
    output_contract: 'sub_research_packet',
    activation_requires: 'agent_zero_approval_and_gateway_policy',
    bridge_session_required_for_execution: true,
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
  }
}

function createSpaceResearchMiniAgentScope(parentPacket: ResearchPacket, input: SpaceResearchMiniAgentFanoutInput): SpaceResearchMiniAgentScope {
  const urls = dedupeStrings([
    ...(input.assignedUrls || []).map(sanitize),
    ...(input.webSources || []).map((source) => source.url ? sanitize(source.url) : null).filter((value): value is string => Boolean(value)),
    ...parentPacket.citations.filter((url) => /^https?:\/\//i.test(url)),
    ...extractUrls(input.request),
  ]).filter(Boolean)
  const sourceIds = dedupeStrings([
    ...(input.assignedSourceIds || []).map(sanitize),
    ...parentPacket.source_list.map((source) => source.source_id),
  ]).filter(Boolean)
  const memoryTtl = normalizeMiniAgentMemoryTtl(input.memoryTtlMinutes)
  const blockedReason = urls.length === 0 && sourceIds.length === 0 ? 'mini_agent_source_scope_required' : null

  return {
    schema: 'space_research_mini_agent_scope_v1',
    allowed_urls: urls,
    allowed_source_ids: sourceIds,
    max_sources: Math.max(1, urls.length || sourceIds.length),
    memory_ttl_minutes: memoryTtl,
    browse_outside_scope_allowed: false,
    blocked_reason: blockedReason,
  }
}

function createPiMiniAgentFanoutRecommendation(parentPacket: ResearchPacket, scope: SpaceResearchMiniAgentScope): PiMiniAgentFanoutRecommendation {
  const recommended = !parentPacket.blocked_reason && !scope.blocked_reason && parentPacket.research_needed
  return {
    schema: 'pi_mini_agent_fanout_recommendation_v1',
    reviewer: 'pi',
    shadow_mode: true,
    recommended,
    recommended_mini_agent_type: 'research',
    fanout_count: recommended ? Math.max(1, Math.min(scope.max_sources, 5)) : 0,
    source_scope: scope.allowed_urls.length ? scope.allowed_urls : scope.allowed_source_ids,
    blocked_reason: recommended ? null : scope.blocked_reason || parentPacket.blocked_reason || 'research_not_needed',
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
    owner_visible_summary: recommended
      ? 'Pi recommends scoped research mini-agent fan-out in shadow mode.'
      : 'Pi does not recommend mini-agent fan-out until scope and research need are valid.',
  }
}

function createAgentZeroMiniAgentCreationApproval(
  parentPacket: ResearchPacket,
  scope: SpaceResearchMiniAgentScope,
  piRecommendation: PiMiniAgentFanoutRecommendation,
): AgentZeroMiniAgentCreationApproval {
  const approved = piRecommendation.recommended && !scope.blocked_reason && parentPacket.status !== 'blocked'
  const blocker = approved ? null : scope.blocked_reason || piRecommendation.blocked_reason || parentPacket.blocked_reason || 'agent_zero_mini_agent_creation_not_approved'
  return {
    schema: 'agent_zero_mini_agent_creation_approval_v1',
    approver: 'agent_zero',
    approved_for_creation: approved,
    activation_enabled: false,
    blocked_reason: blocker,
    rationale: approved
      ? 'Agent Zero approves creation of a scoped read-only Space Research mini-agent definition; runtime activation remains disabled pending Gateway policy and Bridge Session rules.'
      : `Agent Zero blocks Space Research mini-agent creation: ${blocker}.`,
    no_secrets_exposed: true,
  }
}

export function evaluateSpaceResearchMiniAgentScope(scope: SpaceResearchMiniAgentScope, requestedUrl: string | null): SpaceResearchMiniAgentScopeDecision {
  const requested = requestedUrl ? sanitize(requestedUrl) : null
  const allowed = !requested
    ? !scope.blocked_reason
    : scope.allowed_urls.some((url) => normalizeUrlForScope(url) === normalizeUrlForScope(requested))
  return {
    schema: 'space_research_mini_agent_scope_decision_v1',
    requested_url: requested,
    allowed,
    blocked_reason: allowed ? null : 'mini_agent_browse_outside_assigned_scope_blocked',
    no_secrets_exposed: true,
    no_raw_paths: true,
  }
}

function createSubResearchPacketForMiniAgent(
  parentPacket: ResearchPacket,
  input: SpaceResearchMiniAgentFanoutInput,
  scope: SpaceResearchMiniAgentScope,
): ResearchPacket {
  const scopedWebSources = (input.webSources || [])
    .filter((source) => !source.url || scope.allowed_urls.some((url) => normalizeUrlForScope(url) === normalizeUrlForScope(source.url || '')))
  const evidence = input.subEvidence || input.evidence || parentPacket.evidence.map((item) => ({
    summary: item.summary,
    quote: item.quote,
    source_id: item.source_id,
    source_type: item.source_type,
    url: item.url,
    confidence: item.confidence,
  }))
  return createSpaceAgentResearchPacket({
    request: `Mini-agent scoped research for: ${parentPacket.original_request}`,
    requestedBy: 'gateway',
    responsibleAgent: parentPacket.responsible_agent,
    generatedAt: input.generatedAt,
    firecrawlConfigured: input.firecrawlConfigured,
    evidence,
    webSources: scopedWebSources.length > 0 ? scopedWebSources : scope.allowed_urls.map((url, index) => ({
      source_id: `mini_agent_source_${index + 1}`,
      url,
      status: 'checked' as const,
      access: 'public' as const,
    })),
    youtubeSources: input.youtubeSources,
    browserActions: [],
  })
}

export function mergeSpaceAgentSubResearchPackets(parentPacket: ResearchPacket, subPackets: ResearchPacket[]): GatewaySubResearchMerge {
  const blockers = dedupeStrings([...parentPacket.blockers, ...subPackets.flatMap((packet) => packet.blockers)])
  const findings = dedupeStrings([...parentPacket.findings, ...subPackets.flatMap((packet) => packet.findings)])
  const citations = dedupeStrings([...parentPacket.citations, ...subPackets.flatMap((packet) => packet.citations)])
  const sourceList = [...parentPacket.source_list, ...subPackets.flatMap((packet) => packet.source_list)]
  const status: GatewaySubResearchMerge['status'] = blockers.length > 0
    ? 'blocked'
    : subPackets.length === 0
      ? 'needs_more_research'
      : 'merged'

  return {
    schema: 'gateway_sub_research_merge_v1',
    parent_packet_id: parentPacket.packet_id,
    sub_packet_ids: subPackets.map((packet) => packet.packet_id),
    status,
    source_list: sourceList,
    findings,
    citations,
    blockers,
    confidence: deriveResearchConfidence([...parentPacket.evidence, ...subPackets.flatMap((packet) => packet.evidence)], blockers),
    no_secrets_exposed: true,
    no_raw_paths: true,
    owner_visible_summary: status === 'merged'
      ? `Gateway merged ${subPackets.length} sub-ResearchPacket${subPackets.length === 1 ? '' : 's'} into the parent packet.`
      : status === 'needs_more_research'
        ? 'Gateway needs sub-ResearchPacket results before merge can complete.'
        : `Gateway merge is blocked: ${blockers[0]}.`,
  }
}

function expireSpaceResearchMiniAgent(definition: MiniAgentDefinition, expiredAt: string): MiniAgentDefinition {
  return {
    ...definition,
    lifecycle: 'expired',
    audit_trail: [
      ...definition.audit_trail,
      {
        event: 'gateway.mini_agent.expired_after_space_research_task',
        actor: 'gateway',
        target: definition.id,
        summary: 'Space Research mini-agent expired after scoped task handoff.',
        recorded_at: expiredAt,
        external_write: false,
        secrets_exposed: false,
      },
    ],
  }
}

function blockedMiniAgentMemoryResult(blockedReason: string): MiniAgentMemoryResult {
  return {
    ok: false,
    mode: 'mini_agent_memory_dry_run',
    memory: null,
    policy_result: 'blocked',
    blocked_reason: blockedReason,
    owner_visible_summary: `Mini-agent memory action is blocked: ${blockedReason}.`,
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
  }
}

function createSpaceResearchMiniAgentAuditLog(input: {
  generatedAt: string
  parentPacket: ResearchPacket
  miniAgentId: string
  blockedReason: string | null
}): SpaceResearchMiniAgentAuditEvent[] {
  const status = input.blockedReason ? `Blocked: ${input.blockedReason}.` : 'Recorded.'
  return [
    miniAgentAuditEvent('space_agent.mini_agent.requested', 'space_agent', 'gateway', `Space Agent requested scoped mini-agent fan-out. ${status}`, input.generatedAt),
    miniAgentAuditEvent('hermes.space_research_template.created', 'hermes', 'gateway', 'Hermes provided Space Research mini-agent template.', input.generatedAt),
    miniAgentAuditEvent('pi.mini_agent_fanout.recommended', 'pi', 'gateway', 'Pi reviewed mini-agent fan-out in shadow mode.', input.generatedAt),
    miniAgentAuditEvent('agent_zero.mini_agent_creation.reviewed', 'agent_zero', input.miniAgentId, 'Agent Zero reviewed mini-agent creation authority.', input.generatedAt),
    miniAgentAuditEvent('gateway.mini_agent.scope.assigned', 'gateway', input.miniAgentId, 'Gateway assigned limited URL/source scope and memory TTL.', input.generatedAt),
    miniAgentAuditEvent('mini_agent.sub_research_packet.returned', 'mini_agent', 'gateway', 'Mini-agent returned sub-ResearchPacket without external writes.', input.generatedAt),
    miniAgentAuditEvent('gateway.sub_research_packet.merged', 'gateway', input.parentPacket.packet_id, 'Gateway merged sub-results into parent ResearchPacket.', input.generatedAt),
    miniAgentAuditEvent('gateway.mini_agent.expired', 'gateway', input.miniAgentId, 'Gateway expired mini-agent after task.', input.generatedAt),
  ]
}

function miniAgentAuditEvent(
  event: string,
  actor: SpaceResearchMiniAgentAuditEvent['actor'],
  target: string,
  summary: string,
  recordedAt: string,
): SpaceResearchMiniAgentAuditEvent {
  return {
    event,
    actor,
    target: sanitize(target),
    summary: sanitize(summary),
    recorded_at: recordedAt,
    external_write: false,
    secrets_exposed: false,
  }
}

function resolveSpaceResearchMemoryTtl(input: SpaceResearchMemoryInput): number {
  if (input.ttl_mode === 'short_task') return SPACE_RESEARCH_SHORT_TTL_MINUTES
  const requested = Number(input.ttl_minutes || 0)
  if (input.ttl_mode === 'project_research' || requested > SPACE_RESEARCH_DEFAULT_TTL_MINUTES) {
    return input.project_extension_owner_approved
      ? Math.max(SPACE_RESEARCH_DEFAULT_TTL_MINUTES, Math.min(SPACE_RESEARCH_PROJECT_TTL_MINUTES, Math.floor(requested || SPACE_RESEARCH_PROJECT_TTL_MINUTES)))
      : SPACE_RESEARCH_DEFAULT_TTL_MINUTES
  }
  if (Number.isFinite(requested) && requested > 0) {
    return Math.max(SPACE_RESEARCH_SHORT_TTL_MINUTES, Math.min(SPACE_RESEARCH_DEFAULT_TTL_MINUTES, Math.floor(requested)))
  }
  return SPACE_RESEARCH_DEFAULT_TTL_MINUTES
}

function getSpaceResearchMemoryBlocker(value: string): string | null {
  if (RAW_COOKIE_SESSION_PATTERN.test(value)) return 'space_research_memory_raw_cookie_or_session_token_forbidden'
  SECRETISH_PATTERN.lastIndex = 0
  if (SECRETISH_PATTERN.test(value)) return 'space_research_memory_secret_storage_forbidden'
  return null
}

function blockedSpaceResearchMemory(blockedReason: string): SpaceResearchMemoryResult {
  return {
    ok: false,
    mode: 'space_research_memory_dry_run',
    memory: null,
    policy_result: 'blocked',
    blocked_reason: blockedReason,
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
    owner_visible_summary: `Space Research memory action is blocked: ${blockedReason}.`,
  }
}

function spaceResearchMemoryAuditEvent(
  event: string,
  actor: SpaceResearchMemoryAuditEvent['actor'],
  target: string,
  summary: string,
  recordedAt: string,
): SpaceResearchMemoryAuditEvent {
  return {
    event,
    actor,
    target: sanitize(target),
    summary: sanitize(summary),
    recorded_at: recordedAt,
    external_write: false,
    secrets_exposed: false,
  }
}

function validateResearchPacketForGateway(packet: ResearchPacket): GatewayResearchPacketValidation {
  const missingFields = requiredResearchPacketFields().filter((field) => isMissingResearchPacketField(packet, field))
  const unsafeOutput = packetContainsUnsafeOutput(packet)
  const hardBlockers = [
    ...missingFields.map((field) => `missing_${field}`),
    unsafeOutput ? 'research_packet_contains_unsafe_output' : null,
  ].filter((value): value is string => Boolean(value))
  const blockers = dedupeStrings([...packet.blockers, ...hardBlockers])
  const needsMoreResearch = packet.research_needed && packet.status !== 'blocked' && packet.evidence.length === 0 && packet.source_list.length === 0 && packet.citations.length === 0
  const hardBlocked = packet.status === 'blocked' || hardBlockers.length > 0
  const decision: GatewayResearchPacketValidation['decision'] = hardBlocked
    ? 'blocked'
    : needsMoreResearch
      ? 'needs_more_research'
      : 'accepted'

  return {
    schema: 'gateway_research_packet_validation_v1',
    validator: 'gateway',
    packet_id: packet.packet_id,
    job_id: packet.job_id,
    valid: !hardBlocked,
    decision,
    missing_fields: missingFields,
    blockers,
    source_count: packet.source_list.length,
    evidence_count: packet.evidence.length,
    citations_count: packet.citations.length,
    no_secrets_exposed: true,
    no_raw_paths: true,
    owner_visible_summary: decision === 'blocked'
      ? `Gateway validation blocked the ResearchPacket: ${blockers[0] || 'unknown_blocker'}.`
      : decision === 'needs_more_research'
        ? 'Gateway validation accepted the packet schema but needs more research evidence before handoff.'
        : 'Gateway validation accepted the ResearchPacket for handoff.',
  }
}

function reviewResearchPacketWithPi(packet: ResearchPacket, validation: GatewayResearchPacketValidation): PiResearchQualityReview {
  const routeQuality: PiResearchQualityReview['route_quality'] = validation.decision === 'blocked'
    ? 'blocked'
    : validation.decision === 'needs_more_research' || packet.confidence === 'low'
      ? 'review'
      : 'pass'
  const recommendation: PiResearchQualityReview['recommendation'] = routeQuality === 'blocked'
    ? 'blocked'
    : routeQuality === 'review'
      ? 'request_more_research'
      : 'handoff_to_responsible_agent'

  return {
    schema: 'pi_research_quality_review_v1',
    reviewer: 'pi',
    shadow_mode: true,
    packet_id: packet.packet_id,
    route_quality: routeQuality,
    confidence: packet.confidence,
    findings_count: packet.findings.length,
    source_count: packet.source_list.length,
    blockers: validation.blockers,
    recommended_next_agent: packet.recommended_next_agent,
    recommendation,
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
    owner_visible_summary: recommendation === 'blocked'
      ? 'Pi recommends blocking this research handoff until Gateway blockers are resolved.'
      : recommendation === 'request_more_research'
        ? 'Pi recommends more research before the responsible agent acts.'
        : `Pi recommends handing this packet to ${packet.recommended_next_agent}.`,
  }
}

function draftHermesWorkflowFromResearch(packet: ResearchPacket, validation: GatewayResearchPacketValidation): HermesResearchWorkflowDraft {
  const available = validation.decision !== 'blocked' && packet.findings.length > 0
  const title = packet.research_operation === 'research_not_needed'
    ? 'Research Not Needed Handoff'
    : `Turn ${packet.research_operation} findings into an Agent Zero workflow`

  return {
    schema: 'hermes_research_workflow_draft_v1',
    reviewer: 'hermes',
    mode: 'workflow_design_only',
    packet_id: packet.packet_id,
    available,
    title,
    purpose: available
      ? 'Convert Space Agent evidence into a safe skill, workflow, or next-agent plan for Agent Zero review.'
      : 'No workflow draft is available until Space Agent returns usable findings.',
    inputs: ['ResearchPacket', 'Gateway validation result', 'Pi route-quality review'],
    proposed_steps: available
      ? [
        'Review evidence snippets and citations.',
        'Separate confirmed findings from blockers and assumptions.',
        'Draft a workflow or skill proposal for Agent Zero.',
        'Keep activation blocked until Agent Zero review and Bridge Session approval.',
      ]
      : [],
    blocked_reason: available ? null : validation.decision === 'blocked' ? 'gateway_validation_blocked_packet' : 'research_findings_missing',
    requires_agent_zero_review: true,
    activation_requires: 'agent_zero_bridge_session',
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
    owner_visible_summary: available
      ? 'Hermes can turn the Space Agent findings into a workflow proposal only.'
      : 'Hermes cannot draft a workflow until research findings are available.',
  }
}

function decideResearchNextAction(packet: ResearchPacket, validation: GatewayResearchPacketValidation, piReview: PiResearchQualityReview): AgentZeroResearchDecision {
  const decision: AgentZeroResearchDecision['decision'] = validation.decision === 'blocked' || piReview.recommendation === 'blocked'
    ? 'blocked'
    : validation.decision === 'needs_more_research' || piReview.recommendation === 'request_more_research'
      ? 'request_more_research'
      : 'handoff_to_responsible_agent'
  return {
    schema: 'agent_zero_research_decision_v1',
    decision_maker: 'agent_zero',
    packet_id: packet.packet_id,
    decision,
    next_agent: packet.recommended_next_agent,
    rationale: decision === 'blocked'
      ? validation.blockers[0] || 'gateway_or_pi_blocked_research_handoff'
      : decision === 'request_more_research'
        ? 'Research packet is structurally safe but needs stronger evidence before downstream action.'
        : `Research is ready; Agent Zero hands it to ${packet.recommended_next_agent} through Gateway.`,
    owner_response_owner: 'agent_zero',
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
  }
}

function createResponsibleAgentResearchHandoff(packet: ResearchPacket, decision: AgentZeroResearchDecision): ResponsibleAgentResearchHandoff {
  const accepted = decision.decision === 'handoff_to_responsible_agent'
  return {
    schema: 'responsible_agent_research_handoff_v1',
    from: 'space_agent',
    through: 'gateway',
    to: decision.next_agent,
    packet_id: packet.packet_id,
    accepted,
    action: actionForResponsibleAgent(decision.next_agent),
    requires_more_research: decision.decision === 'request_more_research',
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
    owner_visible_summary: accepted
      ? `Responsible agent ${decision.next_agent} received the ResearchPacket through Gateway.`
      : decision.decision === 'request_more_research'
        ? 'Responsible-agent handoff is paused while Space Agent gathers more evidence.'
        : `Responsible-agent handoff is blocked: ${decision.rationale}.`,
  }
}

function createSpaceAgentTaskExit(packet: ResearchPacket, decision: AgentZeroResearchDecision): SpaceAgentTaskExit {
  const state: SpaceAgentTaskExit['state'] = decision.decision === 'blocked'
    ? 'blocked'
    : decision.decision === 'request_more_research'
      ? 'awaiting_more_research'
      : 'exited'
  return {
    schema: 'space_agent_task_exit_v1',
    agent: 'space_agent',
    packet_id: packet.packet_id,
    state,
    reason: state === 'exited'
      ? 'ResearchPacket returned; Space Agent exits until Gateway requests more research.'
      : state === 'awaiting_more_research'
        ? 'Gateway requested more evidence before handoff.'
        : decision.rationale,
    can_resume_with_gateway_request: true,
    no_secrets_exposed: true,
  }
}

function createSpaceAgentHandoffAuditLog(input: {
  packet: ResearchPacket
  stages: SpaceAgentHandoffStage[]
  status: SpaceAgentResearchHandoff['status']
  generatedAt: string
}): SpaceAgentHandoffAuditEvent[] {
  return input.stages.map((stage, index) => {
    const actorTarget = auditActorTargetForStage(stage, input.packet)
    return {
      audit_id: normalizeId(`space_agent_handoff_audit_${input.packet.packet_id}_${index + 1}_${stage}`),
      schema: 'space_agent_handoff_audit_event_v1',
      stage,
      actor: actorTarget.actor,
      target: actorTarget.target,
      status: input.status === 'blocked'
        ? 'blocked'
        : input.status === 'needs_more_research'
          ? 'needs_more_research'
          : 'recorded',
      blocked_reason: input.status === 'blocked' ? input.packet.blockers[0] || input.packet.blocked_reason : null,
      recorded_at: input.generatedAt,
      no_secrets_exposed: true,
      no_raw_paths: true,
    }
  })
}

function requiredResearchPacketFields(): Array<keyof ResearchPacket> {
  return [
    'job_id',
    'original_request',
    'assigned_supervisor',
    'source_list',
    'findings',
    'confidence',
    'evidence_snippets',
    'citations',
    'urls',
    'blockers',
    'recommended_next_agent',
  ]
}

function isMissingResearchPacketField(packet: ResearchPacket, field: keyof ResearchPacket): boolean {
  const value = packet[field]
  return value === null || value === undefined || (typeof value === 'string' && value.length === 0)
}

function packetContainsUnsafeOutput(packet: ResearchPacket): boolean {
  const serialized = JSON.stringify({
    original_request: packet.original_request,
    request_summary: packet.request_summary,
    findings: packet.findings,
    evidence_snippets: packet.evidence_snippets,
    owner_visible_summary: packet.owner_visible_summary,
  })
  return /(?:sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|\/home\/tony|\/a0\/|\/tmp|\/var\/folders)/i.test(serialized)
}

function actionForResponsibleAgent(agent: SpaceAgentResponsibleAgent): ResponsibleAgentResearchHandoff['action'] {
  if (agent === 'hermes') return 'design_workflow'
  if (agent === 'pi') return 'route_review'
  if (agent === 'responsible_specialist_agent') return 'manual_review'
  return 'review_findings'
}

function auditActorTargetForStage(stage: SpaceAgentHandoffStage, packet: ResearchPacket): Pick<SpaceAgentHandoffAuditEvent, 'actor' | 'target'> {
  if (stage === 'research_task_received') return { actor: 'gateway', target: 'space_agent' }
  if (stage === 'research_performed' || stage === 'research_packet_returned' || stage === 'space_agent_exited_task') return { actor: 'space_agent', target: 'gateway' }
  if (stage === 'pi_reviewed_route_quality') return { actor: 'pi', target: 'gateway' }
  if (stage === 'hermes_prepared_workflow_option') return { actor: 'hermes', target: 'gateway' }
  if (stage === 'agent_zero_decided_next_action') return { actor: 'agent_zero', target: 'gateway' }
  if (stage === 'responsible_agent_received_handoff') return { actor: 'gateway', target: packet.responsible_agent }
  return { actor: 'gateway', target: 'gateway' }
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function normalizeMiniAgentMemoryTtl(value: number | null | undefined): number {
  const numeric = Number(value || 1440)
  if (!Number.isFinite(numeric)) return 1440
  return Math.max(30, Math.min(1440, Math.floor(numeric)))
}

function normalizeUrlForScope(value: string): string {
  try {
    const url = new URL(sanitize(value))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return sanitize(value).replace(/\/$/, '')
  }
}

function extractUrls(value: string): string[] {
  return dedupeStrings((sanitize(value).match(/https?:\/\/[^\s)]+/gi) || []).map((url) => url.replace(/[.,;]+$/, '')))
}

function classifyResearchUrl(value: string | null): { url: string | null; blocked_reason: string | null } {
  if (!value) return { url: null, blocked_reason: null }
  try {
    const url = new URL(sanitizeUrlCandidate(value))
    if (!['http:', 'https:'].includes(url.protocol)) return { url: null, blocked_reason: 'unsupported_url_scheme' }
    if (isBlockedResearchHostname(url.hostname)) return { url: null, blocked_reason: 'blocked_url_not_allowed' }
    url.hash = ''
    return { url: url.toString().replace(/\/$/, ''), blocked_reason: null }
  } catch {
    return { url: null, blocked_reason: 'invalid_url' }
  }
}

function isBlockedResearchHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (/^(?:0|10|127|169\.254|192\.168)\./.test(host)) return true
  const private172 = host.match(/^172\.(\d{1,2})\./)
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31)
}

function addMinutes(iso: string, minutes: number): string {
  const base = new Date(iso)
  const time = Number.isFinite(base.getTime()) ? base.getTime() : new Date(DEFAULT_GENERATED_AT).getTime()
  return new Date(time + minutes * 60_000).toISOString()
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
    .replace(BLOCKED_RESEARCH_URL_PATTERN, '[blocked-url]')
    .trim()
}

function sanitizeUrlCandidate(value: string): string {
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
