import { describe, expect, it } from 'vitest'
import {
  GOOGLE_DRIVE_UPLOAD_BLOCKED_MESSAGE,
  getAgentZeroGoogleDriveDeliveryStatus,
  lookupAgentZeroGoogleDriveFolder,
  uploadAgentZeroGoogleDriveTestFile,
  verifyAgentZeroGoogleDriveLink,
} from './agent-zero-google-drive-delivery'
import type { ZapierToolBridgePayload } from './zapier-tool-bridge'

function fakeBridge(): ZapierToolBridgePayload {
  return {
    ok: true,
    canonical_status: 'READY',
    blocker_class: 'NONE',
    owner_status: {
      status: 'READY',
      label: 'READY',
      summary: 'Visible and usable for safe read-only or advisory work; protected execution is still gated.',
      reason: null,
      blocker_class: 'NONE',
      tone: 'blue',
      can_read: true,
      can_write: false,
      can_execute: false,
      bridge_session_required: true,
    },
    connected: true,
    mcp_reachable: true,
    read_enabled: true,
    tools_total: 2,
    read_tools_total: 1,
    write_tools_total: 1,
    unknown_tools_total: 0,
    tools: [
      {
        tool_name: 'mcp__zapier__google_drive_upload_file',
        description: 'Upload a file to Google Drive.',
        category: 'google_drive',
        write_classification: 'write',
        approval_required: true,
        execution_enabled: false,
        blocker: 'execution locked',
        source: 'claude_mcp',
        required_fields: ['file', 'folder'],
        required_fields_source: 'mcp_schema',
      },
      {
        tool_name: 'mcp__zapier__google_drive_find_folder',
        description: 'Find a folder in Google Drive.',
        category: 'google_drive',
        write_classification: 'read',
        approval_required: false,
        execution_enabled: false,
        blocker: null,
        source: 'claude_mcp',
        required_fields: ['folder_name'],
        required_fields_source: 'mcp_schema',
      },
    ],
    heygen_found: false,
    heygen_tools: [],
    exact_heygen_tool_name: null,
    required_fields: null,
    query: 'google drive',
    source: 'claude_mcp',
    sources_checked: ['test'],
    last_checked_at: '2026-05-03T13:00:00.000Z',
    execution_enabled: false,
    writes_enabled: false,
    no_zapier_writes: true,
    bridge_session_required: true,
    approval_required_for_writes: true,
    allowed_owner_statuses: [
      'LIVE',
      'READY',
      'OWNER_GATED',
      'CREDENTIAL_GATED',
      'SERVICE_DOWN',
      'BLOCKED',
      'DISABLED',
    ],
    blocker: null,
    warning: null,
    next_action: 'test',
  }
}

describe('Agent Zero Google Drive delivery adapter', () => {
  it('shows schema visibility but keeps upload blocked until an execution adapter exists', async () => {
    const status = await getAgentZeroGoogleDriveDeliveryStatus({ toolBridge: fakeBridge() })

    expect(status.connected).toBe(true)
    expect(status.canonical_status).toBe('CREDENTIAL_GATED')
    expect(status.blocker_class).toBe('CREDENTIAL_GATED')
    expect(status.required_scope).toBe('google_drive.upload')
    expect(status.target_folder_required).toBe(true)
    expect(status.target_folder_configured).toBe(false)
    expect(status.no_upload_performed).toBe(true)
    expect(status.upload_tool_visible).toBe(true)
    expect(status.folder_lookup_tool_visible).toBe(true)
    expect(status.schema_available).toBe(true)
    expect(status.upload_connector_configured).toBe(false)
    expect(status.execution_enabled).toBe(false)
    expect(status.writes_enabled).toBe(false)
    expect(status.bridge_session_required).toBe(true)
    expect(status.normal_reply).toBe(GOOGLE_DRIVE_UPLOAD_BLOCKED_MESSAGE)
    expect(status.credential_values_exposed).toBe(false)
    expect(status.no_tokens_exposed).toBe(true)
  })

  it('blocks folder lookup and upload actions without fake done claims', async () => {
    const lookup = await lookupAgentZeroGoogleDriveFolder({ folder: 'Tony videos 2026', toolBridge: fakeBridge() })
    const upload = await uploadAgentZeroGoogleDriveTestFile({ folder: 'Tony videos 2026', toolBridge: fakeBridge() })

    expect(lookup.ok).toBe(false)
    expect(upload.ok).toBe(false)
    expect(upload.normal_reply).toBe(GOOGLE_DRIVE_UPLOAD_BLOCKED_MESSAGE)
    expect(upload.required_scope).toBe('google_drive.upload')
    expect(upload.accepted_for_execution).toBe(false)
    expect(upload.owner_approval_required).toBe(true)
    expect(upload.bridge_session_required).toBe(true)
    expect(upload.execution_enabled).toBe(false)
    expect(upload.no_upload_performed).toBe(true)
    expect(upload.no_fake_done).toBe(true)
    expect(JSON.stringify(upload)).not.toContain('/home/tony')
  })

  it('blocks link verification through the same safe surface', async () => {
    const result = await verifyAgentZeroGoogleDriveLink({ link: 'https://drive.google.com/file/d/example', toolBridge: fakeBridge() })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('blocked')
    expect(result.verify_link).toBe('https://drive.google.com/file/d/example')
    expect(result.normal_reply).toBe(GOOGLE_DRIVE_UPLOAD_BLOCKED_MESSAGE)
    expect(result.no_tokens_exposed).toBe(true)
  })
})
