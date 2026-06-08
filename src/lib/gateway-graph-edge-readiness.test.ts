import { describe, expect, it } from 'vitest'

import {
  buildGatewayGraphEdgeReadiness,
  edgeColorForStatus,
} from '@/lib/gateway-graph-edge-readiness'

describe('gateway graph edge readiness', () => {
  it('maps edge readiness status to the canonical graph colors', () => {
    expect(edgeColorForStatus('active')).toBe('green')
    expect(edgeColorForStatus('ready')).toBe('green')
    expect(edgeColorForStatus('read_only')).toBe('cyan')
    expect(edgeColorForStatus('approval_required')).toBe('yellow')
    expect(edgeColorForStatus('degraded')).toBe('yellow')
    expect(edgeColorForStatus('standby')).toBe('gray')
    expect(edgeColorForStatus('disabled')).toBe('gray')
    expect(edgeColorForStatus('unknown')).toBe('gray')
    expect(edgeColorForStatus('blocked')).toBe('red')
  })

  it('explains the observed gray and read-only gateway graph edges', () => {
    const payload = buildGatewayGraphEdgeReadiness('2026-06-08T16:00:00.000Z')
    const byId = new Map(payload.edges.map((edge) => [edge.edge_id, edge]))

    expect(byId.get('browser.html_surface_to_gateway')).toMatchObject({
      domain: 'browser',
      status: 'read_only',
      color: 'cyan',
      primary_reason: 'html_surface_registered_no_runtime_bridge',
      next_action: 'configure_browser_runtime_bridge_if_active_control_is_required',
    })

    expect(byId.get('browser.firefox_to_gateway')).toMatchObject({
      domain: 'browser',
      status: 'standby',
      color: 'gray',
      primary_reason: 'firefox_runtime_not_connected',
      blockers: ['browser_session_not_connected'],
      next_action: 'start_or_verify_browser_runtime_bridge',
    })

    expect(byId.get('reports.gateway_to_reports')).toMatchObject({
      domain: 'reports',
      status: 'read_only',
      color: 'cyan',
      primary_reason: 'report_preview_ready_delivery_not_enabled',
      next_action: 'request_owner_approval_for_report_delivery_if_needed',
    })

    expect(byId.get('webhooks.inbound_to_gateway')).toMatchObject({
      domain: 'webhooks',
      status: 'standby',
      color: 'gray',
      primary_reason: 'webhook_receiver_ready_no_recent_events',
      next_action: 'send_signed_test_event_or_verify_webhook_heartbeat',
    })

    expect(byId.get('events.event_bus_to_gateway')).toMatchObject({
      domain: 'events',
      status: 'standby',
      color: 'gray',
      primary_reason: 'event_bus_ready_no_recent_events',
      next_action: 'verify_event_stream_heartbeat',
    })
  })

  it('includes the required connector edges without enabling writes or exposing secrets', () => {
    const payload = buildGatewayGraphEdgeReadiness('2026-06-08T16:00:00.000Z')
    const ids = payload.edges.map((edge) => edge.edge_id)

    expect(ids).toEqual(expect.arrayContaining([
      'agentmail.gateway_to_agentmail',
      'connector.zapier_to_gateway',
      'connector.google_drive_to_gateway',
      'connector.onedrive_to_gateway',
      'connector.external_apis_to_gateway',
      'connector.mcp_servers_to_gateway',
      'connector.tools_registry_to_gateway',
      'connector.firecrawl_to_gateway',
      'connector.heygen_to_gateway',
    ]))

    expect(payload).toMatchObject({
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_executed: false,
      broad_connector_execution_enabled: false,
    })

    expect(JSON.stringify(payload)).not.toMatch(/Bearer|Authorization|cookie=|sk-|am_[A-Za-z0-9_-]{24,}/i)
  })
})
