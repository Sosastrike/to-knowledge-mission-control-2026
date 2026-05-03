import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createOrReuseAgentZeroBridgeSession,
  ensureAgentZeroBridgeSessionTables,
} from './agent-zero-bridge-session'
import {
  executeAgentZeroBridgeAction,
  listAgentZeroExecutionAdapters,
} from './agent-zero-execution-gateway'

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
    CREATE UNIQUE INDEX idx_bridge_approval_requests_idempotency_gateway_test
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

function approveSession(db: Database.Database) {
  const created = createOrReuseAgentZeroBridgeSession({ db, requester, now: new Date('2026-05-03T14:00:00.000Z') })
  db.prepare(`UPDATE bridge_approval_requests SET approval_state = 'approved', resolved_at = ?, resolved_by = 'owner' WHERE id = ?`)
    .run('2026-05-03T14:05:00.000Z', created.session.approval_request_id)
  return created.session.session_id
}

const tempRoots: string[] = []

function makeObsidianVault() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'az-gateway-obsidian-'))
  fs.mkdirSync(path.join(root, 'Agent Zero'), { recursive: true })
  fs.writeFileSync(path.join(root, 'Agent Zero', 'Existing.md'), '# Existing\n\nOriginal content.\n')
  tempRoots.push(root)
  return root
}

function makeMemPalaceStore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'az-gateway-mempalace-'))
  const dataDir = path.join(root, 'mempalace-data')
  const configDir = path.join(root, '.mempalace')
  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(configDir, { recursive: true })
  const configPath = path.join(configDir, 'config.json')
  fs.writeFileSync(configPath, '{"enabled":true}')
  tempRoots.push(root)
  return {
    graphDbPath: path.join(configDir, 'knowledge_graph.sqlite3'),
    dataDir,
    chromaDbPath: path.join(dataDir, 'chroma.sqlite3'),
    summaryDbPath: path.join(dataDir, 'agent-zero-memory-summaries.sqlite3'),
    configPath,
  }
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('Agent Zero Bridge execution gateway', () => {
  it('lists registered adapters without enabling unsafe execution surfaces', () => {
    const adapters = listAgentZeroExecutionAdapters()
    expect(adapters.map((adapter) => adapter.action)).toContain('agent_zero.report.create')
    expect(adapters.map((adapter) => adapter.action)).toContain('mempalace.memory.remember_task_result')
    expect(adapters.map((adapter) => adapter.action)).toContain('mcp.tool.execute')
    expect(adapters.every((adapter) => adapter.bridge_session_required)).toBe(true)
    expect(adapters.every((adapter) => adapter.safety.raw_shell_enabled === false)).toBe(true)
    expect(adapters.every((adapter) => adapter.safety.docker_socket_enabled === false)).toBe(true)
    expect(adapters.every((adapter) => adapter.safety.direct_secret_reads_enabled === false)).toBe(true)
  })

  it('blocks every adapter without an active Bridge Session', async () => {
    const db = setupDb()
    const result = await executeAgentZeroBridgeAction({
      db,
      requester,
      action: 'agent_zero.report.create',
      input: { title: 'Blocked report' },
    })

    expect(result.ok).toBe(false)
    expect(result.http_status).toBe(423)
    expect(result.accepted_for_execution).toBe(false)
    expect(result.blocked_reason).toBe('active_bridge_session_required')
    expect(result.raw_shell_enabled).toBe(false)
    expect(result.result).toBeNull()
  })

  it('creates a Mission Control report through the scoped adapter and audits start and finish', async () => {
    const db = setupDb()
    const sessionId = approveSession(db)
    const reportRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'az-gateway-report-'))
    tempRoots.push(reportRoot)

    const result = await executeAgentZeroBridgeAction({
      db,
      requester,
      bridgeSessionId: sessionId,
      action: 'agent_zero.report.create',
      reportRoot,
      input: {
        title: 'Gateway report',
        summary: 'Created by a scoped adapter.',
        sections: [{ heading: 'Result', body: 'No unsafe execution was used.' }],
      },
    })

    expect(result.ok).toBe(true)
    expect(result.http_status).toBe(200)
    expect(result.status).toBe('completed')
    expect(result.accepted_for_execution).toBe(true)
    expect(result.audit.started).toBe(true)
    expect(result.audit.finished).toBe(true)
    expect(JSON.stringify(result)).not.toContain(reportRoot)
    expect(JSON.stringify(result)).not.toContain('/home/tony')
    expect(JSON.stringify(result)).toContain('/api/bridge/agent-zero/reports/')

    const auditCount = (db.prepare(`SELECT COUNT(*) AS count FROM bridge_session_audit_events WHERE action = 'agent_zero.report.create'`).get() as { count: number }).count
    expect(auditCount).toBe(2)
  })

  it('returns blocked, not done, when requested external report delivery is unavailable', async () => {
    const db = setupDb()
    const sessionId = approveSession(db)
    const reportRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'az-gateway-onedrive-'))
    tempRoots.push(reportRoot)

    const result = await executeAgentZeroBridgeAction({
      db,
      requester,
      bridgeSessionId: sessionId,
      action: 'agent_zero.report.create',
      reportRoot,
      input: {
        title: 'OneDrive report',
        owner_message: 'Create a report and send it to OneDrive folder Tony videos 2026.',
        requested_delivery: { provider: 'onedrive', folder: 'Tony videos 2026' },
      },
    })

    expect(result.ok).toBe(false)
    expect(result.http_status).toBe(423)
    expect(result.status).toBe('blocked')
    expect(result.blocked_reason).toBe('requested_external_delivery_blocked')
    expect(result.normal_reply).toBe('OneDrive upload is blocked because the upload connector is not configured.')
    expect(result.normal_reply.toLowerCase()).not.toContain('done')
    expect(JSON.stringify(result)).not.toContain('/home/tony')
  })

  it('routes Drive and MCP requests through registered adapters and never fakes execution', async () => {
    const db = setupDb()
    const sessionId = approveSession(db)

    const drive = await executeAgentZeroBridgeAction({
      db,
      requester,
      bridgeSessionId: sessionId,
      action: 'google_drive.upload_report_pdf',
      input: { report_id: 'azr_invalid_123', folder: 'Reports' },
    })
    expect(drive.ok).toBe(false)
    expect(drive.status).toBe('blocked')
    expect(drive.blocked_reason).toBe('google_drive_upload_connector_not_configured')
    expect(drive.result).toMatchObject({ no_fake_done: true, no_tokens_exposed: true })

    const mcp = await executeAgentZeroBridgeAction({
      db,
      requester,
      bridgeSessionId: sessionId,
      action: 'mcp.tool.execute',
      input: { server: 'zapier', tool: 'heygen' },
    })
    expect(mcp.ok).toBe(false)
    expect(mcp.status).toBe('blocked')
    expect(mcp.blocked_reason).toBe('mcp_tool_execution_adapter_not_configured')
    expect(mcp.result).toMatchObject({ tool_invoked: false })
  })

  it('runs Build-Wiki only through an active Bridge Session and creates a report event', async () => {
    const db = setupDb()
    let callCount = 0
    const runner = async () => {
      callCount += 1
      return { ok: true, exitCode: 0, signal: null, stderr: '' }
    }

    const blocked = await executeAgentZeroBridgeAction({
      db,
      requester,
      action: 'buildwiki.run_now',
      buildWikiRunNowRunner: runner,
    })
    expect(blocked.ok).toBe(false)
    expect(blocked.http_status).toBe(423)
    expect(blocked.blocked_reason).toBe('active_bridge_session_required')
    expect(callCount).toBe(0)

    const sessionId = approveSession(db)
    const reportRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'az-gateway-buildwiki-'))
    tempRoots.push(reportRoot)
    const result = await executeAgentZeroBridgeAction({
      db,
      requester,
      bridgeSessionId: sessionId,
      action: 'buildwiki.run_now',
      reportRoot,
      buildWikiRunNowRunner: runner,
    })

    expect(callCount).toBe(1)
    expect(result.ok).toBe(true)
    expect(result.http_status).toBe(200)
    expect(result.status).toBe('completed')
    expect(result.result).toMatchObject({
      action: 'buildwiki.run_now',
      target_service: 'opencloud-docs-farmer.service',
      exact_command: 'systemctl --user start opencloud-docs-farmer.service',
      run_state: 'completed',
      scoped_service_only: true,
      broad_external_farmers_enabled: false,
      smb_fork2_executed: false,
      external_farmers_executed: false,
      audit_event_required: true,
      report_event_required: true,
      report_event_created: true,
      report_created: true,
    })
    expect(result.result?.report_event).toMatchObject({
      type: 'buildwiki.run_now.result',
      target_service: 'opencloud-docs-farmer.service',
      no_broad_external_farmers: true,
      smb_fork2_executed: false,
      external_farmers_executed: false,
      audited_by_bridge_session: true,
    })
    expect(JSON.stringify(result)).toContain('/api/bridge/agent-zero/reports/')
    expect(JSON.stringify(result)).not.toContain(reportRoot)
    expect(JSON.stringify(result)).not.toContain('/home/tony')

    const auditRows = db.prepare(`
      SELECT outcome, metadata_json
      FROM bridge_session_audit_events
      WHERE action = 'buildwiki.run_now'
      ORDER BY created_at ASC
    `).all() as Array<{ outcome: string; metadata_json: string }>
    expect(auditRows.map((row) => row.outcome)).toEqual(['started', 'completed'])
    expect(JSON.parse(auditRows[1].metadata_json)).toMatchObject({
      report_event_type: 'buildwiki.run_now.result',
      report_event_run_state: 'completed',
    })
  })

  it('reports Build-Wiki service start failures without running broad farmers', async () => {
    const db = setupDb()
    const sessionId = approveSession(db)
    const reportRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'az-gateway-buildwiki-fail-'))
    tempRoots.push(reportRoot)
    const result = await executeAgentZeroBridgeAction({
      db,
      requester,
      bridgeSessionId: sessionId,
      action: 'buildwiki.run_now',
      reportRoot,
      buildWikiRunNowRunner: async () => ({ ok: false, exitCode: 1, signal: null, stderr: 'unit failed without secrets' }),
    })

    expect(result.ok).toBe(false)
    expect(result.http_status).toBe(423)
    expect(result.status).toBe('failed')
    expect(result.blocked_reason).toBe('buildwiki_run_now_systemctl_failed')
    expect(result.normal_reply).toBe('Build-Wiki Run Now could not start the local farmer service; I recorded the result in Mission Control.')
    expect(result.result).toMatchObject({
      run_state: 'failed',
      report_event_created: true,
      broad_external_farmers_enabled: false,
      smb_fork2_executed: false,
      external_farmers_executed: false,
    })
    expect(JSON.stringify(result)).not.toContain(reportRoot)
    expect(JSON.stringify(result)).not.toContain('/home/tony')
  })

  it('writes Obsidian notes only through an active scoped Bridge Session adapter', async () => {
    const db = setupDb()
    const blocked = await executeAgentZeroBridgeAction({
      db,
      requester,
      action: 'obsidian.note.create',
      obsidianRoot: makeObsidianVault(),
      input: { path: 'Agent Zero/Blocked.md', title: 'Blocked', content: 'no session' },
    })
    expect(blocked.ok).toBe(false)
    expect(blocked.http_status).toBe(423)
    expect(blocked.blocked_reason).toBe('active_bridge_session_required')

    const sessionId = approveSession(db)
    const root = makeObsidianVault()
    const created = await executeAgentZeroBridgeAction({
      db,
      requester,
      bridgeSessionId: sessionId,
      action: 'obsidian.note.create',
      obsidianRoot: root,
      input: {
        path: 'Agent Zero/New Note.md',
        title: 'New Note',
        content: 'Created through Bridge Session. api_key=do-not-leak',
        tags: ['agent-zero'],
      },
    })

    expect(created.ok).toBe(true)
    expect(created.status).toBe('completed')
    expect(created.result).toMatchObject({
      action: 'create_note',
      direct_filesystem_exposed: false,
      raw_content_returned: false,
      private_dump_returned: false,
      audit_required: true,
    })
    expect(JSON.stringify(created)).not.toContain(root)
    expect(JSON.stringify(created)).not.toContain('do-not-leak')

    const tagged = await executeAgentZeroBridgeAction({
      db,
      requester,
      bridgeSessionId: sessionId,
      action: 'obsidian.note.tag',
      obsidianRoot: root,
      input: { path: 'Agent Zero/New Note.md', tags: ['release-proof'] },
    })
    expect(tagged.ok).toBe(true)
    expect(tagged.result).toMatchObject({ action: 'tag_note' })

    const auditCount = (db.prepare(`SELECT COUNT(*) AS count FROM bridge_session_audit_events WHERE action LIKE 'obsidian.note.%'`).get() as { count: number }).count
    expect(auditCount).toBe(4)
  })

  it('writes MemPalace memory summaries only through an active scoped Bridge Session adapter', async () => {
    const db = setupDb()
    const mempalacePaths = makeMemPalaceStore()
    const blocked = await executeAgentZeroBridgeAction({
      db,
      requester,
      action: 'mempalace.memory.remember_task_result',
      mempalacePaths,
      input: {
        task_id: 'task-999',
        result_summary: 'No active session should write this.',
      },
    })
    expect(blocked.ok).toBe(false)
    expect(blocked.http_status).toBe(423)
    expect(blocked.blocked_reason).toBe('active_bridge_session_required')

    const sessionId = approveSession(db)
    const remembered = await executeAgentZeroBridgeAction({
      db,
      requester,
      bridgeSessionId: sessionId,
      action: 'mempalace.memory.remember_task_result',
      mempalacePaths,
      input: {
        task_id: 'task-999',
        result_summary: 'Capability report finished. token=do-not-leak /home/tony/private.md',
        report_id: 'report-999',
        tags: ['release'],
      },
    })

    expect(remembered.ok).toBe(true)
    expect(remembered.status).toBe('completed')
    expect(remembered.result).toMatchObject({
      action: 'remember_task_result',
      raw_records_returned: false,
      raw_private_dump_enabled: false,
      direct_filesystem_exposed: false,
      overwrite_performed: false,
      append_only_versioned: true,
      audit_required: true,
    })
    expect(JSON.stringify(remembered)).not.toContain('do-not-leak')
    expect(JSON.stringify(remembered)).not.toContain('/home/tony')
    expect(JSON.stringify(remembered)).not.toContain(mempalacePaths.dataDir)

    const linked = await executeAgentZeroBridgeAction({
      db,
      requester,
      bridgeSessionId: sessionId,
      action: 'mempalace.memory.link_report_task',
      mempalacePaths,
      input: {
        memory_key: 'capability-report',
        task_id: 'task-999',
        report_id: 'report-999',
        summary: 'Linked capability memory to report.',
      },
    })
    expect(linked.ok).toBe(true)
    expect(linked.result).toMatchObject({ action: 'link_memory_to_report_task' })

    const memoryDb = new Database(mempalacePaths.summaryDbPath, { readonly: true, fileMustExist: true })
    const memoryCount = (memoryDb.prepare('SELECT COUNT(*) AS count FROM agent_zero_memory_summaries').get() as { count: number }).count
    memoryDb.close()
    expect(memoryCount).toBe(2)

    const auditCount = (db.prepare(`SELECT COUNT(*) AS count FROM bridge_session_audit_events WHERE action LIKE 'mempalace.memory.%'`).get() as { count: number }).count
    expect(auditCount).toBe(4)
  })

  it('rejects unknown and unsafe action names', async () => {
    const db = setupDb()
    approveSession(db)

    const unknown = await executeAgentZeroBridgeAction({
      db,
      requester,
      action: 'shell.exec',
      input: { command: 'whoami' },
    })
    expect(unknown.ok).toBe(false)
    expect(unknown.http_status).toBe(400)
    expect(unknown.blocked_reason).toBe('adapter_not_registered')
    expect(unknown.raw_shell_enabled).toBe(false)
    expect(JSON.stringify(unknown)).not.toContain('whoami')
  })
})
