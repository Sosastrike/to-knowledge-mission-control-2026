import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import { ensureAgentMailSchema } from '@/lib/agentmail-local-control'
import {
  resolveAgentMailScopedCredential,
  upsertAgentMailScopedCredentialMetadata,
} from '@/lib/agentmail-credential-resolver'
import { normalizeAgentMailSendError, sendAgentMailMessage } from '@/lib/agentmail-send-adapter'

describe('AgentMail scoped credential resolver and send adapter', () => {
  it('resolves scoped credential metadata without exposing the runtime key', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    upsertAgentMailScopedCredentialMetadata(db, {
      agentId: 'pi',
      inboxId: 'pi@agentmail.to',
      credentialRef: 'AGENTMAIL_PI_KEY',
      maskedPreview: 'am_****7890',
      permissions: { inbox_read: true, thread_read: true, message_read: true, message_send: true },
    })

    const resolved = resolveAgentMailScopedCredential({
      db,
      env: { AGENTMAIL_PI_KEY: 'agentmail-test-secret-value-1234567890' },
      agentId: 'pi',
      inboxId: 'pi@agentmail.to',
      requiredPermissions: ['message_send'],
    })

    expect(resolved).toMatchObject({
      keyAvailable: true,
      keyMasked: 'am_****7890',
      scope: 'inbox',
      inboxId: 'pi@agentmail.to',
      credentialRef: 'AGENTMAIL_PI_KEY',
      permissions: { message_send: true },
      blockers: [],
      credential_values_exposed: false,
    })
    expect(JSON.stringify(resolved)).not.toContain('agentmail-test-secret-value')
  })

  it('returns exact blockers for wrong inbox, missing permission, and missing runtime secret', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    upsertAgentMailScopedCredentialMetadata(db, {
      agentId: 'pi',
      inboxId: 'pi@agentmail.to',
      credentialRef: 'AGENTMAIL_PI_KEY',
      maskedPreview: 'am_****7890',
      permissions: { inbox_read: true },
    })

    expect(resolveAgentMailScopedCredential({ db, env: {}, agentId: 'pi', inboxId: 'agent-zero@agentmail.to', requiredPermissions: ['message_send'] }).blockers).toContain('scoped_credential_wrong_inbox')
    const missing = resolveAgentMailScopedCredential({ db, env: {}, agentId: 'pi', inboxId: 'pi@agentmail.to', requiredPermissions: ['message_send'] })
    expect(missing.blockers).toEqual(expect.arrayContaining(['agentmail_runtime_secret_store_required', 'message_send_permission_missing']))
    expect(JSON.stringify(missing)).not.toContain('AGENTMAIL_PI_KEY=')
  })

  it('normalizes AgentMail adapter errors into Mission Control blockers', () => {
    expect(normalizeAgentMailSendError({ status: 401 })).toBe('scoped_credential_invalid')
    expect(normalizeAgentMailSendError({ status: 403 })).toBe('agentmail_message_rejected')
    expect(normalizeAgentMailSendError({ status: 403, message: 'Message rejected: Recipient(s) blocked: tony-88@agentmail.to (not in allow list)' })).toBe('agentmail_send_allowlist_required')
    expect(normalizeAgentMailSendError({ status: 404 })).toBe('agentmail_inbox_or_message_not_found')
  })

  it('uses the real AgentMail send endpoint without returning the API key', async () => {
    const calls: any[] = []
    const result = await sendAgentMailMessage({
      agentId: 'pi',
      inboxId: 'pi@agentmail.to',
      credentialRef: 'AGENTMAIL_PI_KEY',
      apiKey: 'agentmail-test-secret-value-1234567890',
      to: ['owner@example.com'],
      cc: [],
      bcc: [],
      subject: 'Adapter test',
      text: 'hello',
      html: '<p>hello</p>',
      labels: ['agentmail-send-test'],
      approvalId: 'approval_1',
      bridgeSessionId: 'bridge_1',
      gatewayDecisionId: 'gateway_1',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return new Response(JSON.stringify({ message_id: 'msg_1', thread_id: 'thread_1' }), { status: 200, headers: { 'content-type': 'application/json' } })
      },
    })

    expect(result).toMatchObject({ ok: true, message_id: 'msg_1', thread_id: 'thread_1' })
    expect(calls[0].url).toBe('https://api.agentmail.to/v0/inboxes/pi%40agentmail.to/messages/send')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      to: ['owner@example.com'],
      subject: 'Adapter test',
      text: 'hello',
      html: '<p>hello</p>',
      labels: ['agentmail-send-test'],
    })
    expect(JSON.stringify(result)).not.toContain('agentmail-test-secret-value')
    expect(JSON.stringify(calls[0].init.body)).not.toContain('agentmail-test-secret-value')
    expect(JSON.stringify(calls[0].init.body)).not.toContain('approval_1')
    expect(JSON.stringify(calls[0].init.body)).not.toContain('gateway_1')
  })

  it('returns sanitized provider rejection details without exposing the API key', async () => {
    const result = await sendAgentMailMessage({
      agentId: 'pi',
      inboxId: 'pi@agentmail.to',
      credentialRef: 'AGENTMAIL_PI_KEY',
      apiKey: 'agentmail-test-secret-value-1234567890',
      to: ['owner@example.com'],
      subject: 'Adapter rejection test',
      text: 'hello',
      fetchImpl: async () => new Response(JSON.stringify({
        message: 'Message rejected: Recipient(s) blocked: owner@example.com (not in allow list)',
      }), { status: 403, headers: { 'content-type': 'application/json' } }),
    })

    expect(result).toMatchObject({
      ok: false,
      exact_blocker: 'agentmail_send_allowlist_required',
      provider_status: 'http_error',
      http_status: 403,
      provider_error_summary: {
        status: 403,
        credential_values_exposed: false,
      },
      credential_values_exposed: false,
    })
    expect(JSON.stringify(result)).not.toContain('agentmail-test-secret-value')
  })
})
