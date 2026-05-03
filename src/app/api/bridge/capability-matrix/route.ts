import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import { requireRole } from '@/lib/auth'
import { buildAgentZeroEcosystemContext } from '@/lib/agent-zero-ecosystem-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CapabilityState =
  | 'active'
  | 'configured'
  | 'sandbox'
  | 'backup'
  | 'degraded'
  | 'missing_credential'
  | 'disabled'
  | 'blocked'
  | 'unknown'

type PermissionState = 'execute_approved' | 'observe_only' | 'review_only' | 'read_only' | 'owner_approval_required' | 'disabled'

type ProviderStatus = {
  name?: string
  id?: string
  status?: string
  state?: string
  role?: string
  blocker?: string | null
}

type AgentCapability = {
  id: string
  display_name: string
  role: string
  status: CapabilityState
  execution_permission: PermissionState
  available_models: string[]
  available_tools: string[]
  available_skills: string[]
  available_integrations: string[]
  available_mcps: string[]
  provider_routes: string[]
  approval_gates: string[]
  restrictions: string[]
  memory_brain_sync_status: string
  harness_event_routing_status: string
  cost_rate_limits: string[]
  blockers: string[]
  next_action: string
  can_execute: boolean
}

const CLAUDECLAW_ENV_PATH =
  process.env.CLAUDECLAW_ENV_PATH ||
  '/home/tony/claudeclaw/.env'
const CLAUDECLAW_BRIDGE_PROVIDERS_URL =
  process.env.CLAUDECLAW_BRIDGE_PROVIDERS_URL ||
  'http://127.0.0.1:3000/api/bridge/providers'

function readDashboardToken(): string {
  const envToken = process.env.CLAUDECLAW_DASHBOARD_TOKEN || process.env.DASHBOARD_TOKEN
  if (envToken) return envToken.trim()

  try {
    const text = fs.readFileSync(CLAUDECLAW_ENV_PATH, 'utf8')
    const match = text.match(/^DASHBOARD_TOKEN=(.*)$/m)
    return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : ''
  } catch {
    return ''
  }
}

async function loadProviderStatuses(): Promise<Record<string, ProviderStatus>> {
  const token = readDashboardToken()
  if (!token) return {}

  try {
    const upstream = new URL(CLAUDECLAW_BRIDGE_PROVIDERS_URL)
    upstream.searchParams.set('token', token)
    const response = await fetch(upstream, { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    if (!response.ok) return {}
    const payload = await response.json() as { providers?: ProviderStatus[] }
    const providers = Array.isArray(payload.providers) ? payload.providers : []
    return Object.fromEntries(
      providers.map((provider) => [
        String(provider.id || provider.name || '').toLowerCase().replace(/\s+/g, '_'),
        provider,
      ]),
    )
  } catch {
    return {}
  }
}

function stateFromProvider(providers: Record<string, ProviderStatus>, key: string, fallback: CapabilityState): CapabilityState {
  const provider = providers[key]
  const raw = String(provider?.status || provider?.state || '').toLowerCase()
  if (!raw) return fallback
  if (raw.includes('active')) return 'active'
  if (raw.includes('configured')) return 'configured'
  if (raw.includes('sandbox')) return 'sandbox'
  if (raw.includes('backup')) return 'backup'
  if (raw.includes('degraded')) return 'degraded'
  if (raw.includes('missing')) return 'missing_credential'
  if (raw.includes('disabled')) return 'disabled'
  if (raw.includes('blocked')) return 'blocked'
  return fallback
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [providers, agentZeroContext] = await Promise.all([
    loadProviderStatuses(),
    buildAgentZeroEcosystemContext(),
  ])

  const agents: AgentCapability[] = [
    {
      id: 'agent_zero',
      display_name: 'Agent Zero',
      role: 'active ecosystem commander / bridge-session task operator',
      status: 'active',
      execution_permission: 'owner_approval_required',
      available_models: ['OpenRouter/model registry through Mission Control', 'Claude/OpenAI/Gemini/Groq/local providers when configured', 'Agent Zero internal runtime for chat'],
      available_tools: ['Mission Control live bridge', 'Bridge/MCP registry', 'report/PDF delivery surface', 'Build-Wiki/Farmer status', 'Agent Network UI'],
      available_skills: ['Agent Zero deployed skills', 'Mission Control repo skills', 'ClaudeClaw legacy skills as archived metadata only'],
      available_integrations: ['Telegram/Mission Control delivery if route configured', 'Google Drive/OneDrive status adapters', 'Zapier/HeyGen schema visibility only until approved execution', 'Obsidian/MemPalace/Brain adapters'],
      available_mcps: ['MCP inventory via /api/mcp/list', 'MCP tool/schema summaries; execution requires active Bridge Session'],
      provider_routes: ['commander=agent_zero', 'bridge_session_required=true', 'transport=Mission Control / Bridge / registered adapters only'],
      approval_gates: ['Bridge Session for execution', 'external writes', 'model routing changes', 'memory writes', 'governance changes', 'credentials', 'deployments', 'firewall/Caddy/Cloudflare/Docker exposure'],
      restrictions: ['No raw shell/root/Docker socket', 'No direct secret reads', 'No fake completion', 'No unapproved external writes', 'No raw local paths in owner replies'],
      memory_brain_sync_status: 'live status/read adapters through Mission Control; writes require active Bridge Session and adapter audit',
      harness_event_routing_status: 'Agent Zero commander path is primary; actions must stay adapter-scoped and audited',
      cost_rate_limits: ['Use configured model registry honestly', 'Report blocked providers instead of guessing', 'Do not execute expensive external tools without session scope'],
      blockers: ['Production mission-control.service must be restarted by admin to load latest commander bundle'],
      next_action: 'Restart production Mission Control, then validate Agent Zero live queries and Bridge Session execution from the owner UI.',
      can_execute: true,
    },
    {
      id: 'hermes',
      display_name: 'Hermes',
      role: 'lieutenant / skill and workflow specialist',
      status: stateFromProvider(providers, 'hermes', 'sandbox'),
      execution_permission: 'read_only',
      available_models: ['Sandbox/local provider only when configured'],
      available_tools: ['sandbox CLI diagnostics', 'workflow/skill recommendation'],
      available_skills: ['Skill creation guidance', 'workflow improvement recommendations'],
      available_integrations: ['No production credentials', 'No legacy memory connection', 'Mission Control read-only status'],
      available_mcps: ['none authorized for production mutation'],
      provider_routes: ['lieutenant=hermes', 'sandbox_home=/home/tony/sandbox/hermes-home-20260428'],
      approval_gates: ['Production promotion', 'credentials', 'public gateway', 'legacy memory connection'],
      restrictions: ['Sandbox/test mode only', 'No protected execution', 'No public port', 'No production credentials'],
      memory_brain_sync_status: 'can recommend memory updates only; no writes',
      harness_event_routing_status: 'planned sandbox specialist lane',
      cost_rate_limits: ['Use local/non-production provider only until promoted'],
      blockers: ['Provider config/credentials may be required for full operation', 'Production authorization not granted'],
      next_action: 'Show as Agent Zero lieutenant, but keep degraded/read-only until health, chat/API, and Bridge Session proof pass.',
      can_execute: false,
    },
    {
      id: 'openclaw_gateway',
      display_name: 'OpenClaw Gateway',
      role: 'integration gateway',
      status: stateFromProvider(providers, 'openclaw_gateway', 'active'),
      execution_permission: 'read_only',
      available_models: [],
      available_tools: ['gateway health', 'provider status', 'integration status'],
      available_skills: ['OpenClaw skill inventory when available'],
      available_integrations: ['Telegram provider', 'Discord provider degraded/deferred', 'gateway public route'],
      available_mcps: ['gateway-provided integrations when configured'],
      provider_routes: ['local=http://127.0.0.1:18789', 'public=https://gw.knowledge-vs-ai.com'],
      approval_gates: ['Provider credential changes', 'public exposure changes', 'connector writes'],
      restrictions: ['No credential edits', 'No Docker/firewall/Caddy/Cloudflare changes'],
      memory_brain_sync_status: 'status source only',
      harness_event_routing_status: 'gateway can become event source after audit persistence',
      cost_rate_limits: ['No autonomous external writes'],
      blockers: ['Discord deferred until token rotation', 'write connectors locked'],
      next_action: 'Expose gateway status in Bridge Mode and keep writes locked.',
      can_execute: false,
    },
  ]

  const modelProviders = [
    { id: 'claude_cli', status: stateFromProvider(providers, 'claude_cli', 'active'), role: 'legacy ClaudeClaw route; Agent Zero is commander', execution: 'legacy transport only until Agent Zero production route is fully loaded' },
    { id: 'openrouter', status: stateFromProvider(providers, 'openrouter', 'configured'), role: 'cloud fallback/model router candidate', execution: 'locked behind routing approval' },
    { id: 'ollama', status: stateFromProvider(providers, 'ollama', 'backup'), role: 'local emergency fallback', execution: 'backup only' },
    { id: 'openai', status: stateFromProvider(providers, 'openai', 'configured'), role: 'STT/API/provider candidate', execution: 'credentialed paths only' },
    { id: 'nvidia', status: stateFromProvider(providers, 'nvidia', 'configured'), role: 'provider candidate', execution: 'not selected as default route' },
  ]

  const toolInventory = [
    { id: 'firecrawl', state: 'CREDENTIAL_REQUIRED', mode: 'readiness only', endpoint: '/api/firecrawl/status', writes_enabled: false },
    { id: 'viral_crawl_video', state: 'READ_ONLY', mode: 'wrapper/vendor/Obsidian/skill status only', endpoint: '/api/viral-crawl/video/status', writes_enabled: false },
    { id: 'zapier', state: 'OWNER_APPROVAL_REQUIRED', mode: 'canonical Zapier Tool Bridge inventory/search only', endpoint: '/api/bridge/zapier/tools', writes_enabled: false },
    { id: 'n8n', state: 'BACKEND_REQUIRED', mode: 'status/readiness only', endpoint: '/api/n8n/status', writes_enabled: false },
    { id: 'mcp_tools', state: 'READ_ONLY', mode: 'status/server inventory only', endpoint: '/api/mcp/servers', writes_enabled: false },
    { id: 'skills', state: 'READ_ONLY', mode: 'ClaudeClaw agent skill inventory plus search/list only', endpoint: '/api/skills/tool-skills', writes_enabled: false },
  ]

  return NextResponse.json({
    ok: true,
    mode: 'bridge_mode_read_only_mvp',
    generated_at: new Date().toISOString(),
    no_execution_enabled: true,
    no_memory_writes_enabled: true,
    no_connector_writes_enabled: true,
    canonical_endpoints: {
      provider_registry: '/api/bridge/providers',
      capability_matrix: '/api/bridge/capability-matrix',
      preflight: '/api/bridge/preflight',
      costs: '/api/bridge/costs',
      approval_readiness: '/api/bridge/approval-readiness',
      executive_report_preview: '/api/bridge/executive-report-preview',
      telegram_approval_preview: '/api/bridge/telegram-approval-preview',
      button_contracts: '/api/bridge/button-contracts',
      approval_contract: '/api/bridge/approval-contract',
      integrations_setup: '/api/integrations',
      mcp_status_summary: '/api/mcp/status',
      mcp_server_details: '/api/mcp/servers',
    },
    semantics: {
      active: 'usable in its approved current lane',
      sandbox: 'visible and testable, not production-authorized for protected execution',
      backup: 'available only as fallback/emergency path',
      read_only: 'can observe/list/status only',
      owner_approval_required: 'must not execute until approved and audited',
    },
    agents,
    model_providers: modelProviders,
    tool_inventory: toolInventory,
    live_registry: agentZeroContext.live_registry,
    agent_zero_ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem',
    approval_gates: [
      'credentials',
      'memory writes',
      'governance changes',
      'Agent Zero voice / commander identity changes',
      'model routing changes',
      'Zapier writes',
      'connector execution',
      'service restarts outside approved scope',
      'firewall/Caddy/Cloudflare/Docker exposure',
      'production DB migrations',
      'external-user access',
    ],
    retired_agents: [
      { id: 'tony_legacy', display_name: 'Tony Legacy', status: 'retired', visible_by_default: false, reason: 'archived rollback/audit only' },
    ],
    summary: {
      agents_total: agents.length,
      executable_agents: agents.filter((agent) => agent.can_execute).length,
      read_only_or_observe_agents: agents.filter((agent) => !agent.can_execute).length,
      tools_total: toolInventory.length,
      connector_writes_enabled: 0,
      protected_actions_locked: true,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
