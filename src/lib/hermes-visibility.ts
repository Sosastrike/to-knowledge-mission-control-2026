import type {
  AgentZeroIntegrationCapability,
  AgentZeroModelProviderSummary,
  AgentZeroReadOnlyContext,
  AgentZeroReadOnlyEndpointSummary,
  AgentZeroToolRegistryItem,
  EcosystemAccessState,
} from '@/lib/agent-zero-bridge'

export type HermesCapabilityState =
  | 'connected'
  | 'configured'
  | 'read_only'
  | 'write_enabled'
  | 'blocked'
  | 'missing_credential'

export type HermesModelContext = {
  id: string
  name: string
  status: 'connected' | 'configured' | 'blocked'
  states: HermesCapabilityState[]
  credential_present: boolean
  credential_names: string[]
  credential_values_exposed: false
  model_count: number
  models: string[]
  best_use_case: string
  execution_mode: string
  execution_enabled: false
  bridge_session_required: true
  blocked_reason: string | null
}

export type HermesIntegrationContext = {
  id: string
  name: string
  category: string
  status: 'connected' | 'configured' | 'blocked'
  states: HermesCapabilityState[]
  credential_present: boolean | null
  missing_credential: boolean
  credential_names: string[]
  credential_values_exposed: false
  read_only: boolean
  write_enabled: boolean
  execution_enabled: false
  requires_bridge_session: boolean
  tool_count: number | null
  source: string
  delivery_status?: EcosystemAccessState
  upload_connector_configured?: boolean
  blocked_reason: string | null
  notes: string
}

export type HermesBridgeMcpVisibility = {
  providers: Array<{
    id: string
    name: string
    state: string
    category: string
    read_only: true
    execution_enabled: false
  }>
  mcp_servers: Array<{
    name: string
    status: string
    tool_count: number | null
    schema_available: boolean
    reachable: boolean
    execution_enabled: false
    bridge_session_required: true
    blocked_reason: string | null
    tools_endpoint: string
  }>
  endpoint_summaries: AgentZeroReadOnlyEndpointSummary[]
  tool_schema_summary: AgentZeroReadOnlyContext['mcp']['tool_schema_summary']
  required_routes: Array<{
    route: string
    purpose: string
    read_only: true
    execution_enabled: false
  }>
  execution_enabled: false
}

export type HermesToolVisibility = {
  registry_status: EcosystemAccessState
  total: number
  read_only_total: number
  write_enabled_total: number
  bridge_session_required_total: number
  missing_credentials_total: number
  registry: Array<AgentZeroToolRegistryItem & {
    states: HermesCapabilityState[]
  }>
  execution_enabled: false
  writes_enabled: false
}

export type HermesModelsVisibility = {
  registry_status: EcosystemAccessState
  openrouter_status: EcosystemAccessState
  providers: HermesModelContext[]
  catalog: AgentZeroReadOnlyContext['models']['catalog']
  execution_enabled: false
  bridge_session_required: true
  credential_values_exposed: false
}

export type HermesIntegrationsVisibility = {
  registry_status: EcosystemAccessState
  connected_total: number
  configured_total: number
  blocked_total: number
  missing_credentials_total: number
  write_enabled_total: number
  bridge_session_required_total: number
  registry: HermesIntegrationContext[]
  execution_enabled: false
  writes_enabled: false
  credential_values_exposed: false
}

export type HermesBuildWikiOpenCloudVisibility = {
  status: EcosystemAccessState
  direct_opencloud_access_visible: boolean
  build_wiki_status_visible: boolean
  read_only: true
  read_available: boolean
  write_available: boolean
  execution_enabled: false
  run_now_requires_bridge_session: true
  run_now_target_service: 'opencloud-docs-farmer.service'
  timer_active: boolean | null
  service_active: boolean | null
  fork2_smb_blocker: string | null
  blocked_reason: string | null
  distinction: string
}

const REQUIRED_ROUTES: HermesBridgeMcpVisibility['required_routes'] = [
  { route: '/api/bridge/preflight', purpose: 'Bridge preflight/status', read_only: true, execution_enabled: false },
  { route: '/api/bridge/providers', purpose: 'Bridge provider registry', read_only: true, execution_enabled: false },
  { route: '/api/bridge/providers/:id', purpose: 'Bridge provider detail', read_only: true, execution_enabled: false },
  { route: '/api/mcp/list', purpose: 'MCP server list', read_only: true, execution_enabled: false },
  { route: '/api/mcp/servers/:id/tools', purpose: 'MCP tool/schema summary', read_only: true, execution_enabled: false },
  { route: '/api/zapier/tools', purpose: 'Zapier tool inventory', read_only: true, execution_enabled: false },
  { route: '/api/bridge/zapier/tools/search', purpose: 'Zapier/HeyGen schema search', read_only: true, execution_enabled: false },
]

const REQUIRED_MODEL_PROVIDERS: Array<{ id: string; name: string; aliases: string[]; bestUseCase: string }> = [
  { id: 'openrouter', name: 'OpenRouter', aliases: ['openrouter'], bestUseCase: 'Router/fallback access to hosted models.' },
  { id: 'openai', name: 'OpenAI', aliases: ['openai', 'gpt'], bestUseCase: 'General reasoning, coding, and multimodal tasks when configured.' },
  { id: 'anthropic', name: 'Claude / Anthropic', aliases: ['anthropic', 'claude'], bestUseCase: 'Reasoning, coding, writing, and review through configured Claude access.' },
  { id: 'codex_chatgpt', name: 'Codex/ChatGPT plugin', aliases: ['codex', 'chatgpt'], bestUseCase: 'Coding/reasoning helper through the Agent Zero plugin when connected.' },
  { id: 'ollama', name: 'Ollama', aliases: ['ollama'], bestUseCase: 'Local model fallback when configured.' },
  { id: 'nvidia', name: 'NVIDIA', aliases: ['nvidia'], bestUseCase: 'GPU/provider-backed model routes when configured.' },
  { id: 'groq', name: 'Groq', aliases: ['groq'], bestUseCase: 'Low-latency model route when configured.' },
  { id: 'xai', name: 'xAI Grok', aliases: ['xai', 'grok'], bestUseCase: 'Grok model route when configured.' },
  { id: 'gemini', name: 'Gemini', aliases: ['gemini', 'google'], bestUseCase: 'Google model route when configured.' },
]

const REQUIRED_INTEGRATIONS: Array<{
  id: string
  name: string
  aliases: string[]
  category: string
  notes: string
}> = [
  { id: 'agentmail', name: 'AgentMail', aliases: ['agentmail', 'email', 'mail'], category: 'communication', notes: 'Email status only; send requires Bridge Session and configured adapter.' },
  { id: 'firecrawl', name: 'Firecrawl', aliases: ['firecrawl'], category: 'crawler', notes: 'Crawler status only; use requires configured key and approved adapter.' },
  { id: 'google_drive', name: 'Google Drive', aliases: ['google_drive', 'drive'], category: 'storage', notes: 'Upload requires configured connector and Bridge Session.' },
  { id: 'onedrive', name: 'OneDrive', aliases: ['onedrive', 'one_drive'], category: 'storage', notes: 'Upload requires configured connector and Bridge Session.' },
  { id: 'zapier', name: 'Zapier', aliases: ['zapier'], category: 'automation', notes: 'Schemas are read-only; writes require Bridge Session.' },
  { id: 'heygen', name: 'HeyGen', aliases: ['heygen'], category: 'media', notes: 'Schema visibility does not enable generation.' },
  { id: 'telegram', name: 'Telegram', aliases: ['telegram'], category: 'messaging', notes: 'Owner channel status only; sending requires approved route.' },
  { id: 'whatsapp', name: 'WhatsApp', aliases: ['whatsapp', 'whats_app'], category: 'messaging', notes: 'Visible only if configured in registry.' },
  { id: 'codex_chatgpt', name: 'Codex/ChatGPT plugin', aliases: ['codex', 'chatgpt'], category: 'developer', notes: 'Plugin status only; auth values are never exposed.' },
  { id: 'claude_anthropic', name: 'Claude/Anthropic plugin', aliases: ['claude', 'anthropic'], category: 'developer', notes: 'Connected only if Claude plugin/auth source is configured.' },
  { id: 'paperclip', name: 'Paperclip Workforce Control Plane', aliases: ['paperclip', 'workforce'], category: 'workforce', notes: 'Hermes can see Paperclip task/skills registry and draft proposals; issue/work-product writes require Agent Zero/Gateway Bridge Session.' },
]

function statesFor(input: {
  status?: string | null
  readOnly?: boolean
  writeEnabled?: boolean
  missingCredential?: boolean
  blocked?: boolean
}): HermesCapabilityState[] {
  const states = new Set<HermesCapabilityState>()
  if (input.status === 'connected') states.add('connected')
  if (input.status === 'configured') states.add('configured')
  if (input.readOnly) states.add('read_only')
  if (input.writeEnabled) states.add('write_enabled')
  if (input.blocked || input.status === 'blocked') states.add('blocked')
  if (input.missingCredential) states.add('missing_credential')
  if (!states.size) states.add('blocked')
  return Array.from(states)
}

function findByAliases<T extends { id: string; name?: string }>(items: T[], aliases: string[]): T | undefined {
  return items.find((item) => {
    const haystack = `${item.id} ${item.name || ''}`.toLowerCase()
    return aliases.some((alias) => haystack.includes(alias.toLowerCase()))
  })
}

function statusFromLiveItem(context: AgentZeroReadOnlyContext, aliases: string[]): 'connected' | 'configured' | 'blocked' | null {
  const live = findByAliases(context.live_registry.items, aliases)
  if (!live) return null
  if (live.connected) return 'connected'
  if (live.configured) return 'configured'
  return 'blocked'
}

function modelFromProvider(provider: AgentZeroModelProviderSummary): HermesModelContext {
  return {
    id: provider.id,
    name: provider.name,
    status: provider.status,
    states: statesFor({
      status: provider.status,
      readOnly: true,
      writeEnabled: false,
      missingCredential: !provider.credential_present && provider.status === 'blocked',
      blocked: provider.status === 'blocked',
    }),
    credential_present: provider.credential_present,
    credential_names: provider.credential_names,
    credential_values_exposed: false,
    model_count: provider.model_count,
    models: provider.models.slice(0, 40),
    best_use_case: provider.best_use_case,
    execution_mode: provider.execution_mode,
    execution_enabled: false,
    bridge_session_required: true,
    blocked_reason: provider.blocked_reason,
  }
}

function blockedModel(required: (typeof REQUIRED_MODEL_PROVIDERS)[number], status: 'connected' | 'configured' | 'blocked' | null): HermesModelContext {
  const effectiveStatus = status || 'blocked'
  return {
    id: required.id,
    name: required.name,
    status: effectiveStatus,
    states: statesFor({
      status: effectiveStatus,
      readOnly: true,
      blocked: effectiveStatus === 'blocked',
      missingCredential: effectiveStatus === 'blocked',
    }),
    credential_present: effectiveStatus !== 'blocked',
    credential_names: [],
    credential_values_exposed: false,
    model_count: 0,
    models: [],
    best_use_case: required.bestUseCase,
    execution_mode: 'mission_control_registry_status_only; execution_requires_owner_approved_bridge_session',
    execution_enabled: false,
    bridge_session_required: true,
    blocked_reason: effectiveStatus === 'blocked' ? `${required.id}_not_visible_or_not_configured` : null,
  }
}

function integrationFromCapability(capability: AgentZeroIntegrationCapability): HermesIntegrationContext {
  return {
    id: capability.id,
    name: capability.name,
    category: capability.category,
    status: capability.status,
    states: statesFor({
      status: capability.status,
      readOnly: capability.read_only,
      writeEnabled: capability.write_enabled,
      missingCredential: capability.missing_credential,
      blocked: capability.status === 'blocked',
    }),
    credential_present: capability.credential_present,
    missing_credential: capability.missing_credential,
    credential_names: capability.credential_names,
    credential_values_exposed: false,
    read_only: capability.read_only,
    write_enabled: capability.write_enabled,
    execution_enabled: false,
    requires_bridge_session: capability.requires_bridge_session,
    tool_count: capability.tool_count,
    source: capability.source,
    blocked_reason: capability.blocked_reason,
    notes: capability.notes,
  }
}

function blockedIntegration(input: {
  id: string
  name: string
  category: string
  status: 'connected' | 'configured' | 'blocked' | null
  notes: string
  blockedReason: string
}): HermesIntegrationContext {
  const status = input.status || 'blocked'
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    status,
    states: statesFor({
      status,
      readOnly: true,
      writeEnabled: false,
      missingCredential: status === 'blocked',
      blocked: status === 'blocked',
    }),
    credential_present: status === 'blocked' ? false : null,
    missing_credential: status === 'blocked',
    credential_names: [],
    credential_values_exposed: false,
    read_only: true,
    write_enabled: false,
    execution_enabled: false,
    requires_bridge_session: true,
    tool_count: null,
    source: 'mission_control_registry_missing_or_status_only',
    blocked_reason: status === 'blocked' ? input.blockedReason : null,
    notes: input.notes,
  }
}

export function buildHermesBridgeMcpVisibility(context: AgentZeroReadOnlyContext): HermesBridgeMcpVisibility {
  return {
    providers: context.bridge.provider_registry.map((provider) => ({
      id: provider.id,
      name: provider.name,
      state: provider.state,
      category: provider.category,
      read_only: true as const,
      execution_enabled: false as const,
    })).slice(0, 120),
    mcp_servers: context.mcp.servers.map((server) => ({
      name: server.name,
      status: server.status,
      tool_count: server.tool_count,
      schema_available: server.schema_available,
      reachable: server.reachable,
      execution_enabled: false as const,
      bridge_session_required: true as const,
      blocked_reason: server.blocked_reason,
      tools_endpoint: server.tools_endpoint,
    })).slice(0, 120),
    endpoint_summaries: context.mcp.endpoint_summaries.slice(0, 120),
    tool_schema_summary: context.mcp.tool_schema_summary,
    required_routes: REQUIRED_ROUTES,
    execution_enabled: false,
  }
}

export function buildHermesToolVisibility(context: AgentZeroReadOnlyContext): HermesToolVisibility {
  const registry = context.tools.registry.map((tool) => ({
    ...tool,
    states: statesFor({
      status: tool.status,
      readOnly: tool.read_only,
      writeEnabled: tool.write_enabled,
      missingCredential: tool.missing_credential,
      blocked: tool.status === 'blocked',
    }),
  }))

  return {
    registry_status: context.tools.registry_status,
    total: registry.length,
    read_only_total: context.tools.read_only_total,
    write_enabled_total: context.tools.write_enabled_total,
    bridge_session_required_total: context.tools.bridge_session_required_total,
    missing_credentials_total: context.tools.missing_credentials_total,
    registry,
    execution_enabled: false,
    writes_enabled: false,
  }
}

export function buildHermesModelsVisibility(context: AgentZeroReadOnlyContext): HermesModelsVisibility {
  const providersById = new Map(context.models.provider_registry.map((provider) => [provider.id, modelFromProvider(provider)]))
  for (const required of REQUIRED_MODEL_PROVIDERS) {
    if (!providersById.has(required.id)) {
      const liveStatus = statusFromLiveItem(context, required.aliases)
      providersById.set(required.id, blockedModel(required, liveStatus))
    }
  }

  return {
    registry_status: context.models.registry_status,
    openrouter_status: context.models.openrouter_status,
    providers: Array.from(providersById.values()).sort((a, b) => a.id.localeCompare(b.id)),
    catalog: context.models.catalog,
    execution_enabled: false,
    bridge_session_required: true,
    credential_values_exposed: false,
  }
}

export function buildHermesBuildWikiOpenCloudVisibility(context: AgentZeroReadOnlyContext): HermesBuildWikiOpenCloudVisibility {
  const buildWiki = context.opencloud_buildwiki
  return {
    status: buildWiki.status,
    direct_opencloud_access_visible: buildWiki.direct_opencloud_access_visible,
    build_wiki_status_visible: buildWiki.build_wiki_status_visible,
    read_only: true,
    read_available: buildWiki.read_available,
    write_available: buildWiki.write_available,
    execution_enabled: false,
    run_now_requires_bridge_session: true,
    run_now_target_service: 'opencloud-docs-farmer.service',
    timer_active: buildWiki.timer_active,
    service_active: buildWiki.service.active,
    fork2_smb_blocker: buildWiki.smb.blocker || buildWiki.fork_state.fork2.blocker || null,
    blocked_reason: buildWiki.blocked_reason || buildWiki.run_now.blocked_reason || null,
    distinction: buildWiki.direct_opencloud_access_visible
      ? 'A separate runtime endpoint is visible separately from Build-Wiki/Farmer status.'
      : 'No separate runtime endpoint is proven here; only Build-Wiki/Farmer status is visible through Mission Control.',
  }
}

export function buildHermesIntegrationsVisibility(context: AgentZeroReadOnlyContext): HermesIntegrationsVisibility {
  const integrationsById = new Map<string, HermesIntegrationContext>()
  for (const capability of context.integrations.registry) {
    integrationsById.set(capability.id, integrationFromCapability(capability))
  }

  for (const required of REQUIRED_INTEGRATIONS) {
    if (!integrationsById.has(required.id)) {
      const capability = findByAliases(context.integrations.registry, required.aliases)
      if (capability) {
        integrationsById.set(required.id, { ...integrationFromCapability(capability), id: required.id, name: required.name })
        continue
      }
      integrationsById.set(required.id, blockedIntegration({
        id: required.id,
        name: required.name,
        category: required.category,
        status: statusFromLiveItem(context, required.aliases),
        notes: required.notes,
        blockedReason: `${required.id}_not_visible_or_not_configured`,
      }))
    }
  }

  const googleDrive = integrationsById.get('google_drive')
  if (googleDrive) {
    googleDrive.delivery_status = context.delivery.google_drive_delivery_adapter_status
    googleDrive.upload_connector_configured = context.delivery.google_drive_upload_connector_configured
    googleDrive.blocked_reason = googleDrive.blocked_reason || (context.delivery.google_drive_delivery_adapter_status === 'blocked' ? 'google_drive_upload_connector_not_configured' : null)
  }

  const oneDrive = integrationsById.get('onedrive')
  if (oneDrive) {
    oneDrive.delivery_status = context.delivery.onedrive_delivery_adapter_status
    oneDrive.upload_connector_configured = context.delivery.onedrive_upload_connector_configured
    oneDrive.blocked_reason = oneDrive.blocked_reason || (context.delivery.onedrive_delivery_adapter_status === 'blocked' ? 'onedrive_upload_connector_not_configured' : null)
  }

  const buildWiki = buildHermesBuildWikiOpenCloudVisibility(context)
  integrationsById.set('buildwiki_farmer', {
    id: 'buildwiki_farmer',
    name: 'Build-Wiki/Farmer',
    category: 'buildwiki',
    status: buildWiki.status === 'blocked' ? 'blocked' : 'connected',
    states: statesFor({
      status: buildWiki.status === 'blocked' ? 'blocked' : 'connected',
      readOnly: true,
      writeEnabled: false,
      blocked: buildWiki.status === 'blocked',
    }),
    credential_present: null,
    missing_credential: false,
    credential_names: [],
    credential_values_exposed: false,
    read_only: true,
    write_enabled: false,
    execution_enabled: false,
    requires_bridge_session: true,
    tool_count: null,
    source: 'mission_control_buildwiki_farmer_status',
    blocked_reason: buildWiki.blocked_reason,
    notes: `${buildWiki.distinction} Run Now is scoped to opencloud-docs-farmer.service and requires Bridge Session approval.`,
  })

  integrationsById.set('buildwiki_farmer_runtime', {
    id: 'buildwiki_farmer_runtime',
    name: 'Build-Wiki/Farmer runtime access',
    category: 'buildwiki',
    status: buildWiki.direct_opencloud_access_visible ? 'connected' : 'blocked',
    states: statesFor({
      status: buildWiki.direct_opencloud_access_visible ? 'connected' : 'blocked',
      readOnly: true,
      blocked: !buildWiki.direct_opencloud_access_visible,
    }),
    credential_present: null,
    missing_credential: false,
    credential_names: [],
    credential_values_exposed: false,
    read_only: true,
    write_enabled: false,
    execution_enabled: false,
    requires_bridge_session: true,
    tool_count: null,
    source: 'mission_control_buildwiki_farmer_status',
    blocked_reason: buildWiki.direct_opencloud_access_visible ? null : 'buildwiki_farmer_runtime_access_not_proven',
    notes: buildWiki.distinction,
  })

  const registry = Array.from(integrationsById.values()).sort((a, b) => a.id.localeCompare(b.id))

  return {
    registry_status: context.integrations.registry_status,
    connected_total: registry.filter((item) => item.status === 'connected').length,
    configured_total: registry.filter((item) => item.status === 'configured').length,
    blocked_total: registry.filter((item) => item.status === 'blocked').length,
    missing_credentials_total: registry.filter((item) => item.missing_credential).length,
    write_enabled_total: registry.filter((item) => item.write_enabled).length,
    bridge_session_required_total: registry.filter((item) => item.requires_bridge_session).length,
    registry,
    execution_enabled: false,
    writes_enabled: false,
    credential_values_exposed: false,
  }
}

function capabilityLine(item: Pick<HermesIntegrationContext | HermesModelContext, 'name' | 'status' | 'states' | 'blocked_reason'>): string {
  const stateText = item.states.join('/')
  return `${item.name}: ${item.status}${stateText ? ` (${stateText})` : ''}${item.blocked_reason ? `, blocked: ${item.blocked_reason.replace(/[_-]+/g, ' ')}` : ''}`
}

export function summarizeHermesIntegrations(visibility: HermesIntegrationsVisibility): string {
  const featured = ['agentmail', 'firecrawl', 'google_drive', 'onedrive', 'zapier', 'heygen', 'telegram', 'whatsapp', 'codex_chatgpt', 'claude_anthropic', 'buildwiki_farmer', 'buildwiki_farmer_runtime', 'paperclip']
    .map((id) => visibility.registry.find((item) => item.id === id))
    .filter((item): item is HermesIntegrationContext => Boolean(item))
    .map(capabilityLine)

  return [
    `${visibility.registry.length} integration records visible.`,
    `Connected: ${visibility.connected_total}; configured: ${visibility.configured_total}; blocked: ${visibility.blocked_total}; missing credential: ${visibility.missing_credentials_total}.`,
    featured.join('; '),
  ].filter(Boolean).join(' ')
}

export function summarizeHermesModels(visibility: HermesModelsVisibility): string {
  const featured = REQUIRED_MODEL_PROVIDERS
    .map((required) => visibility.providers.find((provider) => provider.id === required.id))
    .filter((provider): provider is HermesModelContext => Boolean(provider))
    .map(capabilityLine)

  return [
    `${visibility.providers.length} model/provider records visible; OpenRouter status is ${visibility.openrouter_status}.`,
    featured.join('; '),
  ].filter(Boolean).join(' ')
}

export function summarizeHermesTools(input: {
  bridgeMcp: HermesBridgeMcpVisibility
  tools: HermesToolVisibility
}): string {
  const servers = input.bridgeMcp.mcp_servers
    .slice(0, 8)
    .map((server) => `${server.name}: ${server.status}, reachable=${server.reachable}, tools=${server.tool_count ?? 'unknown'}, schema=${server.schema_available}`)
  const tools = input.tools.registry
    .slice(0, 8)
    .map((tool) => `${tool.name}: ${tool.status}${tool.schema_available ? ', schema visible' : ''}${tool.requires_bridge_session ? ', Bridge Session required' : ''}${tool.blocked_reason ? `, blocked: ${tool.blocked_reason.replace(/[_-]+/g, ' ')}` : ''}`)

  return [
    `${input.bridgeMcp.providers.length} Bridge providers visible.`,
    `${input.bridgeMcp.mcp_servers.length} MCP servers visible; ${input.bridgeMcp.tool_schema_summary.tools_total} MCP/Zapier tools summarized; schema visible=${input.bridgeMcp.tool_schema_summary.schema_available}.`,
    servers.length ? `Servers: ${servers.join('; ')}.` : 'Servers: none visible.',
    tools.length ? `Tools: ${tools.join('; ')}.` : 'Tools: no registry rows visible.',
  ].join(' ')
}
