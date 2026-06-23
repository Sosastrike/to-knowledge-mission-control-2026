import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createGatewayRegistryFromAgentNetwork } from './gateway-model'
import {
  buildAgentHubAgentAuditPayload,
  buildAgentHubAgentHealthPayload,
  buildAgentHubAgentRoutesPayload,
  buildAgentHubAgentsPayload,
  buildAgentHubStatusPayload,
  buildAgentHubRegistryPayload,
  attachGatewayRouteCdpTruthStatus,
  getAgentHubAgentPayload,
  normalizeAgentHubAgentId,
} from './gateway-agent-hub'

const registry = createGatewayRegistryFromAgentNetwork({ generatedAt: '2026-05-07T00:00:00.000Z' })

describe('Gateway Agent Hub', () => {
  it('builds the production roster from Gateway registry truth, not mock data', () => {
    const payload = buildAgentHubStatusPayload(registry)
    expect(payload).toMatchObject({
      mode: 'gateway_agent_hub_status_read_only',
      source: 'gateway_registry',
      mock_data_used: false,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    })
    expect(payload.mission_control_runtime_health).toMatchObject({
      service_restart_attempted: false,
      public_exposure_changed: false,
      secrets_exposed: false,
      raw_env_values_exposed: false,
      cwd_summary: {
        path_values_redacted: true,
      },
    })
    expect(JSON.stringify(payload.mission_control_runtime_health)).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]|mc_session|\.env/)
    expect(payload.direct_agent_lines).toMatchObject({
      route: '/api/bridge/agent-routing/lines',
      live_trace_route: '/api/bridge/agent-routing/trace/live',
      probe_route: '/api/bridge/agent-routing/trace/probe',
      gateway_architecture: 'owner_to_mission_control_to_nuclear_gateway_to_direct_agent_line',
      direct_line_required_for_owner_messages: true,
      conversation_owner_rule: 'target_agent_owns_conversation',
      opencloud_hidden_intermediary_allowed: false,
      opencloud_conversation_owner_allowed: false,
      opencloud_allowed_role: 'supporting_tool_only_when_explicitly_invoked',
      no_secrets_exposed: true,
    })
    expect(payload.direct_agent_lines.total).toBeGreaterThan(20)
    expect(payload.direct_agent_lines.active).toBeGreaterThan(20)
    expect(payload.direct_agent_lines.paperclip_company_agents).toBeGreaterThanOrEqual(7)
    expect(payload.direct_agent_lines.hermes_mini_agents).toBeGreaterThanOrEqual(2)
    expect(payload.direct_agent_lines.ron_mini_agents).toBeGreaterThanOrEqual(0)
    expect(payload.direct_agent_lines.inactive_supporting_runtime).toBeGreaterThanOrEqual(1)
    expect(payload.direct_agent_lines.trace_commands.length).toBe(payload.direct_agent_lines.active)
    expect(payload.direct_agent_lines.trace_commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        agent_id: 'agent-zero-jarvis',
        command: expect.stringContaining('bash /home/tony/agent-line-trace.sh --agent jarvis'),
        trace_href: '/api/bridge/agent-routing/trace/live?agent=jarvis',
        opencloud_intermediary_allowed: false,
      }),
      expect.objectContaining({
        agent_id: 'paperclip.eco.ceo',
        command: expect.stringContaining('bash /home/tony/agent-line-trace.sh --agent paperclip.eco.ceo'),
        local_probe_command: expect.stringContaining('--local-probe'),
      }),
      expect.objectContaining({
        agent_id: 'hermes-mini-agent.workflow-drafter',
        command: expect.stringContaining('bash /home/tony/agent-line-trace.sh --agent hermes-mini-agent.workflow-drafter'),
      }),
      expect.objectContaining({
        agent_id: 'brain-sync',
        command: expect.stringContaining('bash /home/tony/agent-line-trace.sh --agent brain-sync'),
      }),
    ]))
    expect(payload.direct_agent_lines.trace_commands.some((trace) => trace.agent_id === 'openclaw' || trace.agent_id === 'opencloud')).toBe(false)
    expect(payload.nuclear_gateway_graph).toMatchObject({
      graph_id: 'nuclear_gateway_operational_path',
      central_broker_node: 'nuclear.gateway',
      architecture: 'owner_to_mission_control_to_nuclear_gateway_to_direct_agent_line',
      openclaw_disabled_reason: 'Supporting runtime only — not an agent line.',
      openclaw_hidden_intermediary_allowed: false,
      openclaw_commander_allowed: false,
      credential_broker: 'nuclear.gateway',
      no_secrets_exposed: true,
    })
    expect(payload.nuclear_gateway_graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'mission.control', label: 'Mission Control' }),
      expect.objectContaining({ id: 'nuclear.gateway', label: 'Nuclear Gateway' }),
      expect.objectContaining({ id: 'ron.weasley', direct_line_owner: true }),
      expect.objectContaining({ id: 'paperclip', direct_line_owner: true }),
      expect.objectContaining({ id: 'openclaw.supporting_runtime', direct_line_owner: false, disabled_reason: 'Supporting runtime only — not an agent line.' }),
    ]))
    expect(payload.nuclear_gateway_graph.edges).toEqual(expect.arrayContaining([
      { source: 'owner', target: 'mission.control', relation: 'enters' },
      { source: 'mission.control', target: 'nuclear.gateway', relation: 'brokers' },
      { source: 'nuclear.gateway', target: 'agent.zero', relation: 'routes_to' },
      { source: 'nuclear.gateway', target: 'credential.broker', relation: 'brokers' },
    ]))
    expect(payload.nuclear_gateway_graph.direct_line_trace_buttons.some((button) => button.agent_id === 'openclaw')).toBe(false)
    expect(payload.nuclear_gateway_graph.nodes.map((node) => node.id)).not.toContain('sofia')
    expect(payload.nuclear_gateway_graph.edges).not.toEqual(expect.arrayContaining([
      { source: 'nuclear.gateway', target: 'sofia', relation: 'routes_to' },
      { source: 'sofia', target: 'ron.weasley', relation: 'reports_to' },
    ]))
    expect(payload.nuclear_gateway_graph.direct_line_trace_buttons.some((button) => button.agent_id === 'sofia')).toBe(false)
    expect(payload.agent_update_control_plane).toMatchObject({
      route: '/api/bridge/agent-updates/status',
      run_route: '/api/bridge/agent-updates/run',
      visible_task_title: 'Agent Auto-Update Control Plane',
      scheduler_task_id: 'agent_update_check',
      scheduler_interval: 'every_6h',
      auto_apply_setting: 'agent_updates.auto_apply',
      auto_apply_scope: 'exact_scoped_loopback_only',
      opencloud_intermediary: false,
      public_exposure_created: false,
      secrets_exposed: false,
      raw_env_values_exposed: false,
    })
    expect(payload.agent_update_control_plane.safe_auto_apply_components.map((component) => component.label)).toEqual([
      'Ron Weasley WebUI',
      'Ron Weasley Agent',
    ])
    expect(payload.agent_update_control_plane.visible_task_only_components.map((component) => component.label)).toEqual(expect.arrayContaining([
      'Mission Control',
      'Agent Zero / Jarvis',
      'SpaceAgent',
      'Pi',
      'Paperclip',
      'OpenClaw / OpenCloud Supporting Runtime Only',
    ]))
    expect(JSON.stringify(payload.agent_update_control_plane)).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]/i)
    expect(payload.gateway_route_cdp_truth).toMatchObject({
      mode: 'gateway_route_cdp_truth',
      route_source: 'source_route_tree',
      gateway_status: 'ROUTE_MAP_REQUIRED',
      route_map_status: 'READY',
      cdp_status: 'CDP_NOT_RUNNING',
      opencloud_intermediary: false,
      public_exposure_created: false,
      secrets_exposed: false,
      raw_env_values_exposed: false,
    })
    expect(payload.gateway_route_cdp_truth.routes.map((route) => route.route)).toEqual(expect.arrayContaining([
      '/api/gateway/status',
      '/api/gateway/registry',
      '/api/gateway/agent-hub/status',
      '/api/gateway/nodes/playwright-mcp',
      '/api/gateway/space-agent/browser/status',
      '/api/gateway/space-agent/playwright-mcp/evidence',
      '/api/bridge/playwright-mcp/status',
      '/api/bridge/playwright-mcp/smoke',
    ]))
    expect(payload.gateway_route_cdp_truth.missing_legacy_routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ route: '/tools', correct_route: '/gateway/tools' }),
      expect.objectContaining({ route: '/routes', correct_route: '/api/gateway/flows' }),
      expect.objectContaining({ route: '/health', correct_route: '/api/gateway/status' }),
    ]))
    expect(payload.gateway_route_cdp_truth.cdp_truth).toMatchObject({
      running: false,
      cdpReady: false,
      status: 'CDP_NOT_RUNNING',
      service: 'playwright-mcp.service',
      mcp_endpoint: 'http://127.0.0.1:8931/mcp',
      local_only: true,
      public_exposure: false,
      bridge_session_required_for_interactive_actions: true,
    })
    expect(JSON.stringify(payload.gateway_route_cdp_truth)).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]/i)
    expect(payload.agents.map((agent) => agent.id)).toEqual(['paperclip', 'agent-zero', 'hermes', 'spaceagent', 'pi-mono'])
    expect(payload.agents.map((agent) => agent.id)).not.toContain('hermes-webui')
    expect(payload.agents.map((agent) => agent.id)).not.toContain('sofia')
    expect(payload.direct_agent_lines.trace_commands.map((trace) => trace.agent_id)).not.toContain('sofia')
    expect(payload.agents.find((agent) => agent.id === 'agent-zero')).toMatchObject({ role: 'Commander', status: 'partial_go', called_true_proven: true })
    const ron = payload.agents.find((agent) => agent.id === 'hermes')
    expect(ron).toMatchObject({
      name: 'Hermes',
      role: 'Software Agent',
      status: 'full_access_delegated',
      called_true_proven: true,
      proof_panel: {
        webui: 'READY',
        webui_alias: 'READY',
        full_access_delegation: 'FULL_ACCESS_DELEGATED',
        mission_control_service: 'ACTIVE',
        authenticated_ron_routes: 'RESPONDING',
        direct_line_chat: 'LOCAL_PROOF_PRESENT',
        direct_line_chat_blocker: 'mission_control_authenticated_proxy_send_receive_proof_pending',
        direct_line_chat_proof: 'TRACE-MC-RON-20260529T005215Z-LEGACY-ALIAS',
        mission_control_proxy: 'AUTHENTICATED_SEND_RECEIVE_PENDING',
        proxy_proof_route: '/api/bridge/ron/runtime-proof',
        protected_writes_execution: 'JARVIS CONCURRENCE REQUIRED',
        execution_model: 'JARVIS-GATED EXECUTION',
        opencloud_intermediary: false,
      },
    })
    expect(ron?.blocked_reason).toBe('protected_writes_require_backend_authorization_and_approval')
    expect(JSON.stringify(ron)).toContain('Ron/Hermes-WebUI')
    expect(JSON.stringify(ron)).toContain('durable_job_owner')
    expect(JSON.stringify(ron)).not.toContain('Ron Wegsley')
    expect(JSON.stringify(ron)).not.toContain('PARTIAL')
    expect(ron).toMatchObject({
      name: 'Hermes',
      role: 'Software Agent',
      interface: {
        local_ui_url: null,
        ui_mode: 'mission_control_proxy',
      },
      control_surfaces: [
        expect.objectContaining({
          component_type: 'control_surface',
          component_id: 'ron-hermes-webui',
          target_agent_id: 'hermes',
          route: '/gateway/agents/hermes/jobs',
          legacy_route: '/gateway/agent-hub/ron/webui/app',
          durable_job_owner: false,
          execution_authority: false,
          credential_authority: false,
        }),
      ],
    })
    expect(payload.agents.find((agent) => agent.id === 'paperclip')).toMatchObject({
      role: 'Workforce Control Plane',
      status: 'partial_go',
      live_interface_proven: true,
      interface: {
        tailnet_url: 'http://100.116.35.95:3100/ECO/dashboard',
        ui_mode: 'tailnet_authenticated',
        tailnet_ui_proven: true,
      },
    })
    expect(payload.agents.find((agent) => agent.id === 'spaceagent')).toMatchObject({
      role: 'Independent Specialized Agent',
      status: 'configured',
      called_true_proven: true,
      routes: { bridge_status: '/api/bridge/spaceagent/status' },
    })
    expect(payload.gateway_route_cdp_truth.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ route: '/api/bridge/spaceagent/pipeline-status', surface: 'space_agent', state: 'READY' }),
      expect.objectContaining({ route: '/api/bridge/spaceagent/brain-status', surface: 'space_agent', state: 'READY' }),
      expect.objectContaining({ route: '/api/bridge/spaceagent/tool-map', surface: 'space_agent', state: 'READY' }),
      expect.objectContaining({ route: '/api/bridge/spaceagent/certification-proof', surface: 'space_agent', state: 'READY' }),
      expect.objectContaining({ route: '/api/bridge/spaceagent/quality-scorecard', surface: 'space_agent', state: 'READY' }),
      expect.objectContaining({ route: '/api/bridge/spaceagent/live-proof-readiness', surface: 'space_agent', state: 'READY' }),
      expect.objectContaining({ route: '/api/bridge/spaceagent/final-certification', surface: 'space_agent', state: 'READY' }),
    ]))
    expect(payload.agents.find((agent) => agent.id === 'pi-mono')).toMatchObject({
      name: 'Pi',
      role: 'Full Access Gateway Agent',
      status: 'full_access_delegated',
      called_true_proven: true,
      routes: {
        bridge_status: '/api/bridge/pi/status',
      },
    })
    expect(payload.agents.find((agent) => agent.id === 'pi-mono')?.blocked_reason).toBe('production_execution_requires_jarvis_concurrence')
    expect(payload.design_handoff.expected_files_present).toBe(true)
    expect(payload.design_handoff.production_uses_mock_data).toBe(false)
    for (const agent of payload.agents) {
      expect(agent.interface.auth_required).toBe(true)
      expect(agent.interface.iframe_allowed).toBe(false)
      expect(agent.interface.public_exposure).toBe(false)
      expect(agent.interface.local_ui_url).toBeNull()
      if (agent.id === 'paperclip') {
        expect(agent.interface.tailnet_url).toBe('http://100.116.35.95:3100/ECO/dashboard')
      } else {
        expect(agent.interface.tailnet_url).toBeNull()
      }
    }
  })

  it('keeps Paperclip before OpenClaw+ and keeps Build-Wiki/Farmer gated', () => {
    const paperclip = getAgentHubAgentPayload(registry, 'paperclip')
    const routes = buildAgentHubAgentRoutesPayload(registry, 'paperclip')
    const status = buildAgentHubStatusPayload(registry)

    expect(paperclip?.agent.layer).toBe('company_workforce_direct_line')
    expect(routes?.registered_flows.some((flow) => flow.selected_route.hops.join('>') === 'agent_zero>gateway>paperclip>openclaw_plus')).toBe(true)
    expect(status.supporting_runtime_systems.some((system) => system.id === 'buildwiki')).toBe(true)
    expect(status.buildwiki_run_now).toMatchObject({
      target_service: 'opencloud-docs-farmer.service',
      bridge_session_required: true,
      owner_approval_required: true,
      execution_enabled: false,
      fork2_smb_status: 'blocked',
    })
  })

  it('serves detail, health, routes, and audit payloads without owner-unsafe fields', () => {
    const agents = buildAgentHubAgentsPayload(registry)
    const health = buildAgentHubAgentHealthPayload(registry, 'pi')
    const routes = buildAgentHubAgentRoutesPayload(registry, 'agent_zero')
    const audit = buildAgentHubAgentAuditPayload(registry, 'space-agent')
    const registryPayload = buildAgentHubRegistryPayload(registry)
    const serialized = JSON.stringify({ agents, health, routes, audit, registryPayload })

    expect(normalizeAgentHubAgentId('pi')).toBe('pi-mono')
    expect(normalizeAgentHubAgentId('space_agent')).toBe('spaceagent')
    expect(normalizeAgentHubAgentId('hermes_webui')).toBe('hermes')
    expect(health).toMatchObject({ agent_id: 'pi-mono', status: 'full_access_delegated', execution_enabled: false, writes_enabled: false })
    expect(routes?.registered_flows.length).toBeGreaterThan(0)
    expect(routes?.trace_direct_line).toMatchObject({
      label: 'Trace Direct Line',
      live_trace_route: '/api/bridge/agent-routing/trace/live',
      probe_route: '/api/bridge/agent-routing/trace/probe',
      opencloud_intermediary_allowed: false,
    })
    expect(routes?.trace_direct_line.command).toContain('bash /home/tony/agent-line-trace.sh --agent jarvis')
    expect(routes?.trace_direct_line.local_probe_command).toContain('bash /home/tony/agent-line-trace.sh --agent jarvis --local-probe')
    expect(audit?.audit_events.length).toBeGreaterThan(0)
    expect(registryPayload.gateway_route_cdp_truth).toMatchObject({
      route_map_status: 'READY',
      cdp_status: 'CDP_NOT_RUNNING',
      public_exposure_created: false,
      secrets_exposed: false,
    })
    expect(serialized).not.toMatch(/\/a0\/|auth\.json|Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]/i)
    expect(agents.mock_data_used).toBe(false)
    expect(agents.execution_enabled).toBe(false)
    expect(registryPayload).toMatchObject({ mode: 'gateway_agent_hub_registry_read_only', mock_data_used: false, execution_enabled: false, writes_enabled: false })
  })

  it('attaches live Playwright MCP CDP truth without enabling unsafe browser writes', () => {
    const payload = attachGatewayRouteCdpTruthStatus(buildAgentHubStatusPayload(registry), {
      ok: true,
      mode: 'playwright_mcp_status',
      status: 'connected',
      service_name: 'playwright-mcp.service',
      endpoint: 'localhost:8931/mcp',
      service_endpoint: '127.0.0.1:8931',
      mcp_endpoint: 'http://127.0.0.1:8931/mcp',
      service_status: 'connected_local_only',
      transport: 'streamable_http',
      bind_host: '127.0.0.1',
      local_only: true,
      public_exposure: false,
      browser_mode: 'headless_firefox_isolated',
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required_for_interactive_actions: true,
      authenticated_browsing_requires_owner_approval: true,
      tool_count: 5,
      tools: ['browser_navigate', 'browser_snapshot', 'browser_take_screenshot', 'browser_console_messages', 'browser_network_requests'],
      required_tools_present: true,
      blocker: null,
      last_error: null,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })

    expect(payload.gateway_route_cdp_truth.cdp_status).toBe('READY')
    expect(payload.gateway_route_cdp_truth.gateway_status).toBe('READY')
    expect(payload.gateway_route_cdp_truth.cdp_truth).toMatchObject({
      running: true,
      cdpReady: true,
      status: 'READY',
      public_exposure: false,
      local_only: true,
      bridge_session_required_for_interactive_actions: true,
    })
    expect(payload.gateway_route_cdp_truth.routes.find((route) => route.route === '/api/bridge/playwright-mcp/smoke')).toMatchObject({
      state: 'READY',
      writes_enabled: false,
      public_exposure: false,
    })
  })

  it('does not render stale Bridge-not-active copy on the live Agent Hub control center', () => {
    const source = readFileSync('src/components/gateway-agent-hub/AgentHubControlCenter.tsx', 'utf8')

    expect(source).toContain('/api/bridge/mission-control/stale-bundle-health')
    expect(source).toContain('Mission Control Runtime Health')
    expect(source).toContain('stale deleted standalone bundle')
    expect(source).toContain('No restart is attempted from this panel')
    expect(source).toContain('Direct lines active')
    expect(source).toContain('Universal Direct Lines')
    expect(source).toContain('Every agent gets its own highway')
    expect(source).toContain('Agent Auto-Update Control Plane')
    expect(source).toContain('exact scoped auto-apply')
    expect(source).toContain('/api/bridge/agent-updates/status')
    expect(source).toContain('/api/bridge/agent-updates/run')
    expect(source).toContain('unsafe or uncertified updates become visible tasks')
    expect(source).toContain('summary.trace_commands.map')
    expect(source).toContain('local_probe_command')
    expect(source).toContain('RonProofPanel')
    expect(source).toContain('FULL ACCESS DELEGATED')
    expect(source).toContain('JARVIS-GATED EXECUTION')
    expect(source).toContain('JARVIS CONCURRENCE REQUIRED')
    expect(source).toContain('Direct-line chat')
    expect(source).toContain("method='post' action={proof.proxy_proof_route}")
    expect(source).toContain("name='action' value='run_mission_control_proxy_proof'")
    expect(source).toContain('Uses the current authenticated Mission Control session')
    expect(source).toContain('MISSION_CONTROL_PROXY_CERTIFIED')
    expect(source).toContain('Agent Zero / Jarvis')
    expect(source).toContain('Ron Weasley')
    expect(source).toContain('Pi')
    expect(source).toContain('SpaceAgent is an independent specialized direct-line agent under Jarvis authority')
    expect(source).toContain('/api/bridge/spaceagent/pipeline-status')
    expect(source).toContain('/api/bridge/spaceagent/brain-status')
    expect(source).toContain('/api/bridge/spaceagent/tool-map')
    expect(source).toContain('/api/bridge/spaceagent/certification-proof')
    expect(source).toContain('/api/bridge/spaceagent/quality-scorecard')
    expect(source).toContain('/api/bridge/spaceagent/live-proof-readiness')
    expect(source).toContain('/api/bridge/spaceagent/final-certification')
    expect(source).toContain('Quality Scorecard')
    expect(source).toContain('Live Proof Readiness')
    expect(source).toContain('Final Certification')
    expect(source).toContain('internal pipeline templates')
    expect(source).toContain('Brain source labels')
    expect(source).toContain('Gateway-brokered tool map')
    expect(source).toContain('certification source proof')
    expect(source).toContain('OpenCloud / OpenClaw stay supporting runtime tools')
    expect(source).toContain('Nuclear Gateway')
    expect(source).not.toContain('Bridge not active')
    expect(source).not.toContain('OpenCloud intermediary true')
    expect(source).not.toContain('Ron Wegsley')
  })

  it('keeps owner-visible Agent Hub handoff data from overriding Ron live truth', () => {
    const source = readFileSync('public/design/gateway/shared/agent-data.js', 'utf8')
    const ronBlock = source.slice(source.indexOf("id: 'hermes'"), source.indexOf("id: 'space-agent'"))

    expect(ronBlock).toContain("name: 'Ron Weasley'")
    expect(ronBlock).toContain("status_label: 'FULL ACCESS DELEGATED / JARVIS-GATED EXECUTION'")
    expect(ronBlock).toContain("status: 'green'")
    expect(ronBlock).toContain('protected writes require Jarvis concurrence')
    expect(ronBlock).not.toContain('Ron Wegsley')
    expect(ronBlock).not.toContain("status: 'yellow'")
    expect(source).toContain('Owner → Mission Control → Nuclear Gateway → direct agent line')
    expect(source).toContain('Full Access Gateway Agent')
    expect(source).toContain("label: 'Open UI'")
  })

  it('renders the Agent Hub auto-update control plane on the live Gateway shell rail', () => {
    const source = readFileSync('src/components/gateway/GatewayShell.tsx', 'utf8')

    expect(source).toContain('Agent Auto-Update Control Plane')
    expect(source).toContain('/api/bridge/agent-updates/status')
    expect(source).toContain('/api/bridge/agent-updates/run')
    expect(source).toContain('Ron Weasley WebUI')
    expect(source).toContain('Ron Weasley Agent')
    expect(source).toContain('unsafe or uncertified updates become visible tasks')
    expect(source).toContain('OpenCloud intermediary: false')
    expect(source).toContain('Gateway Route / CDP Truth')
    expect(source).toContain('ROUTE_MAP_REQUIRED')
    expect(source).toContain('CDP_NOT_RUNNING')
    expect(source).toContain('/api/gateway/agent-hub/status')
    expect(source).not.toContain('OpenCloud intermediary: true')
  })
})
