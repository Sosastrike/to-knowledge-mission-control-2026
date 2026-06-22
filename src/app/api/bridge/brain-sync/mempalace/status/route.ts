import { NextRequest } from 'next/server'

import { buildBrainBridgeLaneStatus } from '@/lib/brain-sync-gateway-status'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  return readOnly({ route: 'bridge.brain-sync.mempalace.status', lane: buildBrainBridgeLaneStatus('mempalace') })
}
