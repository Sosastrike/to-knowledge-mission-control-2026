import { NextRequest } from 'next/server'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'
import { inspectRuntimeService, runtimeServiceSpec } from '@/lib/runtime-service-status'
import { paperclipLiveStatus } from '@/lib/paperclip-live-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const spec = runtimeServiceSpec('paperclip')
  const [service, live] = await Promise.all([
    spec ? inspectRuntimeService(spec) : Promise.resolve(null),
    paperclipLiveStatus('status'),
  ])

  return readOnly({
    ...live,
    route: 'paperclip.status',
    service_reachability_blocker_class: live.health_status === 'ok' ? 'NONE' : 'SERVICE_DOWN',
    promotion_blocker_class: live.company_access_status === 'ready' ? 'OWNER_GATED' : 'OWNER_GATED',
    promotion_blocked: true,
    promotion_requirements_complete: false,
    go_claim_allowed: false,
    promotion_summary: {
      service_id: 'paperclip',
      read_only_current_surface: live.company_access_status === 'ready',
      current_surface_blocker_class: live.company_access_status === 'ready' ? 'NONE' : 'OWNER_GATED',
      promotion_blocker_class: 'OWNER_GATED',
      promotion_blocked: true,
      promotion_requirements_complete: false,
      promotion_go_claim_allowed: false,
      reason: 'Paperclip reads can be live while real task writes remain Bridge-gated.',
    },
    no_go_claim: true,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    external_writes_enabled: false,
    readiness_endpoint: service?.readiness_endpoint || '/api/paperclip/status',
    read_probe_endpoint: service?.read_probe_endpoint || '/api/paperclip/status',
    owner_action_type: 'owner_approval',
    paperclip_readiness_summary: {
      service_id: 'paperclip',
      sandbox_runtime_state: 'READ_ONLY',
      sandbox_runtime_blocker_class: live.health_status === 'ok' ? 'NONE' : 'SERVICE_DOWN',
      browser_proof_state: live.company_access_status === 'ready' ? 'READ_ONLY' : 'OWNER_GATED',
      workforce_control_plane_state: live.company_access_status === 'ready' ? 'READ_ONLY' : 'OWNER_GATED',
      protected_action_gate_state: 'OWNER_GATED',
      ...live,
    },
    service,
    sandbox_readiness: {
      state: 'READ_ONLY',
      blocker_class: live.health_status === 'ok' ? 'NONE' : 'SERVICE_DOWN',
      install_readiness: service?.install_readiness || null,
      browser_proof_state: live.company_access_status === 'ready' ? 'READ_ONLY' : 'OWNER_GATED',
      no_fake_button: true,
      reason: live.company_access_status === 'ready'
        ? 'Paperclip health is reachable and the owner-accessible ECO company is selected for read-only status.'
        : 'Paperclip health is reachable, but the owner-accessible company claim still needs browser proof.',
    },
    workforce_control_plane: {
      state: live.company_access_status === 'ready' ? 'READ_ONLY' : 'OWNER_GATED',
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      protected_execution_enabled: false,
      no_fake_button: true,
      reason: 'Paperclip can show read-only company/agent/task state. Protected task creation stays Bridge-gated.',
    },
    protected_action_gate: {
      state: 'OWNER_GATED',
      approval_required: true,
      audit_required: true,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      protected_execution_enabled: false,
      fake_success_allowed: false,
      reason: 'Workforce writes require Bridge approval, exact scope, audit, and rollback proof.',
    },
    audit_state: 'OWNER_GATED',
    rollback_state: 'OWNER_GATED',
    rollback_command: service?.rollback_command || 'disable Paperclip protected runner; keep sandbox status read-only',
    browser_proof_state: live.company_access_status === 'ready' ? 'READ_ONLY' : 'OWNER_GATED',
    failure_states: [
      { state: 'OWNER_GATED', owner_message: 'Legacy To Knowledge Gateway (TOK) still needs owner membership repair before that company can be used.' },
      { state: 'OWNER_GATED', owner_message: 'Protected Paperclip task writes are waiting on Bridge approval/audit/rollback proof.' },
    ],
    promotion_requirements: [
      'Paperclip health reachable',
      'Owner-accessible company selected',
      'Bridge approval for any write',
      'Audit trail exists for writes',
      'Rollback proof exists for writes',
    ],
  })
}
