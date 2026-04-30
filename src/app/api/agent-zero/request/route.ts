import { NextRequest, NextResponse } from 'next/server'
import { authJson, ownerApprovalRequired } from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AGENT_ZERO_STUB = {
  protected_action: 'agent_zero_request',
  current_state: 'OWNER_APPROVAL_REQUIRED',
  no_execution_enabled: true,
  no_agent_execution_enabled: true,
  no_memory_writes_enabled: true,
  no_connector_writes_enabled: true,
  persistence: 'not_applied',
  canonical_contract: '/api/bridge/approval-contract',
}

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_request_protected_stub',
    generated_at: new Date().toISOString(),
    ...AGENT_ZERO_STUB,
    next_action: 'Agent Zero remains observe/review only until owner-approved approval persistence and audit chain exist.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = authJson(request, 'operator')
  if (auth) return auth

  return ownerApprovalRequired({
    reason: 'agent_zero_execution_requires_owner_approval_and_audit_persistence',
    http_status_when_blocked: 423,
    ...AGENT_ZERO_STUB,
    agent_zero_called: false,
    request_dispatched: false,
    next_action: 'Owner approval plus persistent audit chain are required before Agent Zero execution requests.',
  })
}
