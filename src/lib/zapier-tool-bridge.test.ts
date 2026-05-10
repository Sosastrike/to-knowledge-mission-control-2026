import { describe, expect, it, vi } from 'vitest'
import { getZapierToolBridge } from './zapier-tool-bridge'
import { getMcpServerTools } from './mcp-server-tool-schemas'

vi.mock('./mcp-server-tool-schemas', () => ({
  getMcpServerTools: vi.fn(),
}))

const mockedGetMcpServerTools = vi.mocked(getMcpServerTools)

describe('Zapier tool bridge contract', () => {
  it('surfaces live read-only tools as READY and keeps execution disabled', async () => {
    mockedGetMcpServerTools.mockResolvedValueOnce({
      ok: true,
      status: 'live',
      canonical_status: 'READY',
      blocker_class: 'NONE',
      owner_status: {
        status: 'READY',
        label: 'READY',
        summary: 'ready',
        reason: null,
        blocker_class: 'NONE',
        tone: 'blue',
        can_read: true,
        can_write: false,
        can_execute: false,
        bridge_session_required: true,
      },
      server: 'zapier',
      mcp_reachable: true,
      tools_total: 2,
      read_tools_total: 1,
      write_tools_total: 1,
      unknown_tools_total: 0,
      read_enabled: true,
      bridge_session_required: true,
      approval_required_for_writes: true,
      allowed_owner_statuses: ['LIVE', 'READY', 'OWNER_GATED', 'CREDENTIAL_GATED', 'SERVICE_DOWN', 'BLOCKED', 'DISABLED'],
      tools: [
        {
          raw_tool_name: 'list_records',
          tool_name: 'mcp__zapier__list_records',
          description: 'List records.',
          write_classification: 'read',
          approval_required: false,
          execution_enabled: false,
          writes_enabled: false,
          required_fields: [],
          schema_available: true,
          input_schema: { type: 'object', required_fields: [], properties: [] },
        },
        {
          raw_tool_name: 'send_mail',
          tool_name: 'mcp__zapier__send_mail',
          description: 'Send mail.',
          write_classification: 'write',
          approval_required: true,
          execution_enabled: false,
          writes_enabled: false,
          required_fields: ['to'],
          schema_available: true,
          input_schema: { type: 'object', required_fields: ['to'], properties: [] },
        },
      ],
      source: 'claude_mcp_oauth_cache',
      credentials_source: 'claude_oauth_cache',
      auth_attached: true,
      auth_redacted: true,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
    })

    const payload = await getZapierToolBridge()

    expect(payload).toMatchObject({
      ok: true,
      canonical_status: 'READY',
      blocker_class: 'NONE',
      connected: true,
      mcp_reachable: true,
      read_enabled: true,
      tools_total: 2,
      read_tools_total: 1,
      write_tools_total: 1,
      unknown_tools_total: 0,
      execution_enabled: false,
      writes_enabled: false,
      no_zapier_writes: true,
      bridge_session_required: true,
      approval_required_for_writes: true,
    })
    expect(payload.tools[1].approval_required).toBe(true)
    expect(payload.tools[1].execution_enabled).toBe(false)
  })

  it('classifies invisible Zapier inventory as a canonical external blocker', async () => {
    mockedGetMcpServerTools.mockResolvedValueOnce({
      ok: false,
      status: 'unavailable',
      canonical_status: 'BLOCKED',
      blocker_class: 'BLOCKED',
      owner_status: {
        status: 'BLOCKED',
        label: 'BLOCKED',
        summary: 'blocked',
        reason: 'MCP server zapier is not present in the Claude MCP configuration.',
        blocker_class: 'BLOCKED',
        tone: 'red',
        can_read: false,
        can_write: false,
        can_execute: false,
        bridge_session_required: true,
      },
      server: 'zapier',
      mcp_reachable: false,
      tools_total: 0,
      tools: [],
      read_tools_total: 0,
      write_tools_total: 0,
      unknown_tools_total: 0,
      read_enabled: false,
      bridge_session_required: true,
      approval_required_for_writes: true,
      allowed_owner_statuses: ['LIVE', 'READY', 'OWNER_GATED', 'CREDENTIAL_GATED', 'SERVICE_DOWN', 'BLOCKED', 'DISABLED'],
      source: null,
      credentials_source: null,
      auth_attached: false,
      auth_redacted: true,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
      error: 'mcp_server_not_configured',
      blocker: 'MCP server zapier is not present in the Claude MCP configuration.',
      next_action: 'Connect or resync the MCP server in Claude Code, then retry this read-only route.',
    })

    const payload = await getZapierToolBridge()

    expect(payload).toMatchObject({
      ok: true,
      canonical_status: 'BLOCKED',
      blocker_class: 'BLOCKED',
      connected: false,
      tools_total: 0,
      read_enabled: false,
      execution_enabled: false,
      writes_enabled: false,
      no_zapier_writes: true,
      bridge_session_required: true,
      approval_required_for_writes: true,
    })
    expect(payload.blocker).toContain('MCP server zapier')
    expect(JSON.stringify(payload)).not.toMatch(/\/home\/tony|Bearer\s+/i)
  })
})
