export type PlaywrightMcpStatus = {
  ok: boolean
  mode: 'playwright_mcp_status'
  status: 'connected' | 'blocked'
  service_name: 'playwright-mcp.service'
  endpoint: 'localhost:8931/mcp'
  service_endpoint: '127.0.0.1:8931'
  mcp_endpoint: 'http://127.0.0.1:8931/mcp'
  service_status: 'connected_local_only' | 'blocked'
  transport: 'streamable_http'
  bind_host: '127.0.0.1'
  local_only: true
  public_exposure: false
  browser_mode: 'headless_firefox_isolated'
  execution_enabled: false
  writes_enabled: false
  bridge_session_required_for_interactive_actions: true
  authenticated_browsing_requires_owner_approval: true
  tool_count: number
  tools: string[]
  required_tools_present: boolean
  blocker: string | null
  last_error: string | null
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export type BrowserEvidencePacket = {
  ok: boolean
  mode: 'space_agent_playwright_mcp_browser_evidence_packet'
  packet_id: string
  requested_url: string
  status: 'completed' | 'blocked'
  service: PlaywrightMcpStatus
  evidence: {
    snapshot_available: boolean
    snapshot_contains_requested_page: boolean
    console_available: boolean
    network_available: boolean
    screenshot_available: boolean
    snapshot_excerpt: string
  }
  blocker: string | null
  route: {
    source: 'owner'
    gateway: 'gateway'
    commander: 'agent_zero'
    research_agent: 'space_agent'
    tool_server: 'playwright_mcp'
    return_to: 'agent_zero'
  }
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  bridge_session_required: boolean
  no_secrets_exposed: true
  raw_paths_exposed: false
}

const MCP_ENDPOINT = 'http://localhost:8931/mcp'
const SAFE_DEFAULT_URL = 'https://example.com'
const REQUIRED_TOOLS = ['browser_navigate', 'browser_snapshot', 'browser_take_screenshot', 'browser_console_messages', 'browser_network_requests']

type JsonRpcPayload = Record<string, unknown>

export async function getPlaywrightMcpStatus(): Promise<PlaywrightMcpStatus> {
  try {
    const client = await createMcpClient()
    const tools = await listTools(client)
    const names = tools.map((tool) => sanitizeText(tool.name || '')).filter(Boolean)
    const requiredToolsPresent = REQUIRED_TOOLS.every((tool) => names.includes(tool))
    return {
      ok: requiredToolsPresent,
      mode: 'playwright_mcp_status',
      status: requiredToolsPresent ? 'connected' : 'blocked',
      service_name: 'playwright-mcp.service',
      endpoint: 'localhost:8931/mcp',
      service_endpoint: '127.0.0.1:8931',
      mcp_endpoint: 'http://127.0.0.1:8931/mcp',
      service_status: requiredToolsPresent ? 'connected_local_only' : 'blocked',
      transport: 'streamable_http',
      bind_host: '127.0.0.1',
      local_only: true,
      public_exposure: false,
      browser_mode: 'headless_firefox_isolated',
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required_for_interactive_actions: true,
      authenticated_browsing_requires_owner_approval: true,
      tool_count: names.length,
      tools: names,
      required_tools_present: requiredToolsPresent,
      blocker: requiredToolsPresent ? null : 'playwright_mcp_required_tools_missing',
      last_error: null,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    }
  } catch (error) {
    return blockedStatus(error instanceof Error ? error.message : 'playwright_mcp_unreachable')
  }
}

export async function createPlaywrightBrowserEvidencePacket(input: {
  url?: string
  generatedAt?: string
} = {}): Promise<BrowserEvidencePacket> {
  const requestedUrl = input.url?.trim() || SAFE_DEFAULT_URL
  const validation = validateSafeReadOnlyUrl(requestedUrl)
  const service = await getPlaywrightMcpStatus()
  const packetId = normalizeId(`playwright_mcp_${input.generatedAt || new Date().toISOString()}_${requestedUrl}`)

  if (!validation.ok) {
    return evidenceBlocked(packetId, requestedUrl, service, validation.blocker, true)
  }
  if (!service.ok) {
    return evidenceBlocked(packetId, requestedUrl, service, service.blocker || 'playwright_mcp_service_blocked', false)
  }

  try {
    const client = await createMcpClient()
    const navigate = await callTool(client, 'browser_navigate', { url: requestedUrl })
    if (navigate.error || Boolean(navigate.result?.isError)) {
      return evidenceBlocked(packetId, requestedUrl, service, 'playwright_mcp_navigation_failed', false)
    }
    const snapshot = await callTool(client, 'browser_snapshot', {})
    const consoleMessages = await callTool(client, 'browser_console_messages', {})
    const networkRequests = await callTool(client, 'browser_network_requests', {})
    const screenshot = await callTool(client, 'browser_take_screenshot', {})
    const snapshotText = sanitizeText(JSON.stringify(snapshot.result || {}))
    const host = new URL(requestedUrl).hostname.replace(/^www\./, '')

    return {
      ok: !snapshot.error,
      mode: 'space_agent_playwright_mcp_browser_evidence_packet',
      packet_id: packetId,
      requested_url: sanitizeUrl(requestedUrl),
      status: snapshot.error ? 'blocked' : 'completed',
      service,
      evidence: {
        snapshot_available: !snapshot.error && snapshotText.length > 0,
        snapshot_contains_requested_page: snapshotText.toLowerCase().includes(host.toLowerCase()) || /example domain/i.test(snapshotText),
        console_available: !consoleMessages.error,
        network_available: !networkRequests.error,
        screenshot_available: !screenshot.error,
        snapshot_excerpt: snapshotText.slice(0, 500),
      },
      blocker: snapshot.error ? 'playwright_mcp_snapshot_failed' : null,
      route: PLAYWRIGHT_ROUTE,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      bridge_session_required: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    }
  } catch (error) {
    return evidenceBlocked(packetId, requestedUrl, service, error instanceof Error ? error.message : 'playwright_mcp_evidence_failed', false)
  }
}


export type PlaywrightMcpSmokePayload = {
  ok: boolean
  mode: 'playwright_mcp_mission_control_smoke'
  generated_at: string
  status: 'passed' | 'blocked'
  target_url: string
  service: PlaywrightMcpStatus
  evidence: BrowserEvidencePacket
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  no_public_exposure: true
  no_secrets_exposed: true
  raw_paths_exposed: false
  blocker: string | null
}

export type PlaywrightMcpEvidenceIndexPayload = {
  ok: true
  mode: 'playwright_mcp_browser_evidence_index'
  generated_at: string
  latest_evidence_packet: 'pending_production_smoke'
  latest_snapshot: 'pending_production_smoke'
  latest_console: 'pending_production_smoke'
  latest_network: 'pending_production_smoke'
  smoke_route: '/api/bridge/playwright-mcp/smoke'
  status_route: '/api/bridge/playwright-mcp/status'
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  no_public_exposure: true
  no_secrets_exposed: true
  raw_paths_exposed: false
  blocker: 'production_smoke_result_not_persisted_yet'
}

export async function runPlaywrightMcpMissionControlSmoke(input: { url?: string; generatedAt?: string } = {}): Promise<PlaywrightMcpSmokePayload> {
  const generatedAt = input.generatedAt || new Date().toISOString()
  const targetUrl = input.url?.trim() || 'https://mc.knowledge-vs-ai.com/login'
  const evidence = await createPlaywrightBrowserEvidencePacket({ url: targetUrl, generatedAt })
  return {
    ok: evidence.ok,
    mode: 'playwright_mcp_mission_control_smoke',
    generated_at: generatedAt,
    status: evidence.ok ? 'passed' : 'blocked',
    target_url: sanitizeUrl(targetUrl),
    service: evidence.service,
    evidence,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_public_exposure: true,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    blocker: evidence.blocker,
  }
}

export function getPlaywrightMcpEvidenceIndex(generatedAt = new Date().toISOString()): PlaywrightMcpEvidenceIndexPayload {
  return {
    ok: true,
    mode: 'playwright_mcp_browser_evidence_index',
    generated_at: generatedAt,
    latest_evidence_packet: 'pending_production_smoke',
    latest_snapshot: 'pending_production_smoke',
    latest_console: 'pending_production_smoke',
    latest_network: 'pending_production_smoke',
    smoke_route: '/api/bridge/playwright-mcp/smoke',
    status_route: '/api/bridge/playwright-mcp/status',
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_public_exposure: true,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
    blocker: 'production_smoke_result_not_persisted_yet',
  }
}

function blockedStatus(message: string): PlaywrightMcpStatus {
  return {
    ok: false,
    mode: 'playwright_mcp_status',
    status: 'blocked',
    service_name: 'playwright-mcp.service',
    endpoint: 'localhost:8931/mcp',
    service_endpoint: '127.0.0.1:8931',
    mcp_endpoint: 'http://127.0.0.1:8931/mcp',
    service_status: 'blocked',
    transport: 'streamable_http',
    bind_host: '127.0.0.1',
    local_only: true,
    public_exposure: false,
    browser_mode: 'headless_firefox_isolated',
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required_for_interactive_actions: true,
    authenticated_browsing_requires_owner_approval: true,
    tool_count: 0,
    tools: [],
    required_tools_present: false,
    blocker: 'playwright_mcp_service_unreachable',
    last_error: sanitizeText(message),
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

function evidenceBlocked(packetId: string, requestedUrl: string, service: PlaywrightMcpStatus, blocker: string, bridgeSessionRequired: boolean): BrowserEvidencePacket {
  return {
    ok: false,
    mode: 'space_agent_playwright_mcp_browser_evidence_packet',
    packet_id: packetId,
    requested_url: sanitizeUrl(requestedUrl),
    status: 'blocked',
    service,
    evidence: {
      snapshot_available: false,
      snapshot_contains_requested_page: false,
      console_available: false,
      network_available: false,
      screenshot_available: false,
      snapshot_excerpt: '',
    },
    blocker: sanitizeText(blocker),
    route: PLAYWRIGHT_ROUTE,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    bridge_session_required: bridgeSessionRequired,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

const PLAYWRIGHT_ROUTE = {
  source: 'owner',
  gateway: 'gateway',
  commander: 'agent_zero',
  research_agent: 'space_agent',
  tool_server: 'playwright_mcp',
  return_to: 'agent_zero',
} as const

async function createMcpClient() {
  const init = await postMcp({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mission-control-gateway', version: '1.0.0' },
    },
  })
  if (!init.sessionId) throw new Error('playwright_mcp_session_id_missing')
  await postMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, init.sessionId)
  return { sessionId: init.sessionId }
}

async function listTools(client: { sessionId: string }) {
  const response = await postMcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, client.sessionId)
  const tools = response.payload?.result && typeof response.payload.result === 'object'
    ? (response.payload.result as { tools?: Array<{ name?: string }> }).tools
    : []
  return Array.isArray(tools) ? tools : []
}

async function callTool(client: { sessionId: string }, name: string, args: Record<string, unknown>) {
  const response = await postMcp({
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 1_000_000) + 10,
    method: 'tools/call',
    params: { name, arguments: args },
  }, client.sessionId, 20_000)
  return response.payload || {}
}

async function postMcp(body: JsonRpcPayload, sessionId?: string, timeoutMs = 8_000): Promise<{ sessionId: string | null; payload: Record<string, any> | null }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    }
    if (sessionId) headers['mcp-session-id'] = sessionId
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`playwright_mcp_http_${response.status}`)
    return {
      sessionId: response.headers.get('mcp-session-id') || sessionId || null,
      payload: parseSsePayload(text),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function parseSsePayload(text: string): Record<string, any> | null {
  const line = text.split(/\r?\n/).find((item) => item.startsWith('data:'))
  if (!line) return null
  try {
    return JSON.parse(line.slice(5).trim())
  } catch {
    return null
  }
}

function validateSafeReadOnlyUrl(value: string): { ok: true } | { ok: false; blocker: string } {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { ok: false, blocker: 'invalid_url' }
  }
  if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, blocker: 'unsupported_url_protocol' }
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return { ok: false, blocker: 'bridge_session_required_for_local_or_authenticated_browser_target' }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|100\.)/.test(host)) return { ok: false, blocker: 'bridge_session_required_for_private_network_browser_target' }
  return { ok: true }
}

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    url.hash = ''
    return url.toString()
  } catch {
    return sanitizeText(value)
  }
}

function sanitizeText(value: string) {
  return String(value || '')
    .replace(/sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?FILE|COOKIE|STORAGE[_-]?STATE)\s*[:=]\s*[^,\s}"']+/gi, '[redacted-secret]')
    .replace(/(?:\/(?:home|Users|a0|tmp|var|private)\/|[A-Z]:\\)[^\s`'"\])}]*/gi, '[redacted-path]')
    .trim()
}

function normalizeId(value: string) {
  return sanitizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'playwright_mcp_packet'
}
