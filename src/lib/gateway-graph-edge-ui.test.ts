import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Gateway graph edge diagnostics UI', () => {
  it('loads protected edge readiness and exposes a line inspector with a legend', () => {
    const html = readFileSync(join(process.cwd(), 'public/design/gateway/Gateway Overview.html'), 'utf8')

    expect(html).toContain('/api/gateway/graph/edge-readiness')
    expect(html).toContain('/api/gateway/graph/node-readiness')
    expect(html).toContain('edge-tooltip')
    expect(html).toContain('openEdgeInspector')
    expect(html).toContain('nodeReadinessFor')
    expect(html).toContain('/api/gateway/approvals/center')
    expect(html).toContain('Gateway edge legend')
    expect(html).toContain('Gateway Graph Health')
    expect(html).toContain('Gateway Diagnostics')
    expect(html).toContain('View Settings')
    expect(html).toContain('Gateway View Controls')
    expect(html).toContain('graph_readiness_unavailable')
    expect(html).toContain('graph_node_readiness_unavailable')
    expect(html).toContain('edge_status_missing')
    expect(html).toContain('node_status_missing')
    expect(html).toContain('edge_mapping_mismatch')
    expect(html).toContain('node_mapping_mismatch')
    expect(html).toContain('Node registered, edge standby.')
    expect(html).toContain('Node registered, edge status is evaluated separately.')
  })

  it('uses routed/bundled pathlines and operator navigation instead of center-to-center Bezier hairballs', () => {
    const html = readFileSync(join(process.cwd(), 'public/design/gateway/Gateway Overview.html'), 'utf8')

    expect(html).toContain('gw-viewport-stage')
    expect(html).toContain('edge-trunk')
    expect(html).toContain('edge-highway')
    expect(html).toContain('edge-branch')
    expect(html).toContain('function railFor')
    expect(html).toContain('function orthogonalPath')
    expect(html).toContain('function setEdgeMode')
    expect(html).toContain("edgeMode = 'operator'")
    expect(html).toContain('mode-diagnostics')
    expect(html).toContain('mode-quiet')
    expect(html).toContain('view-fit')
    expect(html).toContain('view-reset')
    expect(html).toContain('view-center-dispatcher')
    expect(html).toContain('view-save-layout')
    expect(html).toContain('gateway_overview_ui_v2')
    expect(html).toContain('function domainHub')
    expect(html).toContain('function nodeDomain')
    expect(html).not.toContain('C ${a.x + cp}')
  })

  it('ships static fallback reasons for the observed gray edges', () => {
    const data = readFileSync(join(process.cwd(), 'public/design/gateway/shared/gateway-data.js'), 'utf8')

    expect(data).toContain('html_surface_registered_no_runtime_bridge')
    expect(data).toContain('firefox_runtime_not_connected')
    expect(data).toContain('report_preview_ready_delivery_not_enabled')
    expect(data).toContain('webhook_receiver_ready_no_recent_events')
    expect(data).toContain('event_bus_ready_no_recent_events')
    expect(data).toContain('openrouter_model_runtime_ready')
    expect(data).toContain('nvidia_model_runtime_ready')
    expect(data).toContain('zapier_discovery_ready_writes_guarded')
    expect(data).toContain('gateway-edge-readiness-v2')
    expect(data).toContain('gateway-node-readiness-v1')
    expect(data).toContain("yellow:  { label: 'Guarded'")
    expect(data).toContain('Preview ready · delivery guarded')
    expect(data).toContain('Receiver ready · waiting for events')
    expect(data).toContain('Event bus ready · no recent events')
    expect(data).toContain("status: 'live', primary_reason: 'approval_gated_send_ready'")
    expect(data).toContain("per_action_state: 'no_pending_send_request'")
    expect(data).toContain('zapier.scope.discovery_and_status')
    expect(data).toContain("name: 'GBrain'")
    expect(data).toContain('GBrain inventory ready · tool invocation guarded')
    expect(data).toContain('xai_grok_model_runtime_ready')
    expect(data).not.toContain('xai_grok_permission_or_billing_required')
    expect(data).not.toContain('Bridge Session required for Run Now')
    expect(data).toContain("label: 'NVIDIA NIM'")
    expect(data).toContain("status: 'green', note: 'Provider Vault credential validated; Gateway Runtime Bridge handles execution governance.'")
    expect(data).not.toContain("warn: 'not configured'")
  })

  it('keeps Gateway lane mount containers scrollable and prevents card stacking overlap', () => {
    const html = readFileSync(join(process.cwd(), 'public/design/gateway/Gateway Overview.html'), 'utf8')

    expect(html).toContain('overflow: auto')
    expect(html).toContain('.lane.brain #lane-brain')
    expect(html).toContain('.lane.models #lane-models')
    expect(html).toContain('.lane.inputs #lane-inputs')
    expect(html).toContain('.lane.integrations #lane-integrations')
    expect(html).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))')
    expect(html).toContain('grid-template-columns: repeat(10, minmax(120px, 1fr))')
    expect(html).toContain('min-height: 1040px')
  })

  it('labels gray node cards as standby instead of offline or not configured', () => {
    const rootData = readFileSync(join(process.cwd(), 'public/design/gateway/shared/gateway-data.js'), 'utf8')
    const dropinData = readFileSync(join(process.cwd(), 'gateway-dropin/public/design/gateway/shared/gateway-data.js'), 'utf8')
    const rootCss = readFileSync(join(process.cwd(), 'public/design/gateway/shared/tokens.css'), 'utf8')
    const dropinCss = readFileSync(join(process.cwd(), 'gateway-dropin/public/design/gateway/shared/tokens.css'), 'utf8')
    const rootHealth = readFileSync(join(process.cwd(), 'public/design/gateway/Gateway Health.html'), 'utf8')
    const dropinHealth = readFileSync(join(process.cwd(), 'gateway-dropin/public/design/gateway/Gateway Health.html'), 'utf8')

    for (const data of [rootData, dropinData]) {
      expect(data).toContain("gray:    { label: 'Standby'")
      expect(data).toContain('Registered but idle, no recent heartbeat, or waiting for a runtime event.')
      expect(data).not.toContain("gray:    { label: 'Not configured'")
      expect(data).toContain("summary: 'Receiver ready · waiting for events.'")
      expect(data).toContain("summary: 'Event bus ready · no recent events.'")
    }

    for (const css of [rootCss, dropinCss]) {
      expect(css).toContain('/* standby / no recent heartbeat */')
      expect(css).not.toContain('/* not configured */')
    }

    for (const health of [rootHealth, dropinHealth]) {
      expect(health).toContain('<div class="card gray"><div class="lbl">Standby</div>')
      expect(health).not.toContain('<div class="card gray"><div class="lbl">Not configured</div>')
    }
  })

  it('preserves semantic static readiness instead of forcing guarded/read-only nodes gray', () => {
    const rootData = readFileSync(join(process.cwd(), 'public/design/gateway/shared/gateway-data.js'), 'utf8')
    const dropinData = readFileSync(join(process.cwd(), 'gateway-dropin/public/design/gateway/shared/gateway-data.js'), 'utf8')

    for (const data of [rootData, dropinData]) {
      expect(data).toContain('cssStatusFromNodeReadiness')
      expect(data).toContain("n.live_state_known = Boolean(readiness && readiness.color)")
      expect(data).not.toContain("every node FORCED to 'gray'")
      expect(data).toContain('nodes without semantic fallback readiness remain standby until API proof')
    }
  })

  it('shows guarded write/execute badges as guarded instead of off', () => {
    const rootCss = readFileSync(join(process.cwd(), 'public/design/gateway/shared/tokens.css'), 'utf8')
    const dropinCss = readFileSync(join(process.cwd(), 'gateway-dropin/public/design/gateway/shared/tokens.css'), 'utf8')
    const renderer = readFileSync(join(process.cwd(), 'public/design/gateway/shared/render.js'), 'utf8')

    for (const css of [rootCss, dropinCss]) {
      expect(css).toContain('.rwx .rwx-pill.guarded')
      expect(css).toContain('var(--st-yellow)')
      expect(css).toContain('var(--st-yellow-bg)')
    }

    expect(renderer).toContain("guardedWrite(readiness) ? 'guarded'")
    expect(renderer).toContain("guardedExecute(readiness) ? 'guarded'")
    expect(renderer).toContain('Writes/execution guarded by Gateway policy and owner approval')
  })
})
