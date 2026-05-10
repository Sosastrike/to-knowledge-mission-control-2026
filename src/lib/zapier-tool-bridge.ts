import { existsSync, readFileSync } from 'node:fs'
import { getMcpServerTools } from './mcp-server-tool-schemas'
import {
  describeOwnerFacingStatus,
  OWNER_FACING_STATUS_STATES,
  type OwnerFacingBlockerClass,
  type OwnerFacingStatus,
  type OwnerFacingStatusDescriptor,
} from './owner-status'

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
  canonical_status: OwnerFacingStatus
  blocker_class: OwnerFacingBlockerClass
  owner_status: OwnerFacingStatusDescriptor
  connected: boolean
  mcp_reachable: boolean
  read_enabled: boolean
  tools_total: number
  read_tools_total: number
  write_tools_total: number
  unknown_tools_total: number
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
  bridge_session_required: true
  approval_required_for_writes: true
  allowed_owner_statuses: typeof OWNER_FACING_STATUS_STATES
  blocker: string | null
  warning: string | null
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
  blocker: string | null
  canonical_status: OwnerFacingStatus
}> {
  const claudeMcp = await getMcpServerTools('zapier')
  if (claudeMcp.ok && claudeMcp.tools.length > 0) {
    return {
      mcp_reachable: true,
      blocker: null,
      canonical_status: 'READY',
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
  if (!url) {
    return {
      mcp_reachable: false,
      tools: [],
      blocker: claudeMcp.blocker || claudeMcp.error || 'zapier_mcp_not_configured',
      canonical_status: claudeMcp.canonical_status,
    }
  }

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
    if (!response.ok || payload?.error) {
      return {
        mcp_reachable: false,
        tools: [],
        blocker: `zapier_mcp_tools_list_failed: HTTP ${response.status}`,
        canonical_status: 'SERVICE_DOWN',
      }
    }
    const tools = (payload?.result?.tools || [])
      .map((tool) => toRecord(tool, 'zapier_mcp', providerNames))
      .filter((tool): tool is ZapierToolRecord => Boolean(tool))
    return {
      mcp_reachable: true,
      tools,
      blocker: tools.length ? null : 'zapier_mcp_returned_no_tools',
      canonical_status: tools.length ? 'READY' : 'BLOCKED',
    }
  } catch {
    return {
      mcp_reachable: false,
      tools: [],
      blocker: 'zapier_mcp_tools_list_failed',
      canonical_status: 'SERVICE_DOWN',
    }
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
  const readToolsTotal = allTools.filter((tool) => tool.write_classification === 'read').length
  const writeToolsTotal = allTools.filter((tool) => tool.write_classification === 'write').length
  const unknownToolsTotal = allTools.filter((tool) => tool.write_classification === 'unknown').length
  const blocker = allTools.length === 0
    ? (live.blocker || 'zapier_tool_inventory_not_visible')
    : null
  const warning = allTools.length > 0 && !live.mcp_reachable
    ? 'Zapier tools are shown from a cached snapshot. Live Zapier MCP is not reachable, and execution remains locked.'
    : allTools.length > 0
      ? 'Zapier tool inventory is visible. Tool execution remains locked until scoped owner approval and exact runner wiring.'
      : null
  const owner_status = describeOwnerFacingStatus({
    rawStatus: allTools.length > 0
      ? 'read_only'
      : live.canonical_status === 'CREDENTIAL_GATED'
        ? 'credential_required'
        : live.canonical_status === 'SERVICE_DOWN'
          ? 'service_down'
          : 'blocked',
    blockers: blocker ? [blocker] : [],
    configured: Boolean(zapierMcpUrl()) || allTools.length > 0,
    readEnabled: allTools.length > 0,
    writeEnabled: false,
    executionEnabled: false,
    requiresBridgeSession: true,
    preferReadyWhenReadable: true,
  })

  return {
    ok: true,
    canonical_status: owner_status.status,
    blocker_class: owner_status.blocker_class,
    owner_status,
    connected: allTools.length > 0,
    mcp_reachable: live.mcp_reachable,
    read_enabled: owner_status.can_read,
    tools_total: allTools.length,
    read_tools_total: readToolsTotal,
    write_tools_total: writeToolsTotal,
    unknown_tools_total: unknownToolsTotal,
    tools: filteredTools,
    heygen_found: heygenTools.length > 0,
    heygen_tools: heygenTools,
    exact_heygen_tool_name: preferred?.tool_name || null,
    required_fields: preferred?.required_fields || null,
    query: query || null,
    source,
    sources_checked: [
      zapierMcpUrl() ? 'mission_control_zapier_mcp_env_present' : 'mission_control_zapier_mcp_env_missing',
      existsSync(ZAPIER_TOOLS_TXT) ? 'cached_zapier_tools_snapshot_present' : 'cached_zapier_tools_snapshot_missing',
      existsSync(ZAPIER_PROVIDERS_JSON) ? 'cached_zapier_provider_snapshot_present' : 'cached_zapier_provider_snapshot_missing',
    ],
    last_checked_at: new Date().toISOString(),
    execution_enabled: false,
    writes_enabled: false,
    no_zapier_writes: true,
    bridge_session_required: true,
    approval_required_for_writes: true,
    allowed_owner_statuses: OWNER_FACING_STATUS_STATES,
    blocker,
    warning,
    next_action: heygenTools.length > 0
      ? 'Use the Zapier HeyGen path for video planning. Do not ask for direct HeyGen API keys first.'
      : 'HeyGen is not visible in Zapier MCP. Owner must connect HeyGen in Zapier, then rerun Zapier resync/tool discovery.',
  }
}
