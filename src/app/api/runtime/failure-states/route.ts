import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildMonitoringFailureStatePayload } from '@/lib/monitoring-failure-states'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json(buildMonitoringFailureStatePayload(), {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
