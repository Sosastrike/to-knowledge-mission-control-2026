import { describe, expect, it } from 'vitest'
import { buildSpaceAgentBrowserAutomationPayload } from './space-agent-browser-automation'
import { buildPlaywrightMcpClosureSummary, type PlaywrightMcpStatus } from './playwright-mcp'

const connectedPlaywright: PlaywrightMcpStatus = {
  ok: true,
  mode: 'playwright_mcp_status',
  status: 'connected',
  canonical_status: 'LIVE',
  blocker_class: 'NONE',
  service_name: 'playwright-mcp.service',
  endpoint: 'localhost:8931/mcp',
  service_endpoint: '127.0.0.1:8931',
  mcp_endpoint: 'http://127.0.0.1:8931/mcp',
  service_status: 'connected_local_only',
  transport: 'streamable_http',
  bind_host: '127.0.0.1',
  local_only: true,
  public_exposure: false,
  browser_mode: 'headless_firefox_isolated',
  execution_enabled: false,
  writes_enabled: false,
  bridge_session_required_for_interactive_actions: true,
  authenticated_browsing_requires_owner_approval: true,
  tool_count: 5,
  tools: ['browser_navigate', 'browser_snapshot', 'browser_take_screenshot', 'browser_console_messages', 'browser_network_requests'],
  required_tools_present: true,
  blocker: null,
  last_error: null,
  no_secrets_exposed: true,
  raw_paths_exposed: false,
  proof_packet: {
    lane: 'SpaceAgent Playwright MCP',
    timestamp: '2026-05-07T00:00:00.000Z',
    runtime_commit: null,
    route_or_service_checked: '/api/bridge/playwright-mcp/status',
    result: 'LIVE',
    blocker: null,
    blocker_class: 'NONE',
    audit_pointer: '/api/bridge/playwright-mcp/status',
    safe_log_pointer: null,
    rollback_command: 'git revert <day-06-spaceagent-playwright-commit>',
    tool_server: 'playwright_mcp',
    service_endpoint: '127.0.0.1:8931',
    local_only: true,
    public_exposure: false,
    execution_enabled: false,
    writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  },
}

describe('SpaceAgent browser automation truth payload', () => {
  it('shows Playwright MCP as a connected local-only tool and keeps Firecrawl/YouTube truthful', () => {
    const payload = buildSpaceAgentBrowserAutomationPayload({
      generatedAt: '2026-05-07T00:00:00.000Z',
      playwrightMcp: connectedPlaywright,
    })
    const playwright = payload.cards.find((card) => card.id === 'playwright_mcp')
    const firecrawl = payload.cards.find((card) => card.id === 'firecrawl')
    const youtube = payload.cards.find((card) => card.id === 'youtube_research')

    expect(payload.architecture_rule).toBe('SpaceAgent is the agent; Playwright MCP is the browser automation tool used by SpaceAgent through Gateway policy.')
    expect(playwright).toMatchObject({
      status: 'connected_local_only',
      tone: 'green',
      installed: true,
      configured: true,
      connected: true,
      service_endpoint: '127.0.0.1:8931',
      mcp_endpoint: 'http://127.0.0.1:8931/mcp',
      public_exposure: false,
      bridge_required_for_interactive: true,
      bridge_required_for_authenticated: true,
      blocker: null,
    })
    expect(firecrawl).toMatchObject({ status: 'blocked', blocker: 'firecrawl_credential_required' })
    expect(youtube).toMatchObject({ status: 'limited_pending', blocker: 'youtube_transcript_connector_not_proven' })
    expect(payload.execution_enabled).toBe(false)
    expect(payload.writes_enabled).toBe(false)
    expect(payload.external_writes_enabled).toBe(false)
  })

  it('does not keep showing the stale YouTube blocker once the transcript connector is proven', () => {
    const payload = buildSpaceAgentBrowserAutomationPayload({
      generatedAt: '2026-05-07T00:00:00.000Z',
      playwrightMcp: connectedPlaywright,
      youtubeTranscriptConnectorProven: true,
    })
    const youtube = payload.cards.find((card) => card.id === 'youtube_research')

    expect(youtube).toMatchObject({
      status: 'limited_pending',
      blocker: null,
      configured: true,
      summary: 'Metadata/transcript connector is proven for read-only public video research. Full video download stays blocked.',
    })
    expect(JSON.stringify(youtube)).not.toContain('not proven')
  })

  it('keeps enabled buttons mapped to real routes and disables gated actions with blockers', () => {
    const payload = buildSpaceAgentBrowserAutomationPayload({ generatedAt: '2026-05-07T00:00:00.000Z', playwrightMcp: connectedPlaywright })

    for (const button of payload.safe_read_only_buttons) {
      expect(button.state).toBe('enabled')
      expect(button.route).toMatch(/^\/api\//)
      expect(button.blocker).toBeNull()
      expect(button.bridge_session_required).toBe(false)
    }
    for (const button of payload.gated_buttons) {
      expect(button.state).toBe('requires_bridge_session')
      expect(button.route).toBeNull()
      expect(button.blocker).toMatch(/^bridge_session_required_/)
      expect(button.bridge_session_required).toBe(true)
    }
  })

  it('classifies Playwright MCP closure states without enabling execution', () => {
    const live = buildPlaywrightMcpClosureSummary({
      ok: true,
      requiredToolsPresent: true,
      blocker: null,
      timestamp: '2026-05-07T00:00:00.000Z',
    })
    const serviceDown = buildPlaywrightMcpClosureSummary({
      ok: false,
      requiredToolsPresent: false,
      blocker: 'playwright_mcp_service_unreachable',
      timestamp: '2026-05-07T00:00:00.000Z',
    })
    const blocked = buildPlaywrightMcpClosureSummary({
      ok: false,
      requiredToolsPresent: false,
      blocker: 'playwright_mcp_required_tools_missing',
      timestamp: '2026-05-07T00:00:00.000Z',
    })

    expect(live).toMatchObject({
      canonical_status: 'LIVE',
      blocker_class: 'NONE',
      blocker: null,
      proof_packet: { lane: 'SpaceAgent Playwright MCP', result: 'LIVE', execution_enabled: false, writes_enabled: false },
    })
    expect(serviceDown).toMatchObject({
      canonical_status: 'SERVICE_DOWN',
      blocker_class: 'SERVICE_DOWN',
      blocker: 'playwright_mcp_service_unreachable',
    })
    expect(blocked).toMatchObject({
      canonical_status: 'BLOCKED',
      blocker_class: 'BLOCKED',
      blocker: 'playwright_mcp_required_tools_missing',
    })
    expect(JSON.stringify([live, serviceDown, blocked])).not.toMatch(/sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|auth\.json|\/home\/tony/i)
  })
})
