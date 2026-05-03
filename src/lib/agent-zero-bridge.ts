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

export type AgentZeroEcosystemAgentState = 'connected' | 'degraded' | 'offline'

export type AgentZeroEcosystemAgentRecord = {
  id: 'agent_zero'
  name: 'Agent Zero'
  category: 'agent'
  status: AgentZeroEcosystemAgentState
  state: AgentZeroEcosystemAgentState
  mode: 'read_only'
  execution_enabled: false
  writes_enabled: false
  bridge_session_required: true
  health_url: 'configured'
  chat_route: '/api/bridge/agent-zero/test-chat'
  capabilities_source: 'mission_control_context'
  health_status: 'healthy' | 'unreachable'
  auth_status: 'configured' | 'missing'
  chat_status: 'working' | 'blocked' | 'not_checked'
  agent_zero_called: boolean
  last_checked: number
  last_checked_at: string
  detail: {
    endpoint: string
    health_endpoint: string
    chat_endpoint: string
    health_http_status: number | null
    health_latency_ms: number | null
    version: string | null
    commit_hash: string | null
    api_key_configured: boolean
    test_chat_endpoint: '/api/bridge/agent-zero/test-chat'
    ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem'
    bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session'
    capabilities_source: 'mission_control_context'
    mode: 'read_only'
    execution_enabled: false
    bridge_session_required: true
    direct_access: false
    proxy_access: true
    blocker: string | null
    notes: string
    error: string | null
  }
  next_action: string
}

export type EcosystemAccessState =
  | 'connected'
  | 'configured'
  | 'visible'
  | 'blocked'
  | 'not_connected'
  | 'unknown'

export type AgentZeroReadOnlyEndpointSummary = {
  endpoint: string
  method: 'GET'
  mcp_server_name: string | null
  status: EcosystemAccessState
  reachable: boolean
  tool_count: number | null
  schema_available: boolean
  execution_enabled: false
  bridge_session_required: true
  blocked_reason: string | null
  note: string
}

export type AgentZeroModelProviderStatus = 'connected' | 'configured' | 'blocked'

export type AgentZeroModelProviderSummary = {
  id: string
  name: string
  status: AgentZeroModelProviderStatus
  credential_present: boolean
  credential_names: string[]
  credential_values_exposed: false
  model_count: number
  models: string[]
  best_use_case: string
  execution_mode: string
  execution_enabled: false
  bridge_session_required: true
  direct_access: false
  proxy_access: true
  blocked_reason: string | null
}

export type AgentZeroSkillSafeMode = 'metadata_only' | 'blocked'

export type AgentZeroSkillRegistryItem = {
  name: string
  source: 'agent_zero' | 'claudeclaw_tony' | 'mission_control_repo' | 'home_claude' | 'database'
  source_label: string
  description: string
  dependencies: string[]
  missing_dependencies: string[]
  blocked_dependencies: string[]
  safe_mode: AgentZeroSkillSafeMode
  status: EcosystemAccessState
  execution_enabled: false
  writes_enabled: false
  direct_access: false
  proxy_access: true
  blocked_reason: string | null
}

export type AgentZeroSkillSourceSummary = {
  source: AgentZeroSkillRegistryItem['source']
  label: string
  status: EcosystemAccessState
  total: number
  safe_mode: AgentZeroSkillSafeMode
  blocked_reason: string | null
}

export type AgentZeroReadOnlyContext = {
  execution_enabled: false
  bridge_session_required: true
  mission_control: {
    visible: true
    status: EcosystemAccessState
    mode: 'read_only_bridge_context'
    execution_enabled: false
    writes_enabled: false
    direct_access: false
    proxy_access: true
    auth_required: true
    surfaces: string[]
  }
  bridge: {
    providers: string[]
    provider_count: number
    provider_registry: Array<{
      id: string
      name: string
      state: string
      category: string
      access: EcosystemAccessState
      execution_enabled: boolean
      direct_access: boolean
      proxy_access: boolean
    }>
    mcp_visible: boolean
    zapier_visible: boolean
    heygen_visible: boolean
    heygen_schema_visible: boolean
    mcp_servers: string[]
    mcp_tools_visible: boolean
  }
  mcp: {
    visible: boolean
    status: EcosystemAccessState
    servers: Array<{
      name: string
      status: string
      transport: string
      tool_count: number | null
      access: EcosystemAccessState
      reachable: boolean
      schema_available: boolean
      execution_enabled: false
      bridge_session_required: true
      blocked_reason: string | null
      tools_endpoint: string
    }>
    endpoint_summaries: AgentZeroReadOnlyEndpointSummary[]
    tool_schema_summary: {
      tools_total: number
      schema_available: boolean
      required_fields: string[]
      write_tools_total: number
      read_tools_total: number
    }
    execution_enabled: false
    writes_enabled: false
    direct_tool_execution_enabled: false
  }
  agents: {
    visible: true
    registry_status: EcosystemAccessState
    items: Array<{
      id: string
      status: string
      role: string
      execution_enabled: boolean
      direct_access: boolean
      proxy_access: boolean
    }>
  }
  models: {
    visible: true
    registry_status: EcosystemAccessState
    total: number
    providers: string[]
    catalog: Array<{
      alias: string
      provider: string
      name: string
    }>
    provider_registry: AgentZeroModelProviderSummary[]
    openrouter_status: EcosystemAccessState
    execution_enabled: false
    bridge_session_required: true
    credential_values_exposed: false
  }
  skills: {
    visible: boolean
    registry_status: EcosystemAccessState
    total: number
    sample: string[]
    sources: AgentZeroSkillSourceSummary[]
    registry: AgentZeroSkillRegistryItem[]
    blocked_total: number
    missing_dependencies_total: number
    execution_enabled: false
    bridge_session_required: true
    writes_enabled: false
  }
  tools: {
    visible: boolean
    registry_status: EcosystemAccessState
    registry: Array<{
      id: string
      status: EcosystemAccessState
      source: string
      direct_access: boolean
      proxy_access: boolean
      execution_enabled: boolean
      writes_enabled: boolean
    }>
    zapier_tools_total: number
    google_drive_visible: boolean
    onedrive_visible: boolean
    heygen_schema_visible: boolean
    execution_enabled: false
    writes_enabled: false
  }
  integrations: {
    visible: true
    registry_status: EcosystemAccessState
    items: Array<{
      id: string
      status: string
      visibility: 'configured' | 'visible' | 'blocked' | 'unknown'
      direct_access: boolean
      proxy_access: boolean
      execution_enabled: boolean
      writes_enabled: boolean
    }>
  }
  brain: {
    visible: boolean
    system_status: EcosystemAccessState
    sources: Array<{
      source: string
      status: string
      summary: string
      access: EcosystemAccessState
      direct_access: boolean
      proxy_access: boolean
    }>
    obsidian_visible: boolean
    obsidian_status: EcosystemAccessState
    mempalace_visible: boolean
    mempalace_status: EcosystemAccessState
    graphify_visible: boolean
    graphify_status: EcosystemAccessState
    memory_writes_enabled: false
  }
  opencloud_buildwiki: {
    status: EcosystemAccessState
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
    report_pdf_delivery_status: EcosystemAccessState
    telegram_reports_visible: boolean
    mission_control_reports_visible: boolean
    google_drive_delivery_visible: boolean
    google_drive_status: EcosystemAccessState
    onedrive_delivery_visible: boolean
    onedrive_status: EcosystemAccessState
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

function stateToAccess(value: unknown): EcosystemAccessState {
  const text = String(value || '').toLowerCase()
  if (!text) return 'unknown'
  if (/(active|healthy|ready|connected|reachable|ok|success)/.test(text)) return 'connected'
  if (/(configured|schema|available)/.test(text)) return 'configured'
  if (/(visible|read_only|degraded|partial|backup|sandbox)/.test(text)) return 'visible'
  if (/(missing|blocked|not_visible|not_connected|unavailable|failed|error|denied|locked)/.test(text)) return 'blocked'
  return 'unknown'
}

function brainSourceStatus(
  sources: Array<{ source: string; status: string }>,
  name: string,
): EcosystemAccessState {
  const source = sources.find((item) => item.source.toLowerCase() === name)
  if (!source) return 'blocked'
  return stateToAccess(source.status)
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

export async function buildAgentZeroEcosystemAgentRecord(input: {
  verifyChat?: boolean
  chatTimeoutMs?: number
  context?: AgentZeroReadOnlyContext
} = {}): Promise<AgentZeroEcosystemAgentRecord> {
  const runtime = await probeAgentZeroRuntime()
  const apiKey = getAgentZeroApiKeyState()
  const now = Date.now()
  let chatStatus: AgentZeroEcosystemAgentRecord['chat_status'] = 'not_checked'
  let agentZeroCalled = false
  let chatBlocker: string | null = null

  if (runtime.reachable && apiKey.present && input.verifyChat) {
    const result = await sendAgentZeroReadOnlyMessage({
      ownerMessage: 'Mission Control provider registry health check. Reply with one short sentence confirming read-only ecosystem context is visible. Do not execute anything.',
      context: input.context || buildAgentZeroReadOnlyContext({ providerIds: ['agent_zero'] }),
      timeoutMs: input.chatTimeoutMs ?? 12000,
    })
    agentZeroCalled = result.agent_zero_called
    chatStatus = result.ok ? 'working' : 'blocked'
    chatBlocker = result.ok ? null : (result.blocker || result.error || `agent_zero_chat_http_${result.status}`)
  } else if (runtime.reachable && apiKey.present) {
    chatStatus = 'not_checked'
  } else {
    chatStatus = 'blocked'
    chatBlocker = runtime.reachable ? 'agent_zero_external_api_key_missing' : 'agent_zero_health_unreachable'
  }

  const state: AgentZeroEcosystemAgentState = !runtime.reachable || !runtime.health_ok
    ? 'offline'
    : apiKey.present && (chatStatus === 'working' || !input.verifyChat)
      ? 'connected'
      : 'degraded'
  const blocker = state === 'offline'
    ? (runtime.error || 'Agent Zero Tailnet health endpoint is not reachable.')
    : state === 'degraded'
      ? (chatBlocker || 'Agent Zero health works, but Mission Control cannot complete authenticated test-chat yet.')
      : null

  return {
    id: 'agent_zero',
    name: 'Agent Zero',
    category: 'agent',
    status: state,
    state,
    mode: 'read_only',
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    health_url: 'configured',
    chat_route: '/api/bridge/agent-zero/test-chat',
    capabilities_source: 'mission_control_context',
    health_status: runtime.reachable && runtime.health_ok ? 'healthy' : 'unreachable',
    auth_status: apiKey.present ? 'configured' : 'missing',
    chat_status: chatStatus,
    agent_zero_called: agentZeroCalled,
    last_checked: now,
    last_checked_at: new Date(now).toISOString(),
    detail: {
      endpoint: runtime.web_endpoint,
      health_endpoint: runtime.health_endpoint,
      chat_endpoint: runtime.chat_endpoint,
      health_http_status: runtime.http_status,
      health_latency_ms: runtime.latency_ms,
      version: runtime.version,
      commit_hash: runtime.commit_hash,
      api_key_configured: apiKey.present,
      test_chat_endpoint: '/api/bridge/agent-zero/test-chat',
      ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem',
      bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session',
      capabilities_source: 'mission_control_context',
      mode: 'read_only',
      execution_enabled: false,
      bridge_session_required: true,
      direct_access: false,
      proxy_access: true,
      blocker,
      notes: 'Agent Zero is active as a read-only ecosystem agent through Mission Control context. Execution remains disabled until a separately approved Bridge Session and scoped adapter exist.',
      error: blocker,
    },
    next_action: state === 'connected'
      ? 'Use /api/bridge/agent-zero/test-chat for read-only Agent Zero ecosystem questions. Execution remains disabled.'
      : state === 'degraded'
        ? 'Fix Agent Zero API auth/test-chat before treating Agent Zero as connected.'
        : 'Restore Agent Zero Tailnet health before read-only ecosystem tests.',
  }
}

export function buildAgentZeroReadOnlyContext(input: {
  providerIds?: string[]
  providerRegistry?: Array<{ id?: string; name?: string; state?: string; category?: string; execution_enabled?: boolean; direct_access?: boolean; proxy_access?: boolean }>
  agents?: Array<{ id: string; status?: string; role?: string; execution_enabled?: boolean; direct_access?: boolean; proxy_access?: boolean }>
  modelCatalog?: Array<{ alias: string; provider: string; name: string }>
  modelProviderRegistry?: AgentZeroModelProviderSummary[]
  skillNames?: string[]
  skillRegistry?: AgentZeroSkillRegistryItem[]
  skillSources?: AgentZeroSkillSourceSummary[]
  integrationItems?: Array<{ id: string; status?: string; visibility?: 'configured' | 'visible' | 'blocked' | 'unknown'; direct_access?: boolean; proxy_access?: boolean; execution_enabled?: boolean; writes_enabled?: boolean }>
  toolRegistry?: Array<{ id: string; status?: EcosystemAccessState; source?: string; direct_access?: boolean; proxy_access?: boolean; execution_enabled?: boolean; writes_enabled?: boolean }>
  mcpServers?: Array<{ name: string; status?: string; transport?: string; tool_count?: number | null; reachable?: boolean; schema_available?: boolean; blocked_reason?: string | null; tools_endpoint?: string }>
  mcpEndpointSummaries?: AgentZeroReadOnlyEndpointSummary[]
  mcpToolSchemaSummary?: { tools_total?: number; schema_available?: boolean; required_fields?: string[]; write_tools_total?: number; read_tools_total?: number }
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
  const providerRegistry = (input.providerRegistry || []).map((provider) => ({
    id: String(provider.id || provider.name || ''),
    name: String(provider.name || provider.id || ''),
    state: String(provider.state || 'unknown'),
    category: String(provider.category || 'provider'),
    access: stateToAccess(provider.state || (provider.id || provider.name ? 'visible' : 'unknown')),
    execution_enabled: Boolean(provider.execution_enabled),
    direct_access: Boolean(provider.direct_access),
    proxy_access: provider.proxy_access !== false,
  })).filter((provider) => provider.id || provider.name)
  const modelCatalog = (input.modelCatalog || []).slice(0, 40)
  const modelProviders = Array.from(new Set(modelCatalog.map((model) => model.provider).filter(Boolean))).sort()
  const modelProviderRegistry = (input.modelProviderRegistry || [])
    .map((provider) => ({
      id: provider.id,
      name: provider.name,
      status: provider.status,
      credential_present: Boolean(provider.credential_present),
      credential_names: Array.from(new Set(provider.credential_names || [])).sort(),
      credential_values_exposed: false as const,
      model_count: Number(provider.model_count || provider.models?.length || 0),
      models: Array.from(new Set(provider.models || [])).slice(0, 40),
      best_use_case: provider.best_use_case,
      execution_mode: provider.execution_mode,
      execution_enabled: false as const,
      bridge_session_required: true as const,
      direct_access: false as const,
      proxy_access: true as const,
      blocked_reason: provider.blocked_reason || null,
    }))
    .filter((provider) => provider.id && provider.name)
    .sort((a, b) => a.id.localeCompare(b.id))
  const skillRegistry = (input.skillRegistry || [])
    .map((skill) => ({
      name: skill.name,
      source: skill.source,
      source_label: skill.source_label,
      description: skill.description || '',
      dependencies: Array.from(new Set(skill.dependencies || [])).sort(),
      missing_dependencies: Array.from(new Set(skill.missing_dependencies || [])).sort(),
      blocked_dependencies: Array.from(new Set(skill.blocked_dependencies || [])).sort(),
      safe_mode: skill.safe_mode,
      status: skill.status,
      execution_enabled: false as const,
      writes_enabled: false as const,
      direct_access: false as const,
      proxy_access: true as const,
      blocked_reason: skill.blocked_reason || null,
    }))
    .filter((skill) => skill.name)
    .sort((a, b) => `${a.source}:${a.name}`.localeCompare(`${b.source}:${b.name}`))
  const skillNames = Array.from(new Set([
    ...(input.skillNames || []),
    ...skillRegistry.map((skill) => skill.name),
  ].filter(Boolean))).sort()
  const derivedSkillSources = new Map<AgentZeroSkillSourceSummary['source'], AgentZeroSkillSourceSummary>()
  for (const skill of skillRegistry) {
    const existing = derivedSkillSources.get(skill.source)
    if (existing) {
      existing.total += 1
      if (skill.status === 'blocked') existing.status = 'visible'
      continue
    }
    derivedSkillSources.set(skill.source, {
      source: skill.source,
      label: skill.source_label,
      status: 'visible',
      total: 1,
      safe_mode: 'metadata_only',
      blocked_reason: null,
    })
  }
  const skillSources = (input.skillSources || Array.from(derivedSkillSources.values()))
    .map((source) => ({
      source: source.source,
      label: source.label,
      status: source.status,
      total: Number(source.total || 0),
      safe_mode: source.safe_mode,
      blocked_reason: source.blocked_reason || null,
    }))
    .sort((a, b) => a.source.localeCompare(b.source))
  const agents = (input.agents || []).map((agent) => ({
    id: agent.id,
    status: agent.status || 'unknown',
    role: agent.role || 'ecosystem agent',
    execution_enabled: Boolean(agent.execution_enabled),
    direct_access: Boolean(agent.direct_access),
    proxy_access: agent.proxy_access !== false,
  }))
  const integrations = (input.integrationItems || []).map((integration) => ({
    id: integration.id,
    status: integration.status || 'unknown',
    visibility: integration.visibility || 'unknown',
    direct_access: Boolean(integration.direct_access),
    proxy_access: integration.proxy_access !== false,
    execution_enabled: Boolean(integration.execution_enabled),
    writes_enabled: Boolean(integration.writes_enabled),
  }))
  const brainSources = (input.brainSources || []).map((source) => ({
    source: String(source.source || 'unknown'),
    status: String(source.status || source.raw_state || 'unknown'),
    summary: String(source.summary || ''),
    access: stateToAccess(source.status || source.raw_state),
    direct_access: false,
    proxy_access: true,
  }))
  const mcpServers = (input.mcpServers || [])
    .map((server) => ({
      name: server.name,
      status: server.status || 'unknown',
      transport: server.transport || 'unknown',
      tool_count: typeof server.tool_count === 'number' ? server.tool_count : null,
      access: stateToAccess(server.status || 'unknown'),
      reachable: Boolean(server.reachable ?? /(connected|visible|ok|ready|active)/i.test(server.status || '')),
      schema_available: Boolean(server.schema_available),
      execution_enabled: false as const,
      bridge_session_required: true as const,
      blocked_reason: server.blocked_reason || null,
      tools_endpoint: server.tools_endpoint || `/api/mcp/servers/${encodeURIComponent(server.name)}/tools`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const endpointSummaries = (input.mcpEndpointSummaries || []).map((endpoint) => ({
    ...endpoint,
    execution_enabled: false as const,
    bridge_session_required: true as const,
  }))
  const mcpToolSummary = {
    tools_total: Number(input.mcpToolSchemaSummary?.tools_total || input.zapierToolsTotal || 0),
    schema_available: Boolean(input.mcpToolSchemaSummary?.schema_available || input.heygenSchemaVisible),
    required_fields: Array.from(new Set(input.mcpToolSchemaSummary?.required_fields || [])),
    write_tools_total: Number(input.mcpToolSchemaSummary?.write_tools_total || 0),
    read_tools_total: Number(input.mcpToolSchemaSummary?.read_tools_total || 0),
  }
  const toolRegistry = (input.toolRegistry || []).map((tool) => ({
    id: tool.id,
    status: tool.status || 'unknown',
    source: tool.source || 'unknown',
    direct_access: Boolean(tool.direct_access),
    proxy_access: tool.proxy_access !== false,
    execution_enabled: Boolean(tool.execution_enabled),
    writes_enabled: Boolean(tool.writes_enabled),
  }))
  const openrouterModelProvider = modelProviderRegistry.find((provider) => provider.id === 'openrouter')
  const openrouterStatus = openrouterModelProvider
    ? stateToAccess(openrouterModelProvider.status)
    : input.integrationItems?.find((item) => item.id === 'openrouter')?.visibility === 'visible'
      ? 'visible'
      : providers.includes('openrouter') ? 'visible' : 'unknown'
  const obsidianStatus = brainSourceStatus(brainSources, 'obsidian')
  const mempalaceStatus = brainSourceStatus(brainSources, 'mempalace')
  const graphifyStatus = brainSourceStatus(brainSources, 'graphify')
  return {
    execution_enabled: false,
    bridge_session_required: true,
    mission_control: {
      visible: true,
      status: 'connected',
      mode: 'read_only_bridge_context',
      execution_enabled: false,
      writes_enabled: false,
      direct_access: false,
      proxy_access: true,
      auth_required: true,
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
      provider_registry: providerRegistry,
      mcp_visible: Boolean(input.mcpVisible),
      zapier_visible: Boolean(input.zapierVisible),
      heygen_visible: Boolean(input.heygenVisible),
      heygen_schema_visible: Boolean(input.heygenSchemaVisible),
      mcp_servers: mcpServers.map((server) => server.name),
      mcp_tools_visible: Boolean(input.mcpVisible || input.zapierVisible || input.heygenVisible),
    },
    mcp: {
      visible: Boolean(input.mcpVisible || mcpServers.length),
      status: input.mcpVisible || mcpServers.length ? 'visible' : 'blocked',
      servers: mcpServers,
      endpoint_summaries: endpointSummaries,
      tool_schema_summary: mcpToolSummary,
      execution_enabled: false,
      writes_enabled: false,
      direct_tool_execution_enabled: false,
    },
    agents: {
      visible: true,
      registry_status: agents.length > 0 ? 'visible' : 'unknown',
      items: agents,
    },
    models: {
      visible: true,
      registry_status: modelCatalog.length > 0 ? 'visible' : 'unknown',
      total: modelCatalog.length,
      providers: modelProviders,
      catalog: modelCatalog.map((model) => ({
        alias: model.alias,
        provider: model.provider,
        name: model.name,
      })),
      provider_registry: modelProviderRegistry,
      openrouter_status: openrouterStatus as EcosystemAccessState,
      execution_enabled: false,
      bridge_session_required: true,
      credential_values_exposed: false,
    },
    skills: {
      visible: skillNames.length > 0,
      registry_status: skillNames.length > 0 ? 'visible' : 'unknown',
      total: skillNames.length,
      sample: skillNames.slice(0, 25),
      sources: skillSources,
      registry: skillRegistry.slice(0, 100),
      blocked_total: skillRegistry.filter((skill) => skill.status === 'blocked').length,
      missing_dependencies_total: skillRegistry.filter((skill) => skill.missing_dependencies.length > 0 || skill.blocked_dependencies.length > 0).length,
      execution_enabled: false,
      bridge_session_required: true,
      writes_enabled: false,
    },
    tools: {
      visible: Boolean(input.mcpVisible || input.zapierVisible || input.heygenVisible || input.zapierToolsTotal),
      registry_status: toolRegistry.length > 0 ? 'visible' : 'unknown',
      registry: toolRegistry,
      zapier_tools_total: Number(input.zapierToolsTotal || 0),
      google_drive_visible: Boolean(input.googleDriveVisible),
      onedrive_visible: Boolean(input.oneDriveVisible),
      heygen_schema_visible: Boolean(input.heygenSchemaVisible),
      execution_enabled: false,
      writes_enabled: false,
    },
    integrations: {
      visible: true,
      registry_status: integrations.length > 0 ? 'visible' : 'unknown',
      items: integrations,
    },
    brain: {
      visible: brainSources.length > 0,
      system_status: brainSources.length > 0 ? 'visible' : 'blocked',
      sources: brainSources,
      obsidian_visible: obsidianStatus !== 'blocked' && obsidianStatus !== 'not_connected',
      obsidian_status: obsidianStatus,
      mempalace_visible: mempalaceStatus !== 'blocked' && mempalaceStatus !== 'not_connected',
      mempalace_status: mempalaceStatus,
      graphify_visible: graphifyStatus !== 'blocked' && graphifyStatus !== 'not_connected',
      graphify_status: graphifyStatus,
      memory_writes_enabled: false,
    },
    opencloud_buildwiki: {
      status: 'visible',
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
      report_pdf_delivery_status: 'visible',
      telegram_reports_visible: true,
      mission_control_reports_visible: true,
      google_drive_delivery_visible: Boolean(input.googleDriveVisible),
      google_drive_status: input.googleDriveVisible ? 'visible' : 'blocked',
      onedrive_delivery_visible: Boolean(input.oneDriveVisible),
      onedrive_status: input.oneDriveVisible ? 'visible' : 'blocked',
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
    'For MCP/tool questions, use mcp.servers, mcp.endpoint_summaries, mcp.tool_schema_summary, tools.registry, models, and integrations from the JSON context.',
    'For model questions, use models.provider_registry and models.catalog. Do not claim a model/provider is usable when its status is blocked; credential presence is boolean only and never a key value.',
    'For skill questions, use skills.registry and skills.sources. Do not claim unregistered skills; mark blocked or dependency-limited skills honestly.',
    'When asked what you can see, distinguish visible, configured, connected, blocked, execution disabled, and direct access versus Mission Control proxy.',
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
  timeoutMs?: number
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
      signal: AbortSignal.timeout(input.timeoutMs ?? 45000),
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
