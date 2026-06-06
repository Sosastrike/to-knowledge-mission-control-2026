import { NextRequest } from 'next/server'

import { revokeAgentMailBridgeSession } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'operator')
  if (auth) return auth

  return readOnly(revokeAgentMailBridgeSession(getDatabase(), 'owner'))
}
