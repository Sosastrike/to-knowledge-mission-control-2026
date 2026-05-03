export const AGENT_ZERO_DEFAULT_BASE_URL = 'http://100.116.35.95:50080'
export const AGENT_ZERO_API_KEY_ENV_NAMES = [
  'AGENT_ZERO_API_KEY',
  'AGENT_ZERO_EXTERNAL_API_KEY',
  'AGENT_ZERO_BRIDGE_API_KEY',
]

export type AgentZeroApiKeyState = {
  required: true
  present: boolean
  configured_env_name: string | null
  accepted_env_names: string[]
  redacted: string | null
}

export type AgentZeroRuntimeProbe = {
  base_url: string
  web_endpoint: string
  health_endpoint: string
  chat_endpoint: string
  reachable: boolean
  health_ok: boolean
  http_status: number | null
  latency_ms: number | null
  version: string | null
  commit_hash: string | null
  error: string | null
}

export type AgentZeroReadOnlyContext = {
  mission_control: {
    visible: true
    mode: 'read_only_bridge_context'
    execution_enabled: false
    writes_enabled: false
  }
  bridge: {
    providers: string[]
    provider_count: number
    mcp_visible: boolean
    zapier_visible: boolean
    heygen_visible: boolean
    heygen_schema_visible: boolean
  }
  restrictions: string[]
}

export type AgentZeroReadOnlyMessageResult = {
  ok: boolean
  status: number
  mode: 'agent_zero_read_only_test_chat'
  agent_zero_called: boolean
  execution_enabled: false
  writes_enabled: false
  blocker: string | null
  response_text: string | null
  context_id: string | null
  raw_response_shape: string[]
  error: string | null
}

type EnvLike = Record<string, string | undefined>

function normalizeBaseUrl(value?: string | null): string {
  const raw = (value || process.env.AGENT_ZERO_BASE_URL || AGENT_ZERO_DEFAULT_BASE_URL).trim()
  return raw.replace(/\/+$/, '')
}

export function getAgentZeroBaseUrl(): string {
  return normalizeBaseUrl()
}

function readAgentZeroApiKey(env: EnvLike = process.env): { name: string; value: string } | null {
  for (const name of AGENT_ZERO_API_KEY_ENV_NAMES) {
    const value = env[name]?.trim()
    if (value) return { name, value }
  }
  return null
}

export function getAgentZeroApiKeyState(env: EnvLike = process.env): AgentZeroApiKeyState {
  const key = readAgentZeroApiKey(env)
  return {
    required: true,
    present: Boolean(key),
    configured_env_name: key?.name || null,
    accepted_env_names: AGENT_ZERO_API_KEY_ENV_NAMES,
    redacted: key ? `${key.name}=<redacted>` : null,
  }
}

export async function probeAgentZeroRuntime(baseUrl = getAgentZeroBaseUrl()): Promise<AgentZeroRuntimeProbe> {
  const normalized = normalizeBaseUrl(baseUrl)
  const healthEndpoint = `${normalized}/api/health`
  const startedAt = Date.now()
  try {
    const response = await fetch(healthEndpoint, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    const text = await response.text()
    let payload: any = {}
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      payload = {}
    }
    return {
      base_url: normalized,
      web_endpoint: `${normalized}/`,
      health_endpoint: healthEndpoint,
      chat_endpoint: `${normalized}/api/api_message`,
      reachable: response.ok,
      health_ok: response.ok,
      http_status: response.status,
      latency_ms: Date.now() - startedAt,
      version: payload?.gitinfo?.version || payload?.gitinfo?.short_tag || null,
      commit_hash: payload?.gitinfo?.commit_hash || null,
      error: response.ok ? null : `agent_zero_health_http_${response.status}`,
    }
  } catch (error) {
    return {
      base_url: normalized,
      web_endpoint: `${normalized}/`,
      health_endpoint: healthEndpoint,
      chat_endpoint: `${normalized}/api/api_message`,
      reachable: false,
      health_ok: false,
      http_status: null,
      latency_ms: Date.now() - startedAt,
      version: null,
      commit_hash: null,
      error: error instanceof Error ? error.message : 'agent_zero_health_probe_failed',
    }
  }
}

export function buildAgentZeroReadOnlyContext(input: {
  providerIds?: string[]
  mcpVisible?: boolean
  zapierVisible?: boolean
  heygenVisible?: boolean
  heygenSchemaVisible?: boolean
} = {}): AgentZeroReadOnlyContext {
  const providers = Array.from(new Set((input.providerIds || []).filter(Boolean))).sort()
  return {
    mission_control: {
      visible: true,
      mode: 'read_only_bridge_context',
      execution_enabled: false,
      writes_enabled: false,
    },
    bridge: {
      providers,
      provider_count: providers.length,
      mcp_visible: Boolean(input.mcpVisible),
      zapier_visible: Boolean(input.zapierVisible),
      heygen_visible: Boolean(input.heygenVisible),
      heygen_schema_visible: Boolean(input.heygenSchemaVisible),
    },
    restrictions: [
      'read-only Mission Control context only',
      'no protected action execution',
      'no Zapier or HeyGen execution',
      'no SMB or farmer execution',
      'no Docker/config/auth/credential changes',
      'answer unknown when data is not visible through the provided context',
    ],
  }
}

export function buildAgentZeroReadOnlyPrompt(ownerMessage: string, context: AgentZeroReadOnlyContext): string {
  return [
    'You are Agent Zero in a Mission Control read-only ecosystem test.',
    'You may use only the JSON context below. Do not claim direct access beyond it.',
    'Execution is disabled. Do not run tools, request writes, or say that you executed anything.',
    'If the owner asks whether you can see Mission Control, answer yes only if this context is present.',
    '',
    `MISSION_CONTROL_READ_ONLY_CONTEXT=${JSON.stringify(context)}`,
    '',
    `OWNER_MESSAGE=${ownerMessage}`,
  ].join('\n')
}

function extractAgentZeroResponse(payload: unknown, fallbackText: string): { text: string | null; contextId: string | null; shape: string[] } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { text: fallbackText || null, contextId: null, shape: [] }
  }
  const record = payload as Record<string, unknown>
  const text = record.message || record.response || record.text || record.output || record.content
  const contextId = record.context_id || record.contextId
  return {
    text: typeof text === 'string' ? text : fallbackText || null,
    contextId: typeof contextId === 'string' ? contextId : null,
    shape: Object.keys(record).sort(),
  }
}

export async function sendAgentZeroReadOnlyMessage(input: {
  ownerMessage: string
  context: AgentZeroReadOnlyContext
  env?: EnvLike
  baseUrl?: string
}): Promise<AgentZeroReadOnlyMessageResult> {
  const key = readAgentZeroApiKey(input.env)
  if (!key) {
    return {
      ok: false,
      status: 503,
      mode: 'agent_zero_read_only_test_chat',
      agent_zero_called: false,
      execution_enabled: false,
      writes_enabled: false,
      blocker: 'agent_zero_external_api_key_missing',
      response_text: null,
      context_id: null,
      raw_response_shape: [],
      error: 'Agent Zero external API requires X-API-KEY; configure one of AGENT_ZERO_API_KEY, AGENT_ZERO_EXTERNAL_API_KEY, or AGENT_ZERO_BRIDGE_API_KEY without exposing the value.',
    }
  }

  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const endpoint = `${baseUrl}/api/api_message`
  const prompt = buildAgentZeroReadOnlyPrompt(input.ownerMessage, input.context)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(45000),
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': key.value,
      },
      body: JSON.stringify({
        context_id: 'mission-control-agent-zero-readonly',
        project_name: 'Mission Control read-only Agent Zero test',
        message: prompt,
        lifetime_hours: 2,
      }),
    })
    const text = await response.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }
    const extracted = extractAgentZeroResponse(payload, text)
    return {
      ok: response.ok,
      status: response.status,
      mode: 'agent_zero_read_only_test_chat',
      agent_zero_called: true,
      execution_enabled: false,
      writes_enabled: false,
      blocker: response.ok ? null : `agent_zero_api_http_${response.status}`,
      response_text: extracted.text,
      context_id: extracted.contextId,
      raw_response_shape: extracted.shape,
      error: response.ok ? null : (extracted.text || `Agent Zero API returned HTTP ${response.status}`).slice(0, 500),
    }
  } catch (error) {
    return {
      ok: false,
      status: 503,
      mode: 'agent_zero_read_only_test_chat',
      agent_zero_called: true,
      execution_enabled: false,
      writes_enabled: false,
      blocker: 'agent_zero_api_unreachable',
      response_text: null,
      context_id: null,
      raw_response_shape: [],
      error: error instanceof Error ? error.message : 'agent_zero_api_call_failed',
    }
  }
}
