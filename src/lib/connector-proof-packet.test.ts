import { describe, expect, it } from 'vitest'
import { buildConnectorProofReplayPacket } from './connector-proof-packet'
import type { ZapierToolBridgePayload } from './zapier-tool-bridge'

const mockZapierBridge: ZapierToolBridgePayload = {
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
  tools_total: 3,
  read_tools_total: 1,
  write_tools_total: 2,
  unknown_tools_total: 0,
  tools: [
    {
      tool_name: 'mcp__zapier__google_drive_find_a_file',
      description: 'Find a Google Drive file',
      category: 'google_drive',
      write_classification: 'read',
      approval_required: false,
      execution_enabled: false,
      blocker: null,
      source: 'claude_mcp',
      required_fields: ['query'],
      required_fields_source: 'mcp_schema',
    },
    {
      tool_name: 'mcp__zapier__onedrive_upload_file',
      description: 'Upload a file to OneDrive',
      category: 'onedrive',
      write_classification: 'write',
      approval_required: true,
      execution_enabled: false,
      blocker: 'Zapier execution is locked. Use Telegram approval and exact-scope runner before invoking this tool.',
      source: 'claude_mcp',
      required_fields: ['file'],
      required_fields_source: 'mcp_schema',
    },
    {
      tool_name: 'mcp__zapier__heygen_create_an_avatar_video_generate',
      description: 'Create an avatar video in HeyGen',
      category: 'heygen',
      write_classification: 'write',
      approval_required: true,
      execution_enabled: false,
      blocker: 'Zapier execution is locked. Use Telegram approval and exact-scope runner before invoking this tool.',
      source: 'claude_mcp',
      required_fields: ['avatar_id', 'script'],
      required_fields_source: 'mcp_schema',
    },
  ],
  heygen_found: true,
  heygen_tools: [
    {
      tool_name: 'mcp__zapier__heygen_create_an_avatar_video_generate',
      description: 'Create an avatar video in HeyGen',
      category: 'heygen',
      write_classification: 'write',
      approval_required: true,
      execution_enabled: false,
      blocker: 'Zapier execution is locked. Use Telegram approval and exact-scope runner before invoking this tool.',
      source: 'claude_mcp',
      required_fields: ['avatar_id', 'script'],
      required_fields_source: 'mcp_schema',
    },
  ],
  exact_heygen_tool_name: 'mcp__zapier__heygen_create_an_avatar_video_generate',
  required_fields: ['avatar_id', 'script'],
  query: 'heygen',
  source: 'claude_mcp',
  sources_checked: ['test_fixture'],
  last_checked_at: '2026-05-12T00:00:00.000Z',
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
  next_action: 'Use the Zapier HeyGen path for video planning. Do not ask for direct HeyGen API keys first.',
}

describe('buildConnectorProofReplayPacket', () => {
  it('replays connector proof without enabling sends, uploads, Zapier writes, or HeyGen generation', async () => {
    const packet = await buildConnectorProofReplayPacket({
      generatedAt: '2026-05-12T00:00:00.000Z',
      runtimeCommit: 'test-commit',
      zapierBridge: mockZapierBridge,
    })

    expect(packet.ok).toBe(true)
    expect(packet.connectors_total).toBe(6)
    expect(packet.connector_packets.map((entry) => entry.connector_id)).toEqual([
      'telegram',
      'agentmail',
      'google_drive',
      'onedrive',
      'zapier',
      'heygen',
    ])
    expect(packet.execution_enabled).toBe(false)
    expect(packet.writes_enabled).toBe(false)
    expect(packet.external_writes_enabled).toBe(false)
    expect(packet.no_telegram_send).toBe(true)
    expect(packet.no_agentmail_send).toBe(true)
    expect(packet.no_drive_upload).toBe(true)
    expect(packet.no_onedrive_upload).toBe(true)
    expect(packet.no_zapier_writes).toBe(true)
    expect(packet.no_heygen_generation).toBe(true)
    expect(packet.secrets_exposed).toBe(false)
    expect(packet.raw_paths_exposed).toBe(false)
    expect(packet.consistency_ok).toBe(true)

    for (const connector of packet.connector_packets) {
      expect(connector.result).not.toBe('LIVE')
      expect(connector.execution_enabled).toBe(false)
      expect(connector.writes_enabled).toBe(false)
      expect(connector.external_writes_enabled).toBe(false)
      expect(connector.fake_success_allowed).toBe(false)
      expect(connector.secrets_exposed).toBe(false)
      expect(connector.raw_paths_exposed).toBe(false)
      expect(connector.audit_pointer).toBe('/api/bridge/approval-requests/audit-report')
      expect(connector.safe_log_pointer).toMatch(/^\/api\//)
    }
  })
})
