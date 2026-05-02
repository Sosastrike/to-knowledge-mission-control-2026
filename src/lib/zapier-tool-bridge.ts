import { existsSync, readFileSync } from 'node:fs'
import { getMcpServerTools } from './mcp-server-tool-schemas'

export type ZapierWriteClassification = 'read' | 'write' | 'unknown'

export type ZapierToolRecord = {
  tool_name: string
  description: string | null
  category: string
  write_classification: ZapierWriteClassification
  approval_required: boolean
  execution_enabled: false
  blocker: string | null
  source: 'claude_mcp' | 'zapier_mcp' | 'registry' | 'cached_snapshot'
  required_fields: string[] | null
  required_fields_source: 'mcp_schema' | 'cached_snapshot_unavailable'
}

export type ZapierToolBridgePayload = {
  ok: true
  connected: boolean
  mcp_reachable: boolean
  tools_total: number
  tools: ZapierToolRecord[]
  heygen_found: boolean
  heygen_tools: ZapierToolRecord[]
  exact_heygen_tool_name: string | null
  required_fields: string[] | null
  query: string | null
  source: 'claude_mcp' | 'zapier_mcp' | 'registry' | 'cached_snapshot' | 'none'
  sources_checked: string[]
  last_checked_at: string
  execution_enabled: false
  writes_enabled: false
  no_zapier_writes: true
  blocker: string | null
  next_action: string
}

type McpTool = {
  name?: string
  description?: string
  inputSchema?: {
    required?: unknown
    properties?: Record<string, unknown>
  }
}

const ZAPIER_TOOLS_TXT =
  process.env.CLAUDECLAW_ZAPIER_TOOLS_PATH ||
  '/home/tony/claudeclaw/runtime/zapier-tools.txt'

const ZAPIER_PROVIDERS_JSON =
  process.env.CLAUDECLAW_ZAPIER_PROVIDERS_PATH ||
  '/home/tony/claudeclaw/runtime/zapier-providers.json'

const HEYGEN_SEARCH_TERMS = [
  'heygen',
  'avatar',
  'video',
  'talking avatar',
  'create video',
  'generate video',
]

function zapierMcpUrl(): string {
  return (process.env.ZAPIER_MCP_URL || process.env.ZAPIER_MCP_SERVER || '').trim()
}

function classifyZapierTool(name: string, description?: string | null): ZapierWriteClassification {
  const text = `${name} ${description || ''}`.toLowerCase()
  if (/\b(create|update|delete|remove|send|post|upload|run|execute|trigger|publish|invite|move|set|enable|disable|approve|revoke|translate|cancel|add|copy|rename|replace|clear|archive)\b/.test(text)) {
    return 'write'
  }
  if (/\b(get|list|search|find|lookup|retrieve|read|fetch|query|inspect|describe|status|history|check)\b/.test(text)) {
    return 'read'
  }
  return 'unknown'
}

function readProviderNames(): string[] {
  try {
    const payload = JSON.parse(readFileSync(ZAPIER_PROVIDERS_JSON, 'utf8')) as {
      providers?: Record<string, number>
    }
    return Object.keys(payload.providers || {}).sort((a, b) => b.length - a.length)
  } catch {
    return []
  }
}

function toolSlug(name: string): string {
  return name.replace(/^mcp__zapier__/, '').toLowerCase()
}

function categoryForTool(name: string, providerNames: string[]): string {
  const slug = toolSlug(name)
  const provider = providerNames.find((candidate) => slug === candidate || slug.startsWith(`${candidate}_`))
  if (provider) return provider
  return slug.split('_')[0] || 'unknown'
}

function titleFromToolName(name: string): string {
  const slug = toolSlug(name)
  return slug
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function requiredFields(tool: McpTool): string[] | null {
  const required = tool.inputSchema?.required
  if (Array.isArray(required) && required.every((item) => typeof item === 'string')) {
    return required as string[]
  }
  const properties = tool.inputSchema?.properties
  if (properties && typeof properties === 'object') return Object.keys(properties)
  return null
}

function toRecord(
  tool: McpTool,
  source: ZapierToolRecord['source'],
  providerNames: string[],
): ZapierToolRecord | null {
  const name = String(tool.name || '').trim()
  if (!name) return null
  const description = tool.description || (source === 'cached_snapshot' ? `Zapier tool: ${titleFromToolName(name)}` : null)
  const kind = classifyZapierTool(name, description)
  const fields = requiredFields(tool)
  return {
    tool_name: name,
    description,
    category: categoryForTool(name, providerNames),
    write_classification: kind,
    approval_required: kind !== 'read',
    execution_enabled: false,
    blocker: kind === 'read'
      ? null
      : 'Zapier execution is locked. Use Telegram approval and exact-scope runner before invoking this tool.',
    source,
    required_fields: fields,
    required_fields_source: fields ? 'mcp_schema' : 'cached_snapshot_unavailable',
  }
}

function parseMcpJsonResponse(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) return JSON.parse(trimmed)
  for (const line of trimmed.split('\n')) {
    const normalized = line.trim()
    if (!normalized.startsWith('data:')) continue
    const data = normalized.slice(5).trim()
    if (data.startsWith('{')) return JSON.parse(data)
  }
  return null
}

async function listLiveMcpTools(providerNames: string[]): Promise<{
  mcp_reachable: boolean
  tools: ZapierToolRecord[]
}> {
  const claudeMcp = await getMcpServerTools('zapier')
  if (claudeMcp.ok && claudeMcp.tools.length > 0) {
    return {
      mcp_reachable: true,
      tools: claudeMcp.tools
        .map((tool) => toRecord({
          name: tool.tool_name,
          description: tool.description || undefined,
          inputSchema: tool.input_schema
            ? {
              required: tool.input_schema.required_fields,
              properties: Object.fromEntries(tool.input_schema.properties.map((property) => [property.name, { type: property.type || undefined, description: property.description || undefined }])),
            }
            : undefined,
        }, 'claude_mcp', providerNames))
        .filter((tool): tool is ZapierToolRecord => Boolean(tool)),
    }
  }

  const url = zapierMcpUrl()
  if (!url) return { mcp_reachable: false, tools: [] }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'bridge-zapier-tools-list',
        method: 'tools/list',
        params: {},
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    })
    const payload = parseMcpJsonResponse(await response.text()) as
      | { result?: { tools?: McpTool[] }; error?: unknown }
      | null
    if (!response.ok || payload?.error) return { mcp_reachable: false, tools: [] }
    const tools = (payload?.result?.tools || [])
      .map((tool) => toRecord(tool, 'zapier_mcp', providerNames))
      .filter((tool): tool is ZapierToolRecord => Boolean(tool))
    return { mcp_reachable: true, tools }
  } catch {
    return { mcp_reachable: false, tools: [] }
  }
}

function listCachedSnapshotTools(providerNames: string[]): ZapierToolRecord[] {
  const names = new Set<string>()

  try {
    readFileSync(ZAPIER_TOOLS_TXT, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((name) => names.add(name))
  } catch {
    // optional snapshot
  }

  try {
    const payload = JSON.parse(readFileSync(ZAPIER_PROVIDERS_JSON, 'utf8')) as {
      all_tools?: string[]
    }
    for (const name of payload.all_tools || []) names.add(name)
  } catch {
    // optional snapshot
  }

  return Array.from(names)
    .sort()
    .map((name) => toRecord({ name }, 'cached_snapshot', providerNames))
    .filter((tool): tool is ZapierToolRecord => Boolean(tool))
}

function matchesQuery(tool: ZapierToolRecord, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = `${tool.tool_name} ${tool.description || ''} ${tool.category}`.toLowerCase()
  return q.split(/\s+/).every((part) => haystack.includes(part))
}

function heygenMatches(tools: ZapierToolRecord[]): ZapierToolRecord[] {
  return tools.filter((tool) => {
    const haystack = `${tool.tool_name} ${tool.description || ''} ${tool.category}`.toLowerCase()
    return HEYGEN_SEARCH_TERMS.some((term) => haystack.includes(term))
  })
}

function preferredHeyGenTool(tools: ZapierToolRecord[]): ZapierToolRecord | null {
  const ordered = [
    'mcp__zapier__heygen_create_an_avatar_video_generate',
    'mcp__zapier__heygen_create_a_video_from_video_agent',
    'mcp__zapier__heygen_create_a_video_from_template',
    'mcp__zapier__heygen_create_an_avatar_video_scene',
    'mcp__zapier__heygen_create_a_webm_avatar_video',
  ]
  for (const name of ordered) {
    const match = tools.find((tool) => tool.tool_name === name)
    if (match) return match
  }
  return tools.find((tool) => tool.category === 'heygen' && tool.write_classification === 'write') || tools[0] || null
}

export async function getZapierToolBridge(query?: string | null): Promise<ZapierToolBridgePayload> {
  const providerNames = readProviderNames()
  const live = await listLiveMcpTools(providerNames)
  const cached = live.tools.length > 0 ? [] : listCachedSnapshotTools(providerNames)
  const allTools = live.tools.length > 0 ? live.tools : cached
  const filteredTools = query ? allTools.filter((tool) => matchesQuery(tool, query)) : allTools
  const heygenTools = heygenMatches(allTools)
  const preferred = preferredHeyGenTool(heygenTools)
  const source = live.tools.length > 0
    ? 'zapier_mcp'
    : cached.length > 0
      ? 'cached_snapshot'
      : 'none'

  return {
    ok: true,
    connected: allTools.length > 0,
    mcp_reachable: live.mcp_reachable,
    tools_total: allTools.length,
    tools: filteredTools,
    heygen_found: heygenTools.length > 0,
    heygen_tools: heygenTools,
    exact_heygen_tool_name: preferred?.tool_name || null,
    required_fields: preferred?.required_fields || null,
    query: query || null,
    source,
    sources_checked: [
      zapierMcpUrl() ? 'Mission Control ZAPIER_MCP_URL/ZAPIER_MCP_SERVER tools/list' : 'Mission Control MCP env not present',
      existsSync(ZAPIER_TOOLS_TXT) ? ZAPIER_TOOLS_TXT : `${ZAPIER_TOOLS_TXT} missing`,
      existsSync(ZAPIER_PROVIDERS_JSON) ? ZAPIER_PROVIDERS_JSON : `${ZAPIER_PROVIDERS_JSON} missing`,
    ],
    last_checked_at: new Date().toISOString(),
    execution_enabled: false,
    writes_enabled: false,
    no_zapier_writes: true,
    blocker: allTools.length === 0
      ? 'Zapier tool inventory is not visible. Owner must connect/resync Zapier MCP before using Zapier tools.'
      : 'Zapier tool inventory is visible. Tool execution remains locked until scoped Telegram approval and exact runner wiring.',
    next_action: heygenTools.length > 0
      ? 'Use the Zapier HeyGen path for video planning. Do not ask for direct HeyGen API keys first.'
      : 'HeyGen is not visible in Zapier MCP. Owner must connect HeyGen in Zapier, then rerun Zapier resync/tool discovery.',
  }
}
