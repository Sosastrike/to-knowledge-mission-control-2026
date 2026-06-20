import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { fetchAgentPlatformDiagnostics } from '@/lib/agent-platform-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const result = await fetchAgentPlatformDiagnostics({ user: auth.user })
  return NextResponse.json({
    ...result.diagnostics,
    upstream_ok: result.upstream_ok,
    upstream_error: result.upstream_error,
  }, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}
