import type Database from 'better-sqlite3'

import { createApprovalRequest } from '@/lib/approval-requests'
import { AGENTMAIL_INBOX_PROVISIONING_TARGETS } from '@/lib/agentmail-inbox-provisioning'
import {
  detectAgentMailInboxLimitExceeded,
  ensureAgentMailSchema,
  latestAgentMailLiveInboxCount,
  listAgentMailInboxes,
  recordAgentMailAudit,
} from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'

const SAFE_FLAGS = {
  credential_values_exposed: false,
  tokens_exposed: false,
  env_values_exposed: false,
  raw_secret_values_exposed: false,
} as const

function nowIso() {
  return new Date().toISOString()
}

function safeText(value: unknown, fallback = '', max = 200) {
  return String(value || fallback)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/(?:am_|sk-|gsk_|xai-|nva-)[A-Za-z0-9._-]{8,}/gi, '[redacted]')
    .replace(/(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*[:=]\s*[^,\s}]+/gi, '[redacted]')
    .trim()
    .slice(0, max)
}

function provisionedEmails(db: Database.Database) {
  return listAgentMailInboxes(db)
    .filter((row) => row.inbox_address)
    .map((row) => String(row.inbox_address))
}

function missingTargets(db: Database.Database) {
  const inboxes = new Map(listAgentMailInboxes(db).map((row) => [row.agent_id, row]))
  return AGENTMAIL_INBOX_PROVISIONING_TARGETS
    .filter((target) => !inboxes.get(target.agent_id)?.inbox_address)
    .map((target) => ({
      agent_id: target.agent_id,
      display_name: target.display_name,
      email: target.email,
      role: target.role,
      autonomy_level: target.autonomy_level,
      send_policy: target.send_policy,
      exact_blocker: 'agentmail_inbox_limit_exceeded',
    }))
}

export function buildAgentMailCapacityStatus(db: Database.Database = getDatabase()) {
  ensureAgentMailSchema(db)
  const provisioned = provisionedEmails(db)
  const missing = missingTargets(db)
  const inboxLimitExceeded = detectAgentMailInboxLimitExceeded(db) && missing.length > 0
  const liveCount = latestAgentMailLiveInboxCount(db) ?? provisioned.length
  const blocked = inboxLimitExceeded ? missing : []
  if (inboxLimitExceeded) {
    recordAgentMailAudit(db, 'agentmail_inbox_limit_exceeded', 'blocked', `blocked=${blocked.length};live_inboxes=${liveCount}`)
    recordAgentMailAudit(db, 'agentmail_capacity_resolution_required', 'blocked', 'increase_capacity_or_owner_approve_reuse_mapping')
  }
  recordAgentMailAudit(db, 'agentmail_capacity_resolution_previewed', inboxLimitExceeded ? 'blocked' : 'ok', `live=${liveCount};provisioned=${provisioned.length};blocked=${blocked.length}`)

  return {
    ok: true,
    source: 'agentmail_capacity_status',
    generated_at: nowIso(),
    current_primary_blocker: inboxLimitExceeded ? 'agentmail_inbox_limit_exceeded' : missing.length ? 'agentmail_inbox_assignment_missing' : 'agentmail_inbox_credential_required',
    user_facing_blocker: inboxLimitExceeded ? 'AgentMail inbox limit exceeded' : missing.length ? 'AgentMail inbox assignment missing' : 'Scoped AgentMail inbox credential required',
    live_inboxes: liveCount,
    required_target_inboxes: AGENTMAIL_INBOX_PROVISIONING_TARGETS.length,
    provisioned_synced: provisioned.length,
    blocked_by_provider_limit: blocked.length,
    existing_live_inboxes: provisioned,
    missing_required_inboxes: missing,
    provisioned,
    blocked,
    resolution_options: [
      {
        id: 'increase_agentmail_inbox_limit',
        label: 'Increase AgentMail inbox limit',
        mutation_enabled: false,
        owner_approval_required: false,
        detail: 'Upgrade the AgentMail plan or request capacity, then rerun inbox provisioning.',
      },
      {
        id: 'explicit_owner_approved_reuse_mapping',
        label: 'Reuse existing live inboxes',
        mutation_enabled: false,
        owner_approval_required: true,
        detail: 'Requires explicit owner-approved mapping; shared/reused inboxes stay warning-labeled and send locked.',
      },
      {
        id: 'delete_unrelated_inboxes_in_agentmail_console',
        label: 'Delete unrelated inboxes from AgentMail console',
        mutation_enabled: false,
        owner_approval_required: true,
        detail: 'Mission Control will not delete AgentMail inboxes automatically.',
      },
    ],
    recommended_resolution: 'increase_agentmail_inbox_limit',
    alternate_resolution: 'explicit_owner_approved_reuse_mapping',
    deletion_automated: false,
    reuse_applied: false,
    scoped_credentials_created: false,
    email_sent: false,
    send_enabled: false,
    execution_enabled: false,
    ...SAFE_FLAGS,
  }
}

export function buildAgentMailCapacityResolutionPreview(db: Database.Database = getDatabase()) {
  const status = buildAgentMailCapacityStatus(db)
  return {
    current_live_inboxes: status.live_inboxes,
    target_required_inboxes: status.required_target_inboxes,
    provisioned: status.provisioned,
    blocked: status.blocked.map((row) => row.email),
    recommended_resolution: status.recommended_resolution,
    alternate_resolution: status.alternate_resolution,
    existing_live_inboxes: status.existing_live_inboxes,
    missing_required_inboxes: status.missing_required_inboxes.map((row) => row.email),
    resolution_options: status.resolution_options,
    scoped_credentials_created: false,
    email_sent: false,
    credential_values_exposed: false,
  }
}

export function createAgentMailCapacityResolutionRequest(input: { db?: Database.Database; requester?: string; idempotencyKey?: string } = {}) {
  const db = input.db || getDatabase()
  ensureAgentMailSchema(db)
  const preview = buildAgentMailCapacityResolutionPreview(db)
  const { request, created } = createApprovalRequest({
    connector: 'agentmail',
    action: 'agentmail_capacity_resolution',
    target: 'agentmail_capacity',
    target_key: 'agentmail:capacity:resolution',
    requester: safeText(input.requester || 'owner', 'owner', 120),
    risk_level: 'medium',
    protected_category: 'connector_write',
    reason: 'Owner decision is required to resolve AgentMail inbox capacity by increasing capacity, deleting unrelated inboxes externally, or approving an explicit reuse mapping.',
    approval_scope: preview,
    idempotency_key: input.idempotencyKey || 'agentmail:capacity:resolution',
  })
  recordAgentMailAudit(db, 'agentmail_capacity_resolution_requested', 'blocked', `approval_id=${request.id};blocked=${preview.blocked.length};no_delete_no_reuse_no_send`)
  return {
    ok: true,
    source: 'agentmail_capacity_resolution_request',
    approval_id: request.id,
    approval_state: request.approval_state,
    approval_request_created: created,
    exact_blocker: 'agentmail_capacity_resolution_owner_decision_required',
    preview,
    deletion_automated: false,
    reuse_applied: false,
    scoped_credentials_created: false,
    email_sent: false,
    send_enabled: false,
    execution_enabled: false,
    ...SAFE_FLAGS,
  }
}
