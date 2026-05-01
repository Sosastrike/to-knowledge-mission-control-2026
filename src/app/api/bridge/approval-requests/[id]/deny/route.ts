import { NextRequest } from 'next/server'
import { ownerApprovalRequired } from '@/lib/designer-module-api'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function POST(request: NextRequest, { params }: { params: Params }) {
  void request
  const auth = requireRole(request, 'operator')
  if ('error' in auth) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  return ownerApprovalRequired({
    approval_id: id,
    action: 'deny',
    reason: 'canonical_approval_decisions_are_telegram_only',
    current_state: 'OWNER_APPROVAL_REQUIRED',
    approval_channel: 'Tony -> Telegram',
    decision_surface: 'Telegram inline Approve/Deny buttons only',
    persistence: 'canonical_telegram_approval_queue',
    http_status_when_blocked: 423,
    no_execution_enabled: true,
    no_connector_writes_enabled: true,
    no_duplicate_approval_system: true,
    approval_request_created: false,
    accepted_for_execution: false,
    next_action: 'Use the canonical Tony Telegram Approve/Deny buttons for this exact approval id. Mission Control mirrors state but does not deny directly.',
  })
}
