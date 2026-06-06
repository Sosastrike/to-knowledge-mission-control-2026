import { NextRequest } from 'next/server'

import { approveAgentMailCredentialProvision } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'mission_control_owner_operator')
  if (auth) return auth

  const result = approveAgentMailCredentialProvision(getDatabase())
  return readOnly(result)
}
