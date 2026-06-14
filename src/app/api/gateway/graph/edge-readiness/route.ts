import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { buildGatewayGraphEdgeReadiness } from '@/lib/gateway-graph-edge-readiness'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  return NextResponse.json(buildGatewayGraphEdgeReadiness(), {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
