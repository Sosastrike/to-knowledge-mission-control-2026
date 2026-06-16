import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

export type TelegramJarvisRouteStatus = {
  route: 'telegram_gateway_agent_zero'
  status: 'direct' | 'degraded'
  destination_agent: 'agent.zero'
  display_name: 'Jarvis'
  tony_in_path: boolean
  legacy_brain_in_path: boolean
  opencloud_in_path: boolean
  octm_in_path: boolean
  buildwiki_in_path: boolean
  farmer_in_path: boolean
  normal_chat_bridge_required: boolean
  external_actions_require_scope: boolean
  voice_transport: 'elevenlabs' | 'unavailable'
  blockers: string[]
  detail: {
    source_of_truth: 'claudeclaw_runtime_contract'
    telegram_bot: 'jarvis' | 'legacy' | 'missing'
    gateway_ingress: 'active'
    gateway_egress: 'active'
    claudeclaw_runtime_contract: 'available' | 'unavailable'
    source_agent: 'agent.zero'
    telegram: 'active' | 'missing_bot_token'
    commander_token_source: 'AGENT_ZERO_BOT_TOKEN' | 'JARVIS_BOT_TOKEN' | 'TELEGRAM_BOT_TOKEN_LEGACY' | 'missing'
    external_action_approval_required: true
    normal_chat_transport_only: true
    credential_values_exposed: false
    tokens_exposed: false
    env_values_exposed: false
  }
}

export type TelegramJarvisRouteFacts = {
  legacyBrainEnabled: boolean
  dedicatedJarvisBotTokenPresent: boolean
  agentZeroBotTokenPresent: boolean
  legacyTelegramTokenPresent: boolean
  ownerTelegramTurnRoutesToAgentZero: boolean
  voiceTransportAvailable: boolean
  claudeClawRuntimeAvailable: boolean
}

const DEFAULT_CLAUDECLAW_ENV_PATH = '/home/tony/claudeclaw/.env'
const DEFAULT_CLAUDECLAW_PROCESS_PATTERN = '/home/tony/claudeclaw/dist/index.js'

function parseEnvText(text: string): Record<string, string> {
  const entries: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    entries[match[1]] = value
  }
  return entries
}

export function readClaudeClawEnvForRouteFacts(envPath = DEFAULT_CLAUDECLAW_ENV_PATH): Record<string, string> {
  try {
    return parseEnvText(fs.readFileSync(envPath, 'utf8'))
  } catch {
    return {}
  }
}

function boolFrom(value: unknown): boolean {
  return String(value || '').toLowerCase() === 'true'
}

function present(...values: unknown[]): boolean {
  return values.some((value) => typeof value === 'string' && value.trim().length > 0)
}

function commandSucceeds(command: string, args: string[]): boolean {
  try {
    execFileSync(command, args, {
      stdio: 'ignore',
      timeout: 2000,
    })
    return true
  } catch {
    return false
  }
}

export function detectClaudeClawRuntimeAvailable(): boolean {
  if (commandSucceeds('systemctl', ['--user', 'is-active', '--quiet', 'claudeclaw.service'])) return true
  return commandSucceeds('pgrep', ['-f', DEFAULT_CLAUDECLAW_PROCESS_PATTERN])
}

export function gatherTelegramJarvisRouteFacts(input?: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
  claudeclawEnv?: Record<string, string | undefined>
  claudeClawRuntimeAvailable?: boolean
}): TelegramJarvisRouteFacts {
  const env = input?.env ?? process.env
  const claudeclawEnv = input?.claudeclawEnv ?? readClaudeClawEnvForRouteFacts()
  const legacyBrainEnabled = boolFrom(env.CLAUDECLAW_LEGACY_BRAIN_ENABLED ?? claudeclawEnv.CLAUDECLAW_LEGACY_BRAIN_ENABLED)
  const dedicatedJarvisBotTokenPresent = present(env.JARVIS_BOT_TOKEN, claudeclawEnv.JARVIS_BOT_TOKEN)
  const agentZeroBotTokenPresent = present(env.AGENT_ZERO_BOT_TOKEN, claudeclawEnv.AGENT_ZERO_BOT_TOKEN)
  const legacyTelegramTokenPresent = present(env.TELEGRAM_BOT_TOKEN, claudeclawEnv.TELEGRAM_BOT_TOKEN)

  return {
    legacyBrainEnabled,
    dedicatedJarvisBotTokenPresent,
    agentZeroBotTokenPresent,
    legacyTelegramTokenPresent,
    ownerTelegramTurnRoutesToAgentZero: !legacyBrainEnabled,
    voiceTransportAvailable: present(env.ELEVENLABS_API_KEY, claudeclawEnv.ELEVENLABS_API_KEY) &&
      present(env.ELEVENLABS_VOICE_ID, claudeclawEnv.ELEVENLABS_VOICE_ID),
    claudeClawRuntimeAvailable: input?.claudeClawRuntimeAvailable ?? detectClaudeClawRuntimeAvailable(),
  }
}

function tokenSource(facts: TelegramJarvisRouteFacts): TelegramJarvisRouteStatus['detail']['commander_token_source'] {
  if (facts.agentZeroBotTokenPresent) return 'AGENT_ZERO_BOT_TOKEN'
  if (facts.dedicatedJarvisBotTokenPresent) return 'JARVIS_BOT_TOKEN'
  if (facts.legacyTelegramTokenPresent) return 'TELEGRAM_BOT_TOKEN_LEGACY'
  return 'missing'
}

export function buildTelegramJarvisRouteStatus(
  facts: TelegramJarvisRouteFacts = gatherTelegramJarvisRouteFacts(),
): TelegramJarvisRouteStatus {
  const source = tokenSource(facts)
  const blockers: string[] = []

  if (facts.legacyBrainEnabled) blockers.push('legacy_brain_enabled')
  if (!facts.ownerTelegramTurnRoutesToAgentZero) blockers.push('owner_telegram_turn_not_routed_to_agent_zero')
  if (source === 'TELEGRAM_BOT_TOKEN_LEGACY') blockers.push('jarvis_bot_token_not_dedicated')
  if (source === 'missing') blockers.push('jarvis_bot_token_missing')
  if (!facts.voiceTransportAvailable) blockers.push('elevenlabs_voice_transport_unavailable')
  if (!facts.claudeClawRuntimeAvailable) blockers.push('claudeclaw_runtime_contract_unavailable')

  const direct = blockers.length === 0

  return {
    route: 'telegram_gateway_agent_zero',
    status: direct ? 'direct' : 'degraded',
    destination_agent: 'agent.zero',
    display_name: 'Jarvis',
    tony_in_path: facts.legacyBrainEnabled,
    legacy_brain_in_path: facts.legacyBrainEnabled,
    opencloud_in_path: false,
    octm_in_path: false,
    buildwiki_in_path: false,
    farmer_in_path: false,
    normal_chat_bridge_required: false,
    external_actions_require_scope: true,
    voice_transport: facts.voiceTransportAvailable ? 'elevenlabs' : 'unavailable',
    blockers,
    detail: {
      source_of_truth: 'claudeclaw_runtime_contract',
      telegram_bot: source === 'missing' ? 'missing' : source === 'TELEGRAM_BOT_TOKEN_LEGACY' ? 'legacy' : 'jarvis',
      gateway_ingress: 'active',
      gateway_egress: 'active',
      claudeclaw_runtime_contract: facts.claudeClawRuntimeAvailable ? 'available' : 'unavailable',
      source_agent: 'agent.zero',
      telegram: source === 'missing' ? 'missing_bot_token' : 'active',
      commander_token_source: source,
      external_action_approval_required: true,
      normal_chat_transport_only: true,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    },
  }
}
