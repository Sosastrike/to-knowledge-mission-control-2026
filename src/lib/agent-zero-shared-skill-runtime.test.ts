import { describe, expect, it } from 'vitest'
import { buildAgentZeroReadOnlyContext, type AgentZeroSkillRegistryItem, type AgentZeroSkillSourceSummary } from './agent-zero-bridge'

describe('OpenClaw+ shared skill runtime', () => {
  it('exposes skill paths, requirements, blockers, and shared Agent Zero/Hermes access without Tony ownership', () => {
    const skill: AgentZeroSkillRegistryItem = {
      id: 'openclaw_plus:report-builder',
      name: 'report-builder',
      source: 'openclaw_plus',
      source_label: 'OpenClaw+ shared skills',
      path: '/home/tony/.openclaw/skills/report-builder',
      skill_doc_path: '/home/tony/.openclaw/skills/report-builder/SKILL.md',
      description: 'Builds owner-facing reports.',
      dependencies: ['tool:report.create', 'credential:AGENTMAIL_API_KEY'],
      required_tools: ['report.create'],
      required_credentials: ['AGENTMAIL_API_KEY'],
      execution_requirements: ['bridge_session_required_for_execution', 'credentials_required'],
      missing_dependencies: ['credential:AGENTMAIL_API_KEY'],
      blocked_dependencies: ['tool:report.create:execution_disabled_in_read_only_context'],
      blocked_reasons: ['credential:AGENTMAIL_API_KEY:missing', 'tool:report.create:bridge_session_required'],
      runtime_layer: 'OpenClaw+',
      shared_runtime: true,
      owner_agent: null,
      available_to_agents: ['agent_zero', 'hermes'],
      legacy_controller_owns_skill_system: false,
      safe_mode: 'metadata_only',
      status: 'visible',
      execution_enabled: false,
      writes_enabled: false,
      direct_access: false,
      proxy_access: true,
      blocked_reason: null,
    }
    const source: AgentZeroSkillSourceSummary = {
      source: 'openclaw_plus',
      label: 'OpenClaw+ shared skills',
      root_path: '/home/tony/.openclaw/skills',
      status: 'visible',
      total: 1,
      runtime_layer: 'OpenClaw+',
      shared_runtime: true,
      owner_agent: null,
      available_to_agents: ['agent_zero', 'hermes'],
      legacy_controller_owns_skill_system: false,
      safe_mode: 'metadata_only',
      blocked_reason: null,
    }

    const context = buildAgentZeroReadOnlyContext({
      skillNames: ['report-builder'],
      skillRegistry: [skill],
      skillSources: [source],
    })

    expect(context.skills.shared_runtime).toMatchObject({
      runtime_layer: 'OpenClaw+',
      active_commander: 'agent_zero',
      lieutenant: 'hermes',
      legacy_controller_owns_skill_system: false,
      paths_visible: true,
      required_tools_visible: true,
      required_credentials_visible: true,
      execution_requirements_visible: true,
      blocked_reasons_visible: true,
    })
    expect(context.skills.shared_runtime.available_to_agents).toEqual(['agent_zero', 'hermes'])
    expect(context.skills.sources[0]).toMatchObject({
      root_path: '/home/tony/.openclaw/skills',
      legacy_controller_owns_skill_system: false,
    })
    expect(context.skills.registry[0]).toMatchObject({
      id: 'openclaw_plus:report-builder',
      path: '/home/tony/.openclaw/skills/report-builder',
      skill_doc_path: '/home/tony/.openclaw/skills/report-builder/SKILL.md',
      required_tools: ['report.create'],
      required_credentials: ['AGENTMAIL_API_KEY'],
      execution_requirements: ['bridge_session_required_for_execution', 'credentials_required'],
      blocked_reasons: ['credential:AGENTMAIL_API_KEY:missing', 'tool:report.create:bridge_session_required'],
      runtime_layer: 'OpenClaw+',
      shared_runtime: true,
      owner_agent: null,
      available_to: ['agent_zero', 'hermes'],
      available_to_agents: ['agent_zero', 'hermes'],
      legacy_controller_owns_skill_system: false,
      status: 'visible',
      execution_enabled: false,
      writes_enabled: false,
    })
  })

  it('normalizes missing skill ids and keeps execution-capable skills Bridge Session gated', () => {
    const context = buildAgentZeroReadOnlyContext({
      skillRegistry: [{
        name: 'email-triage',
        source: 'openclaw_plus',
        source_label: 'OpenClaw+ shared skills',
        path: '/home/tony/.openclaw/skills/email-triage',
        skill_doc_path: '/home/tony/.openclaw/skills/email-triage/SKILL.md',
        description: 'Drafts email triage plans.',
        dependencies: ['tool:agentmail', 'credential:AGENTMAIL_API_KEY'],
        required_tools: ['agentmail'],
        required_credentials: ['AGENTMAIL_API_KEY'],
        execution_requirements: ['bridge_session_required_for_execution'],
        missing_dependencies: ['credential:AGENTMAIL_API_KEY'],
        blocked_dependencies: ['tool:agentmail:execution_disabled_in_read_only_context'],
        blocked_reasons: ['credential:AGENTMAIL_API_KEY:missing', 'tool:agentmail:bridge_session_required'],
        runtime_layer: 'OpenClaw+',
        shared_runtime: true,
        owner_agent: null,
        available_to_agents: ['agent_zero'],
        legacy_controller_owns_skill_system: false,
        safe_mode: 'metadata_only',
        status: 'visible',
        execution_enabled: false,
        writes_enabled: false,
        direct_access: false,
        proxy_access: true,
        blocked_reason: 'credential:AGENTMAIL_API_KEY:missing',
      }],
    })

    expect(context.skills.registry[0]).toMatchObject({
      id: 'openclaw_plus:email-triage',
      available_to: ['agent_zero', 'hermes'],
      available_to_agents: ['agent_zero', 'hermes'],
      required_tools: ['agentmail'],
      required_credentials: ['AGENTMAIL_API_KEY'],
      execution_requirements: ['bridge_session_required_for_execution'],
      blocked_reason: 'credential:AGENTMAIL_API_KEY:missing',
      execution_enabled: false,
      writes_enabled: false,
      legacy_controller_owns_skill_system: false,
    })
    expect(context.skills.shared_runtime.bridge_session_required_for_execution).toBe(true)
    expect(context.skills.shared_runtime.skill_review_workflow).toContain('Hermes proposes')
  })
})
