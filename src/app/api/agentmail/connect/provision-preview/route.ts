import { NextRequest } from 'next/server'

import { buildAgentMailInboxSyncPreview, recordAgentMailAudit } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const db = getDatabase()
  const preview = buildAgentMailInboxSyncPreview(db)
  recordAgentMailAudit(db, 'agentmail_inbox_sync_previewed', 'ok', 'preview_only_no_provisioning_no_send')

  return readOnly(preview)
}
