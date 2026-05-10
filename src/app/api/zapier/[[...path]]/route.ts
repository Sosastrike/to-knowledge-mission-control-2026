import { NextRequest, NextResponse } from 'next/server'
import {
  authJson,
  backendRequired,
  CatchAllParams,
  hasEnv,
  ownerApprovalRequired,
  routePath,
} from '@/lib/designer-module-api'
import { getZapierToolBridge } from '@/lib/zapier-tool-bridge'
import { isZapierWriteTool, zapierBackendLocked, zapierNoWriteGuard } from '@/lib/zapier-write-guard'

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

async function statusPayload() {
  const conn = readZapierState()
  const oauth = !!conn?.connected || hasEnv('ZAPIER_ACCESS_TOKEN') || hasEnv('ZAPIER_API_KEY')
  const mcpConfigured = hasEnv('ZAPIER_MCP_URL') || hasEnv('ZAPIER_MCP_SERVER')
  const bridge = await getZapierToolBridge()
  return {
    ok: true,
    status: bridge.connected
      ? 'connected'
      : bridge.canonical_status === 'SERVICE_DOWN'
        ? 'degraded'
        : 'not_configured',
    canonical_status: bridge.canonical_status,
    blocker_class: bridge.blocker_class,
    owner_status: bridge.owner_status,
    oauth,
    mcp: bridge.mcp_reachable ? 'connected' : (conn?.health || (mcpConfigured ? 'configured' : 'not_configured')),
    tools_count: bridge.tools_total || conn?.tool_count || 0,
    read_tools_total: bridge.read_tools_total,
    write_tools_total: bridge.write_tools_total,
    unknown_tools_total: bridge.unknown_tools_total,
    writes_unlocked: false,
    execution_enabled: false,
    writes_enabled: false,
    no_zapier_writes: true,
    bridge_session_required: true,
    approval_required_for_writes: true,
    unlock_expires_at: null,
    blocked_writes_24h: readAuditEvents('blocked').length,
    allowed_reads_24h: readAuditEvents('allowed').length,
    credential_names: ['ZAPIER_ACCESS_TOKEN', 'ZAPIER_API_KEY', 'ZAPIER_MCP_URL'],
    blocker: bridge.blocker,
    warning: bridge.warning,
    next_action: bridge.next_action,
  }
}

export async function GET(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  const path = routePath((await params).path)
  if (!path || path === 'status') return NextResponse.json(await statusPayload())
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
    const query = new URL(request.url).searchParams.get('q')
    const result = await getZapierToolBridge(query)
    return NextResponse.json({
      ...result,
      endpoint: '/api/zapier/tools',
      canonical_endpoint: '/api/bridge/zapier/tools',
      route_state: 'legacy_read_only_compatibility',
      note: 'Legacy Zapier tool route now uses the canonical read-only Bridge inventory. No Zapier tools were invoked.',
    })
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
    if (isZapierWriteTool(tool)) {
      return ownerApprovalRequired(zapierNoWriteGuard({ tool, reason: 'write_tools_locked' }))
    }
    return backendRequired({
      tool,
      ...zapierBackendLocked({ tool }),
      missing: 'zapier_mcp_client.callTool()',
      note: 'Read-only tool discovery may be available at GET /api/zapier/tools, but tool invocation is intentionally disabled.',
    })
  }
  if (path === 'request-write-approval') {
    const body = await request.json().catch(() => ({}))
    const tool = String(body?.tool || 'all')
    return ownerApprovalRequired(zapierNoWriteGuard({
      tool,
      scope: body?.scope || 'session',
      ttl_minutes: body?.ttl_minutes || 30,
      designed_payload_accepted: true,
    }))
  }
  if (path === 'revoke-write-approval') {
    return backendRequired({
      ...zapierBackendLocked({ tool: 'zapier.write' }),
      approval_state: 'not_connected',
      revoked: false,
      next_action: 'Approval persistence is not connected, so there is no durable Zapier approval state to revoke yet.',
    })
  }

  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}
