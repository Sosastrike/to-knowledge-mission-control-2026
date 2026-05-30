import { describe, expect, it } from 'vitest'

import { buildZapierApprovedActionLibrary } from './zapier-approved-action-library'
import {
  buildZapierConnectionDetails,
  type ZapierCredentialPresence,
} from './zapier-connection-details'
import type { ZapierToolBridgePayload } from './zapier-tool-bridge'

function bridge(overrides: Partial<ZapierToolBridgePayload> = {}): ZapierToolBridgePayload {
  return {
    ok: true,
    connected: true,
    mcp_reachable: true,
    tools_total: 4,
    tools: [
      {
        tool_name: 'mcp__zapier__google_drive_find_file',
        description: 'Find a file',
        category: 'google_drive',
        write_classification: 'read',
        approval_required: false,
        execution_enabled: false,
        blocker: null,
        source: 'zapier_mcp',
        required_fields: ['query'],
        required_fields_source: 'mcp_schema',
      },
      {
        tool_name: 'mcp__zapier__slack_send_channel_message',
        description: 'Send a Slack message',
        category: 'slack',
        write_classification: 'write',
        approval_required: true,
        execution_enabled: false,
        blocker: 'Zapier execution is locked.',
        source: 'zapier_mcp',
        required_fields: ['channel', 'text'],
        required_fields_source: 'mcp_schema',
      },
      {
        tool_name: 'mcp__zapier__salesforce_lookup_record',
        description: 'Lookup a record',
        category: 'salesforce',
        write_classification: 'read',
        approval_required: false,
        execution_enabled: false,
        blocker: null,
        source: 'zapier_mcp',
        required_fields: ['query'],
        required_fields_source: 'mcp_schema',
      },
      {
        tool_name: 'mcp__zapier__custom_action',
        description: 'Custom Zapier action',
        category: 'custom',
        write_classification: 'unknown',
        approval_required: true,
        execution_enabled: false,
        blocker: 'Zapier execution is locked.',
        source: 'zapier_mcp',
        required_fields: null,
        required_fields_source: 'cached_snapshot_unavailable',
      },
    ],
    heygen_found: true,
    heygen_tools: [
      {
        tool_name: 'mcp__zapier__heygen_create_an_avatar_video_generate',
        description: 'Create an avatar video',
        category: 'heygen',
        write_classification: 'write',
        approval_required: true,
        execution_enabled: false,
        blocker: 'Zapier execution is locked.',
        source: 'zapier_mcp',
        required_fields: ['avatar_id', 'script'],
        required_fields_source: 'mcp_schema',
      },
    ],
    exact_heygen_tool_name: 'mcp__zapier__heygen_create_an_avatar_video_generate',
    required_fields: ['avatar_id', 'script'],
    query: null,
    source: 'zapier_mcp',
    sources_checked: ['claude_mcp', 'zapier_mcp'],
    last_checked_at: '2026-05-30T00:00:00.000Z',
    execution_enabled: false,
    writes_enabled: false,
    no_zapier_writes: true,
    blocker: null,
    next_action: 'Read-only discovery available. Writes remain locked.',
    ...overrides,
  }
}

describe('Zapier connection details', () => {
  it('summarizes concrete Zapier connections without exposing credential values', () => {
    const credentials: ZapierCredentialPresence = {
      ZAPIER_MCP_URL: true,
      ZAPIER_MCP_SERVER: false,
      ZAPIER_ACCESS_TOKEN: true,
      ZAPIER_API_KEY: false,
    }

    const details = buildZapierConnectionDetails({
      bridge: bridge(),
      approvedActionLibrary: buildZapierApprovedActionLibrary(),
      credentialPresence: credentials,
      auditCounts: {
        blocked_writes_24h: 1,
        allowed_reads_24h: 3,
      },
    })

    expect(details.status).toBe('connected')
    expect(details.secret_values_exposed).toBe(false)
    expect(details.session_id_value_exposed).toBe(false)
    expect(details.credential_names_checked).toEqual(Object.keys(credentials))
    expect(details.credential_present_by_name_only).toEqual(credentials)
    expect(details.credentials_present_count).toBe(2)
    expect(details.summary).toMatchObject({
      tools_total: 4,
      read_tools: 2,
      write_gated_tools: 1,
      unknown_tools: 1,
      approved_actions_total: 8,
      certified_actions_total: 1,
      prepared_actions_total: 7,
      mcp_reachable: true,
      source: 'zapier_mcp',
    })
    expect(details.connections.map((connection) => connection.id)).toEqual([
      'zapier_mcp_transport',
      'zapier_tool_inventory',
      'zapier_heygen',
      'zapier_approved_actions',
      'zapier_write_approval',
    ])
    expect(details.connections.find((connection) => connection.id === 'zapier_heygen')).toMatchObject({
      label: 'HeyGen via Zapier',
      state: 'READ_ONLY',
      endpoint: '/api/bridge/zapier/tools/search?q=heygen',
      exact_tool_name: 'mcp__zapier__heygen_create_an_avatar_video_generate',
      required_fields: ['avatar_id', 'script'],
    })
    expect(JSON.stringify(details)).not.toContain('redacted-present')
    expect(JSON.stringify(details)).not.toContain('Bearer')
  })

  it('shows specific blockers when OAuth is present but tool inventory is not visible', () => {
    const details = buildZapierConnectionDetails({
      bridge: bridge({
        connected: false,
        mcp_reachable: false,
        tools_total: 0,
        tools: [],
        heygen_found: false,
        heygen_tools: [],
        exact_heygen_tool_name: null,
        required_fields: null,
        source: 'none',
        blocker: 'zapier_mcp_not_reachable',
        next_action: 'Connect or resync Zapier MCP.',
      }),
      approvedActionLibrary: buildZapierApprovedActionLibrary(),
      credentialPresence: {
        ZAPIER_MCP_URL: false,
        ZAPIER_MCP_SERVER: false,
        ZAPIER_ACCESS_TOKEN: true,
        ZAPIER_API_KEY: false,
      },
      auditCounts: {
        blocked_writes_24h: 0,
        allowed_reads_24h: 0,
      },
    })

    expect(details.status).toBe('degraded')
    expect(details.connections.find((connection) => connection.id === 'zapier_tool_inventory')).toMatchObject({
      state: 'CREDENTIAL_REQUIRED',
      blocker: 'zapier_mcp_not_reachable',
    })
    expect(details.connections.find((connection) => connection.id === 'zapier_write_approval')).toMatchObject({
      state: 'OWNER_APPROVAL_REQUIRED',
      writes_enabled: false,
    })
  })
})
