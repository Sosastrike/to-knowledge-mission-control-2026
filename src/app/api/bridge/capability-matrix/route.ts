import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import { requireRole } from '@/lib/auth'

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

  const providers = await loadProviderStatuses()

  const agents: AgentCapability[] = [
    {
      id: 'tony',
      display_name: 'Tony',
      role: 'central operational leader / mission commander',
      status: stateFromProvider(providers, 'tony', 'active'),
      execution_permission: 'execute_approved',
      available_models: ['Claude CLI primary route: claude_cli_direct', 'OpenRouter cloud fallback/model router', 'Ollama local emergency fallback'],
      available_tools: ['Telegram text route', 'Telegram voice input route', 'ClaudeClaw dashboard', 'OpenClaw Gateway status', 'Mission Control read-only status', 'Viral Crawl Video Intelligence status'],
      available_skills: ['Skills registry read-only search', 'watch_video skill visible/read-only', 'Approved installed ClaudeClaw skills only'],
      available_integrations: ['ElevenLabs voice output', 'Whisper/OpenAI/Groq STT approved path', 'FireCrawl readiness', 'Viral Crawl Obsidian destination status', 'Zapier Tool Bridge read-only inventory locked until scoped approval'],
      available_mcps: ['MCP inventory via /api/mcp/servers', 'No MCP mutation without approval'],
      provider_routes: ['primary_chat=claude_cli_direct', 'cloud_fallback=OpenRouter', 'local_fallback=Ollama', 'voice=ElevenLabs', 'automation=Zapier locked'],
      approval_gates: ['Zapier writes', 'model routing changes', 'memory writes', 'governance changes', 'credentials', 'deployments', 'firewall/Caddy/Cloudflare/Docker'],
      restrictions: ['Do not change Tony voice ID', 'Do not rewrite Tony memory automatically', 'Do not change governance', 'Do not expose secrets'],
      memory_brain_sync_status: 'read-only visibility only; protected writes blocked',
      harness_event_routing_status: 'planned/read-only; no production route mutations',
      cost_rate_limits: ['Use Claude CLI primary path', 'Use OpenRouter only as approved fallback/router', 'Use Ollama as local emergency fallback'],
      blockers: ['Persistent approval/audit DB migration not applied', 'Connector execution not enabled'],
      next_action: 'Surface this matrix in Bridge Mode and keep protected actions approval-gated.',
      can_execute: true,
    },
    {
      id: 'agent_zero',
      display_name: 'Agent Zero',
      role: 'advisor, supervisor, automation strategist, behavior reviewer',
      status: stateFromProvider(providers, 'agent_zero', 'active'),
      execution_permission: 'observe_only',
      available_models: ['Agent Zero internal runtime only'],
      available_tools: ['Tailnet dashboard', 'review/recommend workflow', 'manual ticket review'],
      available_skills: ['Advisory/review only until bridge execution approval exists'],
      available_integrations: ['Mission Control visibility', 'Bridge Mode status'],
      available_mcps: ['none authorized for production mutation'],
      provider_routes: ['tailnet_url=http://100.116.35.95:50080'],
      approval_gates: ['Any execution', 'Docker/config changes', 'external access'],
      restrictions: ['Observe/recommend/review only', 'No public exposure', 'No Docker config changes without owner approval'],
      memory_brain_sync_status: 'may recommend memory updates; cannot overwrite protected memory',
      harness_event_routing_status: 'planned reviewer node; no production routing writes',
      cost_rate_limits: ['Review expensive loops and recommend cheaper workflows'],
      blockers: ['No approved production bridge execution contract'],
      next_action: 'Keep as supervisor/reviewer in Bridge Mode until approval/audit persistence exists.',
      can_execute: false,
    },
    {
      id: 'hermes',
      display_name: 'Hermes / Hermit',
      role: 'skill/workflow specialist and tool-method advisor',
      status: stateFromProvider(providers, 'hermes', 'sandbox'),
      execution_permission: 'read_only',
      available_models: ['Sandbox/local provider only when configured'],
      available_tools: ['sandbox CLI diagnostics', 'workflow/skill recommendation'],
      available_skills: ['Skill creation guidance', 'workflow improvement recommendations'],
      available_integrations: ['No production credentials', 'No Tony memory connection'],
      available_mcps: ['none authorized for production mutation'],
      provider_routes: ['sandbox_home=/home/tony/sandbox/hermes-home-20260428'],
      approval_gates: ['Production promotion', 'credentials', 'public gateway', 'Tony memory connection'],
      restrictions: ['Sandbox/test mode only', 'No protected execution', 'No public port', 'No production credentials'],
      memory_brain_sync_status: 'can recommend memory updates only; no writes',
      harness_event_routing_status: 'planned sandbox specialist lane',
      cost_rate_limits: ['Use local/non-production provider only until promoted'],
      blockers: ['Provider config/credentials may be required for full operation', 'Production authorization not granted'],
      next_action: 'Keep visible as sandbox specialist and document exact promotion checklist.',
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
    { id: 'claude_cli', status: stateFromProvider(providers, 'claude_cli', 'active'), role: 'Tony primary chat route', execution: 'active through Tony runtime only' },
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
    approval_gates: [
      'credentials',
      'memory writes',
      'governance changes',
      'Tony voice changes',
      'model routing changes',
      'Zapier writes',
      'connector execution',
      'service restarts outside approved scope',
      'firewall/Caddy/Cloudflare/Docker exposure',
      'production DB migrations',
      'external-user access',
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
