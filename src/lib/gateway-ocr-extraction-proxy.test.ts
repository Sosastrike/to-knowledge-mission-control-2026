import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { buildGatewayAiExtractionProxyAttempt, buildGatewayAiExtractionProxyStatus } from './gateway-ai-extraction-proxy'
import { createGatewayRegistryFromAgentNetwork } from './gateway-model'

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(() => ({ user: { role: 'admin' } })),
}))

describe('Gateway OCR direct line and AI extraction proxy', () => {
  it('registers OCR as a formal Gateway direct-line candidate without enabling execution', () => {
    const registry = createGatewayRegistryFromAgentNetwork({ generatedAt: '2026-06-17T12:00:00.000Z' })
    const node = registry.nodes.find((item) => item.id === 'ocr_specialist')
    const capability = registry.capabilities.find((item) => item.id === 'ocr_specialist_structured_extraction')

    expect(node).toMatchObject({
      id: 'ocr_specialist',
      label: 'OCR Specialist',
      kind: 'mini_agent',
      role: 'pdf_invoice_contract_ocr_to_structured_json',
      parent: 'mini_agents',
      supervisors: ['agent_zero', 'hermes', 'pi', 'gateway'],
      execution_state: 'proposal_only_until_bridge_session',
      external_writes: 'disabled',
      status: 'blocked',
      visibility: 'owner_visible',
      blockers: expect.arrayContaining(['jarvis_concurrence_required_for_ocr_direct_line']),
    })
    expect(node?.status_details).toMatchObject({
      direct_line_visible_in_gateway: true,
      direct_line_activation: 'blocked_until_jarvis_concurrence',
      backend_proxy_endpoint: '/api/gateway/extraction/ai',
      browser_ai_extraction_requires_backend_proxy: true,
      provider_api_keys_in_browser_allowed: false,
      execution_enabled: false,
      writes_enabled: false,
      secrets_exposed: false,
    })

    expect(capability).toMatchObject({
      id: 'ocr_specialist_structured_extraction',
      label: 'OCR Specialist structured extraction',
      kind: 'agent',
      status: 'blocked',
      source_node: 'ocr_specialist',
      execution_enabled: false,
      write_enabled: false,
      requires_session: true,
      available_to: ['agent_zero', 'hermes', 'pi', 'space_agent'],
      required_tools: ['/api/gateway/extraction/ai'],
      blockers: expect.arrayContaining(['jarvis_concurrence_required_for_ocr_direct_line']),
    })

    expect(registry.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'gateway', target: 'ocr_specialist', kind: 'delegation', status: 'blocked' }),
      expect.objectContaining({ source: 'ocr_specialist', target: 'agent_zero', kind: 'report' }),
    ]))
    expect(registry.policies.ocr_direct_line_requires_jarvis_concurrence).toMatchObject({
      auth_required: true,
      bridge_session_required: true,
      write_allowed: false,
      secret_safe: true,
      external_allowed: false,
    })
  })

  it('exposes authenticated Gateway route responses without executing extraction', async () => {
    const route = await import('@/app/api/gateway/extraction/ai/route')
    const secretish = 'API_' + 'KEY=abc123'

    const statusResponse = await route.GET(new NextRequest('http://localhost/api/gateway/extraction/ai'))
    const attemptResponse = await route.POST(new NextRequest('http://localhost/api/gateway/extraction/ai', {
      method: 'POST',
      body: JSON.stringify({ request: `Extract fields from /home/tony/private/invoice.pdf with ${secretish}`, document_type: 'invoice' }),
    }))
    const statusPayload = await statusResponse.json() as Record<string, any>
    const attemptPayload = await attemptResponse.json() as Record<string, any>

    expect(statusResponse.status).toBe(200)
    expect(statusPayload).toMatchObject({
      mode: 'gateway_ai_extraction_proxy_read_only',
      state: 'READ_ONLY',
      endpoint: '/api/gateway/extraction/ai',
      proxy_present: true,
      execution_enabled: false,
      writes_enabled: false,
      no_secrets_exposed: true,
    })
    expect(attemptResponse.status).toBe(423)
    expect(attemptPayload).toMatchObject({
      mode: 'gateway_ai_extraction_proxy_owner_gated',
      state: 'OWNER_GATED',
      blocker_class: 'OWNER_GATED',
      owner_approval_required: true,
      requested_action: 'ai_extraction',
      execution_enabled: false,
      writes_enabled: false,
      approval_request_created: false,
      blocked_reason: 'jarvis_concurrence_required_for_ocr_direct_line',
    })
    expect(JSON.stringify(attemptPayload)).not.toMatch(/API_?KEY=abc123|\/home\/tony\/private/)
  })

  it('exposes a server-side AI extraction proxy contract without browser secrets or execution', () => {
    const status = buildGatewayAiExtractionProxyStatus('2026-06-17T12:00:00.000Z')
    const secretish = 'API_' + 'KEY=abc123'
    const attempt = buildGatewayAiExtractionProxyAttempt({
      request: `Extract fields from /home/tony/private/invoice.pdf with ${secretish}`,
      document_type: 'invoice',
    }, '2026-06-17T12:01:00.000Z')

    expect(status).toMatchObject({
      mode: 'gateway_ai_extraction_proxy_read_only',
      endpoint: '/api/gateway/extraction/ai',
      proxy_present: true,
      browser_cors_solution: 'server_side_proxy_only',
      browser_api_key_exposure_allowed: false,
      execution_enabled: false,
      writes_enabled: false,
      owner_approval_required_for_execution: true,
      jarvis_concurrence_required: true,
      no_secrets_exposed: true,
    })
    expect(attempt).toMatchObject({
      mode: 'gateway_ai_extraction_proxy_owner_gated',
      requested_action: 'ai_extraction',
      document_type: 'invoice',
      output_contract: 'structured_json',
      execution_enabled: false,
      writes_enabled: false,
      owner_approval_required: true,
      jarvis_concurrence_required: true,
      approval_request_created: false,
      blocked_reason: 'jarvis_concurrence_required_for_ocr_direct_line',
      safe_browser_contract: {
        browser_calls_mission_control_only: true,
        provider_keys_in_browser: false,
        cors_to_ai_provider_required: false,
        server_side_provider_call_required: true,
      },
    })

    const serialized = JSON.stringify(attempt)
    expect(serialized).not.toMatch(/API_?KEY=abc123|\/home\/tony\/private/)
    expect(serialized).toContain('[redacted-secret]')
    expect(serialized).toContain('[redacted-path]')
  })
})
