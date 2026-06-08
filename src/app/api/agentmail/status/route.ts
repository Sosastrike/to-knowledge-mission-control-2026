import { NextRequest } from 'next/server'

import { buildAgentMailDispatchRuntimeStatus, buildAgentMailReceivePathStatus, buildAgentMailSetupStatus, buildAgentMailStatus } from '@/lib/agentmail-local-control'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const setupStatus = buildAgentMailSetupStatus()
  return readOnly({
    ...buildAgentMailStatus(),
    setup_status: setupStatus,
    agentmail_receive_path: buildAgentMailReceivePathStatus(),
    setup_state: setupStatus.setup_state,
    per_send_status: setupStatus.per_send_status,
    agentmail_dispatch_runtime: buildAgentMailDispatchRuntimeStatus(),
    current_primary_blocker: setupStatus.setup_state === 'approval_gated_send_ready' ? 'approval_gated_send_ready' : setupStatus.primary_blocker,
    exact_blockers: setupStatus.exact_blockers,
  })
}
