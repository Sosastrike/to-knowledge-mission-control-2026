import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getZapierToolBridge } from '@/lib/zapier-tool-bridge'
import { buildZapierApprovedActionLibrary } from '@/lib/zapier-approved-action-library'
import {
  buildZapierConnectionDetails,
  zapierCredentialPresenceFromEnv,
} from '@/lib/zapier-connection-details'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const payload = await getZapierToolBridge()
  const approvedActionLibrary = buildZapierApprovedActionLibrary()
  const connectionDetails = buildZapierConnectionDetails({
    bridge: payload,
    approvedActionLibrary,
    credentialPresence: zapierCredentialPresenceFromEnv(),
  })
  return NextResponse.json({
    ...payload,
    endpoint: '/api/bridge/zapier/status',
    canonical_tools_endpoint: '/api/bridge/zapier/tools',
    canonical_search_endpoint: '/api/bridge/zapier/tools/search?q=heygen',
    approved_action_library_endpoint: '/api/bridge/zapier/approved-actions',
    card_copy: approvedActionLibrary.card_copy,
    zapier_runtime: approvedActionLibrary.zapier_runtime,
    standing_scopes: approvedActionLibrary.standing_scopes,
    standing_scope_summary: approvedActionLibrary.standing_scope_summary,
    approved_action_library: {
      adapter_id: approvedActionLibrary.adapter_id,
      certified_actions: approvedActionLibrary.certified_actions,
      prepared_actions: approvedActionLibrary.prepared_actions,
      standing_scope_summary: approvedActionLibrary.standing_scope_summary,
      broad_execution_enabled: false,
      credential_values_exposed: false,
    },
    connection_details: connectionDetails,
    note: 'Read-only Zapier Tool Bridge. No Zapier tools are invoked.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
