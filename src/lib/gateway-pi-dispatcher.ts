import type { GatewayCapability, GatewayRegistry } from './gateway-model'
import { classifyGatewayOwnerRequest, planGatewayRoute, type GatewayRouteClassification } from './gateway-route-planner'

export type PiOperationType = 'read' | 'write' | 'execute' | 'mixed'

export type PiDispatcherRecommendation = {
  ok: boolean
  mode: 'pi_dispatcher_shadow_recommendation'
  generated_at: string
  shadow_mode: true
  requester: 'owner' | 'agent_zero' | 'hermes' | 'gateway'
  owner_request: string
  classification: GatewayRouteClassification | 'unknown'
  operation_type: PiOperationType
  selected_route: {
    source: string
    target: string
    via: string[]
  }
  recommended_agent: 'agent_zero' | 'hermes' | 'space_agent' | 'mini_agent' | null
  recommended_model: string | null
  recommended_mini_agent_type: 'research' | 'report' | 'qa' | 'workflow' | 'coding' | null
  policy_result: 'allowed' | 'blocked' | 'requires_session' | 'missing_credential'
  blocked_reason: string | null
  confidence: 'low' | 'medium' | 'high'
  rationale: string
  fallback_route: string | null
  execution_enabled: false
  writes_enabled: false
  audit_required: true
  no_secrets_exposed: true
  owner_visible_summary: string
}

const UNKNOWN_CONNECTOR_PATTERN = /(?:use|connect|run|call)\s+([a-z][a-z0-9_-]{2,})/i
const KNOWN_WORDS = new Set([
  'agent',
  'agentmail',
  'build',
  'buildwiki',
  'codex',
  'drive',
  'email',
  'firecrawl',
  'gateway',
  'google',
  'heygen',
  'hermes',
  'mail',
  'mcp',
  'mem',
  'mempalace',
  'mission',
  'onedrive',
  'opencloud',
  'openrouter',
  'pi',
  'telegram',
  'wiki',
  'article',
  'browser',
  'browse',
  'crawl',
  'extract',
  'online',
  'research',
  'scrape',
  'search',
  'space',
  'video',
  'web',
  'webpage',
  'website',
  'youtube',
  'zapier',
])

export function recommendPiGatewayRoute(
  registry: GatewayRegistry,
  input: { ownerRequest: string; requester?: PiDispatcherRecommendation['requester']; generatedAt?: string },
): PiDispatcherRecommendation {
  const generatedAt = input.generatedAt || registry.generated_at
  const ownerRequest = sanitize(input.ownerRequest)
  const unknownConnector = findUnknownConnector(registry, ownerRequest)
  if (unknownConnector) {
    return blockedRecommendation({
      generatedAt,
      ownerRequest,
      requester: input.requester || 'gateway',
      blockedReason: 'unknown_connector_not_registered',
      rationale: `Pi cannot recommend ${unknownConnector} because it is not present in Gateway registry.`,
    })
  }

  const plan = planGatewayRoute(registry, { ownerRequest, source: input.requester || 'owner', generatedAt })
  const operationType = classifyOperation(ownerRequest, plan.classification)
  const model = selectModelRecommendation(registry, ownerRequest)
  const miniAgentType = recommendMiniAgentType(ownerRequest)
  const recommendedAgent = recommendAgent(plan.classification, ownerRequest, miniAgentType)
  const target = recommendedAgent === 'mini_agent'
    ? 'mini_agents'
    : recommendedAgent === 'space_agent'
      ? 'space_agent'
      : recommendedAgent === 'hermes'
        ? 'hermes'
        : plan.dispatch_target
  const via = recommendedAgent === 'mini_agent'
    ? ['owner', 'gateway', 'agent_zero', 'gateway', 'mini_agents']
    : recommendedAgent === 'space_agent'
      ? ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent']
      : plan.route_via

  return {
    ok: !plan.blocked,
    mode: 'pi_dispatcher_shadow_recommendation',
    generated_at: generatedAt,
    shadow_mode: true,
    requester: input.requester || 'gateway',
    owner_request: ownerRequest,
    classification: plan.classification,
    operation_type: operationType,
    selected_route: {
      source: input.requester || 'owner',
      target,
      via,
    },
    recommended_agent: recommendedAgent,
    recommended_model: model,
    recommended_mini_agent_type: miniAgentType,
    policy_result: plan.route_decision,
    blocked_reason: plan.blocker,
    confidence: confidenceFor(plan.classification, plan.blocked),
    rationale: rationaleFor({ classification: plan.classification, ownerRequest, recommendedAgent, model, miniAgentType, blockedReason: plan.blocker }),
    fallback_route: plan.blocked ? 'agent_zero_manual_review' : null,
    execution_enabled: false,
    writes_enabled: false,
    audit_required: true,
    no_secrets_exposed: true,
    owner_visible_summary: plan.blocked
      ? `Pi recommends blocking this route: ${plan.blocker}.`
      : `Pi recommends ${target} in shadow mode; Agent Zero remains commander.`,
  }
}

function blockedRecommendation(input: {
  generatedAt: string
  ownerRequest: string
  requester: PiDispatcherRecommendation['requester']
  blockedReason: string
  rationale: string
}): PiDispatcherRecommendation {
  return {
    ok: false,
    mode: 'pi_dispatcher_shadow_recommendation',
    generated_at: input.generatedAt,
    shadow_mode: true,
    requester: input.requester,
    owner_request: input.ownerRequest,
    classification: 'unknown',
    operation_type: 'read',
    selected_route: { source: input.requester, target: 'blocked', via: ['owner', 'gateway', 'agent_zero'] },
    recommended_agent: 'agent_zero',
    recommended_model: null,
    recommended_mini_agent_type: null,
    policy_result: 'blocked',
    blocked_reason: input.blockedReason,
    confidence: 'high',
    rationale: input.rationale,
    fallback_route: 'agent_zero_manual_review',
    execution_enabled: false,
    writes_enabled: false,
    audit_required: true,
    no_secrets_exposed: true,
    owner_visible_summary: `Pi blocked the route in shadow mode: ${input.blockedReason}.`,
  }
}

function classifyOperation(ownerRequest: string, classification: GatewayRouteClassification): PiOperationType {
  const text = ownerRequest.toLowerCase()
  const write = /\b(?:write|save|send|upload|create|append|update|delete|generate|mount|run|execute|start)\b/.test(text)
  const execute = /\b(?:run|execute|start|restart|generate|trigger|mount)\b/.test(text) || classification === 'protected_action'
  if (write && execute) return 'mixed'
  if (execute) return 'execute'
  if (write || ['upload', 'sync'].includes(classification)) return 'write'
  return 'read'
}

function recommendAgent(
  classification: GatewayRouteClassification,
  ownerRequest: string,
  miniAgentType: PiDispatcherRecommendation['recommended_mini_agent_type'],
): PiDispatcherRecommendation['recommended_agent'] {
  const text = ownerRequest.toLowerCase()
  if (classification === 'research' || /browser|browse|webpage|web page|website|article|youtube|you tube|video|firecrawl|fire crawl|crawl|scrape|search the web|web search|extract page/.test(text)) return 'space_agent'
  if (classification === 'skill' || /workflow|skill design|design a skill|mini-agent spec/.test(text)) return 'hermes'
  if (miniAgentType && /small|scoped|summarize|draft|check|research/.test(text)) return 'mini_agent'
  return 'agent_zero'
}

function recommendMiniAgentType(ownerRequest: string): PiDispatcherRecommendation['recommended_mini_agent_type'] {
  const text = ownerRequest.toLowerCase()
  if (/research|investigate|summarize|browser|browse|webpage|web page|website|article|youtube|you tube|video|firecrawl|fire crawl|crawl|scrape/.test(text)) return 'research'
  if (/report|brief|write[-\s]?up|summary/.test(text)) return 'report'
  if (/qa|test|verify|checklist/.test(text)) return 'qa'
  if (/workflow|automation/.test(text)) return 'workflow'
  if (/coding|code|implementation/.test(text)) return 'coding'
  return null
}

function selectModelRecommendation(registry: GatewayRegistry, ownerRequest: string): string | null {
  const models = registry.capabilities.filter((capability) => capability.kind === 'model' && capability.status !== 'blocked' && capability.status !== 'missing')
  if (models.length === 0) return null
  const hard = /architecture|complex|hard|multi-step|security|debug|synthesis|large/.test(ownerRequest.toLowerCase())
  const selected = hard ? findStrongModel(models) : findLowCostModel(models)
  return selected?.id || null
}

function findLowCostModel(models: GatewayCapability[]): GatewayCapability | null {
  return models.find((model) => /ollama|local|mini|small|gpt_4o_mini|gpt-4o-mini/.test(model.id.toLowerCase())) || models[0] || null
}

function findStrongModel(models: GatewayCapability[]): GatewayCapability | null {
  return models.find((model) => /openrouter|claude|sonnet|gpt_4|gpt-4|openai/.test(model.id.toLowerCase())) || models[0] || null
}

function confidenceFor(classification: GatewayRouteClassification, blocked: boolean): PiDispatcherRecommendation['confidence'] {
  if (blocked) return 'high'
  if (classification === 'chat' || classification === 'skill') return 'high'
  if (classification === 'model' || classification === 'tool') return 'medium'
  return 'medium'
}

function rationaleFor(input: {
  classification: GatewayRouteClassification
  ownerRequest: string
  recommendedAgent: PiDispatcherRecommendation['recommended_agent']
  model: string | null
  miniAgentType: PiDispatcherRecommendation['recommended_mini_agent_type']
  blockedReason: string | null
}): string {
  if (input.blockedReason) return `Gateway policy blocks the route because ${input.blockedReason}.`
  if (input.recommendedAgent === 'hermes') return 'Workflow and skill design should route to Hermes through Agent Zero.'
  if (input.recommendedAgent === 'space_agent') return 'Browser, web, YouTube, video, page extraction, crawl, scrape, search, and Firecrawl research should route through Pi recommendation and Agent Zero approval to Space Agent.'
  if (input.recommendedAgent === 'mini_agent') return `A scoped ${input.miniAgentType || 'mini-agent'} can handle the small task under Agent Zero supervision.`
  if (input.classification === 'model' && input.model) return `Pi recommends model route ${input.model} while keeping execution disabled in shadow mode.`
  return 'Owner commands route to Agent Zero by default.'
}

function findUnknownConnector(registry: GatewayRegistry, ownerRequest: string): string | null {
  const match = ownerRequest.match(UNKNOWN_CONNECTOR_PATTERN)
  const candidate = match?.[1]?.toLowerCase() || ''
  if (!candidate || KNOWN_WORDS.has(candidate)) return null
  const haystack = registry.capabilities.map((capability) => `${capability.id} ${capability.label}`).join(' ').toLowerCase()
  const nodeHaystack = registry.nodes.map((node) => `${node.id} ${node.label}`).join(' ').toLowerCase()
  return haystack.includes(candidate) || nodeHaystack.includes(candidate) ? null : candidate
}

function sanitize(value: string): string {
  return String(value || '')
    .replace(/(?:\/home\/tony|\/a0\/|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi, '[redacted-path]')
    .replace(/(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*[:=]\s*[^,\s}]+)/gi, '[redacted-secret]')
    .trim()
}
