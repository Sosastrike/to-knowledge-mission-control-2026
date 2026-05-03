import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import {
  buildAgentZeroEcosystemAgentRecord,
  type AgentZeroEcosystemAgentRecord,
} from '@/lib/agent-zero-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

type BridgeProvider = {
  id?: string
  name?: string
  state?: string
  status?: string
  [key: string]: unknown
}

function retireTonyProvider(provider: BridgeProvider): BridgeProvider {
  const id = String(provider.id || provider.name || '').toLowerCase().replace(/\s+/g, '_')
  if (id !== 'tony') return provider
  return {
    ...provider,
    id: 'tony_legacy',
    name: 'Tony Legacy',
    category: 'agent',
    state: 'retired',
    status: 'retired',
    hidden: true,
    detail: {
      ...(typeof provider.detail === 'object' && provider.detail ? provider.detail as Record<string, unknown> : {}),
      notes: 'Tony is retired/archived. Agent Zero is the active ecosystem commander; ClaudeClaw may remain only as legacy transport/backend until fully decommissioned.',
    },
    next_action: 'Use Agent Zero as commander. Show Tony only in archived diagnostics when explicitly requested.',
  }
}

function mergeAgentZeroProvider(providers: BridgeProvider[], agentZero: AgentZeroEcosystemAgentRecord): BridgeProvider[] {
  const normalizedProviders = providers
    .filter((provider) => String(provider.id || '').toLowerCase() !== 'agent_zero')
    .map(retireTonyProvider)
  return [
    ...normalizedProviders,
    agentZero,
  ].sort((a, b) => String(a.id || a.name || '').localeCompare(String(b.id || b.name || '')))
}

function summarizeProviders(providers: BridgeProvider[]) {
  return {
    total: providers.length,
    by_state: providers.reduce((acc, provider) => {
      const state = String(provider.state || provider.status || 'unknown')
      acc[state] = (acc[state] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  }
}

function fallbackProviders(error: string, agentZero: AgentZeroEcosystemAgentRecord) {
  const now = Date.now()
  const providers = mergeAgentZeroProvider([
    {
      id: 'tony_legacy',
      name: 'Tony Legacy',
      category: 'agent',
      state: 'retired',
      last_checked: now,
      detail: {
        endpoint: CLAUDECLAW_BRIDGE_PROVIDERS_URL,
        credential_name: 'DASHBOARD_TOKEN',
        credential_present: Boolean(readDashboardToken()),
        notes: 'Tony is retired/archived. ClaudeClaw provider proxy is legacy transport/status only and does not make Tony commander.',
        error,
      },
      next_action: 'Use Agent Zero as active commander; keep Tony visible only as legacy/archived diagnostics.',
    },
    {
      id: 'hermes',
      name: 'Hermes / Hermit',
      category: 'agent',
      state: 'sandbox',
      last_checked: now,
      detail: {
        endpoint: 'sandbox only',
        notes: 'Hermes remains sandbox/read-only until owner promotes it for protected execution.',
        error,
      },
      next_action: 'Keep Hermes visible as sandbox specialist; do not grant protected execution.',
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      category: 'model_router',
      state: 'degraded',
      last_checked: now,
      detail: {
        credential_name: 'OPENROUTER_API_KEY',
        credential_present: null,
        notes: 'Fallback registry shows role only; no credential value is inspected or exposed here.',
        error,
      },
      next_action: 'Use ClaudeClaw provider proxy for authoritative OpenRouter status.',
    },
    {
      id: 'nvidia',
      name: 'NVIDIA',
      category: 'model_provider',
      state: 'degraded',
      last_checked: now,
      detail: {
        credential_name: 'NVIDIA_API_KEY or NGC_API_KEY or NVIDIA_NIM_API_KEY',
        credential_present: null,
        notes: 'Fallback registry shows setup names only; no provider probe is executed.',
        error,
      },
      next_action: 'Use provider registry proxy before enabling NVIDIA as a model/provider candidate.',
    },
    {
      id: 'openai',
      name: 'OpenAI API',
      category: 'model_provider',
      state: 'degraded',
      last_checked: now,
      detail: {
        credential_name: 'OPENAI_API_KEY',
        credential_present: null,
        notes: 'Fallback registry shows role only. No secret is read or exposed.',
        error,
      },
      next_action: 'Keep OpenAI status read-only until provider proxy confirms configuration.',
    },
    {
      id: 'ollama',
      name: 'Ollama',
      category: 'local_model',
      state: 'backup',
      last_checked: now,
      detail: {
        endpoint: 'http://127.0.0.1:11434',
        notes: 'Emergency local backup only. Agent Zero routing is not changed.',
        error,
      },
      next_action: 'Use only as emergency/local backup when approved by Bridge Mode.',
    },
    {
      id: 'claude_cli',
      name: 'Claude CLI',
      category: 'model_provider',
      state: 'degraded',
      last_checked: now,
      detail: {
        endpoint: 'claude CLI',
        notes: 'Fallback registry cannot run model probes. Claude CLI remains a legacy ClaudeClaw capability until Agent Zero routing is fully loaded.',
        error,
      },
      next_action: 'Use ClaudeClaw proxy for live Claude CLI route status.',
    },
    {
      id: 'openclaw_gateway',
      name: 'OpenClaw Gateway',
      category: 'gateway',
      state: 'degraded',
      last_checked: now,
      detail: {
        endpoint: 'https://gw.knowledge-vs-ai.com/',
        notes: 'Fallback registry shows gateway role only; no connector writes are enabled.',
        error,
      },
      next_action: 'Use gateway health endpoints for authoritative status.',
    },
  ], agentZero)
  return {
    ok: true,
    mode: 'bridge_provider_registry_fallback_read_only',
    upstream_ok: false,
    error,
    generated_at: new Date().toISOString(),
    providers,
    summary: summarizeProviders(providers),
    no_execution_enabled: true,
    no_routing_changes_enabled: true,
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const agentZeroRecordPromise = buildAgentZeroEcosystemAgentRecord({
    verifyChat: searchParams.get('agent_zero_chat') !== '0',
    chatTimeoutMs: 12000,
  }).catch((error) => ({
    id: 'agent_zero',
    name: 'Agent Zero',
    category: 'agent',
    status: 'offline',
    state: 'offline',
    mode: 'read_only',
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    full_access_via_bridge: false,
    health_url: 'configured',
    chat_route: '/api/bridge/agent-zero/test-chat',
    capabilities_source: 'mission_control_context',
    health_status: 'unreachable',
    auth_status: 'missing',
    chat_status: 'blocked',
    agent_zero_called: false,
    last_checked: Date.now(),
    last_checked_at: new Date().toISOString(),
    detail: {
      endpoint: 'http://100.116.35.95:50080/',
      health_endpoint: 'http://100.116.35.95:50080/api/health',
      chat_endpoint: 'http://100.116.35.95:50080/api/api_message',
      health_http_status: null,
      health_latency_ms: null,
      version: null,
      commit_hash: null,
      api_key_configured: false,
      test_chat_endpoint: '/api/bridge/agent-zero/test-chat',
      ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem',
      bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session',
      execution_gateway_endpoint: '/api/bridge/agent-zero/execute',
      capabilities_source: 'mission_control_context',
      mode: 'read_only',
      execution_enabled: false,
      bridge_session_required: true,
      full_access_via_bridge: false,
      direct_access: false,
      proxy_access: true,
      blocker: error instanceof Error ? error.message : 'agent_zero_status_probe_failed',
      notes: 'Agent Zero status probe failed; execution remains disabled.',
      error: error instanceof Error ? error.message : 'agent_zero_status_probe_failed',
    },
    next_action: 'Restore Agent Zero health/auth before read-only ecosystem tests.',
  } satisfies AgentZeroEcosystemAgentRecord))

  const token = readDashboardToken()
  if (!token) {
    return NextResponse.json(fallbackProviders('claudeclaw_dashboard_token_missing', await agentZeroRecordPromise), {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const upstream = new URL(CLAUDECLAW_BRIDGE_PROVIDERS_URL)
  upstream.searchParams.set('token', token)
  if (searchParams.get('force') === '1') upstream.searchParams.set('force', '1')

  try {
    const response = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    const text = await response.text()
    const contentType = response.headers.get('content-type') || ''
    let payload: unknown = text

    if (contentType.includes('application/json')) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = { ok: false, error: 'invalid_upstream_json' }
      }
    }

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const upstreamPayload = payload as Record<string, unknown>
      const upstreamProviders = Array.isArray(upstreamPayload.providers)
        ? (upstreamPayload.providers.filter((item): item is BridgeProvider => Boolean(item && typeof item === 'object')) as BridgeProvider[])
        : []
      const providers = mergeAgentZeroProvider(upstreamProviders, await agentZeroRecordPromise)
      payload = {
        ok: response.ok,
        mode: 'bridge_provider_registry_proxy_read_only',
        upstream_ok: response.ok,
        no_execution_enabled: true,
        no_routing_changes_enabled: true,
        ...upstreamPayload,
        providers,
        summary: summarizeProviders(providers),
      }
    }

    return NextResponse.json(payload, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    logger.warn('bridge providers proxy failed')
    return NextResponse.json(fallbackProviders('claudeclaw_bridge_providers_unreachable', await agentZeroRecordPromise), {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
