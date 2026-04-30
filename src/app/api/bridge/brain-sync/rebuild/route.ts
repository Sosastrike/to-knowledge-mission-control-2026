import { NextRequest, NextResponse } from 'next/server'
import { authJson, ownerApprovalRequired } from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REBUILD_STUB = {
  protected_action: 'brain_sync_rebuild',
  current_state: 'OWNER_APPROVAL_REQUIRED',
  no_execution_enabled: true,
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
    mode: 'brain_sync_rebuild_protected_stub',
    generated_at: new Date().toISOString(),
    ...REBUILD_STUB,
    next_action: 'Use this endpoint only as a protected-action contract until approval/audit persistence is applied.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = authJson(request, 'operator')
  if (auth) return auth

  return ownerApprovalRequired({
    reason: 'brain_sync_rebuild_requires_owner_approval_and_audit_persistence',
    http_status_when_blocked: 423,
    ...REBUILD_STUB,
    rebuild_started: false,
    memory_written: false,
    next_action: 'Owner approval plus persistent audit chain are required before Brain Sync rebuild execution.',
  })
}
