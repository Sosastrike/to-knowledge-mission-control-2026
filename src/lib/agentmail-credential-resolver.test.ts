import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import {
  listAgentMailBootstrapInboxes,
  resolveAgentMailScopedCredential,
  resolveAgentMailBootstrapCredential,
  testAgentMailBootstrapConnection,
  upsertAgentMailScopedCredentialMetadata,
} from '@/lib/agentmail-credential-resolver'
import { encryptProviderSecret, ensureProviderVaultSchema } from '@/lib/provider-vault'

function seedAgentMailSecret(db: Database.Database, masterKey: Buffer, rawSecret: string) {
  ensureProviderVaultSchema(db)
  db.prepare(`
    INSERT INTO provider_configs (provider_id, display_name, provider_type, base_url, validation_path, enabled, custom)
    VALUES ('agentmail', 'AgentMail', 'hosted', 'https://api.agentmail.to', '/v0/inboxes', 1, 1)
  `).run()
  const encrypted = encryptProviderSecret(rawSecret, masterKey, 'test-key-v1')
  db.prepare(`
    INSERT INTO provider_secrets (
      provider_id, env_var_name, ciphertext, iv, auth_tag, algorithm, key_version, masked_preview, fingerprint_hash, created_by
    ) VALUES ('agentmail', 'AGENTMAIL_API_KEY', ?, ?, ?, ?, ?, 'am_****7890', 'unit-test-fingerprint', 'unit-test')
  `).run(encrypted.ciphertext, encrypted.iv, encrypted.auth_tag, encrypted.algorithm, encrypted.key_version)
}

describe('AgentMail bootstrap credential resolver', () => {
  it('resolves encrypted AgentMail bootstrap credentials without exposing raw values', () => {
    const db = new Database(':memory:')
    const masterKey = Buffer.alloc(32, 6)
    seedAgentMailSecret(db, masterKey, 'agentmail-test-secret-value-1234567890')

    const result = resolveAgentMailBootstrapCredential({
      db,
      env: {
        AGENTMAIL_API_KEY_REF: 'AGENTMAIL_API_KEY',
        MISSION_CONTROL_SECRETS_MASTER_KEY: masterKey.toString('base64'),
      },
    })

    expect(result).toMatchObject({
      ref: 'AGENTMAIL_API_KEY',
      keyAvailable: true,
      keyMasked: 'am_****7890',
      source: 'provider_vault',
      exact_blocker: null,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      raw_secret_values_exposed: false,
    })
    expect(JSON.stringify(result)).not.toContain('agentmail-test-secret-value')
  })

  it('runs a safe AgentMail inbox-list probe from encrypted runtime credential state', async () => {
    const db = new Database(':memory:')
    const masterKey = Buffer.alloc(32, 7)
    const fakeSecret = 'agentmail-test-secret-value-1234567890'
    seedAgentMailSecret(db, masterKey, fakeSecret)
    let authHeader = ''

    const result = await testAgentMailBootstrapConnection({
      db,
      env: {
        AGENTMAIL_API_KEY_REF: 'AGENTMAIL_API_KEY',
        MISSION_CONTROL_SECRETS_MASTER_KEY: masterKey.toString('base64'),
      },
      fetchImpl: async (_url, init) => {
        authHeader = String((init?.headers as Record<string, string>)?.Authorization || '')
        return new Response(JSON.stringify({ data: [{ id: 'inbox_1' }, { id: 'inbox_2' }] }), { status: 200 })
      },
    })

    expect(authHeader).toBe(`Bearer ${fakeSecret}`)
    expect(result).toMatchObject({
      ok: true,
      probe_status: 'ok',
      http_status: 200,
      exact_blocker: null,
      inbox_count: 2,
      endpoint_used: 'https://api.agentmail.to/v0/inboxes',
      auth_header_present: true,
      credential_values_exposed: false,
    })
    expect(JSON.stringify(result)).not.toContain('agentmail-test-secret-value')
  })

  it('lists sanitized live AgentMail inboxes from the bootstrap credential', async () => {
    const db = new Database(':memory:')
    const masterKey = Buffer.alloc(32, 8)
    const fakeSecret = 'agentmail-test-secret-value-1234567890'
    seedAgentMailSecret(db, masterKey, fakeSecret)

    const result = await listAgentMailBootstrapInboxes({
      db,
      env: {
        AGENTMAIL_API_KEY_REF: 'AGENTMAIL_API_KEY',
        MISSION_CONTROL_SECRETS_MASTER_KEY: masterKey.toString('base64'),
      },
      fetchImpl: async () => new Response(JSON.stringify({
        count: 2,
        inboxes: [
          {
            organization_id: 'org_live_1',
            pod_id: 'pod_1',
            inbox_id: 'itt@agentmail.to',
            email: 'itt@agentmail.to',
            display_name: 'ITT_AGENT',
            updated_at: '2026-06-07T01:00:00.000Z',
            created_at: '2026-06-07T00:00:00.000Z',
          },
          {
            organization_id: 'org_live_1',
            pod_id: 'pod_1',
            inbox_id: 'tony-88@agentmail.to',
            email: 'tony-88@agentmail.to',
            display_name: 'Chief-Tony88',
          },
        ],
      }), { status: 200 }),
    })

    expect(result).toMatchObject({
      ok: true,
      http_status: 200,
      exact_blocker: null,
      inbox_count: 2,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    })
    expect(result.inboxes[0]).toMatchObject({ inbox_id: 'itt@agentmail.to', email_preview: 'i***@agentmail.to', display_name: 'ITT_AGENT' })
    expect(JSON.stringify(result)).not.toContain(fakeSecret)
  })

  it('resolves scoped inbox credentials from encrypted Provider Vault storage without env injection', () => {
    const db = new Database(':memory:')
    const masterKey = Buffer.alloc(32, 9)
    const rawScopedSecret = 'agentmail-scoped-secret-for-pi-1234567890'
    ensureProviderVaultSchema(db)
    db.prepare(`
      INSERT INTO provider_configs (provider_id, display_name, provider_type, base_url, validation_path, enabled, custom)
      VALUES ('agentmail', 'AgentMail', 'hosted', 'https://api.agentmail.to', '/v0/inboxes', 1, 1)
    `).run()
    const encrypted = encryptProviderSecret(rawScopedSecret, masterKey, 'test-key-v1')
    db.prepare(`
      INSERT INTO provider_secrets (
        provider_id, env_var_name, ciphertext, iv, auth_tag, algorithm, key_version, masked_preview, fingerprint_hash, created_by
      ) VALUES ('agentmail', 'AGENTMAIL_INBOX_KEY_PI', ?, ?, ?, ?, ?, 'am_****7890', 'unit-test-scoped-fingerprint', 'unit-test')
    `).run(encrypted.ciphertext, encrypted.iv, encrypted.auth_tag, encrypted.algorithm, encrypted.key_version)
    upsertAgentMailScopedCredentialMetadata(db, {
      agentId: 'pi',
      inboxId: 'pi-88@agentmail.to',
      credentialRef: 'AGENTMAIL_INBOX_KEY_PI',
      maskedPreview: 'am_****7890',
      permissions: { inbox_read: true, thread_read: true, message_read: true, message_send: true },
    })

    const result = resolveAgentMailScopedCredential({
      db,
      env: { MISSION_CONTROL_SECRETS_MASTER_KEY: masterKey.toString('base64') },
      agentId: 'pi',
      inboxId: 'pi-88@agentmail.to',
      requiredPermissions: ['message_send'],
    })

    expect(result).toMatchObject({
      credentialRef: 'AGENTMAIL_INBOX_KEY_PI',
      keyAvailable: true,
      keyMasked: 'am_****7890',
      scope: 'inbox',
      inboxId: 'pi-88@agentmail.to',
      credential_status: 'scoped',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      raw_secret_values_exposed: false,
    })
    expect(result.blockers).toEqual([])
    expect(result.permissions.message_send).toBe(true)
    expect(JSON.stringify(result)).not.toContain(rawScopedSecret)
  })

})
