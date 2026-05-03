import { execFile } from 'node:child_process'
import { fetchClaudeClawJson } from '@/lib/claudeclaw-telegram-approvals'
import { getMcpServerTools } from '@/lib/mcp-server-tool-schemas'
import { getZapierToolBridge, type ZapierToolRecord } from '@/lib/zapier-tool-bridge'
import { getAllModels } from '@/lib/models'
import { getDatabase } from '@/lib/db'
import { deriveRunNowUiState, readLatestRunNow } from '@/lib/build-wiki-run-now'
import {
  type AgentZeroReadOnlyContext,
  type EcosystemAccessState,
  buildAgentZeroReadOnlyContext,
} from '@/lib/agent-zero-bridge'

type ProviderStatus = {
  id?: string
  name?: string
  state?: string
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
    modelCatalog: getAllModels().map((model) => ({ alias: model.alias, provider: model.provider, name: model.name })),
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
    }],
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
