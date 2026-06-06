import { NextRequest } from 'next/server'

import { buildAgentMailSendAccessStatus } from '@/lib/agentmail-local-control'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const status = buildAgentMailSendAccessStatus()
  return readOnly({
    source: 'agentmail_bridge_session_status',
    bridge_session: status.global,
    exact_blockers: status.exact_blockers,
  })
}
