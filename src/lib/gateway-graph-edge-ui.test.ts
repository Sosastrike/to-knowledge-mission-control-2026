import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Gateway graph edge diagnostics UI', () => {
  it('loads protected edge readiness and exposes a line inspector with a legend', () => {
    const html = readFileSync(join(process.cwd(), 'public/design/gateway/Gateway Overview.html'), 'utf8')

    expect(html).toContain('/api/gateway/graph/edge-readiness')
    expect(html).toContain('/api/gateway/graph/node-readiness')
    expect(html).toContain('/api/gateway/graph/topology')
    expect(html).toContain('/api/gateway/graph/sync-status')
    expect(html).toContain('/api/gateway/graph/traffic')
    expect(html).toContain('edge-tooltip')
    expect(html).toContain('openEdgeInspector')
    expect(html).toContain('nodeReadinessFor')
    expect(html).toContain('canonicalTopology')
    expect(html).toContain('renderTopologyDataSync')
    expect(html).toContain('graphTrafficSnapshot')
    expect(html).toContain('fetchGraphTraffic')
    expect(html).toContain('traffic_data_unavailable')
    expect(html).toContain('Traffic data unavailable')
    expect(html).toContain('Telemetry stale')
    expect(html).toContain('missing traffic mappings')
    expect(html).toContain('auth/login outside topology')
    expect(html).toContain('agent_config_sync resolved')
    expect(html).toContain('agent_config_sync unresolved')
    expect(html).toContain('agent_config_sync identity missing')
    expect(html).toContain('source-provided canonical identity')
    expect(html).toContain('protected-action-check unresolved')
    expect(html).toContain('unmapped event types')
    expect(html).toContain('mapping confidence')
    expect(html).toContain('reason no pulse rendered')
    expect(html).toContain('identity_confidence')
    expect(html).toContain('no pulse rendered')
    expect(html).toContain('source_record_id')
    expect(html).toContain('traffic_classification')
    expect(html).toContain('recommended_mapping_fix')
    expect(html).toContain('Stale threshold')
    expect(html).toContain('relationship')
    expect(html).toContain('traffic status')
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
    expect(html).toContain('topologyEdgeForHighway')
    expect(html).toContain("if (node.id === 'input.webhook') return 'webhooks'")
    expect(html).toContain("if (node.id === 'input.event') return 'events'")
    expect(html).toContain("if (readiness?.domain === 'browser') return 'browser'")
    expect(html).not.toContain('webhooks-events')
    expect(html).not.toContain('browser-runtime')
    expect(html).toContain('missing_edge_mappings')
    expect(html).toContain('data-edge-relationship')
    expect(html).not.toContain('C ${a.x + cp}')
  })

  it('does not use static request stream data as live traffic animation proof', () => {
    const html = readFileSync(join(process.cwd(), 'public/design/gateway/Gateway Overview.html'), 'utf8')
    const dropinHtml = readFileSync(join(process.cwd(), 'gateway-dropin/public/design/gateway/Gateway Overview.html'), 'utf8')
    const data = readFileSync(join(process.cwd(), 'public/design/gateway/shared/gateway-data.js'), 'utf8')

    for (const source of [html, dropinHtml]) {
      expect(source).toContain('function startLiveTrafficOverlay')
      expect(source).toContain('trusted runtime event/request is mapped to a canonical Gateway line')
      expect(source).toContain('traffic-bead')
      expect(source).toContain('edge-has-traffic')
      expect(source).toContain('trafficForTopologyEdge')
      expect(source).toContain('routeHasRecentTraffic')
      expect(source).toContain('trusted_telemetry_counter')
      expect(source).toContain('data-traffic-source-edge-id')
      expect(source).toContain('Traffic Dot Legend')
      expect(source).toContain('Traffic source edge')
      expect(source).toContain('rendered traffic dots')
      expect(source).toContain('Open ${label}')
      expect(source).toContain('Diagnostics')
      expect(source).toContain('View Settings')
      expect(source).toContain('Ready · no recent traffic')
      expect(source).toContain('Dots appear only when a trusted runtime event/request is mapped to a canonical Gateway line.')
      expect(source).toContain('fetchGraphTraffic, 10000')
      expect(source).toContain('Research, Classify, Write, Code, Review, Archive, and Sub-dispatch')
      expect(source).not.toContain('const r = G.REQUEST_STREAM[i % G.REQUEST_STREAM.length]')
    }
    expect(data).toContain('DEMO_REQUEST_STREAM')
    expect(data).toContain('REQUEST_STREAM: DEMO_REQUEST_STREAM')
  })

  it('ships static fallback reasons for the observed gray edges', () => {
    const data = readFileSync(join(process.cwd(), 'public/design/gateway/shared/gateway-data.js'), 'utf8')
    const dropinData = readFileSync(join(process.cwd(), 'gateway-dropin/public/design/gateway/shared/gateway-data.js'), 'utf8')

    for (const source of [data, dropinData]) {
      expect(source).toContain('html_surface_registered_no_runtime_bridge')
      expect(source).toContain('firefox_runtime_not_connected')
      expect(source).toContain('report_preview_ready_delivery_not_enabled')
      expect(source).toContain('webhook_receiver_ready_no_recent_events')
      expect(source).toContain('event_bus_ready_no_recent_events')
      expect(source).toContain('openrouter_model_runtime_ready')
      expect(source).toContain('nvidia_model_runtime_ready')
      expect(source).toContain('zapier_discovery_ready_writes_guarded')
      expect(source).toContain('gateway-edge-readiness-v2')
      expect(source).toContain('gateway-node-readiness-v1')
      expect(source).toContain("yellow:  { label: 'Guarded'")
      expect(source).toContain('Preview ready · delivery guarded')
      expect(source).toContain('Receiver ready · waiting for events')
      expect(source).toContain('Event bus ready · no recent events')
      expect(source).toContain("status: 'live', primary_reason: 'approval_gated_send_ready'")
      expect(source).toContain("per_action_state: 'no_pending_send_request'")
      expect(source).toContain('zapier.scope.discovery_and_status')
      expect(source).toContain('APPROVAL_CENTER_PROPOSALS')
      expect(source).toContain("scope_id: 'scope.gbrain.invocation.preview'")
      expect(source).toContain("name: 'GBrain'")
      expect(source).toContain('GBrain inventory ready · tool invocation guarded')
      expect(source).toContain('xai_grok_model_runtime_ready')
      expect(source).not.toContain('xai_grok_permission_or_billing_required')
      expect(source).not.toContain('Bridge Session required for Run Now')
      expect(source).toContain("label: 'NVIDIA NIM'")
      expect(source).toContain("status: 'green', note: 'Provider Vault credential validated; Gateway Runtime Bridge handles execution governance.'")
      expect(source).not.toContain("warn: 'not configured'")
    }
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

  it('keeps Gateway public and drop-in mirrors free of stale AgentMail/Zapier blocker copy', () => {
    const files = [
      'public/design/gateway/Mission Control + Gateway.html',
      'gateway-dropin/public/design/gateway/Mission Control + Gateway.html',
      'public/design/gateway/shared/gateway-data.js',
      'gateway-dropin/public/design/gateway/shared/gateway-data.js',
      'src/components/gateway/GatewayShell.tsx',
      'gateway-dropin/src/components/gateway/GatewayShell.tsx',
      'src/components/gateway/gateway-status-contracts.ts',
      'gateway-dropin/src/components/gateway/gateway-status-contracts.ts',
      'src/components/gateway/gateway-actions.ts',
      'gateway-dropin/src/components/gateway/gateway-actions.ts',
    ].map((file) => readFileSync(join(process.cwd(), file), 'utf8'))

    for (const source of files) {
      expect(source).not.toContain('Owner pre-approval per execution')
      expect(source).not.toContain('Owner pre-approval required per execution scope')
      expect(source).not.toContain('AGENTMAIL_API_KEY and allowed-recipient policy are missing')
      expect(source).not.toContain('AgentMail send/reply is disabled until credentials')
      expect(source).not.toContain('Bridge Session required to send mail')
      expect(source).not.toContain('Primary mailbox is represented, but outbound sends remain Bridge-gated')
      expect(source).not.toContain('Sending remains disabled without Bridge approval')
      expect(source).not.toContain('It is blocked from direct execution until an explicit Gateway contract is attached')
      expect(source).not.toContain('Open Bridge Session from')
      expect(source).not.toContain('https://app.agentmail.to')
    }

    expect(files.join('\n')).toContain('Zapier discovery ready · writes guarded')
    expect(files.join('\n')).toContain('AgentMail ready · approval-gated sending')
    expect(files.join('\n')).toContain('approval_gated_send_ready')
    expect(files.join('\n')).toContain('auto_send_enabled: false')
    expect(files.join('\n')).toContain('bulk_send_enabled: false')
    expect(files.join('\n')).toContain('Gateway action is guarded')
    expect(files.join('\n')).toContain('Nothing executed.')
  })
})
