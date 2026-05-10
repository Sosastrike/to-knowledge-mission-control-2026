import { describe, expect, it } from 'vitest'
import { getAgentMailReadiness } from './agentmail-readiness'

describe('AgentMail readiness', () => {
  function withEnv(env: Record<string, string | undefined>, fn: () => void) {
    const keys = [
      'AGENTMAIL_API_KEY',
      'AGENTMAIL_TOKEN',
      'AGENTMAIL_API_KEY_FILE',
      'AGENTMAIL_STATUS_ENDPOINT',
      'AGENTMAIL_INBOX_ENDPOINT',
      'AGENTMAIL_SEND_ENDPOINT',
      'AGENTMAIL_ALLOWED_DOMAINS',
      'AGENTMAIL_ALLOWED_RECIPIENTS',
    ]
    const before = new Map(keys.map((key) => [key, process.env[key]]))
    for (const key of keys) delete process.env[key]
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    try {
      fn()
    } finally {
      for (const key of keys) {
        const value = before.get(key)
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  }

  it('reports credential-gated state without exposing values', () => {
    withEnv({}, () => {
      const status = getAgentMailReadiness()
      expect(status.canonical_status).toBe('CREDENTIAL_GATED')
      expect(status.blocker_class).toBe('CREDENTIAL_GATED')
      expect(status.blocker_kind).toBe('CREDENTIAL_GATED')
      expect(status.credential_present).toBe(false)
      expect(status.credential_values_exposed).toBe(false)
      expect(status.outgoing.no_email_sent).toBe(true)
      expect(status.outgoing.writes_enabled).toBe(false)
      expect(JSON.stringify(status)).not.toContain('secret')
    })
  })

  it('distinguishes configured credentials from missing backend adapters', () => {
    withEnv({ AGENTMAIL_API_KEY: 'agentmail-placeholder' }, () => {
      const status = getAgentMailReadiness()
      expect(status.canonical_status).toBe('BLOCKED')
      expect(status.blocker_kind).toBe('BACKEND_MISSING')
      expect(status.credential_present).toBe(true)
      expect(status.outgoing.send_endpoint_configured).toBe(false)
      expect(status.blocked_reason).toBe('agentmail_backend_adapter_not_configured')
    })
  })

  it('reports readiness when backend and allow-list are configured while keeping sends Bridge-gated', () => {
    withEnv({
      AGENTMAIL_API_KEY: 'agentmail-placeholder',
      AGENTMAIL_STATUS_ENDPOINT: 'https://agentmail.example/status',
      AGENTMAIL_SEND_ENDPOINT: 'https://agentmail.example/send',
      AGENTMAIL_ALLOWED_DOMAINS: 'knowledge-vs-ai.com, example.com',
    }, () => {
      const status = getAgentMailReadiness()
      expect(status.canonical_status).toBe('READY')
      expect(status.blocker_class).toBe('NONE')
      expect(status.blocker_kind).toBe('NONE')
      expect(status.outgoing.bridge_session_required).toBe(true)
      expect(status.outgoing.required_scope).toBe('agentmail.send')
      expect(status.outgoing.writes_enabled).toBe(false)
      expect(status.outgoing.domain_allow_list_configured).toBe(true)
      expect(status.outgoing.allowed_domains).toEqual(['knowledge-vs-ai.com', 'example.com'])
      expect(JSON.stringify(status)).not.toContain('agentmail-placeholder')
    })
  })
})
