import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { fetchClaudeClawJson, hasClaudeClawDashboardToken } from '@/lib/claudeclaw-telegram-approvals'
import {
  getAgentZeroApiKeyState,
  probeAgentZeroRuntime,
} from '@/lib/agent-zero-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ProviderStatus = {
  id?: string
  name?: string
  category?: string
  state?: string
  last_checked?: number
  detail?: {
    endpoint?: string | null
    http_status?: number | null
    latency_ms?: number | null
    notes?: string
    error?: string | null
  }
  next_action?: string | null
}

async function readProviderStatus() {
  if (!hasClaudeClawDashboardToken()) {
    return {
      provider: null as ProviderStatus | null,
      warning: 'claudeclaw_dashboard_token_missing',
    }
  }

  const upstream = await fetchClaudeClawJson<{ providers?: ProviderStatus[] }>(
    '/api/bridge/providers',
    {},
    12000,
  ).catch((error) => ({
    ok: false,
    status: 503,
    payload: { error: error instanceof Error ? error.message : 'provider_status_failed' },
  }))

  const providers = Array.isArray((upstream.payload as any)?.providers)
    ? ((upstream.payload as any).providers as ProviderStatus[])
    : []

  return {
    provider: providers.find((provider) => provider.id === 'agent_zero') || null,
    warning: upstream.ok ? null : ((upstream.payload as any)?.error || `provider status HTTP ${upstream.status}`),
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [runtime, providerStatus] = await Promise.all([
    probeAgentZeroRuntime(),
    readProviderStatus(),
  ])

  const provider = providerStatus.provider
  const apiKey = getAgentZeroApiKeyState()
  const bridgeStatus = runtime.reachable
    ? (apiKey.present ? 'ready_for_read_only_live_test' : 'blocked_missing_agent_zero_api_key')
    : 'unreachable'
  const providerState = provider?.state || (runtime.reachable ? 'degraded' : 'not_connected')

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_reviewer_status_read_only',
    generated_at: new Date().toISOString(),
    agent: {
      id: 'agent_zero',
      name: 'Agent Zero',
      role: 'reviewer / supervisor',
      mode: 'read_only_test',
      allowed_behavior: ['observe', 'recommend', 'review'],
      disallowed_behavior: ['execute protected actions', 'change Docker/config', 'change permissions', 'bypass Tony approval'],
      execution_permission: 'observe_recommend_review_only',
      execution_enabled: false,
      execution_disabled_until: 'separate owner approval with audit-backed scoped runner',
      owner_approval_required_for_execution: true,
      bridge_session_required: true,
    },
    tailnet: {
      endpoint: runtime.web_endpoint,
      reachable: runtime.reachable,
      http_status: runtime.http_status,
      latency_ms: runtime.latency_ms,
      error: runtime.error,
    },
    runtime: {
      base_url: runtime.base_url,
      health_endpoint: runtime.health_endpoint,
      chat_endpoint: runtime.chat_endpoint,
      version: runtime.version,
      commit_hash: runtime.commit_hash,
      health_ok: runtime.health_ok,
    },
    mission_control_connector: {
      status: bridgeStatus,
      can_see_mission_control: apiKey.present && runtime.reachable ? 'not_live_verified_yet' : false,
      agent_zero_api_key_configured: apiKey.present,
      context_mode: 'read_only_bridge_context',
      test_chat_endpoint: '/api/bridge/agent-zero/test-chat',
      ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem',
      bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session',
      bridge_session_execution_enabled: false,
      blocker: bridgeStatus === 'blocked_missing_agent_zero_api_key'
        ? 'Agent Zero external API is reachable at /api/api_message, but Mission Control has no configured API key to call it.'
        : bridgeStatus === 'unreachable'
          ? 'Agent Zero Tailnet runtime is not reachable.'
          : null,
    },
    provider_registry: {
      state: providerState,
      category: provider?.category || 'agent',
      last_checked_at: typeof provider?.last_checked === 'number'
        ? new Date(provider.last_checked).toISOString()
        : null,
      notes: provider?.detail?.notes || 'Agent Zero is read-only reviewer/supervisor in Mission Control.',
      error: provider?.detail?.error || providerStatus.warning || null,
      next_action: provider?.next_action || 'Keep Agent Zero observe/recommend/review only until owner-approved execution exists.',
    },
    safety: {
      docker_changes_enabled: false,
      config_changes_enabled: false,
      execution_permissions_changed: false,
      protected_actions_created: false,
      writes_enabled: false,
      mission_control_auth_weakened: false,
      agent_zero_execution_enabled: false,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
