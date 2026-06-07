import { NextRequest } from 'next/server'

import { applyAgentMailSelectedInboxMapping } from '@/lib/agentmail-inbox-provisioning'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'operator')
  if (auth) return auth

  const body = await request.json().catch(() => ({}))
  const selectedMapping = body?.selected_mapping || body?.selectedMapping || {}
  const ownerApproved = body?.owner_approved === true || body?.ownerApproved === true
  const result = await applyAgentMailSelectedInboxMapping({
    db: getDatabase(),
    selectedMapping,
    ownerApproved,
    actor: 'owner',
  })
  return readOnly(result)
}
