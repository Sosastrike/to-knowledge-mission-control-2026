import fs from 'node:fs'
import path from 'node:path'

export const AGENT_ZERO_DEFAULT_BASE_URL = 'http://100.116.35.95:50080'
export const AGENT_ZERO_API_KEY_ENV_NAMES = [
  'AGENT_ZERO_API_KEY',
  'AGENT_ZERO_EXTERNAL_API_KEY',
  'AGENT_ZERO_BRIDGE_API_KEY',
]
export const AGENT_ZERO_API_KEY_FILE_ENV_NAME = 'AGENT_ZERO_API_KEY_FILE'
export const AGENT_ZERO_DEFAULT_API_KEY_FILE =
  '/home/tony/.config/mission-control/secrets/agent-zero-api-key'
export const AGENT_ZERO_SYSTEMD_CREDENTIAL_NAMES = [
  'agent-zero-api-key',
  'AGENT_ZERO_API_KEY',
  'agent_zero_api_key',
]

export type AgentZeroApiKeyState = {
  required: true
  present: boolean
  configured_env_name: string | null
  source_type: 'environment' | 'secret_file' | 'systemd_credential' | 'missing'
  source_path: string | null
  accepted_env_names: string[]
  accepted_file_env_name: string
  accepted_systemd_credential_names: string[]
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
    surfaces: string[]
  }
  bridge: {
    providers: string[]
    provider_count: number
    mcp_visible: boolean
    zapier_visible: boolean
    heygen_visible: boolean
    heygen_schema_visible: boolean
    mcp_servers: string[]
    mcp_tools_visible: boolean
  }
  agents: {
    visible: true
    items: Array<{
      id: string
      status: string
      role: string
      execution_enabled: boolean
    }>
  }
  models: {
    visible: true
    total: number
    providers: string[]
    catalog: Array<{
      alias: string
      provider: string
      name: string
    }>
  }
  skills: {
    visible: boolean
    total: number
    sample: string[]
    writes_enabled: false
  }
  tools: {
    visible: boolean
    zapier_tools_total: number
    google_drive_visible: boolean
    onedrive_visible: boolean
    heygen_schema_visible: boolean
    execution_enabled: false
    writes_enabled: false
  }
  integrations: {
    visible: true
    items: Array<{
      id: string
      status: string
      visibility: 'configured' | 'visible' | 'blocked' | 'unknown'
      execution_enabled: boolean
      writes_enabled: boolean
    }>
  }
  brain: {
    visible: boolean
    sources: Array<{
      source: string
      status: string
      summary: string
    }>
    obsidian_visible: boolean
    mempalace_visible: boolean
    graphify_visible: boolean
    memory_writes_enabled: false
  }
  opencloud_buildwiki: {
    direct_opencloud_access_visible: boolean
    build_wiki_status_visible: boolean
    farmer_service: string
    farmer_timer: string
    timer_active: boolean | null
    latest_run_state: string | null
    farmer_execution_enabled: false
    note: string
  }
  delivery: {
    telegram_reports_visible: boolean
    mission_control_reports_visible: boolean
    google_drive_delivery_visible: boolean
    onedrive_delivery_visible: boolean
    external_delivery_writes_enabled: false
  }
  bridge_session: {
    available: boolean
    status: 'read_only_context_active' | 'owner_approval_required' | 'blocked'
    execution_enabled: false
    writes_enabled: false
    allowed_scopes: string[]
    blocked_scopes: string[]
    note: string
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
type KeySource = {
  name: string
  value: string
  sourceType: AgentZeroApiKeyState['source_type']
  sourcePath: string | null
}

function normalizeBaseUrl(value?: string | null): string {
  const raw = (value || process.env.AGENT_ZERO_BASE_URL || AGENT_ZERO_DEFAULT_BASE_URL).trim()
  return raw.replace(/\/+$/, '')
}

export function getAgentZeroBaseUrl(): string {
  return normalizeBaseUrl()
}

function safeReadSecretFile(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return null
    const value = fs.readFileSync(filePath, 'utf8').trim()
    return value || null
  } catch {
    return null
  }
}

function systemdCredentialCandidates(env: EnvLike): string[] {
  const dir = env.CREDENTIALS_DIRECTORY
  if (!dir) return []
  return AGENT_ZERO_SYSTEMD_CREDENTIAL_NAMES.map((name) => path.join(dir, name))
}

function secretFileCandidates(env: EnvLike, includeDefaults: boolean): string[] {
  const candidates = [
    env[AGENT_ZERO_API_KEY_FILE_ENV_NAME],
    ...systemdCredentialCandidates(env),
    ...(includeDefaults ? [AGENT_ZERO_DEFAULT_API_KEY_FILE] : []),
  ].filter((value): value is string => Boolean(value && value.trim()))

  return Array.from(new Set(candidates))
}

function readAgentZeroApiKey(env: EnvLike = process.env): KeySource | null {
  for (const name of AGENT_ZERO_API_KEY_ENV_NAMES) {
    const value = env[name]?.trim()
    if (value) return { name, value, sourceType: 'environment', sourcePath: null }
  }

  const includeDefaultFile = env === process.env
  for (const filePath of secretFileCandidates(env, includeDefaultFile)) {
    const value = safeReadSecretFile(filePath)
    if (value) {
      const isSystemdCredential = Boolean(env.CREDENTIALS_DIRECTORY && filePath.startsWith(`${env.CREDENTIALS_DIRECTORY}/`))
      return {
        name: isSystemdCredential ? 'systemd_credential' : AGENT_ZERO_API_KEY_FILE_ENV_NAME,
        value,
        sourceType: isSystemdCredential ? 'systemd_credential' : 'secret_file',
        sourcePath: filePath,
      }
    }
  }
  return null
}

export function getAgentZeroApiKeyState(env: EnvLike = process.env): AgentZeroApiKeyState {
  const key = readAgentZeroApiKey(env)
  return {
    required: true,
    present: Boolean(key),
    configured_env_name: key?.name || null,
    source_type: key?.sourceType || 'missing',
    source_path: key?.sourcePath || null,
    accepted_env_names: AGENT_ZERO_API_KEY_ENV_NAMES,
    accepted_file_env_name: AGENT_ZERO_API_KEY_FILE_ENV_NAME,
    accepted_systemd_credential_names: AGENT_ZERO_SYSTEMD_CREDENTIAL_NAMES,
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
  agents?: Array<{ id: string; status?: string; role?: string; execution_enabled?: boolean }>
  modelCatalog?: Array<{ alias: string; provider: string; name: string }>
  skillNames?: string[]
  integrationItems?: Array<{ id: string; status?: string; visibility?: 'configured' | 'visible' | 'blocked' | 'unknown'; execution_enabled?: boolean; writes_enabled?: boolean }>
  mcpServers?: string[]
  mcpVisible?: boolean
  zapierVisible?: boolean
  zapierToolsTotal?: number
  googleDriveVisible?: boolean
  oneDriveVisible?: boolean
  heygenVisible?: boolean
  heygenSchemaVisible?: boolean
  brainSources?: Array<{ source?: string; status?: string; raw_state?: string; summary?: string }>
  timerActive?: boolean | null
  latestBuildWikiRunState?: string | null
  bridgeSessionAvailable?: boolean
} = {}): AgentZeroReadOnlyContext {
  const providers = Array.from(new Set((input.providerIds || []).filter(Boolean))).sort()
  const modelCatalog = (input.modelCatalog || []).slice(0, 40)
  const modelProviders = Array.from(new Set(modelCatalog.map((model) => model.provider).filter(Boolean))).sort()
  const skillNames = Array.from(new Set((input.skillNames || []).filter(Boolean))).sort()
  const agents = (input.agents || []).map((agent) => ({
    id: agent.id,
    status: agent.status || 'unknown',
    role: agent.role || 'ecosystem agent',
    execution_enabled: Boolean(agent.execution_enabled),
  }))
  const integrations = (input.integrationItems || []).map((integration) => ({
    id: integration.id,
    status: integration.status || 'unknown',
    visibility: integration.visibility || 'unknown',
    execution_enabled: Boolean(integration.execution_enabled),
    writes_enabled: Boolean(integration.writes_enabled),
  }))
  const brainSources = (input.brainSources || []).map((source) => ({
    source: String(source.source || 'unknown'),
    status: String(source.status || source.raw_state || 'unknown'),
    summary: String(source.summary || ''),
  }))
  const mcpServers = Array.from(new Set((input.mcpServers || []).filter(Boolean))).sort()
  return {
    mission_control: {
      visible: true,
      mode: 'read_only_bridge_context',
      execution_enabled: false,
      writes_enabled: false,
      surfaces: [
        '/api/bridge/agent-zero/status',
        '/api/bridge/agent-zero/test-chat',
        '/api/bridge/agent-zero/ecosystem',
        '/api/bridge/providers',
        '/api/bridge/preflight',
        '/api/mcp/list',
        '/api/bridge/brain-sync/status',
        '/api/bridge/brain-context',
      ],
    },
    bridge: {
      providers,
      provider_count: providers.length,
      mcp_visible: Boolean(input.mcpVisible),
      zapier_visible: Boolean(input.zapierVisible),
      heygen_visible: Boolean(input.heygenVisible),
      heygen_schema_visible: Boolean(input.heygenSchemaVisible),
      mcp_servers: mcpServers,
      mcp_tools_visible: Boolean(input.mcpVisible || input.zapierVisible || input.heygenVisible),
    },
    agents: {
      visible: true,
      items: agents,
    },
    models: {
      visible: true,
      total: modelCatalog.length,
      providers: modelProviders,
      catalog: modelCatalog.map((model) => ({
        alias: model.alias,
        provider: model.provider,
        name: model.name,
      })),
    },
    skills: {
      visible: skillNames.length > 0,
      total: skillNames.length,
      sample: skillNames.slice(0, 25),
      writes_enabled: false,
    },
    tools: {
      visible: Boolean(input.mcpVisible || input.zapierVisible || input.heygenVisible || input.zapierToolsTotal),
      zapier_tools_total: Number(input.zapierToolsTotal || 0),
      google_drive_visible: Boolean(input.googleDriveVisible),
      onedrive_visible: Boolean(input.oneDriveVisible),
      heygen_schema_visible: Boolean(input.heygenSchemaVisible),
      execution_enabled: false,
      writes_enabled: false,
    },
    integrations: {
      visible: true,
      items: integrations,
    },
    brain: {
      visible: brainSources.length > 0,
      sources: brainSources,
      obsidian_visible: brainSources.some((source) => source.source.toLowerCase() === 'obsidian' && source.status !== 'not_connected'),
      mempalace_visible: brainSources.some((source) => source.source.toLowerCase() === 'mempalace' && source.status !== 'not_connected'),
      graphify_visible: brainSources.some((source) => source.source.toLowerCase() === 'graphify' && source.status !== 'not_connected'),
      memory_writes_enabled: false,
    },
    opencloud_buildwiki: {
      direct_opencloud_access_visible: false,
      build_wiki_status_visible: true,
      farmer_service: 'opencloud-docs-farmer.service',
      farmer_timer: 'opencloud-docs-farmer.timer',
      timer_active: typeof input.timerActive === 'boolean' ? input.timerActive : null,
      latest_run_state: input.latestBuildWikiRunState || null,
      farmer_execution_enabled: false,
      note: 'Mission Control exposes Build-Wiki/Farmer status read-only; this does not grant direct OpenCloud file access or permission to run the farmer.',
    },
    delivery: {
      telegram_reports_visible: true,
      mission_control_reports_visible: true,
      google_drive_delivery_visible: Boolean(input.googleDriveVisible),
      onedrive_delivery_visible: Boolean(input.oneDriveVisible),
      external_delivery_writes_enabled: false,
    },
    bridge_session: {
      available: Boolean(input.bridgeSessionAvailable),
      status: input.bridgeSessionAvailable ? 'owner_approval_required' : 'read_only_context_active',
      execution_enabled: false,
      writes_enabled: false,
      allowed_scopes: input.bridgeSessionAvailable
        ? ['read_only.ecosystem_context', 'review.recommendation', 'buildwiki.run_now.after_owner_approval']
        : ['read_only.ecosystem_context', 'review.recommendation'],
      blocked_scopes: [
        'broad_shell',
        'docker_socket',
        'zapier.write_without_bridge_session',
        'heygen.generate_without_bridge_session',
        'smb.mount_without_smb_phase',
        'memory.write_without_owner_approval',
      ],
      note: 'Agent Zero may see ecosystem context and recommend actions. Execution remains locked until a separately approved Bridge Session and a scoped adapter exist.',
    },
    restrictions: [
      'read-only Mission Control ecosystem context unless a scoped Bridge Session is separately approved',
      'no protected action execution from test-chat',
      'no Zapier or HeyGen execution from test-chat',
      'no SMB or farmer execution from test-chat',
      'no broad shell, Docker socket, root/system, credential, or auth bypass access',
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
    'Bridge Session execution is not active in this chat. If execution is requested, explain that a separate owner-approved Bridge Session and scoped adapter are required.',
    'Do not enumerate your internal Agent Zero tools unless they are present in the JSON context.',
    'For tools, models, agents, integrations, skills, OpenCloud, or Build-Wiki, report only what the JSON context explicitly shows.',
    'If a category is not present in the JSON context, say it is not visible through the Mission Control bridge.',
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
      error: 'Agent Zero external API requires X-API-KEY; configure a Mission Control environment variable, systemd credential, or secret file without exposing the value.',
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
