import { describe, expect, it } from 'vitest'

import { buildGatewayApprovalCenter } from './gateway-approval-center'

describe('Gateway Approval Center', () => {
  it('classifies vague Gateway approval states into exact operator states', () => {
    const payload = buildGatewayApprovalCenter('2026-06-09T12:00:00.000Z')
    const byComponent = new Map(payload.items.map((item) => [item.component, item]))

    expect(byComponent.get('AgentMail')).toMatchObject({
      state: 'standing_scope_active',
      exact_reason: 'agentmail_setup_ready_no_pending_send_request',
      approval_required: false,
      write_enabled: true,
    })
    expect(byComponent.get('Zapier')).toMatchObject({
      state: 'standing_scope_active',
      standing_scope_id: 'zapier.scope.discovery_and_status',
      write_enabled: false,
      execute_enabled: false,
    })
    expect(byComponent.get('OpenCloud / OCTM')).toMatchObject({
      state: 'approval_needed',
      exact_reason: 'opencloud_workers_runtime_ready_execution_guarded',
    })
    expect(byComponent.get('Palacio / MemPalace')).toMatchObject({
      state: 'approval_needed',
      exact_reason: 'mempalace_writes_bridge_gated',
    })
    expect(byComponent.get('Obsidian Vault')).toMatchObject({
      state: 'approval_needed',
      exact_reason: 'obsidian_reads_ready_writes_guarded',
      node_id: 'brain.obsidian',
    })
    expect(byComponent.get('Graphify / Graffiti')).toMatchObject({
      state: 'approval_needed',
      exact_reason: 'graphify_reads_ready_writes_guarded',
      node_id: 'brain.graphify',
    })
    expect(byComponent.get('Brain Sync')).toMatchObject({
      state: 'approval_needed',
      exact_reason: 'brain_sync_runtime_ready_writes_guarded',
    })
    expect(byComponent.get('GBrain')).toMatchObject({
      state: 'read_only_active',
      exact_reason: 'gbrain_inventory_only_no_tool_invocation',
      node_id: 'brain.gbrain',
    })
  })

  it('reports safe exposure flags and no external writes', () => {
    const payload = buildGatewayApprovalCenter('2026-06-09T12:00:00.000Z')

    expect(payload).toMatchObject({
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_executed: false,
      broad_connector_execution_enabled: false,
    })
    expect(JSON.stringify(payload)).not.toMatch(
      /Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i,
    )
  })
})
