import { describe, expect, it } from 'vitest'
import { buildAgentZeroReadOnlyContext } from '@/lib/agent-zero-bridge'
import {
  buildHermesReadOnlyContext,
  classifyHermesStatus,
  redactSecretsDeep,
  sendHermesReadOnlyMessage,
} from '@/lib/hermes-bridge'

function fakeEcosystemContext() {
  return buildAgentZeroReadOnlyContext({
    providerIds: ['agent_zero', 'hermes', 'openrouter'],
    providerRegistry: [
      { id: 'agent_zero', name: 'Agent Zero', state: 'active', category: 'agent', execution_enabled: false, direct_access: false, proxy_access: true },
      { id: 'hermes', name: 'Hermes', state: 'degraded', category: 'agent', execution_enabled: false, direct_access: false, proxy_access: true },
    ],
    agents: [
      { id: 'agent_zero', status: 'active', role: 'commander', execution_enabled: true, direct_access: false, proxy_access: true },
      { id: 'hermes', status: 'degraded', role: 'lieutenant / skill and workflow specialist', execution_enabled: false, direct_access: false, proxy_access: true },
    ],
    skillNames: ['workflow-designer'],
    skillRegistry: [{
      name: 'workflow-designer',
      source: 'openclaw_plus',
      source_label: 'OpenClaw+',
      path: '/home/tony/.openclaw/skills/workflow-designer',
      skill_doc_path: '/home/tony/.openclaw/skills/workflow-designer/SKILL.md',
      description: 'Designs safe workflows.',
      dependencies: ['tool:bridge'],
      required_tools: ['bridge'],
      required_credentials: ['OPENROUTER_API_KEY'],
      execution_requirements: ['Bridge Session required for execution'],
      missing_dependencies: [],
      blocked_dependencies: [],
      blocked_reasons: [],
      runtime_layer: 'OpenClaw+',
      shared_runtime: true,
      owner_agent: null,
      available_to_agents: ['agent_zero', 'hermes'],
      tony_owns_skill_system: false,
      safe_mode: 'metadata_only',
      status: 'visible',
      execution_enabled: false,
      writes_enabled: false,
      direct_access: false,
      proxy_access: true,
      blocked_reason: null,
    }],
    brainSources: [
      { source: 'obsidian', status: 'visible', raw_state: 'visible' },
      { source: 'mempalace', status: 'visible', raw_state: 'visible' },
    ],
    brainRegistry: [
      {
        id: 'obsidian',
        name: 'Obsidian',
        status: 'visible',
        raw_state: 'visible',
        status_visible: true,
        read_available: true,
        write_available: false,
        blocked: false,
        blocked_reason: null,
        read_blocked_reason: null,
        write_blocked_reason: 'bridge_session_required',
        read_adapter: 'available',
        write_adapter: 'status_only',
        read_content_enabled: true,
        write_content_enabled: false,
        memory_writes_enabled: false,
        direct_access: false,
        proxy_access: true,
        path_status: 'present',
        index_status: 'configured',
        last_sync_at: null,
        last_attempt_at: null,
        last_error: null,
        available_read_apis: ['/api/bridge/agent-zero/obsidian'],
        available_write_apis: [],
        blockers: [],
        summary: 'visible',
        notes: 'visible',
      },
    ],
  })
}

describe('Hermes bridge status classification', () => {
  it('reports connected status without enabling execution', () => {
    const status = classifyHermesStatus({ installed: true, reachable: true, authConfigured: true, version: 'Hermes Agent v0.11.0' })

    expect(status).toMatchObject({
      health: 'healthy',
      state: 'connected',
      reachable: true,
      auth_configured: true,
      execution_enabled: false,
      writes_enabled: false,
      blocker: null,
      values_exposed: false,
    })
  })

  it('reports missing auth as degraded and redacted', () => {
    const status = classifyHermesStatus({ installed: true, reachable: true, authConfigured: false })

    expect(status.state).toBe('degraded')
    expect(status.blocker).toBe('hermes_auth_not_configured')
    expect(JSON.stringify(status)).not.toMatch(/token|secret|password|sk-/i)
  })

  it('reports unreachable health and missing install distinctly', () => {
    expect(classifyHermesStatus({ installed: true, reachable: false, authConfigured: true }).blocker)
      .toBe('hermes_gateway_unreachable')
    expect(classifyHermesStatus({ installed: false, reachable: false, authConfigured: false }).blocker)
      .toBe('hermes_not_installed')
  })

  it('marks provider warnings as degraded without exposing values', () => {
    const status = classifyHermesStatus({
      installed: true,
      reachable: true,
      authConfigured: true,
      providerWarning: 'chat_adapter_not_proven',
    })

    expect(status.health).toBe('degraded')
    expect(status.blocker).toBe('chat_adapter_not_proven')
    expect(status.values_exposed).toBe(false)
  })
})

describe('Hermes read-only test chat guardrail', () => {
  it('builds redacted context with Agent Zero, Bridge/MCP, skills, Brain, and OpenClaw+', () => {
    const context = buildHermesReadOnlyContext(fakeEcosystemContext())

    expect(context.mission_control.routes).toContain('/api/bridge/hermes/test-chat')
    expect(context.agents.agent_zero.role).toBe('commander')
    expect(context.agents.hermes.role).toBe('lieutenant / skill and workflow specialist')
    expect(context.skills.runtime_layer).toBe('OpenClaw+')
    expect(context.brain.registry[0].name).toBe('Obsidian')
    expect(context.safety.execution_enabled).toBe(false)
  })

  it('redacts secret-looking values but keeps credential names', () => {
    const redacted = redactSecretsDeep({
      credential_name: 'OPENROUTER_API_KEY',
      api_key: 'example-sensitive-value',
      token: 'example-token-value',
    })

    expect(redacted.credential_name).toBe('OPENROUTER_API_KEY')
    expect(redacted.api_key).toBe('<redacted>')
    expect(redacted.token).toBe('<redacted>')
  })

  it('returns an honest blocked live-chat result without execution or fake access', async () => {
    const result = await sendHermesReadOnlyMessage({
      ownerMessage: 'Can you see Mission Control? Answer yes or no.',
      context: fakeEcosystemContext(),
    })

    expect(result.ok).toBe(true)
    expect(result.hermes_called).toBe(false)
    expect(result.blocker).toBe('hermes_safe_live_chat_adapter_not_configured')
    expect(result.response_text).toMatch(/^No, Sir\./)
    expect(result.response_text).not.toMatch(/\/home\/tony|Failed stage|Traceback|Done/i)
    expect(result.safety).toMatchObject({
      no_execution: true,
      no_writes: true,
      no_tool_invocation: true,
      no_secret_values: true,
      no_fake_done: true,
    })
  })

  it('answers role and capability prompts from registry context only', async () => {
    const role = await sendHermesReadOnlyMessage({
      ownerMessage: 'Can you see Agent Zero? What is his role?',
      context: fakeEcosystemContext(),
    })
    const capability = await sendHermesReadOnlyMessage({
      ownerMessage: 'What can you do in this ecosystem? Do not execute anything.',
      context: fakeEcosystemContext(),
    })

    expect(role.response_text).toContain('Agent Zero is the commander')
    expect(capability.response_text).toContain('OpenClaw+ skills')
    expect(capability.execution_enabled).toBe(false)
    expect(capability.writes_enabled).toBe(false)
  })
})
