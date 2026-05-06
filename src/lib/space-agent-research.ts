export type SpaceAgentResearchType = 'browser' | 'web' | 'youtube' | 'video' | 'firecrawl' | 'page_extraction' | 'general'

export type SpaceAgentResearchPacket = {
  packet_id: string
  mode: 'space_agent_research_packet'
  status: 'ready' | 'blocked'
  research_stage_owner: 'space_agent'
  returns_to: 'agent_zero'
  requested_by: 'owner' | 'agent_zero' | 'hermes' | 'pi' | 'gateway'
  research_type: SpaceAgentResearchType
  request_summary: string
  allowed_surfaces: string[]
  forbidden_surfaces: string[]
  required_gateway_route: 'owner_gateway_agent_zero_space_agent'
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

export type SpaceAgentResearchPacketInput = {
  request: string
  requestedBy?: SpaceAgentResearchPacket['requested_by']
  generatedAt?: string
  firecrawlConfigured?: boolean
}

const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z'
const PRIVATE_OR_LOGIN_PATTERN = /\b(?:login|log in|sign in|private|paywall|paid content|credential|password|cookie|session token)\b/i
const SECRETISH_PATTERN = /(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?FILE)\s*[:=]\s*[^,\s}]+)/gi
const RAW_PATH_PATTERN = /(?:\/home\/tony|\/a0\/|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi

export function createSpaceAgentResearchPacket(input: SpaceAgentResearchPacketInput): SpaceAgentResearchPacket {
  const request = sanitize(input.request)
  const researchType = classifySpaceAgentResearch(request)
  const bridgeSessionReason = PRIVATE_OR_LOGIN_PATTERN.test(request)
    ? 'private_or_login_boundary_requires_owner_approved_credentials_and_bridge_session_scope'
    : null
  const firecrawlRequested = researchType === 'firecrawl' || /fire\s*crawl|firecrawl|crawl|scrape/i.test(request)
  const firecrawlStatus: SpaceAgentResearchPacket['firecrawl_status'] = firecrawlRequested
    ? input.firecrawlConfigured
      ? 'available_from_registry'
      : 'blocked_missing_credential'
    : 'not_requested'
  const blockedReason = bridgeSessionReason || (firecrawlRequested && !input.firecrawlConfigured ? 'firecrawl_missing_credential_research_packet_can_still_use_browser_or_web_fallback_if_available' : null)

  return {
    packet_id: normalizeId(`space_agent_${researchType}_${input.generatedAt || DEFAULT_GENERATED_AT}`),
    mode: 'space_agent_research_packet',
    status: blockedReason && bridgeSessionReason ? 'blocked' : 'ready',
    research_stage_owner: 'space_agent',
    returns_to: 'agent_zero',
    requested_by: input.requestedBy || 'gateway',
    research_type: researchType,
    request_summary: request,
    allowed_surfaces: ['public web pages', 'owner-approved browser pages', 'public YouTube metadata/transcripts when available', 'Gateway Firecrawl status'],
    forbidden_surfaces: ['private accounts without approved credentials', 'paywalled/private content bypass', 'external writes', 'Zapier writes', 'HeyGen generation', 'SMB mounts', 'raw secret files'],
    required_gateway_route: 'owner_gateway_agent_zero_space_agent',
    requires_bridge_session: Boolean(bridgeSessionReason),
    bridge_session_reason: bridgeSessionReason,
    browser_interaction_enabled: false,
    external_writes_enabled: false,
    tool_execution_enabled: false,
    firecrawl_status: firecrawlStatus,
    youtube_status: /youtube|you tube|video/i.test(request) ? 'research_packet_only' : 'not_requested',
    login_boundary_respected: true,
    paywall_private_content_blocked: true,
    no_secrets_exposed: true,
    no_raw_paths: true,
    findings: [],
    citations: [],
    blocked_reason: blockedReason,
    owner_visible_summary: blockedReason
      ? `Space Agent prepared a research packet with blocker: ${blockedReason}.`
      : `Space Agent can prepare a ${researchType} research packet and return responsibility to Agent Zero.`,
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

function sanitize(value: string): string {
  return String(value || '')
    .replace(SECRETISH_PATTERN, '[redacted-secret]')
    .replace(RAW_PATH_PATTERN, '[redacted-path]')
    .trim()
}

function normalizeId(value: string): string {
  return sanitize(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'space_agent_research_packet'
}
