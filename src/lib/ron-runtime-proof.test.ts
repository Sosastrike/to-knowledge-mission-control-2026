import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET as getRonRuntimeProof } from '@/app/api/bridge/ron/runtime-proof/route'
import { buildRonRuntimeProof } from '@/lib/ron-runtime-proof'

describe('Ron runtime proof', () => {
  beforeEach(() => {
    process.env.HERMES_WEBUI_URL = 'http://127.0.0.1:8787/'
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({
          status: 'ok',
          sessions: 1,
          active_streams: 0,
          active_runs: 0,
        }), { status: 200 })
      }
      if (url.endsWith('/api/sessions')) {
        return new Response(JSON.stringify({
          sessions: [
            {
              session_id: '813ccb3a8d9f',
              title: 'Ron direct-line smoke TRACE-MC-RON-20260529T005215Z',
              message_count: 2,
            },
          ],
        }), { status: 200 })
      }
      return new Response('{}', { status: 404 })
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.HERMES_WEBUI_URL
  })

  it('separates Ron delegation, runtime, direct-line, SMS, auth, and Jarvis concurrence truth', async () => {
    const proof = await buildRonRuntimeProof({ smsDisabledProofPresent: true })

    expect(proof).toMatchObject({
      route: 'bridge.ron.runtime-proof',
      canonical_name: 'Ron Weasley',
      delegation: 'FULL_ACCESS_DELEGATED',
      overall_state: 'RUNTIME_RECOVERED_LOCAL_DIRECT_LINE_PROOF_PRESENT',
      opencloud_intermediary: false,
      secrets_exposed: false,
      components: {
        gateway: { state: 'ACTIVE', startup_failed: false },
        webui: { state: 'READY', health_reachable: true },
        direct_line: { state: 'PROOF_PRESENT', message_count: 2 },
        sms: { state: 'DISABLED_UNCONFIGURED', blocking_startup: false, insecure_signature_validation: false },
        auth: { state: 'MISSION_CONTROL_AUTH_REQUIRED' },
        jarvis_concurrence: { state: 'REQUIRED' },
        runtime_tools: { state: 'READ_ONLY_PROOF_ONLY' },
      },
      mission_control_proxy_certification: {
        state: 'PENDING_AUTHENTICATED_SEND_RECEIVE_PROOF',
        blocker: 'mission_control_authenticated_proxy_send_receive_proof_pending',
      },
    })
    expect(proof.components.direct_line.session_proof?.masked_session_id).toBe('813c...d9f')
  })

  it('does not mark direct-line proof present without a send/receive session', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/health')) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      if (url.endsWith('/api/sessions')) return new Response(JSON.stringify({ sessions: [] }), { status: 200 })
      return new Response('{}', { status: 404 })
    })

    const proof = await buildRonRuntimeProof({ smsDisabledProofPresent: true })

    expect(proof.overall_state).toBe('RUNTIME_HEALTHY_DIRECT_LINE_PROOF_PENDING')
    expect(proof.components.direct_line).toMatchObject({
      state: 'PENDING_PROOF',
      exact_blocker: 'ron_direct_line_send_receive_proof_missing',
    })
  })

  it('keeps the runtime proof route protected when unauthenticated', async () => {
    const response = await getRonRuntimeProof(new NextRequest('http://localhost/api/bridge/ron/runtime-proof'))

    expect(response.status).toBe(401)
  })
})
