import { describe, expect, it } from 'vitest'

import {
  buildCredentialBrokerStatus,
  buildCredentialBrokerSystemStatus,
  listCredentialBrokerSystems,
  runCredentialBrokerCheck,
} from '@/lib/credential-broker'

describe('Nuclear Gateway credential broker', () => {
  it('reports credential presence by name only and never exposes values', () => {
    const env = {
      NODE_ENV: 'test' as const,
      MISSION_CONTROL_API_KEY: 'secret-mission-control-value',
      PAPERCLIP_BOARD_API_KEY: 'secret-paperclip-value',
      OPENCLAW_GATEWAY_HOST: '127.0.0.1',
    }
    const status = buildCredentialBrokerStatus(env)
    const serialized = JSON.stringify(status)

    expect(status).toMatchObject({
      route: 'bridge.credentials.status',
      mode: 'name_only_credential_broker',
      values_exposed: false,
      no_secrets_exposed: true,
      credential_broker_owner: 'nuclear_gateway',
      openclaw_credential_broker_allowed: false,
      project_continues: true,
    })
    expect(serialized).not.toContain('secret-mission-control-value')
    expect(serialized).not.toContain('secret-paperclip-value')
    expect(serialized).toContain('MISSION_CONTROL_API_KEY')
    expect(serialized).toContain('PAPERCLIP_BOARD_API_KEY')
  })

  it('normalizes legacy agent names without giving OpenClaw credential broker ownership', () => {
    expect(buildCredentialBrokerSystemStatus('hermes', { NODE_ENV: 'test' as const })).toMatchObject({
      system: 'ron-weasley',
      values_exposed: false,
      scope: 'nuclear_dispatcher_scoped_token_brokered',
    })
    expect(buildCredentialBrokerSystemStatus('opencloud', {
      NODE_ENV: 'test' as const,
      OPENCLAW_GATEWAY_PORT: '18789',
    })).toMatchObject({
      system: 'openclaw',
      values_exposed: false,
      scope: 'supporting_runtime_only_not_credential_broker',
      owner_action_required: false,
    })
  })

  it('runs broker checks with exact name filters and redacted output', () => {
    const result = runCredentialBrokerCheck({
      system: 'paperclip',
      credential_names: ['PAPERCLIP_BOARD_API_KEY', 'BAD-NAME=secret'],
    }, {
      NODE_ENV: 'test' as const,
      PAPERCLIP_BOARD_API_KEY: 'secret-paperclip-value',
    })

    expect(result).toMatchObject({
      ok: true,
      route: 'bridge.credentials.broker-check',
      system: 'paperclip',
      credential_names_checked: ['PAPERCLIP_BOARD_API_KEY'],
      values_exposed: false,
      no_secrets_exposed: true,
      project_continues: true,
    })
    expect(JSON.stringify(result)).not.toContain('secret-paperclip-value')
  })

  it('keeps registered systems explicit', () => {
    expect(listCredentialBrokerSystems()).toEqual(expect.arrayContaining([
      'mission-control',
      'agent-zero-jarvis',
      'ron-weasley',
      'pi',
      'paperclip',
      'brain-bridge',
      'openclaw',
    ]))
    expect(runCredentialBrokerCheck({ system: 'missing-system' })).toMatchObject({
      ok: false,
      exact_blocker: 'credential_system_not_registered',
      values_exposed: false,
      no_secrets_exposed: true,
    })
  })
})
