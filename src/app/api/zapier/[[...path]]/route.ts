import { NextRequest, NextResponse } from 'next/server'
import {
  authJson,
  backendRequired,
  CatchAllParams,
  hasEnv,
  ownerApprovalRequired,
  routePath,
} from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function readZapierState() {
  try {
    // Optional table. If it is absent, status remains honestly not_configured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDatabase } = require('@/lib/db') as typeof import('@/lib/db')
    const db = getDatabase()
    return db.prepare("SELECT * FROM integration_connections WHERE provider = 'zapier' LIMIT 1").get() as
      | { connected?: number; health?: string; tool_count?: number }
      | undefined
  } catch {
    return undefined
  }
}

function readAuditEvents(kind?: string | null) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDatabase } = require('@/lib/db') as typeof import('@/lib/db')
    const db = getDatabase()
    let sql = "SELECT * FROM audit_events WHERE event LIKE 'zapier.%'"
    if (kind === 'blocked') sql += " AND outcome = 'blocked'"
    if (kind === 'allowed') sql += " AND outcome = 'allowed'"
    sql += ' ORDER BY ts DESC LIMIT 200'
    return db.prepare(sql).all() as unknown[]
  } catch {
    return []
  }
}

function statusPayload() {
  const conn = readZapierState()
  const oauth = !!conn?.connected || hasEnv('ZAPIER_ACCESS_TOKEN') || hasEnv('ZAPIER_API_KEY')
  const mcpConfigured = hasEnv('ZAPIER_MCP_URL') || hasEnv('ZAPIER_MCP_SERVER')
  return {
    ok: true,
    status: oauth || mcpConfigured ? 'connected' : 'not_configured',
    oauth,
    mcp: conn?.health || (mcpConfigured ? 'configured' : 'not_configured'),
    tools_count: conn?.tool_count || 0,
    writes_unlocked: false,
    unlock_expires_at: null,
    blocked_writes_24h: readAuditEvents('blocked').length,
    allowed_reads_24h: readAuditEvents('allowed').length,
    credential_names: ['ZAPIER_ACCESS_TOKEN', 'ZAPIER_API_KEY', 'ZAPIER_MCP_URL'],
    next_action: 'Wire Zapier MCP client and owner approval persistence before write actions.',
  }
}

type ZapierToolClass = 'read' | 'write' | 'unknown'

type McpTool = {
  name?: string
  description?: string
  inputSchema?: unknown
}

function zapierMcpUrl(): string {
  return (process.env.ZAPIER_MCP_URL || process.env.ZAPIER_MCP_SERVER || '').trim()
}

function classifyZapierTool(tool: McpTool): ZapierToolClass {
  const text = `${tool.name || ''} ${tool.description || ''}`.toLowerCase()
  if (/\b(create|update|delete|remove|send|post|upload|run|execute|trigger|publish|invite|move|set|enable|disable|approve|revoke)\b/.test(text)) {
    return 'write'
  }
  if (/\b(get|list|search|find|lookup|retrieve|read|fetch|query|inspect|describe|status|history)\b/.test(text)) {
    return 'read'
  }
  return 'unknown'
}

function parseMcpJsonResponse(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) return JSON.parse(trimmed)

  // Some MCP HTTP transports can stream SSE frames. Parse the first JSON data
  // frame without returning raw response text, because transport errors may
  // include sensitive server details.
  for (const line of trimmed.split('\n')) {
    const normalized = line.trim()
    if (!normalized.startsWith('data:')) continue
    const data = normalized.slice(5).trim()
    if (data && data.startsWith('{')) return JSON.parse(data)
  }
  return null
}

async function listZapierMcpTools() {
  const url = zapierMcpUrl()
  if (!url) {
    return {
      ok: true,
      status: 'credential_required',
      state: 'CREDENTIAL_REQUIRED',
      credential_required: true,
      provider: 'zapier',
      credential_names: ['ZAPIER_MCP_URL', 'ZAPIER_ACCESS_TOKEN', 'ZAPIER_API_KEY'],
      tools: [],
      total: 0,
      by_kind: {},
      execution_enabled: false,
      writes_enabled: false,
      approval_request_created: false,
      next_action: 'Configure a Zapier MCP URL/token through the approved secret manager before read-only tool discovery.',
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'tools-list',
        method: 'tools/list',
        params: {},
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    })
    const payload = parseMcpJsonResponse(await response.text()) as
      | { result?: { tools?: McpTool[] }; error?: { code?: number; message?: string } }
      | null

    if (!response.ok || payload?.error) {
      return {
        ok: true,
        status: 'backend_required',
        state: 'BACKEND_REQUIRED',
        backend_required: true,
        provider: 'zapier',
        tools: [],
        total: 0,
        by_kind: {},
        http_status: response.status,
        error: payload?.error?.code ? `mcp_error_${payload.error.code}` : 'zapier_mcp_tools_list_failed',
        execution_enabled: false,
        writes_enabled: false,
        approval_request_created: false,
        next_action: 'Verify Zapier MCP transport/auth, then retry read-only tools/list. No tools were invoked.',
      }
    }

    const tools = (payload?.result?.tools || []).map((tool) => {
      const kind = classifyZapierTool(tool)
      return {
        name: String(tool.name || ''),
        description: tool.description || null,
        kind,
        execution_state: kind === 'write' ? 'OWNER_APPROVAL_REQUIRED' : kind === 'read' ? 'READ_ONLY' : 'BACKEND_REQUIRED',
        approval_required: kind !== 'read',
        audit_required: true,
      }
    }).filter((tool) => tool.name)

    return {
      ok: true,
      status: 'read_only',
      provider: 'zapier',
      tools,
      total: tools.length,
      by_kind: tools.reduce((acc, tool) => {
        acc[tool.kind] = (acc[tool.kind] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      writes_unlocked: false,
      execution_enabled: false,
      writes_enabled: false,
      approval_request_created: false,
      note: 'Read-only tools/list only. No Zapier tools were invoked.',
    }
  } catch {
    return {
      ok: true,
      status: 'backend_required',
      state: 'BACKEND_REQUIRED',
      backend_required: true,
      provider: 'zapier',
      tools: [],
      total: 0,
      by_kind: {},
      error: 'zapier_mcp_tools_list_unreachable',
      execution_enabled: false,
      writes_enabled: false,
      approval_request_created: false,
      next_action: 'Zapier MCP endpoint is configured but not reachable from Mission Control. No tools were invoked.',
    }
  }
}

export async function GET(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  const path = routePath((await params).path)
  if (!path || path === 'status') return NextResponse.json(statusPayload())
  if (path === 'audit') {
    const kind = new URL(request.url).searchParams.get('kind')
    return NextResponse.json({
      ok: true,
      events: readAuditEvents(kind),
      blocked_writes: readAuditEvents('blocked'),
      allowed_reads: readAuditEvents('allowed'),
    })
  }
  if (path === 'tools') {
    const result = await listZapierMcpTools()
    return NextResponse.json(result)
  }

  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}

export async function POST(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'operator')
  if (auth) return auth

  const path = routePath((await params).path)
  if (path === 'test-read') {
    const body = await request.json().catch(() => ({}))
    const tool = String(body?.tool || '')
    if (!tool) return NextResponse.json({ ok: false, error: 'tool required' }, { status: 400 })
    if (/^(create|update|delete|send|post|upload|run|execute)/i.test(tool)) {
      return ownerApprovalRequired({ tool, reason: 'write_tools_locked' })
    }
    return backendRequired({
      tool,
      missing: 'zapier_mcp_client.callTool()',
      note: 'Read-only tool discovery may be available at GET /api/zapier/tools, but tool invocation is intentionally disabled.',
    })
  }
  if (path === 'request-write-approval') {
    const body = await request.json().catch(() => ({}))
    const tool = String(body?.tool || 'all')
    return ownerApprovalRequired({
      tool,
      scope: body?.scope || 'session',
      ttl_minutes: body?.ttl_minutes || 30,
      designed_payload_accepted: true,
      next_action: 'Owner approval UI and audit chain required before writes can unlock.',
    })
  }
  if (path === 'revoke-write-approval') {
    return backendRequired({
      approval_state: 'not_connected',
      revoked: false,
      next_action: 'Approval persistence is not connected, so there is no durable Zapier approval state to revoke yet.',
    })
  }

  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}
