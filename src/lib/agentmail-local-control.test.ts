import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { encryptProviderSecret, ensureProviderVaultSchema } from '@/lib/provider-vault'

import {
  AGENTMAIL_CONSOLE_URL,
  AGENTMAIL_MCP_URL,
  buildAgentMailPayload,
  buildAgentMailStatus,
  buildAgentMailConnectStatus,
  buildAgentMailInboxSyncPreview,
  approveAgentMailBridgeSession,
  approveAgentMailSendRequest,
  buildAgentMailSendAccessStatus,
  buildAgentMailSetupStatus,
  createAgentMailBridgeSessionRequest,
  createAgentMailInboxProvisioningRequest,
  createAgentMailSendPreview,
  createAgentMailSendRequest,
  dispatchAgentMailSendRequest,
  upsertAgentMailScopedCredentialMetadata,
  ensureAgentMailSchema,
  ingestAgentMailEvent,
  listAgentMailInboxes,
  normalizeAgentMailEvent,
  recordAgentMailAudit,
  validateInboxRegistry,
} from '@/lib/agentmail-local-control'

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
      'action_bridge_session_required',
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

  it('masks AgentMail API-key fallback and keeps send Bridge/approval gated', () => {
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
      bridge_session_status: 'action_bridge_session_required',
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
      bridge_allowed: false,
    })
    expect(status.agents.pi.blockers).toEqual(expect.arrayContaining([
      'agentmail_inbox_assignment_missing',
      'agentmail_inbox_credential_required',
      'message_send_permission_missing',
      'action_bridge_session_inactive',
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

  it('blocks dispatch without canonical message approval and active Bridge Session', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'pi'").run('pi@agentmail.to')

    const preview = createAgentMailSendPreview(db, {
      agent_id: 'pi',
      inbox_id: 'pi@agentmail.to',
      to: ['owner@example.com'],
      subject: 'AgentMail send test',
      text: 'This must not send without approval and Bridge Session.',
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
      exact_blocker: 'action_bridge_session_inactive',
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
    expect(status.global.send_default).toBe('approval_required')
  })

  it('requires message approval, scoped credentials, and a real send adapter before dispatch', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'pi'").run('pi@agentmail.to')
    createAgentMailBridgeSessionRequest(db, { requester: 'owner' })
    approveAgentMailBridgeSession(db, { actor: 'owner' })

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
    })
    expect(dispatch).toMatchObject({
      ok: false,
      dispatch_enabled: false,
      exact_blocker: 'scoped_credential_missing',
      credential_values_exposed: false,
    })
  })


  it('dispatches through the real AgentMail adapter only after every gate passes', async () => {
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
    createAgentMailBridgeSessionRequest(db, { requester: 'owner' })
    const bridge = approveAgentMailBridgeSession(db, { actor: 'owner' })
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
      bridge_session_id: (bridge as any).bridge_session_id,
      credential_values_exposed: false,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      agentId: 'pi',
      inboxId: 'pi@agentmail.to',
      credentialRef: 'AGENTMAIL_PI_KEY',
      approvalId: (approved as any).send_request.approval_request_id,
      bridgeSessionId: (bridge as any).bridge_session_id,
    })
    expect(JSON.stringify(dispatch)).not.toContain('agentmail-test-secret-value')
    expect(db.prepare('SELECT message_id, thread_id, state FROM agentmail_send_requests WHERE id = ?').get((approved as any).send_request.id)).toMatchObject({
      message_id: 'msg_live_1',
      thread_id: 'thread_live_1',
      state: 'dispatched',
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
      'action_bridge_session_inactive',
      'owner_approval_required',
    ]))
    expect(setup.primary_blocker).not.toBe('action_bridge_session_inactive')
    expect(setup.primary_blocker).not.toBe('bridge_session_required')
    expect(sendAccess.primary_blocker).toBe('agentmail_owner_sso_or_api_key_required')
    expect(sendAccess.exact_blockers[0]).toBe('agentmail_owner_sso_or_api_key_required')
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
      'action_bridge_session_inactive',
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
      'owner_approval_required',
      'action_bridge_session_inactive',
    ]))
    expect(setup.next_action).toBe('provision_scoped_inbox_credentials')
    expect(setup.send_ready).toBe(false)
  })

})
