import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createGatewayRegistryFromAgentNetwork } from './gateway-model'
import { clearSpaceAgentJobStoreForTests } from './space-agent-api'

const requireRoleMock = vi.hoisted(() => vi.fn())
const loadGatewayRegistryMock = vi.hoisted(() => vi.fn())
const getPlaywrightMcpStatusMock = vi.hoisted(() => vi.fn())
const createPlaywrightBrowserEvidencePacketMock = vi.hoisted(() => vi.fn())
const runPlaywrightMcpMissionControlSmokeMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireRole: requireRoleMock,
}))

vi.mock('@/lib/gateway-registry-api', async () => {
  const actual = await vi.importActual<typeof import('./gateway-registry-api')>('@/lib/gateway-registry-api')
  return {
    ...actual,
    loadGatewayRegistry: loadGatewayRegistryMock,
  }
})

vi.mock('@/lib/playwright-mcp', async () => {
  const actual = await vi.importActual<typeof import('./playwright-mcp')>('@/lib/playwright-mcp')
  return {
    ...actual,
    getPlaywrightMcpStatus: getPlaywrightMcpStatusMock,
    createPlaywrightBrowserEvidencePacket: createPlaywrightBrowserEvidencePacketMock,
    runPlaywrightMcpMissionControlSmoke: runPlaywrightMcpMissionControlSmokeMock,
  }
})

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

async function json(response: Response) {
  return await response.json() as Record<string, any>
}

function expectOwnerSafe(payload: unknown) {
  const serialized = JSON.stringify(payload)
  expect(serialized).not.toMatch(/API_KEY=abc123|Bearer\s+abc123|\/home\/owner|auth\.json/i)
  expect(serialized).toMatch(/"execution_enabled":false/)
}

describe('Space Agent Gateway and Bridge routes', () => {
  beforeEach(() => {
    requireRoleMock.mockReset()
    loadGatewayRegistryMock.mockReset()
    getPlaywrightMcpStatusMock.mockReset()
    createPlaywrightBrowserEvidencePacketMock.mockReset()
    runPlaywrightMcpMissionControlSmokeMock.mockReset()
    clearSpaceAgentJobStoreForTests()
    loadGatewayRegistryMock.mockResolvedValue(createGatewayRegistryFromAgentNetwork({
      generatedAt: '2026-05-06T00:00:00.000Z',
    }))
    getPlaywrightMcpStatusMock.mockResolvedValue({
      ok: true,
      mode: 'playwright_mcp_status',
      status: 'connected',
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
      tool_count: 23,
      tools: ['browser_navigate', 'browser_snapshot', 'browser_take_screenshot', 'browser_console_messages', 'browser_network_requests'],
      required_tools_present: true,
      blocker: null,
      last_error: null,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    runPlaywrightMcpMissionControlSmokeMock.mockResolvedValue({
      ok: true,
      mode: 'playwright_mcp_mission_control_smoke',
      generated_at: '2026-05-06T00:00:00.000Z',
      status: 'passed',
      target_url: 'https://mc.knowledge-vs-ai.com/login',
      service: { status: 'connected', service_status: 'connected_local_only', local_only: true, public_exposure: false },
      evidence: {
        ok: true,
        bridge_session_required: false,
      },
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      no_public_exposure: true,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
      blocker: null,
    })
    createPlaywrightBrowserEvidencePacketMock.mockResolvedValue({
      ok: true,
      mode: 'space_agent_playwright_mcp_browser_evidence_packet',
      packet_id: 'playwright_mcp_example',
      requested_url: 'https://example.com/',
      status: 'completed',
      evidence: {
        snapshot_available: true,
        snapshot_contains_requested_page: true,
        console_available: true,
        network_available: true,
        screenshot_available: true,
        snapshot_excerpt: 'Example Domain',
      },
      blocker: null,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      bridge_session_required: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
  })

  it('rejects unauthenticated Space Agent routes before loading Gateway state', async () => {
    requireRoleMock.mockReturnValue({ error: 'Authentication required', status: 401 })
    const nodeAlias = await import('@/app/api/gateway/nodes/space-agent/route')
    const status = await import('@/app/api/bridge/space-agent/status/route')
    const canonicalStatus = await import('@/app/api/bridge/spaceagent/status/route')
    const canonicalReadiness = await import('@/app/api/bridge/spaceagent/readiness/route')
    const canonicalCapabilityMap = await import('@/app/api/bridge/spaceagent/capability-map/route')
    const canonicalCertificationProof = await import('@/app/api/bridge/spaceagent/certification-proof/route')
    const canonicalToolMap = await import('@/app/api/bridge/spaceagent/tool-map/route')
    const canonicalBrainStatus = await import('@/app/api/bridge/spaceagent/brain-status/route')
    const canonicalPipelineStatus = await import('@/app/api/bridge/spaceagent/pipeline-status/route')
    const canonicalAuthority = await import('@/app/api/bridge/spaceagent/authority/route')
    const canonicalRecommendation = await import('@/app/api/bridge/spaceagent/recommendation/route')
    const canonicalTaskPlan = await import('@/app/api/bridge/spaceagent/task-plan/route')
    const canonicalReportDraft = await import('@/app/api/bridge/spaceagent/report-draft/route')
    const canonicalConcurrence = await import('@/app/api/bridge/spaceagent/jarvis-concurrence-request/route')
    const testChat = await import('@/app/api/bridge/space-agent/test-chat/route')
    const research = await import('@/app/api/gateway/space-agent/research/route')
    const job = await import('@/app/api/gateway/space-agent/jobs/[id]/route')
    const playwrightStatus = await import('@/app/api/bridge/space-agent/playwright-mcp/status/route')
    const playwrightStatusAlias = await import('@/app/api/bridge/playwright-mcp/status/route')
    const playwrightSmoke = await import('@/app/api/bridge/playwright-mcp/smoke/route')
    const playwrightEvidence = await import('@/app/api/gateway/space-agent/playwright-mcp/evidence/route')
    const browserStatus = await import('@/app/api/gateway/space-agent/browser/status/route')
    const browserJobs = await import('@/app/api/gateway/space-agent/browser/jobs/route')

    const responses = await Promise.all([
      nodeAlias.GET(request('http://localhost/api/gateway/nodes/space-agent')),
      status.GET(request('http://localhost/api/bridge/space-agent/status')),
      canonicalStatus.GET(request('http://localhost/api/bridge/spaceagent/status')),
      canonicalReadiness.GET(request('http://localhost/api/bridge/spaceagent/readiness')),
      canonicalCapabilityMap.GET(request('http://localhost/api/bridge/spaceagent/capability-map')),
      canonicalCertificationProof.GET(request('http://localhost/api/bridge/spaceagent/certification-proof')),
      canonicalToolMap.GET(request('http://localhost/api/bridge/spaceagent/tool-map')),
      canonicalBrainStatus.GET(request('http://localhost/api/bridge/spaceagent/brain-status')),
      canonicalPipelineStatus.GET(request('http://localhost/api/bridge/spaceagent/pipeline-status')),
      canonicalAuthority.GET(request('http://localhost/api/bridge/spaceagent/authority')),
      canonicalRecommendation.POST(request('http://localhost/api/bridge/spaceagent/recommendation', {
        method: 'POST',
        body: JSON.stringify({ title: 'unauth', recommendation: 'blocked' }),
      })),
      canonicalTaskPlan.POST(request('http://localhost/api/bridge/spaceagent/task-plan', {
        method: 'POST',
        body: JSON.stringify({ title: 'unauth', objective: 'blocked' }),
      })),
      canonicalReportDraft.POST(request('http://localhost/api/bridge/spaceagent/report-draft', {
        method: 'POST',
        body: JSON.stringify({ title: 'unauth', summary: 'blocked' }),
      })),
      canonicalConcurrence.POST(request('http://localhost/api/bridge/spaceagent/jarvis-concurrence-request', {
        method: 'POST',
        body: JSON.stringify({ request_id: 'unauth', reason: 'blocked' }),
      })),
      testChat.POST(request('http://localhost/api/bridge/space-agent/test-chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Can you see Gateway?' }),
      })),
      research.POST(request('http://localhost/api/gateway/space-agent/research', {
        method: 'POST',
        body: JSON.stringify({ request: 'Research a public page.' }),
      })),
      playwrightStatus.GET(request('http://localhost/api/bridge/space-agent/playwright-mcp/status')),
      playwrightStatusAlias.GET(request('http://localhost/api/bridge/playwright-mcp/status')),
      playwrightSmoke.POST(request('http://localhost/api/bridge/playwright-mcp/smoke', { method: 'POST' })),
      playwrightEvidence.GET(request('http://localhost/api/gateway/space-agent/playwright-mcp/evidence')),
      playwrightEvidence.POST(request('http://localhost/api/gateway/space-agent/playwright-mcp/evidence', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com' }),
      })),
      browserStatus.GET(request('http://localhost/api/gateway/space-agent/browser/status')),
      browserJobs.GET(request('http://localhost/api/gateway/space-agent/browser/jobs')),
      job.GET(request('http://localhost/api/gateway/space-agent/jobs/missing'), {
        params: Promise.resolve({ id: 'missing' }),
      }),
    ])

    for (const response of responses) {
      expect([401, 403]).toContain(response.status)
      expect(await response.json()).toMatchObject({ error: 'Authentication required' })
    }
    expect(loadGatewayRegistryMock).not.toHaveBeenCalled()
  })

  it('returns canonical SpaceAgent status, readiness, authority, and internal record routes when authenticated', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'operator' } })
    const canonicalStatus = await import('@/app/api/bridge/spaceagent/status/route')
    const canonicalReadiness = await import('@/app/api/bridge/spaceagent/readiness/route')
    const canonicalCapabilityMap = await import('@/app/api/bridge/spaceagent/capability-map/route')
    const canonicalCertificationProof = await import('@/app/api/bridge/spaceagent/certification-proof/route')
    const canonicalToolMap = await import('@/app/api/bridge/spaceagent/tool-map/route')
    const canonicalBrainStatus = await import('@/app/api/bridge/spaceagent/brain-status/route')
    const canonicalPipelineStatus = await import('@/app/api/bridge/spaceagent/pipeline-status/route')
    const canonicalAuthority = await import('@/app/api/bridge/spaceagent/authority/route')
    const canonicalRecommendation = await import('@/app/api/bridge/spaceagent/recommendation/route')
    const canonicalTaskPlan = await import('@/app/api/bridge/spaceagent/task-plan/route')
    const canonicalReportDraft = await import('@/app/api/bridge/spaceagent/report-draft/route')
    const canonicalConcurrence = await import('@/app/api/bridge/spaceagent/jarvis-concurrence-request/route')

    const responses = await Promise.all([
      canonicalStatus.GET(request('http://localhost/api/bridge/spaceagent/status')),
      canonicalReadiness.GET(request('http://localhost/api/bridge/spaceagent/readiness')),
      canonicalCapabilityMap.GET(request('http://localhost/api/bridge/spaceagent/capability-map')),
      canonicalCertificationProof.GET(request('http://localhost/api/bridge/spaceagent/certification-proof')),
      canonicalToolMap.GET(request('http://localhost/api/bridge/spaceagent/tool-map')),
      canonicalBrainStatus.GET(request('http://localhost/api/bridge/spaceagent/brain-status')),
      canonicalPipelineStatus.GET(request('http://localhost/api/bridge/spaceagent/pipeline-status')),
      canonicalAuthority.GET(request('http://localhost/api/bridge/spaceagent/authority')),
      canonicalRecommendation.POST(request('http://localhost/api/bridge/spaceagent/recommendation', {
        method: 'POST',
        body: JSON.stringify({ title: 'SpaceAgent recommendation', recommendation: 'Draft only.' }),
      })),
      canonicalTaskPlan.POST(request('http://localhost/api/bridge/spaceagent/task-plan', {
        method: 'POST',
        body: JSON.stringify({ title: 'SpaceAgent task plan', objective: 'Read status.' }),
      })),
      canonicalReportDraft.POST(request('http://localhost/api/bridge/spaceagent/report-draft', {
        method: 'POST',
        body: JSON.stringify({ title: 'SpaceAgent report', summary: 'Internal report draft.' }),
      })),
      canonicalConcurrence.POST(request('http://localhost/api/bridge/spaceagent/jarvis-concurrence-request', {
        method: 'POST',
        body: JSON.stringify({ request_id: 'spaceagent-test', action_type: 'gateway_tool_execution', reason: 'Production action requires Jarvis.' }),
      })),
    ])
    const payloads = await Promise.all(responses.map((response) => response.json()))

    for (const response of responses) expect(response.status).toBe(200)
    expect(payloads[0]).toMatchObject({ route: 'bridge.spaceagent.status', agent_id: 'spaceagent', conversation_owner: 'spaceagent', opencloud_intermediary_allowed: false })
    expect(payloads[1]).toMatchObject({ route: 'bridge.spaceagent.readiness', final_certification_status: 'NOT_CERTIFIED' })
    expect(payloads[2]).toMatchObject({ route: 'bridge.spaceagent.capability-map', writes_enabled: false, pipeline_status_route: '/api/bridge/spaceagent/pipeline-status', tool_map_route: '/api/bridge/spaceagent/tool-map' })
    expect(payloads[3]).toMatchObject({
      route: 'bridge.spaceagent.certification-proof',
      status: 'SPACEAGENT_CERTIFICATION_SOURCE_PROOF_READY_LIVE_PROOF_PENDING',
      direct_line: { conversation_owner: 'spaceagent', direct_line_active: true },
      message_envelope: { target_agent: 'spaceagent', conversation_owner: 'spaceagent', direct_line_used: true, opencloud_used: false },
      proof: { no_opencloud_intermediary: true, no_external_execution: true, credential_values_exposed: false },
      execution_enabled: false,
      external_execution_enabled: false,
    })
    expect(payloads[4]).toMatchObject({
      route: 'bridge.spaceagent.tool-map',
      status: 'SPACEAGENT_TOOL_MAP_GATEWAY_BROKERED',
      credential_policy: { values_exposed: false, brokered_credentials_by_name_only: true },
      proof: { no_opencloud_intermediary: true, credential_values_exposed: false },
      execution_enabled: false,
      external_execution_enabled: false,
    })
    expect(payloads[5]).toMatchObject({
      route: 'bridge.spaceagent.brain-status',
      status: 'SPACEAGENT_BRAIN_BRIDGE_CONNECTED_READ_ONLY',
      brain_bridge: { gateway_connected: true, opencloud_intermediary_allowed: false },
      memory_policy: { can_execute_memory_write: false, broad_memory_deletion_allowed: false },
      proof: { no_opencloud_intermediary: true, credential_values_exposed: false },
    })
    expect(payloads[6]).toMatchObject({
      route: 'bridge.spaceagent.pipeline-status',
      status: 'SPACEAGENT_PIPELINE_REGISTERED_INTERNAL_ONLY',
      pipeline: { name: 'SpaceAgent Gateway Integration Pipeline', direct_gateway_connection: true },
      proof: { no_external_execution: true, no_opencloud_intermediary: true },
    })
    expect(payloads[7]).toMatchObject({ route: 'bridge.spaceagent.authority', may_execute_production_changes: false, jarvis_concurrence_required_for_production: true })
    expect(payloads[8]).toMatchObject({ route: 'bridge.spaceagent.recommendation', mode: 'spaceagent_internal_record_written', record: { kind: 'spaceagent_recommendation' } })
    expect(payloads[9]).toMatchObject({ route: 'bridge.spaceagent.task_plan', record: { kind: 'spaceagent_task_plan' } })
    expect(payloads[10]).toMatchObject({ route: 'bridge.spaceagent.report_draft', record: { kind: 'spaceagent_report_draft' } })
    expect(payloads[11]).toMatchObject({ route: 'bridge.spaceagent.jarvis_concurrence_request', record: { kind: 'spaceagent_jarvis_concurrence_request' } })
    for (const payload of payloads) expectOwnerSafe(payload)
  })

  it('returns Playwright MCP status and read-only browser evidence packets through protected Gateway routes', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'operator' } })
    const playwrightStatus = await import('@/app/api/bridge/space-agent/playwright-mcp/status/route')
    const playwrightStatusAlias = await import('@/app/api/bridge/playwright-mcp/status/route')
    const playwrightSmoke = await import('@/app/api/bridge/playwright-mcp/smoke/route')
    const playwrightEvidence = await import('@/app/api/gateway/space-agent/playwright-mcp/evidence/route')
    const browserStatus = await import('@/app/api/gateway/space-agent/browser/status/route')

    const statusResponse = await playwrightStatus.GET(request('http://localhost/api/bridge/space-agent/playwright-mcp/status'))
    const aliasResponse = await playwrightStatusAlias.GET(request('http://localhost/api/bridge/playwright-mcp/status'))
    const smokeResponse = await playwrightSmoke.POST(request('http://localhost/api/bridge/playwright-mcp/smoke', { method: 'POST' }))
    const evidenceIndexResponse = await playwrightEvidence.GET(request('http://localhost/api/gateway/space-agent/playwright-mcp/evidence'))
    const evidenceResponse = await playwrightEvidence.POST(request('http://localhost/api/gateway/space-agent/playwright-mcp/evidence', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
    }))
    const browserStatusResponse = await browserStatus.GET(request('http://localhost/api/gateway/space-agent/browser/status'))
    const statusPayload = await json(statusResponse)
    const aliasPayload = await json(aliasResponse)
    const smokePayload = await json(smokeResponse)
    const evidenceIndexPayload = await json(evidenceIndexResponse)
    const evidencePayload = await json(evidenceResponse)
    const browserStatusPayload = await json(browserStatusResponse)

    expect(statusResponse.status).toBe(200)
    expect(aliasResponse.status).toBe(200)
    expect(smokeResponse.status).toBe(200)
    expect(evidenceIndexResponse.status).toBe(200)
    expect(browserStatusResponse.status).toBe(200)
    expect(statusPayload).toMatchObject({
      status: 'connected',
      endpoint: 'localhost:8931/mcp',
      service_endpoint: '127.0.0.1:8931',
      mcp_endpoint: 'http://127.0.0.1:8931/mcp',
      service_status: 'connected_local_only',
      local_only: true,
      public_exposure: false,
      execution_enabled: false,
      writes_enabled: false,
      required_tools_present: true,
    })
    expect(aliasPayload).toMatchObject({ service_status: 'connected_local_only', public_exposure: false })
    expect(smokePayload).toMatchObject({ mode: 'playwright_mcp_mission_control_smoke', execution_enabled: false, writes_enabled: false })
    expect(evidenceIndexPayload).toMatchObject({ mode: 'playwright_mcp_browser_evidence_index', latest_evidence_packet: 'pending_production_smoke' })
    expect(browserStatusPayload.cards.find((card: any) => card.id === 'playwright_mcp')).toMatchObject({ status: 'connected_local_only', public_exposure: false })
    expect(evidenceResponse.status).toBe(200)
    expect(evidencePayload).toMatchObject({
      mode: 'space_agent_playwright_mcp_browser_evidence_packet',
      status: 'completed',
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      bridge_session_required: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expect(createPlaywrightBrowserEvidencePacketMock).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com' }))
    expectOwnerSafe(statusPayload)
    expectOwnerSafe(evidencePayload)
  })

  it('returns authenticated read-only Space Agent status and node detail without secrets', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'operator' } })
    const nodeAlias = await import('@/app/api/gateway/nodes/space-agent/route')
    const status = await import('@/app/api/bridge/space-agent/status/route')

    const nodeResponse = await nodeAlias.GET(request('http://localhost/api/gateway/nodes/space-agent'))
    const statusResponse = await status.GET(request('http://localhost/api/bridge/space-agent/status'))
    const nodePayload = await json(nodeResponse)
    const statusPayload = await json(statusResponse)

    expect(nodeResponse.status).toBe(200)
    expect(nodePayload.node).toMatchObject({
      id: 'space_agent',
      type: 'specialist_agent',
      execution_enabled: false,
      write_enabled: false,
    })
    expect(statusResponse.status).toBe(200)
    expect(statusPayload).toMatchObject({
      mode: 'space_agent_status_read_only',
      health: 'degraded',
      firecrawl: {
        credential_configured: false,
        blocked_reason: 'firecrawl_missing_credential',
      },
      browser: {
        configured: true,
        runtime_adapter_configured: true,
        bridge_session_required: true,
        execution_enabled: false,
      },
      playwright_mcp: {
        status: 'connected',
        local_only: true,
        public_exposure: false,
        required_tools_present: true,
      },
      youtube: {
        transcript_path_configured: true,
        runtime_adapter_configured: false,
        execution_enabled: false,
      },
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
    expectOwnerSafe(statusPayload)
  })

  it('keeps test-chat safely blocked until a live Space Agent adapter is configured', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'operator' } })
    const testChat = await import('@/app/api/bridge/space-agent/test-chat/route')

    const response = await testChat.POST(request('http://localhost/api/bridge/space-agent/test-chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Can you see Gateway? API_KEY=abc123' }),
    }))
    const payload = await json(response)

    expect(response.status).toBe(503)
    expect(payload).toMatchObject({
      mode: 'space_agent_read_only_test_chat',
      space_agent_called: false,
      live_chat_status: 'blocked_safe_live_adapter_not_configured',
      blocker: 'space_agent_runtime_adapter_not_configured',
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(payload.prompt).toContain('[redacted-secret]')
    expectOwnerSafe(payload)
  })

  it('creates read-only research packets, stores job lookup, and blocks protected browser work', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'operator' } })
    const research = await import('@/app/api/gateway/space-agent/research/route')
    const job = await import('@/app/api/gateway/space-agent/jobs/[id]/route')

    const planned = await research.POST(request('http://localhost/api/gateway/space-agent/research', {
      method: 'POST',
      body: JSON.stringify({ request: 'Use Firecrawl to crawl a public documentation page.' }),
    }))
    const plannedPayload = await json(planned)
    const jobId = plannedPayload.job.id as string
    const jobResponse = await job.GET(request(`http://localhost/api/gateway/space-agent/jobs/${jobId}`), {
      params: Promise.resolve({ id: jobId }),
    })
    const jobPayload = await json(jobResponse)

    expect(planned.status).toBe(200)
    expect(plannedPayload).toMatchObject({
      mode: 'space_agent_research_packet_planning',
      accepted_for_execution: false,
      research_performed: false,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(plannedPayload.packet.firecrawl_status).toBe('blocked_missing_credential')
    expect(jobResponse.status).toBe(200)
    expect(jobPayload.job.id).toBe(jobId)
    expectOwnerSafe(plannedPayload)

    const blocked = await research.POST(request('http://localhost/api/gateway/space-agent/research', {
      method: 'POST',
      body: JSON.stringify({ request: 'Log in with owner credentials and inspect a private dashboard.' }),
    }))
    const blockedPayload = await json(blocked)

    expect(blocked.status).toBe(423)
    expect(blockedPayload).toMatchObject({
      ok: false,
      accepted_for_execution: false,
      research_performed: false,
      bridge_session_required: true,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(blockedPayload.blocked_reason).toBe('owner_credentials_not_approved')
    expectOwnerSafe(blockedPayload)
  })
})
