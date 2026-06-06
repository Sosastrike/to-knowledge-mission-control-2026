import { NextRequest } from 'next/server'

import { createAgentMailBridgeSessionRequest } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'operator')
  if (auth) return auth

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  return readOnly(createAgentMailBridgeSessionRequest(getDatabase(), {
    requester: typeof body.requester === 'string' ? body.requester : 'owner',
    ttl_minutes: typeof body.ttl_minutes === 'number' ? body.ttl_minutes : undefined,
  }))
}
