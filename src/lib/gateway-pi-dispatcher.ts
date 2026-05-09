import type { GatewayCapability, GatewayRegistry } from './gateway-model'
import type { MissionControlCanonicalStatus, MissionControlClosureBlockerClass } from './agent-zero-bridge'
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
  recommended_agent: 'agent_zero' | 'hermes' | 'space_agent' | 'mini_agent' | 'paperclip' | 'openclaw_plus' | 'delivery_adapter' | null
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

export type PiDispatcherStatusPayload = {
  ok: true
  mode: 'pi_dispatcher_shadow_status'
  generated_at: string
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  proof_packet: {
    lane: 'Pi'
    timestamp: string
    runtime_commit: string | null
    route_or_service_checked: '/api/bridge/pi/status'
    result: MissionControlCanonicalStatus
    blocker: string | null
    blocker_class: MissionControlClosureBlockerClass
    audit_pointer: '/api/bridge/pi/status'
    safe_log_pointer: null
    rollback_command: string
    execution_enabled: false
    writes_enabled: false
    secrets_exposed: false
    raw_paths_exposed: false
  }
  node_id: 'pi'
  agent_hub_id: 'pi-mono'
  canonical_gateway_node: 'pi_dispatcher'
  role: 'Dispatcher / Route Optimizer Candidate'
  authority: 'advisory_only'
  status: 'shadow_live'
  runtime: {
    installed: true
    reachable: true
    mode: 'mission_control_in_process_shadow'
    service_mode: false
    cli_mode: false
    rpc_mode: false
    sdk_mode: true
    public_exposure: false
    blocker: 'advisory_only_no_execution_authority'
  }
  capabilities: {
    route_recommendations: true
    model_recommendations: true
    agent_recommendations: true
    mini_agent_recommendations: true
    policy_explanation: true
  }
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  tools_enabled: false
  can_bypass_gateway: false
  commander: false
  replaces_agent_zero: false
  replaces_hermes: false
  replaces_paperclip: false
  replaces_spaceagent: false
  replaces_openclaw_plus: false
  supervisors: ['gateway', 'agent_zero']
  blockers: string[]
  safe_probe: PiDispatcherRecommendation
  last_result: PiDispatcherRecommendation
  advisory_result_proven: true
  audit_trail: Array<{
    event: 'pi.dispatcher.recommendation.generated'
    route_target: string
    decision: PiDispatcherRecommendation['policy_result']
    blocked_reason: string | null
    external_write: false
    execution_enabled: false
    writes_enabled: false
    secrets_exposed: false
    recorded_at: string
  }>
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
  'screenshot',
  'page',
  'state',
  'map',
  'space',
  'smb',
  'fork',
  'fork2',
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
  const override = specializedRouteOverride(registry, ownerRequest, plan.classification)
  const operationType = classifyOperation(ownerRequest, plan.classification)
  const model = selectModelRecommendation(registry, ownerRequest)
  const miniAgentType = recommendMiniAgentType(ownerRequest)
  const recommendedAgent = override?.recommendedAgent || recommendAgent(plan.classification, ownerRequest, miniAgentType)
  const target = override?.target || (recommendedAgent === 'mini_agent'
    ? 'mini_agents'
    : recommendedAgent === 'space_agent'
      ? 'space_agent'
      : recommendedAgent === 'hermes'
        ? 'hermes'
        : plan.dispatch_target)
  const via = override?.via || (recommendedAgent === 'mini_agent'
    ? ['owner', 'gateway', 'agent_zero', 'gateway', 'mini_agents']
    : recommendedAgent === 'space_agent'
      ? ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent']
      : plan.route_via)
  const policyResult = override?.policyResult || plan.route_decision
  const blockedReason = override?.blockedReason ?? plan.blocker
  const routeBlocked = Boolean(blockedReason) || policyResult === 'blocked' || policyResult === 'missing_credential' || policyResult === 'requires_session'

  return {
    ok: !routeBlocked,
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
    policy_result: policyResult,
    blocked_reason: blockedReason,
    confidence: confidenceFor(plan.classification, plan.blocked),
    rationale: override?.rationale || rationaleFor({ classification: plan.classification, ownerRequest, recommendedAgent, model, miniAgentType, blockedReason }),
    fallback_route: routeBlocked ? 'agent_zero_manual_review' : null,
    execution_enabled: false,
    writes_enabled: false,
    audit_required: true,
    no_secrets_exposed: true,
    owner_visible_summary: routeBlocked
      ? `Pi recommends blocking or gating this route: ${blockedReason || policyResult}.`
      : `Pi recommends ${target} in shadow mode; Agent Zero remains commander.`,
  }
}

export function buildPiDispatcherStatusPayload(registry: GatewayRegistry, generatedAt = registry.generated_at): PiDispatcherStatusPayload {
  const safeProbe = recommendPiGatewayRoute(registry, {
    ownerRequest: 'Given this owner request, which route would you recommend?',
    requester: 'gateway',
    generatedAt,
  })
  return {
    ok: true,
    mode: 'pi_dispatcher_shadow_status',
    generated_at: generatedAt,
    canonical_status: 'LIVE',
    blocker_class: 'NONE',
    proof_packet: {
      lane: 'Pi',
      timestamp: generatedAt,
      runtime_commit: null,
      route_or_service_checked: '/api/bridge/pi/status',
      result: 'LIVE',
      blocker: null,
      blocker_class: 'NONE',
      audit_pointer: '/api/bridge/pi/status',
      safe_log_pointer: null,
      rollback_command: 'git revert <day-03-pi-commit>',
      execution_enabled: false,
      writes_enabled: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    },
    node_id: 'pi',
    agent_hub_id: 'pi-mono',
    canonical_gateway_node: 'pi_dispatcher',
    role: 'Dispatcher / Route Optimizer Candidate',
    authority: 'advisory_only',
    status: 'shadow_live',
    runtime: {
      installed: true,
      reachable: true,
      mode: 'mission_control_in_process_shadow',
      service_mode: false,
      cli_mode: false,
      rpc_mode: false,
      sdk_mode: true,
      public_exposure: false,
      blocker: 'advisory_only_no_execution_authority',
    },
    capabilities: {
      route_recommendations: true,
      model_recommendations: true,
      agent_recommendations: true,
      mini_agent_recommendations: true,
      policy_explanation: true,
    },
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    tools_enabled: false,
    can_bypass_gateway: false,
    commander: false,
    replaces_agent_zero: false,
    replaces_hermes: false,
    replaces_paperclip: false,
    replaces_spaceagent: false,
    replaces_openclaw_plus: false,
    supervisors: ['gateway', 'agent_zero'],
    blockers: [],
    safe_probe: safeProbe,
    last_result: safeProbe,
    advisory_result_proven: true,
    audit_trail: [{
      event: 'pi.dispatcher.recommendation.generated',
      route_target: safeProbe.selected_route.target,
      decision: safeProbe.policy_result,
      blocked_reason: safeProbe.blocked_reason,
      external_write: false,
      execution_enabled: false,
      writes_enabled: false,
      secrets_exposed: false,
      recorded_at: generatedAt,
    }],
    no_secrets_exposed: true,
    owner_visible_summary: 'Pi is live as a Mission Control in-process shadow dispatcher. It recommends routes but cannot execute, write, call tools, or replace Agent Zero.',
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
  if (classification === 'research') return 'space_agent'
  if (classification === 'skill' || /workflow|skill design|design a skill|mini-agent spec/.test(text)) return 'hermes'
  if (miniAgentType && /small|scoped|summarize|draft|check|research/.test(text)) return 'mini_agent'
  if (['chat', 'model', 'tool', 'memory', 'sync', 'upload', 'report', 'protected_action', 'event'].includes(classification)) return 'agent_zero'
  if (/browser|browse|webpage|web page|website|article|youtube|you tube|video|firecrawl|fire crawl|crawl|scrape|map|search the web|web search|extract page|screenshot|screen shot|page state|agents? (?:normally )?(?:cannot|can't) access|cannot access (?:this |the )?(?:site|video)/.test(text)) return 'space_agent'
  if (miniAgentType && /small|scoped|summarize|draft|check|research/.test(text)) return 'mini_agent'
  return 'agent_zero'
}

function specializedRouteOverride(
  registry: GatewayRegistry,
  ownerRequest: string,
  classification: GatewayRouteClassification,
): {
  target: string
  via: string[]
  recommendedAgent: PiDispatcherRecommendation['recommended_agent']
  policyResult: PiDispatcherRecommendation['policy_result']
  blockedReason: string | null
  rationale: string
} | null {
  const text = ownerRequest.toLowerCase()

  if (classification === 'research' && /youtube|you tube|transcript|video/.test(text)) {
    return {
      target: 'space_agent',
      via: ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'],
      recommendedAgent: 'space_agent',
      policyResult: 'allowed',
      blockedReason: null,
      rationale: 'Pi recommends Space Agent plus the YouTube metadata/transcript connector for public video research; no full video download.',
    }
  }

  if (/fire\s*crawl|firecrawl|scrape|crawl|map|extract/.test(text)) {
    const firecrawl = registry.capabilities.find((capability) => capability.id.startsWith('space_agent.firecrawl.'))
    const blocker = firecrawl?.blockers?.[0] || (firecrawl?.status === 'blocked' ? 'firecrawl_credential_required' : null) || (!firecrawl ? 'firecrawl_credential_required' : null)
    return {
      target: 'space_agent',
      via: ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'],
      recommendedAgent: 'space_agent',
      policyResult: blocker ? 'missing_credential' : 'allowed',
      blockedReason: blocker,
      rationale: blocker
        ? `Pi recommends Space Agent plus Firecrawl, but Gateway must block Firecrawl until ${blocker} is resolved.`
        : 'Pi recommends Space Agent plus Firecrawl for read-only scrape/crawl/map/extract research.',
    }
  }

  if (/workforce|paperclip|co-?worker|task queue|daily work|heartbeat|budget|work product/.test(text)) {
    return {
      target: 'paperclip',
      via: ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'paperclip'],
      recommendedAgent: 'paperclip',
      policyResult: 'requires_session',
      blockedReason: 'paperclip_task_write_requires_bridge_session',
      rationale: 'Pi recommends Paperclip for workforce/task/co-worker orchestration, with Agent Zero final approval and Gateway policy gating.',
    }
  }

  if (/openclaw|runtime|mini-agent execution|execute.*mini-agent|run.*mini-agent|activate.*mini-agent|execute.*skill|run.*skill/.test(text)) {
    return {
      target: 'openclaw_plus',
      via: ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'paperclip', 'openclaw_plus'],
      recommendedAgent: 'openclaw_plus',
      policyResult: 'requires_session',
      blockedReason: 'openclaw_runtime_execution_requires_bridge_session',
      rationale: 'Pi recommends OpenClaw+ through Gateway, Agent Zero, Paperclip, and a scoped Bridge Session for runtime/skill/mini-agent execution.',
    }
  }

  if (/deliver|delivery|telegram|agentmail|google drive|onedrive|one drive|upload|attach/.test(text)) {
    return {
      target: 'delivery_adapter',
      via: ['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'delivery_adapter'],
      recommendedAgent: 'delivery_adapter',
      policyResult: 'requires_session',
      blockedReason: 'delivery_adapter_requires_bridge_session_and_configured_connector',
      rationale: 'Pi recommends the Gateway delivery adapter path, with sends/uploads gated by Bridge Session and connector proof.',
    }
  }

  return null
}

function recommendMiniAgentType(ownerRequest: string): PiDispatcherRecommendation['recommended_mini_agent_type'] {
  const text = ownerRequest.toLowerCase()
  if (/research|investigate|summarize|search the web|web search|search web|read website|read page|browser|browse|webpage|web page|website|article|youtube|you tube|video|firecrawl|fire crawl|crawl|scrape|map|screenshot|screen shot|page state|agents? (?:normally )?(?:cannot|can't) access|cannot access (?:this |the )?(?:site|video)/.test(text)) return 'research'
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
  if (input.recommendedAgent === 'space_agent') return 'Web search, page reading, Firecrawl scrape/crawl/map/extract, browser interaction, YouTube/video inspection, screenshot/page-state, and normally inaccessible site/video research should route through Pi recommendation and Agent Zero approval to Space Agent.'
  if (input.recommendedAgent === 'paperclip') return 'Workforce, co-worker, task queue, heartbeat, budget, and work product requests should route to Paperclip through Agent Zero and Gateway policy.'
  if (input.recommendedAgent === 'openclaw_plus') return 'Runtime, skill, mini-agent, tool, and report execution requests should route through Paperclip to OpenClaw+ only after Bridge Session approval.'
  if (input.recommendedAgent === 'delivery_adapter') return 'Report delivery requests should route to the Gateway delivery adapter and remain gated until the connector and Bridge Session are proven.'
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
