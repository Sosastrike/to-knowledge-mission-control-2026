import { describe, expect, it } from 'vitest'
import { describeMcpToolDiscoveryResult } from './mcp-server-tool-schemas'

describe('MCP tool discovery contract', () => {
  it('marks live tools/list as read-only READY and keeps execution disabled', () => {
    const result = describeMcpToolDiscoveryResult({
      ok: true,
      status: 'live',
      server: 'zapier',
      mcp_reachable: true,
      tools_total: 3,
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
          raw_tool_name: 'send_message',
          tool_name: 'mcp__zapier__send_message',
          description: 'Send a message.',
          write_classification: 'write',
          approval_required: true,
          execution_enabled: false,
          writes_enabled: false,
          required_fields: ['to'],
          schema_available: true,
          input_schema: { type: 'object', required_fields: ['to'], properties: [] },
        },
        {
          raw_tool_name: 'do_thing',
          tool_name: 'mcp__zapier__do_thing',
          description: null,
          write_classification: 'unknown',
          approval_required: true,
          execution_enabled: false,
          writes_enabled: false,
          required_fields: [],
          schema_available: false,
          input_schema: null,
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

    expect(result).toMatchObject({
      canonical_status: 'READY',
      blocker_class: 'NONE',
      read_enabled: true,
      read_tools_total: 1,
      write_tools_total: 1,
      unknown_tools_total: 1,
      bridge_session_required: true,
      approval_required_for_writes: true,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
    })
  })

  it('classifies missing auth as CREDENTIAL_GATED without enabling execution', () => {
    const result = describeMcpToolDiscoveryResult({
      ok: false,
      status: 'unavailable',
      server: 'zapier',
      mcp_reachable: false,
      tools_total: 0,
      tools: [],
      source: null,
      credentials_source: 'claude_oauth_cache',
      auth_attached: false,
      auth_redacted: true,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
      error: 'mcp_auth_missing',
      blocker: 'No non-expired Claude MCP OAuth token is available.',
      next_action: 'Re-authenticate the MCP server. No tools were invoked.',
    })

    expect(result).toMatchObject({
      canonical_status: 'CREDENTIAL_GATED',
      blocker_class: 'CREDENTIAL_GATED',
      read_enabled: false,
      tools_total: 0,
      execution_enabled: false,
      writes_enabled: false,
    })
  })

  it('classifies failed tools/list as SERVICE_DOWN and preserves no-tool-invocation truth', () => {
    const result = describeMcpToolDiscoveryResult({
      ok: false,
      status: 'unavailable',
      server: 'zapier',
      mcp_reachable: false,
      tools_total: 0,
      tools: [],
      source: 'server_authorization_header',
      credentials_source: 'claude_oauth_cache',
      auth_attached: true,
      auth_redacted: true,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
      error: 'mcp_tools_list_failed',
      blocker: 'MCP HTTP 503',
      next_action: 'Retry after confirming MCP server health. No tools were invoked.',
    })

    expect(result).toMatchObject({
      canonical_status: 'SERVICE_DOWN',
      blocker_class: 'SERVICE_DOWN',
      read_enabled: false,
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
    })
  })
})
