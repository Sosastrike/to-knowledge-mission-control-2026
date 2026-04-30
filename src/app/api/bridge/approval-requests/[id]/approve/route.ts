import { NextRequest } from 'next/server'
import { authJson, ownerApprovalRequired } from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const auth = authJson(request, 'operator')
  if (auth) return auth

  const { id } = await params
  return ownerApprovalRequired({
    approval_id: id,
    action: 'approve',
    reason: 'approval_persistence_not_applied',
    persistence: 'not_applied',
    current_state: 'OWNER_APPROVAL_REQUIRED',
    http_status_when_blocked: 423,
    no_execution_enabled: true,
    no_connector_writes_enabled: true,
    approval_request_created: false,
    accepted_for_execution: false,
    next_action: 'Apply the owner-approved bridge approval/audit migration before approvals can be persisted or executed.',
  })
}
