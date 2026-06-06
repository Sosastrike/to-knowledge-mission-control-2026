import { NextRequest } from 'next/server'

import { applyAgentMailCredentialProvision } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, blocked } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'mission_control_owner_operator')
  if (auth) return auth

  const result = applyAgentMailCredentialProvision(getDatabase())
  return blocked(result, 423)
}
