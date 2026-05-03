import { describe, expect, it } from 'vitest'
import {
  ONEDRIVE_UPLOAD_BLOCKED_MESSAGE,
  getAgentZeroOneDriveDeliveryStatus,
  lookupAgentZeroOneDriveFolder,
  uploadAgentZeroOneDriveTestFile,
  verifyAgentZeroOneDriveLink,
} from './agent-zero-onedrive-delivery'
import type { ZapierToolBridgePayload } from './zapier-tool-bridge'

function fakeBridge(): ZapierToolBridgePayload {
  return {
    ok: true,
    connected: true,
    mcp_reachable: true,
    tools_total: 2,
    tools: [
      {
        tool_name: 'mcp__zapier__onedrive_upload_file',
        description: 'Upload a file to OneDrive.',
        category: 'onedrive',
        write_classification: 'write',
        approval_required: true,
        execution_enabled: false,
        blocker: 'execution locked',
        source: 'claude_mcp',
        required_fields: ['file', 'folder'],
        required_fields_source: 'mcp_schema',
      },
      {
        tool_name: 'mcp__zapier__onedrive_find_folder',
        description: 'Find a folder in OneDrive.',
        category: 'onedrive',
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
    query: 'onedrive',
    source: 'claude_mcp',
    sources_checked: ['test'],
    last_checked_at: '2026-05-03T13:00:00.000Z',
    execution_enabled: false,
    writes_enabled: false,
    no_zapier_writes: true,
    blocker: null,
    next_action: 'test',
  }
}

describe('Agent Zero OneDrive delivery adapter', () => {
  it('shows schema visibility but keeps upload blocked until an execution adapter exists', async () => {
    const status = await getAgentZeroOneDriveDeliveryStatus({ toolBridge: fakeBridge() })

    expect(status.connected).toBe(true)
    expect(status.upload_tool_visible).toBe(true)
    expect(status.folder_lookup_tool_visible).toBe(true)
    expect(status.schema_available).toBe(true)
    expect(status.upload_connector_configured).toBe(false)
    expect(status.execution_enabled).toBe(false)
    expect(status.writes_enabled).toBe(false)
    expect(status.bridge_session_required).toBe(true)
    expect(status.normal_reply).toBe(ONEDRIVE_UPLOAD_BLOCKED_MESSAGE)
    expect(status.credential_values_exposed).toBe(false)
    expect(status.no_tokens_exposed).toBe(true)
  })

  it('blocks folder lookup and upload actions without fake done claims', async () => {
    const lookup = await lookupAgentZeroOneDriveFolder({ folder: 'Tony videos 2026', toolBridge: fakeBridge() })
    const upload = await uploadAgentZeroOneDriveTestFile({ folder: 'Tony videos 2026', toolBridge: fakeBridge() })

    expect(lookup.ok).toBe(false)
    expect(upload.ok).toBe(false)
    expect(upload.normal_reply).toBe(ONEDRIVE_UPLOAD_BLOCKED_MESSAGE)
    expect(upload.accepted_for_execution).toBe(false)
    expect(upload.owner_approval_required).toBe(true)
    expect(upload.bridge_session_required).toBe(true)
    expect(upload.execution_enabled).toBe(false)
    expect(upload.no_fake_done).toBe(true)
    expect(JSON.stringify(upload)).not.toContain('/home/tony')
  })

  it('blocks link verification through the same safe surface', async () => {
    const result = await verifyAgentZeroOneDriveLink({ link: 'https://onedrive.live.com/example', toolBridge: fakeBridge() })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('blocked')
    expect(result.verify_link).toBe('https://onedrive.live.com/example')
    expect(result.normal_reply).toBe(ONEDRIVE_UPLOAD_BLOCKED_MESSAGE)
    expect(result.no_tokens_exposed).toBe(true)
  })
})
