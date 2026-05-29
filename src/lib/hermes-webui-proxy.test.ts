import { describe, expect, it } from 'vitest'

import {
  buildHermesWebUiProxyResponseHeaders,
  buildHermesWebUiProxyTarget,
  deriveHermesWebUiSessionIdFromUrl,
  repairHermesWebUiChatStartBody,
  shouldRepairHermesWebUiChatStartBody,
  isAllowedHermesWebUiLoopbackUrl,
} from './hermes-webui-proxy'

describe('Hermes WebUI Mission Control proxy', () => {
  it('only allows loopback Hermes WebUI targets', () => {
    expect(isAllowedHermesWebUiLoopbackUrl('http://127.0.0.1:8787/')).toBe(true)
    expect(isAllowedHermesWebUiLoopbackUrl('http://localhost:8787/')).toBe(true)
    expect(isAllowedHermesWebUiLoopbackUrl('http://100.116.35.95:8787/')).toBe(false)
    expect(isAllowedHermesWebUiLoopbackUrl('https://example.com/hermes')).toBe(false)
  })

  it('maps Mission Control proxy paths to the loopback WebUI without exposing localhost to the owner browser', () => {
    const target = buildHermesWebUiProxyTarget(['api', 'models'], '?live=1')

    expect(target).toMatchObject({ ok: true, blocker: null })
    expect(target.target?.href).toBe('http://127.0.0.1:8787/api/models?live=1')
  })

  it('rewrites loopback redirects and cookie paths back under the canonical Ron Weasley route', () => {
    const upstreamHeaders = new Headers({
      'content-type': 'text/html',
      location: 'http://127.0.0.1:8787/login?next=/',
      'set-cookie': 'hermes_session=redacted; HttpOnly; Path=/; SameSite=Lax',
    })

    const headers = buildHermesWebUiProxyResponseHeaders(upstreamHeaders)

    expect(headers.get('location')).toBe('/gateway/agent-hub/ron/webui/login?next=/')
    expect(headers.get('set-cookie')).toContain('Path=/gateway/agent-hub/ron/webui')
    expect(headers.get('x-mission-control-hermes-webui-proxy')).toBe('true')
  })

  it('derives a safe session id from Mission Control proxied Ron WebUI session URLs', () => {
    expect(deriveHermesWebUiSessionIdFromUrl('https://tkmc.example/gateway/agent-hub/ron/webui/session/808632053117')).toBe('808632053117')
    expect(deriveHermesWebUiSessionIdFromUrl('https://tkmc.example/gateway/agent-hub/hermes/webui/session/808632053117')).toBe('808632053117')
    expect(deriveHermesWebUiSessionIdFromUrl('https://tkmc.example/gateway/agent-hub/hermes/webui/session/ses_abc-123.extra')).toBe('ses_abc-123.extra')
    expect(deriveHermesWebUiSessionIdFromUrl('https://tkmc.example/gateway/agent-hub/hermes/webui/app')).toBeNull()
    expect(deriveHermesWebUiSessionIdFromUrl('https://tkmc.example/gateway/agent-hub/hermes/webui/session/../../etc/passwd')).toBeNull()
  })

  it('repairs only proxied Ron WebUI chat-start posts that are missing session_id', () => {
    expect(shouldRepairHermesWebUiChatStartBody('POST', '/api/chat/start', { message: 'hello' })).toBe(true)
    expect(shouldRepairHermesWebUiChatStartBody('POST', '/api/chat/start', { session_id: 'ses_existing', message: 'hello' })).toBe(false)
    expect(shouldRepairHermesWebUiChatStartBody('GET', '/api/chat/start', { message: 'hello' })).toBe(false)
    expect(shouldRepairHermesWebUiChatStartBody('POST', '/api/session/update', { message: 'hello' })).toBe(false)

    expect(repairHermesWebUiChatStartBody(
      'POST',
      '/api/chat/start',
      { message: 'hello' },
      'https://tkmc.example/gateway/agent-hub/ron/webui/session/808632053117',
    )).toMatchObject({
      repaired: true,
      body: {
        message: 'hello',
        session_id: '808632053117',
      },
      sessionId: '808632053117',
    })

    expect(repairHermesWebUiChatStartBody(
      'POST',
      '/api/chat/start',
      { message: 'hello' },
      'https://tkmc.example/gateway/agent-hub/hermes/webui/session/%2Fetc%2Fpasswd',
    )).toMatchObject({
      repaired: false,
      sessionId: null,
    })
  })
})
