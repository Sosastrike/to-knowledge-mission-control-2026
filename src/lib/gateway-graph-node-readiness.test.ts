import { describe, expect, it } from 'vitest'

import {
  buildGatewayGraphNodeReadiness,
  nodeColorForStatus,
} from '@/lib/gateway-graph-node-readiness'

describe('gateway graph node readiness', () => {
  it('maps node readiness status to card colors without making guarded systems look offline', () => {
    expect(nodeColorForStatus('live')).toBe('green')
    expect(nodeColorForStatus('read_only')).toBe('cyan')
    expect(nodeColorForStatus('approval_required')).toBe('yellow')
    expect(nodeColorForStatus('standby')).toBe('gray')
    expect(nodeColorForStatus('degraded')).toBe('yellow')
    expect(nodeColorForStatus('blocked')).toBe('red')
    expect(nodeColorForStatus('disabled')).toBe('gray')
  })

  it('covers every visible Gateway card and keeps readiness separate from edge health', () => {
    const payload = buildGatewayGraphNodeReadiness('2026-06-08T20:00:00.000Z')

    expect(payload.ok).toBe(true)
    expect(payload.nodes.length).toBe(42)
    expect(payload.graph_health).toMatchObject({
      readiness_feed: 'healthy',
      graph_data_source: 'live',
      edge_count_expected: 22,
      node_count_expected: 42,
      node_count_returned: 42,
      node_mapping_errors: [],
      static_asset_version: 'gateway-node-readiness-v1',
    })
  })

  it('marks model cards live except xAI, which stays blocked with the real provider blocker', () => {
    const payload = buildGatewayGraphNodeReadiness('2026-06-08T20:00:00.000Z')
    const byId = new Map(payload.nodes.map((node) => [node.node_id, node]))

    for (const id of ['model.openrouter', 'model.openai', 'model.claude', 'model.ollama', 'model.nvidia', 'model.gemini', 'model.groq']) {
      expect(byId.get(id)).toMatchObject({
        domain: 'model',
        status: 'live',
        color: 'green',
        read_ready: true,
        execute_ready: true,
        approval_required: false,
      })
    }

    expect(byId.get('model.xai_grok')).toMatchObject({
      domain: 'model',
      status: 'blocked',
      color: 'red',
      primary_reason: 'xai_grok_permission_or_billing_required',
      execute_ready: false,
      next_action: 'fix_xai_console_team_api_billing_credit_or_permission_before_unlocking',
    })
  })

  it('shows guarded and read-only connectors as active states instead of gray offline cards', () => {
    const payload = buildGatewayGraphNodeReadiness('2026-06-08T20:00:00.000Z')
    const byId = new Map(payload.nodes.map((node) => [node.node_id, node]))

    expect(byId.get('int.zapier')).toMatchObject({
      domain: 'connector',
      status: 'read_only',
      color: 'cyan',
      primary_reason: 'zapier_discovery_ready_writes_guarded',
      short_label: 'Zapier discovery ready · writes guarded',
      read_ready: true,
      write_ready: false,
      execute_ready: false,
      approval_required: true,
    })

    expect(byId.get('int.agentmail')).toMatchObject({
      domain: 'agentmail',
      status: 'live',
      color: 'green',
      primary_reason: 'approval_gated_send_ready',
      short_label: 'AgentMail ready · approval-gated sending',
      setup_state: 'approval_gated_send_ready',
      per_action_state: 'no_pending_send_request',
      lock_scope: 'external_delivery_per_send',
      read_ready: true,
      write_ready: true,
      execute_ready: true,
      approval_required: true,
    })

    expect(byId.get('int.reports')).toMatchObject({
      domain: 'report',
      status: 'read_only',
      color: 'cyan',
      short_label: 'Preview ready · delivery guarded',
      primary_reason: 'report_preview_ready_delivery_not_enabled',
    })
  })

  it('keeps standby cards gray with exact not-offline copy', () => {
    const payload = buildGatewayGraphNodeReadiness('2026-06-08T20:00:00.000Z')
    const byId = new Map(payload.nodes.map((node) => [node.node_id, node]))

    expect(byId.get('input.webhook')).toMatchObject({
      domain: 'webhook',
      status: 'standby',
      color: 'gray',
      short_label: 'Receiver ready · waiting for events',
      primary_reason: 'webhook_receiver_ready_no_recent_events',
    })
    expect(byId.get('input.event')).toMatchObject({
      domain: 'connector',
      status: 'standby',
      color: 'gray',
      short_label: 'Event bus ready · no recent events',
      primary_reason: 'event_bus_ready_no_recent_events',
    })
  })

  it('does not expose secrets or enable external writes in node readiness', () => {
    const payload = buildGatewayGraphNodeReadiness('2026-06-08T20:00:00.000Z')

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
