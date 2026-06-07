import { NextRequest } from 'next/server'

import { listAgentMailBootstrapInboxes } from '@/lib/agentmail-credential-resolver'
import { buildAgentMailInboxSyncPreview, recordAgentMailAudit } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const db = getDatabase()
  const basePreview = buildAgentMailInboxSyncPreview(db)
  const liveAgentMail = await listAgentMailBootstrapInboxes({ db })
  const liveInboxRows = liveAgentMail.ok
    ? liveAgentMail.inboxes.map((inbox) => ({
      inbox_id: inbox.inbox_id,
      email: inbox.email,
      email_preview: inbox.email_preview,
      display_name: inbox.display_name,
      organization_id: inbox.organization_id,
      provision_state: 'live_existing_preview_only',
    }))
    : []
  const preview = {
    ...basePreview,
    connection_visible_to_runtime: liveAgentMail.ok || basePreview.connection_visible_to_runtime,
    organization_connected: liveAgentMail.ok || basePreview.organization_connected,
    organization_selected: liveAgentMail.ok || basePreview.organization_selected,
    organization: {
      ...basePreview.organization,
      state: liveAgentMail.ok ? 'selected_from_live_agentmail_runtime' : basePreview.organization.state,
      id: liveAgentMail.inboxes.find((inbox) => inbox.organization_id)?.organization_id || basePreview.organization.id,
    },
    live_agentmail: liveAgentMail,
    available_inboxes: liveAgentMail.ok ? liveInboxRows : basePreview.available_inboxes,
    existing_agentmail_inboxes: liveAgentMail.ok ? liveInboxRows : basePreview.existing_agentmail_inboxes,
    exact_blocker: liveAgentMail.ok ? 'agentmail_inbox_registry_preview_requires_owner_approval' : basePreview.exact_blocker,
    inbox_sync_complete: false,
    provision_automatically: false,
    mutation_enabled: false,
    send_enabled: false,
    execution_enabled: false,
  }
  recordAgentMailAudit(db, 'agentmail_inbox_sync_previewed', liveAgentMail.ok ? 'ok' : 'blocked', liveAgentMail.ok ? 'live_inbox_preview_only_no_provisioning_no_send' : 'agentmail_connection_not_visible_to_runtime')

  return readOnly(preview)
}
