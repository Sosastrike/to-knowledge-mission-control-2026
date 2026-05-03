import { execFile } from 'node:child_process'
import { fetchClaudeClawJson } from '@/lib/claudeclaw-telegram-approvals'
import { getMcpServerTools } from '@/lib/mcp-server-tool-schemas'
import { getZapierToolBridge, type ZapierToolRecord } from '@/lib/zapier-tool-bridge'
import { getAllModels } from '@/lib/models'
import { getDatabase } from '@/lib/db'
import { deriveRunNowUiState, readLatestRunNow } from '@/lib/build-wiki-run-now'
import {
  type AgentZeroModelProviderStatus,
  type AgentZeroModelProviderSummary,
  type AgentZeroReadOnlyContext,
  type AgentZeroReadOnlyEndpointSummary,
  type EcosystemAccessState,
  buildAgentZeroReadOnlyContext,
} from '@/lib/agent-zero-bridge'

type ProviderStatus = {
  id?: string
  name?: string
  state?: string
  status?: string
  category?: string
  type?: string
}

type BrainSyncPayload = {
  sources?: Array<{
    source?: string
    state?: string
    status?: string
    summary?: string
  }>
}

function execFileText(command: string, args: string[], timeout = 2500): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        timeout,
        env: {
          ...process.env,
          XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/1001',
        },
      },
      (_error, stdout) => resolve(String(stdout || '')),
    )
  })
}

function readSkillNames(): string[] {
  try {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT name FROM skills ORDER BY name LIMIT 200')
      .all() as Array<{ name?: string }>
    return rows.map((row) => String(row.name || '')).filter(Boolean)
  } catch {
    return []
  }
}

async function readBuildWikiTimerActive(): Promise<boolean | null> {
  const text = (await execFileText('systemctl', ['--user', 'is-active', 'opencloud-docs-farmer.timer'], 2000)).trim()
  if (!text) return null
  return text === 'active'
}

function hasOneDriveTool(toolNames: string[]): boolean {
  return toolNames.some((tool) => tool.includes('onedrive') || tool.includes('one_drive'))
}

function hasSource(brainSources: BrainSyncPayload['sources'], sourceName: string): boolean {
  return Boolean(brainSources?.some((source) => String(source.source).toLowerCase() === sourceName))
}

function providerId(provider: ProviderStatus): string {
  return String(provider.id || provider.name || '').trim()
}

function normalizeToolName(tool: ZapierToolRecord): string {
  return String(tool.tool_name || '').toLowerCase()
}

function accessFromVisibility(value: string | null | undefined): EcosystemAccessState {
  const text = String(value || '').toLowerCase()
  if (/(active|healthy|ready|connected|reachable|ok|success|schema_visible)/.test(text)) return 'connected'
  if (/(configured|available)/.test(text)) return 'configured'
  if (/(visible|read_only|degraded|partial|cached)/.test(text)) return 'visible'
  if (/(missing|blocked|not_visible|not_connected|unavailable|failed|error|denied|locked)/.test(text)) return 'blocked'
  return 'unknown'
}

function hasCredential(names: string[]): boolean {
  return names.some((name) => Boolean(process.env[name]?.trim()))
}

function normalizedProviderText(provider: ProviderStatus): string {
  return [
    provider.id,
    provider.name,
    provider.category,
    provider.type,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ')
}

function providerStateFor(providers: ProviderStatus[], ids: string[]): string | null {
  const needles = ids.map((id) => id.toLowerCase())
  const provider = providers.find((item) => {
    const text = normalizedProviderText(item)
    return needles.some((needle) => text.includes(needle))
  })
  return provider ? String(provider.state || provider.status || 'visible') : null
}

function modelProviderStatus(input: {
  credentialPresent: boolean
  providerState: string | null
  localConfigured?: boolean
}): AgentZeroModelProviderStatus {
  const access = accessFromVisibility(input.providerState)
  if (access === 'connected') return 'connected'
  if (input.credentialPresent || input.localConfigured || access === 'configured' || access === 'visible') return 'configured'
  return 'blocked'
}

function buildModelProviderRegistry(input: {
  providers: ProviderStatus[]
  models: Array<{ provider: string; name: string }>
}): AgentZeroModelProviderSummary[] {
  const modelsByProvider = new Map<string, string[]>()
  for (const model of input.models) {
    const key = model.provider.toLowerCase()
    modelsByProvider.set(key, [...(modelsByProvider.get(key) || []), model.name])
  }

  const build = (provider: {
    id: string
    name: string
    modelProvider?: string
    providerIds?: string[]
    credentialNames: string[]
    bestUseCase: string
    executionMode: string
    localConfigured?: boolean
    includeBlocked?: boolean
  }): AgentZeroModelProviderSummary | null => {
    const providerState = providerStateFor(input.providers, provider.providerIds || [provider.id, provider.name])
    const credentialPresent = hasCredential(provider.credentialNames)
    const status = modelProviderStatus({
      credentialPresent,
      providerState,
      localConfigured: provider.localConfigured,
    })
    const modelProvider = provider.modelProvider || provider.id
    const models = modelsByProvider.get(modelProvider.toLowerCase()) || []
    if (!provider.includeBlocked && status === 'blocked') return null

    return {
      id: provider.id,
      name: provider.name,
      status,
      credential_present: credentialPresent,
      credential_names: provider.credentialNames,
      credential_values_exposed: false,
      model_count: models.length,
      models,
      best_use_case: provider.bestUseCase,
      execution_mode: provider.executionMode,
      execution_enabled: false,
      bridge_session_required: true,
      direct_access: false,
      proxy_access: true,
      blocked_reason: status === 'blocked'
        ? `${provider.id}_not_configured_or_not_visible_in_provider_registry`
        : null,
    }
  }

  const allModelNames = Array.from(new Set(input.models.map((model) => model.name))).slice(0, 40)
  const openRouterState = providerStateFor(input.providers, ['openrouter', 'open router'])
  const openRouterCredential = hasCredential(['OPENROUTER_API_KEY'])
  const openRouterStatus = modelProviderStatus({
    credentialPresent: openRouterCredential,
    providerState: openRouterState,
  })

  const requiredProviders: AgentZeroModelProviderSummary[] = [
    {
      id: 'openrouter',
      name: 'OpenRouter',
      status: openRouterStatus,
      credential_present: openRouterCredential,
      credential_names: ['OPENROUTER_API_KEY'],
      credential_values_exposed: false,
      model_count: allModelNames.length,
      models: allModelNames,
      best_use_case: 'Router/fallback access to hosted models when configured through Mission Control.',
      execution_mode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
      execution_enabled: false,
      bridge_session_required: true,
      direct_access: false,
      proxy_access: true,
      blocked_reason: openRouterStatus === 'blocked' ? 'openrouter_not_configured_or_not_visible_in_provider_registry' : null,
    },
    build({
      id: 'anthropic',
      name: 'Anthropic / Claude',
      modelProvider: 'anthropic',
      providerIds: ['anthropic', 'claude'],
      credentialNames: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
      bestUseCase: 'High-quality reasoning, coding, analysis, and agent planning.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
      includeBlocked: true,
    })!,
    build({
      id: 'openai',
      name: 'OpenAI',
      modelProvider: 'openai',
      providerIds: ['openai'],
      credentialNames: ['OPENAI_API_KEY'],
      bestUseCase: 'General assistant work, coding support, fast/cheap GPT-class routing, and report drafting.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
      includeBlocked: true,
    })!,
    build({
      id: 'google',
      name: 'Gemini / Google',
      modelProvider: 'google',
      providerIds: ['google', 'gemini'],
      credentialNames: ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
      bestUseCase: 'Gemini long-context, multimodal, and Google-family reasoning tasks when configured.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
      includeBlocked: true,
    })!,
    build({
      id: 'groq',
      name: 'Groq',
      modelProvider: 'groq',
      providerIds: ['groq'],
      credentialNames: ['GROQ_API_KEY'],
      bestUseCase: 'Very low-latency hosted inference for lightweight or speed-sensitive work.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
      includeBlocked: true,
    })!,
    build({
      id: 'ollama',
      name: 'Ollama / Local',
      modelProvider: 'ollama',
      providerIds: ['ollama', 'local'],
      credentialNames: [],
      bestUseCase: 'Local/private fallback tasks where latency and model quality are acceptable.',
      executionMode: 'local_status_visible_read_only; execution_requires_owner_approved_bridge_session_and_local_adapter',
      localConfigured: Boolean(process.env.OLLAMA_HOST?.trim()) || Boolean(providerStateFor(input.providers, ['ollama', 'local'])),
      includeBlocked: true,
    })!,
  ]

  const optionalProviders = [
    build({
      id: 'moonshot',
      name: 'Moonshot / Kimi',
      modelProvider: 'moonshot',
      providerIds: ['moonshot', 'kimi'],
      credentialNames: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
      bestUseCase: 'Alternative hosted model routing when explicitly configured.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
    }),
    build({
      id: 'venice',
      name: 'Venice AI',
      modelProvider: 'venice',
      providerIds: ['venice'],
      credentialNames: ['VENICE_API_KEY'],
      bestUseCase: 'Alternative hosted open-model routing when explicitly configured.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
    }),
    build({
      id: 'minimax',
      name: 'MiniMax',
      modelProvider: 'minimax',
      providerIds: ['minimax'],
      credentialNames: ['MINIMAX_API_KEY'],
      bestUseCase: 'Cost-sensitive hosted coding and general tasks when explicitly configured.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
    }),
  ].filter((provider): provider is AgentZeroModelProviderSummary => Boolean(provider))

  return [...requiredProviders, ...optionalProviders]
}

function curatedZapierTools(tools: ZapierToolRecord[]): ZapierToolRecord[] {
  const priorityTerms = [
    'heygen',
    'google_drive',
    'onedrive',
    'one_drive',
    'openai',
    'gmail',
    'slack',
    'youtube',
    'drive',
    'file',
    'report',
    'search',
    'find',
    'list',
  ]
  const selected = new Map<string, ZapierToolRecord>()
  for (const tool of tools) {
    const name = normalizeToolName(tool)
    if (priorityTerms.some((term) => name.includes(term))) selected.set(tool.tool_name, tool)
  }
  for (const tool of tools) {
    if (selected.size >= 75) break
    selected.set(tool.tool_name, tool)
  }
  return Array.from(selected.values()).slice(0, 75)
}

function endpointSummary(input: {
  endpoint: string
  mcp_server_name?: string | null
  status: EcosystemAccessState
  reachable: boolean
  tool_count?: number | null
  schema_available?: boolean
  blocked_reason?: string | null
  note: string
}): AgentZeroReadOnlyEndpointSummary {
  return {
    endpoint: input.endpoint,
    method: 'GET',
    mcp_server_name: input.mcp_server_name ?? null,
    status: input.status,
    reachable: input.reachable,
    tool_count: typeof input.tool_count === 'number' ? input.tool_count : null,
    schema_available: Boolean(input.schema_available),
    execution_enabled: false,
    bridge_session_required: true,
    blocked_reason: input.blocked_reason || null,
    note: input.note,
  }
}

export async function buildAgentZeroEcosystemContext(): Promise<AgentZeroReadOnlyContext> {
  const [providersResult, zapierResult, mcpZapierResult, brainResult, timerActive] = await Promise.all([
    fetchClaudeClawJson<{ providers?: ProviderStatus[] }>('/api/bridge/providers', {}, 12000).catch(() => ({
      ok: false,
      status: 503,
      payload: { providers: [] as ProviderStatus[] },
    })),
    getZapierToolBridge(null).catch(() => ({
      connected: false,
      mcp_reachable: false,
      tools_total: 0,
      tools: [] as ZapierToolRecord[],
      heygen_found: false,
      required_fields: null as string[] | null,
    })),
    getMcpServerTools('zapier').catch(() => ({
      ok: false,
      status: 'unavailable',
      server: 'zapier',
      mcp_reachable: false,
      tools_total: 0,
      tools: [],
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
      blocker: 'zapier_mcp_schema_unavailable',
    })),
    fetchClaudeClawJson<BrainSyncPayload>('/api/memory-sync/status', {}, 12000).catch(() => ({
      ok: false,
      status: 503,
      payload: { sources: [] as BrainSyncPayload['sources'] },
    })),
    readBuildWikiTimerActive(),
  ])

  const providers = Array.isArray((providersResult.payload as any)?.providers)
    ? ((providersResult.payload as any).providers as ProviderStatus[])
    : []
  const allModels = getAllModels()
  const providerIds = providers.map(providerId).filter(Boolean)
  const providerSet = new Set(providerIds.map((provider) => provider.toLowerCase()))
  const zapierTools = Array.isArray((zapierResult as any).tools)
    ? ((zapierResult as any).tools as ZapierToolRecord[])
    : []
  const toolSet = new Set(zapierTools.map((tool) => normalizeToolName(tool)))
  const brainSources = Array.isArray((brainResult.payload as BrainSyncPayload)?.sources)
    ? ((brainResult.payload as BrainSyncPayload).sources || [])
    : []
  const latestRunNow = readLatestRunNow()
  const runState = deriveRunNowUiState(latestRunNow.approval, latestRunNow.run)
  const skillNames = readSkillNames()
  const oneDriveVisible = hasOneDriveTool(Array.from(toolSet))
  const googleDriveVisible = Array.from(toolSet).some((tool) => tool.includes('google_drive') || tool.includes('google_drive_upload_file'))
  const heygenRequiredFields = Array.isArray((zapierResult as any).required_fields)
    ? ((zapierResult as any).required_fields as string[])
    : []
  const schemaRequiredFields = Array.from(new Set([
    ...((mcpZapierResult as any).tools || []).flatMap((tool: any) => Array.isArray(tool.required_fields) ? tool.required_fields : []),
    ...heygenRequiredFields,
  ])).slice(0, 75)
  const writeToolsTotal = ((mcpZapierResult as any).tools || []).filter((tool: any) => tool.write_classification !== 'read').length
  const readToolsTotal = ((mcpZapierResult as any).tools || []).filter((tool: any) => tool.write_classification === 'read').length
  const mcpToolCount = Number((mcpZapierResult as any).tools_total || (zapierResult as any).tools_total || zapierTools.length || 0)
  const mcpSchemaAvailable = Boolean(
    ((mcpZapierResult as any).ok && ((mcpZapierResult as any).tools || []).some((tool: any) => tool.schema_available))
      || heygenRequiredFields.length > 0,
  )
  const mcpReachable = Boolean((mcpZapierResult as any).mcp_reachable || (zapierResult as any).mcp_reachable)
  const zapierReachable = Boolean((zapierResult as any).connected || (zapierResult as any).mcp_reachable)
  const zapierBlocker = String((mcpZapierResult as any).blocker || (zapierResult as any).blocker || '').trim() || null
  const endpointSummaries = [
    endpointSummary({
      endpoint: '/api/bridge/preflight',
      status: 'connected',
      reachable: true,
      note: 'Bridge preflight is visible read-only for routing decisions; it does not execute tools.',
    }),
    endpointSummary({
      endpoint: '/api/bridge/providers',
      status: providers.length > 0 ? 'visible' : 'blocked',
      reachable: providers.length > 0,
      blocked_reason: providers.length > 0 ? null : 'provider_registry_empty_or_unreachable',
      note: 'Bridge provider registry is visible through Mission Control.',
    }),
    endpointSummary({
      endpoint: '/api/bridge/providers/:id',
      status: providers.length > 0 ? 'visible' : 'blocked',
      reachable: providers.length > 0,
      blocked_reason: providers.length > 0 ? null : 'provider_detail_requires_provider_registry',
      note: 'Provider detail route is available for individual read-only provider records.',
    }),
    endpointSummary({
      endpoint: '/api/mcp/list',
      status: mcpReachable || mcpToolCount > 0 ? 'visible' : 'blocked',
      reachable: mcpReachable || mcpToolCount > 0,
      tool_count: mcpToolCount,
      schema_available: mcpSchemaAvailable,
      blocked_reason: mcpReachable || mcpToolCount > 0 ? null : zapierBlocker,
      note: 'MCP server list is visible read-only; execution is disabled.',
    }),
    endpointSummary({
      endpoint: '/api/mcp/servers/zapier/tools',
      mcp_server_name: 'zapier',
      status: (mcpZapierResult as any).ok ? 'connected' : (zapierReachable ? 'visible' : 'blocked'),
      reachable: Boolean((mcpZapierResult as any).ok || zapierReachable),
      tool_count: mcpToolCount,
      schema_available: mcpSchemaAvailable,
      blocked_reason: (mcpZapierResult as any).ok ? null : zapierBlocker,
      note: 'Zapier MCP tools/schema summary is read-only. No MCP tool invocation is enabled.',
    }),
    endpointSummary({
      endpoint: '/api/zapier/tools',
      mcp_server_name: 'zapier',
      status: (zapierResult as any).connected ? 'visible' : 'blocked',
      reachable: Boolean((zapierResult as any).connected),
      tool_count: Number((zapierResult as any).tools_total || zapierTools.length || 0),
      schema_available: heygenRequiredFields.length > 0 || mcpSchemaAvailable,
      blocked_reason: (zapierResult as any).connected ? null : String((zapierResult as any).blocker || zapierBlocker || 'zapier_tool_inventory_unavailable'),
      note: 'Canonical Zapier tool inventory is visible read-only when configured; writes remain disabled.',
    }),
    endpointSummary({
      endpoint: '/api/bridge/zapier/tools/search',
      mcp_server_name: 'zapier',
      status: (zapierResult as any).heygen_found ? 'visible' : ((zapierResult as any).connected ? 'configured' : 'blocked'),
      reachable: Boolean((zapierResult as any).connected),
      tool_count: Number((zapierResult as any).heygen_tools?.length || 0),
      schema_available: heygenRequiredFields.length > 0,
      blocked_reason: (zapierResult as any).connected ? null : String((zapierResult as any).blocker || zapierBlocker || 'zapier_search_unavailable'),
      note: 'Zapier tool search is visible read-only; use q=heygen for schema discovery. No execution is enabled.',
    }),
  ]
  const integrationItems = [
    { id: 'mission_control', status: 'reachable', visibility: 'visible' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'bridge', status: providers.length > 0 ? 'visible' : 'degraded', visibility: 'visible' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'mcp', status: (mcpZapierResult as any).mcp_reachable ? 'connected' : ((zapierResult as any).mcp_reachable ? 'visible' : 'blocked'), visibility: ((zapierResult as any).mcp_reachable || (mcpZapierResult as any).mcp_reachable) ? 'visible' as const : 'blocked' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'zapier', status: (zapierResult as any).connected ? 'tool_inventory_visible' : 'blocked', visibility: (zapierResult as any).connected ? 'visible' as const : 'blocked' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'heygen', status: (zapierResult as any).heygen_found ? 'schema_visible_read_only' : 'not_visible', visibility: (zapierResult as any).heygen_found ? 'visible' as const : 'blocked' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'google_drive', status: googleDriveVisible ? 'visible_via_zapier_schema' : 'not_visible', visibility: googleDriveVisible ? 'visible' as const : 'blocked' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'onedrive', status: oneDriveVisible ? 'visible_via_zapier_schema' : 'not_visible', visibility: oneDriveVisible ? 'visible' as const : 'blocked' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'openrouter', status: providerSet.has('openrouter') ? 'visible_in_provider_registry' : 'unknown', visibility: providerSet.has('openrouter') ? 'visible' as const : 'unknown' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'obsidian', status: hasSource(brainSources, 'obsidian') ? 'visible_read_only' : 'not_connected', visibility: hasSource(brainSources, 'obsidian') ? 'visible' as const : 'blocked' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'mempalace', status: hasSource(brainSources, 'mempalace') ? 'visible_read_only' : 'not_connected', visibility: hasSource(brainSources, 'mempalace') ? 'visible' as const : 'blocked' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'graphify', status: hasSource(brainSources, 'graphify') ? 'visible_read_only' : 'not_connected', visibility: hasSource(brainSources, 'graphify') ? 'visible' as const : 'blocked' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'build_wiki', status: 'visible_read_only', visibility: 'visible' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
    { id: 'reports_pdf_delivery', status: 'visible_via_mission_control', visibility: 'visible' as const, direct_access: false, proxy_access: true, execution_enabled: false, writes_enabled: false },
  ]
  const curatedTools = curatedZapierTools(zapierTools)
  const toolRegistry = [
    {
      id: 'mission_control.status',
      status: 'connected' as EcosystemAccessState,
      source: 'mission_control',
      direct_access: false,
      proxy_access: true,
      execution_enabled: false,
      writes_enabled: false,
    },
    {
      id: 'bridge.providers.list',
      status: providers.length > 0 ? 'visible' as EcosystemAccessState : 'blocked' as EcosystemAccessState,
      source: 'mission_control_bridge',
      direct_access: false,
      proxy_access: true,
      execution_enabled: false,
      writes_enabled: false,
    },
    {
      id: 'mcp.zapier.tools.schema',
      status: accessFromVisibility((mcpZapierResult as any).ok ? 'connected' : (mcpZapierResult as any).blocker),
      source: 'mcp_schema_passthrough',
      direct_access: false,
      proxy_access: true,
      execution_enabled: false,
      writes_enabled: false,
    },
    {
      id: 'build_wiki.farmer.status',
      status: 'visible' as EcosystemAccessState,
      source: 'mission_control_build_wiki',
      direct_access: false,
      proxy_access: true,
      execution_enabled: false,
      writes_enabled: false,
    },
    {
      id: 'brain.sync.status',
      status: brainSources.length > 0 ? 'visible' as EcosystemAccessState : 'blocked' as EcosystemAccessState,
      source: 'claudeclaw_brain_sync',
      direct_access: false,
      proxy_access: true,
      execution_enabled: false,
      writes_enabled: false,
    },
    ...curatedTools.map((tool) => ({
      id: tool.tool_name,
      status: accessFromVisibility(tool.required_fields ? 'schema_visible' : tool.source),
      source: `zapier_${tool.source}`,
      direct_access: false,
      proxy_access: true,
      execution_enabled: false,
      writes_enabled: false,
    })),
  ]

  return buildAgentZeroReadOnlyContext({
    providerIds,
    providerRegistry: providers.map((provider) => ({
      id: providerId(provider),
      name: String(provider.name || provider.id || ''),
      state: String(provider.state || 'unknown'),
      category: String(provider.category || provider.type || 'provider'),
      execution_enabled: false,
      direct_access: false,
      proxy_access: true,
    })),
    agents: providers
      .filter((provider) => ['tony', 'agent_zero', 'hermes', 'openclaw_gateway'].includes(String(provider.id || '').toLowerCase()))
      .map((provider) => ({
        id: String(provider.id || provider.name || ''),
        status: String(provider.state || 'unknown'),
        role: String(provider.category || provider.type || 'agent'),
        execution_enabled: false,
        direct_access: false,
        proxy_access: true,
      })),
    modelCatalog: allModels.map((model) => ({ alias: model.alias, provider: model.provider, name: model.name })),
    modelProviderRegistry: buildModelProviderRegistry({
      providers,
      models: allModels.map((model) => ({ provider: model.provider, name: model.name })),
    }),
    skillNames,
    integrationItems,
    toolRegistry,
    mcpServers: [{
      name: 'zapier',
      status: (mcpZapierResult as any).ok
        ? 'connected'
        : ((zapierResult as any).mcp_reachable || (zapierResult as any).connected ? 'visible_cached_or_bridge_inventory' : 'blocked'),
      transport: 'http',
      tool_count: mcpToolCount || null,
      reachable: Boolean((mcpZapierResult as any).ok || zapierReachable),
      schema_available: mcpSchemaAvailable,
      blocked_reason: (mcpZapierResult as any).ok ? null : zapierBlocker,
      tools_endpoint: '/api/mcp/servers/zapier/tools',
    }],
    mcpEndpointSummaries: endpointSummaries,
    mcpToolSchemaSummary: {
      tools_total: mcpToolCount,
      schema_available: mcpSchemaAvailable,
      required_fields: schemaRequiredFields,
      write_tools_total: writeToolsTotal,
      read_tools_total: readToolsTotal,
    },
    mcpVisible: Boolean((zapierResult as any).mcp_reachable || (zapierResult as any).connected || (mcpZapierResult as any).mcp_reachable),
    zapierVisible: Boolean((zapierResult as any).connected || (zapierResult as any).tools_total),
    zapierToolsTotal: Number((zapierResult as any).tools_total || zapierTools.length || 0),
    googleDriveVisible,
    oneDriveVisible,
    heygenVisible: Boolean((zapierResult as any).heygen_found),
    heygenSchemaVisible: heygenRequiredFields.length > 0,
    brainSources,
    timerActive,
    latestBuildWikiRunState: runState.ui_state,
    bridgeSessionAvailable: latestRunNow.persistence_ready,
  })
}
