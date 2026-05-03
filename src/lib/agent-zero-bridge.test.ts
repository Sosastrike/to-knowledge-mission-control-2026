import { describe, expect, it } from 'vitest'
import {
  buildAgentZeroReadOnlyContext,
  buildAgentZeroReadOnlyPrompt,
  getAgentZeroApiKeyState,
  sendAgentZeroReadOnlyMessage,
} from './agent-zero-bridge'

describe('Agent Zero read-only bridge connector', () => {
  it('reports missing external API auth without exposing a secret', () => {
    const state = getAgentZeroApiKeyState({})
    expect(state.present).toBe(false)
    expect(state.configured_env_name).toBeNull()
    expect(state.redacted).toBeNull()
    expect(state.accepted_env_names).toContain('AGENT_ZERO_API_KEY')
  })

  it('redacts configured Agent Zero API auth by name only', () => {
    const state = getAgentZeroApiKeyState({ AGENT_ZERO_API_KEY: 'secret-value' })
    expect(state.present).toBe(true)
    expect(state.configured_env_name).toBe('AGENT_ZERO_API_KEY')
    expect(state.redacted).toBe('AGENT_ZERO_API_KEY=<redacted>')
    expect(JSON.stringify(state)).not.toContain('secret-value')
  })

  it('blocks live Agent Zero chat before any call when auth is missing', async () => {
    const result = await sendAgentZeroReadOnlyMessage({
      ownerMessage: 'Can you see Mission Control?',
      env: {},
      context: buildAgentZeroReadOnlyContext({ providerIds: ['tony', 'agent_zero'] }),
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(503)
    expect(result.agent_zero_called).toBe(false)
    expect(result.blocker).toBe('agent_zero_external_api_key_missing')
    expect(result.execution_enabled).toBe(false)
    expect(result.writes_enabled).toBe(false)
  })

  it('builds a read-only Mission Control context and refuses execution claims', () => {
    const context = buildAgentZeroReadOnlyContext({
      providerIds: ['tony', 'agent_zero', 'zapier'],
      mcpVisible: true,
      zapierVisible: true,
      heygenVisible: true,
      heygenSchemaVisible: true,
    })
    const prompt = buildAgentZeroReadOnlyPrompt('What can you see?', context)

    expect(context.mission_control.execution_enabled).toBe(false)
    expect(context.mission_control.writes_enabled).toBe(false)
    expect(context.bridge.providers).toEqual(['agent_zero', 'tony', 'zapier'])
    expect(prompt).toContain('Mission Control read-only ecosystem test')
    expect(prompt).toContain('Do not run tools')
    expect(prompt).toContain('"heygen_schema_visible":true')
  })
})
