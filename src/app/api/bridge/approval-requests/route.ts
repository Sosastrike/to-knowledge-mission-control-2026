import { NextRequest, NextResponse } from 'next/server'
import { authJson, ownerApprovalRequired } from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APPROVAL_STUB = {
  persistence: 'not_applied',
  no_execution_enabled: true,
  no_connector_writes_enabled: true,
  migration_required: 'bridge approval/audit persistence migration',
  canonical_contract: '/api/bridge/approval-contract',
}

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  return NextResponse.json({
    ok: true,
    mode: 'approval_requests_read_only_stub',
    generated_at: new Date().toISOString(),
    ...APPROVAL_STUB,
    approvals: [],
    summary: {
      total: 0,
      pending: 0,
      approved: 0,
      denied: 0,
      expired: 0,
    },
    next_action: 'Owner must approve and apply the bridge approval/audit migration before approval requests can persist.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = authJson(request, 'operator')
  if (auth) return auth

  return ownerApprovalRequired({
    reason: 'approval_persistence_not_applied',
    current_state: 'OWNER_APPROVAL_REQUIRED',
    http_status_when_blocked: 423,
    ...APPROVAL_STUB,
    accepted_for_execution: false,
    approval_request_created: false,
    next_action: 'Apply the owner-approved bridge approval/audit migration before creating persistent approval requests.',
  })
}
