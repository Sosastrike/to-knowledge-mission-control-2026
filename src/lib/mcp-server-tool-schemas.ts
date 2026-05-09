import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

export type McpToolWriteClassification = 'read' | 'write' | 'unknown'

type McpHttpServer = {
  type: 'http'
  url: string
  headers?: Record<string, string>
}

type McpServer = McpHttpServer | {
  type?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
}

type RawMcpTool = {
  name?: string
  description?: string
  inputSchema?: {
    type?: string
    required?: unknown
    properties?: Record<string, unknown>
  }
}

export type McpToolSchemaProperty = {
  name: string
  type: string | null
  description: string | null
  enum_values: string[] | null
}

export type McpServerToolRecord = {
  raw_tool_name: string
  tool_name: string
  description: string | null
  write_classification: McpToolWriteClassification
  approval_required: boolean
  execution_enabled: false
  writes_enabled: false
  required_fields: string[]
  schema_available: boolean
  input_schema: {
    type: string | null
    required_fields: string[]
    properties: McpToolSchemaProperty[]
  } | null
}

export type McpServerToolsResult = {
  ok: boolean
  status: 'live' | 'unavailable'
  server: string
  mcp_reachable: boolean
  tools_total: number
  tools: McpServerToolRecord[]
  source: 'claude_mcp_oauth_cache' | 'server_authorization_header' | 'server_token_query' | null
  credentials_source: string | null
  auth_attached: boolean
  auth_redacted: true
  execution_enabled: false
  writes_enabled: false
  no_tool_invocation: true
  error?: string
  blocker?: string
  next_action?: string
}

const CREDENTIALS_PATH = path.join(homedir(), '.claude', '.credentials.json')
const CLAUDE_JSON_PATH = path.join(homedir(), '.claude.json')

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isHttpServer(server: McpServer): server is McpHttpServer {
  return server.type === 'http' && 'url' in server && typeof server.url === 'string'
}

function normalizeServerId(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeMcpServer(value: unknown): McpServer | null {
  if (!isRecord(value)) return null
  if (typeof value.url === 'string') {
    const declaredType = typeof value.type === 'string' ? value.type.toLowerCase() : 'http'
    if (declaredType === 'http' || declaredType === 'sse') {
      return {
        type: declaredType,
        url: value.url,
        ...(isRecord(value.headers) ? { headers: value.headers as Record<string, string> } : {}),
      } as McpServer
    }
  }
  if (typeof value.command === 'string') {
    return {
      command: value.command,
      ...(Array.isArray(value.args) ? { args: value.args as string[] } : {}),
      ...(isRecord(value.env) ? { env: value.env as Record<string, string> } : {}),
    }
  }
  return null
}

function readClaudeMcpServers(): Record<string, McpServer> {
  if (!existsSync(CLAUDE_JSON_PATH)) return {}

  try {
    const raw = JSON.parse(readFileSync(CLAUDE_JSON_PATH, 'utf8'))
    const merged: Record<string, McpServer> = {}

    const addServers = (servers: unknown) => {
      if (!isRecord(servers)) return
      for (const [name, cfg] of Object.entries(servers)) {
        const normalized = normalizeMcpServer(cfg)
        if (normalized) merged[name] = normalized
      }
    }

    addServers(raw?.mcpServers)
    const projects = isRecord(raw?.projects) ? raw.projects : {}
    for (const project of Object.values(projects)) {
      addServers(isRecord(project) ? project.mcpServers : null)
    }

    return merged
  } catch {
    return {}
  }
}

function hasAuthHeader(headers: Record<string, string> | undefined): boolean {
  if (!headers) return false
  return Object.entries(headers).some(([key, value]) => key.toLowerCase() === 'authorization' && Boolean(value?.trim()))
}

function hasTokenQuery(url: string): boolean {
  try {
    const parsed = new URL(url)
    return Boolean(parsed.searchParams.get('token') || parsed.searchParams.get('access_token'))
  } catch {
    return false
  }
}

function sameMcpEndpoint(a: string, b: string): boolean {
  try {
    const left = new URL(a)
    const right = new URL(b)
    return left.hostname === right.hostname && left.pathname.replace(/\/$/, '') === right.pathname.replace(/\/$/, '')
  } catch {
    return a === b
  }
}

function readJson(pathname: string): unknown | null {
  try {
    return JSON.parse(readFileSync(pathname, 'utf8'))
  } catch {
    return null
  }
}

function findMcpOauthToken(serverName: string, serverUrl: string): string | null {
  const credentials = readJson(CREDENTIALS_PATH)
  if (!isRecord(credentials) || !isRecord(credentials.mcpOAuth)) return null

  for (const [entryKey, entryValue] of Object.entries(credentials.mcpOAuth)) {
    if (!isRecord(entryValue)) continue
    const entryServerName = typeof entryValue.serverName === 'string' ? entryValue.serverName.toLowerCase() : ''
    const entryServerUrl = typeof entryValue.serverUrl === 'string' ? entryValue.serverUrl : ''
    const keyMatches = entryKey.toLowerCase().startsWith(`${serverName.toLowerCase()}|`) || entryServerName === serverName.toLowerCase()
    const urlMatches = entryServerUrl ? sameMcpEndpoint(entryServerUrl, serverUrl) : false
    if (!keyMatches && !urlMatches) continue

    const expiresAt = typeof entryValue.expiresAt === 'number' ? entryValue.expiresAt : null
    if (expiresAt !== null && expiresAt <= Date.now() + 30_000) return null

    const token = entryValue.accessToken ?? entryValue.access_token ?? entryValue.token
    return typeof token === 'string' && token.trim() ? token.trim() : null
  }

  return null
}

function withAuth(serverName: string, server: McpHttpServer): {
  ok: boolean
  server: McpHttpServer
  source: McpServerToolsResult['source']
  reason?: string
} {
  if (hasAuthHeader(server.headers)) return { ok: true, server, source: 'server_authorization_header' }
  if (hasTokenQuery(server.url)) return { ok: true, server, source: 'server_token_query' }

  const token = findMcpOauthToken(serverName, server.url)
  if (!token) {
    return {
      ok: false,
      server,
      source: null,
      reason: `No non-expired Claude MCP OAuth token is available for ${serverName}. Re-authenticate the MCP server in Claude Code.`,
    }
  }

  return {
    ok: true,
    server: {
      ...server,
      headers: {
        ...(server.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    },
    source: 'claude_mcp_oauth_cache',
  }
}

function parseMcpResponse(text: string, contentType: string): unknown {
  if (contentType.includes('text/event-stream')) {
    const data = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== '[DONE]')
      .join('\n')
    if (!data) return null
    return JSON.parse(data)
  }
  if (!text.trim()) return null
  return JSON.parse(text)
}

async function mcpPost(server: McpHttpServer, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(server.url, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...(server.headers ?? {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  const text = await response.text()
  const payload = parseMcpResponse(text, response.headers.get('content-type') || '')
  if (!response.ok) throw new Error(`MCP HTTP ${response.status}`)
  if (isRecord(payload) && payload.error) throw new Error('MCP JSON-RPC error')
  return isRecord(payload) && 'result' in payload ? payload.result : payload
}

function classifyTool(name: string, description?: string | null): McpToolWriteClassification {
  const text = `${name} ${description || ''}`.toLowerCase()
  if (/\b(create|update|delete|remove|send|post|upload|run|execute|trigger|publish|invite|move|set|enable|disable|approve|revoke|translate|cancel|add|copy|rename|replace|clear|archive)\b/.test(text)) return 'write'
  if (/\b(get|list|search|find|lookup|retrieve|read|fetch|query|inspect|describe|status|history|check)\b/.test(text)) return 'read'
  return 'unknown'
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function schemaType(value: unknown): string | null {
  return isRecord(value) && typeof value.type === 'string' ? value.type : null
}

function schemaDescription(value: unknown): string | null {
  if (!isRecord(value) || typeof value.description !== 'string') return null
  return value.description.length > 500 ? `${value.description.slice(0, 500)}...` : value.description
}

function schemaEnum(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.enum)) return null
  const values = value.enum.filter((item): item is string => typeof item === 'string').slice(0, 50)
  return values.length ? values : null
}

function sanitizeTool(serverName: string, tool: RawMcpTool): McpServerToolRecord | null {
  const rawName = typeof tool.name === 'string' ? tool.name.trim() : ''
  if (!rawName) return null
  const description = typeof tool.description === 'string' ? tool.description : null
  const requiredFields = stringArray(tool.inputSchema?.required)
  const properties = tool.inputSchema?.properties && isRecord(tool.inputSchema.properties)
    ? Object.entries(tool.inputSchema.properties).map(([name, value]) => ({
      name,
      type: schemaType(value),
      description: schemaDescription(value),
      enum_values: schemaEnum(value),
    }))
    : []
  const classification = classifyTool(rawName, description)
  return {
    raw_tool_name: rawName,
    tool_name: rawName.startsWith('mcp__') ? rawName : `mcp__${serverName}__${rawName}`,
    description,
    write_classification: classification,
    approval_required: classification !== 'read',
    execution_enabled: false,
    writes_enabled: false,
    required_fields: requiredFields,
    schema_available: Boolean(tool.inputSchema),
    input_schema: tool.inputSchema
      ? {
        type: tool.inputSchema.type || null,
        required_fields: requiredFields,
        properties,
      }
      : null,
  }
}

export async function getMcpServerTools(serverId: string): Promise<McpServerToolsResult> {
  const serverName = normalizeServerId(serverId)
  const servers = readClaudeMcpServers()
  const server = servers[serverName]

  if (!server) {
    return {
      ok: false,
      status: 'unavailable',
      server: serverName,
      mcp_reachable: false,
      tools_total: 0,
      tools: [],
      source: null,
      credentials_source: null,
      auth_attached: false,
      auth_redacted: true,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
      error: 'mcp_server_not_configured',
      blocker: `MCP server ${serverName} is not present in the Claude MCP configuration.`,
      next_action: 'Connect or resync the MCP server in Claude Code, then retry this read-only route.',
    }
  }

  if (!isHttpServer(server)) {
    return {
      ok: false,
      status: 'unavailable',
      server: serverName,
      mcp_reachable: false,
      tools_total: 0,
      tools: [],
      source: null,
      credentials_source: null,
      auth_attached: false,
      auth_redacted: true,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
      error: 'mcp_server_not_http',
      blocker: `MCP server ${serverName} is configured, but read-only HTTP tools/list passthrough only supports HTTP MCP servers.`,
      next_action: 'Use Claude CLI MCP discovery for non-HTTP servers.',
    }
  }

  const auth = withAuth(serverName, server)
  if (!auth.ok) {
    return {
      ok: false,
      status: 'unavailable',
      server: serverName,
      mcp_reachable: false,
      tools_total: 0,
      tools: [],
      source: auth.source,
      credentials_source: 'claude_oauth_cache',
      auth_attached: false,
      auth_redacted: true,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
      error: 'mcp_auth_missing',
      blocker: auth.reason || 'MCP OAuth token is missing.',
      next_action: `Re-authenticate ${serverName} in Claude Code. No tools were invoked.`,
    }
  }

  try {
    const result = await mcpPost(auth.server, {
      jsonrpc: '2.0',
      id: 'mission-control-tools-list',
      method: 'tools/list',
      params: {},
    }) as { tools?: RawMcpTool[] }
    const tools = Array.isArray(result?.tools)
      ? result.tools.map((tool) => sanitizeTool(serverName, tool)).filter((tool): tool is McpServerToolRecord => Boolean(tool))
      : []
    return {
      ok: true,
      status: 'live',
      server: serverName,
      mcp_reachable: true,
      tools_total: tools.length,
      tools,
      source: auth.source,
      credentials_source: 'claude_oauth_cache',
      auth_attached: true,
      auth_redacted: true,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
    }
  } catch (error) {
    return {
      ok: false,
      status: 'unavailable',
      server: serverName,
      mcp_reachable: false,
      tools_total: 0,
      tools: [],
      source: auth.source,
      credentials_source: 'claude_oauth_cache',
      auth_attached: true,
      auth_redacted: true,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
      error: 'mcp_tools_list_failed',
      blocker: error instanceof Error ? error.message : 'MCP tools/list failed.',
      next_action: 'Retry after confirming MCP server health. No tools were invoked.',
    }
  }
}
