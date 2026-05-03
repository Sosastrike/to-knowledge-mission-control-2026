import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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
    expect(state.source_type).toBe('missing')
    expect(state.source_path).toBeNull()
    expect(state.redacted).toBeNull()
    expect(state.accepted_env_names).toContain('AGENT_ZERO_API_KEY')
    expect(state.accepted_file_env_name).toBe('AGENT_ZERO_API_KEY_FILE')
  })

  it('redacts configured Agent Zero API auth by name only', () => {
    const state = getAgentZeroApiKeyState({ AGENT_ZERO_API_KEY: 'secret-value' })
    expect(state.present).toBe(true)
    expect(state.configured_env_name).toBe('AGENT_ZERO_API_KEY')
    expect(state.source_type).toBe('environment')
    expect(state.redacted).toBe('AGENT_ZERO_API_KEY=<redacted>')
    expect(JSON.stringify(state)).not.toContain('secret-value')
  })

  it('reads Agent Zero API auth from a secret file and redacts the value', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-zero-key-'))
    const file = path.join(dir, 'agent-zero-api-key')
    fs.writeFileSync(file, 'file-secret-value\n', { mode: 0o600 })

    const state = getAgentZeroApiKeyState({ AGENT_ZERO_API_KEY_FILE: file })
    expect(state.present).toBe(true)
    expect(state.configured_env_name).toBe('AGENT_ZERO_API_KEY_FILE')
    expect(state.source_type).toBe('secret_file')
    expect(state.source_path).toBe(file)
    expect(state.redacted).toBe('AGENT_ZERO_API_KEY_FILE=<redacted>')
    expect(JSON.stringify(state)).not.toContain('file-secret-value')
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
    expect(context.opencloud_buildwiki.build_wiki_status_visible).toBe(true)
    expect(context.opencloud_buildwiki.direct_opencloud_access_visible).toBe(false)
    expect(context.opencloud_buildwiki.farmer_execution_enabled).toBe(false)
    expect(prompt).toContain('Mission Control read-only ecosystem test')
    expect(prompt).toContain('Do not run tools')
    expect(prompt).toContain('Do not enumerate your internal Agent Zero tools')
    expect(prompt).toContain('"heygen_schema_visible":true')
  })
})
