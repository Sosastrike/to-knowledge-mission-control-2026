import {
  createGatewayFlow,
  type GatewayCapability,
  type GatewayEdgeKind,
  type GatewayExecutionMode,
  type GatewayFlow,
  type GatewayHealth,
  type GatewayPolicy,
  type GatewayRegistry,
  type GatewayStatus,
} from './gateway-model'
import {
  auditGatewayPolicyDecision,
  evaluateGatewayPolicy,
  gatewayPolicyBadges,
  type GatewayPolicyBadge,
  type GatewayPolicyDecision,
  type GatewayRouteDecision,
} from './gateway-policy'

export const GATEWAY_ROUTE_CLASSIFICATIONS = [
  'chat',
  'plan',
  'skill',
  'research',
  'tool',
  'model',
  'memory',
  'sync',
  'upload',
  'report',
  'protected_action',
  'event',
] as const

export type GatewayRouteClassification = (typeof GATEWAY_ROUTE_CLASSIFICATIONS)[number]

export type GatewayRoutePlannerInput = {
  ownerRequest: string
  source?: string
  generatedAt?: string
}

export type GatewayRoutePlan = {
  ok: boolean
  mode: 'gateway_route_plan'
  generated_at: string
  classification: GatewayRouteClassification
  source: string
  primary_target: string
  dispatch_target: string
  route_via: string[]
  selected_capability: GatewayCapability | null
  requires_bridge_session: boolean
  execution_enabled: false
  writes_enabled: false
  blocked: boolean
  blocker: string | null
  rationale: string
  route_decision: GatewayRouteDecision
  policy_decision: GatewayPolicyDecision
  policy_badges: GatewayPolicyBadge[]
  flow: GatewayFlow
}

type RouteTarget = {
  primaryTarget: string
  dispatchTarget: string
  via: string[]
  capability: GatewayCapability | null
  edgeKind: GatewayEdgeKind
  requiresBridgeSession: boolean
  executionMode: GatewayExecutionMode
  blocker: string | null
  rationale: string
}

const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z'

const READ_ONLY_POLICY: GatewayPolicy = {
  auth_required: true,
  bridge_session_required: false,
  write_allowed: false,
  secret_safe: true,
  external_allowed: false,
}

const BRIDGE_SESSION_POLICY: GatewayPolicy = {
  auth_required: true,
  bridge_session_required: true,
  write_allowed: false,
  secret_safe: true,
  external_allowed: false,
}

export function classifyGatewayOwnerRequest(ownerRequest: string): GatewayRouteClassification {
  const text = normalizeText(ownerRequest)

  if (matches(text, EVENT_PATTERNS)) return 'event'
  if (matches(text, UPLOAD_PATTERNS)) return 'upload'
  if (matches(text, REPORT_PATTERNS)) return 'report'
  if (matches(text, SYNC_PATTERNS)) return 'sync'
  if (matches(text, MEMORY_PATTERNS)) return 'memory'
  if (matches(text, SKILL_PATTERNS)) return 'skill'
  if (matches(text, PROTECTED_ACTION_PATTERNS)) return 'protected_action'
  if (matches(text, RESEARCH_PATTERNS)) return 'research'
  if (matches(text, TOOL_PATTERNS)) return 'tool'
  if (matches(text, MODEL_PATTERNS)) return 'model'
  if (matches(text, PLAN_PATTERNS)) return 'plan'
  return 'chat'
}

export function planGatewayRoute(registry: GatewayRegistry, input: GatewayRoutePlannerInput): GatewayRoutePlan {
  const generatedAt = input.generatedAt || registry.generated_at || DEFAULT_GENERATED_AT
  const source = normalizeId(input.source || 'owner')
  const prompt = sanitizeRequest(input.ownerRequest)
  const classification = classifyGatewayOwnerRequest(prompt)
  const target = selectRouteTarget(registry, classification, prompt)
  const policyDecision = evaluateGatewayPolicy({
    classification,
    ownerRequest: prompt,
    routeTarget: target.dispatchTarget,
    capabilityId: target.capability?.id || null,
    capabilityStatus: target.capability?.status || null,
    capabilityBlockers: target.capability?.blockers || [],
    routeBlocker: target.blocker,
    requiresBridgeSession: target.requiresBridgeSession,
  })
  const blocked = !policyDecision.allowed
  const blocker = policyDecision.blocked_reason
  const resultStatus: GatewayStatus = blocked ? 'blocked' : (policyDecision.bridge_session_required ? 'read_only' : 'connected')
  const policy = policyDecision.bridge_session_required ? BRIDGE_SESSION_POLICY : READ_ONLY_POLICY
  const flow = createGatewayFlow({
    flow_id: normalizeId(`flow_${source}_${classification}_${target.dispatchTarget}`),
    source,
    target: target.dispatchTarget,
    requested_action: classification,
    selected_route: {
      source,
      target: target.dispatchTarget,
      edge_kind: target.edgeKind,
      hops: target.via,
    },
    policy_result: {
      route_decision: policyDecision.route_decision,
      allowed: policyDecision.allowed,
      requires_bridge_session: policyDecision.bridge_session_required,
      blocked_reason: blocker,
    },
    bridge_session_id: null,
    status: resultStatus,
    node_health: routeNodeHealth(registry, target.via),
    request: {
      source,
      target: target.dispatchTarget,
      purpose: target.rationale,
      prompt,
    },
    route: {
      source,
      target: target.dispatchTarget,
      edge_kind: target.edgeKind,
      hops: target.via,
    },
    policy,
    execution_mode: blocked ? 'blocked' : target.executionMode,
    audit: {
      audit_id: null,
      events: ['gateway_route_plan_created'],
      external_write: false,
      secrets_exposed: false,
    },
    result: {
      status: resultStatus,
      summary: blocked
        ? `Gateway route is blocked: ${blocker}.`
        : `Gateway selected ${target.dispatchTarget} for ${classification}.`,
      blocker,
    },
  })
  auditGatewayPolicyDecision(policyDecision, target.dispatchTarget)

  return {
    ok: !blocked,
    mode: 'gateway_route_plan',
    generated_at: generatedAt,
    classification,
    source,
    primary_target: target.primaryTarget,
    dispatch_target: target.dispatchTarget,
    route_via: target.via,
    selected_capability: target.capability,
    requires_bridge_session: policyDecision.bridge_session_required,
    execution_enabled: false,
    writes_enabled: false,
    blocked,
    blocker,
    rationale: target.rationale,
    route_decision: policyDecision.route_decision,
    policy_decision: policyDecision,
    policy_badges: gatewayPolicyBadges(policyDecision),
    flow,
  }
}

function routeNodeHealth(registry: GatewayRegistry, hops: readonly string[]): Record<string, GatewayHealth> {
  return Object.fromEntries(
    hops.map((nodeId) => {
      const node = registry.nodes.find((item) => item.id === nodeId)
      const health = registry.health[nodeId] || node?.health || null
      return health ? [nodeId, { ...health }] : null
    }).filter((entry): entry is [string, GatewayHealth] => Boolean(entry)),
  )
}

function selectRouteTarget(
  registry: GatewayRegistry,
  classification: GatewayRouteClassification,
  prompt: string,
): RouteTarget {
  switch (classification) {
    case 'skill':
      return routeSkill(registry, prompt)
    case 'research':
      return routeResearch(registry, prompt)
    case 'model':
      return routeModel(registry, prompt)
    case 'tool':
      return routeTool(registry, prompt)
    case 'memory':
      return routeBrain(registry, prompt)
    case 'sync':
      return routeSync(registry, prompt)
    case 'upload':
      return routeUpload(registry, prompt)
    case 'report':
      return routeReport(registry, prompt)
    case 'protected_action':
      return routeProtectedAction(registry, prompt)
    case 'event':
      return routeEvent(registry, prompt)
    case 'plan':
      return routeAgentZero('plan', 'Agent Zero handles operational planning by default.')
    case 'chat':
    default:
      return routeAgentZero('chat', 'Owner commands route to Agent Zero by default.')
  }
}

function routeAgentZero(classification: GatewayRouteClassification, rationale: string): RouteTarget {
  return {
    primaryTarget: 'agent_zero',
    dispatchTarget: 'agent_zero',
    via: ['owner', 'gateway', 'agent_zero'],
    capability: null,
    edgeKind: classification === 'chat' || classification === 'plan' ? 'command' : 'tool-call',
    requiresBridgeSession: false,
    executionMode: 'read_only',
    blocker: null,
    rationale,
  }
}

function routeSkill(registry: GatewayRegistry, prompt: string): RouteTarget {
  if (isSkillExecutionIntent(prompt)) {
    return routeSkillExecution(registry, prompt)
  }
  return routeHermesViaAgentZero(registry, prompt)
}

function routeHermesViaAgentZero(registry: GatewayRegistry, prompt: string): RouteTarget {
  const hermes = findNodeStatus(registry, 'hermes')
  const capability = findCapability(registry, 'hermes.lieutenant')
  const blocker = blockedReason(capability) || (hermes === 'blocked' || hermes === 'missing' ? 'hermes_lieutenant_not_available' : null)
  return {
    primaryTarget: 'agent_zero',
    dispatchTarget: 'hermes',
    via: ['owner', 'gateway', 'agent_zero', 'hermes'],
    capability,
    edgeKind: 'delegation',
    requiresBridgeSession: false,
    executionMode: 'read_only',
    blocker,
    rationale: prompt.includes('workflow')
      ? 'Skill and workflow design routes to Hermes through Agent Zero.'
      : 'Skill design routes to Hermes through Agent Zero.',
  }
}

function routeResearch(registry: GatewayRegistry, prompt: string): RouteTarget {
  const spaceAgent = findNodeStatus(registry, 'space_agent')
  const capability = findCapability(registry, 'space_agent_research_packet')
  const boundaryBlocker = researchBoundaryBlocker(prompt)
  const blocker = boundaryBlocker || blockedReason(capability) || (spaceAgent === 'blocked' || spaceAgent === 'missing' ? 'space_agent_research_specialist_not_available' : null)
  return {
    primaryTarget: 'agent_zero',
    dispatchTarget: 'space_agent',
    via: ['owner', 'gateway', 'agent_zero', 'space_agent'],
    capability,
    edgeKind: 'delegation',
    requiresBridgeSession: Boolean(boundaryBlocker),
    executionMode: 'read_only',
    blocker,
    rationale: 'Browser, web, article, YouTube, video, crawl, scrape, search, extraction, and Firecrawl research routes to Space Agent for a structured Research Packet; responsibility returns to Agent Zero after research.',
  }
}

function researchBoundaryBlocker(prompt: string): string | null {
  const text = normalizeText(prompt)
  if (/\b(?:login|log in|sign in|private|paywall|paid content|credential|password|cookie|session token)\b/.test(text)) {
    return 'space_agent_private_or_login_boundaries_require_owner_approved_credentials_and_bridge_session_scope'
  }
  return null
}

function routeSkillExecution(registry: GatewayRegistry, prompt: string): RouteTarget {
  const wanted = firstSkillCapability(registry, prompt)
  const capability = wanted || registry.capabilities.find((item) => item.kind === 'skill') || null
  return routeCapability({
    primaryTarget: 'agent_zero',
    fallbackDispatch: 'openclaw_plus',
    via: ['owner', 'gateway', 'agent_zero', 'openclaw_plus'],
    capability,
    edgeKind: 'tool-call',
    requiresBridgeSession: true,
    executionMode: 'bridge_session',
    missingBlocker: 'skill_execution_capability_not_registered',
    rationale: 'Skill execution routes to Agent Zero and the OpenClaw+ runtime, and requires an owner-approved Bridge Session.',
  })
}

function isSkillExecutionIntent(prompt: string): boolean {
  return /\b(?:execute|run|activate|install|promote|write)\b.*\bskill\b|\bskill\b.*\b(?:execute|run|activate|install|promote|write)\b/.test(normalizeText(prompt))
}

function routeModel(registry: GatewayRegistry, prompt: string): RouteTarget {
  const wanted = firstProvider(prompt, [
    ['openrouter', 'model_openrouter'],
    ['openai', 'model_openai'],
    ['claude', 'model_claude_anthropic'],
    ['anthropic', 'model_claude_anthropic'],
    ['codex', 'model_codex_chatgpt'],
    ['chatgpt', 'model_codex_chatgpt'],
    ['ollama', 'model_ollama'],
    ['nvidia', 'model_nvidia'],
    ['gemini', 'model_gemini'],
    ['groq', 'model_groq'],
  ])
  const preferred = wanted || preferredModelForTask(prompt)
  const selection = selectModelCapability(registry, preferred)
  const capability = selection.capability
  return routeCapability({
    primaryTarget: 'agent_zero',
    fallbackDispatch: 'llm_gateway',
    via: capability?.source_node
      ? ['owner', 'gateway', 'agent_zero', 'llm_gateway', capability.source_node]
      : ['owner', 'gateway', 'agent_zero', 'llm_gateway'],
    capability,
    edgeKind: 'model-call',
    requiresBridgeSession: true,
    executionMode: 'bridge_session',
    missingBlocker: preferred ? `${preferred}_not_registered` : 'model_provider_not_registered',
    rationale: selection.rationale,
  })
}

function preferredModelForTask(prompt: string): string {
  const text = normalizeText(prompt)
  if (/codex|repo|code|coding|debug|patch/.test(text)) return 'model_codex_chatgpt'
  if (/claude|deep reason|long analysis|review|planning/.test(text)) return 'model_claude_anthropic'
  if (/local|private|offline|no external/.test(text)) return 'model_ollama'
  if (/fast|latency|low latency|speed/.test(text)) return 'model_groq'
  if (/gemini|google|long context|multimodal|vision/.test(text)) return 'model_gemini'
  if (/gpu|nvidia/.test(text)) return 'model_nvidia'
  if (/openai|gpt/.test(text)) return 'model_openai'
  return 'model_openrouter'
}

function selectModelCapability(registry: GatewayRegistry, preferredId: string): { capability: GatewayCapability | null; rationale: string } {
  const preferred = findCapability(registry, preferredId)
  const preferredBlocker = blockedReason(preferred)
  if (preferred && !preferredBlocker) {
    return {
      capability: preferred,
      rationale: `Gateway selected ${preferred.label} from the LLM Gateway route policy.`,
    }
  }

  const fallback = fallbackModelCapability(registry, preferred)
  if (fallback && !blockedReason(fallback)) {
    const blocker = preferredBlocker || (preferred ? `${preferred.id}_blocked` : `${preferredId}_not_registered`)
    return {
      capability: fallback,
      rationale: `Gateway selected ${fallback.label} as a model fallback because ${preferred?.label || preferredId} is blocked: ${blocker}. Raw provider tracebacks are redacted from owner output.`,
    }
  }

  return {
    capability: preferred || fallback || registry.capabilities.find((item) => item.kind === 'model') || null,
    rationale: 'Gateway could not find an available model fallback; it returns an exact blocked provider status without raw LiteLLM/OpenRouter tracebacks.',
  }
}

function fallbackModelCapability(registry: GatewayRegistry, preferred: GatewayCapability | null): GatewayCapability | null {
  const fallbackId = detailString(preferred?.status_details || {}, 'fallback_provider')
  if (fallbackId) {
    const direct = findCapability(registry, `model_${fallbackId}`) || findCapability(registry, fallbackId)
    if (direct && !blockedReason(direct)) return direct
  }
  const fallbackOrder = ['model_openrouter', 'model_openai', 'model_claude_anthropic', 'model_codex_chatgpt', 'model_ollama']
  return fallbackOrder.map((id) => findCapability(registry, id)).find((capability) => capability && !blockedReason(capability)) || null
}

function routeTool(registry: GatewayRegistry, prompt: string): RouteTarget {
  const wanted = firstProvider(prompt, [
    ['firecrawl', 'integration_firecrawl'],
    ['zapier', 'integration_zapier'],
    ['heygen', 'integration_heygen'],
    ['agentmail', 'integration_agentmail'],
    ['agent mail', 'integration_agentmail'],
    ['google drive', 'integration_google_drive'],
    ['onedrive', 'integration_onedrive'],
    ['one drive', 'integration_onedrive'],
    ['n8n', 'integration_n8n'],
    ['mcp', 'mcp_servers'],
    ['api', 'bridge_mcp.providers'],
  ])
  const capability = (wanted ? findCapability(registry, wanted) : null) ||
    registry.capabilities.find((item) => ['tool', 'mcp_server', 'integration'].includes(item.kind) && item.status !== 'blocked') ||
    null
  return routeCapability({
    primaryTarget: 'agent_zero',
    fallbackDispatch: wanted === 'mcp_servers' ? 'mcp_tools' : 'mcp_gateway',
    via: capability?.source_node
      ? ['owner', 'gateway', 'agent_zero', 'mcp_gateway', capability.source_node]
      : ['owner', 'gateway', 'agent_zero', 'mcp_gateway'],
    capability,
    edgeKind: 'mcp-call',
    requiresBridgeSession: true,
    executionMode: 'bridge_session',
    missingBlocker: wanted ? `${wanted}_not_registered` : 'tool_or_mcp_capability_not_registered',
    rationale: 'Tool and MCP calls route through the Gateway MCP/Tool cluster, Bridge/MCP, and registered adapters.',
  })
}

function routeBrain(registry: GatewayRegistry, prompt: string): RouteTarget {
  const wanted = firstProvider(prompt, [
    ['obsidian', 'brain_obsidian'],
    ['mempalace', 'brain_mempalace'],
    ['memory', 'brain_mempalace'],
    ['graphify', 'brain_graphify'],
    ['graph', 'brain_graphify'],
    ['brain sync', 'brain.systems'],
    ['brain', 'brain.systems'],
  ])
  const capability = (wanted ? findCapability(registry, wanted) : null) ||
    registry.capabilities.find((item) => item.kind === 'brain' && item.status !== 'blocked') ||
    null
  const writeRequested = matches(prompt, [/write|save|remember|append|update|create|tag|link/])
  return routeCapability({
    primaryTarget: 'agent_zero',
    fallbackDispatch: capability?.source_node || 'brain_sync',
    via: ['owner', 'gateway', 'agent_zero', 'brain_sync', capability?.source_node || 'brain_sync'],
    capability,
    edgeKind: 'memory',
    requiresBridgeSession: writeRequested || Boolean(capability?.requires_session),
    executionMode: writeRequested ? 'bridge_session' : 'read_only',
    missingBlocker: wanted ? `${wanted}_not_registered` : 'brain_capability_not_registered',
    rationale: 'Knowledge and memory requests route to Brain adapters.',
  })
}

function routeSync(registry: GatewayRegistry, prompt: string): RouteTarget {
  const capability = findCapability(registry, 'brain_buildwiki')
  return routeCapability({
    primaryTarget: 'agent_zero',
    fallbackDispatch: 'buildwiki',
    via: ['owner', 'gateway', 'agent_zero', 'brain_sync', 'buildwiki'],
    capability,
    edgeKind: 'sync',
    requiresBridgeSession: true,
    executionMode: 'bridge_session',
    missingBlocker: 'buildwiki_farmer_capability_not_registered',
    rationale: prompt.includes('run now')
      ? 'Build-Wiki Run Now routes to the scoped farmer adapter and requires Bridge Session approval.'
      : 'Sync requests route to Build-Wiki/Farmer through Brain Sync.',
  })
}

function routeUpload(registry: GatewayRegistry, prompt: string): RouteTarget {
  const wanted = firstProvider(prompt, [
    ['onedrive', 'integration_onedrive'],
    ['one drive', 'integration_onedrive'],
    ['google drive', 'integration_google_drive'],
    ['drive', 'integration_google_drive'],
    ['telegram', 'integration_telegram'],
    ['attach', 'integration_telegram'],
  ])
  const capability = wanted ? findCapability(registry, wanted) : null
  return routeCapability({
    primaryTarget: 'agent_zero',
    fallbackDispatch: 'integrations',
    via: ['owner', 'gateway', 'agent_zero', 'integrations'],
    capability,
    edgeKind: 'tool-call',
    requiresBridgeSession: true,
    executionMode: 'bridge_session',
    missingBlocker: wanted ? `${wanted}_not_registered` : 'upload_delivery_capability_not_registered',
    rationale: 'Upload and attachment requests route through delivery integrations and require approved adapters.',
  })
}

function routeReport(registry: GatewayRegistry, prompt: string): RouteTarget {
  const capability = findCapability(registry, 'tool_report_create') ||
    registry.capabilities.find((item) => item.kind === 'tool' && /report/i.test(item.label)) ||
    null
  return routeCapability({
    primaryTarget: 'agent_zero',
    fallbackDispatch: 'agent_zero',
    via: ['owner', 'gateway', 'agent_zero', 'tools'],
    capability,
    edgeKind: 'report',
    requiresBridgeSession: false,
    executionMode: 'read_only',
    missingBlocker: 'report_creation_capability_not_registered',
    rationale: 'Report requests route to Agent Zero and the report adapter.',
  })
}

function routeProtectedAction(registry: GatewayRegistry, prompt: string): RouteTarget {
  const buildWikiRun = /build[-\s]?wiki|farmer|run now|sync/.test(prompt)
  if (buildWikiRun) return routeSync(registry, prompt)
  return {
    primaryTarget: 'agent_zero',
    dispatchTarget: 'agent_zero',
    via: ['owner', 'gateway', 'agent_zero'],
    capability: null,
    edgeKind: 'approval',
    requiresBridgeSession: true,
    executionMode: 'bridge_session',
    blocker: null,
    rationale: 'Protected actions require Gateway policy, owner approval, and a Bridge Session before execution.',
  }
}

function routeEvent(registry: GatewayRegistry, prompt: string): RouteTarget {
  const eventNodeExists = registry.nodes.some((node) => node.id === 'events')
  return {
    primaryTarget: 'gateway',
    dispatchTarget: 'events',
    via: ['owner', 'gateway', 'events'],
    capability: null,
    edgeKind: 'event',
    requiresBridgeSession: false,
    executionMode: 'read_only',
    blocker: eventNodeExists ? null : 'gateway_event_node_not_registered',
    rationale: 'Incoming webhooks, email, Telegram, and schedules are normalized as Gateway events.',
  }
}

function routeCapability(input: {
  primaryTarget: string
  fallbackDispatch: string
  via: string[]
  capability: GatewayCapability | null
  edgeKind: GatewayEdgeKind
  requiresBridgeSession: boolean
  executionMode: GatewayExecutionMode
  missingBlocker: string
  rationale: string
}): RouteTarget {
  const dispatchTarget = input.capability?.source_node || input.fallbackDispatch
  const capabilityBlocker = blockedReason(input.capability)
  return {
    primaryTarget: input.primaryTarget,
    dispatchTarget,
    via: input.via,
    capability: input.capability,
    edgeKind: input.edgeKind,
    requiresBridgeSession: input.requiresBridgeSession,
    executionMode: input.executionMode,
    blocker: input.capability ? capabilityBlocker : input.missingBlocker,
    rationale: input.rationale,
  }
}

function detailString(details: GatewayCapability['status_details'], key: string): string | null {
  const value = details[key]
  if (value === null || value === undefined || value === false) return null
  const text = String(value || '').trim()
  return text || null
}

function blockedReason(capability: GatewayCapability | null): string | null {
  if (!capability) return null
  if (capability.status === 'blocked' || capability.status === 'missing') {
    return capability.blockers[0] || `${capability.id}_${capability.status}`
  }
  return capability.blockers[0] || null
}

function findNodeStatus(registry: GatewayRegistry, id: string): GatewayStatus {
  return registry.nodes.find((node) => node.id === normalizeId(id))?.status || 'missing'
}

function findCapability(registry: GatewayRegistry, id: string): GatewayCapability | null {
  const normalized = normalizeId(id)
  return registry.capabilities.find((capability) => capability.id === normalized) || null
}

function firstProvider(prompt: string, pairs: Array<[string, string]>): string | null {
  const text = normalizeText(prompt)
  return pairs.find(([needle]) => text.includes(needle))?.[1] || null
}

function firstSkillCapability(registry: GatewayRegistry, prompt: string): GatewayCapability | null {
  const text = normalizeText(prompt)
  return registry.capabilities.find((capability) => {
    if (capability.kind !== 'skill') return false
    return text.includes(capability.id.replace(/^skill_/, '').replace(/_/g, ' ')) || text.includes(capability.label.toLowerCase())
  }) || null
}

function matches(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

function normalizeText(value: string): string {
  return sanitizeRequest(value).toLowerCase()
}

function sanitizeRequest(value: string): string {
  return String(value || '')
    .replace(/(?:sk-[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*[:=]\s*[^,\s}]+)/gi, '[redacted]')
    .replace(/(?:\/home\/tony|\/a0\/(?:usr|tmp|var)|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi, '[path redacted]')
    .trim()
}

function normalizeId(value: string): string {
  return sanitizeRequest(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'gateway_item'
}

const PROTECTED_ACTION_PATTERNS = [
  /\b(?:execute|run|restart|start|stop|delete|destroy|decommission|send|email|write|upload|mount|generate)\b/,
  /\b(?:bridge session|approval|protected action|owner approval)\b/,
]
const UPLOAD_PATTERNS = [/\b(?:upload|attach|send file|drive|onedrive|google drive|telegram attachment)\b/]
const REPORT_PATTERNS = [/\b(?:report|pdf|markdown|executive summary|capability inventory)\b/]
const SYNC_PATTERNS = [/\b(?:build[-\s]?wiki|farmer|sync|run now|opencloud)\b/]
const MEMORY_PATTERNS = [/\b(?:brain|obsidian|mempalace|memory|remember|graphify|knowledge|note|vault)\b/]
const SKILL_PATTERNS = [/\b(?:skill|workflow|automation|spec|proposal|design a skill|create a skill)\b/]
const RESEARCH_PATTERNS = [/\b(?:live web|web research|webpage|web page|website|browser|browse|article|youtube|you tube|video inspection|inspect video|firecrawl|fire crawl|crawl|scrape|search the web|web search|online research|extract page|page extraction|page interaction)\b/]
const TOOL_PATTERNS = [/\b(?:tool|mcp|api|zapier|heygen|agentmail|agent mail|n8n|webhook tool)\b/]
const MODEL_PATTERNS = [/\b(?:model|llm|openrouter|openai|claude|anthropic|codex|chatgpt|ollama|nvidia|gemini|groq)\b/]
const PLAN_PATTERNS = [/\b(?:plan|strategy|analyze|review|map|decide|recommend)\b/]
const EVENT_PATTERNS = [/\b(?:incoming|webhook|telegram message|email event|schedule event|event)\b/]
