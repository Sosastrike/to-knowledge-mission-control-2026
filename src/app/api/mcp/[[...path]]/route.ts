import { NextRequest, NextResponse } from 'next/server'
import {
  authJson,
  backendRequired,
  CatchAllParams,
  homePath,
  ownerApprovalRequired,
  readJsonIfPresent,
  routePath,
  safeExecFile,
} from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type McpServer = {
  name: string
  transport: string
  status: string
  source: string
  auth?: string
  tool_count?: number | null
  last_tested?: string | null
  error?: string | null
  visible_to?: { tony: boolean; sub_agents: boolean }
}

const MCP_CACHE_TTL_MS = 30_000
let cachedServers: { loadedAt: number; servers: McpServer[] } | null = null
let loadingServers: Promise<McpServer[]> | null = null

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

async function readMcpConfigFile(): Promise<McpServer[]> {
  const candidates = [
    homePath('.claude', 'mcp.json'),
    homePath('.config', 'claude', 'mcp.json'),
  ]
  const out: McpServer[] = []
  for (const candidate of candidates) {
    const json = await readJsonIfPresent(candidate) as { mcpServers?: Record<string, { command?: string; url?: string }>; servers?: Record<string, { command?: string; url?: string }> } | null
    const servers = json?.mcpServers || json?.servers
    if (!servers) continue
    for (const [name, cfg] of Object.entries(servers)) {
      out.push({
        name,
        transport: cfg.command ? 'stdio' : cfg.url ? 'http' : 'unknown',
        status: 'unknown',
        source: candidate,
      })
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
  const fromCliResult = await safeExecFile('claude', ['mcp', 'list'], 15000)
  // `claude mcp list` performs live health checks and can exit non-zero or
  // timeout when one provider is slow. Parse any stdout it returned so one
  // failing server does not make the whole Mission Control MCP panel empty.
  const fromCli = fromCliResult.stdout ? parseClaudeMcpList(fromCliResult.stdout) : []
  const fromConfig = await readMcpConfigFile()
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
    visible_to: { tony: true, sub_agents: false },
  }))
}

function tally(servers: McpServer[]) {
  return servers.reduce(
    (acc, server) => {
      acc.total += 1
      if (server.status === 'connected' || server.status === 'ok') acc.healthy += 1
      else if (server.status === 'degraded' || server.status === 'needs_auth') acc.degraded += 1
      else if (server.status === 'failed') acc.failed += 1
      else acc.unknown += 1
      return acc
    },
    { total: 0, healthy: 0, degraded: 0, failed: 0, unknown: 0 },
  )
}

export async function GET(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  const path = routePath((await params).path)
  const servers = await loadServers()
  const summary = tally(servers)
  if (!path || path === 'status') return NextResponse.json({ ok: true, ...summary })
  if (path === 'servers') {
    return NextResponse.json({
      ok: true,
      ...summary,
      summary,
      servers,
      sources_checked: ['claude-cli', '~/.claude/mcp.json', '~/.config/claude/mcp.json'],
      note: servers.length ? null : 'no_mcp_servers_detected',
    })
  }

  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'servers' && parts[1] && ['tools', 'resources'].includes(parts[2] || '')) {
    return backendRequired({
      server: parts[1],
      action: parts[2],
      note: 'Per-server MCP passthrough is not wired yet.',
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
