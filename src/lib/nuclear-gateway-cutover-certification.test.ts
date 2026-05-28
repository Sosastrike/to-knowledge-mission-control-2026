import { describe, expect, it } from 'vitest'

import { buildNuclearGatewayCutoverCertificationStatus } from '@/lib/nuclear-gateway-cutover-certification'

describe('Nuclear Gateway cutover certification preflight', () => {
  it('does not certify cutover while live direct-line and service reload blockers remain', () => {
    const status = buildNuclearGatewayCutoverCertificationStatus()

    expect(status).toMatchObject({
      ok: true,
      route: 'bridge.nuclear-gateway.cutover-certification',
      phase: 'phase_10_cutover_disable_openclaw_operational_path',
      final_status: 'CUTOVER_NOT_CERTIFIED',
      OPENCLOUD_REMOVED_FROM_OPERATIONAL_PATH: false,
      cutover_allowed: false,
      disable_openclaw_service_allowed: false,
      openclaw_service_mutation_performed: false,
      openclaw_conversation_owner_allowed: false,
      openclaw_hidden_intermediary_allowed: false,
      openclaw_credential_broker_allowed: false,
      openclaw_commander_allowed: false,
      credential_values_exposed: false,
      raw_env_values_exposed: false,
      no_secrets_exposed: true,
      external_writes_enabled: false,
      project_continues: true,
    })
    expect(status.blockers).toEqual(expect.arrayContaining([
      { id: 'phase_8_brain_bridge_connection', blocker: 'mission_control_service_reload_required_for_live_phase8_payload' },
      { id: 'phase_9_trace_kit', blocker: 'live_external_agent_receive_probe_still_required' },
      { id: 'phase_10_runtime_cutover', blocker: 'runtime_disable_waiting_on_live_direct_line_proof_dependency_cutover_and_rollback_confirmation' },
    ]))
  })

  it('proves OpenClaw commander and hidden intermediary attempts are refused', () => {
    const status = buildNuclearGatewayCutoverCertificationStatus()

    expect(status.openclaw_commander_attempt).toMatchObject({
      allowed: false,
      exact_blocker: 'opencloud_cannot_be_conversation_owner',
    })
    expect(status.openclaw_hidden_intermediary_attempt).toMatchObject({
      allowed: false,
      exact_blocker: 'opencloud_hidden_intermediary_forbidden',
    })
    expect(status.line_registry_summary.openclaw_line).toMatchObject({
      direct_line_active: false,
      conversation_owner: 'none',
      allowed_as_tool: true,
      allowed_as_intermediary: false,
      allowed_as_commander: false,
    })
  })
})
