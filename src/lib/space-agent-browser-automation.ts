import type { PlaywrightMcpStatus } from './playwright-mcp'

export type SpaceAgentBrowserAutomationCardStatus = 'connected_local_only' | 'blocked' | 'limited_pending'
export type SpaceAgentBrowserAutomationCardTone = 'green' | 'yellow' | 'red' | 'gray'
export type SpaceAgentBrowserAutomationButtonState = 'enabled' | 'disabled' | 'requires_bridge_session'

export type SpaceAgentBrowserAutomationButton = {
  id: string
  label: string
  method: 'GET' | 'POST'
  route: string | null
  state: SpaceAgentBrowserAutomationButtonState
  blocker: string | null
  bridge_session_required: boolean
  owner_visible_summary: string
}

export type SpaceAgentBrowserAutomationCard = {
  id: 'playwright_mcp' | 'firecrawl' | 'youtube_research'
  title: string
  status: SpaceAgentBrowserAutomationCardStatus
  tone: SpaceAgentBrowserAutomationCardTone
  installed: boolean
  configured: boolean
  connected: boolean
  service_endpoint: string | null
  mcp_endpoint: string | null
  browser_mode: string | null
  public_exposure: false
  bridge_required_for_interactive: boolean
  bridge_required_for_authenticated: boolean
  blocker: string | null
  summary: string
  details: string[]
}

export type SpaceAgentBrowserAutomationPayload = {
  ok: true
  mode: 'space_agent_browser_automation_truth'
  agent_id: 'space_agent'
  generated_at: string
  architecture_rule: 'SpaceAgent is the agent; Playwright MCP is the browser automation tool used by SpaceAgent through Gateway policy.'
  cards: SpaceAgentBrowserAutomationCard[]
  safe_read_only_buttons: SpaceAgentBrowserAutomationButton[]
  gated_buttons: SpaceAgentBrowserAutomationButton[]
  last_evidence_packet: {
    status: 'pending_production_smoke' | 'available'
    route: '/api/gateway/space-agent/playwright-mcp/evidence'
    blocker: string | null
  }
  last_snapshot: 'pending_production_smoke' | 'available'
  last_console: 'pending_production_smoke' | 'available'
  last_network: 'pending_production_smoke' | 'available'
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  no_public_exposure: true
  no_secrets_exposed: true
  raw_paths_exposed: false
}

export function buildSpaceAgentBrowserAutomationPayload(input: {
  generatedAt: string
  playwrightMcp: PlaywrightMcpStatus
  firecrawlCredentialConfigured?: boolean
  youtubeTranscriptConnectorProven?: boolean
}): SpaceAgentBrowserAutomationPayload {
  const playwrightConnected = input.playwrightMcp.ok && input.playwrightMcp.local_only && input.playwrightMcp.public_exposure === false
  const firecrawlConfigured = Boolean(input.firecrawlCredentialConfigured)
  const youtubeProven = Boolean(input.youtubeTranscriptConnectorProven)

  return {
    ok: true,
    mode: 'space_agent_browser_automation_truth',
    agent_id: 'space_agent',
    generated_at: input.generatedAt,
    architecture_rule: 'SpaceAgent is the agent; Playwright MCP is the browser automation tool used by SpaceAgent through Gateway policy.',
    cards: [
      {
        id: 'playwright_mcp',
        title: 'Playwright MCP',
        status: playwrightConnected ? 'connected_local_only' : 'blocked',
        tone: playwrightConnected ? 'green' : 'red',
        installed: playwrightConnected,
        configured: playwrightConnected,
        connected: playwrightConnected,
        service_endpoint: '127.0.0.1:8931',
        mcp_endpoint: 'http://127.0.0.1:8931/mcp',
        browser_mode: 'headless / isolated',
        public_exposure: false,
        bridge_required_for_interactive: true,
        bridge_required_for_authenticated: true,
        blocker: playwrightConnected ? null : input.playwrightMcp.blocker || 'playwright_mcp_service_unreachable',
        summary: playwrightConnected
          ? 'Installed and proven as a local-only SpaceAgent browser automation tool. Interactive actions remain Bridge Session gated.'
          : 'Playwright MCP is not currently reachable; no live browser status is claimed.',
        details: [
          'Listens only on localhost.',
          'Direct MCP status/smoke is read-only.',
          'No public URL is exposed.',
          'Authenticated browsing and form/file actions are disabled unless scoped by Bridge Session.',
        ],
      },
      {
        id: 'firecrawl',
        title: 'Firecrawl',
        status: firecrawlConfigured ? 'limited_pending' : 'blocked',
        tone: firecrawlConfigured ? 'yellow' : 'red',
        installed: false,
        configured: firecrawlConfigured,
        connected: false,
        service_endpoint: null,
        mcp_endpoint: null,
        browser_mode: null,
        public_exposure: false,
        bridge_required_for_interactive: true,
        bridge_required_for_authenticated: true,
        blocker: firecrawlConfigured ? 'firecrawl_live_adapter_not_proven' : 'firecrawl_credential_required',
        summary: firecrawlConfigured
          ? 'Credential presence is visible, but SpaceAgent native Firecrawl runtime access still needs proof.'
          : 'Missing credential or live adapter proof; Firecrawl requests stay blocked.',
        details: ['Gateway can classify Firecrawl research requests.', 'No Firecrawl live adapter is marked connected here.', 'No external write is enabled.'],
      },
      {
        id: 'youtube_research',
        title: 'YouTube Research',
        status: youtubeProven ? 'limited_pending' : 'limited_pending',
        tone: 'yellow',
        installed: true,
        configured: youtubeProven,
        connected: false,
        service_endpoint: null,
        mcp_endpoint: null,
        browser_mode: null,
        public_exposure: false,
        bridge_required_for_interactive: true,
        bridge_required_for_authenticated: true,
        blocker: youtubeProven ? null : 'youtube_transcript_connector_not_proven',
        summary: 'Metadata/transcript packet model exists, but a dedicated live transcript connector is not proven.',
        details: ['Use official metadata/transcript paths first.', 'Do not download full videos by default.', 'Return limited status when transcript is unavailable.'],
      },
    ],
    safe_read_only_buttons: [
      enabledButton('check_playwright_mcp_status', 'Check Playwright MCP status', 'GET', '/api/bridge/playwright-mcp/status', 'Reads local-only MCP status through authenticated Mission Control.'),
      enabledButton('open_last_browser_evidence', 'Open last browser evidence packet', 'GET', '/api/gateway/space-agent/playwright-mcp/evidence', 'Shows the latest read-only evidence status or pending production smoke.'),
      enabledButton('run_mission_control_ui_smoke', 'Run Mission Control UI smoke', 'POST', '/api/bridge/playwright-mcp/smoke', 'Runs a read-only Playwright MCP smoke against the Mission Control login surface.'),
    ],
    gated_buttons: [
      gatedButton('start_browser_session', 'Start browser session', 'bridge_session_required_for_browser_session_route'),
      gatedButton('interactive_browser_action', 'Interactive browser action', 'bridge_session_required_for_interactive_browser_action'),
      gatedButton('authenticated_browsing', 'Authenticated browsing', 'bridge_session_required_for_authenticated_browsing'),
      gatedButton('submit_form', 'Submit form', 'bridge_session_required_for_form_submission'),
      gatedButton('upload_file', 'Upload file', 'bridge_session_required_for_file_upload'),
    ],
    last_evidence_packet: {
      status: 'pending_production_smoke',
      route: '/api/gateway/space-agent/playwright-mcp/evidence',
      blocker: 'production_smoke_result_not_persisted_yet',
    },
    last_snapshot: 'pending_production_smoke',
    last_console: 'pending_production_smoke',
    last_network: 'pending_production_smoke',
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_public_exposure: true,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}

function enabledButton(id: string, label: string, method: 'GET' | 'POST', route: string, summary: string): SpaceAgentBrowserAutomationButton {
  return { id, label, method, route, state: 'enabled', blocker: null, bridge_session_required: false, owner_visible_summary: summary }
}

function gatedButton(id: string, label: string, blocker: string): SpaceAgentBrowserAutomationButton {
  return { id, label, method: 'POST', route: null, state: 'requires_bridge_session', blocker, bridge_session_required: true, owner_visible_summary: 'Disabled until a scoped Bridge Session route exists.' }
}
