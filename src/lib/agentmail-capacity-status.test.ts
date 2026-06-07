import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import {
  buildAgentMailCapacityStatus,
  createAgentMailCapacityResolutionRequest,
} from '@/lib/agentmail-capacity-status'
import { ensureAgentMailSchema, recordAgentMailAudit } from '@/lib/agentmail-local-control'

describe('AgentMail capacity status', () => {
  function seedLimitExceededState() {
    const db = new Database(':memory:')
    ensureAgentMailSchema(db)
    db.prepare("UPDATE agentmail_inboxes SET inbox_address = ?, provision_state = 'assigned' WHERE agent_id = 'gateway'").run('gateway@agentmail.to')
    recordAgentMailAudit(db, 'agentmail_live_inbox_preview_completed', 'ok', 'live_inboxes=3')
    for (const agent of ['pi', 'agent_zero', 'bridge_unit', 'agentmail_monitor', 'agentmail_audit']) {
      recordAgentMailAudit(db, 'agentmail_inbox_provisioning_failed', 'error', `agent=${agent};agentmail_inbox_limit_exceeded;http=403`)
    }
    return db
  }

  it('reports AgentMail inbox limit as the capacity blocker without enabling send or credentials', () => {
    const db = seedLimitExceededState()

    const status = buildAgentMailCapacityStatus(db)

    expect(status).toMatchObject({
      ok: true,
      source: 'agentmail_capacity_status',
      current_primary_blocker: 'agentmail_inbox_limit_exceeded',
      live_inboxes: 3,
      required_target_inboxes: 6,
      provisioned_synced: 1,
      blocked_by_provider_limit: 5,
      scoped_credentials_created: false,
      email_sent: false,
      send_enabled: false,
      credential_values_exposed: false,
    })
    expect(status.provisioned).toEqual(['gateway@agentmail.to'])
    expect(status.blocked.map((row: any) => row.email)).toEqual([
      'pi@agentmail.to',
      'agent-zero@agentmail.to',
      'bridge-unit@agentmail.to',
      'agentmail-monitor@agentmail.to',
      'agentmail-audit@agentmail.to',
    ])
    expect(status.resolution_options.map((row: any) => row.id)).toEqual([
      'increase_agentmail_inbox_limit',
      'explicit_owner_approved_reuse_mapping',
      'delete_unrelated_inboxes_in_agentmail_console',
    ])
    expect(JSON.stringify(status)).not.toContain('agentmail-test-secret-value')
  })

  it('creates an owner-gated capacity resolution request without mutating inboxes', () => {
    const db = seedLimitExceededState()

    const result = createAgentMailCapacityResolutionRequest({ db, requester: 'owner' })

    expect(result).toMatchObject({
      ok: true,
      source: 'agentmail_capacity_resolution_request',
      approval_request_created: expect.any(Boolean),
      exact_blocker: 'agentmail_capacity_resolution_owner_decision_required',
      scoped_credentials_created: false,
      email_sent: false,
      send_enabled: false,
    })
    expect(result.preview).toMatchObject({
      current_live_inboxes: 3,
      target_required_inboxes: 6,
      provisioned: ['gateway@agentmail.to'],
      recommended_resolution: 'increase_agentmail_inbox_limit',
      alternate_resolution: 'explicit_owner_approved_reuse_mapping',
    })
    expect(result.preview.blocked).toEqual([
      'pi@agentmail.to',
      'agent-zero@agentmail.to',
      'bridge-unit@agentmail.to',
      'agentmail-monitor@agentmail.to',
      'agentmail-audit@agentmail.to',
    ])
    expect(JSON.stringify(result)).not.toContain('agentmail-test-secret-value')
  })
})
