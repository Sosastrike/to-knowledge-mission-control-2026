import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { buildMissionControlRuntimeHealth } from '@/lib/mission-control-runtime-health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  return NextResponse.json({
    ok: true,
    mode: 'mission_control_stale_bundle_health_read_only',
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    ...buildMissionControlRuntimeHealth(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
