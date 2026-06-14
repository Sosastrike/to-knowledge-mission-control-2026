import { describe, expect, it } from 'vitest'

import {
  buildAgentMessageEnvelope,
  buildAgentRoutingLinesStatus,
  auditOpenCloudReferences,
  listAgentRoutingLines,
  resolveAgentRoutingLine,
  routeAgentMessage,
} from '@/lib/agent-routing-lines'

describe('Universal direct agent routing lines', () => {
  it('registers direct lines for canonical agents and demotes OpenCloud', () => {
    const status = buildAgentRoutingLinesStatus()
    const lines = status.by_id

    expect(status.opencloud_demoted_to_supporting_runtime).toBe(true)
    expect(status.no_secrets_exposed).toBe(true)
    expect(status.project_continues).toBe(true)
    expect(status.generated_at).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/))
    expect(status.generated_at).not.toBe('2026-05-21T00:00:00.000Z')
    expect(status.lines.every((line) => line.last_verified === status.generated_at)).toBe(true)
    expect(lines['agent-zero-jarvis']).toMatchObject({
      direct_line_active: true,
      conversation_owner: 'agent-zero-jarvis',
      gateway_route: '/api/bridge/agent-zero/*',
      opencloud_allowed_role: 'supporting_tool_only',
    })
    expect(lines.hermes).toMatchObject({
      direct_line_active: true,
      conversation_owner: 'ron-weasley',
      reports_to: 'agent-zero-jarvis',
      gateway_route: '/api/bridge/hermes/*',
    })
    expect(lines.pi).toMatchObject({
      direct_line_active: true,
      conversation_owner: 'pi',
      execution_policy: 'advisory_only_until_certified',
    })
    expect(lines.paperclip).toMatchObject({
      direct_line_active: true,
      conversation_owner: 'paperclip',
      company_scope_required: true,
    })
    expect(lines.spaceagent).toMatchObject({
      direct_line_active: true,
      conversation_owner: 'spaceagent',
    })
    expect(lines.opencloud).toMatchObject({
      system_type: 'supporting_runtime_system',
      direct_line_active: false,
      conversation_owner: 'none',
      allowed_as_tool: true,
      allowed_as_intermediary: false,
      allowed_as_commander: false,
    })
  })

  it('keeps Pi, SpaceAgent, and Paperclip visible without granting broad execution', () => {
    const status = buildAgentRoutingLinesStatus()
    const directAgents = [
      status.by_id['agent-zero-jarvis'],
      status.by_id.hermes,
      status.by_id.pi,
      status.by_id.spaceagent,
      status.by_id.paperclip,
    ]

    for (const line of directAgents) {
      expect(line).toMatchObject({
        direct_line_active: true,
        normal_chat_bridge_required: false,
        gateway_tools_visible: true,
        skills_visible: true,
        mcp_visible: true,
        models_visible: true,
        gateway_runtime_visible: true,
        hidden_intermediary_required: false,
        dangerous_actions_require_scope: true,
        credential_values_exposed: false,
      })
      expect(line.forbidden_intermediaries).toEqual(expect.arrayContaining(['opencloud', 'openclaw', 'claudeclaw']))
    }

    expect(status.normal_chat_bridge_required).toBe(false)
    expect(status.dangerous_actions_require_scope).toBe(true)
    expect(status.by_id.pi).toMatchObject({
      system_type: 'advisory_dispatcher',
      display_name: 'Pi Advisory Dispatcher',
      execution_policy: 'advisory_only_until_certified',
      allowed_tools: ['read_only_recommendations', 'gateway_status'],
    })
    expect(status.by_id.spaceagent).toMatchObject({
      execution_policy: 'local_only_browser_research_no_public_exposure',
      allowed_tools: ['playwright_mcp_local_only', 'read_only_research'],
    })
    expect(status.by_id.paperclip).toMatchObject({
      execution_policy: 'writes_bridge_gated_company_scope_required',
    })
  })

  it('gives Paperclip company agents and Hermes mini-agents scoped direct lines', () => {
    const ids = listAgentRoutingLines().map((line) => line.agent_id)

    expect(ids).toEqual(expect.arrayContaining([
      'paperclip.eco.ceo',
      'paperclip.eco.cmo',
      'paperclip.eco.cto',
      'paperclip.eco.avatar-specialist',
      'paperclip.eco.field-service-advisor',
      'paperclip.eco.social-coordinator',
      'paperclip.eco.video-producer',
      'paperclip.pacman-cybersecurity.ceo',
      'hermes-mini-agent.researcher',
      'hermes-mini-agent.classifier',
      'hermes-mini-agent.workflow-drafter',
      'memory-approvals',
    ]))

    expect(resolveAgentRoutingLine('paperclip.pacman-cybersecurity.ceo')).toMatchObject({
      reports_to: 'paperclip',
      company_scope_required: true,
      blocker: 'paperclip_board_admin_credential_required',
    })
    expect(resolveAgentRoutingLine('paperclip.eco.avatar-specialist')).toMatchObject({
      reports_to: 'paperclip',
      company_scope_required: true,
      company_slug: 'eco',
      company_name: 'E copier Solutions',
      role: 'Avatar Specialist',
      allowed_actions: ['read_status', 'read_context', 'draft_recommendation', 'request_exact_scope_write'],
      write_policy: 'jarvis_delegated_company_scope_required',
      blocker: null,
    })
    expect(resolveAgentRoutingLine('hermes-mini-agent.researcher')).toMatchObject({
      reports_to: 'hermes',
      execution_policy: 'parent_hermes_final_authority_agent_zero_no_secrets_no_production_writes',
    })
  })

  it('resolves human-friendly aliases for Brain, Build-Wiki, tools, and providers', () => {
    expect(resolveAgentRoutingLine('ron')).toMatchObject({ agent_id: 'hermes' })
    expect(resolveAgentRoutingLine('ron-weasley')).toMatchObject({ agent_id: 'hermes' })
    expect(resolveAgentRoutingLine('Ron Weasley')).toMatchObject({ agent_id: 'hermes' })
    expect(resolveAgentRoutingLine('brain-bridge')).toMatchObject({ agent_id: 'brain-sync' })
    expect(resolveAgentRoutingLine('buildwiki')).toMatchObject({ agent_id: 'build-wiki-farmer' })
    expect(resolveAgentRoutingLine('farmer')).toMatchObject({ agent_id: 'build-wiki-farmer' })
    expect(resolveAgentRoutingLine('memory-approval')).toMatchObject({ agent_id: 'memory-approvals' })
    expect(resolveAgentRoutingLine('graph')).toMatchObject({ agent_id: 'graphify' })
    expect(resolveAgentRoutingLine('mem-palace')).toMatchObject({ agent_id: 'mempalace' })
    expect(resolveAgentRoutingLine('agent-mail')).toMatchObject({ agent_id: 'agentmail' })
    expect(resolveAgentRoutingLine('drive')).toMatchObject({ agent_id: 'google-drive' })
    expect(resolveAgentRoutingLine('mcp')).toMatchObject({ agent_id: 'mcp-tool-layer' })
    expect(resolveAgentRoutingLine('models')).toMatchObject({ agent_id: 'provider-model-layer' })
  })

  it('maps Telegram Jarvis aliases to Agent Zero and never to OpenCloud', () => {
    expect(resolveAgentRoutingLine('@Jarvis_88sbot')).toMatchObject({
      agent_id: 'agent-zero-jarvis',
      conversation_owner: 'agent-zero-jarvis',
    })
    expect(resolveAgentRoutingLine('openclaw')).toMatchObject({
      agent_id: 'opencloud',
      direct_line_active: false,
      conversation_owner: 'none',
    })
  })

  it('builds owner-to-agent envelopes with direct line trace and no hidden intermediary', () => {
    const line = resolveAgentRoutingLine('hermes')
    if (!line) throw new Error('Hermes line should exist')

    const envelope = buildAgentMessageEnvelope({
      target_agent: 'hermes',
      source_channel: 'telegram',
      message: 'route this work',
      owner_id_redacted: 'owner_hash',
    }, line, {
      visible_task_id: '101',
      audit_id: 'audit_101',
      rollback_id: 'no_state_101',
    })

    expect(envelope).toMatchObject({
      source_channel: 'telegram',
      target_agent: 'hermes',
      conversation_owner: 'ron-weasley',
      direct_line_used: true,
      route_trace: ['owner', 'mission_control_gateway', 'hermes'],
      intermediaries: [],
      opencloud_used: false,
      opencloud_role: 'not_used',
      visible_task_id: '101',
    })
  })

  it('records scoped route traces for company agents, mini-agents, and Brain child lanes', () => {
    const ecoCeo = resolveAgentRoutingLine('paperclip.eco.ceo')
    const miniAgent = resolveAgentRoutingLine('hermes-mini-agent.researcher')
    const obsidian = resolveAgentRoutingLine('obsidian')
    const hermesWebui = resolveAgentRoutingLine('hermes-webui')
    if (!ecoCeo || !miniAgent || !obsidian || !hermesWebui) throw new Error('Expected direct lines to exist')

    expect(buildAgentMessageEnvelope({ message: 'status' }, ecoCeo).route_trace).toEqual([
      'owner',
      'mission_control_gateway',
      'paperclip',
      'paperclip.company.eco',
      'paperclip.eco.ceo',
    ])
    expect(buildAgentMessageEnvelope({ message: 'status' }, miniAgent).route_trace).toEqual([
      'owner',
      'mission_control_gateway',
      'hermes',
      'hermes-mini-agent.researcher',
    ])
    expect(buildAgentMessageEnvelope({ message: 'status' }, obsidian).route_trace).toEqual([
      'owner',
      'mission_control_gateway',
      'brain-sync',
      'obsidian',
    ])
    expect(buildAgentMessageEnvelope({ message: 'status' }, hermesWebui).route_trace).toEqual([
      'owner',
      'mission_control_gateway',
      'hermes',
      'hermes-webui',
    ])
  })

  it('records direct-line send envelopes and visible scoped blockers', () => {
    const hermes = routeAgentMessage({
      target_agent: 'hermes',
      source_channel: 'mission_control_gateway',
      message: 'status check',
    })

    expect(hermes).toMatchObject({
      ok: true,
      route: 'bridge.agent-routing.send',
      mode: 'direct_agent_line_envelope_recorded',
      envelope: {
        target_agent: 'hermes',
        conversation_owner: 'ron-weasley',
        direct_line_used: true,
        route_trace: ['owner', 'mission_control_gateway', 'hermes'],
        intermediaries: [],
        opencloud_used: false,
      },
      project_continues: true,
      external_writes_enabled: false,
      credential_values_exposed: false,
    })
    expect(hermes.visible_task_id).toEqual(expect.any(String))
    expect(hermes.audit_id).toEqual(expect.any(String))
    expect(hermes.rollback_id).toEqual(expect.any(String))

    const missingLine = routeAgentMessage({ target_agent: 'not-registered', message: 'hello' })

    expect(missingLine).toMatchObject({
      ok: false,
      exact_blocker: 'agent_direct_line_missing_visible_ticket_required',
      owner_visible_task_route: expect.stringMatching(/^\/api\/tasks\/\d+$/),
      visible_task_event_route: expect.stringMatching(/^\/api\/tasks\/\d+\/events$/),
      audit_id: expect.any(String),
      rollback_id: expect.any(String),
      rollback_no_state_proof: {
        external_writes_enabled: false,
        production_write_allowed: false,
        credential_values_exposed: false,
      },
      project_continues: true,
      credential_values_exposed: false,
    })
    expect(missingLine.visible_task_id).toEqual(expect.any(String))

    const opencloudCommander = routeAgentMessage({ target_agent: 'opencloud', message: 'command mission' })

    expect(opencloudCommander).toMatchObject({
      ok: false,
      exact_blocker: 'opencloud_is_supporting_runtime_not_commander',
      owner_visible_task_route: expect.stringMatching(/^\/api\/tasks\/\d+$/),
      visible_task_event_route: expect.stringMatching(/^\/api\/tasks\/\d+\/events$/),
      audit_id: expect.any(String),
      rollback_id: expect.any(String),
      rollback_no_state_proof: {
        external_writes_enabled: false,
        production_write_allowed: false,
        credential_values_exposed: false,
      },
      project_continues: true,
      credential_values_exposed: false,
    })
    expect(opencloudCommander.visible_task_id).toEqual(expect.any(String))
  })

  it('refuses hidden intermediaries while preserving explicit tool-call support lanes', () => {
    const hiddenTransport = routeAgentMessage({
      target_agent: 'hermes',
      source_channel: 'mission_control_gateway',
      message: 'status check',
      intermediaries: ['legacy-transport-layer'],
    })

    expect(hiddenTransport).toMatchObject({
      ok: false,
      exact_blocker: 'hidden_intermediary_forbidden',
      envelope: {
        target_agent: 'hermes',
        conversation_owner: 'ron-weasley',
        direct_line_used: false,
        intermediaries: ['legacy-transport-layer'],
        tools_called: [],
        opencloud_used: false,
      },
      project_continues: true,
      credential_values_exposed: false,
      owner_visible_task_route: expect.stringMatching(/^\/api\/tasks\/\d+$/),
      visible_task_event_route: expect.stringMatching(/^\/api\/tasks\/\d+\/events$/),
      audit_id: expect.any(String),
      rollback_id: expect.any(String),
      rollback_no_state_proof: {
        external_writes_enabled: false,
        production_write_allowed: false,
        hidden_intermediary_allowed: false,
        credential_values_exposed: false,
      },
    })
    expect(hiddenTransport.visible_task_id).toEqual(expect.any(String))

    const opencloudIntermediary = routeAgentMessage({
      target_agent: 'agent-zero-jarvis',
      message: 'status check',
      intermediaries: ['openclaw'],
    })

    expect(opencloudIntermediary).toMatchObject({
      ok: false,
      exact_blocker: 'opencloud_hidden_intermediary_forbidden',
      envelope: {
        target_agent: 'agent-zero-jarvis',
        conversation_owner: 'agent-zero-jarvis',
        intermediaries: ['openclaw'],
        opencloud_used: true,
        opencloud_role: 'forbidden_hidden_intermediary',
      },
      owner_visible_task_route: expect.stringMatching(/^\/api\/tasks\/\d+$/),
      visible_task_event_route: expect.stringMatching(/^\/api\/tasks\/\d+\/events$/),
      audit_id: expect.any(String),
      rollback_id: expect.any(String),
      rollback_no_state_proof: {
        external_writes_enabled: false,
        production_write_allowed: false,
        hidden_intermediary_allowed: false,
        credential_values_exposed: false,
      },
    })

    const explicitToolCall = routeAgentMessage({
      target_agent: 'hermes',
      message: 'use diagnostics helper only',
      tools_called: ['openclaw'],
    })

    expect(explicitToolCall).toMatchObject({
      ok: true,
      envelope: {
        target_agent: 'hermes',
        direct_line_used: true,
        intermediaries: [],
        tools_called: ['openclaw'],
        opencloud_used: true,
        opencloud_role: 'supporting_tool_only',
      },
    })
  })

  it('audits OpenCloud references without flagging explicit demotion copy as wrong', () => {
    const audit = auditOpenCloudReferences([
      {
        file: 'good.ts',
        text: 'OpenCloud/OpenClaw is supporting runtime only and must not be the hidden dispatcher or conversation owner.',
      },
      {
        file: 'bad.ts',
        text: 'Owner request routes through OpenCloud before Jarvis answers.',
      },
    ])

    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: 'good.ts', wrong_reference: false }),
      expect.objectContaining({
        file: 'bad.ts',
        wrong_reference: true,
        required_correction: expect.stringContaining('supporting runtime/tool-only'),
      }),
    ]))
  })
})
