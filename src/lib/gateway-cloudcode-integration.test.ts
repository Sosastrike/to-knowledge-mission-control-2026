import { describe, expect, it } from 'vitest'
import {
  buildCloudCodeAgentHealth,
  buildCloudCodeBuildWikiTruth,
  buildCloudCodeGatewayStatus,
  buildCloudCodeNavigation,
} from './gateway-cloudcode-integration'

describe('CloudCode backend-support integration', () => {
  it('normalizes Gateway status into owner-safe canonical truth', () => {
    const truth = buildCloudCodeGatewayStatus({
      ok: true,
      generated_at: '2026-05-09T12:00:00.000Z',
      status: 'connected',
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      agent_zero: {
        id: 'agent_zero',
        label: 'Agent Zero',
        status: 'connected',
        health: { status: 'connected', summary: 'commander reachable' },
        blockers: [],
      },
      hermes: {
        id: 'hermes',
        label: 'Hermes',
        status: 'degraded',
        health: { status: 'degraded', summary: 'owner gated' },
        blockers: ['owner_approval_pending'],
      },
      bridge_mcp: {
        visible: true,
        providers: 3,
        mcp_servers: 2,
        mcp_tools_visible: true,
        execution_enabled: false,
      },
      mcp_gateway: {
        servers: [
          {
            id: 'mcp_zapier',
            label: 'Zapier MCP',
            status: 'blocked',
            reachable: false,
            schema_available: false,
            tool_count: 0,
            tools_route: null,
            blocker: 'zapier_backend_missing',
          },
        ],
        tools_integrations: [],
      },
      llm_gateway: { providers: [] },
      brain_systems: [],
      buildwiki_openclaw: {
        service_active: false,
        service_state: 'inactive',
        timer_active: true,
        timer_state: 'active',
        last_run_status: null,
        run_now_target_service: 'opencloud-docs-farmer.service',
        blockers: ['bridge_session_required'],
      },
      safety: {
        auth_required: true,
        secrets_exposed: false,
        raw_paths_exposed: false,
        bridge_session_required_for_writes: true,
      },
    } as any)

    expect(truth.normalized_status.execution_enabled).toBe(false)
    expect(truth.normalized_status.agents.find((agent) => agent.id === 'agent_zero')?.status).toBe('READ_ONLY')
    expect(truth.normalized_status.blockers.some((blocker) => blocker.kind === 'OWNER_GATED')).toBe(true)
    expect(truth.owner_status).toBe(truth.normalized_status.overall_status)
    expect(truth.route_metadata.breadcrumbs.map((crumb) => crumb.route)).toEqual(['/', '/gateway'])
    expect(JSON.stringify(truth)).not.toMatch(/\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)
  })

  it('builds canonical agent health without fake LIVE states', () => {
    const health = buildCloudCodeAgentHealth({
      execution_enabled: false,
      agents: [
        {
          id: 'agent-zero',
          name: 'Agent Zero',
          connected: true,
          configured: true,
          blocked_reason: null,
          live_interface_proven: true,
          called_true_proven: true,
        },
        {
          id: 'openclaw-plus',
          name: 'OpenClaw+',
          connected: false,
          configured: true,
          blocked_reason: 'openclaw_doctor_runtime_not_reachable',
          live_interface_proven: false,
        },
        {
          id: 'spaceagent',
          name: 'SpaceAgent',
          connected: true,
          configured: true,
          blocked_reason: null,
          live_interface_proven: true,
        },
      ],
    } as any)

    expect(health.find((agent) => agent.id === 'agent_zero')?.status).toBe('READ_ONLY')
    expect(health.find((agent) => agent.id === 'openclaw_plus')).toMatchObject({
      status: 'SERVICE_DOWN',
      blocker: 'openclaw_doctor_runtime_not_reachable',
    })
    expect(health.find((agent) => agent.id === 'spaceagent_playwright')?.status).toBe('READ_ONLY')
    expect(health.every((agent) => agent.status !== 'LIVE')).toBe(true)
  })

  it('uses SpaceAgent browser automation card truth instead of one aggregate fake status', () => {
    const health = buildCloudCodeAgentHealth({
      execution_enabled: false,
      agents: [
        {
          id: 'spaceagent',
          name: 'SpaceAgent',
          connected: true,
          configured: true,
          blocked_reason: 'firecrawl_credential_required',
          live_interface_proven: true,
        },
      ],
      space_agent_browser_automation: {
        cards: [
          {
            id: 'playwright_mcp',
            status: 'blocked',
            configured: true,
            connected: false,
            blocker: 'playwright_mcp_service_unreachable',
          },
          {
            id: 'youtube_research',
            status: 'limited_pending',
            configured: true,
            connected: false,
            blocker: null,
          },
          {
            id: 'firecrawl',
            status: 'blocked',
            configured: false,
            connected: false,
            blocker: 'firecrawl_credential_required',
          },
        ],
      },
    } as any)

    expect(health.find((agent) => agent.id === 'spaceagent_playwright')).toMatchObject({
      status: 'SERVICE_DOWN',
      blocker: 'playwright_mcp_service_unreachable',
    })
    expect(health.find((agent) => agent.id === 'spaceagent_youtube')).toMatchObject({
      status: 'READ_ONLY',
      blocker: null,
    })
    expect(health.find((agent) => agent.id === 'spaceagent_firecrawl')).toMatchObject({
      status: 'CREDENTIAL_GATED',
      blocker: 'firecrawl_credential_required',
    })
    expect(health.every((agent) => agent.status !== 'LIVE')).toBe(true)
  })

  it('returns route metadata for breadcrumbs, home, back, Gateway Overview, and Agent Hub', () => {
    const nav = buildCloudCodeNavigation('/gateway/agent-hub')

    expect(nav.current?.route).toBe('/gateway/agent-hub')
    expect(nav.targets).toMatchObject({
      mission_control_home: '/',
      safe_back: '/gateway',
      gateway_overview: '/gateway',
      agent_hub: '/gateway?tab=agent-hub',
    })
    expect(nav.breadcrumbs.map((crumb) => crumb.breadcrumb_label)).toEqual(['Mission Control', 'Gateway', 'Agent Hub'])
  })

  it('returns route metadata for the mounted Paperclip Agent Hub page', () => {
    const nav = buildCloudCodeNavigation('/gateway/agent-hub/paperclip')

    expect(nav.current?.route).toBe('/gateway/agent-hub/paperclip')
    expect(nav.targets).toMatchObject({
      mission_control_home: '/',
      safe_back: '/gateway?tab=agent-hub',
      gateway_overview: '/gateway',
      agent_hub: '/gateway?tab=agent-hub',
    })
    expect(nav.breadcrumbs.map((crumb) => crumb.breadcrumb_label)).toEqual(['Mission Control', 'Gateway', 'Agent Hub', 'Paperclip'])
  })

  it('keeps Build-Wiki Run Now approval-gated and Fork 1 only', () => {
    const truth = buildCloudCodeBuildWikiTruth({
      service_probe: {
        service_active_state: 'inactive',
        service_sub_state: 'dead',
        timer_active: true,
        last_run_exited_at: null,
        last_exit_status: null,
      },
      run_now: {
        persistence_ready: true,
        approval: null,
        run: null,
      },
    } as any)

    expect(truth.buildwiki_farmer.service_name).toBe('opencloud-docs-farmer.service')
    expect(truth.buildwiki_farmer.run_now_requires_owner_approval).toBe(true)
    expect(truth.run_now_gate).toMatchObject({
      run_now_button_enabled: false,
      reason: 'Global execution is disabled.',
    })
    expect(JSON.stringify(truth)).not.toMatch(/smb|fork2|gmail-farmer|slack-farmer|youtube-farmer|web-farmer/i)
  })
})
