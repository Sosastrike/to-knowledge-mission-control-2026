import { listApprovalRequests } from '@/lib/approval-requests'
import { jarvisBridgeSessionStatus } from '@/lib/jarvis-bridge-session'

export type BridgeAccessState =
  | 'inactive'
  | 'active'
  | 'approval_pending'
  | 'approved_no_execution_runner'
  | 'denied'
  | 'expired'
  | 'failed'

const BRIDGE_ACTIONS = new Set([
  'bridge_session',
  'agent_zero_full_access',
  'jarvis_full_access',
  'execution_session',
])

function isBridgeSessionRequest(request: {
  connector: string
  action: string
  protected_category: string
}) {
  const connector = request.connector.toLowerCase()
  const action = request.action.toLowerCase()
  const category = request.protected_category.toLowerCase()
  return connector === 'bridge' || category === 'bridge_session' || BRIDGE_ACTIONS.has(action)
}

export function bridgeSessionContract() {
  const jarvisSession = jarvisBridgeSessionStatus()
  const requests = listApprovalRequests().filter(isBridgeSessionRequest)
  const approved = requests.find((request) => request.approval_state === 'approved') || null
  const pending = requests.find((request) => request.approval_state === 'pending') || null
  const denied = requests.find((request) => request.approval_state === 'denied') || null
  const state: BridgeAccessState = jarvisSession.state === 'active'
    ? 'active'
    : approved
    ? 'approved_no_execution_runner'
    : pending
      ? 'approval_pending'
      : denied
        ? 'denied'
        : 'inactive'

  return {
    state,
    jarvis_owner_operator_session: jarvisSession,
    owner_approved_session: Boolean(approved),
    standing_owner_session_active: jarvisSession.state === 'active',
    active_approval_id: approved?.id || null,
    pending_approval_id: pending?.id || null,
    denied_approval_id: denied?.id || null,
    execution_permission_enabled: jarvisSession.state === 'active',
    execution_runner_enabled: jarvisSession.state === 'active',
    exact_scope_mcp_status_probe_enabled: jarvisSession.state === 'active',
    internal_writes_enabled: jarvisSession.internal_writes_enabled,
    write_adapters_enabled: jarvisSession.state === 'active',
    protected_execution_enabled: jarvisSession.state === 'active',
    external_writes_enabled: jarvisSession.state === 'active',
    audit_sink_enabled: jarvisSession.state === 'active',
    rollback_proof_present: jarvisSession.state === 'active',
    credential_values_exposed: false,
    exact_blocker: jarvisSession.state === 'active'
      ? 'owner_hard_stops_only_remaining'
      : approved
      ? 'execution_adapter_not_enabled'
      : pending
        ? 'bridge_session_approval_pending'
        : 'bridge_session_required',
    next_action: jarvisSession.state === 'active'
      ? 'Jarvis may write Mission Control internal state and execute certified exact-scope adapters with audit and rollback. Owner-hard-stop lanes remain blocked: raw secrets, .env edits, credential injection, public exposure, destructive deletion, spending above cap, disabling auth/audit/rollback, and broad connector execution.'
      : approved
      ? 'Wire and verify a scoped execution adapter, audit sink, and rollback path before Jarvis can execute protected actions.'
      : 'Create and approve a scoped Bridge Session request for Jarvis / Agent Zero.',
  }
}

export function protectedActionBlocker(action: string, target: string) {
  const session = bridgeSessionContract()
  return {
    route: 'bridge.protected-action',
    action,
    target,
    state: 'OWNER_GATED',
    blocker_class: 'OWNER_GATED',
    owner_approval_required: true,
    bridge_session: session,
    exact_blocker: session.exact_blocker,
    execution_enabled: false,
    writes_enabled: false,
    protected_execution_enabled: false,
    external_writes_enabled: false,
    approval_request_created: false,
    accepted_for_execution: false,
    audit_record_written: false,
    credential_values_exposed: false,
    fake_success_allowed: false,
    no_go_claim: true,
    go_claim_allowed: false,
    rollback_command: `keep ${target} ${action} disabled; require active Bridge Session, scoped adapter, audit trail, and rollback proof`,
    next_action: session.next_action,
  }
}
