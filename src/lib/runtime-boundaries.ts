import { existsSync, readFileSync } from 'node:fs'

export const AGENT_ZERO_TELEGRAM_CONFIG_PATH =
  process.env.AGENT_ZERO_TELEGRAM_CONFIG_PATH ||
  '/home/tony/agent-zero-deploy/data/usr/plugins/_telegram_integration/config.json'

export type AgentZeroNativeTelegramStatus = {
  config_present: boolean
  jarvis_bot_configured: boolean
  jarvis_bot_enabled: boolean
  jarvis_token_present: boolean
  jarvis_polling_enabled: boolean
  paperclip_concierge_enabled: boolean
  allowed_user_count: number
  token_value_exposed: false
}

export type RuntimeBoundaryTelegramStatus = {
  desired_bot_username: '@Jarvis_88sbot'
  legacy_fallback_username: '@Tony_MC88_bot'
  active_token_source_variable:
    | 'AGENT_ZERO_NATIVE_TELEGRAM_PLUGIN_CONFIG'
    | 'AGENT_ZERO_BOT_TOKEN'
    | 'JARVIS_BOT_TOKEN'
    | 'TELEGRAM_BOT_TOKEN_LEGACY'
    | 'none'
  active_runtime_owner: 'agent_zero_native_runtime' | 'mission_control_env' | 'legacy_fallback' | 'missing'
  active_bot_identity_status:
    | 'agent_zero_native_telegram_plugin_active'
    | 'dedicated_jarvis_env_token_configured'
    | 'legacy_tony_fallback_active'
    | 'telegram_token_missing'
  dedicated_jarvis_token_present: boolean
  native_agent_zero_jarvis_bot: AgentZeroNativeTelegramStatus
  tony_legacy_fallback_present: boolean
  credential_required: 'JARVIS_BOT_TOKEN' | null
  identity_statement: string
  openclaw_relationship: string
  credential_values_exposed: false
}

export type RuntimeBoundaryPacket = {
  runtime_boundaries: {
    agent_zero_jarvis: {
      type: 'agent_runtime'
      role: 'mission_control_owner_operator'
      identity: 'Agent Zero / Jarvis'
      telegram_identity: '@Jarvis_88sbot'
      execution_route: '/api/bridge/agent-zero/execute'
      runtime_owner: 'agent-zero Docker container / Agent Zero data runtime'
      is_openclaw: false
      uses_openclaw_as_identity: false
      self_report_wording: string
    }
    openclaw_plus: {
      type: 'supporting_runtime_system'
      role: 'gateway_shared_runtime'
      is_agent_zero: false
      is_jarvis: false
      is_telegram_identity: false
      can_be_used_as_tool_provider_only: true
    }
    paperclip: {
      type: 'company_workforce_system'
      company_scope: 'ECO'
      writes_policy: 'exact_scope_adapter_required'
    }
    pi: {
      type: 'dispatcher_advisory_agent'
      execution_policy: 'recommend_only_until_certified'
    }
    hermes: {
      type: 'separate_agent_or_provider_runtime'
      source: 'canonical registry only'
    }
    space_agent: {
      type: 'separate_mission_control_agent'
      source: 'canonical registry only'
    }
    tony_mc: {
      type: 'legacy_telegram_fallback'
      active_only_if: 'JARVIS_BOT_TOKEN and Agent Zero native Jarvis bot are missing'
    }
    claudeclaw: {
      type: 'non_jarvis_runtime'
      role: 'diagnostics_or_runtime_support_only_when_explicitly_assigned'
      is_agent_zero: false
      is_jarvis: false
      is_telegram_identity: false
    }
  }
  telegram_identity: RuntimeBoundaryTelegramStatus
  canonical_self_report: string
  regression_guards: string[]
  credential_values_exposed: false
}

const CANONICAL_SELF_REPORT =
  'I am Agent Zero / Jarvis. OpenClaw+ is a supporting Gateway/runtime layer, not my identity. I execute certified Mission Control actions through /api/bridge/agent-zero/execute. I do not live inside OpenClaw.'

function safeReadJson(path: string): unknown {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function inspectAgentZeroNativeTelegramConfig(path = AGENT_ZERO_TELEGRAM_CONFIG_PATH): AgentZeroNativeTelegramStatus {
  const data = asRecord(safeReadJson(path))
  const bots = Array.isArray(data.bots) ? data.bots.map(asRecord) : []
  const jarvis = bots.find((bot) => String(bot.name || '').toLowerCase() === 'jarvis') || null
  const paperclip = bots.find((bot) => String(bot.name || '').toLowerCase() === 'paperclip concierge') || null

  return {
    config_present: bots.length > 0,
    jarvis_bot_configured: Boolean(jarvis),
    jarvis_bot_enabled: jarvis ? jarvis.enabled === true : false,
    jarvis_token_present: jarvis ? typeof jarvis.token === 'string' && jarvis.token.length > 0 : false,
    jarvis_polling_enabled: jarvis ? String(jarvis.mode || '').toLowerCase() === 'polling' : false,
    paperclip_concierge_enabled: paperclip ? paperclip.enabled === true : false,
    allowed_user_count: jarvis && Array.isArray(jarvis.allowed_users) ? jarvis.allowed_users.length : 0,
    token_value_exposed: false,
  }
}

export function buildRuntimeBoundaryTelegramStatus(): RuntimeBoundaryTelegramStatus {
  const native = inspectAgentZeroNativeTelegramConfig()
  const agentZeroTokenPresent = Boolean(process.env.AGENT_ZERO_BOT_TOKEN)
  const jarvisTokenPresent = Boolean(process.env.JARVIS_BOT_TOKEN)
  const legacyTonyTokenPresent = Boolean(process.env.TELEGRAM_BOT_TOKEN)
  const nativeJarvisActive = native.jarvis_bot_configured && native.jarvis_bot_enabled && native.jarvis_token_present
  const dedicatedEnvTokenPresent = agentZeroTokenPresent || jarvisTokenPresent
  const dedicatedJarvisTokenPresent = nativeJarvisActive || dedicatedEnvTokenPresent
  const activeTokenSource = nativeJarvisActive
    ? 'AGENT_ZERO_NATIVE_TELEGRAM_PLUGIN_CONFIG'
    : agentZeroTokenPresent
      ? 'AGENT_ZERO_BOT_TOKEN'
      : jarvisTokenPresent
        ? 'JARVIS_BOT_TOKEN'
        : legacyTonyTokenPresent
          ? 'TELEGRAM_BOT_TOKEN_LEGACY'
          : 'none'

  return {
    desired_bot_username: '@Jarvis_88sbot',
    legacy_fallback_username: '@Tony_MC88_bot',
    active_token_source_variable: activeTokenSource,
    active_runtime_owner: nativeJarvisActive
      ? 'agent_zero_native_runtime'
      : dedicatedEnvTokenPresent
        ? 'mission_control_env'
        : legacyTonyTokenPresent
          ? 'legacy_fallback'
          : 'missing',
    active_bot_identity_status: nativeJarvisActive
      ? 'agent_zero_native_telegram_plugin_active'
      : dedicatedEnvTokenPresent
        ? 'dedicated_jarvis_env_token_configured'
        : legacyTonyTokenPresent
          ? 'legacy_tony_fallback_active'
          : 'telegram_token_missing',
    dedicated_jarvis_token_present: dedicatedJarvisTokenPresent,
    native_agent_zero_jarvis_bot: native,
    tony_legacy_fallback_present: legacyTonyTokenPresent,
    credential_required: dedicatedJarvisTokenPresent ? null : 'JARVIS_BOT_TOKEN',
    identity_statement: nativeJarvisActive
      ? '@Jarvis_88sbot is owned by the native Agent Zero Telegram plugin. OpenClaw and ClaudeClaw must not answer as Jarvis.'
      : dedicatedEnvTokenPresent
        ? '@Jarvis_88sbot is configured by a dedicated Agent Zero/Jarvis token source. Confirm username with Telegram getMe before claiming live cutover.'
        : '@Jarvis_88sbot is not active until the Agent Zero native plugin or AGENT_ZERO_BOT_TOKEN/JARVIS_BOT_TOKEN is present. Tony MC remains a legacy fallback only.',
    openclaw_relationship: 'OpenClaw+ is a Gateway/shared runtime layer, not Agent Zero/Jarvis and not the Jarvis Telegram identity.',
    credential_values_exposed: false,
  }
}

export function buildRuntimeBoundaryPacket(): RuntimeBoundaryPacket {
  return {
    runtime_boundaries: {
      agent_zero_jarvis: {
        type: 'agent_runtime',
        role: 'mission_control_owner_operator',
        identity: 'Agent Zero / Jarvis',
        telegram_identity: '@Jarvis_88sbot',
        execution_route: '/api/bridge/agent-zero/execute',
        runtime_owner: 'agent-zero Docker container / Agent Zero data runtime',
        is_openclaw: false,
        uses_openclaw_as_identity: false,
        self_report_wording: CANONICAL_SELF_REPORT,
      },
      openclaw_plus: {
        type: 'supporting_runtime_system',
        role: 'gateway_shared_runtime',
        is_agent_zero: false,
        is_jarvis: false,
        is_telegram_identity: false,
        can_be_used_as_tool_provider_only: true,
      },
      paperclip: {
        type: 'company_workforce_system',
        company_scope: 'ECO',
        writes_policy: 'exact_scope_adapter_required',
      },
      pi: {
        type: 'dispatcher_advisory_agent',
        execution_policy: 'recommend_only_until_certified',
      },
      hermes: {
        type: 'separate_agent_or_provider_runtime',
        source: 'canonical registry only',
      },
      space_agent: {
        type: 'separate_mission_control_agent',
        source: 'canonical registry only',
      },
      tony_mc: {
        type: 'legacy_telegram_fallback',
        active_only_if: 'JARVIS_BOT_TOKEN and Agent Zero native Jarvis bot are missing',
      },
      claudeclaw: {
        type: 'non_jarvis_runtime',
        role: 'diagnostics_or_runtime_support_only_when_explicitly_assigned',
        is_agent_zero: false,
        is_jarvis: false,
        is_telegram_identity: false,
      },
    },
    telegram_identity: buildRuntimeBoundaryTelegramStatus(),
    canonical_self_report: CANONICAL_SELF_REPORT,
    regression_guards: [
      'OpenClaw+ must never appear as Agent Zero.',
      'OpenClaw+ must never appear as Jarvis.',
      'OpenClaw+ must never be reported as the Telegram identity.',
      'Developer/Researcher/Hacker profiles must remain local Agent Zero profiles, not Mission Control agents.',
      'Jarvis execution must route through /api/bridge/agent-zero/execute.',
      'Jarvis must not say no access when the live Bridge Session route reports an active exact-scope session.',
      'Jarvis must not report OpenClaw as his brain.',
    ],
    credential_values_exposed: false,
  }
}

export function buildRuntimeBoundarySummary() {
  const packet = buildRuntimeBoundaryPacket()
  return {
    agent_zero_identity: packet.runtime_boundaries.agent_zero_jarvis.identity,
    agent_zero_execution_route: packet.runtime_boundaries.agent_zero_jarvis.execution_route,
    openclaw_role: packet.runtime_boundaries.openclaw_plus.role,
    openclaw_is_jarvis: packet.runtime_boundaries.openclaw_plus.is_jarvis,
    openclaw_is_agent_zero: packet.runtime_boundaries.openclaw_plus.is_agent_zero,
    telegram_identity: packet.telegram_identity,
    canonical_self_report: packet.canonical_self_report,
    credential_values_exposed: false,
  }
}
