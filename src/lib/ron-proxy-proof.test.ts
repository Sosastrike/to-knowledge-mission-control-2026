import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = vi.hoisted(() => vi.fn())
const limiterMock = vi.hoisted(() => vi.fn(() => null))

vi.mock('@/lib/auth', () => ({ requireRole: authMock }))
vi.mock('@/lib/rate-limit', () => ({ mutationLimiter: limiterMock }))

describe('Ron Mission Control proxy proof', () => {
  it('runs the proof through Mission Control proxy URLs without exposing session or auth values', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}

      if (url.endsWith('/gateway/agent-hub/ron/webui/api/session/new')) {
        expect(init?.headers).toMatchObject({ cookie: 'mc_session=owner-session' })
        return new Response(JSON.stringify({ session: { session_id: 'ron_proxy_session_123456', title: 'Ron proxy proof' } }), { status: 200 })
      }

      if (url.endsWith('/gateway/agent-hub/ron/webui/api/chat/start')) {
        expect(body.session_id).toBe('ron_proxy_session_123456')
        expect(String(body.message)).toContain('RON_PROXY_PROOF')
        return new Response(JSON.stringify({ ok: true, stream_id: 'stream_123', session_id: 'ron_proxy_session_123456' }), { status: 200 })
      }

      if (url.includes('/gateway/agent-hub/ron/webui/api/session?')) {
        return new Response(JSON.stringify({
          session: {
            session_id: 'ron_proxy_session_123456',
            message_count: 2,
            title: 'Ron proxy proof',
          },
          messages: [
            { role: 'user', content: body.message },
            { role: 'assistant', content: 'RON_PROXY_PROOF acknowledged. target_agent=ron-weasley' },
          ],
        }), { status: 200 })
      }

      return new Response('{}', { status: 404 })
    })

    const { runRonMissionControlProxyProof } = await import('@/lib/ron-proxy-proof')
    const result = await runRonMissionControlProxyProof(new NextRequest('http://localhost/api/bridge/ron/runtime-proof', {
      method: 'POST',
      headers: { cookie: 'mc_session=owner-session' },
    }), {
      fetchImpl: fetchMock,
      nonce: 'RON_PROXY_PROOF_TEST_NONCE',
      persist: false,
      pollAttempts: 1,
    })

    expect(result).toMatchObject({
      ok: true,
      target_agent: 'ron-weasley',
      conversation_owner: 'ron-weasley',
      direct_line_used: true,
      opencloud_intermediary: false,
      response_received: true,
      authenticated_proxy_send_receive_proof: true,
      session_id_value_exposed: false,
      tokens_cookies_exposed: false,
      credential_values_exposed: false,
      visible_task_event_written: false,
    })
    expect(JSON.stringify(result)).not.toContain('ron_proxy_session_123456')
    expect(JSON.stringify(result)).not.toContain('owner-session')
    expect(result.masked_session_ref).toMatch(/^ron_.*456$/)
  })

  it('returns exact blockers for proxy proof failures', async () => {
    const { runRonMissionControlProxyProof } = await import('@/lib/ron-proxy-proof')
    const result = await runRonMissionControlProxyProof(new NextRequest('http://localhost/api/bridge/ron/runtime-proof', {
      method: 'POST',
      headers: { cookie: 'mc_session=owner-session' },
    }), {
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ error: 'no session' }), { status: 500 })),
      nonce: 'RON_PROXY_PROOF_FAIL',
      persist: false,
      pollAttempts: 1,
    })

    expect(result).toMatchObject({
      ok: false,
      exact_blocker: 'ron_proxy_session_create_failed',
      authenticated_proxy_send_receive_proof: false,
      session_id_value_exposed: false,
      tokens_cookies_exposed: false,
    })
  })

  it('protects the POST route and returns redacted proof for operator sessions', async () => {
    authMock.mockReturnValueOnce({ error: 'Authentication required', status: 401 })
    const route = await import('@/app/api/bridge/ron/runtime-proof/route')

    const unauthenticated = await route.POST(new NextRequest('http://localhost/api/bridge/ron/runtime-proof', {
      method: 'POST',
      body: JSON.stringify({ action: 'run_mission_control_proxy_proof' }),
    }))
    expect(unauthenticated.status).toBe(401)

    authMock.mockReturnValue({ user: { role: 'operator', username: 'owner', workspace_id: 1 } })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}
      if (url.endsWith('/gateway/agent-hub/ron/webui/api/session/new')) {
        return new Response(JSON.stringify({ session_id: 'route_session_123456' }), { status: 200 })
      }
      if (url.endsWith('/gateway/agent-hub/ron/webui/api/chat/start')) {
        expect(body.session_id).toBe('route_session_123456')
        return new Response(JSON.stringify({ ok: true, stream_id: 'stream_route' }), { status: 200 })
      }
      if (url.includes('/gateway/agent-hub/ron/webui/api/session?')) {
        return new Response(JSON.stringify({
          session: { session_id: 'route_session_123456', message_count: 2 },
          messages: [{ role: 'assistant', content: 'RON_PROXY_PROOF route ack' }],
        }), { status: 200 })
      }
      return new Response('{}', { status: 404 })
    }))

    try {
      const response = await route.POST(new NextRequest('http://localhost/api/bridge/ron/runtime-proof', {
        method: 'POST',
        headers: { cookie: 'mc_session=route-owner', 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'run_mission_control_proxy_proof', persist: false }),
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload).toMatchObject({
        ok: true,
        target_agent: 'ron-weasley',
        authenticated_proxy_send_receive_proof: true,
        session_id_value_exposed: false,
        tokens_cookies_exposed: false,
      })
      expect(JSON.stringify(payload)).not.toContain('route_session_123456')
      expect(JSON.stringify(payload)).not.toContain('route-owner')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
