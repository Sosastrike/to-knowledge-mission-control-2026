import { describe, expect, it } from 'vitest'

import { buildOpenCloudAuthorityPolicy, evaluateOpenCloudAuthority } from '@/lib/opencloud-authority-policy'

describe('OpenCloud authority policy', () => {
  it('demotes OpenCloud to supporting runtime and forbids conversation ownership', () => {
    const policy = buildOpenCloudAuthorityPolicy()

    expect(policy).toMatchObject({
      opencloud_demoted: true,
      openclaw_demoted: true,
      nuclear_gateway_owner: true,
      system_type: 'supporting_runtime_system',
      conversation_owner: 'none',
      direct_line_active: false,
      can_listen_to_other_agent_channels: false,
      can_modify_production_directly: false,
      can_route_owner_messages: false,
      can_be_default_gateway: false,
      can_broker_credentials: false,
      no_secrets_exposed: true,
      project_continues: true,
    })
    expect(policy.allowed_roles).toEqual(expect.arrayContaining([
      'supporting_runtime_system',
      'tool_provider_when_invoked',
      'mini_agent_when_invoked',
      'diagnostics_helper',
      'supporting_tool_only',
    ]))
    expect(policy.forbidden_roles).toEqual(expect.arrayContaining([
      'commander',
      'hidden_dispatcher',
      'conversation_owner',
      'credential_broker',
      'default_gateway',
    ]))
  })

  it('blocks OpenCloud as commander, owner, or hidden intermediary', () => {
    expect(evaluateOpenCloudAuthority({
      target_agent: 'opencloud',
      opencloud_role: 'commander',
    })).toMatchObject({
      allowed: false,
      exact_blocker: 'opencloud_is_supporting_runtime_not_commander',
    })

    expect(evaluateOpenCloudAuthority({
      conversation_owner: 'openclaw',
      opencloud_role: 'supporting_tool_only',
    })).toMatchObject({
      allowed: false,
      exact_blocker: 'opencloud_cannot_be_conversation_owner',
    })

    expect(evaluateOpenCloudAuthority({
      hidden_intermediary: true,
      opencloud_role: 'supporting_tool_only',
    })).toMatchObject({
      allowed: false,
      exact_blocker: 'opencloud_hidden_intermediary_forbidden',
    })
  })

  it('allows OpenCloud only as an explicitly invoked supporting tool with task, audit, and rollback proof', () => {
    expect(evaluateOpenCloudAuthority({
      target_agent: 'agent-zero-jarvis',
      invoked_by: 'agent-zero-jarvis',
      opencloud_role: 'supporting_tool_only',
      direct_line_used: true,
      visible_task_id: '123',
      audit_id: 'audit_123',
      rollback_id: 'no_state_123',
    })).toMatchObject({
      allowed: true,
      exact_blocker: null,
      opencloud_role: 'supporting_tool_only',
      no_secrets_exposed: true,
    })

    expect(evaluateOpenCloudAuthority({
      target_agent: 'agent-zero-jarvis',
      invoked_by: 'agent-zero-jarvis',
      opencloud_role: 'supporting_tool_only',
      direct_line_used: true,
      audit_id: 'audit_123',
      rollback_id: 'no_state_123',
    })).toMatchObject({
      allowed: false,
      exact_blocker: 'opencloud_visible_task_required',
    })
  })
})
