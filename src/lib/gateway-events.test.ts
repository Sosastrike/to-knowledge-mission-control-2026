import { describe, expect, it } from 'vitest'
import type { GatewayRegistry } from './gateway-model'
import { buildGatewayEventsPayload } from './gateway-events'

const registry = {
  version: 'gateway_registry_v1',
  generated_at: '2026-05-04T00:00:00.000Z',
  nodes: [],
  edges: [],
  capabilities: [
    {
      id: 'integration_telegram',
      label: 'Telegram',
      kind: 'integration',
      status: 'read_only',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      read_enabled: true,
      available_to: ['agent_zero'],
      execution_requirements: [],
      write_enabled: false,
      execution_enabled: false,
      requires_session: true,
      required_tools: [],
      required_credentials: ['TELEGRAM_BOT_TOKEN'],
      blockers: [],
      status_details: {},
      source_node: 'integrations',
      last_seen: '2026-05-04T00:00:00.000Z',
    },
    {
      id: 'integration_agentmail',
      label: 'AgentMail',
      kind: 'integration',
      status: 'read_only',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      read_enabled: true,
      available_to: ['agent_zero'],
      execution_requirements: [],
      write_enabled: false,
      execution_enabled: false,
      requires_session: true,
      required_tools: [],
      required_credentials: ['AGENTMAIL_API_KEY'],
      blockers: [],
      status_details: { incoming_status: 'connected' },
      source_node: 'integration_agentmail',
      last_seen: '2026-05-04T00:00:00.000Z',
    },
    {
      id: 'tool_report_create',
      label: 'Create report',
      kind: 'tool',
      status: 'read_only',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      read_enabled: true,
      available_to: ['agent_zero'],
      execution_requirements: [],
      write_enabled: false,
      execution_enabled: false,
      requires_session: false,
      required_tools: [],
      required_credentials: [],
      blockers: [],
      status_details: {},
      source_node: 'tools',
      last_seen: '2026-05-04T00:00:00.000Z',
    },
    {
      id: 'mcp_zapier',
      label: 'Zapier MCP',
      kind: 'mcp_server',
      status: 'read_only',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      read_enabled: true,
      available_to: ['agent_zero'],
      execution_requirements: [],
      write_enabled: false,
      execution_enabled: false,
      requires_session: true,
      required_tools: [],
      required_credentials: [],
      blockers: [],
      status_details: { schema_available: true },
      source_node: 'mcp_zapier',
      last_seen: '2026-05-04T00:00:00.000Z',
    },
    {
      id: 'brain_buildwiki',
      label: 'Build-Wiki / Farmer',
      kind: 'brain',
      status: 'read_only',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      read_enabled: true,
      available_to: ['agent_zero'],
      execution_requirements: [],
      write_enabled: false,
      execution_enabled: false,
      requires_session: true,
      required_tools: [],
      required_credentials: [],
      blockers: ['active_bridge_session_required_for_buildwiki_run_now'],
      status_details: { last_run_status: 'completed' },
      source_node: 'buildwiki',
      last_seen: '2026-05-04T00:00:00.000Z',
    },
  ],
  policies: {
    gateway_bridge_session_write: {
      auth_required: true,
      bridge_session_required: true,
      write_allowed: false,
      secret_safe: true,
      external_allowed: false,
    },
  },
  health: {},
} as GatewayRegistry

describe('Gateway event stream', () => {
  it('builds a read-only event stream for Gateway sources', () => {
    const payload = buildGatewayEventsPayload(registry)

    expect(payload.mode).toBe('gateway_events_read_only')
    expect(payload.events.map((event) => event.kind)).toEqual([
      'telegram_message',
      'email_received',
      'report_generated',
      'approval_requested',
      'tool_completed',
      'sync_completed',
    ])
    expect(payload.events.find((event) => event.kind === 'telegram_message')).toMatchObject({
      source: 'telegram',
      target: 'gateway',
      requires_bridge_session: false,
      write_event: false,
    })
    expect(payload.events.find((event) => event.kind === 'sync_completed')?.summary).toContain('completed')
    expect(payload.execution_enabled).toBe(false)
    expect(payload.writes_enabled).toBe(false)
    expect(payload.secrets_exposed).toBe(false)
    expect(JSON.stringify(payload)).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|\/home\/tony/)
  })
})
