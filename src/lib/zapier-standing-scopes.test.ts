import { describe, expect, it } from 'vitest'

import {
  buildZapierStandingScopes,
  evaluateZapierStandingScopeRequest,
} from '@/lib/zapier-standing-scopes'

describe('Zapier standing scopes', () => {
  it('keeps Zapier always-on for read-only discovery without enabling writes', () => {
    const payload = buildZapierStandingScopes()

    expect(payload.zapier_runtime).toMatchObject({
      mode: 'always_on',
      enabled: true,
      status: 'active',
      owner_enabled: true,
      emergency_stop: false,
      writes_default: 'blocked_unless_scope_approved',
      discovery: 'enabled',
      inventory: 'enabled',
      audit_required: true,
    })
    expect(payload.standing_scope_summary).toMatchObject({
      active_scopes: 1,
      read_only_scopes: 1,
      execution_scopes: 0,
      writes_enabled: false,
      broad_execution_enabled: false,
    })
    expect(payload.standing_scopes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope_id: 'zapier.scope.discovery_and_status',
        status: 'active',
        writes_enabled: false,
        allowed_actions: expect.arrayContaining([
          'zapier.connection_probe',
          'zapier.tool_list',
          'zapier.zap_metadata_read',
          'zapier.execution_status_check',
        ]),
      }),
    ]))
  })

  it('allows read-only discovery actions inside the standing discovery scope', () => {
    const decision = evaluateZapierStandingScopeRequest({
      action: 'zapier.tool_list',
      agent_id: 'agent.zero',
      destination: 'zapier_mcp_tool_inventory',
    })

    expect(decision).toMatchObject({
      allowed: true,
      scope_id: 'zapier.scope.discovery_and_status',
      writes_enabled: false,
      execution_enabled: false,
      exact_blocker: null,
    })
  })

  it('requires owner approval for out-of-scope or write-like Zapier actions', () => {
    const decision = evaluateZapierStandingScopeRequest({
      action: 'zapier.create_zap',
      agent_id: 'agent.zero',
      destination: 'zapier_live_write',
    })

    expect(decision).toMatchObject({
      allowed: false,
      approval_required: true,
      exact_blocker: 'zapier_action_outside_standing_scope',
      next_action: 'Approval required for out-of-scope Zapier action',
      writes_enabled: false,
      broad_execution_enabled: false,
    })
  })

  it('never exposes secrets in standing scope payloads', () => {
    const payload = buildZapierStandingScopes()

    expect(payload).toMatchObject({
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_enabled: false,
      broad_execution_enabled: false,
    })
    expect(JSON.stringify(payload)).not.toMatch(
      /Bearer|Authorization|cookie=|sk-[A-Za-z0-9]{12,}|\bam_[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/i,
    )
  })
})
