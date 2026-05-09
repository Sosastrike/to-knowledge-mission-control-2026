import { describe, expect, it } from 'vitest'
import {
  buildMcpServerRegistryPayload,
  buildMcpServerRegistryRecord,
} from './mcp-server-registry'

describe('MCP server registry contract', () => {
  it('adds canonical owner-facing status and keeps MCP execution disabled', () => {
    const payload = buildMcpServerRegistryPayload({
      generatedAt: '2026-05-09T00:00:00.000Z',
      discovery: {
        cli_ok: true,
        cli_stdout_length: 200,
        cli_stderr_length: 0,
        cli_error: null,
        fallback_used: false,
        config_servers_found: 2,
      },
      servers: [
        { name: 'zapier', transport: 'http', status: 'connected', source: 'claude-cli', tool_count: 4 },
        { name: 'filesystem', transport: 'stdio', status: 'needs_auth', source: 'claude-cli', error: 'authentication_required' },
        { name: 'slow-server', transport: 'http', status: 'failed', source: 'claude-cli', error: 'connection_failed' },
      ],
    })

    expect(payload).toMatchObject({
      mode: 'mcp_server_registry',
      ok: true,
      canonical_status: 'READY',
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
      summary: {
        total: 3,
        healthy: 1,
        degraded: 1,
        failed: 1,
        unknown: 0,
      },
    })
    expect(payload.allowed_owner_statuses).toEqual([
      'LIVE',
      'READY',
      'OWNER_GATED',
      'CREDENTIAL_GATED',
      'SERVICE_DOWN',
      'BLOCKED',
      'DISABLED',
    ])
    expect(payload.servers.map((server) => server.canonical_status)).toEqual([
      'READY',
      'CREDENTIAL_GATED',
      'SERVICE_DOWN',
    ])
    for (const server of payload.servers) {
      expect(server.execution_enabled).toBe(false)
      expect(server.writes_enabled).toBe(false)
      expect(server.bridge_session_required).toBe(true)
      expect(server.approval_required_for_writes).toBe(true)
      expect(server.tools_endpoint).toBe(`/api/mcp/servers/${server.id}/tools`)
    }
  })

  it('records exact empty-registry blocker without exposing local paths', () => {
    const syntheticBearer = 'Bearer ' + 'abc.def_1234567890123456'
    const payload = buildMcpServerRegistryPayload({
      generatedAt: '2026-05-09T00:00:00.000Z',
      servers: [],
      discovery: {
        cli_ok: false,
        cli_stdout_length: 0,
        cli_stderr_length: 0,
        cli_error: `spawn /Users/owner/.nvm/versions/node/bin/claude ENOENT with ${syntheticBearer}`,
        fallback_used: true,
        config_servers_found: 0,
      },
    })

    expect(payload).toMatchObject({
      summary: { total: 0 },
      canonical_status: 'SERVICE_DOWN',
      blocker_class: 'SERVICE_DOWN',
    })
    expect(JSON.stringify(payload)).not.toMatch(/\/Users\/owner|Bearer\s+abc\.def/i)
    expect(payload.blocker).toContain('claude_mcp_discovery_unavailable')
  })

  it('treats config-only unknown servers as ready for read-only inventory, not executable', () => {
    const server = buildMcpServerRegistryRecord({
      name: 'docs-server',
      transport: 'stdio',
      status: 'unknown',
      source: 'claude-user-mcp-config',
    })

    expect(server).toMatchObject({
      id: 'docs-server',
      canonical_status: 'READY',
      blocker_class: 'NONE',
      read_enabled: true,
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required: true,
    })
  })
})
