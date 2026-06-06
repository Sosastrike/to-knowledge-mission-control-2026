import { NextRequest } from 'next/server'

import { recordAgentMailAudit } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, ownerGated } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'operator')
  if (auth) return auth

  recordAgentMailAudit(getDatabase(), 'agentmail_send_approved', 'blocked', 'canonical_approval_decisions_are_owner_channel_only')
  return ownerGated({
    source: 'agentmail_send_approve',
    exact_blocker: 'canonical_owner_approval_required',
    reason: 'canonical_approval_decisions_are_owner_channel_only',
    decision_surface: 'Agent Zero owner-channel approval only',
    no_duplicate_approval_system: true,
    dispatch_enabled: false,
    accepted_for_execution: false,
  }, 423)
}
