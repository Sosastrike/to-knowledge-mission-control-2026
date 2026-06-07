import { NextRequest } from 'next/server'

import { buildAgentMailConnectStatus, buildAgentMailInboxSyncPreview, recordAgentMailAudit } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const db = getDatabase()
  const status = buildAgentMailConnectStatus(db)
  const preview = buildAgentMailInboxSyncPreview(db)
  const ready = status.status === 'sync_ready' || status.status === 'inbox_sync_complete' || status.status === 'monitor_ready'
  recordAgentMailAudit(
    db,
    ready ? 'agentmail_inbox_sync_completed' : 'agentmail_connection_not_visible_to_runtime',
    ready ? 'ok' : 'blocked',
    ready ? 'sync_state_refreshed_no_send_enabled' : 'connect_agentmail_before_sync',
  )

  return readOnly({
    source: 'agentmail_connect_sync',
    status: ready ? 'inbox_sync_complete' : status.status,
    sync_ready: ready,
    inbox_sync_complete: ready,
    exact_blocker: ready ? 'agentmail_inbox_credential_required' : 'agentmail_owner_sso_or_api_key_required',
    send_enabled: false,
    execution_enabled: false,
    preview,
  })
}
