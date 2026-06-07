import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import {
  applyAgentMailInboxProvisioning,
  approveAgentMailInboxProvisioning,
  buildAgentMailInboxProvisioningPreview,
  createAgentMailInboxProvisioningApproval,
} from '@/lib/agentmail-inbox-provisioning'
import { ensureAgentMailSchema, listAgentMailInboxes } from '@/lib/agentmail-local-control'
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

function testEnv(masterKey: Buffer) {
  return {
    AGENTMAIL_API_KEY_REF: 'AGENTMAIL_API_KEY',
    AGENTMAIL_WS_URL: 'wss://api.agentmail.to/ws',
    MISSION_CONTROL_SECRETS_MASTER_KEY: masterKey.toString('base64'),
  }
}

function liveInboxPayload(extra: unknown[] = []) {
  return {
    inboxes: [
      {
        inbox_id: 'inbox_live_pi',
        email: 'pi@agentmail.to',
        display_name: 'Existing Pi',
        client_id: 'mission-pi-inbox-v1',
        pod_id: 'pod_live_1',
        organization_id: 'org_live_1',
        metadata: { agent_id: 'pi', environment: 'production' },
      },
      {
        inbox_id: 'inbox_live_unrelated',
        email: 'tony-88@agentmail.to',
        display_name: 'Chief-Tony88',
        client_id: 'owner-inbox',
        pod_id: 'pod_live_1',
        organization_id: 'org_live_1',
      },
      ...extra,
    ],
  }
}

function provisioningFetcher(rawSecret: string, calls: Array<{ method: string; url: string; body?: unknown }> = []) {
  return async (url: string | URL | Request, init?: RequestInit) => {
    const endpoint = String(url)
    const method = String(init?.method || 'GET').toUpperCase()
    calls.push({ method, url: endpoint, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    expect(String((init?.headers as Record<string, string>)?.Authorization || '')).toBe(`Bearer ${rawSecret}`)

    if (method === 'GET' && endpoint.endsWith('/v0/inboxes')) {
      return new Response(JSON.stringify(liveInboxPayload()), { status: 200 })
    }

    if (method === 'POST' && endpoint.endsWith('/v0/inboxes')) {
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
      const username = String(body.username || '')
      const domain = String(body.domain || 'agentmail.to')
      return new Response(JSON.stringify({
        inbox_id: `inbox_created_${username.replace(/-/g, '_')}`,
        email: `${username}@${domain}`,
        display_name: body.display_name,
        client_id: body.client_id,
        pod_id: 'pod_live_1',
        organization_id: 'org_live_1',
        metadata: body.metadata,
      }), { status: 201 })
    }

    throw new Error(`unexpected AgentMail test call ${method} ${endpoint}`)
  }
}

describe('AgentMail inbox provisioning', () => {
  it('builds a live dedupe preview without creating inboxes, credentials, or sends', async () => {
    const db = new Database(':memory:')
    const masterKey = Buffer.alloc(32, 12)
    const rawSecret = 'agentmail-test-secret-value-1234567890'
    seedAgentMailSecret(db, masterKey, rawSecret)
    ensureAgentMailSchema(db)
    const calls: Array<{ method: string; url: string; body?: unknown }> = []

    const preview = await buildAgentMailInboxProvisioningPreview({
      db,
      env: testEnv(masterKey),
      fetchImpl: provisioningFetcher(rawSecret, calls),
    })

    expect(preview.ok).toBe(true)
    expect(preview.live_inbox_count_before).toBe(2)
    expect(preview.matching_inboxes).toEqual(expect.arrayContaining([
      expect.objectContaining({ agent_id: 'pi', email: 'pi@agentmail.to', action: 'reuse_existing_inbox' }),
    ]))
    expect(preview.missing_inboxes_to_create).toHaveLength(5)
    expect(preview.proposed_inbox_assignments).toHaveLength(6)
    expect(preview.scoped_credentials_created).toBe(false)
    expect(preview.email_sent).toBe(false)
    expect(preview.mutation_enabled).toBe(false)
    expect(calls.map((call) => call.method)).toEqual(['GET'])
    expect(JSON.stringify(preview)).not.toContain(rawSecret)
    expect(JSON.stringify(preview)).not.toContain('Authorization')
  })

  it('blocks apply without the exact approved owner request and performs no mutation', async () => {
    const db = new Database(':memory:')
    const masterKey = Buffer.alloc(32, 13)
    const rawSecret = 'agentmail-test-secret-value-1234567890'
    seedAgentMailSecret(db, masterKey, rawSecret)
    ensureAgentMailSchema(db)
    const calls: Array<{ method: string; url: string; body?: unknown }> = []

    const result = await applyAgentMailInboxProvisioning({
      db,
      env: testEnv(masterKey),
      fetchImpl: provisioningFetcher(rawSecret, calls),
      approvalId: 'apr_missing_for_unit_test',
    })

    expect(result.ok).toBe(false)
    expect(result.exact_blocker).toBe('inbox_provisioning_approval_required')
    expect(result.inboxes_created).toHaveLength(0)
    expect(result.registry_rows_updated).toBe(0)
    expect(result.scoped_credentials_created).toBe(false)
    expect(result.email_sent).toBe(false)
    expect(calls.map((call) => call.method)).toEqual(['GET'])
    expect(listAgentMailInboxes(db).every((inbox) => !inbox.inbox_address)).toBe(true)
  })

  it('applies approved provisioning by reusing matches, creating only missing inboxes, and moving to credential blocker', async () => {
    const db = new Database(':memory:')
    const masterKey = Buffer.alloc(32, 14)
    const rawSecret = 'agentmail-test-secret-value-1234567890'
    seedAgentMailSecret(db, masterKey, rawSecret)
    ensureAgentMailSchema(db)
    const calls: Array<{ method: string; url: string; body?: unknown }> = []
    const approval = await createAgentMailInboxProvisioningApproval({
      db,
      env: testEnv(masterKey),
      fetchImpl: provisioningFetcher(rawSecret, calls),
      idempotencyKey: `agentmail:inboxes:provision:${Date.now()}:unit`,
    })
    const approved = approveAgentMailInboxProvisioning({ db, approvalId: approval.approval_id, actor: 'owner' })
    expect(approved.ok).toBe(true)
    const approvedId = String(approved.approval_id)

    const result = await applyAgentMailInboxProvisioning({
      db,
      env: testEnv(masterKey),
      fetchImpl: provisioningFetcher(rawSecret, calls),
      approvalId: approvedId,
    })

    expect(result.ok).toBe(true)
    expect(result.inboxes_reused).toEqual(expect.arrayContaining([
      expect.objectContaining({ agent_id: 'pi', email: 'pi@agentmail.to' }),
    ]))
    expect(result.inboxes_created).toHaveLength(5)
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(5)
    expect(calls.some((call) => call.url.includes('/messages') || call.url.includes('/send'))).toBe(false)
    expect(result.registry_rows_updated).toBe(6)
    expect((result as any).current_primary_blocker).toBe('agentmail_inbox_credential_required')
    expect(result.scoped_credentials_created).toBe(false)
    expect(result.email_sent).toBe(false)
    const rows = listAgentMailInboxes(db)
    expect(rows.every((row) => row.provision_state === 'assigned')).toBe(true)
    expect(rows.map((row) => row.inbox_address)).toEqual([
      'pi@agentmail.to',
      'agent-zero@agentmail.to',
      'gateway@agentmail.to',
      'bridge-unit@agentmail.to',
      'agentmail-monitor@agentmail.to',
      'agentmail-audit@agentmail.to',
    ])
    expect(JSON.stringify(result)).not.toContain(rawSecret)
  })
})
