import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { buildAgentZeroEcosystemAgentRecord } from '@/lib/agent-zero-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CLAUDECLAW_ENV_PATH =
  process.env.CLAUDECLAW_ENV_PATH ||
  '/home/tony/claudeclaw/.env'
const CLAUDECLAW_BRIDGE_PROVIDERS_URL =
  process.env.CLAUDECLAW_BRIDGE_PROVIDERS_URL ||
  'http://127.0.0.1:3000/api/bridge/providers'

type BridgeProvider = {
  id?: string
  name?: string
  category?: string
  state?: string
  detail?: Record<string, unknown>
  next_action?: string
  [key: string]: unknown
}

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

function normalizeProviderId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function providerMatches(provider: BridgeProvider, requestedId: string): boolean {
  const aliases = new Set([
    provider.id,
    provider.name,
    provider.id?.replace(/_/g, '-'),
    provider.name?.replace(/\s+/g, '-'),
  ].filter(Boolean).map((value) => normalizeProviderId(String(value))))

  return aliases.has(normalizeProviderId(requestedId))
}

function providersFromPayload(payload: unknown): BridgeProvider[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const providers = (payload as { providers?: unknown }).providers
  return Array.isArray(providers) ? providers.filter((item): item is BridgeProvider => Boolean(item && typeof item === 'object')) : []
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (normalizeProviderId(id) === 'agent_zero') {
    const provider = await buildAgentZeroEcosystemAgentRecord({
      verifyChat: true,
      chatTimeoutMs: 12000,
    })
    return NextResponse.json(
      {
        ok: true,
        mode: 'bridge_provider_detail_agent_zero_read_only',
        upstream_ok: true,
        provider,
        execution_enabled: false,
        no_routing_changes_enabled: true,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const token = readDashboardToken()
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error: 'claudeclaw_dashboard_token_missing',
        provider_id: id,
        execution_enabled: false,
        no_routing_changes_enabled: true,
        blocker: 'Provider detail needs the ClaudeClaw dashboard token to read the canonical provider registry.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const upstream = new URL(CLAUDECLAW_BRIDGE_PROVIDERS_URL)
  upstream.searchParams.set('token', token)

  try {
    const response = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    const text = await response.text()
    const payload = JSON.parse(text) as unknown
    const providers = providersFromPayload(payload)
    const provider = providers.find((candidate) => providerMatches(candidate, id))

    if (!provider) {
      return NextResponse.json(
        {
          ok: false,
          error: 'provider_not_found',
          provider_id: id,
          available_provider_ids: providers.map((candidate) => candidate.id || candidate.name).filter(Boolean),
          execution_enabled: false,
          no_routing_changes_enabled: true,
        },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    return NextResponse.json(
      {
        ok: response.ok,
        mode: 'bridge_provider_detail_proxy_read_only',
        upstream_ok: response.ok,
        provider,
        execution_enabled: false,
        no_routing_changes_enabled: true,
      },
      { status: response.ok ? 200 : response.status, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    logger.warn({ err: error }, 'bridge provider detail proxy failed')
    return NextResponse.json(
      {
        ok: false,
        error: 'claudeclaw_bridge_provider_detail_unreachable',
        provider_id: id,
        execution_enabled: false,
        no_routing_changes_enabled: true,
        blocker: 'Mission Control could not read the canonical ClaudeClaw provider registry.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
