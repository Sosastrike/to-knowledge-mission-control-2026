import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fetchClaudeClawJson } from '@/lib/claudeclaw-telegram-approvals'
import { getZapierToolBridge } from '@/lib/zapier-tool-bridge'
import { getAllModels } from '@/lib/models'
import { getDatabase } from '@/lib/db'
import { deriveRunNowUiState, readLatestRunNow } from '@/lib/build-wiki-run-now'
import {
  AgentZeroReadOnlyContext,
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

const ZAPIER_TOOLS_FILE = '/home/tony/claudeclaw/runtime/zapier-tools.txt'

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

async function readZapierToolNames(): Promise<string[]> {
  try {
    const text = await readFile(ZAPIER_TOOLS_FILE, 'utf8')
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
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

export async function buildAgentZeroEcosystemContext(): Promise<AgentZeroReadOnlyContext> {
  const [providersResult, zapierResult, brainResult, zapierToolNames, timerActive] = await Promise.all([
    fetchClaudeClawJson<{ providers?: ProviderStatus[] }>('/api/bridge/providers', {}, 12000).catch(() => ({
      ok: false,
      status: 503,
      payload: { providers: [] as ProviderStatus[] },
    })),
    getZapierToolBridge('heygen').catch(() => ({
      connected: false,
      mcp_reachable: false,
      heygen_found: false,
      required_fields: null as string[] | null,
    })),
    fetchClaudeClawJson<BrainSyncPayload>('/api/memory-sync/status', {}, 12000).catch(() => ({
      ok: false,
      status: 503,
      payload: { sources: [] as BrainSyncPayload['sources'] },
    })),
    readZapierToolNames(),
    readBuildWikiTimerActive(),
  ])

  const providers = Array.isArray((providersResult.payload as any)?.providers)
    ? ((providersResult.payload as any).providers as ProviderStatus[])
    : []
  const providerIds = providers.map((provider) => provider.id || provider.name || '').filter(Boolean)
  const providerSet = new Set(providerIds.map((provider) => provider.toLowerCase()))
  const toolSet = new Set(zapierToolNames.map((tool) => tool.toLowerCase()))
  const brainSources = Array.isArray((brainResult.payload as BrainSyncPayload)?.sources)
    ? ((brainResult.payload as BrainSyncPayload).sources || [])
    : []
  const latestRunNow = readLatestRunNow()
  const runState = deriveRunNowUiState(latestRunNow.approval, latestRunNow.run)
  const skillNames = readSkillNames()
  const oneDriveVisible = hasOneDriveTool(Array.from(toolSet))

  return buildAgentZeroReadOnlyContext({
    providerIds,
    agents: providers
      .filter((provider) => ['tony', 'agent_zero', 'hermes', 'openclaw_gateway'].includes(String(provider.id || '').toLowerCase()))
      .map((provider) => ({
        id: String(provider.id || provider.name || ''),
        status: String(provider.state || 'unknown'),
        role: String(provider.category || provider.type || 'agent'),
        execution_enabled: String(provider.id || '').toLowerCase() === 'tony',
      })),
    modelCatalog: getAllModels().map((model) => ({ alias: model.alias, provider: model.provider, name: model.name })),
    skillNames,
    integrationItems: [
      { id: 'mission_control', status: 'reachable', visibility: 'visible', execution_enabled: false, writes_enabled: false },
      { id: 'bridge', status: providers.length > 0 ? 'visible' : 'degraded', visibility: 'visible', execution_enabled: false, writes_enabled: false },
      { id: 'mcp', status: (zapierResult as any).mcp_reachable ? 'visible' : 'unknown', visibility: 'visible', execution_enabled: false, writes_enabled: false },
      { id: 'zapier', status: (zapierResult as any).connected ? 'visible' : 'blocked', visibility: (zapierResult as any).connected ? 'visible' : 'blocked', execution_enabled: false, writes_enabled: false },
      { id: 'heygen', status: (zapierResult as any).heygen_found ? 'schema_visible' : 'not_visible', visibility: (zapierResult as any).heygen_found ? 'visible' : 'blocked', execution_enabled: false, writes_enabled: false },
      { id: 'google_drive', status: toolSet.has('mcp__zapier__google_drive_upload_file') ? 'visible_via_zapier_schema' : 'not_visible', visibility: toolSet.has('mcp__zapier__google_drive_upload_file') ? 'visible' : 'blocked', execution_enabled: false, writes_enabled: false },
      { id: 'onedrive', status: oneDriveVisible ? 'visible_via_zapier_schema' : 'not_visible', visibility: oneDriveVisible ? 'visible' : 'blocked', execution_enabled: false, writes_enabled: false },
      { id: 'openrouter', status: providerSet.has('openrouter') ? 'visible' : 'unknown', visibility: providerSet.has('openrouter') ? 'visible' : 'unknown', execution_enabled: false, writes_enabled: false },
      { id: 'obsidian', status: hasSource(brainSources, 'obsidian') ? 'visible_read_only' : 'not_connected', visibility: hasSource(brainSources, 'obsidian') ? 'visible' : 'blocked', execution_enabled: false, writes_enabled: false },
      { id: 'mempalace', status: hasSource(brainSources, 'mempalace') ? 'visible_read_only' : 'not_connected', visibility: hasSource(brainSources, 'mempalace') ? 'visible' : 'blocked', execution_enabled: false, writes_enabled: false },
      { id: 'graphify', status: hasSource(brainSources, 'graphify') ? 'visible_read_only' : 'not_connected', visibility: hasSource(brainSources, 'graphify') ? 'visible' : 'blocked', execution_enabled: false, writes_enabled: false },
      { id: 'build_wiki', status: 'visible_read_only', visibility: 'visible', execution_enabled: false, writes_enabled: false },
    ],
    mcpServers: (zapierResult as any).connected || (zapierResult as any).mcp_reachable ? ['zapier'] : [],
    mcpVisible: Boolean((zapierResult as any).mcp_reachable || (zapierResult as any).connected),
    zapierVisible: Boolean((zapierResult as any).connected || (zapierResult as any).tools_total),
    zapierToolsTotal: Number((zapierResult as any).tools_total || zapierToolNames.length || 0),
    googleDriveVisible: toolSet.has('mcp__zapier__google_drive_upload_file'),
    oneDriveVisible,
    heygenVisible: Boolean((zapierResult as any).heygen_found),
    heygenSchemaVisible: Array.isArray((zapierResult as any).required_fields)
      && ((zapierResult as any).required_fields as string[]).length > 0,
    brainSources,
    timerActive,
    latestBuildWikiRunState: runState.ui_state,
    bridgeSessionAvailable: latestRunNow.persistence_ready,
  })
}
