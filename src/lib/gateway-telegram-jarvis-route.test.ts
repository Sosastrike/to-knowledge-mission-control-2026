import { describe, expect, it } from 'vitest'

import { buildTelegramJarvisRouteStatus, gatherTelegramJarvisRouteFacts } from './gateway-telegram-jarvis-route'

describe('Gateway Telegram Jarvis route status', () => {
  it('reports the direct Telegram -> Gateway -> Agent Zero route without Bridge Session for normal chat', () => {
    const status = buildTelegramJarvisRouteStatus({
      legacyBrainEnabled: false,
      dedicatedJarvisBotTokenPresent: true,
      agentZeroBotTokenPresent: false,
      legacyTelegramTokenPresent: true,
      ownerTelegramTurnRoutesToAgentZero: true,
      voiceTransportAvailable: true,
    })

    expect(status).toMatchObject({
      route: 'telegram_gateway_agent_zero',
      status: 'direct',
      destination_agent: 'agent.zero',
      display_name: 'Jarvis',
      tony_in_path: false,
      legacy_brain_in_path: false,
      opencloud_in_path: false,
      octm_in_path: false,
      buildwiki_in_path: false,
      normal_chat_bridge_required: false,
      external_actions_require_scope: true,
      voice_transport: 'elevenlabs',
      blockers: [],
    })
    expect(status.detail.telegram_bot).toBe('jarvis')
    expect(status.detail.tokens_exposed).toBe(false)
  })

  it('degrades instead of pretending direct when only the legacy Telegram token is available', () => {
    const status = buildTelegramJarvisRouteStatus({
      legacyBrainEnabled: false,
      dedicatedJarvisBotTokenPresent: false,
      agentZeroBotTokenPresent: false,
      legacyTelegramTokenPresent: true,
      ownerTelegramTurnRoutesToAgentZero: true,
      voiceTransportAvailable: true,
    })

    expect(status.status).toBe('degraded')
    expect(status.blockers).toContain('jarvis_bot_token_not_dedicated')
    expect(status.detail.telegram_bot).toBe('legacy')
    expect(status.normal_chat_bridge_required).toBe(false)
  })

  it('never routes normal chat through Tony, OpenCloud, OCTM, or Build-Wiki', () => {
    const status = buildTelegramJarvisRouteStatus({
      legacyBrainEnabled: false,
      dedicatedJarvisBotTokenPresent: true,
      agentZeroBotTokenPresent: false,
      legacyTelegramTokenPresent: false,
      ownerTelegramTurnRoutesToAgentZero: true,
      voiceTransportAvailable: true,
    })

    expect(status.tony_in_path).toBe(false)
    expect(status.opencloud_in_path).toBe(false)
    expect(status.octm_in_path).toBe(false)
    expect(status.buildwiki_in_path).toBe(false)
    expect(status.farmer_in_path).toBe(false)
  })

  it('uses presence-only environment facts and does not expose values', () => {
    const facts = gatherTelegramJarvisRouteFacts({
      env: {},
      claudeclawEnv: {
        JARVIS_BOT_TOKEN: 'secret-token-value',
        TELEGRAM_BOT_TOKEN: 'legacy-secret-token',
        ELEVENLABS_API_KEY: 'eleven-secret',
        ELEVENLABS_VOICE_ID: 'voice-id',
        CLAUDECLAW_LEGACY_BRAIN_ENABLED: 'false',
      },
    })
    const status = buildTelegramJarvisRouteStatus(facts)

    expect(status.status).toBe('direct')
    expect(JSON.stringify(status)).not.toContain('secret-token-value')
    expect(JSON.stringify(status)).not.toContain('legacy-secret-token')
    expect(JSON.stringify(status)).not.toContain('eleven-secret')
  })
})
