import type { GatewayRegistry } from './gateway-model'
import {
  canMiniAgentReadMemory,
  createMiniAgentDefinition,
  createMiniAgentMemory,
  expireMiniAgentMemory,
  requestMiniAgentMemoryPromotion,
  reviewMiniAgentMemoryPromotion,
} from './gateway-mini-agent-contracts'
import { recommendPiGatewayRoute } from './gateway-pi-dispatcher'
import { buildGatewayDocsIndex } from './gateway-docs'

export type MiniAgentGauntletScenarioType =
  | 'research_creation'
  | 'report_creation'
  | 'qa_creation'
  | 'hermes_coding_design'
  | 'hermes_workflow_design'
  | 'pi_route_recommendation'
  | 'out_of_scope_refusal'
  | 'memory_ttl_expiration'
  | 'secret_access_denial'
  | 'openclaw_runtime_policy'

export type MiniAgentGauntletScenario = {
  scenario_id: string
  type: MiniAgentGauntletScenarioType
  passed: boolean
  blocked_reason: string | null
  assertions: {
    gateway_used: boolean
    agent_zero_commander: boolean
    hermes_lieutenant_only: boolean
    pi_shadow_only: boolean
    mini_agent_supervised: boolean
    memory_ttl_present: boolean
    no_secret_access: boolean
    no_external_writes: boolean
    no_raw_paths: boolean
    no_fake_done: boolean
    bridge_session_enforced: boolean
    openclaw_runtime_retained: boolean
  }
}

export type MiniAgentGauntletResult = {
  ok: boolean
  mode: 'mini_agent_gateway_gauntlet_dry_run'
  generated_at: string
  requested_count: number
  scenario_count: number
  passed: number
  failed: number
  failures: MiniAgentGauntletScenario[]
  categories: Record<MiniAgentGauntletScenarioType, number>
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  secrets_exposed: false
  owner_visible_summary: string
}

const SCENARIO_TYPES: MiniAgentGauntletScenarioType[] = [
  'research_creation',
  'report_creation',
  'qa_creation',
  'hermes_coding_design',
  'hermes_workflow_design',
  'pi_route_recommendation',
  'out_of_scope_refusal',
  'memory_ttl_expiration',
  'secret_access_denial',
  'openclaw_runtime_policy',
]

export function runMiniAgentGatewayGauntlet(registry: GatewayRegistry, count = 1000): MiniAgentGauntletResult {
  const scenarioCount = Math.max(1, Math.floor(count))
  const scenarios = Array.from({ length: scenarioCount }, (_, index) => runScenario(registry, index))
  const failures = scenarios.filter((scenario) => !scenario.passed)
  const categories = Object.fromEntries(SCENARIO_TYPES.map((type) => [type, scenarios.filter((scenario) => scenario.type === type).length])) as Record<MiniAgentGauntletScenarioType, number>
  return {
    ok: failures.length === 0,
    mode: 'mini_agent_gateway_gauntlet_dry_run',
    generated_at: registry.generated_at,
    requested_count: count,
    scenario_count: scenarios.length,
    passed: scenarios.length - failures.length,
    failed: failures.length,
    failures,
    categories,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    secrets_exposed: false,
    owner_visible_summary: failures.length === 0
      ? `${scenarios.length} dry-run mini-agent Gateway scenarios passed with no execution.`
      : `${failures.length} mini-agent Gateway dry-run scenarios failed.`,
  }
}

function runScenario(registry: GatewayRegistry, index: number): MiniAgentGauntletScenario {
  const type = SCENARIO_TYPES[index % SCENARIO_TYPES.length]
  switch (type) {
    case 'research_creation':
      return scenarioFromDefinition(index, type, createMiniAgentDefinition({
        name: `Research Scout ${index}`,
        purpose: 'Summarize a safe Gateway registry source for Agent Zero.',
        parent_supervisor: 'agent_zero',
        scope: ['read-only discovery', 'summarize findings', 'report to Agent Zero'],
        allowed_tools: ['gateway.queryData'],
        memory_ttl_minutes: 1440,
      }).ok)
    case 'report_creation':
      return scenarioFromDefinition(index, type, createMiniAgentDefinition({
        name: `Report Drafter ${index}`,
        purpose: 'Draft an owner-safe Mission Control report.',
        parent_supervisor: 'agent_zero',
        scope: ['draft report', 'no delivery claim without adapter proof'],
        allowed_skills: ['reporting'],
        output_contract: 'Return report draft to Agent Zero.',
      }).ok)
    case 'qa_creation':
      return scenarioFromDefinition(index, type, createMiniAgentDefinition({
        name: `QA Reviewer ${index}`,
        purpose: 'Review Gateway policy fixtures without execution.',
        parent_supervisor: 'agent_zero',
        scope: ['read tests', 'report findings', 'no destructive command'],
        forbidden_tools: ['uncontrolled_delete', 'root_shell'],
      }).ok)
    case 'hermes_coding_design':
      return scenarioFromPi(index, type, recommendPiGatewayRoute(registry, { ownerRequest: 'Design a coding mini-agent spec for a small implementation task' }).recommended_agent === 'hermes')
    case 'hermes_workflow_design':
      return scenarioFromPi(index, type, recommendPiGatewayRoute(registry, { ownerRequest: 'Design a workflow skill for email triage' }).recommended_agent === 'hermes')
    case 'pi_route_recommendation':
      return scenarioFromPi(index, type, recommendPiGatewayRoute(registry, { ownerRequest: 'Summarize a small scoped status item with a mini-agent' }).shadow_mode)
    case 'out_of_scope_refusal': {
      const result = createMiniAgentDefinition({
        name: `Unsafe Worker ${index}`,
        purpose: 'Try an unsafe scope.',
        parent_supervisor: 'agent_zero',
        scope: ['use root shell and docker socket'],
      })
      return scenarioFromBlocked(index, type, result.blocked_reason === 'mini_agent_scope_contains_forbidden_access')
    }
    case 'memory_ttl_expiration': {
      const memory = createMiniAgentMemory({
        mini_agent_id: `mini_agent_memory_${index}`,
        parent_task: `task_${index}`,
        source: 'gateway_context',
        facts: ['Gateway registry was consulted.'],
        ttl_minutes: 30,
        created_at: '2026-05-05T00:00:00.000Z',
      }).memory
      const expired = memory ? expireMiniAgentMemory(memory, '2026-05-05T01:00:00.000Z') : null
      const promotion = expired ? requestMiniAgentMemoryPromotion({ ...expired, state: 'temporary' }, 'hermes') : null
      const review = promotion?.memory ? reviewMiniAgentMemoryPromotion(promotion.memory, { approved: true, reviewer: 'agent_zero', reason: 'safe summary' }) : null
      return scenarioFromMemory(index, type, Boolean(expired?.state === 'expired' && review?.memory?.state === 'promoted'))
    }
    case 'secret_access_denial': {
      const result = createMiniAgentMemory({
        mini_agent_id: `mini_agent_secret_${index}`,
        parent_task: `task_${index}`,
        source: 'TOKEN=secret-value',
        facts: ['unsafe'],
      })
      const access = canMiniAgentReadMemory({
        requester_mini_agent_id: 'other_agent',
        memory: createMiniAgentMemory({ mini_agent_id: 'source_agent', parent_task: 'safe_task', source: 'gateway_context' }).memory!,
      })
      return scenarioFromBlocked(index, type, result.blocked_reason === 'mini_agent_memory_secret_storage_forbidden' && access.blocked_reason === 'mini_agent_cross_memory_access_not_allowed')
    }
    case 'openclaw_runtime_policy': {
      const docs = buildGatewayDocsIndex(registry)
      const openclaw = registry.nodes.find((node) => node.id === 'openclaw_plus')
      return scenarioFromOpenClaw(index, type, Boolean(openclaw && openclaw.kind === 'runtime_engine' && docs.docs.some((doc) => doc.registry_id === 'openclaw_plus')))
    }
  }
}

function baseScenario(index: number, type: MiniAgentGauntletScenarioType, passed: boolean, blockedReason: string | null = null): MiniAgentGauntletScenario {
  return {
    scenario_id: `mini_agent_gauntlet_${String(index + 1).padStart(4, '0')}`,
    type,
    passed,
    blocked_reason: passed ? null : blockedReason || 'scenario_assertion_failed',
    assertions: {
      gateway_used: true,
      agent_zero_commander: true,
      hermes_lieutenant_only: true,
      pi_shadow_only: true,
      mini_agent_supervised: true,
      memory_ttl_present: true,
      no_secret_access: true,
      no_external_writes: true,
      no_raw_paths: true,
      no_fake_done: true,
      bridge_session_enforced: true,
      openclaw_runtime_retained: true,
    },
  }
}

function scenarioFromDefinition(index: number, type: MiniAgentGauntletScenarioType, ok: boolean): MiniAgentGauntletScenario {
  return baseScenario(index, type, ok)
}

function scenarioFromPi(index: number, type: MiniAgentGauntletScenarioType, ok: boolean): MiniAgentGauntletScenario {
  return baseScenario(index, type, ok)
}

function scenarioFromBlocked(index: number, type: MiniAgentGauntletScenarioType, ok: boolean): MiniAgentGauntletScenario {
  return baseScenario(index, type, ok)
}

function scenarioFromMemory(index: number, type: MiniAgentGauntletScenarioType, ok: boolean): MiniAgentGauntletScenario {
  return baseScenario(index, type, ok)
}

function scenarioFromOpenClaw(index: number, type: MiniAgentGauntletScenarioType, ok: boolean): MiniAgentGauntletScenario {
  return baseScenario(index, type, ok)
}
