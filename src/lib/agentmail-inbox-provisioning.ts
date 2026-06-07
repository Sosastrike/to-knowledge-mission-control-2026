import type Database from 'better-sqlite3'

import { createApprovalRequest, getApprovalRequest, listApprovalRequests, resolveApprovalRequest } from '@/lib/approval-requests'
import {
  createAgentMailBootstrapInbox,
  listAgentMailBootstrapInboxes,
  type AgentMailLiveInbox,
} from '@/lib/agentmail-credential-resolver'
import {
  buildAgentMailSetupStatus,
  ensureAgentMailSchema,
  listAgentMailInboxes,
  recordAgentMailAudit,
  type AgentMailAutonomyLevel,
} from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'

const SAFE_FLAGS = {
  credential_values_exposed: false,
  tokens_exposed: false,
  env_values_exposed: false,
  raw_secret_values_exposed: false,
} as const

export type AgentMailProvisioningTarget = {
  agent_id: string
  display_name: string
  role: string
  username: string
  domain: string
  email: string
  client_id: string
  autonomy_level: AgentMailAutonomyLevel
  send_policy: string
  owner_approval_required: true
}

export const AGENTMAIL_INBOX_PROVISIONING_TARGETS: AgentMailProvisioningTarget[] = [
  { agent_id: 'pi', display_name: 'Pi', role: 'reasoning_observer', username: 'pi', domain: 'agentmail.to', email: 'pi@agentmail.to', client_id: 'mission-pi-inbox-v1', autonomy_level: 'L1_draft_only', send_policy: 'owner_approval_required', owner_approval_required: true },
  { agent_id: 'agent_zero', display_name: 'Agent Zero', role: 'command_triage', username: 'agent-zero', domain: 'agentmail.to', email: 'agent-zero@agentmail.to', client_id: 'mission-agent-zero-inbox-v1', autonomy_level: 'L1_draft_only', send_policy: 'owner_approval_required', owner_approval_required: true },
  { agent_id: 'gateway', display_name: 'Gateway', role: 'policy_router', username: 'gateway', domain: 'agentmail.to', email: 'gateway@agentmail.to', client_id: 'mission-gateway-inbox-v1', autonomy_level: 'L0_monitor_only', send_policy: 'no_normal_external_send', owner_approval_required: true },
  { agent_id: 'bridge_unit', display_name: 'Bridge Unit', role: 'event_translation_queue', username: 'bridge-unit', domain: 'agentmail.to', email: 'bridge-unit@agentmail.to', client_id: 'mission-bridge-inbox-v1', autonomy_level: 'L0_monitor_only', send_policy: 'dispatch_control_plane_only', owner_approval_required: true },
  { agent_id: 'agentmail_monitor', display_name: 'Mission Control Monitor', role: 'health_monitor', username: 'agentmail-monitor', domain: 'agentmail.to', email: 'agentmail-monitor@agentmail.to', client_id: 'mission-agentmail-monitor-v1', autonomy_level: 'L0_monitor_only', send_policy: 'no_send', owner_approval_required: true },
  { agent_id: 'agentmail_audit', display_name: 'Audit Archive', role: 'audit_export_identity', username: 'agentmail-audit', domain: 'agentmail.to', email: 'agentmail-audit@agentmail.to', client_id: 'mission-agentmail-audit-v1', autonomy_level: 'L0_monitor_only', send_policy: 'no_send', owner_approval_required: true },
]

type ProvisioningInput = {
  db?: Database.Database
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  idempotencyKey?: string
  approvalId?: string
  actor?: string
  requester?: string
}

function nowIso() {
  return new Date().toISOString()
}

function safeText(value: unknown, fallback = '', max = 240) {
  return String(value || fallback)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:am_|sk-|gsk_|xai-|nva-)[A-Za-z0-9._-]{8,}\b/gi, '[redacted]')
    .replace(/(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*[:=]\s*[^,\s}]+/gi, '[redacted]')
    .trim()
    .slice(0, max)
}

function safeMetadata(target: AgentMailProvisioningTarget) {
  return {
    agent_id: target.agent_id,
    role: target.role,
    environment: 'production',
    autonomy_level: target.autonomy_level,
    send_policy: target.send_policy,
    owner_approval_required: true,
    created_by: 'mission-control',
  }
}

function safeInbox(inbox: AgentMailLiveInbox) {
  return {
    inbox_id: safeText(inbox.inbox_id, 'unknown_inbox', 220),
    email: inbox.email,
    email_preview: inbox.email_preview,
    display_name: inbox.display_name,
    organization_id: inbox.organization_id,
    pod_id: inbox.pod_id,
    client_id: inbox.client_id,
    metadata: inbox.metadata,
    credential_values_exposed: false,
  }
}

function matchesTarget(inbox: AgentMailLiveInbox, target: AgentMailProvisioningTarget) {
  const email = String(inbox.email || '').toLowerCase()
  const clientId = String(inbox.client_id || '').toLowerCase()
  const metadataAgent = String(inbox.metadata?.agent_id || '').toLowerCase()
  const inboxId = String(inbox.inbox_id || '').toLowerCase()
  return email === target.email.toLowerCase()
    || clientId === target.client_id.toLowerCase()
    || metadataAgent === target.agent_id.toLowerCase()
    || inboxId === target.email.toLowerCase()
}

function findTargetMatch(inboxes: AgentMailLiveInbox[], target: AgentMailProvisioningTarget) {
  return inboxes.find((inbox) => matchesTarget(inbox, target)) || null
}

function ensureProvisioningColumns(db: Database.Database) {
  ensureAgentMailSchema(db)
  const columns = new Set((db.prepare(`PRAGMA table_info(agentmail_inboxes)`).all() as Array<{ name: string }>).map((row) => row.name))
  const addColumn = (name: string, sql: string) => {
    if (!columns.has(name)) db.prepare(sql).run()
  }
  addColumn('agentmail_inbox_id', `ALTER TABLE agentmail_inboxes ADD COLUMN agentmail_inbox_id TEXT`)
  addColumn('agentmail_pod_id', `ALTER TABLE agentmail_inboxes ADD COLUMN agentmail_pod_id TEXT`)
  addColumn('agentmail_organization_id', `ALTER TABLE agentmail_inboxes ADD COLUMN agentmail_organization_id TEXT`)
  addColumn('agentmail_metadata_json', `ALTER TABLE agentmail_inboxes ADD COLUMN agentmail_metadata_json TEXT`)
  addColumn('agentmail_synced_at', `ALTER TABLE agentmail_inboxes ADD COLUMN agentmail_synced_at TEXT`)
}

function updateRegistryRow(db: Database.Database, target: AgentMailProvisioningTarget, inbox: AgentMailLiveInbox) {
  ensureProvisioningColumns(db)
  const email = String(inbox.email || target.email).toLowerCase()
  db.prepare(`
    INSERT INTO agentmail_inboxes (
      agent_id, display_name, role, inbox_address, client_id,
      autonomy_level, owner_approval_required, provision_state,
      agentmail_inbox_id, agentmail_pod_id, agentmail_organization_id, agentmail_metadata_json, agentmail_synced_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 'assigned', ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(agent_id) DO UPDATE SET
      display_name = excluded.display_name,
      role = excluded.role,
      inbox_address = excluded.inbox_address,
      client_id = excluded.client_id,
      autonomy_level = excluded.autonomy_level,
      owner_approval_required = 1,
      provision_state = 'assigned',
      agentmail_inbox_id = excluded.agentmail_inbox_id,
      agentmail_pod_id = excluded.agentmail_pod_id,
      agentmail_organization_id = excluded.agentmail_organization_id,
      agentmail_metadata_json = excluded.agentmail_metadata_json,
      agentmail_synced_at = excluded.agentmail_synced_at,
      updated_at = unixepoch()
  `).run(
    target.agent_id,
    target.display_name,
    target.role,
    email,
    target.client_id,
    target.autonomy_level,
    inbox.inbox_id,
    inbox.pod_id,
    inbox.organization_id,
    JSON.stringify(safeMetadata(target)),
    nowIso(),
  )
}

function latestApprovedProvisioningRequest(approvalId?: string | null) {
  if (approvalId) {
    const request = getApprovalRequest(approvalId)
    return request?.connector === 'agentmail'
      && request.action === 'agentmail_inbox_provisioning'
      && request.approval_state === 'approved'
      ? request
      : null
  }
  return listApprovalRequests().find((request) => request.connector === 'agentmail'
    && request.action === 'agentmail_inbox_provisioning'
    && request.approval_state === 'approved') || null
}

export async function buildAgentMailInboxProvisioningPreview(input: ProvisioningInput = {}) {
  const db = input.db || getDatabase()
  const env = input.env || process.env
  ensureProvisioningColumns(db)
  recordAgentMailAudit(db, 'agentmail_live_inbox_preview_started', 'ok', 'safe_live_inbox_probe_no_mutation_no_send')
  const live = await listAgentMailBootstrapInboxes({ db, env, fetchImpl: input.fetchImpl })
  const liveInboxes = live.ok ? live.inboxes : []
  const matching = AGENTMAIL_INBOX_PROVISIONING_TARGETS
    .map((target) => {
      const inbox = findTargetMatch(liveInboxes, target)
      if (!inbox) return null
      return {
        agent_id: target.agent_id,
        display_name: target.display_name,
        email: inbox.email || target.email,
        inbox_id: inbox.inbox_id,
        client_id: inbox.client_id || target.client_id,
        action: 'reuse_existing_inbox',
        metadata: safeMetadata(target),
      }
    })
    .filter(Boolean) as Array<Record<string, unknown>>
  const missing = AGENTMAIL_INBOX_PROVISIONING_TARGETS
    .filter((target) => !findTargetMatch(liveInboxes, target))
    .map((target) => ({
      agent_id: target.agent_id,
      display_name: target.display_name,
      role: target.role,
      proposed_inbox: target.email,
      proposed_client_id: target.client_id,
      proposed_metadata: safeMetadata(target),
      action: 'create_missing_inbox_after_owner_approval',
    }))
  const assignments = AGENTMAIL_INBOX_PROVISIONING_TARGETS.map((target) => {
    const match = findTargetMatch(liveInboxes, target)
    return {
      agent_id: target.agent_id,
      display_name: target.display_name,
      role: target.role,
      autonomy_level: target.autonomy_level,
      owner_approval_required: true,
      proposed_inbox: target.email,
      proposed_client_id: target.client_id,
      proposed_metadata: safeMetadata(target),
      registry_update: match ? 'sync_existing_live_inbox' : 'create_then_sync_missing_inbox',
      agentmail_inbox_id: match?.inbox_id || null,
      scoped_credentials_created: false,
      send_enabled: false,
    }
  })
  recordAgentMailAudit(db, 'agentmail_live_inbox_preview_completed', live.ok ? 'ok' : 'blocked', live.ok ? `live_inboxes=${live.inbox_count}` : live.exact_blocker || 'agentmail_live_inbox_preview_failed')
  recordAgentMailAudit(db, 'agentmail_inbox_deduplication_completed', live.ok ? 'ok' : 'blocked', `matched=${matching.length};missing=${missing.length};no_send_no_scoped_credentials`)
  return {
    ok: live.ok,
    source: 'agentmail_inbox_provisioning_preview',
    generated_at: nowIso(),
    live_agentmail: live,
    live_inbox_count_before: live.inbox_count,
    existing_live_inboxes: liveInboxes.map(safeInbox),
    matching_inboxes: matching,
    missing_inboxes_to_create: missing,
    missing_inboxes: missing,
    proposed_inbox_assignments: assignments,
    registry_rows_to_update: assignments,
    approval_required: true,
    provision_automatically: false,
    mutation_enabled: false,
    scoped_credentials_created: false,
    email_sent: false,
    send_enabled: false,
    execution_enabled: false,
    exact_blocker: live.ok ? 'inbox_provisioning_approval_required' : live.exact_blocker || 'agentmail_connection_not_visible_to_runtime',
    ...SAFE_FLAGS,
  }
}

export async function createAgentMailInboxProvisioningApproval(input: ProvisioningInput = {}) {
  const db = input.db || getDatabase()
  const preview = await buildAgentMailInboxProvisioningPreview(input)
  const { request, created } = createApprovalRequest({
    connector: 'agentmail',
    action: 'agentmail_inbox_provisioning',
    target: 'agentmail_inboxes',
    target_key: 'agentmail:inboxes:provision',
    requester: safeText(input.requester || input.actor || 'owner', 'owner', 120),
    risk_level: 'medium',
    protected_category: 'connector_write',
    reason: 'Owner approval is required before Mission Control creates or syncs AgentMail inboxes.',
    approval_scope: {
      existing_live_inboxes_count: preview.live_inbox_count_before,
      existing_matching_inboxes: preview.matching_inboxes,
      missing_inboxes_to_create: preview.missing_inboxes_to_create,
      proposed_inbox_assignments: preview.proposed_inbox_assignments,
      registry_rows_to_update: preview.registry_rows_to_update,
      scoped_credentials_created: false,
      email_sent: false,
      credential_values_exposed: false,
    },
    idempotency_key: input.idempotencyKey || 'agentmail:inboxes:provision',
  })
  recordAgentMailAudit(db, 'agentmail_inbox_provisioning_requested', 'blocked', `approval_id=${request.id};missing=${preview.missing_inboxes_to_create.length};reuse=${preview.matching_inboxes.length};no_scoped_credentials_no_send`)
  return {
    ok: true,
    source: 'agentmail_inbox_provisioning_request',
    approval_id: request.id,
    approval_state: request.approval_state,
    approval_request_created: created,
    exact_blocker: request.approval_state === 'approved' ? 'approved_ready_to_apply' : 'inbox_provisioning_approval_required',
    provision_enabled: false,
    scoped_credentials_created: false,
    email_sent: false,
    send_enabled: false,
    preview,
    ...SAFE_FLAGS,
  }
}

export function approveAgentMailInboxProvisioning(input: ProvisioningInput = {}) {
  const db = input.db || getDatabase()
  ensureProvisioningColumns(db)
  const approvalId = input.approvalId || listApprovalRequests().find((request) => request.connector === 'agentmail' && request.action === 'agentmail_inbox_provisioning')?.id || ''
  const resolved = approvalId ? resolveApprovalRequest(approvalId, 'approved', safeText(input.actor || 'owner', 'owner', 120), 'Owner approved AgentMail inbox provisioning only. No scoped credentials or sends are approved by this record.') : null
  if (!resolved) {
    recordAgentMailAudit(db, 'agentmail_inbox_provisioning_approved', 'blocked', 'approval_request_missing')
    return { ok: false, source: 'agentmail_inbox_provisioning_approve', approval_id: approvalId || null, exact_blocker: 'inbox_provisioning_approval_required', ...SAFE_FLAGS }
  }
  recordAgentMailAudit(db, 'agentmail_inbox_provisioning_approved', 'ok', `approval_id=${resolved.id};no_scoped_credentials_no_send`)
  return { ok: true, source: 'agentmail_inbox_provisioning_approve', approval_id: resolved.id, approval_state: resolved.approval_state, exact_blocker: null, ...SAFE_FLAGS }
}

export async function applyAgentMailInboxProvisioning(input: ProvisioningInput = {}) {
  const db = input.db || getDatabase()
  const env = input.env || process.env
  ensureProvisioningColumns(db)
  const preview = await buildAgentMailInboxProvisioningPreview(input)
  const approved = latestApprovedProvisioningRequest(input.approvalId)
  if (!approved) {
    recordAgentMailAudit(db, 'agentmail_inbox_provisioning_started', 'blocked', 'inbox_provisioning_approval_required')
    return {
      ok: false,
      source: 'agentmail_inbox_provisioning_apply',
      exact_blocker: 'inbox_provisioning_approval_required',
      inboxes_reused: [],
      inboxes_created: [],
      inboxes_skipped: [],
      registry_rows_updated: 0,
      scoped_credentials_created: false,
      email_sent: false,
      send_enabled: false,
      preview,
      ...SAFE_FLAGS,
    }
  }
  if (!preview.ok) {
    recordAgentMailAudit(db, 'agentmail_inbox_provisioning_started', 'blocked', preview.exact_blocker)
    return {
      ok: false,
      source: 'agentmail_inbox_provisioning_apply',
      exact_blocker: preview.exact_blocker,
      inboxes_reused: [],
      inboxes_created: [],
      inboxes_skipped: [],
      registry_rows_updated: 0,
      scoped_credentials_created: false,
      email_sent: false,
      send_enabled: false,
      preview,
      ...SAFE_FLAGS,
    }
  }

  recordAgentMailAudit(db, 'agentmail_inbox_provisioning_started', 'ok', `approval_id=${approved.id};missing=${preview.missing_inboxes_to_create.length};reuse=${preview.matching_inboxes.length}`)
  const liveInboxes = preview.live_agentmail.ok ? preview.live_agentmail.inboxes : []
  const reused: Array<Record<string, unknown>> = []
  const created: Array<Record<string, unknown>> = []
  const skipped: Array<Record<string, unknown>> = []
  let registryRowsUpdated = 0

  for (const target of AGENTMAIL_INBOX_PROVISIONING_TARGETS) {
    const existing = findTargetMatch(liveInboxes, target)
    if (existing) {
      updateRegistryRow(db, target, existing)
      registryRowsUpdated += 1
      const row = { agent_id: target.agent_id, email: existing.email || target.email, inbox_id: existing.inbox_id, action: 'reused' }
      reused.push(row)
      recordAgentMailAudit(db, 'agentmail_inbox_reused', 'ok', `agent=${target.agent_id};email=${target.email}`)
      recordAgentMailAudit(db, 'agentmail_inbox_registry_synced', 'ok', `agent=${target.agent_id};email=${target.email}`)
      continue
    }

    const createdResult = await createAgentMailBootstrapInbox({
      db,
      env,
      fetchImpl: input.fetchImpl,
      username: target.username,
      domain: target.domain,
      displayName: target.display_name,
      clientId: target.client_id,
      metadata: safeMetadata(target),
    })
    if (!createdResult.ok || !createdResult.inbox) {
      const blocker = createdResult.exact_blocker || 'agentmail_inbox_provisioning_failed'
      skipped.push({ agent_id: target.agent_id, email: target.email, exact_blocker: blocker, http_status: createdResult.http_status, provider_error_summary: createdResult.provider_error_summary || null })
      recordAgentMailAudit(db, 'agentmail_inbox_provisioning_failed', 'error', `agent=${target.agent_id};${blocker};http=${createdResult.http_status || 'none'}`)
      continue
    }
    updateRegistryRow(db, target, createdResult.inbox)
    registryRowsUpdated += 1
    const row = { agent_id: target.agent_id, email: createdResult.inbox.email || target.email, inbox_id: createdResult.inbox.inbox_id, action: 'created' }
    created.push(row)
    recordAgentMailAudit(db, 'agentmail_inbox_created', 'ok', `agent=${target.agent_id};email=${target.email}`)
    recordAgentMailAudit(db, 'agentmail_inbox_registry_synced', 'ok', `agent=${target.agent_id};email=${target.email}`)
  }

  const setup = buildAgentMailSetupStatus(db, env)
  const ok = skipped.length === 0
  recordAgentMailAudit(db, ok ? 'agentmail_inbox_provisioning_completed' : 'agentmail_inbox_provisioning_failed', ok ? 'ok' : 'error', `created=${created.length};reused=${reused.length};skipped=${skipped.length};next=${setup.primary_blocker};no_scoped_credentials_no_send`)

  return {
    ok,
    source: 'agentmail_inbox_provisioning_apply',
    approval_id: approved.id,
    approval_state: approved.approval_state,
    inboxes_reused: reused,
    inboxes_created: created,
    inboxes_skipped: skipped,
    registry_rows_updated: registryRowsUpdated,
    final_inboxes: listAgentMailInboxes(db).map((row) => ({
      agent_id: row.agent_id,
      display_name: row.display_name,
      inbox_address: row.inbox_address,
      provision_state: row.provision_state,
      autonomy_level: row.autonomy_level,
    })),
    current_primary_blocker: setup.primary_blocker,
    full_blocker_list: setup.blockers,
    exact_blocker: ok ? setup.primary_blocker : 'agentmail_inbox_provisioning_failed',
    scoped_credentials_created: false,
    email_sent: false,
    send_enabled: false,
    execution_enabled: false,
    setup_status: setup,
    ...SAFE_FLAGS,
  }
}
