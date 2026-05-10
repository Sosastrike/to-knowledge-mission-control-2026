import { describe, expect, it } from 'vitest'
import { isZapierWriteTool, zapierBackendLocked, zapierNoWriteGuard } from './zapier-write-guard'

describe('Zapier no-write guard', () => {
  it('classifies mutating Zapier tool names as writes', () => {
    for (const tool of [
      'send_mail',
      'create_record',
      'update_ticket',
      'delete_row',
      'upload_file',
      'run_zap',
      'execute_action',
      'generate_video',
      'publish_post',
      'mcp__zapier__gmail_send_email',
    ]) {
      expect(isZapierWriteTool(tool)).toBe(true)
    }

    expect(isZapierWriteTool('list_records')).toBe(false)
    expect(isZapierWriteTool('find_folder')).toBe(false)
  })

  it('keeps write approval probes non-executable and non-persistent', () => {
    const payload = zapierNoWriteGuard({ tool: 'send_mail' })

    expect(payload).toMatchObject({
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      no_zapier_writes: true,
      bridge_session_required: true,
      approval_required_for_writes: true,
      approval_request_created: false,
      required_scope: 'zapier.write',
      blocker: 'owner_approval_required',
      blocked_action: 'zapier.write',
      tool: 'send_mail',
    })
  })

  it('keeps backend-required Zapier paths explicit about disabled writes', () => {
    const payload = zapierBackendLocked({ tool: 'list_records' })

    expect(payload).toMatchObject({
      accepted_for_execution: false,
      execution_enabled: false,
      writes_enabled: false,
      no_zapier_writes: true,
      bridge_session_required: true,
      approval_required_for_writes: true,
      approval_request_created: false,
      blocker: 'zapier_write_runner_not_configured',
      tool: 'list_records',
    })
  })
})
