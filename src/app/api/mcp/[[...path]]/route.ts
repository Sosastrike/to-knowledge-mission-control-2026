import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import {
  NODE24_BIN,
  authJson,
  backendRequired,
  CatchAllParams,
  homePath,
  ownerApprovalRequired,
  readJsonIfPresent,
  routePath,
} from '@/lib/designer-module-api'
import { getMcpServerTools } from '@/lib/mcp-server-tool-schemas'
import { sanitizeBridgeProviderPayload } from '@/lib/bridge-provider-sanitizer'
import {
  buildMcpServerRegistryPayload,
  type McpDiscoverySummary,
  type McpServerRegistryInput,
} from '@/lib/mcp-server-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type McpServer = McpServerRegistryInput

const MCP_CACHE_TTL_MS = 30_000
let cachedServers: { loadedAt: number; servers: McpServer[] } | null = null
let loadingServers: Promise<McpServer[]> | null = null
let lastDiscovery: McpDiscoverySummary = null

function parseClaudeMcpList(stdout: string): McpServer[] {
  const servers: McpServer[] = []
  for (const raw of stdout.split('\n')) {
    const line = raw.trim()
    if (!line || /^name\s+/i.test(line) || /^checking\s+/i.test(line)) continue
    const human = line.match(/^(.+?):\s+(.+?)\s+-\s+([✓✗!])\s+(.+)$/)
    if (human) {
      const target = human[2].trim()
      const statusText = human[4].trim().toLowerCase()
      const status = human[3] === '✓'
        ? 'connected'
        : human[3] === '!' || statusText.includes('authentication')
          ? 'needs_auth'
          : 'failed'
      servers.push({
        name: human[1].trim(),
        transport: /^https?:\/\//i.test(target) ? 'http' : target.startsWith('npx ') ? 'stdio' : 'unknown',
        status,
        source: 'claude-cli',
      })
      continue
    }
    const compact = line.match(/^([a-zA-Z0-9_.-]+)\s+(\w+)\s+(\w+)/)
    if (!compact) continue
    servers.push({
      name: compact[1],
      transport: compact[2],
      status: compact[3].toLowerCase(),
      source: 'claude-cli',
    })
  }
  return servers
}

function redactedMcpConfigSource(candidate: string): string {
  if (candidate.endsWith('.claude.json')) return 'claude-json-mcp-config'
  return candidate.includes('/.config/') ? 'claude-config-mcp-config' : 'claude-user-mcp-config'
}

function addMcpConfigServers(
  out: McpServer[],
  servers: unknown,
  source: string,
) {
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) return
  for (const [name, cfg] of Object.entries(servers as Record<string, { command?: string; url?: string }>)) {
    out.push({
      name,
      transport: cfg.command ? 'stdio' : cfg.url ? 'http' : 'unknown',
      status: 'unknown',
      source,
    })
  }
}

async function readMcpConfigFile(): Promise<McpServer[]> {
  const candidates = [
    homePath('.claude', 'mcp.json'),
    homePath('.config', 'claude', 'mcp.json'),
    homePath('.claude.json'),
  ]
  const out: McpServer[] = []
  for (const candidate of candidates) {
    const json = await readJsonIfPresent(candidate) as {
      mcpServers?: Record<string, { command?: string; url?: string }>
      servers?: Record<string, { command?: string; url?: string }>
      projects?: Record<string, { mcpServers?: Record<string, { command?: string; url?: string }> }>
    } | null
    if (!json) continue
    const source = redactedMcpConfigSource(candidate)
    addMcpConfigServers(out, json.mcpServers || json.servers, source)
    if (json.projects && typeof json.projects === 'object') {
      for (const project of Object.values(json.projects)) {
        addMcpConfigServers(out, project?.mcpServers, source)
      }
    }
  }
  return out
}

async function loadServers(): Promise<McpServer[]> {
  const now = Date.now()
  if (cachedServers && now - cachedServers.loadedAt < MCP_CACHE_TTL_MS) {
    return cachedServers.servers
  }
  if (loadingServers) return loadingServers

  loadingServers = loadServersUncached()
    .then((servers) => {
      cachedServers = { loadedAt: Date.now(), servers }
      return servers
    })
    .finally(() => {
      loadingServers = null
    })

  return loadingServers
}

async function loadServersUncached(): Promise<McpServer[]> {
  const fromCliResult = await readClaudeMcpList()
  // `claude mcp list` performs live health checks and can exit non-zero or
  // timeout when one provider is slow. Parse any stdout it returned so one
  // failing server does not make the whole Mission Control MCP panel empty.
  const fromCli = fromCliResult.stdout ? parseClaudeMcpList(fromCliResult.stdout) : []
  const fromConfig = await readMcpConfigFile()
  lastDiscovery = {
    cli_ok: fromCliResult.ok,
    cli_stdout_length: fromCliResult.stdout.length,
    cli_stderr_length: fromCliResult.stderr.length,
    cli_error: fromCliResult.error || null,
    fallback_used: fromCliResult.fallback_used,
    config_servers_found: fromConfig.length,
  }
  const merged = new Map<string, McpServer>()
  for (const server of fromCli) merged.set(server.name, server)
  for (const server of fromConfig) if (!merged.has(server.name)) merged.set(server.name, server)
  return Array.from(merged.values()).map((server) => ({
    ...server,
    auth: 'unknown',
    tool_count: null,
    last_tested: null,
    error: server.status === 'failed'
      ? 'failed_to_connect'
      : server.status === 'needs_auth'
        ? 'authentication_required'
        : null,
    visible_to: { owner: true, sub_agents: false },
  }))
}

function runtimeCwd() {
  return process.env.MISSION_CONTROL_ROOT || process.cwd()
}

function runtimePath() {
  const entries = [
    process.env.CLAUDE_BIN_DIR,
    NODE24_BIN,
    process.env.PATH || '',
  ].filter(Boolean)
  return entries.join(':')
}

function candidateClaudeCommands() {
  const candidates = [
    process.env.CLAUDE_BIN,
    `${NODE24_BIN}/claude`,
    'claude',
  ].filter((candidate): candidate is string => Boolean(candidate))

  return Array.from(new Set(candidates))
}

function execFileText(command: string, args: string[], timeout: number, shellFallback = false) {
  return new Promise<{ ok: boolean; stdout: string; stderr: string; error?: string; fallback_used: boolean }>((resolve) => {
    if (command.includes('/') && !existsSync(command)) {
      resolve({
        ok: false,
        stdout: '',
        stderr: '',
        error: `command_not_found: ${command}`,
        fallback_used: shellFallback,
      })
      return
    }

    execFile(
      command,
      args,
      {
        cwd: runtimeCwd(),
        timeout,
        env: {
          ...process.env,
          PATH: runtimePath(),
        },
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          error: error ? String(error.message || 'command_failed').slice(0, 500) : undefined,
          fallback_used: shellFallback,
        })
      },
    )
  })
}

async function readClaudeMcpList() {
  let lastResult: Awaited<ReturnType<typeof execFileText>> | null = null
  for (const command of candidateClaudeCommands()) {
    const result = await execFileText(command, ['mcp', 'list'], 20000)
    lastResult = result
    if (result.stdout.trim()) return result
  }

  // Some production shells initialize Claude plugin paths differently. This is
  // still read-only; it lists MCP servers and never invokes tools.
  const fallback = await execFileText('/bin/bash', ['-lc', 'claude mcp list'], 25000, true)
  return fallback.stdout.trim() ? fallback : (lastResult || fallback)
}

export async function GET(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  const path = routePath((await params).path)
  const servers = await loadServers()
  const registry = buildMcpServerRegistryPayload({ servers, discovery: lastDiscovery })
  const summary = registry.summary
  if (!path || path === 'status') {
    return NextResponse.json({
      ok: true,
      ...summary,
      canonical_status: registry.canonical_status,
      blocker_class: registry.blocker_class,
      blocker: registry.blocker,
      allowed_owner_statuses: registry.allowed_owner_statuses,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
    })
  }
  if (path === 'list' || path === 'servers') {
    return NextResponse.json({
      ok: true,
      ...summary,
      summary,
      servers: registry.servers,
      canonical_status: registry.canonical_status,
      blocker_class: registry.blocker_class,
      blocker: registry.blocker,
      owner_status_summary: registry.owner_status_summary,
      allowed_owner_statuses: registry.allowed_owner_statuses,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
      authoritative_route: '/api/mcp/list',
      compatibility_routes: ['/api/mcp/status', '/api/mcp/servers'],
      sources_checked: ['claude-cli', 'claude-user-mcp-config', 'claude-config-mcp-config', 'claude-json-mcp-config'],
      discovery: registry.discovery,
      note: servers.length ? null : 'no_mcp_servers_detected',
    })
  }

  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'servers' && parts[1] && parts[2] === 'tools') {
    const result = await getMcpServerTools(parts[1])
    return NextResponse.json(sanitizeBridgeProviderPayload({
      ...result,
      endpoint: `/api/mcp/servers/${parts[1]}/tools`,
      route_state: result.ok ? 'read_only_live_schema_passthrough' : 'read_only_schema_passthrough_unavailable',
      note: result.ok ? 'Read-only MCP tools/list only. No MCP tool was invoked.' : result.next_action,
    }), { status: result.ok ? 200 : 503 })
  }

  if (parts[0] === 'servers' && parts[1] && parts[2] === 'resources') {
    return backendRequired({
      server: parts[1],
      action: parts[2],
      source: '/api/mcp/list',
      route_state: 'read_only_passthrough_not_wired',
      blocker: 'Mission Control can list MCP servers and HTTP tool schemas read-only, but per-server resource passthrough is not wired yet.',
      next_action: 'Use /api/mcp/list for server visibility and provider-specific read-only inventory routes until live passthrough is approved and implemented.',
      note: 'No MCP tool was invoked.',
    })
  }

  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}

export async function POST(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'operator')
  if (auth) return auth

  const path = routePath((await params).path)
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'servers' && parts[1] && parts[2] === 'test') {
    const started = Date.now()
    const servers = await loadServers()
    const found = servers.find((server) => server.name === parts[1])
    if (!found) return NextResponse.json({ ok: false, error: 'server_not_found' }, { status: 404 })
    return NextResponse.json({
      ok: ['connected', 'ok'].includes(found.status),
      latency_ms: Date.now() - started,
      status: found.status,
      error: found.error,
    })
  }
  if (parts[0] === 'servers' && parts[1] && ['enable', 'disable', 'reauth'].includes(parts[2] || '')) {
    return ownerApprovalRequired({
      server: parts[1],
      action: parts[2],
      next_action: 'Owner approval plus MCP config write and restart required.',
    })
  }

  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}
