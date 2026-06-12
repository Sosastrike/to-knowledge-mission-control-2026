import { NextRequest } from 'next/server'
import { buildAgentMailCapacityStatus } from '@/lib/agentmail-capacity-status'
import { buildAgentMailSendAccessStatus } from '@/lib/agentmail-local-control'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const capacity = buildAgentMailCapacityStatus()
  const sendAccess = buildAgentMailSendAccessStatus()
  const setupReady = sendAccess.setup_state === 'approval_gated_send_ready'
  const perSendState = sendAccess.per_send_status?.state || 'no_pending_send_request'
  const dispatchRuntime = sendAccess.global.agentmail_dispatch_runtime
  const readinessBlockerClass = capacity.current_primary_blocker === 'agentmail_inbox_limit_exceeded'
    ? 'CAPACITY_GATED'
    : setupReady
      ? 'APPROVAL_GATED_READY'
      : 'CREDENTIAL_GATED'

  return readOnly({
    route: 'bridge.agentmail-readiness',
    blocker_class: readinessBlockerClass,
    promotion_blocker_class: readinessBlockerClass,
    promotion_blocked: !setupReady,
    promotion_requirements_complete: setupReady,
    go_claim_allowed: false,
    promotion_summary: {
      connector_id: 'agentmail',
      read_only_current_surface: setupReady,
      current_surface_blocker_class: readinessBlockerClass,
      promotion_blocker_class: readinessBlockerClass,
      promotion_blocked: !setupReady,
      promotion_requirements_complete: setupReady,
      promotion_go_claim_allowed: false,
    },
    no_go_claim: !setupReady,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    external_writes_enabled: false,
    readiness_endpoint: '/api/bridge/agentmail-readiness',
    read_probe_endpoint: '/api/bridge/agentmail-readiness',
    owner_action_type: 'credential',
    capacity_readiness: {
      state: capacity.current_primary_blocker === 'agentmail_inbox_limit_exceeded' ? 'CAPACITY_GATED' : 'OK',
      exact_blocker: capacity.current_primary_blocker,
      owner_message: capacity.user_facing_blocker,
      live_inboxes: capacity.live_inboxes,
      required_target_inboxes: capacity.required_target_inboxes,
      provisioned_synced: capacity.provisioned_synced,
      blocked_by_provider_limit: capacity.blocked_by_provider_limit,
      blocked_inboxes: capacity.blocked.map((row) => row.email),
      recommended_resolution: capacity.recommended_resolution,
      credential_values_exposed: false,
    },
    credential_readiness: {
      state: setupReady ? 'READY' : 'CREDENTIAL_GATED',
      blocker_class: setupReady ? 'READY' : 'CREDENTIAL_GATED',
      credential_names: setupReady ? [] : ['AGENTMAIL_API_KEY'],
      credential_values_exposed: false,
      reason: capacity.current_primary_blocker === 'agentmail_inbox_limit_exceeded'
        ? 'AgentMail runtime credential is visible; inbox provisioning is blocked by provider inbox capacity.'
        : setupReady
          ? 'AgentMail runtime credential, inbox registry, scoped credentials, and send-capable permissions are visible to Mission Control.'
          : 'AgentMail credential must be provided through the approved secret path before readiness can become LIVE.',
    },
    allowed_recipient_readiness: {
      state: 'CREDENTIAL_GATED',
      blocker_class: 'CREDENTIAL_GATED',
      credential_names: ['AGENTMAIL_ALLOWED_RECIPIENTS'],
      credential_values_exposed: false,
      allowlist_required: true,
      raw_local_paths_exposed: false,
      reason: 'AgentMail sends require an approved recipient allow-list before proof.',
    },
    bridge_send_request: {
      state: perSendState === 'no_pending_send_request' ? 'IDLE_NO_PENDING_SEND_REQUEST' : perSendState === 'approved_send_dispatch_ready' ? 'APPROVED_DISPATCH_READY' : 'OWNER_GATED',
      policy: 'always-on dispatch runtime with approval-gated sends',
      approval_required: true,
      audit_required: true,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      protected_execution_enabled: false,
      fake_success_allowed: false,
      reason: perSendState === 'no_pending_send_request'
        ? 'AgentMail setup is ready for approval-gated sends, and no message is currently waiting for dispatch.'
        : 'AgentMail send requests remain locked until message approval, active dispatch runtime, Gateway policy, audit, and rollback are ready.',
    },
    agentmail_dispatch_runtime: dispatchRuntime,
    safe_send_proof: {
      state: 'OWNER_GATED',
      attempted: false,
      message_sent: false,
      allowed_recipient_only: true,
      raw_local_paths_exposed: false,
      credential_values_exposed: false,
      reason: 'Safe AgentMail send proof is pending credential, allow-list, Bridge approval, and audit proof.',
    },
    connector_ui_state: {
      state: setupReady ? 'APPROVAL_GATED_READY' : 'CREDENTIAL_GATED',
      status_endpoint: '/api/bridge/agentmail-readiness',
      configure_endpoint_state: 'OWNER_GATED',
      send_endpoint_state: 'OWNER_GATED',
      no_fake_button: true,
    },
    failure_states: [
      { state: 'CAPACITY_GATED', owner_message: 'AgentMail inbox limit exceeded. Increase capacity or approve explicit reuse mapping before send gates matter.' },
      { state: 'CREDENTIAL_GATED', owner_message: 'AgentMail credential or allowed recipient list is missing.' },
      { state: 'OWNER_GATED', owner_message: 'AgentMail send is waiting on owner message approval, active dispatch runtime, audit, and rollback proof.' },
      { state: 'BLOCKED', owner_message: 'AgentMail connector route or safe send runner is not wired in this slice.' },
    ],
    audit_state: 'OWNER_GATED',
    rollback_state: 'OWNER_GATED',
    rollback_command: 'enable AgentMail dispatch runtime emergency stop and disable the AgentMail send runner',
    promotion_requirements: [
      'AgentMail credential configured through approved secret path',
      'readiness route shows LIVE',
      'recipient allow-list verified',
      'approval-gated send request exists',
      'safe AgentMail send proof passes',
      'failure states are owner-readable',
      'audit trail exists',
      'connector UI reflects readiness truthfully',
      'no secret or raw path exposure',
    ],
    setup_state: sendAccess.setup_state,
    per_send_status: sendAccess.per_send_status,
    current_primary_blocker: setupReady ? 'approval_gated_send_ready' : sendAccess.primary_blocker || capacity.current_primary_blocker,
    exact_blockers: sendAccess.exact_blockers || [],
    next_action: setupReady
      ? (perSendState === 'no_pending_send_request' ? 'Create a send preview/request when the owner wants to dispatch a specific AgentMail message.' : sendAccess.next_action)
      : capacity.current_primary_blocker === 'agentmail_inbox_limit_exceeded'
      ? 'Resolve AgentMail inbox capacity before creating approval-gated AgentMail send requests.'
      : 'Keep AgentMail sends locked until credential, allow-list, owner approval, dispatch runtime, audit, rollback, and safe send proof are complete.',
  })
}
