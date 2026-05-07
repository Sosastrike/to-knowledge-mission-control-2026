import type { GatewayRegistry } from './gateway-model'
import { getGatewayNodeDetail, type GatewayNodeDetailPayload } from './gateway-registry-api'
import {
  createSpaceAgentResearchPacket,
  type SpaceAgentResearchPacket,
  type SpaceAgentResearchPacketInput,
  type SpaceAgentResponsibleAgent,
} from './space-agent-research'
import type { PlaywrightMcpStatus } from './playwright-mcp'

export type SpaceAgentStatusPayload = {
  ok: true
  mode: 'space_agent_status_read_only'
  generated_at: string
  node: GatewayNodeDetailPayload['node'] | null
  capabilities: GatewayNodeDetailPayload['capabilities']
  health: 'read_only' | 'blocked' | 'degraded'
  reachable: boolean
  configured: boolean
  firecrawl: {
    status: string
    credential_configured: boolean
    read_only_schema_visible: boolean
    backend_reachable: boolean
    blocked_reason: string | null
  }
  browser: {
    status: string
    configured: boolean
    runtime_adapter_configured: boolean
    bridge_session_required: boolean
    execution_enabled: false
  }
  playwright_mcp?: PlaywrightMcpStatus
  youtube: {
    support: string
    transcript_path_configured: boolean
    runtime_adapter_configured: boolean
    execution_enabled: false
  }
  latest_research_jobs: string[]
  handoff_target: string
  blockers: string[]
  status_endpoint: '/api/bridge/space-agent/status'
  test_chat_endpoint: '/api/bridge/space-agent/test-chat'
  research_endpoint: '/api/gateway/space-agent/research'
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export function attachPlaywrightMcpStatus(payload: SpaceAgentStatusPayload, playwrightMcp: PlaywrightMcpStatus): SpaceAgentStatusPayload {
  return {
    ...payload,
    health: playwrightMcp.ok && payload.firecrawl.blocked_reason ? 'degraded' : playwrightMcp.ok ? 'read_only' : payload.health,
    configured: payload.configured || playwrightMcp.ok,
    browser: {
      ...payload.browser,
      status: playwrightMcp.ok
        ? 'playwright_mcp_local_only_read_only_evidence_available_bridge_session_required_for_interactive_actions'
        : payload.browser.status,
      configured: payload.browser.configured || playwrightMcp.ok,
      runtime_adapter_configured: payload.browser.runtime_adapter_configured || playwrightMcp.ok,
      bridge_session_required: true,
      execution_enabled: false,
    },
    playwright_mcp: playwrightMcp,
    blockers: playwrightMcp.ok
      ? Array.from(new Set(payload.blockers.filter((blocker) => blocker !== 'spaceagent_runtime_not_proven_live')))
      : Array.from(new Set([...payload.blockers, playwrightMcp.blocker || 'playwright_mcp_service_unreachable'])),
  }
}

export type SpaceAgentTestChatPayload = {
  ok: true
  mode: 'space_agent_read_only_test_chat'
  generated_at: string
  prompt: string
  response_text: string
  space_agent_called: false
  live_chat_status: 'blocked_safe_live_adapter_not_configured'
  blocker: 'space_agent_runtime_adapter_not_configured'
  context_source: '/api/gateway/nodes/space_agent'
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
  next_action: string
}

export type SpaceAgentResearchJobRecord = {
  id: string
  schema: 'space_agent_gateway_job_record_v1'
  created_at: string
  status: 'planned' | 'blocked'
  packet: SpaceAgentResearchPacket
  execution_enabled: false
  writes_enabled: false
  bridge_session_required: boolean
  blocked_reason: string | null
  owner_visible_summary: string
}

export type SpaceAgentResearchPayload = {
  ok: boolean
  mode: 'space_agent_research_packet_planning'
  generated_at: string
  job: SpaceAgentResearchJobRecord
  packet: SpaceAgentResearchPacket
  accepted_for_execution: false
  research_performed: boolean
  execution_enabled: false
  writes_enabled: false
  protected_actions_enabled: false
  bridge_session_required: boolean
  blocked_reason: string | null
  no_secrets_exposed: true
  raw_paths_exposed: false
  next_action: string
}

export type SpaceAgentJobPayload = {
  ok: boolean
  mode: 'space_agent_job_read_only'
  generated_at: string
  job: SpaceAgentResearchJobRecord | null
  execution_enabled: false
  writes_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
  error?: 'space_agent_job_not_found'
}

const SPACE_AGENT_JOB_STORE = new Map<string, SpaceAgentResearchJobRecord>()

export function buildSpaceAgentStatusPayload(registry: GatewayRegistry, generatedAt: string): SpaceAgentStatusPayload {
  const detail = getGatewayNodeDetail(registry, 'space_agent')
  const node = detail?.node || null
  const details = node?.status_details || {}
  const blockers = [
    node?.blocked_reason || null,
    detail?.capabilities.flatMap((capability) => capability.blockers || [])[0] || null,
    stringDetail(details.blockers_summary, null),
  ].filter((value): value is string => Boolean(value))
  const firecrawlBlockedReason = stringDetail(details.firecrawl_blocked_reason, null)
  const browserStatus = stringDetail(details.browser_status, stringDetail(node?.browser_interaction, 'gated_by_gateway_policy'))
  const youtubeSupport = stringDetail(details.youtube_support, stringDetail(node?.youtube_inspection, 'metadata_transcript_when_available'))
  const latestJobs = stringDetail(details.latest_research_jobs, 'none_recorded_yet')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const credentialConfigured = details.firecrawl_credential_configured === true
  const browserRuntimeAdapterConfigured = details.browser_runtime_adapter_configured === true
  const youtubeRuntimeAdapterConfigured = details.youtube_runtime_adapter_configured === true
  const youtubeTranscriptPathConfigured = /transcript|captions/i.test(youtubeSupport)

  return {
    ok: true,
    mode: 'space_agent_status_read_only',
    generated_at: generatedAt,
    node,
    capabilities: detail?.capabilities || [],
    health: firecrawlBlockedReason ? 'blocked' : node?.status === 'degraded' ? 'degraded' : 'read_only',
    reachable: Boolean(node),
    configured: Boolean(node) && !firecrawlBlockedReason,
    firecrawl: {
      status: stringDetail(details.firecrawl_status, 'blocked'),
      credential_configured: credentialConfigured,
      read_only_schema_visible: details.firecrawl_read_only_schema_visible === true,
      backend_reachable: details.firecrawl_backend_reachable === true,
      blocked_reason: firecrawlBlockedReason,
    },
    browser: {
      status: browserStatus,
      configured: browserRuntimeAdapterConfigured,
      runtime_adapter_configured: browserRuntimeAdapterConfigured,
      bridge_session_required: /bridge_session|gated|required|blocked_until/i.test(browserStatus),
      execution_enabled: false,
    },
    youtube: {
      support: youtubeSupport,
      transcript_path_configured: youtubeTranscriptPathConfigured,
      runtime_adapter_configured: youtubeRuntimeAdapterConfigured,
      execution_enabled: false,
    },
    latest_research_jobs: latestJobs,
    handoff_target: stringDetail(details.handoff_target, 'agent_zero_by_default'),
    blockers: Array.from(new Set(blockers)),
    status_endpoint: '/api/bridge/space-agent/status',
    test_chat_endpoint: '/api/bridge/space-agent/test-chat',
    research_endpoint: '/api/gateway/space-agent/research',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

export function buildSpaceAgentTestChatPayload(input: {
  message: string
  registry: GatewayRegistry
  generatedAt: string
}): SpaceAgentTestChatPayload {
  const prompt = sanitizeOwnerText(input.message).slice(0, 2000)
  const status = buildSpaceAgentStatusPayload(input.registry, input.generatedAt)
  const response = [
    'Space Agent route is present in Gateway.',
    `Firecrawl status: ${status.firecrawl.status}.`,
    `Browser status: ${status.browser.status}.`,
    `YouTube support: ${status.youtube.support}.`,
    'Live Space Agent runtime chat is blocked until a safe no-tool adapter is configured.',
  ].join(' ')

  return {
    ok: true,
    mode: 'space_agent_read_only_test_chat',
    generated_at: input.generatedAt,
    prompt,
    response_text: response,
    space_agent_called: false,
    live_chat_status: 'blocked_safe_live_adapter_not_configured',
    blocker: 'space_agent_runtime_adapter_not_configured',
    context_source: '/api/gateway/nodes/space_agent',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    next_action: 'Configure a safe Space Agent runtime adapter before marking live chat as called. No execution occurred.',
  }
}

export function createSpaceAgentResearchPayload(input: {
  request: string
  registry: GatewayRegistry
  generatedAt: string
  responsibleAgent?: SpaceAgentResponsibleAgent
  researchPerformed?: boolean
  evidence?: SpaceAgentResearchPacketInput['evidence']
  webSources?: SpaceAgentResearchPacketInput['webSources']
  browserActions?: SpaceAgentResearchPacketInput['browserActions']
}): SpaceAgentResearchPayload {
  const request = sanitizeOwnerText(input.request).slice(0, 4000)
  const status = buildSpaceAgentStatusPayload(input.registry, input.generatedAt)
  const packet = createSpaceAgentResearchPacket({
    request,
    requestedBy: 'owner',
    responsibleAgent: input.responsibleAgent || 'agent_zero',
    generatedAt: input.generatedAt,
    firecrawlConfigured: status.firecrawl.credential_configured,
    evidence: input.evidence,
    webSources: input.webSources,
    browserActions: input.browserActions,
  })
  const browserEvidencePerformed = Boolean(input.researchPerformed && input.evidence?.length)
  const bridgeSessionRequired = packet.requires_bridge_session || (packet.research_operation === 'browser_interaction' && !browserEvidencePerformed)
  const blockedReason = packet.blocked_reason || (bridgeSessionRequired ? packet.bridge_session_reason : null)
  const job: SpaceAgentResearchJobRecord = {
    id: packet.job_id,
    schema: 'space_agent_gateway_job_record_v1',
    created_at: input.generatedAt,
    status: packet.status === 'blocked' ? 'blocked' : 'planned',
    packet,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: bridgeSessionRequired,
    blocked_reason: blockedReason,
    owner_visible_summary: packet.status === 'blocked'
      ? `Space Agent research is blocked: ${blockedReason}.`
      : browserEvidencePerformed
        ? 'Space Agent collected read-only Playwright MCP browser evidence and prepared a Research Packet. No write or protected action occurred.'
        : 'Space Agent Research Packet was prepared. No browser, Firecrawl, upload, send, or external write was executed.',
  }
  SPACE_AGENT_JOB_STORE.set(job.id, job)

  return {
    ok: packet.status !== 'blocked',
    mode: 'space_agent_research_packet_planning',
    generated_at: input.generatedAt,
    job,
    packet,
    accepted_for_execution: false,
    research_performed: browserEvidencePerformed,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    bridge_session_required: bridgeSessionRequired,
    blocked_reason: blockedReason,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    next_action: packet.status === 'blocked'
      ? 'Open a scoped Bridge Session or remove the protected browser/private-content request. No research execution occurred.'
      : browserEvidencePerformed
        ? 'Agent Zero may review the Playwright MCP evidence packet and hand the Research Packet to the responsible agent.'
        : 'Agent Zero may review the Research Packet and decide whether a Bridge Session is needed for any live research action.',
  }
}

export function getSpaceAgentJobPayload(id: string, generatedAt: string): SpaceAgentJobPayload {
  const normalizedId = sanitizeOwnerText(id).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  const job = SPACE_AGENT_JOB_STORE.get(normalizedId) || null
  return {
    ok: Boolean(job),
    mode: 'space_agent_job_read_only',
    generated_at: generatedAt,
    job,
    execution_enabled: false,
    writes_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    ...(job ? {} : { error: 'space_agent_job_not_found' as const }),
  }
}

export function clearSpaceAgentJobStoreForTests() {
  SPACE_AGENT_JOB_STORE.clear()
}

function stringDetail(value: unknown, fallback: string): string
function stringDetail(value: unknown, fallback: null): string | null
function stringDetail(value: unknown, fallback: string | null): string | null {
  if (typeof value === 'string' && value.trim()) return sanitizeOwnerText(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function sanitizeOwnerText(value: string) {
  return String(value || '')
    .replace(/sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?FILE)\s*[:=]\s*[^,\s}]+/gi, '[redacted-secret]')
    .replace(/(?:\/(?:home|Users|a0|tmp|var|private)\/|[A-Z]:\\)[^\s`'"\])}]*/gi, '[redacted-path]')
    .trim()
}
