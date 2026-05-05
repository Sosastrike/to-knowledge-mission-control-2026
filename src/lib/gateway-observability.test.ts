import { describe, expect, it } from 'vitest'
import type { GatewayRegistry } from './gateway-model'
import { buildGatewayObservabilityPayload, replayGatewayRoute } from './gateway-observability'

const registry = {
  version: 'gateway_registry_v1',
  generated_at: '2026-05-04T00:00:00.000Z',
  nodes: [
    {
      id: 'owner',
      label: 'Owner',
      kind: 'owner',
      status: 'connected',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      health: { status: 'connected', summary: 'Owner connected', score: 100, last_seen: '2026-05-04T00:00:00.000Z' },
      capabilities: [],
      blockers: [],
    },
    {
      id: 'gateway',
      label: 'Gateway',
      kind: 'api',
      status: 'connected',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      health: { status: 'connected', summary: 'Gateway connected', score: 100, last_seen: '2026-05-04T00:00:00.000Z' },
      capabilities: [],
      blockers: [],
    },
    {
      id: 'agent_zero',
      label: 'Agent Zero',
      kind: 'commander',
      status: 'connected',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      health: { status: 'connected', summary: 'Agent Zero connected', score: 100, last_seen: '2026-05-04T00:00:00.000Z' },
      capabilities: [],
      blockers: [],
    },
    {
      id: 'integration_firecrawl',
      label: 'Firecrawl',
      kind: 'tool',
      status: 'blocked',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      health: { status: 'blocked', summary: 'Missing credential', score: 0, last_seen: null },
      capabilities: [],
      blockers: ['missing_credential'],
    },
  ],
  edges: [
    {
      source: 'owner',
      target: 'gateway',
      kind: 'command',
      allowed: true,
      requires_session: false,
      status: 'connected',
      blocker: null,
      last_seen: '2026-05-04T00:00:00.000Z',
    },
    {
      source: 'gateway',
      target: 'agent_zero',
      kind: 'command',
      allowed: true,
      requires_session: false,
      status: 'connected',
      blocker: null,
      last_seen: '2026-05-04T00:00:00.000Z',
    },
    {
      source: 'gateway',
      target: 'integration_firecrawl',
      kind: 'tool-call',
      allowed: false,
      requires_session: true,
      status: 'blocked',
      blocker: 'missing_credential',
      last_seen: '2026-05-04T00:00:00.000Z',
    },
  ],
  capabilities: [
    {
      id: 'integration_firecrawl',
      label: 'Firecrawl',
      kind: 'integration',
      status: 'blocked',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      read_enabled: true,
      available_to: ['agent_zero'],
      execution_requirements: ['bridge_session_required_for_writes'],
      write_enabled: false,
      execution_enabled: false,
      requires_session: true,
      required_tools: [],
      required_credentials: ['FIRECRAWL_API_KEY'],
      blockers: ['missing_credential'],
      status_details: {},
      source_node: 'integration_firecrawl',
      last_seen: '2026-05-04T00:00:00.000Z',
    },
    {
      id: 'model_openrouter',
      label: 'OpenRouter',
      kind: 'model',
      status: 'read_only',
      owner: 'ecosystem',
      visibility: 'owner_visible',
      read_enabled: true,
      available_to: ['agent_zero'],
      execution_requirements: ['bridge_session_required_for_model_execution'],
      write_enabled: false,
      execution_enabled: false,
      requires_session: true,
      required_tools: [],
      required_credentials: ['OPENROUTER_API_KEY'],
      blockers: [],
      status_details: {},
      source_node: 'model_openrouter',
      last_seen: '2026-05-04T00:00:00.000Z',
    },
  ],
  policies: {
    gateway_read_only: {
      auth_required: true,
      bridge_session_required: false,
      write_allowed: false,
      secret_safe: true,
      external_allowed: false,
    },
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

describe('Gateway observability and audit', () => {
  it('builds read-only traces, audit records, and observability metrics', () => {
    const payload = buildGatewayObservabilityPayload(registry)

    expect(payload.mode).toBe('gateway_observability_read_only')
    expect(payload.traces[0]).toMatchObject({
      source: 'owner',
      gateway: 'gateway',
      duration_ms: null,
      duration_source: 'not_recorded',
    })
    expect(payload.traces.every((trace) => trace.route.includes('gateway') || trace.source === 'owner')).toBe(true)
    expect(payload.audit_log.length).toBe(payload.traces.length * 2)
    expect(payload.metrics.health.by_status.connected).toBeGreaterThan(0)
    expect(payload.metrics.blockers).toEqual(expect.arrayContaining([{ reason: 'missing_credential', count: expect.any(Number) }]))
    expect(payload.metrics.external_writes.execution_enabled).toBe(false)
    expect(payload.metrics.llm_usage).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'openrouter', usage_available: false, total_tokens: null, cost_usd: null }),
    ]))
    expect(payload.replay_safe_mode).toMatchObject({
      enabled: true,
      plan_only: true,
      execution_enabled: false,
      writes_enabled: false,
    })
    expect(payload.execution_enabled).toBe(false)
    expect(payload.writes_enabled).toBe(false)
    expect(JSON.stringify(payload)).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|\/home\/tony/)
  })

  it('replays a route as plan-only without execution', () => {
    const replay = replayGatewayRoute(registry, 'Use Firecrawl on /home/tony/private with token=secret')

    expect(replay.mode).toBe('gateway_route_replay_safe_mode')
    expect(replay.replay_safe_mode).toBe(true)
    expect(replay.execution_enabled).toBe(false)
    expect(replay.writes_enabled).toBe(false)
    expect(replay.external_write_executed).toBe(false)
    expect(replay.trace.duration_source).toBe('replay_measurement')
    expect(replay.request).not.toContain('/home/tony')
    expect(JSON.stringify(replay)).not.toMatch(/token=secret|\/home\/tony/)
  })
})
