import { describe, expect, it } from 'vitest'
import { buildBridgeApprovalUiState, type BridgeApprovalUiInput } from './bridge-approval-ui-state'

type ModelOverrides = Omit<Partial<BridgeApprovalUiInput>, 'scope' | 'owner' | 'lifecycle' | 'execution' | 'audit' | 'rollback'> & {
  scope?: Partial<BridgeApprovalUiInput['scope']>
  owner?: Partial<BridgeApprovalUiInput['owner']>
  lifecycle?: Partial<BridgeApprovalUiInput['lifecycle']>
  execution?: Partial<BridgeApprovalUiInput['execution']>
  audit?: Partial<BridgeApprovalUiInput['audit']>
  rollback?: Partial<BridgeApprovalUiInput['rollback']>
}

function model(overrides: ModelOverrides = {}): BridgeApprovalUiInput {
  const state = overrides.lifecycle?.approval_state || 'pending'
  return {
    id: overrides.id || `apr_${state}`,
    request_type: overrides.request_type || 'buildwiki.run_now',
    scope: {
      connector: 'skill.build_wiki',
      action: 'buildwiki.run_now',
      target: 'opencloud-docs-farmer.service',
      target_key: 'opencloud-docs-farmer.service',
      protected_category: 'tooling',
      risk_level: 'medium',
      approval_scope: {
        service: 'opencloud-docs-farmer.service',
        scope: 'buildwiki.run_now',
      },
      scope_hash: 'hash_buildwiki',
      ...overrides.scope,
    },
    owner: {
      requester: 'owner',
      requester_user_id: 1,
      required_approver: 'owner',
      resolved_by: null,
      resolved_by_user_id: null,
      resolution_reason: null,
      ...overrides.owner,
    },
    lifecycle: {
      approval_state: state,
      requested_at: '2026-05-09T14:00:00.000Z',
      created_at: '2026-05-09T14:00:00.000Z',
      expires_at: '2026-05-09T14:30:00.000Z',
      resolved_at: null,
      approved_at: null,
      denied_at: null,
      expired_at: null,
      ...overrides.lifecycle,
    },
    execution: {
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      executor: null,
      run_id: null,
      run_state: null,
      result: null,
      error: null,
      started_at: null,
      completed_at: null,
      audit_event_id: null,
      ...overrides.execution,
    },
    audit: {
      latest_event_id: null,
      latest_outcome: null,
      latest_actor: null,
      correlation_id: 'corr_buildwiki',
      ...overrides.audit,
    },
    rollback: {
      available: true,
      ref: 'systemctl --user stop opencloud-docs-farmer.service',
      ...overrides.rollback,
    },
  }
}

describe('Bridge approval UI state', () => {
  it('exposes pending approvals with exact approve and deny commands but no execution affordance', () => {
    const state = buildBridgeApprovalUiState({
      models: [model({ id: 'apr_pending' })],
      generatedAt: '2026-05-09T14:05:00.000Z',
    })

    expect(state.summary).toMatchObject({
      total: 1,
      pending: 1,
      history: 0,
    })
    expect(state.pending).toHaveLength(1)
    expect(state.pending[0]).toMatchObject({
      id: 'apr_pending',
      ui_state: 'pending',
      status_grammar: 'yellow',
      title: 'buildwiki.run_now',
      scope_label: 'skill.build_wiki · buildwiki.run_now · opencloud-docs-farmer.service',
      commands: {
        approve: {
          method: 'POST',
          path: '/api/bridge/approval-requests/apr_pending/approve',
          enabled: true,
        },
        deny: {
          method: 'POST',
          path: '/api/bridge/approval-requests/apr_pending/deny',
          enabled: true,
        },
        execute: {
          enabled: false,
          blocker: 'owner_approval_required_before_execution',
        },
      },
      audit: {
        correlation_id: 'corr_buildwiki',
      },
      execution: {
        accepted_for_execution: false,
        execution_enabled: false,
        writes_enabled: false,
      },
    })
  })

  it('moves approved, denied, completed, failed, and expired approvals to history without approve or deny commands', () => {
    const state = buildBridgeApprovalUiState({
      models: [
        model({
          id: 'apr_completed',
          lifecycle: { approval_state: 'approved', approved_at: '2026-05-09T14:06:00.000Z', resolved_at: '2026-05-09T14:06:00.000Z' },
          execution: {
            accepted_for_execution: true,
            run_id: 'run_completed',
            run_state: 'completed',
            result: 'run dispatched / completed',
            audit_event_id: 'audit_completed',
          },
          audit: { latest_event_id: 'audit_completed', latest_outcome: 'completed' },
        }),
        model({
          id: 'apr_denied',
          lifecycle: { approval_state: 'denied', denied_at: '2026-05-09T14:07:00.000Z', resolved_at: '2026-05-09T14:07:00.000Z' },
        }),
        model({
          id: 'apr_failed',
          lifecycle: { approval_state: 'approved', approved_at: '2026-05-09T14:08:00.000Z', resolved_at: '2026-05-09T14:08:00.000Z' },
          execution: {
            accepted_for_execution: true,
            run_id: 'run_failed',
            run_state: 'failed',
            error: 'service_down',
            audit_event_id: 'audit_failed',
          },
        }),
        model({
          id: 'apr_expired',
          lifecycle: { approval_state: 'pending', expires_at: '2026-05-09T13:00:00.000Z' },
        }),
      ],
      generatedAt: '2026-05-09T14:10:00.000Z',
    })

    expect(state.pending).toEqual([])
    expect(state.history.map((row) => row.id)).toEqual(['apr_completed', 'apr_denied', 'apr_failed', 'apr_expired'])
    expect(state.history.map((row) => row.ui_state)).toEqual(['completed', 'denied', 'failed', 'expired'])
    expect(state.history.every((row) => !row.commands.approve.enabled && !row.commands.deny.enabled)).toBe(true)
    expect(state.history.find((row) => row.id === 'apr_completed')?.result_label).toBe('run dispatched / completed')
    expect(state.history.find((row) => row.id === 'apr_failed')?.result_label).toBe('service_down')
    expect(state.summary).toMatchObject({
      total: 4,
      pending: 0,
      completed: 1,
      denied: 1,
      failed: 1,
      expired: 1,
      history: 4,
    })
  })
})
