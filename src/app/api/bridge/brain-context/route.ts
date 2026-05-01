import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { fetchClaudeClawJson, hasClaudeClawDashboardToken } from '@/lib/claudeclaw-telegram-approvals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BrainContextPayload = {
  ok?: boolean
  mode?: string
  generated_at?: string
  query?: string
  agent_id?: string
  source_status?: unknown[]
  source_contracts?: unknown[]
  agent_consumers?: unknown[]
  write_contract?: unknown
  hits?: unknown[]
  context_text?: string
  error?: string
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!hasClaudeClawDashboardToken()) {
    return NextResponse.json({
      ok: false,
      mode: 'shared_brain_context_proxy',
      error: 'claudeclaw_dashboard_token_missing',
      execution_enabled: false,
      memory_writes_enabled: false,
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  const url = new URL(request.url)
  const q = url.searchParams.get('q') || url.searchParams.get('query') || ''
  const agentId = url.searchParams.get('agent_id') || 'tony'
  const limit = url.searchParams.get('limit') || '10'
  const upstream = await fetchClaudeClawJson<BrainContextPayload>(
    `/api/brain/context?q=${encodeURIComponent(q)}&agent_id=${encodeURIComponent(agentId)}&limit=${encodeURIComponent(limit)}`,
    {},
    12000,
  )

  return NextResponse.json({
    ...upstream.payload,
    ok: upstream.ok && Boolean((upstream.payload as BrainContextPayload).ok),
    mode: 'mission_control_shared_brain_context_proxy',
    upstream_status: upstream.status,
    canonical_source: 'ClaudeClaw /api/brain/context',
    execution_enabled: false,
    memory_writes_enabled: false,
    note: 'Read-only shared brain context proxy. It reads Build-Wiki, Obsidian, file handoffs, approval history, task history, and MemPalace status through ClaudeClaw. Source contracts and agent consumer contracts are mirrored from the canonical endpoint.',
  }, {
    status: upstream.ok ? 200 : upstream.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
