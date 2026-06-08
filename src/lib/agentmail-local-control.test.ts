import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { encryptProviderSecret, ensureProviderVaultSchema } from '@/lib/provider-vault'

import {
  AGENTMAIL_CONSOLE_URL,
  AGENTMAIL_MCP_URL,
  buildAgentMailPayload,
  buildAgentMailReceivePathStatus,
  buildAgentMailStatus,
  buildAgentMailConnectStatus,
  buildAgentMailInboxSyncPreview,
  buildAgentMailCredentialProvisionPreview,
  approveAgentMailBridgeSession,
  approveAgentMailCredentialProvision,
  approveAgentMailSendRequest,
  buildAgentMailSendAccessStatus,
  buildAgentMailDispatchRuntimeStatus,
  buildAgentMailSetupStatus,
  createAgentMailBridgeSessionRequest,
  createAgentMailCredentialProvisionRequest,
  createAgentMailInboxProvisioningRequest,
  createAgentMailSendPreview,
  createAgentMailSendRequest,
  dispatchAgentMailSendRequest,
  setAgentMailDispatchRuntimeEmergencyStop,
  applyAgentMailCredentialProvision,
  upsertAgentMailScopedCredentialMetadata,
  ensureAgentMailSchema,
  ingestAgentMailEvent,
  listAgentMailInboxes,
  normalizeAgentMailEvent,
  recordAgentMailAudit,
  validateInboxRegistry,
  verifyAgentMailReceivePath,
} from '@/lib/agentmail-local-control'

function assignCanonicalAgentMailInboxes(db: Database.Database) {
  const rows = [
    ['pi', 'pi-88@agentmail.to'],
    ['agent_zero', 'jarvis88@agentmail.to'],
    ['gateway', 'gateway@agentmail.to'],
    ['bridge_unit', 'bridge-unit@agentmail.to'],
    ['agentmail_monitor', 'tony-88@agentmail.to'],
    ['agentmail_audit', 'audit-88@agentmail.to'],
  ]
  for (const [agentId, inbox] of rows) {
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = ?").run(inbox, agentId)
  }
}

function seedAgentMailBootstrapSecret(db: Database.Database, masterKey: Buffer, rawSecret: string) {
  ensureProviderVaultSchema(db)
  db.prepare(`
    INSERT INTO provider_configs (provider_id, display_name, provider_type, base_url, validation_path, enabled, custom)
    VALUES ('agentmail', 'AgentMail', 'hosted', 'https://api.agentmail.to', '/v0/inboxes', 1, 1)
    ON CONFLICT(provider_id) DO UPDATE SET display_name = excluded.display_name
  `).run()
  const encrypted = encryptProviderSecret(rawSecret, masterKey, 'test-key-v1')
  db.prepare(`
    INSERT INTO provider_secrets (
      provider_id, env_var_name, ciphertext, iv, auth_tag, algorithm, key_version, masked_preview, fingerprint_hash, created_by
    ) VALUES ('agentmail', 'AGENTMAIL_API_KEY', ?, ?, ?, ?, ?, 'am_****7890', 'unit-test-bootstrap-fingerprint', 'unit-test')
  `).run(encrypted.ciphertext, encrypted.iv, encrypted.auth_tag, encrypted.algorithm, encrypted.key_version)
}

describe('AgentMail local control bootstrap', () => {
  it('seeds monitor-first inbox registry without shared autonomous inboxes', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const inboxes = listAgentMailInboxes(db)

    expect(inboxes.map((row) => row.agent_id)).toEqual(expect.arrayContaining([
      'pi',
      'agent_zero',
      'gateway',
      'bridge_unit',
      'agentmail_monitor',
      'agentmail_audit',
    ]))
    expect(inboxes.find((row) => row.agent_id === 'gateway')).toMatchObject({
      autonomy_level: 'L0_monitor_only',
      owner_approval_required: true,
      provision_state: 'not_provisioned',
    })
    expect(validateInboxRegistry(inboxes)).toMatchObject({
      ok: true,
      shared_autonomous_inbox_detected: false,
      credential_values_exposed: false,
    })
  })

  it('normalizes received messages into redacted Gateway-safe events', () => {
    const event = normalizeAgentMailEvent({
      type: 'message.received',
      inbox: 'bridge@agents.example.com',
      sender: 'sender@example.com',
      subject: 'Need help with API_KEY=secret',
      message_id: 'msg_1',
      thread_id: 'thread_1',
      received_at: '2026-06-06T00:00:00.000Z',
    }, [{
      agent_id: 'bridge_unit',
      display_name: 'Bridge Unit',
      role: 'event_translation_queue',
      inbox_address: 'bridge@agents.example.com',
      client_id: 'mission-bridge-inbox-v1',
      autonomy_level: 'L0_monitor_only',
      owner_approval_required: true,
      provision_state: 'assigned',
    }])

    expect(event).toMatchObject({
      source: 'agentmail',
      event_type: 'message.received',
      agent_id: 'bridge_unit',
      direction: 'inbound',
      sender_preview: 's***@example.com',
      sender_domain: 'example.com',
      classification: 'unknown',
      policy_state: 'pending_gateway_review',
      outbound_send_enabled: false,
      owner_approval_required: true,
      credential_values_exposed: false,
    })
    expect(event.subject).toContain('[redacted]')
    expect(JSON.stringify(event)).not.toContain('sender@example.com')
    expect(JSON.stringify(event)).not.toContain('API_KEY=secret')
  })

  it('queues inbound events, blocks outbound send, and writes audit records', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const event = ingestAgentMailEvent({
      type: 'message.received',
      inbox: 'pi@agents.example.com',
      sender: 'owner@example.com',
      subject: 'Status',
      message_id: 'msg_pi_1',
      thread_id: 'thread_pi_1',
    }, db)

    const queue = buildAgentMailPayload('bridge_queue', db) as { bridge_queue: Array<Record<string, unknown>> }
    const approvals = buildAgentMailPayload('approvals', db) as { approvals: Array<Record<string, unknown>> }
    const audit = buildAgentMailPayload('audit', db) as { audit: Array<Record<string, unknown>> }

    expect(event.policy_state).toBe('pending_gateway_review')
    expect(queue.bridge_queue[0]).toMatchObject({
      event_id: event.event_id,
      task_candidate_state: 'candidate_pending_classification',
      policy_state: 'pending_gateway_review',
      outbound_send_enabled: 0,
      owner_approval_required: 1,
    })
    expect(approvals.approvals[0]).toMatchObject({
      event_id: event.event_id,
      action_type: 'outbound_send',
      state: 'blocked',
      exact_blocker: 'agentmail_owner_approval_required',
    })
    expect(audit.audit[0]).toMatchObject({
      event_id: event.event_id,
      action: 'event_ingested',
      result: 'ok',
    })
  })

  it('reports stopped/degraded/running monitor state without exposing secrets', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const stopped = buildAgentMailStatus(db, {})
    const degraded = buildAgentMailStatus(db, { AGENTMAIL_CREDENTIAL_REF: 'configured' })

    expect(stopped).toMatchObject({
      state: 'stopped',
      send_enabled: false,
      credential_values_exposed: false,
    })
    expect(degraded).toMatchObject({
      state: 'degraded',
      send_enabled: false,
      credential_values_exposed: false,
    })
    expect(JSON.stringify(degraded)).not.toContain('configured')
  })

  it('maps missing credential state to hosted AgentMail owner SSO/API fallback without localhost as the primary action', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const status = buildAgentMailConnectStatus(db, {}, { agentmail_mcp_config_detected: false })

    expect(status).toMatchObject({
      ok: true,
      source: 'agentmail_connect_status',
      status: 'owner_sso_required',
      hosted_console_url: AGENTMAIL_CONSOLE_URL,
      mcp_oauth_url: AGENTMAIL_MCP_URL,
      primary_cta: 'Connect AgentMail',
      send_state: 'approval_required',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    })
    expect(status.next_status_flow).toEqual([
      'owner_sso_required',
      'connected',
      'sync_ready',
      'inbox_sync_complete',
      'approval_gated_send_ready',
      'monitor_ready',
    ])
    expect(JSON.stringify(status)).not.toContain('localhost')
    expect(JSON.stringify(status)).not.toContain('127.0.0.1')
  })

  it('reports local MCP config as not visible to the Mission Control runtime without faking connection', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const status = buildAgentMailConnectStatus(db, {}, { agentmail_mcp_config_detected: true })

    expect(status).toMatchObject({
      status: 'api_key_required',
      current_blocker: 'agentmail_mcp_oauth_not_visible_to_mission_control_runtime',
      mcp_oauth_status: {
        state: 'mcp_config_detected_runtime_unusable',
        cli_status: 'configured_for_local_cli_not_service_runtime',
      },
      api_key_fallback: {
        state: 'api_key_required',
      },
      send_state: 'approval_required',
      send_enabled: false,
      credential_values_exposed: false,
    })
  })

  it('masks AgentMail API-key fallback and keeps send approval-gated', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const status = buildAgentMailConnectStatus(db, {
      AGENTMAIL_API_KEY: 'agentmail-test-secret-value-1234567890',
      AGENTMAIL_WS_URL: 'wss://api.agentmail.to/ws',
    })

    expect(status).toMatchObject({
      status: 'sync_ready',
      api_key_fallback: {
        state: 'detected',
        masked_preview: 'am_****7890',
      },
      bridge_session_status: 'legacy_optional_not_global_setup_gate',
      send_state: 'approval_required',
      execution_enabled: false,
      send_enabled: false,
    })
    expect(JSON.stringify(status)).not.toContain('agentmail-test-secret-value')
  })


  it('resolves AgentMail bootstrap API key references from encrypted runtime storage without exposing raw secrets', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    ensureProviderVaultSchema(db)
    db.prepare(`
      INSERT INTO provider_configs (provider_id, display_name, provider_type, base_url, validation_path, enabled, custom)
      VALUES ('agentmail', 'AgentMail', 'hosted', 'https://api.agentmail.to', '/v0/inboxes', 1, 1)
    `).run()
    const masterKey = Buffer.alloc(32, 4)
    const encrypted = encryptProviderSecret('agentmail-test-secret-value-1234567890', masterKey, 'test-key-v1')
    db.prepare(`
      INSERT INTO provider_secrets (
        provider_id, env_var_name, ciphertext, iv, auth_tag, algorithm, key_version, masked_preview, fingerprint_hash, created_by
      ) VALUES ('agentmail', 'AGENTMAIL_API_KEY', ?, ?, ?, ?, ?, 'am_****7890', 'unit-test-fingerprint', 'unit-test')
    `).run(encrypted.ciphertext, encrypted.iv, encrypted.auth_tag, encrypted.algorithm, encrypted.key_version)

    const status = buildAgentMailConnectStatus(db, {
      AGENTMAIL_API_KEY_REF: 'AGENTMAIL_API_KEY',
      MISSION_CONTROL_SECRETS_MASTER_KEY: masterKey.toString('base64'),
      AGENTMAIL_WS_URL: 'wss://api.agentmail.to/ws',
    })

    expect(status.status).toBe('sync_ready')
    expect((status as any).runtime_credentials.agentmail_api_key_ref).toBe('resolved')
    expect((status as any).api_key_fallback).toMatchObject({ state: 'detected', source: 'provider_vault', ref_status: 'resolved' })
    expect((status as any).secret_safety).toMatchObject({ raw_secret_exposed: false, client_exposed: false })
    expect(JSON.stringify(status)).not.toContain('agentmail-test-secret-value')
  })

  it('reports unresolved AgentMail bootstrap references without faking runtime visibility', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const status = buildAgentMailConnectStatus(db, { AGENTMAIL_API_KEY_REF: 'AGENTMAIL_API_KEY' })

    expect(status.status).toBe('api_key_required')
    expect((status as any).runtime_credentials.agentmail_api_key_ref).toBe('unresolved')
    expect((status as any).runtime_credential_blocker).toBe('agentmail_runtime_secret_store_required')
    expect(status.current_blocker).toBe('agentmail_runtime_secret_store_required')
  })

  it('builds inbox sync preview without provisioning or enabling sends', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const preview = buildAgentMailInboxSyncPreview(db, {}, { agentmail_mcp_config_detected: false })

    expect(preview).toMatchObject({
      ok: true,
      source: 'agentmail_inbox_sync_preview',
      organization_connected: false,
      connection_visible_to_runtime: false,
      organization_selected: false,
      provision_automatically: false,
      mutation_enabled: false,
      send_enabled: false,
      exact_blocker: 'agentmail_owner_sso_or_api_key_required',
      bridge_routing_preview: expect.any(Array),
      credential_values_exposed: false,
    })
    expect(preview.known_agents.map((agent: any) => agent.agent_id)).toEqual(expect.arrayContaining([
      'pi',
      'agent_zero',
      'gateway',
      'bridge_unit',
      'agentmail_monitor',
      'agentmail_audit',
    ]))
    expect(preview.missing_inbox_addresses).toHaveLength(6)
    expect(preview.provisioning_plan).toHaveLength(6)
    expect(preview.required_scoped_credentials.map((row: any) => row.agent_id)).toEqual(['pi', 'agent_zero'])
    expect(preview.required_permissions.find((row: any) => row.agent_id === 'pi')).toMatchObject({
      credential_scope: 'inbox',
      send_policy: 'owner_approval_required',
      scoped_credential_required: true,
      required_permissions: expect.arrayContaining(['message_send', 'draft_send']),
    })
    expect(preview.required_permissions.find((row: any) => row.agent_id === 'gateway')).toMatchObject({
      credential_scope: 'monitor_or_control_plane',
      send_policy: 'no_external_send_by_default',
      scoped_credential_required: false,
    })
    expect(preview.proposed_inbox_assignments.find((row: any) => row.agent_id === 'gateway')).toMatchObject({
      role: 'policy_router',
      autonomy_level: 'L0_monitor_only',
      owner_approval_required: true,
    })
  })

  it('creates only an owner approval request for AgentMail inbox provisioning', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const result = createAgentMailInboxProvisioningRequest(db, 'owner')

    expect(result).toMatchObject({
      ok: true,
      source: 'agentmail_inbox_provisioning_request',
      approval_state: expect.any(String),
      exact_blocker: 'canonical_owner_approval_required',
      provision_enabled: false,
      send_enabled: false,
      credential_values_exposed: false,
    })
    expect(result.preview.provision_automatically).toBe(false)
    expect(result.preview.mutation_enabled).toBe(false)
    expect(result.preview.send_enabled).toBe(false)
    expect(listAgentMailInboxes(db).every((inbox) => inbox.provision_state === 'not_provisioned')).toBe(true)
    expect(JSON.stringify(result)).not.toContain('agentmail-test-secret-value')
  })

  it('writes sanitized AgentMail connect audit records', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    recordAgentMailAudit(db, 'agentmail_console_opened', 'blocked', 'SECRET_KEY=agentmail-test-secret-value-1234567890')
    const audit = buildAgentMailPayload('audit', db) as { audit: Array<Record<string, unknown>> }

    expect(audit.audit[0]).toMatchObject({
      action: 'agentmail_console_opened',
      result: 'blocked',
    })
    expect(String(audit.audit[0].detail)).toContain('[redacted]')
    expect(JSON.stringify(audit)).not.toContain('agentmail-test-secret-value')
  })

it('reports per-agent send access blockers without enabling send execution', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const status = buildAgentMailSendAccessStatus(db, {})

    expect(status.global).toMatchObject({
      bridge_session_state: 'inactive',
      send_default: 'approval_required',
      execution_enabled: false,
    })
    expect(status.agents.pi).toMatchObject({
      inbox_status: 'missing',
      credential_status: 'missing',
      gateway_policy: 'approval_required',
      send_ready: false,
      bridge_allowed: true,
      dispatch_runtime_allowed: true,
    })
    expect(status.agents.pi.blockers).toEqual(expect.arrayContaining([
      'agentmail_inbox_assignment_missing',
      'agentmail_inbox_credential_required',
      'message_send_permission_missing',
    ]))
    expect(status.agents.pi.dispatch_blockers).toEqual(expect.arrayContaining([
      'owner_approval_required',
    ]))
    expect(status.agents.gateway).toMatchObject({
      gateway_policy: 'monitor_only',
      send_ready: false,
    })
    expect(status.agents.gateway.blockers).toContain('gateway_policy_monitor_only')
    expect(JSON.stringify(status)).not.toContain('agentmail-test-secret-value')
  })

  it('keeps AgentMail Bridge Session requests owner-gated and audited', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const request = createAgentMailBridgeSessionRequest(db, { requester: 'owner' })
    const status = buildAgentMailSendAccessStatus(db, { AGENTMAIL_CREDENTIAL_REF: 'configured' })

    expect(request).toMatchObject({
      ok: true,
      state: 'pending_owner_approval',
      execution_enabled: false,
      bridge_session_required: true,
      approval_request_created: expect.any(Boolean),
      credential_values_exposed: false,
    })
    expect(status.global.bridge_session_state).toBe('pending_owner_approval')
    expect(status.global.execution_enabled).toBe(false)
  })

  it('blocks dispatch without canonical message approval even when the dispatch runtime is active', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'pi'").run('pi@agentmail.to')

    const preview = createAgentMailSendPreview(db, {
      agent_id: 'pi',
      inbox_id: 'pi@agentmail.to',
      to: ['owner@example.com'],
      subject: 'AgentMail send test',
      text: 'This must not send without owner approval.',
    })
    const request = createAgentMailSendRequest(db, (preview as any).send_request.id)
    const dispatch = dispatchAgentMailSendRequest(db, (request as any).send_request.id)

    expect(preview).toMatchObject({
      ok: true,
      dispatch_enabled: false,
      exact_blocker: 'owner_approval_required',
    })
    expect(request).toMatchObject({
      ok: true,
      approval_required: true,
      dispatch_enabled: false,
    })
    expect(dispatch).toMatchObject({
      ok: false,
      dispatch_enabled: false,
      exact_blocker: 'owner_approval_required',
      credential_values_exposed: false,
    })
  })

  it('blocks a send request when an agent tries to use another agent inbox', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'pi'").run('pi@agentmail.to')
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'agent_zero'").run('agent-zero@agentmail.to')

    const preview = createAgentMailSendPreview(db, {
      agent_id: 'pi',
      inbox_id: 'agent-zero@agentmail.to',
      to: ['owner@example.com'],
      subject: 'Wrong inbox',
      text: 'Blocked.',
    })

    expect(preview).toMatchObject({
      ok: false,
      exact_blocker: 'wrong_agent_inbox',
      dispatch_enabled: false,
    })
  })

  it('activates an owner-approved AgentMail Bridge Session without enabling unrestricted dispatch', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    const request = createAgentMailBridgeSessionRequest(db, { requester: 'owner' })

    const approved = approveAgentMailBridgeSession(db, { actor: 'owner' })
    const status = buildAgentMailSendAccessStatus(db, { AGENTMAIL_CREDENTIAL_REF: 'configured' })

    expect(request.state).toBe('pending_owner_approval')
    expect(approved).toMatchObject({
      ok: true,
      state: 'active',
      execution_enabled: false,
      dispatch_enabled: false,
      bridge_session_active: true,
      credential_values_exposed: false,
    })
    expect(status.global.bridge_session_state).toBe('active')
    expect(status.global.agentmail_dispatch_runtime.status).toBe('active')
    expect(status.global.send_default).toBe('approval_required')
  })

  it('requires message approval, scoped credentials, and a real send adapter before dispatch', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'pi'").run('pi@agentmail.to')
    const preview = createAgentMailSendPreview(db, {
      agent_id: 'pi',
      inbox_id: 'pi@agentmail.to',
      to: ['owner@example.com'],
      subject: 'AgentMail safe send test',
      text: 'This should stay blocked until a real scoped AgentMail send adapter is present.',
    })
    const requested = createAgentMailSendRequest(db, (preview as any).send_request.id)
    const approved = approveAgentMailSendRequest(db, (requested as any).send_request.id, { actor: 'owner' })
    const dispatch = dispatchAgentMailSendRequest(db, (approved as any).send_request.id)

    expect(approved).toMatchObject({
      ok: true,
      approval_state: 'approved',
      dispatch_enabled: false,
      exact_blocker: null,
      dispatch_runtime: {
        status: 'active',
      },
    })
    expect(dispatch).toMatchObject({
      ok: false,
      dispatch_enabled: false,
      exact_blocker: 'scoped_credential_missing',
      credential_values_exposed: false,
    })
  })

  it('separates global setup readiness from per-send approval and dispatch runtime states', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'pi'").run('pi@agentmail.to')
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'agent_zero'").run('agent-zero@agentmail.to')
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = agent_id || '@agentmail.to', provision_state = 'assigned' WHERE inbox_address IS NULL").run()
    for (const agentId of ['pi', 'agent_zero']) {
      upsertAgentMailScopedCredentialMetadata(db, {
        agentId,
        inboxId: agentId === 'pi' ? 'pi@agentmail.to' : 'agent-zero@agentmail.to',
        credentialRef: agentId === 'pi' ? 'AGENTMAIL_PI_KEY' : 'AGENTMAIL_AGENT_ZERO_KEY',
        maskedPreview: 'am_****7890',
        permissions: {
          inbox_read: true,
          thread_read: true,
          message_read: true,
          message_send: true,
          message_update: true,
          draft_read: true,
          draft_create: true,
          draft_update: true,
          draft_send: true,
        },
      })
    }

    const ready = buildAgentMailSetupStatus(db, {
      AGENTMAIL_API_KEY: 'agentmail-test-secret-value-1234567890',
      AGENTMAIL_PI_KEY: 'agentmail-test-secret-value-1234567890',
      AGENTMAIL_AGENT_ZERO_KEY: 'agentmail-test-secret-value-abcdef',
      AGENTMAIL_WS_URL: 'wss://api.agentmail.to/ws',
    })
    expect(ready).toMatchObject({
      setup_state: 'approval_gated_send_ready',
      primary_blocker: 'ready',
      exact_blockers: [],
      per_send_status: { state: 'no_pending_send_request' },
    })

    const preview = createAgentMailSendPreview(db, {
      agent_id: 'pi',
      inbox_id: 'pi@agentmail.to',
      to: ['tony-88@agentmail.to'],
      subject: 'Mission Control AgentMail approval-gated send test',
      text: 'Controlled test preview only.',
    })
    const requested = createAgentMailSendRequest(db, (preview as any).send_request.id)
    const needsApproval = buildAgentMailSetupStatus(db, {
      AGENTMAIL_API_KEY: 'agentmail-test-secret-value-1234567890',
      AGENTMAIL_PI_KEY: 'agentmail-test-secret-value-1234567890',
      AGENTMAIL_AGENT_ZERO_KEY: 'agentmail-test-secret-value-abcdef',
      AGENTMAIL_WS_URL: 'wss://api.agentmail.to/ws',
    })
    expect(needsApproval.setup_state).toBe('approval_gated_send_ready')
    expect(needsApproval.per_send_status).toMatchObject({
      state: 'owner_approval_required',
      send_request_id: (requested as any).send_request.id,
      exact_blocker: 'owner_approval_required',
    })

    approveAgentMailSendRequest(db, (requested as any).send_request.id, { actor: 'owner' })
    const readyToDispatch = buildAgentMailSetupStatus(db, {
      AGENTMAIL_API_KEY: 'agentmail-test-secret-value-1234567890',
      AGENTMAIL_PI_KEY: 'agentmail-test-secret-value-1234567890',
      AGENTMAIL_AGENT_ZERO_KEY: 'agentmail-test-secret-value-abcdef',
      AGENTMAIL_WS_URL: 'wss://api.agentmail.to/ws',
    })
    expect(readyToDispatch.setup_state).toBe('approval_gated_send_ready')
    expect(readyToDispatch.per_send_status).toMatchObject({
      state: 'approved_send_dispatch_ready',
      send_request_id: (requested as any).send_request.id,
      exact_blocker: null,
    })
  })


  it('dispatches through the real AgentMail adapter after owner approval and always-on runtime without a temporary Bridge Session', async () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'pi'").run('pi@agentmail.to')
    upsertAgentMailScopedCredentialMetadata(db, {
      agentId: 'pi',
      inboxId: 'pi@agentmail.to',
      credentialRef: 'AGENTMAIL_PI_KEY',
      maskedPreview: 'am_****7890',
      permissions: {
        inbox_read: true,
        thread_read: true,
        message_read: true,
        message_send: true,
        message_update: true,
        draft_read: true,
        draft_create: true,
        draft_update: true,
        draft_send: true,
      },
    })
    const preview = createAgentMailSendPreview(db, {
      agent_id: 'pi',
      inbox_id: 'pi@agentmail.to',
      to: ['owner@example.com'],
      subject: 'AgentMail adapter test',
      text: 'This uses a mocked adapter and must store message IDs only after all gates pass.',
    })
    const requested = createAgentMailSendRequest(db, (preview as any).send_request.id)
    const approved = approveAgentMailSendRequest(db, (requested as any).send_request.id, { actor: 'owner' })
    const calls: any[] = []
    const dispatch = await dispatchAgentMailSendRequest(db, (approved as any).send_request.id, {
      env: { AGENTMAIL_PI_KEY: 'agentmail-test-secret-value-1234567890' },
      adapter: {
        sendAgentMailMessage: async (input: any) => {
          calls.push(input)
          return { ok: true, message_id: 'msg_live_1', thread_id: 'thread_live_1', provider_status: 'sent', credential_values_exposed: false, tokens_exposed: false, env_values_exposed: false }
        },
      },
    })

    expect(dispatch).toMatchObject({
      ok: true,
      dispatch_enabled: false,
      message_id: 'msg_live_1',
      thread_id: 'thread_live_1',
      bridge_session_id: null,
      credential_values_exposed: false,
      dispatch_runtime: {
        mode: 'always_on',
        status: 'active',
        default_policy: 'approval_gated_send',
      },
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      agentId: 'pi',
      inboxId: 'pi@agentmail.to',
      credentialRef: 'AGENTMAIL_PI_KEY',
      approvalId: (approved as any).send_request.approval_request_id,
      bridgeSessionId: null,
    })
    expect(JSON.stringify(dispatch)).not.toContain('agentmail-test-secret-value')
    expect(db.prepare('SELECT message_id, thread_id, state FROM agentmail_send_requests WHERE id = ?').get((approved as any).send_request.id)).toMatchObject({
      message_id: 'msg_live_1',
      thread_id: 'thread_live_1',
      state: 'dispatched',
    })
    expect(buildAgentMailSendAccessStatus(db, { AGENTMAIL_PI_KEY: 'agentmail-test-secret-value-1234567890' }).per_send_status).toMatchObject({
      state: 'no_pending_send_request',
      send_request_id: null,
      exact_blocker: null,
    })
  })

  it('blocks dispatch when the always-on AgentMail runtime is emergency-stopped', async () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'pi'").run('pi@agentmail.to')
    upsertAgentMailScopedCredentialMetadata(db, {
      agentId: 'pi',
      inboxId: 'pi@agentmail.to',
      credentialRef: 'AGENTMAIL_PI_KEY',
      maskedPreview: 'am_****7890',
      permissions: {
        inbox_read: true,
        thread_read: true,
        message_read: true,
        message_send: true,
        message_update: true,
      },
    })
    setAgentMailDispatchRuntimeEmergencyStop(db, true, 'owner')
    const runtime = buildAgentMailDispatchRuntimeStatus(db)
    expect(runtime).toMatchObject({
      mode: 'always_on',
      enabled: true,
      owner_enabled: true,
      emergency_stop: true,
      status: 'paused',
    })
    const preview = createAgentMailSendPreview(db, {
      agent_id: 'pi',
      inbox_id: 'pi@agentmail.to',
      to: ['owner@example.com'],
      subject: 'Blocked by runtime emergency stop',
      text: 'No adapter call should happen while emergency stop is active.',
    })
    const requested = createAgentMailSendRequest(db, (preview as any).send_request.id)
    const approved = approveAgentMailSendRequest(db, (requested as any).send_request.id, { actor: 'owner' })
    let called = false
    const dispatch = await dispatchAgentMailSendRequest(db, (approved as any).send_request.id, {
      env: { AGENTMAIL_PI_KEY: 'agentmail-test-secret-value-1234567890' },
      adapter: {
        sendAgentMailMessage: async () => {
          called = true
          return { ok: true, message_id: 'bad', thread_id: 'bad', provider_status: 'sent', credential_values_exposed: false, tokens_exposed: false, env_values_exposed: false }
        },
      },
    })

    expect(called).toBe(false)
    expect(dispatch).toMatchObject({
      ok: false,
      exact_blocker: 'agentmail_dispatch_runtime_paused',
      dispatch_runtime: {
        emergency_stop: true,
        status: 'paused',
      },
      dispatch_enabled: false,
      credential_values_exposed: false,
    })
  })

  it('does not call the AgentMail adapter when the scoped runtime secret is unavailable', async () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'pi'").run('pi@agentmail.to')
    upsertAgentMailScopedCredentialMetadata(db, {
      agentId: 'pi',
      inboxId: 'pi@agentmail.to',
      credentialRef: 'AGENTMAIL_PI_KEY',
      maskedPreview: 'am_****7890',
      permissions: { message_send: true, inbox_read: true, thread_read: true, message_read: true, message_update: true },
    })
    createAgentMailBridgeSessionRequest(db, { requester: 'owner' })
    approveAgentMailBridgeSession(db, { actor: 'owner' })
    const preview = createAgentMailSendPreview(db, {
      agent_id: 'pi',
      inbox_id: 'pi@agentmail.to',
      to: ['owner@example.com'],
      subject: 'Blocked missing runtime secret',
      text: 'No adapter call should happen.',
    })
    const requested = createAgentMailSendRequest(db, (preview as any).send_request.id)
    const approved = approveAgentMailSendRequest(db, (requested as any).send_request.id, { actor: 'owner' })
    let called = false
    const dispatch = await dispatchAgentMailSendRequest(db, (approved as any).send_request.id, {
      env: {},
      adapter: {
        sendAgentMailMessage: async () => { called = true; return { ok: true, message_id: 'bad', thread_id: 'bad', provider_status: 'sent', credential_values_exposed: false, tokens_exposed: false, env_values_exposed: false } },
      },
    })

    expect(called).toBe(false)
    expect(dispatch).toMatchObject({
      ok: false,
      exact_blocker: 'agentmail_runtime_secret_store_required',
      dispatch_enabled: false,
      credential_values_exposed: false,
    })
  })


  it('selects the exact AgentMail primary blocker by priority instead of collapsing to Bridge Session', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const setup = buildAgentMailSetupStatus(db, {})
    const sendAccess = buildAgentMailSendAccessStatus(db, {})

    expect(setup).toMatchObject({
      agentmail_ready: false,
      send_ready: false,
      primary_blocker: 'agentmail_owner_sso_or_api_key_required',
      setup_state: 'agentmail_owner_sso_or_api_key_required',
      per_send_status: {
        state: 'no_pending_send_request',
        send_request_id: null,
        exact_blocker: null,
      },
      next_action: 'connect_agentmail',
      inboxes: {
        total: 6,
        provisioned: 0,
        missing_addresses: 6,
      },
      credentials: {
        scoped_credentials_present: 0,
        required: 2,
      },
      checklist: {
        owner_connection: 'missing',
        inboxes_provisioned: 'no',
        inbox_addresses: 'missing',
        scoped_credentials: 'missing',
        action_bridge_session: 'inactive',
      },
    })
    expect(setup.blockers).toEqual(expect.arrayContaining([
      'agentmail_owner_sso_or_api_key_required',
      'agentmail_inbox_not_provisioned',
      'agentmail_inbox_address_missing',
      'agentmail_inbox_credential_required',
      'message_send_permission_missing',
    ]))
    expect(setup.primary_blocker).not.toBe('action_bridge_session_inactive')
    expect(setup.primary_blocker).not.toBe('bridge_session_required')
    expect(sendAccess.primary_blocker).toBe('agentmail_owner_sso_or_api_key_required')
    expect(sendAccess.exact_blockers[0]).toBe('agentmail_owner_sso_or_api_key_required')
    expect(JSON.stringify(setup)).not.toContain('agentmail-test-secret-value')
  })

  it('treats a resolved bootstrap credential as runtime-visible for inbox sync even before the WebSocket monitor runs', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const setup = buildAgentMailSetupStatus(db, {
      AGENTMAIL_API_KEY: 'agentmail-test-secret-value-1234567890',
    })

    expect(setup.primary_blocker).toBe('agentmail_inbox_assignment_missing')
    expect(setup.blockers).not.toContain('agentmail_connection_not_visible_to_runtime')
    expect(setup.next_action).toBe('sync_or_provision_inbox_registry')
    expect(JSON.stringify(setup)).not.toContain('agentmail-test-secret-value')
  })

  it('prioritizes provisioning and credential blockers before Action Bridge Session once owner connection is present', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const setup = buildAgentMailSetupStatus(db, {
      AGENTMAIL_API_KEY: 'agentmail-test-secret-value-1234567890',
      AGENTMAIL_WS_URL: 'wss://api.agentmail.to/ws',
    })

    expect(setup.primary_blocker).toBe('agentmail_inbox_assignment_missing')
    expect(setup.blockers).toEqual(expect.arrayContaining([
      'agentmail_inbox_not_provisioned',
      'agentmail_inbox_address_missing',
      'agentmail_inbox_credential_required',
    ]))
    expect(setup.next_action).toBe('sync_or_provision_inbox_registry')
    expect(JSON.stringify(setup)).not.toContain('agentmail-test-secret-value')
  })

  it('maps provisioned inboxes with missing scoped credentials before owner approval and Action Bridge blockers', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'pi'").run('pi@agentmail.to')
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'agent_zero'").run('agent-zero@agentmail.to')
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = agent_id || '@agentmail.to', provision_state = 'assigned' WHERE inbox_address IS NULL").run()

    const setup = buildAgentMailSetupStatus(db, {
      AGENTMAIL_API_KEY: 'agentmail-test-secret-value-1234567890',
      AGENTMAIL_WS_URL: 'wss://api.agentmail.to/ws',
    })

    expect(setup.primary_blocker).toBe('agentmail_inbox_credential_required')
    expect(setup.blockers).toEqual(expect.arrayContaining([
      'agentmail_inbox_credential_required',
      'message_send_permission_missing',
    ]))
    expect(setup.next_action).toBe('provision_scoped_inbox_credentials')
    expect(setup.send_ready).toBe(false)
    expect(setup.per_send_status.state).toBe('no_pending_send_request')
  })

  it('previews scoped AgentMail credentials for every assigned inbox with role-specific permissions and no send', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    assignCanonicalAgentMailInboxes(db)

    const preview = buildAgentMailCredentialProvisionPreview(db, {
      AGENTMAIL_API_KEY: 'agentmail-test-secret-value-1234567890',
    })

    expect(preview).toMatchObject({
      ok: true,
      source: 'agentmail_scoped_credential_provision_preview',
      provision_automatically: false,
      provider_vault_available: expect.any(Boolean),
      email_sent: false,
      send_enabled: false,
      credential_values_exposed: false,
    })
    expect(preview.targets).toHaveLength(6)
    expect(preview.targets.find((row: any) => row.agent_id === 'pi')).toMatchObject({
      inbox_id: 'pi-88@agentmail.to',
      credential_ref: 'AGENTMAIL_INBOX_KEY_PI',
      credential_scope: 'inbox',
      send_capable: true,
      send_policy: 'approval_gated_send',
      proposed_permissions: expect.objectContaining({
        inbox_read: true,
        thread_read: true,
        message_read: true,
        message_send: true,
        message_update: true,
        draft_read: true,
        draft_create: true,
        draft_update: true,
        draft_send: true,
      }),
    })
    expect(preview.targets.find((row: any) => row.agent_id === 'gateway')).toMatchObject({
      inbox_id: 'gateway@agentmail.to',
      credential_ref: 'AGENTMAIL_INBOX_KEY_GATEWAY',
      send_capable: false,
      send_policy: 'no_normal_external_send',
      proposed_permissions: expect.objectContaining({
        inbox_read: true,
        thread_read: true,
        message_read: true,
        message_update: true,
        message_send: false,
        draft_send: false,
      }),
    })
    expect(preview.targets.find((row: any) => row.agent_id === 'agentmail_audit')).toMatchObject({
      credential_ref: 'AGENTMAIL_INBOX_KEY_AUDIT_ARCHIVE',
      send_policy: 'no_send',
      proposed_permissions: expect.objectContaining({
        inbox_read: true,
        thread_read: true,
        message_read: true,
        message_send: false,
        message_update: false,
      }),
    })
    expect(JSON.stringify(preview)).not.toContain('agentmail-test-secret-value')
  })

  it('creates and stores scoped AgentMail inbox credentials only after owner approval without sending email', async () => {
    const db = new Database(':memory:')
    const masterKey = Buffer.alloc(32, 18)
    const bootstrapSecret = 'agentmail-bootstrap-secret-value-1234567890'
    ensureAgentMailSchema(db)
    assignCanonicalAgentMailInboxes(db)
    seedAgentMailBootstrapSecret(db, masterKey, bootstrapSecret)
    const requested = createAgentMailCredentialProvisionRequest(db, 'owner')
    const approved = approveAgentMailCredentialProvision(db, { approvalId: requested.approval_id, actor: 'owner' } as any)
    expect(approved).toMatchObject({ ok: true, approval_state: 'approved' })
    const calls: Array<{ method: string; url: string; body?: any; auth: string }> = []

    const result = await applyAgentMailCredentialProvision({
      db,
      env: {
        AGENTMAIL_API_KEY_REF: 'AGENTMAIL_API_KEY',
        MISSION_CONTROL_SECRETS_MASTER_KEY: masterKey.toString('base64'),
      },
      fetchImpl: async (url: any, init: any) => {
        const method = String(init?.method || 'GET').toUpperCase()
        const body = init?.body ? JSON.parse(String(init.body)) : undefined
        const auth = String((init?.headers as Record<string, string>)?.Authorization || '')
        calls.push({ method, url: String(url), body, auth })
        if (method === 'POST' && String(url).includes('/api-keys')) {
          const inboxId = decodeURIComponent(String(url).split('/v0/inboxes/')[1].split('/api-keys')[0])
          return new Response(JSON.stringify({
            api_key_id: `key_${inboxId.replace(/[^a-z0-9]/gi, '_')}`,
            api_key: `agentmail-scoped-key-${inboxId}-1234567890`,
            prefix: 'am_test',
            name: body?.name,
            pod_id: 'pod_live_1',
            inbox_id: inboxId,
            permissions: body?.permissions,
          }), { status: 200 })
        }
        if (method === 'GET' && String(url).includes('/v0/inboxes/')) {
          const inboxId = decodeURIComponent(String(url).split('/v0/inboxes/')[1])
          return new Response(JSON.stringify({ inbox_id: inboxId, email: inboxId, display_name: inboxId }), { status: 200 })
        }
        throw new Error(`unexpected AgentMail credential test call ${method} ${url}`)
      },
    } as any)

    expect(result).toMatchObject({
      ok: true,
      source: 'agentmail_scoped_credential_provision_apply',
      credentials_created: 6,
      credentials_stored: 6,
      current_primary_blocker: 'ready',
      scoped_credentials_created: true,
      email_sent: false,
      send_enabled: false,
      credential_values_exposed: false,
    })
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(6)
    expect(calls.some((call) => call.url.includes('/messages') || call.url.includes('/send'))).toBe(false)
    expect(calls.every((call) => call.auth === `Bearer ${bootstrapSecret}` || call.auth.startsWith('Bearer agentmail-scoped-key-'))).toBe(true)
    expect(calls.find((call) => call.url.includes('pi-88%40agentmail.to'))?.body.permissions.message_send).toBe(true)
    expect(calls.find((call) => call.url.includes('gateway%40agentmail.to'))?.body.permissions.message_send).toBe(false)
    expect(calls.find((call) => call.url.includes('audit-88%40agentmail.to'))?.body.permissions.message_update).toBe(false)
    const sendAccess = buildAgentMailSendAccessStatus(db, {
      MISSION_CONTROL_SECRETS_MASTER_KEY: masterKey.toString('base64'),
      AGENTMAIL_API_KEY_REF: 'AGENTMAIL_API_KEY',
    })
    expect((sendAccess.agents.pi as any).credential_status).toBe('scoped')
    expect((sendAccess.agents.pi as any).permission_status.message_send).toBe(true)
    expect((sendAccess.agents.pi as any).approval_gated_send_capable).toBe(true)
    expect((sendAccess.agents.pi as any).agentmail_provider_send_allowlist).toMatchObject({
      status: 'unknown',
      required_next_action: 'verify_recipient_in_agentmail_provider_send_allowlist_before_dispatch',
      credential_values_exposed: false,
    })
    expect((sendAccess.agents.gateway as any).permission_status.message_send).toBe(false)
    expect((sendAccess.agents.gateway as any).agentmail_provider_send_allowlist.status).toBe('not_required')
    expect((sendAccess.agents.agentmail_audit as any).permission_status.message_send).toBe(false)
    expect(sendAccess.primary_blocker).toBe('ready')
    expect(sendAccess.setup_state).toBe('approval_gated_send_ready')
    expect(sendAccess.per_send_status.state).toBe('no_pending_send_request')
    expect(sendAccess.exact_blockers).toEqual([])
    expect(JSON.stringify(result)).not.toContain(bootstrapSecret)
    expect(JSON.stringify(result)).not.toContain('agentmail-scoped-key-')
  })

  it('reports provider-side send allowlist evidence from sanitized audit records', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    assignCanonicalAgentMailInboxes(db)
    db.prepare(`
      INSERT INTO agentmail_audit (id, event_id, action, result, detail, created_at)
      VALUES ('ama_allowlist_pi', 'evt_allowlist_pi', 'agentmail_send_allowlist_entry_verified', 'ok', 'inbox=pi-88@agentmail.to;entry=tony-88@agentmail.to;created=true', unixepoch())
    `).run()

    const sendAccess = buildAgentMailSendAccessStatus(db, {})
    expect((sendAccess.agents.pi as any).agentmail_provider_send_allowlist).toMatchObject({
      status: 'configured',
      last_verified_recipient: 'tony-88@agentmail.to',
      credential_values_exposed: false,
      tokens_exposed: false,
    })
    expect((sendAccess.agents.agent_zero as any).agentmail_provider_send_allowlist).toMatchObject({
      status: 'unknown',
      required_next_action: 'verify_recipient_in_agentmail_provider_send_allowlist_before_dispatch',
    })
  })

  it('verifies recipient visibility without assuming sender thread IDs match recipient thread IDs', async () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    assignCanonicalAgentMailInboxes(db)
    upsertAgentMailScopedCredentialMetadata(db, {
      agentId: 'pi',
      inboxId: 'pi-88@agentmail.to',
      credentialRef: 'AGENTMAIL_INBOX_KEY_PI',
      maskedPreview: 'am_****send',
      permissions: { inbox_read: true, thread_read: true, message_read: true, message_send: true, message_update: true },
    })
    upsertAgentMailScopedCredentialMetadata(db, {
      agentId: 'agentmail_monitor',
      inboxId: 'tony-88@agentmail.to',
      credentialRef: 'AGENTMAIL_INBOX_KEY_MONITOR',
      maskedPreview: 'am_****read',
      permissions: { inbox_read: true, thread_read: true, message_read: true },
    })
    db.prepare(`
      INSERT INTO agentmail_send_requests (
        id, agent_id, inbox_id, to_json, cc_json, bcc_json, subject, text_body,
        html_body, thread_id, reply_to_message_id, labels_json, state, gateway_policy,
        exact_blocker, approval_request_id, bridge_session_id, message_id, created_at, updated_at
      ) VALUES (
        'amsr_receive_1', 'pi', 'pi-88@agentmail.to', '["tony-88@agentmail.to"]', '[]', '[]',
        'Mission Control AgentMail approval-gated send test', 'body omitted from status', null,
        'sender-thread-1', null, '[]', 'dispatched', 'approval_required', null,
        'approval_1', null, '<known-message@email.example>', 1780934855, 1780934855
      )
    `).run()

    const calls: Array<{ method: string; url: string }> = []
    const result = await verifyAgentMailReceivePath({
      db,
      env: {
        AGENTMAIL_INBOX_KEY_PI: 'agentmail-test-sender-key-1234567890',
        AGENTMAIL_INBOX_KEY_MONITOR: 'agentmail-test-monitor-key-1234567890',
      },
      fetchImpl: async (url: any, init: any) => {
        calls.push({ method: String(init?.method || 'GET'), url: String(url) })
        expect(String(init?.method || 'GET')).toBe('GET')
        expect(String(url)).not.toContain('/messages/send')
        if (String(url).includes('pi-88%40agentmail.to/threads/sender-thread-1')) {
          return new Response(JSON.stringify({ id: 'sender-thread-1', messages: [{ message_id: '<known-message@email.example>', thread_id: 'sender-thread-1' }] }), { status: 200 })
        }
        if (String(url).includes('tony-88%40agentmail.to/threads/sender-thread-1')) {
          return new Response(JSON.stringify({ message: 'not found' }), { status: 404 })
        }
        if (String(url).includes('tony-88%40agentmail.to/messages/%3Cknown-message%40email.example%3E')) {
          return new Response(JSON.stringify({ message: 'not found' }), { status: 404 })
        }
        if (String(url).endsWith('/v0/inboxes/tony-88%40agentmail.to/messages')) {
          return new Response(JSON.stringify({ data: [{
            id: 'recipient-visible-message-1',
            thread_id: 'recipient-thread-9',
            subject: 'Mission Control AgentMail approval-gated send test',
            from: 'pi-88@agentmail.to',
            to: ['tony-88@agentmail.to'],
            received_at: '2026-06-08T20:07:35.000Z',
          }] }), { status: 200 })
        }
        if (String(url).endsWith('/v0/inboxes/tony-88%40agentmail.to/threads')) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 })
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      },
    })

    expect(result).toMatchObject({
      ok: true,
      exact_blocker: null,
      email_sent: false,
      recipient_visible_message_id: 'recipient-visible-message-1',
      recipient_visible_thread_id: 'recipient-thread-9',
      credential_values_exposed: false,
    })
    expect(calls.some((call) => call.method !== 'GET')).toBe(false)
    expect(calls.some((call) => call.url.includes('/messages/send'))).toBe(false)
    const receivePath = buildAgentMailReceivePathStatus(db)
    expect(receivePath).toMatchObject({
      sender_sent_message_visible: true,
      recipient_read_credential_ok: true,
      sender_thread_id_recipient_visible: false,
      recipient_message_by_subject: 'found',
      recipient_visible_message_id: 'recipient-visible-message-1',
      recipient_visible_thread_id: 'recipient-thread-9',
      final_blocker: null,
      credential_values_exposed: false,
    })
    expect(receivePath.lookup_methods_attempted).toEqual(expect.arrayContaining(['recipient_thread_id', 'message_id', 'subject']))
    expect(JSON.stringify(result)).not.toContain('agentmail-test-sender-key')
    expect(JSON.stringify(result)).not.toContain('agentmail-test-monitor-key')
  })

  it('reports received message not visible after all read-only fallbacks miss', async () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    assignCanonicalAgentMailInboxes(db)
    upsertAgentMailScopedCredentialMetadata(db, {
      agentId: 'pi',
      inboxId: 'pi-88@agentmail.to',
      credentialRef: 'AGENTMAIL_INBOX_KEY_PI',
      maskedPreview: 'am_****send',
      permissions: { inbox_read: true, thread_read: true, message_read: true, message_send: true, message_update: true },
    })
    upsertAgentMailScopedCredentialMetadata(db, {
      agentId: 'agentmail_monitor',
      inboxId: 'tony-88@agentmail.to',
      credentialRef: 'AGENTMAIL_INBOX_KEY_MONITOR',
      maskedPreview: 'am_****read',
      permissions: { inbox_read: true, thread_read: true, message_read: true },
    })
    db.prepare(`
      INSERT INTO agentmail_send_requests (
        id, agent_id, inbox_id, to_json, cc_json, bcc_json, subject, text_body,
        html_body, thread_id, reply_to_message_id, labels_json, state, gateway_policy,
        exact_blocker, approval_request_id, bridge_session_id, message_id, created_at, updated_at
      ) VALUES (
        'amsr_receive_missing', 'pi', 'pi-88@agentmail.to', '["tony-88@agentmail.to"]', '[]', '[]',
        'Mission Control AgentMail approval-gated send test', 'body omitted from status', null,
        'sender-thread-missing', null, '[]', 'dispatched', 'approval_required', null,
        'approval_1', null, '<missing-message@email.example>', 1780934855, 1780934855
      )
    `).run()

    const result = await verifyAgentMailReceivePath({
      db,
      env: {
        AGENTMAIL_INBOX_KEY_PI: 'agentmail-test-sender-key-1234567890',
        AGENTMAIL_INBOX_KEY_MONITOR: 'agentmail-test-monitor-key-1234567890',
      },
      fetchImpl: async (url: any, init: any) => {
        expect(String(init?.method || 'GET')).toBe('GET')
        expect(String(url)).not.toContain('/messages/send')
        if (String(url).includes('pi-88%40agentmail.to')) {
          return new Response(JSON.stringify({ data: [{ message_id: '<missing-message@email.example>', thread_id: 'sender-thread-missing' }] }), { status: 200 })
        }
        return new Response(JSON.stringify({ data: [] }), { status: String(url).includes('/threads/sender-thread-missing') ? 404 : 200 })
      },
    })

    expect(result).toMatchObject({
      ok: false,
      exact_blocker: 'agentmail_received_message_not_visible',
      email_sent: false,
      credential_values_exposed: false,
    })
    expect(buildAgentMailReceivePathStatus(db)).toMatchObject({
      sender_sent_message_visible: true,
      recipient_read_credential_ok: true,
      sender_thread_id_recipient_visible: false,
      recipient_visible_message_id: null,
      recipient_visible_thread_id: null,
      final_blocker: 'agentmail_received_message_not_visible',
    })
  })

})
