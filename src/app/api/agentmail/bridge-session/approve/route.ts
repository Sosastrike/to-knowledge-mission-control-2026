import { NextRequest } from 'next/server'

import { approveAgentMailBridgeSession } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'mission_control_owner_operator')
  if (auth) return auth

  return readOnly(approveAgentMailBridgeSession(getDatabase(), { actor: 'owner' }))
}
