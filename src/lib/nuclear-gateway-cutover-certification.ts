import { buildAgentRoutingLinesStatus } from '@/lib/agent-routing-lines'
import { buildCredentialBrokerStatus } from '@/lib/credential-broker'
import { buildNuclearGatewayToolMigrationStatus } from '@/lib/nuclear-gateway-tool-migration'
import { buildOpenCloudAuthorityPolicy, evaluateOpenCloudAuthority } from '@/lib/opencloud-authority-policy'

export const NUCLEAR_GATEWAY_CUTOVER_PHASE = 'phase_10_cutover_disable_openclaw_operational_path' as const

export type NuclearGatewayCutoverCriterionStatus = 'PASS' | 'SOURCE_READY' | 'BLOCKED'

export type NuclearGatewayCutoverCriterion = {
  id: string
  label: string
  status: NuclearGatewayCutoverCriterionStatus
  blocker: string | null
  proof: string[]
}

function criterion(input: NuclearGatewayCutoverCriterion): NuclearGatewayCutoverCriterion {
  return input
}

function passed(item: NuclearGatewayCutoverCriterion) {
  return item.status === 'PASS'
}

export function buildNuclearGatewayCutoverCertificationStatus() {
  const lines = buildAgentRoutingLinesStatus()
  const credentialBroker = buildCredentialBrokerStatus()
  const toolMigration = buildNuclearGatewayToolMigrationStatus()
  const authorityPolicy = buildOpenCloudAuthorityPolicy()
  const openclawLine = lines.by_id.openclaw

  const openclawCommanderAttempt = evaluateOpenCloudAuthority({
    target_agent: 'openclaw',
    invoked_by: 'owner',
    opencloud_role: 'commander',
    conversation_owner: 'openclaw',
    direct_line_used: false,
  })
  const openclawHiddenIntermediaryAttempt = evaluateOpenCloudAuthority({
    target_agent: 'ron-weasley',
    invoked_by: 'openclaw',
    opencloud_role: 'hidden_dispatcher',
    conversation_owner: 'ron-weasley',
    direct_line_used: false,
    hidden_intermediary: true,
  })

  const criteria = [
    criterion({
      id: 'phase_1_dependency_map',
      label: 'OpenClaw/OpenCloud dependencies inventoried and classified',
      status: 'PASS',
      blocker: null,
      proof: ['runtime/openclaw-dependency-map.md'],
    }),
    criterion({
      id: 'phase_2_direct_line_registry',
      label: 'Universal direct-line registry is Nuclear Gateway owned',
      status: openclawLine?.direct_line_active === false && openclawLine.conversation_owner === 'none' ? 'PASS' : 'BLOCKED',
      blocker: openclawLine?.direct_line_active === false ? null : 'openclaw_direct_line_must_remain_inactive',
      proof: ['/api/bridge/agent-routing/lines'],
    }),
    criterion({
      id: 'phase_3_message_envelope',
      label: 'Message envelope requires direct line and refuses hidden intermediary routing',
      status: lines.hidden_intermediaries_allowed === false ? 'PASS' : 'BLOCKED',
      blocker: lines.hidden_intermediaries_allowed === false ? null : 'hidden_intermediary_policy_not_enforced',
      proof: ['/api/bridge/agent-routing/send', '/api/bridge/agent-routing/trace/probe'],
    }),
    criterion({
      id: 'phase_4_openclaw_demotion_policy',
      label: 'OpenClaw commander and hidden intermediary attempts are refused',
      status: openclawCommanderAttempt.allowed === false && openclawHiddenIntermediaryAttempt.allowed === false ? 'PASS' : 'BLOCKED',
      blocker: openclawCommanderAttempt.allowed || openclawHiddenIntermediaryAttempt.allowed ? 'openclaw_refusal_policy_failed' : null,
      proof: [
        openclawCommanderAttempt.exact_blocker || 'commander_attempt_refused',
        openclawHiddenIntermediaryAttempt.exact_blocker || 'hidden_intermediary_attempt_refused',
      ],
    }),
    criterion({
      id: 'phase_5_credential_broker',
      label: 'Credential broker is Nuclear Gateway owned and name-only',
      status: credentialBroker.credential_broker_owner === 'nuclear_gateway' && credentialBroker.values_exposed === false ? 'PASS' : 'BLOCKED',
      blocker: credentialBroker.values_exposed === false ? null : 'credential_values_exposure_policy_failed',
      proof: ['/api/bridge/credentials/status', '/api/bridge/credentials/broker-check'],
    }),
    criterion({
      id: 'phase_6_tool_migration_map',
      label: 'OpenClaw tool dependencies mapped into Gateway registries',
      status: toolMigration.gateway_tool_broker_of_record && !toolMigration.openclaw_tool_broker_of_record ? 'PASS' : 'BLOCKED',
      blocker: toolMigration.gateway_tool_broker_of_record ? null : 'gateway_tool_broker_not_ready',
      proof: ['/api/bridge/nuclear-gateway/tool-migration'],
    }),
    criterion({
      id: 'phase_7_agent_hub_graph',
      label: 'Agent Hub shows Nuclear Gateway as broker and OpenClaw as supporting runtime only',
      status: 'PASS',
      blocker: null,
      proof: ['/gateway/agent-hub', '/api/gateway/agent-hub/status'],
    }),
    criterion({
      id: 'phase_8_brain_bridge_connection',
      label: 'Brain Bridge source contract is Nuclear Gateway connected',
      status: 'SOURCE_READY',
      blocker: 'mission_control_service_reload_required_for_live_phase8_payload',
      proof: ['/api/bridge/brain-sync/gateway-status', 'src/lib/brain-sync-gateway-status.ts'],
    }),
    criterion({
      id: 'phase_9_trace_kit',
      label: 'Direct Agent Line Trace Kit source and local probe proof are installed',
      status: 'SOURCE_READY',
      blocker: 'live_external_agent_receive_probe_still_required',
      proof: ['/home/tony/agent-line-trace.sh', '/api/bridge/agent-routing/trace/live', '/api/bridge/agent-routing/trace/probe'],
    }),
    criterion({
      id: 'phase_10_runtime_cutover',
      label: 'OpenClaw operational path disable/isolation',
      status: 'BLOCKED',
      blocker: 'runtime_disable_waiting_on_live_direct_line_proof_dependency_cutover_and_rollback_confirmation',
      proof: ['No OpenClaw service stop/disable attempted in this source-only hop.'],
    }),
  ]

  const passedCount = criteria.filter(passed).length
  const blockedCriteria = criteria.filter((item) => item.status !== 'PASS')
  const cutoverCertified = blockedCriteria.length === 0

  return {
    ok: true,
    route: 'bridge.nuclear-gateway.cutover-certification',
    phase: NUCLEAR_GATEWAY_CUTOVER_PHASE,
    generated_at: new Date().toISOString(),
    architecture: 'owner -> mission-control -> nuclear-gateway -> direct-agent-line -> certified-adapter-or-mcp-api-tool',
    final_status: cutoverCertified ? 'OPENCLOUD_REMOVED_FROM_OPERATIONAL_PATH' : 'CUTOVER_NOT_CERTIFIED',
    target_final_statuses: [
      'OPENCLOUD_REMOVED_FROM_OPERATIONAL_PATH',
      'NUCLEAR_GATEWAY_ACTIVE',
      'UNIVERSAL_DIRECT_AGENT_LINES_READY',
    ],
    OPENCLOUD_REMOVED_FROM_OPERATIONAL_PATH: cutoverCertified,
    NUCLEAR_GATEWAY_ACTIVE: passedCount >= 7 ? 'SOURCE_READY' : 'BLOCKED',
    UNIVERSAL_DIRECT_AGENT_LINES_READY: blockedCriteria.some((item) => item.id === 'phase_9_trace_kit') ? 'SOURCE_READY_PENDING_LIVE_PROOF' : 'READY',
    cutover_allowed: cutoverCertified,
    disable_openclaw_service_allowed: false,
    openclaw_service_mutation_performed: false,
    openclaw_runtime_role: 'supporting_runtime_tool_layer_only_until_cutover',
    openclaw_conversation_owner_allowed: false,
    openclaw_hidden_intermediary_allowed: false,
    openclaw_credential_broker_allowed: false,
    openclaw_commander_allowed: false,
    openclaw_commander_attempt: {
      allowed: openclawCommanderAttempt.allowed,
      exact_blocker: openclawCommanderAttempt.exact_blocker,
    },
    openclaw_hidden_intermediary_attempt: {
      allowed: openclawHiddenIntermediaryAttempt.allowed,
      exact_blocker: openclawHiddenIntermediaryAttempt.exact_blocker,
    },
    criteria_count: criteria.length,
    pass_count: passedCount,
    blocked_count: blockedCriteria.length,
    blockers: blockedCriteria.map((item) => ({ id: item.id, blocker: item.blocker })),
    criteria,
    authority_policy_summary: {
      opencloud_demoted: authorityPolicy.opencloud_demoted,
      openclaw_demoted: authorityPolicy.openclaw_demoted,
      can_route_owner_messages: authorityPolicy.can_route_owner_messages,
      can_be_default_gateway: authorityPolicy.can_be_default_gateway,
      can_broker_credentials: authorityPolicy.can_broker_credentials,
    },
    line_registry_summary: {
      lines_count: lines.lines_count,
      openclaw_line: {
        direct_line_active: openclawLine?.direct_line_active ?? null,
        conversation_owner: openclawLine?.conversation_owner ?? null,
        allowed_as_tool: openclawLine?.allowed_as_tool ?? null,
        allowed_as_intermediary: openclawLine?.allowed_as_intermediary ?? null,
        allowed_as_commander: openclawLine?.allowed_as_commander ?? null,
      },
    },
    credential_broker_summary: {
      credential_broker_owner: credentialBroker.credential_broker_owner,
      openclaw_credential_broker_allowed: credentialBroker.openclaw_credential_broker_allowed,
      values_exposed: credentialBroker.values_exposed,
    },
    tool_migration_summary: {
      entries_count: toolMigration.entries_count,
      openclaw_tool_broker_of_record: toolMigration.openclaw_tool_broker_of_record,
      gateway_tool_broker_of_record: toolMigration.gateway_tool_broker_of_record,
    },
    next_safe_lane: 'Collect live external direct-line receive proof and reload Mission Control for refreshed Phase 8 payload before any runtime cutover.',
    rollback_command: 'cd /home/tony/mission-control && git revert <phase-10-cutover-preflight-commit>',
    credential_values_exposed: false,
    raw_env_values_exposed: false,
    no_secrets_exposed: true,
    external_writes_enabled: false,
    project_continues: true,
  }
}
