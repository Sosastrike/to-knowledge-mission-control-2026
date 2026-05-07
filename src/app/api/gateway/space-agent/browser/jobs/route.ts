import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    ok: true,
    mode: 'space_agent_browser_jobs_read_only',
    generated_at: new Date().toISOString(),
    jobs: [],
    latest_evidence_route: '/api/gateway/space-agent/playwright-mcp/evidence',
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_public_exposure: true,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    blocker: 'browser_job_persistence_not_enabled_yet',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
