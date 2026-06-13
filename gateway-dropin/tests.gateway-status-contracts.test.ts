import { describe, expect, it } from 'vitest'

import { statusForGatewayApiPath } from './src/components/gateway/gateway-status-contracts'

describe('statusForGatewayApiPath - standalone Gateway read-only status contracts', () => {
  it('reports Agent Zero as operational through exact-scope execution', () => {
    const status = statusForGatewayApiPath(['agent-zero', 'status'])
    expect(status).toMatchObject({
      ok: true,
      state: 'OPERATIONAL_GO',
      agent_id: 'agent-zero',
      label: 'Agent Zero (Jarvis)',
      execution_enabled: true,
      go_claim_allowed: true,
      owner_access_blocker: null,
    })
  })

  it('exposes Jarvis bridge status, ecosystem, and report preview with exact-scope execution enabled', () => {
    const status = statusForGatewayApiPath(['bridge', 'agent-zero', 'status'])
    expect(status).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.status',
      owner_facing_name: 'Agent Zero (Jarvis)',
      execution_enabled: true,
      protected_execution_enabled: true,
    })
    expect(JSON.stringify(status)).toContain('/api/bridge/agent-zero/ecosystem')
    expect(JSON.stringify(status)).toContain('owner_hard_stops_only_remaining')

    const ecosystem = statusForGatewayApiPath(['bridge', 'agent-zero', 'ecosystem'])
    expect(ecosystem).toMatchObject({
      ok: true,
      mode: 'jarvis_full_ecosystem_operational_context',
      execution_enabled: true,
      writes_enabled: true,
    })
    expect(JSON.stringify(ecosystem)).toContain('execution_readiness_matrix')
    expect(JSON.stringify(ecosystem)).toContain('visible_to_agent_zero')

    const reports = statusForGatewayApiPath(['bridge', 'agent-zero', 'reports'])
    expect(reports).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.reports',
      delivery_enabled: false,
      send_enabled: false,
      exact_blocker_for_delivery: 'bridge_session_required',
    })
  })

  it('separates the canonical Mission Control agent roster from local Agent Zero profiles', () => {
    const roster = statusForGatewayApiPath(['bridge', 'agent-zero', 'agent-roster'])
    expect(roster).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.agent-roster',
      mode: 'canonical_mission_control_agent_roster',
      credential_values_exposed: false,
      execution_enabled: false,
      writes_enabled: false,
    })

    expect(roster.local_agent_zero_profiles).toEqual([
      'Developer',
      'Researcher',
      'Hacker',
      'Agent Zero profile',
      'Default profile',
    ])
    expect(JSON.stringify(roster)).toContain('local Agent Zero delegation profiles, not Mission Control agents')

    const missionControlAgents = roster.mission_control_agents as Array<{ id: string; label: string }>
    expect(missionControlAgents.map((agent) => agent.label)).toContain('Agent Zero (Jarvis)')
    expect(missionControlAgents.map((agent) => agent.label)).toContain('Paperclip')
    expect(missionControlAgents.map((agent) => agent.label)).toContain('PI Dispatcher')
    expect(missionControlAgents.map((agent) => agent.label)).not.toContain('Developer')
    expect(missionControlAgents.map((agent) => agent.label)).not.toContain('Researcher')
    expect(missionControlAgents.map((agent) => agent.label)).not.toContain('Hacker')
    expect(missionControlAgents.map((agent) => agent.label)).not.toContain('Default profile')

    expect(JSON.stringify(roster.paperclip_eco_agents)).toContain('CEO')
    expect(JSON.stringify(roster.dispatcher_agents)).toContain('PI Dispatcher')
    expect(roster.hermes_status).toBe('agent_registered')
    expect(roster.space_agent_status).toBe('agent_registered')
    expect(roster.source_endpoints_checked).toMatchObject({
      mission_control_agents: '/api/agents',
      dispatcher_status: '/api/bridge/dispatcher/status',
      paperclip_gateway_inventory: '/api/bridge/paperclip/gateway-inventory',
    })
  })

  it('reports reachable local/Tailnet runtimes as read-only without enabling service control', () => {
    expect(statusForGatewayApiPath(['hermes', 'status'])).toMatchObject({
      state: 'READ_ONLY',
      local_bind_address: '127.0.0.1',
      service_control_enabled: false,
    })
    expect(statusForGatewayApiPath(['paperclip', 'status'])).toMatchObject({
      state: 'READ_ONLY',
      overall_status: 'INSTALLED / READY - WRITES BRIDGE-GATED',
      company_access_status: 'ready',
      exact_blocker: 'paperclip_writes_bridge_gated',
      tailnet_url: 'http://100.116.35.95:3100/ECO/dashboard',
      service_control_enabled: false,
    })
    expect(statusForGatewayApiPath(['bridge', 'space-agent', 'status'])).toMatchObject({
      state: 'DIRECT_GATEWAY_READY',
      playwright_mcp_status: 'live_local_only',
      normal_chat_bridge_required: false,
      gateway_tools_visible: true,
      service_control_enabled: false,
    })
    expect(statusForGatewayApiPath(['spaceagent', 'status'])).toMatchObject({
      state: 'DIRECT_GATEWAY_READY',
      normal_chat_bridge_required: false,
      service_control_enabled: false,
    })
  })

  it('returns connector readiness without enabling external writes', () => {
    const status = statusForGatewayApiPath(['bridge', 'connector-readiness'])
    expect(status).toMatchObject({
      ok: true,
      state: 'READ_ONLY',
      execution_enabled: false,
      external_writes_enabled: false,
      approval_request_created: false,
    })
    expect(Array.isArray(status.connectors)).toBe(true)
  })

  it('exposes a Paperclip-facing Gateway inventory so ECO agents can see Zapier as connected with writes gated', () => {
    const inventory = statusForGatewayApiPath(['bridge', 'paperclip', 'gateway-inventory'])
    expect(inventory).toMatchObject({
      ok: true,
      route: 'bridge.paperclip.gateway-inventory',
      company_scope: 'ECO',
      credential_values_exposed: false,
      execution_enabled: false,
      writes_enabled: false,
      gateway_inventory: {
        company_scope: 'ECO',
        credential_values_exposed: false,
        execution_enabled: false,
        zapier: {
          visible: true,
          execution_allowed: true,
          write_allowed: false,
        },
        bridge_policy: {
          read_visible: true,
          writes_bridge_gated: true,
          execution_requires_bridge_session: true,
        },
      },
    })
    expect(JSON.stringify(inventory)).toContain('Zapier is visible in Gateway')
    expect(JSON.stringify(inventory)).toContain('zapier.connection_probe')
    expect(JSON.stringify(inventory)).not.toContain('Zapier does not exist')
  })

  it('injects Gateway inventory into ECO Paperclip agent context without enabling execution', () => {
    const context = statusForGatewayApiPath(['bridge', 'paperclip', 'agent-context'])
    expect(context).toMatchObject({
      ok: true,
      route: 'bridge.paperclip.agent-context',
      company_scope: 'ECO',
      context_injection_status: 'ready_for_paperclip_runtime',
      execution_enabled: false,
      writes_enabled: false,
      zapier_execution_enabled: false,
      n8n_execution_enabled: false,
      credential_values_exposed: false,
      ceo_test_question: 'Do we have Zapier? Check the Gateway on Mission Control.',
    })
    expect(context.target_agents).toEqual([
      'CEO',
      'CMO',
      'CTO',
      'Avatar Specialist',
      'Field Service Advisor',
      'Social Coordinator',
      'Video Producer',
    ])
    expect(JSON.stringify(context)).toContain('providers')
    expect(JSON.stringify(context)).toContain('models')
    expect(JSON.stringify(context)).toContain('MCP')
    expect(JSON.stringify(context)).toContain('n8n')
    expect(JSON.stringify(context)).toContain('Zapier is visible in Gateway')
    expect(JSON.stringify(context)).toContain('configured')
    expect(JSON.stringify(context)).toContain('WRITES_BRIDGE_GATED')
    expect(JSON.stringify(context)).not.toContain('Zapier does not exist')
    expect(JSON.stringify(context)).not.toContain('I cannot access Mission Control')
  })

  it('describes Paperclip voice reply and Concierge routes as ECO CEO text-only and non-writing', () => {
    const transcribe = statusForGatewayApiPath(['bridge', 'paperclip', 'transcribe'])
    expect(transcribe).toMatchObject({
      ok: true,
      route: 'bridge.paperclip.transcribe',
      company_scope: 'ECO',
      agent_scope: 'CEO',
      auth_tier: 'viewer',
      accepts: 'multipart/form-data',
      writes_enabled: false,
      execution_enabled: false,
      no_auto_send: true,
      sticky_state: 'sqlite',
      secure_context_required: true,
      credential_values_exposed: false,
    })
    expect(transcribe.required_fields).toEqual([
      'audio',
      'context_company_slug',
      'context_agent_id',
      'context_thread_id',
    ])
    expect(JSON.stringify(transcribe)).toContain('transcript_inserted_for_owner_review')

    const concierge = statusForGatewayApiPath(['bridge', 'paperclip', 'concierge', 'answer'])
    expect(concierge).toMatchObject({
      ok: true,
      route: 'bridge.paperclip.concierge.answer',
      bot_name: 'Paperclip Concierge',
      company_scope: 'ECO',
      agent_scope: 'CEO',
      output_mode: 'text_only',
      wrote_anything: false,
      writes_enabled: false,
      execution_enabled: false,
      write_requests: 'WRITES_BRIDGE_GATED',
      credential_values_exposed: false,
    })
    expect(JSON.stringify(concierge)).toContain('not_configured_for_v1')
  })

  it('registers Pi as a direct Gateway agent with exact-scope guards for dangerous actions', () => {
    const pi = statusForGatewayApiPath(['bridge', 'pi', 'status'])
    expect(pi).toMatchObject({
      ok: true,
      state: 'DIRECT_GATEWAY_READY',
      agent_id: 'pi',
      label: 'Pi',
      runtime_blocker: null,
      normal_chat_bridge_required: false,
      gateway_tools_visible: true,
      skills_visible: true,
      mcp_visible: true,
      models_visible: true,
      gateway_runtime_visible: true,
      dangerous_actions_require_scope: true,
      exact_scope_execution_enabled: true,
      writes_enabled: false,
      broad_connector_execution_allowed: false,
    })
    expect(Array.isArray(pi.visibility_contract)).toBe(true)
    expect(JSON.stringify(pi.visibility_contract)).toContain('visible_to_PI')
    expect(JSON.stringify(pi.visibility_contract)).toContain('capability_matrix')

    const matrix = statusForGatewayApiPath(['bridge', 'capability-matrix'])
    expect(JSON.stringify(matrix)).toContain('pi_visibility_contract')
    expect(JSON.stringify(matrix)).toContain('direct_gateway_agent_ready')
    expect(JSON.stringify(matrix)).toContain('execution_readiness_matrix')
    expect(JSON.stringify(matrix)).toContain('visible_to_agent_zero')
    expect(JSON.stringify(matrix)).toContain('write_allowed')
    expect(JSON.stringify(matrix)).not.toContain('pi_runtime_session_not_proven')
  })

  it('keeps PI recommendations read-only and handed off to Jarvis for protected execution', () => {
    const recommendation = statusForGatewayApiPath(['bridge', 'pi', 'recommend'])
    expect(recommendation).toMatchObject({
      ok: true,
      route: 'bridge.pi.recommend',
      execution_enabled: false,
      writes_enabled: false,
      protected_execution_enabled: false,
    })
    expect(JSON.stringify(recommendation)).toContain('Agent Zero (Jarvis)')
  })

  it('exposes Jarvis Bridge Session checklist without enabling a runner', () => {
    const session = statusForGatewayApiPath(['bridge', 'agent-zero', 'bridge-session'])
    expect(session).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.bridge-session',
      execution_enabled: false,
      protected_execution_enabled: false,
    })
    expect(JSON.stringify(session)).toContain('Owner-approved Bridge Session')
    expect(JSON.stringify(session)).toContain('Execution permission enabled for Jarvis session')
  })

  it('exposes Jarvis owner-operator authority without weakening hard stops', () => {
    const authority = statusForGatewayApiPath(['bridge', 'agent-zero', 'authority'])
    expect(authority).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.authority',
      required_role: 'mission_control_owner_operator',
      execution_enabled: false,
      protected_execution_enabled: false,
    })
    expect(JSON.stringify(authority)).toContain('DIRECT_INTERNAL_WRITE')
    expect(JSON.stringify(authority)).toContain('HARD_STOP')
    expect(JSON.stringify(authority)).toContain('.env edits')
    expect(JSON.stringify(authority)).toContain('raw secret exposure')
  })

  it('keeps Jarvis internal writes scoped to Mission Control state', () => {
    const internalWrite = statusForGatewayApiPath(['bridge', 'agent-zero', 'internal-write'])
    expect(internalWrite).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.internal-write',
      required_role: 'mission_control_owner_operator',
      execution_enabled: false,
      protected_execution_enabled: false,
      external_writes_enabled: false,
      exact_blocker: 'bridge_session_required',
    })
    expect(JSON.stringify(internalWrite)).toContain('readiness_matrix_annotation')
    expect(JSON.stringify(internalWrite)).toContain('approval_request_note')
  })

  it('registers Jarvis workflow and certification surfaces as exact-scope executable', () => {
    const workflows = statusForGatewayApiPath(['bridge', 'agent-zero', 'workflows'])
    expect(workflows).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.workflows',
      execution_enabled: true,
      external_writes_enabled: true,
      exact_blocker: 'owner_hard_stops_only_remaining',
    })
    expect(JSON.stringify(workflows)).toContain('paperclip_eco_status')
    expect(JSON.stringify(workflows)).toContain('provider_mcp_repair')

    const certification = statusForGatewayApiPath(['bridge', 'agent-zero', 'certification'])
    expect(certification).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.certification',
      certification_complete: true,
      status: 'OPERATIONAL_GO',
      execution_enabled: true,
      protected_execution_enabled: true,
    })
    expect(JSON.stringify(certification)).toContain('approved_exact_scope_action')
  })

  it('keeps Jarvis bridge audit and revoke routes redacted/non-executing', () => {
    const audit = statusForGatewayApiPath(['bridge', 'agent-zero', 'bridge-session', 'audit'])
    expect(audit).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.bridge-session.audit',
      credential_values_exposed: false,
      execution_enabled: false,
    })

    const revoke = statusForGatewayApiPath(['bridge', 'agent-zero', 'bridge-session', 'revoke'])
    expect(revoke).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.bridge-session.revoke',
      required_role: 'mission_control_owner_operator',
      external_writes_enabled: false,
      protected_execution_enabled: false,
    })
  })

  it('registers the Jarvis execution router with MCP, Paperclip, and n8n readiness/list exact actions', () => {
    const execute = statusForGatewayApiPath(['bridge', 'agent-zero', 'execute'])
    expect(execute).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.execute',
      mode: 'jarvis_exact_scope_execution_router',
      execution_enabled: true,
      credential_values_exposed: false,
      external_writes_enabled: false,
      hard_stop_enforced: true,
      certified_first_action: {
        adapter_id: 'mcp_readonly_status_probe',
        action: 'mcp.status_probe',
        scope: {
          server_id: 'mcp-tools',
          operation: 'status_probe',
        },
      },
    })
    expect(JSON.stringify(execute)).toContain('token_governor_not_proven')
    expect(JSON.stringify(execute)).toContain('paperclip_eco_task_dry_run')
    expect(JSON.stringify(execute)).toContain('paperclip.eco_task_dry_run')
    expect(JSON.stringify(execute)).toContain('paperclip_external_write_disabled')
    expect(JSON.stringify(execute)).toContain('paperclip_writes_bridge_gated')
    expect(JSON.stringify(execute)).toContain('n8n_workflow_list')
    expect(JSON.stringify(execute)).toContain('n8n.workflow_list')
    expect(JSON.stringify(execute)).toContain('n8n_credentials_required_for_workflow_list')
    expect(JSON.stringify(execute)).toContain('workflow_activation_enabled')
    expect(JSON.stringify(execute)).toContain('buildwiki_run_now')
    expect(JSON.stringify(execute)).toContain('buildwiki.run_now_dispatch')
    expect(JSON.stringify(execute)).toContain('opencloud-docs-farmer.service')
    expect(execute.blocked_adapters).not.toContainEqual(
      expect.objectContaining({ id: 'buildwiki_run_now' }),
    )
    expect(JSON.stringify(execute)).not.toContain('zapier_execution_disabled')
    expect(JSON.stringify(execute)).not.toContain('provider/model execution enabled')

    const matrix = statusForGatewayApiPath(['bridge', 'capability-matrix'])
    expect(JSON.stringify(matrix)).toContain('mcp_readonly_status_probe')
    expect(JSON.stringify(matrix)).toContain('paperclip_eco_task_dry_run')
    expect(JSON.stringify(matrix)).toContain('n8n_workflow_list')
    expect(JSON.stringify(matrix)).toContain('buildwiki_run_now')
    expect(JSON.stringify(matrix)).toContain('execution_allowed')
  })

  it('selects exactly one safe Jarvis protected action for certification without dispatching external work', () => {
    const certification = statusForGatewayApiPath(['bridge', 'agent-zero', 'protected-action-certification'])
    expect(certification).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.protected-action-certification',
      selected_action: 'buildwiki_run_now_approval_request_only',
      action_count: 1,
      bridge_session_required: true,
      execution_enabled: false,
      external_writes_enabled: false,
      protected_execution_enabled: false,
      credential_values_exposed: false,
      farmer_dispatch_enabled: false,
      exact_adapter: {
        id: 'buildwiki_run_now',
        mode: 'approval_request_only_no_dispatch',
      },
      exact_scope: {
        connector: 'buildwiki',
        action: 'run_now',
        target: 'opencloud-docs-farmer.service',
        fork_scope: 'Fork 1 only',
      },
      rollback_path: {
        available: true,
      },
    })
    expect(JSON.stringify(certification)).toContain('Bridge Session -> exact-scope adapter -> approval request -> audit -> rollback record')
    expect(JSON.stringify(certification)).not.toContain('systemctl --user start opencloud-docs-farmer.service')
  })

  it('selects Paperclip Gateway Visibility Bridge as the next exact-scope adapter without enabling writes', () => {
    const expansion = statusForGatewayApiPath(['bridge', 'agent-zero', 'exact-scope-adapter-expansion'])
    expect(expansion).toMatchObject({
      ok: true,
      route: 'bridge.agent-zero.exact-scope-adapter-expansion',
      selected_adapter: 'paperclip_gateway_inventory',
      phase: 'phase_2',
      action_count: 1,
      bridge_session_required: true,
      execution_enabled: false,
      external_writes_enabled: false,
      protected_execution_enabled: false,
      credential_values_exposed: false,
      paperclip_writes_enabled: false,
      zapier_execution_enabled: false,
      exact_scope: {
        company_scope: 'ECO',
        source_route: '/api/bridge/paperclip/gateway-inventory',
        allowed_operation: 'read_gateway_inventory_for_paperclip_eco',
      },
      exact_adapter: {
        id: 'paperclip_gateway_inventory',
        mode: 'read_only_inventory_certification',
      },
      rollback_path: {
        available: true,
      },
    })
    expect(JSON.stringify(expansion)).toContain('Bridge Session -> exact-scope adapter -> read-only inventory proof -> audit -> rollback record')
    expect(JSON.stringify(expansion)).toContain('Zapier is visible in Gateway')
    expect(JSON.stringify(expansion)).toContain('WRITES_BRIDGE_GATED')
    expect(JSON.stringify(expansion)).not.toContain('paperclip task created')
  })

  it('reports Brain readiness as partial read-only provenance with writes gated', () => {
    const status = statusForGatewayApiPath(['bridge', 'brain-readiness'])
    expect(status).toMatchObject({
      state: 'READ_ONLY',
      pipeline_state: 'PARTIAL',
      writes_enabled: false,
      exact_blocker: 'brain_write_sync_requires_bridge_and_backend_proof',
    })
    expect(JSON.stringify(status)).toContain('Agent Brain visibility')
  })
})
