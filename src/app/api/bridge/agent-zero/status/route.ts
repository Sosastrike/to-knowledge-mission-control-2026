import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { fetchClaudeClawJson, hasClaudeClawDashboardToken } from '@/lib/claudeclaw-telegram-approvals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AGENT_ZERO_TAILNET_URL = 'http://100.116.35.95:50080/'

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

async function probeTailnet() {
  const startedAt = Date.now()
  try {
    const response = await fetch(AGENT_ZERO_TAILNET_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    return {
      reachable: response.ok,
      http_status: response.status,
      latency_ms: Date.now() - startedAt,
      error: null as string | null,
    }
  } catch (error) {
    return {
      reachable: false,
      http_status: null as number | null,
      latency_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'agent_zero_tailnet_probe_failed',
    }
  }
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

  const [tailnet, providerStatus] = await Promise.all([
    probeTailnet(),
    readProviderStatus(),
  ])

  const provider = providerStatus.provider
  const providerState = provider?.state || (tailnet.reachable ? 'active' : 'not_connected')

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_reviewer_status_read_only',
    generated_at: new Date().toISOString(),
    agent: {
      id: 'agent_zero',
      name: 'Agent Zero',
      role: 'reviewer / supervisor',
      allowed_behavior: ['observe', 'recommend', 'review'],
      disallowed_behavior: ['execute protected actions', 'change Docker/config', 'change permissions', 'bypass Tony approval'],
      execution_permission: 'observe_recommend_review_only',
      execution_enabled: false,
      execution_disabled_until: 'separate owner approval with audit-backed scoped runner',
      owner_approval_required_for_execution: true,
    },
    tailnet: {
      endpoint: AGENT_ZERO_TAILNET_URL,
      reachable: tailnet.reachable,
      http_status: tailnet.http_status,
      latency_ms: tailnet.latency_ms,
      error: tailnet.error,
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
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
