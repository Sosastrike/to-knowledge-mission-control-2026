import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { createSpaceAgentResearchPayload } from '@/lib/space-agent-api'
import { createPlaywrightBrowserEvidencePacket } from '@/lib/playwright-mcp'
import type { SpaceAgentResponsibleAgent } from '@/lib/space-agent-research'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RESPONSIBLE_AGENTS = new Set(['agent_zero', 'hermes', 'pi', 'responsible_specialist_agent'])

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, unknown> = {}
  let ownerRequest = ''
  try {
    const parsed = await request.json()
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    ownerRequest = typeof body.request === 'string'
      ? body.request.trim()
      : typeof body.message === 'string'
        ? body.message.trim()
        : ''
  } catch {
    body = {}
    ownerRequest = ''
  }

  if (!ownerRequest) {
    return NextResponse.json({
      ok: false,
      error: 'request_required',
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const responsibleAgent = typeof body.responsible_agent === 'string' && RESPONSIBLE_AGENTS.has(body.responsible_agent)
    ? body.responsible_agent as SpaceAgentResponsibleAgent
    : 'agent_zero'
  const generatedAt = new Date().toISOString()
  const registry = await loadGatewayRegistry()
  const browserEvidence = await collectSafePublicBrowserEvidence(ownerRequest, generatedAt)
  const payload = createSpaceAgentResearchPayload({
    request: ownerRequest,
    responsibleAgent,
    registry,
    generatedAt,
    ...browserEvidence,
  })
  const status = payload.packet.status === 'blocked' ? 423 : 200

  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}


async function collectSafePublicBrowserEvidence(ownerRequest: string, generatedAt: string) {
  const url = firstPublicUrl(ownerRequest)
  if (!url) return {}
  if (/fire\s*crawl|firecrawl|youtube|youtu\.be|watch\?v=|login|authenticate|credential|password|private|paywall|captcha|submit|upload|form\b/i.test(ownerRequest)) {
    return {}
  }

  const packet = await createPlaywrightBrowserEvidencePacket({ url, generatedAt })
  if (!packet.ok) {
    return {
      browserActions: [{
        action: 'inspect' as const,
        target: url,
        url,
        timestamp: generatedAt,
        status: 'blocked' as const,
        summary: `Read-only Playwright MCP browser inspection was blocked: ${packet.blocker || 'playwright_mcp_browser_evidence_blocked'}.`,
        blocked_reason: packet.blocker || 'playwright_mcp_browser_evidence_blocked',
      }],
    }
  }

  const excerpt = packet.evidence.snapshot_excerpt || 'Read-only browser snapshot collected through Playwright MCP.'
  const host = new URL(url).hostname.replace(/^www\./, '')
  return {
    researchPerformed: true,
    evidence: [{
      evidence_id: 'playwright_mcp_read_only_snapshot',
      source_id: 'playwright_mcp_public_page',
      source_type: 'browser' as const,
      summary: `Playwright MCP read-only browser evidence confirmed the public page ${host}.`,
      quote: excerpt.slice(0, 240),
      url,
      confidence: packet.evidence.snapshot_contains_requested_page ? 'high' as const : 'medium' as const,
      collected_at: generatedAt,
    }],
    webSources: [{
      source_id: 'playwright_mcp_public_page',
      url,
      title: host,
      access: 'public' as const,
      status: 'checked' as const,
      last_checked: generatedAt,
    }],
    browserActions: [{
      action: 'inspect' as const,
      target: url,
      url,
      timestamp: generatedAt,
      status: 'summarized' as const,
      summary: 'Playwright MCP performed a local-only read-only browser inspection and returned snapshot, console, network, and screenshot availability.',
    }],
  }
}

function firstPublicUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s)>,]+/i)
  if (!match) return null
  try {
    const url = new URL(match[0])
    url.username = ''
    url.password = ''
    url.hash = ''
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return null
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|100\.)/.test(host)) return null
    return url.toString()
  } catch {
    return null
  }
}
