import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { runRouteSmoke } from '@/lib/cloudcode-backend-support'
import { buildSafeRouteSmokeTable } from '@/lib/gateway-cloudcode-integration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const report = await runRouteSmoke({
    baseOrigin: url.origin,
    authHeader: request.headers.get('authorization'),
  })
  const safeReport = {
    ...report,
    base_origin_redacted: 'same-origin',
  }

  return NextResponse.json({
    ok: true,
    mode: 'gateway_route_smoke_diagnostics',
    report: safeReport,
    table: buildSafeRouteSmokeTable(safeReport),
    cloudcode_backend_support: {
      applied: true,
      source: 'cloudcode-backend-support-handoff',
      helpers: ['runRouteSmoke', 'buildRouteSmokeReport'],
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
