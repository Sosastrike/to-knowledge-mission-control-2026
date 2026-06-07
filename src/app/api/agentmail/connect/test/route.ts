import { NextRequest } from 'next/server'

import { buildAgentMailConnectStatus, recordAgentMailAudit } from '@/lib/agentmail-local-control'
import { testAgentMailBootstrapConnection } from '@/lib/agentmail-credential-resolver'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const db = getDatabase()
  const probe = await testAgentMailBootstrapConnection({ db })
  const status = buildAgentMailConnectStatus(db)
  const connected = probe.ok
  recordAgentMailAudit(
    db,
    connected ? 'agentmail_connection_test_passed' : 'agentmail_connection_test_failed',
    connected ? 'ok' : 'blocked',
    connected ? `safe_inbox_probe_ok;inbox_count=${probe.inbox_count};sends_remain_approval_required` : (probe.exact_blocker || 'agentmail_connection_test_blocked'),
  )
  recordAgentMailAudit(
    db,
    connected ? 'agentmail_connection_visible_to_runtime' : 'agentmail_connection_not_visible_to_runtime',
    connected ? 'ok' : 'blocked',
    connected ? 'mission_control_service_runtime_can_probe_agentmail_with_bootstrap_credential' : (probe.exact_blocker || 'mission_control_service_runtime_cannot_probe_agentmail'),
  )
  if (connected) {
    recordAgentMailAudit(db, 'agentmail_organization_selected', 'ok', 'bootstrap_connection_probe_visible_no_send_enabled')
  }

  return readOnly({
    ...status,
    connection_test: connected ? 'passed' : 'blocked',
    exact_blocker: connected ? null : probe.exact_blocker || 'agentmail_connection_not_visible_to_runtime',
    connection_probe: {
      ...probe,
      secret_material_returned: false,
    },
  })
}
