import { NextRequest } from 'next/server'

import { buildAgentMailConnectStatus, recordAgentMailAudit } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const db = getDatabase()
  const status = buildAgentMailConnectStatus(db)
  const connected = status.status !== 'owner_sso_required'
  recordAgentMailAudit(
    db,
    connected ? 'agentmail_connection_test_passed' : 'agentmail_connection_test_failed',
    connected ? 'ok' : 'blocked',
    connected ? 'credential metadata detected; sends remain approval required' : 'owner_sso_required_or_api_key_required',
  )

  return readOnly({
    ...status,
    connection_test: connected ? 'passed' : 'blocked',
    exact_blocker: connected ? null : 'agentmail_owner_sso_or_api_key_required',
  })
}
