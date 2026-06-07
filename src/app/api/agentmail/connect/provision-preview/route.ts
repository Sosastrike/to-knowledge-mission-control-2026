import { NextRequest } from 'next/server'

import { buildAgentMailInboxProvisioningPreview } from '@/lib/agentmail-inbox-provisioning'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const preview = await buildAgentMailInboxProvisioningPreview({ db: getDatabase() })
  return readOnly(preview)
}
