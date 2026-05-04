import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  AGENT_ZERO_BRIDGE_SESSION_ACTION,
  AGENT_ZERO_BRIDGE_SESSION_OWNER_PROMPT,
  createOrReuseAgentZeroBridgeSession,
  evaluateHermesBridgeSessionAction,
  ensureAgentZeroBridgeSessionTables,
  readLatestAgentZeroBridgeSession,
  recordAgentZeroBridgeSessionAudit,
} from './agent-zero-bridge-session'

function setupDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);
    INSERT INTO users (id, username) VALUES (1, 'owner');

    CREATE TABLE bridge_approval_requests (
      id TEXT PRIMARY KEY,
      workspace_id INTEGER NOT NULL DEFAULT 1,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      connector TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      target_key TEXT NOT NULL DEFAULT '',
      requester TEXT NOT NULL,
      requester_user_id INTEGER,
      risk_level TEXT NOT NULL,
      approval_state TEXT NOT NULL,
      protected_category TEXT NOT NULL,
      approval_scope_json TEXT NOT NULL DEFAULT '{}',
      scope_hash TEXT NOT NULL,
      reason TEXT,
      required_approver TEXT NOT NULL DEFAULT 'owner',
      rollback_available INTEGER NOT NULL DEFAULT 0,
      rollback_ref TEXT,
      expires_at TEXT,
      resolved_at TEXT,
      resolved_by TEXT,
      resolved_by_user_id INTEGER,
      resolution_reason TEXT,
      correlation_id TEXT NOT NULL,
      idempotency_key TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE UNIQUE INDEX idx_bridge_approval_requests_idempotency_test
      ON bridge_approval_requests(workspace_id, tenant_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;

    CREATE TABLE bridge_audit_events (
      id TEXT PRIMARY KEY,
      workspace_id INTEGER NOT NULL DEFAULT 1,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      approval_request_id TEXT,
      actor TEXT NOT NULL,
      actor_user_id INTEGER,
      connector TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      target_key TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL,
      payload_hash TEXT,
      before_ref TEXT,
      after_ref TEXT,
      rollback_ref TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      correlation_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `)
  ensureAgentZeroBridgeSessionTables(db)
  return db
}

const requester = {
  userId: 1,
  username: 'owner',
  workspaceId: 1,
  tenantId: 1,
}

describe('Agent Zero Bridge Session approval gate', () => {
  it('creates one pending approval prompt without enabling execution', () => {
    const db = setupDb()
    const result = createOrReuseAgentZeroBridgeSession({ db, requester, now: new Date('2026-05-03T14:00:00.000Z') })

    expect(result.ok).toBe(true)
    expect(result.approval_request_created).toBe(true)
    expect(result.reused_existing).toBe(false)
    expect(result.session.status).toBe('pending_approval')
    expect(result.session.execution_enabled).toBe(false)
    expect(result.session.approval_prompt).toBe(AGENT_ZERO_BRIDGE_SESSION_OWNER_PROMPT)
    expect(result.session.scope).toContain('tools, skills, models, agents, integrations, Brain adapters')
    expect(result.session.participants.map((participant) => participant.agent_id)).toEqual(['agent_zero', 'hermes'])
    expect(result.session.agent_zero_authority.approves_and_delegates_hermes_actions).toBe(true)
    expect(result.session.hermes_permissions.default_allowed_actions).toContain('hermes.plan')
    expect(result.session.hermes_permissions.default_allowed_actions).toContain('hermes.workflow_plan')
    expect(result.session.hermes_permissions.explicit_execution_actions).toContain('hermes.report.draft')
    expect(result.session.hermes_permissions.explicit_execution_actions).toContain('hermes.skill_spec.draft')
    expect(result.session.hermes_permissions.external_email_requires_domain_allow_list).toBe(true)
    expect(result.session.hermes_permissions.blocked_actions).toContain('hermes.raw_shell')
    expect(result.session.allowed_tools).toContain('all_registered_tools')
    expect(result.session.allowed_tools).toContain('all_registered_execution_adapters')
    expect(result.session.allowed_skills).toContain('all_registered_skills')
    expect(result.session.allowed_delivery_surfaces).toContain('all_registered_delivery_surfaces')
    expect(result.session.allowed_delivery_surfaces).toContain('agentmail_if_connector_configured')
    expect(result.session.allowed_tools).toContain('buildwiki.run_now')
    expect(result.session.allowed_integrations).toContain('google_drive_if_connector_configured')
    expect(result.session.allowed_integrations).toContain('agentmail_if_configured')
    expect(result.session.allowed_brain_access).toContain('obsidian.read_adapter')
    expect(result.session.blocked_scopes).toContain('docker_socket')
    expect(result.session.safety_contract).toMatchObject({
      one_bridge_session_approval_model: true,
      no_approval_spam: true,
      every_action_audited: true,
      every_agent_zero_and_hermes_action_audited: true,
      no_fake_completion: true,
      raw_root_shell_enabled: false,
      docker_socket_enabled: false,
      direct_secret_reads_enabled: false,
    })
    expect(result.session.audit_log[0]).toMatchObject({ action: 'bridge_session.approval_requested', outcome: 'approval_requested' })

    const approval = db.prepare('SELECT action, approval_state, reason, approval_scope_json FROM bridge_approval_requests LIMIT 1').get() as any
    expect(approval.action).toBe(AGENT_ZERO_BRIDGE_SESSION_ACTION)
    expect(approval.approval_state).toBe('pending')
    expect(approval.reason).toBe(AGENT_ZERO_BRIDGE_SESSION_OWNER_PROMPT)
    const scope = JSON.parse(approval.approval_scope_json)
    expect(scope.one_bridge_session_approval_model).toBe(true)
    expect(scope.participants.map((participant: any) => participant.agent_id)).toEqual(['agent_zero', 'hermes'])
    expect(scope.agent_zero_authority.approves_and_delegates_hermes_actions).toBe(true)
    expect(scope.hermes_permissions.default_allowed_actions).toContain('hermes.plan')
    expect(scope.allowed_skills).toContain('all_registered_skills')
    expect(scope.allowed_delivery_surfaces).toContain('all_registered_delivery_surfaces')
    expect(scope.raw_root_shell_enabled).toBe(false)
    expect(scope.docker_socket_enabled).toBe(false)
    expect(scope.direct_secret_reads_enabled).toBe(false)
  })

  it('reuses a pending or active session instead of creating duplicate prompts', () => {
    const db = setupDb()
    const first = createOrReuseAgentZeroBridgeSession({ db, requester })
    const second = createOrReuseAgentZeroBridgeSession({ db, requester })

    expect(first.session.approval_request_id).toBe(second.session.approval_request_id)
    expect(second.approval_request_created).toBe(false)
    expect(second.reused_existing).toBe(true)
    expect(second.session.duplicate_prompt_prevented).toBe(true)
    const count = (db.prepare('SELECT COUNT(*) AS count FROM bridge_approval_requests').get() as any).count
    expect(count).toBe(1)
  })

  it('activates execution only after the owner approval row is approved', () => {
    const db = setupDb()
    const created = createOrReuseAgentZeroBridgeSession({ db, requester, now: new Date('2026-05-03T14:00:00.000Z') })

    db.prepare(`UPDATE bridge_approval_requests SET approval_state = 'approved', resolved_at = ?, resolved_by = 'owner' WHERE id = ?`)
      .run('2026-05-03T14:05:00.000Z', created.session.approval_request_id)

    const read = readLatestAgentZeroBridgeSession({ db, sync: true, now: new Date('2026-05-03T14:06:00.000Z') })
    expect(read.session.status).toBe('active')
    expect(read.session.execution_enabled).toBe(true)
    expect(read.session.started_at).toBe('2026-05-03T14:05:00.000Z')
  })

  it('audits scoped actions inside an active session and blocks unaudited execution without one', () => {
    const db = setupDb()
    const blocked = recordAgentZeroBridgeSessionAudit({ db, requester, action: 'mcp.tools.schema_read' })
    expect(blocked.ok).toBe(false)
    expect(blocked.http_status).toBe(423)

    const created = createOrReuseAgentZeroBridgeSession({ db, requester })
    db.prepare(`UPDATE bridge_approval_requests SET approval_state = 'approved', resolved_at = ? WHERE id = ?`)
      .run('2026-05-03T14:05:00.000Z', created.session.approval_request_id)

    const audited = recordAgentZeroBridgeSessionAudit({
      db,
      requester,
      sessionId: created.session.session_id,
      action: 'mcp.tools.schema_read',
      target: 'zapier',
      metadata: { tool_count: 12 },
      now: new Date('2026-05-03T14:06:00.000Z'),
    })

    expect(audited.ok).toBe(true)
    expect(audited.execution_enabled).toBe(true)
    expect(audited.audit_event).toMatchObject({ action: 'mcp.tools.schema_read', target: 'zapier', outcome: 'allowed' })
    expect(audited.session.safety_contract.direct_secret_reads_enabled).toBe(false)
    expect(JSON.stringify(audited)).not.toMatch(/sk-[A-Za-z0-9]|AIzaSy|xox[baprs]-/)
  })

  it('audits Hermes actions inside the same Agent Zero Bridge Session', () => {
    const db = setupDb()
    const created = createOrReuseAgentZeroBridgeSession({ db, requester })
    db.prepare(`UPDATE bridge_approval_requests SET approval_state = 'approved', resolved_at = ? WHERE id = ?`)
      .run('2026-05-03T14:05:00.000Z', created.session.approval_request_id)

    const audited = recordAgentZeroBridgeSessionAudit({
      db,
      requester,
      sessionId: created.session.session_id,
      agentId: 'hermes',
      action: 'hermes.skill_spec.draft',
      target: 'email-triage-skill-draft',
      metadata: { delegated_by_agent_zero: true },
      now: new Date('2026-05-03T14:06:00.000Z'),
    })

    expect(audited.ok).toBe(true)
    expect(audited.audit_event).toMatchObject({
      action: 'hermes.skill_spec.draft',
      target: 'email-triage-skill-draft',
      outcome: 'allowed',
    })
    expect(audited.audit_event?.metadata).toMatchObject({
      audited_agent_id: 'hermes',
      agent_zero_remains_commander: true,
      hermes_execution_requires_delegation: true,
    })
    const row = db.prepare(`SELECT agent_id FROM bridge_session_audit_events WHERE action = 'hermes.skill_spec.draft' LIMIT 1`).get() as any
    expect(row.agent_id).toBe('hermes')
  })

  it('allows Hermes planning by default but gates execution on active session, delegation, connector, and domain rules', () => {
    const pending = createOrReuseAgentZeroBridgeSession({ db: setupDb(), requester }).session
    const planning = evaluateHermesBridgeSessionAction({ session: pending, action: 'plan' })
    expect(planning.ok).toBe(true)
    expect(planning.execution_enabled).toBe(false)
    expect(planning.normal_reply).toContain('Hermes may plan')

    const blockedExecution = evaluateHermesBridgeSessionAction({ session: pending, action: 'draft_skill_spec', delegatedByAgentZero: true })
    expect(blockedExecution.ok).toBe(false)
    expect(blockedExecution.blocked_reason).toBe('owner_approval_pending')

    const db = setupDb()
    const created = createOrReuseAgentZeroBridgeSession({ db, requester })
    db.prepare(`UPDATE bridge_approval_requests SET approval_state = 'approved', resolved_at = ? WHERE id = ?`)
      .run('2026-05-03T14:05:00.000Z', created.session.approval_request_id)
    const active = readLatestAgentZeroBridgeSession({ db, sync: true, now: new Date('2026-05-03T14:06:00.000Z') }).session

    const noDelegate = evaluateHermesBridgeSessionAction({ session: active, action: 'draft_skill_spec' })
    expect(noDelegate.ok).toBe(false)
    expect(noDelegate.blocked_reason).toBe('agent_zero_delegation_required')

    const draftSkill = evaluateHermesBridgeSessionAction({ session: active, action: 'draft_skill_spec', delegatedByAgentZero: true })
    expect(draftSkill.ok).toBe(true)
    expect(draftSkill.execution_enabled).toBe(true)

    const obsidianWrite = evaluateHermesBridgeSessionAction({ session: active, action: 'obsidian_write', delegatedByAgentZero: true })
    expect(obsidianWrite.ok).toBe(true)

    const mempalaceWrite = evaluateHermesBridgeSessionAction({ session: active, action: 'mempalace_write', delegatedByAgentZero: true })
    expect(mempalaceWrite.ok).toBe(true)

    const missingConnector = evaluateHermesBridgeSessionAction({ session: active, action: 'registered_adapter_execute', delegatedByAgentZero: true, connectorConfigured: false })
    expect(missingConnector.ok).toBe(false)
    expect(missingConnector.normal_reply).toContain('connector missing or not configured')

    const emailNoDomain = evaluateHermesBridgeSessionAction({ session: active, action: 'external_email_send', delegatedByAgentZero: true, connectorConfigured: true, domainAllowed: false })
    expect(emailNoDomain.ok).toBe(false)
    expect(emailNoDomain.blocked_reason).toBe('agentmail_domain_allow_list_required')

    const emailAllowed = evaluateHermesBridgeSessionAction({ session: active, action: 'external_email_send', delegatedByAgentZero: true, connectorConfigured: true, domainAllowed: true })
    expect(emailAllowed.ok).toBe(true)
    expect(emailAllowed.execution_enabled).toBe(true)
  })

  it('keeps raw shell, Docker socket, secret reads, and direct Build-Wiki execution blocked for Hermes', () => {
    const db = setupDb()
    const created = createOrReuseAgentZeroBridgeSession({ db, requester })
    db.prepare(`UPDATE bridge_approval_requests SET approval_state = 'approved', resolved_at = ? WHERE id = ?`)
      .run('2026-05-03T14:05:00.000Z', created.session.approval_request_id)
    const active = readLatestAgentZeroBridgeSession({ db, sync: true, now: new Date('2026-05-03T14:06:00.000Z') }).session

    expect(evaluateHermesBridgeSessionAction({ session: active, action: 'raw_shell', delegatedByAgentZero: true }).blocked_reason)
      .toBe('hermes_raw_shell_forbidden')
    expect(evaluateHermesBridgeSessionAction({ session: active, action: 'docker_socket', delegatedByAgentZero: true }).blocked_reason)
      .toBe('hermes_docker_socket_forbidden')
    expect(evaluateHermesBridgeSessionAction({ session: active, action: 'secret_read', delegatedByAgentZero: true }).blocked_reason)
      .toBe('hermes_direct_secret_read_forbidden')
    expect(evaluateHermesBridgeSessionAction({ session: active, action: 'buildwiki_suggest' }).ok)
      .toBe(true)
    const buildWikiExecute = evaluateHermesBridgeSessionAction({ session: active, action: 'buildwiki_execute', delegatedByAgentZero: true })
    expect(buildWikiExecute.ok).toBe(false)
    expect(buildWikiExecute.blocked_reason).toBe('hermes_may_suggest_buildwiki_agent_zero_must_execute_scoped_adapter')
  })

  it('expires automatically', () => {
    const db = setupDb()
    const created = createOrReuseAgentZeroBridgeSession({ db, requester, now: new Date('2026-05-03T00:00:00.000Z') })
    db.prepare(`UPDATE bridge_approval_requests SET approval_state = 'approved', resolved_at = ? WHERE id = ?`)
      .run('2026-05-03T00:05:00.000Z', created.session.approval_request_id)

    const read = readLatestAgentZeroBridgeSession({ db, sync: true, now: new Date('2026-05-03T13:00:00.000Z') })
    expect(read.session.status).toBe('expired')
    expect(read.session.execution_enabled).toBe(false)
    expect(read.session.blocked_reason).toBe('bridge_session_expired')
  })
})
