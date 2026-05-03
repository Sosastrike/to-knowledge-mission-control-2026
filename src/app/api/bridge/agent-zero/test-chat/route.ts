import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { fetchClaudeClawJson } from '@/lib/claudeclaw-telegram-approvals'
import { getZapierToolBridge } from '@/lib/zapier-tool-bridge'
import {
  buildAgentZeroReadOnlyContext,
  getAgentZeroApiKeyState,
  probeAgentZeroRuntime,
  sendAgentZeroReadOnlyMessage,
} from '@/lib/agent-zero-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ProviderStatus = {
  id?: string
  name?: string
}

async function buildContext() {
  const [providersResult, zapierResult] = await Promise.all([
    fetchClaudeClawJson<{ providers?: ProviderStatus[] }>('/api/bridge/providers', {}, 12000).catch(() => ({
      ok: false,
      status: 503,
      payload: { providers: [] as ProviderStatus[] },
    })),
    getZapierToolBridge('heygen').catch(() => ({
      connected: false,
      mcp_reachable: false,
      heygen_found: false,
      required_fields: null as string[] | null,
    })),
  ])

  const providers = Array.isArray((providersResult.payload as any)?.providers)
    ? ((providersResult.payload as any).providers as ProviderStatus[])
    : []

  return buildAgentZeroReadOnlyContext({
    providerIds: providers.map((provider) => provider.id || provider.name || '').filter(Boolean),
    mcpVisible: Boolean((zapierResult as any).mcp_reachable || (zapierResult as any).connected),
    zapierVisible: Boolean((zapierResult as any).connected || (zapierResult as any).tools_total),
    heygenVisible: Boolean((zapierResult as any).heygen_found),
    heygenSchemaVisible: Array.isArray((zapierResult as any).required_fields)
      && ((zapierResult as any).required_fields as string[]).length > 0,
  })
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [runtimeStatus, apiKey, context] = await Promise.all([
    probeAgentZeroRuntime(),
    Promise.resolve(getAgentZeroApiKeyState()),
    buildContext(),
  ])

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_read_only_test_channel',
    generated_at: new Date().toISOString(),
    label: 'Agent Zero — read-only ecosystem test',
    runtime: runtimeStatus,
    api_key: apiKey,
    context,
    status: runtimeStatus.reachable
      ? (apiKey.present ? 'ready_for_read_only_chat' : 'blocked_missing_agent_zero_api_key')
      : 'unreachable',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    next_action: apiKey.present
      ? 'Use POST /api/bridge/agent-zero/test-chat for read-only live Agent Zero context tests.'
      : 'Owner must configure an Agent Zero external API key for Mission Control before live chat can be proxied.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let message = ''
  try {
    const body = await request.json()
    message = typeof body?.message === 'string' ? body.message.trim() : ''
  } catch {
    message = ''
  }

  if (!message) {
    return NextResponse.json(
      {
        ok: false,
        error: 'message_required',
        execution_enabled: false,
        writes_enabled: false,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const context = await buildContext()
  const result = await sendAgentZeroReadOnlyMessage({
    ownerMessage: message.slice(0, 4000),
    context,
  })

  return NextResponse.json({
    ...result,
    label: 'Agent Zero — read-only ecosystem test',
    context_sent: context,
    safety: {
      execution_enabled: false,
      writes_enabled: false,
      zapier_writes_enabled: false,
      heygen_generation_enabled: false,
      smb_enabled: false,
      farmer_execution_enabled: false,
    },
    next_action: result.ok
      ? 'Review Agent Zero answer against the read-only context; execution remains disabled.'
      : 'Configure Agent Zero external API access or resolve the runtime blocker, then rerun the read-only test.',
  }, {
    status: result.ok ? 200 : result.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
