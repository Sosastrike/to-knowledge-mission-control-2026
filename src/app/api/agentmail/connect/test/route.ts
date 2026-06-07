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
  const connected = status.status !== 'owner_sso_required' && status.status !== 'api_key_required'
  recordAgentMailAudit(
    db,
    connected ? 'agentmail_connection_test_passed' : 'agentmail_connection_test_failed',
    connected ? 'ok' : 'blocked',
    connected ? 'credential metadata detected; sends remain approval required' : 'owner_sso_required_or_api_key_required',
  )
  recordAgentMailAudit(
    db,
    connected ? 'agentmail_connection_visible_to_runtime' : 'agentmail_connection_not_visible_to_runtime',
    connected ? 'ok' : 'blocked',
    connected ? 'mission_control_service_runtime_can_see_agentmail_connection' : 'mission_control_service_runtime_cannot_see_agentmail_connection',
  )
  if (status.status === 'sync_ready' || status.status === 'inbox_sync_complete' || status.status === 'monitor_ready') {
    recordAgentMailAudit(db, 'agentmail_organization_selected', 'ok', 'organization_selection_or_api_fallback_detected_no_send_enabled')
  }

  return readOnly({
    ...status,
    connection_test: connected ? 'passed' : 'blocked',
    exact_blocker: connected ? null : status.status === 'api_key_required' ? 'agentmail_connection_not_visible_to_runtime' : 'agentmail_owner_sso_or_api_key_required',
  })
}
