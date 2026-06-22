import { NextRequest, NextResponse } from 'next/server'
import { requireRole, requireRoleOrAgentScope } from '@/lib/auth'

type Role = 'viewer' | 'operator' | 'mission_control_owner_operator' | 'admin'
type ContractState =
  | 'LIVE'
  | 'READY'
  | 'READ_ONLY'
  | 'DEGRADED'
  | 'OWNER_GATED'
  | 'CREDENTIAL_GATED'
  | 'SERVICE_DOWN'
  | 'BLOCKED'
  | 'DISABLED'
  | 'UNKNOWN'

export function authRequired(request: NextRequest, role: Role = 'viewer') {
  const auth = requireRole(request, role)
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  return null
}

export function authRequiredOrAgentScope(request: NextRequest, role: Role, scopes: string[]) {
  const auth = requireRoleOrAgentScope(request, role, scopes)
  if (!('error' in auth)) return null
  return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
}

export function readOnly(extra: Record<string, unknown> = {}) {
  return NextResponse.json({
    ok: true,
    state: 'READ_ONLY' satisfies ContractState,
    blocker_class: 'NONE',
    execution_enabled: false,
    writes_enabled: false,
    protected_execution_enabled: false,
    fake_success_allowed: false,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    no_secrets_exposed: true,
    external_writes_enabled: false,
    no_go_claim: true,
    go_claim_allowed: false,
    ...extra,
  })
}

export function ownerGated(extra: Record<string, unknown> = {}, status = 423) {
  return NextResponse.json(
    {
      ok: false,
      state: 'OWNER_GATED' satisfies ContractState,
      blocker_class: 'OWNER_GATED',
      owner_approval_required: true,
      token_governor_required: true,
      token_governor_state: 'BLOCKED',
      execution_enabled: false,
      writes_enabled: false,
      protected_execution_enabled: false,
      fake_success_allowed: false,
      approval_request_created: false,
      audit_record_written: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      external_writes_enabled: false,
      no_go_claim: true,
      go_claim_allowed: false,
      ...extra,
    },
    { status },
  )
}

export function blocked(extra: Record<string, unknown> = {}, status = 503) {
  return NextResponse.json(
    {
      ok: false,
      state: 'BLOCKED' satisfies ContractState,
      blocker_class: 'BLOCKED',
      execution_enabled: false,
      writes_enabled: false,
      protected_execution_enabled: false,
      fake_success_allowed: false,
      approval_request_created: false,
      audit_record_written: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      external_writes_enabled: false,
      no_go_claim: true,
      go_claim_allowed: false,
      ...extra,
    },
    { status },
  )
}

export function credentialGated(extra: Record<string, unknown> = {}, status = 503) {
  return NextResponse.json(
    {
      ok: false,
      state: 'CREDENTIAL_GATED' satisfies ContractState,
      blocker_class: 'CREDENTIAL_GATED',
      credential_required: true,
      execution_enabled: false,
      writes_enabled: false,
      protected_execution_enabled: false,
      fake_success_allowed: false,
      approval_request_created: false,
      audit_record_written: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      external_writes_enabled: false,
      no_go_claim: true,
      go_claim_allowed: false,
      ...extra,
    },
    { status },
  )
}
