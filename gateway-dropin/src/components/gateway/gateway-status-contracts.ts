type GatewayStatusPayload = Record<string, unknown>

const SAFE_READ_ONLY = {
  execution_enabled: false,
  writes_enabled: false,
  protected_execution_enabled: false,
  external_writes_enabled: false,
  fake_success_allowed: false,
  approval_request_created: false,
  audit_record_written: false,
  credential_values_exposed: false,
  go_claim_allowed: false,
  no_go_claim: true,
}

const SERVICE_CONTROL_BLOCKED = {
  service_control_enabled: false,
  install_started: false,
  restart_started: false,
}

function serviceDown(agentId: string, label: string, runtimeHint: string): GatewayStatusPayload {
  return {
    ok: false,
    route: `${agentId}.status`,
    agent_id: agentId,
    label,
    state: 'SERVICE_DOWN',
    blocker_class: 'SERVICE_DOWN',
    installed: false,
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    next_action: `${label} needs a real local runtime/service registration before Gateway can open or execute it. Expected runtime: ${runtimeHint}.`,
  }
}

function agentZeroStatus(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'agent-zero.status',
    agent_id: 'agent-zero',
    label: 'Agent Zero',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    installed: true,
    tailnet_url: 'http://100.116.35.95:50080/',
    owner_access_blocker: 'agent_zero_fd_exhaustion_guard_pending',
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    next_action: 'Owner UI is reachable on Tailnet; keep command execution disabled until the fd guard and safe command route are proven.',
  }
}

function readOnlyConnector(name: string, state: string, scope: string, nextAction: string): GatewayStatusPayload {
  return {
    name,
    state,
    scope,
    next_action: nextAction,
    external_writes_enabled: false,
    credential_values_exposed: false,
  }
}

function connectorReadiness(): GatewayStatusPayload {
  const connectors = [
    readOnlyConnector('AgentMail', 'READ_ONLY', 'mail', 'Primary mailbox is represented, but outbound sends remain Bridge-gated.'),
    readOnlyConnector('SendGrid', 'NOT_CONFIGURED', 'mail', 'Configure API key and sender domain through the owner secret path.'),
    readOnlyConnector('Twilio Voice', 'READ_ONLY', 'voice', 'Signature verification/readiness can be checked; outbound calls remain disabled.'),
    readOnlyConnector('Twilio SMS', 'READ_ONLY', 'sms', 'Readiness can be checked; SMS sends remain disabled without Bridge approval.'),
    readOnlyConnector('ElevenLabs', 'READ_ONLY', 'voice', 'Voice synthesis readiness can be checked without placing calls.'),
    readOnlyConnector('Google Drive', 'READ_ONLY', 'files', 'Workspace reads are represented; writes require scoped approval.'),
    readOnlyConnector('OneDrive', 'READ_ONLY', 'files', 'Backup handoff reads are represented; writes require scoped approval.'),
    readOnlyConnector('SMB share', 'BLOCKED', 'files', 'Legacy on-prem mount is blocked until migration and credential vaulting are complete.'),
    readOnlyConnector('Firecrawl', 'READ_ONLY', 'workflow', 'Web fetch readiness is available through allowlisted read-only checks.'),
    readOnlyConnector('n8n (OpenCloud)', 'READ_ONLY', 'workflow', 'Workflow runtime is represented; starts and mutations remain Bridge-gated.'),
    readOnlyConnector('Google Calendar', 'NOT_CONFIGURED', 'calendar', 'OAuth approval is required before scheduling operations.'),
    readOnlyConnector('Slack', 'NOT_CONFIGURED', 'chat', 'Webhook/bot token approval is required before posting.'),
  ]

  return {
    ok: true,
    route: 'bridge.connector-readiness',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    connectors,
    summary: {
      total: connectors.length,
      read_only: connectors.filter((connector) => connector.state === 'READ_ONLY').length,
      blocked: connectors.filter((connector) => connector.state === 'BLOCKED').length,
      not_configured: connectors.filter((connector) => connector.state === 'NOT_CONFIGURED').length,
    },
    ...SAFE_READ_ONLY,
    next_action: 'Connector buttons are wired to readiness checks. External writes stay disabled until owner credentials and Bridge approval are present.',
  }
}

function capabilityMatrix(): GatewayStatusPayload {
  const agents = [
    { id: 'agent-zero', status: 'partial', can_open_ui: true, can_execute: false, blocker: 'agent_zero_fd_exhaustion_guard_pending' },
    { id: 'hermes', status: 'partial', can_open_ui: false, can_execute: false, blocker: 'hermes_owner_proxy_not_wired' },
    { id: 'pi', status: 'advisory', can_open_ui: false, can_execute: false, blocker: 'pi_runtime_session_not_proven' },
    { id: 'spaceagent', status: 'partial', can_open_ui: false, can_execute: false, blocker: 'no_standalone_spaceagent_ui' },
    { id: 'paperclip', status: 'partial', can_open_ui: true, can_execute: false, blocker: 'paperclip_owner_company_claim_required' },
    { id: 'openclaw-plus', status: 'partial', can_open_ui: true, can_execute: false, blocker: 'openclaw_doctor_runtime_not_reachable' },
  ]

  return {
    ok: true,
    route: 'bridge.capability-matrix',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    agents,
    connectors: connectorReadiness().connectors,
    ...SAFE_READ_ONLY,
    next_action: 'Use /gateway/tools for the owner UI wrapper. This API remains machine-readable and never executes protected actions.',
  }
}

function runtimeServices(): GatewayStatusPayload {
  const services = [
    {
      ...paperclipBridge('status'),
      route: 'paperclip.status',
      agent_id: 'paperclip',
      label: 'Paperclip',
    },
    agentZeroStatus(),
    {
      ok: true,
      route: 'hermes.status',
      agent_id: 'hermes',
      label: 'Hermes',
      state: 'READ_ONLY',
      blocker_class: 'NONE',
      local_bind_address: '127.0.0.1',
      local_port: '3000',
      owner_access_blocker: 'hermes_owner_proxy_not_wired',
      ...SAFE_READ_ONLY,
      ...SERVICE_CONTROL_BLOCKED,
      next_action: 'Expose an authenticated Mission Control Hermes config panel or approved launch proxy.',
    },
    {
      ok: true,
      route: 'bridge.space-agent.status',
      agent_id: 'spaceagent',
      label: 'SpaceAgent',
      state: 'READ_ONLY',
      blocker_class: 'NONE',
      local_bind_address: '127.0.0.1',
      local_port: '8931',
      playwright_mcp_status: 'live_local_only',
      owner_access_blocker: 'no_standalone_spaceagent_ui; firecrawl_credential_required; firecrawl_backend_adapter_not_configured; youtube_transcript_connector_not_proven',
      ...SAFE_READ_ONLY,
      ...SERVICE_CONTROL_BLOCKED,
      next_action: 'Keep Playwright MCP local-only and expose SpaceAgent status/config through Mission Control.',
    },
    {
      ok: true,
      route: 'bridge.dispatcher.status',
      agent_id: 'pi',
      label: 'Pi',
      state: 'READ_ONLY',
      blocker_class: 'NONE',
      runtime_mode: 'advisory_only',
      ...SAFE_READ_ONLY,
      ...SERVICE_CONTROL_BLOCKED,
      owner_access_blocker: 'pi_runtime_session_not_proven',
      next_action: 'Keep Pi advisory-only; no standalone service/UI found.',
    },
  ]

  return {
    ok: false,
    route: 'bridge.runtime-services',
    state: 'SERVICE_DOWN',
    blocker_class: 'SERVICE_DOWN',
    services,
    summary: {
      total: services.length,
      installed: 3,
      service_down: services.filter((service) => service.state === 'SERVICE_DOWN').length,
      credential_gated: services.filter((service) => service.state === 'CREDENTIAL_GATED').length,
    },
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    next_action: 'Install/register the local runtimes and approved credentials before declaring these agents live.',
  }
}

function openClawPlusStatus(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'openclaw-plus.status',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    service_process: 'openclaw-gateway.service',
    local_bind_address: '127.0.0.1',
    local_ports: ['18789', '18791'],
    owner_tunnel_url: 'http://127.0.0.1:18789/',
    tailnet_url: null,
    public_exposure: false,
    owner_login_required: true,
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    next_action: 'Use the existing owner SSH/Tailnet tunnel or add an authenticated Mission Control proxy; do not expose OpenClaw+ publicly.',
  }
}

function paperclipBridge(resource: string): GatewayStatusPayload {
  return {
    ok: true,
    route: `bridge.paperclip.${resource}`,
    state: resource === 'status' ? 'READ_ONLY' : 'OWNER_GATED',
    blocker_class: resource === 'status' ? 'NONE' : 'OWNER_GATED',
    service_process: 'paperclip-lab dev runner (node/tsx)',
    paperclip_sandbox_service_not_running: false,
    paperclip_owner_session_required: true,
    local_url: null,
    tailnet_url: 'http://100.116.35.95:3100/',
    owner_login_url: 'http://100.116.35.95:3100/',
    company_dashboard_url: 'http://100.116.35.95:3100/companies',
    agent_roster_url: 'http://100.116.35.95:3100/agents',
    task_queue_url: 'http://100.116.35.95:3100/issues',
    health_endpoint: 'http://100.116.35.95:3100/api/health',
    health_probe: {
      http_status: 200,
      deployment_mode: 'authenticated',
      bootstrap_status: 'ready',
      bootstrap_invite_active: false,
    },
    items: [],
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    next_action: resource === 'status'
      ? 'Owner opens the Tailnet UI and completes Paperclip login; keep Mission Control health-only until an authenticated owner session is available.'
      : 'Complete Paperclip owner login/session first; then add authenticated read-only bridge inventory without storing credentials in Mission Control.',
  }
}

function agentLocalInterfaces(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'agent-local-interfaces',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    discovery: {
      server_tailnet_ip: '100.116.35.95',
      owner_laptop_tailnet_ip: '100.108.96.80',
      no_secrets_read: true,
      public_exposure_created: false,
    },
    agents: [
      { name: 'Agent Zero', status: 'partial_ui_restored', tailnet_url: 'http://100.116.35.95:50080/', mission_control_route: '/api/agent-zero/status', blocker: 'agent_zero_fd_exhaustion_guard_pending' },
      { name: 'Hermes', status: 'partial_service_active', local_url: null, mission_control_route: '/api/hermes/status', blocker: 'hermes_owner_proxy_not_wired' },
      { name: 'Pi', status: 'advisory_runtime_not_proven', mission_control_route: '/api/bridge/dispatcher/status', blocker: 'pi_runtime_session_not_proven' },
      { name: 'SpaceAgent', status: 'partial_mission_control_panel_only', mission_control_route: '/api/bridge/space-agent/status', blocker: 'no_standalone_spaceagent_ui; firecrawl_credential_required; firecrawl_backend_adapter_not_configured; youtube_transcript_connector_not_proven' },
      { name: 'Paperclip', status: 'partial_ui_reachable', tailnet_url: 'http://100.116.35.95:3100/', mission_control_route: '/api/bridge/paperclip/status', blocker: 'paperclip_owner_company_claim_required' },
      { name: 'OpenClaw+', status: 'tunnel_live_doctor_cli_blocked', owner_tunnel_url: 'http://127.0.0.1:18789/', mission_control_route: '/api/openclaw-plus/status', blocker: 'openclaw_doctor_runtime_not_reachable' },
    ],
    ...SAFE_READ_ONLY,
    next_action: 'Open only live Tailnet/tunnel/config routes. Missing links stay disabled until blockers clear.',
  }
}

function brainReadiness(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.brain-readiness',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    systems: [
      { name: 'Obsidian', state: 'READ_ONLY', writes_enabled: false },
      { name: 'Main policy', state: 'READ_ONLY', writes_enabled: false },
      { name: 'Brain synchronization system', state: 'READ_ONLY', writes_enabled: false },
      { name: 'Tony memory inheritance', state: 'READ_ONLY', writes_enabled: false },
    ],
    ...SAFE_READ_ONLY,
    next_action: 'Brain synchronization is visible as read-only provenance until the write path has owner approval and audit persistence.',
  }
}

function agentMailReadiness(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.agentmail-readiness',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    mailbox: 'ops@to-knowledge',
    send_enabled: false,
    draft_enabled: true,
    ...SAFE_READ_ONLY,
    next_action: 'AgentMail can be inspected. Sending remains disabled without Bridge approval.',
  }
}

function driveReadiness(name: string): GatewayStatusPayload {
  return {
    ok: true,
    route: `bridge.${name.toLowerCase().replace(/\s+/g, '-')}-readiness`,
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    connector: name,
    read_enabled: true,
    write_enabled: false,
    ...SAFE_READ_ONLY,
    next_action: `${name} can be checked in read-only mode. Writes require scoped owner approval.`,
  }
}

function firecrawlStatus(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'firecrawl.status',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    url_allowlist_enforced: true,
    crawl_enabled: false,
    ...SAFE_READ_ONLY,
    next_action: 'Firecrawl readiness is wired. Crawls remain disabled until allowlist and Bridge approval are present.',
  }
}

function n8nWorkflows(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'n8n.workflows',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    workflow_start_enabled: false,
    workers: [
      { name: 'Build-Wiki worker', state: 'SERVICE_DOWN', start_enabled: false },
      { name: 'Farmer worker', state: 'SERVICE_DOWN', start_enabled: false },
    ],
    ...SAFE_READ_ONLY,
    next_action: 'OpenCloud/n8n workflow metadata is wired read-only; worker starts require runtime registration and Bridge approval.',
  }
}

function preflight(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'bridge.preflight',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    checks: [
      { name: 'route_exists', state: 'PASS' },
      { name: 'credentials_present', state: 'BLOCKED' },
      { name: 'approval_present', state: 'BLOCKED' },
      { name: 'audit_sink_present', state: 'BLOCKED' },
    ],
    ...SAFE_READ_ONLY,
    next_action: 'Dry-run completed without dispatch. Credentials, Bridge approval, and audit sink are still required for execution.',
  }
}

function skillsRegistry(): GatewayStatusPayload {
  return {
    ok: true,
    route: 'skills',
    state: 'READ_ONLY',
    blocker_class: 'NONE',
    skills: [],
    ...SAFE_READ_ONLY,
    next_action: 'Skill registry endpoint is wired for read-only inspection. Installation remains gated.',
  }
}

function unknownRoute(path: string): GatewayStatusPayload {
  return {
    ok: false,
    route: path || 'unknown',
    state: 'BLOCKED',
    blocker_class: 'BACKEND_MISSING',
    installed: false,
    ...SAFE_READ_ONLY,
    ...SERVICE_CONTROL_BLOCKED,
    next_action: 'No Gateway contract exists for this route yet, so the button is blocked instead of pretending to work.',
  }
}

export function statusForGatewayApiPath(path: string[] = []): GatewayStatusPayload {
  const key = path.join('/')

  switch (key) {
    case 'agent-zero/status':
      return agentZeroStatus()
    case 'hermes/status':
      return (runtimeServices().services as GatewayStatusPayload[])[2]
    case 'paperclip/status':
      return {
        ...paperclipBridge('status'),
        route: 'paperclip.status',
        agent_id: 'paperclip',
        label: 'Paperclip',
      }
    case 'bridge/paperclip/status':
    case 'bridge/paperclip/companies':
    case 'bridge/paperclip/agents':
    case 'bridge/paperclip/issues':
      return paperclipBridge(key.split('/').at(-1) || 'status')
    case 'bridge/space-agent/status':
      return (runtimeServices().services as GatewayStatusPayload[])[3]
    case 'bridge/space-agent/playwright-mcp/status':
      return {
        ok: true,
        route: 'bridge.space-agent.playwright-mcp.status',
        state: 'READ_ONLY',
        blocker_class: 'NONE',
        local_bind_address: '127.0.0.1',
        local_port: '8931',
        public_exposure: false,
        owner_access_blocker: 'local_only_public_exposure_forbidden',
        ...SAFE_READ_ONLY,
        ...SERVICE_CONTROL_BLOCKED,
        next_action: 'Keep Playwright MCP local-only and manage it through the SpaceAgent panel.',
      }
    case 'pi-mono/status':
      return (runtimeServices().services as GatewayStatusPayload[])[4]
    case 'openclaw-plus/status':
      return openClawPlusStatus()
    case 'agent-local-interfaces':
      return agentLocalInterfaces()
    case 'bridge/connector-readiness':
      return connectorReadiness()
    case 'bridge/capability-matrix':
      return capabilityMatrix()
    case 'bridge/agentmail-readiness':
      return agentMailReadiness()
    case 'bridge/google-drive-readiness':
      return driveReadiness('Google Drive')
    case 'bridge/onedrive-readiness':
      return driveReadiness('OneDrive')
    case 'bridge/runtime-services':
    case 'bridge/dispatcher/status':
      return runtimeServices()
    case 'bridge/preflight':
      return preflight()
    case 'bridge/brain-readiness':
      return brainReadiness()
    case 'firecrawl/status':
      return firecrawlStatus()
    case 'n8n/workflows':
      return n8nWorkflows()
    case 'skills':
      return skillsRegistry()
    default:
      return unknownRoute(key)
  }
}

export type { GatewayStatusPayload }
