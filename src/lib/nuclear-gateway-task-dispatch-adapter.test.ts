import { describe, expect, it } from 'vitest'

import {
  buildNuclearGatewayTaskDispatchAdapterStatus,
  buildNuclearGatewayTaskDispatchPreview,
} from '@/lib/nuclear-gateway-task-dispatch-adapter'
import { buildAgentLineTraceRecord } from '@/lib/agent-line-trace'

describe('Nuclear Gateway task dispatch adapter contract', () => {
  it('publishes source-ready task dispatch adapters without invoking OpenClaw', () => {
    const status = buildNuclearGatewayTaskDispatchAdapterStatus()

    expect(status).toMatchObject({
      ok: true,
      route: 'bridge.nuclear-gateway.task-dispatch-adapter',
      phase: 'phase_6_task_dispatch_adapter_contract',
      status: 'SOURCE_READY_EXECUTION_BLOCKED',
      openclaw_runtime_invoked: false,
      openclaw_conversation_owner_allowed: false,
      openclaw_hidden_intermediary_allowed: false,
      openclaw_default_gateway_allowed: false,
      openclaw_credential_broker_allowed: false,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
    })
    expect(status.adapters).toHaveLength(4)
    expect(status.adapters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'task_dispatch_new_session',
        route: '/api/bridge/agent-routing/send',
        openclaw_allowed_role: 'not_allowed',
        execution_enabled: false,
      }),
      expect.objectContaining({
        id: 'task_dispatch_target_session',
        blocker: 'target_session_direct_line_handoff_live_proof_required',
      }),
      expect.objectContaining({
        id: 'aegis_review',
        blocker: 'aegis_review_direct_line_adapter_live_proof_required',
      }),
      expect.objectContaining({
        id: 'task_broadcast',
        blocker: 'task_broadcast_direct_line_fanout_live_proof_required',
      }),
    ]))
  })

  it('builds a direct Nuclear Gateway envelope preview for Ron task dispatch without execution', () => {
    const preview = buildNuclearGatewayTaskDispatchPreview({
      dispatch_kind: 'task_dispatch_new_session',
      task_id: 140,
      target_agent: 'ron',
      message: 'Review this direct-line dispatch task.',
      visible_task_id: '140',
    })

    expect(preview).toMatchObject({
      ok: true,
      exact_blocker: 'execution_blocked_until_live_receive_trace_proof',
      dispatch_kind: 'task_dispatch_new_session',
      task_id: '140',
      target_agent: 'ron-weasley',
      conversation_owner: 'ron-weasley',
      direct_line_used: true,
      route_trace: ['owner', 'mission-control', 'nuclear-gateway', 'ron-weasley'],
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      openclaw_used: false,
      openclaw_hidden_intermediary_allowed: false,
      credential_values_exposed: false,
    })
    expect(preview.audit_preview).toMatchObject({
      action: 'nuclear_gateway.task_dispatch.preview',
      actor: 'nuclear-gateway',
      target_type: 'direct_agent_line',
      target: 'ron-weasley',
      payload_values_exposed: false,
    })
    expect(preview.rollback_or_no_state_proof).toMatchObject({
      proof_type: 'NO_STATE_PREVIEW_ONLY',
      no_runtime_mutation: true,
      no_external_write: true,
      rollback_required: false,
      rollback_ref: 'no_state_preview_only',
    })
    expect(preview.envelope_preview).toMatchObject({
      source_channel: 'nuclear_gateway_task_dispatch',
      target_agent: 'ron-weasley',
      target_system: 'task_dispatch_new_session',
      conversation_owner: 'ron-weasley',
      visible_task_id: '140',
      intermediaries: [],
      tools_called: [],
      opencloud_used: false,
    })
  })

  it('links live direct-line receive trace proof without enabling execution', () => {
    const trace = buildAgentLineTraceRecord({
      target_agent: 'ron-weasley',
      nonce: 'TRACE-test-task-dispatch-receive-proof',
      message_received_by_agent: true,
      response_sent: true,
      local_gateway_probe: false,
      verification_sources: ['mission_control_journal_nonce', 'agent_runtime_journal_nonce'],
      create_visible_task_on_failure: false,
    })

    const preview = buildNuclearGatewayTaskDispatchPreview({
      dispatch_kind: 'task_dispatch_new_session',
      target_agent: 'ron-weasley',
      message: 'Preview dispatch with linked receive proof.',
      visible_task_id: '140',
      receive_trace_nonce: trace.nonce,
    })

    expect(preview).toMatchObject({
      ok: true,
      exact_blocker: 'execution_blocked_until_runtime_cutover_and_jarvis_concurrence',
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      receive_trace_proof: {
        status: 'PASS',
        nonce: 'TRACE-test-task-dispatch-receive-proof',
        target_agent: 'ron-weasley',
        direct_line_used: true,
        message_received_by_agent: true,
        response_sent: true,
        openclaw_used: false,
        local_gateway_probe: false,
        external_receive_verified: true,
        verification_sources: ['mission_control_journal_nonce', 'agent_runtime_journal_nonce'],
        raw_message_body_exposed: false,
      },
    })
  })

  it('does not accept local-only trace proof for task dispatch cutover', () => {
    const trace = buildAgentLineTraceRecord({
      target_agent: 'ron-weasley',
      nonce: 'TRACE-test-task-dispatch-local-only-proof',
      message_received_by_agent: true,
      response_sent: true,
      local_gateway_probe: true,
      verification_sources: ['mission_control_protected_probe_route'],
      create_visible_task_on_failure: false,
    })

    const preview = buildNuclearGatewayTaskDispatchPreview({
      dispatch_kind: 'task_dispatch_new_session',
      target_agent: 'ron-weasley',
      message: 'Preview dispatch with local-only trace.',
      visible_task_id: '140',
      receive_trace_nonce: trace.nonce,
    })

    expect(preview).toMatchObject({
      ok: true,
      exact_blocker: 'execution_blocked_until_live_receive_trace_proof',
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      receive_trace_proof: {
        status: 'FAIL',
        nonce: 'TRACE-test-task-dispatch-local-only-proof',
        local_gateway_probe: true,
        external_receive_verified: false,
        verification_sources: [],
        blocker: 'receive_trace_external_verification_source_required',
      },
    })
  })

  it('blocks OpenClaw and missing targets from becoming task dispatch owners', () => {
    expect(buildNuclearGatewayTaskDispatchPreview({
      dispatch_kind: 'task_broadcast',
      target_agent: 'openclaw',
      message: 'Broadcast through OpenClaw',
    })).toMatchObject({
      ok: false,
      exact_blocker: 'openclaw_cannot_be_task_dispatch_conversation_owner',
      target_agent: 'openclaw',
      direct_line_used: false,
      execution_enabled: false,
    })

    expect(buildNuclearGatewayTaskDispatchPreview({
      dispatch_kind: 'aegis_review',
      message: 'Review task',
    })).toMatchObject({
      ok: false,
      exact_blocker: 'target_agent_required',
      execution_enabled: false,
      credential_values_exposed: false,
    })

    expect(buildNuclearGatewayTaskDispatchPreview({
      dispatch_kind: 'unknown',
      target_agent: 'ron',
      message: 'Review task',
    })).toMatchObject({
      ok: false,
      exact_blocker: 'task_dispatch_kind_not_registered',
      execution_enabled: false,
    })
  })
})
