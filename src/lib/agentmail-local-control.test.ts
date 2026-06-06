import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import {
  AGENTMAIL_CONSOLE_URL,
  AGENTMAIL_MCP_URL,
  buildAgentMailPayload,
  buildAgentMailStatus,
  buildAgentMailConnectStatus,
  buildAgentMailInboxSyncPreview,
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

    const status = buildAgentMailConnectStatus(db, {})

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
      'bridge_session_required',
      'monitor_ready',
    ])
    expect(JSON.stringify(status)).not.toContain('localhost')
    expect(JSON.stringify(status)).not.toContain('127.0.0.1')
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
      bridge_session_status: 'bridge_session_required',
      send_state: 'approval_required',
      execution_enabled: false,
      send_enabled: false,
    })
    expect(JSON.stringify(status)).not.toContain('agentmail-test-secret-value')
  })

  it('builds inbox sync preview without provisioning or enabling sends', () => {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)

    const preview = buildAgentMailInboxSyncPreview(db)

    expect(preview).toMatchObject({
      ok: true,
      source: 'agentmail_inbox_sync_preview',
      organization_connected: false,
      provision_automatically: false,
      send_enabled: false,
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
    expect(preview.proposed_inbox_assignments.find((row: any) => row.agent_id === 'gateway')).toMatchObject({
      role: 'policy_router',
      autonomy_level: 'L0_monitor_only',
      owner_approval_required: true,
    })
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
})
