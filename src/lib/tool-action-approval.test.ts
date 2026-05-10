import { describe, expect, it } from 'vitest'
import { buildToolActionApprovalPlan } from './tool-action-approval'

describe('tool action approval planner', () => {
  it.each([
    [{ connector: 'zapier', tool: 'mcp__zapier__gmail_send_email', action: 'send email' }, 'zapier.write', 'zapier', 'high'],
    [{ connector: 'zapier', tool: 'mcp__zapier__heygen_create_a_video_from_template', action: 'generate video' }, 'heygen.generate', 'zapier.heygen', 'high'],
    [{ connector: 'agentmail', action: 'send', target: 'owner@example.com' }, 'agentmail.send', 'agentmail', 'medium'],
    [{ connector: 'google_drive', action: 'upload report', target: 'reports' }, 'google_drive.upload', 'google_drive', 'medium'],
    [{ connector: 'onedrive', action: 'upload report', target: 'reports' }, 'onedrive.upload', 'onedrive', 'medium'],
    [{ connector: 'mcp', tool: 'mcp__linear__create_issue', action: 'execute tool' }, 'protected_action.execute', 'mcp', 'high'],
  ] as const)('maps %j to an exact approval scope without enabling execution', (input, requiredScope, connector, riskLevel) => {
    const result = buildToolActionApprovalPlan({
      ...input,
      payload: {
        subject: 'Day 50 proof',
        body: 'This value must not be echoed into owner-facing approval output.',
      },
    })

    expect(result).toMatchObject({
      ok: true,
      mode: 'tool_action_approval_plan',
      canonical_status: 'OWNER_GATED',
      blocker_class: 'OWNER_GATED',
      required_scope: requiredScope,
      connector,
      risk_level: riskLevel,
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required: true,
      owner_approval_required: true,
      approval_request_created: false,
    })
    expect(result.approval_scope).toMatchObject({
      required_scope: requiredScope,
      payload_fields_present: ['body', 'subject'],
      payload_value_storage: 'hash_and_field_names_only',
    })
    expect(result.approval_scope).not.toHaveProperty('body')
    expect(JSON.stringify(result)).not.toContain('This value must not be echoed')
  })

  it('blocks unknown or broad external action requests instead of creating an approval', () => {
    const result = buildToolActionApprovalPlan({
      connector: 'unknown',
      action: 'do everything everywhere',
      payload: { raw: 'no exact tool scope' },
    })

    expect(result).toMatchObject({
      ok: false,
      canonical_status: 'BLOCKED',
      blocker_class: 'BLOCKED',
      required_scope: null,
      approval_request_created: false,
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      blocker: 'tool_action_scope_not_supported',
    })
  })
})
