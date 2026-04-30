import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { authJson, hasEnv } from '@/lib/designer-module-api'
import { getZapierToolBridge } from '@/lib/zapier-tool-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TaskType =
  | 'status_check'
  | 'planning'
  | 'code_change'
  | 'connector_read'
  | 'connector_write'
  | 'memory_or_brain_sync'
  | 'agent_request'
  | 'deployment_or_infra'
  | 'credential_setup'
  | 'general'

type DecisionState =
  | 'ALLOWED_READ_ONLY'
  | 'OWNER_APPROVAL_REQUIRED'
  | 'CREDENTIAL_REQUIRED'
  | 'BACKEND_REQUIRED'
  | 'BLOCKED'

type PreflightRequest = {
  agent_id?: string
  owner_goal?: string
  task_type?: TaskType
  requested_action?: string
  requested_resources?: string[]
  connector?: string
  target?: string
  expected_duration_seconds?: number
}

type LatestPreflightResult = {
  id: string
  generated_at: string
  agent_id: string
  task_type: TaskType
  connector: string | null
  decision: DecisionState
  reason: string
  selected_route: ReturnType<typeof routeFor>
  selected_tools: string[]
  selected_models: string[]
  selected_skills: string[]
  selected_integrations: string[]
  selected_mcps: string[]
  restrictions: string[]
  approval_gates: string[]
  missing_credentials: string[]
  credential_required: boolean
  next_action: string
}

const TASK_TYPES: TaskType[] = [
  'status_check',
  'planning',
  'code_change',
  'connector_read',
  'connector_write',
  'memory_or_brain_sync',
  'agent_request',
  'deployment_or_infra',
  'credential_setup',
  'general',
]

const PROTECTED_KEYWORDS = [
  'apply migration',
  'approval',
  'caddy',
  'cloudflare',
  'credential',
  'delete',
  'deploy',
  'docker',
  'env',
  'execute',
  'firewall',
  'governance',
  'memory write',
  'push',
  'restart',
  'route change',
  'send email',
  'voice',
  'write',
  'zapier',
]

const READ_ONLY_KEYWORDS = [
  'audit',
  'check',
  'diagnose',
  'inspect',
  'list',
  'plan',
  'read',
  'report',
  'search',
  'status',
  'verify',
]

const CONNECTOR_CREDENTIALS: Record<string, string[]> = {
  firecrawl: ['FIRECRAWL_API_KEY'],
  zapier: ['ZAPIER_MCP_URL', 'ZAPIER_MCP_SERVER', 'ZAPIER_ACCESS_TOKEN', 'ZAPIER_API_KEY'],
  n8n: ['N8N_BASE_URL', 'N8N_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  nvidia: ['NVIDIA_API_KEY', 'NGC_API_KEY', 'NVIDIA_NIM_API_KEY'],
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word))
}

function classifyTask(input: PreflightRequest): TaskType {
  if (input.task_type && TASK_TYPES.includes(input.task_type)) return input.task_type

  const text = [
    input.owner_goal,
    input.requested_action,
    input.connector,
    input.target,
    ...(input.requested_resources || []),
  ].map(normalize).join(' ')

  if (/(credential|secret|\.env|api key|token)/.test(text)) return 'credential_setup'
  if (/(firewall|caddy|cloudflare|docker|restart|deploy|service|migration)/.test(text)) return 'deployment_or_infra'
  if (/(memory|brain sync|obsidian|governance)/.test(text)) return 'memory_or_brain_sync'
  if (/(zapier|n8n|firecrawl|mcp|connector|send|post|upload|execute|run workflow)/.test(text)) {
    return includesAny(text, ['send', 'post', 'upload', 'execute', 'write', 'create', 'delete', 'update'])
      ? 'connector_write'
      : 'connector_read'
  }
  if (/(agent zero|hermes|agent|handoff|delegate)/.test(text)) return 'agent_request'
  if (/(code|patch|build|typecheck|test|route|endpoint)/.test(text)) return 'code_change'
  if (includesAny(text, READ_ONLY_KEYWORDS)) return 'status_check'
  if (/(plan|roadmap|strategy|research)/.test(text)) return 'planning'
  return 'general'
}

function detectConnector(input: PreflightRequest): string | null {
  const text = [
    input.connector,
    input.owner_goal,
    input.requested_action,
    input.target,
    ...(input.requested_resources || []),
  ].map(normalize).join(' ')

  for (const name of Object.keys(CONNECTOR_CREDENTIALS)) {
    if (text.includes(name)) return name
  }

  if (/(heygen|avatar video|talking avatar|create video|generate video)/.test(text)) return 'zapier'
  if (text.includes('mcp')) return 'mcp'
  if (text.includes('skills')) return 'skills'
  if (text.includes('hermes')) return 'hermes'
  if (text.includes('agent zero')) return 'agent_zero'
  return null
}

let latestPreflightResult: LatestPreflightResult | null = null

function credentialPresence(names: string[]): Record<string, boolean> {
  return Object.fromEntries(names.map((name) => [name, hasEnv(name)]))
}

function missingCredentials(connector: string | null): string[] {
  if (!connector) return []
  const names = CONNECTOR_CREDENTIALS[connector] || []
  if (connector === 'zapier') {
    const hasTransport = hasEnv('ZAPIER_MCP_URL') || hasEnv('ZAPIER_MCP_SERVER')
    const hasToken = hasEnv('ZAPIER_ACCESS_TOKEN') || hasEnv('ZAPIER_API_KEY')
    const missing = []
    if (!hasTransport) missing.push('ZAPIER_MCP_URL or ZAPIER_MCP_SERVER')
    if (!hasToken) missing.push('ZAPIER_ACCESS_TOKEN or ZAPIER_API_KEY')
    return missing
  }
  return names.filter((name) => !hasEnv(name))
}

function buildDecision(input: PreflightRequest, taskType: TaskType, connector: string | null) {
  const text = [
    input.owner_goal,
    input.requested_action,
    input.connector,
    input.target,
    ...(input.requested_resources || []),
  ].map(normalize).join(' ')

  const missing = missingCredentials(connector)
  const protectedIntent = includesAny(text, PROTECTED_KEYWORDS)
  const writeTask = taskType === 'connector_write' || taskType === 'deployment_or_infra' || taskType === 'credential_setup'
  const memoryOrAgentProtected = taskType === 'memory_or_brain_sync' || (taskType === 'agent_request' && protectedIntent)

  if (taskType === 'credential_setup') {
    return {
      state: 'OWNER_APPROVAL_REQUIRED' as DecisionState,
      reason: 'Credential changes require owner action through the approved secret path.',
      http_status_if_attempted: 423,
      missing_credentials: missing,
    }
  }

  if (missing.length > 0 && taskType !== 'status_check' && taskType !== 'planning') {
    return {
      state: 'CREDENTIAL_REQUIRED' as DecisionState,
      reason: 'Required connector/provider credentials are missing by name.',
      http_status_if_attempted: 503,
      missing_credentials: missing,
    }
  }

  if (writeTask || memoryOrAgentProtected || protectedIntent) {
    return {
      state: 'OWNER_APPROVAL_REQUIRED' as DecisionState,
      reason: 'Protected or mutating action requires approval/audit persistence before execution.',
      http_status_if_attempted: 423,
      missing_credentials: missing,
    }
  }

  if (taskType === 'connector_read' && ['n8n', 'firecrawl'].includes(connector || '')) {
    return {
      state: 'BACKEND_REQUIRED' as DecisionState,
      reason: 'Read-only connector backend is not fully wired for this connector yet.',
      http_status_if_attempted: 503,
      missing_credentials: missing,
    }
  }

  return {
    state: 'ALLOWED_READ_ONLY' as DecisionState,
    reason: 'Request is limited to read-only/planning work under current Bridge Mode MVP.',
    http_status_if_attempted: 200,
    missing_credentials: missing,
  }
}

function routeFor(agentId: string, taskType: TaskType, connector: string | null) {
  const normalizedAgent = normalize(agentId) || 'tony'

  if (connector === 'zapier') {
    return {
      primary: 'zapier_tool_bridge_read_only',
      fallback: 'manual_owner_scoped_connector_plan',
      notes: ['Query /api/bridge/zapier/tools/search before deciding whether a Zapier tool exists.', 'Zapier writes remain locked until scoped Telegram approval and exact runner wiring exist.'],
    }
  }

  if (connector === 'hermes' || normalizedAgent === 'hermes') {
    return {
      primary: 'hermes_sandbox_read_only',
      fallback: 'tony_planning_route',
      notes: ['Hermes is sandbox/test-only and not production-authorized for protected execution.'],
    }
  }

  if (normalizedAgent === 'agent_zero' || taskType === 'agent_request') {
    return {
      primary: 'agent_zero_observe_review',
      fallback: 'tony_operational_decision',
      notes: ['Agent Zero is observe/recommend/review only until owner-approved execution exists.'],
    }
  }

  return {
    primary: taskType === 'code_change' ? 'codex_backend_runtime_lane' : 'tony_claude_cli_direct',
    fallback: 'ollama_local_backup_for_safe_read_only_analysis',
    notes: ['OpenRouter remains a protected model-routing fallback, not an automatic switch.'],
  }
}

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  return NextResponse.json({
    ok: true,
    mode: 'bridge_preflight_read_only_contract',
    no_execution_enabled: true,
    no_persistence_enabled: true,
    endpoint: {
      method: 'POST',
      path: '/api/bridge/preflight',
      description: 'Evaluates task route, blockers, approval gates, and fallback route without executing or persisting anything.',
    },
    accepted_fields: [
      'agent_id',
      'owner_goal',
      'task_type',
      'requested_action',
      'requested_resources',
      'connector',
      'target',
      'expected_duration_seconds',
    ],
    allowed_task_types: TASK_TYPES,
    decision_states: ['ALLOWED_READ_ONLY', 'OWNER_APPROVAL_REQUIRED', 'CREDENTIAL_REQUIRED', 'BACKEND_REQUIRED', 'BLOCKED'],
    canonical_docs: {
      execution_cycle: '/docs/MISSION_CONTROL_AGENT_EXECUTION_CYCLE.md',
      preflight_policy: '/docs/BRIDGE_MODE_PREFLIGHT_POLICY.md',
      approval_contracts: '/docs/BRIDGE_APPROVAL_API_CONTRACTS.md',
    },
    ui_visibility: {
      card_title: 'Latest Bridge Mode Preflight',
      state: latestPreflightResult ? latestPreflightResult.decision : 'NO_PREFLIGHT_RECORDED',
      latest_preflight: latestPreflightResult,
      empty_state: latestPreflightResult
        ? null
        : 'No in-memory preflight has been run since the current Mission Control process started.',
      note: 'This is process-local read-only visibility. Approval persistence is not connected and no approval request is created.',
    },
    example_request: {
      agent_id: 'tony',
      owner_goal: 'Prepare a Zapier email automation plan',
      connector: 'zapier',
      requested_action: 'plan only',
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  let input: PreflightRequest
  try {
    input = await request.json() as PreflightRequest
  } catch {
    input = {}
  }

  const taskType = classifyTask(input)
  const connector = detectConnector(input)
  const zapierQuery = connector === 'zapier'
    ? /(heygen|avatar|video)/.test([
      input.owner_goal,
      input.requested_action,
      input.target,
      ...(input.requested_resources || []),
    ].map(normalize).join(' '))
      ? 'heygen'
      : input.requested_action || input.owner_goal || null
    : null
  const zapierDiscovery = connector === 'zapier'
    ? await getZapierToolBridge(zapierQuery)
    : null
  let decision = buildDecision(input, taskType, connector)
  if (connector === 'zapier' && zapierDiscovery?.connected && decision.state === 'CREDENTIAL_REQUIRED') {
    decision = taskType === 'connector_write'
      ? {
        state: 'OWNER_APPROVAL_REQUIRED',
        reason: 'Zapier tools are visible through the Bridge Tool inventory. Writes remain locked behind Telegram approval and exact-scope runner wiring.',
        http_status_if_attempted: 423,
        missing_credentials: [],
      }
      : {
        state: 'ALLOWED_READ_ONLY',
        reason: 'Zapier tool inventory is visible through Bridge Mode read-only discovery.',
        http_status_if_attempted: 200,
        missing_credentials: [],
      }
  }
  const selectedRoute = routeFor(input.agent_id || 'tony', taskType, connector)
  const credentialNames = connector ? CONNECTOR_CREDENTIALS[connector] || [] : []

  const correlationId = `pf_${Date.now()}_${randomUUID().slice(0, 8)}`
  const approvalRequired = decision.state === 'OWNER_APPROVAL_REQUIRED'
  const credentialRequired = decision.state === 'CREDENTIAL_REQUIRED'
  const generatedAt = new Date().toISOString()
  const selectedTools = zapierDiscovery?.exact_heygen_tool_name
    ? [zapierDiscovery.exact_heygen_tool_name, 'zapier_tool_bridge_read_only']
    : connector
      ? [`${connector}:readiness_or_inventory`]
      : ['bridge:capability_matrix', 'bridge:button_contracts']
  const selectedModels = input.agent_id === 'hermes'
    ? ['sandbox/local provider when configured']
    : ['claude_cli_direct primary', 'OpenRouter fallback locked', 'Ollama emergency local backup']
  const selectedSkills = ['skills registry read-only search/list only']
  const selectedIntegrations = connector ? [connector] : ['Mission Control status', 'OpenClaw Gateway status']
  const selectedMcps = ['MCP status/server inventory only']
  const approvalGates = approvalRequired
    ? ['owner approval required', 'approval/audit persistence migration required before execution']
    : []
  const restrictions = [
    'no protected execution enabled',
    'no connector writes enabled',
    'no memory/governance/voice/routing changes',
    'no secrets exposed',
  ]
  const nextAction = approvalRequired
    ? 'Create owner-facing roadmap/report, then use Telegram approval after persistence and approval queue are wired.'
    : 'Proceed only with safe read-only/planning work under this preflight result.'

  latestPreflightResult = {
    id: correlationId,
    generated_at: generatedAt,
    agent_id: input.agent_id || 'tony',
    task_type: taskType,
    connector,
    decision: decision.state,
    reason: decision.reason,
    selected_route: selectedRoute,
    selected_tools: selectedTools,
    selected_models: selectedModels,
    selected_skills: selectedSkills,
    selected_integrations: selectedIntegrations,
    selected_mcps: selectedMcps,
    restrictions,
    approval_gates: approvalGates,
    missing_credentials: decision.missing_credentials,
    credential_required: credentialRequired,
    next_action: nextAction,
  }

  return NextResponse.json({
    ok: true,
    mode: 'bridge_preflight_read_only',
    generated_at: generatedAt,
    preflight: {
      id: correlationId,
      persistence: 'not_connected',
      execution_enabled: false,
      approval_request_created: false,
      approved_for_execution: false,
      agent_id: input.agent_id || 'tony',
      task_type: taskType,
      connector,
      owner_goal: input.owner_goal || null,
      requested_action: input.requested_action || null,
      target: input.target || null,
      decision: decision.state,
      reason: decision.reason,
      http_status_if_attempted: decision.http_status_if_attempted,
      selected_route: selectedRoute,
      selected_tools: selectedTools,
      selected_models: selectedModels,
      selected_skills: selectedSkills,
      selected_integrations: selectedIntegrations,
      selected_mcps: selectedMcps,
      approval_gates: approvalGates,
      restrictions,
      credential_names: credentialNames,
      credentials_present_by_name: credentialPresence(credentialNames),
      missing_credentials: decision.missing_credentials,
      credential_required: credentialRequired,
      fallback_routes: [selectedRoute.fallback],
      audit: {
        required_for_execution: true,
        current_state: 'not_persisted_read_only_response',
        would_log: ['preflight_created', 'route_selected', 'blockers_evaluated'],
      },
      roadmap_required: true,
      validation_required: {
        required_checks: 10,
        template: '/docs/AGENT_EXECUTION_TEMPLATES.md#10-check-validation-template',
      },
      executive_report_required: true,
      telegram_approval_required: approvalRequired,
      next_action: nextAction,
      zapier_tool_discovery: zapierDiscovery
        ? {
          connected: zapierDiscovery.connected,
          mcp_reachable: zapierDiscovery.mcp_reachable,
          tools_total: zapierDiscovery.tools_total,
          query: zapierDiscovery.query,
          heygen_found: zapierDiscovery.heygen_found,
          exact_heygen_tool_name: zapierDiscovery.exact_heygen_tool_name,
          required_fields: zapierDiscovery.required_fields,
          source: zapierDiscovery.source,
          execution_enabled: false,
          writes_enabled: false,
          blocker: zapierDiscovery.blocker,
          next_action: zapierDiscovery.next_action,
        }
        : null,
    },
    ui_visibility: {
      card_title: 'Latest Bridge Mode Preflight',
      latest_preflight: latestPreflightResult,
      note: 'Read-only process-local visibility only. No approval request was created.',
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
