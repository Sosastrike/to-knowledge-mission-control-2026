import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

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

function fallbackProviders(error: string) {
  const now = Date.now()
  const providers = [
    {
      id: 'tony',
      name: 'Tony',
      category: 'agent',
      state: 'degraded',
      last_checked: now,
      detail: {
        endpoint: CLAUDECLAW_BRIDGE_PROVIDERS_URL,
        credential_name: 'DASHBOARD_TOKEN',
        credential_present: Boolean(readDashboardToken()),
        notes: 'ClaudeClaw provider proxy is unavailable; fallback is read-only and does not change routing.',
        error,
      },
      next_action: 'Restore ClaudeClaw /api/bridge/providers proxy for live Tony/provider status.',
    },
    {
      id: 'agent_zero',
      name: 'Agent Zero',
      category: 'agent',
      state: 'degraded',
      last_checked: now,
      detail: {
        endpoint: 'http://100.116.35.95:50080/',
        notes: 'Fallback registry cannot probe Agent Zero from this endpoint without the ClaudeClaw provider proxy.',
        error,
      },
      next_action: 'Use Bridge Mode capability matrix and Agent Zero readiness until provider proxy returns.',
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
        notes: 'Emergency local backup only. Tony routing is not changed.',
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
        notes: 'Fallback registry cannot run model probes. Tony primary route remains claude_cli_direct.',
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
  ]
  return {
    ok: true,
    mode: 'bridge_provider_registry_fallback_read_only',
    upstream_ok: false,
    error,
    generated_at: new Date().toISOString(),
    providers,
    summary: {
      total: providers.length,
      by_state: providers.reduce((acc, provider) => {
        acc[provider.state] = (acc[provider.state] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    },
    no_execution_enabled: true,
    no_routing_changes_enabled: true,
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const token = readDashboardToken()
  if (!token) {
    return NextResponse.json(fallbackProviders('claudeclaw_dashboard_token_missing'), {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const { searchParams } = new URL(request.url)
  const upstream = new URL(CLAUDECLAW_BRIDGE_PROVIDERS_URL)
  upstream.searchParams.set('token', token)
  if (searchParams.get('force') === '1') upstream.searchParams.set('force', '1')

  try {
    const response = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
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
      payload = {
        ok: response.ok,
        mode: 'bridge_provider_registry_proxy_read_only',
        upstream_ok: response.ok,
        no_execution_enabled: true,
        no_routing_changes_enabled: true,
        ...(payload as Record<string, unknown>),
      }
    }

    return NextResponse.json(payload, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    logger.warn('bridge providers proxy failed')
    return NextResponse.json(fallbackProviders('claudeclaw_bridge_providers_unreachable'), {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
